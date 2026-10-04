import { registerCannedReply } from '../fakeSample';

// Feste Antworten für die Neubau-Vorlagen goal-check@1 (P5), claude-drill@1 (P6),
// unit-listen@1, text-level@1, alternatives@1 (P4) und text-cards@1 (P3). Sie lesen nur die
// Datenzeilen des Prompts. `zzjson` in den Nutzerdaten → kein JSON. Nur Entwicklung und Tests –
// nie Teil des Produktions-Builds.

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';
const between = (input: string, re: RegExp): string => (re.exec(input)?.[1] ?? '').trim();
const numbered = (s: string): string[] => s.split('\n').filter((l) => /^\d+\. /.test(l));

// ---------------------------------------------------------------- goal-check@1

export function goalCheckReply(input: string): string {
  const en = /^Explanation language: English$/m.test(input);
  const goals = numbered(between(input, /\nGoals:\n([\s\S]*?)\n(?:Criteria|Transcript):/));
  const criteria = numbered(between(input, /\nCriteria:\n([\s\S]*?)\nTranscript:/));
  const said = [...input.matchAll(/^Learner: (.*)$/gm)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
  if (said.some((s) => /\bzzjson\b/i.test(s))) return NOT_JSON;
  const last = said.at(-1) ?? '';
  const quote = last.split(/\s+/).slice(0, 12).join(' ');
  const state = (i: number) => (!quote ? 'open' : i === 0 ? 'met' : i === 1 && said.length > 1 ? 'partly' : 'open');
  return JSON.stringify({
    goals: goals.map((_, i) => ({ i, state: state(i), quote: state(i) === 'open' ? '' : quote })),
    criteria: criteria.map((_, i) => ({
      i,
      state: state(i),
      quote: state(i) === 'open' ? '' : quote,
      note:
        state(i) === 'met'
          ? en ? 'You did this clearly in your own words.' : 'Das hast du klar mit eigenen Worten getan.'
          : state(i) === 'partly'
            ? en ? 'A good start, but it stayed a little vague.' : 'Ein guter Anfang, aber es blieb etwas vage.'
            : en ? 'This did not come up in the conversation.' : 'Das kam im Gespräch nicht vor.',
    })),
  });
}

// ---------------------------------------------------------------- claude-drill@1

const DRILL: Record<'de' | 'en', { title: string; items: Array<{ sentence: string; answer: string; accept: string[]; hint: string; why: string }> }> = {
  de: {
    title: 'since vs. for',
    items: [
      { sentence: 'We have been partners ___ 2021.', answer: 'since', accept: [], hint: 'Zeitpunkt', why: 'Nach einem Zeitpunkt wie einer Jahreszahl steht since.' },
      { sentence: 'I have led this account ___ three years.', answer: 'for', accept: [], hint: 'Dauer', why: 'Nach einer Zeitdauer steht for.' },
      { sentence: 'They have not replied ___ last Monday.', answer: 'since', accept: [], hint: 'Startpunkt', why: 'Last Monday ist ein Zeitpunkt, also since.' },
      { sentence: 'The pilot has been running ___ six weeks now.', answer: 'for', accept: [], hint: 'Zeitraum', why: 'Six weeks beschreibt eine Dauer, also for.' },
      { sentence: 'Prices have been stable ___ the merger.', answer: 'since', accept: [], hint: 'Ereignis', why: 'Ein Ereignis markiert den Startpunkt, daher since.' },
    ],
  },
  en: {
    title: 'since vs. for',
    items: [
      { sentence: 'We have been partners ___ 2021.', answer: 'since', accept: [], hint: 'point in time', why: 'Use since with a point in time such as a year.' },
      { sentence: 'I have led this account ___ three years.', answer: 'for', accept: [], hint: 'length of time', why: 'Use for with a length of time.' },
      { sentence: 'They have not replied ___ last Monday.', answer: 'since', accept: [], hint: 'starting point', why: 'Last Monday is a point in time, so since.' },
      { sentence: 'The pilot has been running ___ six weeks now.', answer: 'for', accept: [], hint: 'period', why: 'Six weeks is a duration, so for.' },
      { sentence: 'Prices have been stable ___ the merger.', answer: 'since', accept: [], hint: 'event', why: 'An event marks the starting point, so since.' },
    ],
  },
};

export function claudeDrillReply(input: string): string {
  if (/\bzzjson\b/i.test(between(input, /\n<<<\n([\s\S]*?)\n>>>/))) return NOT_JSON;
  const en = /hint: 1 to 4 words in English/.test(input);
  return JSON.stringify(DRILL[en ? 'en' : 'de']);
}

// ---------------------------------------------------------------- text-cards@1

const CARD_WORDS: ReadonlyArray<{ word: string; pos: string; de: string; def: string }> = [
  { word: 'leverage', pos: 'verb', de: 'nutzen, einsetzen', def: 'to use something to maximum advantage' },
  { word: 'streamline', pos: 'verb', de: 'straffen, vereinfachen', def: 'to make a process simpler and more efficient' },
  { word: 'stakeholder', pos: 'noun', de: 'Beteiligter, Interessengruppe', def: 'a person with an interest in a project or business' },
  { word: 'roll out', pos: 'phrasal verb', de: 'einführen, ausrollen', def: 'to introduce something new in stages' },
  { word: 'bottleneck', pos: 'noun', de: 'Engpass', def: 'a point where progress is slowed down' },
  { word: 'budget', pos: 'noun', de: 'Budget, Etat', def: 'an amount of money available for a purpose' },
  { word: 'deadline', pos: 'noun', de: 'Frist, Stichtag', def: 'the latest time by which something must be done' },
  { word: 'revenue', pos: 'noun', de: 'Umsatz, Einnahmen', def: 'the income a company receives from its business' },
  { word: 'customer', pos: 'noun', de: 'Kunde', def: 'a person or company that buys goods or services' },
];

export function textCardsReply(input: string): string {
  const text = between(input, /<<<TEXT\n([\s\S]*?)\nTEXT>>>/);
  if (/\bzzjson\b/i.test(text)) return NOT_JSON;
  const sentences = (text.match(/[^.!?\n]+[.!?]/g) ?? []).map((s) => s.trim()).filter((s) => s.length >= 8);
  const cards: Array<{ word: string; pos: string; de: string; def: string; ex: string }> = [];
  for (const w of CARD_WORDS) {
    const ex = sentences.find((s) => s.toLowerCase().includes(w.word.split(' ')[0] ?? w.word));
    if (ex) cards.push({ ...w, ex });
  }
  // Sonst: je Satz das längste Wort als Vorschlag (Ursprungssatz bleibt wörtlich).
  for (const ex of sentences) {
    if (cards.length >= 5) break;
    const word = (ex.match(/[A-Za-z]{7,}/g) ?? []).sort((a, b) => b.length - a.length)[0];
    if (!word || cards.some((c) => c.word.toLowerCase() === word.toLowerCase())) continue;
    cards.push({ word: word.toLowerCase(), pos: 'noun', de: 'siehe Beispielsatz', def: 'a useful word from this text', ex });
  }
  return JSON.stringify({ cards: cards.slice(0, 15) });
}

export function registerNbReplies(): void {
  registerCannedReply('goal-check', goalCheckReply);
  registerCannedReply('claude-drill', claudeDrillReply);
  registerCannedReply('text-cards', textCardsReply);
}
