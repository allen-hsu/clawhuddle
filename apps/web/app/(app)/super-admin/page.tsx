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

interface AccessRule {
  id: string;
  type: 'domain' | 'email';
  value: string;
  created_at: string;
}

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const userId = session?.user?.id;
  const [orgs, setOrgs] = useState<OrgWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isSuperAdmin = useSuperAdmin();
  const { confirm } = useConfirm();

  // Access rules state
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [ruleType, setRuleType] = useState<'domain' | 'email'>('domain');
  const [ruleValue, setRuleValue] = useState('');
  const [addingRule, setAddingRule] = useState(false);
  const [deletingRuleId, setDeletingRuleId] = useState<string | null>(null);

  const fetchOrgs = () => {
    if (!userId || !isSuperAdmin) return;
    apiFetch<{ data: OrgWithCount[] }>('/api/super-admin/orgs', {
      headers: { 'x-user-id': userId },
    })
      .then((res) => setOrgs(res.data))
      .catch(() => toast('Failed to load organizations', 'error'))
      .finally(() => setLoading(false));
  };

  const fetchRules = () => {
    if (!userId || !isSuperAdmin) return;
    apiFetch<{ data: AccessRule[] }>('/api/super-admin/access-rules', {
      headers: { 'x-user-id': userId },
    })
      .then((res) => setRules(res.data))
      .catch(() => toast('Failed to load access rules', 'error'));
  };

  useEffect(() => {
    fetchOrgs();
    fetchRules();
  }, [userId, isSuperAdmin]);

  const addRule = async () => {
    if (!userId || !ruleValue.trim()) return;
    setAddingRule(true);
    try {
      const res = await apiFetch<{ data: AccessRule }>('/api/super-admin/access-rules', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ type: ruleType, value: ruleValue.trim() }),
      });
      setRules((prev) => [res.data, ...prev]);
      setRuleValue('');
      toast('Rule added', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to add rule', 'error');
    } finally {
      setAddingRule(false);
    }
  };

  const deleteRule = async (rule: AccessRule) => {
    if (!userId) return;
    setDeletingRuleId(rule.id);
    try {
      await apiFetch(`/api/super-admin/access-rules/${rule.id}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId },
      });
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
      toast('Rule removed', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to delete rule', 'error');
    } finally {
      setDeletingRuleId(null);
    }
  };

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
        Manage access rules and organizations
      </p>

      {/* Access Rules Section */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Access Rules
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        {rules.length === 0
          ? 'No rules — anyone can sign in (open registration).'
          : 'Only matching domains/emails can sign in.'}
      </p>

      {/* Add rule form */}
      <div className="flex gap-2 mb-4">
        <select
          value={ruleType}
          onChange={(e) => setRuleType(e.target.value as 'domain' | 'email')}
          className="px-3 py-1.5 rounded text-sm"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          <option value="domain">Domain</option>
          <option value="email">Email</option>
        </select>
        <input
          type="text"
          value={ruleValue}
          onChange={(e) => setRuleValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addRule(); }}
          placeholder={ruleType === 'domain' ? 'company.com' : 'user@example.com'}
          className="flex-1 px-3 py-1.5 rounded text-sm"
          style={{
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
          }}
        />
        <button
          onClick={addRule}
          disabled={addingRule || !ruleValue.trim()}
          className="px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40"
          style={{
            background: 'var(--accent)',
            color: 'white',
          }}
        >
          {addingRule ? 'Adding…' : 'Add'}
        </button>
      </div>

      {/* Rules list */}
      {rules.length > 0 && (
        <div
          className="rounded-xl overflow-hidden mb-8"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Type', 'Value', 'Added', ''].map((h, i) => (
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
              {rules.map((rule, i) => (
                <tr
                  key={rule.id}
                  className="transition-colors"
                  style={{
                    borderBottom: i < rules.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium uppercase"
                      style={{
                        background: rule.type === 'domain' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: rule.type === 'domain' ? 'rgb(99, 102, 241)' : 'rgb(16, 185, 129)',
                      }}
                    >
                      {rule.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>
                    {rule.value}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {new Date(rule.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteRule(rule)}
                      disabled={deletingRuleId === rule.id}
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
                      {deletingRuleId === rule.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rules.length === 0 && <div className="mb-8" />}

      {/* Organizations Section */}
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Organizations
      </h2>

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
