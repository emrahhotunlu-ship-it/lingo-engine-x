// Erfundener Beispielartikel für das Lesen-Modul (Entwicklungs-Adapter und Tests), in echter Länge (≈ 550 Wörter, 24 Sätze, 6 Absätze).
// Er besteht alle neun Prüftore von `acceptArticle` und zeigt das Zielbild des Prompts `read-article@1`: C1-Wortverbindungen,
// Abschwächung, abwechslungsreiche Verbindungswörter, Gegenargument, praktisches Fazit, mehrteilige Schlüsselwörter.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

export type CannedSentence = { e: string; d: string };

export const CANNED_PARAS: CannedSentence[][] = [
  [
    { e: 'Per-seat pricing looks refreshingly simple: count the users, multiply by a fixed fee, and the forecast almost writes itself.', d: 'Die Abrechnung pro Nutzer wirkt erfrischend einfach: Nutzer zählen, mit einer festen Gebühr multiplizieren, und die Prognose schreibt sich fast von selbst.' },
    { e: 'In practice, that simplicity tends to hide the questions that matter most to a growing software vendor.', d: 'In der Praxis verbirgt diese Einfachheit meist genau die Fragen, die für einen wachsenden Softwareanbieter am wichtigsten sind.' },
    { e: 'Who actually uses the product, how deeply, and what happens when the team of a customer doubles or shrinks?', d: 'Wer nutzt das Produkt tatsächlich, wie intensiv, und was passiert, wenn sich das Team eines Kunden verdoppelt oder verkleinert?' },
    { e: 'Only when these answers are visible can a pricing model inform real decisions instead of merely describing the last quarter.', d: 'Erst wenn diese Antworten sichtbar sind, kann ein Preismodell echte Entscheidungen stützen, statt nur das vergangene Quartal zu beschreiben.' },
  ],
  [
    { e: 'Imagine a mid-sized insurer that buys 200 seats of a document-management platform for its claims department.', d: 'Stellen wir uns einen mittelgroßen Versicherer vor, der für seine Schadenabteilung 200 Lizenzen einer Dokumentenmanagement-Plattform kauft.' },
    { e: 'The compliance team would benefit from access, but every additional seat raises the invoice, so the IT department quietly keeps the circle small.', d: 'Die Compliance-Abteilung würde vom Zugang profitieren, doch jede weitere Lizenz verteuert die Rechnung, und so hält die IT den Kreis unauffällig klein.' },
    { e: 'As a result, the product spreads more slowly than its value would justify, and the vendor sees flat revenue where a stronger case for expansion exists.', d: 'Dadurch verbreitet sich das Produkt langsamer, als sein Nutzen rechtfertigen würde, und der Anbieter sieht stagnierende Umsätze, wo eigentlich mehr Ausbaupotenzial besteht.' },
    { e: 'That said, charging for usage is no cure-all.', d: 'Allerdings ist eine nutzungsabhängige Abrechnung kein Allheilmittel.' },
  ],
  [
    { e: 'Usage-based models track the delivered value more closely, which makes them attractive to buyers who dislike paying for shelfware.', d: 'Nutzungsabhängige Modelle bilden den gelieferten Wert genauer ab und sind deshalb für Käufer attraktiv, die nicht für ungenutzte Software zahlen wollen.' },
    { e: 'The price of that fairness is volatility: revenue now moves with the workload of the customer, and finance teams must explain why a quarter came in lower than planned.', d: 'Der Preis dieser Fairness ist Schwankung: Der Umsatz folgt nun dem Arbeitsaufkommen des Kunden, und die Finanzabteilung muss erklären, warum ein Quartal niedriger ausfiel als geplant.' },
    { e: 'Buyers face the same problem from the other side, since a budget owner cannot sign off on an invoice that nobody can predict.', d: 'Die Käufer haben dasselbe Problem von der anderen Seite, denn wer ein Budget verantwortet, kann keine Rechnung freigeben, die niemand vorhersagen kann.' },
    { e: 'Many vendors therefore compromise with a volume commitment plus overage fees, arguably the least elegant but most workable option.', d: 'Viele Anbieter einigen sich deshalb auf eine Mindestabnahme plus Mehrverbrauchsgebühren, wohl die unelegantste, aber praktikabelste Lösung.' },
  ],
  [
    { e: 'A third lever is packaging, because three tiers let a prospect compare options without negotiating from scratch.', d: 'Ein dritter Hebel ist die Paketierung, denn mit drei Stufen können Interessenten Optionen vergleichen, ohne bei null zu verhandeln.' },
    { e: 'The danger is designing those tiers around internal features rather than around the problems that a buying committee is trying to solve.', d: 'Die Gefahr besteht darin, diese Stufen um interne Funktionen statt um die Probleme zu entwerfen, die ein Einkaufsgremium lösen will.' },
    { e: 'In many cases, procurement wants audit trails and retention controls, while the business unit cares only about search speed.', d: 'In vielen Fällen verlangt der Einkauf Prüfpfade und Aufbewahrungskontrollen, während der Fachbereich nur auf die Suchgeschwindigkeit achtet.' },
    { e: 'A tier that speaks to both audiences gives the champion inside the company something concrete to defend in the next budget meeting.', d: 'Eine Stufe, die beide Gruppen anspricht, gibt dem Fürsprecher im Unternehmen etwas Konkretes an die Hand, das er in der nächsten Budgetrunde verteidigen kann.' },
  ],
  [
    { e: 'None of this means that a company should redesign its pricing every year.', d: 'Nichts davon bedeutet, dass ein Unternehmen seine Preisgestaltung jedes Jahr neu aufsetzen sollte.' },
    { e: 'Existing customers dislike surprises, and a sudden increase can feel like a breach of trust even when the new price is entirely fair.', d: 'Bestandskunden mögen keine Überraschungen, und eine plötzliche Erhöhung kann sich wie ein Vertrauensbruch anfühlen, selbst wenn der neue Preis völlig fair ist.' },
    { e: 'Even so, standing still carries a cost of its own, because a price that no longer matches the value delivered erodes margins or goodwill, and often both.', d: 'Trotzdem hat auch Stillstand seinen Preis, denn ein Preis, der nicht mehr zum gelieferten Nutzen passt, schwächt Margen oder Wohlwollen, oft beides.' },
    { e: 'A sensible compromise is to test changes on new customers first and to give renewals a clear, early explanation.', d: 'Ein vernünftiger Kompromiss besteht darin, Änderungen zuerst bei Neukunden zu testen und Verlängerungen früh und klar zu erklären.' },
  ],
  [
    { e: 'The practical takeaway is to treat the pricing model as a forecasting tool as much as a revenue mechanism.', d: 'Die praktische Konsequenz lautet, das Preismodell ebenso als Prognoseinstrument wie als Erlösmechanismus zu behandeln.' },
    { e: 'Before the next planning cycle, it is worth asking which customers would pay more under another model, which would pay less, and why.', d: 'Vor dem nächsten Planungszyklus lohnt die Frage, welche Kunden bei einem anderen Modell mehr zahlen würden, welche weniger und warum.' },
    { e: 'Teams that can answer these questions in two minutes usually explain their prices well to customers, too.', d: 'Teams, die diese Fragen in zwei Minuten beantworten können, erklären ihre Preise meist auch den Kunden gut.' },
    { e: 'That clarity is an advantage no rival can copy simply by cutting prices.', d: 'Diese Klarheit ist ein Vorteil, den kein Konkurrent einfach durch niedrigere Preise kopieren kann.' },
  ],
];

export const CANNED_TITLE = 'What Per-Seat Pricing Hides From Your Forecast';
export const CANNED_ASOF = '2026-01';
export const CANNED_SUMMARY = 'Der Artikel zeigt, wie die Wahl des Preismodells Verbreitung, Prognose und Kundenbeziehung eines Softwareanbieters beeinflusst.';

export const CANNED_KEYWORDS: Array<{ w: string; de: string; i: [number, number] }> = [
  { w: 'shelfware', de: 'ungenutzte Software', i: [2, 0] },
  { w: 'sign off on', de: 'freigeben', i: [2, 2] },
  { w: 'volume commitment', de: 'Mindestabnahme, Abnahmeverpflichtung', i: [2, 3] },
  { w: 'breach of trust', de: 'Vertrauensbruch', i: [4, 1] },
  { w: 'erodes margins', de: 'schmälert die Margen', i: [4, 2] },
];

export const CANNED_CHECK: Array<{ q: string; o: [string, string, string]; a: number; why: string }> = [
  {
    q: 'What is the main argument of the article?',
    o: ['Per-seat pricing looks simple but can obscure how the product is really used.', 'Usage-based pricing is clearly better than any seat-based model.', 'Vendors should change their prices every year to stay competitive.'],
    a: 0,
    why: 'Der Text zeigt, dass die Abrechnung pro Nutzer einfach wirkt, aber wichtige Fragen verdeckt. Die nutzungsabhängige Abrechnung nennt er ausdrücklich „kein Allheilmittel“.',
  },
  {
    q: 'Why might the IT department of the insurer keep the circle of users small?',
    o: ['The platform cannot handle more than 200 users.', 'Every additional seat adds to the invoice, and the department wants to limit costs.', 'The compliance team has no interest in the platform.'],
    a: 1,
    why: 'Jede weitere Lizenz verteuert die Rechnung. Die Compliance-Abteilung würde sogar profitieren, daher passt die dritte Antwort nicht.',
  },
  {
    q: 'What does the author mean by “a breach of trust” in the fifth paragraph?',
    o: ['A legal violation of the contract by the vendor.', 'A data leak that damages the reputation of the vendor.', 'A price increase that customers experience as unfair, even if it is fair on paper.'],
    a: 2,
    why: 'Gemeint ist das Gefühl der Kunden, hintergangen zu werden, auch wenn der neue Preis angemessen ist. Von einem Rechtsbruch oder Datenleck ist im Text keine Rede.',
  },
];
