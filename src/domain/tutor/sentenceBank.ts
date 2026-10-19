import { BRITISH } from '../c1x/kinds/common';
import { poolNorm } from '../drills/orderPool';
import { isWrongLang } from '../lang/detect';
import { storedExamples } from '../srs/examples';
import { phraseIn } from '../../prompts/tolerant';
import { knownKeys, readCfx, readWx, wordRepeats } from './acceptWordCtx';

// Satzbank SB (wort-lernen-plan.md, Paket SB; Tutor-Engine v3 E6). Rein und deterministisch, ohne KI und ohne Speichern (das Schreiben baut der
// Bildschirm-Agent: `writer.transform`, nur ergänzend). Je Karte eine Bank `vocab/<id>.sb[]` mit Beispielsätzen aus drei Quellen:
//   read  Sätze aus Emrahs Lesetexten/Tagesartikeln (Auswahl über `senseFits`/`gapUsable` beim Aufrufer),
//   c1    C1-Aufgabensätze (`crossLink.ts`),
//   ai    Claude-Satzbank `word-bank@1` (gebündelt, 6–8 Karten je Anfrage, je Karte 4 Sätze: 2 Beruf, 1 Alltag, 1 andere Satzform).
// Ziel: mindestens 4 Sätze je Karte vor Stufe 4, 6 vor „Fest“.
//
// Quarantäne (tutor-e8-lehrer-routine.md Leitplanke 5, gleiche Regel wie für Aufgabenvorschläge): JEDER Claude-Satz wird ab seiner Erzeugung (`t`)
// 4 Wochen nur GESAMMELT, nicht gezeigt (Klärung 19.10.2026: „4 Wochen je Satz ab Erzeugung“). Zusätzlich gilt ein gemeinsamer Freigabe-Schalter:
// Nach den ersten 4 Wochen prüft der Englischlehrer eine Stichprobe von 30 (`teacherSample`); die Hauptsession gibt nur frei bei höchstens 1 hartem
// Fehler UND höchstens 2 nicht eindeutigen Lücken (`releaseGate`, Gegenlesung S4). Danach monatliche Stichprobe. Gemeldete Sätze (`bad: 1`)
// erscheinen nie wieder. Sätze aus Lesetexten und C1-Aufgaben sind geprüfter Inhalt und sofort sichtbar.
//
// Eintrag: `{en, de, sit, k, src, t, pv, bad?}` – `k` Satzart (`work` | `life` | `form`), `pv` Vorlage oder Quelle (`word-bank@1`, `read:<id>`, `c1:<id>`).
// ≈ 250 Byte je Satz, höchstens 8 je Karte (≈ 2 KB, weit unter 64 KiB je Karte); kein neues Dokument.

type Doc = Readonly<Record<string, unknown>>;

export type SbKind = 'work' | 'life' | 'form';
export type SbSrc = 'ai' | 'read' | 'c1';
export type SbEntry = { en: string; de: string; sit: string; k: SbKind; src: SbSrc; t: number; pv: string; bad?: 1 };

/** Höchstens so viele Sätze je Karte in der Bank. */
export const SB_MAX = 8;
/** Ziel: so viele Sätze je Karte vor Stufe 4 bzw. vor „Fest“ (wort-lernen-plan.md, SB). */
export const SB_MIN_BEFORE_STAGE4 = 4;
export const SB_MIN_BEFORE_FEST = 6;
/** Claude-Sätze je Karte und Anfrage. */
export const SB_PER_REQUEST = 4;
/** Quarantäne: so lange (Tage) wird jeder Claude-Satz ab seiner Erzeugung nur gesammelt. */
export const QUARANTINE_DAYS = 28;
/** Stichprobe für den Englischlehrer; erlaubte harte Fehler und (eigenes Merkmal) nicht eindeutige Lücken für die Freigabe. */
export const TEACHER_SAMPLE = 30;
export const RELEASE_MAX_HARD_ERRORS = 1;
export const RELEASE_MAX_UNCLEAR_GAPS = 2;
/** Satzlänge in Wörtern (Claude-Sätze; wie `word-ctx`). Sätze aus echten Texten dürfen länger sein. */
export const SB_MIN_WORDS = 8;
export const SB_MAX_WORDS = 18;
export const SB_SOURCE_MAX_WORDS = 30;

const DAY_MS = 86_400_000;
const KINDS: readonly SbKind[] = ['work', 'life', 'form'];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const wordsOf = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/** Gespeicherte Bank tolerant lesen; unbekannte Formen fehlen in der Liste (im Dokument bleiben sie). `withBad`: auch gemeldete. */
export function readSb(doc: Doc, withBad = false): SbEntry[] {
  const raw = doc.sb;
  if (!Array.isArray(raw)) return [];
  const out: SbEntry[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const en = str(x.en);
    const src = x.src === 'read' || x.src === 'c1' || x.src === 'ai' ? x.src : null;
    if (!en || !src || (!withBad && x.bad === 1)) continue;
    const k = KINDS.includes(x.k as SbKind) ? (x.k as SbKind) : 'work';
    out.push({ en, de: str(x.de), sit: str(x.sit), k, src, t: num(x.t), pv: str(x.pv), ...(x.bad === 1 ? { bad: 1 as const } : {}) });
  }
  return out;
}

// ------------------------------------------------------------------ Quarantäne und Freigabe

/** Befund einer Stichprobe: harte Fehler und (eigenes Merkmal) Sätze, deren Lücke nicht eindeutig wäre. */
export type SbReview = { hard: number; unclear: number };

/** Freigabe-Schalter der Claude-Sätze (gespeichert vom Aufrufer, z. B. neben `items: on` in `tutor/fb`). `start` = erster gesammelter Claude-Satz. */
export type SbGate = { start: number | null; on: boolean; checkedAt?: number | null; review?: SbReview | null };

export const GATE_CLOSED: SbGate = { start: null, on: false };

const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);

/** Gate tolerant lesen (fehlt es oder ist es kaputt: geschlossen). */
export function readGate(v: unknown): SbGate {
  if (!isObj(v)) return GATE_CLOSED;
  const start = num(v.start) || null;
  const r = isObj(v.review) ? { hard: count(v.review.hard), unclear: count(v.review.unclear) } : null;
  const review = r && r.hard !== null && r.unclear !== null ? { hard: r.hard, unclear: r.unclear } : null;
  return { start, on: v.on === true && start !== null, checkedAt: num(v.checkedAt) || null, review };
}

/** Sind die ersten 4 Wochen Sammelzeit vorbei (dann ist die erste Stichprobe fällig)? */
export const quarantineOver = (gate: SbGate, nowMs: number): boolean => gate.start !== null && nowMs - gate.start >= QUARANTINE_DAYS * DAY_MS;

/** Ist die 4-Wochen-Quarantäne DIESES Satzes vorbei (ab Erzeugung `t`)? Ohne gültigen Zeitstempel: nie. */
export const sentenceQuarantineOver = (e: Pick<SbEntry, 't'>, nowMs: number): boolean => e.t > 0 && nowMs - e.t >= QUARANTINE_DAYS * DAY_MS;

/** Nach dem ersten gesammelten Claude-Satz: Startzeit setzen (nur einmal). `null` = nichts zu ändern. */
export const gateStartPatch = (gate: SbGate, nowMs: number): SbGate | null => (gate.start === null ? { ...gate, start: Math.floor(nowMs) } : null);

/** Besteht der Befund die Schwelle (≤ 1 harter Fehler, ≤ 2 nicht eindeutige Lücken)? */
export const reviewPasses = (r: SbReview): boolean =>
  count(r.hard) !== null && count(r.unclear) !== null && r.hard <= RELEASE_MAX_HARD_ERRORS && r.unclear <= RELEASE_MAX_UNCLEAR_GAPS;

/**
 * Freigabe nach der Stichprobe des Englischlehrers: nur wenn die ersten 4 Wochen vorbei sind und der Befund die Schwelle besteht.
 * Sonst bleibt die Bank geschlossen (die Hauptsession meldet Emrah den Befund). Gibt den neuen Schalter mit dem Befund zurück.
 */
export function releaseGate(gate: SbGate, nowMs: number, review: SbReview): SbGate {
  const ok = quarantineOver(gate, nowMs) && reviewPasses(review);
  return { ...gate, on: ok, checkedAt: Math.floor(nowMs), review: { hard: review.hard, unclear: review.unclear } };
}

/** Darf der Satz gezeigt werden? Gemeldete nie; Lesetext/C1 sofort; Claude-Sätze erst nach der Freigabe UND 4 Wochen nach ihrer Erzeugung. */
export const sbVisible = (e: SbEntry, gate: SbGate, nowMs: number): boolean =>
  e.bad !== 1 && (e.src !== 'ai' || (gate.on && sentenceQuarantineOver(e, nowMs)));

/** Sichtbare Sätze der Bank. */
export const visibleSb = (doc: Doc, gate: SbGate, nowMs: number): SbEntry[] => readSb(doc).filter((e) => sbVisible(e, gate, nowMs));

/** Claude-Sätze in Quarantäne (gesammelt, noch nicht sichtbar). */
export const quarantinedSb = (doc: Doc, gate: SbGate, nowMs: number): SbEntry[] => readSb(doc).filter((e) => e.src === 'ai' && !sbVisible(e, gate, nowMs));

// ------------------------------------------------------------------ Bedarf

/** Satzvorrat der Karte: Ursprungssatz, gespeicherte Kontexte (`xEx`) und sichtbare Bank-Sätze (ohne Dubletten). */
export function sentenceCount(doc: Doc, gate: SbGate, nowMs: number): number {
  const keys = new Set<string>();
  const add = (s: string): void => {
    const k = poolNorm(s);
    if (k) keys.add(k);
  };
  add(str(doc.ex));
  for (const x of storedExamples(doc)) add(x.en);
  for (const x of visibleSb(doc, gate, nowMs)) add(x.en);
  return keys.size;
}

/** Ziel der Karte: 4 Sätze vor Stufe 4, danach 6 (vor „Fest“). */
export const sentenceTarget = (stage: number): number => (stage >= 4 ? SB_MIN_BEFORE_FEST : SB_MIN_BEFORE_STAGE4);

/**
 * Braucht die Karte neue Claude-Sätze? Gezählt wird, was sichtbar ist, PLUS was in Quarantäne wartet – sonst würde während der Sammelzeit bei jeder
 * Runde neu gefragt. Volle Bank: nie.
 */
export function needsBank(doc: Doc, gate: SbGate, nowMs: number): boolean {
  const all = readSb(doc, true);
  if (all.length >= SB_MAX) return false;
  const have = sentenceCount(doc, gate, nowMs) + quarantinedSb(doc, gate, nowMs).length;
  return have < sentenceTarget(num(doc.stage));
}

// ------------------------------------------------------------------ Annahme

export type SbReject = 'shape' | 'id' | 'missing_word' | 'repeat' | 'length' | 'punct' | 'british' | 'quote' | 'bracket' | 'de_lang' | 'duplicate';
export type SbCard = { id: string; en: string };
export type AcceptedBank = { id: string; sb: SbEntry[]; rejected: SbReject[] };

function sentenceFault(en: string, maxWords: number): SbReject | null {
  const n = wordsOf(en);
  if (n < SB_MIN_WORDS || n > maxWords) return 'length';
  if (!/[.!?]$/.test(en)) return 'punct';
  if (BRITISH.test(en)) return 'british';
  if (/["„“”]/.test(en)) return 'quote';
  if (/[[\]{}<>]/.test(en)) return 'bracket';
  return null;
}

/** Normalformen, die ein neuer Satz nicht wiederholen darf: wie `knownKeys` (Ursprung, `xEx`, `wx`, `cfx`) plus die ganze Bank (auch gemeldete). */
export function bankKeys(doc: Doc, ex: string): Set<string> {
  const keys = knownKeys(doc, ex);
  for (const x of readSb(doc, true)) keys.add(poolNorm(x.en));
  for (const x of readWx(doc, true)) keys.add(poolNorm(x.en));
  for (const x of readCfx(doc, true)) keys.add(poolNorm(x.en));
  return keys;
}

/**
 * Prüft einen Eintrag von `word-bank@1` (`{id, sents: [{en, de, sit, k}]}`) für die Karte. Ein Satz fällt weg, wenn das Wort fehlt oder doppelt
 * vorkommt (die Lücke würde die Lösung verraten), er zu kurz/lang ist, ohne Satzzeichen endet, britisch geschrieben ist, Anführungszeichen oder
 * Klammern trägt, `de` nicht deutsch ist oder er einen bekannten Satz wiederholt. Höchstens 4 je Karte.
 */
export function acceptBankItem(raw: unknown, card: SbCard, known: ReadonlySet<string>, nowMs: number, pv: string): AcceptedBank {
  const out: AcceptedBank = { id: card.id, sb: [], rejected: [] };
  if (!isObj(raw)) return (out.rejected.push('shape'), out);
  if (str(raw.id) !== card.id) return (out.rejected.push('id'), out);
  const seen = new Set(known);
  for (const s of (Array.isArray(raw.sents) ? raw.sents : []).slice(0, SB_PER_REQUEST + 2)) {
    if (out.sb.length >= SB_PER_REQUEST) break;
    const r = checkSentence(s, card.en, seen, SB_MAX_WORDS, true);
    if (typeof r === 'string') {
      out.rejected.push(r);
      continue;
    }
    out.sb.push({ ...r, src: 'ai', t: Math.floor(nowMs), pv });
  }
  if (!out.sb.length && !out.rejected.length) out.rejected.push('shape');
  return out;
}

/**
 * Sätze aus Lesetexten (`read`) oder C1-Aufgaben (`c1`) für die Bank: dieselben Regeln, aber bis 30 Wörter und ohne Pflicht zur Übersetzung
 * (der Aufrufer wählt sie vorher mit `senseFits`/`gapUsable` aus; abgeschnittene Sätze mit „…“ fallen hier weg).
 */
export function acceptSourceSentences(
  cands: ReadonlyArray<{ en: string; de?: string; sit?: string; ref: string }>,
  card: SbCard,
  src: Exclude<SbSrc, 'ai'>,
  known: ReadonlySet<string>,
  nowMs: number,
): AcceptedBank {
  const out: AcceptedBank = { id: card.id, sb: [], rejected: [] };
  const seen = new Set(known);
  for (const c of cands) {
    if (out.sb.length >= SB_PER_REQUEST) break;
    if (/…|\.\.\./.test(c.en)) {
      out.rejected.push('punct');
      continue;
    }
    const r = checkSentence({ en: c.en, de: c.de ?? '', sit: c.sit ?? src, k: 'work' }, card.en, seen, SB_SOURCE_MAX_WORDS, false);
    if (typeof r === 'string') {
      out.rejected.push(r);
      continue;
    }
    out.sb.push({ ...r, src, t: Math.floor(nowMs), pv: `${src}:${c.ref}`.slice(0, 60) });
  }
  return out;
}

function checkSentence(s: unknown, word: string, seen: Set<string>, maxWords: number, needDe: boolean): Pick<SbEntry, 'en' | 'de' | 'sit' | 'k'> | SbReject {
  if (!isObj(s)) return 'shape';
  const en = str(s.en);
  const de = str(s.de);
  if (!en || (needDe && !de)) return 'shape';
  const fault = sentenceFault(en, maxWords);
  if (fault) return fault;
  if (!phraseIn(en, word)) return 'missing_word';
  if (wordRepeats(en, word)) return 'repeat';
  if (de && isWrongLang(de, 'de', 3)) return 'de_lang';
  const k = poolNorm(en);
  if (seen.has(k)) return 'duplicate';
  seen.add(k);
  const kind = KINDS.includes(s.k as SbKind) ? (s.k as SbKind) : 'work';
  return { en, de, sit: str(s.sit).slice(0, 40), k: kind };
}

// ------------------------------------------------------------------ Speichern (nur ergänzend)

/** Darf ein Eintrag bei voller Bank weichen? Nur ungemeldete Claude-Sätze; Lesetext/C1, gemeldete und fremde Roh-Einträge bleiben immer. */
const evictable = (x: unknown): boolean => isObj(x) && x.src === 'ai' && x.bad !== 1;

/**
 * Neue Bank: neue Einträge hinten an. Ist sie voll, weichen zuerst die ältesten ungemeldeten Claude-Sätze; reicht der Platz dann nicht, wird nur
 * ergänzt, was passt. `null` = nichts Neues oder kein Platz. Nie gelöscht wird anderes (data-guard).
 */
export function sbPatch(cur: unknown, add: readonly SbEntry[]): unknown[] | null {
  if (!add.length) return null;
  const out = Array.isArray(cur) ? [...(cur as unknown[])] : [];
  // Lesetext/C1 verdrängen nie andere Quellen, Claude-Sätze nur Claude-Sätze.
  while (out.length + add.length > SB_MAX) {
    let idx = -1;
    let oldest = Infinity;
    out.forEach((x, i) => {
      if (!evictable(x)) return;
      const t = num((x as Record<string, unknown>).t);
      if (t < oldest) {
        oldest = t;
        idx = i;
      }
    });
    if (idx < 0) break;
    out.splice(idx, 1);
  }
  const room = SB_MAX - out.length;
  if (room <= 0) return null;
  return [...out, ...add.slice(0, room)];
}

/** „Melden“: den Satz als `bad: 1` markieren (nichts gelöscht). `null` = nicht gefunden oder schon gemeldet. */
export function markSbBad(cur: unknown, en: string): unknown[] | null {
  if (!Array.isArray(cur)) return null;
  const k = poolNorm(en);
  let hit = false;
  const next = (cur as unknown[]).map((x) => {
    if (hit || !isObj(x) || poolNorm(str(x.en)) !== k || x.bad === 1) return x;
    hit = true;
    return { ...x, bad: 1 };
  });
  return hit ? next : null;
}

// ------------------------------------------------------------------ Stichprobe für den Englischlehrer

export type SampleRow = { id: string; word: string; en: string; de: string; k: SbKind; t: number };

/** FNV-1a über den Satz: stabile, gleichmäßige Reihenfolge ohne Zufall. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Deterministische Stichprobe (Standard 30) aus den ungemeldeten Claude-Sätzen, optional nur die seit `since` gesammelten (monatliche Stichprobe).
 * Höchstens 2 Sätze je Karte, damit die Stichprobe viele Wörter abdeckt.
 */
export function teacherSample(cards: ReadonlyArray<{ id: string; word: string; doc: Doc }>, n: number = TEACHER_SAMPLE, since = 0): SampleRow[] {
  const rows: SampleRow[] = [];
  for (const c of cards) {
    for (const e of readSb(c.doc)) if (e.src === 'ai' && e.t >= since) rows.push({ id: c.id, word: c.word, en: e.en, de: e.de, k: e.k, t: e.t });
  }
  rows.sort((a, b) => hash(a.en) - hash(b.en) || a.en.localeCompare(b.en));
  const per = new Map<string, number>();
  const out: SampleRow[] = [];
  for (const r of rows) {
    if (out.length >= n) break;
    const k = per.get(r.id) ?? 0;
    if (k >= 2) continue;
    per.set(r.id, k + 1);
    out.push(r);
  }
  return out;
}
