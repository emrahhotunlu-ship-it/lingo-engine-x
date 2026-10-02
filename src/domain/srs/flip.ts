import { addDays, dayKey, learningDayStart } from '../date';
import { meaningOf } from './cards';
import { stageOf } from './ladder';
import { CATCHUP_MIN_S, CATCHUP_TYPED_EVERY } from '../unit/backlog';
import type { Grade, Lang, TrainCard } from './types';

// Anki-Modus „Aufdecken“ (docs/neubau/anki-regeln.md, verbindlich): Modus-Regel für `auto`,
// Vorschlag aus der Denkzeit, Stufenregel, Kontrolle der „Leicht“-Karten und Kalibrierung.
// Rein und getestet; die Regel steht an genau EINER Stelle (architektur.md §4.1).

export const FLIP = {
  easyMs: 3000,
  easyStrictMs: 2000,
  goodMs: 10000,
  phraseFactor: 1.5,
  readFreeWords: 8,
  readPerWordMs: 150,
  readMaxMs: 3000,
  floorMs: 1000,
  /** splice(pos + 6): 5 andere Karten dazwischen. */
  againGap: 6,
} as const;

export const CONTROL = { perWeek: 5, perDay: 2, perSession: 1, windowDays: 28, minPairs: 10, minHit: 0.75, hintEveryDays: 14 } as const;

/** Beim Tippen: Wiedervorlage nach 3 anderen Karten (pos + 4). */
export const TYPE_AGAIN_GAP = 4;

/**
 * Gewünschter Modus: `auto` (Tageseinheit, „Alle fälligen“), Stapel-Modus `flip` oder `type`,
 * oder `listen` (N35 Hör-Modus: die Sprachausgabe spricht, getippt wird in die Lücke – `listen.ts`).
 */
export type RequestedMode = 'auto' | 'type' | 'flip' | 'listen';
/**
 * Gewählter Modus je Karte: Aufdecken, Tippen (Leiter), Kontrolle (frei tippen nach „Leicht“) oder
 * Prüfabfrage (tippen mit Stütze auf Stufe 3 nach „Gut“).
 */
export type PickedMode = 'type' | 'flip' | 'control' | 'probe';
/** Richtung der Aufdeck-Karte (§8): Deutsch → Englisch (aktiv, Standard), Englisch → Deutsch, gemischt. */
export type FlipDir = 'de-en' | 'en-de' | 'mix';
export const FLIP_DIRS: readonly FlipDir[] = ['de-en', 'en-de', 'mix'];

type Doc = Readonly<Record<string, unknown>>;
export type HistEntry = { t: number; g: number | null; x: string | null };

const DAY_MS = 86_400_000;
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Verlauf einer Karte (älteste zuerst), nur lesbare Einträge. */
export function histOf(doc: Doc): HistEntry[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const out: HistEntry[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    const t = num(o.t);
    if (t === null) continue;
    out.push({ t, g: num(o.g), x: typeof o.x === 'string' ? o.x : null });
  }
  return out.sort((a, b) => a.t - b.t);
}

export const lastRating = (doc: Doc): HistEntry | null => histOf(doc).at(-1) ?? null;

const isFlipEntry = (h: HistEntry | null | undefined): boolean => h?.x === 'flip';

export type PickInput = {
  card: Pick<TrainCard, 'doc' | 'de' | 'def'>;
  requested: RequestedMode;
  /** Lerntag (04:00-Regel). */
  day: string;
  lang: Lang;
  /** Die Karte ist heute fällig (Kontrolle nur dann, nie vorziehen, §4). */
  due: boolean;
  /** Nur Stapel im Aufdecken-Modus: Kontrolle erlaubt (Deckel 1/2/5, `controlAllowed`). */
  controlAllowed?: boolean;
  /** Aufholmodus (`unit/backlog.ts`): reife, fällige Karten aufdecken statt tippen, jede vierte tippen. */
  catchUp?: boolean;
  /** Kennung der Karte (für die feste Wahl „jede vierte“). */
  key?: string;
};

/** Feste, wiederholbare Wahl je Karte und Lerntag: jede `every`-te Karte. */
function everyNth(key: string, day: string, every: number): boolean {
  let h = 0;
  for (const ch of `${key}|${day}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h) % every === 0;
}

/**
 * Modus je Karte (§1, der erste Treffer entscheidet):
 * 1 `type` gewünscht oder keine Bedeutung in der Oberflächensprache → Tippen
 * 2 heute schon bewertet → derselbe Modus wie diese Bewertung
 * 3 `flip` gewünscht (Stapel) → Aufdecken, Ausnahme Kontrolle (§4, gedeckelt)
 * 4 auto: zuletzt Aufdecken + Leicht (und fällig) → Kontrolle
 * 5 auto: gespeicherte Stufe ≥ 3 (`stageOf(doc)`, nie die Anzeige-Stufe) → Tippen
 * 6 auto: zuletzt Aufdecken + Gut → Prüfabfrage (Stufe 3 mit Stütze)
 * 7 sonst → Aufdecken
 */
export function pickMode(i: PickInput): PickedMode {
  if (i.requested === 'type' || i.requested === 'listen' || !meaningOf(i.card, i.lang)) return 'type';
  const last = lastRating(i.card.doc);
  if (last && dayKey(last.t) === i.day) return isFlipEntry(last) ? 'flip' : 'type';
  const easyFlip = isFlipEntry(last) && last?.g === 4;
  if (i.requested === 'flip') return easyFlip && i.due && i.controlAllowed === true ? 'control' : 'flip';
  if (easyFlip && i.due) return 'control';
  if (i.catchUp && i.due && stageOf(i.card.doc) >= 3 && (num(i.card.doc.S) ?? 0) >= CATCHUP_MIN_S && !everyNth(i.key ?? (typeof i.card.doc.id === 'string' ? i.card.doc.id : ''), i.day, CATCHUP_TYPED_EVERY)) return 'flip';
  if (stageOf(i.card.doc) >= 3) return 'type';
  if (isFlipEntry(last) && last?.g === 3) return 'probe';
  return 'flip';
}

export type SuggestInput = {
  /** Denkzeit vom ersten Bild der Vorderseite bis zum Aufdecken (ohne Hintergrundzeit). */
  revealMs: number;
  /** Wendung oder Mehrwort-Karte (`isPhraseCard`): Faktor 1,5. */
  phrase: boolean;
  /** Wörter des Satzes auf der Vorderseite (Lesezuschlag ab dem 9. Wort, nur für „Gut“). */
  frontWords?: number;
  /** Heute schon gesehen (Einführung, Wiedervorlage, frühere Runde): höchstens „Gut“. */
  seenToday?: boolean;
  /** Seite war während der Vorderseite verborgen: „Gut“. */
  hidden?: boolean;
  /** Schwache Kalibrierung (§4): Leicht-Grenze 2 s × f. */
  strict?: boolean;
};

/** Vorschlag aus der Denkzeit (§2). „Nochmal“ schlägt die App nie vor. */
export function flipSuggest(i: SuggestInput): 2 | 3 | 4 {
  if (i.hidden) return 3;
  if (!(i.revealMs >= FLIP.floorMs)) return 3;
  const f = i.phrase ? FLIP.phraseFactor : 1;
  const easy = (i.strict ? FLIP.easyStrictMs : FLIP.easyMs) * f;
  const read = Math.min(FLIP.readMaxMs, Math.max(0, (i.frontWords ?? 0) - FLIP.readFreeWords) * FLIP.readPerWordMs);
  const g: 2 | 3 | 4 = i.revealMs <= easy ? 4 : i.revealMs <= FLIP.goodMs * f + read ? 3 : 2;
  return i.seenToday && g === 4 ? 3 : g;
}

/**
 * Stufe nach einer Aufdeck-Bewertung (§3): Nochmal senkt um höchstens eine Stufe, Schwer hält,
 * Gut/Leicht heben höchstens bis Stufe 2. Nie unter 1 (Schema `stage ≥ 1`).
 */
export function flipStage(s0: number, grade: Grade): number {
  const s = Math.max(0, Math.min(5, Math.round(Number.isFinite(s0) ? s0 : 0)));
  if (grade === 1) return Math.max(1, s - 1);
  if (grade === 2) return Math.max(1, s);
  return Math.max(1, s, Math.min(2, s + 1));
}

/** Wiedervorlage nach „Nochmal“: Aufdecken nach 5 anderen Karten, Tippen nach 3 (höchstens ans Ende). */
export const againPos = (pos: number, queueLen: number, flip: boolean, passed = false): number =>
  Math.min(queueLen, pos + Math.max(flip ? FLIP.againGap : TYPE_AGAIN_GAP, passed ? PASSED_AGAIN_GAP : 0));
/** Nach „Gut“ im Lernschritt (kurze Wiedervorlage nach 10 Min.) mindestens 8 Karten dazwischen – sonst prüft die Wiedervorlage nur das Kurzzeitgedächtnis. */
export const PASSED_AGAIN_GAP = 8;

/** Richtung einer Karte; `mix` wählt je Karte und Lerntag fest (kein Würfeln beim Neuzeichnen). */
export function dirFor(key: string, dir: FlipDir, day: string): 'de-en' | 'en-de' {
  if (dir !== 'mix') return dir;
  let h = 0;
  for (const ch of `${key}|${day}`) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (h & 1) === 0 ? 'de-en' : 'en-de';
}

// ------------------------------------------------------------------ Intervalle

/** „1 Min.“, „10 Min.“, „5 Std.“, „3 Tage“, „2 Mon.“, „1 J.“ bzw. „1 min“, „3 days“ … */
export function formatInterval(ms: number, lang: Lang): string {
  const de = lang === 'de';
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return de ? `${min} Min.` : `${min} min`;
  const h = Math.round(ms / 3_600_000);
  if (h < 24) return de ? `${h} Std.` : `${h} h`;
  const d = Math.max(1, Math.round(ms / DAY_MS));
  if (d < 30) return de ? `${d} ${d === 1 ? 'Tag' : 'Tage'}` : `${d} ${d === 1 ? 'day' : 'days'}`;
  if (d < 365) {
    const m = Math.max(1, Math.round(d / 30));
    return de ? `${m} Mon.` : `${m} mo`;
  }
  const y = Math.round((d / 365) * 10) / 10;
  const ys = Number.isInteger(y) ? String(y) : de ? String(y).replace('.', ',') : String(y);
  return de ? `${ys} J.` : `${ys} ${y === 1 ? 'yr' : 'yrs'}`;
}

// ------------------------------------------------------------------ Kontrolle und Kalibrierung

/** Beginn der Kalenderwoche (Montag 04:00 Ortszeit) des Lerntags von `nowMs`. */
export function weekStartMs(nowMs: number): number {
  const day = dayKey(nowMs);
  const [y, m, d] = day.split('-').map(Number);
  const dow = (new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay() + 6) % 7;
  const mon = addDays(day, -dow);
  const [ya, ma, da] = mon.split('-').map(Number);
  return new Date(ya ?? 1970, (ma ?? 1) - 1, da ?? 1, 4).getTime();
}

/**
 * Kontrollen seit `fromMs`: getippte Antworten, deren vorige Bewertung Aufdecken + Leicht war
 * (Kontrollen aus `auto` zählen mit, §4). Abgeleitet aus `hist`, kein neues Datenfeld.
 */
export function controlsSince(docs: Iterable<Doc>, fromMs: number): number {
  let n = 0;
  for (const doc of docs) {
    const h = histOf(doc);
    for (let i = 1; i < h.length; i++) {
      const prev = h[i - 1] as HistEntry;
      const cur = h[i] as HistEntry;
      if (cur.t >= fromMs && cur.x !== null && cur.x !== 'flip' && isFlipEntry(prev) && prev.g === 4) n++;
    }
  }
  return n;
}

/** Deckel der Kontrolle in eigenen Aufdeck-Stapeln: 1 je Sitzung, 2 je Lerntag, bis die Woche 5 hat. */
export function controlAllowed(c: { week: number; day: number; session: number }): boolean {
  return c.week < CONTROL.perWeek && c.day < CONTROL.perDay && c.session < CONTROL.perSession;
}

export function controlCounts(docs: Iterable<Doc>, nowMs: number): { week: number; day: number } {
  const list = [...docs];
  return { week: controlsSince(list, weekStartMs(nowMs)), day: controlsSince(list, learningDayStart(nowMs)) };
}

export type Calibration = { pairs: number; hits: number; strict: boolean };

/**
 * Kalibrierung (§4): Paare „Aufdecken-Leicht → nächste Antwort getippt“ der letzten 28 Tage.
 * Treffer = Note ≥ 2. Ab 10 Paaren mit Quote < 75 % gilt die strenge Leicht-Grenze.
 */
export function calibration(docs: Iterable<Doc>, nowMs: number): Calibration {
  const from = nowMs - CONTROL.windowDays * DAY_MS;
  let pairs = 0;
  let hits = 0;
  for (const doc of docs) {
    const h = histOf(doc);
    for (let i = 1; i < h.length; i++) {
      const prev = h[i - 1] as HistEntry;
      const cur = h[i] as HistEntry;
      if (prev.t < from || !isFlipEntry(prev) || prev.g !== 4 || cur.x === null || cur.x === 'flip') continue;
      pairs++;
      if ((cur.g ?? 0) >= 2) hits++;
    }
  }
  return { pairs, hits, strict: pairs >= CONTROL.minPairs && hits / pairs < CONTROL.minHit };
}

/** Wurde die Karte heute (Lerntag) schon gesehen bzw. bewertet? */
export function seenOn(doc: Doc, day: string): boolean {
  if (typeof doc.intro === 'string' && doc.intro === day) return true;
  const last = lastRating(doc);
  return !!last && dayKey(last.t) === day;
}

/** Wörter eines Satzes (für den Lesezuschlag). */
export const wordCount = (s: string | null | undefined): number => (s ? (s.match(/[\p{L}\p{N}’'-]+/gu) ?? []).length : 0);
