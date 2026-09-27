import { DIMS, isConfidence, type Confidence, isLevel, TRENDS, type AssessData, type AssessDim, type AssessHist, type AssessRead, type Dim, type Trend } from './types';
import { assess } from '../../prompts/assess';

// `app/assess` lesen und schreiben (Plan §4.1, A6.10). Gelesen werden beide Formen: die Hülle
// der alten App `{d, t, lang, answers, writings, data:{…}}` und die flache Form aus Anhang B.
// Geschrieben wird immer die Hülle mit VOLLSTÄNDIGEM `data` (fehlende Felder als `null`), denn
// `update` mischt verschachtelte Objekte – kein Altschlüssel darf stehen bleiben. Flache
// Altfelder oben im Dokument bleiben unberührt (nie gelöscht, Kap. 9).

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const strs = (v: unknown): string[] => arr(v).filter((x): x is string => typeof x === 'string' && !!x.trim());

export const HIST_MAX = 60;
/** Vorlage und Version der gespeicherten Einschätzung (folgt der Vorlage, nie von Hand). */
export const ASSESS_PV = `${assess.id}@${assess.version}`;

// Kennungen der alten App (echte Daten): `dims[].id` gr/vo/re/li/wr/fl und `confidence`
// low/mid/high. `fl` (Flüssigkeit, im alten Tagesplan vom Sprint gespeist) ist die Fertigkeit
// Sprechen. Beim Lesen umgesetzt, gespeichert bleibt der Altstand unverändert.
const LEGACY_DIM: Readonly<Record<string, Dim>> = { gr: 'grammar', vo: 'vocabulary', re: 'reading', li: 'listening', wr: 'writing', fl: 'speaking' };
const LEGACY_CONF: Readonly<Record<string, Confidence>> = { low: 'thin', mid: 'fair', high: 'good' };
const dimOf = (v: unknown): Dim | null => ((DIMS as readonly unknown[]).includes(v) ? (v as Dim) : typeof v === 'string' ? (LEGACY_DIM[v] ?? null) : null);
const confOf = (v: unknown): Confidence => (isConfidence(v) ? v : typeof v === 'string' ? (LEGACY_CONF[v] ?? 'thin') : 'thin');

const trendOf = (v: unknown): Trend | null => ((TRENDS as readonly unknown[]).includes(v) ? (v as Trend) : null);

/** `data` aus einem Dokument beider Formen, tolerant normalisiert. */
export function readAssessData(raw: unknown): AssessData {
  const d = obj(raw);
  const dims: AssessDim[] = [];
  for (const x of arr(d.dims)) {
    const o = obj(x);
    const id = dimOf(o.id);
    if (!id || dims.some((y) => y.id === id)) continue;
    dims.push({ id, level: isLevel(o.level) ? o.level : null, confidence: confOf(o.confidence), why: text(o.why) });
  }
  const f = obj(d.focus);
  return {
    level: text(d.level),
    cefr: isLevel(d.cefr) ? d.cefr : null,
    levelWhy: text(d.levelWhy),
    trend: trendOf(d.trend),
    trendWhy: text(d.trendWhy),
    today: text(d.today),
    c1gap: strs(d.c1gap),
    strengths: arr(d.strengths)
      .map(obj)
      .filter((s) => text(s.title))
      .map((s) => ({ title: text(s.title) ?? '', why: text(s.why) ?? '', ev: strs(s.ev) })),
    blockers: arr(d.blockers)
      .map(obj)
      .filter((b) => text(b.title))
      .map((b) => ({ title: text(b.title) ?? '', why: text(b.why) ?? '', fix: text(b.fix) ?? '', action: text(b.action), ev: strs(b.ev) })),
    dims,
    focus: text(f.title) ? { title: text(f.title) ?? '', why: text(f.why) ?? '', action: text(f.action), days: Math.max(1, Math.min(7, Math.round(num(f.days) || 3))), channels: strs(f.channels) } : null,
  };
}

function readHist(v: unknown): AssessHist[] {
  const out: AssessHist[] = [];
  for (const x of arr(v)) {
    const o = obj(x);
    const d = text(o.d);
    if (!d) continue;
    const dims: AssessHist['dims'] = {};
    for (const [k, lv] of Object.entries(obj(o.dims))) {
      const id = dimOf(k);
      if (id) dims[id] = isLevel(lv) ? lv : null;
    }
    out.push({ d, cefr: isLevel(o.cefr) ? o.cefr : null, trend: trendOf(o.trend), dims });
  }
  return out;
}

/** Beide Formen lesen. `null`, wenn gar keine Einschätzung darin steht. `lang` fehlt → `de` (alte App). */
export function readAssess(doc: unknown): AssessRead | null {
  if (!doc || typeof doc !== 'object') return null;
  const a = obj(doc);
  const inner = a.data && typeof a.data === 'object' && !Array.isArray(a.data) ? a.data : a;
  const data = readAssessData(inner);
  if (!data.cefr && !data.level && !data.dims.length) return null;
  return {
    d: text(a.d),
    t: num(a.t),
    lang: a.lang === 'en' ? 'en' : 'de',
    answers: num(a.answers),
    writings: num(a.writings),
    tier: text(a.tier),
    data,
    hist: readHist(a.hist),
    runDay: text(obj(a.run).d),
  };
}

/** `data` vollständig: jeder Schlüssel gesetzt, Fehlendes als `null` (Plan E1). */
export function fullData(d: AssessData): Record<string, unknown> {
  return {
    level: d.level,
    cefr: d.cefr,
    levelWhy: d.levelWhy,
    trend: d.trend,
    trendWhy: d.trendWhy,
    today: d.today,
    c1gap: d.c1gap,
    strengths: d.strengths.map((s) => ({ title: s.title, why: s.why, ev: s.ev })),
    blockers: d.blockers.map((b) => ({ title: b.title, why: b.why, fix: b.fix, action: b.action, ev: b.ev })),
    dims: d.dims.map((x) => ({ id: x.id, level: x.level, confidence: x.confidence, why: x.why })),
    focus: d.focus ? { title: d.focus.title, why: d.focus.why, action: d.focus.action, days: d.focus.days, channels: d.focus.channels } : null,
  };
}

export type AssessResult = {
  day: string;
  t: number;
  lang: 'de' | 'en';
  answers: number;
  writings: number;
  tier: string;
  basis: Record<string, unknown>;
  data: AssessData;
};

export type AssessOp = { set: Doc } | { update: Doc };

/**
 * Schreibvorgang für `writer.transform('app/assess', …)`:
 * - Dokument fehlt → `set` mit der Hülle,
 * - ein anderes Gerät war nach unserem Start schneller (`cur.t > startedAt`) → `null`,
 * - sonst `update` mit vollständigem `data`; `hist` wächst um einen Eintrag (≤ 60).
 */
export function assessWrite(cur: Doc | undefined, r: AssessResult, startedAt: number): AssessOp | null {
  const entry: AssessHist = { d: r.day, cefr: r.data.cefr, trend: r.data.trend, dims: Object.fromEntries(r.data.dims.map((x) => [x.id, x.level])) };
  const body = { d: r.day, t: r.t, lang: r.lang, answers: r.answers, writings: r.writings, v: 2, pv: ASSESS_PV, tier: r.tier, basis: r.basis, data: fullData(r.data) };
  if (!cur) return { set: { ...body, hist: [entry] } };
  if (num(cur.t) > startedAt) return null;
  const prev = arr(cur.hist).filter((h) => obj(h).d !== r.day);
  // Erster neuer Lauf auf einer Einschätzung der alten App (ohne `hist`): ihr Stand wird der
  // erste Verlaufseintrag, denn ihr `data` wird gleich ersetzt (Befund H3).
  if (!Array.isArray(cur.hist)) {
    const old = readAssess(cur);
    if (old?.d && old.d !== r.day) prev.push({ d: old.d, cefr: old.data.cefr, trend: old.data.trend, dims: Object.fromEntries(old.data.dims.map((x) => [x.id, x.level])) });
  }
  return { update: { ...body, hist: [...prev, entry].slice(-HIST_MAX) } };
}
