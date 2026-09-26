import { cardExamples } from './cardExamples';
import { grammarItems } from './grammarItems';
import { grammarJudge } from './grammarJudge';
import { lessonContent } from './lessonContent';
import { lessonProduction } from './lessonProduction';
import { produceCheck } from './produceCheck';
import type { PromptTemplate } from './types';
import { wordLookup } from './wordLookup';

// Alle Vorlagen an einem Ort. Ein Test prüft eindeutige Kennungen und die Kopfzeile.

export const TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  wordLookup,
  produceCheck,
  cardExamples,
  // Phase 2 (docs/phase2-plan.md §7)
  lessonContent,
  lessonProduction,
  grammarItems,
  grammarJudge,
];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
