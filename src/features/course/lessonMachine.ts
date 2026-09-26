import { setup } from 'xstate';
import type { Step } from './lessonRun';

// Ablauf einer Lektion (phase2-plan §3 „Zustände"): intro → words → dialog → grammar → output →
// summary. Zurück ist erlaubt (nicht aus der Zusammenfassung), Überspringen nicht. Der
// Wiedereinstieg beginnt im gespeicherten Schritt (K-01).

type Ev = { type: 'NEXT' } | { type: 'BACK' };

export function makeLessonMachine(start: Step) {
  return setup({ types: { events: {} as Ev } }).createMachine({
    id: 'lesson',
    initial: start,
    states: {
      intro: { on: { NEXT: 'words' } },
      words: { on: { NEXT: 'dialog', BACK: 'intro' } },
      dialog: { on: { NEXT: 'grammar', BACK: 'words' } },
      grammar: { on: { NEXT: 'output', BACK: 'dialog' } },
      output: { on: { NEXT: 'summary', BACK: 'grammar' } },
      summary: { type: 'final' },
    },
  });
}
