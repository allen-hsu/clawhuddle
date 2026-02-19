'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { apiFetch } from '@/lib/api';
import type { OrgMember, Skill } from '@clawteam/shared';

interface SkillWithStatus extends Skill {
  assigned: boolean;
}

export default function DashboardPage() {
  const { orgs, currentOrgId, refreshOrgs, loading: orgLoading } = useOrg();

  // No orgs — show create org form
  if (!orgLoading && orgs.length === 0) {
    return <CreateOrgView onCreated={refreshOrgs} />;
  }

  // Has org selected — show dashboard
  if (currentOrgId) {
    return <DashboardView />;
  }

  // Loading / transitioning
  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--accent)' }}
      />
    </div>
  );
}

/* ─── Create Organization ─── */

function CreateOrgView({ onCreated }: { onCreated: () => Promise<void> }) {
  const { data: session } = useSession();
  const userId = (session?.user as any)?.id;
  const [orgName, setOrgName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const createOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || !userId) {
      if (!userId) setError('Session error: please sign out and sign in again.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await apiFetch('/api/orgs', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      await onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-sm w-full p-8">
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: 'var(--accent-muted)',
              border: '1px solid rgba(199, 148, 74, 0.2)',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            Welcome to ClawTeam
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Create your organization to get started
          </p>
        </div>

        <form onSubmit={createOrg} className="space-y-4">
          <div>
            <label
              className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Acme Corp"
              className="w-full px-4 py-3 text-sm rounded-lg"
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={creating}
            className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150 disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
          >
            {creating ? 'Creating...' : 'Create Organization'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-xs transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Dashboard ─── */

function DashboardView() {
  const { orgFetch, ready, userId } = useOrgFetch();
  const { memberRole } = useOrg();
  const isAdmin = memberRole === 'admin' || memberRole === 'owner';

  const [me, setMe] = useState<OrgMember | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [runningCount, setRunningCount] = useState(0);
  const [skillStats, setSkillStats] = useState<{ enabled: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!orgFetch) return;
    try {
      const [membersRes, skillsRes] = await Promise.all([
        orgFetch<{ data: OrgMember[] }>('/members'),
        orgFetch<{ data: SkillWithStatus[] }>('/me/skills'),
      ]);

      const self = membersRes.data.find((m: any) => m.user_id === userId);
      setMe(self || null);
      setMemberCount(membersRes.data.length);
      setRunningCount(membersRes.data.filter((m: any) => m.gateway_status === 'running').length);

      const enabled = skillsRes.data.filter((s) => s.assigned).length;
      setSkillStats({ enabled, total: skillsRes.data.length });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [orgFetch, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll while deploying
  useEffect(() => {
    if (!me || me.gateway_status !== 'deploying') return;
    const id = setInterval(fetchData, 5000);
    return () => clearInterval(id);
  }, [me?.gateway_status, fetchData]);

  const openGateway = () => {
    if (!me?.gateway_port || !me?.gateway_token) return;
    const hostname = window.location.hostname;
    window.open(`http://${hostname}:${me.gateway_port}/?token=${me.gateway_token}`, '_blank');
  };

  if (loading || !ready) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  const gwStatus = me?.gateway_status || 'not deployed';
  const gwColor =
    gwStatus === 'running' ? 'var(--green)' :
    gwStatus === 'deploying' ? 'var(--blue)' :
    gwStatus === 'stopped' ? 'var(--yellow)' :
    'var(--text-tertiary)';

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        {/* Gateway Card */}
        <div
          className="rounded-xl p-5"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Assistant
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ background: gwColor }} />
              <span className="text-xs font-medium" style={{ color: gwColor }}>
                {gwStatus === 'deploying' ? 'starting...' : gwStatus}
              </span>
            </div>
          </div>

          {gwStatus === 'running' ? (
            <button
              onClick={openGateway}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              Open AI Assistant
            </button>
          ) : gwStatus === 'deploying' ? (
            <div className="flex items-center gap-2 py-2">
              <div
                className="w-4 h-4 rounded-full border-2 animate-spin"
                style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--blue)' }}
              />
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                Your assistant is starting up...
              </span>
            </div>
          ) : (
            <p className="text-xs py-2" style={{ color: 'var(--text-tertiary)' }}>
              {gwStatus === 'stopped'
                ? 'Your assistant is stopped. Contact your admin to restart it.'
                : 'Your assistant is not yet deployed. Contact your admin to get started.'}
            </p>
          )}
        </div>

        {/* Skills Card */}
        {skillStats && (
          <Link
            href="/skills"
            className="block rounded-xl p-5 transition-colors"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  My Skills
                </h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
                  {skillStats.enabled} of {skillStats.total} enabled
                </p>
              </div>
              <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                Manage &rarr;
              </span>
            </div>
          </Link>
        )}

        {/* Admin Overview Card */}
        {isAdmin && (
          <div
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Team Overview
            </h2>
            <div className="flex gap-6 mb-4">
              <div>
                <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {memberCount}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>members</p>
              </div>
              <div>
                <p className="text-lg font-semibold" style={{ color: 'var(--green)' }}>
                  {runningCount}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>gateways running</p>
              </div>
            </div>
            <div className="flex gap-3">
              <QuickLink href="/admin">Members</QuickLink>
              <QuickLink href="/admin/skills">Skills</QuickLink>
              <QuickLink href="/admin/api-keys">API Keys</QuickLink>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function QuickLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-xs font-medium px-3 py-1.5 rounded-md transition-colors"
      style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-inverse)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-muted)'; e.currentTarget.style.color = 'var(--accent)'; }}
    >
      {children}
    </Link>
  );
}
