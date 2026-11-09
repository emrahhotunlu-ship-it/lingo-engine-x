import type { UnitState } from '../../domain/metrics';
import { useT, type MessageKey } from '../../i18n';
import type { ShellStatus } from './ExerciseShell';
import { useBand } from './bandStore';

// Blockzeile (Relaunch Teil 1c, D3 V-UEBUNG; Vorschau `blockline`): Bereich · Übungsart · Stand in Worten · Plakette, 13 px in --fg-2.
// K4 (Emrah 04.11.2026): kein farbiger Kanalpunkt mehr (sagte nichts), und statt „●●●● Lernt“ steht der Stand in Worten („
// lernst du gerade“). Kennungen (`status`, `ex-kind`, `again-badge`, `status-where`) bleiben. `state: null` = kein Stand (nie ein falsches „Neu“).

const AREA: Record<ShellStatus['area'], MessageKey> = { words: 'vuAreaWords', grammar: 'vuAreaGrammar' };
const STAND: Record<UnitState, MessageKey> = { new: 'exStandNew', learning: 'exStandLearning', wobbly: 'exStandWobbly', safe: 'exStandSafe', firm: 'exStandFirm' };
/** Gefüllte Punkte von vier: Neu 1, Lernt 2, Sicher 3, Fest 4 (Wortliste, Musterblatt, Abschluss – nicht mehr in der Statuszeile). */
export const STATE_DOTS: Record<UnitState, number> = { new: 1, learning: 2, wobbly: 2, safe: 3, firm: 4 };
/** UX-Prüfung W10: Grün heißt „sicher“. Neue und lernende Einheiten zeigen ihre Punkte neutral (`data-unsure` an `.lx-dots`). */
export const isUnsure = (state: UnitState | null | undefined): boolean => state === 'new' || state === 'learning';

export function ExerciseStatus({ area, state, kindLabel, topic, pattern, badge, badgeTone = 'near', badgeTestId = 'again-badge' }: ShellStatus) {
  const { t } = useT();
  const where = [topic, pattern].filter((x): x is string => !!x).join(' · ');
  // Großpaket T: Steht die Übungsleiste („Wörter · 3 von 37“), ist der Bereich hier nur noch für Vorleseprogramme da.
  const inBar = useBand((s) => s.hosts) > 0;
  return (
    <p className="lx-vu-blockline" data-testid="status" data-area={area} data-state={state ?? undefined}>
      <span data-testid="ex-area" className={inBar ? 'sr-only' : undefined}>
        {t(AREA[area])}
      </span>
      {/* Trennpunkt als ::before des folgenden Elements: bricht die Zeile, hängt nie ein Punkt am Zeilenende. */}
      <span data-testid="ex-kind" className="lx-vu-sep">
        {kindLabel}
      </span>
      {state && (
        <span className="lx-vu-sep" data-testid="ex-stand">
          {t('exStandLine', { state: t(STAND[state]) })}
        </span>
      )}
      {/* UX-Prüfung W1: „dein Fehler“ nie zusammen mit „Neu“ (ein neues Thema hat keinen alten Fehler). */}
      {/* Buch-Test und Klausur (Ton `hint`): die Plakette steht auch bei neuen Aufgaben (UX-Prüfung 09.11.2026, sonst fehlt „das ist die Klausur“). */}
      {badge && (state !== 'new' || badgeTone === 'hint') && (
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
