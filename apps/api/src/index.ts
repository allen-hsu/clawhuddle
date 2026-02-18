import Fastify from 'fastify';
import cors from '@fastify/cors';
import 'dotenv/config';
import { authRoutes } from './routes/auth.js';
import { adminUserRoutes } from './routes/admin/users.js';
import { adminSkillRoutes } from './routes/admin/skills.js';
import { adminApiKeyRoutes } from './routes/admin/api-keys.js';
import { adminGatewayRoutes } from './routes/admin/gateways.js';
import { chatRoutes } from './routes/chat.js';

const app = Fastify({ logger: true });

await app.register(cors, { origin: true, credentials: true });

// Routes
await app.register(authRoutes);
await app.register(adminUserRoutes);
await app.register(adminSkillRoutes);
await app.register(adminApiKeyRoutes);
await app.register(adminGatewayRoutes);
await app.register(chatRoutes);

app.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || '0.0.0.0';

await app.listen({ port, host });
console.log(`API server running on http://${host}:${port}`);
