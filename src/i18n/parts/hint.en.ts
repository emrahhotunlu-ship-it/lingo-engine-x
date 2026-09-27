import type { hintDe } from './hint.de';

// Oberflächentexte „Erst ein Hinweis, dann die Lösung" (Selbstkorrektur, Lernberatung Vorschlag 4), Englisch.

export const hintEn: Record<keyof typeof hintDe, string> = {
  rhLabel: 'Hint',
  rhSpelling: 'Almost – check the spelling',
  rhForm: 'Right word, different form',
  rhStartWord_one: 'It’s a different word – it starts with “{start}…” ({n} letter)',
  rhStartWord_other: 'It’s a different word – it starts with “{start}…” ({n} letters)',
  rhStartPhrase: 'It’s a different phrase – it starts with “{start}…” ({n} words)',
  rhGrammarHint: 'Watch out for: {hint}',
  rhGrammarTopic: 'Watch out for: {topic}',
  rhGrammarVerb: 'Watch the verb form',
};
