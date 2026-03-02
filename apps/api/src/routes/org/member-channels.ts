import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { redeployGateway, getGatewayStatus } from '../../services/gateway.js';

function maskToken(token: string): string {
  if (token.length <= 10) return '***';
  return token.slice(0, 6) + '...' + token.slice(-4);
}

export async function orgMemberChannelRoutes(app: FastifyInstance) {
  // List channel configs for current member
  app.get('/api/orgs/:orgId/me/channels', async (request) => {
    const memberId = request.orgMember!.id;
    const db = getDb();
    const rows = db
      .prepare('SELECT channel, bot_token, created_at, updated_at FROM member_channels WHERE member_id = ?')
      .all(memberId) as { channel: string; bot_token: string; created_at: string; updated_at: string }[];

    const data = rows.map((r) => ({
      channel: r.channel,
      configured: true,
      masked_token: maskToken(r.bot_token),
      updated_at: r.updated_at,
    }));

    return { data };
  });

  // Set/update channel token
  app.put<{ Params: { orgId: string; channel: string }; Body: { bot_token: string } }>(
    '/api/orgs/:orgId/me/channels/:channel',
    async (request, reply) => {
      const { channel } = request.params;
      const { bot_token } = request.body;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;

      if (!bot_token || !bot_token.trim()) {
        return reply.status(400).send({ error: 'validation', message: 'bot_token is required' });
      }

      const validChannels = ['telegram', 'discord', 'slack'];
      if (!validChannels.includes(channel)) {
        return reply.status(400).send({ error: 'validation', message: `Invalid channel: ${channel}` });
      }

      const db = getDb();
      db.prepare(
        `INSERT INTO member_channels (member_id, channel, bot_token, updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(member_id, channel) DO UPDATE SET bot_token = ?, updated_at = datetime('now')`
      ).run(memberId, channel, bot_token.trim(), bot_token.trim());

      // Auto-redeploy if gateway is running
      const member = request.orgMember!;
      if (member.gateway_url && (member.gateway_status === 'running' || member.gateway_status === 'deploying')) {
        try {
          await redeployGateway(orgId, memberId);
        } catch {
          // Redeploy failed, but token was saved
        }
      }

      return { data: { channel, configured: true } };
    }
  );

  // Remove channel token
  app.delete<{ Params: { orgId: string; channel: string } }>(
    '/api/orgs/:orgId/me/channels/:channel',
    async (request, reply) => {
      const { channel } = request.params;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;

      const db = getDb();
      const result = db
        .prepare('DELETE FROM member_channels WHERE member_id = ? AND channel = ?')
        .run(memberId, channel);

      if (result.changes === 0) {
        return reply.status(404).send({ error: 'not_found', message: 'Channel not configured' });
      }

      // Auto-redeploy if gateway is running
      const member = request.orgMember!;
      if (member.gateway_url && (member.gateway_status === 'running' || member.gateway_status === 'deploying')) {
        try {
          await redeployGateway(orgId, memberId);
        } catch {
          // Redeploy failed, but token was removed
        }
      }

      return { data: { channel, configured: false } };
    }
  );

  // Approve a pairing code
  app.post<{ Params: { orgId: string; channel: string }; Body: { code: string } }>(
    '/api/orgs/:orgId/me/channels/:channel/pair',
    async (request, reply) => {
      const { channel } = request.params;
      const { code } = request.body;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;

      if (!code || !code.trim()) {
        return reply.status(400).send({ error: 'validation', message: 'Pairing code is required' });
      }

      try {
        // const output = await approvePairing(orgId, memberId, channel, code.trim());
        // todo: channel approval
        return { data: { channel, approved: true, output: "not implemented" } };
      } catch (err: any) {
        return reply.status(400).send({ error: 'pairing_error', message: err.message });
      }
    }
  );

  // List pending pairing requests
  app.get<{ Params: { orgId: string; channel: string } }>(
    '/api/orgs/:orgId/me/channels/:channel/pair',
    async (request, reply) => {
      const { channel } = request.params;
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;

      try {
        // const output = await listPairingRequests(orgId, memberId, channel);
        // todo missing list pairing requests
        const output = "not implemented"
        return { data: { channel, output } };
      } catch (err: any) {
        return reply.status(400).send({ error: 'pairing_error', message: err.message });
      }
    }
  );

  // Get own gateway status
  app.get(
    '/api/orgs/:orgId/me/gateway/status',
    async (request, reply) => {
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;
      try {
        const result = await getGatewayStatus(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Redeploy own gateway
  app.post(
    '/api/orgs/:orgId/me/gateway/redeploy',
    async (request, reply) => {
      const orgId = request.orgId!;
      const memberId = request.orgMember!.id;
      const member = request.orgMember!;

      if (!member.gateway_url) {
        return reply.status(400).send({ error: 'gateway_error', message: 'No gateway deployed. Ask an admin to deploy one for you.' });
      }

      try {
        const result = await redeployGateway(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );
}
