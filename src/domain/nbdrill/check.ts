import { editDistance } from '../answer/diff';
import { toUS } from '../answer/spelling';
import { lemmaCandidates } from '../text/lemma';
import { normText } from '../week/text';

// Lokale Prüfung getippter Antworten der neuen Übungen (Plan N101/N102, rein, ohne KI):
// Groß-/Kleinschreibung, Satzzeichen, gerade/typografische Apostrophe und Kurzformen zählen nicht
// (can't = cannot, let's = let us). Britische Schreibweise und britische Wörter sind richtig
// (A7.3); die Rückmeldung nennt dann die US-Form als Hinweis. Ein kleiner Tippfehler ist
// „fast richtig“, nie „richtig“.

export type AnswerVerdict = 'ok' | 'close' | 'wrong';

export type AnswerCheck = {
  verdict: AnswerVerdict;
  /** Richtig, aber in britischer Form: `us` ist die US-Fassung der getroffenen Lösung. */
  uk: boolean;
  /** Die Lösung, der die Antwort am nächsten kommt (Original-Schreibweise). */
  match: string;
};

/** Normalform einer Antwort: normText + US-Schreibweise je Wort. */
export function normAnswer(s: string): string {
  const n = normText(s);
  return n ? toUS(n) : '';
}

/** Erlaubte Tippfehler je Länge (wie die Kartenprüfung, auf Wendungen erweitert). */
export const phraseTypoBudget = (len: number): number => (len <= 4 ? 0 : len <= 10 ? 1 : len <= 24 ? 2 : 3);

export function checkAnswer(given: string, accepted: readonly string[]): AnswerCheck {
  const list = accepted.filter((a) => a.trim());
  const fallback = list[0] ?? '';
  const raw = normText(given);
  if (!raw || !list.length) return { verdict: 'wrong', uk: false, match: fallback };
  const us = toUS(raw);
  for (const a of list) {
    const na = normText(a);
    if (na === raw) return { verdict: 'ok', uk: false, match: a };
  }
  for (const a of list) {
    if (toUS(normText(a)) === us) return { verdict: 'ok', uk: us !== raw, match: a };
  }
  let best = { a: fallback, d: Number.POSITIVE_INFINITY };
  for (const a of list) {
    const d = editDistance(us, normAnswer(a));
    if (d < best.d) best = { a, d };
  }
  const budget = phraseTypoBudget(normAnswer(best.a).length);
  if (best.d > 0 && best.d <= budget) return { verdict: 'close', uk: false, match: best.a };
  return { verdict: 'wrong', uk: false, match: best.a };
}

/** Wortzahl einer Antwort (Kurzformen ausgeschrieben, wie `normText`). */
export function wordCount(s: string): number {
  const n = normText(s);
  return n ? n.split(' ').length : 0;
}

/** Enthält die Antwort das Wort (auch gebeugt: `may` in „may not“, `despite` …)? */
export function hasKeyword(given: string, key: string): boolean {
  const words = normText(given).split(' ');
  const k = normText(key);
  if (!k) return true;
  if (k.includes(' ')) return ` ${normText(given)} `.includes(` ${k} `);
  return words.some((w) => w === k || lemmaCandidates(w).includes(k));
}

/** Ein einzelnes Verb (auch gebeugt: closed, striking) gegen eine Liste von Grundformen. */
export function matchVerb(given: string, verbs: readonly string[]): string | null {
  const g = normAnswer(given).replace(/^to /, '');
  if (!g) return null;
  for (const v of verbs) {
    const nv = normAnswer(v).replace(/^to /, '');
    if (!nv) continue;
    if (g === nv) return v;
    // Mehrwort-Verben (z. B. „set up“): erstes Wort darf gebeugt sein.
    const [gh, ...gt] = g.split(' ');
    const [vh, ...vt] = nv.split(' ');
    if (gt.join(' ') === vt.join(' ') && gh && vh && (gh === vh || lemmaCandidates(gh).includes(vh))) return v;
  }
  return null;
}
