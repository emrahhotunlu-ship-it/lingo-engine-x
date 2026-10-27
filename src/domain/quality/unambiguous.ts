// Eindeutigkeit von Lücken-Aufgaben (E1a). Rein. Ergänzt `lintTask` (Tutor-Engine v3 §4.2) um drei Prüfungen:
//
//   gap_no_hint      eine offene Lücke (keine Auswahl, kein Ausgangssatz) mit mehrteiliger Lösung ohne jeden Hinweis: viele Antworten wären richtig
//   several_correct  in der Auswahl stehen zwei richtige Antworten (Lösung/`accepted`), oder dieselbe Option zweimal
//   slot_count       Zahl der Lücken passt nicht zur Zahl der Teile in der Lösung, oder die Wortzahl-Angabe („3 words“) passt nicht

export type GapIssue = 'gap_no_hint' | 'several_correct' | 'slot_count';
export const GAP_ISSUES: readonly GapIssue[] = ['gap_no_hint', 'several_correct', 'slot_count'];

export type GapInput = {
  prompt: string;
  answer: string;
  accepted?: readonly string[];
  options?: readonly string[] | null;
  hint?: string | null;
  /** Ausgangssatz vorhanden (Umformung, Schlüsselwort): dann ist die Lücke nie „ohne Hinweis“. */
  hasSource?: boolean;
};

const GAP_RE = /_{3,}/g;
const PAREN_HINT = /\(\s*[^)]*[a-z][^)]*\)/i;
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ein: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fünf: 5 };

/** Wortzahl aus einem Hinweis wie „(3 words)“, „2–3 Wörter“, „three words“; `null` ohne Angabe. */
export function wordSpan(text: string): [number, number] | null {
  const m = /\b(\d|one|two|three|four|five|six|ein|eins|zwei|drei|vier|fünf)(?:\s*[-–]\s*(\d|two|three|four|five|six|zwei|drei|vier|fünf))?\s+(words?|wörter|wort)\b/i.exec(text);
  if (!m) return null;
  const v = (s: string): number => (/^\d$/.test(s) ? Number(s) : (NUM[s.toLowerCase()] ?? 0));
  const lo = v(m[1]!);
  const hi = m[2] ? v(m[2]) : lo;
  return lo > 0 && hi >= lo ? [lo, hi] : null;
}

/** Wörter einer Antwort; Kurzformen zählen als ein Wort (`don't`), Bindestrich-Wörter auch. */
export const answerWords = (s: string): number => (s.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;

/** Teile einer Lösung für mehrere Lücken („had / been“, „had … been“, „had | been“). */
const parts = (answer: string): number => answer.split(/\s*(?:\/|\||…|\.\.\.)\s*/).filter((p) => p.trim()).length;

export function checkGap(i: GapInput): GapIssue[] {
  const out = new Set<GapIssue>();
  const gaps = (i.prompt.match(GAP_RE) ?? []).length;
  const opts = i.options ?? null;
  const hintText = `${i.hint ?? ''} ${(PAREN_HINT.exec(i.prompt) ?? [''])[0]}`.trim();

  // Ein einzelnes Funktionswort (as, the, on) ist aus dem Satz eindeutig; ab zwei Wörtern braucht die offene Lücke einen Hinweis.
  if (gaps >= 1 && !opts?.length && !i.hasSource && !hintText && answerWords(i.answer) >= 2) out.add('gap_no_hint');

  if (opts?.length) {
    const o = opts.map(norm);
    if (new Set(o).size !== o.length) out.add('several_correct');
    const ok = new Set([i.answer, ...(i.accepted ?? [])].map(norm));
    if (o.filter((x) => ok.has(x)).length > 1) out.add('several_correct');
  }

  if (gaps > 1 && parts(i.answer) !== gaps) out.add('slot_count');
  const span = wordSpan(hintText);
  if (span && gaps === 1) {
    for (const a of [i.answer, ...(i.accepted ?? [])]) {
      const n = answerWords(a);
      if (n < span[0] || n > span[1]) out.add('slot_count');
    }
  }
  return GAP_ISSUES.filter((x) => out.has(x));
}
