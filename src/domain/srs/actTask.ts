import { hash32, mulberry32 } from '../random';
import { activationCodesOf, fmtOfCode, HIDES_TARGET, MULTI_TARGET, NEEDS_SOURCE, parseActCode, pickActBrief, STEP_FMTS, vectorOf, type ActBrief, type ActFmt, type ActStep } from './actBrief';
import type { ToneId } from './brief';
import { recallDays } from './brief';
import { meaningForTask } from './cards';
import { contextsOf } from './rotate';
import type { CardKind, ExerciseId, Lang, TrainCard } from './types';
import { leastRecent } from './variety';

// Eine Aktivierungs-Aufgabe A2–A5 (Wörter aktivieren, Stufe 2) als reine Beschreibung: Format, Vorgaben, Zielwörter, Quelle. Die Oberfläche setzt daraus
// den Text zusammen (Anweisung in drei Wortlauten, Marken, Quelle); gespeichert wird nur der Code der Vorgabe (`hist[].a`) und der Eintrag in `act/…`.

export type ActTarget = {
  key: string;
  id: string;
  word: string;
  lemma: string;
  kind: CardKind;
  de: string | null;
  def: string | null;
  /** Bedeutung für die Anzeige in der Oberflächensprache (mit Rückfall auf die andere). */
  meaning: string | null;
};

/** Quelle beim Umformen (A3): früherer eigener Satz (geprüft, `own`) oder Beispielsatz der Karte. */
export type ActSource = { text: string; own: boolean; day: string | null; tone: ToneId };

export type ActTask = ActBrief & {
  step: ActStep;
  /** Erhaltungs-Aktivierung (A4) nach dem vollen Fahrplan. */
  maintenance: boolean;
  /** Zielwörter; das erste gehört zur Karte der Aufgabe (nur sie bekommt die Note). */
  targets: ActTarget[];
  /** Wird das Zielwort in der Anweisung genannt? (A4: nein.) */
  showTarget: boolean;
  source: ActSource | null;
};

/** Ein früher geprüfter eigener Satz der Karte (aus `act/…`), für Quelle und Neuheitsprüfung. */
export type OwnSentence = { id: string; text: string; day: string; code: string; reusable: boolean };

export const EX_OF_FMT: Readonly<Record<ActFmt, ExerciseId>> = {
  sc: 'act_scene',
  tw: 'act_rewrite',
  rw: 'act_rewrite',
  ex: 'act_rewrite',
  im: 'act_impulse',
  lg: 'act_impulse',
  kb: 'act_combo',
  ml: 'act_mail',
};

const targetOf = (c: TrainCard, lang: Lang): ActTarget => ({ key: c.key, id: c.id, word: c.word, lemma: c.lemma, kind: c.kind, de: c.de, def: c.def, meaning: meaningForTask(c, lang) });

/** Kann diese Karte Zielwort-Partner einer Kombi-Aufgabe sein? Vokabel, sichtbar, Bedeutung da, schon sicher abgerufen. */
const partnerOk = (c: TrainCard, base: TrainCard, lang: Lang): boolean =>
  c.kind === 'vocab' && !c.hidden && c.key !== base.key && c.lemma !== base.lemma && c.stage >= 3 && recallDays(c.doc) >= 2 && !!meaningForTask(c, lang) && !c.isNew;

/** Partnerkarten für Kombi-Sätze und Kundenmails: fällige zuerst (sie brauchen es), dann feste Reihenfolge; die Wahl ist ein Hash aus Karte und Tag. */
export function pickPartners(card: TrainCard, pool: readonly TrainCard[], day: string, lang: Lang, count: number): TrainCard[] {
  const ok = pool.filter((c) => partnerOk(c, card, lang)).sort((a, b) => a.fsrs.due - b.fsrs.due || a.key.localeCompare(b.key));
  const out: TrainCard[] = [];
  const rng = mulberry32(hash32(`${card.key}|${day}|partners`));
  const top = ok.slice(0, Math.max(count * 4, 6));
  while (out.length < count && top.length) out.push(top.splice(Math.floor(rng() * top.length), 1)[0] as TrainCard);
  return out;
}

/** Mehr als so viele Zielwörter trägt keine Aufgabe (Kundenmail: 2–3). */
export const ACT_MAX_TARGETS = 3;

/** Steckt ein Wort der Grundform (ab vier Buchstaben, ohne die letzten beiden) im Text? Dann verrät der Text das Wort. */
const spoils = (text: string, lemma: string): boolean => {
  const t = text.toLowerCase();
  return lemma
    .toLowerCase()
    .split(/\s+/)
    .some((w) => w.replace(/[^a-z]/g, '').length >= 4 && t.includes(w.replace(/[^a-z]/g, '').slice(0, Math.max(4, w.replace(/[^a-z]/g, '').length - 2))));
};

/**
 * Bedeutung für Aufgaben ohne gezeigtes Zielwort (A4): „Deutscher Impuls“ nimmt zuerst die deutsche, „Lage ohne Wort“ zuerst die englische Bedeutung
 * (jeweils in der Oberflächensprache, wenn die Karte beide hat). Verrät eine das Wort, nimmt sie die andere; verrät keine, gibt es keine (`null`).
 */
export function actMeaning(t: Pick<ActTarget, 'de' | 'def' | 'meaning' | 'lemma'>, fmt: ActFmt, lang: Lang): string | null {
  const pref = fmt === 'im' ? [lang === 'en' ? t.def : t.de, lang === 'en' ? t.de : t.def] : [t.def, t.de];
  const own = t.meaning;
  const all = [...pref, own].filter((m): m is string => !!m && !!m.trim());
  return all.find((m) => !spoils(m, t.lemma)) ?? null;
}

const SOURCE_MIN_WORDS = 4;

/**
 * Quelle für Umformen: der jüngste geprüfte eigene Satz, der das Wort enthält (Wiederverwendung, nur `reusable`); sonst ein Satz der Karte (Ursprungssatz
 * oder gespeicherter Beispielsatz, in dem das Wort steht). `null`, wenn es nichts gibt.
 */
export function pickSource(card: TrainCard, own: readonly OwnSentence[], key: string): ActSource | null {
  const mine = [...own].filter((o) => o.reusable && o.text.split(/\s+/).length >= SOURCE_MIN_WORDS).sort((a, b) => b.day.localeCompare(a.day) || b.id.localeCompare(a.id));
  const o = mine[0];
  if (o) return { text: o.text, own: true, day: o.day, tone: parseActCode(o.code)?.tone ?? (vectorOf(o.code)?.tone as ToneId | undefined) ?? '-' };
  const ctxs = contextsOf(card).filter((c) => c.sentence.split(/\s+/).length >= SOURCE_MIN_WORDS);
  if (!ctxs.length) return null;
  const c = ctxs[hash32(`${key}|src`) % ctxs.length] as (typeof ctxs)[number];
  return { text: c.sentence, own: false, day: null, tone: '-' };
}

export type BuildIn = {
  card: TrainCard;
  step: Exclude<ActStep, 1>;
  maintenance: boolean;
  pool: readonly TrainCard[];
  day: string;
  lang: Lang;
  /** Frühere eigene Sätze dieser Karte (aus `act/…`). */
  own: readonly OwnSentence[];
};

/**
 * Baut die Aufgabe für einen Schritt. Das Format wechselt reihum (am längsten nicht benutzt); fehlt für ein Format, was es braucht (Quelle, Partnerkarte),
 * fällt es auf die anderen Formate desselben Schritts zurück, A3 ohne jede Quelle auf die Mini-Szene. `null`, wenn gar nichts geht (z. B. keine Bedeutung).
 */
export function buildActTask(i: BuildIn): ActTask | null {
  const { card, step, pool, day, lang } = i;
  if (card.kind !== 'vocab' || !meaningForTask(card, lang)) return null;
  const used = activationCodesOf(card.doc);
  const source = pickSource(card, i.own, card.key);
  const partners = pickPartners(card, pool, day, lang, 2);
  const can = (f: ActFmt): boolean => (NEEDS_SOURCE.has(f) ? !!source : f === 'kb' ? partners.length >= 1 : f === 'ml' ? partners.length >= 1 : true);
  let fmts = STEP_FMTS[step].filter(can);
  if (!fmts.length && step === 3) fmts = ['sc'];
  if (!fmts.length && step === 5) fmts = STEP_FMTS[4].filter(can);
  if (!fmts.length) return null;
  const fmt = leastRecent(fmts, (f) => f, used.map((c) => fmtOfCode(c)).filter((f): f is ActFmt => f !== null && f !== 'pr'), hash32(`${card.key}|${day}|fmt`)) as ActFmt;
  const nTargets = fmt === 'kb' ? 2 : fmt === 'ml' ? (partners.length >= 2 && hash32(`${card.key}|${day}|n`) % 2 === 1 ? 3 : 2) : 1;
  const targets = [targetOf(card, lang), ...partners.slice(0, nTargets - 1).map((c) => targetOf(c, lang))];
  const src = NEEDS_SOURCE.has(fmt) ? source : null;
  const brief = pickActBrief(fmt, card.key, day, used, { lemmas: targets.map((t) => t.lemma), card, sourceTone: src?.tone ?? null });
  const stepOfTask: ActStep = step;
  return { ...brief, step: stepOfTask, maintenance: i.maintenance, targets, showTarget: !HIDES_TARGET.has(fmt), source: src };
}

export const isMulti = (fmt: ActFmt): boolean => MULTI_TARGET.has(fmt);
