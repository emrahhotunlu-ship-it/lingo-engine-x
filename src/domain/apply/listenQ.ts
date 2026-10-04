import { isWrongLang } from '../lang/detect';
import { usesChunk } from '../text/chunkMatch';
import { normText } from '../text/normText';
import { hash32 } from '../random';

// Prüfung der von Claude geschriebenen Hörtexte vor der Anzeige (Plan Anwenden, Übung 3; Lernwissenschaft: formal prüfen,
// kennzeichnen). Rein und getestet. Inhaltlich kann ein Text Fehler haben – die Oberfläche kennzeichnet ihn deshalb.

export type ListenItem = {
  /** Stabile Kennung aus dem Text. */
  id: string;
  word: string;
  text: string;
  question: string;
  /** Optionen in der Reihenfolge der Anzeige (fest gemischt), `answer` zeigt auf die richtige. */
  options: string[];
  answer: number;
  quote: string;
  why: string;
};

const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const words = (s: string): number => s.split(/\s+/).filter(Boolean).length;

export const LISTEN_TEXT_WORDS: readonly [number, number] = [20, 90];

/** Ein Rohobjekt prüfen: gültiger Eintrag oder `null`. `seen` = schon gehörte Texte (normiert). */
export function acceptListen(raw: unknown, uiLang: 'de' | 'en', seen: ReadonlySet<string> = new Set()): ListenItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const word = str(o.word);
  const text = str(o.text);
  const question = str(o.question);
  const quote = str(o.quote);
  const why = str(o.why);
  const opts = Array.isArray(o.options) ? o.options.map(str) : [];
  const answer = typeof o.answer === 'number' ? Math.round(o.answer) : Number.NaN;
  if (!word || !text || !question || !quote || !why) return null;
  if (opts.length !== 3 || opts.some((x) => !x || x.length > 90) || new Set(opts.map(normText)).size !== 3) return null;
  if (!Number.isInteger(answer) || answer < 0 || answer > 2) return null;
  const w = words(text);
  if (w < LISTEN_TEXT_WORDS[0] || w > LISTEN_TEXT_WORDS[1]) return null;
  if (text.length > 600 || question.length > 160 || why.length > 240) return null;
  if (/["„“”()[\]{}]/.test(text)) return null;
  // Sprache: Text englisch, Frage englisch, Erklärung in der Oberflächensprache.
  if (isWrongLang(text, 'en') || isWrongLang(question, 'en') || isWrongLang(why, uiLang)) return null;
  // Das Zielwort kommt im Text vor (auch gebeugt).
  if (!usesChunk(text, word)) return null;
  // Der Beleg steht wörtlich im Text und ist lang genug, um die Antwort zu tragen.
  if (words(quote) < 3 || !normText(text).includes(normText(quote))) return null;
  // Die Frage darf nicht schon die richtige Antwort verraten.
  const right = opts[answer] ?? '';
  if (normText(question).includes(normText(right))) return null;
  if (seen.has(normText(text))) return null;
  // Feste Mischung, damit die richtige Antwort nicht immer an derselben Stelle steht (Fehler des Input-Blocks, 02.10.).
  const order = [0, 1, 2].sort((a, b) => hash32(`${text}|${a}`) - hash32(`${text}|${b}`));
  const options = order.map((i) => opts[i] ?? '');
  return { id: `lq${hash32(normText(text)).toString(36)}`, word, text, question, options, answer: order.indexOf(answer), quote, why };
}

/** Alle gültigen Einträge einer Antwort (Dubletten und Ungültiges fallen weg). */
export function acceptListenAll(items: readonly unknown[], uiLang: 'de' | 'en', seen: ReadonlySet<string> = new Set()): ListenItem[] {
  const out: ListenItem[] = [];
  const have = new Set(seen);
  for (const x of items) {
    const it = acceptListen(x, uiLang, have);
    if (!it) continue;
    have.add(normText(it.text));
    out.push(it);
  }
  return out;
}
