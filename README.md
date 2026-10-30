# Hide + Seek — Movie Enjoyers Edition

A web app (and future App Store / Play Store app) for playing **Hide + Seek** in the style of
[Jet Lag: The Game](https://www.youtube.com/@jetlagthegame), on your own city's public transit.

One player hides somewhere on the transit network; everyone else hunts them down by asking questions.
Every answer gives the hider cards: time bonuses, power-ups and curses that make the seekers' lives miserable.
The longest hide wins.

> Fan-made project inspired by the show. Not affiliated with Jet Lag: The Game or Wendover Productions.

## Features

| | |
|---|---|
| 🗺️ **Live tracking** | Every phone shares its GPS. Seekers see each other live; the **hider's location is secret** (enforced in the database) until the round ends. |
| 🛰️ **Live view** | One tap switches to satellite imagery with every bus, tram, subway and train line and station drawn on top from live OpenStreetMap data. It shows name labels on every visible player and keeps the whole team in frame as people move. |
| ❓ **Question deck** | Matching, Measuring, Thermometer, Radar, Tentacles and Photos. The pool scales with game size, and each question can be asked once per round. |
| 📡 **Auto-answers** | Radar and thermometer questions are answered from the hider's GPS and drawn on the seekers' map as deduction overlays. |
| 🃏 **Hider deck** | 100 cards: 55 time bonuses, 21 power-ups (Veto, Randomize, Discard/Draw, Duplicate, Move…) and 24 curses. Draw X and keep Y, with a hand limit of 6. |
| 💀 **Curses** | Seekers get the curse card, plus a countdown for timed curses. Overflowing Chalice's extra draws are applied automatically. |
| 📍 **Hiding zone** | The hider locks their zone at a station and gets a warning if they leave it. Seekers can declare Endgame, then Found. |
| 💬 **Chat** | Signal-style bubbles, replies, reactions and delete-for-everyone. Send photos, GIFs (GIPHY), stickers and locations. There is also a **seekers-only channel** the hider can't read. |
| 📯 **Trolling** | Air horns, phone buzz plus screen shake, sad trombone, a full-screen "I SEE YOU" flash, confetti and ominous curse sounds. |
| 🏆 **Scoring** | Your score is the time until you're found plus the time bonuses in your hand. The leaderboard tracks every round, and the hider rotates each round. |
| ⚡ **Fast updates** | Realtime pushes every change instantly. GPS uploads about once a second while moving, and map markers glide smoothly between positions. |
| 📶 **Tunnel-proof** | When the realtime connection drops (subways!) the app polls live state every second, and everything else every 5 s. |
| 🎉 **Celebrations** | A "FOUND!" animation with a target lock-on and a count-up of the hider's time. A winner podium with a falling crown when the host ends the game. |
| 🌗 **Light & dark mode** | Follows the phone's setting by default, or pick Light or Dark on the home screen or Team tab. The map style follows the theme. |

## Game balance (city edition)

| Size | Hiding time | Hiding zone | Best for |
|---|---|---|---|
| Small | 30 min | 400 m | One city's core network, 1.5–3 h rounds |
| Medium | 60 min | 400 m | Whole city including suburbs / regional rail |
| Large | 3 h | 800 m | Metro region, all-day game |

- Hider answer time: 5 min (photos 10 min, or 20 in Large). The host can change this.
- Question rewards: Matching / Measuring draw 3 keep 1, Radar / Thermometer draw 2 keep 1,
  Tentacles draw 4 keep 2, Photos draw 1 keep 1.
- Distances are rescaled from the show's country-sized games to city size (e.g. radar 250 m to 5 km in Small).
  Tune them in `src/lib/game/questions.ts` and `src/lib/game/config.ts`.
- Time bonuses scale with game size: +2 to +12 min in Small, up to +5 to +30 min in Large.

Full rules and every card are listed in the app under **How to play** (`/rules`).

## Setup (≈10 minutes)

### 1. Supabase (free tier is plenty)
1. Create a project at [supabase.com](https://supabase.com).
2. **Authentication → Sign In / Providers → enable "Anonymous sign-ins"**. Players don't need accounts.
3. **SQL Editor** → paste and run [`supabase/schema.sql`](supabase/schema.sql).
   This creates the tables, the row-level-security rules, realtime and the `media` storage bucket for photos.
4. Copy the **Project URL** and **anon key** from Project Settings → API.

### 2. Run locally
```bash
cp .env.example .env.local   # fill in the Supabase values
npm install
npm run dev
```
Open http://localhost:3000. Location needs HTTPS or localhost.

### 3. Deploy to Vercel
1. Import this repo in [Vercel](https://vercel.com/new). The framework is detected as Next.js.
2. Add the environment variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and,
   optionally, `NEXT_PUBLIC_GIPHY_API_KEY` (free at [developers.giphy.com](https://developers.giphy.com)).
3. Deploy. Everyone opens the URL on their phone and taps **Share → Add to Home Screen**.
   It installs like an app (PWA).

### 4. App Store / Play Store (Capacitor)
The project is already set up for [Capacitor](https://capacitorjs.com):
```bash
npm run build:mobile          # static export to /out + cap sync
npx cap add ios               # needs a Mac with Xcode
npx cap add android           # needs Android Studio
npx cap open ios
```
- Add location permission strings in `ios/App/App/Info.plist`:
  `NSLocationWhenInUseUsageDescription` → "Your location is shared with your team during the game."
- Set `NEXT_PUBLIC_SITE_URL` to your Vercel URL so invite links point to the web app.
- Or set `CAP_SERVER_URL=https://your-app.vercel.app` before `cap sync` so the native shell loads the live site,
  which means updates ship without store review.
- To track phones while the screen is locked, add a background location plugin such as
  `@capacitor-community/background-geolocation`. The web version keeps the screen awake during rounds
  (Wake Lock API) because browsers pause GPS in the background.

## How a round works
1. The host picks a hider in the lobby and starts the round.
2. **Hiding period.** The hider rides transit to a station and taps **Set hiding zone here**.
3. **Seeking.** Seekers ask questions from the Ask tab. Only one can be pending at a time.
   The hider answers, then draws and keeps cards.
4. The hider casts curses and plays power-ups from the Cards tab.
5. Once seekers are inside the zone and off transit, they hit **🚨 Endgame**. The hider must freeze.
6. A seeker reaches the hider and hits **🎯 Found**. The hider's time plus bonuses goes on the leaderboard.
7. After the last round, the host taps **🏁 End game & crown the winner**.

## Tech
- Next.js 15 (App Router) + React 19 + TypeScript. Everything runs client-side, so it hosts anywhere and exports statically.
- Supabase: Postgres + row-level security, Realtime, anonymous auth and Storage.
- Leaflet with OpenStreetMap / CARTO / ÖPNVKarte tiles, Esri World Imagery for satellite, and transit routes/stops from OpenStreetMap via the Overpass API.
- Sounds are synthesised with Web Audio, so there are no audio assets.

```
src/lib/game/      pure game logic: sizes, questions, 100-card deck, geo math (unit-tested)
src/lib/           Supabase client, realtime hook, actions, GPS sharing, sounds, GIPHY
src/components/    Map, Chat, Questions, Hider cards, Curses, Lobby/Team, status bar
supabase/schema.sql database, security rules, realtime and storage
```

```bash
npm test          # vitest: deck, draws, chalice, duplicate, radar/thermometer math
npm run lint      # typecheck
```

### Notes
- **Fair play.** The hider's location and deck can't be read by seekers through the API.
  Game-state changes are trusted among players, which is fine for a friends' game.
- Chat is private to game members but **not end-to-end encrypted** like Signal.
- Map tiles and transit data come from free community servers (OSM, CARTO, Esri, Overpass). They're fine for a friends' game. For heavy use, switch to a keyed provider (e.g. MapTiler) in `MapView.tsx`.
- OpenStreetMap has no aerial photos, so satellite imagery comes from Esri. The transit lines on top are OpenStreetMap data, so they're only as complete as your city's OSM mapping.
