import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/index.js';
import { v4 as uuid } from 'uuid';
import { requireRole } from '../../middleware/auth.js';
import { PROVIDER_IDS, type CredentialType } from '@clawhuddle/shared';
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
  /**
   * GET /api/orgs/:orgId/api-keys
   * Returns all keys grouped:
   * {
   *   defaults: ApiKeyDisplay[],           // is_company_default = 1
   *   userSpecific: {                      // is_company_default = 0
   *     key: ApiKeyDisplay,
   *     assignedMemberIds: string[]
   *   }[]
   * }
   */
  app.get(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request) => {
      const db = getDb();
      const orgId = request.orgId!;

      const allKeys = db.prepare(
        'SELECT * FROM api_keys WHERE org_id = ? ORDER BY created_at DESC'
      ).all(orgId) as any[];

      const assignments = db.prepare(
        `SELECT aka.api_key_id, aka.member_id
         FROM api_key_assignments aka
         JOIN api_keys ak ON ak.id = aka.api_key_id
         WHERE ak.org_id = ?`
      ).all(orgId) as { api_key_id: string; member_id: string }[];

      // group assignments by key id
      const assignMap: Record<string, string[]> = {};
      for (const a of assignments) {
        if (!assignMap[a.api_key_id]) assignMap[a.api_key_id] = [];
        assignMap[a.api_key_id].push(a.member_id);
      }

      const mapKey = (k: any) => ({
        id: k.id,
        provider: k.provider,
        key_masked: maskKey(decodeKey(k.key_value)),
        is_company_default: k.is_company_default === 1,
        credential_type: (k.credential_type || 'api_key') as CredentialType,
        default_model: k.default_model || null,
      });

      const defaults = allKeys.filter(k => k.is_company_default === 1).map(mapKey);
      const userSpecific = allKeys
        .filter(k => k.is_company_default !== 1)
        .map(k => ({
          key: mapKey(k),
          assignedMemberIds: assignMap[k.id] || [],
        }));

      return { data: { defaults, userSpecific } };
    }
  );

  /**
   * POST /api/orgs/:orgId/api-keys
   * Creates a key. If isDefault=true, replaces org default for provider.
   * If isDefault=false, creates a user-specific key (no assignments yet).
   * Body: { provider, key, credentialType, defaultModel, isDefault }
   */
  app.post<{ Body: { provider: string; key: string; credentialType?: CredentialType; defaultModel?: string; isDefault?: boolean } }>(
    '/api/orgs/:orgId/api-keys',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { provider, key, credentialType, defaultModel, isDefault = true } = request.body;
      if (!provider || !key) {
        return reply.status(400).send({ error: 'validation', message: 'provider and key are required' });
      }
      if (!PROVIDER_IDS.includes(provider)) {
        return reply.status(400).send({ error: 'validation', message: `Unknown provider: ${provider}` });
      }
      const ct: CredentialType = credentialType === 'token' ? 'token' : credentialType === 'oauth' ? 'oauth' : 'api_key';
      const db = getDb();
      const orgId = request.orgId!;
      const id = uuid();

      if (isDefault) {
        // Upsert org default: remove previous default for this provider
        db.prepare('DELETE FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?').run(provider, orgId);
        db.prepare(
          'INSERT INTO api_keys (id, provider, key_value, is_company_default, org_id, credential_type, default_model) VALUES (?, ?, ?, 1, ?, ?, ?)'
        ).run(id, provider, encodeKey(key), orgId, ct, defaultModel || null);
      } else {
        // Create user-specific key (not assigned to anyone yet)
        db.prepare(
          'INSERT INTO api_keys (id, provider, key_value, is_company_default, org_id, credential_type, default_model) VALUES (?, ?, ?, 0, ?, ?, ?)'
        ).run(id, provider, encodeKey(key), orgId, ct, defaultModel || null);
      }

      syncAuthProfiles(orgId);

      return reply.status(201).send({
        data: { id, provider, key_masked: maskKey(key), is_company_default: isDefault, credential_type: ct, default_model: defaultModel || null },
      });
    }
  );

  /**
   * POST /api/orgs/:orgId/api-keys/:keyId/assign
   * Assigns a member to a user-specific key.
   * Enforces: one member can only have one key per provider.
   * Body: { memberId }
   */
  app.post<{ Params: { orgId: string; keyId: string }; Body: { memberId: string } }>(
    '/api/orgs/:orgId/api-keys/:keyId/assign',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { keyId } = request.params;
      const { memberId } = request.body;
      if (!memberId) return reply.status(400).send({ error: 'validation', message: 'memberId is required' });

      const db = getDb();
      const orgId = request.orgId!;

      const targetKey = db.prepare('SELECT * FROM api_keys WHERE id = ? AND org_id = ?').get(keyId, orgId) as any;
      if (!targetKey) return reply.status(404).send({ error: 'not_found', message: 'Key not found' });
      if (targetKey.is_company_default) return reply.status(400).send({ error: 'validation', message: 'Cannot assign members to a default key' });

      // Remove any existing assignment for this member+provider (one key per provider per member)
      db.prepare(`
        DELETE FROM api_key_assignments
        WHERE member_id = ?
          AND api_key_id IN (
            SELECT id FROM api_keys WHERE provider = ? AND org_id = ? AND is_company_default = 0
          )
      `).run(memberId, targetKey.provider, orgId);

      // Add new assignment
      const id = uuid();
      db.prepare('INSERT INTO api_key_assignments (id, api_key_id, member_id) VALUES (?, ?, ?)').run(id, keyId, memberId);

      syncAuthProfiles(orgId);
      return { data: { id, api_key_id: keyId, member_id: memberId } };
    }
  );

  /**
   * DELETE /api/orgs/:orgId/api-keys/:keyId/assign/:memberId
   * Removes a member assignment from a key.
   */
  app.delete<{ Params: { orgId: string; keyId: string; memberId: string } }>(
    '/api/orgs/:orgId/api-keys/:keyId/assign/:memberId',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { keyId, memberId } = request.params;
      const db = getDb();
      const orgId = request.orgId!;

      db.prepare(`
        DELETE FROM api_key_assignments
        WHERE api_key_id = ? AND member_id = ?
          AND api_key_id IN (SELECT id FROM api_keys WHERE org_id = ?)
      `).run(keyId, memberId, orgId);

      syncAuthProfiles(orgId);
      return { data: { keyId, memberId, deleted: true } };
    }
  );

  /**
   * PATCH /api/orgs/:orgId/api-keys/:id
   * Update default model for a key.
   */
  app.patch<{ Params: { orgId: string; id: string }; Body: { defaultModel: string } }>(
    '/api/orgs/:orgId/api-keys/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const { defaultModel } = request.body;
      const db = getDb();
      const result = db.prepare(
        'UPDATE api_keys SET default_model = ? WHERE id = ? AND org_id = ?'
      ).run(defaultModel || null, id, request.orgId!);
      if (result.changes === 0) {
        return reply.status(404).send({ error: 'not_found', message: 'API key not found' });
      }
      syncAuthProfiles(request.orgId!);
      return { data: { id, default_model: defaultModel || null } };
    }
  );

  /**
   * DELETE /api/orgs/:orgId/api-keys/:id
   * Delete a key (and cascade its assignments).
   */
  app.delete<{ Params: { orgId: string; id: string } }>(
    '/api/orgs/:orgId/api-keys/:id',
    { preHandler: requireRole('owner', 'admin') },
    async (request, reply) => {
      const { id } = request.params;
      const db = getDb();
      db.prepare('DELETE FROM api_key_assignments WHERE api_key_id = ?').run(id);
      db.prepare('DELETE FROM api_keys WHERE id = ? AND org_id = ?').run(id, request.orgId!);
      syncAuthProfiles(request.orgId!);
      return { data: { id, deleted: true } };
    }
  );
}

// Helper used by gateway service — gets org-scoped default API key
export function getOrgApiKey(orgId: string, provider: string): string | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT key_value FROM api_keys WHERE provider = ? AND is_company_default = 1 AND org_id = ?'
  ).get(provider, orgId) as { key_value: string } | undefined;
  return row ? decodeKey(row.key_value) : null;
}

/**
 * Returns all API keys (decrypted) for a specific member's gateway.
 * Logic:
 *   - For each provider, use the user-specific key if the member is assigned one.
 *   - Otherwise fall back to the org default.
 */
export function getOrgAllApiKeys(
  orgId: string,
  memberId?: string
): { provider: string; key: string; credential_type: CredentialType; default_model: string | null }[] {
  const db = getDb();

  let rows: any[];

  if (memberId) {
    // Fetch user-specific assigned keys + org defaults for providers without an assignment
    rows = db.prepare(`
      SELECT ak.provider, ak.key_value, ak.credential_type, ak.default_model
      FROM api_keys ak
      INNER JOIN api_key_assignments aka ON aka.api_key_id = ak.id AND aka.member_id = ?
      WHERE ak.org_id = ? AND ak.is_company_default = 0

      UNION ALL

      SELECT ak.provider, ak.key_value, ak.credential_type, ak.default_model
      FROM api_keys ak
      WHERE ak.org_id = ? AND ak.is_company_default = 1
        AND NOT EXISTS (
          SELECT 1 FROM api_key_assignments aka2
          INNER JOIN api_keys ak2 ON ak2.id = aka2.api_key_id
          WHERE aka2.member_id = ? AND ak2.provider = ak.provider AND ak2.org_id = ?
        )
    `).all(memberId, orgId, orgId, memberId, orgId) as any[];
  } else {
    rows = db.prepare(
      'SELECT provider, key_value, credential_type, default_model FROM api_keys WHERE is_company_default = 1 AND org_id = ?'
    ).all(orgId) as any[];
  }

  return rows.map((r) => ({
    provider: r.provider,
    key: decodeKey(r.key_value),
    credential_type: (r.credential_type || 'api_key') as CredentialType,
    default_model: r.default_model || null,
  }));
}
