import { askJson } from '../../ai/gate';
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
import { normalizeTask, wantTypes } from '../../domain/grammar/tasks';
import type { GrammarTask } from '../../domain/learn/types';
import { seenByTopic } from '../../domain/plan/dailyIntake';
import { logError, logWarn } from '../../platform/diagnostics';
import { grammarItems } from '../../prompts/grammarItems';
import { tabId } from '../progress/persist';
import { loadLearnInputs } from '../learn/inputs';

// „Neue Aufgaben zu {Thema}" (phase2-plan §4.10, §7): nur auf Knopfdruck (sample.d.ts). Die
// gültigen Aufgaben kommen per `poolIntake` in `app/pool` (Platz nach dem Verdichten, unter
// `acquire`); was nicht passt, lebt nur in der folgenden Runde. Echte Fehler Emrahs zum Thema
// gehen mit (≤ 5), damit Claude genau diese Verwechslung neu übt.

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

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
  const tasks = r.data.items.map((it) => normalizeTask(it, 'ai')).filter((t): t is GrammarTask => !!t);
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
      res = poolIntake(cur, [{ day: null, src: 'ai', items: r.data.items }], seenByTopic(docs), nowMs);
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
