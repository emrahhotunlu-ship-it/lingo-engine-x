import { useEffect, useRef, useState } from 'react';
import { numberRolls } from '../domain/moments/detect';
import { effectiveLevel } from '../engine/fx/level';
import { playFx } from '../platform/sound';
import { session } from '../platform/storage';

// Zahlen-Rollen (Lernplattform 3.0 P55, Erlebnis-Engine M6): jede Ziffer ist eine Spalte 0–9, die per CSS-Übergang (`translateY(-n·1em)`) auf ihren Wert rollt.
// Tabellenziffern, Tausenderpunkt und Text stehen fest. Vorgelesen wird nur der Endwert (`aria-label`), die Spalten sind `aria-hidden`.
// Gerollt wird nur, wenn sich der Wert seit dem letzten Anzeigen geändert hat (`sessionStorage lx:odo:<id>`), und nie bei Stufe „Aus“:
// dann steht sofort der Endwert da, ohne „0“ als Zwischenbild. Die Zahl selbst kommt immer aus dem Selektor des Aufrufers (eine Quelle je Zahl).

export type OdoCol = { kind: 'digit'; from: number; to: number; lead: boolean } | { kind: 'char'; ch: string };

/** Spalten von `prev` nach `next`. Ziffern werden rechtsbündig gepaart; Spalten, die es vorher nicht gab, blenden ein (`lead`). Rein. */
export function odometerCols(prev: string | null, next: string): OdoCol[] {
  const nd = next.replace(/\D/g, '');
  const pd = (prev ?? '').replace(/\D/g, '');
  const startDigits = prev === null ? '' : pd;
  const out: OdoCol[] = [];
  let di = 0;
  for (const ch of next) {
    if (!/\d/.test(ch)) {
      out.push({ kind: 'char', ch });
      continue;
    }
    const fromIdx = di - (nd.length - startDigits.length);
    const known = fromIdx >= 0 && fromIdx < startDigits.length;
    out.push({ kind: 'digit', from: known ? Number(startDigits[fromIdx]) : 0, to: Number(ch), lead: !known });
    di += 1;
  }
  return out;
}

/** Wie viele Spalten sich bewegen (für die Ton-Ticks, höchstens 12). */
export const movingCols = (cols: readonly OdoCol[]): number => cols.filter((c) => c.kind === 'digit' && (c.from !== c.to || c.lead)).length;

const odoKey = (id: string): string => `lx:odo:${id}`;

type Props = {
  text: string;
  /** Merk-Kennung je Anzeigeort (z. B. `day-hero`); ohne rollt die Zahl bei jedem Erscheinen. */
  id?: string;
  /** Darf überhaupt gerollt werden (z. B. nur im Moment)? */
  play?: boolean;
  /** Start nach dem Erscheinen (ms), passend zur Choreografie des Moments. */
  delay?: number;
  className?: string;
  /** Fester Startwert statt des gemerkten (Vorschau „Momente ansehen“). */
  from?: string;
};

export function Odometer({ text, id, play = true, delay = 150, className, from }: Props) {
  const [initial] = useState(() => {
    const last = from ?? (id ? session.get(odoKey(id)) : null);
    const roll = play && effectiveLevel() !== 'off' && numberRolls(last, text) && /\d/.test(text);
    return { roll, from: roll ? (last ?? null) : text };
  });
  const [cols] = useState<OdoCol[]>(() => odometerCols(initial.from, text));
  // pre → rolling → still (danach steht wieder der reine Text da, Tests und Kopieren lesen ihn unverändert).
  const [phase, setPhase] = useState<'pre' | 'rolling' | 'still'>(initial.roll ? 'pre' : 'still');
  const started = useRef(false);

  useEffect(() => {
    if (id) session.set(odoKey(id), text);
  }, [id, text]);

  useEffect(() => {
    if (started.current) {
      // Der Wert ändert sich während der Anzeige: direkt auf den neuen Stand (Bedienung, kein Rollen).
      setPhase('still');
      return;
    }
    started.current = true;
    if (!initial.roll) return;
    const ticks = Math.min(12, movingCols(cols));
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(
      setTimeout(() => {
        setPhase('rolling');
        for (let i = 0; i < ticks; i++) timers.push(setTimeout(() => playFx('tick'), 40 + i * 55));
        timers.push(setTimeout(() => setPhase('still'), ROLL_MS + cols.length * 40));
      }, delay),
    );
    return () => timers.forEach(clearTimeout);
    // Nur beim Erscheinen bzw. wenn sich der Endwert ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (phase === 'still') {
    return (
      <span className={`lx-odo lx-tnum ${className ?? ''}`} data-testid="odometer" data-phase="still" data-value={text}>
        {text}
      </span>
    );
  }
  const rolled = phase === 'rolling';
  return (
    <span className={`lx-odo lx-tnum ${className ?? ''}`} role="img" aria-label={text} data-testid="odometer" data-phase={phase} data-value={text}>
      {cols.map((c, i) =>
        c.kind === 'char' ? (
          <span key={i} className="lx-odo-ch" aria-hidden="true">
            {c.ch}
          </span>
        ) : (
          <span key={i} className="lx-odo-col" aria-hidden="true" data-lead={c.lead && !rolled ? '' : undefined}>
            <span className="lx-odo-stack" style={{ transform: `translateY(${-(rolled ? c.to : c.from)}em)`, transitionDelay: `${i * 40}ms` }}>
              {DIGITS}
            </span>
          </span>
        ),
      )}
    </span>
  );
}

/** Dauer des Rollens (CSS `.lx-odo-stack`), danach steht der reine Text. */
export const ROLL_MS = 700;

const DIGITS = Array.from({ length: 10 }, (_, d) => (
  <span key={d} className="lx-odo-d">
    {d}
  </span>
));
