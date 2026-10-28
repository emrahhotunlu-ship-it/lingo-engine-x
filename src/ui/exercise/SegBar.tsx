import { useEffect, useState } from 'react';
import { useT } from '../../i18n';

// Balken mit Abschnitten (Relaunch Stufe 1 P3, stufe1-plan §6.4, Vorschau `progBar`): ein Abschnitt je Block des Tages,
// erledigte Blöcke voll, der laufende Block füllt sich mit den Aufgaben der Runde. Füllung immer in Iris (`--act`, Nora 1),
// nie in der Bereichsfarbe. Ohne Blöcke (freie Runde) ist es EIN Abschnitt – derselbe Balken wie vorher.
// Blockwechsel (Vorschau H3): Beginnt eine Runde in einem späteren Block als die letzte, „springt“ der Balken in den
// nächsten Abschnitt – der neue Abschnitt leuchtet 300 ms kurz auf (`data-pulse`; bei reduzierter Bewegung nicht).
// Rollen und Kennungen wie im alten Balken (`role="progressbar"`, `aria-valuemax`, Text „n von total“).

/** Zuletzt gezeigter Abschnitt (über Runden hinweg; Modulzustand, weil jede Runde den Balken neu einhängt). */
let lastSeg: number | null = null;

export type SegBarProps = {
  progress: { n: number; total: number; extra?: number };
  /** Blöcke des Tages; `current` 0-basiert. `null` = ein Abschnitt. */
  segments?: { count: number; current: number } | null;
  label?: string | undefined;
  testId?: string | undefined;
};

export function SegBar({ progress, segments = null, label, testId = 'round-progress' }: SegBarProps) {
  const { t } = useT();
  const total = Math.max(1, progress.total);
  const n = Math.max(1, Math.min(total, progress.n));
  const count = segments && segments.count >= 2 ? segments.count : 1;
  const cur = count > 1 && segments ? Math.max(0, Math.min(count - 1, segments.current)) : 0;
  // Jede Runde hängt den Balken neu ein: ob er aufleuchtet, steht beim Einhängen fest (Vergleich mit dem letzten Abschnitt).
  const [pulse, setPulse] = useState(() => count > 1 && lastSeg !== null && cur > lastSeg);
  useEffect(() => {
    lastSeg = count > 1 ? cur : null;
  }, [count, cur]);
  useEffect(() => {
    if (!pulse) return;
    const id = window.setTimeout(() => setPulse(false), 320);
    return () => window.clearTimeout(id);
  }, [pulse]);
  const frac = Math.round((n / total) * 100);
  return (
    <div className="flex items-center gap-3" data-testid="seg-bar" data-segs={count} data-cur={cur}>
      <div
        className="lx-segs"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={n}
        aria-label={label ?? (count > 1 ? t('bandBar', { n: cur + 1, total: count }) : undefined)}
      >
        {Array.from({ length: count }, (_, i) => (
          <i key={i} data-done={i < cur ? '' : undefined} data-cur={i === cur ? '' : undefined} data-pulse={i === cur && pulse ? '' : undefined}>
            {i === cur && <b style={{ width: `${frac}%` }} />}
          </i>
        ))}
      </div>
      <span className="lx-tnum flex-none text-xs text-muted" data-testid={testId}>
        {t('nvProgress', { n, total: progress.total })}
      </span>
      {!!progress.extra && (
        <span className="sr-only" data-testid="round-extra" data-n={progress.extra}>
          +{progress.extra}
        </span>
      )}
    </div>
  );
}
