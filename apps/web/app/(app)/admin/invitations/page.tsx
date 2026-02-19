'use client';

import { useState, useEffect, useCallback } from 'react';
import { useOrgFetch } from '@/lib/use-org-fetch';
import { useToast } from '@/components/ui/toast';

interface Invitation {
  id: string;
  email: string;
  token: string;
  status: string;
  created_at: string;
}

export default function InvitationsPage() {
  const { orgFetch, ready } = useOrgFetch();
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!orgFetch) return;
    try {
      const res = await orgFetch<{ data: Invitation[] }>('/members/invitations');
      setInvitations(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [orgFetch]);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    toast('Link copied to clipboard', 'success');
  };

  const cancelInvitation = async (id: string) => {
    if (!orgFetch) return;
    setActionLoading(id);
    try {
      await orgFetch(`/members/invitations/${id}`, { method: 'DELETE' });
      await fetchInvitations();
      toast('Invitation cancelled', 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const resendInvitation = async (inv: Invitation) => {
    if (!orgFetch) return;
    setActionLoading(inv.id);
    try {
      // Cancel old, create new
      await orgFetch(`/members/invitations/${inv.id}`, { method: 'DELETE' });
      await orgFetch('/members/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inv.email }),
      });
      await fetchInvitations();
      toast(`New invitation sent to ${inv.email}`, 'success');
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || !ready) {
    return (
      <div>
        <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
          Invitations
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight mb-6" style={{ color: 'var(--text-primary)' }}>
        Invitations
      </h1>

      {invitations.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            No pending invitations. Use the Members page to invite people.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['Email', 'Status', 'Created', 'Actions'].map((h) => (
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
              {invitations.map((inv, i) => {
                const isLoading = actionLoading === inv.id;
                return (
                  <tr
                    key={inv.id}
                    className="transition-colors"
                    style={{
                      borderBottom: i < invitations.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>
                      {inv.email}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium"
                        style={{
                          background: inv.status === 'pending' ? 'var(--yellow-muted)' : 'var(--green-muted)',
                          color: inv.status === 'pending' ? 'var(--yellow)' : 'var(--green)',
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {isLoading ? (
                        <span className="text-xs animate-pulse" style={{ color: 'var(--text-tertiary)' }}>
                          working...
                        </span>
                      ) : (
                        <div className="flex items-center gap-3">
                          <ActionBtn onClick={() => copyLink(inv.token)}>Copy Link</ActionBtn>
                          <ActionBtn onClick={() => resendInvitation(inv)}>Resend</ActionBtn>
                          <ActionBtn onClick={() => cancelInvitation(inv.id)} color="danger">Cancel</ActionBtn>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, color = 'default', children }: { onClick: () => void; color?: 'default' | 'danger'; children: React.ReactNode }) {
  const colorMap = {
    default: { normal: 'var(--accent)', hover: 'var(--accent-hover)' },
    danger:  { normal: 'var(--red)',    hover: '#fca5a5' },
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
