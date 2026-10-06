import { create } from 'zustand';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { dayKey } from '../../domain/date';
import { clozeCandidates } from '../../domain/drills/cloze';
import { orderPoolSize } from '../../domain/drills/orderPool';
import { buildSprintDeck } from '../../domain/drills/sprint';
import { readPlan } from '../../domain/plan/buildPlan';
import { comebackMode, restartActive } from '../../domain/plan/comeback';
import { cardStats } from '../../domain/plan/dayStats';
import { type FeasibleData } from '../../domain/plan/channels';
import { pflichtFor, pflichtMarked, type PflichtInput } from '../../domain/plan/pflicht';
import type { StoredPlan } from '../../domain/plan/types';
import { repairsDoneToday, repairsDutyToday, pickDailyRepairs } from '../../domain/repair/daily';
import { buildTrainCards, fehlersaetzeDue } from '../../domain/metrics';
import { freezeGrammarDay } from '../../domain/grammar/path';
import { patternsOf } from '../../domain/grammar/patterns';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { newQuotaLeft, quizzable } from '../../domain/srs/queue';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { buildUnitStored, unitDraft, type ReviewGoal } from '../../domain/unit/plan';
import { unitReviewGoal } from '../../domain/unit/review';
import { packTopUp } from './pack';
import { REPAIR_MAX } from '../../domain/unit/block1';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';
import { mergedVocab } from '../../domain/overview';
import { ensurePflichtSince, healPflicht, runDailyIntake } from '../progress/dayJobs';
import { setPflichtResolver, tabId, usePending } from '../progress/persist';
import { loadLearnInputs, setDailyOpen, useLearnInputs } from '../learn/inputs';
import { viewPlan } from './device';
import { computeDayWith } from './state';
import type { DayEntry } from '../../domain/plan/buildPlan';
import { normGoalMin } from '../../domain/progress/settings';
import { historyPatch, historySnapshot } from '../../domain/progress/history';
import { vocabGoal } from '../../domain/vocab/goal';
import { recordProfileFields } from '../progress/persist';

// Tagesplan = Tageseinheit (plan.md §1.5, N10/N12): einmal je Lerntag festgelegt und in
// app/profile.plan gespeichert, nie neu gewürfelt (Kap. 15). Ein schon gespeicherter Plan von heute
// (auch ein Plan von Phase 1/2 nach einem Update mitten am Tag) bleibt bis 04:00 unverändert.
//
// N14 „Heute sofort“ (leistung.md §4 Nr. 3, Anhang A Nr. 3): Der Plan steht nach dem ersten Abo –
// aus `app/profile.plan`, sonst aus der lokalen Kopie `lx:plan:<tag>`, sonst sofort neu berechnet
// (ohne `env`, M5; ohne Warten auf KI oder Sprachausgabe). Speichern, Tagesauftrag (`intake`),
// `pflichtSince`, Selbstheilung und Tagesbild laufen DANACH und blockieren die Statuszeile nie.

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

/** Einführungsplan je Thema (`introPlan` der Musterdatei, P2); Themen ohne Musterdatei haben keinen (`u.gt.pats` bleibt dann leer). */
const INTRO_PLAN_OF = (topic: string): string[][] | null => patternsOf(topic)?.introPlan ?? null;

// ------------------------------------------------------------------ lokale Kopie `lx:plan:<tag>`

const PLAN_PREFIX = `${KEY_PREFIX}plan:`;
const PLAN_KEEP = 3;

/** Lokale Kopie des Plans (Bequemlichkeit, Kap. 3.1: maßgeblich bleibt `app/profile.plan`). */
export function loadLocalPlan(day: string): StoredPlan | null {
  return readPlan(local.getJson<unknown>(`${PLAN_PREFIX}${day}`), day);
}

export function saveLocalPlan(plan: StoredPlan): void {
  const key = `${PLAN_PREFIX}${plan.d}`;
  const raw = JSON.stringify(plan);
  if (local.get(key) === raw) return;
  local.set(key, raw);
  const old = local
    .keys()
    .filter((k) => k.startsWith(PLAN_PREFIX))
    .sort()
    .slice(0, -PLAN_KEEP);
  for (const k of old) local.remove(k);
}

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

/**
 * Plan eines Lerntags: aktueller Plan, gemerkter Plan oder `app/profile.plan` (falls noch dieser Tag) –
 * in der Ansicht des Umbaus (ohne entfallene Blöcke, `domain/plan/retire`; nie vom Gerät abhängig). Die Pflicht-Prüfung (`pflichtFor`)
 * liest dieselbe Liste wie Zähler und Zeilen.
 */
function planFor(day: string, profile?: Readonly<Doc> | null): StoredPlan | null {
  const s = useTodayPlan.getState();
  if (s.day === day && s.plan && s.plan.d === day) return viewPlan(s.plan);
  return viewPlan(dayMemo.get(day)?.plan ?? readPlan(profile?.plan, day) ?? readPlan(useLive.getState().docs['app/profile']?.plan, day));
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
    // Fester Pool (02.10.2026): konstant, unabhängig von Lektionen und Pool-Aufgaben – ein gespeicherter Plan mit ch:order bleibt erfüllbar.
    order: orderPoolSize(),
    sprint: buildSprintDeck({ cards: visible, grammarDocs: live.collections.grammar ?? new Map(), pool: inputs.pool, lang, nowMs, seed: 'feasible', max: 40 }).length,
    vocab: visible.filter((c) => quizzable(c, lang, visible.length - 1)).length,
  };
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

/** Folgearbeiten erst nach dem Zeichnen der Statuszeile (P7-1, N14). */
function afterPaint(fn: () => void): void {
  if (typeof window === 'undefined') fn();
  else window.setTimeout(fn, 60);
}

/** Neuer Tagesplan der Einheit aus den Live-Daten (rein rechnend, schreibt nichts). */
export function buildTodayPlan(today: string, nowMs: number): StoredPlan {
  const live = useLive.getState();
  const profile = live.docs['app/profile'];
  const lang = useSettings.getState().lang;
  const goalMin = normGoalMin(profile?.goalMin);
  // Wiedereinstieg: die Neustart-Woche steht schon vor dem Plan fest (nur die Pause zählt), der Kurz-Plan nach 7–13 Tagen erst mit dem Überfälligen.
  const restart = restartActive(profile, today);
  const draft = unitDraft({ day: today, week: null, goalMin, ...(restart ? { comeback: 'restart' as const } : {}) });
  let review: ReviewGoal = { goal: 0, due: 0, fresh: 0, repairs: 0 };
  let facts: { ov: number; sure: number } | null = null;
  if (draft.duty.includes('review')) {
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
    // Wendungen (`chunk/*`) gehören zur täglichen Wiederholung (Kap. 5, M15): gleiche Planung.
    const all = [...cards, ...buildChunkCards(live.collections.chunk ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'chunk'))];
    const introduced = cards.filter((c) => c.intro === today);
    const entries = live.day?.key === today && Array.isArray(live.day.doc?.entries) ? (live.day.doc.entries as Array<{ type?: unknown; id?: unknown }>) : [];
    const repairs = pickDailyRepairs(live.docs['app/repair'], nowMs, repairsDoneToday(entries), REPAIR_MAX, repairsDutyToday(entries)).length;
    const quota = newQuotaLeft(profile?.newPerDay, introduced.length, introduced.filter((c) => c.src === 'lesson').length);
    review = unitReviewGoal({
      cards: all,
      repairs,
      nowMs,
      lang,
      budgetSec: draft.reviewSec,
      // Neustart-Woche: höchstens 2 neue Wörter (Gesamtkonzept 3.2, `03` §2).
      quotaLeft: restart ? Math.min(quota, 2) : quota,
    });
    const st = cardStats(all, lang, nowMs);
    facts = { ov: st.overdue, sure: st.sure };
  }
  // Die Neustart-Woche endet nach 7 Lerntagen oder sobald weniger als 40 Karten überfällig sind; danach Kurz-Plan, solange es ≥ 40 sind (Prüfbefund S9).
  const mode = comebackMode(profile, today, facts?.ov ?? null);
  // Fehlersätze: nichts fällig (früherer Lerntage) → der Schritt „Fehler korrigieren“ entfällt (Gesamtkonzept 3.2).
  const grammarDocs = live.collections.grammar ?? new Map();
  const fixDue = fehlersaetzeDue({ grammarDocs, repairDoc: live.docs['app/repair'], nowMs, today });
  // Das Grammatikthema des Tages und die Musterzustände vom Morgen werden mit dem Plan eingefroren (Lernplattform 2.0 §2.3, für jeden neuen Plan).
  const { gt, ps } = freezeGrammarDay({ docs: grammarDocs, today, nowMs, introPlanOf: INTRO_PLAN_OF, seed: today });
  return buildUnitStored({ day: today, nowMs, week: null, goalMin, review, fixDue, gt, ps, ...(mode ? { comeback: mode } : {}), ...(facts ? { ov: facts.ov, sure: facts.sure } : {}) });
}

/** Plan in `app/profile.plan` speichern – außer ein anderes Gerät hat für heute schon einen (der gilt). */
async function storePlan(today: string, plan: StoredPlan): Promise<void> {
  let final: StoredPlan = plan;
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
      return { update: { plan } };
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
    saveLocalPlan(final);
    useTodayPlan.setState({ day: today, plan: final, status });
  }
}

// Bleibt `async` (Aufrufer und Tests erwarten ein Promise), seit dem Fokus-Umbau ohne Warten auf `app/week`.
// eslint-disable-next-line @typescript-eslint/require-await
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

  // 1) Gespeicherter Plan von heute (auch Phase 1/2): sofort zeichnen, nie ändern.
  const kept = readPlan(useLive.getState().docs['app/profile']?.plan, today);
  if (kept) {
    useTodayPlan.setState({ day: today, plan: kept, status: 'ready' });
    saveLocalPlan(kept);
    afterPaint(() => void followUp(today, nowMs, null));
    return;
  }
  // 2) Lokale Kopie (z. B. Neuladen, bevor das Speichern ankam): sofort zeichnen, danach speichern.
  const localPlan = loadLocalPlan(today);
  if (localPlan) {
    useTodayPlan.setState({ day: today, plan: localPlan, status: 'ready' });
    afterPaint(() => void followUp(today, nowMs, localPlan));
    return;
  }
  // 3) Neuer Plan (seit dem Fokus-Umbau ohne Wochenthema: nie Warten auf `app/week`, KI oder Schreiben).
  let built: StoredPlan;
  try {
    const again = readPlan(useLive.getState().docs['app/profile']?.plan, today);
    built = again ?? buildTodayPlan(today, nowMs);
  } catch (err) {
    // Nie endlos im Ladezustand: Hinweis mit „Erneut versuchen" (Kap. 3.4, keine stillen Fehler).
    logError('today:plan', err, 'Aufbau');
    if (useTodayPlan.getState().day === today) useTodayPlan.setState({ day: today, plan: null, status: 'error' });
    return;
  }
  useTodayPlan.setState({ day: today, plan: built, status: 'ready' });
  saveLocalPlan(built);
  afterPaint(() => void followUp(today, nowMs, built));
}

/** Nach dem ersten Bild: Plan speichern, Tagesauftrag, Lerninhalte, dann Schritte 3 bis 5. */
async function followUp(today: string, nowMs: number, toStore: StoredPlan | null): Promise<void> {
  if (toStore) await storePlan(today, toStore);
  try {
    await intake(today, nowMs);
  } catch (err) {
    logError('day:daily', err, 'Abgleich');
  }
  // C1-Paket: bis zu 2 geprüfte Einträge je Lerntag als neue Karten (nach den eigenen Funden im Korb).
  try {
    await packTopUp(today, nowMs);
  } catch (err) {
    logError('day:pack', err, 'C1-Paket');
  }
  await loadLearnInputs();
  await afterPlan(today, nowMs);
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
  void recordProfileFields('today:history', (cur) => historyPatch(cur, historySnapshot({ day: today, nowMs, profile: cur, grammar: live.collections.grammar ?? new Map(), vocabNow: goal.now, festNow: goal.fest }))).then((ok) => {
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
  if (s.status === 'ready' && profile && readPlan(profile.plan, today)) {
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
  await healPflicht(writer, dutyInput(s.day, viewPlan(s.plan) ?? s.plan));
}

/**
 * Selbstheilung `pflicht[day]` für einen bestimmten Lerntag (z. B. Block der Tageseinheit, der vor
 * 04:00 begonnen und danach beendet wurde). Setzt nur, entfernt nie.
 */
export async function healDay(day: string): Promise<void> {
  const writer = getWriter();
  const plan = planFor(day);
  if (!plan || !writer) return;
  await healPflicht(writer, dutyInput(day, plan));
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
