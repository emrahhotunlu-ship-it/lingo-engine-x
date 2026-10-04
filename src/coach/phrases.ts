// Wendungen enthalten die Platzhalter `sth` (something) und `sb` (somebody). Beim freien Abrufen
// darf Emrah das Platzhalter-Kürzel oder das ausgeschriebene Wort tippen.

const SB = ['sb', 'somebody', 'someone'];
const STH = ['sth', 'something'];

/** Alle Schreibweisen, die als richtig gelten: `take sth into account` → auch `take something into account`. */
export function placeholderForms(word: string): string[] {
  const toks = word.split(' ');
  if (!toks.includes('sth') && !toks.includes('sb')) return [word];
  let forms: string[][] = [[]];
  for (const tok of toks) {
    const options = tok === 'sth' ? STH : tok === 'sb' ? SB : [tok];
    forms = forms.flatMap((f) => options.map((o) => [...f, o]));
  }
  return forms.map((f) => f.join(' '));
}
