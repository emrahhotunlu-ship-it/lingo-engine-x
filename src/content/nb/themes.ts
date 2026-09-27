// Sechzehn Wochenthemen (docs/neubau/lehrer.md §3, Plan §1.5). Daten, kein Code (A6.11):
// Kennungen `t01`…`t16` nie ändern, sie stehen in `app/week`.
// - `n` ist die Nummer aus der Lehrer-Tabelle, `THEME_ORDER` die vorgeschlagene Reihenfolge.
// - `tool` ist eine vorhandene Grammatik-ID (16 alte Themen oder `c1-*`), `trap` eine Startsatz-ID aus `traps.ts`.
// - Wendungen in US-Englisch mit Bedeutung auf Deutsch (`de`) und Englisch (`def`).
// - `keywords` (klein, Wortanfänge) ordnen Karten dem Thema zu (`isThemeCard`, anki-regeln §5 Stufe 4).
// - `fluencyQ` ist die „Frage A der Woche“ für 90/60/45 (Kennung aus `content/fluency/questions.ts`).
// - `scene` ist die Business-Szene zum Thema (`content/nb/scenes.json`).

export type ThemeId =
  | 't01' | 't02' | 't03' | 't04' | 't05' | 't06' | 't07' | 't08'
  | 't09' | 't10' | 't11' | 't12' | 't13' | 't14' | 't15' | 't16';

export type Bi = { de: string; en: string };
export type ThemePhrase = { en: string; de: string; def: string };
export type TargetKind = 'hedge' | 'transition' | 'phrase';
export type ThemeGoal = { kind: TargetKind; need: number };

export type WeekTheme = {
  id: ThemeId;
  /** Nummer in lehrer.md §3. */
  n: number;
  kind: 'job' | 'bridge' | 'life';
  title: Bi;
  /** Kernaufgabe der Woche. */
  task: Bi;
  /** Werkzeug der Woche: Grammatik-ID. */
  tool: string;
  /** Sprachfokus in Worten. */
  focus: Bi;
  /** Falle der Woche: Startsatz-ID (`f01`…`f25`). */
  trap: string;
  phrases: readonly ThemePhrase[];
  keywords: readonly string[];
  fluencyQ: string;
  scene: string;
  /** Sichtbare Zählziele in den Aufgaben der Woche (N13). */
  goals: readonly ThemeGoal[];
};

export const THEMES: readonly WeekTheme[] = [
  {
    id: 't01',
    n: 1,
    kind: 'job',
    title: { de: 'Erstgespräch: Bedarf klären', en: 'Discovery call: finding the need' },
    task: {
      de: 'Call mit einem Interessenten: 5 offene Fragen stellen, dann den Bedarf zusammenfassen.',
      en: 'Call with a prospect: ask 5 open questions, then sum up their needs.',
    },
    tool: 'reported',
    focus: {
      de: 'Fragen und indirekte Fragen: normale Wortstellung, kein „do“ im Nebensatz.',
      en: 'Questions and indirect questions: normal word order, no "do" in the embedded clause.',
    },
    trap: 'f20',
    phrases: [
      { en: 'walk me through your current process', de: 'erklär mir Schritt für Schritt, wie ihr es heute macht', def: 'describe your current way of working step by step' },
      { en: "What's prompting you to look at this now?", de: 'Was bringt Sie dazu, sich das gerade jetzt anzusehen?', def: 'asks for the trigger behind the interest' },
      { en: 'What would success look like for you?', de: 'Woran würden Sie Erfolg messen?', def: 'asks how the customer defines a good result' },
      { en: "So if I'm hearing you correctly, …", de: 'Wenn ich Sie richtig verstehe, …', def: 'introduces a summary to check understanding' },
      { en: 'Who else is involved in the decision?', de: 'Wer entscheidet noch mit?', def: 'asks about the other decision makers' },
    ],
    keywords: ['discovery', 'prospect', 'requirement', 'need', 'pain point', 'process', 'decision maker', 'stakeholder', 'qualify', 'qualification', 'budget'],
    fluencyQ: 'dms-value',
    scene: 'b01',
    goals: [
      { kind: 'phrase', need: 2 },
      { kind: 'transition', need: 2 },
    ],
  },
  {
    id: 't02',
    n: 2,
    kind: 'job',
    title: { de: 'Den Wert einfach erklären (Cloud-DMS/ECM)', en: 'Explaining the value simply (cloud DMS/ECM)' },
    task: {
      de: 'Elevator Pitch in 30, 60 und 120 Sekunden für Menschen ohne Technik-Hintergrund.',
      en: 'Elevator pitch in 30, 60, and 120 seconds for non-technical listeners.',
    },
    tool: 'c1-discourse',
    focus: {
      de: 'Überleitungen, Nutzen statt Produktmerkmale.',
      en: 'Transitions, benefits instead of features.',
    },
    trap: 'f01',
    phrases: [
      { en: 'In a nutshell, …', de: 'Kurz gesagt, …', def: 'introduces a very short summary' },
      { en: 'What that means for you is …', de: 'Für Sie bedeutet das …', def: 'turns a feature into a benefit for the listener' },
      { en: 'a single source of truth', de: 'eine zentrale, verlässliche Datenquelle', def: 'one place where the correct, current version lives' },
      { en: 'instead of digging through folders', de: 'statt in Ordnern zu suchen', def: 'without searching through many folders' },
      { en: 'from day one', de: 'vom ersten Tag an', def: 'right from the start' },
    ],
    keywords: ['pitch', 'benefit', 'value', 'feature', 'archive', 'document management', 'dms', 'ecm', 'workflow', 'cloud', 'search', 'folder'],
    fluencyQ: 'elevator',
    scene: 'b02',
    goals: [
      { kind: 'transition', need: 3 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't03',
    n: 3,
    kind: 'job',
    title: { de: 'CFO: Preis, ROI, Business Case', en: 'CFO: price, ROI, business case' },
    task: {
      de: 'Einen Preiseinwand entkräften und den ROI mit einer Zahl erklären.',
      en: 'Handle a price objection and explain the ROI with one number.',
    },
    tool: 'c1-hedging',
    focus: {
      de: 'Aussagen abschwächen (Hedging), Zahlen sicher nennen.',
      en: 'Hedging claims, stating numbers with confidence.',
    },
    trap: 'f19',
    phrases: [
      { en: 'I understand it may seem high at first glance', de: 'Ich verstehe, dass es auf den ersten Blick hoch wirkt', def: 'acknowledges a price concern without agreeing' },
      { en: 'total cost of ownership', de: 'Gesamtbetriebskosten', def: 'all costs of a solution over its lifetime' },
      { en: 'pays for itself within 18 months', de: 'hat sich innerhalb von 18 Monaten bezahlt gemacht', def: 'the savings cover the cost within 18 months' },
      { en: 'roughly a third of', de: 'ungefähr ein Drittel von', def: 'about one third of' },
      { en: 'over a three-year period', de: 'über drei Jahre gerechnet', def: 'calculated across three years' },
    ],
    keywords: ['price', 'pricing', 'cost', 'roi', 'return on investment', 'business case', 'budget', 'discount', 'cfo', 'saving', 'invest', 'license'],
    fluencyQ: 'price',
    scene: 'b03',
    goals: [
      { kind: 'hedge', need: 2 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't04',
    n: 4,
    kind: 'job',
    title: { de: 'IT-Leitung: Sicherheit, DSGVO, GoBD, Datenstandort', en: 'Head of IT: security, GDPR, GoBD, data residency' },
    task: {
      de: 'Einem skeptischen IT-Leiter antworten, ohne zu viel zu versprechen.',
      en: 'Answer a skeptical head of IT without overpromising.',
    },
    tool: 'passive',
    focus: {
      de: 'Genaue Zusagen (will, can, may), Passiv für Abläufe.',
      en: 'Precise commitments (will, can, may), passive voice for processes.',
    },
    trap: 'f13',
    phrases: [
      { en: 'hosted in EU data centers', de: 'in Rechenzentren in der EU betrieben', def: 'the servers are located inside the EU' },
      { en: 'encrypted at rest and in transit', de: 'gespeichert und bei der Übertragung verschlüsselt', def: 'data is protected both when stored and when sent' },
      { en: 'role-based access', de: 'rollenbasierte Zugriffsrechte', def: 'people only see what their role allows' },
      { en: 'audit-proof archiving', de: 'revisionssichere Archivierung', def: 'archiving that cannot be changed later and passes an audit' },
      { en: 'Let me double-check that and get back to you', de: 'Das prüfe ich noch einmal und melde mich bei Ihnen', def: 'promises a verified answer later instead of guessing' },
    ],
    keywords: ['security', 'secure', 'gdpr', 'gobd', 'compliance', 'complian', 'encrypt', 'data center', 'hosting', 'access', 'audit', 'certificate', 'certification', 'backup', 'privacy'],
    fluencyQ: 'security',
    scene: 'b04',
    goals: [
      { kind: 'hedge', need: 1 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't05',
    n: 5,
    kind: 'job',
    title: { de: 'E-Rechnung und ViDA als Verkaufsanlass', en: 'E-invoicing and ViDA as a reason to buy' },
    task: {
      de: 'Einem Geschäftsführer in 2 Minuten erklären, warum er jetzt handeln sollte.',
      en: 'Explain to a managing director in 2 minutes why they should act now.',
    },
    tool: 'future-forms',
    focus: {
      de: 'Fristen und Zukunft: will, going to, Present Continuous für Pläne.',
      en: 'Deadlines and the future: will, going to, present continuous for plans.',
    },
    trap: 'f11',
    phrases: [
      { en: 'as of January 1', de: 'ab dem 1. Januar', def: 'starting on January 1' },
      { en: 'the mandate is being phased in', de: 'die Pflicht wird schrittweise eingeführt', def: 'the legal requirement starts in stages' },
      { en: 'get ahead of the deadline', de: 'der Frist zuvorkommen', def: 'be ready before the deadline arrives' },
      { en: "It's not a question of if, but when", de: 'Die Frage ist nicht ob, sondern wann', def: 'it will definitely happen; only the timing is open' },
      { en: 'stay compliant', de: 'die Vorschriften weiter einhalten', def: 'keep following the rules' },
    ],
    keywords: ['invoice', 'invoicing', 'e-invoic', 'vida', 'mandate', 'deadline', 'regulation', 'tax', 'vat', 'xrechnung', 'zugferd', 'peppol', 'complian'],
    fluencyQ: 'einvoice',
    scene: 'b05',
    goals: [
      { kind: 'phrase', need: 2 },
      { kind: 'transition', need: 2 },
    ],
  },
  {
    id: 't06',
    n: 6,
    kind: 'job',
    title: { de: 'Demo und Präsentation vor Entscheidern', en: 'Demo and presentation for decision makers' },
    task: {
      de: '3 Folien sprechen, eine Grafik erklären, 3 harte Fragen beantworten.',
      en: 'Present 3 slides, explain a chart, answer 3 tough questions.',
    },
    tool: 'c1-emphasis',
    focus: {
      de: 'Wegweiser in der Rede, Betonung durch Satzbau („What really matters is …“).',
      en: 'Signposting, emphasis through sentence structure ("What really matters is …").',
    },
    trap: 'f09',
    phrases: [
      { en: 'Let me walk you through …', de: 'Ich zeige Ihnen Schritt für Schritt …', def: 'introduces a step-by-step explanation' },
      { en: 'This brings me to …', de: 'Damit komme ich zu …', def: 'moves on to the next point' },
      { en: 'more than doubled', de: 'hat sich mehr als verdoppelt', def: 'grew to over twice the size' },
      { en: "I'll come back to that in a minute", de: 'Darauf komme ich gleich zurück', def: 'postpones a question politely' },
      { en: "That's a great question", de: 'Das ist eine sehr gute Frage', def: 'acknowledges a question and buys a moment to think' },
    ],
    keywords: ['demo', 'presentation', 'present', 'slide', 'chart', 'graph', 'figure', 'trend', 'decision maker', 'board', 'q&a'],
    fluencyQ: 'ai-docs',
    scene: 'b06',
    goals: [
      { kind: 'transition', need: 3 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't07',
    n: 7,
    kind: 'job',
    title: { de: 'Verhandeln: Rabatt gegen Laufzeit', en: 'Negotiating: discount for a longer term' },
    task: {
      de: 'Rollenspiel mit dem Einkauf: Zugeständnis nur gegen Gegenleistung.',
      en: 'Role-play with procurement: no concession without something in return.',
    },
    tool: 'conditionals',
    focus: {
      de: 'Bedingungssätze, diplomatische Distanz statt „Das geht nicht.“',
      en: 'Conditionals, diplomatic distance instead of "That is not possible."',
    },
    trap: 'f25',
    phrases: [
      { en: "If you could commit to three years, we could …", de: 'Wenn Sie sich auf drei Jahre festlegen könnten, könnten wir …', def: 'offers a concession only in exchange for a longer contract' },
      { en: 'Where do you have some flexibility?', de: 'Wo haben Sie Spielraum?', def: 'asks what the other side can change' },
      { en: "That's not something I can agree to today", de: 'Dem kann ich heute nicht zustimmen', def: 'a polite, firm no for now' },
      { en: 'meet you halfway', de: 'Ihnen auf halbem Weg entgegenkommen', def: 'compromise so both sides give something' },
      { en: "Let's park that for now", de: 'Das stellen wir erst mal zurück', def: 'postpone a topic to discuss it later' },
    ],
    keywords: ['negotiat', 'discount', 'procurement', 'purchasing', 'contract', 'term', 'concession', 'condition', 'price', 'deal', 'commit', 'renewal'],
    fluencyQ: 'discount',
    scene: 'b07',
    goals: [
      { kind: 'hedge', need: 1 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't08',
    n: 8,
    kind: 'job',
    title: { de: 'Partner und Vertriebspartner (UK/US)', en: 'Partners and resellers (UK/US)' },
    task: {
      de: 'Ein Systemhaus als Reseller gewinnen: Pitch und Nachfass-Mail.',
      en: 'Win an IT service provider as a reseller: pitch and follow-up email.',
    },
    tool: 'conditionals',
    focus: {
      de: 'Überzeugen mit dem 2. Konditional; britisches Understatement verstehen.',
      en: 'Persuading with the second conditional; understanding British understatement.',
    },
    trap: 'f04',
    phrases: [
      { en: "What's in it for you is …", de: 'Ihr Vorteil dabei ist …', def: 'names the benefit for the partner' },
      { en: 'recurring revenue', de: 'wiederkehrender Umsatz', def: 'income that comes in again every month or year' },
      { en: 'a mutually beneficial partnership', de: 'eine Partnerschaft zum Vorteil beider Seiten', def: 'a partnership that helps both sides' },
      { en: 'enablement and co-marketing', de: 'Schulung und gemeinsames Marketing', def: 'training partners and marketing together' },
      { en: 'Would you be open to a quick call?', de: 'Hätten Sie Interesse an einem kurzen Telefonat?', def: 'a soft request for a short call' },
    ],
    keywords: ['partner', 'reseller', 'channel', 'margin', 'commission', 'recurring', 'revenue', 'enablement', 'co-marketing', 'referral', 'system integrator'],
    fluencyQ: 'partner',
    scene: 'b08',
    goals: [
      { kind: 'phrase', need: 2 },
      { kind: 'transition', need: 2 },
    ],
  },
  {
    id: 't09',
    n: 9,
    kind: 'job',
    title: { de: 'Wenn es brennt: Verzögerung, Eskalation, Beschwerde', en: 'When things go wrong: delays, escalations, complaints' },
    task: {
      de: 'Mail an den Projektleiter und Call mit einem verärgerten Kunden.',
      en: 'Email to the project lead and a call with an upset customer.',
    },
    tool: 'past-simple-perfect',
    focus: {
      de: 'Present Perfect für den aktuellen Stand, Verantwortung übernehmen.',
      en: 'Present perfect for the current status, taking responsibility.',
    },
    trap: 'f12',
    phrases: [
      { en: 'I owe you an apology', de: 'Ich muss mich bei Ihnen entschuldigen', def: 'a personal, direct apology' },
      { en: "We've identified the root cause", de: 'Wir haben die eigentliche Ursache gefunden', def: 'we know what really caused the problem' },
      { en: "Here's what we're doing about it", de: 'Das tun wir jetzt dagegen', def: 'introduces the concrete fix' },
      { en: "I'll keep you posted", de: 'Ich halte Sie auf dem Laufenden', def: 'promises regular updates' },
      { en: 'to make up for it', de: 'um es wiedergutzumachen', def: 'to compensate for the problem' },
    ],
    keywords: ['delay', 'escalat', 'complain', 'complaint', 'apolog', 'issue', 'incident', 'outage', 'root cause', 'fix', 'problem', 'upset'],
    fluencyQ: 'deal-stuck',
    scene: 'b09',
    goals: [
      { kind: 'phrase', need: 2 },
      { kind: 'hedge', need: 1 },
    ],
  },
  {
    id: 't10',
    n: 10,
    kind: 'job',
    title: { de: 'Intern führen: Pipeline, Forecast, Kickoff', en: 'Leading internally: pipeline, forecast, kickoff' },
    task: {
      de: 'Ein Meeting eröffnen, steuern und abschließen (mit zwei Figuren).',
      en: 'Open, steer, and close a meeting (with two characters).',
    },
    tool: 'c1-precision',
    focus: {
      de: 'Gespräch steuern, Überleitungen, genaue Zahlen und Termine.',
      en: 'Steering a conversation, transitions, precise numbers and dates.',
    },
    trap: 'f21',
    phrases: [
      { en: "Let's get started", de: 'Fangen wir an', def: 'opens the meeting' },
      { en: 'Can I just jump in here?', de: 'Darf ich kurz einhaken?', def: 'politely interrupts' },
      { en: "Let's take that offline", de: 'Das besprechen wir separat', def: 'moves a side topic out of the meeting' },
      { en: "Who's going to own this?", de: 'Wer übernimmt das?', def: 'asks who is responsible for a task' },
      { en: 'To wrap up, …', de: 'Zum Abschluss …', def: 'starts the final summary' },
    ],
    keywords: ['pipeline', 'forecast', 'kickoff', 'meeting', 'agenda', 'quota', 'target', 'team', 'owner', 'action item', 'q1', 'q2', 'q3', 'q4'],
    fluencyQ: 'kpi',
    scene: 'b10',
    goals: [
      { kind: 'transition', need: 3 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't11',
    n: 11,
    kind: 'job',
    title: { de: 'Bestandskunden: Verlängerung, Upsell, Referenz', en: 'Existing customers: renewal, upsell, reference' },
    task: {
      de: 'Verlängerungsgespräch führen und um eine Referenz bitten.',
      en: 'Lead a renewal conversation and ask for a reference.',
    },
    tool: 'c1-diplomacy',
    focus: {
      de: 'Indirekte Bitten („I was wondering if …“), diplomatische Distanz.',
      en: 'Indirect requests ("I was wondering if …"), diplomatic distance.',
    },
    trap: 'f06',
    phrases: [
      { en: "Now that you've been using it for a year, …", de: 'Jetzt, wo Sie es seit einem Jahr nutzen, …', def: 'opens a review after one year of use' },
      { en: 'How has it been working for your team?', de: 'Wie klappt es bei Ihrem Team?', def: 'asks for honest feedback' },
      { en: "I'd love to explore whether …", de: 'Ich würde gern ausloten, ob …', def: 'suggests checking an option without pressure' },
      { en: 'Would you be open to being a reference?', de: 'Wären Sie bereit, als Referenz zu dienen?', def: 'asks the customer to recommend you to others' },
      { en: 'No pressure at all', de: 'Ganz ohne Druck', def: 'makes clear that saying no is fine' },
    ],
    keywords: ['renewal', 'renew', 'upsell', 'upgrade', 'reference', 'case study', 'customer success', 'satisfaction', 'account', 'expansion', 'churn'],
    fluencyQ: 'onboarding',
    scene: 'b11',
    goals: [
      { kind: 'hedge', need: 2 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't12',
    n: 12,
    kind: 'bridge',
    title: { de: 'Messe, Networking, LinkedIn', en: 'Trade shows, networking, LinkedIn' },
    task: {
      de: 'Gespräch am Messestand und LinkedIn-Nachricht danach.',
      en: 'Conversation at the booth and a LinkedIn message afterward.',
    },
    tool: 'pres-simple-cont',
    focus: {
      de: 'Small-Talk-Rituale, Anschlussfragen, lockerer Ton.',
      en: 'Small-talk rituals, follow-up questions, a relaxed tone.',
    },
    trap: 'f24',
    phrases: [
      { en: 'What brings you to the show?', de: 'Was führt Sie auf die Messe?', def: 'a classic opener at a trade show' },
      { en: "How's business on your end?", de: 'Wie läuft das Geschäft bei Ihnen?', def: 'a friendly question about their company' },
      { en: 'Great connecting with you at …', de: 'Schön, Sie auf … kennengelernt zu haben', def: 'opens a follow-up message after an event' },
      { en: "Let's stay in touch", de: 'Lassen Sie uns in Kontakt bleiben', def: 'suggests keeping the connection' },
      { en: "I'll let you get back to it", de: 'Ich will Sie nicht länger aufhalten', def: 'a polite way to end a conversation' },
    ],
    keywords: ['trade show', 'trade fair', 'booth', 'network', 'linkedin', 'conference', 'event', 'small talk', 'contact', 'connect'],
    fluencyQ: 'trade-fair',
    scene: 'b12',
    goals: [
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't13',
    n: 13,
    kind: 'life',
    title: { de: 'Unterwegs: Hotel, Flug, Mietwagen', en: 'On the road: hotel, flight, rental car' },
    task: {
      de: 'Höflich, aber bestimmt reklamieren.',
      en: 'Complain politely but firmly.',
    },
    tool: 'modals-deduction',
    focus: {
      de: 'Höflich und bestimmt, Modalverben („There must have been a mix-up.“).',
      en: 'Polite but firm, modal verbs ("There must have been a mix-up.").',
    },
    trap: 'f03',
    phrases: [
      { en: "I was wondering if there's anything you could do", de: 'Ich wollte fragen, ob Sie da etwas machen können', def: 'a soft but clear request for help' },
      { en: "That's not what I booked", de: 'Das habe ich so nicht gebucht', def: 'states that the service does not match the booking' },
      { en: 'Could you rebook me on the next flight?', de: 'Könnten Sie mich auf den nächsten Flug umbuchen?', def: 'asks to change to the next flight' },
      { en: "I'd appreciate it if …", de: 'Ich wäre Ihnen dankbar, wenn …', def: 'a polite way to ask for something' },
      { en: "I'd like to get this straightened out", de: 'Ich möchte das gern klären', def: 'wants the problem solved' },
    ],
    keywords: ['hotel', 'flight', 'airline', 'airport', 'rental', 'car', 'booking', 'book', 'room', 'reservation', 'luggage', 'baggage', 'refund', 'upgrade', 'travel'],
    fluencyQ: 'travel',
    scene: 'b13',
    goals: [
      { kind: 'phrase', need: 2 },
      { kind: 'hedge', need: 1 },
    ],
  },
  {
    id: 't14',
    n: 14,
    kind: 'life',
    title: { de: 'Geschichten erzählen: Erlebnisse und Kundenerfolge', en: 'Storytelling: experiences and customer wins' },
    task: {
      de: 'Eine 2-Minuten-Geschichte: Wochenende, Reise oder Erfolg eines Kunden.',
      en: 'A 2-minute story: a weekend, a trip, or a customer success.',
    },
    tool: 'past-perfect',
    focus: {
      de: 'Erzählzeiten: Past Simple, Past Continuous, Past Perfect.',
      en: 'Narrative tenses: past simple, past continuous, past perfect.',
    },
    trap: 'f22',
    phrases: [
      { en: 'So there I was …', de: 'Da stand ich also …', def: 'starts the key moment of a story' },
      { en: 'It turned out that …', de: 'Es stellte sich heraus, dass …', def: 'reveals a surprising result' },
      { en: 'Long story short, …', de: 'Um es kurz zu machen, …', def: 'skips to the end of the story' },
      { en: 'The funny thing is …', de: 'Das Lustige daran ist …', def: 'introduces a surprising or amusing detail' },
      { en: 'In the end, …', de: 'Am Ende …', def: 'tells how things finished' },
    ],
    keywords: ['story', 'weekend', 'trip', 'vacation', 'success', 'experience', 'happened', 'anecdote'],
    fluencyQ: 'lost-deal',
    scene: 'b14',
    goals: [
      { kind: 'transition', need: 2 },
      { kind: 'phrase', need: 2 },
    ],
  },
  {
    id: 't15',
    n: 15,
    kind: 'life',
    title: { de: 'Nachrichten, Tech und Meinung', en: 'News, tech, and opinions' },
    task: {
      de: 'Eine Meinung vertreten und auf ein Gegenargument eingehen (90/60/45).',
      en: 'Defend an opinion and respond to a counterargument (90/60/45).',
    },
    tool: 'c1-hedging',
    focus: {
      de: 'Meinung abstufen, zustimmen und widersprechen.',
      en: 'Grading opinions, agreeing and disagreeing.',
    },
    trap: 'f02',
    phrases: [
      { en: "I see where you're coming from, but …", de: 'Ich verstehe Ihren Standpunkt, aber …', def: 'acknowledges a view before disagreeing' },
      { en: "I'd argue that …", de: 'Ich würde sagen, dass …', def: 'states an opinion with some care' },
      { en: "It's a bit more nuanced than that", de: 'Ganz so einfach ist es nicht', def: 'says the topic is more complex' },
      { en: "That's a fair point", de: 'Da ist was dran', def: 'accepts part of the other argument' },
      { en: 'Time will tell', de: 'Das wird die Zeit zeigen', def: 'we will know later' },
    ],
    keywords: ['opinion', 'news', 'ai', 'artificial intelligence', 'tech', 'economy', 'sport', 'argue', 'debate', 'trend'],
    fluencyQ: 'ai-docs',
    scene: 'b15',
    goals: [
      { kind: 'hedge', need: 2 },
      { kind: 'transition', need: 2 },
    ],
  },
  {
    id: 't16',
    n: 16,
    kind: 'life',
    title: { de: 'Alltag regeln: Arzt, Wohnung, Handwerker, Behörde', en: 'Everyday errands: doctor, apartment, repairs, offices' },
    task: {
      de: 'Ein Telefonat und eine Beschwerde-Mail.',
      en: 'A phone call and a complaint email.',
    },
    tool: 'relative',
    focus: {
      de: 'Beschreiben und umschreiben, wenn das Wort fehlt (Relativsätze: „the thing that …“).',
      en: 'Describing and paraphrasing when a word is missing (relative clauses: "the thing that …").',
    },
    trap: 'f23',
    phrases: [
      { en: "I've been having trouble with …", de: 'Ich habe seit einiger Zeit Probleme mit …', def: 'describes an ongoing problem' },
      { en: "It's been going on for about a week", de: 'Das geht schon seit ungefähr einer Woche so', def: 'says how long the problem has lasted' },
      { en: 'Could you take a look at …?', de: 'Könnten Sie sich … ansehen?', def: 'asks someone to check something' },
      { en: 'What are my options?', de: 'Welche Möglichkeiten habe ich?', def: 'asks which choices are available' },
      { en: 'Would it be possible to …?', de: 'Wäre es möglich, …?', def: 'a polite request' },
    ],
    keywords: ['doctor', 'appointment', 'apartment', 'landlord', 'repair', 'plumber', 'heating', 'leak', 'prescription', 'deposit', 'office', 'insurance', 'rent'],
    fluencyQ: 'habits',
    scene: 'b16',
    goals: [
      { kind: 'phrase', need: 2 },
    ],
  },
];

/** Vorgeschlagene Reihenfolge (lehrer.md §3): 1, 2, 13, 3, 4, 14, 5, 6, 12, 7, 8, 15, 9, 10, 16, 11. */
export const THEME_ORDER: readonly ThemeId[] = [
  't01', 't02', 't13', 't03', 't04', 't14', 't05', 't06', 't12', 't07', 't08', 't15', 't09', 't10', 't16', 't11',
];

const BY_ID = new Map<string, WeekTheme>(THEMES.map((t) => [t.id, t]));

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && BY_ID.has(v);

export function themeById(id: unknown): WeekTheme | null {
  return typeof id === 'string' ? (BY_ID.get(id) ?? null) : null;
}
