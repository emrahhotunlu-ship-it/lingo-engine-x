import { cardExamples } from './cardExamples';
import { comboCheck } from './comboCheck';
import { listenQ } from './listenQ';
import { orderGen } from './orderGen';
import { explainAnswer } from './explainAnswer';
import { grammarItems } from './grammarItems';
import { grammarJudge } from './grammarJudge';
import { mnemonic } from './mnemonic';
import { NB_TEMPLATES } from './nb';
import { produceCheck } from './produceCheck';
import { synonymCheck } from './synonymCheck';
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
  // Lernplattform 2.0 P2: „Erklär mir meine Antwort“
  explainAnswer,
  // Phase 2 (docs/phase2-plan.md §7)
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
  // Lernberatung 27.09., V2 – Reparatur-Sätze
  repairCheck,
  // Lernberatung 27.09., V3 – Deutsch-Fallen
  patterns,
  patternCheck,
  // Neubau (docs/neubau/plan.md §3.2): neue Vorlagen der Pakete P1–P7
  ...NB_TEMPLATES,
  // Paket B: „Claude merkt sich“ (B5)
  memoryExtract,
  // Lernplattform 2.0 P6: „War das auch richtig?“
  synonymCheck,
];

/** Gesprächsvorlagen (Freitext, gestreamt über src/ai/stream.ts; Phase 3 und 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn, companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
