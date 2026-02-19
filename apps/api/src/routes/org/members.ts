import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import crypto from 'node:crypto';
import { requireRole } from '../../middleware/auth.js';
import { sendInvitationEmail } from '../../services/email.js';
import type { InviteMemberRequest, UpdateMemberRequest } from '@clawteam/shared';

export async function orgMemberRoutes(app: FastifyInstance) {
  // List members
  app.get('/api/orgs/:orgId/members', async (request) => {
    const db = getDb();
    const members = db.prepare(
      `SELECT om.*, u.email, u.name, u.avatar_url
       FROM org_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.org_id = ?
       ORDER BY om.joined_at`
    ).all(request.orgId!);

    return { data: members };
  });

  // Invite member (admin+ only)
  app.post<{ Body: InviteMemberRequest }>(
    '/api/orgs/:orgId/members/invite',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { email, role } = request.body;
      if (!email) {
        return reply.status(400).send({ error: 'validation', message: 'email is required' });
      }

      const db = getDb();

      // Check if already a member
      const existing = db.prepare(
        `SELECT om.id FROM org_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.org_id = ? AND u.email = ?`
      ).get(request.orgId!, email);

      if (existing) {
        return reply.status(409).send({ error: 'conflict', message: 'User is already a member' });
      }

      // Check for pending invitation
      const pendingInvite = db.prepare(
        "SELECT id FROM invitations WHERE org_id = ? AND email = ? AND status = 'pending'"
      ).get(request.orgId!, email);

      if (pendingInvite) {
        return reply.status(409).send({ error: 'conflict', message: 'Invitation already pending for this email' });
      }

      const id = uuid();
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

      const memberRole = role || 'member';
      db.prepare(
        'INSERT INTO invitations (id, org_id, email, role, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(id, request.orgId!, email, memberRole, token, request.currentUser!.id, expiresAt);

      // Send invitation email (non-blocking — don't fail the API if email fails)
      const org = db.prepare('SELECT name FROM organizations WHERE id = ?').get(request.orgId!) as any;
      sendInvitationEmail({
        to: email,
        orgName: org?.name || 'your team',
        invitedByName: request.currentUser!.name || request.currentUser!.email,
        role: memberRole,
        token,
      }).catch((err) => {
        console.error('[email] Failed to send invitation:', err);
      });

      const invitation = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id);
      return reply.status(201).send({ data: invitation });
    }
  );

  // List pending invitations (admin+ only)
  app.get(
    '/api/orgs/:orgId/members/invitations',
    { preHandler: requireRole('owner', 'admin') },
    async (request) => {
      const db = getDb();
      const invitations = db.prepare(
        `SELECT i.*, u.name as invited_by_name
         FROM invitations i
         JOIN users u ON u.id = i.invited_by
         WHERE i.org_id = ? AND i.status = 'pending'
         ORDER BY i.created_at DESC`
      ).all(request.orgId!);

      return { data: invitations };
    }
  );

  // Cancel invitation (admin+ only)
  app.delete<{ Params: { orgId: string; id: string } }>(
    '/api/orgs/:orgId/members/invitations/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();

      const invitation = db.prepare(
        "SELECT * FROM invitations WHERE id = ? AND org_id = ? AND status = 'pending'"
      ).get(id, request.orgId!) as any;

      if (!invitation) {
        return reply.status(404).send({ error: 'not_found', message: 'Invitation not found' });
      }

      db.prepare("UPDATE invitations SET status = 'expired' WHERE id = ?").run(id);
      return { data: { id, cancelled: true } };
    }
  );

  // Update member role/status (admin+ only)
  app.patch<{ Params: { orgId: string; memberId: string }; Body: UpdateMemberRequest }>(
    '/api/orgs/:orgId/members/:memberId',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { memberId } = request.params;
      const { role, status } = request.body;

      const db = getDb();
      const member = db.prepare(
        'SELECT * FROM org_members WHERE id = ? AND org_id = ?'
      ).get(memberId, request.orgId!) as any;

      if (!member) {
        return reply.status(404).send({ error: 'not_found', message: 'Member not found' });
      }

      // Only owners can change roles to/from owner
      if ((role === 'owner' || member.role === 'owner') && request.orgMember!.role !== 'owner') {
        return reply.status(403).send({ error: 'forbidden', message: 'Only owners can manage owner role' });
      }

      const updates: string[] = [];
      const values: any[] = [];

      if (role !== undefined) {
        updates.push('role = ?');
        values.push(role);
      }
      if (status !== undefined) {
        updates.push('status = ?');
        values.push(status);
      }

      if (updates.length > 0) {
        values.push(memberId);
        db.prepare(`UPDATE org_members SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }

      const updated = db.prepare(
        `SELECT om.*, u.email, u.name, u.avatar_url
         FROM org_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = ?`
      ).get(memberId);

      return { data: updated };
    }
  );

  // Remove member (admin+ only)
  app.delete<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/members/:memberId',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { memberId } = request.params;
      const db = getDb();

      const member = db.prepare(
        'SELECT * FROM org_members WHERE id = ? AND org_id = ?'
      ).get(memberId, request.orgId!) as any;

      if (!member) {
        return reply.status(404).send({ error: 'not_found', message: 'Member not found' });
      }

      if (member.role === 'owner') {
        return reply.status(400).send({ error: 'validation', message: 'Cannot remove org owner' });
      }

      db.prepare('DELETE FROM org_members WHERE id = ?').run(memberId);
      return { data: { id: memberId, removed: true } };
    }
  );
}
