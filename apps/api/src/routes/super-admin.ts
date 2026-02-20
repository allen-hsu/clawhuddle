import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { authPlugin } from '../middleware/auth.js';

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL;

export async function superAdminRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  // Guard: every route in this scope requires super admin
  app.addHook('onRequest', async (request, reply) => {
    if (request.currentUser?.email !== SUPER_ADMIN_EMAIL) {
      return reply.status(403).send({ error: 'forbidden', message: 'Super admin only' });
    }
  });

  // List all organizations
  app.get('/api/super-admin/orgs', async () => {
    const db = getDb();
    const orgs = db.prepare(
      `SELECT o.*,
              (SELECT COUNT(*) FROM org_members om WHERE om.org_id = o.id AND om.status = 'active') as member_count
       FROM organizations o
       ORDER BY o.created_at DESC`
    ).all();
    return { data: orgs };
  });

  // Update an org's tier
  app.patch<{ Params: { id: string }; Body: { tier: string } }>(
    '/api/super-admin/orgs/:id/tier',
    async (request, reply) => {
      const { id } = request.params;
      const { tier } = request.body;

      if (!['free', 'pro', 'enterprise'].includes(tier)) {
        return reply.status(400).send({ error: 'validation', message: 'Invalid tier' });
      }

      const db = getDb();
      const org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(id);
      if (!org) {
        return reply.status(404).send({ error: 'not_found', message: 'Organization not found' });
      }

      db.prepare('UPDATE organizations SET tier = ? WHERE id = ?').run(tier, id);
      const updated = db.prepare('SELECT * FROM organizations WHERE id = ?').get(id);
      return { data: updated };
    }
  );

  // Check super admin status
  app.get('/api/super-admin/check', async () => {
    return { data: { isSuperAdmin: true } };
  });
}
