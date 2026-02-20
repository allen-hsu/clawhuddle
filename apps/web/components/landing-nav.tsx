'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ClawHuddleLogo } from './logo';

export function LandingNav() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated' && !!session;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          style={{ color: '#ff4d4d' }}
        >
          <ClawHuddleLogo size={20} />
          ClawHuddle
        </Link>
        <div className="flex items-center gap-6">
          <a
            href="https://buymeacoffee.com/unless"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] transition-colors hidden sm:block"
            style={{ color: '#5a6480' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#ffdd00'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6480'; }}
          >
            ☕ Sponsor
          </a>
          <a
            href="https://github.com/allen-hsu/clawhuddle"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] transition-colors hidden sm:block"
            style={{ color: '#5a6480' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#8892b0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#5a6480'; }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="inline-block align-[-3px]">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
          </a>
          {isLoggedIn ? (
            <Link
              href="/home"
              className="text-[13px] font-semibold px-4 py-1.5 rounded-md transition-all"
              style={{
                color: '#fff',
                background: '#ff4d4d',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-[13px] transition-colors"
              style={{ color: '#8892b0' }}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
