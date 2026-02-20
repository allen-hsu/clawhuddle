'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from '@/lib/org-context';
import { createOrgFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import type { OrgMember } from '@clawhuddle/shared';

function Badge({ color, children }: { color: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray'; children: React.ReactNode }) {
  const styles: Record<string, { bg: string; text: string }> = {
    green:  { bg: 'var(--green-muted)',  text: 'var(--green)' },
    red:    { bg: 'var(--red-muted)',    text: 'var(--red)' },
    yellow: { bg: 'var(--yellow-muted)', text: 'var(--yellow)' },
    blue:   { bg: 'var(--blue-muted)',   text: 'var(--blue)' },
    purple: { bg: 'var(--purple-muted)', text: 'var(--purple)' },
    gray:   { bg: 'var(--bg-tertiary)',  text: 'var(--text-tertiary)' },
  };
  const s = styles[color];
  return (
    <span
      className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      {children}
    </span>
  );
}

function ActionBtn({ onClick, color = 'default', children }: { onClick: () => void; color?: 'default' | 'danger' | 'success'; children: React.ReactNode }) {
  const colorMap = {
    default: { normal: 'var(--accent)', hover: 'var(--accent-hover)' },
    danger:  { normal: 'var(--red)',    hover: '#fca5a5' },
    success: { normal: 'var(--green)',  hover: '#6ee7b7' },
  };
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className="text-xs font-medium transition-colors"
      style={{ color: c.normal }}
      onMouseEnter={(e) => { e.currentTarget.style.color = c.hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = c.normal; }}
    >
      {children}
    </button>
  );
}

interface Props {
  initialMembers: OrgMember[];
}

export function MemberTable({ initialMembers }: Props) {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const userId = session?.user?.id;
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [limitHit, setLimitHit] = useState(false);
  const [loadingGateway, setLoadingGateway] = useState<string | null>(null);

  const orgFetch = useCallback(
    <T,>(path: string, options?: RequestInit) => {
      if (!currentOrgId || !userId) return Promise.reject(new Error('No org'));
      return createOrgFetch(currentOrgId, userId)<T>(path, options);
    },
    [currentOrgId, userId]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await orgFetch<{ data: OrgMember[] }>('/members');
      setMembers(res.data);
    } catch { /* ignore */ }
  }, [orgFetch]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasDeploying = members.some((m) => m.gateway_status === 'deploying');

  useEffect(() => {
    if (hasDeploying) {
      pollingRef.current = setInterval(async () => {
        const deploying = members.filter((m) => m.gateway_status === 'deploying');
        for (const m of deploying) {
          try {
            const res = await orgFetch<{ data: { gateway_status: string } }>(
              `/gateways/members/${m.id}/status`
            );
            if (res.data.gateway_status !== 'deploying') {
              await refresh();
              return;
            }
          } catch { /* ignore */ }
        }
      }, 2000);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [hasDeploying, members, orgFetch, refresh]);

  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteLink(null);
    try {
      const res = await orgFetch<{ data: { token: string } }>('/members/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });
      const link = `${window.location.origin}/invite/${res.data.token}`;
      setInviteLink(link);
      setInviteEmail('');
    } catch (err: any) {
      if (err.code === 'member_limit') {
        setLimitHit(true);
      } else {
        toast(err.message, 'error');
      }
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (member: OrgMember) => {
    const ok = await confirm({
      title: 'Remove member',
      description: `Remove ${member.name || member.email} from this organization?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    try {
      await orgFetch(`/members/${member.id}`, { method: 'DELETE' });
      toast('Member removed', 'success');
      await refresh();
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const toggleStatus = async (member: OrgMember) => {
    const newStatus = member.status === 'active' ? 'disabled' : 'active';
    await orgFetch(`/members/${member.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    await refresh();
  };

  const gatewayAction = async (memberId: string, action: 'deploy' | 'start' | 'stop' | 'remove' | 'redeploy') => {
    setLoadingGateway(memberId);
    try {
      switch (action) {
        case 'deploy':
          await orgFetch(`/gateways/members/${memberId}`, { method: 'POST' });
          break;
        case 'start':
          await orgFetch(`/gateways/members/${memberId}/start`, { method: 'POST' });
          break;
        case 'stop':
          await orgFetch(`/gateways/members/${memberId}/stop`, { method: 'POST' });
          break;
        case 'redeploy':
          await orgFetch(`/gateways/members/${memberId}/redeploy`, { method: 'POST' });
          break;
        case 'remove':
          await orgFetch(`/gateways/members/${memberId}`, { method: 'DELETE' });
          break;
      }
      await refresh();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoadingGateway(null);
    }
  };

  const openGateway = (member: OrgMember) => {
    if (!member.gateway_token) return;
    const { protocol, hostname } = window.location;
    if (hostname === 'localhost' && member.gateway_port) {
      window.open(`http://localhost:${member.gateway_port}/?token=${member.gateway_token}`, '_blank');
    } else if (member.gateway_subdomain) {
      window.open(`${protocol}//${member.gateway_subdomain}.${hostname}/?token=${member.gateway_token}`, '_blank');
    }
  };

  const gatewayStatusBadge = (member: OrgMember) => {
    if (!member.gateway_status) return <Badge color="gray">not deployed</Badge>;
    if (member.gateway_status === 'deploying') {
      return (
        <span className="animate-pulse-amber">
          <Badge color="blue">deploying...</Badge>
        </span>
      );
    }
    if (member.gateway_status === 'running') return <Badge color="green">running</Badge>;
    if (member.gateway_status === 'stopped') return <Badge color="yellow">stopped</Badge>;
    return <Badge color="blue">{member.gateway_status}</Badge>;
  };

  const gatewayActions = (member: OrgMember) => {
    const isLoading = loadingGateway === member.id;
    if (isLoading) {
      return (
        <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
          working...
        </span>
      );
    }

    if (!member.gateway_status) {
      return <ActionBtn onClick={() => gatewayAction(member.id, 'deploy')}>Deploy</ActionBtn>;
    }

    if (member.gateway_status === 'deploying') {
      return (
        <span className="flex gap-3 items-center">
          <span className="text-xs" style={{ color: 'var(--blue)' }}>starting up...</span>
          <ActionBtn onClick={() => gatewayAction(member.id, 'remove')} color="danger">Remove</ActionBtn>
        </span>
      );
    }

    if (member.gateway_status === 'running') {
      return (
        <span className="flex gap-3">
          <ActionBtn onClick={() => openGateway(member)} color="success">Open</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(member.id, 'redeploy')}>Redeploy</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(member.id, 'stop')}>Stop</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(member.id, 'remove')} color="danger">Remove</ActionBtn>
        </span>
      );
    }

    if (member.gateway_status === 'stopped') {
      return (
        <span className="flex gap-3">
          <ActionBtn onClick={() => gatewayAction(member.id, 'start')} color="success">Start</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(member.id, 'redeploy')}>Redeploy</ActionBtn>
          <ActionBtn onClick={() => gatewayAction(member.id, 'remove')} color="danger">Remove</ActionBtn>
        </span>
      );
    }

    return null;
  };

  const roleColor = (role: string) => {
    if (role === 'owner') return 'yellow';
    if (role === 'admin') return 'purple';
    return 'gray';
  };

  return (
    <div>
      {/* Invite form */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="email"
          value={inviteEmail}
          onChange={(e) => { setInviteEmail(e.target.value); setLimitHit(false); }}
          placeholder="employee@company.com"
          className="flex-1 max-w-sm px-3 py-2 text-sm rounded-lg"
        />
        <button
          onClick={invite}
          disabled={inviting}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            color: 'var(--text-inverse)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          Invite Member
        </button>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
          {members.length} members
        </span>
      </div>

      {/* Member limit banner */}
      {limitHit && (
        <div
          className="flex items-center gap-3 mb-4 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--yellow-muted)', border: '1px solid rgba(234, 179, 8, 0.3)' }}
        >
          <span style={{ color: 'var(--text-primary)' }}>
            Member limit reached. Adjust the <code>MAX_MEMBERS_PER_ORG</code> environment variable to increase.
          </span>
          <button
            onClick={() => setLimitHit(false)}
            className="shrink-0 text-xs px-1 ml-auto"
            style={{ color: 'var(--text-tertiary)' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Invite link */}
      {inviteLink && (
        <div
          className="flex items-center gap-2 mb-6 px-4 py-3 rounded-lg text-sm"
          style={{ background: 'var(--green-muted)', border: '1px solid rgba(74, 199, 120, 0.2)' }}
        >
          <span className="flex-1 font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>
            {inviteLink}
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(inviteLink);
              toast('Link copied to clipboard', 'success');
            }}
            className="shrink-0 text-xs font-medium px-3 py-1 rounded-md transition-colors"
            style={{ color: 'var(--green)', background: 'rgba(74, 199, 120, 0.15)' }}
          >
            Copy
          </button>
          <button
            onClick={() => setInviteLink(null)}
            className="shrink-0 text-xs px-1"
            style={{ color: 'var(--text-tertiary)' }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Table */}
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
              {['Name', 'Email', 'Role', 'Status', 'Gateway', 'Actions'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((member, i) => (
              <tr
                key={member.id}
                className="transition-colors"
                style={{
                  borderBottom: i < members.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {member.name || '\u2014'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {member.email}
                </td>
                <td className="px-4 py-3">
                  <Badge color={roleColor(member.role) as any}>
                    {member.role}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge color={member.status === 'active' ? 'green' : 'red'}>
                    {member.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {gatewayStatusBadge(member)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <ActionBtn onClick={() => toggleStatus(member)}>
                      {member.status === 'active' ? 'Disable' : 'Enable'}
                    </ActionBtn>
                    {member.role !== 'owner' && member.user_id !== userId && (
                      <ActionBtn onClick={() => removeMember(member)} color="danger">
                        Remove
                      </ActionBtn>
                    )}
                    {gatewayActions(member)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && (
          <p
            className="text-center py-12 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            No members yet. Invite someone to get started.
          </p>
        )}
      </div>
    </div>
  );
}
