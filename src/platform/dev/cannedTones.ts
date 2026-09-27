import { registerCannedReply } from './fakeSample';

// Feste, realistische Antwort des Entwicklungs-Adapters für tone-check@1 („Eine Botschaft, drei
// Tonlagen“). Sie liest nur die Datenzeilen des Prompts: Erklärungssprache und die drei
// eingerahmten Fassungen. Das Tonurteil folgt einfachen Merkmalen (Anrede/Gruß → Mail passt,
// „you must“/„asap“ → zu direkt, „hereby“/„kindly“ → zu steif); Korrekturen gibt es nur für
// typische Fehler, die wörtlich im Text stehen. `zzjson` in einer Fassung → keine JSON-Antwort
// (Fehlerzustand testen). Nur Entwicklung und Tests.

type Lang = 'de' | 'en';
type Reg = 'slack' | 'cfo' | 'meeting';
const REGS: readonly Reg[] = ['slack', 'cfo', 'meeting'];

const lineOf = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const langOf = (input: string): Lang => (/^English$/i.test(lineOf(input, 'Explanation language')) ? 'en' : 'de');
const texts = (input: string): string[] => [...input.matchAll(/<<<TEXT\n([\s\S]*?)\nTEXT>>>/g)].map((m) => (m[1] ?? '').trim());

type Rule = { re: RegExp; right: (m: string) => string; why: Record<Lang, string> };
const RULES: readonly Rule[] = [
  { re: /\bwill delay (?:for|with) two weeks\b/i, right: () => 'will be delayed by two weeks', why: { de: 'Verschoben um einen Zeitraum: „be delayed by“.', en: 'Postponed by a period of time: “be delayed by”.' } },
  { re: /\bdiscuss about\b/i, right: () => 'discuss', why: { de: '„discuss“ steht ohne „about“.', en: '“Discuss” takes a direct object, without “about”.' } },
  { re: /\bsince two weeks\b/i, right: () => 'for two weeks', why: { de: 'Zeitraum: „for“, Zeitpunkt: „since“.', en: 'A period of time takes “for”, a point in time “since”.' } },
  { re: /\bI am agree\b/i, right: () => 'I agree', why: { de: '„agree“ ist ein Verb, kein Adjektiv.', en: '“Agree” is a verb, not an adjective.' } },
];

const WHY: Record<Lang, Record<'too_direct' | 'too_stiff' | 'fits', string>> = {
  de: { too_direct: 'Die Nachricht kommt ohne Einleitung und klingt dadurch schroff.', too_stiff: 'Für diesen Rahmen klingt die Fassung zu förmlich und umständlich.', fits: 'Der Ton passt gut zu diesem Empfänger.' },
  en: { too_direct: 'The news comes without any lead-in, so it sounds abrupt.', too_stiff: 'For this setting the version sounds too formal and wordy.', fits: 'The tone fits this audience well.' },
};
const MODEL: Record<Reg, string> = {
  slack: "Heads-up: the archive migration is slipping by two weeks – the export is taking longer than planned. I'll update the timeline today.",
  cfo: 'Dear Ms. Keller, I wanted to let you know that the archive migration will take about two weeks longer than planned, as the export from the legacy system needs more time. We have adjusted the plan so that your year-end closing is not affected. I would be happy to walk you through the new timeline this week.',
  meeting: "Quick update on the migration: we're looking at about two extra weeks, mainly because the export is slower than expected.",
};
const TIP: Record<Lang, string> = {
  de: 'Gleiche Fakten, anderer Rahmen: Beim CFO zuerst Wirkung und Lösung, unter Kollegen direkt zur Sache.',
  en: 'Same facts, different frame: with the CFO lead with impact and solution, with colleagues get straight to the point.',
};

function toneOf(reg: Reg, text: string): 'too_direct' | 'too_stiff' | 'fits' {
  if (/\b(hereby|kindly|herewith|we regret to inform)\b/i.test(text)) return reg === 'cfo' ? 'fits' : 'too_stiff';
  if (/\b(you must|asap|immediately)\b/i.test(text)) return 'too_direct';
  if (reg === 'cfo' && !/^(dear|hi|hello|good morning)\b/i.test(text)) return 'too_direct';
  return 'fits';
}

export function toneCheckReply(input: string): string {
  const all = texts(input);
  if (all.some((t) => /\bzzjson\b/i.test(t))) return 'Sorry, I cannot give a clean answer for that right now.';
  const lang = langOf(input);
  const versions = REGS.map((reg, i) => {
    const tone = toneOf(reg, all[i] ?? '');
    return { reg, tone, why: WHY[lang][tone], model: MODEL[reg] };
  });
  const corrections = REGS.flatMap((reg, i) =>
    RULES.flatMap((r) => {
      const m = r.re.exec(all[i] ?? '')?.[0];
      return m ? [{ reg, wrong: m, right: r.right(m), why: r.why[lang] }] : [];
    }),
  ).slice(0, 6);
  return JSON.stringify({ versions, corrections, tip: TIP[lang] });
}

export function registerToneReplies(): void {
  registerCannedReply('tone-check', toneCheckReply);
}
