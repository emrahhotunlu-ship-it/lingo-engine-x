import { newVocabDoc } from '../srs/newCard';

// Claude-Blatt „Übersetzen“ (plan.md §1.2, N93, Emrahs Kritik A7): Jede Wendung und das ganze
// Ergebnis kommen mit EINEM Tipp in den Wortschatz – immer mit Ursprungssatz (Kap. 15). Rein:
// Hier wird nur bestimmt, WAS gespeichert werden kann; gespeichert wird über `lookup/store`.

export type SaveTarget = { key: string; word: string; de: string; ex: string; kind: 'result' | 'term' };

type Result = {
  from: 'de' | 'en';
  text: string;
  translation: string;
  example?: string | null;
  alternatives: ReadonlyArray<{ text: string }>;
  terms: ReadonlyArray<{ en: string; de: string }>;
};

const clean = (x: string) => x.trim().replace(/^["'„“”‚‘’]+|["'„“”‚‘’.!?;:,]+$/g, '').trim();
const words = (x: string) => x.split(/\s+/).filter(Boolean).length;

/** Nur Ziele, aus denen wirklich eine Karte mit Satz entsteht (`newVocabDoc` ≠ null). */
function valid(word: string, de: string, sentences: readonly string[]): { ex: string } | null {
  for (const ex of sentences) {
    if (!ex.trim()) continue;
    const made = newVocabDoc({ word, de, ex, src: 'translate', origin: { v: 1, kind: 'translate', t: 0 }, today: '2000-01-01' });
    if (made) return { ex };
  }
  return null;
}

export function saveTargets(r: Result): SaveTarget[] {
  const out: SaveTarget[] = [];
  const en = r.from === 'de' ? r.translation.trim() : r.text.trim();
  const de = r.from === 'de' ? r.text.trim() : r.translation.trim();
  const sentences = [r.from === 'de' ? r.translation : r.text, ...r.alternatives.map((a) => a.text), r.example ?? ''];
  // Das ganze Ergebnis: kurze Wendung (Satz = Beispiel) oder ein Satz (Satz = eigener Ursprung).
  if (en && de && !/\n/.test(en) && words(en) <= 25) {
    const short = words(en) <= 5;
    const word = short ? clean(en).replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase()) : en;
    const hit = short ? valid(word, clean(de), [r.example ?? '', ...sentences].filter((x) => words(x) > words(word) + 1)) : valid(word, de, [en]);
    if (hit) out.push({ key: `result|${word}`, word, de: short ? clean(de) : de, ex: hit.ex, kind: 'result' });
  }
  for (const t of r.terms) {
    const hit = valid(t.en, t.de, sentences);
    if (hit && !out.some((o) => o.word.toLowerCase() === t.en.toLowerCase())) out.push({ key: `term|${t.en}`, word: t.en, de: t.de, ex: hit.ex, kind: 'term' });
  }
  return out;
}
