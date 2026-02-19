import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { authPlugin } from '../middleware/auth.js';
import type { CreateOrgRequest } from '@clawteam/shared';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export async function orgRoutes(app: FastifyInstance) {
  // All routes here require auth
  await app.register(authPlugin);

  // List user's organizations
  app.get('/api/orgs', async (request) => {
    const db = getDb();
    const orgs = db.prepare(
      `SELECT o.*, om.role as member_role
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = ? AND om.status = 'active'
       ORDER BY o.name`
    ).all(request.currentUser!.id);

    return { data: orgs };
  });

  // Create organization
  app.post<{ Body: CreateOrgRequest }>('/api/orgs', async (request, reply) => {
    const { name, slug: customSlug } = request.body;
    if (!name) {
      return reply.status(400).send({ error: 'validation', message: 'name is required' });
    }

    const db = getDb();
    const slug = customSlug || slugify(name);

    const existing = db.prepare('SELECT id FROM organizations WHERE slug = ?').get(slug);
    if (existing) {
      return reply.status(409).send({ error: 'conflict', message: 'Organization slug already taken' });
    }

    const orgId = uuid();
    const memberId = uuid();

    db.prepare('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)').run(orgId, name, slug);
    db.prepare(
      "INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, 'owner')"
    ).run(memberId, orgId, request.currentUser!.id);

    const org = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId);
    return reply.status(201).send({ data: org });
  });

}
