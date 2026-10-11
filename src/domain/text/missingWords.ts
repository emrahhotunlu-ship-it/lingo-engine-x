// Fehlendes Wort in einer Fehlerstelle („Fehler finden“). Rein, ohne Texte; der Kopf der Rückmeldung (`ui/exercise/findHead.ts`) formuliert daraus den Satz.

export type Missing = { words: string; where: 'before' | 'after'; /** Das Wort der Fehlerstelle, an dem die Lücke liegt. */ anchor: string; many: boolean };

const bare = (w: string): string => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');

/**
 * Fehlt der Fehlerstelle nur ein Wort (Lösung = Fehlerstelle mit genau einer eingefügten Wortgruppe, z. B. „finished“ → „have finished“ oder
 * „such great meeting“ → „such a great meeting“)? Dann nennt der Kopf das fehlende Wort statt „Der Fehler steckt in …“. Rein; `null` für
 * Falsches, Überflüssiges und Vertauschtes.
 */
export function missingWords(errWord: string | null, answer: string | undefined): Missing | null {
  if (!errWord || !answer) return null;
  const e = errWord.split(/\s+/).filter(Boolean);
  const a = answer.split(/\s+/).filter(Boolean);
  if (!e.length || a.length <= e.length) return null;
  // Jedes Wort der Fehlerstelle der Reihe nach in der Lösung finden; was dazwischen steht, ist eingefügt.
  const gaps: Array<{ at: number; words: string[] }> = [];
  let ai = 0;
  for (let ei = 0; ei < e.length; ei++) {
    const start = ai;
    while (ai < a.length && bare(a[ai] ?? '') !== bare(e[ei] ?? '')) ai++;
    if (ai >= a.length || !bare(e[ei] ?? '')) return null;
    if (ai > start) gaps.push({ at: ei, words: a.slice(start, ai) });
    ai++;
  }
  if (ai < a.length) gaps.push({ at: e.length, words: a.slice(ai) });
  if (gaps.length !== 1 || !gaps[0]) return null;
  const g = gaps[0];
  const anchor = g.at < e.length ? (e[g.at] ?? errWord) : (e[e.length - 1] ?? errWord);
  return { words: g.words.map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).join(' '), where: g.at < e.length ? 'before' : 'after', anchor, many: g.words.length > 1 };
}
