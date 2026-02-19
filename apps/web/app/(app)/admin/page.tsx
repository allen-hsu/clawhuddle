'use client';

import { useState, useEffect } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { MemberTable } from '@/components/admin/member-table';
import type { OrgMember } from '@clawteam/shared';

export default function AdminMembersPage() {
  const { orgFetch, ready } = useOrgFetch();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgFetch) return;
    orgFetch<{ data: OrgMember[] }>('/members')
      .then((res) => setMembers(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgFetch]);

  if (loading || !ready) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          Members
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        Members
      </h1>
      <MemberTable initialMembers={members} />
    </div>
  );
}
