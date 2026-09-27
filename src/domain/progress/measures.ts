import { TOPICS } from '../content';
import { topicP } from '../grammar/bkt';

// „Messwerte dahinter" (Kap. 5, Plan §7.5), nur eingeklappt sichtbar: FSRS-Kennzahlen der Karten
// und die Beherrschung je Grammatikthema (BKT mit Anzeige-Verfall).

type Doc = Readonly<Record<string, unknown>>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const DAY = 86_400_000;

export type FsrsMeasures = {
  byState: { new: number; learning: number; review: number; relearning: number };
  meanR: number | null;
  meanStability: number | null;
  leeches: number;
  /** Echte Trefferquote der Wiederholungen (Protokoll, `ctx:'rev'`, `k:'v'`), `null` ohne Daten. */
  accuracy30: { ok: number; n: number } | null;
};

export function fsrsMeasures(vocab: ReadonlyMap<string, Doc>, nowMs: number, logs?: ReadonlyMap<string, Doc>): FsrsMeasures {
  const byState = { new: 0, learning: 0, review: 0, relearning: 0 };
  let rSum = 0;
  let rN = 0;
  let sSum = 0;
  let leeches = 0;
  for (const d of vocab.values()) {
    if (d.hidden === true) continue;
    const f = obj(d.fsrs);
    const st = typeof f.state === 'number' ? f.state : d.state === 'new' ? 0 : 2;
    if (st === 0) byState.new++;
    else if (st === 1) byState.learning++;
    else if (st === 3) byState.relearning++;
    else byState.review++;
    const s = num(f.stability) || num(d.S);
    const last = num(f.last) || num(d.last);
    if (st !== 0 && s > 0 && last > 0) {
      rSum += Math.pow(1 + (19 / 81) * (Math.max(0, nowMs - last) / DAY / s), -0.5);
      sSum += s;
      rN++;
    }
    if ((num(f.lapses) || num(d.lapses)) >= 3) leeches++;
  }
  let accuracy30: FsrsMeasures['accuracy30'] = null;
  if (logs) {
    let ok = 0;
    let n = 0;
    for (const doc of logs.values()) {
      const entries = Array.isArray(doc.entries) ? doc.entries : [];
      for (const e of entries.map(obj)) {
        if (e.k !== 'v' || e.ctx !== 'rev') continue;
        n++;
        if (e.ok === true) ok++;
      }
    }
    accuracy30 = n ? { ok, n } : null;
  }
  return { byState, meanR: rN ? rSum / rN : null, meanStability: rN ? sSum / rN : null, leeches, accuracy30 };
}

export type BktRow = { id: string; name: string; nameEn: string; p: number; n: number; last10: { ok: number; n: number }; due: number | null };

export function bktMeasures(grammar: ReadonlyMap<string, Doc>, nowMs: number): BktRow[] {
  return TOPICS.map((t) => {
    const d = grammar.get(t.id);
    const recent = Array.isArray(d?.recent) ? (d.recent as unknown[]).filter((x): x is number => typeof x === 'number').slice(-10) : [];
    return {
      id: t.id,
      name: t.name,
      nameEn: t.name_en ?? t.name,
      p: topicP(t.id, d, nowMs),
      n: num(d?.n),
      last10: { ok: recent.filter((x) => x > 0).length, n: recent.length },
      due: typeof d?.due === 'number' ? d.due : null,
    };
  });
}
