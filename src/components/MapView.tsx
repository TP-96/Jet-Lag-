'use client';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { SIZES, formatDistance } from '@/lib/game/config';
import { thermometerExcludedPolygon } from '@/lib/game/geo';
import { useTheme } from '@/lib/theme';
import { MODE_WEIGHT, contains, fetchTransit, padBBox, type BBox, type TransitData } from '@/lib/transit';
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

const MODE_LABEL: Record<string, string> = {
  bus: '🚌 Bus',
  trolleybus: '🚎 Trolleybus',
  tram: '🚊 Tram',
  light_rail: '🚈 LRT',
  subway: '🚇 Subway',
  train: '🚆 Train',
  monorail: '🚝 Monorail',
  ferry: '⛴️ Ferry',
};

const LIVE_KEY = 'hs-live-view';

function drawTransit(group: L.LayerGroup, data: TransitData) {
  group.clearLayers();
  for (const r of data.routes) {
    const w = MODE_WEIGHT[r.mode];
    const label = `${MODE_LABEL[r.mode] ?? r.mode}${r.ref ? ` ${esc(r.ref)}` : ''}${r.name ? ` · ${esc(r.name)}` : ''}`;
    // Dark casing keeps thin coloured lines readable over satellite imagery.
    L.polyline(r.lines, { pane: 'transit', color: '#000', weight: w + 3, opacity: 0.45, interactive: false }).addTo(group);
    L.polyline(r.lines, { pane: 'transit', color: r.color, weight: w, opacity: 0.95 }).bindTooltip(label, { sticky: true }).addTo(group);
  }
  for (const st of data.stops) {
    const big = st.kind === 'station';
    L.circleMarker([st.lat, st.lng], {
      pane: 'transit',
      radius: big ? 6 : st.kind === 'tram' ? 4.5 : 3.5,
      color: '#111',
      weight: big ? 2.5 : 1.5,
      fillColor: big ? '#fff' : st.kind === 'tram' ? '#ffd2db' : '#ffe9b3',
      fillOpacity: 1,
    })
      .bindTooltip(`${big ? '🚉' : st.kind === 'tram' ? '🚊' : '🚏'} ${esc(st.name ?? 'Stop')}`)
      .addTo(group);
  }
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
  const markers = useRef(new Map<string, { marker: L.Marker; ring: L.Circle | null; key: string; permanent: boolean }>());
  const bases = useRef<{ dark: L.Layer; light: L.Layer; streets: L.Layer; satellite: L.Layer; transitMap: L.Layer } | null>(null);
  const transitGroup = useRef<L.LayerGroup | null>(null);
  const transitAddedByLive = useRef(false);
  const [transitStatus, setTransitStatus] = useState<'off' | 'zoom' | 'loading' | 'ok' | 'error'>('off');
  const [live, setLive] = useState(false);
  const liveFollow = useRef(true);
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
    // OpenStreetMap has no aerial imagery, so satellite comes from Esri World Imagery (free, attribution required),
    // with Esri's place/road labels on top.
    const satellite = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: 'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        opacity: 0.9,
      }),
    ]);
    const transitMap = L.tileLayer('https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: 'Map © memomaps.de, data © OpenStreetMap contributors',
    });
    const rail = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.8,
      attribution: '© OpenRailwayMap',
    });
    // Transit lines & stops drawn from live OpenStreetMap data, between the tiles and the markers.
    m.createPane('transit').style.zIndex = '350';
    const transit = L.layerGroup();
    transit.getAttribution = () => 'Transit data © OpenStreetMap contributors';
    transitGroup.current = transit;
    const isLight = document.documentElement.dataset.theme === 'light' ||
      (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: light)').matches);
    (isLight ? light : dark).addTo(m);
    bases.current = { dark, light, streets, satellite, transitMap };
    L.control
      .layers(
        { Dark: dark, Light: light, Streets: streets, Satellite: satellite, 'Transit map': transitMap },
        { 'Transit lines & stops (OSM)': transit, 'Rail detail': rail },
        { position: 'topright' },
      )
      .addTo(m);
    // Dark/Light keep following the app theme; picking any other base map sticks.
    m.on('baselayerchange', (e: L.LayersControlEvent) => {
      autoBase.current = e.name === 'Dark' || e.name === 'Light';
    });
    const onOverlay = (e: L.LayersControlEvent) => {
      if (e.layer === transit) {
        transitAddedByLive.current = false;
        lastTransit.current = null;
        if (e.type === 'overlayremove') setTransitStatus('off');
        loadTransit();
      }
    };
    m.on('overlayadd', onOverlay);
    m.on('overlayremove', onOverlay);
    m.on('moveend', () => loadTransit());
    L.control.zoom({ position: 'topright' }).addTo(m);
    playersLayer.current = L.layerGroup().addTo(m);
    qLayer.current = L.layerGroup().addTo(m);
    zoneLayer.current = L.layerGroup().addTo(m);
    m.on('dragstart', () => {
      setFollow(false);
      liveFollow.current = false;
    });
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

  // ── transit overlay ──
  const lastTransit = useRef<{ box: BBox; busStops: boolean } | null>(null);
  const transitAbort = useRef<AbortController | null>(null);
  const loadTransitRef = useRef<() => void>(() => {});
  loadTransitRef.current = () => {
    const m = map.current;
    const group = transitGroup.current;
    if (!m || !group || !m.hasLayer(group)) return;
    const zoom = m.getZoom();
    if (zoom < 11) {
      group.clearLayers();
      lastTransit.current = null;
      setTransitStatus('zoom');
      return;
    }
    const bb = m.getBounds();
    const view = { south: bb.getSouth(), west: bb.getWest(), north: bb.getNorth(), east: bb.getEast() };
    const busStops = zoom >= 15;
    if (lastTransit.current && lastTransit.current.busStops === busStops && contains(lastTransit.current.box, view)) return;
    // Pad less when zoomed out so a city-wide view stays a reasonable download.
    const box = padBBox(view, zoom < 13 ? 0.15 : 0.5);
    transitAbort.current?.abort();
    const ctrl = new AbortController();
    transitAbort.current = ctrl;
    setTransitStatus('loading');
    fetchTransit(box, busStops, ctrl.signal)
      .then((data) => {
        if (ctrl.signal.aborted || !m.hasLayer(group)) return;
        drawTransit(group, data);
        lastTransit.current = { box, busStops };
        setTransitStatus('ok');
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setTransitStatus('error');
      });
  };
  // Stable wrapper for Leaflet event handlers registered once at init.
  const loadTransit = () => loadTransitRef.current();

  // Live view: satellite imagery + OSM transit overlay, auto-framing every visible player.
  useEffect(() => {
    try {
      setLive(localStorage.getItem(LIVE_KEY) === '1');
    } catch {}
  }, []);
  useEffect(() => {
    const m = map.current;
    const b = bases.current;
    const group = transitGroup.current;
    if (!m || !b || !group) return;
    try {
      localStorage.setItem(LIVE_KEY, live ? '1' : '0');
    } catch {}
    const setBase = (layer: L.Layer) => {
      for (const l of Object.values(b)) if (l !== layer && m.hasLayer(l)) m.removeLayer(l);
      if (!m.hasLayer(layer)) layer.addTo(m);
    };
    if (live) {
      autoBase.current = false;
      setBase(b.satellite);
      if (!m.hasLayer(group)) {
        group.addTo(m);
        transitAddedByLive.current = true;
      }
      liveFollow.current = true;
      loadTransitRef.current();
    } else if (m.hasLayer(b.satellite)) {
      autoBase.current = true;
      setBase(document.documentElement.dataset.theme === 'light' ||
        (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: light)').matches) ? b.light : b.dark);
      if (transitAddedByLive.current) {
        m.removeLayer(group);
        group.clearLayers();
        lastTransit.current = null;
        transitAddedByLive.current = false;
        setTransitStatus('off');
      }
    }
  }, [live]);

  // Player markers. Markers persist between GPS updates so CSS can glide them to the new spot.
  useEffect(() => {
    const layer = playersLayer.current;
    if (!layer || !map.current) return;
    const seen = new Set<string>();
    const place = (
      id: string,
      ll: L.LatLngTuple,
      icon: () => L.DivIcon,
      key: string,
      name: string,
      tip: string,
      accuracy: number | null,
      color: string,
      z = 0,
    ) => {
      seen.add(id);
      let entry = markers.current.get(id);
      if (!entry) {
        entry = { marker: L.marker(ll, { icon: icon(), zIndexOffset: z }).addTo(layer), ring: null, key, permanent: !live };
        markers.current.set(id, entry);
      } else {
        entry.marker.setLatLng(ll);
        if (entry.key !== key) {
          entry.marker.setIcon(icon());
          entry.key = key;
        }
      }
      // Live view pins carry permanent name labels; otherwise names show on hover/tap.
      if (entry.permanent !== live) {
        entry.marker.unbindTooltip();
        entry.marker.bindTooltip(
          live ? name : tip,
          live ? { permanent: true, direction: 'bottom', offset: [0, 16], className: 'pin-label' } : { direction: 'top', offset: [0, -16] },
        );
        entry.permanent = live;
      } else entry.marker.setTooltipContent(live ? name : tip);
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
        esc(p.name),
        `${esc(p.name)}${isTheHider ? ' (hider)' : ''} · ${ago(loc.updated_at)}`,
        loc.accuracy,
        p.color,
      );
    }
    if (position) {
      const mine = player(me);
      const ll: L.LatLngTuple = [position.coords.latitude, position.coords.longitude];
      place('__me', ll, () => pinIcon(mine?.avatar ?? '🙂', '#3d8bff', 'me'), mine?.avatar ?? '', 'You', 'You', position.coords.accuracy, '#3d8bff', 1000);
      if (!centred.current) {
        map.current.setView(ll, 14);
        centred.current = true;
      } else if (follow && !live) map.current.panTo(ll, { animate: true, duration: 1 });
    }
    // Live view keeps everyone in frame, re-framing only when someone leaves the screen.
    if (live && liveFollow.current) {
      const pts = [...markers.current.entries()].filter(([id]) => seen.has(id)).map(([, e]) => e.marker.getLatLng());
      if (pts.length) {
        const all = L.latLngBounds(pts);
        if (!map.current.getBounds().pad(-0.1).contains(all)) map.current.fitBounds(all.pad(0.25), { maxZoom: 17, animate: true });
      }
    }
    for (const [id, entry] of markers.current) {
      if (seen.has(id)) continue;
      entry.marker.remove();
      entry.ring?.remove();
      markers.current.delete(id);
    }
  }, [locations, position, player, me, game.hider_id, game.status, follow, live]);

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
    liveFollow.current = true;
    const pts: L.LatLngTuple[] = locations.map((l) => [l.lat, l.lng]);
    if (position) pts.push([position.coords.latitude, position.coords.longitude]);
    if (pts.length && map.current) map.current.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 16 });
  };

  const seekers = locations.filter((l) => l.user_id !== game.hider_id).length;
  return (
    <>
      <div ref={el} className="map" />
      <div className="map-legend">
        {live && (
          <div className="live-badge">
            <span className="live-dot" /> LIVE · {locations.length} on map
          </div>
        )}
        {transitStatus === 'zoom' && <div>🚇 Zoom in to see transit lines</div>}
        {transitStatus === 'loading' && <div>🚇 Loading transit from OpenStreetMap…</div>}
        {transitStatus === 'error' && <div>🚇 Transit data unavailable right now</div>}
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
        <button className={`btn small ${live ? 'primary' : ''}`} onClick={() => setLive((v) => !v)} aria-pressed={live}>
          🛰️ {live ? 'Live on' : 'Live view'}
        </button>
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
