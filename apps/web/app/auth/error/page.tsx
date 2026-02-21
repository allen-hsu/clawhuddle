'use client';

import { signIn, signOut } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ClawHuddleLogo } from '@/components/logo';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  const isAccessDenied = error === 'AccessDenied';

  const title = isAccessDenied ? 'Access Denied' : 'Authentication Error';
  const description = isAccessDenied
    ? 'Your account is not allowed to access this workspace. Please try a different Google account, or contact your administrator.'
    : 'An error occurred during sign in. Please try again.';

  const handleTryDifferentAccount = async () => {
    // Sign out from NextAuth first, then force Google account picker
    await signOut({ redirect: false });
    signIn('google', { callbackUrl: '/home' }, { prompt: 'select_account' });
  };

  const handleSignOut = () => {
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Ambient glow */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255, 77, 77, 0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-sm w-full space-y-8 p-8">
        {/* Brand */}
        <div className="text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
            style={{
              background: 'var(--accent-muted)',
              border: '1px solid rgba(255, 77, 77, 0.2)',
            }}
          >
            <ClawHuddleLogo size={28} />
          </div>
          <h1
            className="text-2xl font-semibold tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-sm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {description}
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          {isAccessDenied ? (
            <>
              <button
                onClick={handleTryDifferentAccount}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-primary)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-tertiary)';
                  e.currentTarget.style.borderColor = 'var(--border-focus)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--bg-secondary)';
                  e.currentTarget.style.borderColor = 'var(--border-primary)';
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Try a different Google account
              </button>
              <button
                onClick={handleSignOut}
                className="w-full text-xs py-2 transition-colors"
                style={{ color: 'var(--text-tertiary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
              >
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-150"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 77, 77, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Sign out & try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
