'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from './api';
import type { Organization } from '@clawhuddle/shared';

interface OrgWithRole extends Organization {
  member_role: string;
}

interface OrgContextValue {
  orgs: OrgWithRole[];
  currentOrg: OrgWithRole | null;
  currentOrgId: string | null;
  memberRole: string | null;
  switchOrg: (orgId: string) => void;
  refreshOrgs: () => Promise<void>;
  loading: boolean;
}

const OrgContext = createContext<OrgContextValue>({
  orgs: [],
  currentOrg: null,
  currentOrgId: null,
  memberRole: null,
  switchOrg: () => {},
  refreshOrgs: async () => {},
  loading: true,
});

export function useOrg() {
  return useContext(OrgContext);
}

const ORG_STORAGE_KEY = 'clawhuddle.currentOrgId';

export function OrgProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [orgs, setOrgs] = useState<OrgWithRole[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshOrgs = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch<{ data: OrgWithRole[] }>('/api/orgs', {
        headers: { 'x-user-id': userId },
      });
      setOrgs(res.data);

      // If current org is no longer valid, reset
      if (currentOrgId && !res.data.find((o) => o.id === currentOrgId)) {
        const stored = localStorage.getItem(ORG_STORAGE_KEY);
        const validStored = stored && res.data.find((o) => o.id === stored);
        const newOrgId = validStored ? stored : res.data[0]?.id || null;
        setCurrentOrgId(newOrgId);
        if (newOrgId) localStorage.setItem(ORG_STORAGE_KEY, newOrgId);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [userId, currentOrgId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Initialize from localStorage
    const stored = localStorage.getItem(ORG_STORAGE_KEY);
    if (stored) setCurrentOrgId(stored);

    refreshOrgs();
  }, [userId]);

  // When orgs load and no currentOrgId yet, pick the first one
  useEffect(() => {
    if (!currentOrgId && orgs.length > 0) {
      const stored = localStorage.getItem(ORG_STORAGE_KEY);
      const validStored = stored && orgs.find((o) => o.id === stored);
      const orgId = validStored ? stored : orgs[0].id;
      setCurrentOrgId(orgId);
      localStorage.setItem(ORG_STORAGE_KEY, orgId);
    }
  }, [orgs, currentOrgId]);

  const switchOrg = useCallback((orgId: string) => {
    setCurrentOrgId(orgId);
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
  }, []);

  const currentOrg = orgs.find((o) => o.id === currentOrgId) || null;
  const memberRole = currentOrg?.member_role || null;

  return (
    <OrgContext.Provider
      value={{
        orgs,
        currentOrg,
        currentOrgId,
        memberRole,
        switchOrg,
        refreshOrgs,
        loading,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}
