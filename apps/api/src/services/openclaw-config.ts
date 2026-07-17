import { PROVIDERS } from '@clawhuddle/shared';

// Channel plugins enabled on every gateway — exactly the channels this platform
// can hand a token to (see validChannels in routes/org/member-channels.ts).
//
// Everything else is deliberately left out. An enabled plugin is not free: only
// telegram and imessage ship inside OpenClaw, so the rest are downloaded from npm
// into the gateway's state on its first boot, and since 2026.7.1 that download is
// load-bearing — a configured plugin that fails to install stops startup
// migrations and the gateway refuses to come up at all (2026.6.11 only warned).
// Enabling a channel we cannot configure buys nothing and puts another package
// between a new gateway and starting.
//
// whatsapp is doubly excluded: it is the only channel sourced from ClawHub
// (`clawhub:@openclaw/whatsapp`) rather than npm, so it also drags a second
// registry into the boot path.
//
// Once installed, plugins are cached in the mounted state — later boots need no
// network at all. Adding to this list re-opens that window on every gateway.
const CHANNEL_PLUGINS = [
  'telegram',
  'discord',
  'slack',
];

/**
 * An entry in agents.defaults.models. `agentRuntime` binds the model to an
 * OpenClaw agent runtime, which then serves it from its linked account instead
 * of from models.providers[...].models[].
 */
export interface ModelEntry {
  agentRuntime?: { id: string };
}

export interface ChannelTokens {
  telegram?: string;
  discord?: string;
  slack?: string;
}

export interface OpenClawConfig {
  meta: {
    lastTouchedVersion: string;
    lastTouchedAt: string;
  };
  commands: {
    native: string;
    nativeSkills: string;
    config: boolean;
  };
  env?: Record<string, string>;
  models?: {
    providers: Record<string, {
      baseUrl: string;
      apiKey: string;
      api: string;
      models: {
        id: string;
        name: string;
        reasoning?: boolean;
        input?: string[];
        cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
        contextWindow: number;
        maxTokens: number;
      }[];
    }>;
  };
  gateway: {
    mode: string;
    port: number;
    bind: string;
    controlUi: {
      enabled: boolean;
      allowInsecureAuth: boolean;
      allowedOrigins?: string[];
      dangerouslyAllowHostHeaderOriginFallback?: boolean;
    };
    auth: {
      mode: string;
      token: string;

    };
    trustedProxies?: string[];
  };
  agents?: {
    defaults: {
      model: { primary: string; fallbacks?: string[] };
      models: Record<string, ModelEntry>;
    };
  };
  channels?: Record<string, { enabled: boolean; botToken: string; dmPolicy?: string; allowFrom?: string[] }>;
  plugins: {
    entries: Record<string, { enabled: boolean }>;
  };
}

export function generateOpenClawConfig(options: {
  port: number;
  token: string;
  enabledChannels?: string[];
  activeProviderIds?: string[];
  /** Per-provider model overrides from DB (provider id -> model id) */
  modelOverrides?: Record<string, string>;
  channelTokens?: ChannelTokens;
  /** Explicit allowed origins for Control UI (e.g. ["https://claw-xx.example.com"]) */
  allowedOrigins?: string[];
  /** Use Host-header fallback for origin check (local dev only) */
  useHostHeaderFallback?: boolean;
  /** Claw-proxy configuration (custom provider for Claude Max subscriptions) */
  clawProxy?: { baseUrl: string; apiKey: string };
  /**
   * Provider id pinned by the org as the primary model. If set AND the user has a key
   * for it, that provider becomes agents.defaults.model.primary; otherwise falls back
   * to the natural (alphabetical) order of activeProviderIds.
   */
  primaryProviderId?: string;
}): OpenClawConfig {
  const { port, token } = options;
  const channels = options.enabledChannels ?? CHANNEL_PLUGINS;

  const pluginEntries: Record<string, { enabled: boolean }> = {};
  for (const ch of channels) {
    pluginEntries[ch] = { enabled: true };
  }

  const config: OpenClawConfig = {
    meta: {
      lastTouchedVersion: '2026.2.17',
      lastTouchedAt: new Date().toISOString(),
    },
    commands: {
      native: 'auto',
      nativeSkills: 'auto',
      config: true,
    },
    gateway: {
      mode: 'local',
      port,
      bind: 'loopback',
      controlUi: {
        enabled: true,
        allowInsecureAuth: true,
        ...(options.allowedOrigins?.length ? { allowedOrigins: options.allowedOrigins } : {}),
        ...(options.useHostHeaderFallback ? { dangerouslyAllowHostHeaderOriginFallback: true } : {}),
      },
      auth: {
        mode: 'token',
        token,

      },
      trustedProxies: [
          // Local / private ranges
          '127.0.0.0/8',
          '10.0.0.0/8',
          '172.16.0.0/12',
          '192.168.0.0/16',
          // Cloudflare IPv4 — https://www.cloudflare.com/ips-v4/
          '173.245.48.0/20',
          '103.21.244.0/22',
          '103.22.200.0/22',
          '103.31.4.0/22',
          '141.101.64.0/18',
          '108.162.192.0/18',
          '190.93.240.0/20',
          '188.114.96.0/20',
          '197.234.240.0/22',
          '198.41.128.0/17',
          '162.158.0.0/15',
          '172.64.0.0/13',
          '131.0.72.0/22',
          '104.16.0.0/13',
          '104.24.0.0/14',
        ],
    },
    plugins: {
      entries: pluginEntries,
    },
  };

  // Register claw-proxy as a custom OpenClaw provider
  if (options.clawProxy) {
    config.models = {
      providers: {
        claw: {
          baseUrl: options.clawProxy.baseUrl,
          apiKey: options.clawProxy.apiKey,
          api: 'openai-completions',
          models: [
            { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000000, maxTokens: 32000 },
            { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 1000000, maxTokens: 32000 },
            { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 16000 },
            { id: 'claude-opus-4', name: 'Claude Opus 4', reasoning: true, input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 32000 },
            { id: 'claude-haiku-4', name: 'Claude Haiku 4', input: ['text', 'image'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 16000 },
          ],
        },
      },
    };
  }

  // Set default model based on active providers so OpenClaw doesn't
  // fall back to Anthropic when only another provider's key exists.
  // If the org pinned a primary provider AND the user has a key for it,
  // hoist that provider to the front so its model becomes primary.
  let activeProviders = (options.activeProviderIds ?? [])
    .map((id) => PROVIDERS.find((p) => p.id === id))
    .filter(Boolean) as typeof PROVIDERS;

  if (options.primaryProviderId) {
    const pinnedIdx = activeProviders.findIndex((p) => p.id === options.primaryProviderId);
    if (pinnedIdx > 0) {
      const pinned = activeProviders[pinnedIdx];
      activeProviders = [pinned, ...activeProviders.slice(0, pinnedIdx), ...activeProviders.slice(pinnedIdx + 1)];
    }
  }

  if (activeProviders.length > 0) {
    const overrides = options.modelOverrides ?? {};
    const models: Record<string, ModelEntry> = {};
    // Use user-selected model if set, otherwise provider default
    const resolveModel = (p: (typeof PROVIDERS)[number]) => overrides[p.id] || p.defaultModel;

    for (const p of activeProviders) {
      // A provider whose models come from an agent runtime must say so here.
      // Enabling its plugin takes those models out of the built-in catalog, and
      // an entry left empty sends OpenClaw looking in models.providers[...],
      // where it finds nothing and fails every turn with "Unknown model".
      models[resolveModel(p)] = p.agentRuntime ? { agentRuntime: { id: p.agentRuntime } } : {};
    }
    const primary = resolveModel(activeProviders[0]);
    const fallbacks = activeProviders.slice(1).map((p) => resolveModel(p));

    config.agents = {
      defaults: {
        model: { primary, ...(fallbacks.length > 0 ? { fallbacks } : {}) },
        models,
      },
    };
  }

  // Configure channel tokens (e.g. Telegram bot token)
  const ct = options.channelTokens;
  if (ct) {
    const channelsCfg: NonNullable<OpenClawConfig['channels']> = {};
    if (ct.telegram) {
      channelsCfg.telegram = { enabled: true, botToken: ct.telegram, dmPolicy: 'pairing' };
    }
    if (ct.discord) {
      channelsCfg.discord = { enabled: true, botToken: ct.discord };
    }
    if (ct.slack) {
      channelsCfg.slack = { enabled: true, botToken: ct.slack };
    }
    if (Object.keys(channelsCfg).length > 0) {
      config.channels = channelsCfg;
    }
  }

  return config;
}

/**
 * Merge platform-managed fields into an existing OpenClaw config,
 * preserving any user customizations (custom agent settings, extra fields, etc.).
 */
export function mergeOpenClawConfig(
  existing: Record<string, unknown>,
  options: Parameters<typeof generateOpenClawConfig>[0],
): OpenClawConfig {
  const generated = generateOpenClawConfig(options);

  // Deep clone existing to avoid mutation
  const merged = JSON.parse(JSON.stringify(existing)) as Record<string, unknown>;

  // Platform-managed: meta
  merged.meta = generated.meta;

  // Platform-managed: gateway auth, port, bind, controlUi, trustedProxies
  // (preserve any user-added gateway fields like custom mode settings)
  if (typeof merged.gateway !== 'object' || merged.gateway === null) {
    merged.gateway = {};
  }
  const gw = merged.gateway as Record<string, unknown>;
  gw.mode = generated.gateway.mode;
  gw.auth = generated.gateway.auth;
  gw.port = generated.gateway.port;
  gw.bind = generated.gateway.bind;
  gw.controlUi = generated.gateway.controlUi;
  gw.trustedProxies = generated.gateway.trustedProxies;

  // Platform-managed: models.providers.claw (claw-proxy custom provider)
  if (generated.models) {
    merged.models = generated.models;
  } else {
    delete merged.models;
  }

  // Clean up legacy env.OPENAI_BASE_URL if present
  if (merged.env && typeof merged.env === 'object') {
    delete (merged.env as Record<string, unknown>).OPENAI_BASE_URL;
    if (Object.keys(merged.env as object).length === 0) delete merged.env;
  }

  // Platform-managed: agents.defaults.model + agents.defaults.models
  if (generated.agents) {
    if (typeof merged.agents !== 'object' || merged.agents === null) {
      merged.agents = {};
    }
    (merged.agents as Record<string, unknown>).defaults = generated.agents.defaults;
  } else if (merged.agents && typeof merged.agents === 'object') {
    // No active providers — clear managed defaults but preserve other agent settings
    delete (merged.agents as Record<string, unknown>).defaults;
  }

  // Channels: initialize missing channels from generated, but preserve any
  // existing user customization (multi-account structures, group allowlists,
  // custom tokens, etc.). Once a channel exists in user config, the user owns it.
  // Never delete user's channels — they may have added accounts manually.
  if (generated.channels) {
    if (typeof merged.channels !== 'object' || merged.channels === null) {
      merged.channels = {};
    }
    const mergedChannels = merged.channels as Record<string, unknown>;
    for (const [channelId, channelCfg] of Object.entries(generated.channels)) {
      if (!(channelId in mergedChannels)) {
        mergedChannels[channelId] = channelCfg;
      }
    }
  }

  // Plugins: merge entries so user-added plugins (e.g. openai, anthropic)
  // are preserved. For platform-managed entries, shallow-merge so any extra
  // fields the user added on the same entry are kept.
  if (typeof merged.plugins !== 'object' || merged.plugins === null) {
    merged.plugins = { entries: {} };
  }
  const mergedPlugins = merged.plugins as { entries?: Record<string, { enabled: boolean }> };
  if (typeof mergedPlugins.entries !== 'object' || mergedPlugins.entries === null) {
    mergedPlugins.entries = {};
  }
  for (const [pluginId, pluginCfg] of Object.entries(generated.plugins.entries)) {
    mergedPlugins.entries[pluginId] = { ...(mergedPlugins.entries[pluginId] ?? {}), ...pluginCfg };
  }

  return merged as unknown as OpenClawConfig;
}
