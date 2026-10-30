'use client';

import { useMemo } from 'react';

export interface TrollFx {
  id: string;
  action: string;
  from: string;
}

export function TrollOverlay({ fx }: { fx: TrollFx | null }) {
  const pieces = useMemo(
    () =>
      fx?.action === 'confetti'
        ? Array.from({ length: 40 }, (_, i) => ({
            i,
            left: Math.random() * 100,
            dur: 1.8 + Math.random() * 1.6,
            delay: Math.random() * 0.6,
            ch: ['🎉', '🎊', '✨', '🥳', '🎈'][i % 5],
          }))
        : [],
    [fx],
  );
  if (!fx) return null;
  if (fx.action === 'fakeping') return <div className="flash">👀<br />I SEE YOU<br /><small style={{ fontSize: 18 }}>— {fx.from}</small></div>;
  if (fx.action === 'airhorn') return <div className="flash" style={{ background: 'rgba(255,212,0,.3)' }}>📯📯📯</div>;
  if (fx.action === 'trombone') return <div className="flash" style={{ background: 'rgba(60,60,255,.3)' }}>🎺 wah wah…</div>;
  if (fx.action === 'ominous') return <div className="flash" style={{ background: 'rgba(80,0,120,.45)' }}>🕯️💀🕯️</div>;
  if (fx.action === 'confetti')
    return (
      <>
        {pieces.map((p) => (
          <span key={p.i} className="confetti" style={{ left: `${p.left}vw`, animationDuration: `${p.dur}s`, animationDelay: `${p.delay}s` }}>
            {p.ch}
          </span>
        ))}
      </>
    );
  return null;
}
