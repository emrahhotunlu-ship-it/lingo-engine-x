import type { UnitState } from '../../domain/metrics';
import { useT, type MessageKey } from '../../i18n';
import type { ShellStatus } from './ExerciseShell';

// Blockzeile (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau `blockline`, style.css:238): Kanalpunkt in der Bereichsfarbe · Bereich ·
// Übungsart · ●●○○ Zustand · Plakette, 13 px in --fg-2. Ersetzt die frühere Statuszeile; Kennungen (`status`, `ex-kind`, `again-badge`,
// `status-where`) bleiben. `state: null` = keine Punkte und kein Zustandswort (nie ein falsches „Neu“).

const AREA: Record<ShellStatus['area'], MessageKey> = { words: 'vuAreaWords', grammar: 'vuAreaGrammar' };
const WORD: Record<UnitState, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', wobbly: 'exStateWobbly', safe: 'exStateSafe', firm: 'exStateFirm' };
/** Gefüllte Punkte von vier: Neu 1, Lernt 2, Sicher 3, Fest 4. */
export const STATE_DOTS: Record<UnitState, number> = { new: 1, learning: 2, wobbly: 2, safe: 3, firm: 4 };
/** UX-Prüfung W10: Grün heißt „sicher“. Neue und lernende Einheiten zeigen ihre Punkte neutral (`data-unsure` an `.lx-dots`). */
export const isUnsure = (state: UnitState | null | undefined): boolean => state === 'new' || state === 'learning';

export function ExerciseStatus({ area, state, kindLabel, topic, pattern, badge, badgeTone = 'near', badgeTestId = 'again-badge' }: ShellStatus) {
  const { t } = useT();
  const word = state ? t(WORD[state]) : null;
  const where = [topic, pattern].filter((x): x is string => !!x).join(' · ');
  return (
    <p className="lx-vu-blockline" data-testid="status" data-area={area} data-state={state ?? undefined}>
      <span className="lx-v-dot" data-ch={area === 'words' ? 'w' : 'g'} aria-hidden="true" />
      <span data-testid="ex-area">{t(AREA[area])}</span>
      {/* Trennpunkt als ::before des folgenden Elements: bricht die Zeile, hängt nie ein Punkt am Zeilenende. */}
      <span data-testid="ex-kind" className="lx-vu-sep">
        {kindLabel}
      </span>
      {state && word && (
        <span className="lx-vu-sep inline-flex items-center gap-1.5" role="img" aria-label={t('exStateLabel', { state: word })}>
          <span className="lx-dots" aria-hidden="true" data-unsure={isUnsure(state) || undefined} data-wobbly={state === 'wobbly' || undefined}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="lx-dot" data-on={i < STATE_DOTS[state] || undefined} />
            ))}
          </span>
          <span aria-hidden="true">{word}</span>
        </span>
      )}
      {/* UX-Prüfung W1: „dein Fehler“ nie zusammen mit „Neu“ (ein neues Thema hat keinen alten Fehler). */}
      {badge && state !== 'new' && (
        <span className="lx-vu-badge" data-testid={badgeTestId} data-tone={badgeTone}>
          {badge}
        </span>
      )}
      {/* Thema und Muster stehen hinter „Wozu?“ (nur für Vorleseprogramme hier). */}
      {where && (
        <span className="sr-only" data-testid="status-where">
          {where}
        </span>
      )}
    </p>
  );
}
