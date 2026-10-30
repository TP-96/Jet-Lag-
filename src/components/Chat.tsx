'use client';

import Icon from './Icon';

import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteMessage, sendMessage, toggleReaction } from '@/lib/actions';
import { cardDef } from '@/lib/game/deck';
import { gifSearchAvailable, searchGifs, type Gif } from '@/lib/giphy';
import { compressImage, uploadMedia } from '@/lib/supabase';
import { QUICK_REACTIONS, STICKERS, TROLL_ACTIONS } from '@/lib/troll';
import type { Message } from '@/lib/types';
import { useGameCtx } from './GameContext';

type Tray = null | 'gif' | 'sticker' | 'troll';

function time(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function preview(m: Message | undefined): string {
  if (!m) return 'deleted message';
  if (m.kind === 'text') return m.body ?? '';
  if (m.kind === 'image') return 'Photo';
  if (m.kind === 'gif') return 'GIF';
  if (m.kind === 'sticker') return `${m.body} sticker`;
  return m.body ?? m.kind;
}

export default function Chat() {
  const { game, me, messages, reactions, player, isHider, position, toast } = useGameCtx();
  const [channel, setChannel] = useState<'all' | 'seekers'>('all');
  const [text, setText] = useState('');
  const [tray, setTray] = useState<Tray>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [menu, setMenu] = useState<Message | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const chan = isHider ? 'all' : channel;

  const shown = useMemo(() => messages.filter((m) => m.channel === chan), [messages, chan]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [shown.length, chan]);

  async function send(partial: Partial<Message> & { kind: Message['kind'] }) {
    try {
      await sendMessage({ game_id: game.id, channel: chan, reply_to: replyTo?.id ?? null, ...partial });
      setReplyTo(null);
    } catch (e) {
      toast((e as Error).message);
    }
  }

  async function sendText() {
    const body = text.trim();
    if (!body) return;
    setText('');
    await send({ kind: 'text', body: body.slice(0, 2000) });
  }

  async function sendPhotos(files: FileList) {
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 6)) {
        const isGif = f.type === 'image/gif';
        const blob = isGif ? f : await compressImage(f);
        const url = await uploadMedia(game.id, blob, isGif ? 'gif' : 'jpg');
        await send({ kind: isGif ? 'gif' : 'image', media_url: url });
      }
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function shareLocation() {
    if (!position) return toast('No GPS fix yet.');
    await send({
      kind: 'location',
      body: 'My location',
      meta: { lat: position.coords.latitude, lng: position.coords.longitude },
    });
  }

  return (
    <div className="chat">
      <div className="chan">
        <button className={`btn small ${chan === 'all' ? 'primary' : ''}`} onClick={() => setChannel('all')}>
          Everyone
        </button>
        {!isHider && (
          <button className={`btn small ${chan === 'seekers' ? 'primary' : ''}`} onClick={() => setChannel('seekers')}>
            Seekers only
          </button>
        )}
      </div>

      <div className="msgs" ref={listRef}>
        {shown.length === 0 && <div className="sys">No messages yet. Say hi, or start the trash talk.</div>}
        {shown.map((m, i) => {
          if (m.kind === 'system') return <div key={m.id} className="sys">{m.body}</div>;
          const p = player(m.user_id);
          const mine = m.user_id === me;
          if (m.kind === 'troll') {
            const t = TROLL_ACTIONS.find((x) => x.id === (m.meta as { action?: string }).action);
            return (
              <div key={m.id} className="sys">
                {t?.icon} {p?.name ?? 'Someone'} used {t?.label ?? 'a troll'}
              </div>
            );
          }
          const prev = shown[i - 1];
          const grouped = prev && prev.user_id === m.user_id && prev.kind !== 'system' && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 120_000;
          const rx = reactions.filter((r) => r.message_id === m.id);
          const counts = new Map<string, { n: number; mine: boolean }>();
          rx.forEach((r) => {
            const c = counts.get(r.emoji) ?? { n: 0, mine: false };
            counts.set(r.emoji, { n: c.n + 1, mine: c.mine || r.user_id === me });
          });
          const media = m.kind === 'image' || m.kind === 'gif' || m.kind === 'sticker' || m.kind === 'card';
          return (
            <div key={m.id} className={`msg ${mine ? 'mine' : ''}`} style={{ marginTop: grouped ? 0 : 6 }}>
              {!mine && (
                <div className="av" style={{ background: p?.color ?? '#555', visibility: grouped ? 'hidden' : 'visible' }}>
                  {p?.avatar ?? '❔'}
                </div>
              )}
              <div>
                <div
                  className={`bubble ${media ? 'media' : ''}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu(m);
                  }}
                  onClick={() => (m.kind === 'image' || m.kind === 'gif' ? setLightbox(m.media_url) : setMenu(m))}
                >
                  {!mine && !grouped && !media && (
                    <div className="who" style={{ color: p?.color }}>
                      {p?.name ?? 'Unknown'}
                    </div>
                  )}
                  {m.reply_to && <div className="quote">↩ {preview(byId.get(m.reply_to))}</div>}
                  {m.kind === 'text' && m.body}
                  {(m.kind === 'image' || m.kind === 'gif') && m.media_url && <img src={m.media_url} alt={m.kind} loading="lazy" />}
                  {m.kind === 'sticker' && (
                    <div className="sticker">
                      {m.body}
                      {typeof m.meta.sub === 'string' && <small>{m.meta.sub}</small>}
                    </div>
                  )}
                  {m.kind === 'card' && typeof m.meta.card_id === 'string' && <CardMessage cardId={m.meta.card_id} />}
                  {m.kind === 'location' && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${m.meta.lat}&mlon=${m.meta.lng}#map=17/${m.meta.lat}/${m.meta.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'inherit' }}
                    >
                      {m.body} ↗
                    </a>
                  )}
                  {!media && <span className="time">{time(m.created_at)}</span>}
                </div>
                {counts.size > 0 && (
                  <div className="reacts" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    {[...counts].map(([emoji, c]) => (
                      <button key={emoji} className={c.mine ? 'on' : ''} onClick={() => toggleReaction(game.id, m.id, emoji, c.mine)}>
                        {emoji} {c.n > 1 ? c.n : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="composer">
        {replyTo && (
          <div className="row spread small">
            <span className="muted">↩ Replying to {player(replyTo.user_id)?.name}: {preview(replyTo).slice(0, 60)}</span>
            <button className="btn small ghost" onClick={() => setReplyTo(null)}>
              ✕
            </button>
          </div>
        )}
        {tray === 'gif' && <GifTray onPick={(g) => (send({ kind: 'gif', media_url: g }), setTray(null))} />}
        {tray === 'sticker' && (
          <div className="tray sticker-grid">
            {STICKERS.map((s) => (
              <button
                key={s.id}
                title={s.sub}
                onClick={() => {
                  send({ kind: 'sticker', body: s.text, meta: s.sub ? { sub: s.sub } : {} });
                  setTray(null);
                }}
              >
                {s.text}
              </button>
            ))}
          </div>
        )}
        {tray === 'troll' && (
          <div className="tray troll-grid">
            {TROLL_ACTIONS.map((t) => (
              <button
                key={t.id}
                title={t.description}
                onClick={() => {
                  send({ kind: 'troll', meta: { action: t.id } });
                  setTray(null);
                }}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
            {!isHider && (
              <button onClick={() => (shareLocation(), setTray(null))} title="Share your current location">
                <span><Icon name="pin" /></span>
                My location
              </button>
            )}
          </div>
        )}
        <div className="bar">
          <label className="iconbtn" title="Photo" aria-label="Send a photo">
            {uploading ? <span className="spinner" aria-label="Uploading" /> : <Icon name="camera" />}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && sendPhotos(e.target.files)} />
          </label>
          <button className="iconbtn" title="GIF" onClick={() => setTray(tray === 'gif' ? null : 'gif')} style={{ fontSize: 12, fontWeight: 800 }}>
            GIF
          </button>
          <button className="iconbtn" title="Stickers" aria-label="Stickers" onClick={() => setTray(tray === 'sticker' ? null : 'sticker')}>
            <Icon name="smile" />
          </button>
          <button className="iconbtn" title="Troll the others" aria-label="Troll the others" onClick={() => setTray(tray === 'troll' ? null : 'troll')}>
            <Icon name="horn" />
          </button>
          <textarea
            className="input"
            rows={1}
            placeholder="Message"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendText();
              }
            }}
          />
          <button className="iconbtn send" onClick={sendText} aria-label="Send">
            <Icon name="send" />
          </button>
        </div>
      </div>

      {menu && (
        <div className="menu" onClick={() => setMenu(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="reaction-pick">
              {QUICK_REACTIONS.map((e) => {
                const has = reactions.some((r) => r.message_id === menu.id && r.user_id === me && r.emoji === e);
                return (
                  <button
                    key={e}
                    onClick={() => {
                      toggleReaction(game.id, menu.id, e, has).catch((err) => toast(err.message));
                      setMenu(null);
                    }}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
            <button className="btn block" onClick={() => (setReplyTo(menu), setMenu(null))}>
              ↩ Reply
            </button>
            {menu.body && menu.kind === 'text' && (
              <button className="btn block" onClick={() => (navigator.clipboard?.writeText(menu.body!), setMenu(null))}>
                Copy
              </button>
            )}
            {menu.user_id === me && (
              <button className="btn danger block" onClick={() => (deleteMessage(menu.id), setMenu(null))}>
                Delete for everyone
              </button>
            )}
          </div>
        </div>
      )}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}

function CardMessage({ cardId }: { cardId: string }) {
  const d = cardDef(cardId);
  return (
    <div className={`gcard ${d.kind}`} style={{ maxWidth: 260, minHeight: 0 }}>
      <div className="kind">{d.kind === 'curse' ? 'Curse cast' : 'Power-up played'}</div>
      <div className="title">{d.name}</div>
      <div className="body">{d.kind === 'curse' ? d.effect : d.kind === 'powerup' ? d.text : ''}</div>
    </div>
  );
}

function GifTray({ onPick }: { onPick: (url: string) => void }) {
  const [q, setQ] = useState('');
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!gifSearchAvailable) return;
    const t = setTimeout(() => {
      searchGifs(q)
        .then((g) => (setGifs(g), setErr(null)))
        .catch((e) => setErr(e.message));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (!gifSearchAvailable) {
    return (
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^https?:\/\/.+/i.test(q)) onPick(q.trim());
        }}
      >
        <input className="input" placeholder="Paste a GIF link (or pick a .gif with 📷)" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Send</button>
      </form>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      <input className="input" placeholder="Search GIPHY" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      {err && <div className="small muted">{err}</div>}
      <div className="tray gif-grid">
        {gifs.map((g) => (
          <img key={g.id} src={g.preview} alt={g.title} onClick={() => onPick(g.url)} loading="lazy" />
        ))}
      </div>
      <div className="small muted" style={{ textAlign: 'right' }}>
        Powered by GIPHY
      </div>
    </div>
  );
}
