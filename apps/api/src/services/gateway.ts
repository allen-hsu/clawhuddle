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
const PORT_START = 6001;
const CONTAINER_PREFIX = 'clawhuddle-gw-';

function getGatewayHost(): string {
  // In Docker, reach the host network via host.docker.internal or gateway IP
  return process.env.GATEWAY_HOST || '127.0.0.1';
}

async function checkGatewayHealth(port: number): Promise<boolean> {
  try {
    const host = getGatewayHost();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://${host}:${port}/`, { signal: controller.signal });
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
  return `${CONTAINER_PREFIX}${orgId}-${userId}`;
}

function allocatePort(): number {
  const db = getDb();
  const row = db.prepare('SELECT MAX(gateway_port) as max_port FROM org_members').get() as {
    max_port: number | null;
  };
  return (row.max_port || PORT_START - 1) + 1;
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

export async function provisionGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (member.gateway_status === 'running' || member.gateway_status === 'deploying') {
    throw new Error('Gateway already running');
  }

  const anthropicApiKey = getOrgApiKey(orgId, 'anthropic');
  if (!anthropicApiKey) throw new Error('No Anthropic API key configured');

  // Allocate port and generate token
  const port = allocatePort();
  const token = crypto.randomBytes(24).toString('hex');

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

  // Update DB with provisioning status + token
  db.prepare(
    'UPDATE org_members SET gateway_port = ?, gateway_status = ?, gateway_token = ? WHERE id = ?'
  ).run(port, 'provisioning', token, memberId);

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

    const container = await docker.createContainer({
      Image: GATEWAY_IMAGE,
      name: containerName,
      Env: [`ANTHROPIC_API_KEY=${anthropicApiKey}`],
      HostConfig: {
        NetworkMode: 'host',
        Binds: [`${getHostGatewayDir(orgId, member.user_id)}:/root/.openclaw`],
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });

    await container.start();

    // Mark as deploying — getGatewayStatus will promote to running after health check
    db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

    return { memberId, userId: member.user_id, gateway_port: port, gateway_status: 'deploying' as const };
  } catch (err) {
    // Rollback DB on failure
    db.prepare(
      'UPDATE org_members SET gateway_port = NULL, gateway_status = NULL WHERE id = ?'
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
    'UPDATE org_members SET gateway_port = NULL, gateway_status = NULL, gateway_token = NULL WHERE id = ?'
  ).run(memberId);

  return { memberId, userId: member.user_id, gateway_port: null, gateway_status: null };
}

export async function redeployGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port || !member.gateway_token) throw new Error('No gateway deployed');

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
  const config = generateOpenClawConfig({ port: member.gateway_port, token: member.gateway_token });
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Create new container with updated env vars
  const container = await docker.createContainer({
    Image: GATEWAY_IMAGE,
    name: containerName,
    Env: [`ANTHROPIC_API_KEY=${anthropicApiKey}`],
    HostConfig: {
      NetworkMode: 'host',
      Binds: [`${gatewayDir}:/root/.openclaw`],
      RestartPolicy: { Name: 'unless-stopped' },
    },
  });

  await container.start();
  db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('deploying', memberId);

  return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'deploying' as const };
}

export async function getGatewayStatus(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) {
    return { memberId, userId: member.user_id, gateway_port: null, gateway_status: null };
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
      return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'stopped' as const };
    }

    // Container is running — check if gateway HTTP is actually ready
    const healthy = await checkGatewayHealth(member.gateway_port);
    const actualStatus = healthy ? 'running' : 'deploying';

    if (actualStatus !== member.gateway_status) {
      db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run(actualStatus, memberId);
    }

    return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: actualStatus };
  } catch {
    // Container doesn't exist — mark as stopped
    if (member.gateway_status !== 'stopped') {
      db.prepare('UPDATE org_members SET gateway_status = ? WHERE id = ?').run('stopped', memberId);
    }
    return { memberId, userId: member.user_id, gateway_port: member.gateway_port, gateway_status: 'stopped' as const };
  }
}
