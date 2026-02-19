// === Tier System ===

export type OrgTier = 'free' | 'pro' | 'enterprise';

export const TIER_LIMITS: Record<OrgTier, number> = {
  free: 5,
  pro: 20,
  enterprise: Infinity,
};

export const TIER_INFO: Record<OrgTier, { label: string; price: string; description: string }> = {
  free: { label: 'Free', price: '$0/mo', description: 'Up to 5 members' },
  pro: { label: 'Pro', price: '$10/mo', description: 'Up to 20 members' },
  enterprise: { label: 'Enterprise', price: 'Custom', description: 'Unlimited members' },
};

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

export interface SetApiKeyRequest {
  provider: 'anthropic' | 'openai';
  key: string;
}
