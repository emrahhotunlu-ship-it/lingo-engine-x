// Prompt-Vorlagen des Trainers (docs/neustart.md §8): nur zwei, beide nur auf Knopfdruck.
// Kurz gehalten, damit jede Anfrage wenig Kontingent kostet.

export const TRANSLATE_ID = 'coach-translate';
export const ASK_ID = 'coach-ask';
export const PROMPT_VERSION = 1;

/** Übersetzung Deutsch ↔ Englisch (Richtung erkennt Claude selbst). */
export function translatePrompt(text: string): string {
  return [
    `[${TRANSLATE_ID}@${PROMPT_VERSION}]`,
    'Translate the following text. If it is German, translate it into natural American English; if it is English, translate it into natural German.',
    'Reply with the translation only. If there are two common ways to say it, give both on separate lines.',
    '',
    text.slice(0, 2000),
  ].join('\n');
}

/** Frage an Claude mit Bezug zur aktuellen Aufgabe. */
export function askPrompt(question: string, context: string, uiLang: 'de' | 'en'): string {
  const lang = uiLang === 'de' ? 'German' : 'English';
  return [
    `[${ASK_ID}@${PROMPT_VERSION}]`,
    'You are a concise, friendly English coach for Emrah, a German native speaker (B2, aiming for C1, works in B2B software sales).',
    `Answer in ${lang}. Use American English for all English examples. Keep it short: at most 120 words, plain text, no headings.`,
    context ? `Current exercise: ${context.slice(0, 600)}` : '',
    '',
    `Question: ${question.slice(0, 1500)}`,
  ]
    .filter((l, i) => l || i > 3)
    .join('\n');
}

export const BRIEF_ID = 'coach-brief';

/** Wöchentlicher Trainer-Brief aus berechneten Zahlen (eine Anfrage je Woche). */
export function briefPrompt(facts: unknown, uiLang: 'de' | 'en'): string {
  const lang = uiLang === 'de' ? 'German' : 'English';
  return [
    `[${BRIEF_ID}@${PROMPT_VERSION}]`,
    'You are the personal English coach of Emrah (German native speaker, working in B2B software sales, B2 now, goal C1 within 12 months).',
    `Write his weekly coach letter in ${lang}, addressing him as "du" in German or "you" in English. Use only the facts below, never invent numbers.`,
    'Structure, plain text without headings or lists: 1) what went well (one or two sentences, concrete), 2) what is holding him back (one or two sentences), 3) one clear focus for next week (one sentence).',
    'Warm, direct, no flattery, at most 110 words. English words and examples in American English.',
    '',
    `Facts (JSON): ${JSON.stringify(facts)}`,
  ].join('\n');
}
