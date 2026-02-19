'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrg } from '@/lib/org-context';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { memberRole, loading } = useOrg();
  const router = useRouter();
  const isAdmin = memberRole === 'admin' || memberRole === 'owner';

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      router.replace('/home');
    }
  }, [isAdmin, loading, router]);

  if (loading || !isAdmin) return null;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      {children}
    </div>
  );
}
