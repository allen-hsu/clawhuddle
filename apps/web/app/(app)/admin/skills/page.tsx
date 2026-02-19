'use client';

import { useState, useEffect } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { SkillTable } from '@/components/admin/skill-table';
import type { Skill } from '@clawteam/shared';

export default function AdminSkillsPage() {
  const { orgFetch, ready } = useOrgFetch();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgFetch) return;
    orgFetch<{ data: Skill[] }>('/skills')
      .then((res) => setSkills(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [orgFetch]);

  if (loading || !ready) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          Skills
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        Skills
      </h1>
      <SkillTable initialSkills={skills} fetchFn={orgFetch!} />
    </div>
  );
}
