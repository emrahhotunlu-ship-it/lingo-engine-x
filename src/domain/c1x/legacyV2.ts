import { splitWords } from '../answer/align';
import { v2Tasks } from '../grammar/patterns';
import type { FindTask, KwtTask, V2Task } from '../grammar/patternTypes';
import { keyOf, findSeq } from './kinds/common';
import { kwtWords } from './kwtNorm';
import type { C1Item, Err, Kwt } from './types';

// Nur-Lese-Adapter (Lernplattform 3.0 K-1): die LP2-Aufgaben `kwt` und `find` aus `tasks-v2.json` als c1x-Aufgaben.
// IDs `kwt-v2-<n>` / `err-v2-<n>` mit n = 1-basierte Position in der Datei (die Datei wird nur hinten ergänzt, neue Inhalte entstehen
// im c1x-Format). `meaning` bleibt eine LP2-Aufgabe. Nichts wird geschrieben.

/** Teil A und Teil B einer Lösungsvariante: Teil A reicht bis zum Schlüsselwort, Teil B ist der Rest; steht das Schlüsselwort am Ende, ist Teil B das letzte Wort. */
function splitKey(variant: string, key: string): { a: string; b: string } {
  const words = splitWords(variant);
  if (words.length < 2) return { a: variant, b: variant };
  const at = words.findIndex((w) => keyOf(w) === key.toLowerCase());
  const cut = at >= 0 && at < words.length - 1 ? at + 1 : words.length - 1;
  return { a: words.slice(0, cut).join(' '), b: words.slice(cut).join(' ') };
}

function kwtFrom(t: KwtTask, n: number): Kwt {
  const [before = '', after = ''] = t.frame.split(/_{3,}/);
  const variants = [t.answer, ...t.accepted];
  const counts = variants.map((v) => kwtWords(v).length);
  const own = splitWords(t.answer).filter((w) => keyOf(w) !== t.key.toLowerCase());
  return {
    id: `kwt-v2-${n}`,
    kind: 'kwt',
    area: 'gram',
    pat: t.pat,
    topic: t.topic,
    level: 'B2',
    dom: 'biz',
    why: t.why,
    src: 'seed',
    lead: t.from,
    key: t.key,
    before: before.trim(),
    after: after.trim() || '.',
    keys: variants.map((v) => {
      const { a, b } = splitKey(v, t.key);
      return { a: [a], b: [b] };
    }),
    tiles: own.length ? own : [t.answer],
    extra: [],
    // Die LP2-Wortzahl zählt Kurzformen als ein Wort (I'd); Cambridge zählt zwei. Der Bereich wird um die ausgeschriebenen Varianten erweitert.
    words: [Math.min(t.words[0], ...counts), Math.max(t.words[1], ...counts)],
  };
}

function errFrom(t: FindTask, n: number): Err {
  const base = { id: `err-v2-${n}`, kind: 'err' as const, area: 'gram' as const, pat: t.pat, topic: t.topic, level: 'B2' as const, dom: 'biz' as const, why: t.why, src: 'seed' as const, text: t.prompt };
  if (!t.err) return { ...base, bad: null };
  const words = splitWords(t.prompt);
  const [from, to] = t.err;
  const seq = words.slice(from, to + 1);
  const keys = seq.map(keyOf);
  const hay = words.map(keyOf);
  // Wievielter Treffer der Wortfolge ist die Fehlerstelle?
  let nth = 1;
  for (let i = 0; i < from; i++) if (findSeq(hay.slice(i, i + keys.length), keys) === 0) nth++;
  return { ...base, bad: { span: seq.join(' '), ...(nth > 1 ? { nth } : {}), fix: [t.answer ?? '', ...t.accepted] } };
}

let cache: C1Item[] | null = null;

/** Alle LP2-`kwt`- und `find`-Aufgaben als c1x-Aufgaben (einmal gebaut). */
export function legacyV2Items(): readonly C1Item[] {
  if (cache) return cache;
  const all = v2Tasks();
  const out: C1Item[] = [];
  all.forEach((t: V2Task, i) => {
    if (t.type === 'kwt') out.push(kwtFrom(t, i + 1));
    else if (t.type === 'find') out.push(errFrom(t, i + 1));
  });
  cache = out;
  return out;
}

/** Eine einzelne Aufgabe nach ihrer ID (`kwt-v2-7`), sonst `null`. */
export const legacyV2ById = (id: string): C1Item | null => legacyV2Items().find((x) => x.id === id) ?? null;
