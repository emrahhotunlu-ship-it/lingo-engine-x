import type { PromptTemplate } from '../shared';
import { meaning } from './meaning';
import { ownSentence } from './ownSentence';
import { transfer } from './transfer';

// Die drei Vorlagen des Wörter-Moduls (plan.md §7). Die Einspruch-Fassungen (`transferRecheck`, `ownSentenceRecheck`) tragen dieselbe Kennung und
// werden deshalb nicht eigens registriert.
export const VOCAB_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  transfer,
  ownSentence,
  meaning,
];
