'use client';

import * as React from 'react';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { PROVIDERS, type CredentialType, type OrgMember } from '@clawhuddle/shared';

type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface ApiKeyDisplay {
  id: string;
  provider: string;
  key_masked: string;
  is_company_default: boolean;
  credential_type?: CredentialType;
  default_model?: string | null;
}

export interface UserSpecificKeyEntry {
  key: ApiKeyDisplay;
  assignedMemberIds: string[];
}

export interface ApiKeyData {
  defaults: ApiKeyDisplay[];
  userSpecific: UserSpecificKeyEntry[];
}

interface Props {
  initialData: ApiKeyData;
  fetchFn: FetchFn;
  members?: OrgMember[];
}

const CRED_TYPE_LABEL: Record<CredentialType, string> = {
  api_key: 'API Key',
  token: 'Setup Token',
  oauth: 'OAuth Token',
};

function getAvailableTabs(provider: (typeof PROVIDERS)[number]): CredentialType[] {
  if (provider.supportsOAuth && !provider.envVar) return ['oauth'];
  const tabs: CredentialType[] = ['api_key'];
  if (provider.supportsSetupToken) tabs.push('token');
  if (provider.supportsOAuth) tabs.push('oauth');
  return tabs;
}

// ---- Sub-component: Single key card with input row ----
function KeyCard({
  keyEntry,
  assignedMemberIds,
  isDefault,
  members,
  onDelete,
  onAssign,
  onUnassign,
  onModelChange,
  saving,
}: {
  keyEntry: ApiKeyDisplay;
  assignedMemberIds?: string[];
  isDefault: boolean;
  members: OrgMember[];
  onDelete: (id: string) => void;
  onAssign?: (keyId: string, memberId: string) => void;
  onUnassign?: (keyId: string, memberId: string) => void;
  onModelChange?: (keyId: string, model: string) => void;
  saving: boolean;
}) {
  const providerConfig = PROVIDERS.find(p => p.id === keyEntry.provider);
  const [addMember, setAddMember] = useState('');

  const assignedMembers = members.filter(m => assignedMemberIds?.includes(m.id));
  const unassignedMembers = members.filter(m => !assignedMemberIds?.includes(m.id));

  return (
    <div
      className="rounded-lg px-3 py-2 flex flex-col gap-1.5"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Key value display */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0"
          style={{
            background: keyEntry.credential_type === 'api_key' ? 'var(--bg-tertiary)' : 'var(--accent-muted,rgba(99,102,241,0.15))',
            color: keyEntry.credential_type === 'api_key' ? 'var(--text-tertiary)' : 'var(--accent)',
          }}
        >
          {CRED_TYPE_LABEL[keyEntry.credential_type ?? 'api_key']}
        </span>
        <code
          className="text-[11px] font-mono px-1.5 py-0.5 rounded flex-1"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
        >
          {keyEntry.key_masked}
        </code>
        <button
          onClick={() => onDelete(keyEntry.id)}
          disabled={saving}
          className="text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-50 shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error,#ef4444)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
        >
          Delete
        </button>
      </div>

      {/* Model selector (only when provider has a models list) */}
      {providerConfig?.models && providerConfig.models.length > 0 && onModelChange && (
        <div className="flex items-center gap-2 pl-1">
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Model:</span>
          <select
            value={keyEntry.default_model ?? providerConfig.defaultModel}
            onChange={(e) => onModelChange(keyEntry.id, e.target.value)}
            disabled={saving}
            className="text-[11px] px-2 py-0.5 rounded flex-1 disabled:opacity-50"
            style={{
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {providerConfig.models.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Show model label only (no selector) when no models list */}
      {(!providerConfig?.models || providerConfig.models.length === 0) && keyEntry.default_model && (
        <span className="text-[10px] pl-1" style={{ color: 'var(--text-tertiary)' }}>{keyEntry.default_model}</span>
      )}

      {/* Assigned members (for user-specific keys) */}
      {!isDefault && assignedMemberIds !== undefined && (
        <div className="pl-2 flex flex-col gap-1">
          {assignedMembers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {assignedMembers.map(m => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-muted,rgba(99,102,241,0.15))', color: 'var(--accent)' }}
                >
                  {m.name || m.email}
                  <button
                    onClick={() => onUnassign?.(keyEntry.id, m.id)}
                    disabled={saving}
                    className="opacity-60 hover:opacity-100 transition-opacity"
                    title="Remove assignment"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {unassignedMembers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={addMember}
                onChange={e => setAddMember(e.target.value)}
                className="text-[11px] px-2 py-0.5 rounded flex-1"
                style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <option value="">+ Add member...</option>
                {unassignedMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name || m.email}</option>
                ))}
              </select>
              <button
                onClick={() => {
                  if (addMember) {
                    onAssign?.(keyEntry.id, addMember);
                    setAddMember('');
                  }
                }}
                disabled={saving || !addMember}
                className="text-[11px] px-2 py-0.5 rounded disabled:opacity-40 transition-opacity"
                style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
              >
                Assign
              </button>
            </div>
          )}
          {assignedMemberIds.length === 0 && unassignedMembers.length === 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>No members available</span>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sub-component: Provider section (add key form) ----
function ProviderSection({
  providerId,
  isDefault,
  children,
  onSave,
  saving,
}: {
  providerId: string;
  isDefault: boolean;
  children?: React.ReactNode;
  onSave: (provider: string, key: string, cred: CredentialType, isDefault: boolean, defaultModel?: string) => void;
  saving: boolean;
}) {
  const providerConfig = PROVIDERS.find(p => p.id === providerId)!;
  const tabs = getAvailableTabs(providerConfig);
  const [activeTab, setActiveTab] = useState<CredentialType>(tabs[0]);
  const [input, setInput] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>(providerConfig?.defaultModel ?? '');

  const label = providerConfig?.label ?? providerId;

  return (
    <div className="flex flex-col gap-2">
      {/* existing key cards */}
      {children}

      {/* add key row */}
      <div className="flex flex-col gap-1.5">
        {tabs.length > 1 && (
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="px-2 py-0.5 text-[10px] font-medium rounded transition-all"
                style={{
                  background: activeTab === tab ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab ? 'var(--text-inverse)' : 'var(--text-tertiary)',
                  border: activeTab === tab ? 'none' : '1px solid var(--border-subtle)',
                }}
              >
                {CRED_TYPE_LABEL[tab]}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          {activeTab === 'oauth' ? (
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='{"access_token": "...", "refresh_token": "...", "expires_at": "..."}'
              rows={2}
              className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg resize-none"
            />
          ) : (
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={activeTab === 'token' ? 'Paste setup token...' : providerConfig?.placeholder ?? 'sk-...'}
              className="flex-1 px-3 py-1.5 text-sm rounded-lg"
            />
          )}
          <button
            onClick={() => {
              if (input.trim()) {
                onSave(providerId, input.trim(), activeTab, isDefault, selectedModel || undefined);
                setInput('');
              }
            }}
            disabled={saving || !input.trim()}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 whitespace-nowrap self-end"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            Add Key
          </button>
        </div>

        {/* Model selector for new key */}
        {providerConfig?.models && providerConfig.models.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Default model:</span>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="text-[11px] px-2 py-0.5 rounded"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {providerConfig.models.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main component ----
export function ApiKeyForm({ initialData, fetchFn, members = [] }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<ApiKeyData>(initialData);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await fetchFn<{ data: ApiKeyData }>('/api-keys');
    setData(res.data);
  };

  const saveKey = async (provider: string, key: string, credentialType: CredentialType, isDefault: boolean, defaultModel?: string) => {
    if (credentialType === 'oauth') {
      try {
        const parsed = JSON.parse(key);
        const tokens = parsed.tokens ?? parsed;
        if (!tokens.access_token || !tokens.refresh_token) {
          toast('Invalid auth.json — must contain access_token and refresh_token', 'error');
          return;
        }
      } catch {
        toast('Invalid JSON — paste the full contents of auth.json', 'error');
        return;
      }
    }
    setSaving(true);
    try {
      await fetchFn('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key, credentialType, isDefault, defaultModel }),
      });
      await refresh();
      toast(`${PROVIDERS.find(p => p.id === provider)?.label ?? provider} key saved`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (keyId: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}`, { method: 'DELETE' });
      await refresh();
      toast('Key deleted', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateModel = async (keyId: string, defaultModel: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}`, {
        method: 'PATCH',
        body: JSON.stringify({ defaultModel }),
      });
      await refresh();
      toast('Default model updated', 'success');
      toast('⚠️ 重新啟動 claw 後方能生效', 'info');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const assignMember = async (keyId: string, memberId: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ memberId }),
      });
      await refresh();
      const m = members.find(m => m.id === memberId);
      toast(`${m?.name || m?.email || 'Member'} assigned`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const unassignMember = async (keyId: string, memberId: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}/assign/${memberId}`, { method: 'DELETE' });
      await refresh();
      toast('Assignment removed', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Group default keys and user-specific keys by provider
  const defaultByProvider: Record<string, ApiKeyDisplay[]> = {};
  for (const k of data.defaults) {
    if (!defaultByProvider[k.provider]) defaultByProvider[k.provider] = [];
    defaultByProvider[k.provider].push(k);
  }

  const userSpecificByProvider: Record<string, UserSpecificKeyEntry[]> = {};
  for (const entry of data.userSpecific) {
    const p = entry.key.provider;
    if (!userSpecificByProvider[p]) userSpecificByProvider[p] = [];
    userSpecificByProvider[p].push(entry);
  }

  const allProviders = PROVIDERS;

  const sectionStyle = {
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: '0.75rem',
    padding: '1.25rem',
  };

  const headerStyle = {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '0.75rem',
  };

  const subheaderStyle = {
    fontSize: '0.7rem',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: 'var(--text-tertiary)',
    marginBottom: '0.5rem',
  };

  return (
    <div className="flex flex-col gap-8 max-w-2xl">

      {/* ── Default Keys ── */}
      <div style={sectionStyle}>
        <h2 style={headerStyle}>Default Keys</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
          One key per AI provider. Used by all members unless overridden by a user-specific key.
        </p>
        <div className="flex flex-col gap-5">
          {allProviders.map(providerConfig => {
            const { id, label, models, defaultModel } = providerConfig;
            const existing = defaultByProvider[id] ?? [];
            return (
              <div key={id}>
                <div className="flex items-center justify-between mb-2">
                  <span style={{ ...subheaderStyle, textTransform: undefined, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {label}
                  </span>
                  {!providerConfig.models && defaultModel && (
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
                      {defaultModel}
                    </span>
                  )}
                </div>
                <ProviderSection providerId={id} isDefault={true} onSave={saveKey} saving={saving}>
                  {existing.map(k => (
                    <KeyCard
                      key={k.id}
                      keyEntry={k}
                      isDefault={true}
                      members={members}
                      onDelete={deleteKey}
                      onModelChange={updateModel}
                      saving={saving}
                    />
                  ))}
                </ProviderSection>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── User-Specific Keys ── */}
      <div style={sectionStyle}>
        <h2 style={headerStyle}>User-Specific Keys</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--text-tertiary)' }}>
          Assign specific keys to individual members. For the same AI provider, a member can only have one key assigned.
          Members not assigned here will use the Default key above.
        </p>
        <div className="flex flex-col gap-5">
          {allProviders.map(providerConfig => {
            const { id, label } = providerConfig;
            const existing = userSpecificByProvider[id] ?? [];
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between mb-2">
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {label}
                  </span>
                  <span style={subheaderStyle}>{existing.length} key{existing.length !== 1 ? 's' : ''}</span>
                </div>
                <ProviderSection providerId={id} isDefault={false} onSave={saveKey} saving={saving}>
                  {existing.map(entry => (
                    <KeyCard
                      key={entry.key.id}
                      keyEntry={entry.key}
                      assignedMemberIds={entry.assignedMemberIds}
                      isDefault={false}
                      members={members}
                      onDelete={deleteKey}
                      onAssign={assignMember}
                      onUnassign={unassignMember}
                      onModelChange={updateModel}
                      saving={saving}
                    />
                  ))}
                </ProviderSection>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
