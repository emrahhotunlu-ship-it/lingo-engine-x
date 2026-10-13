// Erfundene Testartikel für das Lesen-Modul (keine echten Daten). `goodArticle()` besteht alle neun Tore.

import type { ArticleItem } from '../../../src/modules/read/schemas';

type S = { e: string; d: string };
type Raw = {
  title: string;
  topic: string;
  kind: string;
  level: string;
  asOf: string;
  summary: string;
  paras: S[][];
  keyWords: Array<{ w: string; de: string; i: [number, number] }>;
  check: Array<{ q: string; o: string[]; a: number; why: string }>;
};

const PARAS: S[][] = [
  [
    { e: 'Pricing is often treated as a spreadsheet exercise, but for most software companies it quietly shapes who becomes a customer and how long they stay.', d: 'Preisgestaltung wird oft als Tabellenübung behandelt, doch bei den meisten Softwareunternehmen bestimmt sie leise mit, wer zum Kunden wird und wie lange er bleibt.' },
    { e: 'A pricing page is therefore one of the few places where product, marketing and finance have to agree on a single message.', d: 'Eine Preisseite ist deshalb einer der wenigen Orte, an denen Produkt, Marketing und Finanzen sich auf eine einzige Botschaft einigen müssen.' },
    { e: 'When that message is vague, buyers fill the gap with their own assumptions, and those assumptions are rarely generous.', d: 'Ist diese Botschaft vage, füllen die Käufer die Lücke mit eigenen Annahmen, und diese Annahmen sind selten großzügig.' },
    { e: 'For a growing company, the cost of getting this wrong compounds every quarter that the page stays unchanged.', d: 'Für ein wachsendes Unternehmen summieren sich die Kosten eines Fehlers in jedem Quartal, in dem die Seite unverändert bleibt.' },
  ],
  [
    { e: 'Consider the common choice between charging per seat and charging for usage.', d: 'Man denke an die verbreitete Entscheidung, ob man pro Nutzer oder nach Verbrauch abrechnet.' },
    { e: 'Per-seat pricing is easy to forecast, yet it can punish customers for sharing the product widely, which slows adoption inside a company.', d: 'Die Abrechnung pro Nutzer lässt sich leicht prognostizieren, kann Kunden aber dafür bestrafen, dass sie das Produkt breit einsetzen, was die Verbreitung im Unternehmen bremst.' },
    { e: 'Usage-based pricing tracks the value more closely, although it makes revenue harder to predict and invoices harder to explain.', d: 'Eine nutzungsabhängige Abrechnung bildet den Wert genauer ab, macht den Umsatz jedoch schwerer vorhersagbar und Rechnungen schwerer erklärbar.' },
    { e: 'Neither model is simply better, which is why the right choice depends on how customers actually experience the value.', d: 'Keines der beiden Modelle ist schlicht besser, deshalb hängt die richtige Wahl davon ab, wie Kunden den Wert tatsächlich erleben.' },
  ],
  [
    { e: 'Many teams respond by offering three tiers, because a middle option makes the premium plan look reasonable by comparison.', d: 'Viele Teams reagieren mit drei Stufen, weil eine mittlere Option den Premiumtarif im Vergleich vernünftig aussehen lässt.' },
    { e: 'The risk is that the tiers are designed around internal features instead of around the problems customers want to solve.', d: 'Das Risiko besteht darin, dass die Stufen um interne Funktionen herum entworfen werden statt um die Probleme, die Kunden lösen wollen.' },
    { e: 'A better test is whether a prospect can say in one sentence why they would choose the plan they are looking at.', d: 'Ein besserer Test ist, ob ein Interessent in einem Satz sagen kann, warum er den Tarif wählen würde, den er gerade ansieht.' },
  ],
  [
    { e: 'Churn offers another clue, because customers who leave within the first few months often signed up for the wrong plan.', d: 'Auch die Kündigungsquote liefert einen Hinweis, denn Kunden, die in den ersten Monaten gehen, haben sich oft für den falschen Tarif entschieden.' },
    { e: 'In such cases the roughly one third of accounts that cancel early may not be unhappy with the product at all.', d: 'In solchen Fällen sind vielleicht rund ein Drittel der Konten, die früh kündigen, mit dem Produkt gar nicht unzufrieden.' },
    { e: 'Their problem is that the price promised something the onboarding never delivered.', d: 'Ihr Problem ist, dass der Preis etwas versprach, das die Einführung nie einlöste.' },
    { e: 'Looking at which plan customers chose, and what they did in the first week, shows where expectations and reality part ways.', d: 'Ein Blick darauf, welchen Tarif Kunden gewählt haben und was sie in der ersten Woche taten, zeigt, wo Erwartung und Wirklichkeit auseinandergehen.' },
  ],
  [
    { e: 'Companies that revisit their prices once a year usually learn more than those that never touch them.', d: 'Unternehmen, die ihre Preise einmal im Jahr überprüfen, lernen meist mehr als solche, die sie nie anfassen.' },
    { e: 'Small experiments, such as testing a new tier with 5 percent of new visitors, limit the damage if the idea fails.', d: 'Kleine Experimente, etwa ein neuer Tarif für 5 Prozent der neuen Besucher, begrenzen den Schaden, falls die Idee scheitert.' },
    { e: 'Existing customers deserve extra care, since a sudden increase can feel like a breach of trust even when the new price is fair.', d: 'Bestehende Kunden verdienen besondere Sorgfalt, da sich eine plötzliche Erhöhung wie ein Vertrauensbruch anfühlen kann, selbst wenn der neue Preis fair ist.' },
  ],
  [
    { e: 'In the end, good pricing is less about finding the perfect number than about making the logic behind the number easy to understand.', d: 'Letztlich geht es bei guter Preisgestaltung weniger darum, die perfekte Zahl zu finden, als die Logik hinter der Zahl leicht verständlich zu machen.' },
    { e: 'Teams that can explain their pricing to a new colleague in two minutes tend to explain it well to customers, too.', d: 'Teams, die einem neuen Kollegen ihre Preise in zwei Minuten erklären können, erklären sie in der Regel auch den Kunden gut.' },
    { e: 'That clarity is a competitive advantage that no competitor can copy by simply lowering a price.', d: 'Diese Klarheit ist ein Wettbewerbsvorteil, den kein Konkurrent kopieren kann, indem er einfach einen Preis senkt.' },
  ],
];

export function goodRaw(): Raw {
  return {
    title: 'Why Pricing Pages Quietly Decide Growth',
    topic: 'saas',
    kind: 'explainer',
    level: 'c1',
    asOf: 'general state as of early 2026',
    summary: 'Der Artikel zeigt, warum Preisseiten das Wachstum von Softwareunternehmen leise steuern.',
    paras: PARAS.map((p) => p.map((s) => ({ ...s }))),
    keyWords: [
      { w: 'tiers', de: 'Stufen', i: [2, 0] },
      { w: 'forecast', de: 'vorhersagen', i: [1, 1] },
      { w: 'churn', de: 'Kundenabwanderung', i: [3, 0] },
      { w: 'onboarding', de: 'Einführung neuer Kunden', i: [3, 2] },
      { w: 'breach of trust', de: 'Vertrauensbruch', i: [4, 2] },
    ],
    check: [
      { q: 'What does the article suggest about customers who cancel early?', o: ['They always dislike the product.', 'They may have chosen a plan that did not fit their needs.', 'They are usually the largest accounts.'], a: 1, why: 'Der Text sagt, dass frühe Kündigungen oft auf den falschen Tarif zurückgehen, nicht auf das Produkt.' },
      { q: 'Why does the author recommend small experiments?', o: ['They limit the damage if an idea fails.', 'They replace the need for customer research.', 'They always raise prices faster.'], a: 0, why: 'Kleine Tests mit wenigen Besuchern halten den Schaden gering, falls die Idee scheitert.' },
    ],
  };
}

/** Gespeicherter Artikel (Tagesdokument) aus dem guten Rohartikel. */
export function goodItem(id = 'a-2026-10-13-1-abc123', t = 1_790_000_000_000): ArticleItem {
  const r = goodRaw();
  return {
    id,
    t,
    topic: r.topic,
    kind: r.kind,
    level: r.level,
    title: r.title,
    summary: r.summary,
    asOf: r.asOf,
    paras: r.paras,
    keyWords: r.keyWords,
    check: r.check.map((c) => ({ ...c, o: c.o as [string, string, string] })),
    model: 'default',
    pv: 1,
  };
}

/** Artikel mit anderem Titel und Text: so entstehen viele verschiedene Artikel gleicher Größe. */
export function itemNo(n: number, day = '2026-10-13'): ArticleItem {
  const g = goodItem(`a-${day}-${n}-${n.toString(36).padStart(6, '0')}`);
  return { ...g, title: `${g.title} (part ${n})` };
}
