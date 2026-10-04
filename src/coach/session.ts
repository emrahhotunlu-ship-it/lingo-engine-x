import { bank, type BankWord } from '../bank/words';
import { hash32, mulberry32 } from '../domain/random';
import { legacyToFsrs } from '../domain/srs/legacyFsrs';
import { reviewFsrs } from '../domain/srs/scheduler';
import type { Grade } from '../domain/srs/types';
import { familyTask, gapIn, synonymTask, viewOf } from './cardView';
import type { CardRec, DayRec, Placement } from './types';

// Die tägliche Wort-Einheit (docs/neustart.md §4–§6). Der Trainer wählt selbst:
// - fällige Wiederholungen (älteste zuerst, höchstens REVIEW_CAP je Einheit),
// - neue Wörter (eigene alte Wörter zuerst, dann die Bank nach Häufigkeit ab dem Band, in dem
//   die Einstufung Lücken zeigt; jedes dritte neue Wort aus Business/Beruf),
// - in gut bekannten Bändern erst „Kennst du das?" (Sortieren) – bestätigt bekannte Wörter landen
//   gleich als gefestigt in der Planung und kosten keine Einführung,
// - die Abfrageart je Übungsstufe, damit ein Wort nicht immer gleich abgefragt wird.
// Bewertet wird automatisch aus Richtigkeit, Hilfe und Antwortzeit (keine Selbsteinschätzung).

export const REVIEW_CAP = 60;
export const MAX_SORTS = 20;
const SORT_FROM = 0.6;

export type Format = 'choose' | 'gap' | 'recall' | 'listen' | 'family' | 'synonym';
export type Step =
  | { kind: 'review'; id: string; format: Format }
  | { kind: 'meet'; id: string }
  | { kind: 'sort'; id: string };

export type AnswerFacts = { correct: boolean; near?: boolean; help?: boolean; ms: number };

const DAY = 86_400_000;

export function freshFsrs(nowMs: number) {
  return legacyToFsrs({ state: 'new', reps: 0 }, nowMs);
}

export function gradeOf(format: Format, a: AnswerFacts, lv: number): Grade {
  if (!a.correct && !a.near) return 1;
  if (a.near || a.help) return 2;
  if (format === 'choose' || format === 'synonym') return a.ms > 9000 ? 2 : 3;
  if (a.ms > 20_000) return 2;
  return lv >= 3 && a.ms < 6000 ? 4 : 3;
}

export const nextLevel = (lv: number, g: Grade): number => (g === 1 ? Math.max(0, lv - 1) : g === 2 ? lv : Math.min(4, lv + 1));

/** Abfrageart je Stufe; leicht gemischt, damit Stufe 3+ nicht immer gleich aussieht. */
export function formatFor(id: string, rec: CardRec): Format {
  const view = viewOf(id, rec);
  const canGap = !!view && !!gapIn(view);
  const rng = mulberry32(hash32(id) ^ rec.f.reps);
  switch (rec.lv) {
    case 0:
      return view?.de ? 'choose' : 'recall';
    case 1:
      return canGap ? 'gap' : 'recall';
    case 2:
      return 'recall';
    case 3: {
      const r = rng();
      if (r < 0.2 && view && synonymTask(view)) return 'synonym';
      return r < 0.5 ? 'recall' : r < 0.75 && canGap ? 'gap' : 'listen';
    }
    default: {
      const r = rng();
      if (r < 0.3 && view && familyTask(view)) return 'family';
      return r < 0.65 ? 'listen' : 'recall';
    }
  }
}

export type SessionInput = {
  cards: ReadonlyMap<string, CardRec>;
  nowMs: number;
  newPerDay: number;
  today: DayRec;
  placement?: Placement | undefined;
  /** Nur neue Wörter (Extra-Runde): keine Wiederholungen. */
  extraNew?: number;
};

export type SessionPlan = { reviews: string[]; quota: number; candidates: () => Iterator<Candidate> };
export type Candidate = { id: string; sort: boolean; word?: BankWord };

export function dueIds(cards: ReadonlyMap<string, CardRec>, nowMs: number): string[] {
  return [...cards]
    .filter(([, c]) => c.f.state !== 0 && c.f.due <= nowMs)
    .sort((a, b) => a[1].f.due - b[1].f.due)
    .map(([id]) => id);
}

export function newQuota(due: number, newPerDay: number, doneToday: number): number {
  const q = Math.max(0, newPerDay - doneToday);
  if (due > 100) return Math.min(q, 3);
  if (due > 60) return Math.min(q, 5);
  return q;
}

/** Startband: das erste Band, das laut Einstufung nicht fast vollständig bekannt ist. */
export function knownShare(placement: Placement | undefined, rank: number): number {
  if (!placement) return rank <= 2000 ? 0.8 : 0.3;
  const band = Math.min(placement.bands.length, Math.max(1, Math.ceil(rank / 1000)));
  return placement.bands[band - 1] ?? 0;
}

export function* newCandidates(cards: ReadonlyMap<string, CardRec>, placement?: Placement): Generator<Candidate, void, unknown> {
  // 1. Eigene, noch nie geübte Wörter aus der alten App.
  for (const [id, c] of cards) if (c.f.state === 0 && !c.known) yield { id, sort: false };
  // 2. Bank: allgemeiner Wortschatz und Beruf im Wechsel (2 : 1).
  const b = bank();
  const pool = [...b.words, ...b.phrasal].filter((w) => !cards.has(w.i)).sort((x, y) => x.r - y.r);
  const work = pool.filter((w) => w.l.includes('business') || w.l.includes('toeic'));
  const general = pool.filter((w) => !(w.l.includes('business') || w.l.includes('toeic')));
  const used = new Set<string>();
  let gi = 0;
  let wi = 0;
  for (let n = 0; gi < general.length || wi < work.length; n++) {
    const fromWork = n % 3 === 2 ? work[wi++] : general[gi++];
    const w = fromWork ?? (gi < general.length ? general[gi++] : work[wi++]);
    if (!w || used.has(w.i)) continue;
    used.add(w.i);
    const share = knownShare(placement, w.r);
    if (share >= 0.97 && w.r <= 3000 && !w.l.includes('business')) continue; // sicher bekannt: überspringen
    yield { id: w.i, sort: share >= SORT_FROM, word: w };
  }
}

/** Ablauf einer Einheit als kleiner Zustandsautomat (reine Logik, von der Oberfläche getrieben). */
export class Session {
  readonly reviews: string[];
  readonly quota: number;
  introduced = 0;
  sorted = 0;
  steps = 0;
  private readonly cands: Iterator<Candidate>;
  private again: Array<{ id: string; at: number; n: number }> = [];
  private repeats = new Map<string, number>();
  private readonly onlyNew: boolean;

  constructor(private readonly input: SessionInput) {
    this.onlyNew = input.extraNew !== undefined;
    const due = this.onlyNew ? [] : dueIds(input.cards, input.nowMs);
    this.reviews = due.slice(0, REVIEW_CAP);
    this.quota = this.onlyNew ? input.extraNew! : newQuota(due.length, input.newPerDay, input.today.nw);
    this.cands = newCandidates(input.cards, input.placement);
  }

  get remaining(): number {
    return this.reviews.length + this.again.length + Math.max(0, this.quota - this.introduced);
  }

  private takeCandidate(): Step | null {
    if (this.introduced >= this.quota) return null;
    for (;;) {
      const r = this.cands.next();
      if (r.done) return null;
      const c = r.value;
      if (this.input.cards.has(c.id) && this.input.cards.get(c.id)!.f.state !== 0) continue;
      if (c.sort && this.sorted < MAX_SORTS) return { kind: 'sort', id: c.id };
      return { kind: 'meet', id: c.id };
    }
  }

  next(cards: ReadonlyMap<string, CardRec>): Step | null {
    this.steps++;
    const ready = this.again.findIndex((a) => a.at <= this.steps);
    if (ready >= 0) {
      const [a] = this.again.splice(ready, 1);
      const rec = cards.get(a!.id);
      if (rec) return { kind: 'review', id: a!.id, format: formatFor(a!.id, rec) };
    }
    const wantNew = this.introduced < this.quota && (this.steps % 3 === 0 || this.reviews.length === 0);
    if (wantNew) {
      const s = this.takeCandidate();
      if (s) return s;
    }
    while (this.reviews.length) {
      const id = this.reviews.shift()!;
      const rec = cards.get(id);
      if (rec) return { kind: 'review', id, format: formatFor(id, rec) };
    }
    const s = this.takeCandidate();
    if (s) return s;
    if (this.again.length) {
      const a = this.again.shift()!;
      const rec = cards.get(a.id);
      if (rec) return { kind: 'review', id: a.id, format: formatFor(a.id, rec) };
    }
    return null;
  }

  /** Nach einer Einführung: erste Abfrage nach drei Schritten. */
  met(id: string): void {
    this.introduced++;
    this.again.push({ id, at: this.steps + 3, n: 0 });
  }

  sortedKnown(): void {
    this.sorted++;
  }

  /** Nach einer Antwort: kurz fällige Karten (Lernschritte) kommen in derselben Einheit wieder. */
  answered(id: string, rec: CardRec, nowMs: number): void {
    const n = this.repeats.get(id) ?? 0;
    if (rec.f.due - nowMs <= 20 * 60_000 && n < 3) {
      this.repeats.set(id, n + 1);
      this.again.push({ id, at: this.steps + (rec.f.state === 3 || rec.f.lapses > 0 ? 3 : 5), n: n + 1 });
    }
  }
}

/** Neue Karte nach der Einführung. */
export function introducedCard(nowMs: number): CardRec {
  return { src: 'bank', f: freshFsrs(nowMs), lv: 0, add: nowMs };
}

/** Beim Sortieren als bekannt bestätigt: wie eine erste „Leicht"-Antwort, Stufe 3. */
export function knownCard(nowMs: number): CardRec {
  return { src: 'bank', f: reviewFsrs(freshFsrs(nowMs), 4, nowMs), lv: 3, add: nowMs, known: 1, ok: 1 };
}

/** Antwort verbuchen: neue Planung, Stufe, Bilanz. */
export function applyAnswer(rec: CardRec, format: Format, a: AnswerFacts, nowMs: number): { rec: CardRec; grade: Grade } {
  const grade = gradeOf(format, a, rec.lv);
  const next: CardRec = {
    ...rec,
    f: reviewFsrs(rec.f, grade, nowMs),
    lv: nextLevel(rec.lv, grade),
    ok: (rec.ok ?? 0) + (grade > 1 ? 1 : 0),
    bad: (rec.bad ?? 0) + (grade === 1 ? 1 : 0),
  };
  return { rec: next, grade };
}

/** Gilt die Karte als gefestigt (für den Wortschatz-Zähler)? */
export const isSolid = (rec: CardRec): boolean => rec.f.state === 2 && rec.f.stability >= 21;
export const daysUntil = (rec: CardRec, nowMs: number): number => Math.max(0, Math.round((rec.f.due - nowMs) / DAY));
