// Feste Antworten des Entwicklungs-Adapters für die Business-Vorlagen mail-refine@1,
// phrase-adapt@1, pitch-script@1 und pitch-feedback@1 (Plan §6.4). Deterministisch, erkannt an
// den festen Datenzeilen; `zzjson` → kein JSON, `zzqx` → erste Antwort schemawidrig.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';
const isRetry = (input: string): boolean => input.includes('did not match the required format');

function explLang(input: string): Lang {
  const m = /Explanation language[^:\n]*: (German|English)/.exec(input);
  return m?.[1] === 'English' ? 'en' : 'de';
}

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const decap = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);

// ---------------------------------------------------------------- mail-refine@1

export function mailRefineReply(input: string): string {
  const de = explLang(input) === 'de';
  const segs = [...input.matchAll(/^\[(\d+)\] (.*)$/gm)].map((m) => ({ i: Number(m[1]), text: (m[2] ?? '').trim() }));
  if (segs.some((s) => /zzjson/i.test(s.text))) return NOT_JSON;
  if (segs.some((s) => /zzqx/i.test(s.text)) && !isRetry(input)) return JSON.stringify({ segments: [{ i: 0, status: 'great' }] });
  const out = segs.map((s) => {
    const words = s.text.split(/\s+/).filter(Boolean).length;
    if (words < 4 || /^(dear|hi|hello|best|kind regards|thanks|thank you)\b/i.test(s.text)) return { i: s.i, status: 'ok', options: [] };
    const core = decap(s.text.replace(/[.!?]+$/, ''));
    return {
      i: s.i,
      status: /\bmust\b/i.test(s.text) ? 'wrong' : 'stiff',
      options: [
        { text: `I wanted to let you know that ${core}.`, register: 'formal', why: de ? 'Kündigt die Nachricht höflich an.' : 'Introduces the news politely.', phrase: 'I wanted to let you know', de: 'ich wollte Ihnen mitteilen', def: 'a polite way to share news' },
        { text: `Just a quick note: ${core}.`, register: 'informal', why: de ? 'Kurz und freundlich.' : 'Short and friendly.', phrase: 'Just a quick note', de: 'nur eine kurze Nachricht', def: 'an informal way to start a short message' },
      ],
    };
  });
  return JSON.stringify({ segments: out, tone: de ? 'Freundlich, an einigen Stellen zu direkt für diesen Empfänger.' : 'Friendly, but too direct for this recipient in places.' });
}

// ---------------------------------------------------------------- phrase-adapt@1

export function phraseAdaptReply(input: string): string {
  const de = explLang(input) === 'de';
  if (/zzjson/i.test(line(input, 'Their situation'))) return NOT_JSON;
  return JSON.stringify({
    phrases: [
      { en: 'what we can offer instead is', de: 'was wir stattdessen anbieten können, ist', def: 'introduces an alternative offer', ex: 'What we can offer instead is a pilot with your finance team.', why: de ? 'Lenkt sofort auf eine Lösung.' : 'Moves straight to a solution.' },
      { en: 'I want to be upfront with you', de: 'ich möchte offen zu Ihnen sein', def: 'signals that you will speak honestly', ex: 'I want to be upfront with you about the timeline.', why: de ? 'Schafft Vertrauen vor der schlechten Nachricht.' : 'Builds trust before the bad news.' },
      { en: 'would it help if', de: 'würde es helfen, wenn', def: 'suggests an option as a question', ex: 'Would it help if we split the rollout into two phases?', why: de ? 'Macht aus dem Nein eine Frage.' : 'Turns the no into a question.' },
    ],
  });
}

// ---------------------------------------------------------------- pitch-script@1

export function pitchScriptReply(input: string): string {
  if (/zzjson/i.test(line(input, 'Slide content'))) return NOT_JSON;
  return JSON.stringify({
    points: ['Cloud archive for small businesses', 'Setup in one day', 'Retention rules built in'],
    script: [
      { en: "Let me start with the problem we're solving.", signpost: true },
      { en: 'Small businesses still archive invoices on paper or in shared folders.', signpost: false },
      { en: 'Our cloud archive changes that with a setup that takes one day.', signpost: false },
      { en: 'Moving on to compliance, retention rules are built in from day one.', signpost: true },
      { en: 'To wrap up, you get a safe archive without a single server.', signpost: true },
    ],
    keyPhrases: [
      { en: 'Let me start with', de: 'Ich beginne mit', def: 'a way to open a talk', ex: "Let me start with the problem we're solving." },
      { en: 'built in from day one', de: 'von Anfang an eingebaut', def: 'included from the very start', ex: 'Retention rules are built in from day one.' },
      { en: 'To wrap up', de: 'Zum Abschluss', def: 'a way to close a talk', ex: 'To wrap up, you get a safe archive.' },
    ],
    seconds: 60,
  });
}

// ---------------------------------------------------------------- pitch-feedback@1

export function pitchFeedbackReply(input: string): string {
  const de = explLang(input) === 'de';
  const attempt = line(input, 'Learner attempt \\(this is the "learner sentence"\\)');
  if (/zzjson/i.test(attempt)) return NOT_JSON;
  const points = line(input, 'Key points of the slide')
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean);
  const lower = attempt.toLowerCase();
  const coverage = points.map((p) => {
    const hit = p
      .toLowerCase()
      .split(/\s+/)
      .some((w) => w.length > 4 && lower.includes(w));
    return { point: p, covered: hit, note: hit ? '' : de ? 'Dieser Punkt fehlt noch.' : 'This point is still missing.' };
  });
  const must = /\bmust\s+(\w+)/i.exec(attempt);
  const layers = must
    ? {
        verdict: 'minor',
        english: true,
        errors: [{ wrong: must[0], right: `need to ${must[1] ?? ''}`.trim(), cat: 'modals-deduction', why: de ? '„must“ klingt vor Kunden wie ein Befehl.' : '"must" sounds like an order in front of clients.' }],
      }
    : { verdict: 'clean', english: true, errors: [] };
  return JSON.stringify({
    coverage,
    ...layers,
    upgraded: "Let me start with the problem we're solving: small businesses still archive invoices on paper.",
    changes: [{ from: attempt.split(/\s+/).slice(0, 3).join(' ') || 'start', to: 'Let me start with', why: de ? 'Eine klare Überleitung führt das Publikum.' : 'A clear signpost guides the audience.' }],
    lands: de ? 'Mit dem Problem zu beginnen, holt das Publikum sofort ab.' : 'Starting with the problem gets the audience on board at once.',
    chunks: [{ en: 'Let me start with', de: 'Ich beginne mit', def: 'a way to open a talk', kind: 'frame', register: 'neutral', why: de ? 'Klassische Eröffnung einer Präsentation.' : 'A classic way to open a presentation.' }],
    targets: [],
  });
}
