import { z } from 'zod';
import { defineArea } from '../app/registry';
import { selectAiAvailable } from '../ai/scope';
import { useCapabilities } from '../platform/capabilities';
import { startDrill } from '../features/drills/session';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { ApplyHub } from '../features/apply/ApplyHub';
import { ComboSentenceScreen } from '../features/apply/ComboSentence';
import { ListenQuestionScreen } from '../features/apply/ListenQuestion';
import { RepairRoundScreen } from '../features/apply/RepairRound';
import { TempoRoundScreen } from '../features/c1x/TempoRound';

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
    comboSentence: { unit?: number };
  }
}

/** Reiter-Wurzel: der Hub; die Abschnitte des Platzes `apply` (Lesen und Sprechen) stehen oben unter dem Titel (P2, Vorschau H13). */
function ApplyRoot() {
  return <ApplyHub lead={<HubSections places={placesOf('apply')} />} />;
}

export const anwenden = defineArea({
  id: 'anwenden',
  screens: {
    // P2 S1-SHELL: der Reiter heißt „Praxis“ – so lautet auch „‹ Praxis“ auf Lesen/Sprechen und „sieht gerade: Praxis“.
    apply: { kind: 'tab', component: ApplyRoot, title: 'shTabPractice', keepScroll: true },
    repairRound: { kind: 'exercise', component: RepairRoundScreen, title: 'apRepair' },
    tempoRound: { kind: 'exercise', component: TempoRoundScreen, title: 'cxTempoTitle' },
    listenQ: { kind: 'exercise', component: ListenQuestionScreen, title: 'apListenQ' },
    comboSentence: { kind: 'exercise', component: ComboSentenceScreen, title: 'apComboOwn', params: z.object({ unit: z.number().int().min(1).max(5).optional() }) },
  },
  // Tagesweg Schritt 3 „Anwenden“ (UX-Neuanfang C, Emrah 02.11.2026): drei eigene Sätze mit Wörtern aus dem Wortschatz und einer
  // Grammatikregel, Claude prüft. Ohne Claude: Satzbau mit den eigenen Wörtern (ohne KI erfüllbar), damit der Schritt nie hängt.
  unitBlocks: [
    {
      kind: 'task.apply',
      feasible: () => true,
      start: (ctx) => {
        if (selectAiAvailable(useCapabilities.getState())) return { name: 'comboSentence', unit: ctx.block };
        return startDrill('order', ctx.day, ctx.block) === null ? false : { name: 'drill', kind: 'order', ctx: 'duty' };
      },
    },
  ],
});
