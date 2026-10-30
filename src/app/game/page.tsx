'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useAccount } from '@/lib/account';
import GameScreen from '@/components/GameScreen';

function Inner() {
  const code = useSearchParams().get('code');
  const { user, loading } = useAccount();

  // Games need an account: send signed-out players to sign in, keeping the code.
  useEffect(() => {
    if (!loading && !user) window.location.replace(code ? `/?join=${encodeURIComponent(code.toUpperCase())}` : '/');
  }, [loading, user, code]);

  if (loading || !user) return <div className="center muted">Checking your account…</div>;
  if (!code) {
    return (
      <div className="center">
        <p>
          No game code. <a href="/">Go home</a>
        </p>
      </div>
    );
  }
  return <GameScreen code={code.toUpperCase()} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="center muted">Loading…</div>}>
      <Inner />
    </Suspense>
  );
}
