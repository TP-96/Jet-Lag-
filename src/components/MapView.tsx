'use client';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { SIZES, formatDistance } from '@/lib/game/config';
import { thermometerExcludedPolygon } from '@/lib/game/geo';
import { useTheme } from '@/lib/theme';
import { useGameCtx } from './GameContext';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function pinIcon(avatar: string, color: string, extra = '') {
  return L.divIcon({
    className: '',
    html: `<div class="pin ${extra}" style="background:${esc(color)}">${esc(avatar)}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

function ago(ts: string) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

export default function MapView() {
  const { game, me, locations, player, questions, isHider, hiderState, position, mutateHider, toast } = useGameCtx();
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const playersLayer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new Map<string, { marker: L.Marker; ring: L.Circle | null; key: string }>());
  const bases = useRef<{ dark: L.TileLayer; light: L.TileLayer } | null>(null);
  const autoBase = useRef(true);
  const { theme } = useTheme();
  const qLayer = useRef<L.LayerGroup | null>(null);
  const zoneLayer = useRef<L.LayerGroup | null>(null);
  const centred = useRef(false);
  const [follow, setFollow] = useState(false);
  const units = game.settings.units;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true }).setView([43.2557, -79.8711], 13);
    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    });
    const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '© OpenStreetMap contributors © CARTO',
    });
    const light = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20,
      attribution: '© OpenStreetMap contributors © CARTO',
    });
    const transit = L.tileLayer('https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: 'Map © memomaps.de, data © OpenStreetMap contributors',
    });
    const rail = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.8,
      attribution: '© OpenRailwayMap',
    });
    const isLight = document.documentElement.dataset.theme === 'light' ||
      (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: light)').matches);
    (isLight ? light : dark).addTo(m);
    bases.current = { dark, light };
    L.control
      .layers({ Dark: dark, Light: light, Streets: streets, 'Transit lines': transit }, { 'Rail overlay': rail }, { position: 'topright' })
      .addTo(m);
    // Dark/Light keep following the app theme; picking Streets or Transit sticks.
    m.on('baselayerchange', (e: L.LayersControlEvent) => {
      autoBase.current = e.name === 'Dark' || e.name === 'Light';
    });
    L.control.zoom({ position: 'topright' }).addTo(m);
    playersLayer.current = L.layerGroup().addTo(m);
    qLayer.current = L.layerGroup().addTo(m);
    zoneLayer.current = L.layerGroup().addTo(m);
    m.on('dragstart', () => setFollow(false));
    map.current = m;
    const ms = markers.current;
    return () => {
      m.remove();
      map.current = null;
      ms.clear();
    };
  }, []);

  // Follow the app's light/dark theme unless the player picked a base map.
  useEffect(() => {
    const m = map.current;
    const b = bases.current;
    if (!m || !b || !autoBase.current) return;
    const want = theme === 'light' ? b.light : b.dark;
    const other = theme === 'light' ? b.dark : b.light;
    if (m.hasLayer(want)) return;
    if (m.hasLayer(other)) m.removeLayer(other);
    want.addTo(m);
  }, [theme]);

  // Player markers. Markers persist between GPS updates so CSS can glide them to the new spot.
  useEffect(() => {
    const layer = playersLayer.current;
    if (!layer || !map.current) return;
    const seen = new Set<string>();
    const place = (id: string, ll: L.LatLngTuple, icon: () => L.DivIcon, key: string, tip: string, accuracy: number | null, color: string, z = 0) => {
      seen.add(id);
      let entry = markers.current.get(id);
      if (!entry) {
        entry = { marker: L.marker(ll, { icon: icon(), zIndexOffset: z }).addTo(layer), ring: null, key };
        markers.current.set(id, entry);
      } else {
        entry.marker.setLatLng(ll);
        if (entry.key !== key) {
          entry.marker.setIcon(icon());
          entry.key = key;
        }
      }
      entry.marker.bindTooltip(tip, { direction: 'top', offset: [0, -16] });
      if (accuracy && accuracy > 40) {
        if (entry.ring) entry.ring.setLatLng(ll).setRadius(accuracy);
        else entry.ring = L.circle(ll, { radius: accuracy, color, weight: 1, fillOpacity: 0.05, interactive: false }).addTo(layer);
      } else if (entry.ring) {
        entry.ring.remove();
        entry.ring = null;
      }
    };

    for (const loc of locations) {
      if (loc.user_id === me) continue; // drawn from live GPS below
      const p = player(loc.user_id);
      if (!p) continue;
      const stale = Date.now() - new Date(loc.updated_at).getTime() > 180_000;
      const isTheHider = loc.user_id === game.hider_id && game.status !== 'lobby';
      const avatar = isTheHider ? '🫣' : p.avatar;
      place(
        loc.user_id,
        [loc.lat, loc.lng],
        () => pinIcon(avatar, p.color, stale ? 'stale' : ''),
        `${avatar}|${p.color}|${stale}`,
        `${esc(p.name)}${isTheHider ? ' (hider)' : ''} · ${ago(loc.updated_at)}`,
        loc.accuracy,
        p.color,
      );
    }
    if (position) {
      const mine = player(me);
      const ll: L.LatLngTuple = [position.coords.latitude, position.coords.longitude];
      place('__me', ll, () => pinIcon(mine?.avatar ?? '🙂', '#3d8bff', 'me'), mine?.avatar ?? '', 'You', position.coords.accuracy, '#3d8bff', 1000);
      if (!centred.current) {
        map.current.setView(ll, 14);
        centred.current = true;
      } else if (follow) map.current.panTo(ll, { animate: true, duration: 1 });
    }
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      entry.ring?.remove();
      markers.current.delete(id);
    }
  }, [locations, position, player, me, game.hider_id, game.status, follow]);

  // Question overlays (radar circles & thermometer half-planes) — the seekers' deduction board.
  useEffect(() => {
    const layer = qLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const q of questions) {
      if (q.round !== game.round || q.status !== 'answered' || q.seeker_lat == null || q.seeker_lng == null) continue;
      const v = q.answer?.value;
      const at: L.LatLngExpression = [q.seeker_lat, q.seeker_lng];
      if (q.category === 'radar' && q.distance_m) {
        const yes = v === 'yes';
        L.circle(at, {
          radius: q.distance_m,
          color: yes ? '#2fd47a' : '#ff4d5e',
          weight: 2,
          dashArray: yes ? undefined : '6 6',
          fillOpacity: yes ? 0.06 : 0.22,
        })
          .bindTooltip(`📡 ${formatDistance(q.distance_m, units)}: ${yes ? 'hider INSIDE' : 'hider NOT here'}`)
          .addTo(layer);
      }
      if (q.category === 'thermometer' && q.start_lat != null && q.start_lng != null && (v === 'hotter' || v === 'colder')) {
        const start = { lat: q.start_lat, lng: q.start_lng };
        const end = { lat: q.seeker_lat, lng: q.seeker_lng };
        L.polygon(
          thermometerExcludedPolygon(start, end, v).map((p) => [p.lat, p.lng] as L.LatLngTuple),
          { color: '#ff4d5e', weight: 0, fillOpacity: 0.18 },
        )
          .bindTooltip(`🌡️ ${v}: hider not in this half`)
          .addTo(layer);
        L.polyline(
          [
            [start.lat, start.lng],
            [end.lat, end.lng],
          ],
          { color: '#f59e0b', weight: 3 },
        ).addTo(layer);
      }
      if (q.category !== 'radar' && q.category !== 'thermometer') {
        L.circleMarker(at, { radius: 6, color: '#ffd400', weight: 2, fillOpacity: 0.6 })
          .bindTooltip(`${esc(q.text)} → ${esc(v ?? (q.answer?.photo_url ? '📸' : ''))}`)
          .addTo(layer);
      }
    }
  }, [questions, game.round, units]);

  // Hider's private hiding zone
  const zone = hiderState?.state.zone;
  useEffect(() => {
    const layer = zoneLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (isHider && zone) {
      L.circle([zone.lat, zone.lng], { radius: SIZES[game.size].zoneRadiusM, color: '#ffd400', weight: 2, fillOpacity: 0.1 })
        .bindTooltip('Your hiding zone (only you can see this)')
        .addTo(layer);
    }
  }, [isHider, zone, game.size]);

  const canSetZone =
    isHider &&
    !!hiderState &&
    (game.status === 'hiding' || (!!game.move_until && new Date(game.move_until).getTime() > Date.now()) || !zone);

  const setZone = async () => {
    if (!position) return toast('Waiting for GPS…');
    if (!confirm(`Set your hiding zone here? It's a ${formatDistance(SIZES[game.size].zoneRadiusM, units)} radius around this point — stand at your transit station.`)) return;
    await mutateHider((s) => ({ ...s, zone: { lat: position.coords.latitude, lng: position.coords.longitude } }));
    toast('📍 Hiding zone set.');
  };

  const fitAll = () => {
    const pts: L.LatLngTuple[] = locations.map((l) => [l.lat, l.lng]);
    if (position) pts.push([position.coords.latitude, position.coords.longitude]);
    if (pts.length && map.current) map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 16 });
  };

  const seekers = locations.filter((l) => l.user_id !== game.hider_id).length;
  return (
    <>
      <div ref={el} className="map" />
      <div className="map-legend">
        {isHider ? (
          <>🫣 You are hiding. {game.settings.hiderSeesSeekers ? `Seekers visible: ${seekers}` : 'Seekers are hidden from you.'}</>
        ) : game.status === 'lobby' ? (
          <>Everyone’s live location appears here.</>
        ) : (
          <>🟢 radar yes · 🔴 ruled out · 🟡 other questions</>
        )}
      </div>
      <div className="map-controls">
        {canSetZone && (
          <button className="btn primary" onClick={setZone}>
            📍 Set hiding zone here
          </button>
        )}
        <button className="btn small" onClick={fitAll}>
          👥 Fit all
        </button>
        <button
          className={`btn small ${follow ? 'primary' : ''}`}
          onClick={() => {
            setFollow(true);
            if (position && map.current) map.current.setView([position.coords.latitude, position.coords.longitude], Math.max(map.current.getZoom(), 15));
          }}
        >
          🎯 Me
        </button>
      </div>
    </>
  );
}
