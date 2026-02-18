import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import {
  provisionGateway,
  stopGateway,
  startGateway,
  removeGateway,
  getGatewayStatus,
} from '../../services/gateway.js';

export async function adminGatewayRoutes(app: FastifyInstance) {
  // Provision gateway for user
  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/gateway',
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      try {
        const result = await provisionGateway(id);
        return reply.status(201).send({ data: result });
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Remove gateway
  app.delete<{ Params: { id: string } }>(
    '/api/admin/users/:id/gateway',
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
      if (!user) {
        return reply.status(404).send({ error: 'not_found', message: 'User not found' });
      }

      try {
        const result = await removeGateway(id);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Start gateway
  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/gateway/start',
    async (request, reply) => {
      const { id } = request.params;
      try {
        const result = await startGateway(id);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Stop gateway
  app.post<{ Params: { id: string } }>(
    '/api/admin/users/:id/gateway/stop',
    async (request, reply) => {
      const { id } = request.params;
      try {
        const result = await stopGateway(id);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );

  // Get gateway status
  app.get<{ Params: { id: string } }>(
    '/api/admin/users/:id/gateway/status',
    async (request, reply) => {
      const { id } = request.params;
      try {
        const result = await getGatewayStatus(id);
        return { data: result };
      } catch (err: any) {
        return reply.status(400).send({ error: 'gateway_error', message: err.message });
      }
    }
  );
}
