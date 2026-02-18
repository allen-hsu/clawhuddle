// === Database Row Types ===

export interface Company {
  id: string;
  name: string;
  allowed_domain: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: 'admin' | 'member';
  status: 'active' | 'disabled';
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'provisioning' | null;
  gateway_token: string | null;
  created_at: string;
  last_login: string | null;
}

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  type: 'mandatory' | 'optional' | 'restricted';
  path: string;
  enabled: boolean;
  created_at: string;
}

export interface UserSkill {
  user_id: string;
  skill_id: string;
  enabled: boolean;
}

export interface ApiKey {
  id: string;
  provider: 'anthropic' | 'openai';
  key_encrypted: string;
  is_company_default: boolean;
  created_at: string;
}

export interface UsageLog {
  id: number;
  user_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

// === API Request/Response Types ===

export interface CreateUserRequest {
  email: string;
  name?: string;
  role?: 'admin' | 'member';
}

export interface UpdateUserRequest {
  status?: 'active' | 'disabled';
  role?: 'admin' | 'member';
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  type?: 'mandatory' | 'optional' | 'restricted';
  path: string;
}

export interface UpdateSkillRequest {
  type?: 'mandatory' | 'optional' | 'restricted';
  enabled?: boolean;
}

export interface SetApiKeyRequest {
  provider: 'anthropic' | 'openai';
  key: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

// === API Response wrappers ===

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  message: string;
}

export interface GatewayActionResponse {
  userId: string;
  gateway_port: number | null;
  gateway_status: 'running' | 'stopped' | 'provisioning' | null;
}
