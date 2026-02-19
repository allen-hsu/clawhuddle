'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';
import { AppSidebar } from '@/components/app-sidebar';
import { useEffect } from 'react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { orgs, currentOrgId, loading } = useOrg();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || loading) return;
    if (!session) {
      router.replace('/login');
    }
  }, [session, status, loading, router]);

  // Still loading auth / org data
  if (status === 'loading' || loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-8 h-8 rounded-full border-2 animate-spin"
          style={{
            borderColor: 'var(--border-primary)',
            borderTopColor: 'var(--accent)',
          }}
        />
      </div>
    );
  }

  // No orgs yet — dashboard page will show the create-org form, no sidebar needed
  if (orgs.length === 0) {
    return (
      <div className="h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
        {children}
      </div>
    );
  }

  return (
    <div className="h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <AppSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  );
}
