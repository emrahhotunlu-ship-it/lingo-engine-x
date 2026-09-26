import { cardExamples } from './cardExamples';
import { grammarItems } from './grammarItems';
import { grammarJudge } from './grammarJudge';
import { lessonContent } from './lessonContent';
import { lessonProduction } from './lessonProduction';
import { mnemonic } from './mnemonic';
import { produceCheck } from './produceCheck';
import { wordGen } from './wordGen';
import type { ChatTemplate, PromptTemplate } from './types';
import { wordLookup } from './wordLookup';
import { turnAnalysis } from './turnAnalysis';
import { roleplayReport } from './roleplayReport';
import { sceneGen } from './sceneGen';
import { mailRefine } from './mailRefine';
import { phraseAdapt } from './phraseAdapt';
import { pitchScript } from './pitchScript';
import { pitchFeedback } from './pitchFeedback';
import { roleplayTurn } from './roleplayTurn';

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
  // Phase 2, Funktionsabgleich M2/M3
  wordGen,
  mnemonic,
  // Phase 3 – Sprechen und Business
  turnAnalysis,
  roleplayReport,
  sceneGen,
  mailRefine,
  phraseAdapt,
  pitchScript,
  pitchFeedback,
];

/** Gesprächsvorlagen (Streaming, Zugliste statt Prompt-Text). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
