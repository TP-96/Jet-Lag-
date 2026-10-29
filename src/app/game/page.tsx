'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import GameScreen from '@/components/GameScreen';

function Inner() {
  const code = useSearchParams().get('code');
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
