import { z } from 'zod';
import { defineArea, type ScreenProps } from '../app/registry';
import { HubSections } from '../app/shell/Hub';
import { placesOf } from '../app/shell/tabs';
import { CourseScreen } from '../features/course/CourseScreen';
import { LessonScreen } from '../features/course/LessonScreen';
import { DrillScreen } from '../features/drills/DrillScreen';
import { GrammarScreen } from '../features/grammar/GrammarScreen';
import { GrammarSessionScreen } from '../features/grammar/SessionScreen';
import { WissenScreen } from '../features/grammar/WissenScreen';
import { LearnHub } from '../features/learn/LearnHub';
import { PatternsScreen } from '../features/patterns/PatternsScreen';
import { FocusScreen } from '../features/grammar/focus/FocusScreen';
import { ensureFocus, focusResume } from '../features/grammar/focus/resume';
import { startFocus } from '../features/grammar/focus/session';
import { AgainScreen } from '../features/repair/again/AgainScreen';
import { againResume, ensureAgain } from '../features/repair/again/resume';
import { startAgain } from '../features/repair/again/session';
import { ensureGrammar, grammarResume } from '../features/grammar/resume';
import { drillResume, ensureDrill } from '../features/drills/resume';
import { startDrill } from '../features/drills/session';
import { startGrammar } from '../features/grammar/session';
import { ensureLesson, lessonResume } from '../features/course/resume';
import { patternResume } from '../features/patterns/run';

// Bereich „Lernen“ (Kurs, Grammatik, Training) – Besitz: Paket P2 (docs/neubau/architektur.md §5.2).
// WP0a: heutige Bildschirme unter den heutigen Routennamen; „Üben“ (`learn`) ist Reiter-Wurzel
// (plan.md §1.1) mit dem bisherigen Hub, darunter die Abschnitte des Platzes `learn` (z. B. P7).

declare module '../app/router/types' {
  interface RouteParams {
    learn: NoParams;
    course: NoParams;
    grammar: { topic?: string };
    wissen: NoParams;
    patterns: { id?: string };
    lesson: { id: string };
    grammarSession: { mode: 'duty' | 'xtra' | 'errors' | 'topic'; topic?: string };
    drill: { kind: 'dictate' | 'cloze' | 'order' | 'sprint'; ctx: 'duty' | 'xtra' };
    /** Tageseinheit Block 4 „Fokus“ (plan.md §1.5, N41). */
    unitFocus: NoParams;
    /** Tageseinheit Block 5 „Nochmal, aber besser“ (N42). */
    unitAgain: NoParams;
  }
}

function LessonRoute({ route }: ScreenProps<'lesson'>) {
  return <LessonScreen id={route.id} />;
}

/** Reiter-Wurzel „Üben“: bisheriger Hub, darunter die Abschnitte des Platzes `learn`. */
function LearnRoot() {
  return (
    <>
      <LearnHub />
      <HubSections places={placesOf('learn')} />
    </>
  );
}

export const lernen = defineArea({
  id: 'lernen',
  screens: {
    learn: { kind: 'tab', component: LearnRoot, title: 'lhTitle', keepScroll: true },
    course: { kind: 'page', component: CourseScreen, title: 'csTitle', keepScroll: true },
    // `grammar?topic=c1-…`: Werkzeug der Woche, 1 Tipp von „Deine Woche“ (P2 Muss 7) – öffnet das Themenblatt.
    grammar: { kind: 'page', component: GrammarScreen, title: 'grTitle', keepScroll: true, params: z.object({ topic: z.string().optional() }) },
    wissen: { kind: 'page', component: WissenScreen, title: 'wsTraps', keepScroll: true },
    patterns: { kind: 'page', component: PatternsScreen, title: 'ptTitle', params: z.object({ id: z.string().optional() }) },
    lesson: { kind: 'exercise', component: LessonRoute, params: z.object({ id: z.string().min(1) }), ensure: ensureLesson },
    grammarSession: {
      kind: 'exercise',
      component: GrammarSessionScreen,
      ensure: ensureGrammar,
      params: z.object({ mode: z.enum(['duty', 'xtra', 'errors', 'topic']), topic: z.string().optional() }),
    },
    drill: {
      kind: 'exercise',
      component: DrillScreen,
      ensure: ensureDrill,
      params: z.object({ kind: z.enum(['dictate', 'cloze', 'order', 'sprint']), ctx: z.enum(['duty', 'xtra']) }),
    },
    unitFocus: { kind: 'exercise', component: FocusScreen, title: 'nbLernenFocusTitle', ensure: ensureFocus },
    unitAgain: { kind: 'exercise', component: AgainScreen, title: 'nbLernenAgainTitle', ensure: ensureAgain },
  },
  // Blöcke 4 und 5 der Tageseinheit (plan.md §1.5, §4.10): synchron im Klick gebaut, ohne KI erfüllbar.
  unitBlocks: [
    {
      kind: 'focus',
      feasible: () => true,
      start: (ctx) => {
        startFocus(ctx);
        return { name: 'unitFocus' };
      },
    },
    {
      // Grammatik als Block 2 (Lernwissenschaft 04.10.2026): die vorhandene Grammatikrunde – fällige und schwache Themen,
      // neue Varianten, höchstens 3 Fehlersätze, verschachtelt (`selectRound`), Rundengröße aus dem Plan.
      kind: 'grammar',
      feasible: () => true,
      start: (ctx) => {
        startGrammar({ mode: 'duty', day: ctx.day, block: ctx.block, ...(ctx.opts?.n ? { size: ctx.opts.n } : {}) });
        return { name: 'grammarSession', mode: 'duty' };
      },
    },
    {
      // Satzbau als Block 3 (Vokabeln und Grammatik, Emrahs Vorgabe 04.10.2026): fester Satz-Pool, ohne KI erfüllbar.
      kind: 'task.order',
      feasible: () => true,
      start: (ctx) => {
        startDrill('order', ctx.day, ctx.block);
        return { name: 'drill', kind: 'order', ctx: 'duty' };
      },
    },
    {
      kind: 'again',
      feasible: () => true,
      start: (ctx) => {
        startAgain(ctx);
        return { name: 'unitAgain' };
      },
    },
  ],
  resumables: [focusResume, againResume, grammarResume, drillResume, lessonResume, patternResume],
});
