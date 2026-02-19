'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Legacy redirect — org creation is now handled on the dashboard
export default function OnboardingPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/'); }, [router]);
  return null;
}
