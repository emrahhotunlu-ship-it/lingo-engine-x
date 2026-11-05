import { isWrongLang } from '../lang/detect';
import { normalize, withoutTo } from '../answer/normalize';
import { lemmaCandidates } from '../text/lemma';
import { stripGapMarks } from '../text/tokenize';
import { locateChunk } from './chunkCards';
import { locate } from './context';
import type { ContextSpan, Lang, TrainCard } from './types';

// Kartenpaket je Wort (docs/ki-paket-plan.md §2, Lehrer-Urteil P1): Claude bereitet für eine Karte
// vier Lückensätze mit weiteren richtigen Antworten, passenden Synonymen (mit Unterschied) und
// Ablenkern (mit „warum nicht") vor. Gespeichert als `xPack` an der Karte, nur von dieser App
// geschrieben, tolerant gelesen. `S`, `D`, `due`, `stage`, `ex`, `xEx` bleiben unberührt (Kap. 9).
//
// Reihenfolge der Sätze über die Wiederholungen (Lehrer-Urteil P1):
// - Ursprungssatz als Anker: neue Karte, Stufe ≤ 2 und nach einem Fehler.
// - Sonst jedes Mal ein anderer Satz aus dem Paket (Index aus `reps` + Anzeigen in dieser Runde).
// - Sind alle Sätze des Pakets einmal gelaufen, schreibt Claude ein neues (ohne die alten Sätze).

export type PackAlt = { w: string; why: string };
export type PackItem = {
  /** Ganzer englischer Satz. */
  en: string;
  /** Genaue Form der Lösung im Satz (`en` enthält sie). */
  gap: string;
  /** Stelle von `gap` in `en`. */
  at: number;
  /** Weitere Formen des Zielworts, die hier ebenso richtig sind. */
  ok: string[];
  /** Andere Wörter, die hier passen, aber nicht das Zielwort sind – mit Unterschied. */
  syn: PackAlt[];
  /** Warum das Zielwort hier passt (Kollokation, Ton), in `lang`. */
  why: string;
};
export type Pack = {
  v: 1;
  /** ms der Erzeugung – zugleich Kennung beim Ersetzen. */
  t: number;
  /** Sprache der Erklärungen (`why`, `syn[].why`, `dis[].why`). */
  lang: Lang;
  /** `reps` der Karte bei der Erzeugung: verbrauchte Sätze = reps − r0. */
  r0: number;
  items: PackItem[];
  /** Ablenker (Grundform), im Satz eindeutig falsch, mit „warum nicht". */
  dis: PackAlt[];
  /** Warum das Zielwort in den Ursprungssatz der Karte passt (Begründung auch auf dem Anker), in `lang`. */
  cwhy: string;
  /** Frühere Sätze (nur Text), damit ein neues Paket sie nicht wiederholt. */
  prev: string[];
};

export const PACK_ITEMS = 4;
export const PACK_DIS = 3;
const PREV_MAX = 12;
const WHY_MAX = 240;

const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const cleanSentence = (s: unknown): string => stripGapMarks(str(s)).text.replace(/\s+/g, ' ').trim();
const sameText = (a: string, b: string): boolean => normalize(a) === normalize(b);

/** Erklärung nur, wenn sie in der erwarteten Sprache ist (Sprachtreue, Kap. 10) und nicht zu lang. */
function why(v: unknown, lang: Lang): string {
  const s = str(v);
  if (!s || isWrongLang(s, lang)) return '';
  return s.length > WHY_MAX ? s.slice(0, WHY_MAX - 1).trimEnd() + '…' : s;
}

function alts(v: unknown, lang: Lang, max: number): PackAlt[] {
  if (!Array.isArray(v)) return [];
  const out: PackAlt[] = [];
  for (const x of v as unknown[]) {
    const r = x && typeof x === 'object' && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
    const w = str(r ? (r.w ?? r.word) : x);
    if (!w || w.length > 60 || out.some((o) => sameText(o.w, w))) continue;
    out.push({ w, why: r ? why(r.why, lang) : '' });
    if (out.length >= max) break;
  }
  return out;
}

/** Stelle der Lösung im Satz: genau `gap`, sonst das Zielwort (gebeugt) bzw. die Wendung. */
export function spanOf(en: string, gap: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>): ContextSpan | null {
  if (!en) return null;
  const tryAt = (g: string): ContextSpan | null => {
    if (!g) return null;
    const i = en.toLowerCase().indexOf(g.toLowerCase());
    if (i < 0) return null;
    const before = en[i - 1];
    const after = en[i + g.length];
    if ((before && /[A-Za-z']/.test(before)) || (after && /[A-Za-z']/.test(after))) return null;
    return { sentence: en, start: i, end: i + g.length, gap: en.slice(i, i + g.length) };
  };
  const hit = card.kind === 'chunk' ? locateChunk(en, card.word) : locate(en, card.lemma);
  const direct = tryAt(gap);
  // Die angegebene Form muss das Zielwort sein: liegt sie innerhalb des Treffers, gilt der Treffer.
  if (direct && (!hit || (direct.start >= hit.start && direct.end <= hit.end) || (hit.start >= direct.start && hit.end <= direct.end))) {
    return hit && card.kind === 'chunk' ? { sentence: en, start: hit.start, end: hit.end, gap: en.slice(hit.start, hit.end) } : direct;
  }
  if (!hit) return null;
  return { sentence: en, start: hit.start, end: hit.end, gap: en.slice(hit.start, hit.end) };
}

/** Eine Paket-Antwort für eine Karte prüfen; unbrauchbare Sätze fallen weg. `null` = nichts Brauchbares. */
export function acceptPack(
  raw: unknown,
  card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>,
  lang: Lang,
  meta: { t: number; r0: number; prev: readonly string[] },
): Pack | null {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const list = Array.isArray(r.items) ? (r.items as unknown[]) : [];
  const seen = new Set<string>([...meta.prev, card.context?.sentence ?? ''].filter(Boolean).map(normalize));
  const items: PackItem[] = [];
  for (const x of list) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const o = x as Record<string, unknown>;
    const en = cleanSentence(o.en);
    if (en.length < 20 || en.length > 240 || seen.has(normalize(en)) || isWrongLang(en, 'en')) continue;
    const span = spanOf(en, str(o.gap), card);
    if (!span) continue;
    seen.add(normalize(en));
    const gapN = normalize(span.gap);
    const ok = (Array.isArray(o.ok) ? (o.ok as unknown[]) : [])
      .map(str)
      .filter((s) => s && s.length <= 60 && normalize(s) !== gapN);
    const syn = alts(o.syn, lang, 3).filter((s) => normalize(s.w) !== gapN && !ok.some((k) => sameText(k, s.w)));
    items.push({ en, gap: span.gap, at: span.start, ok: [...new Set(ok)].slice(0, 4), syn, why: why(o.why, lang) });
    if (items.length >= PACK_ITEMS) break;
  }
  if (!items.length) return null;
  const lemma = withoutTo(normalize(card.lemma));
  const dis = alts(r.dis, lang, PACK_DIS).filter((d) => withoutTo(normalize(d.w)) !== lemma && !items.some((i) => i.syn.some((s) => sameText(s.w, d.w)) || i.ok.some((k) => sameText(k, d.w))));
  const prev = [...meta.prev, ...items.map((i) => i.en)].slice(-PREV_MAX);
  return { v: 1, t: meta.t, lang, r0: Math.max(0, Math.round(meta.r0)), items, dis, cwhy: card.context ? why(r.cwhy, lang) : '', prev };
}

/** Gespeichertes Paket tolerant lesen (`xPack`); `null`, wenn nichts Brauchbares darin ist. */
export function readPack(doc: Readonly<Record<string, unknown>>, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>): Pack | null {
  const raw = doc.xPack;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  const lang: Lang = r.lang === 'en' ? 'en' : 'de';
  const prev = Array.isArray(r.prev) ? (r.prev as unknown[]).map(str).filter(Boolean) : [];
  // Beim Lesen werden frühere Sätze nicht ausgeschlossen (sie stehen selbst in `prev`).
  const p = acceptPack({ items: r.items, dis: r.dis, cwhy: r.cwhy }, card, lang, { t: num(r.t), r0: num(r.r0), prev: [] });
  return p ? { ...p, prev: prev.slice(-PREV_MAX) } : null;
}

/** Wiederholungen der Karte (`reps`, sonst Summe der Antworten je Übungsart). */
export function repsOf(card: Pick<TrainCard, 'doc' | 'xs'>): number {
  const r = card.doc.reps;
  if (typeof r === 'number' && Number.isFinite(r) && r >= 0) return Math.round(r);
  return Object.values(card.xs).reduce((s, c) => s + c.c + c.w, 0);
}

/** War die letzte Antwort der Karte falsch („Nochmal")? */
export function lastWasWrong(card: Pick<TrainCard, 'doc'>): boolean {
  const hist = Array.isArray(card.doc.hist) ? (card.doc.hist as unknown[]) : [];
  const last = hist[hist.length - 1];
  return !!last && typeof last === 'object' && (last as Record<string, unknown>).g === 1;
}

/**
 * Wiederholungen nach dem Erzeugen, die nicht zählen: Antworten im Ursprungssatz (nach einem Fehler)
 * verbrauchen keinen Paket-Satz. Ohne Zähler je Satz wird das mit diesem Spielraum ausgeglichen;
 * schlimmstenfalls kommt ein Paket-Satz ein zweites Mal.
 */
export const PACK_SLACK = 2;

/** Sind alle Sätze des Pakets gelaufen (oder ist es nicht da)? Dann lohnt ein neues. */
export function packUsedUp(pack: Pack | null, reps: number): boolean {
  if (!pack) return true;
  return reps - pack.r0 >= pack.items.length + PACK_SLACK;
}

/** Lohnt ein Paket schon? Neue Karten und Stufe 1 üben im Ursprungssatz (Anker), ab Stufe 2 wird vorbereitet. */
export function packWorthIt(card: Pick<TrainCard, 'isNew' | 'stage' | 'hidden'>): boolean {
  return !card.hidden && !card.isNew && card.stage >= 2;
}

export type SentencePick = { span: ContextSpan | null; item: PackItem | null };

/**
 * Satz für die nächste Abfrage. `shown` = wie oft die Karte in dieser Runde schon kam (die Karten
 * sind für die Runde eingefroren, `reps` steigt also erst in der nächsten Runde).
 */
export function pickSentence(card: Pick<TrainCard, 'context' | 'stage' | 'isNew' | 'doc' | 'xs'>, pack: Pack | null, shown: number, againInRound: boolean): SentencePick {
  const origin = card.context;
  if (!pack || !pack.items.length) return { span: origin, item: null };
  const anchor = !!origin && (card.isNew || card.stage <= 2 || againInRound || lastWasWrong(card));
  if (anchor) return { span: origin, item: null };
  const n = pack.items.length;
  const idx = (((repsOf(card) - pack.r0 + shown) % n) + n) % n;
  const item = pack.items[idx] ?? pack.items[0]!;
  return { span: itemSpan(item) ?? origin, item };
}

/** Stelle eines Paket-Satzes (für Übungen mit Lücke). */
export function itemSpan(item: PackItem): ContextSpan | null {
  const i = item.en.slice(item.at, item.at + item.gap.length) === item.gap ? item.at : item.en.indexOf(item.gap);
  return i < 0 ? null : { sentence: item.en, start: i, end: i + item.gap.length, gap: item.gap };
}

/** Lokale Zusatzprüfung mit dem Paket: weitere richtige Form oder passendes Synonym. */
export function packVerdict(given: string, item: PackItem | null): { kind: 'ok' } | { kind: 'syn'; alt: PackAlt } | null {
  if (!item) return null;
  const g = withoutTo(normalize(given));
  if (!g) return null;
  const matches = (w: string) => {
    const n = withoutTo(normalize(w));
    return n === g || (!g.includes(' ') && !n.includes(' ') && lemmaCandidates(g).includes(n));
  };
  if (item.ok.some((o) => withoutTo(normalize(o)) === g)) return { kind: 'ok' };
  const alt = item.syn.find((s) => matches(s.w));
  return alt ? { kind: 'syn', alt } : null;
}

/** Patch für die Karte: neues Paket nur, wenn keins da ist oder das vorhandene dasselbe ist, das ersetzt werden sollte. */
export function packPatch(cur: Readonly<Record<string, unknown>> | undefined, next: Pack, replacesT: number | null): { xPack: Pack } | null {
  if (!cur) return null;
  const old = cur.xPack;
  if (old !== undefined && old !== null) {
    // Unerwartetes wird nie überschrieben; ein neueres Paket (anderes Gerät) auch nicht.
    if (typeof old !== 'object' || Array.isArray(old)) return null;
    const t = (old as Record<string, unknown>).t;
    if (replacesT === null || t !== replacesT) return null;
  }
  return { xPack: next };
}
