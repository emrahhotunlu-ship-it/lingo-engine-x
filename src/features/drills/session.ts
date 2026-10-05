import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { buildCloze, CLOZE_ROUND, type ClozeItem } from '../../domain/drills/cloze';
import { buildOrder, ORDER_ROUND, type OrderItem } from '../../domain/drills/order';
import { orderPool, poolNorm, type PoolEntry } from '../../domain/drills/orderPool';
import { dictationSentences, type DrillSentence } from '../../domain/drills/sources';
import { buildSprintDeck, type SprintItem } from '../../domain/drills/sprint';
import type { Ctx, DrillAnswer, RadarEvent, SprintEntry } from '../../domain/learn/types';
import { DUTY_ROUND } from '../../domain/plan/channels';
import { hash32, mulberry32, shuffle } from '../../domain/random';
import { buildTrainCards } from '../../domain/srs/cards';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { learnRecorder } from '../progress/persist';
import { useLearnInputs } from '../learn/inputs';
import { roundCtx } from '../today/state';
import { unitDone } from '../../app/unit/done';
import type { UnitBlockNo } from '../../app/unit/types';
import { noteResult, noteSeen, prefetchOrder, seenSentences, takeStock, wrongTopics } from './orderGen';

// Übungen ohne KI (phase2-plan §5.4–5.7): Diktat, Lückenjagd, Satzbau, Sprint. Die Runde wird
// synchron im Klick gebaut und eingefroren. Übungen schreiben nie `grammar/*` oder `vocab/*`
// (D12), nur Log (außer Sprint), Zähler, `act`, Radar und `sprints`.

export type DrillKind = 'dictate' | 'cloze' | 'order' | 'sprint';
export type DrillRow = { label: string; ok: boolean; verdict: DrillAnswer['verdict'] };
export type DictItem = DrillSentence;

type State = {
  active: boolean;
  status: 'running' | 'summary';
  kind: DrillKind;
  ctx: Ctx;
  day: string;
  lang: Lang;
  dictate: DictItem[];
  cloze: ClozeItem[];
  order: OrderItem[];
  sprint: SprintItem[];
  /** Karten der Runde (Beispiele, Nachschlagen). */
  cards: Map<string, TrainCard>;
  allCols: Array<{ p: string; gap: string }>;
  pos: number;
  step: number;
  results: DrillRow[];
  activeMs: number;
  lastInteract: number;
  /** Block der Tageseinheit (Satzbau als Block 3 seit 04.10.2026), sonst `null`. */
  block: UnitBlockNo | null;
};

export const DICTATE_ROUND = 8;

export const useDrill = create<State>(() => ({
  active: false,
  status: 'running',
  kind: 'cloze',
  ctx: 'xtra',
  day: '',
  lang: 'de',
  dictate: [],
  cloze: [],
  order: [],
  sprint: [],
  cards: new Map(),
  allCols: [],
  pos: 0,
  step: 0,
  results: [],
  activeMs: 0,
  lastInteract: 0,
  block: null,
}));

const IDLE_CAP_MS = 60_000;
let roundNo = 0;

/** Karten wie im Trainer (Datenbank über Voreinstellungen), ohne ausgeblendete. */
export function drillCards(nowMs: number): TrainCard[] {
  const live = useLive.getState();
  return buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab')).filter((c) => !c.hidden);
}

export function dictationItems(cards: readonly TrainCard[], seed: string, n = DICTATE_ROUND): DictItem[] {
  const all = dictationSentences({ cards });
  // Überwiegend Bekanntes: aus den ersten Kandidaten (bekannte, fällige Karten zuerst) gemischt.
  const head = all.slice(0, Math.max(n * 3, 12));
  return shuffle(head, mulberry32(hash32(seed))).slice(0, n);
}

/**
 * Satzbau-Runde: neue, geprüfte Sätze von Claude (`extra`, höchstens die Hälfte), der Rest aus dem festen Pool.
 * Kürzlich gesehene Sätze (`seen`) werden gemieden, solange genug übrig bleiben; Themen mit zuletzt falschen Sätzen
 * (`wrong`) bekommen bis zur Hälfte der festen Plätze, aber mit anderen Sätzen als zuletzt.
 */
export function orderItems(seed: string, n = ORDER_ROUND, opts: { extra?: readonly PoolEntry[]; seen?: ReadonlySet<string>; wrong?: readonly string[] } = {}): OrderItem[] {
  const rng = mulberry32(hash32(seed));
  const extra = (opts.extra ?? []).slice(0, Math.ceil(n / 2));
  const seen = opts.seen ?? new Set<string>();
  const slots = n - extra.length;
  const unseen = orderPool().filter((e) => !seen.has(poolNorm(e.en)));
  const base = shuffle(unseen.length >= slots ? unseen : orderPool(), rng);
  const wrong = opts.wrong ?? [];
  const onWrong = base.filter((e) => wrong.includes(e.topic)).slice(0, Math.ceil(slots / 2));
  const fixed = [...onWrong, ...base.filter((e) => !onWrong.includes(e))].slice(0, slots);
  return shuffle([...extra, ...fixed], rng).map((e) => buildOrder(e, { seed }));
}

/** Wörter aus Emrahs Wortschatz als Kontext für neue Sätze (gelernte zuerst, fällige vor den übrigen). */
const contextWords = (cards: readonly TrainCard[]): string[] =>
  cards
    .filter((c) => !c.isNew && !c.hidden && c.word)
    .sort((a, b) => a.fsrs.due - b.fsrs.due)
    .slice(0, 12)
    .map((c) => c.word);

/** Thema eines Satzbau-Satzes (aus der Herkunft `rules/<topic>` bzw. `grammar/<topic>`). */
export const orderTopic = (it: OrderItem): string | null => /\|(?:rules|grammar)\/([a-z0-9-]+)$/.exec(it.key)?.[1] ?? null;

/** Runde bauen. Rückgabe: Eingabeart der ersten Aufgabe (für den Fokus im selben Handler). */
export function startDrill(kind: DrillKind, day?: string, block: UnitBlockNo | null = null): 'typed' | 'choice' | null {
  const nowMs = useClock.getState().now;
  const d = day ?? useClock.getState().today;
  const lang = useSettings.getState().lang;
  const cards = drillCards(nowMs);
  const ctx: Ctx = block ? 'duty' : kind === 'cloze' || kind === 'order' ? roundCtx(kind, d) : 'xtra';
  roundNo++;
  // Satzbau: nach einem Neuladen beginnt `roundNo` wieder bei 1; die Startzeit sorgt für andere Sätze als in der Runde davor.
  const seed = kind === 'order' ? `${d}|${kind}|${roundNo}|${nowMs}` : `${d}|${kind}|${roundNo}`;
  const live = useLive.getState();
  const base: State = {
    ...useDrill.getState(),
    active: true,
    status: 'running',
    kind,
    ctx,
    day: d,
    lang,
    dictate: [],
    cloze: [],
    order: [],
    sprint: [],
    cards: new Map(cards.map((c) => [c.id, c])),
    allCols: cards.flatMap((c) => c.col.filter((x) => x.p && x.gap).map((x) => ({ p: x.p, gap: x.gap }))),
    pos: 0,
    step: useDrill.getState().step + 1,
    results: [],
    activeMs: 0,
    lastInteract: performance.now(),
    block,
  };
  if (kind === 'dictate') base.dictate = dictationItems(cards, seed);
  else if (kind === 'cloze') base.cloze = buildCloze({ cards, seed, n: ctx === 'duty' ? DUTY_ROUND.cloze : CLOZE_ROUND });
  else if (kind === 'order') {
    const n = ctx === 'duty' ? DUTY_ROUND.order : ORDER_ROUND;
    const wrong = wrongTopics();
    base.order = orderItems(seed, n, { extra: takeStock(Math.ceil(n / 2), wrong), seen: new Set(seenSentences()), wrong });
    noteSeen(base.order.map((it) => it.sentence));
    // Nächste Runde vorbereiten (im Hintergrund, eine Handlung von Emrah: Runde gestartet).
    prefetchOrder(contextWords(cards));
  }
  else base.sprint = buildSprintDeck({ cards, grammarDocs: live.collections.grammar ?? new Map(), pool: useLearnInputs.getState().pool, lang, nowMs, seed });
  const len = itemsOf(base).length;
  if (!len) base.status = 'summary';
  useDrill.setState(base);
  if (!len) return null;
  return kind === 'cloze' ? 'typed' : kind === 'sprint' ? (base.sprint[0]?.opts ? 'choice' : 'typed') : null;
}

export function itemsOf(s: Pick<State, 'kind' | 'dictate' | 'cloze' | 'order' | 'sprint'>): readonly unknown[] {
  return s.kind === 'dictate' ? s.dictate : s.kind === 'cloze' ? s.cloze : s.kind === 'order' ? s.order : s.sprint;
}

export function touchDrill(): void {
  const s = useDrill.getState();
  if (!s.active) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useDrill.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

function roundEnd(s: State, aborted: boolean, sprint?: SprintEntry): void {
  const n = s.results.length;
  if (n < 1) return;
  // Satzbau: Vorrat für die nächste Runde auffüllen (im Hintergrund, nach einer beendeten Runde).
  if (s.kind === 'order' && !aborted) prefetchOrder(contextWords([...s.cards.values()]));
  void learnRecorder.roundEnd({
    day: s.day,
    act: s.kind,
    ctx: s.ctx,
    partial: aborted && s.pos < itemsOf(s).length,
    n,
    right: s.results.filter((r) => r.ok).length,
    activeMs: s.activeMs,
    ...(sprint ? { sprint } : {}),
  });
}

/** Antwort einer Übung übernehmen und weiter. Rückgabe: Eingabeart der nächsten Aufgabe. */
export function commitDrill(a: DrillAnswer, label: string): 'typed' | 'choice' | null {
  touchDrill();
  const s = useDrill.getState();
  learnRecorder.drill(a);
  // Ein Fehler bei einem Satz von Claude (nur formal geprüft) macht das Thema nicht zum Fehlerthema.
  if (s.kind === 'order' && !(s.order[s.pos] as OrderItem).ai) noteResult(orderTopic(s.order[s.pos] as OrderItem), a.verdict);
  const results = [...s.results, { label, ok: a.verdict !== 'wrong', verdict: a.verdict }];
  const pos = s.pos + 1;
  const done = pos >= itemsOf(s).length;
  const next: State = { ...s, results, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (done) roundEnd(next, false);
  useDrill.setState(next);
  if (done) return null;
  return s.kind === 'cloze' ? 'typed' : null;
}

/** Sprint beendet (Zeit abgelaufen): `sprints`, `act.sprint`, Radar – kein Log, kein FSRS/BKT. */
export function finishSprint(entry: SprintEntry, rows: DrillRow[], radar: readonly RadarEvent[]): void {
  const s = useDrill.getState();
  touchDrill();
  const next: State = { ...s, results: rows, pos: s.sprint.length, status: 'summary' };
  if (radar.length) learnRecorder.radar(radar);
  if (rows.length) roundEnd({ ...next, activeMs: useDrill.getState().activeMs }, false, entry);
  useDrill.setState(next);
}

/** Block der Tageseinheit abschließen (Knopf „Weiter“ in der Zusammenfassung). */
export function reportDrillDone(): void {
  const s = useDrill.getState();
  if (s.block) unitDone(s.block);
}

export function leaveDrill(): void {
  const s = useDrill.getState();
  if (!s.active) return;
  if (s.status === 'running' && s.kind !== 'sprint') roundEnd(s, true);
  useDrill.setState({ active: false });
}

// ------------------------------------------------------------------ Fortsetzen (architektur.md §3.2, G3)
// Diktat, Lückenjagd, Satzbau: Aufgaben, Position und Ergebnisse. Sprint nicht (Wertung auf Zeit).

export type DrillSnap = Pick<State, 'status' | 'kind' | 'ctx' | 'day' | 'lang' | 'dictate' | 'cloze' | 'order' | 'pos' | 'results'>;

export function drillSnapshot(): DrillSnap | null {
  const s = useDrill.getState();
  if (!s.active || s.kind === 'sprint' || !itemsOf(s).length) return null;
  const { status, kind, ctx, day, lang, dictate, cloze, order, pos, results } = s;
  return { status, kind, ctx, day, lang, dictate, cloze, order, pos, results };
}

/** Synchron herstellen; die Karten (Beispiele, Nachschlagen) kommen frisch aus den Live-Daten. */
export function restoreDrill(snap: DrillSnap): boolean {
  if (!snap || snap.kind === 'sprint' || !['dictate', 'cloze', 'order'].includes(snap.kind) || typeof snap.pos !== 'number') return false;
  // Satzbau-Aufgaben aus der Zeit vor dem festen Pool (ohne deutsche Bedeutung, mit Ablenkern) werden nicht fortgesetzt.
  if (snap.kind === 'order' && (!Array.isArray(snap.order) || snap.order.some((it) => typeof (it as { de?: unknown })?.de !== 'string'))) return false;
  const len = itemsOf({ ...snap, sprint: [] }).length;
  if (!len || snap.pos < 0 || snap.pos > len) return false;
  const cards = drillCards(useClock.getState().now);
  useDrill.setState({
    ...snap,
    sprint: [],
    results: Array.isArray(snap.results) ? snap.results : [],
    active: true,
    cards: new Map(cards.map((c) => [c.id, c])),
    allCols: cards.flatMap((c) => c.col.filter((x) => x.p && x.gap).map((x) => ({ p: x.p, gap: x.gap }))),
    step: useDrill.getState().step + 1,
    activeMs: 0,
    lastInteract: performance.now(),
  });
  return true;
}

/** Fehlergrenze (G4): kaputte Aufgabe ohne Bewertung überspringen. */
export function skipDrill(): void {
  const s = useDrill.getState();
  if (!s.active || s.status !== 'running' || s.kind === 'sprint') return;
  const pos = s.pos + 1;
  const done = pos >= itemsOf(s).length;
  const next: State = { ...s, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (done) roundEnd(next, false);
  useDrill.setState(next);
}
