import { ACTIVATION_SCENES, sceneById, sceneLeaks, tonesOf, type SceneKind } from '../../content/activation/scenes';
import { dayKey } from '../date';
import { hash32, mulberry32 } from '../random';
import { leastRecent } from './variety';

// Variable Aufgabenstellung für „Eigener Satz“ (Wörter aktivieren, Stufe 1; docs/umbau/aktivierung.md). Wer ein Wort immer im selben Muster
// benutzt, lernt das Muster (Encoding Variability, Generieren in neuer Lage). Die Aufgabe nennt deshalb bei jeder Aktivierung eine andere Lage,
// Satzform, einen anderen Ton und eine andere Zeitform. Rein und deterministisch: gleiche Karte, gleicher Tag, gleicher Verlauf → gleiche Vorgabe
// (kein Würfeln beim Neuzeichnen). Der Code der Vorgabe steht kurz im Verlaufseintrag der Karte (`hist[].a`), damit die nächste Wahl anders ausfällt.

export type FormId = 's' | 'q' | 'n' | 'i';
/** Ton: locker, neutral, formell; `-` = noch keine Vorgabe (die ersten beiden Aktivierungen einer Karte, siehe `STAGE_*`). */
export type ToneId = 'c' | 'n' | 'f' | '-';
/** Zeitform; `-` = frei (Wenn-Satz oder noch keine Vorgabe bei der ersten Aktivierung). */
export type TenseId = 'pr' | 'pa' | 'pf' | 'fu' | 'co' | '-';

/** Satzformen: Aussage, Frage, Verneinung, Wenn-Satz. */
export const FORMS: readonly FormId[] = ['s', 'q', 'n', 'i'];
/** Ton: locker, neutral, formell. */
export const TONES: readonly Exclude<ToneId, '-'>[] = ['c', 'n', 'f'];
/** Zeitformen; beim Wenn-Satz entfällt die Vorgabe (`-`), die Bedingung bestimmt die Zeitform. */
export const TENSES: readonly TenseId[] = ['pr', 'pa', 'pf', 'fu', 'co'];

/** Wie oft die Beruf-Lagen gegenüber Alltag-Lagen gewählt werden: etwa 2 von 3. */
export const DAILY_SHARE = 1 / 3;
/** Wortlaute der Anweisung (`task_produce_1..3`). */
export const WORDINGS = 3;
/**
 * Staffelung (Lernwissenschaft M3): Wer ein Wort zum ersten Mal selbst benutzt, bekommt nur Lage und Satzform (Aussage oder Frage). Ab der zweiten
 * Aktivierung kommt die Zeitform dazu, ab der dritten der Ton. Zahl der bisherigen Aktivierungen der Karte, ab der das Merkmal gilt.
 */
export const STAGE_TENSE = 1;
export const STAGE_TONE = 2;
/** Zwei Aktivierungen derselben Karte unterscheiden sich in mindestens so vielen der vier Merkmale (bei gestaffelten ersten Malen: in so vielen der vorgegebenen). */
export const MIN_DIFFERENT = 3;
/** Längster Code (Verlaufseintrag): „j14.q.c.pf“ hat 10 Zeichen, Grenze aus dem Auftrag: unter 40. */
export const CODE_MAX = 40;

export type Brief = { scene: string; form: FormId; tone: ToneId; tense: TenseId; wording: number; code: string };

export const briefCode = (b: Pick<Brief, 'scene' | 'form' | 'tone' | 'tense'>): string => `${b.scene}.${b.form}.${b.tone}.${b.tense}`;

/** Code → Vorgabe (ohne Wortlaut), `null` bei fremdem oder zu langem Text. */
export function parseBrief(code: unknown): Pick<Brief, 'scene' | 'form' | 'tone' | 'tense' | 'code'> | null {
  if (typeof code !== 'string' || code.length >= CODE_MAX) return null;
  const [scene, form, tone, tense, ...rest] = code.split('.');
  if (rest.length || !scene || !sceneById(scene)) return null;
  if (!FORMS.includes(form as FormId) || ![...TONES, '-'].includes(tone as ToneId) || ![...TENSES, '-'].includes(tense as TenseId)) return null;
  // Beim Wenn-Satz bestimmt die Bedingung die Zeitform; sonst darf die Zeitform nur in den ersten Malen (gestaffelt) frei sein.
  if (form === 'i' && tense !== '-') return null;
  return { scene, form: form as FormId, tone: tone as ToneId, tense: tense as TenseId, code };
}

/** Codes der bisherigen Aktivierungen dieser Karte (`hist[].a`), ältester zuerst, nur gültige. */
export function briefCodesOf(doc: Readonly<Record<string, unknown>>): string[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  return raw
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object' && typeof (h as Record<string, unknown>).t === 'number')
    .sort((a, b) => (a.t as number) - (b.t as number))
    .flatMap((h) => (parseBrief(h.a) ? [h.a as string] : []));
}

/** In wie vielen der vier Merkmale unterscheiden sich zwei Vorgaben? */
export function differences(a: Pick<Brief, 'scene' | 'form' | 'tone' | 'tense'>, b: Pick<Brief, 'scene' | 'form' | 'tone' | 'tense'>): number {
  return (a.scene !== b.scene ? 1 : 0) + (a.form !== b.form ? 1 : 0) + (a.tone !== b.tone ? 1 : 0) + (a.tense !== b.tense ? 1 : 0);
}

/** Zustandsverben: die Verlaufsform wäre falsch („I am knowing“), also bekommt die Karte nie die Vorgabe „Verlaufsform“. */
const STATIVE = new Set(
  'know belong own consist comprise contain possess owe need want prefer like love hate believe understand mean require depend resemble remain seem appear exist lack matter deserve doubt suppose recognize realize'.split(' '),
);

/** Passt die Verlaufsform zum Zielwort? Nein bei Zustandsverben, Adjektiven und Adverbien (reluctant, soon). */
export function allowsContinuous(card: { lemma?: string; pos?: string | null }): boolean {
  const first = (card.lemma ?? '').toLowerCase().trim().split(/\s+/)[0] ?? '';
  if (STATIVE.has(first)) return false;
  return !/^(adj|adv)/i.test(card.pos ?? '');
}

/**
 * Vorgabe für diese Karte an diesem Tag. `used` = bisherige Codes der Karte (`briefCodesOf`), der neueste zuletzt. Je Merkmal gilt „am längsten
 * nicht benutzt“, das zuletzt benutzte kommt nie, solange es eine Wahl gibt – damit unterscheiden sich zwei Aktivierungen in allen vorgegebenen
 * Merkmalen (mindestens `MIN_DIFFERENT`, Test) und dasselbe Muster kommt nie zweimal hintereinander. Der Ton kommt nur aus den Tönen, die in der
 * Lage glaubwürdig sind; Lagen, die das Zielwort verraten, entfallen; die Verlaufsform nur, wo sie zum Wort passt (`card` optional).
 */
export function pickBrief(key: string, day: string, used: readonly string[], card: { lemma?: string; pos?: string | null } = {}): Brief {
  const past = used.flatMap((c) => {
    const p = parseBrief(c);
    return p ? [p] : [];
  });
  const rng = mulberry32(hash32(`${key}|${day}|${past.length}|${past.at(-1)?.code ?? ''}`));
  const kind: SceneKind = rng() < DAILY_SHARE ? 'daily' : 'job';
  const ofKind = ACTIVATION_SCENES.filter((s) => s.kind === kind);
  const fitting = ofKind.filter((s) => !card.lemma || !sceneLeaks(s, card.lemma));
  const pool = fitting.length ? fitting : ofKind;
  const scene = leastRecent(pool, (s) => s.id, past.map((p) => p.scene), Math.floor(rng() * 1000)) as (typeof pool)[number];
  // Erstes Mal: Aussage oder Frage; zweites Mal dazu die Verneinung; der Wenn-Satz (verlangt zwei Satzteile) erst, wenn auch der Ton gilt.
  const forms = past.length < STAGE_TENSE ? FORMS.filter((f) => f === 's' || f === 'q') : past.length < STAGE_TONE ? FORMS.filter((f) => f !== 'i') : FORMS;
  const form = leastRecent(forms, (f) => f, past.map((p) => p.form), Math.floor(rng() * 1000)) as FormId;
  const tones = tonesOf(scene);
  const toneRoll = Math.floor(rng() * 1000);
  const tone: ToneId = past.length >= STAGE_TONE ? (leastRecent(tones, (t) => t, past.map((p) => p.tone), toneRoll) as ToneId) : '-';
  const tenses = allowsContinuous(card) ? TENSES : TENSES.filter((t) => t !== 'co');
  const tenseRoll = Math.floor(rng() * 1000);
  const tense: TenseId = form === 'i' || past.length < STAGE_TENSE ? '-' : (leastRecent(tenses, (t) => t, past.map((p) => p.tense), tenseRoll) as TenseId);
  const wording = (past.length + hash32(key)) % WORDINGS;
  return { scene: scene.id, form, tone, tense, wording, code: briefCode({ scene: scene.id, form, tone, tense }) };
}

/**
 * Leitplanke gegen freie Sätze beim ersten Lernen (Barcroft, docs/umbau/tagesaufbau.md T2): Eine Karte gilt erst als „bereit“, wenn sie schon
 * mindestens `ACTIVATION_MIN_DAYS` richtige Abrufe an verschiedenen Tagen hat (Antworten mit Note ≥ 2 im Verlauf, Aufdecken zählt nicht).
 */
export const ACTIVATION_MIN_DAYS = 2;
/** Frühestens ab dieser Stufe der Karte (Stufe 1–2 sind „Neue Wörter“ und Erkennen). */
export const ACTIVATION_MIN_STAGE = 3;

export function recallDays(doc: Readonly<Record<string, unknown>>): number {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const days = new Set<string>();
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const r = h as Record<string, unknown>;
    if (typeof r.t !== 'number' || typeof r.g !== 'number' || r.g < 2 || r.x === 'flip' || r.x === 'known' || r.m === 'known') continue;
    days.add(dayKey(r.t));
  }
  return days.size;
}

export const activationReady = (card: { stage: number; doc: Readonly<Record<string, unknown>> }): boolean =>
  card.stage >= ACTIVATION_MIN_STAGE && recallDays(card.doc) >= ACTIVATION_MIN_DAYS;
