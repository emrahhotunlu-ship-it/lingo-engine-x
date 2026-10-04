import { lemmaCandidates } from '../text/lemma';
import { sentenceSplit } from '../text/textStats';

// Beleg im Text (Plan F15): der Satz mit der größten Wortüberlappung zur richtigen Option,
// die Frage zählt halb mit (Gleichstand, Umschreibungen). Verglichen werden Inhaltswörter mit
// ihren Grundformen und einem Wortstamm aus den ersten fünf Buchstaben für Umschreibungen
// (attending ↔ attend, postponed ↔ postpone). Rein lokal, ohne KI.

const STOP = new Set(
  'a an the and or but if of to in on at by for with from as is are was were be been being it its this that these those he she they we you i his her their our your my me him them us not no do does did have has had will would can could should may might must there here what which who whom whose when where why how than then so very just also only about into over after before because while more most some any all each other such own same too out up down off again once'.split(
    ' ',
  ),
);

/** Je Inhaltswort die Menge seiner Schlüssel (Form, Grundformen, Stamm). */
function wordKeys(text: string): Array<Set<string>> {
  const out: Array<Set<string>> = [];
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g) ?? []) {
    const w = raw.replace(/[’]/g, "'");
    if (STOP.has(w) || w.length < 2 || seen.has(w)) continue;
    seen.add(w);
    const k = new Set<string>(lemmaCandidates(w).slice(0, 4));
    k.add(w);
    if (w.length >= 6) k.add(`~${w.slice(0, 5)}`);
    out.push(k);
  }
  return out;
}

function union(words: ReadonlyArray<Set<string>>): Set<string> {
  const out = new Set<string>();
  words.forEach((w) => w.forEach((k) => out.add(k)));
  return out;
}

/** Anzahl der Wörter aus `a`, von denen irgendein Schlüssel in `b` vorkommt. */
function overlap(a: ReadonlyArray<Set<string>>, b: Set<string>): number {
  return a.filter((w) => [...w].some((k) => b.has(k))).length;
}

export type Evidence = { text: string; start: number; end: number };

/** Belegsatz zu `answer` (Optionstext) mit `question` als Nebenkriterium; `null` ohne jede Überlappung. */
export function evidenceSentence(text: string, answer: string, question = ''): Evidence | null {
  const sentences = sentenceSplit(text);
  if (!sentences.length) return null;
  const aKeys = wordKeys(answer);
  const qKeys = wordKeys(question);
  let best: Evidence | null = null;
  let bestScore = 0;
  for (const s of sentences) {
    const sk = union(wordKeys(s.text));
    const score = overlap(aKeys, sk) * 2 + overlap(qKeys, sk);
    if (score > bestScore) {
      bestScore = score;
      best = { text: s.text, start: s.start, end: s.end };
    }
  }
  return best;
}
