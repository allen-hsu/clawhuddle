import Docker from "dockerode";
import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { getResolvedApiKeysForMember } from "../routes/org/api-keys.js";
import { generateOpenClawConfig, mergeOpenClawConfig, type ChannelTokens } from "./openclaw-config.js";
import { installSkillsForUser } from "./skill-installer.js";
import type { Skill, OrgMember } from "@clawhuddle/shared";
import { PROVIDERS } from "@clawhuddle/shared";

const docker = new Docker();

const GATEWAY_IMAGE = "clawhuddle-gateway:local";
// OpenClaw listens on loopback:6100; socat bridges external traffic on 0.0.0.0:6101
const GATEWAY_INTERNAL_PORT = 6100;
const GATEWAY_EXTERNAL_PORT = 6101;
const CONTAINER_PREFIX = "clawhuddle-gw-";
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || "clawhuddle-net";
const DOMAIN = process.env.DOMAIN || "localhost";
const GATEWAY_DOMAIN = process.env.GATEWAY_DOMAIN || DOMAIN;

async function ensureNetwork(): Promise<void> {
  try {
    await docker.getNetwork(DOCKER_NETWORK).inspect();
  } catch {
    await docker.createNetwork({ Name: DOCKER_NETWORK, Driver: "bridge" });
  }
}

async function checkGatewayHealth(containerName: string): Promise<boolean> {
  try {
    const container = docker.getContainer(containerName);
    const exec = await container.exec({
      Cmd: [
        "node",
        "-e",
        `fetch('http://127.0.0.1:${GATEWAY_INTERNAL_PORT}/').then(r=>(r.ok||r.status===401)?process.exit(0):process.exit(1)).catch(()=>process.exit(1))`,
      ],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    return new Promise<boolean>((resolve) => {
      stream.resume();
      stream.on("end", async () => {
        try {
          const info = await exec.inspect();
          resolve(info.ExitCode === 0);
        } catch {
          resolve(false);
        }
      });
      setTimeout(() => resolve(false), 5000);
    });
  } catch {
    return false;
  }
}

function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve("./data");
}

// Host path for Docker bind mounts — must be an absolute path on the HOST machine.
// In Docker Compose this is set to ${PWD}/data automatically.
// For local dev (no container), falls back to getDataDir() which is already on the host.
function getHostDataDir(): string {
  const dir = process.env.HOST_DATA_DIR || getDataDir();
  if (!path.isAbsolute(dir)) {
    throw new Error(
      `HOST_DATA_DIR must be an absolute path (got "${dir}"). Set it in .env or docker-compose.yml.`,
    );
  }
  return dir;
}

function getGatewayDir(orgId: string, userId: string): string {
  return path.join(getDataDir(), "gateways", orgId, userId);
}

function getHostGatewayDir(orgId: string, userId: string): string {
  return path.join(getHostDataDir(), "gateways", orgId, userId);
}

function getContainerName(orgId: string, userId: string): string {
  // Keep under 63 chars for Docker DNS resolution
  return `${CONTAINER_PREFIX}${orgId.slice(0, 8)}-${userId.slice(0, 8)}`;
}

// Gateway subdomain: "claw-{hex}" under parent domain
function generateSubdomain(): string {
  return `claw-${crypto.randomBytes(4).toString("hex")}`;
}

function getMember(
  orgId: string,
  memberId: string,
): OrgMember & { user_id: string } {
  const db = getDb();
  const member = db
    .prepare("SELECT * FROM org_members WHERE id = ? AND org_id = ?")
    .get(memberId, orgId) as (OrgMember & { user_id: string }) | undefined;
  if (!member) throw new Error("Member not found");
  return member;
}

function getMemberSkills(orgId: string, userId: string): Skill[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.* FROM skills s
       JOIN user_skills us ON us.skill_id = s.id
       WHERE us.user_id = ? AND us.enabled = 1 AND s.enabled = 1 AND s.org_id = ?
       UNION
       SELECT * FROM skills WHERE type = 'mandatory' AND enabled = 1 AND org_id = ?`,
    )
    .all(userId, orgId, orgId) as Skill[];
}

function getMemberChannelTokens(memberId: string): ChannelTokens {
  const db = getDb();
  const rows = db
    .prepare("SELECT channel, bot_token FROM member_channels WHERE member_id = ?")
    .all(memberId) as { channel: string; bot_token: string }[];
  const tokens: ChannelTokens = {};
  for (const row of rows) {
    if (row.channel === "telegram") tokens.telegram = row.bot_token;
    else if (row.channel === "discord") tokens.discord = row.bot_token;
    else if (row.channel === "slack") tokens.slack = row.bot_token;
  }
  return tokens;
}

function createTraefikLabels(
  containerName: string,
  subdomain: string,
): Record<string, string> {
  return {
    "traefik.enable": "true",
    [`traefik.http.routers.${containerName}.rule`]: `Host(\`${subdomain}.${GATEWAY_DOMAIN}\`)`,
    [`traefik.http.routers.${containerName}.entrypoints`]: "web",
    // Traefik connects to socat port (0.0.0.0:6101) which forwards to OpenClaw loopback port
    [`traefik.http.services.${containerName}.loadbalancer.server.port`]: String(
      GATEWAY_EXTERNAL_PORT,
    ),
    // Override proxy headers so OpenClaw sees a local connection and auto-approves device pairing
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-For`]:
      "127.0.0.1",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Real-IP`]:
      "127.0.0.1",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.X-Forwarded-Proto`]:
      "",
    // Strip Cloudflare proxy headers
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Connecting-IP`]:
      "",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.True-Client-IP`]:
      "",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-IPCountry`]:
      "",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Ray`]:
      "",
    [`traefik.http.middlewares.${containerName}-headers.headers.customrequestheaders.CF-Visitor`]:
      "",
    [`traefik.http.routers.${containerName}.middlewares`]: `${containerName}-headers`,
  };
}

/**
 * Writes auth-profiles.json for a gateway.
 *
 * OpenClaw does not read this file at run time (2026.6.11 and 2026.7.1 alike):
 * the entrypoint's `openclaw doctor --fix` imports it into the agent's SQLite
 * auth store and then consumes the file. That import only ADDS profile ids it
 * has not seen — an id already present is never overwritten, and "present" only
 * means the fields are there, not that the credential still works. So writing
 * this file cannot by itself change a credential; see reconcileAuthProfileStore.
 *
 * Also returns a fingerprint per profile id, taken from the credential in our
 * own database, which reconcile needs to tell an operator replacing a key apart
 * from OpenClaw refreshing one.
 */
function writeAuthProfiles(orgId: string, userId: string): {
  providerIds: string[];
  modelOverrides: Record<string, string>;
  clawProxyKey: string | null;
  profiles: Record<string, Record<string, unknown>>;
  fingerprints: Record<string, string>;
} {
  // Resolved = personal overrides where set, org defaults elsewhere
  const allKeys = getResolvedApiKeysForMember(orgId, userId);
  const profiles: Record<string, Record<string, unknown>> = {};
  const fingerprints: Record<string, string> = {};
  const providerIds: string[] = [];
  const modelOverrides: Record<string, string> = {};
  const order: Record<string, string[]> = {};
  const providerCounters: Record<string, number> = {};
  let clawProxyKey: string | null = null;

  for (const { provider, key, credential_type, default_model } of allKeys) {
    // claw-proxy keys go directly into openclaw.json as a custom provider, not auth-profiles
    if (provider === 'claw-proxy') {
      clawProxyKey = key;
      if (!providerIds.includes(provider)) providerIds.push(provider);
      if (default_model && !modelOverrides[provider]) modelOverrides[provider] = default_model;
      continue;
    }

    const providerConfig = PROVIDERS.find((p) => p.id === provider);
    if (!providerConfig) continue;
    if (!providerIds.includes(provider)) providerIds.push(provider);
    if (default_model && !modelOverrides[provider]) modelOverrides[provider] = default_model;

    // OpenClaw namespace for the auth profile. The `openai-codex` platform
    // provider maps to OpenClaw's canonical `openai` namespace so gpt-5.5 auth
    // resolves for `openai/gpt-5.5` model refs (Codex subscription rides the
    // same `openai` provider as API keys, distinguished by profile id + order).
    const ns = provider === "openai-codex" ? "openai" : provider;

    // Generate unique profile ID
    const count = (providerCounters[provider] ?? 0) + 1;
    providerCounters[provider] = count;
    const suffix = count === 1 ? '' : `-${count}`;

    let profileId: string;

    if (credential_type === "oauth") {
      try {
        const oauth = JSON.parse(key);
        const tokens = oauth.tokens ?? oauth;
        if (!tokens.access_token || !tokens.refresh_token) continue;

        let expires: number | undefined;
        try {
          const payload = JSON.parse(
            Buffer.from(tokens.access_token.split(".")[1], "base64").toString(),
          );
          // JWT `exp` is seconds; OpenClaw compares `expires` against Date.now()
          // in milliseconds. Passing raw seconds reads as 1970, so the token
          // looks expired on every single request and the gateway refreshes it
          // constantly — which rotates the refresh token until the provider
          // rejects the chain with refresh_token_invalidated.
          if (payload.exp) expires = payload.exp * 1000;
        } catch { /* non-JWT */ }

        profileId = `${ns}:oauth${suffix}`;
        profiles[profileId] = {
          type: "oauth",
          provider: ns,
          access: tokens.access_token,
          refresh: tokens.refresh_token,
          ...(expires ? { expires } : {}),
        };
      } catch {
        continue;
      }
    } else if (credential_type === "token") {
      profileId = `${ns}:setup-token${suffix}`;
      profiles[profileId] = {
        type: "token",
        provider: ns,
        token: key,
      };
    } else {
      profileId = `${ns}:manual${suffix}`;
      profiles[profileId] = { type: "api_key", provider: ns, key };
    }

    // Fingerprint of the credential as WE hold it, not as OpenClaw stores it:
    // this changes only when an operator supplies a different one.
    fingerprints[profileId] = crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);

    if (!order[ns]) order[ns] = [];
    order[ns].push(profileId);
  }

  // Only include order for providers with multiple profiles
  const orderFiltered: Record<string, string[]> = {};
  for (const [provider, ids] of Object.entries(order)) {
    if (ids.length > 1) orderFiltered[provider] = ids;
  }

  const authProfilesPath = path.join(
    getGatewayDir(orgId, userId),
    "agents", "main", "agent", "auth-profiles.json",
  );
  fs.mkdirSync(path.dirname(authProfilesPath), { recursive: true });
  fs.writeFileSync(
    authProfilesPath,
    JSON.stringify({
      version: 1,
      profiles,
      ...(Object.keys(orderFiltered).length > 0 ? { order: orderFiltered } : {}),
    }, null, 2),
  );

  return { providerIds, modelOverrides, clawProxyKey, profiles, fingerprints };
}

/** Profile ids minted by writeAuthProfiles(), e.g. "openai:oauth", "google:manual-2". */
const MANAGED_PROFILE_ID = /^[^:]+:(manual|oauth|setup-token)(-\d+)?$/;

/** Our record of which credential each profile id was last handed to the importer. */
function authFingerprintPath(orgId: string, userId: string): string {
  return path.join(
    getGatewayDir(orgId, userId),
    "agents", "main", "agent", ".clawhuddle-auth-fingerprints.json",
  );
}

/**
 * Lets `openclaw doctor --fix` import a credential the operator has replaced.
 *
 * The importer never overwrites a profile id it already has, so a key changed in
 * the UI is written to auth-profiles.json, silently skipped at import, and the
 * file consumed — the gateway keeps serving the old credential forever. We own
 * the ids we mint, so we delete the ones whose source credential changed and let
 * the importer add them back.
 *
 * Staleness is judged on a fingerprint of OUR copy of the credential, not on the
 * stored value. For OAuth the store is legitimately newer than our file — the
 * gateway writes refreshed tokens back under the same id — so comparing content
 * would drop a live credential on every redeploy and re-import an original whose
 * refresh token the provider has since rotated away.
 *
 * With no fingerprint on record we keep what the gateway has, for the same
 * reason: the first run after this shipped only records, and the next real key
 * change is caught. Ids are unchanged from before, so the order OpenClaw keeps
 * in auth_profile_state still points at profiles that exist.
 *
 * Only call this while the container is stopped — the gateway holds the store
 * open, and a running agent would not observe the change anyway.
 */
export function reconcileAuthProfileStore(
  orgId: string,
  userId: string,
  profiles: Record<string, Record<string, unknown>>,
  fingerprints: Record<string, string>,
): void {
  const storePath = path.join(
    getGatewayDir(orgId, userId),
    "agents", "main", "agent", "openclaw-agent.sqlite",
  );
  const recordFingerprints = () => {
    try {
      const target = authFingerprintPath(orgId, userId);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(fingerprints, null, 2));
    } catch (err) {
      console.warn(`[gateway] could not record auth fingerprints for ${orgId}/${userId}:`, err);
    }
  };

  // No store yet — the first import has nothing to conflict with.
  if (!fs.existsSync(storePath)) return recordFingerprints();

  let previous: Record<string, string> = {};
  try {
    previous = JSON.parse(fs.readFileSync(authFingerprintPath(orgId, userId), "utf-8"));
  } catch { /* first run, or unreadable — treated as "no record" below */ }

  let store: Database.Database | undefined;
  try {
    store = new Database(storePath);
    const row = store
      .prepare("SELECT store_json FROM auth_profile_store WHERE store_key = 'primary'")
      .get() as { store_json: string } | undefined;
    if (!row) return recordFingerprints();

    const parsed = JSON.parse(row.store_json) as { profiles?: Record<string, unknown> };
    if (!parsed.profiles) return recordFingerprints();

    const dropped: string[] = [];
    for (const profileId of Object.keys(parsed.profiles)) {
      if (!MANAGED_PROFILE_ID.test(profileId)) continue;
      if (!profiles[profileId]) continue;           // not ours to manage right now
      const before = previous[profileId];
      if (before === undefined) continue;            // nothing to compare against — keep
      if (before === fingerprints[profileId]) continue; // same credential — keep the refreshed one
      delete parsed.profiles[profileId];
      dropped.push(profileId);
    }

    recordFingerprints();
    if (dropped.length === 0) return;

    store
      .prepare("UPDATE auth_profile_store SET store_json = ? WHERE store_key = 'primary'")
      .run(JSON.stringify(parsed));
    console.log(
      `[gateway] auth store reconciled for ${orgId}/${userId}: dropped ${dropped.join(", ")} for re-import`,
    );
  } catch (err) {
    // A malformed or unfamiliar store must not block a redeploy: the gateway
    // still boots, it just keeps serving the previous credential.
    console.warn(`[gateway] could not reconcile auth store for ${orgId}/${userId}:`, err);
  } finally {
    store?.close();
  }
}

function getOrgPrimaryProvider(orgId: string): string | null {
  const db = getDb();
  const row = db
    .prepare('SELECT primary_provider FROM organizations WHERE id = ?')
    .get(orgId) as { primary_provider: string | null } | undefined;
  return row?.primary_provider ?? null;
}

/**
 * Rewrite both files for a single gateway in-place:
 *  - auth-profiles.json (credentials; hot-reloaded by OpenClaw)
 *  - openclaw.json (provider list + agents.defaults; OpenClaw reads at startup,
 *    so primary provider / new provider lists only take effect on the next start)
 *
 * Returns false if the gateway directory doesn't exist (member hasn't been
 * provisioned yet) — caller may treat this as a no-op.
 */
function regenerateGatewayConfig(orgId: string, userId: string): boolean {
  const gatewayDir = getGatewayDir(orgId, userId);
  if (!fs.existsSync(gatewayDir)) return false;

  const { providerIds, modelOverrides, clawProxyKey } = writeAuthProfiles(orgId, userId);

  const db = getDb();
  const member = db
    .prepare(
      `SELECT id, gateway_token, gateway_subdomain, gateway_port FROM org_members
       WHERE org_id = ? AND user_id = ?`,
    )
    .get(orgId, userId) as {
    id: string;
    gateway_token: string | null;
    gateway_subdomain: string | null;
    gateway_port: number | null;
  } | undefined;

  if (!member?.gateway_token || !member.gateway_subdomain) {
    // No provisioned gateway yet — auth-profiles.json is enough; openclaw.json
    // will be generated fresh when the gateway is first provisioned.
    return false;
  }

  const channelTokens = getMemberChannelTokens(member.id);

  const clawProxyBaseUrl = process.env.CLAW_PROXY_URL || 'http://claw-proxy:3456/v1';
  const configOptions = {
    port: GATEWAY_INTERNAL_PORT,
    token: member.gateway_token,
    activeProviderIds: providerIds,
    modelOverrides,
    channelTokens,
    clawProxy: clawProxyKey ? { baseUrl: clawProxyBaseUrl, apiKey: clawProxyKey } : undefined,
    primaryProviderId: getOrgPrimaryProvider(orgId) ?? undefined,
    ...getControlUiOrigins(member.gateway_subdomain),
  };

  const configPath = path.join(gatewayDir, 'openclaw.json');
  let config;
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    config = mergeOpenClawConfig(existing, configOptions);
  } catch {
    config = generateOpenClawConfig(configOptions);
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return true;
}

/**
 * Sync every gateway in the org. Called after an org-level change (org-default
 * key add/delete, primary_provider update) that may affect every member.
 *
 * Note: auth-profiles.json hot-reloads, but agents.defaults in openclaw.json
 * is read at gateway startup. Primary-provider changes take effect for new
 * gateway starts; running gateways keep their current primary until restart.
 */
export function syncAuthProfiles(orgId: string): void {
  const db = getDb();
  const members = db
    .prepare(
      `SELECT user_id FROM org_members
       WHERE org_id = ? AND gateway_port IS NOT NULL`,
    )
    .all(orgId) as { user_id: string }[];

  for (const { user_id } of members) {
    regenerateGatewayConfig(orgId, user_id);
  }
}

/**
 * Sync a single member's gateway. Called after a personal key change.
 */
export function syncAuthProfilesForUser(orgId: string, userId: string): void {
  regenerateGatewayConfig(orgId, userId);
}

const IS_LOCAL_DEV = DOMAIN === "localhost";

/** Compute Control UI allowed origins for a gateway subdomain. */
function getControlUiOrigins(subdomain: string): { allowedOrigins?: string[]; useHostHeaderFallback?: boolean } {
  if (IS_LOCAL_DEV) {
    // Local dev uses random ports — fall back to Host header
    return { useHostHeaderFallback: true };
  }
  // Production: explicit origins (both http and https in case of external SSL termination)
  const host = `${subdomain}.${GATEWAY_DOMAIN}`;
  return { allowedOrigins: [`http://${host}`, `https://${host}`] };
}

function createContainerConfig(
  containerName: string,
  subdomain: string,
  orgId: string,
  userId: string,
) {
  const hostConfig: Record<string, any> = {
    Binds: [`${getHostGatewayDir(orgId, userId)}:/root/.openclaw`],
    RestartPolicy: { Name: "unless-stopped" },
  };

  // Local dev: publish socat port so gateway is accessible without Traefik
  if (IS_LOCAL_DEV) {
    hostConfig.PortBindings = {
      [`${GATEWAY_EXTERNAL_PORT}/tcp`]: [{ HostPort: "0" }], // 0 = random available port
    };
  }

  return {
    Image: GATEWAY_IMAGE,
    name: containerName,
    Env: [],
    Labels: createTraefikLabels(containerName, subdomain),
    ExposedPorts: { [`${GATEWAY_EXTERNAL_PORT}/tcp`]: {} },
    HostConfig: hostConfig,
    NetworkingConfig: {
      EndpointsConfig: {
        [DOCKER_NETWORK]: {},
      },
    },
  };
}

// After container starts, read the actual host port Docker allocated
async function getHostPort(containerName: string): Promise<number | null> {
  if (!IS_LOCAL_DEV) return null;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();
    const portBindings =
      info.NetworkSettings.Ports[`${GATEWAY_EXTERNAL_PORT}/tcp`];
    return portBindings?.[0]?.HostPort
      ? Number(portBindings[0].HostPort)
      : null;
  } catch {
    return null;
  }
}

export async function provisionGateway(orgId: string, memberId: string) {
  await ensureNetwork();
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (
    member.gateway_status === "running" ||
    member.gateway_status === "deploying"
  ) {
    throw new Error("Gateway already running");
  }

  // Use fixed internal port, generate token and subdomain
  const port = GATEWAY_INTERNAL_PORT;
  const token = crypto.randomBytes(24).toString("hex");
  const subdomain = generateSubdomain();

  // Create workspace directory
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  fs.mkdirSync(gatewayDir, { recursive: true });

  // Write auth-profiles.json (credentials read from file, not env vars)
  const { providerIds, modelOverrides, clawProxyKey, profiles, fingerprints } = writeAuthProfiles(orgId, member.user_id);
  reconcileAuthProfileStore(orgId, member.user_id, profiles, fingerprints);
  if (providerIds.length === 0)
    throw new Error("No API keys configured — add at least one provider key");

  // Get member's skills
  const skills = getMemberSkills(orgId, member.user_id);

  // Read channel tokens (e.g. Telegram bot token)
  const channelTokens = getMemberChannelTokens(memberId);

  // Generate config
  const clawProxyBaseUrl = process.env.CLAW_PROXY_URL || 'http://claw-proxy:3456/v1';
  const config = generateOpenClawConfig({
    port,
    token,
    activeProviderIds: providerIds,
    modelOverrides,
    channelTokens,
    clawProxy: clawProxyKey ? { baseUrl: clawProxyBaseUrl, apiKey: clawProxyKey } : undefined,
    primaryProviderId: getOrgPrimaryProvider(orgId) ?? undefined,
    ...getControlUiOrigins(subdomain),
  });
  fs.writeFileSync(
    path.join(gatewayDir, "openclaw.json"),
    JSON.stringify(config, null, 2),
  );

  // Install skill directories (still keyed by userId for filesystem)
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Update DB with provisioning status + token + subdomain
  db.prepare(
    "UPDATE org_members SET gateway_port = ?, gateway_status = ?, gateway_token = ?, gateway_subdomain = ? WHERE id = ?",
  ).run(port, "provisioning", token, subdomain, memberId);

  try {
    // Create and start Docker container
    const containerName = getContainerName(orgId, member.user_id);

    // Remove existing container if any
    try {
      const existing = docker.getContainer(containerName);
      await existing.stop().catch(() => {});
      await existing.remove();
    } catch {
      // Container doesn't exist, that's fine
    }

    const container = await docker.createContainer(
      createContainerConfig(containerName, subdomain, orgId, member.user_id),
    );

    await container.start();

    // In local dev, read the actual host port Docker allocated
    const actualPort = (await getHostPort(containerName)) || port;
    if (actualPort !== port) {
      db.prepare("UPDATE org_members SET gateway_port = ? WHERE id = ?").run(
        actualPort,
        memberId,
      );
    }

    // Mark as deploying — getGatewayStatus will promote to running after health check
    db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
      "deploying",
      memberId,
    );

    return {
      memberId,
      userId: member.user_id,
      gateway_port: actualPort,
      gateway_status: "deploying" as const,
      gateway_subdomain: subdomain,
    };
  } catch (err) {
    // Rollback DB on failure
    db.prepare(
      "UPDATE org_members SET gateway_port = NULL, gateway_status = NULL, gateway_subdomain = NULL WHERE id = ?",
    ).run(memberId);
    throw err;
  }
}

export async function stopGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error("No gateway deployed");

  const containerName = getContainerName(orgId, member.user_id);
  const container = docker.getContainer(containerName);
  await container.stop();

  db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
    "stopped",
    memberId,
  );

  return {
    memberId,
    userId: member.user_id,
    gateway_port: member.gateway_port,
    gateway_status: "stopped" as const,
  };
}

export async function startGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error("No gateway deployed");

  // A key may have changed while this gateway was stopped. Reconcile before it
  // boots: the importer would otherwise skip the id it already has and the
  // gateway would come back up on the old credential without saying so.
  const { profiles, fingerprints } = writeAuthProfiles(orgId, member.user_id);
  reconcileAuthProfileStore(orgId, member.user_id, profiles, fingerprints);

  const containerName = getContainerName(orgId, member.user_id);
  const container = docker.getContainer(containerName);
  await container.start();

  db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
    "deploying",
    memberId,
  );

  return {
    memberId,
    userId: member.user_id,
    gateway_port: member.gateway_port,
    gateway_status: "deploying" as const,
  };
}

export async function removeGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) throw new Error("No gateway deployed");

  const containerName = getContainerName(orgId, member.user_id);
  try {
    const container = docker.getContainer(containerName);
    await container.stop().catch(() => {});
    await container.remove();
  } catch {
    // Container may already be removed
  }

  // Delete workspace
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  if (fs.existsSync(gatewayDir)) {
    fs.rmSync(gatewayDir, { recursive: true });
  }

  // Reset DB fields
  db.prepare(
    "UPDATE org_members SET gateway_port = NULL, gateway_status = NULL, gateway_token = NULL, gateway_subdomain = NULL WHERE id = ?",
  ).run(memberId);

  return {
    memberId,
    userId: member.user_id,
    gateway_port: null,
    gateway_status: null,
    gateway_subdomain: null,
  };
}

export async function redeployGateway(orgId: string, memberId: string) {
  await ensureNetwork();
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (
    !member.gateway_port ||
    !member.gateway_token ||
    !member.gateway_subdomain
  )
    throw new Error("No gateway deployed");

  const containerName = getContainerName(orgId, member.user_id);

  // Stop and remove old container
  try {
    const existing = docker.getContainer(containerName);
    await existing.stop().catch(() => {});
    await existing.remove();
  } catch {
    // Container may not exist
  }

  // Write auth-profiles.json (credentials read from file, not env vars)
  const { providerIds, modelOverrides, clawProxyKey, profiles, fingerprints } = writeAuthProfiles(orgId, member.user_id);
  reconcileAuthProfileStore(orgId, member.user_id, profiles, fingerprints);
  if (providerIds.length === 0)
    throw new Error("No API keys configured — add at least one provider key");

  // Read channel tokens (e.g. Telegram bot token)
  const channelTokens = getMemberChannelTokens(memberId);

  // Update config (keep existing token; skills installed as directories)
  const skills = getMemberSkills(orgId, member.user_id);
  const gatewayDir = getGatewayDir(orgId, member.user_id);
  const configPath = path.join(gatewayDir, "openclaw.json");
  const clawProxyBaseUrl = process.env.CLAW_PROXY_URL || 'http://claw-proxy:3456/v1';
  const configOptions = {
    port: GATEWAY_INTERNAL_PORT,
    token: member.gateway_token,
    activeProviderIds: providerIds,
    modelOverrides,
    channelTokens,
    clawProxy: clawProxyKey ? { baseUrl: clawProxyBaseUrl, apiKey: clawProxyKey } : undefined,
    primaryProviderId: getOrgPrimaryProvider(orgId) ?? undefined,
    ...getControlUiOrigins(member.gateway_subdomain),
  };

  // Merge into existing config to preserve user customizations;
  // fall back to fresh generation if no existing config is found.
  let config;
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config = mergeOpenClawConfig(existing, configOptions);
  } catch {
    config = generateOpenClawConfig(configOptions);
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Install skill directories
  await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Create new container (credentials via auth-profiles.json, no env vars needed)
  const container = await docker.createContainer(
    createContainerConfig(
      containerName,
      member.gateway_subdomain,
      orgId,
      member.user_id,
    ),
  );

  await container.start();

  // In local dev, read the actual host port Docker allocated
  const actualPort = (await getHostPort(containerName)) || member.gateway_port;
  if (actualPort !== member.gateway_port) {
    db.prepare("UPDATE org_members SET gateway_port = ? WHERE id = ?").run(
      actualPort,
      memberId,
    );
  }

  db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
    "deploying",
    memberId,
  );

  return {
    memberId,
    userId: member.user_id,
    gateway_port: actualPort,
    gateway_status: "deploying" as const,
  };
}

export async function redeployAllGateways(orgId: string) {
  const db = getDb();
  const members = db
    .prepare(
      "SELECT id FROM org_members WHERE org_id = ? AND gateway_port IS NOT NULL",
    )
    .all(orgId) as { id: string }[];

  const results: { memberId: string; gateway_status: string }[] = [];
  const errors: { memberId: string; error: string }[] = [];

  for (const { id: memberId } of members) {
    try {
      const result = await redeployGateway(orgId, memberId);
      results.push({ memberId, gateway_status: result.gateway_status });
    } catch (err: any) {
      console.error(`Failed to redeploy gateway for member ${memberId}:`, err.message);
      errors.push({ memberId, error: err.message });
    }
  }

  return { results, errors };
}

export async function getGatewayStatus(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_port) {
    return {
      memberId,
      userId: member.user_id,
      gateway_port: null,
      gateway_status: null,
      gateway_subdomain: null,
    };
  }

  // Sync DB with actual container + health state
  const containerName = getContainerName(orgId, member.user_id);
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();

    if (!info.State.Running) {
      if (member.gateway_status !== "stopped") {
        db.prepare(
          "UPDATE org_members SET gateway_status = ? WHERE id = ?",
        ).run("stopped", memberId);
      }
      return {
        memberId,
        userId: member.user_id,
        gateway_port: member.gateway_port,
        gateway_status: "stopped" as const,
        gateway_subdomain: member.gateway_subdomain,
      };
    }

    // Container is running — check if gateway HTTP is actually ready
    const healthy = await checkGatewayHealth(containerName);
    const actualStatus = healthy ? "running" : "deploying";

    if (actualStatus !== member.gateway_status) {
      db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
        actualStatus,
        memberId,
      );
    }

    return {
      memberId,
      userId: member.user_id,
      gateway_port: member.gateway_port,
      gateway_status: actualStatus,
      gateway_subdomain: member.gateway_subdomain,
    };
  } catch {
    // Container doesn't exist — mark as stopped
    if (member.gateway_status !== "stopped") {
      db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
        "stopped",
        memberId,
      );
    }
    return {
      memberId,
      userId: member.user_id,
      gateway_port: member.gateway_port,
      gateway_status: "stopped" as const,
      gateway_subdomain: member.gateway_subdomain,
    };
  }
}

/** Run a command inside a member's gateway container and return stdout. */
async function execInContainer(
  containerName: string,
  cmd: string[],
): Promise<string> {
  const container = docker.getContainer(containerName);
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({});
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", async () => {
      try {
        const info = await exec.inspect();
        const output = Buffer.concat(chunks).toString("utf-8");
        if (info.ExitCode !== 0) {
          reject(new Error(output.trim() || `Exit code ${info.ExitCode}`));
        } else {
          resolve(output);
        }
      } catch (err) {
        reject(err);
      }
    });
    stream.on("error", reject);
    setTimeout(() => reject(new Error("exec timeout")), 10000);
  });
}

/** Approve a pairing code for a channel in the member's gateway container. */
export async function approvePairing(
  orgId: string,
  memberId: string,
  channel: string,
  code: string,
): Promise<string> {
  const member = getMember(orgId, memberId);
  if (member.gateway_status !== "running") {
    throw new Error("Gateway is not running");
  }
  const containerName = getContainerName(orgId, member.user_id);
  const output = await execInContainer(containerName, [
    "openclaw",
    "pairing",
    "approve",
    channel,
    code,
  ]);
  return output.trim();
}

/**
 * Remove all gateway containers and workspace files for an org.
 * Does NOT touch the DB — caller is responsible for deleting org rows.
 */
export async function deleteOrgGateways(orgId: string): Promise<void> {
  const db = getDb();
  const members = db
    .prepare(
      "SELECT * FROM org_members WHERE org_id = ? AND gateway_port IS NOT NULL",
    )
    .all(orgId) as any[];

  for (const member of members) {
    const containerName = getContainerName(orgId, member.user_id);
    try {
      const container = docker.getContainer(containerName);
      await container.stop().catch(() => {});
      await container.remove().catch(() => {});
    } catch {
      // Container may already be gone
    }

    const gatewayDir = getGatewayDir(orgId, member.user_id);
    if (fs.existsSync(gatewayDir)) {
      fs.rmSync(gatewayDir, { recursive: true });
    }
  }

  // Remove the whole org gateway directory if it exists
  const orgGatewayDir = path.join(getDataDir(), "gateways", orgId);
  if (fs.existsSync(orgGatewayDir)) {
    fs.rmSync(orgGatewayDir, { recursive: true });
  }
}

/** Get Docker container IDs for all gateway containers in an org. */
export async function getOrgContainerIds(orgId: string): Promise<Map<string, string>> {
  const result = new Map<string, string>(); // userId -> containerId
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { name: [`${CONTAINER_PREFIX}${orgId.slice(0, 8)}-`] },
    });
    for (const c of containers) {
      // Container name format: /clawhuddle-gw-{orgId8}-{userId8}
      const name = c.Names[0]?.replace(/^\//, '') || '';
      const suffix = name.replace(`${CONTAINER_PREFIX}${orgId.slice(0, 8)}-`, '');
      if (suffix && suffix !== name) {
        // Map the 8-char userId prefix back — caller matches against full userId
        result.set(suffix, c.Id);
      }
    }
  } catch {
    // Docker may be unavailable
  }
  return result;
}

/** List pending pairing requests for a channel. */
export async function listPairingRequests(
  orgId: string,
  memberId: string,
  channel: string,
): Promise<string> {
  const member = getMember(orgId, memberId);
  if (member.gateway_status !== "running") {
    throw new Error("Gateway is not running");
  }
  const containerName = getContainerName(orgId, member.user_id);
  const output = await execInContainer(containerName, [
    "openclaw",
    "pairing",
    "list",
    channel,
  ]);
  return output.trim();
}
