import type { KeyWord, Sentence } from '../schemas';
import { phraseUsed } from './apply';
import type { CourseId } from './courses';
import type { KeptPhrase, LessonEntry } from './lessonProgress';
import { PHRASES_KEPT } from './lessonProgress';
import { normKey } from './text';
import { buildModel, findSurface, pickKeyWords } from './readerModel';

// Aufwärmen (Paket L8, docs/umbau/lesen-kurse.md §2 Nr. 0): zwei Lückensätze aus früheren Lektionen desselben Kurses, LOKAL gebaut aus den
// Wendungen und Sätzen, die die App beim Abschluss einer Lektion in `read/cp` (`ph`) behalten hat. Kein KI-Aufruf, kein Wartezeit.

export const WARMUP_GAP = '_____';
export const WARMUP_COUNT = 2;

/** Die Wendungen einer Lektion mit ihrem Satz, wie sie beim Abschluss in `read/cp` bleiben (höchstens 5). */
export function keptPhrasesOf(lesson: { paras: Sentence[][]; phrases: KeyWord[] }): KeptPhrase[] {
  const model = buildModel({ paras: lesson.paras });
  return pickKeyWords(model, lesson.phrases)
    .filter((p) => p.sentence)
    .slice(0, PHRASES_KEPT)
    .map((p) => ({ w: p.kw.w, de: p.kw.de, e: p.sentence?.e ?? '' }));
}

export type WarmupItem = {
  /** Stabile Kennung (Lektion und Wendung). */
  id: string;
  /** Wendung, wie sie in der Liste steht. */
  w: string;
  de: string;
  /** Satz mit Lücke. */
  gap: string;
  /** Die Form, die im Satz stand (die Lücke ist damit gefüllt). */
  answer: string;
  fromN: number;
};

/**
 * Bis zu zwei Lücken aus früheren, fertigen Lektionen: zuerst aus der letzten, dann aus der davor; gibt es nur eine frühere Lektion, zwei Wendungen
 * daraus. Die Auswahl hängt nur von der Lektionsnummer ab (nicht vom Zufall), damit sie sich beim Neuzeichnen nie ändert (Kap. 15).
 */
export function buildWarmup(entries: readonly LessonEntry[], course: CourseId, n: number): WarmupItem[] {
  const earlier = entries
    .filter((e) => e.course === course && e.done === true && (e.n ?? 0) < n && (e.ph?.length ?? 0) > 0)
    .sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
  const out: WarmupItem[] = [];
  const used = new Set<string>();
  const take = (entry: LessonEntry, offset: number): void => {
    const list = entry.ph ?? [];
    for (let k = 0; k < list.length && out.length < WARMUP_COUNT; k++) {
      const ph = list[(n + offset + k) % list.length];
      if (!ph) continue;
      const key = normKey(ph.w);
      if (used.has(key)) continue;
      const hit = findSurface(ph.e, ph.w);
      if (!hit) continue;
      used.add(key);
      out.push({ id: `${entry.id}:${key}`, w: ph.w, de: ph.de ?? '', gap: `${ph.e.slice(0, hit.span[0])}${WARMUP_GAP}${ph.e.slice(hit.span[1])}`, answer: hit.surface, fromN: entry.n ?? 0 });
      return;
    }
  };
  for (const [i, e] of earlier.entries()) {
    if (out.length >= WARMUP_COUNT) break;
    take(e, i);
  }
  // Nur eine frühere Lektion: die zweite Lücke kommt aus derselben.
  const first = earlier[0];
  if (out.length < WARMUP_COUNT && first) take(first, 1);
  return out.slice(0, WARMUP_COUNT);
}

/** Stimmt die Eingabe? Die Form aus dem Satz oder die Wendung (auch gebeugt) gilt. */
export function warmupRight(item: Pick<WarmupItem, 'w' | 'answer'>, input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  return normKey(t) === normKey(item.answer) || phraseUsed(t, item.w);
}
