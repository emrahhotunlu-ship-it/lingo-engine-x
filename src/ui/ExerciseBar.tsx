import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { IconButton } from './Button';
import { DURATION, EASE_OUT } from './motion';

// Eine Leiste für alle Vollbild-Übungen (UX-Beratung Nr. 4): links ✕, in der Mitte ein dünner
// Fortschrittsbalken mit „3 / 8", rechts das Claude-Symbol (`end`). „Pflicht" bzw. „Extra" steht
// als kleines graues Wort unter dem Balken, nie als Pille (visuelle Regel 8).

type Props = {
  onClose: () => void;
  closeLabel: string;
  closeTestId?: string;
  /** Fortschritt; `null` = kein Balken (z. B. Zusammenfassung, freie Einheiten). */
  progress?: { n: number; total: number; extra?: number } | null;
  /** Beschriftung für Vorleseprogramme, z. B. „Karte 3 von 8". */
  progressLabel?: string;
  progressTestId?: string;
  /** Kleines Wort unter dem Balken („Pflicht · 2 von 3", „Extra"). */
  note?: ReactNode;
  /** Rechts: Claude-Symbol (und ggf. weitere Symbole). */
  end?: ReactNode;
  /**
   * Ersetzt vorübergehend nur den Fortschrittsbalken samt Wort (z. B. Anki „Rückgängig", B4),
   * nie ✕ und nie `end` – sonst sind Übersetzer, Claude und Einstellungen kurz nicht erreichbar
   * (Emrahs Vorgabe „überall", 27.09., Befund 28.09.: der Streifen hat genau das verdeckt).
   */
  middleOverlay?: ReactNode;
};

export function ExerciseBar({ onClose, closeLabel, closeTestId = 'round-close', progress = null, progressLabel, progressTestId = 'round-progress', note, end, middleOverlay = null }: Props) {
  const has = !!progress && progress.total > 0;
  const n = has ? Math.max(1, Math.min(progress.total, progress.n)) : 0;
  const pct = has ? Math.round((n / progress.total) * 100) : 0;
  return (
    <div className="flex min-h-12 items-center gap-2 sm:gap-3" data-testid="exercise-bar">
      <IconButton icon="close" label={closeLabel} onClick={onClose} data-testid={closeTestId} className="-ml-2 flex-none" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {middleOverlay ? (
          middleOverlay
        ) : has ? (
          <div className="flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-valuenow={n}
              aria-label={progressLabel}
            >
              <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: DURATION.base, ease: EASE_OUT }} />
            </div>
            <span className="lx-tnum flex-none text-xs text-muted" data-testid={progressTestId}>
              {n} / {progress.total}
            </span>
            {!!progress.extra && (
              <span className="lx-tnum -ml-2 flex-none text-xs text-subtle" data-testid="round-extra" aria-label={`+${progress.extra}`}>
                +{progress.extra}
              </span>
            )}
          </div>
        ) : (
          <div className="h-1.5" aria-hidden="true" />
        )}
        {note && <div className="text-2xs leading-none text-subtle">{note}</div>}
      </div>
      <div className="flex min-w-11 flex-none items-center justify-end">{end}</div>
    </div>
  );
}
