'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';

type FetchFn = <T>(path: string, options?: RequestInit) => Promise<T>;

interface ApiKeyDisplay {
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
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    const res = await fetchFn<{ data: ApiKeyDisplay[] }>('/api-keys');
    setKeys(res.data);
  };

  const saveKey = async (provider: string, key: string, clearFn: (v: string) => void) => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetchFn('/api-keys', {
        method: 'POST',
        body: JSON.stringify({ provider, key: key.trim() }),
      });
      clearFn('');
      await refresh();
      toast(`${provider.charAt(0).toUpperCase() + provider.slice(1)} key saved`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentKey = (provider: string) => keys.find((k) => k.provider === provider);

  return (
    <div className="space-y-6 max-w-lg">
      {[
        { provider: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...', value: anthropicKey, setter: setAnthropicKey },
        { provider: 'openai', label: 'OpenAI', placeholder: 'sk-...', value: openaiKey, setter: setOpenaiKey },
      ].map(({ provider, label, placeholder, value, setter }) => (
        <div
          key={provider}
          className="p-5 rounded-xl"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <h3
            className="text-sm font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {label}
          </h3>
          {currentKey(provider) && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
              Current:{' '}
              <code
                className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
              >
                {currentKey(provider)!.key_masked}
              </code>
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="password"
              value={value}
              onChange={(e) => setter(e.target.value)}
              placeholder={placeholder}
              className="flex-1 px-3 py-2 text-sm rounded-lg"
            />
            <button
              onClick={() => saveKey(provider, value, setter)}
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
      ))}
    </div>
  );
}
