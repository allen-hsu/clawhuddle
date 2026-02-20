'use client';

import { useState, useEffect } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { useToast } from '@/components/ui/toast';
import { ApiKeyForm, type ApiKeyDisplay } from '@/components/admin/api-key-form';

export default function ApiKeysPage() {
  const { orgFetch, ready } = useOrgFetch();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKeyDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgFetch) return;
    orgFetch<{ data: ApiKeyDisplay[] }>('/api-keys')
      .then((res) => setKeys(res.data))
      .catch(() => toast('Failed to load API keys', 'error'))
      .finally(() => setLoading(false));
  }, [orgFetch]);

  if (loading || !ready) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          API Keys
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        API Keys
      </h1>
      <ApiKeyForm initialKeys={keys} fetchFn={orgFetch!} />
    </div>
  );
}
