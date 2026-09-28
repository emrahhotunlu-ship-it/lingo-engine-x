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

// Bereich „Lernen“ (Kurs, Grammatik, Training) – Besitz: Paket P2 (docs/neubau/architektur.md §5.2).
// WP0a: heutige Bildschirme unter den heutigen Routennamen; „Üben“ (`learn`) ist Reiter-Wurzel
// (plan.md §1.1) mit dem bisherigen Hub, darunter die Abschnitte des Platzes `learn` (z. B. P7).

declare module '../app/router/types' {
  interface RouteParams {
    learn: NoParams;
    course: NoParams;
    grammar: NoParams;
    wissen: NoParams;
    patterns: { id?: string };
    lesson: { id: string };
    grammarSession: { mode: 'duty' | 'xtra' | 'errors' | 'topic'; topic?: string };
    drill: { kind: 'dictate' | 'cloze' | 'order' | 'sprint'; ctx: 'duty' | 'xtra' };
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
    grammar: { kind: 'page', component: GrammarScreen, title: 'grTitle', keepScroll: true },
    wissen: { kind: 'page', component: WissenScreen, title: 'wsTraps', keepScroll: true },
    patterns: { kind: 'page', component: PatternsScreen, title: 'ptTitle', params: z.object({ id: z.string().optional() }) },
    lesson: { kind: 'exercise', component: LessonRoute, params: z.object({ id: z.string().min(1) }) },
    grammarSession: {
      kind: 'exercise',
      component: GrammarSessionScreen,
      params: z.object({ mode: z.enum(['duty', 'xtra', 'errors', 'topic']), topic: z.string().optional() }),
    },
    drill: {
      kind: 'exercise',
      component: DrillScreen,
      params: z.object({ kind: z.enum(['dictate', 'cloze', 'order', 'sprint']), ctx: z.enum(['duty', 'xtra']) }),
    },
  },
});
