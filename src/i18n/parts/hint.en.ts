import type { hintDe } from './hint.de';

// Oberflächentexte „Erst ein Hinweis, dann die Lösung" (Selbstkorrektur, Lernberatung Vorschlag 4), Englisch.

export const hintEn: Record<keyof typeof hintDe, string> = {
  rhLabel: 'Hint',
  rhSpelling: 'Almost – check the spelling',
  rhForm: 'Right word, different form',
  rhStartWord_one: 'Different word – starts with “{start}…” ({n})',
  rhStartWord_other: 'Different word – starts with “{start}…” ({n})',
  rhStartPhrase: 'Different phrase – starts with “{start}…” ({n} words)',
  rhGrammarHint: 'Watch out for: {hint}',
  rhGrammarTopic: 'Watch out for: {topic}',
  rhGrammarVerb: 'Watch the verb form',
};
