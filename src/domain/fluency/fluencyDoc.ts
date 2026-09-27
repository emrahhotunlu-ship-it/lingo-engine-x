import { compactList, monthOf, upsertById } from '../speak/talkDoc';

// Flüssigkeit 90 – 60 – 45 (Lernberatung 27.09., V6 / Vorschlag 5) als Monatsdokument
// `fluency/<JJJJ-MM>` (A6.6: wachsende Ströme zusammenfassen). Ein Eintrag je Durchgang,
// idempotent über `id` (nach den drei Runden und nach der Rückmeldung wird derselbe Eintrag
// ersetzt). Verdichtung bis ≤ 200 KiB: zuerst die Rückmeldungen, dann die Texte der ältesten.

type Doc = Record<string, unknown>;

export const FLUENCY_DOC_MAX_BYTES = 200 * 1024;
/** Höchstlänge einer Runde in Zeichen (Eingabefeld und Speicher). */
export const FLUENCY_TEXT_MAX = 1500;

export type FluencyRound = {
  /** Vorgabe in Sekunden (90, 60, 45). */
  sec: number;
  text: string;
  /** Tatsächlich genutzte Zeit in ms. */
  ms: number;
  words: number;
  wpm: number;
  sentences: number;
  full: number;
};

export type FluencyCorrection = { wrong: string; right: string; why: string };
export type FluencyPhrase = { phrase: string; de: string; def: string; example: string };
export type FluencyFeedback = { progress: string; missing: FluencyPhrase[]; corrections: FluencyCorrection[] };

export type FluencyItem = {
  id: string;
  t: number;
  /** Lerntag des Beginns. */
  day: string;
  /** Kennung der Frage. */
  q: string;
  kind: 'job' | 'life';
  rounds: FluencyRound[];
  fb: FluencyFeedback | null;
  /** Aktive Zeit in ms (Summe der Runden). */
  ms: number;
  lang: 'de' | 'en';
  /** Mit Claude ausgewertet. */
  ai: boolean;
};

const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [
  (i) => (i.fb ? { ...i, fb: null } : null),
  (i) => {
    const rounds = Array.isArray(i.rounds) ? (i.rounds as unknown[]) : [];
    const has = rounds.some((r) => r && typeof r === 'object' && typeof (r as Doc).text === 'string' && ((r as Doc).text as string).length > 0);
    return has ? { ...i, rounds: rounds.map((r) => (r && typeof r === 'object' ? { ...(r as Doc), text: '' } : r)) } : null;
  },
];

export function compactFluency(items: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(items, STEPS, FLUENCY_DOC_MAX_BYTES, (list) => ({ v: 1, month, items: list }));
}

/** Schreibvorgang für `fluency/<Monat>` aus dem frischen Stand (writer.transform). */
export function upsertFluencyItem(cur: Doc | undefined, item: FluencyItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.day);
  if (!cur) return { set: { v: 1, month, items: compactFluency([item], month) } };
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactFluency(upsertById(list, item), month) } };
}

/** Kennung eines Eintrags: Frage + Beginn (Basis 36). */
export const fluencyId = (q: string, t: number): string => `fl-${q}-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Pfad des Monatsdokuments. */
export const fluencyPath = (day: string): string => `fluency/${monthOf(day)}`;
