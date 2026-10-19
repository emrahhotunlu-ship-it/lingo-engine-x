import { splitWords, alignKey } from '../answer/align';
import { toUS } from '../answer/spelling';
import { legacyNorm, legacyTaskKey } from '../grammar/key';
import { allSeedTasks } from '../grammar/tasks';
import { isDictWord, dictLookup } from '../lexicon/dict';
import { lemmaCandidates } from '../text/lemma';
import { wordDistance } from './check';
import { repairNorm, type RepairSrc } from './repair';

// Ausschlussregeln beim LESEN der Fehlersätze (Paket FK, docs/umbau/wort-lernen-plan.md). Ein Fehlersatz, der ganz oder halb kaputt ist
// (verstümmelt, nur ein Wort, Anweisung als Satz, Dopplung, Mitschrift, schon richtig), wird Emrah nicht als „korrigiere das“ gezeigt.
// Rein, schreibt nichts, löscht nichts: Die Einträge bleiben in der Datenbank, das Fehlerradar zählt sie weiter.

export type HideReason =
  | 'empty' // leere oder „…“-Antwort, weniger als 2 Zeichen
  | 'typo' // reiner Tippfehler (ein unbekanntes Wort, Abstand ≤ 2)
  | 'toomany' // mehr als 3 Abweichungen oder mehr als 40 % anders
  | 'instruction' // Aufgabenart ohne Ausgangsmaterial (Umformung, Hinweis in Klammern) oder Anweisung als Satz
  | 'short' // weniger als 4 Wörter
  | 'noverb' // kein Verb im Satz
  | 'doubled' // Satzteil doppelt
  | 'transcript' // Spracherkennungs-Mitschrift ohne Bestätigung
  | 'stylistic' // richtige Fassung nur Stil, Schreibweise oder Zeichensetzung
  | 'fragment' // abgeschnittener Satz (ein Wort bricht mitten ab)
  | 'correct'; // gezeigter Satz ist selbst richtig

export type QualityInput = {
  wrong: string;
  right: string;
  /** Herkunft des Satzes (Reparatur-Satz) bzw. `lesson` bei Grammatik-Fehlern. */
  src?: RepairSrc;
  /** Bei Grammatik-Fehlern: die ursprüngliche Aufgabe (mit Lücke) und die damalige Antwort. */
  q?: string;
  given?: string;
  /** Mitschrift vom Sprechen, die Emrah bestätigt hat (heute nirgends gesetzt: Mitschriften bleiben ausgeblendet). */
  confirmed?: boolean;
};

const AUX = new Set(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'must', 'may', 'might', 'shall', "i'm", "it's", "that's", "there's", "we've", "i've", "you've", "they've", "he's", "she's", "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't", "won't", "can't", "couldn't", "wouldn't", "shouldn't", "haven't", "hasn't", "hadn't", 'cannot']);
const INSTR = /^(rewrite|rephrase|transform|change (?:it |this )?to|complete the|combine|join the|put the .{0,40}into|turn .{0,40}into|report the|begin the)\b/i;
const LABELS = /^(active|passive|direct speech|reported speech|direct|reported|statement|question|sentence)\s*:/i;
const BRACKET_TASK = /\((?:use|using|rewrite|change|make|begin|start|with|key|word)\b[^)]*\)/i;
const BRACKET_HINT = /\([^()]*\/[^()]*\)/;
const SCHAR = /[.,!?;:"“”‘’()]+/g;

let seedKeys: Map<string, { accepted: string[]; answer: string; type: string }> | null = null;
function seedByKey(): Map<string, { accepted: string[]; answer: string; type: string }> {
  if (seedKeys) return seedKeys;
  const m = new Map<string, { accepted: string[]; answer: string; type: string }>();
  for (const t of allSeedTasks()) if (!m.has(t.key)) m.set(t.key, { accepted: t.accepted, answer: t.answer, type: t.type });
  seedKeys = m;
  return m;
}

const tokens = (s: string): string[] => splitWords(s).map(alignKey).filter(Boolean);

function hasVerb(words: readonly string[]): boolean {
  return words.some((w) => {
    if (AUX.has(w)) return true;
    if (w.length > 4 && /(ed|ing)$/.test(w)) return true;
    return lemmaCandidates(w).some((l) => dictLookup(l)?.senses.some((s) => s.pos === 'verb' || s.pos === 'phrasal'));
  });
}

/**
 * Satzteil doppelt (verstümmelter Eintrag)? Drei Wörter in gleicher Folge öfter als im richtigen Satz, ein Wortpaar „A B A B“ oder ein Wort doppelt
 * hintereinander („I I“) oder der falsche Satz ist um 5 Wörter länger als der richtige. Zwei verschiedene Stellen mit „I would“ sind kein Fehler.
 */
function doubled(wrong: readonly string[], right: readonly string[]): boolean {
  if (wrong.length >= right.length + 5) return true;
  for (let i = 0; i + 1 < wrong.length; i++) {
    if (wrong[i] === wrong[i + 1] && !right.some((w, k) => w === wrong[i] && right[k + 1] === w)) return true;
    if (i + 3 < wrong.length && wrong[i] === wrong[i + 2] && wrong[i + 1] === wrong[i + 3]) return true;
  }
  const grams = (w: readonly string[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i + 2 < w.length; i++) {
      const k = `${w[i]} ${w[i + 1]} ${w[i + 2]}`;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };
  const gw = grams(wrong);
  const gr = grams(right);
  for (const [k, n] of gw) if (n > 1 && n > (gr.get(k) ?? 0)) return true;
  return false;
}

/** Die einzige abweichende Wortstelle, wenn es genau eine ist (sonst `null`). */
function singleDiff(a: readonly string[], b: readonly string[]): [string, string] | null {
  if (a.length !== b.length) return null;
  const idx = a.map((w, i) => (w === b[i] ? -1 : i)).filter((i) => i >= 0);
  return idx.length === 1 ? [a[idx[0]!]!, b[idx[0]!]!] : null;
}

const chars = (a: string, b: string): number => wordDistance([...a], [...b]);

/** Reiner Tippfehler: langes, unbekanntes Wort, höchstens 2 Zeichen daneben und keine andere Wortform (kein Anfangsstück des richtigen Worts). */
const isTypo = (a: string, b: string): boolean => a.length >= 6 && chars(a, b) <= 2 && !a.startsWith(b) && !b.startsWith(a) && !isDictWord(a);

const memo = new Map<string, HideReason | null>();

/** Warum dieser Fehlersatz nicht als Aufgabe taugt, sonst `null`. Das Ergebnis hängt nur vom Text ab und wird zwischengemerkt (die Zählungen rufen es oft auf). */
export function fehlersatzProblem(i: QualityInput): HideReason | null {
  const key = `${i.wrong}\u0001${i.right}\u0001${i.src ?? ''}\u0001${i.q ?? ''}\u0001${i.given ?? ''}\u0001${i.confirmed ? 1 : 0}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const r = fehlersatzProblemRaw(i);
  if (memo.size > 3000) memo.clear();
  memo.set(key, r);
  return r;
}

function fehlersatzProblemRaw(i: QualityInput): HideReason | null {
  const wrongText = i.wrong.trim();
  const plain = wrongText.replace(SCHAR, '').replace(/[…]+/g, '').trim();
  if (plain.length < 2 || /(^|\s)(…|\.\.\.)(\s|$|[.,!?])/.test(wrongText) || /[…]$/.test(wrongText)) return 'empty';
  if (i.src === 'talk' && !i.confirmed) return 'transcript';
  const w = tokens(wrongText);
  const r = tokens(i.right);
  // Aufgabenart ohne Ausgangsmaterial: Umformung (Pfeil), Anweisung als Satz, Hinweis in Klammern, Etikett vorn.
  const q = (i.q ?? '').trim();
  if (q.includes('→') || LABELS.test(wrongText) || INSTR.test(wrongText) || BRACKET_TASK.test(wrongText) || BRACKET_HINT.test(wrongText) || wrongText.includes('→')) return 'instruction';
  if (q) {
    const seed = seedByKey().get(legacyTaskKey(q));
    if (seed && (seed.type === 'transform' || seed.type === 'kwt')) return 'instruction';
    // Die damalige Antwort war nach der Aufgabe selbst richtig (erlaubte Alternative).
    const given = (i.given ?? '').trim();
    if (seed && given && [seed.answer, ...seed.accepted].some((a) => legacyNorm(a) === legacyNorm(given))) return 'correct';
  }
  if (w.length < 4) return 'short';
  if (doubled(w, r)) return 'doubled';
  if (!hasVerb(w)) return 'noverb';
  const same = (a: string): string => toUS(repairNorm(a));
  const nw = same(wrongText);
  const nr = same(i.right);
  if (nw === nr) return 'stylistic';
  // Tippfehler: genau ein Wort weicht ab, es ist kein echtes Wort und liegt höchstens 2 Zeichen daneben.
  const one = singleDiff(w, r);
  if (one && isTypo(one[0], one[1])) return 'typo';
  if (one && one[1].startsWith(one[0]) && one[1].length - one[0].length >= 3 && !isDictWord(one[0])) return 'fragment';
  const dist = wordDistance(w, r);
  if (dist > 3 || dist / Math.max(w.length, r.length) > 0.4) return 'toomany';
  return null;
}

/** Kurzer Hinweis aus der ursprünglichen Lückenaufgabe: der Text in Klammern direkt hinter der Lücke („already / send“). */
export function gapHintOf(q: string): string | null {
  const m = /_{3,}\s*\(([^()]*)\)/.exec(q);
  return m?.[1]?.trim() || null;
}
