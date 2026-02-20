'use client';

import { useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useOrg } from './org-context';
import { createOrgFetch } from './api';

export function useOrgFetch() {
  const { data: session } = useSession();
  const { currentOrgId } = useOrg();
  const userId = session?.user?.id;

  const orgFetch = useMemo(() => {
    if (!currentOrgId || !userId) return null;
    return createOrgFetch(currentOrgId, userId);
  }, [currentOrgId, userId]);

  const ready = !!orgFetch;

  return { orgFetch, ready, currentOrgId, userId };
}
