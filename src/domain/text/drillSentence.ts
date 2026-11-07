// Übungssatz statt echtem Satz (Großpaket T, Emrah 07.11.2026: Wort-Abfrage „He ? (feel) tired lately.“): Ein Wort, das in einer
// Grammatik-Übung angetippt und gespeichert wurde, bekam den Übungssatz MIT Lücke und Verb-Hinweis als Beispielsatz. Solche Sätze sind nie ein
// Wort-Satz: weder zum Speichern noch als Abfrage. Rein, ohne Abhängigkeiten.

/** Platzhalter einer Lücke: `___`, `…`/`...` als eigenes Wort, ein einzelnes `?` mitten im Satz. */
const GAP = /_{2,}|(?:^|\s)(?:…|\.{3})(?=\s|$)|(?:^|\s)\?(?=\s+\S)/;
/** Hinweis in Klammern, wie ihn Grammatik-Übungen geben: „(feel)“, „(not / go)“, „(be able to)“ – nur kleine Wörter, höchstens drei. */
const CUE = /\(\s*[a-z]+(?:\s*[/,]?\s*[a-z]+){0,2}\s*\)/;

export function isDrillSentence(text: string): boolean {
  const t = text.replace(/\[([^\]]*)\]/g, '$1');
  return GAP.test(t) || CUE.test(t);
}
