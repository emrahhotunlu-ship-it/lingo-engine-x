import { registerCannedReply } from './fakeSample';

// Feste, realistische Antworten des Entwicklungs-Adapters für word-gen@1, lesson-production@1,
// grammar-items@1 und mnemonic@1 (Prüfbericht: bisher ohne Testantwort). Sie lesen nur die
// festen Datenzeilen des Prompts und halten die Schemaregeln der Vorlagen ein (Beispielsatz mit
// dem Wort, Sprache je Feld, genau eine Lücke …). Nur Entwicklung und Tests.

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const uiLang = (input: string, label: string): Lang => (/^English$/i.test(line(input, label)) ? 'en' : 'de');
const core = (w: string) =>
  w
    .replace(/^to\s+/i, '')
    .replace(/\b(something|someone|sth|sb)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// ---------------------------------------------------------------- word-gen@1

type Gen = { word: string; pos: string; de: string; def: string; ex: string; level: 'B1' | 'B2' | 'C1' | 'C2' };

const GENERAL: readonly Gen[] = [
  { word: 'reluctant', pos: 'adjective', de: 'zögerlich, widerwillig', def: 'not willing to do something and therefore slow to do it', ex: 'The client was reluctant to sign before the budget meeting.', level: 'B2' },
  { word: 'to follow through', pos: 'phrasal verb', de: 'etwas zu Ende bringen, dranbleiben', def: 'to finish something you have started or promised', ex: 'She always follows through on what she promises in meetings.', level: 'B2' },
  { word: 'feasible', pos: 'adjective', de: 'machbar, durchführbar', def: 'possible to do easily or conveniently', ex: 'A launch in March is feasible if testing starts next week.', level: 'C1' },
  { word: 'to streamline', pos: 'verb', de: 'straffen, vereinfachen', def: 'to make a process simpler and more effective', ex: 'We want to streamline the approval process for small invoices.', level: 'C1' },
  { word: 'bottleneck', pos: 'noun', de: 'Engpass', def: 'a point where a process slows down because of a problem', ex: 'Manual data entry is the biggest bottleneck in our workflow.', level: 'B2' },
  { word: 'to weigh up', pos: 'phrasal verb', de: 'abwägen', def: 'to think carefully about the advantages and disadvantages', ex: 'We need to weigh up the costs before we decide on a vendor.', level: 'B2' },
  { word: 'straightforward', pos: 'adjective', de: 'unkompliziert, einfach', def: 'easy to understand or do', ex: 'The migration was more straightforward than we had expected.', level: 'B2' },
  { word: 'to get the ball rolling', pos: 'phrase', de: 'etwas ins Rollen bringen', def: 'to start an activity or process', ex: 'Let me get the ball rolling with a short overview of the numbers.', level: 'C1' },
  { word: 'drawback', pos: 'noun', de: 'Nachteil', def: 'a disadvantage or problem that makes something less attractive', ex: 'The main drawback of the old system is the slow search.', level: 'B2' },
  { word: 'to pinpoint', pos: 'verb', de: 'genau bestimmen', def: 'to find or describe something exactly', ex: 'The report helped us pinpoint where the delays come from.', level: 'C1' },
];

const JOB: readonly Gen[] = [
  { word: 'retention policy', pos: 'noun', de: 'Aufbewahrungsrichtlinie', def: 'rules that say how long documents must be kept', ex: 'Our retention policy keeps invoices for ten years in the archive.', level: 'C1' },
  { word: 'to onboard', pos: 'verb', de: 'einarbeiten, (Kunden) einführen', def: 'to help a new customer or employee get started', ex: 'We onboard new customers in two short workshops.', level: 'B2' },
  { word: 'proof of concept', pos: 'noun', de: 'Machbarkeitsnachweis', def: 'a small test that shows an idea can work in practice', ex: 'The proof of concept ran for six weeks in the finance team.', level: 'C1' },
  { word: 'to scale up', pos: 'phrasal verb', de: 'hochskalieren, ausweiten', def: 'to make something larger or more extensive', ex: 'After the pilot we plan to scale up to all branches.', level: 'B2' },
  { word: 'renewal', pos: 'noun', de: 'Vertragsverlängerung', def: 'the act of extending a contract for another period', ex: 'The renewal is due in June, so we should start talks now.', level: 'B2' },
  { word: 'to integrate with', pos: 'verb', de: 'sich anbinden lassen an', def: 'to connect and work together with another system', ex: 'Our platform can integrate with most ERP systems out of the box.', level: 'B2' },
  { word: 'decision-maker', pos: 'noun', de: 'Entscheider(in)', def: 'a person who has the power to make important decisions', ex: 'We need to meet the real decision-maker before we send the offer.', level: 'B2' },
  { word: 'audit-proof', pos: 'adjective', de: 'revisionssicher', def: 'stored in a way that auditors can trust and check', ex: 'All documents are stored audit-proof in the German data center.', level: 'C1' },
  { word: 'to upsell', pos: 'verb', de: 'zusätzlich verkaufen', def: 'to persuade a customer to buy something more expensive', ex: 'We can upsell the workflow module to existing archive customers.', level: 'C1' },
  { word: 'service level agreement', pos: 'noun', de: 'Dienstgütevereinbarung', def: 'a contract that defines the level of service a customer can expect', ex: 'The service level agreement promises a response within four hours.', level: 'C1' },
];

const FILL: Readonly<Record<string, Omit<Gen, 'word'>>> = {
  benchmark: { pos: 'noun', de: 'Vergleichsmaßstab, Richtwert', def: 'a standard used to compare the quality or performance of something', ex: 'We use last year\'s numbers as a benchmark for the new team.', level: 'B2' },
  leverage: { pos: 'verb', de: 'nutzen, ausnutzen', def: 'to use something you already have to gain an advantage', ex: 'We can leverage our partner network to reach new markets.', level: 'C1' },
};

function wordGenReply(input: string): string {
  const mode = line(input, 'Mode');
  if (mode === 'fill') {
    const m = /^Complete the card for the word: (.+?) \(exactly this word, 1 item[^)]*\)\.$/m.exec(input);
    const word = (m?.[1] ?? '').trim();
    const known = FILL[core(word)];
    const w: Gen = known
      ? { word, ...known }
      : { word, pos: 'noun', de: 'Fachbegriff', def: `a term that is often used in business conversations`, ex: `In our weekly meeting we talked about ${word} for quite a while.`, level: 'B2' };
    return JSON.stringify({ words: [w] });
  }
  const count = Number(/Suggest (\d+) useful/.exec(input)?.[1] ?? 8);
  const knownLine = line(input, 'Do not suggest');
  const known = new Set(knownLine.split(',').map((k) => core(k)).filter(Boolean));
  const pool = mode === 'job' ? JOB : GENERAL;
  const words = pool.filter((w) => !known.has(core(w.word))).slice(0, Math.max(1, count));
  return JSON.stringify({ words: words.length ? words : pool.slice(0, 1) });
}

// ---------------------------------------------------------------- lesson-production@1

function lessonProductionReply(input: string): string {
  const lang = uiLang(input, 'Explanation language');
  const required = line(input, 'Required words')
    .split(',')
    .map((w) => w.trim())
    .filter((w) => w && w !== '(none)');
  const text = line(input, 'Learner text');
  const lower = text.toLowerCase();
  const mustUsed = required.filter((w) => lower.includes(core(w).split(' ')[0] ?? ''));
  const errors: unknown[] = [];
  if (/\b(he|she|it) have\b/i.test(text)) {
    errors.push({ wrong: 'it have', right: 'it has', why: lang === 'de' ? 'Bei he, she und it braucht das Verb im Präsens ein -s.' : 'With he, she and it, the present tense verb needs an -s.', cat: 'verbform', sev: 'minor' });
  }
  const full = mustUsed.length === required.length;
  return JSON.stringify({
    cefr: 'B2',
    scores: { task: full ? 85 : 70, grammar: 80, vocabulary: 78, coherence: 82, register: 84 },
    errors,
    upgrades: [
      {
        orig: text.split(/(?<=[.!?])\s+/)[0]?.slice(0, 180) || text.slice(0, 180),
        better: 'Each invoice is first checked by our accounting team before anything else happens.',
        why: lang === 'de' ? 'So klingt der Ablauf klarer und etwas formeller.' : 'This makes the process sound clearer and a little more formal.',
      },
    ],
    mustUsed,
    structureUsed: true,
    cando: full ? 'met' : 'partly',
    candoWhy: full
      ? lang === 'de'
        ? 'Du beschreibst den Ablauf verständlich und nutzt alle Pflichtwörter.'
        : 'You describe the process clearly and use all of the required words.'
      : lang === 'de'
        ? 'Der Ablauf ist verständlich, aber es fehlen noch Pflichtwörter.'
        : 'The process is clear, but some of the required words are still missing.',
    model: `Every invoice is scanned and checked first. After that, an approval is requested from the finance team. Every step is recorded in the audit trail, so nothing gets lost.`,
  });
}

// ---------------------------------------------------------------- grammar-items@1

let itemRun = 0;

type Type = 'mc' | 'gap' | 'transform' | 'correct';

function grammarItemsReply(input: string): string {
  const topic = line(input, 'Topic id');
  const count = Math.max(3, Number(line(input, 'Count')) || 6);
  const wanted = line(input, 'Wanted types')
    .split(',')
    .map((t) => t.trim())
    .filter((t): t is Type => ['mc', 'gap', 'transform', 'correct'].includes(t));
  const types: Type[] = wanted.length ? wanted : ['mc', 'gap', 'transform', 'correct'];
  itemRun += 1;
  const people = ['Lena', 'Tom', 'Aylin', 'Marco', 'Sofia', 'Jonas', 'Mia', 'David'];
  const items = Array.from({ length: count }, (_, k) => {
    const type = types[k % types.length] as Type;
    const who = people[(k + itemRun) % people.length] as string;
    const n = itemRun * 10 + k + 2;
    const de = 'Der Bericht handelt nicht selbst, deshalb steht hier das Passiv mit der dritten Form.';
    const en = 'The report does not act itself, so the sentence needs the passive with the past participle.';
    const base = { topic, accepted: [] as string[], hint_de: '', explanation_de: de, explanation_en: en, src: 'ai' as const };
    if (type === 'mc') return { ...base, type, prompt: `Report ${n} ___ by ${who} every Monday morning.`, answer: 'is checked', options: ['checks', 'is checked', 'is checking'] };
    if (type === 'gap') return { ...base, type, prompt: `Report ${n} ___ (send) to ${who} yesterday afternoon.`, answer: 'was sent', options: null, hint_de: '(send)' };
    if (type === 'transform') return { ...base, type, prompt: `${who} updates report ${n} every week. → Report ${n} ___ every week.`, answer: 'is updated', options: null };
    return { ...base, type, prompt: `Report ${n} was send to ${who} last week.`, answer: `Report ${n} was sent to ${who} last week.`, options: null };
  });
  return JSON.stringify({ items });
}

// ---------------------------------------------------------------- mnemonic@1

function mnemonicReply(input: string): string {
  const word = line(input, 'Word');
  const lang = uiLang(input, 'Language of the memory aid');
  const w = core(word) || word;
  const text =
    lang === 'de'
      ? `Stell dir bei ${w} ein lebhaftes Bild vor: Du erklärst einem Kollegen im Büro genau diese Bedeutung und zeigst dabei auf die große Tafel.`
      : `Picture yourself saying ${w} in a meeting while you point at a big whiteboard, and the meaning sticks.`;
  return JSON.stringify({ text });
}

export function registerLearnReplies(): void {
  registerCannedReply('word-gen', wordGenReply);
  registerCannedReply('lesson-production', lessonProductionReply);
  registerCannedReply('grammar-items', grammarItemsReply);
  registerCannedReply('mnemonic', mnemonicReply);
}
