import Link from 'next/link';
import { HAND_LIMIT, SIZES, formatDistance, type GameSize } from '@/lib/game/config';
import { CARDS } from '@/lib/game/deck';
import { CATEGORIES, CATEGORY_ORDER, questionsFor } from '@/lib/game/questions';

export const metadata = { title: 'Rules · Hide + Seek' };

export default function Rules() {
  const sizes = Object.keys(SIZES) as GameSize[];
  const time = CARDS.filter((c) => c.kind === 'time');
  const power = CARDS.filter((c) => c.kind === 'powerup');
  const curses = CARDS.filter((c) => c.kind === 'curse');
  return (
    <main className="rules">
      <p>
        <Link href="/">← Back</Link>
      </p>
      <h1 className="brand">
        HIDE <span>+</span> SEEK — Rules
      </h1>
      <p className="muted">
        Based on the Hide + Seek format from Jet Lag: The Game, adapted for one city’s public transit. Fan-made; not affiliated with the show.
      </p>

      <h2>The goal</h2>
      <p>
        One player hides, everyone else seeks. The hider’s score is how long it takes the seekers to find them, plus any time-bonus cards in their hand at
        the end. Everyone takes a turn hiding. Longest time wins.
      </p>

      <h2>Travel</h2>
      <ul>
        <li>Public transit and walking only. No taxis, rideshare, bikes or scooters (unless your group agrees otherwise).</li>
        <li>Keep the app open so your location is shared. Seekers can see each other; the hider’s location stays secret until the round ends.</li>
      </ul>

      <h2>A round</h2>
      <ol>
        <li>
          <b>Hiding period.</b> The hider travels anywhere on the network. Seekers wait at the start. Before the timer runs out the hider must stand at a
          transit station and tap <i>Set hiding zone here</i>. They must stay within the zone for the rest of the round.
        </li>
        <li>
          <b>Seeking.</b> Seekers move around and ask questions. Only one question can be waiting for an answer at a time, and each question can be asked once
          per round.
        </li>
        <li>
          <b>Endgame.</b> When the seekers are inside the hiding zone <i>and off transit</i>, they declare Endgame. The hider must freeze in place.
        </li>
        <li>
          <b>Found.</b> When a seeker reaches the hider, tap Found. The clock stops.
        </li>
      </ol>

      <h2>Game sizes</h2>
      <table className="score-table">
        <thead>
          <tr>
            <th>Size</th>
            <th>Hiding time</th>
            <th>Zone radius</th>
            <th>Questions</th>
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s}>
              <td>{SIZES[s].label}</td>
              <td>{SIZES[s].hidingMinutes} min</td>
              <td>{formatDistance(SIZES[s].zoneRadiusM, 'metric')}</td>
              <td>{questionsFor(s).length}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Questions</h2>
      <p>
        The hider has 5 minutes to answer (photos 10, or 20 in large games). Every answer earns the hider cards. Radar and thermometer questions are answered
        automatically from GPS and drawn on the seekers’ map.
      </p>
      <ul>
        {CATEGORY_ORDER.map((id) => (
          <li key={id}>
            {CATEGORIES[id].icon} <b>{CATEGORIES[id].name}</b>: {CATEGORIES[id].description} <span className="muted">(hider draws {CATEGORIES[id].draw}, keeps {CATEGORIES[id].keep})</span>
          </li>
        ))}
      </ul>

      <h2>The hider’s deck (100 cards)</h2>
      <p>Hand limit: {HAND_LIMIT}. The deck is shuffled fresh every round.</p>
      <h3>Time bonuses ({time.reduce((n, c) => n + c.copies, 0)})</h3>
      <ul>
        {time.map((c) => c.kind === 'time' && (
          <li key={c.id}>
            {c.tier} ×{c.copies}: +{c.minutes.small} / {c.minutes.medium} / {c.minutes.large} min (small / medium / large)
          </li>
        ))}
      </ul>
      <h3>Power-ups ({power.reduce((n, c) => n + c.copies, 0)})</h3>
      <ul>
        {power.map((c) => c.kind === 'powerup' && (
          <li key={c.id}>
            <b>{c.name}</b> ×{c.copies}: {c.text}
          </li>
        ))}
      </ul>
      <h3>Curses ({curses.length})</h3>
      <ul>
        {curses.map((c) => c.kind === 'curse' && (
          <li key={c.id}>
            <b>{c.name}</b>: {c.effect} <i className="muted">Cost: {c.cost}</i>
          </li>
        ))}
      </ul>

      <h2>Chat & trolling</h2>
      <p>
        Everyone can chat in <b>Everyone</b>. Seekers also get a private <b>Seekers only</b> channel the hider can’t read. Send photos, GIFs, stickers, air
        horns, buzzes and “I see you” flashes. Be nice-ish.
      </p>
      <h2>Safety</h2>
      <p>Stay on public land, obey transit rules, don’t run on platforms, and agree on a hard stop time. If anyone feels unsafe, the round ends.</p>
    </main>
  );
}
