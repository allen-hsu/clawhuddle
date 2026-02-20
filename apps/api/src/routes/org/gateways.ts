import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { requireRole } from '../../middleware/auth.js';
import {
  provisionGateway,
  stopGateway,
  startGateway,
  removeGateway,
  redeployGateway,
  getGatewayStatus,
} from '../../services/gateway.js';

export async function orgGatewayRoutes(app: FastifyInstance) {
  // Provision gateway for member (admin+ only)
  app.post<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      const db = getDb();
      const member = db.prepare('SELECT * FROM org_members WHERE id = ? AND org_id = ?').get(memberId, orgId);
      if (!member) {
        return reply.status(404).send({ error: 'not_found', message: 'Member not found' });
      }

      try {
        const result = await provisionGateway(orgId, memberId);
        return reply.status(201).send({ data: result });
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Remove gateway
  app.delete<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      try {
        const result = await removeGateway(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Start gateway
  app.post<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId/start',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      try {
        const result = await startGateway(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Stop gateway
  app.post<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId/stop',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      try {
        const result = await stopGateway(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Redeploy gateway
  app.post<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId/redeploy',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      try {
        const result = await redeployGateway(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Get gateway status
  app.get<{ Params: { orgId: string; memberId: string } }>(
    '/api/orgs/:orgId/gateways/members/:memberId/status',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { orgId, memberId } = request.params;
      try {
        const result = await getGatewayStatus(orgId, memberId);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );
}
