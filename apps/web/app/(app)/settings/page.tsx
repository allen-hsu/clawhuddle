'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import type { OrgMember } from '@clawhuddle/shared';

export default function SettingsPage() {
  const { data: session } = useSession();
  const { currentOrg, currentOrgId } = useOrg();
  const { toast } = useToast();
  const userId = session?.user?.id;
  const [memberCount, setMemberCount] = useState<number | null>(null);

  const orgFetch = useCallback(
    <T,>(path: string, options?: RequestInit) => {
      if (!currentOrgId || !userId) return Promise.reject(new Error('No org'));
      return createOrgFetch(currentOrgId, userId)<T>(path, options);
    },
    [currentOrgId, userId]
  );

  useEffect(() => {
    if (!currentOrgId || !userId) return;
    orgFetch<{ data: OrgMember[] }>('/members')
      .then((res) => setMemberCount(res.data.length))
      .catch(() => toast('Failed to load member count', 'error'));
  }, [currentOrgId, userId, orgFetch]);

  return (
    <div className="flex-1 p-8 max-w-3xl mx-auto w-full">
      <h1 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h1>

      {/* Organization info */}
      <div
        className="rounded-xl p-5 mb-8"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Organization
        </span>
        <p className="text-base font-semibold mt-1" style={{ color: 'var(--text-primary)' }}>
          {currentOrg?.name || '—'}
        </p>

        {memberCount !== null && (
          <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)' }}>
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </p>
        )}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Need help?{' '}
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_SUPPORT_EMAIL || ''}`}
          className="underline transition-colors"
          style={{ color: 'var(--text-secondary)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          Contact support
        </a>
      </p>
    </div>
  );
}
