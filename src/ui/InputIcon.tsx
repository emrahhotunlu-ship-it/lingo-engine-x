import type { SVGProps } from 'react';

// Zusätzliche Linien-Symbole für Lesen, Hören, Schreiben und Entdecken (Phase 4), im selben
// Stil wie Icon.tsx (24er Raster, 1,75 px Strich, currentColor). Eigene Datei, damit parallele
// Phasen Icon.tsx ohne Konflikt erweitern können.

const paths = {
  play: 'M8 5.5v13l10.5-6.5z',
  stop: 'M7 7h10v10H7z',
  rewind: 'M11 7l-6 5 6 5zM19 7l-6 5 6 5z',
  headphones: 'M4 15v-3a8 8 0 0116 0v3M4 15a2 2 0 012-2h1v7H6a2 2 0 01-2-2zM20 15a2 2 0 00-2-2h-1v7h1a2 2 0 002-2z',
  video: 'M4 7h11v10H4zM15 10.5l5-3v9l-5-3z',
  pen: 'M4 20l4.5-1 10-10a2.1 2.1 0 00-3-3l-10 10zM14 7l3 3',
  compass: 'M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z',
  article: 'M6 4h12v16H6zM9 8h6M9 12h6M9 16h4',
  mic: 'M12 4a2.5 2.5 0 012.5 2.5v5a2.5 2.5 0 01-5 0v-5A2.5 2.5 0 0112 4zM7 11.5a5 5 0 0010 0M12 16.5V20',
  history: 'M4 12a8 8 0 102.3-5.7M4 5v4h4M12 8v4l3 2',
} as const;

export type InputIconName = keyof typeof paths;

export function InputIcon({ name, size = 20, ...rest }: SVGProps<SVGSVGElement> & { name: InputIconName; size?: number }) {
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
