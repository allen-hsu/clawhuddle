import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Skill } from '@clawhuddle/shared';

function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve('./data');
}

function getRepoDir(gitUrl: string): string {
  const hash = crypto.createHash('sha256').update(gitUrl).digest('hex').slice(0, 16);
  return path.join(getDataDir(), 'skill-repos', hash);
}

export function cloneOrUpdateRepo(gitUrl: string): string {
  if (!/^https?:\/\//.test(gitUrl) && !/^git@/.test(gitUrl)) {
    throw new Error(`Invalid git URL: ${gitUrl}`);
  }

  const repoDir = getRepoDir(gitUrl);

  if (fs.existsSync(path.join(repoDir, '.git'))) {
    const pull = spawnSync('git', ['pull'], { cwd: repoDir, stdio: 'pipe', timeout: 30_000 });
    if (pull.status !== 0) throw new Error(`git pull failed: ${pull.stderr?.toString()}`);
  } else {
    fs.mkdirSync(path.dirname(repoDir), { recursive: true });
    const clone = spawnSync('git', ['clone', '--depth', '1', gitUrl, repoDir], { stdio: 'pipe', timeout: 60_000 });
    if (clone.status !== 0) throw new Error(`git clone failed: ${clone.stderr?.toString()}`);
  }

  return repoDir;
}

export function scanRepoForSkills(gitUrl: string): { name: string; git_path: string }[] {
  const repoDir = cloneOrUpdateRepo(gitUrl);
  const results: { name: string; git_path: string }[] = [];

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = path.join(dir, entry.name);
      const skillMd = path.join(fullPath, 'SKILL.md');
      if (fs.existsSync(skillMd)) {
        results.push({
          name: entry.name,
          git_path: path.relative(repoDir, fullPath),
        });
      }
      walk(fullPath);
    }
  }

  // Also check repo root for SKILL.md
  if (fs.existsSync(path.join(repoDir, 'SKILL.md'))) {
    results.push({
      name: path.basename(repoDir),
      git_path: '.',
    });
  }

  walk(repoDir);
  return results;
}

export async function installSkillsForUser(userId: string, skills: Skill[]): Promise<void> {
  const skillsDir = path.join(getDataDir(), 'gateways', userId, 'skills');

  // Clear existing installed skills
  if (fs.existsSync(skillsDir)) {
    fs.rmSync(skillsDir, { recursive: true });
  }
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const skill of skills) {
    if (!skill.git_url || !skill.git_path) continue;

    const repoDir = cloneOrUpdateRepo(skill.git_url);
    const srcDir = path.resolve(repoDir, skill.git_path);

    // Prevent path traversal outside repo directory
    if (!srcDir.startsWith(path.resolve(repoDir) + path.sep) && srcDir !== path.resolve(repoDir)) {
      console.warn(`Path traversal blocked: ${skill.git_path} (skill: ${skill.name})`);
      continue;
    }

    if (!fs.existsSync(srcDir)) {
      console.warn(`Skill source not found: ${srcDir} (skill: ${skill.name})`);
      continue;
    }

    // Derive skill dir name from last segment of git_path
    const skillName = path.basename(skill.git_path);
    const destDir = path.join(skillsDir, skillName);

    fs.cpSync(srcDir, destDir, { recursive: true });
  }
}
