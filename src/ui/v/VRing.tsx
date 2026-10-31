import type { ReactNode } from 'react';

// D1 V-BAU: Segmentring des Tages (`.ring`, Vorschau style.css:174–182; Geometrie app.js:116–138; Zeichnen style.css:539–540).
// Ein Segment je Block, Bogenlänge nach Minuten, 8° Abstand, Radius 86 in 200er Box, Strich 11, runde Enden.
// Erledigte Blöcke voll, der laufende anteilig (`partial` 0…1). Der Ring zeigt den Plan, er ändert ihn nie (stufe1c-plan.md §5).
// Mit `onActivate` ist der Ring ein Knopf (Antippen zeigt die Blockliste); sonst ein Bild mit Beschreibung.

export type VRingBlock = { minutes: number };

type Props = {
  blocks: readonly VRingBlock[];
  /** Zahl der erledigten Blöcke (von vorn). */
  done: number;
  /** Anteil des laufenden Blocks (Index `done`), 0…1. */
  partial?: number;
  /** Beim ersten Erscheinen zeichnen (nur einmal je Laden, Vorschau `S.drawOnce`). */
  draw?: boolean;
  /** Beschriftung für Screenreader (Knopf: was Antippen tut; Bild: was der Ring zeigt). */
  label: string;
  onActivate?: () => void;
  /** Ist die Blockliste offen (nur mit `onActivate`)? */
  expanded?: boolean;
  /** Mitte des Rings (z. B. Minuten heute). */
  children?: ReactNode;
  'data-testid'?: string;
};

const CX = 100;
const CY = 100;
const R = 86;
const GAP = 8;

const pt = (deg: number): [number, number] => [CX + R * Math.cos((deg * Math.PI) / 180), CY + R * Math.sin((deg * Math.PI) / 180)];

/** Pfade der Segmente (rein, für Tests exportiert). */
export function ringSegments(blocks: readonly VRingBlock[]): string[] {
  const total = blocks.reduce((a, b) => a + Math.max(0, b.minutes), 0);
  if (total <= 0 || blocks.length === 0) return [];
  let a = -90;
  return blocks.map((b) => {
    const span = (Math.max(0, b.minutes) / total) * 360;
    // Ein einziger Block: fast voller Kreis (ein Bogen kann nicht 360° haben).
    const a0 = a + GAP / 2;
    const a1 = a + Math.min(span, 359.99) - GAP / 2;
    a += span;
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(Math.max(a1, a0 + 0.01));
    const large = a1 - a0 > 180 ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  });
}

export function VRing({ blocks, done, partial = 0, draw, label, onActivate, expanded, children, ...rest }: Props) {
  const segs = ringSegments(blocks);
  const frac = Math.min(1, Math.max(0, partial));
  const svg = (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      {segs.map((d, i) => (
        <g key={i}>
          <path className="lx-v-ring-seg lx-v-ring-trk" d={d} />
          {i < done && <path className="lx-v-ring-seg lx-v-ring-on" pathLength={100} style={{ ['--d' as string]: `${i * 90}ms` }} d={d} />}
          {i === done && frac > 0 && (
            <path className="lx-v-ring-seg lx-v-ring-on" data-part="" pathLength={100} strokeDasharray={`${(frac * 100).toFixed(1)} 100`} d={d} />
          )}
        </g>
      ))}
    </svg>
  );
  const common = { 'data-draw': draw ? '' : undefined, 'data-done': done, 'data-blocks': blocks.length, 'data-testid': rest['data-testid'] };
  return (
    <div className="lx-v-ringwrap">
      {onActivate ? (
        <button type="button" className="lx-v-ring" aria-label={label} aria-expanded={expanded ?? false} onClick={onActivate} {...common}>
          {svg}
        </button>
      ) : (
        <div className="lx-v-ring" role="img" aria-label={label} {...common}>
          {svg}
        </div>
      )}
      {children != null && <div className="lx-v-ringc">{children}</div>}
    </div>
  );
}
