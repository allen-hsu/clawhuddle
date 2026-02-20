'use client';

import { useState, useRef, useEffect } from 'react';
import { useOrg } from '@/lib/org-context';

function OrgAvatar({ name, size = 28 }: { name: string; size?: number }) {
  const initial = (name || '?')[0].toUpperCase();
  return (
    <div
      className="rounded-md flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: 'var(--accent-muted)',
        color: 'var(--accent-text)',
      }}
    >
      {initial}
    </div>
  );
}

export function OrgSwitcher() {
  const { orgs, currentOrg, switchOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const content = (
    <div className="flex items-center gap-2.5 min-w-0">
      <OrgAvatar name={currentOrg?.name || ''} />
      <div className="min-w-0">
        <p
          className="text-[11px] font-medium leading-none mb-0.5"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Workspace
        </p>
        <p
          className="text-[13px] font-semibold leading-tight truncate"
          style={{ color: 'var(--text-primary)' }}
        >
          {currentOrg?.name || 'Select workspace'}
        </p>
      </div>
    </div>
  );

  if (orgs.length <= 1) {
    return <div className="px-1 py-1">{content}</div>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-1 py-1 rounded-lg transition-colors"
        style={{
          background: open ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        {content}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
          style={{ color: 'var(--text-tertiary)' }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 right-0 rounded-lg py-1 z-50 shadow-lg"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {orgs.map((org) => {
            const isActive = org.id === currentOrg?.id;
            return (
              <button
                key={org.id}
                onClick={() => {
                  switchOrg(org.id);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2.5"
                style={{
                  color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-muted)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <OrgAvatar name={org.name} size={22} />
                <span className="truncate font-medium">{org.name}</span>
                <span className="ml-auto text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  {org.member_role}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
