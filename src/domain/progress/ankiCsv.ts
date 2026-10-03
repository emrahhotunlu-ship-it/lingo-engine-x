// CSV-Export für Anki (plan.md N98, markt.md Nr. 25): Die Daten gehören Emrah. Eine Zeile je
// sichtbarer Karte: Vorderseite Deutsch, Rückseite Englisch, Ursprungssatz (Fundstelle fett),
// Schlagwörter. Kopfzeilen im Anki-Format (`#separator`, `#html`, `#columns`), Felder in
// Anführungszeichen, damit Semikolons und Zeilenumbrüche im Satz nichts zerbrechen. Rein.

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const field = (s: string): string => `"${s.replace(/\r?\n/g, ' ').replace(/"/g, '""')}"`;

/** „We need to [approve] it.“ → „We need to <b>approve</b> it.“ (HTML geschützt). */
export function exampleHtml(ex: string): string {
  return esc(ex).replace(/\[([^[\]]+)\]/g, '<b>$1</b>');
}

export function ankiCsv(vocab: Iterable<[string, Doc]>): { text: string; rows: number } {
  const lines = ['#separator:Semicolon', '#html:true', '#columns:Front;Back;Example;Tags', '#tags column:4'];
  let rows = 0;
  const sorted = [...vocab].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [, d] of sorted) {
    if (d.hidden === true) continue;
    const word = str(d.word).trim();
    const de = str(d.de).trim();
    if (!word || !de) continue;
    const tags = ['lingo', str(d.level), str(d.src)].filter(Boolean).map((t) => t.replace(/\s+/g, '_'));
    lines.push([field(esc(de)), field(esc(word)), field(exampleHtml(str(d.ex))), field(tags.join(' '))].join(';'));
    rows++;
  }
  return { text: `${lines.join('\n')}\n`, rows };
}
