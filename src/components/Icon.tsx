// Simple line icons for the tab bar, drawn on a 24px grid.
const PATHS: Record<string, string> = {
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14',
  chat: 'M4 5h16v11H9l-5 4V5Z',
  ask: 'M9.2 9a3 3 0 1 1 4.3 2.7c-.9.4-1.5 1.2-1.5 2.2V15M12 18.5v.5',
  cards: 'M7 3h10v18H7zM10 3v18M7 8h3m4 0h3M7 16h3m4 0h3',
  curse: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Zm-3 9.5h.01M15 12.5h.01M10 19v2m4-2v2',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0-1.2-5.8M18 20a5 5 0 0 0-3-4.6',
};

export default function Icon({ name }: { name: keyof typeof PATHS | string }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.map} />
    </svg>
  );
}
