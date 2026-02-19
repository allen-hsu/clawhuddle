'use client';

import { useState, useRef, useEffect } from 'react';
import { useOrg } from '@/lib/org-context';

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

  if (orgs.length <= 1) {
    return (
      <span className="text-xs font-medium px-2 py-1 rounded" style={{ color: 'var(--text-secondary)' }}>
        {currentOrg?.name || ''}
      </span>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded transition-colors"
        style={{
          color: 'var(--text-secondary)',
          background: open ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = 'transparent'; }}
      >
        {currentOrg?.name || 'Select org'}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-full mt-1 left-0 min-w-[180px] rounded-lg py-1 z-50 shadow-lg"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-primary)',
          }}
        >
          {orgs.map((org) => (
            <button
              key={org.id}
              onClick={() => {
                switchOrg(org.id);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between"
              style={{
                color: org.id === currentOrg?.id ? 'var(--accent-text)' : 'var(--text-secondary)',
                background: org.id === currentOrg?.id ? 'var(--accent-muted)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (org.id !== currentOrg?.id) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (org.id !== currentOrg?.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>{org.name}</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{org.member_role}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
