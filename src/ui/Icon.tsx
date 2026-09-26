import type { SVGProps } from 'react';

// Schlichte Linien-Symbole (24er Raster, 1,75 px Strich), in currentColor.

const paths = {
  sliders: 'M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1M15 5v4M9 10v4M17 15v4',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  chevronDown: 'M6 9l6 6 6-6',
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
  // Phase 3 – Sprechen und Business
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  mic: 'M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zM5.5 11a6.5 6.5 0 0013 0M12 17.5V21M9 21h6',
  send: 'M4 12l16-8-6 16-3-7-7-1z',
  stop: 'M7 7h10v10H7z',
  chat: 'M5 5h14v10H10l-4 4v-4H5z',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  arrowDown: 'M12 5v14M6 13l6 6 6-6',
  target: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12.01V12',
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
