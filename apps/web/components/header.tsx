'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { OrgSwitcher } from './org-switcher';

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { currentOrgId, memberRole } = useOrg();
  const isAdmin = memberRole === 'admin' || memberRole === 'owner';

  return (
    <header
      className="h-14 flex items-center justify-between px-5"
      style={{
        background: 'var(--bg-primary)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-[15px] tracking-tight"
          style={{ color: 'var(--accent)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
          ClawTeam
        </Link>

        <OrgSwitcher />

        {currentOrgId && (
          <nav className="flex items-center gap-1">
            <NavLink href="/" active={pathname === '/'}>
              Dashboard
            </NavLink>
            <NavLink href="/skills" active={pathname.startsWith('/skills')}>
              Skills
            </NavLink>
            {isAdmin && (
              <NavLink href="/admin" active={pathname.startsWith('/admin')}>
                Admin
              </NavLink>
            )}
            <NavLink href="/settings" active={pathname.startsWith('/settings')}>
              Settings
            </NavLink>
          </nav>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {session?.user?.email}
        </span>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="text-xs px-3 py-1.5 rounded-md transition-colors"
          style={{
            color: 'var(--text-secondary)',
            background: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Sign out
        </button>
      </div>
    </header>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors"
      style={{
        color: active ? 'var(--accent-text)' : 'var(--text-secondary)',
        background: active ? 'var(--accent-muted)' : 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-primary)';
          e.currentTarget.style.background = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      {children}
    </Link>
  );
}
