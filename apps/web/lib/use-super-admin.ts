'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from './api';

export function useSuperAdmin() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!userId) return;
    apiFetch<{ data: { isSuperAdmin: boolean } }>('/api/super-admin/check', {
      headers: { 'x-user-id': userId },
    })
      .then((res) => setIsSuperAdmin(res.data.isSuperAdmin))
      .catch(() => setIsSuperAdmin(false));
  }, [userId]);

  return isSuperAdmin;
}
