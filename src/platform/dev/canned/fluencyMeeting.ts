import { registerCannedReply } from '../fakeSample';

// Feste, realistische Antworten des Entwicklungs-Adapters für fluency-check@1, meeting-prep@1 und
// meeting-debrief@1 (Lernberatung 27.09., V6/V4). Sie lesen nur die Datenzeilen des Prompts
// (Erklärungssprache, Texte zwischen den Markierungen). Korrekturen gibt es nur für typische
// Fehler, die wörtlich in einer Runde stehen (so bleibt `wrong` ein echter Ausschnitt).
// `zzjson` im Text → keine JSON-Antwort (Fehlerzustand testen). Nur Entwicklung und Tests.

type Lang = 'de' | 'en';

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';
const lineOf = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const langOf = (input: string): Lang => (/^English$/i.test(lineOf(input, 'Explanation language')) ? 'en' : 'de');
const blocks = (input: string): string[] => Array.from(input.matchAll(/<<<TEXT\n([\s\S]*?)\nTEXT>>>/g), (m) => (m[1] ?? '').trim());

// ---------------------------------------------------------------- fluency-check@1

type Rule = { re: RegExp; right: (m: string) => string; why: Record<Lang, string> };

const RULES: readonly Rule[] = [
  {
    re: /\bwe are doing (?:this|that|it) since \w+ years\b/i,
    right: (m) => m.replace(/\bwe are doing/i, "we've been doing").replace(/\bsince\b/i, 'for'),
    why: { de: 'Dauer bis heute: Present Perfect Continuous und „for“.', en: 'A duration up to now: present perfect continuous with "for".' },
  },
  {
    re: /\bmore cheaper\b/i,
    right: () => 'cheaper',
    why: { de: 'Doppelte Steigerung: nur „cheaper“.', en: 'Double comparative: just use "cheaper".' },
  },
  {
    re: /\bthe most companies\b/i,
    right: () => 'most companies',
    why: { de: '„most“ im Sinn von „die meisten“ steht ohne „the“.', en: '"Most" meaning "the majority of" takes no article.' },
  },
];

const PROGRESS: Record<Lang, string> = {
  de: 'Von Runde zu Runde kommst du schneller zum Kern: In Runde 3 stehen Nutzen und Beispiel direkt am Anfang, die Wiederholungen aus Runde 1 sind weg.',
  en: 'From round to round you get to the point faster: in round 3 the benefit and the example come right at the start, and the repetitions from round 1 are gone.',
};

const MISSING = [
  { phrase: 'the bottom line is', de: 'unterm Strich', def: 'the most important point or result', example: 'The bottom line is that you save time on every single document.' },
  { phrase: 'pay for itself', de: 'sich rechnen, sich amortisieren', def: 'to save as much money as it costs', example: 'In most cases the system will pay for itself within a year.' },
];

export function fluencyCheckReply(input: string): string {
  const rounds = blocks(input);
  const all = rounds.join('\n');
  if (/\bzzjson\b/i.test(all)) return NOT_JSON;
  const lang = langOf(input);
  const corrections = RULES.flatMap((r) => {
    const m = r.re.exec(all)?.[0];
    return m ? [{ wrong: m, right: r.right(m), why: r.why[lang] }] : [];
  }).slice(0, 3);
  return JSON.stringify({ progress: PROGRESS[lang], missing: MISSING, corrections });
}

// ---------------------------------------------------------------- meeting-prep@1

const PREP_WHY: Record<Lang, [string, string, string]> = {
  de: ['Wer Rabatt will, prüft zuerst den Preis gegen den Wettbewerb.', 'Eine lange Laufzeit wirkt auf Partner wie ein Risiko.', 'Am Ende will er wissen, was er intern vorzeigen kann.'],
  en: ['Someone who wants a discount first compares your price with the competition.', 'Partners often see a long contract term as a risk.', 'In the end he wants to know what he can show internally.'],
};

export function meetingPrepReply(input: string): string {
  const text = blocks(input).join('\n');
  if (/\bzzjson\b/i.test(text)) return NOT_JSON;
  const lang = langOf(input);
  const why = PREP_WHY[lang];
  return JSON.stringify({
    phrases: [
      { en: 'in return for', de: 'im Gegenzug für', def: 'as an exchange for something', example: 'We can talk about the price in return for a three-year term.' },
      { en: "I'd be open to", de: 'ich wäre offen für', def: 'willing to consider something', example: "I'd be open to a smaller discount if we agree on a longer term." },
      { en: 'meet you halfway', de: 'Ihnen entgegenkommen', def: 'to agree to part of what someone wants', example: 'I am happy to meet you halfway on the setup fee.' },
      { en: 'from where I stand', de: 'aus meiner Sicht', def: 'in my opinion, from my position', example: 'From where I stand, a longer term is good for both of us.' },
      { en: 'the bigger picture', de: 'das große Ganze', def: 'the situation as a whole', example: 'Let us look at the bigger picture before we talk about numbers.' },
      { en: 'can we agree on', de: 'können wir uns einigen auf', def: 'a polite way to propose a decision', example: 'Can we agree on a first step before the end of the month?' },
      { en: 'to be fully transparent', de: 'um ganz offen zu sein', def: 'to be completely open and honest', example: 'To be fully transparent, fifteen percent is not possible for us.' },
    ],
    objections: [
      { q: 'Your competitor is fifteen percent cheaper. Why should we stay with you?', why: why[0], answers: ['I understand the pressure on price.', 'What you get with us is a partner who knows your customers.', 'Let me show you where the difference pays off.'] },
      { q: 'Three years is a long time. What if the market changes?', why: why[1], answers: ['That is a fair concern.', 'We can build in a review after the first year.', 'A longer term lets us keep the price stable for you.'] },
      { q: 'What can I take back to my management today?', why: why[2], answers: ['You can take back a clear offer.', 'A lower rate in return for a longer term.', 'I can send you a one-page summary this afternoon.'] },
    ],
    scene: {
      title: 'Dress rehearsal: discount or longer term',
      title_de: 'Generalprobe: Rabatt oder längere Laufzeit',
      situation: 'Your partner in the UK wants a fifteen percent discount on the renewal. You want a three-year term instead. He has asked for a short video call before his management meeting on Thursday.',
      situation_de: 'Dein Partner in Großbritannien will fünfzehn Prozent Rabatt bei der Verlängerung. Du willst stattdessen drei Jahre Laufzeit. Er hat vor seiner Managementrunde am Donnerstag um einen kurzen Videocall gebeten.',
      goal: 'Trade a small discount for a three-year term.',
      goal_de: 'Einen kleinen Rabatt gegen drei Jahre Laufzeit tauschen.',
      persona: { name: 'Oliver Grant', role: 'Partner Manager', org: 'a UK software reseller', traits: 'Friendly and direct, under pressure to show savings, compares every offer with the competition.' },
      stake: 'He needs a visible saving to show his management on Thursday.',
      objection: 'He thinks a three-year term is too risky in a fast-moving market.',
      opening: 'Thanks for jumping on the call. I will be straight with you: we need a better price, or we have to look at other options.',
      useful: [
        { en: 'in return for', de: 'im Gegenzug für' },
        { en: 'meet you halfway', de: 'Ihnen entgegenkommen' },
        { en: 'from where I stand', de: 'aus meiner Sicht' },
        { en: 'can we agree on', de: 'können wir uns einigen auf' },
      ],
      level: 'C1',
    },
  });
}

// ---------------------------------------------------------------- meeting-debrief@1

const DEBRIEF: ReadonlyArray<{ want: Record<Lang, string>; en: string; phrase: string; de: string; def: string; why: Record<Lang, string> }> = [
  {
    want: { de: 'Höflich sagen, dass der Rabatt nur mit längerer Laufzeit geht.', en: 'Say politely that the discount only works with a longer term.' },
    en: "I'm happy to look at the price, but only in return for a longer commitment.",
    phrase: 'in return for',
    de: 'im Gegenzug für',
    def: 'as an exchange for something',
    why: { de: 'Verknüpft Zugeständnis und Gegenleistung, ohne hart zu klingen.', en: 'Links a concession to something in return without sounding harsh.' },
  },
  {
    want: { de: 'Um Bedenkzeit bitten, ohne unsicher zu wirken.', en: 'Ask for time to think without sounding unsure.' },
    en: "Let me take this back to my team and I'll get back to you by Friday.",
    phrase: "I'll get back to you",
    de: 'ich melde mich bei Ihnen',
    def: 'to contact someone again later with an answer',
    why: { de: 'Klingt verbindlich und nennt einen klaren Zeitpunkt.', en: 'Sounds committed and gives a clear time.' },
  },
  {
    want: { de: 'Zusammenfassen, worauf man sich geeinigt hat.', en: 'Sum up what you agreed on.' },
    en: 'Just to make sure we are on the same page: we start with a pilot in October.',
    phrase: 'on the same page',
    de: 'auf demselben Stand',
    def: 'agreeing about what is happening or what to do',
    why: { de: 'Ein freundlicher, typischer Einstieg in eine Zusammenfassung.', en: 'A friendly, typical way to start a summary.' },
  },
];

export function meetingDebriefReply(input: string): string {
  const text = blocks(input).join('\n');
  if (/\bzzjson\b/i.test(text)) return NOT_JSON;
  const lang = langOf(input);
  const points = text.split(/\n+|(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  const n = Math.max(1, Math.min(DEBRIEF.length, points.length));
  return JSON.stringify({ items: DEBRIEF.slice(0, n).map((d) => ({ want: d.want[lang], en: d.en, phrase: d.phrase, de: d.de, def: d.def, why: d.why[lang] })) });
}

export function registerFluencyMeetingReplies(): void {
  registerCannedReply('fluency-check', fluencyCheckReply);
  registerCannedReply('meeting-prep', meetingPrepReply);
  registerCannedReply('meeting-debrief', meetingDebriefReply);
}
