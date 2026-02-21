'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useSuperAdmin } from '@/lib/use-super-admin';
import type { Organization } from '@clawhuddle/shared';

interface OrgWithCount extends Organization {
  member_count: number;
}

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const userId = session?.user?.id;
  const [orgs, setOrgs] = useState<OrgWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isSuperAdmin = useSuperAdmin();
  const confirm = useConfirm();

  const fetchOrgs = () => {
    if (!userId || !isSuperAdmin) return;
    apiFetch<{ data: OrgWithCount[] }>('/api/super-admin/orgs', {
      headers: { 'x-user-id': userId },
    })
      .then((res) => setOrgs(res.data))
      .catch(() => toast('Failed to load organizations', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrgs();
  }, [userId, isSuperAdmin]);

  const deleteOrg = async (org: OrgWithCount) => {
    if (!userId) return;
    const confirmed = await confirm({
      title: `Delete "${org.name}"?`,
      description: 'This will permanently remove all members, gateways, and data. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!confirmed) return;
    setDeletingId(org.id);
    try {
      await apiFetch(`/api/super-admin/orgs/${org.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      toast(`"${org.name}" deleted`, 'success');
      setOrgs((prev) => prev.filter((o) => o.id !== org.id));
    } catch (err: any) {
      toast(err.message || 'Failed to delete organization', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Access denied.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
        <h1 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
          Super Admin
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 max-w-4xl mx-auto w-full">
      <h1 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        Super Admin
      </h1>
      <p className="text-xs mb-6" style={{ color: 'var(--text-tertiary)' }}>
        Manage all organizations
      </p>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {['Organization', 'Slug', 'Members', 'Created', ''].map((h, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orgs.map((org, i) => (
              <tr
                key={org.id}
                className="transition-colors"
                style={{
                  borderBottom: i < orgs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {org.name}
                </td>
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {org.slug}
                </td>
                <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                  {org.member_count}
                </td>
                <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {new Date(org.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => deleteOrg(org)}
                    disabled={deletingId === org.id}
                    className="px-3 py-1 rounded text-xs font-medium transition-colors disabled:opacity-40"
                    style={{
                      color: 'var(--red, #ff4d4d)',
                      background: 'rgba(255, 77, 77, 0.1)',
                    }}
                    onMouseEnter={(e) => {
                      if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(255, 77, 77, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 77, 77, 0.1)';
                    }}
                  >
                    {deletingId === org.id ? 'Deleting…' : 'Delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {orgs.length === 0 && (
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No organizations yet.
          </p>
        )}
      </div>
    </div>
  );
}
