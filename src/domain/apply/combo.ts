import { hash32 } from '../random';
import type { Topic } from '../content';
import { comboFrames, type ComboFrames } from '../../content/apply/frames';

// „Wort + Regel“-Paare für die Übung „Eigener Satz“ im Reiter Anwenden (Plan Anwenden, Übung 2, Teil B). Rein und
// getestet. Wörter: die schwächsten bekannten Karten zuerst; Themen: zuerst die mit offenen Fehlersätzen, nur Themen mit
// Kurzregel. Je Runde unterschiedliche Wörter und Themen; fest je Tag und Zähler (kein Neuwürfeln beim Neuzeichnen, Kap. 15).

/**
 * `key`: Pfad der Wortkarte (`vocab/…`), damit ein Beleg aus Anwenden (F3) die Karte findet; fehlt bei älteren Aufrufern.
 * `situation`/`starter`: Rahmen aus `content/apply/frames.json` (Emrahs Live-Rückmeldung 05.11.2026): eine Situation und ein Satzanfang, der den
 * Zusammenhang erzwingt, den die Regel braucht. Fehlen bei Paaren ohne Rahmen und bei gespeicherten Runden von früher.
 */
export type ComboPair = { word: string; topicId: string; key?: string; situation?: { de: string; en: string }; starter?: string };

export type ComboWord = { word: string; lapses: number; stage: number; key?: string };

export const COMBO_ROUNDS = 3;

/** Thema „Present Perfect Continuous“: Zustandsverben passen nicht in die Verlaufsform (Befund english-teacher 05.11.2026). */
export const PPC_TOPIC = 'pres-perf-cont';
const STATE_WORDS: ReadonlySet<string> = new Set(['know', 'own', 'belong', 'consist', 'contain', 'mean', 'seem', 'prefer', 'understand', 'believe']);

/** Passt das Wort nicht zum Thema? Zustandsverben (auch als „to know“) nie mit Present Perfect Continuous. */
export function comboBlocked(word: string, topicId: string): boolean {
  if (topicId !== PPC_TOPIC) return false;
  const head = word.trim().toLowerCase().replace(/^to\s+/, '').split(/\s+/)[0] ?? '';
  return STATE_WORDS.has(head);
}

/**
 * `todayTopics`: Grammatikthemen des heutigen Plans (`u.gt.topics`); sie kommen vor allen anderen (Prüfung learning-scientist 02.11.2026:
 * Anwenden verbindet die Wörter und das Thema von heute). Danach Themen mit offenen Fehlersätzen, dann der Rest fest je Tag gemischt.
 */
export function pickPairs(
  words: readonly ComboWord[],
  topics: readonly Topic[],
  errorTopics: readonly string[],
  seed: string,
  n: number = COMBO_ROUNDS,
  todayTopics: readonly string[] = [],
  frames: ComboFrames = comboFrames(),
): ComboPair[] {
  const usable = topics.filter((t) => t.rule && t.rule.trim());
  if (!usable.length || !words.length) return [];
  const fromToday = todayTopics.map((id) => usable.find((t) => t.id === id)).filter((t): t is Topic => !!t);
  const first = new Set(fromToday.map((t) => t.id));
  const withErrors = usable.filter((t) => !first.has(t.id) && errorTopics.includes(t.id));
  const rest = usable.filter((t) => !first.has(t.id) && !errorTopics.includes(t.id)).sort((a, b) => hash32(`${seed}|${a.id}`) - hash32(`${seed}|${b.id}`));
  const topicOrder = [...fromToday, ...withErrors, ...rest];
  const wordOrder = [...words].sort((a, b) => b.lapses - a.lapses || a.stage - b.stage || (a.word < b.word ? -1 : 1));
  const out: ComboPair[] = [];
  const seenWords = new Set<string>();
  // Themen als Warteschlange: jedes Wort nimmt das erste passende Thema; ein übersprungenes (Sperrliste) bleibt vorn für das nächste Wort.
  let queue: Topic[] = [];
  for (const w of wordOrder) {
    if (out.length >= n) break;
    const key = w.word.toLowerCase();
    if (seenWords.has(key)) continue;
    if (!queue.some((t) => !comboBlocked(w.word, t.id))) queue = [...queue, ...topicOrder];
    const at = queue.findIndex((t) => !comboBlocked(w.word, t.id));
    const t = queue[at];
    if (!t) continue;
    seenWords.add(key);
    queue = [...queue.slice(0, at), ...queue.slice(at + 1)];
    const pair: ComboPair = w.key ? { word: w.word, topicId: t.id, key: w.key } : { word: w.word, topicId: t.id };
    // Rahmen fest je Tag, Wort und Thema (kein Neuwürfeln beim Neuzeichnen).
    const list = frames[t.id] ?? [];
    const frame = list.length ? list[hash32(`${seed}|${key}|${t.id}`) % list.length] : undefined;
    if (frame) Object.assign(pair, { situation: { de: frame.de, en: frame.en }, starter: frame.starter });
    out.push(pair);
  }
  return out;
}
