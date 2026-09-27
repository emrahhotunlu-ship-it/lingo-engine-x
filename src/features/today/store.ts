import { create } from 'zustand';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { dayKey } from '../../domain/date';
import { pickLesson } from '../../domain/course/next';
import { clozeCandidates } from '../../domain/drills/cloze';
import { orderSentences } from '../../domain/drills/sources';
import { buildSprintDeck } from '../../domain/drills/sprint';
import { dueErrors } from '../../domain/grammar/errors';
import { buildPlan, readPlan } from '../../domain/plan/buildPlan';
import { rankChannels, type FeasibleData } from '../../domain/plan/channels';
import { pflichtFor } from '../../domain/plan/pflicht';
import type { StoredPlan } from '../../domain/plan/types';
import { buildTrainCards } from '../../domain/srs/cards';
import { dueCards, planRound, quizzable } from '../../domain/srs/queue';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { useSpeech } from '../../platform/speech';
import { mergedVocab } from '../../domain/overview';
import { ensurePflichtSince, healPflicht, runDailyIntake } from '../progress/dayJobs';
import { setPflichtResolver, tabId, usePending } from '../progress/persist';
import { loadLearnInputs, recentLessonLines, setDailyOpen, useLearnInputs } from '../learn/inputs';
import { computeToday } from './state';
import { assessPlanInput } from '../../domain/assessment/planInput';
import { normGoalMin } from '../../domain/progress/settings';
import { historyPatch, historySnapshot } from '../../domain/progress/history';
import { vocabGoal } from '../../domain/vocab/goal';
import { recordProfileFields } from '../progress/persist';

// Tagesplan: einmal je Lerntag festgelegt und in app/profile.plan gespeichert, nie neu
// gewürfelt (Kap. 15). Ist das Speichern nicht möglich, gilt der lokal berechnete Plan für
// den Tag (eingefroren), und nichts wird überschrieben.
//
// `ensureDay` (phase2-plan §6.4), jeder Schritt protokolliert und blockiert die folgenden nicht:
// 1. alle liegengebliebenen `daily/*` → Karten und Pool (einmal je Tab und Lerntag),
// 2. Plan (nur ohne Plan dieser App von heute; ein Phase-1-Plan von heute bleibt bis 04:00),
// 3. `pflichtSince` (einmal je Datenbank, nur mit Phase-2-Plan von heute),
// 4. Selbstheilung `pflicht[heute]`.

type Doc = Record<string, unknown>;

type PlanState = {
  day: string | null;
  plan: StoredPlan | null;
  status: 'idle' | 'building' | 'ready' | 'local' | 'error';
  /** Lerntag, an dem die Pflichtrunde „Wiederholen" erschöpft war (nichts mehr abzufragen). */
  exhausted: string | null;
};

export const useTodayPlan = create<PlanState>(() => ({ day: null, plan: null, status: 'idle', exhausted: null }));

let intakeDay: string | null = null;

/** Machbarkeit der Kanäle aus den Karten und Pool-Aufgaben (phase2-plan §6.1). */
export function feasibleData(cards: readonly TrainCard[], lang: Lang, nowMs: number): FeasibleData {
  const live = useLive.getState();
  const visible = cards.filter((c) => !c.hidden);
  const inputs = useLearnInputs.getState();
  return {
    cloze: clozeCandidates(visible).length,
    order: orderSentences({ lessonLines: recentLessonLines(lang), extraTasks: inputs.pool }).length,
    sprint: buildSprintDeck({ cards: visible, grammarDocs: live.collections.grammar ?? new Map(), pool: inputs.pool, lang, nowMs, seed: 'feasible', max: 40 }).length,
    vocab: visible.filter((c) => quizzable(c, lang, visible.length - 1)).length,
  };
}

/** Fokus-Aktion der Einschätzung (`grammar:<topic>`, `colloc` …), nur bei passender Sprache. */
function focusAction(assess: Doc | null | undefined, lang: Lang): string | null {
  if (!assess) return null;
  if (typeof assess.lang === 'string' && assess.lang !== lang) return null;
  const data = assess.data && typeof assess.data === 'object' ? (assess.data as Doc) : assess;
  const focus = data.focus && typeof data.focus === 'object' ? (data.focus as Doc) : null;
  return typeof focus?.action === 'string' ? focus.action.trim() || null : null;
}

async function intake(today: string, nowMs: number): Promise<void> {
  if (intakeDay === today) return;
  const db = getDb();
  const writer = getWriter();
  if (!db || !writer) return;
  const live = useLive.getState();
  const known = new Set(mergedVocab(live.collections.vocab ?? new Map()).keys());
  const res = await runDailyIntake({ db, writer, nowMs, tab: tabId(), today, knownVocab: known, grammarDocs: live.collections.grammar ?? new Map() });
  setDailyOpen(today, res.openTasks);
  // „belegt" oder Fehler: beim nächsten ensureDay erneut (nie in einer Schleife).
  if (res.status === 'done') intakeDay = today;
}

export async function ensureDay(nowMs: number): Promise<void> {
  const today = dayKey(nowMs);
  const cur = useTodayPlan.getState();
  if (cur.day === today && cur.status !== 'idle') {
    // Plan steht: nur Selbstheilung (z. B. beim Sichtbarwerden der Seite).
    if (cur.status === 'ready' || cur.status === 'local') void afterPlan(today, nowMs);
    return;
  }
  useTodayPlan.setState({ day: today, plan: null, status: 'building', exhausted: cur.exhausted === today ? today : null });

  try {
    await intake(today, nowMs);
  } catch (err) {
    logError('day:daily', err, 'Abgleich');
  }
  await loadLearnInputs();

  const live = useLive.getState();
  const profile = live.docs['app/profile'];
  let built: ReturnType<typeof buildPlan>;
  try {
    const kept = readPlan(profile?.plan, today);
    if (kept) {
      useTodayPlan.setState({ day: today, plan: kept, status: 'ready' });
      void afterPlan(today, nowMs);
      return;
    }
    const lang = useSettings.getState().lang;
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
    const round = planRound({
      cards,
      nowMs,
      newPerDay: typeof profile?.newPerDay === 'number' ? profile.newPerDay : 5,
      introducedToday: cards.filter((c) => c.intro === today).length,
      introducedLessonToday: cards.filter((c) => c.intro === today && c.src === 'lesson').length,
      lang,
    });
    const visible = cards.filter((c) => !c.hidden);
    const ranked = rankChannels({
      today,
      profile: profile ?? {},
      focus: focusAction(live.docs['app/assess'], lang),
      assess: assessPlanInput(live.docs['app/assess'], today),
      dueErrors: dueErrors(live.collections.grammar ?? new Map(), nowMs).length,
      dueCards: dueCards(visible, nowMs).length,
      data: feasibleData(cards, lang, nowMs),
      env: { tts: useSpeech.getState().status === 'ready' },
    });
    const lesson = pickLesson({ course: live.docs['app/course'], assess: live.docs['app/assess'], lang });
    built = buildPlan({ today, existing: profile?.plan, round, nowMs, phase2: { ranked, lesson, goalMin: normGoalMin(profile?.goalMin) } });
  } catch (err) {
    // Nie endlos im Ladezustand: Hinweis mit „Erneut versuchen" (Kap. 3.4, keine stillen Fehler).
    logError('today:plan', err, 'Aufbau');
    if (useTodayPlan.getState().day === today) useTodayPlan.setState({ day: today, plan: null, status: 'error' });
    return;
  }
  let final: StoredPlan = built.plan;
  let status: PlanState['status'] = 'ready';
  const writer = getWriter();
  try {
    if (!writer) throw new Error('Kein Schreibzugriff');
    let invalid = false;
    await writer.transform('app/profile', (doc) => {
      if (!doc) return null;
      if (!validateDoc('app/profile', doc).ok) {
        invalid = true;
        return null;
      }
      const other = readPlan(doc.plan, today);
      if (other) {
        final = other;
        return null;
      }
      return { update: { plan: built.plan } };
    });
    if (invalid) {
      status = 'local';
      logWarn('today:plan', { code: 'invalid_document', message: 'Profil ungültig – Tagesplan nur lokal' }, 'app/profile');
    }
  } catch (err) {
    status = 'local';
    logError('today:plan', err, 'app/profile');
  }
  if (useTodayPlan.getState().day === today) {
    useTodayPlan.setState({ day: today, plan: final, status });
    void afterPlan(today, nowMs);
  }
}

let historyDay: string | null = null;

/**
 * Schritt 5 (Plan §5.4): ein Tagesbild je Lerntag in `profile.history` (≤ 120, `lx: 1`) – über die
 * eine Sammel-Warteschlange, nur bei gültigem Profil und nur, wenn es für heute noch fehlt.
 */
function ensureHistory(today: string, nowMs: number): void {
  if (historyDay === today) return;
  const live = useLive.getState();
  const profile = live.docs['app/profile'];
  if (!profile) return;
  historyDay = today;
  const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
  const goal = vocabGoal({ profile, cards, today });
  void recordProfileFields('today:history', (cur) => historyPatch(cur, historySnapshot({ day: today, nowMs, profile: cur, grammar: live.collections.grammar ?? new Map(), vocabNow: goal.now }))).then((ok) => {
    if (!ok) historyDay = null;
  });
}

/** Schritte 3 bis 5 (nur mit gespeichertem Plan; ein lokaler Plan setzt nie `pflichtSince`). */
async function afterPlan(today: string, nowMs: number): Promise<void> {
  const s = useTodayPlan.getState();
  if (s.day !== today || !s.plan) return;
  setPflichtResolver(resolvePflicht);
  if (s.status === 'ready') ensureHistory(today, nowMs);
  const writer = getWriter();
  if (!writer) return;
  const live = useLive.getState();
  const profile = live.docs['app/profile'];
  if (s.status === 'ready' && profile) {
    const lang = useSettings.getState().lang;
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
    const data = feasibleData(cards, lang, nowMs);
    await ensurePflichtSince({ writer, nowMs, tab: tabId(), today, plan: s.plan, schema: live.docs['app/schema'], profile, tts: false, ai: false, data: { cloze: data.cloze, order: data.order } });
  }
  await healToday();
}

/** Selbstheilung `pflicht[heute]` aus dem aktuellen Stand (live ⊕ Puffer). Setzt nur, entfernt nie. */
export async function healToday(): Promise<void> {
  const s = useTodayPlan.getState();
  const writer = getWriter();
  if (!s.plan || !s.day || !writer) return;
  const st = computeToday(s.day);
  const review = st.duties.items.find((d) => d.id === 'review');
  const ch = s.plan.duty.find((d) => d.startsWith('ch:'))?.slice(3) ?? null;
  const pending = usePending.getState();
  await healPflicht(writer, {
    day: s.day,
    plan: s.plan,
    reviewDone: !review || review.state === 'done',
    exhausted: s.exhausted === s.day,
    course: useLive.getState().docs['app/course'],
    pendingLessonDay: pending.lessonDays.includes(s.day),
    pendingChannelDone: !!ch && pending.rounds.some((r) => r.day === s.day && r.act === ch && !r.partial),
  });
}

/** Pflicht-Resolver für die Sammel-Warteschlange (Regel 1, im Profil-`transform`). */
function resolvePflicht(i: { profile: Readonly<Doc>; batch: { answers: ReadonlyArray<{ day: string }>; counts: ReadonlyArray<{ day: string }>; rounds: ReadonlyArray<{ day: string; act: string; partial: boolean }> } }): string | null {
  const s = useTodayPlan.getState();
  const plan = s.plan;
  if (!plan || !s.day || plan.d !== s.day) return null;
  const day = s.day;
  const st = computeToday(day);
  const review = st.duties.items.find((d) => d.id === 'review');
  const ch = plan.duty.find((d) => d.startsWith('ch:'))?.slice(3) ?? null;
  const pending = usePending.getState();
  const batchActivity = i.batch.answers.some((a) => a.day === day) || i.batch.counts.some((c) => c.day === day) || i.batch.rounds.some((r) => r.day === day);
  const ok = pflichtFor({
    day,
    plan,
    profile: i.profile,
    batchActivity,
    reviewDone: !review || review.state === 'done',
    exhausted: s.exhausted === day,
    course: useLive.getState().docs['app/course'],
    pendingLessonDay: pending.lessonDays.includes(day),
    pendingChannelDone: !!ch && (i.batch.rounds.some((r) => r.day === day && r.act === ch && !r.partial) || pending.rounds.some((r) => r.day === day && r.act === ch && !r.partial)),
  });
  return ok ? day : null;
}

/** Die Pflichtrunde „Wiederholen" hatte nichts mehr abzufragen (§6.3, Regel 1b). */
export function markExhausted(day: string): void {
  if (useTodayPlan.getState().exhausted === day) return;
  useTodayPlan.setState({ exhausted: day });
}

/** Nach einem Fehler beim Aufbau: einmal neu versuchen (nur per Knopf, nie automatisch). */
export function retryPlan(nowMs: number): void {
  useTodayPlan.setState({ status: 'idle' });
  void ensureDay(nowMs);
}

/** Nur für Tests. */
export function resetTodayForTests(): void {
  intakeDay = null;
  historyDay = null;
  useTodayPlan.setState({ day: null, plan: null, status: 'idle', exhausted: null });
}
