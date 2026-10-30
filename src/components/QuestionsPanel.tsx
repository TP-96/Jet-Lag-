'use client';

import { useEffect, useMemo, useState } from 'react';
import { answerQuestion, askQuestion, replaceQuestion, systemMessage } from '@/lib/actions';
import { formatDistance, formatDuration } from '@/lib/game/config';
import { beginDraw, cardDef, playCard, secureRandom } from '@/lib/game/deck';
import { haversine, radarAnswer, thermometerAnswer } from '@/lib/game/geo';
import {
  answerTimeMs,
  availableQuestions,
  CATEGORIES,
  CATEGORY_ORDER,
  QUESTION_BY_ID,
  renderQuestionText,
  type CategoryId,
  type QuestionDef,
} from '@/lib/game/questions';
import { compressImage, uploadMedia } from '@/lib/supabase';
import type { Answer, Question } from '@/lib/types';
import { useGameCtx, useNow } from './GameContext';

function answerLabel(q: Question): string {
  if (q.status === 'vetoed') return 'Vetoed';
  const v = q.answer?.value;
  if (!v) return q.answer?.photo_url ? 'Photo' : '…';
  const map: Record<string, string> = { yes: 'Yes', no: 'No', closer: 'Closer', further: 'Further', hotter: 'Hotter', colder: 'Colder' };
  return map[v] ?? v;
}

export function QuestionLog({ questions }: { questions: Question[] }) {
  const { player } = useGameCtx();
  if (questions.length === 0) return <p className="muted small">No questions asked yet this round.</p>;
  return (
    <div className="qlist">
      {[...questions].reverse().map((q) => {
        const cat = CATEGORIES[q.category as CategoryId];
        return (
          <div key={q.id} className="qitem" style={{ borderLeftColor: cat?.color }}>
            <div className="row spread small muted">
              <span>
                {cat?.name}, asked by {player(q.asked_by)?.name ?? 'a seeker'}
              </span>
              <span>{new Date(q.asked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div>{q.text}</div>
            {q.answer?.randomized_from && <div className="small muted">The hider randomized this question</div>}
            <div className="qa">{q.status === 'pending' ? 'Waiting for an answer…' : answerLabel(q)}</div>
            {q.answer?.photo_url && <img src={q.answer.photo_url} alt="answer" />}
          </div>
        );
      })}
    </div>
  );
}

function thermoKey(gameId: string, round: number) {
  return `hs-thermo:${gameId}:${round}`;
}

interface ThermoStart {
  qid: string;
  lat: number;
  lng: number;
}

function SeekerAsk({ roundQs }: { roundQs: Question[] }) {
  const { game, position, toast, myPlayer } = useGameCtx();
  const now = useNow(1000);
  const [cat, setCat] = useState<CategoryId | null>(null);
  const [custom, setCustom] = useState('2');
  const [busy, setBusy] = useState(false);
  const [thermo, setThermo] = useState<ThermoStart | null>(null);
  const units = game.settings.units;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(thermoKey(game.id, game.round));
      setThermo(raw ? (JSON.parse(raw) as ThermoStart) : null);
    } catch {}
  }, [game.id, game.round]);

  const pending = roundQs.find((q) => q.status === 'pending');
  const asked = roundQs.map((q) => q.question_id);
  const avail = useMemo(() => new Set(availableQuestions(game.size, asked).map((q) => q.id)), [game.size, asked]);
  const moving = game.move_until && new Date(game.move_until).getTime() > now;
  const canAsk = (game.status === 'seeking' || game.status === 'endgame') && !pending && !moving;
  const here = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;

  async function ask(def: QuestionDef, distance?: number, start?: ThermoStart) {
    if (!here && (def.category === 'radar' || def.category === 'thermometer')) return toast('Need your GPS location for this question.');
    setBusy(true);
    try {
      const d = distance ?? def.distanceM;
      const text = renderQuestionText(def, d ? formatDistance(d, units) : undefined);
      await askQuestion({
        game_id: game.id,
        round: game.round,
        question_id: def.id,
        category: def.category,
        text,
        distance_m: d ?? null,
        deadline: new Date(Date.now() + answerTimeMs(def.category, game.size, game.settings.answerMinutes)).toISOString(),
        seeker_lat: here?.lat ?? null,
        seeker_lng: here?.lng ?? null,
        start_lat: start?.lat ?? null,
        start_lng: start?.lng ?? null,
      });
      await systemMessage(game.id, `${myPlayer?.name} asked: ${text}`, { event: 'question' });
      if (start) {
        localStorage.removeItem(thermoKey(game.id, game.round));
        setThermo(null);
      }
      setCat(null);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startThermo(def: QuestionDef) {
    if (!here) return toast('Need your GPS location to start a thermometer.');
    const t = { qid: def.id, ...here };
    localStorage.setItem(thermoKey(game.id, game.round), JSON.stringify(t));
    setThermo(t);
    toast(`Thermometer started. Travel ${formatDistance(def.distanceM!, units)} then ask.`);
  }

  const thermoDef = thermo ? QUESTION_BY_ID[thermo.qid] : null;
  const travelled = thermo && here ? haversine(thermo, here) : 0;

  return (
    <div className="stack">
      {pending && <PendingCard q={pending} />}
      {moving && <div className="banner info">The hider is moving. Stay where you are; questions are paused.</div>}
      {game.status === 'hiding' && <div className="banner warn">Questions open when the hiding period ends.</div>}

      {thermo && thermoDef && (
        <div className="card stack">
          <div className="row spread">
            <b>Thermometer in progress</b>
            <button
              className="btn small ghost"
              onClick={() => {
                localStorage.removeItem(thermoKey(game.id, game.round));
                setThermo(null);
              }}
            >
              Cancel
            </button>
          </div>
          <div>
            Travelled {formatDistance(travelled, units)} of {formatDistance(thermoDef.distanceM!, units)}
          </div>
          <div style={{ height: 8, background: 'var(--bg3)', borderRadius: 4 }}>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--accent)', width: `${Math.min(100, (travelled / thermoDef.distanceM!) * 100)}%` }} />
          </div>
          <button className="btn primary" disabled={!canAsk || busy || travelled < thermoDef.distanceM!} onClick={() => ask(thermoDef, undefined, thermo)}>
            Ask: hotter or colder?
          </button>
        </div>
      )}

      <div className="cat-grid">
        {CATEGORY_ORDER.map((id) => {
          const c = CATEGORIES[id];
          return (
            <button
              key={id}
              className={`cat ${cat === id ? 'on' : ''}`}
              style={{ '--c': c.color } as React.CSSProperties}
              aria-pressed={cat === id}
              onClick={() => setCat(cat === id ? null : id)}
            >
              <span className="ic">{c.icon}</span>
              <span className="nm">{c.name}</span>
              <span className="cost">
                Hider draws {c.draw}, keeps {c.keep}
              </span>
            </button>
          );
        })}
      </div>

      {cat && (
        <div className="card stack">
          <div className="small muted">{CATEGORIES[cat].description}</div>
          {availableQuestions(game.size, [])
            .filter((q) => q.category === cat)
            .map((q) => {
              const used = !avail.has(q.id);
              if (q.customDistance) {
                const meters = Number(custom) * (units === 'metric' ? 1000 : 1609.344);
                return (
                  <div key={q.id} className="row">
                    <input className="input" style={{ width: 90 }} inputMode="decimal" value={custom} onChange={(e) => setCustom(e.target.value)} />
                    <span>{units === 'metric' ? 'km' : 'mi'}</span>
                    <button className="btn" disabled={!canAsk || busy || !(meters > 0)} onClick={() => ask(q, meters)}>
                      Ask custom radar
                    </button>
                  </div>
                );
              }
              const label = renderQuestionText(q, q.distanceM ? formatDistance(q.distanceM, units) : undefined);
              if (q.category === 'thermometer') {
                return (
                  <button key={q.id} className="qpick" disabled={used || !!thermo || busy} onClick={() => startThermo(q)}>
                    Start: {label}
                  </button>
                );
              }
              return (
                <button key={q.id} className="qpick" disabled={used || !canAsk || busy} onClick={() => ask(q)}>
                  {label}
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}

function PendingCard({ q }: { q: Question }) {
  const now = useNow(1000);
  const left = new Date(q.deadline).getTime() - now;
  const cat = CATEGORIES[q.category as CategoryId];
  return (
    <div className="card stack" style={{ borderColor: cat.color }}>
      <div className="row spread">
        <b>{cat.name}</b>
        <span className="tag" style={{ color: left < 0 ? 'var(--danger)' : undefined }}>
          {left >= 0 ? `${formatDuration(left)} left` : `${formatDuration(-left)} overdue`}
        </span>
      </div>
      <div style={{ fontSize: 17 }}>{q.text}</div>
    </div>
  );
}

function HiderAnswer({ q, roundQs }: { q: Question; roundQs: Question[] }) {
  const { game, position, hiderState, mutateHider, toast } = useGameCtx();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const def = QUESTION_BY_ID[q.question_id];
  const cat = CATEGORIES[q.category as CategoryId];
  const hand = hiderState?.state.hand ?? [];
  const veto = hand.find((c) => cardDef(c).id === 'power-veto');
  const randomize = hand.find((c) => cardDef(c).id === 'power-randomize');
  const here = position ? { lat: position.coords.latitude, lng: position.coords.longitude } : null;

  let auto: string | null = null;
  if (here && q.seeker_lat != null && q.seeker_lng != null) {
    const seeker = { lat: q.seeker_lat, lng: q.seeker_lng };
    if (q.category === 'radar' && q.distance_m) auto = radarAnswer(seeker, here, q.distance_m) ? 'yes' : 'no';
    if (q.category === 'thermometer' && q.start_lat != null && q.start_lng != null)
      auto = thermometerAnswer({ lat: q.start_lat, lng: q.start_lng }, seeker, here);
  }

  async function finish(answer: Answer, status: Question['status'] = 'answered') {
    setBusy(true);
    try {
      await answerQuestion(q, { ...(q.answer ?? {}), ...answer }, status);
      await systemMessage(
        game.id,
        status === 'vetoed' ? `The hider vetoed: ${q.text}` : `${q.text} → ${answer.photo_url ? 'photo' : String(answer.value).toUpperCase()}`,
        { event: 'answer', question: q.id },
      );
      await mutateHider((s) => {
        const after = status === 'vetoed' && veto ? playCard(s, veto) : s;
        return beginDraw(after, cat.draw, cat.keep, `Reward for answering a ${cat.name} question`, true);
      });
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doRandomize() {
    if (!randomize) return;
    const asked = roundQs.map((x) => x.question_id);
    const pool = availableQuestions(game.size, asked).filter((x) => x.category === q.category && x.id !== q.question_id && !x.customDistance);
    if (pool.length === 0) return toast('No other questions in this category to randomize to.');
    const next = pool[Math.floor(secureRandom() * pool.length)];
    setBusy(true);
    try {
      const d = next.distanceM ?? q.distance_m ?? undefined;
      const newText = renderQuestionText(next, d ? formatDistance(d, game.settings.units) : undefined);
      await replaceQuestion(q, { question_id: next.id, text: newText, distance_m: d ?? null, answer: { randomized_from: q.question_id } });
      await mutateHider((s) => playCard(s, randomize));
      await systemMessage(game.id, `The hider randomized the question. New question: ${newText}`);
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoto(file: File) {
    setBusy(true);
    try {
      const blob = await compressImage(file);
      const url = await uploadMedia(game.id, blob, 'jpg');
      await finish({ photo_url: url });
    } catch (e) {
      toast((e as Error).message);
      setBusy(false);
    }
  }

  const type = def?.answerType ?? 'text';
  return (
    <div className="stack">
      <PendingCard q={q} />
      {auto && (
        <div className="card stack">
          <div className="small muted">Calculated from your GPS:</div>
          <button className="btn primary block" style={{ minHeight: 60, fontSize: 20 }} disabled={busy} onClick={() => finish({ value: auto!, auto: true })}>
            Send “{auto.toUpperCase()}”
          </button>
        </div>
      )}
      {!auto && (q.category === 'radar' || q.category === 'thermometer') && (
        <div className="banner warn">Waiting for your GPS to auto-answer… or answer manually below.</div>
      )}
      <div className="small muted">{auto ? 'Or answer manually (if GPS is off):' : 'Your answer:'}</div>
      {type === 'yesno' && (
        <div className="answer-grid">
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'yes' })}>Yes</button>
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'no' })}>No</button>
        </div>
      )}
      {type === 'closerfurther' && (
        <div className="answer-grid">
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'closer' })}>Closer</button>
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'further' })}>Further</button>
        </div>
      )}
      {type === 'hotcold' && (
        <div className="answer-grid">
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'hotter' })}>Hotter</button>
          <button className="btn" disabled={busy} onClick={() => finish({ value: 'colder' })}>Colder</button>
        </div>
      )}
      {type === 'text' && (
        <div className="row">
          <input className="input" placeholder="e.g. Central Library" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" disabled={busy || !text.trim()} onClick={() => finish({ value: text.trim() })}>
            Send
          </button>
        </div>
      )}
      {type === 'photo' && (
        <label className="btn primary block">
          {busy ? 'Uploading…' : 'Take or choose a photo'}
          <input type="file" accept="image/*" capture="environment" hidden disabled={busy} onChange={(e) => e.target.files?.[0] && sendPhoto(e.target.files[0])} />
        </label>
      )}
      <div className="row">
        <button className="btn block" disabled={busy || !veto} onClick={() => confirm('Play Veto? You still get the card draw.') && finish({ vetoed: true }, 'vetoed')}>
          Veto{veto ? '' : ' (no card)'}
        </button>
        <button className="btn block" disabled={busy || !randomize || !!q.answer?.randomized_from} onClick={doRandomize}>
          Randomize{randomize ? '' : ' (no card)'}
        </button>
      </div>
    </div>
  );
}

export default function QuestionsPanel() {
  const { game, questions, isHider } = useGameCtx();
  const roundQs = questions.filter((q) => q.round === game.round);
  const pending = roundQs.find((q) => q.status === 'pending');

  if (game.status === 'lobby' || game.status === 'finished') return <p className="muted">Questions open once a round starts.</p>;

  return (
    <div className="stack">
      {isHider ? (
        pending ? (
          <HiderAnswer q={pending} roundQs={roundQs} />
        ) : (
          <div className="card muted">No open questions. Stay hidden; the next one will buzz your phone.</div>
        )
      ) : (
        game.status !== 'round_over' && <SeekerAsk roundQs={roundQs} />
      )}
      <h3 style={{ marginTop: 8 }}>This round</h3>
      <QuestionLog questions={roundQs} />
    </div>
  );
}
