// Darstellung der Wort-Rückmeldung (Design-Lead 07.10.2026): zerlegt die vorhandenen, zusammengesetzten Zeilen aus `explainWord`
// („phase out · Verb · neutral“, „Merke: phase out a product · neutral. Phase out = schrittweise abschaffen; formeller: discontinue“)
// in getrennte Blöcke. Rein, ohne React. Kein Text wird umgeschrieben: jedes Stück steht wörtlich so in der Zeile.
// Passt ein Text nicht ins Muster, bleibt er als EIN Block stehen (Rückfall).

export type WordHead = { word: string; chips: string[] };
export type WordNotePart = { label: string | null; text: string };
export type WordWhy = {
  /** Wörtliches Präfix („Merke“, „Remember“), sonst null. */
  label: string | null;
  /** Kern der Merke-Zeile (Hauptverbindung oder „Wort = Bedeutung“), ohne angehängtes Register. Null, wenn er nur das Wort wiederholt. */
  main: string | null;
  /** Der Rest, an „; “ getrennt; „formeller: discontinue“ wird zu { label: 'formeller', text: 'discontinue' }. */
  rest: WordNotePart[];
};

const REG = /\s·\s(formell|neutral|locker|formal|informal)$/i;
const PREFIX = /^(Merke|Remember):\s*/;
/** Gegenstücke und Alternativen, die als eigene Zeile stehen („formeller: discontinue“). */
const LABELED = /^(formeller|förmlicher|lockerer|informeller|neutraler|neutral|formell|locker|more formal|less formal|formal|informal|auch|also|synonym|gegenteil|opposite|britisch|british|us)\s*:\s*(\S.*)$/i;

/** „phase out · Verb · neutral“ → Wort und Chips. */
export function splitHead(name: string): WordHead {
  const parts = name.split(' · ').map((s) => s.trim()).filter(Boolean);
  return { word: parts[0] ?? name, chips: parts.slice(1) };
}

const same = (a: string | null | undefined, b: string | null | undefined): boolean => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Merke-Zeile zerlegen. `word` dient nur dazu, eine reine Wiederholung des Worts wegzulassen. */
export function splitWhy(text: string, word: string): WordWhy {
  let s = text.trim();
  const pm = PREFIX.exec(s);
  const label = pm?.[1] ?? null;
  if (pm) s = s.slice(pm[0].length);
  const cut = s.indexOf('. ');
  let main: string | null = cut >= 0 ? s.slice(0, cut) : s;
  const tail = cut >= 0 ? s.slice(cut + 2).trim() : '';
  main = main.replace(REG, '').trim();
  if (!main || (same(main, word) && !label)) main = null;
  const rest: WordNotePart[] = [];
  for (const raw of tail.split(/;\s+/)) {
    const item = raw.trim();
    if (!item) continue;
    const m = LABELED.exec(item);
    if (m && m[1] && m[2]) rest.push({ label: m[1], text: m[2] });
    else rest.push({ label: null, text: item });
  }
  return { label, main, rest };
}
