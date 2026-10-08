import { cardExamples } from './cardExamples';
import { comboCheck } from './comboCheck';
import { listenQ } from './listenQ';
import { orderGen } from './orderGen';
import { explainAnswerV2 } from './explainAnswerV2';
import { sentenceClinic } from './sentenceClinic';
import { c1Mail } from './c1Mail';
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
import { turnAnalysisV3 } from './turnAnalysisV3';
import { roleplayReport } from './roleplayReport';
import { roleplayTurn } from './roleplayTurn';
import { assess4 } from './assess4';
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
  // `explain-answer@1` (LP2 P2, `explainAnswer.ts`) bleibt als Datei erhalten, wird nicht mehr aufgerufen; die Kennung ist je Vorlage einmalig.
  explainAnswerV2,
  // Phase 2 (docs/phase2-plan.md §7)
  grammarItems,
  grammarJudge,
  // Phase 2, Funktionsabgleich M2/M3
  wordGen,
  mnemonic,
  // Phase 3 – Rollenspiel (freiwilliges Extra); seit LP3 P51 turn-analysis@3 (`turnAnalysis.ts` @2 bleibt als Datei, läuft bei ausgeschaltetem Schalter `tutor.talk`)
  turnAnalysisV3,
  roleplayReport,
  // Phase 5 – Übersetzer
  translate,
  // Lehrer-Feedback (28.09.2026, ersetzt die Preply-Brücke)
  teacherFeedback,
  // Phase 6 – Urteil; seit LP3 P45 assess@4 mit „Weg zu C1“ (assess@3 bleibt als Datei, läuft bei ausgeschaltetem Schalter `way`)
  assess4,
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
  // Lernplattform 3.0 P46: Satz-Klinik
  sentenceClinic,
  // Lernplattform 3.0 P47: Schreibwerkstatt (Wochen-Mail)
  c1Mail,
];

/** Gesprächsvorlagen (Freitext, gestreamt über src/ai/stream.ts; Phase 3 und 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn, companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
