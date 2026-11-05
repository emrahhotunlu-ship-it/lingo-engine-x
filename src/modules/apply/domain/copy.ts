// Abschreib-Schutz der Zusammenfassung (F3, Nachtrag learning-scientist Muss 2): lokal, ohne Claude.
// - Wortfolgen von mindestens 6 Wörtern, die wörtlich im Artikel stehen, werden markiert (Zeichenbereiche im eigenen Text).
// - Mehr als 25 % der 4-Wort-Folgen des eigenen Textes stehen im Artikel → Hinweis „in eigenen Worten“.
// Vergleich ohne Groß-/Kleinschreibung und ohne Satzzeichen; typografische Apostrophe gelten wie gerade. Rein, ohne Importe.
// - 4-Wort-Folgen nur aus Namen (groß geschrieben), Zahlen und Funktionswörtern zählen nicht (Prüfbefund T10): „the European Central Bank“ oder
//   „in 2025 and the“ lassen sich in eigenen Worten kaum vermeiden.

export const COPY_RUN_MIN = 6;
export const COPY_GRAM = 4;
export const COPY_RATIO_MAX = 0.25;

type Tok = { w: string; start: number; end: number; plain: boolean };

/** Funktionswörter (Artikel, Präpositionen, Hilfsverben, Pronomen, Bindewörter). */
const FUNCTION_WORDS = new Set(
  'a an the of in on at to for by with from into onto over under about after before during since until up out off and or but nor so yet if than then as is are was were be been being am do does did has have had will would shall should can could may might must it its this that these those there here he she they we i you me him her us them his their our my your which who whom whose what when where why how not no also very more most'.split(' '),
);

/** Name, Zahl oder Funktionswort (für die 4-Wort-Folgen kein Zeichen von Abschreiben). */
const plainWord = (raw: string, w: string): boolean => /^\p{N}/u.test(raw) || /^\p{Lu}/u.test(raw) || FUNCTION_WORDS.has(w);

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

export function tokens(text: string): Tok[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => {
    const w = m[0].toLowerCase().replace(/’/g, "'");
    return { w, start: m.index, end: m.index + m[0].length, plain: plainWord(m[0], w) };
  });
}

function grams(ws: readonly string[], n: number): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + n <= ws.length; i++) out.add(ws.slice(i, i + n).join(' '));
  return out;
}

export type CopyRun = { start: number; end: number };
export type CopyCheck = {
  /** Übernommene Folgen (≥ 6 Wörter) als Zeichenbereiche im eigenen Text, zusammengelegt und sortiert. */
  runs: CopyRun[];
  /** Anteil der 4-Wort-Folgen des eigenen Textes, die im Artikel stehen (0 bis 1). */
  ratio: number;
  /** Hinweis „in eigenen Worten“ zeigen. */
  hint: boolean;
};

export function copyCheck(own: string, article: string): CopyCheck {
  const mine = tokens(own);
  const src = tokens(article).map((t) => t.w);
  const words = mine.map((t) => t.w);
  const srcRuns = grams(src, COPY_RUN_MIN);
  const marked = new Array<boolean>(mine.length).fill(false);
  for (let i = 0; i + COPY_RUN_MIN <= words.length; i++) {
    if (srcRuns.has(words.slice(i, i + COPY_RUN_MIN).join(' '))) for (let k = i; k < i + COPY_RUN_MIN; k++) marked[k] = true;
  }
  const runs: CopyRun[] = [];
  for (let i = 0; i < mine.length; i++) {
    if (!marked[i]) continue;
    const start = mine[i]?.start ?? 0;
    let j = i;
    while (j + 1 < mine.length && marked[j + 1]) j++;
    runs.push({ start, end: mine[j]?.end ?? start });
    i = j;
  }
  const srcGrams = grams(src, COPY_GRAM);
  let total = 0;
  let hit = 0;
  for (let i = 0; i + COPY_GRAM <= words.length; i++) {
    if (mine.slice(i, i + COPY_GRAM).every((t) => t.plain)) continue;
    total++;
    if (srcGrams.has(words.slice(i, i + COPY_GRAM).join(' '))) hit++;
  }
  const ratio = total > 0 ? hit / total : 0;
  return { runs, ratio, hint: ratio > COPY_RATIO_MAX };
}
