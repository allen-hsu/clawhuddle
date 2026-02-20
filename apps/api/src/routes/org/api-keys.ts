import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../../middleware/auth.js';
import { PROVIDER_IDS, type SetApiKeyRequest, type CredentialType } from '@clawhuddle/shared';
import { syncAuthProfiles } from '../../services/gateway.js';

// WARNING: base64 is NOT real encryption — it only obscures keys in the DB.
// For production, replace with AES-GCM using an ENCRYPTION_KEY env variable.
function encodeKey(key: string): string {
  return Buffer.from(key).toString('base64');
}

function decodeKey(encoded: string): string {
  return Buffer.from(encoded, 'base64').toString('utf-8');
}

function maskKey(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}

export async function orgApiKeyRoutes(app: FastifyInstance) {
  // List API keys (admin+ only)
  app.get(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request) => {
      const db = getDb();
      const keys = db.prepare(
        'SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC'
      ).all(request.orgId!) as any[];

      return {
        data: keys.map((k) => ({
          ...k,
          key_masked: maskKey(decodeKey(k.key_value)),
          key_value: undefined,
          credential_type: k.credential_type || 'api_key',
        })),
      };
    }
  );

  // Set API key (upsert org default for provider)
  app.post<{ Body: SetApiKeyRequest }>(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { provider, key, credentialType } = request.body;
      if (!provider || !key) {
        return reply.status(400).send({ error: 'validation', message: 'provider and key are required' });
      }
      if (!PROVIDER_IDS.includes(provider)) {
        return reply.status(400).send({ error: 'validation', message: `Unknown provider: ${provider}` });
      }
      const ct: CredentialType = credentialType === 'token' ? 'token' : credentialType === 'oauth' ? 'oauth' : 'api_key';

      const db = getDb();
      // Remove old default for this provider in this org
      db.prepare('DELETE FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?').run(provider, request.orgId!);

      const id = uuid();
      db.prepare(
        'INSERT INTO api_keys (id, provider, key_value, is_company_default, org_id, credential_type) VALUES (?, ?, ?, 1, ?, ?)'
      ).run(id, provider, encodeKey(key), request.orgId!, ct);

      syncAuthProfiles(request.orgId!);

      return reply.status(201).send({
        data: { id, provider, key_masked: maskKey(key), is_company_default: true, credential_type: ct },
      });
    }
  );

  // Delete API key
  app.delete<{ Params: { orgId: string; id: string } }>(
    '/api/orgs/:orgId/api-keys/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      db.prepare('DELETE FROM api_keys WHERE id = ? AND org_id = ?').run(id, request.orgId!);
      syncAuthProfiles(request.orgId!);
      return { data: { id, deleted: true } };
    }
  );
}

// Helper used by gateway service — gets org-scoped API key
export function getOrgApiKey(orgId: string, provider: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT key_value FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?'
  ).get(provider, orgId) as { key_value: string } | undefined;
  return row ? decodeKey(row.key_value) : null;
}

// Returns all org API keys (decrypted) for auth-profiles.json generation
export function getOrgAllApiKeys(orgId: string): { provider: string; key: string; credential_type: CredentialType }[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT provider, key_value, credential_type FROM api_keys WHERE is_company_default = 1 AND org_id = ?'
  ).all(orgId) as { provider: string; key_value: string; credential_type: string }[];
  return rows.map((r) => ({
    provider: r.provider,
    key: decodeKey(r.key_value),
    credential_type: (r.credential_type || 'api_key') as CredentialType,
  }));
}
