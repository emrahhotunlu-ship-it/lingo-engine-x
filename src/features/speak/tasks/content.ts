// Inhalte der kurzen Sprechaufgaben (Neubau N79, B9 – Lehrer I7, I8, W10, S9). Daten, kein Code:
// Kennungen nie ändern (sie stehen im Tagesprotokoll). Englisch in US-Schreibweise.

export type Bi = { de: string; en: string };

/** Elevator Pitch in drei Längen mit derselben Kernbotschaft (Lehrer I7). */
export type PitchItem = {
  id: string;
  /** Kernbotschaft (bleibt in allen drei Längen gleich). */
  core: Bi;
  /** Muster für die 30-s-Fassung: erst anhören und nachsprechen, dann die eigene Fassung. */
  model: string;
};

export const PITCH_ROUNDS = [30, 60, 120] as const;
export type PitchSec = (typeof PITCH_ROUNDS)[number];

/** Was je Länge dazukommt (Aufbau: Aufhänger · Problem · Lösung · Beleg · nächster Schritt). */
export const PITCH_ADD: Record<PitchSec, Bi> = {
  30: { de: 'Aufhänger, Problem, Lösung – ein Satz je Teil.', en: 'Hook, problem, solution – one sentence each.' },
  60: { de: 'Dazu ein Beispiel aus der Praxis und ein nächster Schritt.', en: 'Add one real example and a next step.' },
  120: { de: 'Dazu Zahlen als Beleg, einen Einwand vorwegnehmen, klarer Abschluss.', en: 'Add numbers as proof, address one objection, close clearly.' },
};

export const PITCHES: readonly PitchItem[] = [
  {
    id: 'p1',
    core: { de: 'Unser Cloud-Archiv findet jedes Dokument in Sekunden und hält alles revisionssicher.', en: 'Our cloud archive finds any document in seconds and keeps everything audit-proof.' },
    model:
      "Most mid-sized companies lose hours every week looking for documents. We fix that. Our cloud archive finds any contract or invoice in seconds, and everything stays audit-proof. Would it make sense to look at your process together?",
  },
  {
    id: 'p2',
    core: { de: 'Mit uns wird die E-Rechnungspflicht zum Effizienzgewinn statt zur Last.', en: 'With us, the e-invoicing mandate becomes an efficiency gain instead of a burden.' },
    model:
      "E-invoicing becomes mandatory soon, and many finance teams see it as extra work. We turn it into a shortcut. Incoming invoices are read, checked and approved automatically. Shall I show you what that would look like for your team?",
  },
  {
    id: 'p3',
    core: { de: 'Unser Partnerprogramm bringt Resellern wiederkehrende Umsätze ohne eigenen Entwicklungsaufwand.', en: 'Our partner program gives resellers recurring revenue without any development work.' },
    model:
      "Resellers want recurring revenue, but building their own product is expensive. Our partner program solves that. You sell a proven cloud solution under a clear margin, and we handle hosting and updates. Could we set up a short call with your sales lead?",
  },
];

/** Diagramm zum Beschreiben in 60 s (Lehrer I8): Trend, Vergleich, Folgerung. */
export type ChartItem = {
  id: string;
  kind: 'bar' | 'line';
  title: string;
  /** Einheit der Werte (Englisch, kurz). */
  unit: string;
  labels: readonly string[];
  values: readonly number[];
  /** Musterbeschreibung (Englisch). */
  model: string;
  /** Wendungen, die hier passen. */
  phrases: readonly string[];
};

export const CHART_SEC = 60;

export const CHARTS: readonly ChartItem[] = [
  {
    id: 'c1',
    kind: 'bar',
    title: 'Documents processed per month',
    unit: 'thousand',
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    values: [12, 15, 19, 26, 31, 38],
    model:
      'The number of processed documents more than tripled in the first half of the year, from 12,000 in January to 38,000 in June. Growth was steady at first and picked up sharply from April. So the new workflow is clearly paying off.',
    phrases: ['more than tripled', 'picked up sharply', 'steady growth'],
  },
  {
    id: 'c2',
    kind: 'line',
    title: 'Support tickets per week',
    unit: 'tickets',
    labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'],
    values: [120, 118, 95, 80, 62, 60, 61, 59],
    model:
      'Support tickets dropped by half over eight weeks, from about 120 to around 60. After week five, the number leveled off. This suggests the new help center answers most simple questions.',
    phrases: ['dropped by half', 'leveled off', 'this suggests'],
  },
  {
    id: 'c3',
    kind: 'bar',
    title: 'Revenue by region',
    unit: '€ million',
    labels: ['DACH', 'UK', 'Nordics', 'US'],
    values: [4.2, 1.1, 0.9, 0.6],
    model:
      'Germany, Austria and Switzerland bring in by far the most revenue, 4.2 million euros. The UK and the Nordics are at around one million each, and the US is only a fraction of that. So there is a lot of room to grow outside our home market.',
    phrases: ['by far the most', 'a fraction of', 'room to grow'],
  },
  {
    id: 'c4',
    kind: 'line',
    title: 'Average search time per document',
    unit: 'seconds',
    labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6'],
    values: [90, 85, 40, 22, 18, 17],
    model:
      'Average search time fell from 90 seconds to under 20. The biggest drop came in the third quarter, right after the rollout, and since then it has leveled off. In short, people now find documents about five times faster.',
    phrases: ['fell from … to …', 'the biggest drop', 'five times faster'],
  },
];

/** Fachwort umschreiben, ohne es zu benutzen (Lehrer W10). */
export type CircumItem = {
  id: string;
  /** Deutsches Fachwort, das Emrah umschreiben soll. */
  de: string;
  /** Englisches Zielwort (darf in der Antwort nicht vorkommen; wird danach eine Karte). */
  en: string;
  /** Musterumschreibung (Englisch). */
  model: string;
  /** Beispielsatz MIT dem Zielwort (Ursprungssatz der Karte, Kap. 15). */
  ex: string;
};

export const CIRCUM_SEC = 45;

export const CIRCUMS: readonly CircumItem[] = [
  { id: 'w1', de: 'Aufbewahrungsfrist', en: 'retention period', model: "It's the length of time a company must keep documents, like invoices, before it's allowed to delete them.", ex: 'The retention period for invoices is ten years in Germany.' },
  { id: 'w2', de: 'Ausschreibung', en: 'tender', model: 'When a company or a city wants to buy something big, it publishes what it needs, and suppliers send offers to win the contract.', ex: 'The city published a tender for a new document system.' },
  { id: 'w3', de: 'Mahnwesen', en: 'dunning', model: "It's the process of reminding customers who haven't paid on time, first politely, then more firmly.", ex: 'Our dunning process sends the first reminder after 14 days.' },
  { id: 'w4', de: 'Kündigungsfrist', en: 'notice period', model: 'The time you have to tell the other side before you can end a contract, for example three months.', ex: 'The contract has a notice period of three months.' },
  { id: 'w5', de: 'Pflichtenheft', en: 'requirements specification', model: 'A document where the customer and the supplier write down exactly what the system has to do.', ex: 'Please send us the requirements specification before the workshop.' },
  { id: 'w6', de: 'Abschlagszahlung', en: 'installment', model: "It's a part of the total price that you pay before the project is finished, for example after each milestone.", ex: 'The second installment is due after the go-live.' },
  { id: 'w7', de: 'Vorsteuerabzug', en: 'input tax deduction', model: 'A company can get back the sales tax it paid to its own suppliers from the tax office.', ex: 'The input tax deduction lowers the VAT you actually pay.' },
  { id: 'w8', de: 'Rahmenvertrag', en: 'framework agreement', model: 'A long-term contract that fixes prices and terms, so later orders can be placed without negotiating again.', ex: 'We signed a framework agreement for the next three years.' },
];

/** Rückübersetzung (Lehrer S9, verkürzt auf einen Satz): EN lesen → DE sehen → wieder EN. */
export type BackItem = { id: string; en: string; de: string };

export const BACKS: readonly BackItem[] = [
  { id: 'b1', en: "We'd like to get a better sense of how your team handles invoices today.", de: 'Wir würden gern besser verstehen, wie Ihr Team heute mit Rechnungen umgeht.' },
  { id: 'b2', en: 'If it helps, I can send you a short summary before our next call.', de: 'Wenn es hilft, kann ich Ihnen vor unserem nächsten Telefonat eine kurze Zusammenfassung schicken.' },
  { id: 'b3', en: "The rollout took longer than planned, but we're back on track now.", de: 'Die Einführung hat länger gedauert als geplant, aber jetzt sind wir wieder im Plan.' },
  { id: 'b4', en: 'Could you walk me through the approval process on your side?', de: 'Könnten Sie mir erklären, wie der Freigabeprozess bei Ihnen abläuft?' },
  { id: 'b5', en: "We've been working with them for three years, and they've never missed a deadline.", de: 'Wir arbeiten seit drei Jahren mit ihnen zusammen, und sie haben noch nie eine Frist verpasst.' },
  { id: 'b6', en: "I'm afraid we can't lower the price, but we could extend the payment terms.", de: 'Leider können wir den Preis nicht senken, aber wir könnten das Zahlungsziel verlängern.' },
];
