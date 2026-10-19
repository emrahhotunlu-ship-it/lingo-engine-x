import { cardExamples } from './cardExamples';
import { comboCheck } from './comboCheck';
import { listenQ } from './listenQ';
import { orderGen } from './orderGen';
import { diagnoseV2 } from './diagnoseV2';
import { solveCheck } from './solveCheck';
import { wordBank } from './wordBank';
import { explainAnswerV2 } from './explainAnswerV2';
import { sentenceClinic } from './sentenceClinic';
import { c1Mail } from './c1Mail';
import { grammarItems } from './grammarItems';
import { grammarFit } from './grammarFit';
import { grammarJudge } from './grammarJudge';
import { mnemonic } from './mnemonic';
import { NB_TEMPLATES } from './nb';
import { produceCheckV2 } from './produceCheckV2';
import { activateCheck } from './activateCheck';
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
import { wordCtx } from './wordCtx';
import { READ_TEMPLATES } from '../modules/read/registry';

// Alle Vorlagen an einem Ort. Ein Test prüft eindeutige Kennungen und die Kopfzeile.

export const TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  wordLookup,
  // Wörter aktivieren Stufe 1: produce-check@2 (drei Schichten, Vorgaben, errType); produce-check@1 bleibt als Datei erhalten, wird nicht mehr aufgerufen.
  produceCheckV2,
  // Wörter aktivieren Stufe 2: activate-check@1 für A2–A5 (mehrere Zielwörter, Vorgaben, drei Schichten); ersetzt produce-check@2 nicht.
  activateCheck,
  cardExamples,
  orderGen,
  // Anwenden, Stufe 2: Hörübung mit Frage
  listenQ,
  comboCheck,
  // Lernplattform 2.0 P2: „Erklär mir meine Antwort“
  // `explain-answer@1` (LP2 P2, `explainAnswer.ts`) bleibt als Datei erhalten, wird nicht mehr aufgerufen; die Kennung ist je Vorlage einmalig.
  explainAnswerV2,
  // Lernplattform 3.0 P49: Wochen-Diagnose „Was du verwechselst“; seit Tutor-Engine S4 diagnose@2 mit Annahmen (`diagnose.ts` @1 bleibt als Datei und
  // wird von `features/tutor/diagnoseStore.ts` weiter aufgerufen, bis der Bildschirm umgestellt ist).
  diagnoseV2,
  // Phase 2 (docs/phase2-plan.md §7); seit Tutor-Engine S4 grammar-items@5 mit Lösungs-Selbstprüfung, dazu der zweite Löser solve-check@1
  grammarItems,
  solveCheck,
  grammarJudge,
  // 19.10.2026: „Auch richtig“ durch Claude (Lücke und Ersetzen)
  grammarFit,
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
  // Lernplattform 3.0 P52: Wörter-Tutor (neue Sätze und Kontrast für schwache Wörter)
  wordCtx,
  // Tutor-Engine S4 (E6): Satzbank je Karte (Quarantäne in `domain/tutor/sentenceBank.ts`)
  wordBank,
  // Lesen (13.10.2026): Artikel und Themenvorschläge, Modul src/modules/read
  ...READ_TEMPLATES,
];

/** Gesprächsvorlagen (Freitext, gestreamt über src/ai/stream.ts; Phase 3 und 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [roleplayTurn, companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
