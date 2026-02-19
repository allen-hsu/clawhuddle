import Docker from 'dockerode';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { getOrgApiKey } from '../routes/org/api-keys.js';
import { generateOpenClawConfig } from './openclaw-config.js';
import { installSkillsForUser } from './skill-installer.js';
import type { Skill, OrgMember } from '@clawhuddle/shared';

const docker = new Docker();

const GATEWAY_IMAGE = 'clawhuddle-gateway:local';
const GATEWAY_INTERNAL_PORT = 6100;
const CONTAINER_PREFIX = 'clawhuddle-gw-';
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || 'clawhuddle-net';
const DOMAIN = process.env.DOMAIN || 'localhost';

async function checkGatewayHealth(containerName: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://${containerName}:${GATEWAY_INTERNAL_PORT}/`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve('./data');
}

// Host path for Docker bind mounts (Docker daemon runs on host, not inside this container)
function getHostDataDir(): string {
  return process.env.HOST_DATA_DIR || getDataDir();
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
    // Strip proxy headers so OpenClaw sees a direct connection and auto-approves device pairing
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-For`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Real-IP`]: '',
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-Proto`]: '',
    [`traefik.http.routers.${containerName}.middlewares`]: `${containerName}-headers`,
  };
}

function createContainerConfig(containerName: string, subdomain: string, anthropicApiKey: string, orgId: string, userId: string) {
  return {
    Image: GATEWAY_IMAGE,
    name: containerName,
    Env: [`ANTHROPIC_API_KEY=${anthropicApiKey}`],
    Labels: createTraefikLabels(containerName, subdomain),
    HostConfig: {
      Binds: [`${getHostGatewayDir(orgId, userId)}:/root/.openclaw`],
      RestartPolicy: { Name: 'unless-stopped' as const },
    },
    NetworkingConfig: {
      EndpointsConfig: {
        [DOCKER_NETWORK]: {},
      },
    },
  };
}

export async function provisionGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (member.gateway_status === 'running' || member.gateway_status === 'deploying') {
    throw new Error('Gateway already running');
  }

  const anthropicApiKey = getOrgApiKey(orgId, 'anthropic');
  if (!anthropicApiKey) throw new Error('No Anthropic API key configured');

  // Use fixed internal port, generate token and subdomain
  const port = GATEWAY_INTERNAL_PORT;
  const token = crypto.randomBytes(24).toString('hex');
  const subdomain = generateSubdomain();

  // Get member's skills
  const skills = getMemberSkills(orgId, member.user_id);

  // Generate config
  const config = generateOpenClawConfig({ port, token });

  // Create workspace directory
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.mkdirSync(gatewayDir, { recursive: true });
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
      createContainerConfig(containerName, subdomain, anthropicApiKey, orgId, member.user_id)
    );

    await container.start();

    // Mark as deploying — getGatewayStatus will promote to running after health check
    db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

    return { memberId, userId: member.user_id, gateway_port: port, gateway_status: 'deploying' as const, gateway_subdomain: subdomain };
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
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port || !member.gateway_token || !member.gateway_subdomain) throw new Error('No gateway deployed');

  const anthropicApiKey = getOrgApiKey(orgId, 'anthropic');
  if (!anthropicApiKey) throw new Error('No Anthropic API key configured');

  const containerName = getContainerName(orgId, member.user_id);

  // Stop and remove old container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop().catch(() => {});
    await existing.remove();
  } catch {
    // Container may not exist
  }

  // Update config (keep existing token; skills installed as directories)
  const skills = getMemberSkills(orgId, member.user_id);
  const config = generateOpenClawConfig({ port: GATEWAY_INTERNAL_PORT, token: member.gateway_token });
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Create new container with updated env vars
  const container = await docker.createContainer(
    createContainerConfig(containerName, member.gateway_subdomain, anthropicApiKey, orgId, member.user_id)
  );

  await container.start();
  db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

  return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'deploying' as const };
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
