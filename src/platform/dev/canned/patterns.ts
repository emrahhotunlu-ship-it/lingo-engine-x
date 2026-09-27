// Feste Antworten des Entwicklungs-Adapters für patterns@1 und pattern-check@1 (Lernberatung
// 27.09., V3 „Deutsch-Fallen“). patterns@1 liest die Fehlerliste des Prompts und ordnet die
// Sätze festen, typischen Übertragungsfehlern zu – die Beispiele stammen so immer wörtlich aus der
// Liste. pattern-check@1: `zzno` im Satz → falsch, `zzjson` → kein JSON, sonst richtig.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

const line = (input: string, label: string): string => (new RegExp(`^${label}: (.*)$`, 'm').exec(input)?.[1] ?? '').trim();
const langOf = (input: string): Lang => (/^English$/i.test(line(input, 'Explanation language')) ? 'en' : 'de');

type Trap = { id: string; re: RegExp; title_de: string; title_en: string; rule: Record<Lang, string>; keys: string[]; tasks: string[] };

const TRAPS: readonly Trap[] = [
  {
    id: 'since-present',
    re: /\bsince\b/i,
    title_de: '„since“ mit Gegenwart',
    title_en: '“since” with the present tense',
    rule: { de: 'Seit einem Zeitpunkt bis jetzt: Present Perfect (Continuous), nicht Präsens.', en: 'From a point in the past until now: use the present perfect (continuous), not the present tense.' },
    keys: ['since'],
    tasks: ['Say how long you have worked for your company.', 'Tell a client how long you have used your current CRM system.', 'Explain since when your team has been working remotely.'],
  },
  {
    id: 'make-do',
    re: /\bmak(e|es|ing)\b/i,
    title_de: '„make“ statt „do“',
    title_en: '“make” instead of “do”',
    rule: { de: 'Tätigkeiten und Aufgaben stehen im Englischen meist mit „do“, nicht mit „make“.', en: 'Tasks and activities usually take “do”, not “make”: do homework, do business.' },
    keys: ['make', 'makes', 'making'],
    tasks: ['Describe what you usually do on Monday mornings at work.', 'Ask a colleague for a small favor.'],
  },
  {
    id: 'actual-current',
    re: /\bactual(ly)?\b/i,
    title_de: '„actual“ = „aktuell“',
    title_en: '“actual” used for “current”',
    rule: { de: '„aktuell“ heißt „current“; „actual“ bedeutet „tatsächlich“.', en: 'German “aktuell” means “current”; “actual” means “real”.' },
    keys: ['actual', 'actually'],
    tasks: ['Describe the current status of your biggest project.', 'Tell a customer about your current pricing model.'],
  },
  {
    id: 'become-get',
    re: /\bbec(o|a)me\b/i,
    title_de: '„become“ = „bekommen“',
    title_en: '“become” used for “get”',
    rule: { de: '„bekommen“ heißt „get“ oder „receive“; „become“ bedeutet „werden“.', en: 'German “bekommen” means “get” or “receive”; “become” means “werden”.' },
    keys: ['become', 'became'],
    tasks: ['Say what you received from a customer last week.', 'Tell a colleague when you will get the signed contract.'],
  },
  {
    id: 'look-forward-ing',
    re: /\blook(ing)? forward to\b/i,
    title_de: '„look forward to“ + -ing',
    title_en: '“look forward to” + -ing',
    rule: { de: 'Nach „look forward to“ folgt die -ing-Form.', en: 'After “look forward to”, use the -ing form.' },
    keys: ['look forward to', 'looking forward to'],
    tasks: ['End an email to a new client in a friendly way.', 'Tell your manager what you are looking forward to next quarter.'],
  },
];

const GENERIC: Trap = {
  id: 'word-choice',
  re: /./,
  title_de: 'Wortwahl nach deutschem Muster',
  title_en: 'Word choice copied from German',
  rule: { de: 'Nicht Wort für Wort übersetzen, sondern die feste englische Wendung nehmen.', en: 'Do not translate word for word; use the fixed English phrase instead.' },
  keys: [],
  tasks: ['Describe your job to someone you have just met.', 'Explain a delay to a customer politely.'],
};

export function patternsReply(input: string): string {
  const lang = langOf(input);
  const list = [...input.matchAll(/^- \[[^\]]*\] (.*) => (.*)$/gm)].map((m) => ({ wrong: (m[1] ?? '').trim(), right: (m[2] ?? '').trim() }));
  const used = new Set<string>();
  const out: unknown[] = [];
  for (const trap of TRAPS) {
    const hits = list.filter((m) => !used.has(m.wrong) && trap.re.test(m.wrong));
    if (!hits.length) continue;
    hits.forEach((h) => used.add(h.wrong));
    out.push({ id: trap.id, title_de: trap.title_de, title_en: trap.title_en, rule: trap.rule[lang], examples: hits.slice(0, 2), count: hits.length, keys: trap.keys, tasks: trap.tasks });
  }
  const rest = list.filter((m) => !used.has(m.wrong));
  if (rest.length >= 2 || !out.length) {
    out.push({ id: GENERIC.id, title_de: GENERIC.title_de, title_en: GENERIC.title_en, rule: GENERIC.rule[lang], examples: rest.slice(0, 2), count: Math.max(1, rest.length), keys: GENERIC.keys, tasks: GENERIC.tasks });
  }
  return JSON.stringify({ patterns: out });
}

const NOTE = {
  ok: { de: 'Der Satz ist richtig, und die Falle ist umgangen.', en: 'The sentence is correct, and the trap is avoided.' },
  no: { de: 'Hier steckt noch die typische Falle im Satz.', en: 'The typical trap is still in this sentence.' },
} as const;

export function patternCheckReply(input: string): string {
  const sentence = line(input, 'Learner sentence');
  if (/\bzzjson\b/i.test(sentence)) return 'Sorry, I cannot give a clean answer for that right now.';
  const lang = langOf(input);
  const ok = !/\bzzno\b/i.test(sentence);
  return JSON.stringify(
    ok
      ? { verdict: 'correct', avoided: true, fixed: '', why: NOTE.ok[lang] }
      : { verdict: 'wrong', avoided: false, fixed: sentence.replace(/\bzzno\b\s*/i, '').trim() || 'We have been partners since 2019.', why: NOTE.no[lang] },
  );
}
