import { cardExamples } from './cardExamples';
import { grammarItems } from './grammarItems';
import { grammarJudge } from './grammarJudge';
import { lessonContent } from './lessonContent';
import { lessonProduction } from './lessonProduction';
import { mnemonic } from './mnemonic';
import { INPUT_TEMPLATES } from './inputRegistry';
import { produceCheck } from './produceCheck';
import { wordGen } from './wordGen';
import { companionChat } from './companionChat';
import { preplyImport } from './preplyImport';
import { preplyPrep } from './preplyPrep';
import { translate } from './translate';
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
import { assess } from './assess';
import { weeklyReport } from './weeklyReport';
import { courseExtend } from './courseExtend';
import { sayCheck } from './sayCheck';
import { repairCheck } from './repairCheck';

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
  // Phase 5 – Übersetzer, Preply-Brücke
  translate,
  preplyPrep,
  preplyImport,
  // Phase 4 – Lesen, Hören, Schreiben, Entdecken
  ...INPUT_TEMPLATES,
  // Phase 6 – Urteil
  assess,
  weeklyReport,
  // Kurs-Erweiterung (Kap. 6.2)
  courseExtend,
  // Lernberatung 27.09. (V1/V2): „Sag es“
  sayCheck,
  // Lernberatung 27.09., V2 – Reparatur-Sätze
  repairCheck,
];

/** Gesprächsvorlagen (Freitext, gestreamt über src/ai/stream.ts; Phase 3 und 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn, companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
