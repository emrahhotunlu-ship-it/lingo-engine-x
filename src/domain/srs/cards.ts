import { mergedVocab } from '../overview';
import { findContext, lemmaOf, parseCollocs } from './context';
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

export function toTrainCard(id: string, doc: Doc, inDb: boolean, nowMs: number): TrainCard | null {
  const word = str(doc.word);
  if (!word || isFutureFsrs(doc)) return null;
  const fsrs = readFsrs(doc, nowMs);
  const hist = Array.isArray(doc.hist) ? doc.hist : [];
  const last = hist[hist.length - 1] as Record<string, unknown> | undefined;
  return {
    kind: 'vocab',
    key: `vocab/${id}`,
    id,
    path: `vocab/${id}`,
    inDb,
    word,
    lemma: lemmaOf(word),
    pos: str(doc.pos),
    de: str(doc.de),
    def: str(doc.def),
    context: findContext(doc.ex, word),
    col: parseCollocs(doc.col),
    src: str(doc.src),
    fsrs,
    stage: stageOf(doc),
    isNew: isNewState(fsrs),
    hidden: doc.hidden === true,
    xs: counts(doc.xs),
    modes: counts(doc.modes),
    lastMode: last && typeof last.m === 'string' ? last.m : null,
    lastEx: last && typeof last.x === 'string' ? last.x : null,
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
