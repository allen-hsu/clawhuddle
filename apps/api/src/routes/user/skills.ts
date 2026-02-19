import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { redeployGateway } from '../../services/gateway.js';
import type { Skill, User } from '@clawteam/shared';

interface SkillWithUserStatus extends Skill {
  assigned: boolean;
}

export async function userSkillRoutes(app: FastifyInstance) {
  // List available skills with user's toggle status
  app.get('/api/me/skills', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
    if (!user) {
      return reply.status(404).send({ error: 'not_found', message: 'User not found' });
    }

    // All enabled skills (admin-enabled)
    const skills = db
      .prepare('SELECT * FROM skills WHERE enabled = 1 ORDER BY type, name')
      .all() as Skill[];

    // User's assigned skills
    const userSkills = db
      .prepare('SELECT skill_id FROM user_skills WHERE user_id = ? AND enabled = 1')
      .all(userId) as { skill_id: string }[];
    const assignedIds = new Set(userSkills.map((us) => us.skill_id));

    const result: SkillWithUserStatus[] = skills.map((s) => ({
      ...s,
      // mandatory skills are always assigned
      assigned: s.type === 'mandatory' || assignedIds.has(s.id),
    }));

    return { data: result };
  });

  // Toggle a skill on/off for the current user
  app.post<{ Params: { id: string }; Body: { enabled: boolean } }>(
    '/api/me/skills/:id',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string;
      if (!userId) {
        return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      }

      const { id } = request.params;
      const { enabled } = request.body;

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as User | undefined;
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      const skill = db.prepare('SELECT * FROM skills WHERE id = ? AND enabled = 1').get(id) as Skill | undefined;
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
      if (user.gateway_port && (user.gateway_status === 'running' || user.gateway_status === 'deploying')) {
        try {
          await redeployGateway(userId);
        } catch {
          // Redeploy failed, but skill toggle was saved
        }
      }

      return { data: { skill_id: id, enabled } };
    }
  );
}
