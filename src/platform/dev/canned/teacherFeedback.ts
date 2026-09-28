import { registerCannedReply } from '../fakeSample';

// Feste, realistische Antwort des Entwicklungs-Adapters für teacher-feedback@1 (28.09.2026,
// ersetzt die Preply-Brücke). Nur Entwicklung und Tests – nie im Build (check-platform.mjs sperrt
// die Marker). `zzempty` im Feedback-Text → alle Listen leer (Rückfall-Test).

const lineOf = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const isEn = (input: string): boolean => /^English$/i.test(lineOf(input, 'Explanation language'));
const blockOf = (input: string): string => (/<<<\n([\s\S]*?)\n>>>/.exec(input)?.[1] ?? '').trim();

export function teacherFeedbackReply(input: string): string {
  const en = isEn(input);
  const empty = /zzempty/i.test(blockOf(input));
  const multi = /zzmulti/i.test(blockOf(input));
  if (multi) {
    return JSON.stringify({
      title: en ? 'Two new phrases' : 'Zwei neue Wendungen',
      summary: '',
      corrections: [],
      words: [
        { en: 'would rather', de: 'lieber wollen', pos: 'phrase', ex: 'We would rather start with a pilot.', fromLesson: true },
        { en: 'phase out', de: 'auslaufen lassen', pos: 'verb', ex: 'We will phase out the old version.', fromLesson: true },
      ],
      tasks: [],
    });
  }
  if (empty) {
    return JSON.stringify({
      title: en ? 'Lesson notes' : 'Stundennotizen',
      summary: '',
      corrections: [],
      words: [],
      tasks: [],
    });
  }
  return JSON.stringify({
    title: en ? 'Prepositions and preferences' : 'Präpositionen und Vorlieben',
    summary: en
      ? 'We practiced verbs with fixed prepositions and expressing preferences.'
      : 'Wir haben Verben mit festen Präpositionen und das Ausdrücken von Vorlieben geübt.',
    corrections: [
      {
        wrong: 'It depends of the budget.',
        right: 'It depends on the budget.',
        why: en ? 'After "depend" the preposition is always "on".' : 'Nach „depend“ steht immer „on“.',
      },
    ],
    words: [{ en: 'would rather', de: 'lieber wollen', pos: 'phrase', ex: 'We would rather start with a pilot.', fromLesson: true }],
    tasks: [
      en ? 'Write five sentences with "would rather".' : 'Schreibe fünf Sätze mit „would rather“.',
      en ? 'Practice depend on / rely on / focus on out loud.' : 'Übe die Präpositionen depend on / rely on / focus on mündlich.',
    ],
  });
}

export function registerTeacherFeedbackReply(): void {
  registerCannedReply('teacher-feedback', teacherFeedbackReply);
}
