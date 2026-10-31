import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { pickDay } from './balance';
import { capDays, EV_F_MAX } from './cap';
import { corridor } from './fuzz';
import { FORM_SPEC, gradeOf, isFreeGood } from './grade';
import { canAscend, descend } from './ladder';
import { book, newTrack, retr } from './tracks';
import type { Form, Grade, Lex, LexKind, Outcome, Track, TrackKey, VocabCfg } from './types';

// Wörter-Modul V1: der Planer je Antwort (plan.md §4.2–4.3, Methoden M1, M7, M8, M9, M10, M11, M15, M77).
//  1. Note aus dem Ergebnis (grade.ts).
//  2. Höchstens EINE FSRS-Buchung je Spur und Lerntag (`lex.day`; Anki-Runde nur `dayU`). Weitere Antworten am selben Tag ändern nur
//     Stufe, Verlauf und den Termin, und den höchstens auf morgen.
//  3. FSRS der Spur, Kopplung nur nach oben: Good/Easy auf Benutzen bucht dieselbe Note auf Verstehen, Hard bucht Hard, Again auf
//     Benutzen bucht auf Verstehen nichts (Ausnahme „anderes Wort“). Eine Antwort auf Verstehen zählt nie für Benutzen.
//  4. Abstands-Deckel (cap.ts), 5. Fuzz-Korridor (fuzz.ts), 6. Lastausgleich in Minuten mit Geschwistern (balance.ts),
//  7. Tagesmarke, Belege, Stufe. Der Verlaufseintrag (vlog.ts) und die Spiegelung (mirror.ts) baut der Aufrufer aus dem Ergebnis.
// Rein: keine Uhr, kein Zufall ohne Startwert, kein Schreiben.

export const SN_MAX = 12;
export const RETRY_GAP = 4; // Wiederkehr nach Fehler: nach 3–5 Karten (M53), fest 4 (M73: kein Würfeln)
export const RETRY_MAX = 4; // höchstens 4 Versuche je Lexem und Tag
export const STEP_A_GAP = 3; // Schritt A nach ≥ 3 anderen Karten
export const STEP_B_GAP = 8; // Schritt B nach ≥ 8 Karten …
export const STEP_B_MS = 3 * 60_000; // … und ≥ 3 Minuten

/** Flags im Verlauf (Bitmaske, plan.md §3.4). */
export const FLAG = { step: 1, override: 2, unfair: 4, anki: 8, ext: 16, noAi: 32, mig: 64 } as const;

export type Answer = {
  t: number;
  form: Form;
  outcome: Outcome;
  hint: number;
  ms: number;
  fk: number;
  /** Schlüssel des gezeigten Satzes oder `null` (ohne Satz). */
  sentence: string | null;
  speed?: 'slow' | 'fast' | null;
  /** Anki-Selbsturteil (nur `flip`). */
  self?: Grade;
  /** Zweiter Versuch nach Hinweis (M45): Fehler kostet keine Stufe. */
  second?: boolean;
  flags?: number;
};

export type PlanCtx = {
  cfg: VocabCfg;
  /** Lexem-Pfad (Startwert für Fuzz und Lastausgleich). */
  path: string;
  /** Darf diese Antwort den Plan verändern? (Sitzung/Tagesmarke, N2; Belege aus anderen Bereichen nach §2.2.) */
  planned: boolean;
  /** Erwartete Minuten je Tag ab heute (1 = morgen), OHNE dieses Lexem. */
  load: (offset: number) => number;
  /** Tages-Offsets, an denen Geschwister (Partner, Kernwort/Kollokation) fällig sind. */
  siblings: ReadonlySet<number>;
  rest?: (offset: number) => boolean;
};

export type AnswerResult = { lex: Lex; grade: Grade | null; booked: TrackKey[]; note: number; track: 0 | 1 | 2 };

export function emptyLex(k: LexKind, pri: Lex['pri'], nowMs: number): Lex {
  return { v: 1, k, of: null, core: null, sense: null, lv: 1, u: newTrack(nowMs), b: null, day: null, dayU: null, step: null, ev: { f: [], o: 0, s: 0 }, sn: [], gr: null, reg: null, pri, lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: null };
}

const clone = (l: Lex): Lex => ({ ...l, u: { ...l.u }, b: l.b ? { ...l.b } : null, ev: { f: [...l.ev.f], o: l.ev.o, s: l.ev.s }, sn: l.sn.map((x) => [x[0], x[1]] as [string, string]), step: l.step ? { ...l.step } : null });

/** Termin (ms) für eine gebuchte Spur: Deckel → Korridor → Lastausgleich. `extraSib` = Tage, die zusätzlich gemieden werden (andere Spur). */
export function placeDue(lex: Lex, track: Track, ivl: number, which: TrackKey, ctx: PlanCtx, nowMs: number, extraSib?: number): number {
  const cap = capDays(lex);
  const [lo, hi] = corridor(ivl, cap);
  const sib = extraSib === undefined ? ctx.siblings : new Set([...ctx.siblings, extraSib]);
  const off = pickDay({ lo, hi, load: ctx.load, siblings: sib, rest: ctx.rest, seed: `${ctx.path}|${which}|${track.reps}` });
  return dayStartOf(addDays(dayKey(nowMs), off));
}

/** Einführung (Karte „neu“): Stufe 1, Einführungstag, Lernschritt A nach ≥ 3 anderen Karten. Keine FSRS-Buchung. */
export function introduce(lex: Lex, nowMs: number): Lex {
  const l = clone(lex);
  l.lv = Math.max(1, l.lv);
  l.intro ??= dayKey(nowMs);
  l.step = { n: 1, at: nowMs, gap: STEP_A_GAP };
  return l;
}

function offsetOf(due: number, nowMs: number): number {
  return daysBetween(dayKey(nowMs), dayKey(due));
}

export function applyAnswer(lex0: Lex, a: Answer, ctx: PlanCtx): AnswerResult {
  const lex = clone(lex0);
  const day = dayKey(a.t);
  const spec = FORM_SPEC[a.form];
  const g = gradeOf({ form: a.form, outcome: a.outcome, hint: a.hint, speed: a.speed, self: a.self, isColloc: lex.k === 'col', easyOk: lex.lv >= 5 });
  const wrong = g === 1;
  const booked: TrackKey[] = [];

  if (a.sentence) {
    lex.sn = [[a.sentence, day] as [string, string], ...lex.sn.filter((x) => x[0] !== a.sentence)].slice(0, SN_MAX);
  }

  // ---------- Buchung
  let target: TrackKey | null = spec.track;
  if (target === 'b' && !lex.b) {
    // Benutzen entsteht mit dem ersten FREIEN getippten Abruf (plan.md §3.2); die Lücke mit Anfangsbuchstabe wirkt dann auf Verstehen.
    if (spec.free) lex.b = newTrack(a.t);
    else target = 'u';
  }
  const ankiBlocked = a.form === 'flip' && (lex.dayU === day || lex.day === day);
  const bookedToday = lex.day === day || ankiBlocked;
  const wasDue = (t: Track | null) => !!t && t.due < dayStartOf(addDays(day, 1));
  const dueBefore = target ? wasDue(target === 'b' ? lex.b : lex.u) : false;

  // Schritt A bucht nie (die erste Buchung eines neuen Lexems ist Schritt B, §4.2 Nr. 2).
  const stepA = lex.step?.n === 1 && dayKey(lex.step.at) === day;
  if (ctx.planned && target && g !== null && !bookedToday && lex.intro !== null && !stepA) {
    if (target === 'b' && lex.b) {
      const r = book(lex.b, g, a.t, ctx.cfg.ret);
      lex.b = r.track;
      booked.push('b');
      // Kopplung nur nach oben.
      const ug: Grade | null = g >= 2 ? g : a.outcome === 'other' ? 1 : null;
      let uIvl = 0;
      if (ug !== null && lex.dayU !== day) {
        const ru = book(lex.u, ug, a.t, ctx.cfg.ret);
        lex.u = ru.track;
        uIvl = ru.ivl;
        booked.push('u');
      }
      if (isFreeGood(a.form, a.outcome, a.hint) && day !== lex.intro && !lex.ev.f.includes(day)) lex.ev.f = [...lex.ev.f, day].slice(-EV_F_MAX);
      lex.b.due = placeDue(lex, lex.b, r.ivl, 'b', ctx, a.t, booked.includes('u') ? undefined : offsetOf(lex.u.due, a.t));
      lex.b.sd = offsetOf(lex.b.due, a.t);
      if (booked.includes('u')) {
        lex.u.due = placeDue(lex, lex.u, uIvl, 'u', ctx, a.t, offsetOf(lex.b.due, a.t));
        lex.u.sd = offsetOf(lex.u.due, a.t);
      }
    } else {
      const r = book(lex.u, g, a.t, ctx.cfg.ret);
      lex.u = r.track;
      booked.push('u');
      lex.u.due = placeDue(lex, lex.u, r.ivl, 'u', ctx, a.t, lex.b ? offsetOf(lex.b.due, a.t) : undefined);
      lex.u.sd = offsetOf(lex.u.due, a.t);
    }
    if (a.form === 'flip') lex.dayU = day;
    else lex.day = day;
    if (wrong && !a.second && !(a.flags && a.flags & FLAG.override)) {
      lex.lv = descend(lex.lv);
      lex.lc += 1;
    } else if (g >= 3 || (g === 2 && a.outcome === 'typo')) {
      if (a.hint === 0 && dueBefore && target === 'b' && canAscend(lex)) lex.lv += 1;
    }
    lex.mv = 0;
  } else if (ctx.planned && wrong && target && lex.day === day) {
    // Zweite Antwort am selben Lerntag: keine zweite Buchung, nur der Termin höchstens auf morgen (§4.2 Nr. 2).
    const tomorrow = dayStartOf(addDays(day, 1));
    if (target === 'b' && lex.b) lex.b.due = Math.min(lex.b.due, tomorrow);
    lex.u.due = target === 'u' || a.outcome === 'other' ? Math.min(lex.u.due, tomorrow) : lex.u.due;
  }

  // ---------- Lernschritte (§4.3): Einführung → A → B; nach Fehler Wiederkehr, höchstens 4 Versuche je Tag.
  const curStep = lex.step && dayKey(lex.step.at) === day ? lex.step : null;
  if (!curStep) lex.step = null;
  if (curStep && lex.intro !== null) {
    const st = curStep;
    if (g === null) {
      lex.step = { n: st.n, at: a.t, gap: RETRY_GAP };
    } else if (wrong) {
      const tries = st.n >= 10 ? st.n - 10 + 1 : 1;
      lex.step = tries >= RETRY_MAX ? null : { n: 10 + tries, at: a.t, gap: RETRY_GAP };
    } else if (st.n === 1) {
      lex.lv = Math.max(lex.lv, 2);
      lex.step = { n: 2, at: a.t, gap: STEP_B_GAP };
    } else if (st.n === 2) {
      if (isFreeGood(a.form, a.outcome, a.hint)) lex.lv = Math.max(lex.lv, 3);
      lex.step = null;
    } else lex.step = null;
  } else if (wrong || g === null) {
    lex.step = { n: g === null ? 10 : 11, at: a.t, gap: RETRY_GAP };
  }

  lex.sync = Math.max(lex.sync, a.t);
  const note = booked.length ? (g ?? 0) : 0;
  const track: 0 | 1 | 2 = booked.length === 2 ? 2 : booked[0] === 'b' ? 1 : 0;
  return { lex, grade: g, booked, note, track };
}

/** Darf ein Beleg aus einem anderen Bereich den Plan verändern? (plan.md §2.2, `reportEvidence`) */
export function evidencePlans(lex: Lex | null, e: { kind: 'seen' | 'recalled' | 'used'; typed: boolean; cued: boolean; t: number }): boolean {
  if (!lex || lex.intro === null) return false;
  if (e.kind === 'seen' || !e.typed || e.cued) return false;
  if (lex.day === dayKey(e.t)) return false;
  const tr = lex.b ?? lex.u;
  return retr(tr, e.t) < 0.95;
}
