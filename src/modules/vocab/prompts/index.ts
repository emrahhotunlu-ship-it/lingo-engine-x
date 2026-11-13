import type { PromptTemplate } from '../shared';
import { wordKnow } from './know';
import { meaning } from './meaning';
import { ownSentence } from './ownSentence';
import { transfer } from './transfer';

// Die drei Vorlagen des Wörter-Moduls (plan.md §7). Die Einspruch-Fassungen (`transferRecheck`, `ownSentenceRecheck`) tragen dieselbe Kennung und
// werden deshalb nicht eigens registriert.
export const VOCAB_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  transfer,
  ownSentence,
  meaning,
  wordKnow,
];

// P4 „Anwenden als Brücke“ (13.11.2026), rein ergänzend: die Urteilsregeln und die lokale Gegenprüfung je Zielwort für die Vorlage
// `apply-bridge@1` (src/prompts/applyBridge.ts) – EIN Wortlaut für „eigener Satz“ in der Wörter-App und in Anwenden, statt einer Abschrift.
export { blank, falseFriendRule, hasTarget, sharedRules, targetLine, verdictRules, WHY_MAX } from './common';
export type { UseErr, UseVerdict, VocabTarget } from './common';
export { checkExtra, checkFixed, isError, isEvade, judgeOne, rawExtra, rawJudgement } from './judge';
export type { ExtraFix, WordJudgement } from './judge';
