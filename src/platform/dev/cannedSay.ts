import { registerCannedReply } from './fakeSample';

// Feste, realistische Antwort des Entwicklungs-Adapters für say-check@1 („Sag es“). Sie liest
// nur die Datenzeilen des Prompts: Erklärungssprache und den Text zwischen den Markierungen.
// Korrekturen gibt es nur für typische Fehler, die wörtlich im Text stehen (so bleibt `wrong`
// ein echter Ausschnitt); ein fehlerfreier zweiter Durchgang bekommt keine Korrekturen.
// `zzjson` im Text → keine JSON-Antwort (Fehlerzustand testen). Nur Entwicklung und Tests.

type Lang = 'de' | 'en';

const lineOf = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const langOf = (input: string): Lang => (/^English$/i.test(lineOf(input, 'Explanation language')) ? 'en' : 'de');
const learnerText = (input: string): string => (/<<<TEXT\n([\s\S]*?)\nTEXT>>>/.exec(input)?.[1] ?? '').trim();

type Rule = { re: RegExp; right: (m: string) => string; why: Record<Lang, string> };

const RULES: readonly Rule[] = [
  {
    re: /\bwe are working with (?:them|you) since \d{4}\b/i,
    right: (m) => m.replace(/\b(w)e are working/i, '$1e have been working'),
    why: { de: 'Seit einem Zeitpunkt bis heute: Present Perfect Continuous.', en: 'From a point in the past until now: use the present perfect continuous.' },
  },
  {
    re: /\bdiscuss about\b/i,
    right: () => 'discuss',
    why: { de: '„discuss“ steht ohne „about“.', en: '"Discuss" takes a direct object, without "about".' },
  },
  {
    re: /\bmore cheaper\b/i,
    right: () => 'cheaper',
    why: { de: 'Doppelte Steigerung: nur „cheaper“.', en: 'Double comparative: just use "cheaper".' },
  },
  {
    re: /\bI am agree\b/i,
    right: () => 'I agree',
    why: { de: '„agree“ ist ein Verb, kein Adjektiv.', en: '"Agree" is a verb, not an adjective.' },
  },
];

const PRAISE: Record<Lang, string> = {
  de: 'Klarer Aufbau und ein konkreter Vorschlag am Ende.',
  en: 'Clear structure and a concrete suggestion at the end.',
};
const UPGRADE_WHY: Record<Lang, string> = {
  de: 'Höflicher Vorschlag statt Anweisung – typisch für C1 im Kundengespräch.',
  en: 'A polite suggestion instead of an instruction – typical C1 tone with clients.',
};
const BETTER =
  'I understand that the price may seem high at first glance. However, we have been working with companies like yours since 2019, and most of them recover the cost within the first year. ' +
  "I'd suggest that we schedule a short call next week to discuss the numbers in more detail.";

/** Letzter Satz des Texts (für die Aufwertung). */
function lastSentence(text: string): string {
  const parts = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  return (parts[parts.length - 1] ?? text).trim();
}

export function sayCheckReply(input: string): string {
  const text = learnerText(input);
  if (/\bzzjson\b/i.test(text)) return 'Sorry, I cannot give a clean answer for that right now.';
  const lang = langOf(input);
  const corrections = RULES.flatMap((r) => {
    const m = r.re.exec(text)?.[0];
    return m ? [{ wrong: m, right: r.right(m), why: r.why[lang] }] : [];
  }).slice(0, 4);
  // Aufwertung nur im ersten Durchgang (Text mit Fehlern) – der zweite ist schon besser.
  const upgrades = corrections.length
    ? [{ from: lastSentence(text), to: "I'd suggest that we schedule a short call next week.", why: UPGRADE_WHY[lang], phrase: "I'd suggest that we", de: 'ich würde vorschlagen, dass wir', def: 'a polite way to propose an idea' }]
    : [];
  return JSON.stringify({ corrections, upgrades, better: BETTER, praise: PRAISE[lang] });
}

export function registerSayReplies(): void {
  registerCannedReply('say-check', sayCheckReply);
}
