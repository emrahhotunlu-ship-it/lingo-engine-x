import { registerCannedReply } from './fakeSample';

// Feste Antworten des Entwicklungs-Adapters für Phase 5 (Plan §6.5): companion-chat@1,
// translate@1, preply-prep@1, preply-import@1. Nur Entwicklung und Tests – nie im Build
// (check-platform.mjs sperrt die Marker). Testmarker:
// - Begleiter: `zzlong` (≈ 3.000 Zeichen, Scroll-Test), `zzen` (englische Antwort, Sprachtreue).
//   Enthält die Einleitung die Schutzregel („has NOT checked"), endet die Antwort mit
//   `[no-solution]`, sonst mit `[solution-ok]` – so prüft der E2E-Test das Schwärzen.
// - Übersetzer: `zzsame` (erste Antwort ohne Alternativen → Schemafehler → Neuversuch).
// - Import: `zzempty` (alles leer).

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const isRetry = (input: string): boolean => input.includes('did not match the required format');
const langOf = (name: string): Lang => (/^English$/i.test(name) ? 'en' : 'de');

// ---------------------------------------------------------------- companion-chat@1

function lastUserTurn(raw: unknown, flat: string): string {
  if (Array.isArray(raw)) {
    const turns = raw as Array<{ role?: unknown; content?: unknown }>;
    const last = turns[turns.length - 1];
    if (last && typeof last.content === 'string') return last.content;
  }
  return flat;
}

function leadOf(raw: unknown, flat: string): string {
  if (Array.isArray(raw)) {
    const first = (raw as Array<{ content?: unknown }>)[0];
    if (first && typeof first.content === 'string') return first.content;
  }
  return flat;
}

const LONG_DE =
  'Hier ist eine ausführliche Erklärung mit vielen Beispielen, damit du den Unterschied wirklich sicher beherrschst. ';

export function companionChatReply(flat: string, raw?: unknown): string {
  const lead = leadOf(raw, flat);
  const msg = lastUserTurn(raw, flat);
  const guarded = lead.includes('has NOT checked');
  const end = guarded ? '[no-solution]' : '[solution-ok]';
  const english = /Write your explanations in English/.test(lead);
  if (/zzen/i.test(msg) && !english) {
    return `Sure! **Leverage** means using something you already have to get an advantage. For example: "We can leverage our network to find new clients." It is very common in business English. ${end}`;
  }
  if (/zzlong/i.test(msg)) {
    const body = Array.from({ length: 28 }, (_, i) => `${i + 1}. ${LONG_DE}`).join('\n\n');
    return `### Ausführlich\n\n${body}\n\n${end}`;
  }
  if (english) {
    return `**Leverage** means using what you already have to gain an advantage.\n\n- "We can **leverage** our network to enter new markets."\n- "She leveraged her experience in the negotiation."\n\nIt usually takes a direct object. ${end}`;
  }
  return `**leverage** heißt hier *nutzen* oder *einsetzen*, um einen Vorteil zu erzielen.\n\n- „We can **leverage** our network to enter new markets.“\n- „She leveraged her experience in the negotiation.“\n\nIm Business-Englisch steht meist ein direktes Objekt dahinter. ${end}`;
}

// ---------------------------------------------------------------- translate@1

function blockText(input: string): string {
  const m = /<<<\n([\s\S]*?)\n>>>/.exec(input);
  return (m?.[1] ?? '').trim();
}

export function translateReply(input: string): string {
  const text = blockText(input);
  const fromLine = line(input, 'From');
  const from: Lang = /detect/i.test(fromLine) ? (/[äöüß]|\b(der|die|das|und|nicht|ist)\b/i.test(text) ? 'de' : 'en') : langOf(fromLine);
  const register = line(input, 'Register') || 'neutral';
  const notesLang = langOf(line(input, 'Notes language'));
  const same = /zzsame/i.test(text) && !isRetry(input);
  const note = (de: string, en: string) => (notesLang === 'de' ? de : en);
  if (from === 'de') {
    const main = /budget/i.test(text) ? 'We need to approve the budget.' : 'Here is the translation of your text in natural American English.';
    return JSON.stringify({
      source: 'de',
      translation: main,
      register,
      alternatives: same ? [] : [
        { text: 'The budget needs to be signed off.', register: 'formal', note: note('passiv, typisch für E-Mails an die Geschäftsführung', 'passive, typical for emails to management') },
        { text: 'We have to okay the budget.', register: 'casual', note: note('locker, nur unter Kollegen', 'casual, only among colleagues') },
      ],
      notes: [note('„freigeben“ heißt hier approve oder sign off, nicht release.', '"freigeben" means approve or sign off here, not release.')],
      terms: [{ en: 'to sign off on', de: 'freigeben' }],
    });
  }
  return JSON.stringify({
    source: 'en',
    translation: 'Das ist die Übersetzung deines Textes auf Deutsch.',
    register,
    alternatives: [
      { text: 'Hier ist die Übersetzung Ihres Textes.', register: same ? register : 'formal', note: note('mit Sie, für Kunden', 'formal address, for customers') },
      { text: 'Hier ist dein Text auf Deutsch.', register: 'casual', note: note('locker', 'casual') },
    ],
    notes: [],
    terms: [],
  });
}

// ---------------------------------------------------------------- preply-prep@1

export function preplyPrepReply(input: string): string {
  const lang = langOf(line(input, 'Explanation language'));
  const block = /Real recent mistakes of the learner \(wrong → correct\):\n([\s\S]*?)\nWords to use actively/.exec(input)?.[1] ?? '';
  const errors = block
    .split('\n')
    .map((l) => /^- (.*) → (.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => !!m)
    .slice(0, 2)
    .map((m) => ({ mistake: (m[1] ?? '').trim(), fix: (m[2] ?? '').trim(), note: lang === 'de' ? 'Achte hier auf die richtige Form.' : 'Watch the correct form here.' }));
  const de = lang === 'de';
  return JSON.stringify({
    title: de ? 'Einwände souverän behandeln' : 'Handling objections with confidence',
    goal_en: 'Handle three typical objections to a cloud DMS without hesitating.',
    goal_x: de ? 'Drei typische Einwände gegen ein Cloud-DMS ohne Zögern entkräften.' : 'Handle three typical objections to a cloud DMS without hesitating.',
    warmup: ['What was the hardest question a customer asked you this month?', 'How do you usually start a sales call?', 'Which objection do you hear most often?'],
    talk: ['Describe a deal you lost and what you would do differently.', 'How do you explain data security to a skeptical CFO?', 'Role-play: the customer says the price is too high.'],
    say: [
      'I understand your concern, and that is exactly why we offer a pilot.',
      'Would it help if we started with one department?',
      'Let me walk you through how other customers solved this.',
      'If you had the numbers in one place, would that change your view?',
    ],
    watch: errors,
    message: 'Hi! In our next lesson I would like to practice handling objections in sales calls. Could we do a short role-play where you are a skeptical customer? Please correct my verb forms.',
  });
}

// ---------------------------------------------------------------- preply-import@1

export function preplyImportReply(input: string): string {
  const lang = langOf(line(input, 'Explanation language'));
  const de = lang === 'de';
  if (/zzempty/i.test(blockText(input))) {
    return JSON.stringify({ title: de ? 'Leere Stunde' : 'Empty lesson', summary: '', corrections: [], tasks: [], words: [], homework: [] });
  }
  return JSON.stringify({
    title: de ? 'Stunde: Präpositionen und Vorlieben' : 'Lesson: prepositions and preferences',
    summary: de ? 'Wir haben Verben mit festen Präpositionen und Vorlieben geübt.' : 'We practiced verbs with fixed prepositions and talking about preferences.',
    corrections: [
      { wrong: 'It depends of the budget.', right: 'It depends on the budget.', topic: 'prepositions', why: de ? 'Nach „depend“ steht immer „on“.' : 'The verb "depend" always takes "on".' },
      { wrong: 'I am agree with you.', right: 'I agree with you.', topic: 'other', why: de ? '„agree“ ist ein Verb, kein Adjektiv.' : '"Agree" is a verb, not an adjective.' },
    ],
    tasks: [
      {
        type: 'gap',
        prompt: 'It depends ___ the budget.',
        answer: 'on',
        accepted: ['on'],
        options: [],
        topic: 'prepositions',
        explanation_de: 'Das Verb „depend“ verlangt die Präposition „on“.',
        explanation_en: 'The verb "depend" always takes the preposition "on".',
      },
      {
        type: 'mc',
        prompt: 'I ___ with your proposal.',
        answer: 'agree',
        accepted: [],
        options: ['agree', 'am agree', 'agreeing', 'am agreed'],
        topic: 'other',
        explanation_de: 'Es heißt „I agree“ – ohne „am“, denn „agree“ ist ein Verb.',
        explanation_en: 'We say "I agree" without "am" because "agree" is a verb.',
      },
    ],
    words: [
      { en: 'would rather', de: 'lieber wollen', pos: 'phrase', ex: 'I would rather start with a small pilot.', fromLesson: true },
      { en: 'bottleneck', de: 'Engpass', pos: 'noun', ex: 'The approval process is our biggest bottleneck.', fromLesson: true },
      { en: 'to leverage', de: 'nutzen', pos: 'verb', ex: 'We should use our network.', fromLesson: false },
    ],
    homework: [de ? 'Schreibe fünf Sätze mit „would rather“.' : 'Write five sentences with "would rather".'],
  });
}

/** Meldet die festen Antworten der Phase 5 beim Entwicklungs-Adapter an. */
export function registerCompanionReplies(): void {
  registerCannedReply('companion-chat', companionChatReply);
  registerCannedReply('translate', translateReply);
  registerCannedReply('preply-prep', preplyPrepReply);
  registerCannedReply('preply-import', preplyImportReply);
}
