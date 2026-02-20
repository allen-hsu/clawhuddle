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
  created_at: string;
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

// === Provider Registry ===

export type CredentialType = 'api_key' | 'token' | 'oauth';

export interface ProviderConfig {
  id: string;
  label: string;
  envVar: string;
  placeholder: string;
  /** Model ID used for agents.defaults.model in openclaw.json */
  defaultModel: string;
  /** Whether this provider supports setup tokens (e.g. `claude setup-token`) */
  supportsSetupToken?: boolean;
  /** Instructions shown in UI for obtaining a setup token */
  setupTokenInstructions?: string;
  /** Whether this provider supports OAuth token paste (e.g. Codex auth.json) */
  supportsOAuth?: boolean;
  /** Instructions shown in UI for obtaining OAuth tokens */
  oauthInstructions?: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'anthropic', label: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', placeholder: 'sk-ant-...', defaultModel: 'anthropic/claude-sonnet-4-5', supportsSetupToken: true, setupTokenInstructions: 'Run `claude setup-token` in your terminal and paste the result here.' },
  { id: 'openai', label: 'OpenAI', envVar: 'OPENAI_API_KEY', placeholder: 'sk-...', defaultModel: 'openai/gpt-4.1' },
  { id: 'openai-codex', label: 'OpenAI Codex', envVar: '', placeholder: '', defaultModel: 'openai-codex/gpt-5.3-codex', supportsOAuth: true, oauthInstructions: 'Run `codex` and sign in with your ChatGPT account, then run `cat ~/.codex/auth.json` and paste the JSON here.' },
  { id: 'openrouter', label: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', placeholder: 'sk-or-...', defaultModel: 'openrouter/anthropic/claude-sonnet-4.5' },
  { id: 'google', label: 'Google Gemini', envVar: 'GEMINI_API_KEY', placeholder: 'AIza...', defaultModel: 'google/gemini-2.5-pro' },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export interface SetApiKeyRequest {
  provider: string;
  key: string;
  credentialType?: CredentialType;
}
