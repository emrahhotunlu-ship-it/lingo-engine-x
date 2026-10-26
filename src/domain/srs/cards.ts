import { dayKey } from '../date';
import { unitHeld } from '../lexicon/unitHeld';
import { mergedVocab } from '../overview';
import { chargeCollocsFor } from './collocs';
import { findContext, lemmaOf, parseCollocs, senseFits } from './context';
import { stageOf } from './ladder';
import { isFutureFsrs, isNewState, readFsrs } from './scheduler';
import type { Counts, Lang, TrainCard } from './types';

// Vokabeln der Datenbank (überlagert auf die Voreinstellungen) → einheitliche Trainerkarten.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function counts(v: unknown): Record<string, Counts> {
  const out: Record<string, Counts> = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return out;
  for (const [k, raw] of Object.entries(v as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    out[k] = { c: Math.max(0, num(r.c)), w: Math.max(0, num(r.w)) };
  }
  return out;
}

// P7-1: Satzstelle und Kollokationen hängen nur am Dokument. Unveränderte Dokumente kommen als
// dasselbe Objekt (contract/db.d.ts, Validierungs-Cache H6) – je Dokument nur einmal suchen.
/**
 * Der gespeicherte Satz der Karte, wenn er zur Wortart der Karte passt (Audit 12.10.2026: Karte „mistake“ mit dem Satz „I was mistaken …“,
 * Karte „blunt“ als Verb mit „a blunt weapon“). Sonst ersatzweise ein anderer Satz der Karte (`fallbackContext`), sonst keiner.
 */
function ownContext(doc: Doc, word: string): TrainCard['context'] {
  const hit = findContext(doc.ex, word);
  return hit && senseFits(hit, doc.pos) ? hit : null;
}

/**
 * Gespeicherter Satz mit Lücken-Platzhalter (Übungssatz, Rückmeldung 2): nicht als Ursprungssatz zeigen, sondern ersatzweise ein
 * sauberes KI-Beispiel (`xEx`) oder der Satz einer Kollokation. Das Dokument bleibt unverändert (nichts löschen, Kap. 9).
 */
function fallbackContext(doc: Doc, word: string): TrainCard['context'] {
  const pool: unknown[] = [];
  if (Array.isArray(doc.xEx)) for (const x of doc.xEx) if (x && typeof x === 'object') pool.push((x as Record<string, unknown>).en);
  if (Array.isArray(doc.col)) for (const c of doc.col) if (c && typeof c === 'object') pool.push((c as Record<string, unknown>).ex);
  for (const s of pool) {
    const hit = findContext(s, word);
    // Ersatz nur in der Bedeutung der Karte („decline“ = Rückgang, nicht „to decline“): lieber kein Satz als einer mit falscher Wortart.
    if (hit && senseFits(hit, doc.pos)) return hit;
  }
  return null;
}

type Static = { lemma: string; context: TrainCard['context']; col: TrainCard['col'] };
const STATIC = new WeakMap<object, Static>();
function staticOf(doc: Doc, word: string): Static {
  const hit = STATIC.get(doc);
  if (hit) return hit;
  // Karte ohne eigene Wortpartner: die geprüfte Charge `col` (gegengelesen, ohne Marke `ai`). Geschrieben wird sie erst mit der ersten Wortpartner-Antwort (`cardPatch`).
  const col = parseCollocs(chargeCollocsFor(doc) ?? doc.col);
  const s: Static = { lemma: lemmaOf(word), context: ownContext(doc, word) ?? fallbackContext(doc, word), col };
  STATIC.set(doc, s);
  return s;
}

/** Wortpartner-Arten (Auswahl und getippt): höchstens EINE solche Aufgabe je Karte und Lerntag (Engine-Verdrahtung 19.10.2026). */
const PARTNER_EX: ReadonlySet<string> = new Set(['colloc', 'colloc_gap']);

/** Hatte die Karte an diesem Lerntag (Wechsel 04:00) schon eine Wortpartner-Aufgabe? Aus dem Verlauf, rein. */
export function partnerDoneToday(hist: readonly unknown[], nowMs: number): boolean {
  const today = dayKey(nowMs);
  return hist.some((h) => {
    if (!h || typeof h !== 'object') return false;
    const e = h as Record<string, unknown>;
    return typeof e.x === 'string' && PARTNER_EX.has(e.x) && typeof e.t === 'number' && Number.isFinite(e.t) && dayKey(e.t) === today;
  });
}

export function toTrainCard(id: string, doc: Doc, inDb: boolean, nowMs: number): TrainCard | null {
  const word = str(doc.word);
  if (!word || isFutureFsrs(doc)) return null;
  const st = staticOf(doc, word);
  const fsrs = readFsrs(doc, nowMs);
  const hist = Array.isArray(doc.hist) ? doc.hist : [];
  const last = hist[hist.length - 1] as Record<string, unknown> | undefined;
  const held = unitHeld(doc) !== null;
  return {
    kind: 'vocab',
    key: `vocab/${id}`,
    id,
    path: `vocab/${id}`,
    inDb,
    word,
    lemma: st.lemma,
    pos: str(doc.pos),
    de: str(doc.de),
    def: str(doc.def),
    context: st.context,
    col: st.col,
    src: str(doc.src),
    fsrs,
    stage: stageOf(doc),
    isNew: isNewState(fsrs),
    hidden: doc.hidden === true || held,
    ...(held ? { held: true as const } : {}),
    xs: counts(doc.xs),
    modes: counts(doc.modes),
    lastMode: last && typeof last.m === 'string' ? last.m : null,
    lastEx: last && typeof last.x === 'string' ? last.x : null,
    ...(partnerDoneToday(hist, nowMs) ? { partnerToday: true } : {}),
    chunk: null,
    intro: str(doc.intro),
    order: num(doc.order, 900),
    added: str(doc.added) ?? '',
    doc,
  };
}

/** Alle Karten (auch ausgeblendete – die Runde filtert). Ungültige Dokumente sind schon ausgeschlossen. */
export function buildTrainCards(dbVocab: ReadonlyMap<string, Doc>, nowMs: number, invalidIds?: ReadonlySet<string>): TrainCard[] {
  const out: TrainCard[] = [];
  for (const [id, doc] of mergedVocab(dbVocab, invalidIds)) {
    const card = toTrainCard(id, doc, dbVocab.has(id), nowMs);
    if (card) out.push(card);
  }
  return out;
}

/** Bedeutung in der Oberflächensprache: Deutsch → `de`, Englisch → `def` (keine Mischsprache). */
export function meaningOf(card: Pick<TrainCard, 'de' | 'def'>, lang: Lang): string | null {
  return lang === 'de' ? card.de : card.def;
}

/**
 * Bedeutung für Aufgaben (nie für Listen und Anzeigen): Fehlt sie in der Oberflächensprache, gilt die andere. Der Tagesplan hängt nicht
 * von der Sprache ab („DE 30 gegen EN 27 Karten“, Lernplattform 2.0 §2.3), und eine Karte ohne englische Definition bleibt abfragbar
 * (Rückfall auf die deutsche Bedeutung). Gleichwertig in beide Richtungen.
 */
export function meaningForTask(card: Pick<TrainCard, 'de' | 'def'>, lang: Lang): string | null {
  return (lang === 'de' ? card.de || card.def : card.def || card.de) ?? null;
}

/**
 * Erste Bedeutung als Antwortoption. Deutsch: die erste von mehreren Übersetzungen (Komma
 * oder Semikolon). Englisch: die ganze erste Definition bis zum Semikolon – Kommas gehören dort
 * zum Satz, und nichts wird mitten im Wort abgeschnitten (B6). Sehr lange Texte werden nur an
 * einer Wortgrenze gekürzt.
 */
export function shortMeaning(m: string, lang: Lang = 'de'): string {
  const first = (m.split(lang === 'en' ? /;/ : /[;,]/)[0] ?? m).trim();
  const max = lang === 'en' ? 120 : 60;
  if (first.length <= max) return first;
  const cut = first.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
