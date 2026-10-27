import type { GrammarTask } from '../learn/types';
import { lintTask } from '../tutor/lintTask';
import { logWarn } from '../../platform/diagnostics';
import { checkErrorSentence, type ErrorSentenceIssue } from './errorSentence';
import { denglisch } from './register';
import { checkGap, type GapIssue } from './unambiguous';

// Qualitätstor für ERZEUGTE Inhalte (E1a): Grammatik-Aufgaben aus Tagesauftrag und KI, Fehlersätze aus eigenen Texten.
// Bis E1a war `lintTask` nur eine Warnliste; jetzt ist jede Verletzung eine Sperre: die Aufgabe bzw. der Fehlersatz wird zurückgehalten
// (nichts gelöscht, der Tagesauftrag bleibt unverändert) und mit Grund im Diagnoseprotokoll gemeldet (`logWarn('quality:gate')`), nie still.
// Feste Inhalte (Seed, Lektionen) laufen NICHT durch das Tor; für sie prüft `tests/quality/content.test.ts` mit Ausnahmeliste.

export type GateIssue = `lint:${string}` | `gap:${GapIssue}` | `err:${ErrorSentenceIssue}` | 'denglisch';

/** Alle Sperrgründe einer erzeugten Grammatik-Aufgabe (leer = darf in die Runde). Rein. */
export function gateTask(task: GrammarTask): GateIssue[] {
  const out: GateIssue[] = lintTask(task).map((i) => `lint:${i}` as const);
  const gapLike = task.type === 'gap' || task.type === 'mc' || task.type === 'transform' || task.type === 'kwt';
  if (gapLike) {
    const hasSource = task.type === 'transform' || task.type === 'kwt';
    for (const g of checkGap({ prompt: task.prompt, answer: task.answer, accepted: task.accepted, options: task.options, hint: task.hint, hasSource }))
      if (!out.includes(`gap:${g}`)) out.push(`gap:${g}`);
  }
  const why = task.expl.de ?? task.expl.en ?? null;
  if (task.type === 'correct') for (const e of checkErrorSentence({ wrong: task.prompt, right: task.answer, why })) out.push(`err:${e}`);
  else if (task.type === 'find' && task.x?.kind === 'find' && task.x.fixed)
    for (const e of checkErrorSentence({ wrong: task.prompt, right: task.x.fixed, why })) out.push(`err:${e}`);
  if (denglisch(`${task.prompt} ${task.answer} ${task.accepted.join(' ')}`).length) out.push('denglisch');
  return out;
}

const reported = new Set<string>();

/**
 * Sperre mit Meldung: `true`, wenn die Aufgabe zurückgehalten wird. Jede gesperrte Aufgabe wird je Sitzung einmal gemeldet
 * (das Tor läuft bei jedem Neuzeichnen; die Meldung soll das Protokoll nicht fluten).
 */
export function holdBackTask(task: GrammarTask, where: string): boolean {
  const issues = gateTask(task);
  if (!issues.length) return false;
  const k = `${where}|${task.topic}|${task.key}`;
  if (!reported.has(k)) {
    reported.add(k);
    logWarn('quality:gate', { message: `zurückgehalten: ${issues.join(', ')}` }, `${where} · ${task.topic} · ${task.prompt.slice(0, 80)}`);
  }
  return true;
}

/** Fehlersatz (Einfehler-Regel) mit Meldung: `true`, wenn er zurückgehalten wird. */
export function holdBackRepair(r: { wrong: string; right: string; why?: string | null; kinds?: readonly string[] }, where: string): boolean {
  const issues = checkErrorSentence(r);
  if (!issues.length) return false;
  const k = `${where}|${r.wrong}`;
  if (!reported.has(k)) {
    reported.add(k);
    logWarn('quality:gate', { message: `Fehlersatz zurückgehalten: ${issues.join(', ')}` }, `${where} · ${r.wrong.slice(0, 80)}`);
  }
  return true;
}

/** Nur für Tests: Meldungs-Gedächtnis leeren. */
export function resetGateReports(): void {
  reported.clear();
}
