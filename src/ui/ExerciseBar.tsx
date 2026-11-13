import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { useSplitLayout } from '../platform/input';
import { IconButton } from './Button';
import { DURATION, EASE_OUT } from './motion';

// Eine Leiste für alle Vollbild-Übungen (UX-Beratung Nr. 4; Politur P1, 13.11.2026: wirklich EINE).
// Aufbau immer gleich: Zeile ✕ · Titel (mit Zähler) · `end` (Übersetzer ab 768 px, Claude-Symbol, Menü „…“), darunter der Balken
// über die ganze Breite. Vorher gab es drei Köpfe: diesen mit Titel („Wörter · 12 von 38 erledigt“), einen ohne Titel (✕ · Balken ·
// kleines Wort darunter) und eigene Köpfe einzelner Übungen. Ohne `title` steht jetzt das kleine Wort (`note`: „Pflicht“, „Extra“,
// „Tageseinheit · Block 2 von 5“) an der Titelstelle. Titel werden nie abgeschnitten (sie brechen um, `kern.css`).
// Neue Übungen bauen keinen eigenen Kopf: `ExerciseTop` (`features/learn/ui.tsx`) mit `title`/`area`, oder diese Leiste direkt mit
// `end={<ExerciseActions onPause={…} />}` (`features/system/Chrome.tsx`).

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
  /**
   * Eine Zählzeile „Pflicht 2/4 · Karte 7/30 +2“ (Lernplattform 2.0 §4.5). Sie ersetzt „n / total“ und das kleine
   * Wort darunter; der Balken folgt `card`. Für Vorleseprogramme heißt „+2“ „2 Wiederholungen in dieser Runde“.
   */
  counter?: {
    duty?: [n: number, total: number];
    card: [n: number, total: number];
    extra?: number;
  };
  /**
   * Kern (Emrah 03.11.2026, Vorschau `9pdpfT8Es8nrdE3vnVeqqx`): Titelzeile „Wörter · 12 von 38 erledigt“. Mit Titel steht oben
   * ✕ · Titel · `end` und darunter der Balken über die ganze Breite; das kleine Wort (`note`) bleibt nur für Vorleseprogramme.
   */
  title?: ReactNode;
};

export function ExerciseBar({
  onClose,
  closeLabel,
  closeTestId = 'round-close',
  progress: progressProp = null,
  progressLabel,
  progressTestId = 'round-progress',
  note,
  end,
  middleOverlay = null,
  counter,
  title,
}: Props) {
  const { t } = useT();
  const split = useSplitLayout();
  const progress = counter ? { n: counter.card[0], total: counter.card[1], extra: counter.extra } : progressProp;
  const has = !!progress && progress.total > 0;
  const n = has ? Math.max(1, Math.min(progress.total, progress.n)) : 0;
  const pct = has ? Math.round((n / progress.total) * 100) : 0;
  const barNode = middleOverlay ? (
    middleOverlay
  ) : has ? (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={n} aria-label={progressLabel}>
        <motion.div className="h-full rounded-full bg-accent" initial={false} animate={{ width: `${pct}%` }} transition={{ duration: DURATION.base, ease: EASE_OUT }} />
      </div>
      {counter ? (
        <span className="lx-tnum lx-t-meta flex-none text-muted" data-testid={progressTestId} data-counter="">
          {/* Höchstens ein sichtbarer Zähler (UX-Audit U1): der Pflichtschritt steht nur für Vorleseprogramme da. */}
          {counter.duty && (
            <span className="sr-only" data-testid="counter-duty">
              {t('exCounterDuty', {
                n: counter.duty[0],
                total: counter.duty[1],
              })}{' '}
              ·{' '}
            </span>
          )}
          <span data-testid="counter-card">{t('exCounterCard', { n, total: progress.total })}</span>
          {!!counter.extra && (
            <span className="sr-only" data-testid="round-extra" aria-label={t('exCounterExtraLabel', { n: counter.extra })}>
              {t('exCounterExtra', { n: counter.extra })}
            </span>
          )}
        </span>
      ) : (
        <span className="lx-tnum flex-none text-xs text-muted" data-testid={progressTestId}>
          {t('nvProgress', { n, total: progress.total })}
        </span>
      )}
      {/* Wiedervorlagen („+1“) nur für Vorleseprogramme: sichtbar wuchs der Zähler sonst während der Runde (UX-Audit U1, „3 von 52 +1“). */}
      {!counter && !!progress.extra && (
        <span className="sr-only" data-testid="round-extra" data-n={progress.extra}>
          +{progress.extra}
        </span>
      )}
    </div>
  ) : (
    <div className="h-1.5" aria-hidden="true" />
  );
  // Ohne eigenen Titel steht das kleine Wort an der Titelstelle (bei `counter` nennt die Zählzeile schon alles).
  const plain = !title;
  const head = title ?? (counter ? null : note);
  return (
    // `data-split`: Laptop mit Tastatur – dort hält `kern.css` Leiste und Inhalt auf EINER Breite (Start, Karte, Abschluss springen nicht).
    <div className="lx-exbar lx-kbar sticky top-0 z-30" data-testid="exercise-bar" data-kern="" data-plain={plain ? '' : undefined} data-split={split ? '' : undefined}>
      <div className="lx-kbar-row">
        <IconButton icon="close" label={closeLabel} onClick={onClose} data-testid={closeTestId} className="-ml-2 flex-none" />
        <span className="lx-kbar-title" data-testid={plain ? 'exercise-note' : 'exercise-title'}>
          {head}
        </span>
        {!plain && note && <span className="sr-only">{note}</span>}
        <div className="flex min-w-11 flex-none items-center justify-end">{end}</div>
      </div>
      <div className="lx-kbar-prog">{barNode}</div>
    </div>
  );
}
