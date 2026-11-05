import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { selectAiAvailable } from '../../ai/scope';
import { isAiFailure } from '../../ai/types';
import { useLive } from '../../data/live';
import { readDoc } from '../../data/reads';
import { lessonMeta } from '../../domain/course/catalog';
import { readLesson } from '../../domain/course/lessonDoc';
import { planFocusTopic, rankTopics, seenOf } from '../../domain/grammar/tasks';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { generateLesson, useLessonRun } from '../course/lessonRun';
import { generateTopicTasks } from '../grammar/generate';
import { useLearnInputs } from '../learn/inputs';
import { dutyChannelOf } from '../../domain/plan/buildPlan';
import { useTodayPlan } from './store';

// Tagesvorbereitung (docs/ki-paket-plan.md §4): Beim ersten Start einer Tagesaufgabe (Handlung)
// bereitet Claude im Hintergrund vor, was heute noch kommt – damit später niemand wartet:
// - die heutige Lektion (`lesson-content`), wenn ihr Inhalt fehlt,
// - frische Grammatik-Aufgaben zum Hauptthema der Grammatik-Pflicht (`grammar-items`), wenn dafür
//   weniger als GRAM_FRESH_MIN ungesehene Aufgaben bereitliegen.
// Die Wörter der Wiederholung bereitet die Runde selbst vor (features/vocab/packs.ts).
// Plan, Pflicht, Mengen und Serie bleiben fest; ohne Claude läuft der Tag wie bisher.
// Höchstens EINMAL je Lerntag und Seitenaufruf, mit Priorität „Hintergrund" (ein Platz der
// Warteschlange bleibt für Nutzer-Aufrufe frei). Nie automatisch wiederholt.

const GRAM_FRESH_MIN = 4;
let doneFor: string | null = null;

/** Hauptthema der heutigen Grammatik-Pflicht (wie `selectRound`: Fokus, sonst schwächstes Thema ohne Lektionsthema). */
export function dutyGrammarTopic(): string | null {
  const plan = useTodayPlan.getState().plan;
  if (!plan || dutyChannelOf(plan) !== 'gram') return null;
  const focus = planFocusTopic(plan);
  if (focus) return focus;
  const lessonTopic = plan.lesson ? (lessonMeta(plan.lesson)?.grammar ?? null) : null;
  const docs = useLive.getState().collections.grammar ?? new Map<string, Record<string, unknown>>();
  const ranked = rankTopics({ grammarDocs: docs, nowMs: useClock.getState().now, seed: plan.d });
  return ranked.map((r) => r.topic).find((t) => t !== lessonTopic) ?? null;
}

/** Ungesehene Aufgaben zum Thema in Pool und Tagesauftrag. */
function freshTasks(topic: string): number {
  const inputs = useLearnInputs.getState();
  const seen = seenOf(useLive.getState().collections.grammar?.get(topic));
  return [...inputs.dailyOpen, ...inputs.pool].filter((t) => t.topic === topic && !seen.has(t.key)).length;
}

async function prepLesson(lid: string, signal: AbortSignal): Promise<void> {
  const meta = lessonMeta(lid);
  if (!meta || useLearnInputs.getState().lessons.has(lid)) return;
  const db = getDb();
  if (!db) return;
  const r = await readDoc(db, `lesson/${lid}`);
  if (r.status !== 'missing') return;
  const lang = useSettings.getState().lang;
  const { stored } = await generateLesson(lid, meta, lang, signal, 'background');
  // Ist die Lektion gerade offen und wartet auf „Vorbereiten", steht der Inhalt sofort bereit.
  const run = useLessonRun.getState();
  if (run.lid === lid && run.status === 'choose') {
    const content = readLesson(stored, run.lang, meta);
    if (content) useLessonRun.setState({ status: 'ready', content: { ...content, source: 'ai' } });
  }
}

async function prepGrammar(topic: string, signal: AbortSignal): Promise<void> {
  if (freshTasks(topic) >= GRAM_FRESH_MIN) return;
  await generateTopicTasks(topic, signal, 'background');
}

const quiet = (scope: string) => (err: unknown) => {
  if (isAiFailure(err) && (err.kind === 'cancelled' || err.kind === 'unavailable' || err.kind === 'busy')) return;
  logWarn(scope, err);
};

/** Einmal je Lerntag: den Rest des Tages im Hintergrund vorbereiten. */
export function prepareDay(): void {
  const day = useClock.getState().today;
  if (doneFor === day) return;
  if (!selectAiAvailable(useCapabilities.getState())) return;
  const plan = useTodayPlan.getState().plan;
  if (!plan || plan.d !== day) return;
  doneFor = day;
  const signal = new AbortController().signal;
  // Nacheinander: Lektion zuerst (sie kommt in der Reihenfolge vor der Grammatik-Pflicht).
  void (async () => {
    if (plan.duty.includes('lesson') && plan.lesson) await prepLesson(plan.lesson, signal).catch(quiet('today:prep-lesson'));
    const topic = dutyGrammarTopic();
    if (topic) await prepGrammar(topic, signal).catch(quiet('today:prep-grammar'));
  })();
}

/** Nur für Tests. */
export function resetDayPrep(): void {
  doneFor = null;
}
