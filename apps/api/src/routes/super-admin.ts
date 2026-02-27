import { FastifyInstance } from 'fastify';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db/index.js';
import { authPlugin } from '../middleware/auth.js';
import { deleteOrgGateways } from '../services/gateway.js';
import { purgeOrgFromDb } from './orgs.js';

export async function superAdminRoutes(app: FastifyInstance) {
  await app.register(authPlugin);

  // Guard: every route in this scope requires super admin
  app.addHook('onRequest', async (request, reply) => {
    if (request.currentUser?.email !== process.env.SUPER_ADMIN_EMAIL) {
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

  // Delete an organization (removes all gateways + data)
  app.delete<{ Params: { id: string } }>(
    '/api/super-admin/orgs/:id',
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const org = db.prepare('SELECT id FROM organizations WHERE id = ?').get(id);
      if (!org) {
        return reply.status(404).send({ error: 'not_found', message: 'Organization not found' });
      }

      await deleteOrgGateways(id);
      purgeOrgFromDb(db, id);

      return reply.status(200).send({ data: { deleted: true } });
    }
  );

  // Check super admin status
  app.get('/api/super-admin/check', async () => {
    return { data: { isSuperAdmin: true } };
  });

  // --- Access allowlist rules ---

  // List all access rules
  app.get('/api/super-admin/access-rules', async () => {
    const db = getDb();
    const rules = db.prepare('SELECT * FROM access_allowlist ORDER BY created_at DESC').all();
    return { data: rules };
  });

  // Add an access rule
  app.post<{ Body: { type: string; value: string } }>(
    '/api/super-admin/access-rules',
    async (request, reply) => {
      const { type, value } = request.body;

      if (!type || !value) {
        return reply.status(400).send({ error: 'validation', message: 'type and value are required' });
      }
      if (type !== 'domain' && type !== 'email') {
        return reply.status(400).send({ error: 'validation', message: 'type must be "domain" or "email"' });
      }

      const db = getDb();
      const id = uuid();
      const normalized = value.toLowerCase().trim();

      try {
        db.prepare('INSERT INTO access_allowlist (id, type, value) VALUES (?, ?, ?)').run(id, type, normalized);
      } catch (err: any) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return reply.status(409).send({ error: 'conflict', message: 'Rule already exists' });
        }
        throw err;
      }

      const rule = db.prepare('SELECT * FROM access_allowlist WHERE id = ?').get(id);
      return { data: rule };
    }
  );

  // Delete an access rule
  app.delete<{ Params: { id: string } }>(
    '/api/super-admin/access-rules/:id',
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const rule = db.prepare('SELECT id FROM access_allowlist WHERE id = ?').get(id);
      if (!rule) {
        return reply.status(404).send({ error: 'not_found', message: 'Rule not found' });
      }

      db.prepare('DELETE FROM access_allowlist WHERE id = ?').run(id);
      return { data: { deleted: true } };
    }
  );
}
