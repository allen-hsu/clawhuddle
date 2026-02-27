import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { redeployGateway } from '../../services/gateway.js';
import type { Skill, BatchUpdateUserSkillsRequest } from '@clawhuddle/shared';

interface SkillWithUserStatus extends Skill {
  assigned: boolean;
}

export async function orgUserSkillRoutes(app: FastifyInstance) {
  // List available skills with user's toggle status
  app.get('/api/orgs/:orgId/me/skills', async (request, reply) => {
    const userId = request.currentUser!.id;
    const orgId = request.orgId!;

    const db = getDb();

    // All enabled skills for this org
    const skills = db
      .prepare('SELECT * FROM skills WHERE org_id = ? AND enabled = 1 ORDER BY type, name')
      .all(orgId) as Skill[];

    // User's assigned skills
    const userSkills = db
      .prepare('SELECT skill_id FROM user_skills WHERE user_id = ? AND enabled = 1')
      .all(userId) as { skill_id: string }[];
    const assignedIds = new Set(userSkills.map((us) => us.skill_id));

    const result: SkillWithUserStatus[] = skills.map((s) => ({
      ...s,
      assigned: s.type === 'mandatory' || assignedIds.has(s.id),
    }));

    return { data: result };
  });

  // Batch update skills for the current user
  app.put<{ Params: { orgId: string }; Body: BatchUpdateUserSkillsRequest }>(
    '/api/orgs/:orgId/me/skills',
    async (request, reply) => {
      const userId = request.currentUser!.id;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;
      const { skills: updates } = request.body;

      if (!Array.isArray(updates) || updates.length === 0) {
        return reply.status(400).send({ error: 'validation', message: 'skills array is required' });
      }

      const db = getDb();

      // Validate all skill IDs exist, are org-enabled, and not mandatory
      const orgSkills = db
        .prepare('SELECT id, type FROM skills WHERE org_id = ? AND enabled = 1')
        .all(orgId) as Pick<Skill, 'id' | 'type'>[];
      const orgSkillMap = new Map(orgSkills.map((s) => [s.id, s]));

      for (const u of updates) {
        const skill = orgSkillMap.get(u.id);
        if (!skill) {
          return reply.status(404).send({ error: 'not_found', message: `Skill ${u.id} not found` });
        }
        if (skill.type === 'mandatory') {
          return reply.status(400).send({ error: 'validation', message: `Cannot toggle mandatory skill ${u.id}` });
        }
      }

      // Upsert all in a single transaction
      const upsert = db.prepare(
        `INSERT INTO user_skills (user_id, skill_id, enabled) VALUES (?, ?, ?)
         ON CONFLICT(user_id, skill_id) DO UPDATE SET enabled = ?`
      );
      const tx = db.transaction(() => {
        for (const u of updates) {
          upsert.run(userId, u.id, u.enabled ? 1 : 0, u.enabled ? 1 : 0);
        }
      });
      tx();

      // Single redeploy at the end
      const member = request.orgMember!;
      if (member.gateway_port && (member.gateway_status === 'running' || member.gateway_status === 'deploying')) {
        try {
          await redeployGateway(orgId, memberId);
        } catch {
          // Redeploy failed, but skill toggles were saved
        }
      }

      return { data: { updated: updates.length } };
    }
  );

  // Toggle a skill on/off for the current user
  app.post<{ Params: { orgId: string; id: string }; Body: { enabled: boolean } }>(
    '/api/orgs/:orgId/me/skills/:id',
    async (request, reply) => {
      const userId = request.currentUser!.id;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;
      const { id } = request.params;
      const { enabled } = request.body;

      const db = getDb();

      const skill = db.prepare(
        'SELECT * FROM skills WHERE id = ? AND org_id = ? AND enabled = 1'
      ).get(id, orgId) as Skill | undefined;

      if (!skill) {
        return reply.status(404).send({ error: 'not_found', message: 'Skill not found' });
      }

      if (skill.type === 'mandatory') {
        return reply.status(400).send({ error: 'validation', message: 'Cannot toggle mandatory skills' });
      }

      // Upsert user_skills
      db.prepare(
        `INSERT INTO user_skills (user_id, skill_id, enabled) VALUES (?, ?, ?)
         ON CONFLICT(user_id, skill_id) DO UPDATE SET enabled = ?`
      ).run(userId, id, enabled ? 1 : 0, enabled ? 1 : 0);

      // Auto-redeploy if gateway is running or deploying
      const member = request.orgMember!;
      if (member.gateway_port && (member.gateway_status === 'running' || member.gateway_status === 'deploying')) {
        try {
          await redeployGateway(orgId, memberId);
        } catch {
          // Redeploy failed, but skill toggle was saved
        }
      }

      return { data: { skill_id: id, enabled } };
    }
  );
}
