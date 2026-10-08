import type { UnitState } from '../../domain/metrics';
import { useT, type MessageKey } from '../../i18n';
import type { ShellStatus } from './ExerciseShell';

// Statuszeile (§4.3): Kante in der Bereichsfarbe (am Rahmen der Übung) · ●●○○ · Zustand · Übungsart ·
// „Thema · Muster“. `state: null` = keine Punkte und kein Zustandswort (nie ein falsches „Neu“).

const WORD: Record<UnitState, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', safe: 'exStateSafe', firm: 'exStateFirm' };
/** Gefüllte Punkte von vier: Neu 1, Lernt 2, Sicher 3, Fest 4. */
export const STATE_DOTS: Record<UnitState, number> = { new: 1, learning: 2, safe: 3, firm: 4 };
/** UX-Prüfung W10: Grün heißt „sicher“. Neue und lernende Einheiten zeigen ihre Punkte neutral (`data-unsure` an `.lx-dots`). */
export const isUnsure = (state: UnitState | null | undefined): boolean => state === 'new' || state === 'learning';

export function ExerciseStatus({ area, state, kindLabel, topic, pattern, badge }: ShellStatus) {
  const { t } = useT();
  const word = state ? t(WORD[state]) : null;
  const where = [topic, pattern].filter((x): x is string => !!x).join(' · ');
  return (
    <p className="lx-t-meta flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-muted" data-testid="status" data-area={area} data-state={state ?? undefined}>
      {state && word && (
        <span className="inline-flex items-center gap-2" role="img" aria-label={t('exStateLabel', { state: word })}>
          <span className="lx-dots" aria-hidden="true" data-unsure={isUnsure(state) || undefined}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="lx-dot" data-on={i < STATE_DOTS[state] || undefined} />
            ))}
          </span>
          <span aria-hidden="true">{word}</span>
        </span>
      )}
      {state && (
        <span aria-hidden="true" className="text-subtle">
          ·
        </span>
      )}
      <span data-testid="ex-kind">{kindLabel}</span>
      {/* UX-Prüfung W1: „dein Fehler“ nie zusammen mit „Neu“ (ein neues Thema hat keinen alten Fehler). */}
      {badge && state !== 'new' && (
        <span className="rounded-full bg-near-soft px-2 py-0.5 text-near-text" data-testid="again-badge">
          {badge}
        </span>
      )}
      {/* UX-Prüfung W1: der Kopf ist EINE Zeile; Thema und Muster stehen hinter ⓘ (nur für Vorleseprogramme hier). */}
      {where && (
        <span className="sr-only" data-testid="status-where">
          {where}
        </span>
      )}
    </p>
  );
}
