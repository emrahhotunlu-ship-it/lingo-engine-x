import { dayKey } from '../date';
import { isLearningState, retrievability } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';
import { FREE_ANSWER, FREE_MIN_GRADE, sentKey } from '../srs/variety';

// EIN ehrlicher Status je Wort- oder Wendungskarte (Paket ST, docs/umbau/wort-lernen-plan.md). Alles wird beim Lesen aus dem Verlauf
// (`hist`) und der Planung (`fsrs`) abgeleitet. Nichts davon wird gespeichert; `stage`, `S`, `D`, `due` werden nie beschrieben.
// Liste, Wortblatt, Übungsbildschirm, Wort-Hub, Fortschritt und Atlas lesen nur diese Datei, damit sie sich nie widersprechen.
//
//   Neu     = noch nicht gelernt
//   Lernt   = alles dazwischen
//   Wackelt = Stufe ≥ 4 (oder schon 2 freie Tage), aber nach dem letzten Fehler noch nicht an 2 Tagen wieder frei richtig (der Fehler setzt den Beleg zurück)
//             ODER die Abrufwahrscheinlichkeit liegt unter 70 % (nur mit belastbarem Abstand)
//   Sicher  = an mindestens 2 verschiedenen Tagen frei richtig abgerufen (getippt, ohne Auswahl und ohne Stütze)
//   Fest    = Stufe 5 ∧ Stabilität ≥ 21 Tage ∧ im neuen Satz gekonnt (richtig frei in mindestens 2 verschiedenen Sätzen) oder selbst benutzt ∧ kein unerholter Fehler
// „Wackelt“ geht vor „Sicher“ und „Fest“: Ein Rückfall nimmt „Fest“ und „Sicher“ sofort, eine sehr lange Pause (Abruf unter 70 %,
// bei einer festen Karte erst nach Monaten) ebenfalls. So steht nie „Sicher“ oder „Fest“ neben „Jetzt im Kopf: wackelig“.

export type UnitState = 'new' | 'learning' | 'wobbly' | 'safe' | 'firm';
export const UNIT_STATES: readonly UnitState[] = ['new', 'learning', 'wobbly', 'safe', 'firm'];
/** Rang für Aufstieg und Rückfall: „Wackelt“ steht auf der Höhe von „Lernt“ (Lernt → Wackelt ist kein Aufstieg). */
export const UNIT_RANK: Readonly<Record<UnitState, number>> = { new: 0, learning: 1, wobbly: 1, safe: 2, firm: 3 };

/** „Fest“: Stufe 5 und Stabilität ≥ 21 Tage (plus Satz-Beleg, siehe `isFest`). */
export const FEST_STAGE = 5;
export const FEST_DAYS = 21;
/** „Wackelt“ gilt ab dieser Stufe. */
export const WOBBLY_FROM_STAGE = 4;
/** Abrufwahrscheinlichkeit unter diesem Wert: wackelt (Stufe ≥ 4). */
export const WOBBLY_R = 0.7;
/** Unter diesem Wert: vermutlich vergessen. */
export const FORGOTTEN_R = 0.5;
/** „Sicher“ braucht so viele verschiedene Tage mit richtiger freier Antwort. */
export const SAFE_FREE_DAYS = 2;
/** Das Ziel der Anzeige „x von 3 Tagen“ (Stufe 5 verlangt drei freie Tage). */
export const FREE_DAYS_GOAL = 3;

const DAY_MS = 86_400_000;

/** Wie sich die Karte JETZT anfühlt: aus der Abrufwahrscheinlichkeit. `noGap` = noch kein belastbarer Abstand (weniger als ein Tag oder in Lernschritten). */
export type Mind = 'none' | 'good' | 'shaky' | 'forgotten' | 'noGap';

export type CardStatus = {
  tier: UnitState;
  /** Erkennst du: Auswahl oder Aufdecken richtig (oder Stufe ≥ 1 ohne lesbaren Verlauf). */
  recognizes: boolean;
  /** Mit Hilfe: Lücke mit Anfangsbuchstabe, Bausteine oder frei richtig. */
  helped: boolean;
  /** Verschiedene Tage mit richtiger freier Antwort (Verlauf, höchstens 12 Einträge). */
  freeDays: number;
  /** Im neuen Satz gekonnt: richtig frei beantwortet in mindestens 2 verschiedenen Sätzen (nicht nur der eine, den man auswendig kennt) oder im eigenen Satz. */
  newSentence: boolean;
  /** Selbst benutzt: eigener Satz, von Claude geprüft (Zähler `na`). */
  own: boolean;
  mind: Mind;
  /** Abrufwahrscheinlichkeit jetzt, nur mit belastbarem Abstand. */
  r: number | null;
  /** Zeitpunkt des letzten falschen Antwort im Verlauf. */
  lastWrong: number | null;
  /** War die allerletzte Antwort falsch? */
  lastWasWrong: boolean;
  /** Es gab einen Fehler, und seitdem noch nicht an 2 verschiedenen Tagen wieder frei richtig (der Fehler setzt den Beleg zurück). */
  unrecovered: boolean;
  /** Gar kein Eintrag im Verlauf: der Stand stammt aus der alten App und ist noch nicht neu belegt. */
  noHistory: boolean;
  /** Nur Aufdecken-Belege (Anki, selbst bewertet), nie getippt. */
  flipOnly: boolean;
};

type Entry = { t: number; g: number | null; x: string | null; s: string | null; u: boolean; ci: boolean; /** `x` fehlte und wurde aus dem Modus `m` der alten App abgeleitet. */ legacy: boolean };

/**
 * Alte Verlaufseinträge (nur `m`, kein `x`) beim LESEN einer Abfrageart zuordnen (altapp-analyse „modeBonus“); es wird nichts geschrieben:
 * type → type (frei), produce → produce (frei), recog und listen → Erkennen, cloze und colloc → Stütze.
 * Hinweis: `hist` hat höchstens 12 Einträge; ältere Belege fallen heraus, deshalb sind alle Belege „in den letzten 12 Antworten“.
 */
const LEGACY_FORM: Readonly<Record<string, string>> = { type: 'type', produce: 'produce', recog: 'mc_en', listen: 'listen_mc', cloze: 'cloze_hint', colloc: 'colloc_gap' };

function entriesOf(doc: Readonly<Record<string, unknown>>): Entry[] {
  const raw = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  const out: Entry[] = [];
  for (const h of raw) {
    if (!h || typeof h !== 'object') continue;
    const o = h as Record<string, unknown>;
    if (typeof o.t !== 'number' || !Number.isFinite(o.t)) continue;
    const ownX = typeof o.x === 'string' ? o.x : null;
    const x = ownX ?? (typeof o.m === 'string' ? (LEGACY_FORM[o.m] ?? null) : null);
    out.push({
      t: o.t,
      g: typeof o.g === 'number' && Number.isFinite(o.g) ? o.g : null,
      x,
      s: typeof o.s === 'string' && o.s ? o.s : null,
      u: o.u === 1,
      ci: typeof o.ci === 'number',
      legacy: ownX === null,
    });
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Abfragen mit Stütze (Anfangsbuchstabe, Bausteine, Partnerwort zur Auswahl) und ein Wort der Wendung als Lücke (`cloze_part`: nur Hilfe, nie freier Tag oder Satz-Beleg). `complete` (Satzanfang) zählt wie in `variety.ts` als frei. */
const SUPPORTED: ReadonlySet<string> = new Set(['cloze_hint', 'tiles', 'colloc_gap', 'cloze_part']);
/** Eigene Sätze (Claude prüft): sind per Definition ein neuer Satz. */
const OWN_SENTENCE: ReadonlySet<string> = new Set(['produce', 'act_scene', 'act_rewrite', 'act_impulse', 'act_combo', 'act_mail']);

/** `context` = Ursprungssatz der Karte (für „im neuen Satz“); fehlt er, gilt nur die Regel „zwei verschiedene Sätze“ oder „eigener Satz“. */
type StatusCard = Pick<TrainCard, 'isNew' | 'stage' | 'fsrs' | 'doc'> & { context?: { sentence: string } | null };

/** Abrufwahrscheinlichkeit nur, wenn sie etwas aussagt: nicht in Lernschritten und erst nach mindestens einem Tag Abstand. */
export function reliableR(c: Pick<TrainCard, 'isNew' | 'fsrs'>, nowMs: number): number | null {
  if (c.isNew || isLearningState(c.fsrs)) return null;
  const last = c.fsrs.last;
  if (typeof last !== 'number' || nowMs - last < DAY_MS) return null;
  return retrievability(c.fsrs, nowMs);
}

/** Eine gute freie Antwort (Note ≥ `FREE_MIN_GRADE`, nie „Schwer“; ohne Auswahl, ohne Stütze, geprüft; Treffer am Partnerwort und `cloze_part` zählen nicht). Wie `freeCorrectDays`, aber ohne die Stufe-4-Ausnahme für `cloze_part`. */
const isFreeCorrect = (h: Entry): boolean => h.x !== null && h.g !== null && h.g >= FREE_MIN_GRADE && !h.u && h.x !== 'cloze_part' && FREE_ANSWER.has(h.x) && !(h.x === 'colloc' && h.ci);

/** Der gemeinsame Beleg-Teil (ohne Uhrzeit): reicht für `isFest`. */
function evidence(c: StatusCard) {
  const hist = entriesOf(c.doc);
  const sentences = new Set<string>();
  const origin = c.context?.sentence ? sentKey(c.context.sentence) : null;
  let recognizes = false;
  let helped = false;
  let newSentence = false;
  let lastWrong: number | null = null;
  for (const h of hist) {
    if (h.g === 1) lastWrong = h.t;
    if (h.g === null || h.g < 2) continue;
    if (h.x === 'flip' || h.x === 'known' || (h.x !== null && !FREE_ANSWER.has(h.x) && !SUPPORTED.has(h.x))) recognizes = true;
    if (h.x !== null && (SUPPORTED.has(h.x) || FREE_ANSWER.has(h.x))) {
      helped = true;
      recognizes = true;
    }
    if (!isFreeCorrect(h)) continue;
    if (h.x !== null && OWN_SENTENCE.has(h.x)) newSentence = true;
    else if (h.s !== null) {
      sentences.add(h.s);
      if (origin !== null && h.s !== origin) newSentence = true;
    }
  }
  if (sentences.size >= 2) newSentence = true;
  // Alte Karten ohne Verlauf oder mit alten Einträgen: die Stufe sagt, was die alte App schon bestanden hat (Erkennen, Zuordnen, mit Stütze).
  // Neue Einträge mit `x` blockieren das nicht.
  if (hist.length === 0 || hist.some((h) => h.legacy)) {
    if (c.stage >= 1) recognizes = true;
    if (c.stage >= 3) helped = true;
  }
  const last = hist.length ? hist[hist.length - 1] : undefined;
  const na = typeof c.doc.na === 'number' && Number.isFinite(c.doc.na) ? c.doc.na : 0;
  const lastWasWrong = !!last && last.g === 1;
  const freeOn = (from: number): number => new Set(hist.filter((h) => h.t >= from && isFreeCorrect(h)).map((h) => dayKey(h.t))).size;
  const freeDays = freeOn(0);
  // Ein Fehler setzt den Beleg zurück: Erst wenn nach dem letzten Fehler an 2 verschiedenen Tagen wieder frei richtig geantwortet wurde, gilt die Karte nicht mehr als „unerholt“.
  const unrecovered = lastWrong !== null && freeOn(lastWrong) < SAFE_FREE_DAYS;
  const flipOnly = hist.length > 0 && hist.every((h) => h.x === 'flip' || h.x === 'known');
  return { recognizes, helped, newSentence, own: na > 0, lastWrong, lastWasWrong, unrecovered, freeDays, noHistory: hist.length === 0, flipOnly };
}

const festByEvidence = (c: StatusCard, e: ReturnType<typeof evidence>, r: number | null): boolean =>
  !c.isNew && c.stage >= FEST_STAGE && c.fsrs.stability >= FEST_DAYS && !isLearningState(c.fsrs) && !e.unrecovered && (e.newSentence || e.own) && !(r !== null && r < WOBBLY_R);

/** Erfüllt die Karte (ohne `hidden`) die Fest-Regel? Auch für den Schreibweg (`ff`, erster Fest-Tag) mit dem Stand nach der Antwort. */
export const isFestState = (c: StatusCard, nowMs?: number): boolean => festByEvidence(c, evidence(c), nowMs === undefined ? null : reliableR(c, nowMs));

/**
 * Sitzt die Karte fest? Neue und ausgeblendete Karten nie (siehe Kopf der Datei). Mit `nowMs` gilt zusätzlich: nach sehr langer Pause
 * (Abrufwahrscheinlichkeit belastbar unter 70 %) ist die Karte nicht mehr fest, sondern wackelt. Alle Zähler übergeben `nowMs`, damit
 * Zahl und Zustand dasselbe sagen.
 */
export const isFestCard = (c: StatusCard & Pick<TrainCard, 'hidden'>, nowMs?: number): boolean => !c.hidden && isFestState(c, nowMs);

/** Der Beleg-Teil einer Karte (ohne Uhrzeit), zum Zwischenspeichern je Dokument (Lernermodell, `learner.ts`). */
export type CardEvidence = ReturnType<typeof evidence>;
export const cardEvidence = (c: StatusCard): CardEvidence => evidence(c);

/** Der Status einer Karte zum Zeitpunkt `nowMs`. */
export function cardStatus(c: StatusCard, nowMs: number): CardStatus {
  return cardStatusFrom(c, evidence(c), nowMs);
}

/** Wie `cardStatus`, mit schon gerechnetem Beleg-Teil (`cardEvidence` derselben Karte). Gleiches Ergebnis. */
export function cardStatusFrom(c: StatusCard, e: CardEvidence, nowMs: number): CardStatus {
  const r = reliableR(c, nowMs);
  let mind: Mind = 'none';
  if (!c.isNew) {
    if (r === null) mind = 'noGap';
    else if (r < FORGOTTEN_R) mind = 'forgotten';
    else if (r < WOBBLY_R || (e.unrecovered && (c.stage >= WOBBLY_FROM_STAGE || e.freeDays >= SAFE_FREE_DAYS))) mind = 'shaky';
    else mind = 'good';
  }
  // Wackelt: Stufe ≥ 4 – oder eine Karte, die nach ihrem Beleg „Sicher“ wäre (2 freie Tage): „Sicher“ und „Jetzt im Kopf: wackelig“ zugleich gibt es nie.
  const wobbly = !c.isNew && (c.stage >= WOBBLY_FROM_STAGE || e.freeDays >= SAFE_FREE_DAYS) && (e.unrecovered || (r !== null && r < WOBBLY_R));
  let tier: UnitState;
  if (c.isNew) tier = 'new';
  else if (festByEvidence(c, e, r)) tier = 'firm';
  else if (wobbly) tier = 'wobbly';
  else if (e.freeDays >= SAFE_FREE_DAYS && !isLearningState(c.fsrs) && !e.unrecovered) tier = 'safe';
  else tier = 'learning';
  return { tier, recognizes: e.recognizes, helped: e.helped, freeDays: e.freeDays, newSentence: e.newSentence, own: e.own, mind, r, lastWrong: e.lastWrong, lastWasWrong: e.lastWasWrong, unrecovered: e.unrecovered, noHistory: e.noHistory, flipOnly: e.flipOnly };
}
