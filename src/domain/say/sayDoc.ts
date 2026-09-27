import { compactList, monthOf, upsertById } from '../speak/talkDoc';

// „Sag es“ (Lernberatung 27.09., V1/V2) als Monatsdokument `say/<JJJJ-MM>` (A6.6: wachsende
// Ströme zusammenfassen). Ein Eintrag je Situation und Tag, idempotent über `id` – nach der
// ersten Prüfung und nach dem zweiten Durchgang wird derselbe Eintrag ersetzt. Verdichtung wie
// bei `talk`/`biz`: bis ≤ 200 KiB zuerst die Rückmeldungen, dann die Texte der ältesten Einträge.

type Doc = Record<string, unknown>;

export const SAY_DOC_MAX_BYTES = 200 * 1024;
/** Mindestlänge der Antwort (3–6 Sätze). */
export const SAY_MIN_WORDS = 20;
/** Höchstlänge einer Antwort in Zeichen (Eingabefeld und Speicher). */
export const SAY_TEXT_MAX = 1500;
/** Sanfte Zeitanzeige (nur Anzeige, kein Abbruch): erster Durchgang 3 Min., zweiter 2 Min. */
export const SAY_TIME_MS = { first: 180_000, second: 120_000 } as const;

export type SayCorrection = { wrong: string; right: string; why: string };
export type SayUpgrade = { from: string; to: string; why: string; phrase?: string; de?: string; def?: string };
export type SayFeedback = { corrections: SayCorrection[]; upgrades: SayUpgrade[]; better: string; praise: string };

export type SayItem = {
  id: string;
  t: number;
  /** Lerntag des Beginns. */
  day: string;
  /** Kennung der Situation. */
  sit: string;
  kind: 'job' | 'life';
  /** Erste Fassung. */
  a1: string;
  /** Zweite Fassung („Nochmal, aber besser“), '' solange es sie nicht gibt. */
  a2: string;
  fb1: SayFeedback | null;
  fb2: SayFeedback | null;
  /** Aktive Zeit in ms. */
  ms: number;
  lang: 'de' | 'en';
  /** Mit Claude geprüft (false = ohne KI gespeichert). */
  ai: boolean;
};

const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [
  (i) => (i.fb1 || i.fb2 ? { ...i, fb1: null, fb2: null } : null),
  (i) => {
    const has = ['a1', 'a2'].some((k) => typeof i[k] === 'string' && i[k].length > 0);
    return has ? { ...i, a1: '', a2: '' } : null;
  },
];

export function compactSay(items: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(items, STEPS, SAY_DOC_MAX_BYTES, (list) => ({ v: 1, month, items: list }));
}

/** Schreibvorgang für `say/<Monat>` aus dem frischen Stand (writer.transform). */
export function upsertSayItem(cur: Doc | undefined, item: SayItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.day);
  if (!cur) return { set: { v: 1, month, items: compactSay([item], month) } };
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactSay(upsertById(list, item), month) } };
}

/** Kennung eines Eintrags: Situation + Beginn (Basis 36). */
export const sayId = (sit: string, t: number): string => `say-${sit}-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Pfad des Monatsdokuments. */
export const sayPath = (day: string): string => `say/${monthOf(day)}`;
