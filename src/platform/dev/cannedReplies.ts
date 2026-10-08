import type { SampleFn, SampleOptions, SampleResult } from '../types';
import { registerCannedReply } from './fakeSample';
import { roleplayReportReply, roleplayTurnReply, turnAnalysisReply } from './cannedSpeak';
import { registerCompanionReplies } from './cannedCompanion';
import { assessReply } from './canned/assess';
import { weeklyReply } from './canned/weekly';
import { registerLearnReplies } from './cannedLearn';
import { comboCheckReply } from './canned/comboCheck';
import { listenQReply } from './canned/listenQ';
import { repairCheckReply } from './canned/repairCheck';
import { patternCheckReply, patternsReply } from './canned/patterns';
import { registerP7Replies } from './canned/p7';
import { registerNbReplies } from './canned/nb';
import { registerLp2P2Replies } from './canned/lp2/p2';
import { registerLp2P5Replies } from './canned/lp2/p5';
import { registerLp2P6Replies } from './canned/lp2/p6';
import { registerLp3P26Replies } from './canned/lp3/p26';
import { registerLp3P46Replies } from './canned/lp3/p46';
import { registerLp3P47Replies } from './canned/lp3/p47';
import { registerLp3P51Replies } from './canned/lp3/p51';
import { registerTeacherFeedbackReply } from './canned/teacherFeedback';

// Feste, realistische Antworten des Entwicklungs-Adapters für die Vorlagen word-lookup@2,
// produce-check@1, card-examples@2 und grammar-judge@1 (erkannt an der Kopfzeile). Sie lesen nur die festen Datenzeilen des Prompts.
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

// ---------------------------------------------------------------- card-examples@2

/** Drei Sätze mit dem Wort (Grundform, ohne „to "). `zzjson` im Wort → kein JSON. */
export function cardExamplesReply(input: string): string {
  const word = line(input, 'Word').replace(/^to\s+/i, '').trim() || 'word';
  if (/zzjson/i.test(word)) return NOT_JSON;
  // Ein gültiger Wortpartner nur, wenn das Wort `colq` enthält (E2E „Wortpartner von Claude“); sonst wie bisher keiner.
  const collocations = /colq/i.test(word) ? [{ p: `${word} the plan`, de: 'den Plan voranbringen', gap: 'plan', opts: ['table', 'price', 'story'], ex: `We [${word} the plan] together every week.` }] : [];
  return JSON.stringify({
    examples: [
      `Our team tried to ${word} the new plan before the deadline.`,
      `It is not always easy to ${word} people in a short meeting.`,
      `She had to ${word} her manager with clear numbers and examples.`,
    ],
    collocations,
  });
}

// ---------------------------------------------------------------- order-gen@1

/**
 * Sechs neue, gültige Satzbau-Sätze mit dem Marker „Quokka“ (E2E erkennt daran, dass ein erzeugter Satz erscheint).
 * `zzjson` im Wortschatz → kein JSON. `zzbad` → lauter ungültige Sätze (Prüfung verwirft alle).
 */
export function orderGenReply(input: string): string {
  const vocab = line(input, 'Learner vocabulary');
  if (/zzjson/i.test(vocab)) return NOT_JSON;
  const good = [
    { topic: 'c1-emphasis', en: 'Never have we seen the Quokka project run so smoothly.', de: 'Noch nie haben wir das Quokka-Projekt so reibungslos laufen sehen.', chunks: ['never have', 'we', 'seen', 'the Quokka project', 'run so smoothly'], single: 'Inversion after never fixes the order: never have we.', why: ['Nach never rückt das Hilfsverb vor das Subjekt: never have we.', 'After never, the auxiliary comes before the subject: never have we.'] },
    { topic: 'c1-discourse', en: 'That said, the Quokka timeline is still tight for the first release.', de: 'Allerdings ist der Quokka-Zeitplan für die erste Version noch knapp.', chunks: ['that said', 'the Quokka timeline', 'is', 'still tight', 'for the first release'], single: 'The framing phrase leads and the rest keeps one natural order.', why: ['That said steht vorn und wird durch ein Komma vom Rest getrennt.', 'That said opens the sentence and is separated from the rest by a comma.'] },
    { topic: 'c1-hedging', en: 'The Quokka rollout could take slightly longer than planned.', de: 'Der Quokka-Rollout könnte etwas länger dauern als geplant. (vorsichtig)', chunks: ['the Quokka rollout', 'could', 'take', 'slightly longer', 'than planned'], single: 'Modal verb and softener stay in one fixed order here.', why: ['Slightly steht vor longer und schwächt die Aussage ab, wie das deutsche etwas.', 'Slightly goes before longer and softens the statement, like German etwas.'] },
    { topic: 'c1-diplomacy', en: 'Would it be possible to move the Quokka call to Friday?', de: 'Wäre es möglich, den Quokka-Termin auf Freitag zu verschieben? (höflich)', chunks: ['would', 'it', 'be possible', 'to move', 'the Quokka call', 'to Friday'], single: 'The polite frame stays first and the object comes before the time.', why: ['Die höfliche Frage beginnt mit would it be possible, nicht mit can you.', 'The polite question starts with would it be possible, not with can you.'] },
    { topic: 'c1-precision', en: 'We can set up the Quokka test within two weeks.', de: 'Wir können den Quokka-Test innerhalb von zwei Wochen einrichten.', chunks: ['we', 'can', 'set up', 'the Quokka test', 'within two weeks'], alt: ['Within two weeks, we can set up the Quokka test.'], why: ['Within two weeks heißt binnen zwei Wochen und passt nicht mit in zusammen.', 'Within two weeks means inside that period and does not combine with in.'] },
    { topic: 'c1-participle', en: 'Having seen the Quokka demo, the team asked about pricing.', de: 'Nachdem das Team die Quokka-Demo gesehen hatte, fragte es nach den Preisen.', chunks: ['having', 'seen', 'the Quokka demo', 'the team', 'asked', 'about pricing'], alt: ['The team asked about pricing, having seen the Quokka demo.'], why: ['Das Subjekt der Partizipgruppe ist das Subjekt des Hauptsatzes: the team.', 'The subject of the participle clause is the subject of the main clause: the team.'] },
  ];
  if (/zzbad/i.test(vocab)) return JSON.stringify({ items: good.map((g) => ({ ...g, chunks: g.chunks.slice(0, 3) })) });
  return JSON.stringify({ items: good });
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
  registerCannedReply('order-gen', orderGenReply);
  registerCannedReply('grammar-judge', grammarJudgeReply);
  // Phase 3 – Sprechen und Business
  registerCannedReply('roleplay-turn', roleplayTurnReply);
  registerCannedReply('turn-analysis', turnAnalysisReply);
  registerCannedReply('roleplay-report', roleplayReportReply);
  // Phase 5: companion-chat, translate
  registerCompanionReplies();
  // Lehrer-Feedback einfügen (28.09.2026, ersetzt die Preply-Brücke)
  registerTeacherFeedbackReply();
  // Phase 6
  registerCannedReply('assess', assessReply);
  registerCannedReply('weekly-report', weeklyReply);
  // Lernberatung 27.09., V2 – Reparatur-Sätze
  registerCannedReply('repair-check', repairCheckReply);
  registerCannedReply('listen-q', listenQReply);
  registerCannedReply('combo-check', comboCheckReply);
  // Neubau P7: pressure-check
  registerP7Replies();
  // Lernberatung 27.09., V3 – Deutsch-Fallen
  registerCannedReply('patterns', patternsReply);
  registerCannedReply('pattern-check', patternCheckReply);
  // word-gen, grammar-items, mnemonic
  registerLearnReplies();
  // Lernplattform 2.0: je Paket eine eigene Datei (grammar-items → P5, card-examples → P6)
  registerLp2P2Replies();
  registerLp2P5Replies();
  registerLp2P6Replies();
  // Lernplattform 3.0: nach P2, denn `explain-answer@2` ersetzt die Antwort von @1 unter derselben Kennung
  registerLp3P26Replies();
  registerLp3P46Replies();
  registerLp3P47Replies();
  registerLp3P51Replies();
  // Neubau: goal-check, claude-drill, text-cards
  registerNbReplies();
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
