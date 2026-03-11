'use client';

import { useState, useEffect } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { useToast } from '@/components/ui/toast';
import { ApiKeyForm, type ApiKeyData } from '@/components/admin/api-key-form';
import type { OrgMember } from '@clawhuddle/shared';

export default function ApiKeysPage() {
  const { orgFetch, ready } = useOrgFetch();
  const { toast } = useToast();
  const [keyData, setKeyData] = useState<ApiKeyData>({ defaults: [], userSpecific: [] });
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgFetch) return;
    Promise.all([
      orgFetch<{ data: ApiKeyData }>('/api-keys'),
      orgFetch<{ data: OrgMember[] }>('/members'),
    ])
      .then(([keysRes, membersRes]) => {
        setKeyData(keysRes.data);
        setMembers(membersRes.data);
      })
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
      <ApiKeyForm initialData={keyData} fetchFn={orgFetch!} members={members} />
    </div>
  );
}
