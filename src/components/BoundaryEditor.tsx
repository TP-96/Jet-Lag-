'use client';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import type { Units } from '@/lib/game/config';
import { BOUNDARY_PRESETS, boundaryArea, circleBoundary, isValidBoundary, type Boundary } from '@/lib/game/geofence';

const vertexIcon = L.divIcon({ className: '', html: '<div class="vertex"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

export default function BoundaryEditor({
  initial,
  here,
  units,
  onSave,
  onClose,
}: {
  initial: Boundary | null;
  here: { lat: number; lng: number } | null;
  units: Units;
  onSave: (b: Boundary | null) => void;
  onClose: () => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [points, setPoints] = useState<[number, number][]>(initial?.points ?? []);
  const [name, setName] = useState(initial?.name ?? 'Custom area');
  const [drawing, setDrawing] = useState(!initial);
  const [radiusKm, setRadiusKm] = useState('3');
  const drawingRef = useRef(drawing);
  drawingRef.current = drawing;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView(here ? [here.lat, here.lng] : [43.6532, -79.3832], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'osm-tiles',
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (!drawingRef.current) return;
      setPoints((p) => [...p, [Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))]]);
    });
    map.current = m;
    if (initial && initial.points.length >= 3) m.fitBounds(L.latLngBounds(initial.points).pad(0.1));
    return () => {
      m.remove();
      map.current = null;
    };
    // Map is created once; later prop changes don't recreate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw polygon + draggable corners whenever the points change.
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    if (points.length >= 2) {
      L.polygon(points, { color: '#ffb800', weight: 3, fillOpacity: 0.12, interactive: false }).addTo(g);
    }
    points.forEach((p, i) => {
      const mk = L.marker(p, { icon: vertexIcon, draggable: true, title: 'Drag to move · double-tap to delete' }).addTo(g);
      mk.on('dragend', () => {
        const ll = mk.getLatLng();
        setPoints((ps) => ps.map((q, j) => (j === i ? [Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6))] : q)));
      });
      mk.on('dblclick', (e) => {
        L.DomEvent.stop(e);
        setPoints((ps) => ps.filter((_, j) => j !== i));
      });
    });
  }, [points]);

  const load = (b: Boundary) => {
    setPoints(b.points);
    setName(b.name);
    setDrawing(false);
    map.current?.fitBounds(L.latLngBounds(b.points).pad(0.1));
  };

  const draft: Boundary = { name: name.trim() || 'Custom area', points };
  const valid = isValidBoundary(draft);
  const area = valid ? boundaryArea(draft) : 0;
  const areaText = units === 'imperial' ? `${(area / 2.59e6).toFixed(1)} sq mi` : `${(area / 1e6).toFixed(1)} km²`;

  return (
    <div className="editor">
      <div className="editor-head">
        <div className="row spread">
          <h3>Play area</h3>
          <button className="btn small ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="preset-row">
          {BOUNDARY_PRESETS.map((p) => (
            <button key={p.id} className={`btn small ${name === p.boundary.name ? 'primary' : ''}`} title={p.description} onClick={() => load(p.boundary)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="row wrap small">
          <button
            className="btn small"
            disabled={!here}
            onClick={() => here && load(circleBoundary(here, Number(radiusKm) * (units === 'metric' ? 1000 : 1609.344), `${radiusKm} ${units === 'metric' ? 'km' : 'mi'} around start`))}
          >
            ⭕ Circle around me
          </button>
          <input className="input" style={{ width: 64, minHeight: 34, padding: '4px 8px' }} inputMode="decimal" value={radiusKm} onChange={(e) => setRadiusKm(e.target.value)} />
          {units === 'metric' ? 'km' : 'mi'}
          <button className={`btn small ${drawing ? 'primary' : ''}`} onClick={() => (setDrawing(true), setPoints([]), setName('Custom area'))}>
            Draw my own
          </button>
          {drawing && points.length > 0 && (
            <button className="btn small" onClick={() => setPoints((p) => p.slice(0, -1))}>
              ↩ Undo
            </button>
          )}
        </div>
        <div className="small muted">
          {drawing ? 'Tap the map to add corners. ' : ''}Drag a corner to adjust it, double-tap to delete it.
          {BOUNDARY_PRESETS.some((p) => p.boundary.name === name) && ' Presets are approximate (±500 m) — fine-tune if needed.'}
        </div>
      </div>
      <div ref={el} className="editor-map" />
      <div className="editor-foot">
        <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Area name" />
        <div className="row spread small">
          <span className="muted">
            {valid ? `${points.length} corners · ${areaText}` : `Add at least 3 corners (${points.length} so far)`}
          </span>
          <button className="btn small ghost" onClick={() => onSave(null)}>
            Remove play area
          </button>
        </div>
        <button className="btn primary block" disabled={!valid} onClick={() => onSave(draft)}>
          Save play area
        </button>
      </div>
    </div>
  );
}
