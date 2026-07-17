// === Tier System ===

export type OrgTier = 'free' | 'pro' | 'enterprise';

/** Default member limit per org. Override via MAX_MEMBERS_PER_ORG env var. */
export const DEFAULT_MAX_MEMBERS = 50;

// === Database Row Types ===

export interface Organization {
  id: string;
  name: string;
  slug: string;
  tier: OrgTier;
  /** Provider id (e.g. "openai-codex") pinned by admin as agents.defaults.model.primary. Null = alphabetical fallback. */
  primary_provider: string | null;
  created_at: string;
}

export interface UpdateOrgRequest {
  /** Pass null to clear the pin and fall back to alphabetical ordering. */
  primary_provider?: string | null;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'disabled';
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'deploying' | 'provisioning' | null;
  gateway_token: string | null;
  gateway_subdomain: string | null;
  joined_at: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  last_login: string | null;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  type: 'mandatory' | 'optional' | 'restricted';
  path: string;
  git_url: string | null;
  git_path: string | null;
  org_id: string | null;
  enabled: boolean;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// === API Request/Response Types ===

export interface CreateOrgRequest {
  name: string;
  slug?: string;
}

export interface InviteMemberRequest {
  email: string;
  role?: 'admin' | 'member';
}

export interface UpdateMemberRequest {
  role?: 'owner' | 'admin' | 'member';
  status?: 'active' | 'disabled';
}

export interface AcceptInviteRequest {
  token: string;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  type?: 'mandatory' | 'optional' | 'restricted';
  path?: string;
  git_url: string;
  git_path: string;
}

export interface UpdateSkillRequest {
  type?: 'mandatory' | 'optional' | 'restricted';
  enabled?: boolean;
  git_url?: string;
  git_path?: string;
}

export interface ScanRepoRequest {
  git_url: string;
}

export interface ScanRepoResult {
  name: string;
  git_path: string;
}

export interface ImportSkillsRequest {
  git_url: string;
  skills: { name: string; git_path: string }[];
}

export interface BatchUpdateUserSkillsRequest {
  skills: { id: string; enabled: boolean }[];
}

// === Provider Registry ===

export type CredentialType = 'api_key' | 'token' | 'oauth';

export interface ModelOption {
  id: string;
  label: string;
}

export interface ProviderConfig {
  id: string;
  label: string;
  envVar: string;
  placeholder: string;
  /** Model ID used for agents.defaults.model in openclaw.json */
  defaultModel: string;
  /**
   * OpenClaw agent runtime that serves this provider's models, written as
   * `agents.defaults.models[<id>].agentRuntime`. Set it for subscriptions whose
   * models come from a runtime and its linked account rather than from a
   * provider API: enabling such a plugin takes the model out of the built-in
   * catalog, and without this OpenClaw looks it up in
   * `models.providers[...].models[]`, finds nothing, and fails every agent turn
   * with "Unknown model".
   */
  agentRuntime?: string;
  /** Available models the user can choose from */
  models?: ModelOption[];
  /** Whether this provider supports setup tokens (e.g. `claude setup-token`) */
  supportsSetupToken?: boolean;
  /** Instructions shown in UI for obtaining a setup token */
  setupTokenInstructions?: string;
  /** Whether this provider supports OAuth token paste (e.g. Codex auth.json) */
  supportsOAuth?: boolean;
  /** Instructions shown in UI for obtaining OAuth tokens */
  oauthInstructions?: string;
  /**
   * Whether individual members can set a personal key that overrides the org default.
   * Defaults to true. Set to false for providers where org-wide control matters
   * (e.g. claw-proxy: shared bearer / cost tracking).
   */
  personalOverridable?: boolean;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: 'anthropic', label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...',
    defaultModel: 'anthropic/claude-fable-5',
    models: [
      { id: 'anthropic/claude-fable-5', label: 'Claude Fable 5' },
      { id: 'anthropic/claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'anthropic/claude-opus-4-7', label: 'Claude Opus 4.7' },
      { id: 'anthropic/claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'anthropic/claude-opus-4-5', label: 'Claude Opus 4.5' },
      { id: 'anthropic/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
      { id: 'anthropic/claude-haiku-4-5', label: 'Claude Haiku 4.5' },
    ],
    supportsSetupToken: true, setupTokenInstructions: 'Run `claude setup-token` in your terminal and paste the result here.',
  },
  {
    id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY', placeholder: 'sk-...',
    defaultModel: 'openai/gpt-4.1',
    models: [
      { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
      { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
  },
  {
    id: 'claw-proxy', label: 'Claw Proxy (Claude Max)', envVar: '', placeholder: 'Bearer token from claw-proxy config',
    defaultModel: 'claw/claude-sonnet-4-6',
    personalOverridable: false,
    models: [
      { id: 'claw/claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claw/claude-opus-4-6', label: 'Claude Opus 4.6' },
      { id: 'claw/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'claw/claude-opus-4', label: 'Claude Opus 4' },
      { id: 'claw/claude-haiku-4', label: 'Claude Haiku 4' },
    ],
  },
  // Codex subscription is served under OpenClaw's canonical `openai` namespace
  // (model ref `openai/gpt-5.5`); the auth-profile provider is remapped to
  // `openai` in writeAuthProfiles(). The `openai-codex` id stays as the
  // platform-level provider so ChatGPT/Codex OAuth keys are tracked separately
  // from OpenAI API keys in the DB/UI and org primary-provider pin.
  // Codex models are served by the bundled `codex` agent runtime off the linked
  // ChatGPT account, not by the OpenAI provider API — hence agentRuntime. They
  // still use `openai/*` refs because OpenClaw merges Codex into that namespace.
  //
  // Which models a subscription offers comes from the linked account, so a new
  // default has to be confirmed against a real one with
  // `openclaw models list --provider openai` on a 2026.7.1 gateway — gpt-5.6
  // was, and enumerates there at 1050k text+image.
  { id: 'openai-codex', label: 'OpenAI Codex', envVar: '', placeholder: '', defaultModel: 'openai/gpt-5.6', agentRuntime: 'codex', models: [{ id: 'openai/gpt-5.6', label: 'GPT-5.6' }, { id: 'openai/gpt-5.5', label: 'GPT-5.5' }], supportsOAuth: true, oauthInstructions: 'Run `codex` and sign in with your ChatGPT account, then run `cat ~/.codex/auth.json` and paste the JSON here.' },
  { id: 'openrouter', label: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', placeholder: 'sk-or-...', defaultModel: 'openrouter/anthropic/claude-sonnet-4.5' },
  { id: 'google', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', placeholder: 'AIza...', defaultModel: 'google/gemini-2.5-pro' },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export interface SetApiKeyRequest {
  provider: string;
  key: string;
  credentialType?: CredentialType;
  /** User-selected default model for this provider */
  defaultModel?: string;
}
