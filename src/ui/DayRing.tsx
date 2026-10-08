import { useEffect, useId, useState, type ReactNode } from 'react';
import { useFxLevel } from '../engine/fx/level';

// Tagesring (Lernplattform 3.0 P55, Erlebnis-Engine M7): ein Bogen je Pflichtschritt (meist 4), sichtbare Lücke 8°, Spur `--lx-track`,
// Füllung `--lx-ok` mit Verlauf entlang des Bogens nach `--lx-ok-text`, runde Kappe mit kleinem Schatten. Teilfüllung je Schritt = erledigter Anteil
// aus derselben Quelle wie „x von 4“ (`duties.items`, Kap. 2 Nr. 2). Im Tagesmoment füllt sich der letzte Bogen, dann schließen sich die Lücken:
// aus vier Teilen wird ein Ring. Stufe „Aus“ zeigt sofort den Endzustand. SVG mit `pathLength=360` (Längen in Grad), Übergänge per CSS.

/** Sichtbare Lücke zwischen zwei Bogen (Grad). */
export const ARC_GAP_DEG = 8;

export type Arc = { start: number; len: number };

/**
 * Lage der Bogen in Grad (0° = oben, im Uhrzeigersinn). Die runde Kappe ragt je Seite um `stroke/2` über den Bogen hinaus; damit die Lücke
 * sichtbar 8° bleibt, wird diese Überlänge in der Geometrie abgezogen. `closed` = Lücken geschlossen (ein Ring). Rein, für Tests.
 */
export function ringArcs(n: number, size: number, stroke: number, closed = false): Arc[] {
  const k = Math.max(1, Math.floor(n));
  const r = (size - stroke) / 2;
  const capDeg = (stroke / r) * (180 / Math.PI);
  const gap = k > 1 && !closed ? ARC_GAP_DEG + capDeg : 0;
  const step = 360 / k;
  const len = Math.max(0.5, step - gap);
  return Array.from({ length: k }, (_, i) => ({ start: i * step + gap / 2, len }));
}

/** Füllanteile je Pflichtschritt aus dem Pflichtzustand: erledigt = 1, offen mit Fortschritt = Anteil (unter 1), sonst 0. */
export function dutyFills(items: ReadonlyArray<{ state: 'done' | 'open'; progress: { done: number; total: number } | null }>): number[] {
  return items.map((d) => {
    if (d.state === 'done') return 1;
    const p = d.progress;
    if (!p || p.total <= 0 || p.done <= 0) return 0;
    // Offen bleibt sichtbar offen: höchstens 95 %, damit „fast fertig“ nie wie „erledigt“ aussieht.
    return Math.min(0.95, p.done / p.total);
  });
}

type Props = {
  /** Füllung je Bogen, 0–1. */
  fills: readonly number[];
  size?: number;
  stroke?: number;
  label: string;
  /** Endzustand „ein Ring“ (Tag geschafft). */
  closed?: boolean;
  /** Tagesmoment: letzter Bogen füllt sich (120–580 ms), dann schließen sich die Lücken (580–900 ms). Nur beim Übergang offen → fertig. */
  play?: boolean;
  children?: ReactNode;
};

/** Punkt auf dem Kreis im gedrehten Koordinatensystem der Bogen (0° = Pfadanfang). */
const pt = (c: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [c + r * Math.cos(a), c + r * Math.sin(a)];
};

export function DayRing({ fills, size = 56, stroke = 7, label, closed = false, play = false, children }: Props) {
  const level = useFxLevel();
  const uid = useId().replace(/:/g, '');
  const n = Math.max(1, fills.length);
  const animate = play && level !== 'off';
  // Phasen des Moments: 0 = Ausgang (letzter Bogen leer, Lücken offen) · 1 = gefüllt · 2 = geschlossen.
  const [phase, setPhase] = useState<0 | 1 | 2>(animate ? 0 : 2);
  useEffect(() => {
    if (!animate) return;
    const a = setTimeout(() => setPhase(1), 120);
    const b = setTimeout(() => setPhase(2), 580);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [animate]);
  const isClosed = closed && (!animate || phase === 2);
  const shown = fills.map((f, i) => (animate && phase === 0 && i === n - 1 ? 0 : Math.max(0, Math.min(1, f))));
  const arcs = ringArcs(n, size, stroke, isClosed);
  const c = size / 2;
  const r = (size - stroke) / 2;
  const filled = fills.filter((f) => f >= 1).length;
  return (
    <span
      className="lx-dayring relative inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
      data-testid="today-ring"
      data-segments={n}
      data-filled={filled}
      data-fills={fills.map((f) => Math.round(f * 100) / 100).join(',')}
      data-closed={isClosed ? 'true' : 'false'}
      data-play={animate ? '' : undefined}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        {isClosed ? (
          // Geschlossen (UX-Prüfung W1): EIN Kreis mit EINEM Verlauf, ohne runde Enden – keine Knubbel oder Nähte an den früheren Bogengrenzen.
          <>
            <defs>
              <linearGradient id={`${uid}w`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={size} y2={size}>
                <stop offset="0" stopColor="var(--lx-ok)" />
                <stop offset="1" stopColor="var(--lx-ok-text)" />
              </linearGradient>
            </defs>
            <circle className="lx-dayring-whole" data-testid="today-ring-whole" cx={c} cy={c} r={r} fill="none" stroke={`url(#${uid}w)`} strokeWidth={stroke} />
          </>
        ) : (
          <>
            <defs>
              {arcs.map((a, i) => {
                const [x1, y1] = pt(c, r, a.start);
                const [x2, y2] = pt(c, r, a.start + a.len);
                return (
                  <linearGradient key={i} id={`${uid}g${i}`} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2}>
                    <stop offset="0" stopColor="var(--lx-ok)" />
                    <stop offset="1" stopColor="var(--lx-ok-text)" />
                  </linearGradient>
                );
              })}
            </defs>
            <g transform={`rotate(-90 ${c} ${c})`}>
              {arcs.map((a, i) => (
                <circle
                  key={`t${i}`}
                  className="lx-dayring-arc"
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke="var(--lx-track)"
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  pathLength={360}
                  strokeDasharray={`${a.len} ${360 - a.len}`}
                  strokeDashoffset={-a.start}
                />
              ))}
              {arcs.map((a, i) => {
                const f = shown[i] ?? 0;
                const len = a.len * f;
                return (
                  <circle
                    key={`f${i}`}
                    className="lx-dayring-arc lx-dayring-fill"
                    data-fill={f >= 1 ? 'full' : f > 0 ? 'part' : 'none'}
                    cx={c}
                    cy={c}
                    r={r}
                    fill="none"
                    stroke={`url(#${uid}g${i})`}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                    pathLength={360}
                    strokeDasharray={`${len} ${360 - len}`}
                    strokeDashoffset={-a.start}
                    opacity={f > 0 ? 1 : 0}
                  />
                );
              })}
            </g>
          </>
        )}
      </svg>
      {children !== undefined && (
        <span className="lx-tnum absolute inset-0 flex items-center justify-center text-center text-xs leading-none font-semibold" aria-hidden="true">
          {children}
        </span>
      )}
    </span>
  );
}
