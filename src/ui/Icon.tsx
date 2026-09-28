import type { SVGProps } from 'react';

// Schlichte Linien-Symbole (24er Raster, 1,75 px Strich), in currentColor.

const paths = {
  sliders: 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
  sort: 'M7 4v16M4 17l3 3 3-3M17 20V4M14 7l3-3 3 3',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  database: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6',
  shield: 'M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3zM9 12l2 2 4-4',
  alert: 'M12 4l9 16H3l9-16zM12 10v4M12 17.5v.01',
  cards: 'M4 7h12v13H4zM8 4h12v13',
  book: 'M4 5c2.5-1 5-1 8 1 3-2 5.5-2 8-1v14c-2.5-1-5-1-8 1-3-2-5.5-2-8-1V5zM12 6v14',
  grammar: 'M5 19L10 5h1l5 14M7 14h7M17 9h3M18.5 7.5v3',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  speaker: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11',
  info: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5.5M12 7.8v.01',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z',
  bookmarkPlus: 'M6 4h12v16l-6-4-6 4zM12 7.5v5M9.5 10h5',
  lightbulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4',
  play: 'M8 5.5v13l10.5-6.5z',
  eyeOff: 'M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.8 9.8 0 0112 5c5 0 8.5 4.5 9.5 7a13 13 0 01-2.6 3.8M6.5 6.6C4.4 8 3 10 2.5 12c1 2.5 4.5 7 9.5 7a9.6 9.6 0 004.3-1',
  flag: 'M5 21V4h11l-1.5 4L16 12H5',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  headphones: 'M4 14v-2a8 8 0 0116 0v2M4 14h3v6H4zM17 14h3v6h-3z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3',
  // Phase 3 – Sprechen und Business
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  stop: 'M7 7h10v10H7z',
  chat: 'M5 5h14v10H10l-4 4v-4H5z',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12.01V12',
  // UX-Beratung 27.09.: Reiter mit Symbol (Heute · Üben · Sprechen · Stand) und Zahnrad
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4',
  layers: 'M12 3l9 5-9 5-9-5zM3 12.5l9 5 9-5M3 16.5l9 5 9-5',
  chart: 'M4 20h16M6 16v-5M10 16V7M14 16v-8M18 16V4',
  history: 'M4 12a8 8 0 102.3-5.7M4 5v4h4M12 8v4l3 2',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 13.5a7.6 7.6 0 000-3l2-1.6-2-3.4-2.4 1a7.5 7.5 0 00-2.6-1.5L14 2.5h-4l-.4 2.5A7.5 7.5 0 007 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 000 3l-2 1.6 2 3.4 2.4-1a7.5 7.5 0 002.6 1.5l.4 2.5h4l.4-2.5a7.5 7.5 0 002.6-1.5l2.4 1 2-3.4z',
  // Übersetzen (Lucide „languages“, vereinfacht)
  translate: 'M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6',
  // Rahmen (WP0b, Prototyp v1): Profil, Chevrons für Zeilen und „‹ Herkunft“
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  chevronRight: 'M9 6l6 6-6 6',
  chevronLeft: 'M15 6l-6 6 6 6',
} as const;

export type IconName = keyof typeof paths;

type Props = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 20, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
