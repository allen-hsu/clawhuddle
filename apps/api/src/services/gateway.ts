import Docker from 'dockerode';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { getOrgAllApiKeys } from '../routes/org/api-keys.js';
import { generateOpenClawConfig } from './openclaw-config.js';
import { installSkillsForUser } from './skill-installer.js';
import type { Skill, OrgMember } from '@clawhuddle/shared';
import { PROVIDERS } from '@clawhuddle/shared';


const docker = new Docker();

const GATEWAY_IMAGE = 'clawhuddle-gateway:local';
const GATEWAY_INTERNAL_PORT = 6100;
const CONTAINER_PREFIX = 'clawhuddle-gw-';
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || 'clawhuddle-net';
const DOMAIN = process.env.DOMAIN || 'localhost';

async function ensureNetwork(): Promise<void> {
  try {
    await docker.getNetwork(DOCKER_NETWORK).inspect();
  } catch {
    await docker.createNetwork({ Name: DOCKER_NETWORK, Driver: 'bridge' });
  }
}

async function checkGatewayHealth(containerName: string): Promise<boolean> {
  try {
    const container = docker.getContainer(containerName);
    const exec = await container.exec({
      Cmd: ['node', '-e', `fetch('http://127.0.0.1:${GATEWAY_INTERNAL_PORT}/').then(r=>(r.ok||r.status===401)?process.exit(0):process.exit(1)).catch(()=>process.exit(1))`],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    return new Promise<boolean>((resolve) => {
      stream.resume();
      stream.on('end', async () => {
        try {
          const info = await exec.inspect();
          resolve(info.ExitCode === 0);
        } catch {
          resolve(false);
        }
      });
      setTimeout(() => resolve(false), 5000);
    });
  } catch {
    return false;
  }
}

function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve('./data');
}

// Host path for Docker bind mounts — must be an absolute path on the HOST machine.
// In Docker Compose this is set to ${PWD}/data automatically.
// For local dev (no container), falls back to getDataDir() which is already on the host.
function getHostDataDir(): string {
  const dir = process.env.HOST_DATA_DIR || getDataDir();
  if (!path.isAbsolute(dir)) {
    throw new Error(`HOST_DATA_DIR must be an absolute path (got "${dir}"). Set it in .env or docker-compose.yml.`);
  }
  return dir;
}

function getGatewayDir(orgId: string, userId: string): string {
  return path.join(getDataDir(), 'gateways', orgId, userId);
}

function getHostGatewayDir(orgId: string, userId: string): string {
  return path.join(getHostDataDir(), 'gateways', orgId, userId);
}

function getContainerName(orgId: string, userId: string): string {
  // Keep under 63 chars for Docker DNS resolution
  return `${CONTAINER_PREFIX}${orgId.slice(0, 8)}-${userId.slice(0, 8)}`;
}

function generateSubdomain(): string {
  return crypto.randomBytes(4).toString('hex');
}

function getMember(orgId: string, memberId: string): OrgMember & { user_id: string } {
  const db = getDb();
  const member = db.prepare(
    'SELECT * FROM org_members WHERE id = ? AND org_id = ?'
  ).get(memberId, orgId) as (OrgMember & { user_id: string }) | undefined;
  if (!member) throw new Error('Member not found');
  return member;
}

function getMemberSkills(orgId: string, userId: string): Skill[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.* FROM skills s
       JOIN user_skills us ON us.skill_id = s.id
       WHERE us.user_id = ? AND us.enabled = 1 AND s.enabled = 1 AND s.org_id = ?
       UNION
       SELECT * FROM skills WHERE type = 'mandatory' AND enabled = 1 AND org_id = ?`
    )
    .all(userId, orgId, orgId) as Skill[];
}

function createTraefikLabels(containerName: string, subdomain: string): Record<string, string> {
  return {
    'traefik.enable': 'true',
    [`traefik.http.routers.${containerName}.rule`]: `Host(\`${subdomain}.${DOMAIN}\`)`,
    [`traefik.http.routers.${containerName}.entrypoints`]: 'web',
    [`traefik.http.services.${containerName}.loadbalancer.server.port`]: String(GATEWAY_INTERNAL_PORT),
    // Override proxy headers so OpenClaw sees a local connection and auto-approves device pairing
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-For`]: '127.0.0.1',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Real-IP`]: '127.0.0.1',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-Proto`]: '',
    // Strip Cloudflare proxy headers
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Connecting-IP`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.True-Client-IP`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-IPCountry`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Ray`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Visitor`]: '',
    [`traefik.http.routers.${containerName}.middlewares`]: `${containerName}-headers`,
  };
}

/**
 * Writes auth-profiles.json for a gateway so OpenClaw reads credentials
 * from the file (hot-reloaded) instead of env vars.
 * Returns the list of provider IDs that have credentials configured.
 */
function writeAuthProfiles(orgId: string, userId: string): string[] {
  const allKeys = getOrgAllApiKeys(orgId);
  const profiles: Record<string, Record<string, unknown>> = {};
  const providerIds: string[] = [];

  for (const { provider, key, credential_type } of allKeys) {
    const providerConfig = PROVIDERS.find((p) => p.id === provider);
    if (!providerConfig) continue;
    providerIds.push(provider);

    if (credential_type === 'oauth') {
      // key is a JSON blob — Codex format: { tokens: { access_token, refresh_token, ... } }
      try {
        const oauth = JSON.parse(key);
        const tokens = oauth.tokens ?? oauth;
        if (!tokens.access_token || !tokens.refresh_token) continue;

        // Extract expiry from JWT payload (middle segment)
        let expires: number | undefined;
        try {
          const payload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64').toString());
          if (payload.exp) expires = payload.exp;
        } catch { /* non-JWT or malformed — skip expires */ }

        profiles[`${provider}:oauth`] = {
          type: 'oauth',
          provider,
          access: tokens.access_token,
          refresh: tokens.refresh_token,
          ...(expires ? { expires } : {}),
        };
      } catch {
        // Skip malformed OAuth JSON
        continue;
      }
    } else if (credential_type === 'token') {
      profiles[`${provider}:setup-token`] = { type: 'token', provider, token: key };
    } else {
      profiles[`${provider}:manual`] = { type: 'api_key', provider, key };
    }
  }

  const authProfilesPath = path.join(
    getGatewayDir(orgId, userId),
    'agents', 'main', 'agent', 'auth-profiles.json'
  );
  fs.mkdirSync(path.dirname(authProfilesPath), { recursive: true });
  fs.writeFileSync(authProfilesPath, JSON.stringify({ version: 1, profiles }, null, 2));

  return providerIds;
}

/**
 * Live-update auth-profiles.json for all running gateways in an org.
 * Called after API key add/delete so credentials propagate without container restart.
 */
export function syncAuthProfiles(orgId: string): void {
  const db = getDb();
  const runningMembers = db.prepare(
    `SELECT om.user_id FROM org_members om
     WHERE om.org_id = ? AND om.gateway_status IN ('running', 'deploying')`
  ).all(orgId) as { user_id: string }[];

  for (const { user_id } of runningMembers) {
    const gatewayDir = getGatewayDir(orgId, user_id);
    if (fs.existsSync(gatewayDir)) {
      writeAuthProfiles(orgId, user_id);
    }
  }
}

const IS_LOCAL_DEV = DOMAIN === 'localhost';

function createContainerConfig(containerName: string, subdomain: string, orgId: string, userId: string) {
  const hostConfig: Record<string, any> = {
    Binds: [`${getHostGatewayDir(orgId, userId)}:/root/.openclaw`],
    RestartPolicy: { Name: 'unless-stopped' },
  };

  // Local dev: publish port so gateway is accessible without Traefik
  if (IS_LOCAL_DEV) {
    hostConfig.PortBindings = {
      [`${GATEWAY_INTERNAL_PORT}/tcp`]: [{ HostPort: '0' }], // 0 = random available port
    };
  }

  return {
    Image: GATEWAY_IMAGE,
    name: containerName,
    Env: [],
    Labels: createTraefikLabels(containerName, subdomain),
    ExposedPorts: { [`${GATEWAY_INTERNAL_PORT}/tcp`]: {} },
    HostConfig: hostConfig,
    NetworkingConfig: {
      EndpointsConfig: {
        [DOCKER_NETWORK]: {},
      },
    },
  };
}

// After container starts, read the actual host port Docker allocated
async function getHostPort(containerName: string): Promise<number | null> {
  if (!IS_LOCAL_DEV) return null;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    const portBindings = info.NetworkSettings.Ports[`${GATEWAY_INTERNAL_PORT}/tcp`];
    return portBindings?.[0]?.HostPort ? Number(portBindings[0].HostPort) : null;
  } catch {
    return null;
  }
}

export async function provisionGateway(orgId: string, memberId: string) {
  await ensureNetwork();
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (member.gateway_status === 'running' || member.gateway_status === 'deploying') {
    throw new Error('Gateway already running');
  }

  // Use fixed internal port, generate token and subdomain
  const port = GATEWAY_INTERNAL_PORT;
  const token = crypto.randomBytes(24).toString('hex');
  const subdomain = generateSubdomain();

  // Create workspace directory
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.mkdirSync(gatewayDir, { recursive: true });

  // Write auth-profiles.json (credentials read from file, not env vars)
  const providerIds = writeAuthProfiles(orgId, member.user_id);
  if (providerIds.length === 0) throw new Error('No API keys configured — add at least one provider key');

  // Get member's skills
  const skills = getMemberSkills(orgId, member.user_id);

  // Generate config
  const config = generateOpenClawConfig({ port, token, activeProviderIds: providerIds });
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories (still keyed by userId for filesystem)
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Update DB with provisioning status + token + subdomain
  db.prepare(
    'UPDATE org_members SET gateway_port = ?, gateway_status = ?, gateway_token = ?, gateway_subdomain = ? WHERE id = ?'
  ).run(port, 'provisioning', token, subdomain, memberId);

  try {
    // Create and start Docker container
    const containerName = getContainerName(orgId, member.user_id);

    // Remove existing container if any
    try {
      const existing = docker.getContainer(containerName);
      await existing.stop().catch(() => {});
      await existing.remove();
    } catch {
      // Container doesn't exist, that's fine
    }

    const container = await docker.createContainer(
      createContainerConfig(containerName, subdomain, orgId, member.user_id)
    );

    await container.start();

    // In local dev, read the actual host port Docker allocated
    const actualPort = (await getHostPort(containerName)) || port;
    if (actualPort !== port) {
      db.prepare('UPDATE org_members SET gateway_port = ? WHERE id = ?').run(actualPort, memberId);
    }

    // Mark as deploying — getGatewayStatus will promote to running after health check
    db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

    return { memberId, userId: member.user_id, gateway_port: actualPort, gateway_status: 'deploying' as const, gateway_subdomain: subdomain };
  } catch (err) {
    // Rollback DB on failure
    db.prepare(
      'UPDATE org_members SET gateway_port = NULL, gateway_status = NULL, gateway_subdomain = NULL WHERE id = ?'
    ).run(memberId);
    throw err;
  }
}

export async function stopGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error('No gateway deployed');

  const containerName = getContainerName(orgId, member.user_id);
  const container = docker.getContainer(containerName);
  await container.stop();

  db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('stopped', memberId);

  return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'stopped' as const };
}

export async function startGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error('No gateway deployed');

  const containerName = getContainerName(orgId, member.user_id);
  const container = docker.getContainer(containerName);
  await container.start();

  db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

  return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'deploying' as const };
}

export async function removeGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error('No gateway deployed');

  const containerName = getContainerName(orgId, member.user_id);
  try {
    const container = docker.getContainer(containerName);
    await container.stop().catch(() => {});
    await container.remove();
  } catch {
    // Container may already be removed
  }

  // Delete workspace
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  if (fs.existsSync(gatewayDir)) {
    fs.rmSync(gatewayDir, { recursive: true });
  }

  // Reset DB fields
  db.prepare(
    'UPDATE org_members SET gateway_port = NULL, gateway_status = NULL, gateway_token = NULL, gateway_subdomain = NULL WHERE id = ?'
  ).run(memberId);

  return { memberId, userId: member.user_id, gateway_port: null, gateway_status: null, gateway_subdomain: null };
}

export async function redeployGateway(orgId: string, memberId: string) {
  await ensureNetwork();
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port || !member.gateway_token || !member.gateway_subdomain) throw new Error('No gateway deployed');

  const containerName = getContainerName(orgId, member.user_id);

  // Stop and remove old container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop().catch(() => {});
    await existing.remove();
  } catch {
    // Container may not exist
  }

  // Write auth-profiles.json (credentials read from file, not env vars)
  const providerIds = writeAuthProfiles(orgId, member.user_id);
  if (providerIds.length === 0) throw new Error('No API keys configured — add at least one provider key');

  // Update config (keep existing token; skills installed as directories)
  const skills = getMemberSkills(orgId, member.user_id);
  const config = generateOpenClawConfig({ port: GATEWAY_INTERNAL_PORT, token: member.gateway_token, activeProviderIds: providerIds });
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Create new container (credentials via auth-profiles.json, no env vars needed)
  const container = await docker.createContainer(
    createContainerConfig(containerName, member.gateway_subdomain, orgId, member.user_id)
  );

  await container.start();

  // In local dev, read the actual host port Docker allocated
  const actualPort = (await getHostPort(containerName)) || member.gateway_port;
  if (actualPort !== member.gateway_port) {
    db.prepare('UPDATE org_members SET gateway_port = ? WHERE id = ?').run(actualPort, memberId);
  }

  db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

  return { memberId, userId: member.user_id, gateway_port: actualPort, gateway_status: 'deploying' as const };
}

export async function getGatewayStatus(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) {
    return { memberId, userId: member.user_id, gateway_port: null, gateway_status: null, gateway_subdomain: null };
  }

  // Sync DB with actual container + health state
  const containerName = getContainerName(orgId, member.user_id);
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();

    if (!info.State.Running) {
      if (member.gateway_status !== 'stopped') {
        db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('stopped', memberId);
      }
      return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'stopped' as const, gateway_subdomain: member.gateway_subdomain };
    }

    // Container is running — check if gateway HTTP is actually ready
    const healthy = await checkGatewayHealth(containerName);
    const actualStatus = healthy ? 'running' : 'deploying';

    if (actualStatus !== member.gateway_status) {
      db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run(actualStatus, memberId);
    }

    return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: actualStatus, gateway_subdomain: member.gateway_subdomain };
  } catch {
    // Container doesn't exist — mark as stopped
    if (member.gateway_status !== 'stopped') {
      db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('stopped', memberId);
    }
    return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'stopped' as const, gateway_subdomain: member.gateway_subdomain };
  }
}
