import type { GrammarTask } from '../../domain/learn/types';
import { whyOf, type WhyFact } from '../../domain/tutor/policy';
import { useT } from '../../i18n';
import { computeLearnerNow, learnerNow } from './learnerLive';
import { taskMarkKey, useTutorSession } from './sessionStore';
import { whyText } from './whyText';

// „Warum diese Aufgabe?“ (Tutor-Engine v3 S2): der Grund (ein Satz aus echten Belegen) steht im ⓘ der Übung und wird erst beim Öffnen
// gerechnet, nie vor dem Zeichnen. Hat die Runde die Aufgabe nach drei Fehlern gegen etwas Bekanntes getauscht (Rang 2), steht der Grund
// sichtbar als Statuszeile darüber („Kurz etwas Bekanntes, dann weiter.“) – dann nicht noch einmal im ⓘ.

/** Statuszeile über der Aufgabe, nur nach dem Tausch (Rang 2). */
export function WinLine({ task }: { task: GrammarTask }) {
  const { t } = useT();
  const mark = useTutorSession((x) => x.marks[taskMarkKey(task)] ?? null);
  if (mark !== 'known') return null;
  return (
    <p className="m-0 px-1.25 text-sm text-muted" role="status" data-testid="tutor-win">
      {t('ttWin')}
    </p>
  );
}

/**
 * Grund „Warum diese Aufgabe?“ für das ⓘ der Übung (UX-Prüfung 19.10.2026: EIN Warum-Zugang an fester Stelle, kein eigener Knopf unter der
 * Aufgabe, der nach dem Prüfen springt). Gerechnet wird erst beim Öffnen; nach dem Tausch (`known`) steht der Grund schon als Statuszeile da.
 */
export function useWhyReason(task: GrammarTask | null, on: boolean): ((checked: boolean) => { text: string; code: string }) | null {
  const { lang } = useT();
  const mark = useTutorSession((x) => (task ? (x.marks[taskMarkKey(task)] ?? null) : null));
  if (!on || !task || mark === 'known') return null;
  // `checked`: schon geprüft? Vorher nennt der Grund nur das Thema, kein Muster (Nachprüfung N3).
  return (checked) => {
    // Das zuletzt fertige Modell, sonst einmal sofort rechnen (die Seite ist längst gezeichnet).
    const m = learnerNow() ?? computeLearnerNow();
    const fact: WhyFact = whyOf(task, m, mark);
    return { text: whyText(fact, lang, { before: !checked }), code: fact.code };
  };
}
