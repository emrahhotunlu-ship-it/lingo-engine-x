import type { SampleFn, SampleOptions, SampleResult } from '../types';
import { coreWord } from '../../domain/course/baseLesson';
import { registerCannedReply } from './fakeSample';
import { roleplayReportReply, roleplayTurnReply, sceneGenReply, turnAnalysisReply } from './cannedSpeak';
import { mailRefineReply, phraseAdaptReply, pitchFeedbackReply, pitchScriptReply } from './cannedBiz';
import { registerCompanionReplies } from './cannedCompanion';
import { registerInputReplies } from './cannedReplies.input';
import { assessReply } from './canned/assess';
import { weeklyReply } from './canned/weekly';
import { registerLearnReplies } from './cannedLearn';

// Feste, realistische Antworten des Entwicklungs-Adapters für die Vorlagen word-lookup@2,
// produce-check@1, card-examples@1, lesson-content@2 und grammar-judge@1 (erkannt an der Kopfzeile). Sie lesen nur die festen Datenzeilen des Prompts.
// Sonderwörter für Fehlerpfade:
// - `zzqx`: erste Antwort verletzt das Schema, der Neuversuch („did not match") ist gültig,
// - `zzjson`: gar kein JSON (→ `invalid_json`).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

type Lang = 'de' | 'en';

function line(input: string, label: string): string {
  const m = new RegExp(`^${label}: (.*)$`, 'm').exec(input);
  return (m?.[1] ?? '').trim();
}

const explanationLang = (input: string): Lang => (/^English$/i.test(line(input, 'Explanation language')) ? 'en' : 'de');
const isRetry = (input: string): boolean => input.includes('did not match the required format');

const NOT_JSON = 'Sorry, I cannot give a clean answer for that right now.';

// ---------------------------------------------------------------- word-lookup@2

type Entry = {
  lemma: string;
  pos: string;
  ipa: string;
  level: string;
  de: string;
  def: string;
  ex: string;
  sense: Record<Lang, string>;
  note: Record<Lang, string>;
};

const LOOKUP: Readonly<Record<string, Entry>> = {
  onboarding: {
    lemma: 'onboarding',
    pos: 'noun',
    ipa: 'ˈɑnˌbɔrdɪŋ',
    level: 'C1',
    de: 'Einarbeitung, Einführung neuer Mitarbeiter',
    def: 'the process of helping new employees or customers get started',
    ex: 'Our onboarding takes two weeks and includes a mentor for every new hire.',
    sense: {
      de: 'Hier ist die geplante Einarbeitung neuer Mitarbeiter im Unternehmen gemeint.',
      en: 'Here it means the planned process of introducing new employees to the company.',
    },
    note: {
      de: 'Oft in „employee onboarding“ oder „customer onboarding“; im Deutschen meist als Fremdwort übernommen.',
      en: 'It is common in "employee onboarding" and "customer onboarding".',
    },
  },
  upsell: {
    lemma: 'upsell',
    pos: 'verb',
    ipa: 'ˈʌpˌsɛl',
    level: 'C1',
    de: 'zusätzlich verkaufen, zum Kauf eines teureren Angebots bewegen',
    def: 'to persuade a customer to buy something more expensive or additional',
    ex: 'The sales team tries to upsell premium support to every new client.',
    sense: {
      de: 'Hier heißt es, einem Kunden zusätzlich ein teureres Angebot zu verkaufen.',
      en: 'Here it means persuading a customer to buy a more expensive or extra product.',
    },
    note: {
      de: 'Das Gegenteil ist „downsell“; das Nomen heißt ebenfalls „upsell“ oder „upselling“.',
      en: 'The opposite is "downsell", and the noun is also "upsell" or "upselling".',
    },
  },
  leverage: {
    lemma: 'leverage',
    pos: 'verb',
    ipa: 'ˈlɛvərɪdʒ',
    level: 'C1',
    de: 'nutzen, einsetzen, ausschöpfen',
    def: 'to use something you have in order to gain an advantage',
    ex: 'We can leverage our existing contacts to enter the Austrian market.',
    sense: {
      de: 'Hier bedeutet es, vorhandene Stärken gezielt für einen Vorteil zu nutzen.',
      en: 'Here it means using existing strengths on purpose to gain an advantage.',
    },
    note: {
      de: 'Im Business-Englisch sehr häufig, oft mit Objekt: „leverage our network“.',
      en: 'It is very common in business English and usually takes a direct object.',
    },
  },
  zzqx: {
    lemma: 'zzqx',
    pos: 'other',
    ipa: 'ˈzɪks',
    level: 'C2',
    de: 'Testwort',
    def: 'a made-up word that the app uses for testing',
    ex: 'The word zzqx only exists in our test data.',
    sense: {
      de: 'Ein erfundenes Wort, mit dem die App ihre Nachschlage-Funktion prüft.',
      en: 'A made-up word that the app uses to test its lookup feature.',
    },
    note: {
      de: 'Es kommt nur in Testdaten vor und hat keine echte Bedeutung.',
      en: 'It only appears in test data and has no real meaning.',
    },
  },
};

function genericEntry(word: string): Entry {
  const lemma = word.toLowerCase();
  return {
    lemma,
    pos: 'other',
    ipa: '',
    level: 'B2',
    de: 'je nach Zusammenhang',
    def: 'a word used with a specific meaning in this sentence',
    ex: `She explained what "${lemma}" means in the meeting.`,
    sense: {
      de: `Hier bezeichnet „${lemma}“ etwas, das im Satz eine wichtige Rolle spielt.`,
      en: `Here, "${lemma}" refers to something that plays a key role in the sentence.`,
    },
    note: {
      de: 'Achte darauf, in welchem Zusammenhang das Wort steht.',
      en: 'Pay attention to the context in which the word appears.',
    },
  };
}

export function wordLookupReply(input: string): string {
  const word = line(input, 'Word');
  const key = word.toLowerCase();
  const lang = explanationLang(input);
  if (key === 'zzjson') return NOT_JSON;
  if (key === 'zzqx' && !isRetry(input)) return JSON.stringify({ lemma: 'zzqx', pos: 'noun', level: 'Z9' });
  const e = LOOKUP[key] ?? genericEntry(word || 'word');
  const { sense, note, ...rest } = e;
  return JSON.stringify({ ...rest, sense: sense[lang], note: note[lang] });
}

// ---------------------------------------------------------------- produce-check@1

const stem = (w: string): string => {
  const s = w.replace(/(ies|es|s|ed|ing|e|y)$/, '');
  return s.length >= 3 ? s : w;
};

/** Grob: Jedes Wort des Ziels (ab 3 Buchstaben) kommt als Wortstamm im Satz vor. */
function usesTarget(sentence: string, target: string): boolean {
  const low = sentence.toLowerCase();
  const words = target.toLowerCase().match(/[a-z]+/g) ?? [];
  const relevant = words.filter((w) => w.length >= 3);
  return relevant.length > 0 && relevant.every((w) => low.includes(stem(w)));
}

const WHY: Record<'correct' | 'minor' | 'wrong', Record<Lang, string>> = {
  correct: {
    de: 'Das Zielwort ist richtig und natürlich verwendet, und der Satz ist grammatisch korrekt.',
    en: 'You used the target word correctly and naturally, and the sentence is grammatical.',
  },
  minor: {
    de: 'Das Zielwort ist richtig verwendet. Ein Satz beginnt aber mit einem Großbuchstaben und endet mit einem Punkt.',
    en: 'You used the target word correctly. A sentence starts with a capital letter and ends with a period.',
  },
  wrong: {
    de: 'Das Zielwort fehlt in deinem Satz. Baue es ein, damit die Übung zählt.',
    en: 'Your sentence does not use the target word. Include it so the exercise counts.',
  },
};

export function produceCheckReply(input: string): string {
  const target = /^Target (?:word|phrase): (.*) \(meaning: /m.exec(input)?.[1]?.trim() ?? '';
  const sentence = line(input, 'Learner sentence');
  const lang = explanationLang(input);
  if (/\bzzjson\b/i.test(sentence)) return NOT_JSON;
  if (/\bzzqx\b/i.test(sentence) && !isRetry(input)) return JSON.stringify({ verdict: 'maybe', usesTarget: 'yes' });
  const uses = usesTarget(sentence, target) || /\bzzqx\b/i.test(sentence);
  const tidy = /^[A-Z]/.test(sentence) && /[.!?]$/.test(sentence);
  const verdict = !uses ? 'wrong' : tidy ? 'correct' : 'minor';
  const fixed =
    verdict === 'minor' ? `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}${/[.!?]$/.test(sentence) ? '' : '.'}` : sentence || '—';
  return JSON.stringify({ verdict, usesTarget: uses, fixed, why: WHY[verdict][lang], better: '' });
}

// ---------------------------------------------------------------- card-examples@1

/** Drei Sätze mit dem Wort (Grundform, ohne „to "). `zzjson` im Wort → kein JSON. */
export function cardExamplesReply(input: string): string {
  const word = line(input, 'Word').replace(/^to\s+/i, '').trim() || 'word';
  if (/zzjson/i.test(word)) return NOT_JSON;
  return JSON.stringify({
    examples: [
      `Our team tried to ${word} the new plan before the deadline.`,
      `It is not always easy to ${word} people in a short meeting.`,
      `She had to ${word} her manager with clear numbers and examples.`,
    ],
  });
}

// ---------------------------------------------------------------- lesson-content@2

/**
 * Eine vollständige Lektion aus den Zeilen des Prompts: die Zielwörter genau wie vorgegeben,
 * jedes Wort in einer Dialogzeile, Fragen in beiden Sprachen, vier Aufgaben (mc, gap,
 * transform, correct) zum angegebenen Thema. `zzjson` im Thema → kein JSON.
 */
export function lessonContentReply(input: string): string {
  const topic = line(input, 'Grammar topic id');
  if (/zzjson/i.test(topic)) return NOT_JSON;
  const ui: Lang = /^en\b/.test(line(input, 'UI language')) ? 'en' : 'de';
  const pairs = line(input, 'Target words \\(keep exactly, in this order\\)')
    .split('; ')
    .map((p) => {
      const i = p.indexOf(' = ');
      return i < 0 ? { en: p.trim(), de: p.trim() } : { en: p.slice(0, i).trim(), de: p.slice(i + 3).trim() };
    })
    .filter((w) => w.en);
  const bare = coreWord;
  const speakers = ['Mia', 'Tom'];
  const wordLines = pairs.map((w, i) => ({ sp: speakers[i % 2] ?? 'Mia', en: `For this project we have to talk about ${bare(w.en)} today.`, de: `Für dieses Projekt müssen wir heute über „${w.de}“ sprechen.` }));
  const extra = [
    { sp: 'Mia', en: 'I am going to send the summary tomorrow morning.', de: 'Ich werde die Zusammenfassung morgen früh schicken.' },
    { sp: 'Tom', en: 'Great, and I will call the customer after lunch.', de: 'Super, und ich rufe den Kunden nach dem Mittagessen an.' },
    { sp: 'Mia', en: 'The meeting starts at ten, so we are meeting at the office.', de: 'Das Meeting beginnt um zehn, also treffen wir uns im Büro.' },
    { sp: 'Tom', en: 'Perfect. I think everything will be ready by Friday.', de: 'Perfekt. Ich glaube, bis Freitag ist alles fertig.' },
  ];
  const lines = [...wordLines, ...extra].slice(0, 14);
  while (lines.length < 8) lines.push({ ...extra[lines.length % extra.length]! });
  const qDe = { q: 'Wann schickt Mia die Zusammenfassung?', options: ['Morgen früh', 'Heute Abend', 'Am Freitag', 'Nach dem Mittagessen'], answer: 'Morgen früh' };
  const qEn = { q: 'When is Mia going to send the summary?', options: ['Tomorrow morning', 'This evening', 'On Friday', 'After lunch'], answer: 'Tomorrow morning' };
  const q2De = { q: 'Was macht Tom nach dem Mittagessen?', options: ['Er ruft den Kunden an', 'Er schreibt einen Bericht', 'Er fährt nach Hause', 'Er bucht eine Reise'], answer: 'Er ruft den Kunden an' };
  const q2En = { q: 'What will Tom do after lunch?', options: ['He will call the customer', 'He will write a report', 'He will go home', 'He will book a trip'], answer: 'He will call the customer' };
  const question = (a: typeof qDe, b: typeof qEn) => {
    const [cur, alt] = ui === 'de' ? [a, b] : [b, a];
    return { ...cur, lang: ui, q_alt: alt.q, options_alt: alt.options, answer_alt: alt.answer };
  };
  const tasks = [
    { topic, type: 'mc', prompt: 'The new system ___ ready next week, the plan is fixed.', answer: 'is going to be', accepted: [], options: ['is going to be', 'be', 'being', 'been'], hint: '', expl: 'Ein fester Plan für die Zukunft wird mit going to ausgedrückt.', expl_en: 'A fixed plan for the future is expressed with going to.' },
    { topic, type: 'gap', prompt: 'Look at those clouds. I think it ___ this afternoon.', answer: 'will rain', accepted: ["'ll rain"], options: null, hint: '(rain)', expl: 'Eine Vermutung über die Zukunft wird mit will ausgedrückt.', expl_en: 'A guess about the future is expressed with will.' },
    { topic, type: 'transform', prompt: 'We plan to visit the fair in May. → We ___ the fair in May.', answer: 'are going to visit', accepted: ["'re going to visit"], options: null, hint: '', expl: 'Eine Absicht wird mit be going to und der Grundform gebildet.', expl_en: 'An intention is formed with be going to and the base form.' },
    { topic, type: 'correct', prompt: 'I will meet the client tomorrow at ten, it is already in my calendar.', answer: 'I am meeting the client tomorrow at ten, it is already in my calendar.', accepted: [], options: null, hint: '', expl: 'Eine feste Verabredung steht im Present Continuous, nicht mit will.', expl_en: 'A fixed arrangement uses the present continuous, not will.' },
  ];
  const must = pairs.slice(0, 3).map((w) => w.en);
  return JSON.stringify({
    words: pairs.map((w) => ({ en: w.en, de: w.de, pos: 'phrase', def: `a useful expression for work: ${bare(w.en)}`, ex: `For this project we have to talk about [${bare(w.en)}] today.` })),
    dialogue: { title: 'Planning the next steps', lines },
    questions: [question(qDe, qEn), question(q2De, q2En)],
    tasks,
    output: {
      de: 'Schreibe einer Kollegin, was ihr nächste Woche geplant habt und was du vermutest.',
      en: 'Write to a colleague about what you have planned for next week and what you expect.',
      mustUse: must,
    },
  });
}

// ---------------------------------------------------------------- grammar-judge@1

const JUDGE_WHY: Record<Lang, string> = {
  de: 'Deine Antwort ist grammatisch richtig und passt zur Aufgabe, auch wenn sie anders gebaut ist.',
  en: 'Your answer is grammatical and fits the task, even though it is built differently.',
};

/** Urteil „richtig, auch akzeptabel" über jede frei formulierte Antwort. `zzjson` in der Antwort → kein JSON. */
export function grammarJudgeReply(input: string): string {
  const given = line(input, 'Learner answer');
  if (/\bzzjson\b/i.test(given)) return NOT_JSON;
  return JSON.stringify({ verdict: 'correct', acceptable: true, corrected: given || '—', why: JUDGE_WHY[explanationLang(input)] });
}

/** Meldet die festen Antworten beim Entwicklungs-Adapter an. */
export function registerCannedReplies(): void {
  registerCannedReply('word-lookup', wordLookupReply);
  registerCannedReply('produce-check', produceCheckReply);
  registerCannedReply('card-examples', cardExamplesReply);
  registerCannedReply('lesson-content', lessonContentReply);
  registerCannedReply('grammar-judge', grammarJudgeReply);
  // Phase 3 – Sprechen und Business
  registerCannedReply('roleplay-turn', roleplayTurnReply);
  registerCannedReply('turn-analysis', turnAnalysisReply);
  registerCannedReply('roleplay-report', roleplayReportReply);
  registerCannedReply('scene-gen', sceneGenReply);
  registerCannedReply('mail-refine', mailRefineReply);
  registerCannedReply('phrase-adapt', phraseAdaptReply);
  registerCannedReply('pitch-script', pitchScriptReply);
  registerCannedReply('pitch-feedback', pitchFeedbackReply);
  // Phase 5: companion-chat, translate, preply-prep, preply-import
  registerCompanionReplies();
  // Phase 4: reading-text, listening-text, writing-prompt, writing-review, reading-check, apply-check
  registerInputReplies();
  // Phase 6
  registerCannedReply('assess', assessReply);
  registerCannedReply('weekly-report', weeklyReply);
  // Prüfbericht: word-gen, lesson-production, grammar-items, mnemonic
  registerLearnReplies();
}

// ---------------------------------------------------------------- Aufrufprotokoll

export type SampleCall = {
  id: string | null;
  tier: Claude.sample.ModelTier;
  input: string;
  /** Phase 5: `cache`-Option des Aufrufs und Anzahl der Schritte (1 = Prompt). */
  cache?: Claude.sample.SampleOptions['cache'];
  turns?: number;
  /** Rolle des ersten und letzten Schritts (nur bei Schrittlisten). */
  roles?: string[];
};

/** Kennung der Vorlage aus der Kopfzeile `[id@version]`. */
export function templateIdOf(input: Claude.sample.SampleInput): string | null {
  const text = typeof input === 'string' ? input : (input[0]?.content ?? '');
  return /^\[([a-z0-9-]+)@\d+\]/.exec(text)?.[1] ?? null;
}

/**
 * Hülle um das nachgebildete `sample`: protokolliert jeden Aufruf (`control.sampleCalls`) und
 * verzögert ihn auf Wunsch (`sampleDelayMs`, z. B. für den Langsam-Hinweis im E2E-Test).
 */
export function withCallLog(inner: SampleFn, calls: SampleCall[], delayMs: number | (() => number) = 0, failOnce: Record<string, Claude.sample.SampleErrorCode> = {}): SampleFn {
  const delayOf = () => (typeof delayMs === 'function' ? delayMs() : delayMs);
  const wait = (signal: AbortSignal | undefined): Promise<void> =>
    delayOf() <= 0
      ? Promise.resolve()
      : new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          }, delayOf());
          const onAbort = () => {
            clearTimeout(timer);
            reject({ code: 'cancelled', message: 'aborted while delayed' });
          };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
  const log = (input: Claude.sample.SampleInput, options?: SampleOptions) => {
    const text = typeof input === 'string' ? input : input.map((t) => t.content).join('\n\n');
    calls.push({
      id: templateIdOf(input),
      tier: options?.modelTier ?? 'default',
      input: text,
      cache: options?.cache,
      turns: typeof input === 'string' ? 1 : input.length,
      roles: typeof input === 'string' ? [] : input.map((t) => t.role),
    });
  };
  /** Einmaliger Fehler je Vorlage (Phase 5: Fehlerpfade im E2E-Test). */
  const failed = (input: Claude.sample.SampleInput, signal: AbortSignal | undefined): Promise<never> | null => {
    const id = templateIdOf(input);
    const code = id ? failOnce[id] : undefined;
    if (!id || !code) return null;
    delete failOnce[id];
    return wait(signal).then(() => Promise.reject({ code, message: `simulated ${code}`, ...(code === 'upstream_error' ? { text: 'Kurzer Anfang der Antwort' } : {}) }));
  };
  const sample = ((input: Claude.sample.SampleInput, options?: SampleOptions): Promise<SampleResult> => {
    log(input, options);
    return failed(input, options?.signal) ?? wait(options?.signal).then(() => inner(input, options));
  }) as SampleFn;
  const json = <T,>(input: Claude.sample.SampleInput, options?: SampleOptions): Promise<T> => {
    log(input, options);
    return failed(input, options?.signal) ?? wait(options?.signal).then(() => inner.json<T>(input, options));
  };
  return Object.freeze(Object.assign(sample, { json, limits: () => inner.limits() }));
}
