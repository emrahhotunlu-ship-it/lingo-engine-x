import { daysBetween } from '../shared';
import { FORM_SPEC } from './grade';
import type { Form, Fq, Lex, TrackKey } from './types';

// Wörter-Modul V2: Formen je Stufe und Formwahl (plan.md §5; synthese §2.3, M22, M25, M26, M27, M57, M78–M81).
//  - Je Stufe mindestens 2 Formen (Kap. 5, Kap. 15 „jede Lernstufe mit nur einer Abfrageart“).
//  - Gewählt wird die Form mit der niedrigsten Trefferquote dieses Lexems, außer sie kam zuletzt; keine Form zweimal in Folge.
//  - Ab Stufe 4 ist jeder 3. Benutzen-Abruf ohne Satz (deutscher Chunk, Situation, Sag es), die anderen mit Satz (M27).
//  - Die schweren Formen ab Stufe 4 brauchen `u.s ≥ 3` Tage (plan.md §3.2); sonst gelten die Formen der Stufe 3.
//  - M78–M81 (Präposition, Zählbarkeit, Partikel) nur mit geprüften `gr`-Daten und erst nach Lehrer-Charge 3 (`grOn`); die Umstellform
//    (*set it up*) nur bei `gr.sep === 1`.
// Rein: was ein Lexem an Inhalt hat, sagt der Aufrufer (`Avail`).

/** Inhalt, den die Formen brauchen (aus Karte, Satzbank und Lehrer-Chargen; der Aufrufer füllt es). */
export type Avail = {
  /** deutscher Chunk für „ohne Satz“ (Pflicht für jedes Lexem; fehlt er, fällt „ohne Satz“ auf den Satz zurück). */
  de?: boolean;
  /** Ton (Sprachausgabe) verfügbar. */
  audio?: boolean;
  /** deutscher Satz zum Satz (für `de_sent`). */
  deSent?: boolean;
  /** Satzanfänge (für `complete`). */
  starts?: boolean;
  /** geprüfte Wortpartner (für `partner`). */
  partner?: boolean;
  /** geprüfte Wortfamilie / andere Wortform (für `family`). */
  family?: boolean;
  /** geprüfte Situation (für `situation`, M29). */
  situation?: boolean;
  /** Claude verfügbar (für `own`, `diplomatic`; V4). */
  ai?: boolean;
  /** Anki-Modus an (Großpaket A S6b-3): jede Verstehen-Abfrage wird Aufdecken mit Selbsturteil; Benutzen bleibt getippt (A7, F3). */
  anki?: boolean;
  /** Diktat/Erkennung verfügbar (für `say`). */
  speech?: boolean;
  /** Lehrer-Charge 3 geprüft: M78–M81 frei. */
  grOn?: boolean;
};

/**
 * Formen-Leiter je Stufe (Benutzen) für planwirksame Abfragen außerhalb der Lernschritte. Reihenfolge = Vorrang bei Gleichstand.
 * Stufe 2 außerhalb von Tag 0 (nach Abstieg oder wenn Schritt B nicht gelang) fragt FREI ab (synthese §2.3: „B frei richtig“); die Stützen
 * (Anfangsbuchstabe = Schritt A, Satz vervollständigen) bleiben den Lernschritten und dem freien Üben, sonst kommt das Wort mit „höchstens
 * Hard“ nie über Stufe 2 (Simulation V2).
 */
export const LADDER_B: Readonly<Record<number, readonly Form[]>> = {
  1: ['intro', 'probe'],
  2: ['gap', 'de_sent', 'nosent'],
  3: ['gap', 'partner', 'cloze_part', 'prep', 'particle', 'count'],
  4: ['gap', 'de_sent', 'nosent'],
  5: ['family', 'partner', 'gap', 'de_sent', 'situation', 'nosent', 'diplomatic', 'own'],
  6: ['gap', 'partner', 'family', 'own', 'situation', 'say', 'nosent'],
  7: ['gap', 'say', 'nosent', 'situation'],
};

/**
 * Verstehen-Formen je Stufe (nur Verstehen fällig, plan.md §3.2: nie eine Auswahl). Politur P2 (E3 „Hören“): Mit Ton wechselt die Spur
 * zwischen „Bedeutung lesen“ und den Hör-Formen – je Wort die schwächere, nie zweimal dieselbe (`pickForm`). Ab Stufe 5 steht „Satz hören“
 * an der Stelle des Diktats, bis das Diktat eine eigene Karte hat (`NO_CARD`).
 */
export const LADDER_U: Readonly<Record<number, readonly Form[]>> = {
  1: ['meaning', 'listen'],
  2: ['meaning', 'listen'],
  3: ['meaning', 'tone_mean', 'listen', 'tiles'],
  4: ['meaning', 'tone_mean', 'listen', 'tiles'],
  5: ['meaning', 'tone_mean', 'listen', 'dictation'],
  6: ['meaning', 'tone_mean', 'listen', 'dictation'],
  7: ['meaning', 'tone_mean', 'listen', 'dictation'],
};

/** Mindestabstand der Verstehen-Stabilität für die schweren Formen ab Stufe 4 (plan.md §3.2, konfigurierbar). */
export const HEAVY_MIN_US = 3;
/** Ab dieser Stufe jeder 3. Benutzen-Abruf ohne Satz. */
export const NOSENT_FROM_LV = 4;
export const NOSENT_EVERY = 3;
/** Satzbindung (M57): so viele Termine ohne Satz nach dem Signal „satzgebunden“. */
export const BOUND_TERMS = 2;
/** … ausgelöst nach so vielen Fehlern in Folge in neuen Sätzen. */
export const BOUND_MISSES = 2;
/** Derselbe Satz kommt für den Formabruf frühestens nach so vielen Tagen wieder (M57). */
export const SENTENCE_REST_DAYS = 30;
/** „Gesucht: …“ (deutsche Bedeutung an der Lücke) bis einschließlich dieser Stufe (M25). */
export const CUE_MAX_LV = 4;

export const emptyFq = (): Fq => ({ l: null, c: 0, h: {}, nb: 0, ak: null, ew: [] });
export const fqOf = (l: Lex): Fq => l.fq ?? emptyFq();

/** Wirksame Stufe für die Formwahl: Stufe 4+ ohne `u.s ≥ 3` nimmt die Formen der Stufe 3. */
export function formLevel(l: Lex): number {
  return l.lv >= 4 && l.u.s < HEAVY_MIN_US ? 3 : Math.max(1, Math.min(7, l.lv));
}

/**
 * Formen der Leitern, für die es noch keine eigene Karte gibt (Politur P2): Sie werden nicht gewählt, bis ihre Karte gebaut ist. Vorher
 * zeigte die Runde an ihrer Stelle die ganze Lücke bzw. „Bedeutung lesen“ – bei `cloze_part` mit der Note einer Teil-Lücke (höchstens
 * „Schwer“, kein Beleg-Tag): richtig getippte Wendungen stiegen nie auf, das Band sagte „knapp“ (Prüfbericht S2).
 */
export const NO_CARD: ReadonlySet<Form> = new Set(['cloze_part', 'tiles', 'dictation']);
/** Hör-Formen mit eigener Karte (Politur P2, E3): „Hören → Bedeutung tippen“ und „Satz hören → Wort tippen“. */
export const HEAR_FORMS: ReadonlySet<Form> = new Set(['tone_mean', 'listen']);

/** Ist die Form für dieses Lexem stellbar? */
export function available(f: Form, l: Lex, av: Avail): boolean {
  const multi = l.k !== 'w';
  if (NO_CARD.has(f)) return false;
  switch (f) {
    case 'gap':
    case 'gap_hint':
    case 'meaning':
      return true;
    case 'nosent':
      return av.de !== false;
    case 'listen':
    case 'tone_mean':
    case 'dictation':
      return !!av.audio;
    case 'de_sent':
      return !!av.deSent;
    case 'cloze_part':
      return multi;
    case 'tiles':
      return l.k === 'ch';
    case 'complete':
      return !!av.starts;
    case 'partner':
      return !!av.partner;
    case 'family':
      return !!av.family;
    case 'situation':
      return !!av.situation;
    case 'own':
    case 'diplomatic':
      return !!av.ai && (f !== 'diplomatic' || l.reg !== null);
    case 'say':
      return !!av.speech;
    case 'prep':
      return !!av.grOn && !!l.gr?.pat && /\b(about|at|by|for|from|in|into|of|on|to|with|over|against|towards?)\b/.test(l.gr.pat);
    case 'count':
      return !!av.grOn && l.gr?.cnt === 'u';
    case 'particle':
      return !!av.grOn && l.k === 'pv';
    case 'probe':
    case 'intro':
      return true;
    default:
      return false;
  }
}

export type FormPick = {
  form: Form;
  /** mit englischem Satz (`s`) oder ohne (`n`). */
  sent: 's' | 'n' | '-';
  /** „Gesucht: …“ an der Lücke (M25). */
  cue: boolean;
  /** Umstellform *set it up* (M81, nur `gr.sep === 1`). */
  swap: boolean;
};

/** Formen mit höchstens Hard (Teilabruf mit Stütze): nie zweimal hintereinander, M78/M79/M81 nur nach passendem Fehler (learning-scientist V2, Blocker 1). */
export const CAPPED: ReadonlySet<Form> = new Set(['gap_hint', 'cloze_part', 'complete', 'prep', 'count', 'particle']);
/** Fehlerprofil, das die gezielte Form freischaltet (synthese M78: „gezielt nach dem Fehlerprofil des Lexems“). */
const PROFILE_FORM: Partial<Record<Form, 'prep' | 'plural' | 'order'>> = { prep: 'prep', count: 'plural', particle: 'order' };

/** Trefferquote einer Form beim Lexem: richtig ohne Hilfe (auch bei Formen mit höchstens Hard), geglättet: unbekannte Formen 0,5. */
export function hitRate(fq: Fq, f: Form): number {
  const [n, ok] = fq.h[f] ?? [0, 0];
  return (ok + 1) / (n + 2);
}

/** Muss der nächste Benutzen-Abruf ohne Satz sein? (jeder 3. ab Stufe 4, oder Satzbindung) */
export function needsNoSentence(l: Lex): boolean {
  const fq = fqOf(l);
  const lv = formLevel(l);
  // Satzbindung wirkt ab Stufe 2 (sie senkt das Lexem oft unter Stufe 4, learning-scientist V2 Befund 5); jeder 3. ohne Satz ab Stufe 4.
  return (lv >= 2 && fq.nb > 0) || (lv >= NOSENT_FROM_LV && fq.c % NOSENT_EVERY === NOSENT_EVERY - 1);
}

/** Form für eine fällige Abfrage der Spur `track` (M22). */
export function pickForm(l: Lex, track: TrackKey, av: Avail): FormPick {
  const p = pickLadder(l, track, av);
  // Anki-Modus (S6b-3): das Aufdecken ersetzt nur „Bedeutung“; Hör-Formen bleiben objektive Kontrollen (learning-scientist Befund 3, Kap. 15).
  return track === 'u' && av.anki && p.form === 'meaning' ? { form: 'flip', sent: 'n', cue: false, swap: false } : p;
}

function pickLadder(l: Lex, track: TrackKey, av: Avail): FormPick {
  const lv = formLevel(l);
  const fq = fqOf(l);
  const ladder = (track === 'u' ? LADDER_U : LADDER_B)[lv] ?? [];
  const prof = new Set(fq.e ?? []);
  let cands = ladder.filter((f) => f !== 'intro' && f !== 'probe' && available(f, l, av) && (!PROFILE_FORM[f] || prof.has(PROFILE_FORM[f])));
  // Stufe 2: „ohne Satz“ (die schwerste freie Form) nur direkt nach einer Lücke, sonst steigt am Boden der Leiter der Fehlerzähler.
  if (track === 'b' && lv === 2 && fq.l !== 'gap' && !(fq.nb > 0)) cands = cands.filter((f) => f !== 'nosent');
  // Formen mit höchstens Hard nie zweimal hintereinander.
  if (fq.l && CAPPED.has(fq.l)) cands = cands.filter((f) => !CAPPED.has(f));
  // Ab Stufe 2: höchstens eine stellbare Form → „ohne Satz“ als zweite, damit keine Stufe nur eine Abfrageart hat (Kap. 15).
  if (track === 'b' && lv >= 2 && (cands.length < 2 || fq.nb > 0) && !cands.includes('nosent') && available('nosent', l, av)) cands = [...cands, 'nosent'];
  if (track === 'b' && lv >= 2) {
    const nos = needsNoSentence(l);
    if (nos || lv >= NOSENT_FROM_LV) {
      const want = nos ? 'n' : 's';
      const m = cands.filter((f) => FORM_SPEC[f].sent === want);
      if (m.length) cands = m;
    }
  }
  if (cands.length > 1 && fq.l) cands = cands.filter((f) => f !== fq.l);
  if (!cands.length) cands = [track === 'u' ? 'meaning' : 'gap'];
  let best = cands[0] as Form;
  for (const f of cands) if (hitRate(fq, f) < hitRate(fq, best)) best = f;
  const sent = FORM_SPEC[best].sent;
  return { form: best, sent, cue: sent === 's' && lv <= CUE_MAX_LV && track === 'b', swap: best === 'particle' && l.gr?.sep === 1 && (fq.h.particle?.[0] ?? 0) % 2 === 1 };
}

/**
 * Satz für eine Abfrage mit Satz (M57): Einführungstag und Folgetag der Ankersatz (`keys[0]`); danach ein Satz, der in den letzten 30 Tagen
 * nicht gezeigt wurde (der am längsten nicht gezeigte zuerst). Gibt es keinen, der am längsten nicht gezeigte. `null` = kein Satz vorhanden.
 */
export function pickSentence(l: Lex, keys: readonly string[], day: string, opts: { fresh?: boolean } = {}): string | null {
  if (!keys.length) return null;
  const anchor = keys[0] as string;
  // Schritt B und Wiederkehr nach Fehler an Tag 0–1: in einem NEUEN Satz (synthese §2.3 Stufe 2, M49/M53; learning-scientist V2 Befund 4).
  if (opts.fresh && keys.length > 1 && (!l.intro || daysBetween(l.intro, day) <= 1)) return keys[1] as string;
  if (!l.intro || daysBetween(l.intro, day) <= 1 || keys.length === 1) return anchor;
  const last = new Map(l.sn.map(([k, d]) => [k, d]));
  const rest = keys.filter((k) => k !== anchor || last.has(k));
  const age = (k: string) => (last.has(k) ? daysBetween(last.get(k) as string, day) : 10_000);
  const sorted = [...rest].sort((a, b) => age(b) - age(a) || keys.indexOf(a) - keys.indexOf(b));
  const fresh = sorted.find((k) => age(k) >= SENTENCE_REST_DAYS);
  return fresh ?? (sorted[0] as string);
}

/**
 * Leck-Prüfung eines Satzes (M24, M57): verrät der Satz das Ziel? Ja, wenn das Ziel (oder eine Form mit gleichem Anfang ≥ 5 Buchstaben)
 * außerhalb der Lücke noch einmal vorkommt. Satzformat wie in den Inhalten: Ziel in eckigen Klammern.
 */
export function leaks(sentence: string, target: string): boolean {
  const outside = sentence.replace(/\[[^\]]*\]/g, ' ').toLowerCase();
  const words = target.toLowerCase().split(/\s+/).filter((w) => w.length >= 4 && !['with', 'into', 'from', 'that', 'this', 'about'].includes(w));
  return words.some((w) => new RegExp(`\\b${w.slice(0, Math.min(5, w.length)).replace(/[^a-z]/g, '')}`).test(outside));
}

/** Formen-Statistik nach einer Antwort fortschreiben (rein). */
export function updateFq(l: Lex, x: { form: Form; track: TrackKey | null; correct: boolean; anchor: boolean | null; wrong: boolean; evadeHit?: string | null; counted: boolean; error?: 'prep' | 'plural' | 'order' | null }): Fq {
  const fq = fqOf(l);
  const h = { ...fq.h };
  const [n, ok] = h[x.form] ?? [0, 0];
  h[x.form] = [n + 1, ok + (x.correct ? 1 : 0)];
  const e = x.error && !(fq.e ?? []).includes(x.error) ? [...(fq.e ?? []), x.error] : fq.e;
  let { c, nb, ak } = fq;
  const noSent = FORM_SPEC[x.form].sent === 'n';
  // „Jeder 3. ohne Satz“ zählt jeden Benutzen-Abruf ab Stufe 4, auch Übung ohne Planwirkung (sonst rutscht der Anteil unter 30 %, Simulation V2).
  if (x.track === 'b' && formLevel(l) >= NOSENT_FROM_LV) c += 1;
  // Satzbindung baut sich ab Stufe 2 ab: nach BOUND_TERMS Abrufen ohne Satz wieder Formen mit Satz (learning-scientist V2, Nachprüfung 1).
  if (x.track === 'b' && noSent && nb > 0 && formLevel(l) >= 2) nb -= 1;
  let xf = fq.xf ?? 0;
  if (x.anchor === true) {
    ak = x.wrong ? 0 : 1;
    xf = 0;
  } else if (x.anchor === false && FORM_SPEC[x.form].sent === 's' && ak === 1 && x.counted) {
    // nur Antworten mit Planwirkung zählen (eine Buchung je Lerntag): die Wiederkehr am selben Tag ist derselbe Gedächtniszustand.
    // Signal „satzgebunden“ (synthese §2.1): im Ankersatz zuletzt richtig, in neuen Sätzen BOUND_MISSES-mal in Folge falsch → 2 Termine
    // ohne Satz. Ein einzelner Fehler im neuen Satz ist noch kein Muster. Danach ist das Signal verbraucht, bis der Ankersatz wieder gelingt.
    xf = x.wrong ? xf + 1 : 0;
    if (xf >= BOUND_MISSES) {
      nb = BOUND_TERMS;
      ak = null;
      xf = 0;
    }
  }
  const hit = x.evadeHit ? x.evadeHit.slice(0, 60) : null; // Schema: ≤ 60 Zeichen (data-guard V2)
  const ew = hit && !fq.ew.includes(hit) ? [...fq.ew, hit].slice(-8) : fq.ew;
  return { l: x.form, c, h, nb, ak, ew, ...(xf ? { xf } : {}), ...(e?.length ? { e } : {}) };
}
