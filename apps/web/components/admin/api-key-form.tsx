'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { PROVIDERS } from '@clawhuddle/shared';

type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;

export interface ApiKeyDisplay {
  id: string;
  provider: string;
  key_masked: string;
  is_company_default: boolean;
}

interface Props {
  initialKeys: ApiKeyDisplay[];
  fetchFn: FetchFn;
}

export function ApiKeyForm({ initialKeys, fetchFn }: Props) {
  const { toast } = useToast();
  const [keys, setKeys] = useState(initialKeys);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await fetchFn<{ data: ApiKeyDisplay[] }>('/api-keys');
    setKeys(res.data);
  };

  const saveKey = async (provider: string) => {
    const key = inputs[provider]?.trim();
    if (!key) return;
    setSaving(true);
    try {
      await fetchFn('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key }),
      });
      setInputs((prev) => ({ ...prev, [provider]: '' }));
      await refresh();
      const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
      toast(`${label} key saved`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteKey = async (keyId: string, providerLabel: string) => {
    setSaving(true);
    try {
      await fetchFn(`/api-keys/${keyId}`, { method: 'DELETE' });
      await refresh();
      toast(`${providerLabel} key deleted`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentKey = (provider: string) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-6 max-w-lg">
      {PROVIDERS.map(({ id, label, placeholder, defaultModel }) => {
        const existing = currentKey(id);
        return (
          <div
            key={id}
            className="p-5 rounded-xl"
            style={{
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <h3
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
              >
                {label}
              </h3>
              <span
                className="text-[11px] font-mono"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {defaultModel}
              </span>
            </div>

            {existing && (
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  Current:{' '}
                  <code
                    className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                    style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                  >
                    {existing.key_masked}
                  </code>
                </p>
                <button
                  onClick={() => deleteKey(existing.id, label)}
                  disabled={saving}
                  className="text-xs px-2 py-0.5 rounded transition-colors disabled:opacity-50"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--error, #ef4444)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                >
                  Delete
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="password"
                value={inputs[id] ?? ''}
                onChange={(e) => setInputs((prev) => ({ ...prev, [id]: e.target.value }))}
                placeholder={placeholder}
                className="flex-1 px-3 py-2 text-sm rounded-lg"
              />
              <button
                onClick={() => saveKey(id)}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--text-inverse)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
              >
                Save
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
