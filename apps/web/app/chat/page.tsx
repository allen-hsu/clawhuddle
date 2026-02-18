'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiFetch } from '@/lib/api';
import type { User } from '@clawteam/shared';

export default function ChatPage() {
  const { data: session } = useSession();
  const [status, setStatus] = useState<'loading' | 'no-gateway' | 'redirecting'>('loading');

  useEffect(() => {
    const userId = (session?.user as any)?.id;
    if (!userId) return;

    const checkGateway = async () => {
      try {
        const res = await apiFetch<{ data: User }>(`/api/auth/me`, {
          headers: { 'x-user-id': userId },
        });
        const u = res.data;
        if (u.gateway_status === 'running' && u.gateway_port) {
          setStatus('redirecting');
          const hostname = window.location.hostname;
          window.location.href = `http://${hostname}:${u.gateway_port}/?token=${u.gateway_token}`;
        } else {
          setStatus('no-gateway');
        }
      } catch {
        setStatus('no-gateway');
      }
    };

    checkGateway();
  }, [session]);

  if (status === 'loading' || status === 'redirecting') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400">
          {status === 'loading' ? 'Checking your AI assistant...' : 'Opening your AI assistant...'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-2">AI Assistant Not Available</h2>
        <p className="text-gray-500 mb-4">
          Your AI assistant is not yet deployed. Contact your admin to get started.
        </p>
      </div>
    </div>
  );
}
