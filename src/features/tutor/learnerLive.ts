import { useLive } from '../../data/live';
import { buildLearnerModel, type LearnerModel } from '../../domain/tutor/learner';
import { lintTask } from '../../domain/tutor/lintTask';
import type { GrammarTask } from '../../domain/learn/types';
import { logWarn } from '../../platform/diagnostics';

// Lernermodell in der Übung (Tutor-Engine v3 §3.1/§6.2): gerechnet nur bei Rundenstart (erste Aufgabe) und bei jeder Rückmeldung, und zwar
// verzögert (nach dem Zeichnen), damit weder „Prüfen“ noch das Urteil warten. Die Rückmeldung nimmt das zuletzt fertige Modell; fehlt es noch,
// gilt als Beleg für „Nicht verwechseln“ nur die Ursache `confuse` in dieser Antwort (`contrastProof`).
// Quellen sind die Live-Daten (Grammatik und Vokabeln); Protokoll und `act/` liegen nicht im Live-Speicher und fehlen hier (die Annahmen
// stützen sich dann auf die Fehlersätze, `errorEvidence`). Das Modell speichert je Dokument zwischen (`learner.ts`), ein zweiter Lauf ist billig.

let last: LearnerModel | null = null;
let pending: ReturnType<typeof setTimeout> | null = null;

/** Das zuletzt fertige Modell (oder `null`). */
export const learnerNow = (): LearnerModel | null => last;

function compute(): void {
  pending = null;
  const s = useLive.getState();
  try {
    last = buildLearnerModel(
      { grammarDocs: s.collections.grammar ?? new Map(), logs: new Map(), vocab: s.collections.vocab ?? new Map(), act: new Map(), profile: s.docs['app/profile'] ?? null, diag: [] },
      Date.now(),
    );
  } catch (err) {
    logWarn('tutor:learner', err, 'buildLearnerModel');
  }
}

/** Neu rechnen, sobald der Browser Zeit hat (höchstens ein Lauf in der Warteschlange). */
export function scheduleLearner(): void {
  if (pending !== null) return;
  pending = setTimeout(compute, 0);
}

/** Nur für Tests: Zustand zurücksetzen. */
export function resetLearnerLive(): void {
  if (pending !== null) clearTimeout(pending);
  pending = null;
  last = null;
}

const linted = new Set<string>();
let lintCount = 0;

/**
 * Aufgaben-Prüfung `lintTask` (§4.2) als Warnzähler im Diagnoseprotokoll: je Aufgabe höchstens einmal je Sitzung, nie eine Sperre.
 * Gibt die Befunde zurück (für Tests).
 */
export function lintOnce(task: GrammarTask): readonly string[] {
  const k = `${task.topic}|${task.key}`;
  if (linted.has(k)) return [];
  linted.add(k);
  let issues: readonly string[];
  try {
    issues = lintTask(task);
  } catch (err) {
    logWarn('tutor:lint', err, k);
    return [];
  }
  if (issues.length) {
    lintCount++;
    logWarn('tutor:lint', { message: `lintTask: ${issues.join(', ')}` }, `${k} · #${lintCount}`);
  }
  return issues;
}
