'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';

export function LandingNav() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated' && !!session;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="max-w-6xl mx-auto px-6 md:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="text-[15px] font-medium tracking-tight"
          style={{ color: '#C7944A' }}
        >
          ClawTeam
        </Link>
        <div className="flex items-center gap-6">
          <a
            href="#pricing"
            className="text-[13px] transition-colors hidden sm:block"
            style={{ color: '#556178' }}
          >
            Pricing
          </a>
          {isLoggedIn ? (
            <Link
              href="/home"
              className="text-[13px] font-medium px-4 py-1.5 rounded-md transition-colors"
              style={{
                color: '#07080A',
                background: '#C7944A',
              }}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-[13px] transition-colors"
              style={{ color: '#8893A7' }}
            >
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
