import { z } from 'zod';
import { defineArea } from '../app/registry';
import { selectAiAvailable } from '../ai/scope';
import { useCapabilities } from '../platform/capabilities';
import { startDrill } from '../features/drills/session';
import { HubSections } from '../app/shell/Hub';
import type { Place } from '../app/shell/tabs';
import { ApplyHub } from '../features/apply/ApplyHub';
import { ComboSentenceScreen } from '../features/apply/ComboSentence';
import { ListenQuestionScreen } from '../features/apply/ListenQuestion';
import { RepairRoundScreen } from '../features/apply/RepairRound';
import { TempoRoundScreen } from '../features/c1x/TempoRound';
import { FOCUS2 } from '../app/focus';
import { useLive } from '../data/live';
import { useTodayPlan } from '../features/today/store';
import { ApplyPage, applyStepRoute } from '../modules/apply/index';
import { isShortDayOf } from '../modules/apply/registry';

// Bereich „Anwenden“ (Emrahs Wunsch 04.10.2026, „Go Anwenden“): vierter Lernreiter neben Wortschatz und Grammatik.
// Hier wird das Gelernte kombiniert benutzt – Diktat, Hörschleife, Lücke, Satzbau, Rollenspiel. Freiwillig, nie Pflicht.

declare module '../app/router/types' {
  interface RouteParams {
    apply: NoParams;
    /** „Fehler korrigieren“: freiwillige Runde mit fälligen Reparatur-Sätzen. */
    repairRound: NoParams;
    /** Tempo-Runde (Lernplattform 3.0 P24): zwölf kurze Aufgaben zu sicheren Mustern, mit Zielzeit. */
    tempoRound: NoParams;
    /** Hörübung mit Frage zu eigenen Wörtern (Sprachausgabe, Claude schreibt die Texte). */
    listenQ: NoParams;
    /** „Eigener Satz“: Wort + Grammatikregel im selben Satz, Claude prüft. `unit` = Schritt des Tagesweges (Anwenden), sonst frei. */
    comboSentence: { unit?: number; n?: number };
  }
}

/** Plätze der Praxis-Seite (seit UX-Neuanfang B kein Reiter mehr, sondern eine Seite unter Heute). */
const PRACTICE_PLACES: readonly Place[] = ['apply', 'read', 'speak'];

/**
 * Praxis-Seite: der Hub; die Abschnitte der Plätze `apply`/`read`/`speak` (Lesen und Sprechen) stehen oben unter dem Titel (P2, Vorschau H13).
 * Fokus 2.0 F3 (anwenden-plan.md „Seite Anwenden“): unter `FOCUS2` die neue Seite „Anwenden“ des Moduls; der alte Hub bleibt nur der Rückweg.
 */
function ApplyRoot() {
  if (FOCUS2) return <ApplyPage />;
  return <ApplyHub lead={<HubSections places={PRACTICE_PLACES} />} />;
}

export const anwenden = defineArea({
  id: 'anwenden',
  screens: {
    // „Praxis“ (P2 S1-SHELL) – seit UX-Neuanfang B eine Seite auf dem Stapel von Heute; so lautet auch „‹ Praxis“ auf Lesen/Sprechen.
    apply: { kind: 'page', chrome: 'shell', component: ApplyRoot, title: FOCUS2 ? 'axTitle' : 'shTabPractice', keepScroll: true },
    repairRound: { kind: 'exercise', component: RepairRoundScreen, title: 'apRepair' },
    tempoRound: { kind: 'exercise', component: TempoRoundScreen, title: 'cxTempoTitle' },
    listenQ: { kind: 'exercise', component: ListenQuestionScreen, title: 'apListenQ' },
    comboSentence: { kind: 'exercise', component: ComboSentenceScreen, title: 'apComboOwn', params: z.object({ unit: z.number().int().min(1).max(5).optional(), n: z.number().int().min(1).max(3).optional() }) },
  },
  // Tagesweg Schritt 3 „Anwenden“ (UX-Neuanfang C, Emrah 02.11.2026; Fokus 2.0 F3): die Disziplin des Tages aus dem eingefrorenen Plan (`u.ap`:
  // eigener Satz, Mail beantworten, Mail schreiben, Artikel zusammenfassen), am kurzen Tag ein eigener Satz. Ohne Claude: Satzbau mit den eigenen
  // Wörtern (ohne KI erfüllbar), damit der Schritt nie hängt.
  unitBlocks: [
    {
      kind: 'task.apply',
      feasible: () => true,
      start: (ctx) => {
        const ai = selectAiAvailable(useCapabilities.getState());
        if (!FOCUS2) {
          if (ai) return { name: 'comboSentence', unit: ctx.block };
          return startDrill('order', ctx.day, ctx.block) === null ? false : { name: 'drill', kind: 'order', ctx: 'duty' };
        }
        const plan = useTodayPlan.getState().plan;
        const ap = plan && plan.d === ctx.day ? plan.u?.ap : undefined;
        return applyStepRoute({ ap, short: isShortDayOf(useLive.getState().docs['app/profile'], ctx.day), ai, day: ctx.day, block: ctx.block });
      },
    },
  ],
});
