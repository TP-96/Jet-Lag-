import Link from 'next/link';
import { HAND_LIMIT, MAX_HIDING_MINUTES, SIZES, formatDistance, formatMinutes, type GameSize } from '@/lib/game/config';
import { CARDS } from '@/lib/game/deck';
import { CATEGORIES, CATEGORY_ORDER, questionsFor } from '@/lib/game/questions';
import { CardView } from '@/components/CardView';

export const metadata = { title: 'How to play · Hide + Seek' };

const SECTIONS: [string, string][] = [
  ['basics', 'Basics'],
  ['round', 'A round'],
  ['questions', 'Questions'],
  ['sizes', 'Game sizes'],
  ['deck', 'The deck'],
  ['chat', 'Chat'],
  ['safety', 'Safety'],
];

const TIER_COLOR: Record<string, string> = { red: '#d7263d', orange: '#e6731a', yellow: '#c99600', green: '#009a5b', blue: '#1e63d6' };

/** The round, drawn as a transit line: each phase is a stop. */
const STOPS = [
  {
    name: 'Hiding',
    color: '#f6be00',
    body: (
      <>
        The hider gets a head start and can ride anywhere in the play area. Seekers wait where they are. Before time runs out, the hider stands at a
        transit station and taps <b>Set hiding zone here</b>. From then on they have to stay inside that zone.
      </>
    ),
  },
  {
    name: 'Seeking',
    color: '#009a5b',
    body: (
      <>
        Seekers travel and ask questions, one at a time. Each question can be asked once per round. Every answer earns the hider cards, which they
        can use to slow the seekers down.
      </>
    ),
  },
  {
    name: 'Endgame',
    color: '#d7263d',
    body: (
      <>
        Once the seekers are inside the hiding zone <i>and off transit</i>, they declare Endgame. The hider has to freeze where they are.
      </>
    ),
  },
  {
    name: 'Found',
    color: '#1e63d6',
    body: <>When a seeker physically reaches the hider, tap Found. The clock stops and the hider’s time goes on the leaderboard.</>,
  },
];

export default function Rules() {
  const sizes = Object.keys(SIZES) as GameSize[];
  const time = CARDS.filter((c) => c.kind === 'time');
  const power = CARDS.filter((c) => c.kind === 'powerup');
  const curses = CARDS.filter((c) => c.kind === 'curse');
  const count = (list: typeof CARDS) => list.reduce((n, c) => n + c.copies, 0);

  return (
    <main className="rules-page">
      <header className="station-sign compact rules-sign">
        <div className="sign-body">
          <Link href="/" className="back-link">
            ‹ Back
          </Link>
          <h1>How to play</h1>
          <p>Hide + Seek on your city’s transit, in the style of Jet Lag: The Game.</p>
        </div>
        <div className="route-stripe" aria-hidden="true">
          {CATEGORY_ORDER.map((id) => (
            <i key={id} style={{ background: CATEGORIES[id].color }} />
          ))}
        </div>
      </header>

      <nav className="jump" aria-label="Sections">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <div className="rules-body">
        <section id="basics">
          <h2>Basics</h2>
          <p className="big-p">
            One player hides. Everyone else seeks together. Your score is how long you stay hidden, plus any time-bonus cards you’re holding when
            you’re found. Everyone takes a turn hiding, and the longest time wins.
          </p>
          <div className="group">
            <div className="item">
              <span className="grow">
                <b>Getting around</b>
                <span className="muted">Public transit and walking only. No taxis, rideshare, bikes or scooters, unless your group agrees otherwise.</span>
              </span>
            </div>
            <div className="item">
              <span className="grow">
                <b>Location</b>
                <span className="muted">
                  Keep the app open so your location is shared. Seekers see each other on the map. The hider’s location stays secret until the
                  round ends.
                </span>
              </span>
            </div>
            <div className="item">
              <span className="grow">
                <b>Play area</b>
                <span className="muted">
                  The host can draw a boundary: a Toronto preset, a circle, or a custom shape. Everyone has to stay inside it, including the
                  hiding zone. If you’re outside for more than 20 seconds, the whole group is told.
                </span>
              </span>
            </div>
          </div>
        </section>

        <section id="round">
          <h2>A round</h2>
          <ol className="route-map">
            {STOPS.map((s) => (
              <li key={s.name} style={{ '--stop': s.color } as React.CSSProperties}>
                <span className="stop" aria-hidden />
                <div>
                  <h3>{s.name}</h3>
                  <p>{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="questions">
          <h2>Questions</h2>
          <p>
            The hider has 5 minutes to answer, or longer for photos (10 minutes, 20 in large games). The host can change this. Radar and
            Thermometer answers are worked out from the hider’s GPS and drawn on the seekers’ map.
          </p>
          <div className="group">
            {CATEGORY_ORDER.map((id) => {
              const c = CATEGORIES[id];
              return (
                <div key={id} className="item q-cat">
                  <span className="bullet" style={{ background: c.color }} aria-hidden>
                    {c.icon}
                  </span>
                  <span className="grow">
                    <b>{c.name}</b>
                    <span className="muted">{c.description}</span>
                  </span>
                  <span className="reward">
                    Draw {c.draw}
                    <br />
                    keep {c.keep}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section id="sizes">
          <h2>Game sizes</h2>
          <div className="group">
            {sizes.map((s) => {
              const [name, area] = SIZES[s].label.split(' — ');
              return (
                <div key={s} className="item size-item">
                  <span className="grow">
                    <b>{name}</b>
                    <span className="muted">{area ? area.charAt(0).toUpperCase() + area.slice(1) : ''}</span>
                  </span>
                  <dl>
                    <div>
                      <dt>Hide</dt>
                      <dd>{formatMinutes(SIZES[s].hidingMinutes)}</dd>
                    </div>
                    <div>
                      <dt>Zone</dt>
                      <dd>{formatDistance(SIZES[s].zoneRadiusM, 'metric')}</dd>
                    </div>
                    <div>
                      <dt>Questions</dt>
                      <dd>{questionsFor(s).length}</dd>
                    </div>
                  </dl>
                </div>
              );
            })}
          </div>
          <p className="group-foot">
            Those are the default hiding times. The host can pick any hiding time from 1 minute to {formatMinutes(MAX_HIDING_MINUTES)}, when starting
            a game or in the lobby before each round.
          </p>
        </section>

        <section id="deck">
          <h2>The hider’s deck</h2>
          <p>
            {count(CARDS)} cards, shuffled fresh every round. You can hold {HAND_LIMIT} at a time. Tap a card in your hand to play or discard it.
          </p>

          <h3>Time bonuses ({count(time)})</h3>
          <p className="muted">Held when you’re found, they add minutes to your score. Bigger games give bigger bonuses.</p>
          <table className="tier-table">
            <thead>
              <tr>
                <th scope="col">Card</th>
                <th scope="col">Copies</th>
                <th scope="col">Small</th>
                <th scope="col">Medium</th>
                <th scope="col">Large</th>
              </tr>
            </thead>
            <tbody>
              {time.map(
                (c) =>
                  c.kind === 'time' && (
                    <tr key={c.id}>
                      <th scope="row">
                        <i className="swatch" style={{ background: TIER_COLOR[c.tier] }} />
                        {c.tier.charAt(0).toUpperCase() + c.tier.slice(1)}
                      </th>
                      <td>{c.copies}</td>
                      <td>+{c.minutes.small} min</td>
                      <td>+{c.minutes.medium} min</td>
                      <td>+{c.minutes.large} min</td>
                    </tr>
                  ),
              )}
            </tbody>
          </table>

          <h3>Power-ups ({count(power)})</h3>
          <p className="muted">Help you dodge questions or improve your hand.</p>
          <div className="hand rules-hand">
            {power.map((c) => (
              <div key={c.id} className="ticket-wrap">
                <CardView card={`${c.id}#1`} size="small" />
                <span className="copies">×{c.copies}</span>
              </div>
            ))}
          </div>

          <h3>Curses ({count(curses)})</h3>
          <p className="muted">Pay the casting cost, then play the curse to slow the seekers down. Seekers see active curses on their Curses tab.</p>
          <details className="more">
            <summary>Show all {count(curses)} curses</summary>
            <div className="hand rules-hand">
            {curses.map((c) => (
              <div key={c.id} className="ticket-wrap">
                <CardView card={`${c.id}#1`} size="small" />
                {c.copies > 1 && <span className="copies">×{c.copies}</span>}
              </div>
            ))}
          </div>
          </details>
        </section>

        <section id="chat">
          <h2>Chat and trolling</h2>
          <p>
            Everyone shares the <b>Everyone</b> channel. Seekers also get a <b>Seekers only</b> channel the hider can’t read, for planning. You can
            send photos, GIFs, stickers and your location, and trigger air horns, phone buzzes and full-screen “I see you” flashes on the other
            players’ phones. Be nice-ish.
          </p>
        </section>

        <section id="safety">
          <h2>Safety</h2>
          <p>
            Stay on public land, follow transit rules, don’t run on platforms or stairs, and agree on a hard stop time before you start. If anyone
            feels unsafe, the round ends.
          </p>
        </section>

        <p className="fine-print">Fan-made game inspired by Jet Lag: The Game. Not affiliated with Wendover Productions.</p>
      </div>
    </main>
  );
}
