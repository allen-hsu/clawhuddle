import { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { v4 as uuid } from 'uuid';
import type { AcceptInviteRequest } from '@clawhuddle/shared';

export async function authRoutes(app: FastifyInstance) {
  // Check if an email is allowed to sign in (public — called by NextAuth signIn callback)
  app.get<{ Querystring: { email: string } }>(
    '/api/auth/check-access',
    async (request, reply) => {
      const { email } = request.query;
      if (!email) {
        return reply.status(400).send({ error: 'validation', message: 'email is required' });
      }

      const db = getDb();
      const rules = db.prepare('SELECT type, value FROM access_allowlist').all() as { type: string; value: string }[];

      // No rules = open registration
      if (rules.length === 0) {
        return { allowed: true };
      }

      const normalizedEmail = email.toLowerCase().trim();
      const domain = normalizedEmail.split('@')[1];

      const allowed = rules.some((rule) => {
        if (rule.type === 'email') return rule.value === normalizedEmail;
        if (rule.type === 'domain') return domain === rule.value;
        return false;
      });

      return { allowed };
    }
  );

  // Called by NextAuth on login to sync user
  app.post<{ Body: { email: string; name?: string; avatar_url?: string } }>(
    '/api/auth/login',
    async (request, reply) => {
      const { email, name, avatar_url } = request.body;
      if (!email) {
        return reply.status(400).send({ error: 'validation', message: 'email is required' });
      }

      const db = getDb();
      let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

      if (!user) {
        // Auto-create user on first login
        const id = uuid();

        db.prepare(
          'INSERT INTO users (id, email, name, avatar_url) VALUES (?, ?, ?, ?)'
        ).run(id, email, name || null, avatar_url || null);

        user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      } else {
        // Update last login and optionally name/avatar
        const updates: string[] = ['last_login = CURRENT_TIMESTAMP'];
        const values: any[] = [];

        if (name && !user.name) {
          updates.push('name = ?');
          values.push(name);
        }
        if (avatar_url && !user.avatar_url) {
          updates.push('avatar_url = ?');
          values.push(avatar_url);
        }

        values.push(user.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }

      if (user.status === 'disabled') {
        return reply.status(403).send({ error: 'forbidden', message: 'Account is disabled' });
      }

      return { data: user };
    }
  );

  // View invitation details (public — no auth needed so invitees can see before signing in)
  app.get<{ Params: { token: string } }>('/api/invitations/:token', async (request, reply) => {
    const { token } = request.params;
    const db = getDb();

    const invitation = db.prepare(
      `SELECT i.*, o.name as org_name, u.name as invited_by_name
       FROM invitations i
       JOIN organizations o ON o.id = i.org_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.token = ? AND i.status = 'pending'`
    ).get(token) as any;

    if (!invitation) {
      return reply.status(404).send({ error: 'not_found', message: 'Invitation not found' });
    }

    if (new Date(invitation.expires_at) < new Date()) {
      return reply.status(410).send({ error: 'expired', message: 'Invitation has expired' });
    }

    return {
      data: {
        id: invitation.id,
        org_name: invitation.org_name,
        email: invitation.email,
        role: invitation.role,
        invited_by_name: invitation.invited_by_name,
        expires_at: invitation.expires_at,
      },
    };
  });

  // Get current user info + org list
  app.get('/api/auth/me', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string;
    if (!userId) {
      return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return reply.status(404).send({ error: 'not_found', message: 'User not found' });
    }

    const orgs = db.prepare(
      `SELECT o.id, o.name, o.slug, o.tier, o.created_at, om.role as member_role
       FROM organizations o
       JOIN org_members om ON om.org_id = o.id
       WHERE om.user_id = ? AND om.status = 'active'
       ORDER BY o.name`
    ).all(userId);

    return { data: { ...user, orgs } };
  });

  // Accept invitation by token
  app.post<{ Body: AcceptInviteRequest }>(
    '/api/invitations/accept',
    async (request, reply) => {
      const userId = request.headers['x-user-id'] as string;
      if (!userId) {
        return reply.status(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      }

      const { token } = request.body;
      if (!token) {
        return reply.status(400).send({ error: 'validation', message: 'token is required' });
      }

      const db = getDb();
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      const invitation = db.prepare(
        "SELECT * FROM invitations WHERE token = ? AND status = 'pending'"
      ).get(token) as any;

      if (!invitation) {
        return reply.status(404).send({ error: 'not_found', message: 'Invitation not found or already used' });
      }

      if (new Date(invitation.expires_at) < new Date()) {
        db.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").run(invitation.id);
        return reply.status(410).send({ error: 'expired', message: 'Invitation has expired' });
      }

      if (invitation.email !== user.email) {
        return reply.status(403).send({ error: 'forbidden', message: 'Invitation is for a different email' });
      }

      // Check if already a member
      const existing = db.prepare(
        'SELECT id FROM org_members WHERE org_id = ? AND user_id = ?'
      ).get(invitation.org_id, userId);

      if (existing) {
        db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitation.id);
        return { data: { org_id: invitation.org_id, already_member: true } };
      }

      // Create membership
      const memberId = uuid();
      db.prepare(
        'INSERT INTO org_members (id, org_id, user_id, role) VALUES (?, ?, ?, ?)'
      ).run(memberId, invitation.org_id, userId, invitation.role);

      db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(invitation.id);

      return { data: { org_id: invitation.org_id, member_id: memberId } };
    }
  );
}
