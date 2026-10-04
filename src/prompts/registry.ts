import { cardExamples } from './cardExamples';
import { comboCheck } from './comboCheck';
import { listenQ } from './listenQ';
import { orderGen } from './orderGen';
import { grammarItems } from './grammarItems';
import { grammarJudge } from './grammarJudge';
import { lessonContent } from './lessonContent';
import { lessonProduction } from './lessonProduction';
import { mnemonic } from './mnemonic';
import { NB_TEMPLATES } from './nb';
import { produceCheck } from './produceCheck';
import { wordGen } from './wordGen';
import { companionChat } from './companionChat';
import { translate } from './translate';
import { teacherFeedback } from './teacherFeedback';
import type { ChatTemplate, PromptTemplate } from './types';
import { wordLookup } from './wordLookup';
import { turnAnalysis } from './turnAnalysis';
import { roleplayReport } from './roleplayReport';
import { roleplayTurn } from './roleplayTurn';
import { assess } from './assess';
import { weeklyReport } from './weeklyReport';
import { courseExtend } from './courseExtend';
import { repairCheck } from './repairCheck';
import { patterns } from './patterns';
import { patternCheck } from './patternCheck';
import { memoryExtract } from './memoryExtract';

// Alle Vorlagen an einem Ort. Ein Test prüft eindeutige Kennungen und die Kopfzeile.

export const TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  wordLookup,
  produceCheck,
  cardExamples,
  orderGen,
  // Anwenden, Stufe 2: Hörübung mit Frage
  listenQ,
  comboCheck,
  // Phase 2 (docs/phase2-plan.md §7)
  lessonContent,
  lessonProduction,
  grammarItems,
  grammarJudge,
  // Phase 2, Funktionsabgleich M2/M3
  wordGen,
  mnemonic,
  // Phase 3 – Rollenspiel (freiwilliges Extra)
  turnAnalysis,
  roleplayReport,
  // Phase 5 – Übersetzer
  translate,
  // Lehrer-Feedback (28.09.2026, ersetzt die Preply-Brücke)
  teacherFeedback,
  // Phase 6 – Urteil
  assess,
  weeklyReport,
  // Kurs-Erweiterung (Kap. 6.2)
  courseExtend,
  // Lernberatung 27.09., V2 – Reparatur-Sätze
  repairCheck,
  // Lernberatung 27.09., V3 – Deutsch-Fallen
  patterns,
  patternCheck,
  // Neubau (docs/neubau/plan.md §3.2): neue Vorlagen der Pakete P1–P7
  ...NB_TEMPLATES,
  // Paket B: „Claude merkt sich“ (B5)
  memoryExtract,
];

/** Gesprächsvorlagen (Freitext, gestreamt über src/ai/stream.ts; Phase 3 und 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn, companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
