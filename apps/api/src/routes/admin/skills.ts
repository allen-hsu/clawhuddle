import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import type { CreateSkillRequest, UpdateSkillRequest, Skill, ScanRepoRequest, ImportSkillsRequest } from '@clawteam/shared';
import { scanRepoForSkills } from '../../services/skill-installer.js';

export async function adminSkillRoutes(app: FastifyInstance) {
  // List all skills
  app.get('/api/admin/skills', async () => {
    const db = getDb();
    const skills = db.prepare('SELECT * FROM skills ORDER BY created_at DESC').all();
    return { data: skills };
  });

  // Scan repo for skills
  app.post<{ Body: ScanRepoRequest }>('/api/admin/skills/scan', async (request, reply) => {
    const { git_url } = request.body;
    if (!git_url) {
      return reply.status(400).send({ error: 'validation', message: 'git_url is required' });
    }
    try {
      new URL(git_url);
    } catch {
      return reply.status(400).send({ error: 'validation', message: 'git_url must be a valid URL' });
    }
    try {
      const results = scanRepoForSkills(git_url);
      return { data: results };
    } catch (err: any) {
      return reply.status(500).send({ error: 'scan_failed', message: err.message });
    }
  });

  // Import multiple skills from a scanned repo
  app.post<{ Body: ImportSkillsRequest }>('/api/admin/skills/import', async (request, reply) => {
    const { git_url, skills } = request.body;
    if (!git_url || !skills?.length) {
      return reply.status(400).send({ error: 'validation', message: 'git_url and skills are required' });
    }

    const db = getDb();
    const created: Skill[] = [];

    for (const s of skills) {
      // Skip duplicates
      const existing = db.prepare('SELECT id FROM skills WHERE git_url = ? AND git_path = ?').get(git_url, s.git_path);
      if (existing) continue;

      const id = uuid();
      const skillPath = s.git_path.split('/').filter(Boolean).pop() || s.git_path;
      db.prepare(
        'INSERT INTO skills (id, name, description, type, path, git_url, git_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, s.name, null, 'optional', skillPath, git_url, s.git_path);

      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Skill;
      created.push(skill);
    }

    return reply.status(201).send({ data: created });
  });

  // Create skill
  app.post<{ Body: CreateSkillRequest }>('/api/admin/skills', async (request, reply) => {
    const { name, description, type, git_url, git_path } = request.body;
    if (!name || !git_url || !git_path) {
      return reply.status(400).send({ error: 'validation', message: 'name, git_url, and git_path are required' });
    }

    try {
      new URL(git_url);
    } catch {
      return reply.status(400).send({ error: 'validation', message: 'git_url must be a valid URL' });
    }

    // Auto-derive path (slug) from last segment of git_path
    const skillPath = git_path.split('/').filter(Boolean).pop() || git_path;

    const db = getDb();
    const id = uuid();
    db.prepare(
      'INSERT INTO skills (id, name, description, type, path, git_url, git_path) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(id, name, description || null, type || 'optional', skillPath, git_url, git_path);

    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    return reply.status(201).send({ data: skill });
  });

  // Update skill
  app.patch<{ Params: { id: string }; Body: UpdateSkillRequest }>(
    '/api/admin/skills/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { type, enabled, git_url, git_path } = request.body;

      const db = getDb();
      const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as Skill | undefined;
      if (!skill) {
        return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (type !== undefined) { updates.push('type = ?'); values.push(type); }
      if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
      if (git_url !== undefined) { updates.push('git_url = ?'); values.push(git_url); }
      if (git_path !== undefined) {
        updates.push('git_path = ?'); values.push(git_path);
        // Update derived path slug
        const skillPath = git_path.split('/').filter(Boolean).pop() || git_path;
        updates.push('path = ?'); values.push(skillPath);
      }

      if (updates.length > 0) {
        values.push(id);
        db.prepare(`UPDATE skills SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
      return { data: updated };
    }
  );

  // Delete skill
  app.delete<{ Params: { id: string } }>('/api/admin/skills/:id', async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const skill = db.prepare('SELECT * FROM skills WHERE id = ?').get(id);
    if (!skill) {
      return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
    }

    db.prepare('DELETE FROM user_skills WHERE skill_id = ?').run(id);
    db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return { data: { id, deleted: true } };
  });
}
