import { askJson } from '../../ai/gate';
import { AiFailure } from '../../ai/types';
import { bgVerdict } from '../../ai/budget';
import { takeTutorCall, tutorLeft } from '../../ai/tutorBudget';
import { useClock } from '../../app/clock';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { topicById } from '../../domain/content';
import { topicP } from '../../domain/grammar/bkt';
import { errorsOf } from '../../domain/grammar/errors';
import { poolIntake, type PoolIntake } from '../../domain/grammar/pool';
import { patternsOf } from '../../domain/grammar/patterns';
import { patsOf } from '../../domain/metrics/pattern';
import { ruleExamples, ruleOf } from '../../domain/grammar/rules';
import { wantTypes } from '../../domain/grammar/tasks';
import type { GrammarTask } from '../../domain/learn/types';
import { acceptGrammarItem, acceptGrammarItems, type SolveCheckResult } from '../../domain/tutor/acceptGrammarItem';
import { seenByTopic } from '../../domain/plan/dailyIntake';
import { logError, logWarn } from '../../platform/diagnostics';
import { grammarItems } from '../../prompts/grammarItems';
import { SOLVE_CHECK_MAX_TASKS, solveCheck } from '../../prompts/solveCheck';
import { useCapabilities } from '../../platform/capabilities';
import { tabId } from '../progress/persist';
import { loadLearnInputs } from '../learn/inputs';

// „Neue Aufgaben zu {Thema}" (phase2-plan §4.10, §7): nur auf Knopfdruck (sample.d.ts). Die
// gültigen Aufgaben kommen per `poolIntake` in `app/pool` (Platz nach dem Verdichten, unter
// `acquire`); was nicht passt, lebt nur in der folgenden Runde. Echte Fehler Emrahs zum Thema
// gehen mit (≤ 5), damit Claude genau diese Verwechslung neu übt.

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export type CheckedItems = { tasks: GrammarTask[]; raws: unknown[]; checked: boolean };

/**
 * Zweiter, unabhängiger Löser für neu erzeugte Aufgaben (`solve-check@1`, Tutor-Engine v3 §6.3, E5): Hintergrund, nur mit `sampleConfirmed`, innerhalb der
 * Tutor-Tagesbremse (`tutorBudget`) und des Hintergrund-Budgets der Vorlage (höchstens 2 je Tag, das KI-Tor zählt). Angenommen wird danach nur, was
 * `acceptGrammarItem` mit dem Ergebnis besteht. Ohne Prüfung (kein Budget, keine Zustimmung, Fehler) bleiben die lokal angenommenen Aufgaben wie bisher.
 * Kein Neuversuch; ein Abbruch durch den Nutzer wird weitergereicht.
 */
export async function checkNewItems(raws: readonly unknown[], signal: AbortSignal): Promise<CheckedItems> {
  const local = raws.map((raw) => ({ raw, task: acceptGrammarItem(raw, { src: 'ai' }).task })).filter((x): x is { raw: unknown; task: GrammarTask } => !!x.task);
  const plain: CheckedItems = { tasks: local.map((x) => x.task), raws: local.map((x) => x.raw), checked: false };
  if (!local.length || !useCapabilities.getState().sampleConfirmed || tutorLeft() <= 0) return plain;
  if (bgVerdict(solveCheck.id, solveCheck.budget?.bgPerDay ?? 0) !== null) return plain;
  const head = local.slice(0, SOLVE_CHECK_MAX_TASKS);
  if (!takeTutorCall()) return plain;
  let solve: Array<SolveCheckResult | null>;
  try {
    const r = await askJson({ template: solveCheck, vars: { tasks: head.map((x) => x.task) }, signal, priority: 'background' });
    solve = head.map((_, i) => r.data.results.find((x) => x.i === i) ?? null);
  } catch (err) {
    if (err instanceof AiFailure && err.kind === 'cancelled' && signal.aborted) throw err;
    logWarn('grammar:solve-check', err instanceof AiFailure ? { code: err.code, message: `solve-check nicht verfügbar (${err.kind}) – lokal geprüfte Aufgaben bleiben` } : err);
    return plain;
  }
  // Aufgaben ohne Ergebnis (gekappte Antwort) gelten als nicht bestätigt: Sie fallen weg (lieber eine Aufgabe weniger als eine mehrdeutige).
  const res = acceptGrammarItems(
    head.map((x) => x.raw),
    { src: 'ai', solve: solve.map((x) => x ?? { answers: [], ambiguous: true }) },
  );
  if (res.dropped.length) logWarn('grammar:solve-check', { code: 'rejected', message: res.dropped.map((d) => `#${d.i}: ${d.reasons.join(', ')}`).join('; ') });
  const keep = new Set(res.tasks.map((t) => t.key));
  const kept = head.filter((x) => keep.has(x.task.key));
  return { tasks: res.tasks, raws: kept.map((x) => x.raw), checked: true };
}

/** Eingeführte Muster des Themas (Bestand: alle, solange es noch keine `pats` gibt); leer ohne Musterdatei. */
function introducedPatterns(topic: string, doc: Readonly<Record<string, unknown>> | undefined): Array<{ id: string; name: string; form: string; signals: string[] }> {
  const tp = patternsOf(topic);
  if (!tp) return [];
  const pats = patsOf(doc);
  const started = Object.keys(pats).length > 0;
  return tp.patterns.filter((p) => (started ? pats[p.id]?.i !== undefined : typeof doc?.n === 'number' && doc.n > 0)).map((p) => ({ id: p.id, name: p.name.en, form: p.form.en, signals: [...p.signals] }));
}

export async function generateTopicTasks(topic: string, signal: AbortSignal): Promise<GrammarTask[]> {
  const tp = topicById(topic);
  if (!tp) return [];
  const live = useLive.getState();
  const docs = live.collections.grammar ?? new Map<string, Record<string, unknown>>();
  const doc = docs.get(topic);
  const nowMs = useClock.getState().now;
  const p = topicP(topic, doc, nowMs);
  const rule = ruleOf(topic, 'en');
  const ruleEn = [rule?.core ?? '', ...(rule?.forms ?? []).map((f) => `${f.name}: ${f.pattern}`)].filter(Boolean).join(' · ');
  const seenText = Array.isArray(doc?.seenText) ? (doc.seenText as unknown[]).map(str).filter(Boolean) : [];
  const errors = errorsOf(doc)
    .slice(-5)
    .map((e) => ({ q: str(e.q), given: str(e.given), ans: str(e.ans) }))
    .filter((e) => e.q && e.ans);
  const r = await askJson({
    template: grammarItems,
    vars: { topic, nameEn: tp.name_en ?? tp.name, ruleEn, examples: ruleExamples(topic, 4), p, types: wantTypes(p).filter((x): x is 'mc' | 'gap' | 'transform' | 'correct' => x === 'mc' || x === 'gap' || x === 'transform' || x === 'correct'), seenText, errors, count: 6, patterns: introducedPatterns(topic, doc) },
    signal,
  });
  // Annahme wie bisher (`grammar-items@5` prüft schon im Schema), jetzt mit Ziel-Satz (`goal`) und – wenn Budget und Zustimmung da sind – dem zweiten Löser.
  const checked = await checkNewItems(r.data.items, signal);
  const tasks = checked.tasks;
  const writer = getWriter();
  if (!writer || !tasks.length) return tasks;
  try {
    const lease = await writer.acquire('app/pool', { holder: tabId(), ttlMs: 15_000 });
    if (!lease.acquired) {
      logWarn('grammar:generate', { code: 'busy', message: 'Pool gerade belegt – Aufgaben nur in dieser Runde' }, 'app/pool');
      return tasks;
    }
    let res: PoolIntake | null = null;
    await writer.transform('app/pool', (cur) => {
      res = poolIntake(cur, [{ day: null, src: 'ai', items: checked.raws }], seenByTopic(docs), nowMs);
      return res.op;
    });
    const out = res as PoolIntake | null;
    if (out?.invalid) logError('grammar:generate', { code: 'invalid_document', message: 'Pool ungültig – nicht überschrieben' }, 'app/pool');
    else if (out && out.open > 0) logWarn('grammar:generate', { code: 'pool_full', message: `${out.open} Aufgaben nur in dieser Runde` }, 'app/pool');
    void loadLearnInputs();
  } catch (err) {
    logError('grammar:generate', err, 'app/pool');
  }
  return tasks;
}
