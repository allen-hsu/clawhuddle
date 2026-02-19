import Docker from 'dockerode';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../db/index.js';
import { getCompanyApiKey } from '../routes/admin/api-keys.js';
import { generateOpenClawConfig } from './openclaw-config.js';
import { installSkillsForUser } from './skill-installer.js';
import type { Skill, User } from '@clawteam/shared';

const docker = new Docker();

const GATEWAY_IMAGE = 'clawteam-gateway:local';
const PORT_START = 6001;
const CONTAINER_PREFIX = 'clawteam-gw-';

async function checkGatewayHealth(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}

function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve('./data');
}

function getGatewayDir(userId: string): string {
  return path.join(getDataDir(), 'gateways', userId);
}

function allocatePort(): number {
  const db = getDb();
  const row = db.prepare('SELECT MAX(gateway_port) as max_port FROM users').get() as {
    max_port: number | null;
  };
  return (row.max_port || PORT_START - 1) + 1;
}

function getUserSkills(userId: string): Skill[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.* FROM skills s
       JOIN user_skills us ON us.skill_id = s.id
       WHERE us.user_id = ? AND us.enabled = 1 AND s.enabled = 1
       UNION
       SELECT * FROM skills WHERE type = 'mandatory' AND enabled = 1`
    )
    .all(userId) as Skill[];
}

export async function provisionGateway(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (user.gateway_status === 'running' || user.gateway_status === 'deploying') throw new Error('Gateway already running');

  const anthropicApiKey = getCompanyApiKey('anthropic');
  if (!anthropicApiKey) throw new Error('No Anthropic API key configured');

  // Allocate port and generate token
  const port = allocatePort();
  const token = crypto.randomBytes(24).toString('hex');

  // Get user's skills
  const skills = getUserSkills(userId);

  // Generate config (skills are installed as directories, not in config)
  const config = generateOpenClawConfig({ port, token });

  // Create workspace directory
  const gatewayDir = getGatewayDir(userId);
  fs.mkdirSync(gatewayDir, { recursive: true });
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(userId, skills);

  // Update DB with provisioning status + token
  db.prepare(
    'UPDATE users SET gateway_port = ?, gateway_status = ?, gateway_token = ? WHERE id = ?'
  ).run(port, 'provisioning', token, userId);

  try {
    // Create and start Docker container
    const containerName = `${CONTAINER_PREFIX}${userId}`;

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
        Binds: [`${gatewayDir}:/root/.openclaw`],
        RestartPolicy: { Name: 'unless-stopped' },
      },
    });

    await container.start();

    // Mark as deploying — getGatewayStatus will promote to running after health check
    db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('deploying', userId);

    return { userId, gateway_port: port, gateway_status: 'deploying' as const };
  } catch (err) {
    // Rollback DB on failure
    db.prepare(
      'UPDATE users SET gateway_port = NULL, gateway_status = NULL WHERE id = ?'
    ).run(userId);
    throw err;
  }
}

export async function stopGateway(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (!user.gateway_port) throw new Error('No gateway deployed');

  const containerName = `${CONTAINER_PREFIX}${userId}`;
  const container = docker.getContainer(containerName);
  await container.stop();

  db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('stopped', userId);

  return { userId, gateway_port: user.gateway_port, gateway_status: 'stopped' as const };
}

export async function startGateway(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (!user.gateway_port) throw new Error('No gateway deployed');

  const containerName = `${CONTAINER_PREFIX}${userId}`;
  const container = docker.getContainer(containerName);
  await container.start();

  db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('deploying', userId);

  return { userId, gateway_port: user.gateway_port, gateway_status: 'deploying' as const };
}

export async function removeGateway(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (!user.gateway_port) throw new Error('No gateway deployed');

  const containerName = `${CONTAINER_PREFIX}${userId}`;
  try {
    const container = docker.getContainer(containerName);
    await container.stop().catch(() => {});
    await container.remove();
  } catch {
    // Container may already be removed
  }

  // Delete workspace
  const gatewayDir = getGatewayDir(userId);
  if (fs.existsSync(gatewayDir)) {
    fs.rmSync(gatewayDir, { recursive: true });
  }

  // Reset DB fields
  db.prepare(
    'UPDATE users SET gateway_port = NULL, gateway_status = NULL, gateway_token = NULL WHERE id = ?'
  ).run(userId);

  return { userId, gateway_port: null, gateway_status: null };
}

export async function redeployGateway(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (!user.gateway_port || !user.gateway_token) throw new Error('No gateway deployed');

  const anthropicApiKey = getCompanyApiKey('anthropic');
  if (!anthropicApiKey) throw new Error('No Anthropic API key configured');

  const containerName = `${CONTAINER_PREFIX}${userId}`;

  // Stop and remove old container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop().catch(() => {});
    await existing.remove();
  } catch {
    // Container may not exist
  }

  // Update config (keep existing token; skills installed as directories)
  const skills = getUserSkills(userId);
  const config = generateOpenClawConfig({ port: user.gateway_port, token: user.gateway_token });
  const gatewayDir = getGatewayDir(userId);
  fs.writeFileSync(path.join(gatewayDir, 'openclaw.json'), JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(userId, skills);

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
  db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('deploying', userId);

  return { userId, gateway_port: user.gateway_port, gateway_status: 'deploying' as const };
}

export async function getGatewayStatus(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
  if (!user) throw new Error('User not found');
  if (!user.gateway_port) {
    return { userId, gateway_port: null, gateway_status: null };
  }

  // Sync DB with actual container + health state
  const containerName = `${CONTAINER_PREFIX}${userId}`;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();

    if (!info.State.Running) {
      if (user.gateway_status !== 'stopped') {
        db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('stopped', userId);
      }
      return { userId, gateway_port: user.gateway_port, gateway_status: 'stopped' as const };
    }

    // Container is running — check if gateway HTTP is actually ready
    const healthy = await checkGatewayHealth(user.gateway_port);
    const actualStatus = healthy ? 'running' : 'deploying';

    if (actualStatus !== user.gateway_status) {
      db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run(actualStatus, userId);
    }

    return { userId, gateway_port: user.gateway_port, gateway_status: actualStatus };
  } catch {
    // Container doesn't exist — mark as stopped
    if (user.gateway_status !== 'stopped') {
      db.prepare('UPDATE users SET gateway_status = ? WHERE id = ?').run('stopped', userId);
    }
    return { userId, gateway_port: user.gateway_port, gateway_status: 'stopped' as const };
  }
}
