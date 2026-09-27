import { validateDoc } from '../../data/validate';
import { TONE_REGISTERS, type ToneKind, type ToneMessage, type ToneRegister } from '../../content/tones/messages';
import { hash32 } from '../random';
import { repairsFromText } from '../repair/sources';
import type { NewRepair } from '../repair/repair';
import { compactList, monthOf, upsertById } from '../speak/talkDoc';

// „Eine Botschaft, drei Tonlagen“ (Lernberatung 27.09., Vorschlag 8 / V7): reine Logik.
// Sachverhalt des Tages, Reparatur-Sätze aus echten Fehlern und das Monatsdokument
// `tones/<JJJJ-MM>` (A6.6: wachsende Ströme zusammenfassen, ≤ 200 KiB, Verdichtung wie `say`).

type Doc = Record<string, unknown>;

export const TONES_DOC_MAX_BYTES = 200 * 1024;
/** Mindestlänge je Fassung (Wörter): Slack darf kurz sein, die Mail nicht. */
export const TONE_MIN_WORDS: Readonly<Record<ToneRegister, number>> = { slack: 5, cfo: 15, meeting: 6 };
/** Höchstlänge je Fassung (Zeichen). */
export const TONE_TEXT_MAX = 900;

export type ToneVerdict = 'too_direct' | 'too_stiff' | 'fits';
export type ToneVersion = { reg: ToneRegister; tone: ToneVerdict; why: string; model: string };
export type ToneCorrection = { reg: ToneRegister; wrong: string; right: string; why: string };
export type ToneFeedback = { versions: ToneVersion[]; corrections: ToneCorrection[]; tip: string };

export type ToneItem = {
  id: string;
  t: number;
  /** Lerntag. */
  day: string;
  /** Kennung des Sachverhalts. */
  msg: string;
  kind: ToneKind;
  /** Die drei Fassungen. */
  texts: Record<ToneRegister, string>;
  fb: ToneFeedback | null;
  /** Aktive Zeit in ms. */
  ms: number;
  lang: 'de' | 'en';
  /** Mit Claude geprüft (false = ohne KI gespeichert). */
  ai: boolean;
};

/** Sachverhalt des Lerntags: fest je Tag, `shift` = wie oft „Anderer Sachverhalt“ getippt wurde. */
export function messageFor(list: readonly ToneMessage[], day: string, shift = 0): ToneMessage | null {
  if (!list.length) return null;
  const base = hash32(`tones|${day}`) % list.length;
  return list[(base + Math.max(0, Math.floor(shift))) % list.length] ?? null;
}

/**
 * Echte Fehler (nicht Ton) → Reparatur-Sätze, je Fassung aus dem eigenen Text: der ganze Satz,
 * in dem der Fehler steht, und derselbe Satz korrigiert. Nicht auffindbare Stellen fallen weg.
 */
export function repairsFromTones(texts: Readonly<Record<ToneRegister, string>>, corrections: readonly ToneCorrection[], ctx: string): NewRepair[] {
  const out: NewRepair[] = [];
  const seen = new Set<string>();
  for (const reg of TONE_REGISTERS) {
    const fixes = corrections.filter((c) => c.reg === reg);
    if (!fixes.length) continue;
    for (const r of repairsFromText(texts[reg], fixes, 'tone', ctx)) {
      const k = r.wrong.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(r);
    }
  }
  return out;
}

const STEPS: ReadonlyArray<(i: Doc) => Doc | null> = [
  (i) => (i.fb ? { ...i, fb: null } : null),
  (i) => {
    const t = i.texts && typeof i.texts === 'object' ? (i.texts as Doc) : null;
    const has = t && Object.values(t).some((v) => typeof v === 'string' && v.length > 0);
    return has ? { ...i, texts: { slack: '', cfo: '', meeting: '' } } : null;
  },
];

export function compactTones(items: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(items, STEPS, TONES_DOC_MAX_BYTES, (list) => ({ v: 1, month, items: list }));
}

/** Schreibvorgang für `tones/<Monat>` aus dem frischen Stand (writer.transform); `null` = Dokument unerwartet. */
export function upsertToneItem(cur: Doc | undefined, item: ToneItem): { set: Doc } | { update: Doc } | null {
  const month = monthOf(item.day);
  if (!cur) return { set: { v: 1, month, items: compactTones([item], month) } };
  if (!validateDoc(tonesPath(item.day), cur).ok) return null;
  if (cur.items != null && !Array.isArray(cur.items)) return null;
  const list = Array.isArray(cur.items) ? cur.items : [];
  return { update: { items: compactTones(upsertById(list, item), month) } };
}

/** Kennung eines Eintrags: Sachverhalt + Beginn (Basis 36). */
export const toneId = (msg: string, t: number): string => `tone-${msg}-${Math.max(0, Math.floor(t)).toString(36)}`;

/** Pfad des Monatsdokuments. */
export const tonesPath = (day: string): string => `tones/${monthOf(day)}`;
