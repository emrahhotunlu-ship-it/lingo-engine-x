import { BRITISH } from '../c1x/kinds/common';
import { poolNorm } from '../drills/orderPool';
import { isWrongLang } from '../lang/detect';
import { histOf } from '../srs/flip';
import { storedExamples } from '../srs/examples';
import { phraseIn } from '../../prompts/tolerant';

// Wörter-Tutor (Lernplattform 3.0 P52, KI-Tutor T3): rein und deterministisch. Welche Karte ist schwach, braucht sie neue Sätze, und was von der
// Antwort `word-ctx@1` besteht die formale Prüfung. Gespeichert wird nur ergänzend in `vocab/<id>.wx[]` (≤ 4) und `vocab/<id>.cfx[]` (≤ 2);
// `xEx`, `S`/`D`/`due`/`stage` und alle anderen Felder bleiben unberührt (das Speichern selbst: `features/vocab/wordCtx.ts`).

type Doc = Readonly<Record<string, unknown>>;
export type Bi = { de: string; en: string };

/** Ein gespeicherter Claude-Satz für ein schwaches Wort. `sit` = Situation (kurz, Englisch). */
export type Wx = {
  en: string;
  de: string;
  sit: string;
  t: number;
  pv: string;
  bad?: 1;
};
/** Ein Kontrast-Satz: enthält das verwechselte Wort `w`, nie das Kartenwort. */
export type Cfx = {
  w: string;
  en: string;
  why: Bi;
  t: number;
  pv: string;
  bad?: 1;
};

export const WX_MAX = 4;
export const CFX_MAX = 2;
/** Frische Claude-Sätze gelten so lange (Tage); darunter weniger als `WX_FRESH_MIN` → Bedarf. */
export const WX_FRESH_DAYS = 30;
export const WX_FRESH_MIN = 2;
/** Schwach: so viele Rückfälle insgesamt oder so viele Fehler im Fenster. */
export const WEAK_LAPSES = 2;
export const WEAK_ERRORS = 2;
export const WEAK_WINDOW_DAYS = 14;
/** Satzlänge in Wörtern (wie `card-examples`). */
export const SENT_MIN_WORDS = 8;
export const SENT_MAX_WORDS = 18;
/** Kontrast nur, wenn beide Karten mindestens diese Stufe haben (Interferenz, ki-tutor.md Z. 80). */
export const CONTRAST_MIN_STAGE = 2;

const DAY_MS = 86_400_000;
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

/** Rückfälle der Karte (FSRS zuerst, sonst die Felder der alten App). */
export function lapsesOf(doc: Doc): number {
  const f = isObj(doc.fsrs) ? doc.fsrs : {};
  return Math.max(num(f.lapses), num(doc.lapses));
}

/** Schwach = `lapses ≥ 2` oder mindestens 2 Fehler (`g === 1`) in den letzten 14 Tagen. */
export function isWeak(doc: Doc, nowMs: number): boolean {
  if (lapsesOf(doc) >= WEAK_LAPSES) return true;
  const from = nowMs - WEAK_WINDOW_DAYS * DAY_MS;
  return histOf(doc).filter((h) => h.t >= from && h.g === 1).length >= WEAK_ERRORS;
}

/** Gespeicherte Claude-Sätze, tolerant gelesen. `withBad`: auch gemeldete (für den Dubletten-Abgleich). */
export function readWx(doc: Doc, withBad = false): Wx[] {
  const raw = doc.wx;
  if (!Array.isArray(raw)) return [];
  const out: Wx[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const en = str(x.en);
    if (!en || (!withBad && x.bad === 1)) continue;
    out.push({
      en,
      de: str(x.de),
      sit: str(x.sit),
      t: num(x.t),
      pv: str(x.pv),
      ...(x.bad === 1 ? { bad: 1 as const } : {}),
    });
  }
  return out;
}

/** Gespeicherte Kontrast-Sätze, tolerant gelesen (ohne zweisprachiges `why` unbrauchbar). */
export function readCfx(doc: Doc, withBad = false): Cfx[] {
  const raw = doc.cfx;
  if (!Array.isArray(raw)) return [];
  const out: Cfx[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const en = str(x.en);
    const w = str(x.w);
    const why = isObj(x.why) ? { de: str(x.why.de), en: str(x.why.en) } : null;
    if (!en || !w || !why || !why.de || !why.en || (!withBad && x.bad === 1)) continue;
    out.push({
      w,
      en,
      why,
      t: num(x.t),
      pv: str(x.pv),
      ...(x.bad === 1 ? { bad: 1 as const } : {}),
    });
  }
  return out;
}

/** Frische, nicht gemeldete Claude-Sätze (≤ 30 Tage). */
export const freshWx = (doc: Doc, nowMs: number): Wx[] => readWx(doc).filter((x) => nowMs - x.t <= WX_FRESH_DAYS * DAY_MS);

/** Bedarf: weniger als 2 frische Claude-Sätze. */
export const needsWordCtx = (doc: Doc, nowMs: number): boolean => freshWx(doc, nowMs).length < WX_FRESH_MIN;

/** Ein Wort der Anfrage (Eingabe von `word-ctx@1`). `other` nur, wenn beide Karten Stufe ≥ 2 haben. */
export type WordCtxWord = {
  id: string;
  en: string;
  pos: string;
  de: string;
  ex: string;
  other: { en: string; de: string } | null;
};

export type RejectReason = 'shape' | 'id' | 'missing_word' | 'length' | 'punct' | 'british' | 'quote' | 'de_lang' | 'duplicate' | 'contrast_target' | 'contrast_other' | 'contrast_why';

export type AcceptedWordCtx = {
  id: string;
  wx: Wx[];
  cfx: Cfx | null;
  rejected: RejectReason[];
};

/** Gemeinsame Satzprüfung (Englisch): Länge, Satzzeichen am Ende, US-Schreibweise, kein gerades Anführungszeichen. */
function sentenceFault(en: string): RejectReason | null {
  const n = words(en);
  if (n < SENT_MIN_WORDS || n > SENT_MAX_WORDS) return 'length';
  if (!/[.!?]$/.test(en)) return 'punct';
  if (BRITISH.test(en)) return 'british';
  if (en.includes('"')) return 'quote';
  return null;
}

/** Normalformen, die ein neuer Satz nicht wiederholen darf: Ursprungssatz, `xEx`, gespeicherte `wx`/`cfx` (auch gemeldete). */
export function knownKeys(doc: Doc, ex: string): Set<string> {
  const keys = new Set<string>();
  const add = (s: string) => {
    const k = poolNorm(s);
    if (k) keys.add(k);
  };
  add(ex);
  add(str(doc.ex));
  for (const x of storedExamples(doc)) add(x.en);
  for (const x of readWx(doc, true)) add(x.en);
  for (const x of readCfx(doc, true)) add(x.en);
  return keys;
}

/**
 * Formale Prüfung eines Eintrags `{id, sents: [{en, de, sit}], contrast: {en, why: {de, en}} | null}` für `word`.
 * Ein Satz wird abgelehnt, wenn das Wort fehlt (beugungstolerant), er zu kurz/lang ist, ohne Satzzeichen endet, britisch geschrieben ist, `"` enthält,
 * `de` nicht deutsch ist oder er einen bekannten Satz wiederholt. Der Kontrast muss `other.en` enthalten und darf das Kartenwort NICHT enthalten.
 * Ohne `other` (eine Karte unter Stufe 2) wird ein Kontrast nie übernommen.
 */
export function acceptWordCtx(raw: unknown, word: WordCtxWord, known: ReadonlySet<string>, nowMs: number, pv: string): AcceptedWordCtx {
  const out: AcceptedWordCtx = { id: word.id, wx: [], cfx: null, rejected: [] };
  if (!isObj(raw)) {
    out.rejected.push('shape');
    return out;
  }
  if (str(raw.id) && str(raw.id) !== word.id) {
    out.rejected.push('id');
    return out;
  }
  const seen = new Set(known);
  const sents = Array.isArray(raw.sents) ? (raw.sents as unknown[]).slice(0, 2) : [];
  if (!sents.length) out.rejected.push('shape');
  for (const s of sents) {
    if (!isObj(s)) {
      out.rejected.push('shape');
      continue;
    }
    const en = str(s.en);
    const de = str(s.de);
    if (!en || !de) {
      out.rejected.push('shape');
      continue;
    }
    if (!phraseIn(en, word.en)) {
      out.rejected.push('missing_word');
      continue;
    }
    const fault = sentenceFault(en);
    if (fault) {
      out.rejected.push(fault);
      continue;
    }
    if (isWrongLang(de, 'de', 3)) {
      out.rejected.push('de_lang');
      continue;
    }
    const k = poolNorm(en);
    if (seen.has(k)) {
      out.rejected.push('duplicate');
      continue;
    }
    seen.add(k);
    out.wx.push({ en, de, sit: str(s.sit).slice(0, 40), t: nowMs, pv });
  }
  const c = raw.contrast;
  if (word.other && isObj(c)) {
    const en = str(c.en);
    const why = isObj(c.why) ? { de: str(c.why.de), en: str(c.why.en) } : null;
    const fault = en ? sentenceFault(en) : 'shape';
    if (!en || !why) out.rejected.push('shape');
    else if (!phraseIn(en, word.other.en)) out.rejected.push('contrast_other');
    else if (phraseIn(en, word.en)) out.rejected.push('contrast_target');
    else if (fault) out.rejected.push(fault);
    else if (!why.de || !why.en || why.de.length > 220 || why.en.length > 220 || isWrongLang(why.de, 'de', 3) || isWrongLang(why.en, 'en', 3)) out.rejected.push('contrast_why');
    else if (seen.has(poolNorm(en))) out.rejected.push('duplicate');
    else out.cfx = { w: word.other.en, en, why, t: nowMs, pv };
  }
  return out;
}

/** Neue Liste `wx`: Rohdaten bleiben unverändert, neue Sätze hinten an; über 4 fällt der älteste weg. `null` = nichts Neues. */
export function wxPatch(cur: unknown, add: readonly Wx[]): unknown[] | null {
  if (!add.length) return null;
  const list = Array.isArray(cur) ? [...(cur as unknown[])] : [];
  return [...list, ...add].slice(-WX_MAX);
}

/** Neue Liste `cfx` (wie `wxPatch`, höchstens 2). */
export function cfxPatch(cur: unknown, add: Cfx | null): unknown[] | null {
  if (!add) return null;
  const list = Array.isArray(cur) ? [...(cur as unknown[])] : [];
  return [...list, add].slice(-CFX_MAX);
}

/** „Melden“: den Eintrag mit diesem Satz als `bad: 1` markieren (nichts gelöscht). `null` = nicht gefunden oder schon gemeldet. */
export function markBad(cur: unknown, en: string): unknown[] | null {
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
