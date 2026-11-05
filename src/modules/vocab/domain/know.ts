import { isWrongLang, toUSText } from '../shared';
import { exampleKey, locateGap } from './card';

// Großpaket W2 „Wörter-Wissen“ (docs/umbau/wissen/plan.md, Emrah 05.11.2026): Prüfung der Ergänzungen von `word-know@1`, bevor etwas gespeichert
// wird. Rein, ohne Datenbank. Je Wort höchstens 3 Wortpartner (`col`) und 2 Beispielsätze (Satzbank `sb`, Herkunft `ai`). Was eine Regel verletzt,
// fällt einzeln weg; nichts wird repariert oder erfunden. Gespeichert wird nur ergänzend (`knowPatch`): Wortpartner nur in ein LEERES `col`,
// Sätze hinten an die Satzbank (≤ 8), nie ein Satz, der schon da ist; Vorhandenes wird nie überschrieben oder gelöscht.

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const words = (s: string): string[] => s.toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];

export const KNOW_COL_MAX = 3;
export const KNOW_SENT_MAX = 2;
export const KNOW_SENT_MIN_WORDS = 8;
export const KNOW_SENT_MAX_WORDS = 22;
/** Satzbank-Obergrenze je Wort (wie `SB_MAX` der Satzbank). */
export const KNOW_SB_MAX = 8;

export type KnowCard = {
  id: string;
  /** Stichwort (Grundform; Wendungen mit sb/sth). */
  head: string;
  /** Phrasal Verb (Teile dürfen getrennt stehen). */
  pv: boolean;
  /** Falsche Verbindungen einer Falle (`teach.colloc`, z. B. „hold a presentation“): nie als Wortpartner. */
  wrong: readonly string[];
  /** Vorhandene Sätze (Ursprung, `wx`, `sb`): kein neuer Satz darf einen davon wiederholen. */
  known: readonly string[];
};

export type KnowCol = { p: string; de: string; ex: string; ai: 1; pv: string; t: number };
export type KnowSent = { en: string; de: string; sit: string; k: 'work'; src: 'ai'; t: number; pv: string };
export type KnowReject = 'shape' | 'id' | 'col_word' | 'col_len' | 'col_prep' | 'col_wrong' | 'col_de' | 'col_ex' | 'sent_word' | 'sent_len' | 'sent_form' | 'sent_de' | 'repeat';
export type KnowAccepted = { id: string; col: KnowCol[]; sb: KnowSent[]; rejected: KnowReject[] };

const PREP_END = /\b(to|of|for|with|on|in|at|about|from|by|into|onto|over|under)$/i;
const BAD_CHARS = /["„“”[\]{}<>]/;

/** Kommt der Kern des Stichworts (ohne Platzhalter) in der Wendung vor? */
function hasHead(text: string, head: string): boolean {
  const core = words(head).filter((w) => !['sb', 'sth', 'someone', 'something', 'one', "one's"].includes(w));
  if (!core.length) return false;
  const tw = new Set(words(text));
  // Gebeugte Formen zählen: Wortanfang (raise → raised, raising) bzw. Wortstamm ohne Endungs-e.
  return core.every((c) => tw.has(c) || [...tw].some((w) => w.startsWith(c.replace(/e$/, '')) && w.length - c.length <= 3));
}

function colFault(raw: Obj, card: KnowCard): KnowReject | null {
  const p = str(raw.p);
  const de = str(raw.de);
  const ex = str(raw.ex);
  const pw = p.split(' ').filter(Boolean).length;
  if (pw < 2 || pw > 5 || p.length > 40 || BAD_CHARS.test(p)) return 'col_len';
  if (!hasHead(p, card.head)) return 'col_word';
  // Einheiten-Regel (Inhalts-Audit 04.11.2026, Grundsatz 3): keine Präposition am Ende („a discount on“ ist keine Einheit).
  if (PREP_END.test(p)) return 'col_prep';
  const low = p.toLowerCase();
  if (card.wrong.some((w) => low.includes(w.toLowerCase()) || w.toLowerCase().includes(low))) return 'col_wrong';
  if (de.length < 2 || de.length > 60 || BAD_CHARS.test(de) || isWrongLang(de, 'de')) return 'col_de';
  // Der Satz zeigt die Wendung in genau EINER Klammer; die Klammer enthält das Stichwort, der Satz ist Englisch und kurz.
  const brackets = [...ex.matchAll(/\[([^[\]]+)\]/g)];
  const plain = ex.replace(/\[([^\]]*)\]/g, '$1');
  const n = words(plain).length;
  if (brackets.length !== 1 || n < 6 || n > KNOW_SENT_MAX_WORDS || /["„“”]/.test(ex) || isWrongLang(plain, 'en') || !/[.!?]$/.test(plain)) return 'col_ex';
  if (!hasHead(brackets[0]![1]!, card.head)) return 'col_ex';
  return null;
}

function sentFault(raw: Obj, card: KnowCard, seen: Set<string>): KnowReject | null {
  const en = str(raw.en);
  const de = str(raw.de);
  const n = words(en).length;
  if (n < KNOW_SENT_MIN_WORDS || n > KNOW_SENT_MAX_WORDS) return 'sent_len';
  if (!/[.!?]$/.test(en) || BAD_CHARS.test(en) || isWrongLang(en, 'en')) return 'sent_form';
  // Dieselbe Prüfung wie für Abfragesätze: das Wort muss sich im Satz finden lassen (sonst taugt der Satz auch später nicht als Lücke).
  if (!locateGap(en, card.head, { pv: card.pv })) return 'sent_word';
  if (de.length < 8 || de.length > 300 || isWrongLang(de, 'de')) return 'sent_de';
  if (seen.has(exampleKey(en))) return 'repeat';
  return null;
}

/** Einen Eintrag `{id, col: [...], sents: [...]}` für die Karte prüfen. US-Schreibweise wird angeglichen (britische Formen gelten als richtig). */
export function acceptKnow(raw: unknown, card: KnowCard, nowMs: number, pv: string): KnowAccepted {
  const out: KnowAccepted = { id: card.id, col: [], sb: [], rejected: [] };
  if (!isObj(raw)) return (out.rejected.push('shape'), out);
  if (str(raw.id) !== card.id) return (out.rejected.push('id'), out);
  const t = Math.floor(nowMs);
  const colSeen = new Set<string>();
  for (const c of (Array.isArray(raw.col) ? raw.col : []).slice(0, KNOW_COL_MAX + 2)) {
    if (out.col.length >= KNOW_COL_MAX) break;
    if (!isObj(c)) {
      out.rejected.push('shape');
      continue;
    }
    const fixed = { ...c, p: toUSText(str(c.p)), ex: toUSText(str(c.ex)) };
    const f = colFault(fixed, card);
    const key = str(fixed.p).toLowerCase();
    if (f || colSeen.has(key)) {
      out.rejected.push(f ?? 'repeat');
      continue;
    }
    colSeen.add(key);
    out.col.push({ p: str(fixed.p), de: str(c.de), ex: str(fixed.ex), ai: 1, pv, t });
  }
  const seen = new Set(card.known.map(exampleKey));
  for (const s of (Array.isArray(raw.sents) ? raw.sents : []).slice(0, KNOW_SENT_MAX + 2)) {
    if (out.sb.length >= KNOW_SENT_MAX) break;
    if (!isObj(s)) {
      out.rejected.push('shape');
      continue;
    }
    const fixed = { ...s, en: toUSText(str(s.en)) };
    const f = sentFault(fixed, card, seen);
    if (f) {
      out.rejected.push(f);
      continue;
    }
    seen.add(exampleKey(str(fixed.en)));
    out.sb.push({ en: str(fixed.en), de: str(s.de), sit: str(s.sit).slice(0, 40) || 'work', k: 'work', src: 'ai', t, pv });
  }
  if (!out.col.length && !out.sb.length && !out.rejected.length) out.rejected.push('shape');
  return out;
}

/** Braucht das Wort-Dokument Wissen? Ohne Wortpartner oder mit weniger als 3 Sätzen (Ursprung + Claude + Satzbank, auch in Quarantäne). */
export function needsKnow(doc: Obj): boolean {
  if (doc.hidden === true) return false;
  const col = Array.isArray(doc.col) ? doc.col.filter((c) => isObj(c) && str(c.p)) : [];
  const sb = Array.isArray(doc.sb) ? doc.sb.filter((x) => isObj(x) && x.bad !== 1 && str(x.en)) : [];
  const wx = Array.isArray(doc.wx) ? doc.wx.filter((x) => isObj(x) && x.bad !== 1 && str(x.en)) : [];
  const sentences = (str(doc.ex) ? 1 : 0) + sb.length + wx.length;
  return col.length === 0 || sentences < 3;
}

/**
 * Ergänzende Änderung für ein Wort-Dokument (auf dem FRISCHEN Stand im Schreibschritt): Wortpartner nur, wenn `col` leer ist; Sätze hinten an
 * die Satzbank bis 8, ohne Doppel. Merkt den Versuch in `kn: {t, pv}` (auch ohne Ergebnis), damit dasselbe Wort nicht täglich neu gefragt wird.
 * `null` = nichts zu ändern.
 */
export function knowPatch(cur: Obj, a: KnowAccepted, nowMs: number, pv: string): Obj | null {
  const patch: Obj = {};
  const col = Array.isArray(cur.col) ? cur.col.filter((c) => isObj(c) && str(c.p)) : [];
  if (col.length === 0 && a.col.length) patch.col = a.col;
  const sb: unknown[] = Array.isArray(cur.sb) ? (cur.sb as unknown[]) : [];
  const wx: unknown[] = Array.isArray(cur.wx) ? (cur.wx as unknown[]) : [];
  const have = new Set<string>([str(cur.ex), ...sb.map((x) => (isObj(x) ? str(x.en) : '')), ...wx.map((x) => (isObj(x) ? str(x.en) : ''))].filter(Boolean).map(exampleKey));
  const add = a.sb.filter((x) => !have.has(exampleKey(x.en)));
  const room = Math.max(0, KNOW_SB_MAX - sb.length);
  if (add.length && room > 0) patch.sb = [...sb, ...add.slice(0, room)];
  patch.kn = { t: Math.floor(nowMs), pv };
  return patch;
}

/** Zuletzt gefragt vor weniger als 14 Tagen? Dann dieses Wort jetzt nicht wieder anfragen. */
export const KNOW_RETRY_DAYS = 14;
export function knowRecent(doc: Obj, nowMs: number): boolean {
  const kn = isObj(doc.kn) ? doc.kn : null;
  const t = kn && typeof kn.t === 'number' ? kn.t : 0;
  return t > 0 && nowMs - t < KNOW_RETRY_DAYS * 86_400_000;
}
