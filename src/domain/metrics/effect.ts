import { dayKey } from '../date';
import { errorDue, errorsOf, type ErrorEntry } from '../grammar/errors';
import { readRepairs } from '../repair/repair';

// Messgrößen „wirkt die neue Methode?“ (Lernplattform 2.0 §4.9, Leitsatz 8). Rein, nur Lesen. Die Entscheidungsregeln nach 14 Tagen stehen
// als Konstanten hier (`EFFECT_RULES`), damit die Ansicht und `stand.md` dieselben Zahlen nennen. Fehlen Daten, ist das Ergebnis `null`
// bzw. die einzelne Größe `null` („noch keine Daten“).

type Doc = Readonly<Record<string, unknown>>;
export type Rate = { n: number; hit: number } | null;
export type EffectStep = 1 | 2 | 3 | 5;

/** Feste Regeln (§4.9). Die Folge steht in der Tabelle des Plans; hier nur Schwelle und Beobachtungsfenster. */
export const EFFECT_RULES = {
  /** Fehlerschlange an so vielen von 14 Tagen über `queueOver` → `limit`-Obergrenze 9 → 11. */
  queueDays: 7,
  queueOver: 15,
  queueWindow: 14,
  /** Treffer beim ersten Versuch in Box 1 unter dem Wert → Erklär-Tiefe in Box 0 `full`. */
  firstTryBox1Min: 0.5,
  /** Rückfall binnen 14 Tagen über dem Wert je Muster → Muster an die Englischlehrer-Prüfung. */
  relapseMax: 0.4,
  relapseDays: 14,
  /** Vortest bestanden über dem Wert → Vortest auf 3 Aufgaben. */
  pretestMax: 0.7,
  /** `touch` über dem Faktor gegen `keys` → Touch-Faktor 1,4 → 1,6. */
  touchOverKeys: 1.5,
  /** Box 28/90 (§13) wird nur entschieden, wenn die Treffer in Box 9 darüber liegen. */
  box9Min: 0.85,
} as const;

export type LearningEffect = {
  firstTry: { box1: Rate; box3: Rate; box9: Rate };
  relapse14: Rate;
  pretest: Rate;
  minutesPerStep: Record<EffectStep, { t: number | null; k: number | null }>;
  queue: { today: number; max7: number };
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const rate = (n: number, hit: number): Rate => (n > 0 ? { n, hit } : null);

/**
 * Wiederholungen einer Fehlerstelle: `rh: [[t, box, ok]]` (≤ 6), `box` = Box VOR der Antwort (0 = erste Wiederholung nach einem Tag,
 * 1 = nach drei Tagen, 2 = nach neun Tagen), `ok` = 1 oder 0 (auch true/false).
 */
function reviewsOf(e: ErrorEntry): Array<{ t: number; box: number; ok: boolean }> {
  const rh = e.rh;
  if (!Array.isArray(rh)) return [];
  const out: Array<{ t: number; box: number; ok: boolean }> = [];
  for (const x of rh) {
    if (!Array.isArray(x)) continue;
    const t = num(x[0]);
    const box = num(x[1]);
    if (t === null || box === null) continue;
    out.push({ t, box: Math.max(0, Math.floor(box)), ok: x[2] === 1 || x[2] === true });
  }
  return out;
}

type Item = { pat: string; t: number; done: boolean; last: number | null; due: number; moreT: number[]; src: 'grammar' | 'repair'; rh: ReturnType<typeof reviewsOf> };

function itemsOf(grammarDocs: ReadonlyMap<string, Doc>, repairDoc: Doc | null | undefined): Item[] {
  const out: Item[] = [];
  for (const doc of grammarDocs.values()) {
    for (const e of errorsOf(doc)) {
      const t = num(e.t);
      if (t === null) continue;
      const more = Array.isArray(e.more) ? e.more.map((m) => (m && typeof m === 'object' ? num((m as Doc).t) : null)).filter((x): x is number => x !== null) : [];
      out.push({ pat: str(e.pat), t, done: e.done === true, last: num(e.last), due: errorDue(e), moreT: more, src: 'grammar', rh: reviewsOf(e) });
    }
  }
  for (const r of readRepairs(repairDoc ?? undefined)) out.push({ pat: '', t: r.t, done: r.done === true, last: r.last ?? null, due: r.due, moreT: [], src: 'repair', rh: [] });
  return out;
}

function vtOf(doc: Doc): { ok: boolean } | null {
  const v = doc.vt;
  return v && typeof v === 'object' && !Array.isArray(v) ? { ok: (v as Doc).ok === true } : null;
}

/** Warteschlange am Tag `d`: offen an diesem Tag (angelegt vorher, noch nicht erledigt oder erst danach erledigt) und bis dahin fällig. */
function queueAt(items: readonly Item[], d: string): number {
  let n = 0;
  for (const i of items) {
    if (dayKey(i.t) >= d) continue;
    if (i.done) {
      if (i.last !== null && dayKey(i.last) >= d) n++;
    } else if (dayKey(i.due) <= d) n++;
  }
  return n;
}

const mean = (xs: readonly number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Die fünf Messgrößen. `logs` = `log/<tag>`-Dokumente (mit `um: {[block]: {s, dev}}`), `today` der Lerntag.
 * Die Warteschlangenlänge der Vortage wird aus den heutigen Fehlereinträgen zurückgerechnet (Näherung: spätere Fälligkeiten
 * früherer Wiederholungen sind nicht gespeichert).
 */
export function learningEffect(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; logs: ReadonlyArray<Readonly<Doc>>; today: string }): LearningEffect | null {
  const items = itemsOf(i.grammarDocs, i.repairDoc);
  const vts = [...i.grammarDocs.values()].map(vtOf).filter((v): v is { ok: boolean } => v !== null);
  const sec: Record<EffectStep, { t: number[]; k: number[] }> = { 1: { t: [], k: [] }, 2: { t: [], k: [] }, 3: { t: [], k: [] }, 5: { t: [], k: [] } };
  for (const log of i.logs) {
    const um = log.um;
    if (!um || typeof um !== 'object' || Array.isArray(um)) continue;
    for (const [block, v] of Object.entries(um as Record<string, unknown>)) {
      const b = Number(block) as EffectStep;
      if (!(b in sec) || !v || typeof v !== 'object') continue;
      const s = num((v as Doc).s);
      const dev = (v as Doc).dev;
      if (s === null || s < 0 || (dev !== 't' && dev !== 'k')) continue;
      sec[b][dev].push(s);
    }
  }
  const hasMinutes = Object.values(sec).some((x) => x.t.length || x.k.length);
  if (!items.length && !vts.length && !hasMinutes) return null;

  // Treffer beim ersten Versuch je Box (nur Grammatik-Fehler mit `rh`; Box 0 = „Box 1“, 1 = „Box 3“, 2 und mehr = „Box 9“).
  const boxes = [rate(0, 0), rate(0, 0), rate(0, 0)] as [Rate, Rate, Rate];
  const tally = [
    { n: 0, hit: 0 },
    { n: 0, hit: 0 },
    { n: 0, hit: 0 },
  ];
  for (const it of items) {
    for (const r of it.rh) {
      const slot = tally[Math.min(2, r.box)]!;
      slot.n++;
      if (r.ok) slot.hit++;
    }
  }
  tally.forEach((x, k) => (boxes[k] = rate(x.n, x.hit)));

  // Rückfall: erledigter Fehler mit Muster, dessen Muster danach binnen 14 Tagen wieder falsch war (neuer Eintrag oder Zusatzsatz). Nur Fälle,
  // bei denen die 14 Tage schon vorbei sind, sonst wäre „kein Rückfall“ nur „noch nicht“.
  let rn = 0;
  let rhit = 0;
  for (const it of items) {
    if (!it.done || !it.pat || it.last === null) continue;
    if (dayKey(it.last) > dayKey(Date.parse(`${i.today}T12:00:00`) - EFFECT_RULES.relapseDays * 86_400_000)) continue;
    rn++;
    const end = it.last + EFFECT_RULES.relapseDays * 86_400_000;
    const again = items.some((o) => o !== it && o.pat === it.pat && [o.t, ...o.moreT].some((t) => t > it.last! && t <= end));
    if (again) rhit++;
  }

  const minutes = (xs: number[]): number | null => {
    const m = mean(xs);
    return m === null ? null : Math.round((m / 60) * 10) / 10;
  };
  const minutesPerStep = Object.fromEntries(([1, 2, 3, 5] as const).map((b) => [b, { t: minutes(sec[b].t), k: minutes(sec[b].k) }])) as LearningEffect['minutesPerStep'];

  const days = Array.from({ length: 7 }, (_, k) => dayKey(Date.parse(`${i.today}T12:00:00`) - k * 86_400_000));
  const lens = days.map((d) => queueAt(items, d));
  return {
    firstTry: { box1: boxes[0], box3: boxes[1], box9: boxes[2] },
    relapse14: rate(rn, rhit),
    pretest: rate(vts.length, vts.filter((v) => v.ok).length),
    minutesPerStep,
    queue: { today: lens[0] ?? 0, max7: Math.max(0, ...lens) },
  };
}
