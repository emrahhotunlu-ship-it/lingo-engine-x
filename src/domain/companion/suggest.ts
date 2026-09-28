import type { Seeing } from './seeing';

// Vorschläge je Lage (Phase 5 §7.2, E5-07): feste Schlüssel aus i18n, das Modell liefert keine.

export type SuggestKey =
  | 'sgHint'
  | 'sgRule'
  | 'sgWhyWrong'
  | 'sgMoreExamples'
  | 'sgConfusable'
  | 'sgWordColloc'
  | 'sgWordRegister'
  | 'sgWordQuiz'
  | 'sgEmail'
  | 'sgPreply'
  | 'sgWeakest'
  | 'sgSimpler'
  | 'sgQuizMe'
  // Neubau (plan.md §1.2): Rückfrage-Chips nach jeder Antwort, z. B. nach „Warum?“.
  | 'nbProfilSgExample'
  | 'nbProfilSgOther'
  | 'nbProfilSgGerman';

export type SuggestLage = { seeing: Seeing | null; hasWord: boolean; afterReply: boolean };

export function suggestions(l: SuggestLage): SuggestKey[] {
  if (l.afterReply) return ['nbProfilSgExample', 'nbProfilSgOther', 'nbProfilSgGerman'];
  if (l.hasWord) return ['sgWordColloc', 'sgWordRegister', 'sgWordQuiz'];
  if (l.seeing?.phase === 'question') return ['sgHint', 'sgRule'];
  if (l.seeing?.phase === 'feedback') return ['sgWhyWrong', 'sgMoreExamples', 'sgConfusable'];
  return ['sgEmail', 'sgPreply', 'sgWeakest'];
}
