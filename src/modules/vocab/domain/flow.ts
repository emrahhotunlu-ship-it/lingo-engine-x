import { leechTreatment } from './leech';
import { addDays, dayKey } from '../shared';
import { type Band, bandOf } from './band';
import { type CardSentence, chooseSentence, cueOf, headWords, type Pos, posOf, sentencesOf, targetOf, type Teach, tipOf, usableSentences } from './card';
import { type Catalog, loadByDay } from './catalog';
import { type Check, type CheckDict, checkAnswer, damerau, type Target } from './check';
import { FORM_SPEC } from './grade';
import { type Answer, type AnswerResult, applyAnswer, FLAG, type PlanCtx, probeKnown } from './planner';
import type { Task } from './session';
import type { Form, FormStats, Lex, Outcome, VocabCfg } from './types';

// Wörter-Modul V3 Schritt 2b: Ablauf EINER Lernkarte, rein gerechnet (v3-bau.md §1–3). Was die Karte zeigt (`cardOf`), wie eine Antwort
// gewertet wird (`evaluate`), welche Buchung daraus wird (`answerOf`) und das Band davor (`previewOf`). Geschrieben wird erst beim Weiter
// (data/store.ts); der Entwurf dafür ist `Draft` (im Browser unter `lx:vm-pending`, nachgebucht nur, wenn das Lexem ihn noch nicht kennt).

type Doc = Record<string, unknown>;

/**
 * Darstellung: `intro` neues Wort (Satz, kurz versuchen, aufdecken) · `probe` „Kenne ich schon“ frei ohne Satz · `gap` Lücke im Satz ·
 * `nosent` Deutsch → Englisch ohne Satz · `meaning` markiertes Wort im Satz → deutsche Bedeutung (Verstehen-Spur).
 */
export type CardMode = 'intro' | 'probe' | 'gap' | 'nosent' | 'meaning';

export type CardModel = {
  path: string;
  mode: CardMode;
  /** Form, mit der die Antwort gebucht wird (Formen ohne eigene Darstellung fallen auf `gap`/`nosent`/`meaning` zurück, ehrlich gebucht). */
  form: Form;
  head: string;
  de: string;
  pos: Pos | null;
  teach: Teach;
  sentence: CardSentence | null;
  /** Gesuchtes (Englisch; bei `meaning` das markierte Wort). */
  answer: string;
  target: Target;
  /** „Gesucht: …“ an der Lücke. */
  cue: { de: string; ff: boolean } | null;
  /** Lernschritt A: Anfangsbuchstaben stehen schon da (Tipp gilt als genutzt). */
  firstLetters: boolean;
  moreSentences: boolean;
  col: unknown;
  /** Kontrastkarte (M14, ohne Planwirkung): womit verwechselt (`w`, null = Leech) und die Lehrer-Falle (falscher Freund / Paar). */
  contrast?: { w: string | null; ff: string | null; pair: string | null };
};

/** Formen, die erst mit späteren Schritten eine eigene Karte bekommen (Anwenden V4, Kontrast Schritt 3, mit Claude V4). */
const LATER: ReadonlySet<Form> = new Set(['transfer', 'own', 'say', 'diplomatic', 'find_trap', 'situation']);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Stichwort eines Dokuments (`vocab/*` → `word`, `chunk/*` → `en`). */
export const headOf = (path: string, doc: Doc): string => str(path.startsWith('chunk/') ? doc.en : doc.word);

/** Grundform zum Tippen ohne Satz (*to rely on sth* → *rely on*). */
export const baseAnswer = (head: string): string => headWords(head).join(' ') || head.trim();

/**
 * Was zeigt die Karte zu dieser Aufgabe? `null` = diese Form hat noch keine Karte (die Runde geht weiter, ohne zu buchen).
 * `avoid` = zuletzt gezeigter Satz dieses Lexems (Wiederkehr nie im selben Satz).
 */
export function cardOf(x: { task: Task; doc: Doc; lex: Lex; teach: Teach; nowMs: number; sbGate: unknown; avoid?: string | null }): CardModel | null {
  const { task, doc, lex, teach } = x;
  if (LATER.has(task.form)) return null;
  const head = headOf(task.path, doc);
  if (!head) return null;
  const de = str(doc.de);
  const pos = posOf(doc.pos);
  const day = dayKey(x.nowMs);
  const { ok: usable } = usableSentences(sentencesOf(doc, x.nowMs, x.sbGate), head, lex.k === 'pv');
  // Offener Kontrast bei einer fälligen Abfrage (die Kontrastkarte entfällt dann): das Band nennt die Falle trotzdem.
  const open = lex.ct ? { contrast: { w: lex.ct.w ?? null, ff: teach.ff ?? null, pair: teach.pair ?? null } } : {};
  const base = { path: task.path, head, de, pos, teach, moreSentences: usable.length > 1, col: doc.col, ...open };
  const spec = FORM_SPEC[task.form];
  const noSentence = (form: Form, mode: CardMode): CardModel => {
    const answer = baseAnswer(head);
    return { ...base, mode, form, sentence: null, answer, target: targetOf(lex, answer, pos, teach, null), cue: null, firstLetters: false };
  };
  if (task.form === 'probe') return noSentence('probe', 'probe');
  // Kontrastkarte: frischer Satz (nie der zuletzt gezeigte), „Gesucht: …“ immer (auch auf hohen Stufen) – die Falle ist der Grund der Karte.
  if (task.form === 'contrast') {
    const contrast = { w: lex.ct?.w ?? null, ff: teach.ff ?? null, pair: teach.pair ?? null };
    const cue = de ? { de, ff: !!teach.ff } : null;
    const s = chooseSentence(lex, usable, day, { fresh: true, avoid: x.avoid ?? null });
    if (!s) return { ...noSentence('contrast', 'nosent'), cue, contrast };
    return { ...base, mode: 'gap', form: 'contrast', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue, firstLetters: false, contrast };
  }
  if (task.intro) {
    const s = chooseSentence(lex, usable, day, { anchorOnly: true });
    if (!s) return { ...noSentence('intro', 'intro'), cue: cueOf({ ...lex, lv: 1 }, de, teach) };
    return { ...base, mode: 'intro', form: 'intro', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue: cueOf({ ...lex, lv: 1 }, de, teach), firstLetters: false };
  }
  // Verstehen-Spur: das Wort steht markiert im Satz, gesucht ist die Bedeutung (Hören, Bausteine und Aufdecken folgen mit eigenen Karten).
  if (spec.track === 'u') {
    const s = chooseSentence(lex, usable, day, { avoid: x.avoid ?? null });
    if (s && de) return { ...base, mode: 'meaning', form: 'meaning', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue: null, firstLetters: false };
    return noSentence('nosent', 'nosent');
  }
  if (task.form === 'nosent' || spec.sent === 'n') return noSentence('nosent', 'nosent');
  const s = chooseSentence(lex, usable, day, { anchorOnly: task.step === 1, fresh: task.step === 3, avoid: x.avoid ?? null });
  if (!s) return noSentence('nosent', 'nosent');
  const form: Form = task.form === 'gap_hint' || task.form === 'gap' || task.form === 'cloze_part' ? task.form : 'gap';
  return {
    ...base,
    mode: 'gap',
    form,
    sentence: s,
    answer: s.gap.answer,
    target: targetOf(lex, s.gap.answer, pos, teach, s.gap),
    cue: task.cue ? cueOf(lex, de, teach) : null,
    firstLetters: form === 'gap_hint',
  };
}

// ---------------------------------------------------------------- Bedeutung (Deutsch) prüfen

const ARTICLE_DE = /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|sich|etw\.?|etwas|jdn\.?|jdm\.?|jemanden|jemandem|zu)\s+/;

/** Deutsch vergleichbar machen: klein, ß → ss, Umlaut-Umschrift, ohne Satzzeichen, ohne Artikel/Platzhalter am Anfang. */
export function canonDe(s: string): string {
  let t = s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/ae/g, 'ä')
    .replace(/oe/g, 'ö')
    .replace(/ue/g, 'ü')
    .replace(/[^a-zäöü0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (let i = 0; i < 3 && ARTICLE_DE.test(t); i++) t = t.replace(ARTICLE_DE, '');
  return t;
}

/** Bedeutungen aus `de` („Angebot (Preis); Kostenvoranschlag / Offerte“): getrennt an , ; / „oder“, ohne Klammern. */
export function meaningVariants(de: string): string[] {
  const out = de
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/[,;/]|\boder\b/)
    .map(canonDe)
    .filter((v) => v.length > 0);
  return [...new Set(out)];
}

/**
 * Bedeutung prüfen (Form `meaning`): genau eine Bedeutung aus `de` → richtig; ein Teil davon, der den Kern trägt (≥ 60 % der Länge, ganze
 * Wörter) → richtig; kleiner Tippfehler (1, ab 7 Zeichen 2) → Tippfehler; sonst falsch. Strenger Vergleich mit Ausweg „War das auch richtig?“.
 */
export function checkMeaning(given: string, de: string): Check {
  const g = canonDe(given);
  if (!g) return { outcome: 'dunno' };
  const vs = meaningVariants(de);
  if (vs.includes(g)) return { outcome: 'ok' };
  for (const v of vs) {
    const words = ` ${v} `;
    if (g.length >= 4 && words.includes(` ${g} `) && g.length >= 0.6 * v.length) return { outcome: 'ok', hit: v };
    const lim = v.length >= 7 ? 2 : v.length >= 4 ? 1 : 0;
    if (lim > 0) {
      const d = damerau(g, v);
      if (d <= lim) return { outcome: 'typo', dist: d, hit: v };
    }
  }
  return { outcome: 'wrong' };
}

/** Antwort werten. `dunno` = „Weiß ich nicht“. */
export function evaluate(m: CardModel, given: string, dict: CheckDict, dunno = false): Check {
  if (dunno) return { outcome: 'dunno' };
  if (m.mode === 'meaning') return checkMeaning(given, m.de);
  return checkAnswer(given, m.target, dict);
}

// ---------------------------------------------------------------- Buchung und Band

/** Was beim Prüfen eingefroren wird (v3-bau §6 Nr. 3): Zeit, Dauer, Zeit bis zum ersten Zeichen, Hilfe. */
export type Frozen = { t: number; ms: number; fk: number; hint: number };

/** Antwort für den Planer. `override`: „Das wusste ich eigentlich“; `later`: „Später prüfen lassen“; `alsoRight`: Claude sagt „passt auch“. */
export function answerOf(m: CardModel, c: Check, f: Frozen, o: { override?: boolean; later?: boolean; alsoRight?: boolean; step?: boolean; unfair?: boolean } = {}): Answer {
  const outcome: Outcome = o.alsoRight ? 'syn' : c.outcome;
  // M43 „Aufgabe war unfair“: Ausgang `unfair` plus Kennzeichen für die Inhaltsprüfung im Verlauf.
  const flags = (o.override ? FLAG.override : 0) | (o.later ? FLAG.later : 0) | (o.step ? FLAG.step : 0) | (c.outcome === 'unfair' || o.unfair ? FLAG.unfair : 0);
  return {
    t: f.t,
    form: m.form,
    outcome,
    hint: m.firstLetters ? Math.max(1, f.hint) : f.hint,
    ms: f.ms,
    fk: f.fk,
    sentence: m.sentence?.sent.key ?? null,
    anchor: m.sentence ? m.sentence.sent.key === 'a' : null,
    hit: c.hit ?? null,
    ...(flags ? { flags } : {}),
  };
}

/** Planer-Zusammenhang für eine Antwort (dieselben Zahlen wie beim Schreiben in data/store.ts). */
export function planCtxOf(cat: Catalog, med: FormStats, path: string, t: number, cfg: VocabCfg, planned: boolean): PlanCtx {
  const day = dayKey(t);
  const load = loadByDay(cat, med, path);
  return { cfg, path, planned, load: (i) => load.get(addDays(day, i)) ?? 0, siblings: cat.siblingOffsets(path, day), ff: leechTreatment(cat.get(path)?.trap) === 'contrast' };
}

/** Rein gerechnetes Ergebnis (für das Band; gebucht wird dasselbe beim Weiter auf dem frischen Dokument). */
export function resultOf(lex: Lex, a: Answer, ctx: PlanCtx, probe = false): AnswerResult {
  return probe && a.outcome === 'ok' ? probeKnown(lex, a.t, ctx) : applyAnswer(lex, a, ctx);
}

export function previewOf(x: {
  m: CardModel;
  check: Check;
  given: string;
  lang: 'de' | 'en';
  before: Lex;
  result: AnswerResult;
  planned: boolean;
  t: number;
  meaningOf?: (w: string) => string | null;
}): Band | null {
  const m = x.m;
  // Bedeutung: Lösung ist die deutsche Bedeutung; Warum nennt Wort = Bedeutung.
  const answer = m.mode === 'meaning' ? m.de : m.answer;
  return bandOf({
    check: x.check,
    given: x.given,
    answer,
    de: m.mode === 'meaning' ? m.answer : m.de,
    pos: m.pos,
    teach: m.teach,
    lang: x.lang,
    before: x.before,
    result: x.result,
    planned: x.planned,
    t: x.t,
    moreSentences: m.moreSentences,
    col: m.col,
    ...(x.meaningOf && m.mode !== 'meaning' ? { meaningOf: x.meaningOf } : {}),
  });
}

/** Tipp-Zeile (`vmTip`/`vmTipOne`). */
export const tipFor = (m: CardModel) => tipOf(m.answer);

// ---------------------------------------------------------------- Entwurf (Browser), damit nichts verloren geht

/** Offene Buchung, im Browser gemerkt, bis sie geschrieben ist. `kind`: Antwort, Einführung oder Probe. */
export type Draft = { v: 1; kind: 'answer' | 'intro' | 'probe'; path: string; planned: boolean; a: Answer };

export function isDraft(v: unknown): v is Draft {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  const a = d.a as Record<string, unknown> | undefined;
  return d.v === 1 && (d.kind === 'answer' || d.kind === 'intro' || d.kind === 'probe') && typeof d.path === 'string' && /^(vocab|chunk)\//.test(d.path) && typeof d.planned === 'boolean' && !!a && typeof a.t === 'number' && typeof a.form === 'string' && typeof a.outcome === 'string';
}

/** Muss der Entwurf noch gebucht werden? Antwort/Probe: das Lexem kennt diese Zeit noch nicht (`sync < t`); Einführung: noch nicht eingeführt. */
export function draftOpen(d: Draft, lex: Lex | null): boolean {
  if (!lex) return false;
  if (d.kind === 'intro') return lex.intro === null;
  return lex.sync < d.a.t;
}
