'use client';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { SIZES, formatDistance } from '@/lib/game/config';
import { thermometerExcludedPolygon } from '@/lib/game/geo';
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
    const transit = L.tileLayer('https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: 'Map © memomaps.de, data © OpenStreetMap contributors',
    });
    const rail = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.8,
      attribution: '© OpenRailwayMap',
    });
    dark.addTo(m);
    L.control.layers({ Dark: dark, Streets: streets, 'Transit lines': transit }, { 'Rail overlay': rail }, { position: 'topright' }).addTo(m);
    L.control.zoom({ position: 'topright' }).addTo(m);
    playersLayer.current = L.layerGroup().addTo(m);
    qLayer.current = L.layerGroup().addTo(m);
    zoneLayer.current = L.layerGroup().addTo(m);
    m.on('dragstart', () => setFollow(false));
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // Player markers
  useEffect(() => {
    const layer = playersLayer.current;
    if (!layer || !map.current) return;
    layer.clearLayers();
    for (const loc of locations) {
      if (loc.user_id === me) continue; // drawn from live GPS below
      const p = player(loc.user_id);
      if (!p) continue;
      const stale = Date.now() - new Date(loc.updated_at).getTime() > 180_000;
      const isTheHider = loc.user_id === game.hider_id && game.status !== 'lobby';
      L.marker([loc.lat, loc.lng], { icon: pinIcon(isTheHider ? '🫣' : p.avatar, p.color, stale ? 'stale' : '') })
        .bindTooltip(`${esc(p.name)}${isTheHider ? ' (hider)' : ''} · ${ago(loc.updated_at)}`, { direction: 'top', offset: [0, -16] })
        .addTo(layer);
      if (loc.accuracy && loc.accuracy > 40) L.circle([loc.lat, loc.lng], { radius: loc.accuracy, color: p.color, weight: 1, fillOpacity: 0.05 }).addTo(layer);
    }
    if (position) {
      const mine = player(me);
      const ll: L.LatLngExpression = [position.coords.latitude, position.coords.longitude];
      L.marker(ll, { icon: pinIcon(mine?.avatar ?? '🙂', '#3d8bff', 'me'), zIndexOffset: 1000 }).bindTooltip('You').addTo(layer);
      if (!centred.current) {
        map.current.setView(ll, 14);
        centred.current = true;
      } else if (follow) map.current.panTo(ll);
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
