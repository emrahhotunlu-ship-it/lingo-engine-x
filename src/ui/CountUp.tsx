import { useEffect, useRef, useState } from 'react';
import { effectiveLevel } from '../engine/fx/level';

// Ziffern zählen hoch (Design-Lead 07.10.2026, Erlebnis-Engine M6/M7): Stufe „Voll“ zählt die erste Zahl im Text von 0 bis zum Endwert hoch,
// mit Feder-Ende (leichtes Überschwingen, dann ruhig); „Ruhig“ zeigt den Endwert mit kurzem Aufsteigen (CSS `dz-count-calm`);
// „Aus“ zeigt sofort den Endwert. Vorleseprogramme hören nur den Endwert: während des Zählens steht er unsichtbar daneben, die zählende
// Zahl ist `aria-hidden`; danach steht wieder nur der reine Text (gleicher Text wie ohne Effekt, Tests lesen ihn unverändert).

/** Erste ganze Zahl im Text (Tausenderpunkt/-komma erlaubt): Teile davor, Zahl, danach. */
export function splitNumber(text: string): { pre: string; n: number; post: string; sep: '.' | ',' | null } | null {
  const m = /^(\D*?)(\d{1,3}(?:([.,])\d{3})+|\d+)(.*)$/s.exec(text);
  if (!m || m[2] === undefined) return null;
  const sep = (m[3] as '.' | ',' | undefined) ?? null;
  const n = Number(sep ? m[2].split(sep).join('') : m[2]);
  if (!Number.isFinite(n)) return null;
  return { pre: m[1] ?? '', n, post: m[4] ?? '', sep };
}

const group = (n: number, sep: '.' | ',' | null): string => (sep ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep) : String(n));

/** Feder-Ende: schnell hoch, kurz drüber, zurück (easeOutBack, gedämpft). */
export const easeSpring = (t: number): number => {
  const c = 1.2;
  const x = t - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

export function CountUp({ text, ms = 900, delay = 0, play = true }: { text: string; ms?: number; delay?: number; play?: boolean }) {
  const parts = splitNumber(text);
  // Ab dem ersten Bild bei 0 (kein Aufblitzen des Endwerts), nur wenn wirklich gezählt wird.
  const [shown, setShown] = useState<string | null>(() => (play && parts && parts.n > 0 && effectiveLevel() === 'full' ? `${parts.pre}${group(0, parts.sep)}${parts.post}` : null));
  const [calm] = useState(() => !!(play && parts && parts.n > 0 && effectiveLevel() === 'calm'));
  const raf = useRef(0);
  useEffect(() => {
    if (!play || !parts || parts.n <= 0) return;
    const level = effectiveLevel();
    if (level !== 'full') return;
    let start = 0;
    const tick = (now: number): void => {
      if (!start) start = now + delay;
      const t = Math.min(1, Math.max(0, (now - start) / ms));
      const v = Math.max(0, Math.round(parts.n * easeSpring(t)));
      setShown(`${parts.pre}${group(v, parts.sep)}${parts.post}`);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else setShown(null);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // Nur beim ersten Erscheinen bzw. wenn sich der Endwert ändert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, play]);
  if (shown === null) return calm ? <span className="dz-count-calm">{text}</span> : <>{text}</>;
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" data-counting="">
        {shown}
      </span>
    </>
  );
}
