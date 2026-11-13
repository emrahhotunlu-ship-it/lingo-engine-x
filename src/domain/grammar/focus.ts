import { TOPICS, topicById } from '../content';
import { daysBetween } from '../date';
import type { GrammarTaskType } from '../learn/types';
import { patsOf } from '../metrics/pattern';
import { topicP } from './bkt';
import { familyOf, patternsOf } from './patterns';
import { isNewTopic, nextNewTopic, pathTopics } from './path';

// Fokus-Thema (Großpaket P „Politur“, P3; Emrahs Entscheidung E1 „A“ vom 13.11.2026): eine Runde = EIN Thema über mehrere Tage.
// Am ersten Tag eine kurze Regel (Einführungskarten, höchstens 2 Muster), dann leicht → schwer in vier Stufen; das Thema bleibt, bis es sitzt.
//   1 Verstehen  Auswahl, Bedeutungspaar, Lücke mit Stütze
//   2 Bilden     Lücken ohne Stütze, 1 Fehler finden
//   3 Umformen   Fehler finden, Umformung (die erste mit Bausteinen)
//   4 Mischen    alle Formen, im Wechsel mit dem Verwechslungs-Partner (`path.json` families)
// Aufstieg: 3 saubere Antworten in Folge (richtig, erster Versuch, ohne Hilfe) in der Stufe, höchstens eine Stufe je Lerntag.
// Abstieg: 2 Fehler am selben Muster am selben Lerntag → eine Stufe leichter (die Mini-Lektion zeigt die Tutor-Engine).
// „Sitzt“: Stufe 4 bestanden UND Beherrschung ≥ 0,8. Danach wählt `focusPick` das nächste Thema – nie mitten in einer Stufe.
// Gespeichert wird nur das ergänzende Feld `grammar/<thema>.fo` (tolerant gelesen, ältere App-Versionen übergehen es). Rein: Zeit kommt als Parameter.

type Doc = Readonly<Record<string, unknown>>;

export type FocusStage = 1 | 2 | 3 | 4;
export const FOCUS_STAGES = 4;
export const STAGE_UP_CLEAN = 3;
export const STAGE_DOWN_WRONG = 2;
/** Ab dieser Beherrschung (mit bestandener Stufe „Mischen“) sitzt das Thema. */
export const FOCUS_SITS_P = 0.8;
/** Unter dieser Beherrschung hat ein begonnenes Thema klaren Bedarf (Vorrang vor dem Kapitel-Thema). */
export const FOCUS_WEAK_P = 0.7;
/** Sicherheitsventil: nach so vielen Lerntagen ohne „sitzt“ ruht das Thema und ein anderes ist dran. */
export const FOCUS_MAX_DAYS = 10;
export const FOCUS_REST_DAYS = 7;
/** Themen, deren Bedarf so dicht am größten liegt, gelten als gleich dringend: dann entscheidet die Lehrreihenfolge. */
export const NEED_BAND = 0.1;
/** Ein eben abgeschlossenes Thema wird so viele Tage nicht wieder Fokus (es kommt im Aufwärmen wieder). */
export const FOCUS_DONE_REST_DAYS = 21;

/** `grammar/<thema>.fo` (nur ergänzend). */
export type FocusState = {
  v: 1;
  /** Stufe 1 bis 4. */
  s: FocusStage;
  /** Saubere Antworten in Folge in dieser Stufe (0 bis 3). */
  k: number;
  /** Erster Lerntag dieses Laufs. */
  d0: string;
  /** Letzter Lerntag mit einer Fokus-Antwort. */
  d: string;
  /** Lerntage in diesem Lauf. */
  n: number;
  /** Lerntag des letzten Aufstiegs (höchstens einer je Lerntag). */
  u?: string;
  /** Fehler am selben Muster am selben Lerntag: Muster, Zahl, Tag. */
  w?: { p: string; n: number; d: string };
  /** Stufe „Verstehen“ bei Themen mit mehreren Einführungsschritten: Lerntag, an dem der aktuelle Schritt (≤ 2 Muster) saß; am nächsten Lerntag kommt der nächste Schritt mit seiner Regel. */
  gp?: string;
  /** Stufe „Mischen“ bestanden (wartet nur noch auf die Beherrschung). */
  m?: 1;
  /** Lerntag, an dem das Thema „sitzt“ (Lauf beendet). */
  ok?: string;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);
const int = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Tolerant lesen: ein unlesbares Feld ist „kein Lauf“ (das Thema bleibt gültig, nichts wird verworfen). */
export function readFocus(doc: Doc | undefined | null): FocusState | null {
  const o = doc?.fo;
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const f = o as Record<string, unknown>;
  const s = int(f.s, 1, FOCUS_STAGES);
  if (s === null || !isDay(f.d0) || !isDay(f.d)) return null;
  const out: FocusState = { v: 1, s: s as FocusStage, k: int(f.k, 0, STAGE_UP_CLEAN) ?? 0, d0: f.d0, d: f.d, n: int(f.n, 1, 9999) ?? 1 };
  if (isDay(f.u)) out.u = f.u;
  const w = f.w && typeof f.w === 'object' && !Array.isArray(f.w) ? (f.w as Record<string, unknown>) : null;
  if (w && typeof w.p === 'string' && w.p && isDay(w.d)) out.w = { p: w.p.slice(0, 80), n: int(w.n, 1, 99) ?? 1, d: w.d };
  if (isDay(f.gp)) out.gp = f.gp;
  if (f.m === 1) out.m = 1;
  if (isDay(f.ok)) out.ok = f.ok;
  return out;
}

/**
 * Speicherform von `fo`: IMMER der ganze feste Schlüsselsatz. `update` führt verschachtelte Objekte zusammen und kann Schlüssel nicht entfernen
 * (contract/db.d.ts) – ein „nicht gesetzt“ steht deshalb ausdrücklich als `null` bzw. 0 da, sonst bliebe ein alter Wert (z. B. `ok`) stehen.
 */
export function focusDoc(st: FocusState): Record<string, unknown> {
  return { v: 1, s: st.s, k: st.k, d0: st.d0, d: st.d, n: st.n, u: st.u ?? null, w: st.w ? { p: st.w.p, n: st.w.n, d: st.w.d } : null, gp: st.gp ?? null, m: st.m ?? 0, ok: st.ok ?? null };
}

/** Läuft der Fokus-Lauf (noch nicht „sitzt“)? */
export const focusOpen = (st: FocusState | null): st is FocusState => !!st && !st.ok;

/** Ruht das Thema gerade (Sicherheitsventil: zu viele Lerntage ohne „sitzt“, bis `FOCUS_REST_DAYS` nach dem letzten Tag)? */
export function focusResting(st: FocusState | null, today: string): boolean {
  if (!focusOpen(st) || st.n < FOCUS_MAX_DAYS || st.d >= today) return false;
  return daysBetween(st.d, today) < FOCUS_REST_DAYS;
}

/** Stufe, in der das Thema heute geübt wird (ohne Lauf: 1). */
export const stageOf = (st: FocusState | null): FocusStage => (focusOpen(st) ? st.s : 1);

/** Zeigt die Runde vorn die kurze Regel? Am ersten Tag eines Laufs, bevor eine Fokus-Antwort gegeben wurde. */
export const ruleDue = (st: FocusState | null): boolean => !focusOpen(st);

export type FocusFact = {
  day: string;
  /** Richtig, im ersten Versuch und ohne Hilfe. */
  clean: boolean;
  /** Falsch (auch „Weiß ich nicht“ und richtig erst nach Hinweis). */
  wrong: boolean;
  pat: string | null;
  /** Beherrschung des Themas NACH dieser Antwort. */
  p: number;
  /** Stufe, für die die Aufgabe gewählt wurde. */
  stage: FocusStage;
  /** Nach dieser Antwort sind noch Einführungsschritte des Themas offen (`groupsLeft`): „Verstehen“ geht dann mit dem nächsten Schritt weiter. */
  more?: boolean;
};

/** Was die Antwort am Lauf geändert hat (für die Runde: Rest neu wählen, Abschluss-Zeile). */
export type FocusMove = 'none' | 'up' | 'down' | 'sits';

/**
 * Eine Fokus-Antwort buchen (rein; `write.ts` rechnet damit auf dem frischen Stand, die Runde auf ihrer Kopie). Ohne Lauf beginnt einer bei
 * Stufe 1; ein abgeschlossener Lauf (`ok`) beginnt neu – frühestens am nächsten Lerntag (am Tag von `ok` ändert eine Antwort nichts). Nach der Ruhe des Sicherheitsventils zählen die Lerntage neu.
 */
export function focusStep(cur: FocusState | null, a: FocusFact): { next: FocusState; move: FocusMove } {
  // Am Tag, an dem das Thema „sitzt“, bleibt der Lauf abgeschlossen: die restlichen Fokus-Aufgaben derselben Runde beginnen keinen neuen Lauf.
  if (cur?.ok && cur.ok === a.day) return { next: cur, move: 'none' };
  let st: FocusState = focusOpen(cur) ? { ...cur } : { v: 1, s: 1, k: 0, d0: a.day, d: a.day, n: 1 };
  if (st.d !== a.day) {
    const rested = st.n >= FOCUS_MAX_DAYS && daysBetween(st.d, a.day) >= FOCUS_REST_DAYS;
    st = { ...st, d: a.day, n: rested ? 1 : st.n + 1, ...(rested ? { d0: a.day } : {}) };
    delete st.w;
    delete st.gp;
  }
  let move: FocusMove = 'none';
  if (a.wrong) {
    st.k = 0;
    const same = !!a.pat && st.w?.p === a.pat && st.w.d === a.day;
    const n = same ? (st.w?.n ?? 0) + 1 : 1;
    if (a.pat) st.w = { p: a.pat, n, d: a.day };
    if (a.pat && n >= STAGE_DOWN_WRONG && st.s > 1) {
      st.s = (st.s - 1) as FocusStage;
      delete st.w;
      delete st.m;
      move = 'down';
    }
  } else if (a.clean && a.stage >= st.s) {
    st.k = Math.min(STAGE_UP_CLEAN, st.k + 1);
    if (st.k >= STAGE_UP_CLEAN) {
      if (st.s === 1 && a.more) {
        // Der Einführungsschritt sitzt, aber das Thema hat noch weitere: „Verstehen“ bleibt, morgen kommt der nächste Schritt mit seiner Regel.
        st.k = 0;
        st.u = a.day;
        st.gp = a.day;
      } else if (st.s < FOCUS_STAGES) {
        // Höchstens ein Aufstieg je Lerntag: sonst bleibt die Serie stehen und der nächste Lerntag steigt mit der ersten sauberen Antwort auf.
        if (st.u !== a.day) {
          st.s = (st.s + 1) as FocusStage;
          st.k = 0;
          st.u = a.day;
          delete st.w;
          move = 'up';
        }
      } else st.m = 1;
    }
  }
  // „Sitzt“: Mischen bestanden und Beherrschung erreicht (auch wenn die Beherrschung erst mit einer späteren richtigen Antwort nachzieht).
  if (st.s === FOCUS_STAGES && st.m === 1 && !a.wrong && a.p >= FOCUS_SITS_P) {
    st.ok = a.day;
    move = 'sits';
  }
  return { next: st, move };
}

/** Wie `focusStep`; die Beherrschung liest die Funktion selbst aus dem Thema (für die Runde, die ihre Kopie des Laufs fortschreibt). */
export function focusStepLive(topic: string, doc: Doc | undefined, cur: FocusState | null, a: Omit<FocusFact, 'p'>, nowMs: number): { next: FocusState; move: FocusMove } {
  return focusStep(cur, { ...a, p: topicP(topic, doc, nowMs) });
}

/**
 * Themen-Test bestanden (6 Aufgaben ohne Hilfe): das Thema ist abgeschlossen – der Lauf endet sofort („sitzt“), auch aus einer frühen Stufe.
 * Wer das Thema schon kann, kürzt so ab; ohne Lauf entsteht ein abgeschlossener, damit das Thema nicht gleich wieder Fokus wird.
 */
export function focusPassed(cur: FocusState | null, day: string): FocusState {
  const base: FocusState = focusOpen(cur) ? { ...cur } : { v: 1, s: FOCUS_STAGES, k: STAGE_UP_CLEAN, d0: day, d: day, n: 1 };
  delete base.w;
  delete base.gp;
  return { ...base, s: FOCUS_STAGES, k: STAGE_UP_CLEAN, m: 1, d: day, ok: day };
}

// ------------------------------------------------------------------ Wahl des Fokus-Themas

export type FocusReason = 'run' | 'weak' | 'chapter' | 'next' | 'new';
export type FocusPick = {
  topic: string;
  stage: FocusStage;
  state: FocusState | null;
  /** Die Runde beginnt mit der kurzen Regel (erster Tag des Laufs). */
  rule: boolean;
  /** Thema noch nie geübt (dann gilt die Einführung des Themas, mit Vortest). */
  fresh: boolean;
  reason: FocusReason;
};

const recentAcc = (doc: Doc | undefined): number | null => {
  const r = Array.isArray(doc?.recent) ? (doc.recent as unknown[]).filter((x): x is number => x === 0 || x === 1) : [];
  return r.length >= 5 ? r.reduce((a, b) => a + b, 0) / r.length : null;
};

/**
 * Bedarf eines begonnenen Themas: Abstand zur Beherrschung, dazu die Quote der letzten Antworten (Stillstand wiegt schwer) und ein kleiner
 * Vorrang für C1-Themen (Emrahs schwache C1-Themen zuerst). Höher = dringender.
 */
export function focusNeed(topic: string, doc: Doc | undefined, nowMs: number): number {
  const p = topicP(topic, doc, nowMs);
  const acc = recentAcc(doc);
  const c1 = topicById(topic)?.level === 'C1' ? 0.05 : 0;
  return 1 - p + (acc === null ? 0 : 0.5 * (1 - acc)) + c1;
}

/** Sitzt das Thema schon (für die Wahl): Lauf abgeschlossen oder Beherrschung erreicht und die letzten Antworten nicht schwach. */
export function topicSits(topic: string, doc: Doc | undefined, nowMs: number): boolean {
  if (isNewTopic(doc)) return false;
  const acc = recentAcc(doc);
  return topicP(topic, doc, nowMs) >= FOCUS_SITS_P && (acc === null || acc >= 0.6);
}

export type FocusPickIn = {
  docs: ReadonlyMap<string, Doc>;
  today: string;
  nowMs: number;
  /** Thema des Kapitel-Cursors (Kapitel-Fokus), sonst `null`. */
  chapterTopic?: string | null;
};

/**
 * Das Fokus-Thema (rein, deterministisch): 1. ein laufender Lauf bleibt (der zuletzt geübte; ruhende übergangen) · 2. das begonnene Thema mit
 * dem größten Bedarf unter `FOCUS_WEAK_P` · 3. das Thema des Kapitel-Cursors · 4. ein begonnenes Thema, das noch nicht sitzt · 5. das nächste
 * neue Thema im Pfad. `null`, wenn alles sitzt. Nichts wird gespeichert: der Lauf entsteht mit der ersten Fokus-Antwort.
 */
export function focusPick(i: FocusPickIn): FocusPick | null {
  const order = pathTopics();
  const at = (t: string): number => {
    const k = order.indexOf(t);
    return k < 0 ? order.length : k;
  };
  const make = (topic: string, reason: FocusReason): FocusPick => {
    const doc = i.docs.get(topic);
    const st = readFocus(doc);
    const open = focusOpen(st) ? st : null;
    return { topic, stage: stageOf(open), state: open, rule: ruleDue(open), fresh: isNewTopic(doc), reason };
  };
  const known = TOPICS.map((t) => t.id);
  // 1. Laufender Lauf.
  const runs = known
    .map((t) => ({ t, st: readFocus(i.docs.get(t)) }))
    .filter((x): x is { t: string; st: FocusState } => focusOpen(x.st) && !focusResting(x.st, i.today))
    .sort((a, b) => (a.st.d < b.st.d ? 1 : a.st.d > b.st.d ? -1 : 0) || at(a.t) - at(b.t));
  if (runs[0]) return make(runs[0].t, 'run');
  const resting = (t: string): boolean => {
    const st = readFocus(i.docs.get(t));
    if (focusResting(st, i.today)) return true;
    return !!st?.ok && daysBetween(st.ok, i.today) < FOCUS_DONE_REST_DAYS;
  };
  const begun = known.filter((t) => !isNewTopic(i.docs.get(t)) && !resting(t) && !topicSits(t, i.docs.get(t), i.nowMs));
  // Größter Bedarf zuerst; liegen mehrere Themen dicht beieinander (`NEED_BAND`), gewinnt das frühere im Lehrpfad (Grundlagen vor Feinheiten).
  const byNeed = (list: string[]): string | null => {
    if (!list.length) return null;
    const need = new Map(list.map((t) => [t, focusNeed(t, i.docs.get(t), i.nowMs)]));
    const top = Math.max(...need.values());
    return [...list].filter((t) => (need.get(t) ?? 0) >= top - NEED_BAND).sort((a, b) => at(a) - at(b))[0] ?? null;
  };
  // 2. Klarer Bedarf.
  const weak = byNeed(begun.filter((t) => topicP(t, i.docs.get(t), i.nowMs) < FOCUS_WEAK_P));
  if (weak) return make(weak, 'weak');
  // 3. Kapitel-Fokus.
  const ch = i.chapterTopic && topicById(i.chapterTopic) && !resting(i.chapterTopic) && !topicSits(i.chapterTopic, i.docs.get(i.chapterTopic), i.nowMs) ? i.chapterTopic : null;
  if (ch) return make(ch, 'chapter');
  // 4. Begonnen, aber noch nicht sitzend.
  const rest = byNeed(begun);
  if (rest) return make(rest, 'next');
  // 5. Das nächste neue Thema.
  const fresh = nextNewTopic(i.docs);
  return fresh ? make(fresh, 'new') : null;
}

// ------------------------------------------------------------------ Formen je Stufe, Muster des Tages, Partner

/** Wunschformen je Platz der Stufe (reihum). `keys` darf ganze Sätze (correct/transform), `touch` nie. */
export function stageForms(stage: FocusStage, profile: 'touch' | 'keys' = 'keys'): readonly (readonly GrammarTaskType[])[] {
  if (stage === 1) return [['mc', 'meaning'], ['gap', 'mc'], ['meaning', 'mc'], ['gap', 'mc']];
  if (stage === 2) return [['gap'], ['gap'], ['find', 'gap'], ['gap']];
  if (stage === 3) return profile === 'keys' ? [['find'], ['kwt', 'transform'], ['find', 'correct'], ['kwt', 'transform']] : [['find'], ['kwt'], ['find'], ['kwt']];
  return profile === 'keys' ? [['kwt', 'transform'], ['find', 'correct'], ['gap'], ['kwt', 'find']] : [['kwt'], ['find'], ['gap'], ['kwt', 'find']];
}

/** Rückfall, wenn die Wunschform fehlt: leichtere Formen zuerst (die Runde wird nie leer, aber auch nie schwerer als die Stufe). */
export function stageFallback(stage: FocusStage, profile: 'touch' | 'keys' = 'keys'): readonly GrammarTaskType[] {
  const whole: GrammarTaskType[] = profile === 'keys' ? ['transform', 'correct'] : [];
  if (stage === 1) return ['mc', 'meaning', 'gap'];
  if (stage === 2) return ['gap', 'find', 'mc', 'meaning'];
  return ['find', 'kwt', ...whole, 'gap', 'mc', 'meaning'];
}

/** Lücke mit Stütze (Platzhalter von Anfang an): nur in der Stufe „Verstehen“. */
export const stageSupport = (stage: FocusStage): boolean => stage === 1;

/** Einführungsschritte eines Themas (je höchstens 2 Muster); ohne Musterdatei leer. */
const groupsOf = (topic: string): string[][] => (patternsOf(topic)?.introPlan ?? []).map((g) => g.slice(0, 2));

/** Die Muster des Einführungsschritts, zu dem `pat` gehört (mit `pat` selbst); ohne Schritt nur `pat`. */
export function groupOf(topic: string, pat: string): string[] {
  return groupsOf(topic).find((g) => g.includes(pat)) ?? [pat];
}

/** Sind nach dem Stand `introduced` noch Einführungsschritte offen (nicht jedes Muster eingeführt)? */
export function groupsLeft(topic: string, introduced: (id: string) => boolean): boolean {
  return groupsOf(topic).some((g) => !g.every(introduced));
}

/** Was die Fokus-Runde heute übt: die Muster (leer = alle eingeführten des Themas), ob vorn die kurze Regel steht, ob danach noch Schritte offen sind. */
export type FocusDay = { pats: string[]; rule: boolean; more: boolean };

/**
 * Die Muster des Tages (höchstens 2) und die Regel (rein, aus dem Thema abgeleitet):
 * - „Verstehen“ mit offenem Einführungsschritt: dieser Schritt, mit Regel am Tag, an dem er beginnt (neues Thema: der erste; sonst der
 *   nächste, sobald der vorige saß (`fo.gp` vom Vortag) oder der Lauf gerade beginnt). Ein begonnener Schritt läuft weiter, ohne neue Regel.
 * - sonst in „Verstehen“ und „Bilden“: die zwei schwächsten eingeführten Muster (Fehlerquote, dann wenig geübt, dann Lehrreihenfolge);
 *   die Regel nur am ersten Tag des Laufs. In „Umformen“ und „Mischen“ alle eingeführten Muster.
 * Ohne Musterdatei: keine Muster (das ganze Thema), Regel am ersten Tag.
 */
export function focusDay(topic: string, doc: Doc | undefined, today: string, state?: FocusState | null): FocusDay {
  const st0 = state === undefined ? readFocus(doc) : state;
  const open = focusOpen(st0) ? st0 : null;
  const stage = stageOf(open);
  const groups = groupsOf(topic);
  if (!groups.length) return { pats: [], rule: !open, more: false };
  const fresh = isNewTopic(doc);
  const entries = patsOf(doc);
  // Altbestand ohne `pats`: alle Muster gelten als eingeführt.
  const legacy = !fresh && !Object.keys(entries).length;
  const has = (id: string): boolean => legacy || entries[id]?.i !== undefined;
  const next = groups.findIndex((g) => !g.every(has));
  if (stage === 1 && next >= 0) {
    const begun = (groups[next] as string[]).some(has);
    const mayStart = fresh || !open || (open.gp !== undefined && open.gp < today);
    const others = groups.some((g, k) => k !== next && !g.every(has));
    if (begun) return { pats: groups[next] as string[], rule: false, more: others };
    if (mayStart) return { pats: groups[next] as string[], rule: true, more: others };
    // Der vorige Schritt sitzt noch nicht: er bleibt dran (der zuletzt begonnene).
    let cur = -1;
    groups.forEach((g, k) => {
      if (g.some(has)) cur = k;
    });
    return { pats: groups[cur >= 0 ? cur : next] as string[], rule: false, more: true };
  }
  if (stage >= 3) return { pats: [], rule: false, more: false };
  const order = groups.flat();
  const pool = order.filter(has);
  const rate = (id: string): number => {
    const e = entries[id];
    const n = num(e?.n);
    return n > 0 ? (n - num(e?.c)) / n : 0.5;
  };
  const pats = [...(pool.length ? pool : (groups[0] as string[]))].sort((a, b) => rate(b) - rate(a) || num(entries[a]?.n) - num(entries[b]?.n) || order.indexOf(a) - order.indexOf(b)).slice(0, 2);
  return { pats, rule: stage === 1 && !open, more: false };
}

/** Verwechslungs-Partner der Stufe „Mischen“: ein begonnenes Thema derselben Kontrastfamilie (das sicherste zuerst), sonst `null`. */
export function focusPartner(topic: string, docs: ReadonlyMap<string, Doc>, nowMs: number): string | null {
  const fam = familyOf(topic).filter((t) => topicById(t) && !isNewTopic(docs.get(t)));
  if (!fam.length) return null;
  return [...fam].sort((a, b) => topicP(b, docs.get(b), nowMs) - topicP(a, docs.get(a), nowMs) || a.localeCompare(b))[0] ?? null;
}

// ------------------------------------------------------------------ Anzeige: „Du bist hier“

/** Stand des Fokus-Themas für die Anzeige (Grammatik-Reiter, Heute-Zeile, Rundenende). Rein, nur gelesen. */
export type FocusView = {
  topic: string;
  stage: FocusStage;
  /** Saubere Antworten in Folge in dieser Stufe (0 bis 3). */
  k: number;
  /** Die nächste Runde beginnt mit der kurzen Regel. */
  rule: boolean;
  pats: string[];
  /** Verwechslungs-Partner (nur in „Mischen“), sonst `null`. */
  partner: string | null;
  /** Das Thema sitzt seit heute (der Lauf ist beendet; morgen kommt das nächste). */
  sitsToday: boolean;
  /** Das Thema stammt aus dem eingefrorenen Plan von heute (`u.gt.fo`); sonst live gewählt. */
  frozen: boolean;
};

/**
 * Das Fokus-Thema für die Anzeige: aus dem eingefrorenen Plan von heute (`gt.fo`, damit Heute, Reiter und Runde dasselbe sagen), sonst die
 * Wahl von `focusPick`. `null`, wenn es keins gibt.
 */
export function focusView(i: FocusPickIn & { gt?: { fo?: 1; topics: readonly string[] } | null }): FocusView | null {
  const first = i.gt?.fo === 1 ? i.gt.topics[0] : undefined;
  const frozen = first && topicById(first) ? first : null;
  const topic = frozen ?? focusPick(i)?.topic ?? null;
  if (!topic) return null;
  const doc = i.docs.get(topic);
  const st = readFocus(doc);
  const open = focusOpen(st) ? st : null;
  const sitsToday = !!st?.ok && st.ok === i.today;
  const stage: FocusStage = sitsToday ? FOCUS_STAGES : stageOf(open);
  const day = focusDay(topic, doc, i.today, open);
  return { topic, stage, k: sitsToday ? STAGE_UP_CLEAN : (open?.k ?? 0), rule: day.rule && !sitsToday, pats: day.pats, partner: stage === FOCUS_STAGES ? focusPartner(topic, i.docs, i.nowMs) : null, sitsToday, frozen: !!frozen };
}
