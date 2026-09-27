import { registerCannedReply } from './fakeSample';

// Feste, realistische Antworten des Entwicklungs-Adapters für die Vorlagen von Phase 4
// (reading-text, listening-text, writing-prompt, writing-review, reading-check, apply-check).
// Amerikanisches Englisch; deutsche und englische Felder jeweils in ihrer Sprache.
// Sonderwörter im Nutzertext für Fehlerpfade:
// - `zzqx`: erste Antwort verletzt das Schema, der Neuversuch („did not match") ist gültig,
// - `zzjson`: gar kein JSON (→ `invalid_json`).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const uiLang = (input: string): Lang => (/^English$/i.test(line(input, 'Explanation language')) ? 'en' : 'de');
const isRetry = (input: string): boolean => input.includes('did not match the required format');
const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

/** Letzter eingerahmter Nutzertext `<<<TEXT … TEXT>>>` im Prompt. */
function lastFenced(input: string): string {
  const all = [...input.matchAll(/<<<TEXT\n([\s\S]*?)\nTEXT>>>/g)];
  return all.length ? (all[all.length - 1]?.[1] ?? '') : '';
}

// ---------------------------------------------------------------- reading-text@1

const ARTICLE_TEXT = [
  'For years, the four-day workweek sounded like a perk for startups with generous investors. Now a growing number of ordinary companies are testing it, from accounting firms to software vendors. The idea is simple: employees work four days instead of five, keep their full salary and are expected to deliver the same results. What surprises many managers is not that people like the idea, but that the numbers often hold up.',
  'The main reason is focus. When a team knows it has only four days, it becomes much more careful about how it spends them. Long status meetings get shorter or disappear, and people push back on requests that do not really matter. Several pilot programs reported that productivity stayed flat or even rose slightly, while sick days and staff turnover went down. For a small company, keeping experienced people can be worth more than an extra day of output.',
  'Still, the model is not a quick fix. It works best where results can be measured clearly and where work can be planned in advance. Customer support, for example, needs someone available every day, so companies have to stagger schedules and make sure clients never feel the difference. Some firms also found that the pressure simply moved into the remaining days, which left employees tired by Thursday evening.',
  'Experts therefore recommend starting with a trial period of three to six months and agreeing on clear metrics before it begins. Teams should decide together which meetings to cut, which tools to automate and how to handle urgent requests. It also helps to be honest about the downside: if targets are missed, the company can return to the old schedule without anyone losing face.',
  'Whether the four-day week becomes the new normal is still an open question. What the trials have already shown is that many organizations waste a surprising amount of time. Even companies that go back to five days often keep the new habits, such as shorter meetings and fewer internal emails, because they turned out to be valuable on their own.',
].join('\n\n');

const ARTICLE = {
  title: 'Can a Four-Day Week Really Work for Ordinary Companies?',
  topic: 'business',
  topic_de: 'Die Vier-Tage-Woche im Praxistest',
  topic_en: 'The four-day workweek put to the test',
  teaser: 'More and more firms are testing a shorter week, and the results are more interesting than expected.',
  text: ARTICLE_TEXT,
  keypoints: [
    'More ordinary companies are now testing a four-day week with full pay.',
    'Shorter weeks force teams to focus, and productivity often stays the same or rises.',
    'The model is harder for roles like customer support that need daily availability.',
    'Experts recommend a trial period with clear metrics agreed in advance.',
    'Even companies that return to five days often keep the new, more efficient habits.',
  ],
  glossary: [
    { w: 'perk', de: 'Vergünstigung, Extra', def: 'an extra benefit you get from your job' },
    { w: 'hold up', de: 'standhalten, sich bestätigen', def: 'to remain true or valid when tested' },
    { w: 'push back on', de: 'sich widersetzen, zurückweisen', def: 'to resist or refuse a request' },
    { w: 'staff turnover', de: 'Personalfluktuation', def: 'the rate at which employees leave a company' },
    { w: 'quick fix', de: 'schnelle Lösung', def: 'an easy solution that does not solve the real problem' },
    { w: 'stagger', de: 'staffeln, versetzt planen', def: 'to arrange things so they do not all happen at the same time' },
    { w: 'losing face', de: 'das Gesicht verlieren', def: 'being embarrassed in front of others' },
  ],
  questions: [
    {
      q: 'What is the main idea of the text?',
      options: [
        'Four-day weeks only work for startups with rich investors.',
        'Many ordinary companies are testing four-day weeks, often with good results.',
        'Governments are forcing companies to introduce shorter weeks.',
        'Employees want to work fewer hours for less money.',
      ],
      answer: 'Many ordinary companies are testing four-day weeks, often with good results.',
      type: 'gist',
      explain_de: 'Der Text beschreibt, dass immer mehr normale Firmen die Vier-Tage-Woche testen und die Zahlen oft „hold up“.',
      explain_en: 'The text says more and more ordinary companies are testing the model and that the numbers often hold up.',
    },
    {
      q: 'According to the text, why does productivity often stay the same?',
      options: ['Teams become more focused on what really matters.', 'Employees work longer hours on each day.', 'Companies hire more staff.', 'Managers check the work more often.'],
      answer: 'Teams become more focused on what really matters.',
      type: 'detail',
      explain_de: 'Laut Text ist der Hauptgrund der Fokus: Meetings werden kürzer, unwichtige Anfragen werden abgelehnt.',
      explain_en: 'The text says the main reason is focus: meetings get shorter and unimportant requests are rejected.',
    },
    {
      q: 'Why is customer support a special challenge?',
      options: ['It needs someone available every day.', 'Its results cannot be measured at all.', 'Support staff do not want shorter weeks.', 'Customers prefer email to phone calls.'],
      answer: 'It needs someone available every day.',
      type: 'detail',
      explain_de: 'Der Text sagt, dass der Kundendienst jeden Tag erreichbar sein muss – deshalb braucht es versetzte Pläne.',
      explain_en: 'The text says customer support needs someone available every day, so schedules must be staggered.',
    },
    {
      q: 'What can we infer about companies that return to a five-day week?',
      options: ['They still gain something from the trial.', 'They lose most of their employees.', 'They never test new ideas again.', 'They have to pay back their staff.'],
      answer: 'They still gain something from the trial.',
      type: 'inference',
      explain_de: 'Auch Firmen, die zurückwechseln, behalten oft die neuen Gewohnheiten wie kürzere Meetings.',
      explain_en: 'Even companies that go back often keep the new habits, such as shorter meetings.',
    },
  ],
};

function ownTextReply(source: string): string {
  const words = [...new Set((source.toLowerCase().match(/[a-z]{6,}/g) ?? []).filter((w) => !['because', 'without', 'through', 'between'].includes(w)))].slice(0, 7);
  const glossary = (words.length >= 6 ? words : [...words, 'several', 'important', 'different', 'example', 'another', 'company'].slice(0, 6)).map((w) => ({
    w,
    de: `Übersetzung von ${w}`,
    def: `the word "${w}" as it is used in this text`,
  }));
  const sentences = (source.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]/g) ?? [source]).map((s) => s.trim()).filter((s) => s.length > 10);
  const pick = (i: number) => (sentences[i] ?? `Statement number ${i + 1} about the text.`).slice(0, 150);
  const opts = [pick(0), 'The text is mainly about the weather in Europe.', 'The text explains how to cook a traditional meal.', 'The text is a letter to a school principal.'];
  const detail = (i: number) => ({
    q: `Which of these statements appears in the text (${i + 1})?`,
    options: [pick(i), `A statement about space travel, variant ${i + 1}.`, `A statement about a football match, variant ${i + 1}.`, `A statement about a concert, variant ${i + 1}.`],
    answer: pick(i),
    type: i === 3 ? 'inference' : 'detail',
    explain_de: 'Genau diese Aussage steht so im Text, die anderen kommen darin nicht vor.',
    explain_en: 'Exactly this statement is in the text; the others do not appear in it.',
  });
  return JSON.stringify({
    title: 'Your Own Text',
    topic: 'own',
    topic_de: 'Eigener Text',
    topic_en: 'Your own text',
    teaser: `A reading lesson based on the text you added yourself.`,
    keypoints: [pick(0), pick(1), pick(2), pick(3)].map((k) => (k.length >= 10 ? k : `${k} (key point)`)),
    glossary,
    questions: [
      {
        q: 'What is the main topic of the text?',
        options: opts,
        answer: opts[0],
        type: 'gist',
        explain_de: 'Der erste Satz des Texts nennt das Thema direkt.',
        explain_en: 'The first sentence of the text states the topic directly.',
      },
      detail(1),
      detail(2),
      detail(3),
    ],
  });
}

export function readingTextReply(input: string): string {
  if (input.includes('Mode: FROM TEXT')) {
    const src = lastFenced(input);
    if (/zzjson/i.test(src)) return NOT_JSON;
    return ownTextReply(src);
  }
  if (/zzjson/i.test(line(input, 'Topic wish'))) return NOT_JSON;
  const title = /football|soccer/i.test(line(input, 'Topic wish')) ? 'Can a Four-Day Week Really Work, Even in Sports Clubs?' : ARTICLE.title;
  return JSON.stringify({ ...ARTICLE, title });
}

// ---------------------------------------------------------------- listening-text@1

const LISTEN = {
  title: 'A Quick Heads-Up Before the Client Call',
  genre: 'briefing',
  topic_de: 'Kurze Abstimmung vor dem Kundentermin',
  topic_en: 'A short sync before a client call',
  text: "Hi team, just a quick heads-up before tomorrow's call with the logistics client. They signed the pilot in June, and so far the feedback has been positive, but yesterday their finance director sent an email with a few concerns about the price for the second year. So here is the plan. Maria will open the call and give a short recap of the pilot results. We processed almost twelve thousand delivery notes without a single outage, and the average search time went down from four minutes to under thirty seconds. Those are the numbers we want them to remember. After that, I will walk them through the renewal options. Please don't offer any discount on the call itself. If they push for a lower price, we can offer to extend the pilot by one more department instead. That keeps the value high and gives us time. Finally, Tom, could you prepare two or three slides on the new mobile scanning feature? It's not released yet, so let's call it a preview and be careful with any dates. Thanks, everyone, and let's meet at ten to nine to do a short dry run.",
  questions: [
    {
      q: 'What is the main purpose of the message?',
      options: ['To prepare the team for an important client call', 'To announce a new product launch date', 'To cancel the meeting with the client', 'To introduce a new finance director'],
      answer: 'To prepare the team for an important client call',
      type: 'gist',
      explain_de: 'Die Sprecherin gibt dem Team einen Plan für den Kundentermin morgen („quick heads-up before tomorrow’s call“).',
      explain_en: "The speaker gives the team a plan for tomorrow's client call (\"quick heads-up before tomorrow's call\").",
    },
    {
      q: 'What worries the client?',
      options: ['The price for the second year', 'The number of outages', 'The speed of the search', 'The mobile scanning feature'],
      answer: 'The price for the second year',
      type: 'detail',
      explain_de: 'Der Finanzchef hat Bedenken zum Preis für das zweite Jahr geäußert.',
      explain_en: 'The finance director has concerns about the price for the second year.',
    },
    {
      q: 'What should the team do if the client asks for a lower price?',
      options: ['Offer to extend the pilot to another department', 'Give a discount immediately', 'End the call politely', 'Promise a release date for the new feature'],
      answer: 'Offer to extend the pilot to another department',
      type: 'detail',
      explain_de: 'Statt eines Rabatts soll das Team anbieten, den Pilot um eine Abteilung zu erweitern.',
      explain_en: 'Instead of a discount, the team should offer to extend the pilot by one more department.',
    },
    {
      q: 'Why does the speaker want to call the new feature a preview?',
      options: ['Because it is not released yet', 'Because the client already knows it', 'Because it failed in the pilot', 'Because Tom does not like it'],
      answer: 'Because it is not released yet',
      type: 'inference',
      explain_de: 'Die Funktion ist noch nicht veröffentlicht, deshalb soll niemand feste Termine versprechen.',
      explain_en: 'The feature is not released yet, so nobody should promise fixed dates.',
    },
  ],
  vocab: [
    { w: 'heads-up', de: 'Vorwarnung, kurzer Hinweis', def: 'a short warning so someone can prepare' },
    { w: 'recap', de: 'kurze Zusammenfassung', def: 'a short summary of what happened' },
    { w: 'outage', de: 'Ausfall', def: 'a time when a system does not work' },
    { w: 'push for', de: 'auf etwas drängen', def: 'to try hard to get something' },
    { w: 'dry run', de: 'Probedurchlauf', def: 'a practice before the real event' },
  ],
};

export function listeningTextReply(input: string): string {
  const genre = line(input, 'Genre');
  return JSON.stringify({ ...LISTEN, genre: /^(voicemail|briefing|podcast|news|announcement|update)$/.test(genre) ? genre : 'briefing' });
}

// ---------------------------------------------------------------- writing-prompt@1

export function writingPromptReply(input: string): string {
  const own = input.includes('the learner chose the topic below') ? lastFenced(input).trim() : '';
  if (/zzjson/i.test(own)) return NOT_JSON;
  if (own) {
    return JSON.stringify({
      genre: 'opinion',
      level: 'B2+',
      title_de: 'Dein eigenes Thema',
      title_en: 'Your own topic',
      task_en: `Write a short opinion text about "${own.replace(/"/g, "'")}". Explain your view, give two reasons with an example and end with a clear conclusion.`,
      task_de: `Schreibe einen kurzen Meinungstext zu „${own.replace(/[„“"]/g, "'")}“. Erkläre deine Sicht, nenne zwei Gründe mit Beispiel und schließe mit einem klaren Fazit.`,
      words: [100, 160],
      focus_de: 'Verbinde deine Gründe mit Wendungen wie „on top of that“ oder „that said“.',
      focus_en: 'Link your reasons with phrases like "on top of that" or "that said".',
      useful: ['In my view,…', 'On top of that,…', 'That said,…', 'All in all,…'],
    });
  }
  return JSON.stringify({
    genre: 'email',
    level: 'B2+',
    title_de: 'Ein Angebot nachfassen',
    title_en: 'Following up on an offer',
    task_en: 'Write an email to a potential client who has not replied to your offer for two weeks. Remind them politely, add one new argument and suggest a short call.',
    task_de: 'Schreibe eine E-Mail an einen möglichen Kunden, der seit zwei Wochen nicht auf dein Angebot geantwortet hat. Erinnere höflich, bring ein neues Argument und schlage ein kurzes Telefonat vor.',
    words: [90, 140],
    focus_de: 'Nutze höfliche Erinnerungen ohne Druck, z. B. „I just wanted to check in on …“.',
    focus_en: 'Use polite reminders without pressure, e.g. "I just wanted to check in on …".',
    useful: ['I just wanted to check in on…', 'In case it helps,…', 'Would a short call next week work for you?', 'I look forward to hearing from you.'],
  });
}

// ---------------------------------------------------------------- Fehlersuche für Korrekturen

type Found = { orig: string; fix: string; cat: string; topic: string | null; sev: 'minor' | 'major'; why: Record<Lang, string> };

const PATTERNS: Array<{ re: RegExp; fix: (m: string) => string; cat: string; topic: string | null; sev: 'minor' | 'major'; why: Record<Lang, string> }> = [
  {
    re: /\blook forward to (hear|see|meet)\b/i,
    fix: (m) => m.replace(/to (hear|see|meet)/i, (_x, v: string) => `to ${v}${v === 'see' ? 'ing' : 'ing'}`),
    cat: 'grammar',
    topic: 'gerund-inf',
    sev: 'major',
    why: { de: 'Nach „look forward to“ folgt die -ing-Form.', en: 'After "look forward to", use the -ing form.' },
  },
  {
    re: /\bdepends? of\b/i,
    fix: (m) => m.replace(/of$/i, 'on'),
    cat: 'collocation',
    topic: null,
    sev: 'minor',
    why: { de: 'Die feste Verbindung lautet „depend on“.', en: 'The fixed phrase is "depend on".' },
  },
  {
    re: /\binformations\b/i,
    fix: () => 'information',
    cat: 'grammar',
    topic: 'articles',
    sev: 'minor',
    why: { de: '„Information“ ist im Englischen nicht zählbar und hat keinen Plural.', en: '"Information" is uncountable and has no plural.' },
  },
  {
    re: /\bdiscuss about\b/i,
    fix: () => 'discuss',
    cat: 'vocabulary',
    topic: null,
    sev: 'minor',
    why: { de: '„Discuss“ braucht keine Präposition.', en: '"Discuss" takes a direct object, without "about".' },
  },
  {
    re: /\b(summarise|organise|colour|centre|realise|analyse)\b/i,
    fix: (m) => ({ summarise: 'summarize', organise: 'organize', colour: 'color', centre: 'center', realise: 'realize', analyse: 'analyze' })[m.toLowerCase()] ?? m,
    cat: 'spelling',
    topic: null,
    sev: 'minor',
    why: { de: 'Amerikanische Schreibweise.', en: 'American spelling.' },
  },
  {
    re: /\bsince (\d+|two|three|four|five) (years|months|weeks)\b/i,
    fix: (m) => m.replace(/^since/i, 'for'),
    cat: 'grammar',
    topic: 'pres-perf-cont',
    sev: 'major',
    why: { de: 'Für eine Zeitdauer steht „for“, für einen Zeitpunkt „since“.', en: 'Use "for" with a period of time and "since" with a point in time.' },
  },
];

function findErrors(text: string): Found[] {
  const out: Found[] = [];
  for (const p of PATTERNS) {
    const m = p.re.exec(text);
    if (!m) continue;
    out.push({ orig: m[0], fix: p.fix(m[0]), cat: p.cat, topic: p.topic, sev: p.sev, why: p.why });
  }
  return out;
}

function applyFixes(text: string, found: readonly Found[]): string {
  let out = text;
  for (const f of found) out = out.replace(f.orig, f.fix);
  return out.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------- writing-review@1

const REVIEW_TEXTS: Record<Lang, { summary: string; strengths: string[]; next: string }> = {
  de: {
    summary: 'Klarer Aufbau und passender Ton; einige Stellen wirken noch direkt aus dem Deutschen übersetzt.',
    strengths: ['Klare Struktur mit Anliegen und nächstem Schritt', 'Höflicher, professioneller Ton'],
    next: 'Achte beim nächsten Text auf feste Verbindungen mit Präpositionen.',
  },
  en: {
    summary: 'Clear structure and a fitting tone; a few phrases still sound translated from German.',
    strengths: ['Clear structure with a request and a next step', 'Polite, professional tone'],
    next: 'In your next text, pay attention to fixed phrases with prepositions.',
  },
};

export function writingReviewReply(input: string): string {
  const text = lastFenced(input);
  if (/zzjson/i.test(text)) return NOT_JSON;
  const lang = uiLang(input);
  const found = findErrors(text);
  const t = REVIEW_TEXTS[lang];
  const bad = /zzqx/i.test(text) && !isRetry(input);
  return JSON.stringify({
    cefr: 'B2',
    scores: { task: bad ? 9 : 4, grammar: found.some((f) => f.sev === 'major') ? 3 : 4, vocabulary: 4, coherence: 4, register: 3 },
    summary: t.summary,
    strengths: t.strengths,
    errors: found.map((f) => ({ orig: f.orig, fix: f.fix, cat: f.cat, topic: f.topic, sev: f.sev, why: f.why[lang] })),
    improved: applyFixes(text, found).replace(/zzqx/gi, 'this') || 'This text has been improved.',
    upgrades: ['I would appreciate it if you could…', 'at your earliest convenience'],
    phrases: ['Thank you for your patience'],
    next: t.next,
  });
}

// ---------------------------------------------------------------- reading-check@1

export function readingCheckReply(input: string): string {
  const summary = lastFenced(input);
  if (/zzjson/i.test(summary)) return NOT_JSON;
  const lang = uiLang(input);
  const kps = line(input, 'Key points of the text')
    .split(' | ')
    .map((k) => k.trim())
    .filter((k) => k && k !== '(none)');
  const found = findErrors(summary);
  return JSON.stringify({
    score: 4,
    covered: kps.slice(0, 3).map((k) => k.split(' ').slice(0, 6).join(' ')),
    misunderstood: [],
    language: {
      cefr: 'B2',
      errors: found.map((f) => ({ orig: f.orig, fix: f.fix, cat: f.cat, why: f.why[lang] })),
      tips: [lang === 'de' ? 'Nutze Verbindungswörter wie „however“ für Gegensätze.' : 'Use linking words like "however" for contrasts.'],
    },
    feedback: lang === 'de' ? 'Gute Zusammenfassung: Du triffst die Kernaussagen klar und knapp.' : 'Good summary: you capture the main ideas clearly and briefly.',
    model_summary: kps.length ? kps.slice(0, 3).join(' ') : 'The text explains a current development and what it means for companies and employees.',
  });
}

// ---------------------------------------------------------------- apply-check@1

export function applyCheckReply(input: string): string {
  const text = lastFenced(input);
  if (/zzjson/i.test(text)) return NOT_JSON;
  const lang = uiLang(input);
  const chunks = line(input, 'Phrases the learner should try to use')
    .split(' | ')
    .map((c) => c.trim())
    .filter((c) => c && c !== '(none)');
  const found = findErrors(text);
  const lower = text.toLowerCase();
  return JSON.stringify({
    verdict: found.length ? 'ok' : 'good',
    chunks: chunks.map((c) => {
      const used = lower.includes(c.toLowerCase().replace(/^to /, '').replace(/…/g, '').trim());
      return {
        chunk: c,
        used,
        natural: used,
        note: used ? (lang === 'de' ? 'Passt gut in deinen Satz.' : 'This fits your sentence well.') : lang === 'de' ? 'Diese Wendung fehlt noch in deinem Text.' : 'This phrase is still missing from your text.',
      };
    }),
    errors: found.map((f) => ({ orig: f.orig, fix: f.fix, cat: f.cat, topic: f.topic, why: f.why[lang] })),
    improved: applyFixes(text, found) || 'This text has been improved.',
    tip: lang === 'de' ? 'Verbinde deine Gedanken mit „that said“ oder „on top of that“.' : 'Connect your ideas with "that said" or "on top of that".',
  });
}

/** Meldet die festen Antworten von Phase 4 beim Entwicklungs-Adapter an. */
export function registerInputReplies(): void {
  registerCannedReply('reading-text', readingTextReply);
  registerCannedReply('listening-text', listeningTextReply);
  registerCannedReply('writing-prompt', writingPromptReply);
  registerCannedReply('writing-review', writingReviewReply);
  registerCannedReply('reading-check', readingCheckReply);
  registerCannedReply('apply-check', applyCheckReply);
}
