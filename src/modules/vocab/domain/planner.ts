import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { pickDay } from './balance';
import { capDays, EV_F_MAX } from './cap';
import { corridor } from './fuzz';
import { easyAllowed, FORM_SPEC, gradeOf, isFreeGood, isVoid, speedOf } from './grade';
import { formLevel, updateFq } from './forms';
import { isLeechCount } from './leech';
import { canAscend, descend } from './ladder';
import { book, newTrack, retr } from './tracks';
import type { Form, FormStats, Grade, Lex, LexKind, Outcome, Track, TrackKey, VocabCfg } from './types';

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
/** Formfehler, nach denen die Form in der Runde noch einmal frei abgerufen wird. */
export const FORM_ERRORS: ReadonlySet<Outcome> = new Set(['spell', 'infl', 'hyph', 'prep', 'plural', 'order', 'colloc']);
export const RETRY_GAP = 4; // Wiederkehr nach Fehler: nach 3–5 Karten (M53), fest 4 (M73: kein Würfeln)
export const RETRY_MAX = 4; // höchstens 4 Versuche je Lexem und Tag
export const STEP_A_GAP = 3; // Schritt A nach ≥ 3 anderen Karten
export const STEP_B_GAP = 8; // Schritt B nach ≥ 8 Karten …
export const STEP_B_MS = 3 * 60_000; // … und ≥ 3 Minuten

/** Flags im Verlauf (Bitmaske, plan.md §3.4). */
export const FLAG = { step: 1, override: 2, unfair: 4, anki: 8, ext: 16, noAi: 32, mig: 64, later: 128 } as const;
/** V3: Wiederkehr nach „Das wusste ich eigentlich“ (20) bzw. „Später prüfen lassen“ (21): neuer Satz, höchstens Hard, kein Beleg, kein Aufstieg. */
export const STEP_OVERRIDE = 20;
export const STEP_LATER = 21;
/** Gedeckelte Note der Wiederkehr nach Einspruch (learning-scientist V3 Befund 1/2). */
export const VOID_RETRY_MAX: Grade = 2;

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
  /** V2, M45: Ausgang des ersten Versuchs (setzt `second`). */
  first?: Outcome;
  /** V2, M57: war der gezeigte Satz der Ankersatz? (`null`/fehlt = ohne Satz oder unbekannt) */
  anchor?: boolean | null;
  /** V2, M41: getroffenes Ausweichwort (für „zweites gleiches → Hard“). */
  hit?: string | null;
  flags?: number;
};

/** V2: Zeitbasis je Form (Median der Zeit bis zum ersten Zeichen und Zahl der Antworten, `vmod/stats`). */
export type FkStats = { med: FormStats; n: Partial<Record<Form, number>> };



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
  /** V2: Zeitbasis je Form (M39). Fehlt sie, gibt es kein Zeit-Urteil. */
  fk?: FkStats;
  /** V3: falscher Freund laut Lehrer-Charge (`trap = 'ff'`): beim Leech Kontrastkarte statt Werkstatt (M14). */
  ff?: boolean;
};

/**
 * Ereignisse für die Oberfläche (V3): `leech` neue Darstellung (M14) · `partner` Kollokationsfehler am Einzelwort, Partner-Lexem markieren (M56) ·
 * `unfair` an die Inhaltsprüfung (M43) · `bound` Signal satzgebunden (M57) · `grammar` Beugungsfehler mit Grammatik-Hinweis (M40c).
 */
export type AnswerEvent = 'leech' | 'partner' | 'unfair' | 'bound' | 'grammar';
export type AnswerResult = { lex: Lex; grade: Grade | null; booked: TrackKey[]; note: number; track: 0 | 1 | 2; events: AnswerEvent[]; speed: 'slow' | 'fast' | null };

export function emptyLex(k: LexKind, pri: Lex['pri'], nowMs: number): Lex {
  return { v: 1, k, of: null, core: null, sense: null, lv: 1, u: newTrack(nowMs), b: null, day: null, dayU: null, step: null, ev: { f: [], o: 0, s: 0 }, sn: [], gr: null, reg: null, pri, lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: null };
}

const clone = (l: Lex): Lex => ({ ...l, u: { ...l.u }, b: l.b ? { ...l.b } : null, ev: { f: [...l.ev.f], o: l.ev.o, s: l.ev.s }, sn: l.sn.map((x) => [x[0], x[1]] as [string, string]), step: l.step ? { ...l.step } : null });

/** Termin (ms) für eine gebuchte Spur: Deckel → Korridor → Lastausgleich. `extraSib` = Tage, die zusätzlich gemieden werden (andere Spur). */
export function placeDue(lex: Lex, track: Track, ivl: number, which: TrackKey, ctx: PlanCtx, nowMs: number, extraSib?: number): number {
  const cap = capDays(lex);
  const [lo, hi] = corridor(ivl, cap);
  const sib = extraSib === undefined ? ctx.siblings : new Set([...ctx.siblings, extraSib]);
  const off = pickDay({ lo, hi, load: ctx.load, siblings: sib, rest: ctx.rest, seed: `${ctx.path}|${which}|${track.reps}`, capped: cap !== null && ivl >= cap });
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

/**
 * Darf die Antwort per Einspruch („Das wusste ich eigentlich“, „Später prüfen lassen“) ohne Note bleiben? Nur bei der ersten Antwort des Lexems am
 * Lerntag: eingeführt, heute noch keine Buchung und kein Lernschritt (damit höchstens einmal je Lexem und Tag, nie im Lernschritt).
 */
export function mayVoid(lex: Lex, t: number): boolean {
  const day = dayKey(t);
  return lex.intro !== null && lex.day !== day && !(lex.step && dayKey(lex.step.at) === day);
}

/**
 * „Kenne ich schon“ mit bestandener Probe (V3, learning-scientist Befund 6): Benutzen bucht „Gut“, Termin fest in 7 Tagen (Kontrolle), Stufe 3,
 * kein Beleg-Tag; Verstehen bucht „Gut“ mit normalem Termin. Nur für ein noch nicht eingeführtes Lexem.
 */
export function probeKnown(lex0: Lex, t: number, ctx: PlanCtx): AnswerResult {
  const lex = clone(lex0);
  if (lex.intro !== null) return { lex, grade: null, booked: [], note: 0, track: 0, events: [], speed: null };
  const day = dayKey(t);
  lex.intro = day;
  lex.day = day;
  lex.step = null;
  lex.lv = Math.max(lex.lv, 3);
  const rb = book(newTrack(t), 3, t, ctx.cfg.ret);
  lex.b = rb.track;
  lex.b.due = dayStartOf(addDays(day, PROBE_CHECK_DAYS));
  lex.b.sd = PROBE_CHECK_DAYS;
  const ru = book(lex.u, 3, t, ctx.cfg.ret);
  lex.u = ru.track;
  lex.u.due = placeDue(lex, lex.u, ru.ivl, 'u', ctx, t, PROBE_CHECK_DAYS);
  lex.u.sd = offsetOf(lex.u.due, t);
  lex.sync = Math.max(lex.sync, t);
  return { lex, grade: 3, booked: ['b', 'u'], note: 3, track: 2, events: [], speed: null };
}
/** Kontrolle nach bestandener Probe: fest nach so vielen Tagen. */
export const PROBE_CHECK_DAYS = 7;
/** Kontrastkarte gilt als gelöst (kleiner Tippfehler eingeschlossen). */
const CONTRAST_OK = new Set<string>(['ok', 'typo']);

function offsetOf(due: number, nowMs: number): number {
  return daysBetween(dayKey(nowMs), dayKey(due));
}

export function applyAnswer(lex0: Lex, a: Answer, ctx: PlanCtx): AnswerResult {
  const lex = clone(lex0);
  const day = dayKey(a.t);
  const spec = FORM_SPEC[a.form];
  const events: AnswerEvent[] = [];
  // M43 „Aufgabe war unfair“ und M31 abgelehnte Erkennung: die Abfrage hat nicht stattgefunden (keine Note, kein Lernschritt, kein Satz).
  if (isVoid(a.outcome)) {
    if (a.outcome === 'unfair') {
      events.push('unfair');
      // Gemeldeter Satz: gemerkt, damit die nächste Abfrage einen anderen wählt; eine gemeldete Kontrastkarte ist erledigt (keine Schleife).
      // Ohne Satz und ohne Kontrast bleibt das Lexem unverändert (kein Schreiben).
      if (a.sentence || (a.form === 'contrast' && lex.ct)) {
        if (a.sentence) lex.sn = [[a.sentence, day] as [string, string], ...lex.sn.filter((x) => x[0] !== a.sentence)].slice(0, SN_MAX);
        if (a.form === 'contrast') delete lex.ct;
        lex.sync = Math.max(lex.sync, a.t);
      }
    }
    return { lex, grade: null, booked: [], note: 0, track: 0, events, speed: null };
  }
  // V3: Kontrastkarte (M14): Übung ohne Note; die Antwort schließt sie (Satz gemerkt, damit die nächste Abfrage einen anderen nimmt).
  // Falsch beantwortet: die Verwechslung besteht weiter, der Termin rückt höchstens auf morgen (learning-scientist V3 S3, Sollte 4).
  if (a.form === 'contrast') {
    if (a.sentence) lex.sn = [[a.sentence, day] as [string, string], ...lex.sn.filter((x) => x[0] !== a.sentence)].slice(0, SN_MAX);
    delete lex.ct;
    if (!CONTRAST_OK.has(a.outcome)) {
      const tomorrow = dayStartOf(addDays(day, 1));
      if (lex.b) lex.b.due = Math.min(lex.b.due, tomorrow);
      lex.u.due = Math.min(lex.u.due, tomorrow);
    }
    lex.sync = Math.max(lex.sync, a.t);
    return { lex, grade: null, booked: [], note: 0, track: 0, events, speed: null };
  }
  // V3: Einspruch ohne Note (erste Antwort des Tages): Wiederkehr nach 4 Karten in einem neuen Satz, dort höchstens Hard.
  const voidKind = a.flags && a.flags & FLAG.override ? STEP_OVERRIDE : a.flags && a.flags & FLAG.later ? STEP_LATER : 0;
  if (voidKind && mayVoid(lex, a.t)) {
    if (a.sentence) lex.sn = [[a.sentence, day] as [string, string], ...lex.sn.filter((x) => x[0] !== a.sentence)].slice(0, SN_MAX);
    lex.step = { n: voidKind, at: a.t, gap: RETRY_GAP };
    lex.sync = Math.max(lex.sync, a.t);
    if (voidKind === STEP_LATER) events.push('unfair');
    return { lex, grade: null, booked: [], note: 0, track: 0, events, speed: null };
  }
  const voidRetry = !!lex.step && lex.step.n >= STEP_OVERRIDE && dayKey(lex.step.at) === day;
  const second = !!a.second || (!!a.first && a.first !== 'ok');
  const endOfDay = dayStartOf(addDays(day, 1));
  const tgt0: Track | null = spec.track === 'b' ? lex.b : spec.track === 'u' ? lex.u : null;
  const dueNow = !!tgt0 && tgt0.due < endOfDay;
  const age = lex.intro ? daysBetween(lex.intro, day) : 0;
  const speed = a.speed !== undefined ? a.speed : ctx.fk ? speedOf(a.fk, ctx.fk.med[a.form], ctx.fk.n[a.form]) : null;
  const evadeRepeat = a.outcome === 'evade' && !!a.hit && !!lex.fq?.ew.includes(a.hit);
  const g0 = gradeOf({ form: a.form, outcome: a.outcome, hint: a.hint, speed, self: a.self, k: lex.k, evadeRepeat, first: a.first, easyOk: easyAllowed(formLevel(lex), dueNow, age) });
  const g = voidRetry && g0 !== null ? (Math.min(g0, VOID_RETRY_MAX) as Grade) : g0;
  const wrong = g === 1;
  const booked: TrackKey[] = [];
  if (a.outcome === 'infl') events.push('grammar');
  if (a.outcome === 'colloc' && lex.k !== 'col') events.push('partner');
  // V3, M14: Verwechslung (anderes echtes Wort der Paar-Liste/Deutsch-Falle, falscher Wortpartner) → Kontrastkarte in der nächsten Runde.
  if ((a.outcome === 'other' || a.outcome === 'colloc') && a.hit && !(a.flags && a.flags & FLAG.override)) lex.ct = { at: a.t, w: a.hit.slice(0, 60) };
  // Offener Kontrast von einem früheren Tag, das Wort kam als fällige Abfrage (die Kontrastkarte entfällt dann, session.ts): richtig
  // beantwortet schließt ihn. Am Tag der Verwechslung nicht (die Wiederkehr in derselben Runde ersetzt die Kontrastkarte nicht).
  else if (lex.ct && g !== null && g >= 2 && ctx.planned && dayKey(lex.ct.at) !== day) delete lex.ct;
  const fqBefore = lex.fq;

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
  const wasDue = (t: Track | null) => !!t && t.due < endOfDay;
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
      // Beleg-Tag nur bei einer FÄLLIGEN Antwort (vorgezogene heben Deckel und Stufe nicht; learning-scientist V1, Befund 2).
      if (dueBefore && !second && !voidRetry && isFreeGood(a.form, a.outcome, a.hint) && day !== lex.intro && !lex.ev.f.includes(day)) lex.ev.f = [...lex.ev.f, day].slice(-EV_F_MAX);
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
    if (wrong && !second && !(a.flags && a.flags & FLAG.override)) {
      lex.lv = descend(lex.lv);
      lex.lc += 1;
      if (isLeechCount(lex.lc)) {
        events.push('leech');
        // Leech eines falschen Freundes: Kontrast statt Werkstatt (leech.ts `leechTreatment`).
        if (ctx.ff && !lex.ct) lex.ct = { at: a.t, w: null };
      }
      // Nach einem Fehler gelten die Belege der höheren Stufe nicht mehr: Deckel und Schwelle passen zur neuen Stufe (Befund 7).
      lex.ev.f = lex.lv <= 2 ? [] : lex.ev.f.slice(-(lex.lv - 2));
    } else if (g >= 3 || (g === 2 && a.outcome === 'typo')) {
      if (a.hint === 0 && !second && !voidRetry && dueBefore && target === 'b' && canAscend(lex)) lex.lv += 1;
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
      const tries = st.n >= 10 && st.n < STEP_OVERRIDE ? st.n - 10 + 1 : 1;
      lex.step = tries >= RETRY_MAX ? null : { n: 10 + tries, at: a.t, gap: RETRY_GAP };
    } else if (st.n === 1) {
      lex.lv = Math.max(lex.lv, 2);
      lex.step = { n: 2, at: a.t, gap: STEP_B_GAP };
    } else if (st.n === 2) {
      if (isFreeGood(a.form, a.outcome, a.hint)) lex.lv = Math.max(lex.lv, 3);
      // Formfehler mit Hard in Schritt B: die richtige Form am selben Tag noch einmal selbst abrufen (M53, Nachprüfung 2).
      lex.step = FORM_ERRORS.has(a.outcome) ? { n: 10, at: a.t, gap: RETRY_GAP } : null;
    } else lex.step = null;
  } else if (wrong || g === null) {
    lex.step = { n: g === null ? 10 : 11, at: a.t, gap: RETRY_GAP };
  } else if (FORM_ERRORS.has(a.outcome)) {
    // Formfehler mit Hard (Rechtschreibliste, Beugung, Bindestrich, Muster/Plural/Stellung, Partner am Einzelwort): die richtige Form nach
    // 3–5 Karten selbst abrufen (M53), ohne zweite Buchung (learning-scientist V2 Befund 6).
    lex.step = { n: 10, at: a.t, gap: RETRY_GAP };
  }

  // V2: Formen-Statistik (Formwahl, jeder 3. ohne Satz, Satzbindung, Ausweichwort). Gezählt wird für „jeder 3.“ nur ein Abruf mit Planwirkung.
  if (spec.track !== null && a.form !== 'flip') {
    const error = a.outcome === 'prep' ? 'prep' : a.outcome === 'plural' ? 'plural' : a.outcome === 'order' ? 'order' : null;
    lex.fq = updateFq({ ...lex, fq: fqBefore }, { form: a.form, track: spec.track, correct: (a.outcome === 'ok' || a.outcome === 'typo') && a.hint === 0 && !second, anchor: a.anchor ?? null, wrong, evadeHit: a.outcome === 'evade' ? (a.hit ?? null) : null, counted: booked.includes('b'), error });
    if ((lex.fq.nb ?? 0) > (fqBefore?.nb ?? 0)) events.push('bound');
  }

  lex.sync = Math.max(lex.sync, a.t);
  const note = booked.length ? (g ?? 0) : 0;
  const track: 0 | 1 | 2 = booked.length === 2 ? 2 : booked[0] === 'b' ? 1 : 0;
  return { lex, grade: g, booked, note, track, events, speed };
}

/**
 * Planwirkung einer Antwort außerhalb der Pflicht (Wochen-Check, „Dieses Wort“, Fehlwörter, Anwenden-Rückfall): nur, wenn eine Spur heute
 * fällig ist oder die Abrufwahrscheinlichkeit unter 0,95 liegt (dieselbe Regel wie für Belege, learning-scientist V1, Befund 5).
 */
export function mayPlan(lex: Lex, nowMs: number): boolean {
  if (lex.intro === null || lex.day === dayKey(nowMs)) return false;
  const end = dayStartOf(addDays(dayKey(nowMs), 1));
  if (lex.u.due < end || (lex.b && lex.b.due < end)) return true;
  return retr(lex.b ?? lex.u, nowMs) < 0.95;
}

/** Darf ein Beleg aus einem anderen Bereich den Plan verändern? (plan.md §2.2, `reportEvidence`) */
export function evidencePlans(lex: Lex | null, e: { kind: 'seen' | 'recalled' | 'used'; typed: boolean; cued: boolean; t: number }): boolean {
  if (!lex || lex.intro === null) return false;
  if (e.kind === 'seen' || !e.typed || e.cued) return false;
  if (lex.day === dayKey(e.t)) return false;
  const tr = lex.b ?? lex.u;
  return retr(tr, e.t) < 0.95;
}
