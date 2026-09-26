import { stripGapMarks } from '../text/tokenize';
import { locate, lemmaOf } from './context';
import type { TrainCard } from './types';

// Beispielsätze nach dem Prüfen (CLAUDE.md A7): Ursprungssatz, Sätze der Kollokationen und
// gespeicherte KI-Beispiele (`xEx`, nur ergänzt). Doppelte und der schon sichtbare Satz fallen weg.

export type ExampleSource = 'origin' | 'col' | 'ai';
export type Example = { en: string; src: ExampleSource };
export type StoredExample = { en: string; t: number };

export const EXAMPLES_MAX = 3;
/** Weniger als so viele eigene Beispiele → KI ergänzt (einmal je Karte). */
export const EXAMPLES_MIN = 2;
/** Höchstens so viele KI-Beispiele werden gespeichert. */
export const X_EX_MAX = 3;

const key = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const clean = (s: unknown): string => (typeof s === 'string' ? stripGapMarks(s).text.replace(/\s+/g, ' ').trim() : '');

/** Gespeicherte KI-Beispiele der Karte (`xEx`), tolerant gelesen. */
export function storedExamples(doc: Readonly<Record<string, unknown>>): StoredExample[] {
  const raw = doc.xEx;
  if (!Array.isArray(raw)) return [];
  const out: StoredExample[] = [];
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    const en = clean(r.en);
    if (en) out.push({ en, t: typeof r.t === 'number' ? r.t : 0 });
  }
  return out;
}

/**
 * Bis zu drei Beispielsätze der Karte in der Reihenfolge Ursprungssatz → Kollokationen → KI.
 * `shown` (der Satz der Übung) wird nicht wiederholt – nichts doppelt auf einem Bildschirm.
 */
export function cardExamples(card: Pick<TrainCard, 'context' | 'doc'>, shown: string | null, extra: readonly StoredExample[] = []): Example[] {
  const seen = new Set<string>();
  if (shown) seen.add(key(shown));
  const out: Example[] = [];
  const add = (en: string, src: ExampleSource) => {
    const k = key(en);
    if (!en || k.split(' ').length < 3 || seen.has(k)) return;
    seen.add(k);
    out.push({ en, src });
  };
  add(card.context?.sentence ?? clean(card.doc.ex), 'origin');
  if (Array.isArray(card.doc.col)) {
    for (const c of card.doc.col) if (c && typeof c === 'object') add(clean((c as Record<string, unknown>).ex), 'col');
  }
  for (const x of [...storedExamples(card.doc), ...extra]) add(x.en, 'ai');
  return out.slice(0, EXAMPLES_MAX);
}

/** KI-Beispiele prüfen: enthalten das Wort (auch gebeugt), keine Klammern, sinnvolle Länge. */
export function acceptExamples(word: string, list: readonly string[], nowMs: number): StoredExample[] {
  const lemma = lemmaOf(word);
  const out: StoredExample[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const en = clean(raw);
    const k = key(en);
    if (en.length < 12 || en.length > 220 || seen.has(k)) continue;
    if (!locate(en, lemma)) continue;
    seen.add(k);
    out.push({ en, t: nowMs });
    if (out.length >= X_EX_MAX) break;
  }
  return out;
}

/** Patch für `vocab/<id>`: nur ergänzen, wenn die Karte noch keine KI-Beispiele hat. */
export function examplesPatch(cur: Readonly<Record<string, unknown>> | undefined, add: readonly StoredExample[]): { xEx: StoredExample[] } | null {
  if (!cur || !add.length) return null;
  // Vorhandenes (auch Unerwartetes) wird nie ersetzt.
  if (cur.xEx !== undefined && cur.xEx !== null) return null;
  return { xEx: add.slice(0, X_EX_MAX).map((x) => ({ en: x.en, t: x.t })) };
}
