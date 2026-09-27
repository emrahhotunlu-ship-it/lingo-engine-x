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
import { pflichtFor, pflichtMarked, type PflichtInput } from '../../domain/plan/pflicht';
import type { StoredPlan } from '../../domain/plan/types';
import { buildTrainCards } from '../../domain/srs/cards';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { dueCards, planRound, quizzable } from '../../domain/srs/queue';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { useSpeech } from '../../platform/speech';
import { mergedVocab } from '../../domain/overview';
import { ensurePflichtSince, healPflicht, runDailyIntake } from '../progress/dayJobs';
import { setPflichtResolver, tabId, usePending } from '../progress/persist';
import { loadLearnInputs, recentLessonLines, setDailyOpen, useLearnInputs } from '../learn/inputs';
import { computeDayWith } from './state';
import type { DayEntry } from '../../domain/plan/buildPlan';
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
/** H4: Lerntag, an dem nach 20 Uhr schon einmal neu abgeglichen wurde. */
let lateIntakeDay: string | null = null;
const LATE_INTAKE_HOUR = 20;

// B1: Pläne und zuletzt bekannte Live-Einträge der letzten Lerntage – damit ein Stapel, der erst
// nach 04:00 ankommt (Funkloch) oder aus einer Runde über 04:00 stammt, die Pflicht seines Tages
// noch setzen kann. Nur im Speicher; nach dem Neuladen hilft `app/profile.plan`, solange es noch
// den Vortag trägt.
type DayMemo = { plan?: StoredPlan; entries?: readonly DayEntry[] };
const MEMO_DAYS = 3;
const dayMemo = new Map<string, DayMemo>();
const exhaustedDays = new Set<string>();
const healedPast = new Set<string>();

function remember(day: string, m: DayMemo): void {
  dayMemo.set(day, { ...dayMemo.get(day), ...m });
  if (dayMemo.size > MEMO_DAYS) {
    const oldest = [...dayMemo.keys()].sort()[0];
    if (oldest !== undefined) dayMemo.delete(oldest);
  }
}

useTodayPlan.subscribe((s) => {
  if (s.day && s.plan && s.plan.d === s.day && dayMemo.get(s.day)?.plan !== s.plan) remember(s.day, { plan: s.plan });
  if (s.exhausted) exhaustedDays.add(s.exhausted);
});
useLive.subscribe((s) => {
  const d = s.day;
  if (d?.key && d.doc && Array.isArray(d.doc.entries) && dayMemo.get(d.key)?.entries !== d.doc.entries) remember(d.key, { entries: d.doc.entries as DayEntry[] });
});

/** Plan eines Lerntags: aktueller Plan, gemerkter Plan oder `app/profile.plan` (falls noch dieser Tag). */
function planFor(day: string, profile?: Readonly<Doc> | null): StoredPlan | null {
  const s = useTodayPlan.getState();
  if (s.day === day && s.plan && s.plan.d === day) return s.plan;
  return dayMemo.get(day)?.plan ?? readPlan(profile?.plan, day) ?? readPlan(useLive.getState().docs['app/profile']?.plan, day);
}

/** Eingaben für `pflichtFor`/`healPflicht` eines Lerntags (live ⊕ Puffer ⊕ Gemerktes). */
function dutyInput(day: string, plan: StoredPlan): Omit<PflichtInput, 'profile' | 'batchActivity'> {
  const exhausted = exhaustedDays.has(day) || useTodayPlan.getState().exhausted === day;
  const st = computeDayWith({ day, plan, exhausted, entries: dayMemo.get(day)?.entries });
  const review = st.duties.items.find((d) => d.id === 'review');
  const ch = plan.duty.find((d) => d.startsWith('ch:'))?.slice(3) ?? null;
  const pending = usePending.getState();
  return {
    day,
    plan,
    reviewDone: !review || review.state === 'done',
    exhausted,
    course: useLive.getState().docs['app/course'],
    pendingLessonDay: pending.lessonDays.includes(day),
    pendingChannelDone: !!ch && pending.rounds.some((r) => r.day === day && r.act === ch && !r.partial),
  };
}

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

/**
 * P7-1: Folgearbeiten (Tagesbild, pflichtSince, Selbstheilung) erst nach dem Zeichnen der
 * Statuszeile – sie rechnen über alle Karten und würden sonst das erste Bild verzögern.
 */
function afterPaint(fn: () => void): void {
  if (typeof window === 'undefined') fn();
  else window.setTimeout(fn, 60);
}

export async function ensureDay(nowMs: number): Promise<void> {
  const today = dayKey(nowMs);
  const cur = useTodayPlan.getState();
  if (cur.day === today && cur.status !== 'idle') {
    // Plan steht: nur Selbstheilung (z. B. beim Sichtbarwerden der Seite).
    if (cur.status === 'ready' || cur.status === 'local') void afterPlan(today, nowMs);
    lateIntake(today, nowMs);
    return;
  }
  useTodayPlan.setState({ day: today, plan: null, status: 'building', exhausted: cur.exhausted === today ? today : null });

  // P7-1 (a): Gibt es schon einen Plan dieser App von heute, zeigt Heute ihn sofort; Abgleich des
  // Tagesauftrags und Lerninhalte laufen danach (sie ändern einen Plan von heute nie).
  const early = readPlan(useLive.getState().docs['app/profile']?.plan, today);
  if (early) useTodayPlan.setState({ day: today, plan: early, status: 'ready' });

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
      afterPaint(() => void afterPlan(today, nowMs));
      return;
    }
    const lang = useSettings.getState().lang;
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
    // Wendungen (`chunk/*`) gehören zur täglichen Wiederholung (Kap. 5, M15): gleiche Planung.
    const round = planRound({
      cards: [...cards, ...buildChunkCards(live.collections.chunk ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'chunk'))],
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
    afterPaint(() => void afterPlan(today, nowMs));
  }
}

/**
 * H4: Beim Sichtbarwerden nach 20 Uhr einmal je Lerntag den Tagesauftrag neu abgleichen (er kann
 * im Laufe des Tages ankommen). Kein Zeitgeber, keine Schleife: nur aus `ensureDay`.
 */
function lateIntake(today: string, nowMs: number): void {
  if (lateIntakeDay === today || new Date(nowMs).getHours() < LATE_INTAKE_HOUR) return;
  lateIntakeDay = today;
  intakeDay = null;
  void intake(today, nowMs).catch((err: unknown) => logError('day:daily', err, 'Abgleich am Abend'));
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
  await healPastDays(today);
}

/** Selbstheilung `pflicht[heute]` aus dem aktuellen Stand (live ⊕ Puffer). Setzt nur, entfernt nie. */
export async function healToday(): Promise<void> {
  const s = useTodayPlan.getState();
  const writer = getWriter();
  if (!s.plan || !s.day || !writer) return;
  await healPflicht(writer, dutyInput(s.day, s.plan));
}

/** B1: beim Tageswechsel einmal die gemerkten Vortage heilen (setzt nur, entfernt nie). */
async function healPastDays(today: string): Promise<void> {
  const writer = getWriter();
  if (!writer) return;
  for (const day of [...dayMemo.keys()].sort()) {
    if (day >= today || healedPast.has(day)) continue;
    const plan = planFor(day);
    if (!plan) continue;
    healedPast.add(day);
    await healPflicht(writer, dutyInput(day, plan));
  }
}

/**
 * Pflicht-Resolver für die Sammel-Warteschlange (Regel 1, im Profil-`transform`). B1: prüft JEDEN
 * Lerntag im Stapel mit dessen Plan – auch den Vortag nach 04:00. Liefert die Tage, deren Pflicht
 * jetzt erfüllt ist (nur setzen, nie entfernen; `pflichtSince` bleibt unberührt).
 */
export function resolvePflicht(i: { profile: Readonly<Doc>; batch: { answers: ReadonlyArray<{ day: string }>; counts: ReadonlyArray<{ day: string }>; rounds: ReadonlyArray<{ day: string; act: string; partial: boolean }> } }): string[] | null {
  const days = new Set<string>();
  for (const x of [...i.batch.answers, ...i.batch.counts, ...i.batch.rounds]) days.add(x.day);
  const out: string[] = [];
  for (const day of [...days].sort()) {
    if (pflichtMarked(i.profile, day)) continue;
    const plan = planFor(day, i.profile);
    if (!plan) continue;
    const base = dutyInput(day, plan);
    const ch = plan.duty.find((d) => d.startsWith('ch:'))?.slice(3) ?? null;
    const ok = pflichtFor({
      ...base,
      profile: i.profile,
      batchActivity: true,
      pendingChannelDone: base.pendingChannelDone || (!!ch && i.batch.rounds.some((r) => r.day === day && r.act === ch && !r.partial)),
    });
    if (ok) out.push(day);
  }
  return out.length ? out : null;
}

/** Die Pflichtrunde „Wiederholen" hatte nichts mehr abzufragen (§6.3, Regel 1b). */
export function markExhausted(day: string): void {
  exhaustedDays.add(day);
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
  lateIntakeDay = null;
  historyDay = null;
  dayMemo.clear();
  exhaustedDays.clear();
  healedPast.clear();
  useTodayPlan.setState({ day: null, plan: null, status: 'idle', exhausted: null });
}
