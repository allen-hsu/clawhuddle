import Docker from "dockerode";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../db/index.js";
import { getOrgAllApiKeys } from "../routes/org/api-keys.js";
import { generateOpenClawConfig, mergeOpenClawConfig, type ChannelTokens } from "./openclaw-config.js";
import { installSkillsForUser } from "./skill-installer.js";
import type { Skill, OrgMember } from "@clawhuddle/shared";
import { PROVIDERS } from "@clawhuddle/shared";

const {ServicesClient} = require('@google-cloud/run').v2;

const runClient = new ServicesClient();

const GCP_PROJECT = process.env.GCP_PROJECT;
const GCP_LOCATION = process.env.GCP_LOCATION;
const SERVICE_PARENT = "projects/" + GCP_PROJECT + "/locations/" + GCP_LOCATION;

const docker = new Docker();

const GATEWAY_IMAGE = "clawhuddle-gateway:local";
// OpenClaw listens on loopback:6100; socat bridges external traffic on 0.0.0.0:6101
const CONTAINER_PREFIX = "clawhuddle-gw-";

async function checkGatewayHealth(gateway_url: string): Promise<boolean> {
  let res = false;
  fetch(gateway_url)
      .then(r=>(r.ok||r.status===401)?res=true:res=false)
      .catch(()=>res=false)

  return res
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


function getHostGatewayDir(orgId: string, userId: string): string {
  return path.join(getHostDataDir(), "gateways", orgId, userId);
}

function getContainerName(orgId: string, userId: string): string {
  // Keep under 63 chars for Docker DNS resolution
  return `${CONTAINER_PREFIX}${orgId.slice(0, 8)}-${userId.slice(0, 8)}`;
}

// Gateway subdomain: "claw-{hex}" under parent domain
function generateServiceName(orgId: string, memberId: string): string {
  return `claw-${orgId}-${memberId.slice(0,8)}-${crypto.randomBytes(4).toString("hex")}`;
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

/**
 * Writes auth-profiles.json for a gateway so OpenClaw reads credentials
 * from the file (hot-reloaded) instead of env vars.
 * Returns the list of provider IDs that have credentials configured.
 */
// function writeAuthProfiles(orgId: string, userId: string): { providerIds: string[]; modelOverrides: Record<string, string> } {
//   const allKeys = getOrgAllApiKeys(orgId);
//   const profiles: Record<string, Record<string, unknown>> = {};
//   const providerIds: string[] = [];
//   const modelOverrides: Record<string, string> = {};
//
//   for (const { provider, key, credential_type, default_model } of allKeys) {
//     const providerConfig = PROVIDERS.find((p) => p.id === provider);
//     if (!providerConfig) continue;
//     providerIds.push(provider);
//     if (default_model) modelOverrides[provider] = default_model;
//
//     if (credential_type === "oauth") {
//       // key is a JSON blob — Codex format: { tokens: { access_token, refresh_token, ... } }
//       try {
//         const oauth = JSON.parse(key);
//         const tokens = oauth.tokens ?? oauth;
//         if (!tokens.access_token || !tokens.refresh_token) continue;
//
//         // Extract expiry from JWT payload (middle segment)
//         let expires: number | undefined;
//         try {
//           const payload = JSON.parse(
//             Buffer.from(tokens.access_token.split(".")[1], "base64").toString(),
//           );
//           if (payload.exp) expires = payload.exp;
//         } catch {
//           /* non-JWT or malformed — skip expires */
//         }
//
//         profiles[`${provider}:oauth`] = {
//           type: "oauth",
//           provider,
//           access: tokens.access_token,
//           refresh: tokens.refresh_token,
//           ...(expires ? { expires } : {}),
//         };
//       } catch {
//         // Skip malformed OAuth JSON
//         continue;
//       }
//     } else if (credential_type === "token") {
//       profiles[`${provider}:setup-token`] = {
//         type: "token",
//         provider,
//         token: key,
//       };
//     } else {
//       profiles[`${provider}:manual`] = { type: "api_key", provider, key };
//     }
//   }
//
//   const authProfilesPath = path.join(
//     getGatewayDir(orgId, userId),
//     "agents",
//     "main",
//     "agent",
//     "auth-profiles.json",
//   );
//   fs.mkdirSync(path.dirname(authProfilesPath), { recursive: true });
//   fs.writeFileSync(
//     authProfilesPath,
//     JSON.stringify({ version: 1, profiles }, null, 2),
//   );
//
//   return { providerIds, modelOverrides };
// }

/**
 * Live-update auth-profiles.json for all running gateways in an org.
 * Called after API key add/delete so credentials propagate without container restart.
 */
export function syncAuthProfiles(orgId: string): void {
  // todo: sync api key to service storage
  // const db = getDb();
  // const runningMembers = db
  //   .prepare(
  //     `SELECT om.user_id FROM org_members om
  //    WHERE om.org_id = ? AND om.gateway_status IN ('running', 'deploying')`,
  //   )
  //   .all(orgId) as { user_id: string }[];
  //
  // for (const { user_id } of runningMembers) {
  //   const gatewayDir = getGatewayDir(orgId, user_id);
  //   if (fs.existsSync(gatewayDir)) {
  //     writeAuthProfiles(orgId, user_id);
  //   }
  // }
}

// function createContainerConfig(
//   containerName: string,
//   subdomain: string,
//   orgId: string,
//   userId: string,
// ) {
//   const hostConfig: Record<string, any> = {
//     Binds: [`${getHostGatewayDir(orgId, userId)}:/root/.openclaw`],
//     RestartPolicy: { Name: "unless-stopped" },
//   };
//
//   // Local dev: publish socat port so gateway is accessible without Traefik
//   if (IS_LOCAL_DEV) {
//     hostConfig.PortBindings = {
//       [`${GATEWAY_EXTERNAL_PORT}/tcp`]: [{ HostPort: "0" }], // 0 = random available port
//     };
//   }
//
//   return {
//     Image: GATEWAY_IMAGE,
//     name: containerName,
//     Env: [],
//     Labels: createTraefikLabels(containerName, subdomain),
//     ExposedPorts: { [`${GATEWAY_EXTERNAL_PORT}/tcp`]: {} },
//     HostConfig: hostConfig,
//     NetworkingConfig: {
//       EndpointsConfig: {
//         [DOCKER_NETWORK]: {},
//       },
//     },
//   };
// }

export async function provisionGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (
    member.gateway_status === "running" ||
    member.gateway_status === "deploying"
  ) {
    throw new Error("Gateway already running");
  }

  // generate token and service name
  const token = crypto.randomBytes(24).toString("hex");
  const serviceName = generateServiceName(orgId, memberId);

  // todo: Assign unique dir in cloud storage(should be object storage) for agent

  // todo: Assign key to agent
  // Write auth-profiles.json (credentials read from file, not env vars)
  // const { providerIds, modelOverrides } = writeAuthProfiles(orgId, member.user_id);
  // if (providerIds.length === 0)
  //   throw new Error("No API keys configured — add at least one provider key");

  // todo: Assign skills
  // Get member's skills
  // const skills = getMemberSkills(orgId, member.user_id);

  // todo: Assign channel tokens (e.g. Telegram bot token)
  // Read channel tokens (e.g. Telegram bot token)
  // const channelTokens = getMemberChannelTokens(memberId);

  // todo: Generate config
  // Generate config
  // const config = generateOpenClawConfig({
  //   port,
  //   token,
  //   activeProviderIds: providerIds,
  //   modelOverrides,
  //   channelTokens,
  // });
  // fs.writeFileSync(
  //   path.join(gatewayDir, "openclaw.json"),
  //   JSON.stringify(config, null, 2),
  // );

  // todo: Install skill to Agent
  // Install skill directories (still keyed by userId for filesystem)
  // await installSkillsForUser(path.join(orgId, member.user_id), skills);

  // Update DB with provisioning status + token + subdomain
  db.prepare(
    "UPDATE org_members SET gateway_status = ?, gateway_token = ? WHERE id = ?",
  ).run("provisioning", token, memberId);

  const createServiceRequest = {
    parent: SERVICE_PARENT,
    serviceId: serviceName,
    service: {
      description: "claw agent created by hatchery",
      template: {
        containers: [
          {
            image: "nginx:latest",
            ports: [{containerPort: 80}]
          }
        ]
      }
    }
  }

  try {
    const [operation] = await runClient.createService(createServiceRequest);
    const [response] = await operation.promise();
    console.log("Create service" + serviceName + "with response: " + response)

    db.prepare(
        "UPDATE org_members SET gateway_status = ?, gateway_url = ?, gateway_service_name = ? WHERE id = ?",
    ).run(
        "provisioning",
        response.uri,
        serviceName,
        memberId,
    )

    return {
      memberId,
      userId: member.user_id,
      gateway_status: "provisioning" as const,
      gateway_url: response.uri
    }
  } catch (err) {
    db.prepare(
        "UPDATE org_members SET gateway_status = NULL, gateway_token = ? WHERE id = ?",
    ).run(memberId);
    throw err;
  }
}

async function adjustServiceLimit(serviceName: string, expectedLimit: number) {
  const request = {
    service: {
      name: `${SERVICE_PARENT}/services/${serviceName}`,
      template: {
        scaling: {
          maxInstanceCount: expectedLimit,
          minInstanceCount: expectedLimit,
        },
      },
    },
    updateMask: {
      paths: ["template.scaling.max_instance_count", "template.scaling.min_instance_count"],
    },
  };

  try {
    const [operation] = await runClient.updateService(request);
    const [response] = await operation.promise();
    console.log("Update service" + serviceName + "with response: " + response)
  } catch (error) {
    console.error("Error update service:", error);
    throw error;
  }
}

export async function stopGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_url || !member.gateway_service_name) throw new Error("No gateway deployed");

  try {
    await adjustServiceLimit(member.gateway_service_name, 0);
  } catch (error) {
    console.error("Error adjust gateway service limit:", error);
    throw error;
  }

  db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
    "stopped",
    memberId,
  );

  return {
    memberId,
    userId: member.user_id,
    gateway_url: member.gateway_url,
    gateway_status: "stopped" as const,
  };
}

export async function startGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_url || !member.gateway_service_name) throw new Error("No gateway deployed");

  try {
    await adjustServiceLimit(member.gateway_service_name, 1);
  } catch (error) {
    console.error("Error adjust gateway service limit:", error);
    throw error;
  }

  db.prepare("UPDATE org_members SET gateway_status = ? WHERE id = ?").run(
      "deploying",
      memberId,
  );

  return {
    memberId,
    userId: member.user_id,
    gateway_url: member.gateway_url,
    gateway_status: "deploying" as const,
  };
}

export async function removeGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_url || !member.gateway_service_name) throw new Error("No gateway deployed");

  const request = {
    name: SERVICE_PARENT + "/services/" + member.gateway_service_name
  };

  // todo: delete gateway service dir from object store

  try {
    const [operation] = await runClient.deleteService(request);
    const [response] = await operation.promise();
    console.log("Delete service" + member.gateway_service_name + "with response: " + response)
  } catch (error) {
    console.error("Error delete service:", error);
    throw error;
  }

  // Reset DB fields
  db.prepare(
    "UPDATE org_members SET gateway_status = NULL, gateway_token = NULL, gateway_url = NULL, gateway_service_name = NULL WHERE id = ?",
  ).run(memberId);

  return {
    memberId,
    userId: member.user_id,
    gateway_status: null,
    gateway_url: null,
    gateway_service_name: null,
  };
}

export async function redeployGateway(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_token || !member.gateway_url)
    throw new Error("No gateway deployed");

  try {
    console.log("Redeploying gateway for member:", memberId);
    return await provisionGateway(orgId, memberId);
  } catch (error) {
    console.error("Error redeploy gateway:", error);
    throw error;
  }
}

export async function getGatewayStatus(orgId: string, memberId: string) {
  const db = getDb();
  const member = getMember(orgId, memberId);
  if (!member.gateway_url) {
    return {
      memberId,
      userId: member.user_id,
      gateway_url: null,
      gateway_status: null,
      gateway_service_name: null,
    };
  }

  const request = {
    name: SERVICE_PARENT + "/services/" + member.gateway_service_name
  }

  try {
    const response = await runClient.getService(request);

    if (response.template.scaling.maxInstanceCount === 0 && member.gateway_status !== "stopped") {
      db.prepare(
          "UPDATE org_members SET gateway_status = ? WHERE id = ?",
      ).run("stopped", memberId);

      return {
        memberId,
        userId: member.user_id,
        gateway_url: member.gateway_url,
        gateway_status: "stopped",
        gateway_service_name: member.gateway_service_name,
      }
    }

    // Container is running — check if gateway HTTP is actually ready
    const healthy = await checkGatewayHealth(member.gateway_url);
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
      gateway_url: member.gateway_url,
      gateway_status: actualStatus,
      gateway_service_name: member.gateway_service_name,
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
      gateway_url: member.gateway_url,
      gateway_status: "stopped" as const,
      gateway_service_name: member.gateway_service_name,
    };
  }
}

/** Approve a pairing code for a channel in the member's gateway container. */
// todo channel approval
// export async function approvePairing(
//   orgId: string,
//   memberId: string,
//   channel: string,
//   code: string,
// ): Promise<string> {
//   const member = getMember(orgId, memberId);
//   if (member.gateway_status !== "running") {
//     throw new Error("Gateway is not running");
//   }
//   const containerName = getContainerName(orgId, member.user_id);
//   const output = await execInContainer(containerName, [
//     "openclaw",
//     "pairing",
//     "approve",
//     channel,
//     code,
//   ]);
//   return output.trim();
// }

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
    try {
      await redeployGateway(orgId, member.id);
    } catch(error) {
      console.warn("Trying to delete org gateway of org " + orgId + " and get :" + error);
      // Container may already be gone
    }

    // todo: Delete gateway dir
  }

  // todo: Remove the whole org gateway directory if it exists
}

/** Get Docker container IDs for all gateway containers in an org. */
export async function getOrgServices(orgId: string): Promise<Map<string, string>> {
  const result = new Map<string, string>(); // userId -> containerId

  try {
    const pattern = `${orgId}-`

    const request = {
      parent: SERVICE_PARENT
    };

    const iterable = runClient.listServicesAsync(request);
    const serviceNameRegex = new RegExp(`claw-${orgId}-(?<memberId>[a-f0-9A-Z]+)-[a-f0-9]+$`);

    for await (const response of iterable) {
      if (!response.name)
        continue;
      const match = response.name.match(serviceNameRegex);
      if (match) {
        result.set(match.groups.memberId, response.name);
      }
    }
  } catch (e) {
    console.error(`getting services of org ${orgId}: ${e}`);
  }

  return result;
}

/** List pending pairing requests for a channel. */
// export async function listPairingRequests(
//   orgId: string,
//   memberId: string,
//   channel: string,
// ): Promise<string> {
//   const member = getMember(orgId, memberId);
//   if (member.gateway_status !== "running") {
//     throw new Error("Gateway is not running");
//   }
//   const containerName = getContainerName(orgId, member.user_id);
//   const output = await execInContainer(containerName, [
//     "openclaw",
//     "pairing",
//     "list",
//     channel,
//   ]);
//   return output.trim();
// }
