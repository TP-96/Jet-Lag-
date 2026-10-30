// Simple line icons for the tab bar, drawn on a 24px grid.
const PATHS: Record<string, string> = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  ask: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.6-11.6a2.6 2.6 0 1 1 3.7 2.4c-.7.3-1.1.9-1.1 1.6v.6M12 17h.01',
  cards: 'M7 3h10v18H7zM10 3v18M7 8h3m4 0h3M7 16h3m4 0h3',
  curse: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Zm-3 9.5h.01M15 12.5h.01M10 19v2m4-2v2',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0-1.2-5.8M18 20a5 5 0 0 0-3-4.6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8Zm8 9a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01',
  horn: 'M3 10v4h3l7 4V6L6 10H3Zm14-1a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11',
  send: 'M4 12 20 4l-4 16-4-6-8-2Zm8 2 8-10',
  pin: 'M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  share: 'M12 15V3m-4 4 4-4 4 4M6 11H5v10h14V11h-1',
  chevron: 'm9 6 6 6-6 6',
};

export default function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.map} />
    </svg>
  );
}
