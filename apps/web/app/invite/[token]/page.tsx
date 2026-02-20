'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useOrg } from '@/lib/org-context';

interface InviteDetails {
  org_name: string;
  email: string;
  role: string;
  invited_by_name: string;
  expires_at: string;
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { data: session, status: authStatus } = useSession();
  const { refreshOrgs } = useOrg();
  const router = useRouter();
  const userId = session?.user?.id;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  // Treat "logged in but no userId" as needing re-auth
  const needsSignIn = authStatus === 'unauthenticated' || (authStatus === 'authenticated' && !userId);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    if (!token) return;
    apiFetch<{ data: InviteDetails }>(`/api/invitations/${token}`)
      .then((res) => setInvite(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const acceptInvite = async () => {
    if (!userId) return;
    setAccepting(true);
    setError('');
    try {
      await apiFetch('/api/auth/accept-invite', {
        method: 'POST',
        headers: { 'x-user-id': userId },
        body: JSON.stringify({ token }),
      });
      await refreshOrgs();
      router.push('/home');
    } catch (err: any) {
      if (err.message === 'User not found') {
        setError('Session expired. Please sign in again.');
        signOut({ redirect: false });
      } else {
        setError(err.message);
      }
    } finally {
      setAccepting(false);
    }
  };

  if (loading || authStatus === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="text-center max-w-sm p-8">
          <h1 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Invalid Invitation
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <line x1="19" y1="8" x2="19" y2="14"/>
              <line x1="22" y1="11" x2="16" y2="11"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Join {invite?.org_name}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>
            {invite?.invited_by_name} invited you as {invite?.role}
          </p>
        </div>

        {error && (
          <p className="text-xs text-center mb-4" style={{ color: 'var(--red)' }}>{error}</p>
        )}

        {needsSignIn ? (
          <div className="space-y-3">
            <button
              onClick={() => signIn('google', { callbackUrl: `/invite/${token}` })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>

            {isDev && (
              <DevLoginForm callbackUrl={`/invite/${token}`} inviteEmail={invite?.email} />
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <button
              onClick={acceptInvite}
              disabled={accepting}
              className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150 disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                color: 'var(--text-inverse)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
            >
              {accepting ? 'Joining...' : 'Accept Invitation'}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
              Signed in as {session?.user?.email}
              {' \u00b7 '}
              <button
                onClick={() => signOut({ redirect: false })}
                className="underline"
                style={{ color: 'var(--text-tertiary)' }}
              >
                use a different account
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DevLoginForm({ callbackUrl, inviteEmail }: { callbackUrl: string; inviteEmail?: string }) {
  const [email, setEmail] = useState(inviteEmail || '');

  return (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full" style={{ borderTop: '1px solid var(--border-primary)' }} />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="px-3" style={{ background: 'var(--bg-base)', color: 'var(--text-tertiary)' }}>
            dev mode
          </span>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn('credentials', { email, callbackUrl });
        }}
        className="space-y-3"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email address"
          className="w-full px-4 py-3 text-sm rounded-lg"
          required
        />
        <button
          type="submit"
          className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
        >
          Dev Sign In
        </button>
      </form>
    </>
  );
}
