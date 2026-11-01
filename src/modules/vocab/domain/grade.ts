import type { Form, Grade, LexKind, Outcome, TrackKey } from './types';

// Wörter-Modul V2: Note aus Richtigkeit, Form, Hilfe und Zeit (plan.md §5; synthese M38, M39, M41, M44, M45, M56, M78, M79, M81).
// Keine Selbstbewertung außer im Anki-Modus (A7): `flip` ist die einzige Form mit Selbsturteil und wirkt nur auf Verstehen (F3).
// Auswahl, Falle finden und Kontrast ändern FSRS nie (M2, M23).

export type FormSpec = {
  /** Spur (`null` = keine Planwirkung). */
  track: TrackKey | null;
  /** höchste Note. */
  max: Grade;
  /** freier Abruf (zählt als Beleg-Tag und für den Aufstieg). */
  free: boolean;
  /** Satz: `s` englischer Satz · `n` ohne englischen Satz (M27) · `-` ohne Abfrage (Einführung, Auswahl). */
  sent: 's' | 'n' | '-';
  /** braucht Claude (V4); ohne KI wird die Form nicht gestellt. */
  ai?: boolean;
};

/** Spur und höchste Note je Form (Tabelle „Spur je Form“, plan.md §5, english-teacher V0 Befund 2). */
export const FORM_SPEC: Readonly<Record<Form, FormSpec>> = {
  // Benutzen, bis Easy
  gap: { track: 'b', max: 4, free: true, sent: 's' },
  nosent: { track: 'b', max: 4, free: true, sent: 'n' },
  de_sent: { track: 'b', max: 4, free: true, sent: 's' },
  partner: { track: 'b', max: 4, free: true, sent: 's' },
  family: { track: 'b', max: 4, free: true, sent: 's' },
  situation: { track: 'b', max: 4, free: true, sent: 'n' },
  own: { track: 'b', max: 4, free: true, sent: 'n', ai: true },
  diplomatic: { track: 'b', max: 4, free: true, sent: 'n', ai: true },
  say: { track: 'b', max: 4, free: true, sent: 'n' },
  transfer: { track: 'b', max: 4, free: true, sent: 'n' },
  probe: { track: 'b', max: 4, free: true, sent: 'n' },
  // Benutzen, höchstens Hard (Teilabruf mit Stütze)
  gap_hint: { track: 'b', max: 2, free: false, sent: 's' },
  cloze_part: { track: 'b', max: 2, free: false, sent: 's' },
  complete: { track: 'b', max: 2, free: false, sent: 's' },
  prep: { track: 'b', max: 2, free: false, sent: 's' },
  count: { track: 'b', max: 2, free: false, sent: 's' },
  particle: { track: 'b', max: 2, free: false, sent: 's' },
  // Verstehen
  listen: { track: 'u', max: 3, free: false, sent: 's' },
  dictation: { track: 'u', max: 3, free: false, sent: 's' },
  tiles: { track: 'u', max: 2, free: false, sent: 's' },
  meaning: { track: 'u', max: 4, free: false, sent: 's' },
  tone_mean: { track: 'u', max: 4, free: false, sent: 'n' },
  flip: { track: 'u', max: 4, free: false, sent: 'n' },
  // keine Planwirkung
  intro: { track: null, max: 1, free: false, sent: '-' },
  choice: { track: null, max: 1, free: false, sent: '-' },
  find_trap: { track: null, max: 1, free: false, sent: '-' },
  contrast: { track: null, max: 1, free: false, sent: '-' },
};

/** Formen, in denen ein Muster-, Zählbarkeits- oder Stellungsfehler der eigentlich gefragte Inhalt ist (dann Again statt Hard). */
const FOCUS: Partial<Record<Outcome, Form>> = { prep: 'prep', plural: 'count', order: 'particle' };

/**
 * Notentabelle (M38): Grundnote je Ausgang. `null` = keine Note (die Abfrage zählt nicht; Wiederkehr nach 3–5 Karten bzw. keine Wirkung).
 * `k` = das Lexem ist selbst die Verbindung (Kollokation, Wendung, Phrasal Verb): dann wiegt ein Fehler an der Verbindung wie „falsch“.
 */
export function baseGrade(outcome: Outcome, x: { k: LexKind; form: Form; evadeRepeat?: boolean }): Grade | null {
  switch (outcome) {
    case 'ok':
      return 3;
    case 'typo': // (a) fast richtig
    case 'infl': // (c) Beugung, mit Grammatik-Hinweis
    case 'spell': // (b) Rechtschreibfehler aus der Liste: Formfehler mit eigener Erklärung, nie „fast richtig“, kein Aufstiegs-Tag
    case 'hyph': // (f) Bindestrich/Leerzeichen mit Wortartwechsel
    case 'odd': // Claude: verständlich, aber unnatürlich (Ton, Wortwahl); Wort gewusst, Gebrauch noch nicht sicher
      return 2;
    case 'pos': // (d)
    case 'other': // (e)
    case 'wrong':
    case 'dunno':
      return 1;
    case 'colloc': // M56: Lexem ist selbst die Verbindung (col/pv/ch) → Again; Einzelwort → Hard, Partner-Lexem markiert
      return x.k === 'w' ? 2 : 1;
    case 'prep': // M78: Muster ist Teil des Lexems (pv/col/ch) oder die Form fragt genau danach → Again; sonst Wort gewusst, Muster falsch → Hard
      return x.k !== 'w' || FOCUS.prep === x.form ? 1 : 2;
    case 'plural': // M79
    case 'order': // M81
      return FOCUS[outcome] === x.form ? 1 : 2;
    case 'evade': // M41: erstes Ausweichen keine Note, das zweite gleiche Hard
      return x.evadeRepeat ? 2 : null;
    case 'syn': // Auch richtig (Synonym je Satz, gr.var, britischer Wortschatz)
    case 'unfair': // M43: ohne Planwirkung, geht in die Inhaltsprüfung
    case 'asr': // M31: eine Ablehnung der Erkennung ist nie ein Fehler
      return null;
  }
}

export type GradeInput = {
  form: Form;
  outcome: Outcome;
  hint: number;
  /** Zeit-Urteil (`speedOf`). */
  speed?: 'slow' | 'fast' | null;
  /** Easy erlaubt (`easyAllowed`: ab Stufe 5, fällig, nach 21 Tagen). */
  easyOk?: boolean;
  /** Anki-Selbsturteil (nur `flip`). */
  self?: Grade;
  /** Art des Lexems (M56, M78). Fehlt sie, gilt `w`. */
  k?: LexKind;
  /** V1-Feld, gleichbedeutend mit `k: 'col'`. */
  isColloc?: boolean;
  /** Ausweichwort schon einmal benutzt (M41). */
  evadeRepeat?: boolean;
  /** Zweiter Versuch (M45): Ausgang des ersten Versuchs. */
  first?: Outcome;
};

/** Note 1–4 oder `null` (keine Note). */
export function gradeOf(x: GradeInput): Grade | null {
  const spec = FORM_SPEC[x.form];
  if (spec.track === null) return null;
  if (x.form === 'flip') return x.self ?? null;
  const k: LexKind = x.k ?? (x.isColloc ? 'col' : 'w');
  let g = baseGrade(x.outcome, { k, form: x.form, evadeRepeat: x.evadeRepeat });
  if (g === null) return null;
  // M45: zweiter Versuch nach einem Fehler ergibt Again (ohne Stufenverlust, das regelt der Planer); war der erste nur ein Tippfehler, Hard.
  if (x.first && x.first !== 'ok') {
    if (g >= 2) g = x.first === 'typo' ? 2 : 1;
  } else if (g === 3) {
    // M38/M44/M39: Hinweis oder sehr langsam → Hard; schnell → Easy (nur, wo erlaubt).
    if (x.hint > 0 || x.speed === 'slow') g = 2;
    else if (x.speed === 'fast' && x.easyOk) g = 4;
  }
  return Math.min(g, spec.max) as Grade;
}

/** Zählt die Antwort als freier richtiger Abruf (Beleg-Tag, Aufstieg)? Ein reiner Tippfehler (a) zählt mit, sonst nichts mit Fehler (Lena 3.3). */
export function isFreeGood(form: Form, outcome: Outcome, hint: number): boolean {
  return FORM_SPEC[form].free && hint === 0 && (outcome === 'ok' || outcome === 'typo');
}

/** Keine Note und keine Wiederkehr (M43 unfair, M31 Erkennung abgelehnt): die Abfrage hat gar nicht stattgefunden. */
export const isVoid = (o: Outcome): boolean => o === 'unfair' || o === 'asr';

// ---------------------------------------------------------------- Zeit (M39)

/** Kappung der Zeit bis zum ersten Zeichen. */
export const FK_CAP_MS = 45_000;
/** Die ersten so vielen Antworten je Form wirken nicht über die Zeit (Zeitbasis erst stabil). */
export const SPEED_MIN_N = 20;
export const SLOW_X = 2;
export const FAST_X = 0.6;
/** Easy erst nach so vielen Tagen seit der Einführung. */
export const EASY_MIN_AGE = 21;
export const EASY_MIN_LV = 5;

/**
 * Zeit-Urteil aus der Zeit bis zum ersten Zeichen (`fkMs`, sonst zählt die Wortlänge mit), gemessen gegen den Median dieser Form.
 * `n` = Zahl der bisherigen Antworten dieser Form; unter 20 → kein Urteil.
 */
export function speedOf(fkMs: number, med: number | undefined, n: number | undefined): 'slow' | 'fast' | null {
  if (!med || !n || n < SPEED_MIN_N || !(fkMs > 0)) return null;
  const t = Math.min(FK_CAP_MS, fkMs);
  if (t > SLOW_X * med) return 'slow';
  if (t < FAST_X * med) return 'fast';
  return null;
}

/** Easy erlaubt: ab Stufe 5, nur bei fälligen Abfragen, nicht in den ersten 21 Tagen seit der Einführung (M39). */
export function easyAllowed(lv: number, due: boolean, ageDays: number): boolean {
  return lv >= EASY_MIN_LV && due && ageDays >= EASY_MIN_AGE;
}

/** Zeitbasis je Form: laufender Median aus höchstens 200 Werten (für `vmod/stats.fk`). */
export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}
