import { packExtraOf } from '../c1pack/packFields';
import { meaningForTask } from './cards';
import { activationReady } from './brief';
import { gapUsable, lemmaFor } from './gapFit';
import { familyFrom, hasPartner, trapTask } from './partner';
import { distinctForms, familyOf, FEST_MIN_FORMS, varietyBias, varietyOf } from './variety';
import type { Counts, ExerciseId, InputKind, Lang, LegacyMode, Stage, TrainCard } from './types';

// Katalog der Abfragearten (phase1-plan §4.2, Lernplattform 2.0 §4.8). Jede Art gehört fest zu einer Stufe (`also`: auch zu
// weiteren); `level` ist die Stufe der alten App für `nextStage`. Jede Stufe hat für jedes Profil (touch/keys × mit/ohne
// Sprachausgabe × mit/ohne KI) mindestens zwei Arten (Kap. 15):
//   1 mc_en, ctx_mc, listen_mc (Hören)   2 mc_de, match   3 cloze_hint, colloc_gap, complete (mit Satzanfang)
//   4 cloze, colloc (getippt), wordfam, find_trap, type (nur ohne Satz), situation
//   5 cloze im neuen Satz (Satzwechsel), produce „Eigener Satz“ (KI; auch am Handy, Wörter aktivieren Stufe 1), dictation (Hören)
// „Eigener Satz“ ist EINE Art (`produce`): „Satz vervollständigen“ ohne Satzanfang gibt es nicht mehr, `complete` braucht einen Satzanfang aus dem Paket.

export type ExerciseDef = { ex: ExerciseId; stage: Stage; level: number; mode: LegacyMode; input: InputKind; also?: readonly Stage[] };

export const CATALOG: readonly ExerciseDef[] = [
  { ex: 'mc_en', stage: 1, level: 1, mode: 'recog', input: 'choice' },
  { ex: 'ctx_mc', stage: 1, level: 1, mode: 'recog', input: 'choice' },
  { ex: 'spot', stage: 1, level: 1, mode: 'recog', input: 'spot' },
  { ex: 'listen_mc', stage: 1, level: 1, mode: 'recog', input: 'choice' },
  { ex: 'mc_de', stage: 2, level: 2, mode: 'recog', input: 'choice' },
  { ex: 'match', stage: 2, level: 2, mode: 'recog', input: 'choice' },
  { ex: 'cloze_hint', stage: 3, level: 3, mode: 'cloze', input: 'typed' },
  { ex: 'colloc_gap', stage: 3, level: 3, mode: 'colloc', input: 'choice' },
  { ex: 'complete', stage: 3, level: 3, mode: 'type', input: 'sentence', also: [5] },
  { ex: 'tiles', stage: 3, level: 3, mode: 'cloze', input: 'tiles' },
  { ex: 'cloze', stage: 4, level: 4, mode: 'type', input: 'typed', also: [5] },
  { ex: 'colloc', stage: 4, level: 4, mode: 'colloc', input: 'typed' },
  { ex: 'wordfam', stage: 4, level: 4, mode: 'type', input: 'typed' },
  { ex: 'find_trap', stage: 4, level: 4, mode: 'recog', input: 'spot' },
  { ex: 'type', stage: 4, level: 4, mode: 'type', input: 'typed' },
  { ex: 'situation', stage: 4, level: 4, mode: 'type', input: 'typed' },
  { ex: 'dictation', stage: 5, level: 5, mode: 'listen', input: 'typed' },
  { ex: 'speed', stage: 5, level: 5, mode: 'type', input: 'typed' },
  { ex: 'produce', stage: 5, level: 5, mode: 'produce', input: 'produce' },
  // Anki „Aufdecken“ (architektur.md §4.2): Stufe 0, damit die Nachbarstufen-Suche es nie findet;
  // `supports` liefert immer `false`. Ohne Eintrag fiele `exerciseDef('flip')` still auf `mc_en` zurück.
  { ex: 'flip', stage: 0, level: 2, mode: 'recog', input: 'flip' },
  // P52 „Welches Wort passt?“ (Kontrast-Satz von Claude): ebenfalls Stufe 0, nie automatisch gewählt; die Runde setzt sie höchstens 1× ein.
  { ex: 'contrast', stage: 0, level: 2, mode: 'recog', input: 'choice' },
  // Wörter aktivieren, Stufe 2: Aktivierungs-Aufgaben A2–A5. Stufe 0 (nie automatisch gewählt, nur der Fahrplan setzt sie ein), Eingabe wie „Eigener Satz“.
  { ex: 'act_scene', stage: 0, level: 5, mode: 'produce', input: 'produce' },
  { ex: 'act_rewrite', stage: 0, level: 5, mode: 'produce', input: 'produce' },
  { ex: 'act_impulse', stage: 0, level: 5, mode: 'produce', input: 'produce' },
  { ex: 'act_combo', stage: 0, level: 5, mode: 'produce', input: 'produce' },
  { ex: 'act_mail', stage: 0, level: 5, mode: 'produce', input: 'produce' },
];

/**
 * Was die Umgebung kann: Sprachausgabe, KI und das Eingabeprofil. `listen` = `tts && !touch` (Hören gibt es nur mit Tastatur,
 * Kap. 6 Geräte-Matrix). Der eigene Satz (`produce`) geht auch am Handy (Wörter aktivieren Stufe 1: kurze Sätze genügen).
 * Das Profil wird je Runde einmal eingefroren.
 */
export type ExerciseEnv = { tts: boolean; ai: boolean; touch?: boolean; listen?: boolean };
export const NO_ENV: ExerciseEnv = { tts: false, ai: false, touch: false, listen: false };
export const makeEnv = (tts: boolean, ai: boolean, touch: boolean): ExerciseEnv => ({ tts, ai, touch, listen: tts && !touch });
/** Hören nur mit Sprachausgabe und Tastatur-Profil (ohne Angabe des Profils wie bisher: Sprachausgabe genügt). */
export const canListen = (env: ExerciseEnv): boolean => env.listen ?? (env.tts && !env.touch);

export const exerciseDef = (ex: ExerciseId): ExerciseDef => CATALOG.find((d) => d.ex === ex) ?? (CATALOG[0] as ExerciseDef);

/** Aus der Wörter-Leiter entfernte Arten: nie verfügbar, alte Daten bleiben lesbar. */
export const RETIRED: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['spot', 'speed', 'tiles']);

/** Arten, die für Wendungen nicht taugen (phase1-plan §4.2, Spalte „Chunk"). */
const NOT_FOR_CHUNKS: ReadonlySet<ExerciseId> = new Set(['spot', 'wordfam']);

/** Ursprungssatz vorhanden und als Lücke brauchbar (verdeckt genau das Wort der Karte, `gapFit.ts`)? */
const gapOk = (card: TrainCard): boolean => !!card.context && gapUsable(card.context, lemmaFor(card));

/** Was eine Übungsart an Kartendaten und Umgebung braucht. */
export function supports(card: TrainCard, ex: ExerciseId, lang: Lang, poolSize: number, env: ExerciseEnv = NO_ENV): boolean {
  const meaning = meaningForTask(card, lang);
  if (RETIRED.has(ex)) return false;
  if (card.kind === 'chunk' && NOT_FOR_CHUNKS.has(ex)) return false;
  switch (ex) {
    case 'mc_en':
    case 'mc_de':
    case 'match':
      return !!meaning && poolSize >= 3;
    case 'ctx_mc':
      return !!meaning && !!card.context && poolSize >= 3;
    case 'listen_mc':
      return canListen(env) && !!meaning && poolSize >= 3;
    case 'spot':
      return !!meaning && !!card.context;
    case 'type':
      // „nur ohne Satz“: mit Ursprungssatz übt die Lücke (`cloze`) dasselbe im Zusammenhang.
      // Auch dann, wenn der Satz als Lücke nicht taugt (Lücke verdeckt ein beliebiges Objekt, `gapFit.ts`): die Karte bleibt abfragbar.
      return !!meaning && !gapOk(card);
    case 'speed':
      return !!meaning;
    case 'cloze_hint':
    case 'cloze':
      return gapOk(card);
    case 'tiles':
      return gapOk(card) || !!meaning;
    case 'colloc_gap':
    case 'colloc':
      return hasPartner(card);
    case 'complete':
      // Nur mit Satzanfang aus dem Paket. Ohne Anfang ist es ein eigener Satz und heißt `produce`.
      return !!meaning && (packExtraOf(card)?.starts?.length ?? 0) > 0;
    case 'wordfam':
      return gapOk(card) && familyFrom(card) !== null;
    case 'find_trap':
      return trapTask(card) !== null;
    case 'situation':
      return card.kind === 'chunk' && !!card.chunk?.scene && !!meaning;
    case 'dictation':
      return canListen(env) && gapOk(card);
    case 'produce':
      // Leitplanke (Barcroft, tagesaufbau.md T2): nie bei einer Karte, die noch nicht an mindestens zwei Tagen richtig abgerufen wurde.
      return env.ai && !!meaning && activationReady(card);
    case 'flip':
    case 'contrast':
    case 'act_scene':
    case 'act_rewrite':
    case 'act_impulse':
    case 'act_combo':
    case 'act_mail':
      return false;
  }
}

const inStage = (d: ExerciseDef, k: number): boolean => d.stage === k || (d.also?.includes(k as Stage) ?? false);

/**
 * Verfügbare Arten für die Stufe der Karte. Sind es weniger als 2, kommen Arten der Nachbarstufen
 * dazu (erst höher, dann tiefer, in Katalogreihenfolge) – so gibt es je Stufe mindestens zwei, wo möglich.
 */
export function availableExercises(card: TrainCard, lang: Lang, poolSize: number, env: ExerciseEnv = NO_ENV): ExerciseId[] {
  const k = Math.max(1, card.stage);
  const ok = (d: ExerciseDef) => supports(card, d.ex, lang, poolSize, env);
  const out = CATALOG.filter((d) => inStage(d, k) && ok(d)).map((d) => d.ex);
  for (let dist = 1; out.length < 2 && dist <= 4; dist++) {
    for (const s of [k + dist, k - dist]) {
      for (const d of CATALOG) {
        if (out.length >= 2) break;
        if (inStage(d, s) && ok(d) && !out.includes(d.ex)) out.push(d.ex);
      }
    }
  }
  return out;
}

const score = (c: Counts) => (c.c + 1) / (c.c + c.w + 2);

// Abfrageart nach der Schwäche der Karte (Auswertung 15.10.2026, Punkt 4): Erkennen (Auswahl, Aufdecken) lief auf 98,7 % (Deckeneffekt), Produzieren auf 50–68 %.
// Die App wich der schwachen Art aus (20 Erkennungen gegen 3 Produktionen). Ab Stufe 3 zählen Auswahlarten deshalb nur noch, wenn nichts Freieres da ist,
// und eine Karte, die erkannt, aber nicht produziert wird, bekommt auch Abfragen der nächsthöheren Stufe, die sie produzieren lassen.
/** Aufschlag auf die Rangzahl einer Auswahl-Art bei Karten ab Stufe 3 (größer = seltener). */
export const CHOICE_PENALTY = 0.3;
/** Abschlag für eine Produktions-Art bei einer Karte, die im Produzieren hinter dem Erkennen liegt. */
export const PRODUCTION_BOOST = 0.15;
const isChoiceEx = (ex: ExerciseId): boolean => {
  const input = exerciseDef(ex).input;
  return input === 'choice' || input === 'spot' || input === 'flip';
};
/** Getippte oder selbst gebildete Arten (ohne Auswahl, ohne Bausteine); `produce` und die Aktivierungen kommen nur über den Fahrplan. */
const isProductionEx = (ex: ExerciseId): boolean => {
  const def = exerciseDef(ex);
  return def.stage > 0 && (def.input === 'typed' || def.input === 'sentence') && ex !== 'produce';
};
const sumCounts = (card: TrainCard, modes: readonly LegacyMode[]): Counts => modes.reduce<Counts>((a, m) => ({ c: a.c + (card.modes[m]?.c ?? 0), w: a.w + (card.modes[m]?.w ?? 0) }), { c: 0, w: 0 });
/** Liegt die Karte im Produzieren hinter dem Erkennen (oder wurde noch kaum produziert, obwohl oft erkannt)? */
export function productionWeak(card: TrainCard): boolean {
  const recog = sumCounts(card, ['recog']);
  const prod = sumCounts(card, ['cloze', 'type', 'colloc', 'listen', 'produce']);
  const rn = recog.c + recog.w;
  const pn = prod.c + prod.w;
  if (rn < 4) return false;
  if (pn < 2) return true;
  return prod.c / pn < recog.c / rn - 0.15;
}

function countsFor(card: TrainCard, ex: ExerciseId): Counts {
  return card.xs[ex] ?? card.modes[exerciseDef(ex).mode] ?? { c: 0, w: 0 };
}

/**
 * Die Art, die diese Karte am schlechtesten kann (Laplace-geglättet). Gleichstand (< 0,05):
 * zuerst eine andere Art als zuletzt an dieser Karte (Art, sonst Modus), dann keine der beiden
 * vorigen Arten der Runde, dann die Katalogreihenfolge.
 */
export function chooseExercise(card: TrainCard, lang: Lang, poolSize: number, recent: readonly ExerciseId[] = [], env: ExerciseEnv = NO_ENV): ExerciseId | null {
  const v = varietyOf(card.doc);
  const all = availableExercises(card, lang, poolSize, env);
  if (!all.length) return null;
  // Vorbereitung auf „Fest“ (V1): Eine Karte ab Stufe 4 mit weniger als drei verschiedenen Formenfamilien im Verlauf bekommt, wenn ihre Stufe nicht genug
  // Familien anbietet, Arten der Nachbarstufe dazu (erst die höhere, bei Stufe 5 die darunter). Nur die Auswahl; die Fest-Definition bleibt unberührt.
  if (card.stage >= 4 && distinctForms(v) < FEST_MIN_FORMS && new Set(all.map(familyOf)).size < FEST_MIN_FORMS) {
    const near = availableExercises({ ...card, stage: card.stage >= 5 ? 4 : ((card.stage + 1) as 5) }, lang, poolSize, env);
    for (const ex of near) if (!all.includes(ex)) all.push(ex);
  }
  // Schwäche im Produzieren: Arten der nächsthöheren Stufe, die produzieren lassen, kommen als Kandidaten dazu (Aufstieg nur mit freien Antworten, Punkt 4).
  const weakProd = card.stage >= 2 && productionWeak(card);
  if (weakProd) {
    const up = availableExercises({ ...card, stage: Math.min(5, card.stage + 1) as Stage }, lang, poolSize, env).filter((ex) => isProductionEx(ex) && !all.includes(ex));
    all.push(...up);
  }
  // Varianz (V1): dieselbe Art wie bei der letzten Antwort dieser Karte kommt nie zweimal in Folge, solange es eine andere gibt.
  const others = card.lastEx ? all.filter((ex) => ex !== card.lastEx) : all;
  const avail = others.length ? others : all;
  const ranked = avail
    .map((ex, i) => ({ ex, i, s: score(countsFor(card, ex)) + varietyBias(ex, v, card.stage) + (card.stage >= 3 && isChoiceEx(ex) ? CHOICE_PENALTY : 0) - (weakProd && isProductionEx(ex) ? PRODUCTION_BOOST : 0) }))
    .sort((a, b) => a.s - b.s || a.i - b.i);
  const best = ranked[0];
  if (!best) return null;
  const tied = ranked.filter((r) => r.s - best.s < 0.05);
  const lastRecent = recent.slice(-2);
  const wasLast = (ex: ExerciseId) => (card.lastEx ? card.lastEx === ex : exerciseDef(ex).mode === card.lastMode);
  tied.sort((a, b) => {
    const la = wasLast(a.ex) ? 1 : 0;
    const lb = wasLast(b.ex) ? 1 : 0;
    if (la !== lb) return la - lb;
    const ra = lastRecent.includes(a.ex) ? 1 : 0;
    const rb = lastRecent.includes(b.ex) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return a.s - b.s || a.i - b.i;
  });
  return tied[0]?.ex ?? best.ex;
}
