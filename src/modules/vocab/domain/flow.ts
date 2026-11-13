import { isProblem, leechTreatment } from './leech';
import { addDays, dayKey } from '../shared';
import { type Band, bandOf } from './band';
import { type CardSentence, chooseSentence, cueOf, headShown, type Pos, posOf, sentencesOf, targetOf, type Teach, tipOf, usableSentences } from './card';
import { type Catalog, loadByDay } from './catalog';
import { type Check, type CheckDict, checkAnswer, damerau, type Target } from './check';
import { FORM_SPEC } from './grade';
import { meaningBare } from './forms';
import { type Answer, type AnswerResult, applyAnswer, FLAG, type PlanCtx, probeKnown } from './planner';
import type { UseInput } from './apply';
import type { Task } from './session';
import type { Form, FormStats, Grade, Lex, Outcome, VocabCfg } from './types';

// Wörter-Modul V3 Schritt 2b: Ablauf EINER Lernkarte, rein gerechnet (v3-bau.md §1–3). Was die Karte zeigt (`cardOf`), wie eine Antwort
// gewertet wird (`evaluate`), welche Buchung daraus wird (`answerOf`) und das Band davor (`previewOf`). Geschrieben wird erst beim Weiter
// (data/store.ts); der Entwurf dafür ist `Draft` (im Browser unter `lx:vm-pending`, nachgebucht nur, wenn das Lexem ihn noch nicht kennt).

type Doc = Record<string, unknown>;

/**
 * Darstellung: `intro` neues Wort (Satz, kurz versuchen, aufdecken) · `probe` „Kenne ich schon“ frei ohne Satz · `gap` Lücke im Satz ·
 * `nosent` Deutsch → Englisch ohne Satz (bei `probe` seit Politur P2: Wort → deutsche Bedeutung, siehe `asksMeaning`) · `meaning` markiertes Wort im Satz → deutsche Bedeutung (Verstehen-Spur) ·
 * `flip` Anki-Modus: Wort (im Satz) → Aufdecken → Selbsturteil (nur Verstehen, A7/F3) ·
 * `tone_mean` Hören → Bedeutung: nur der Klang des Worts, getippt wird die deutsche Bedeutung (Verstehen) ·
 * `listen` Satz hören → Wort tippen: der Satz wird vorgelesen, im Text ist das Wort eine Lücke (Verstehen, höchstens „Gut“).
 */
export type CardMode = 'intro' | 'probe' | 'gap' | 'nosent' | 'meaning' | 'flip' | 'tone_mean' | 'listen';

/**
 * Politur P2 (E3 „Hören“, „Kennst du es schon?“): Karten, deren Antwort die deutsche Bedeutung ist – „Bedeutung lesen“ (Wort markiert im
 * Satz), „Hören → Bedeutung“ (nur der Klang des Worts) und die Probe nach „Ja, prüf mich“ (das Wort stand auf der Vorkarte schon da; die
 * Probe prüft, ob Emrah es versteht, das Benutzen prüft die Kontrolle in 7 Tagen). Lösung, Prüfung und Warum laufen für alle gleich.
 */
export const asksMeaning = (mode: CardMode): boolean => mode === 'meaning' || mode === 'tone_mean' || mode === 'probe';
/** Bedeutung ohne Satz („hier“ passt nicht): Hören → Bedeutung, Probe und „Bedeutung“ ohne Satz. Ihr Warum hat eigene Texte `vmWhyBare…`. */
export const bareMeaning = (m: Pick<CardModel, 'mode' | 'sentence'>): boolean => m.mode === 'tone_mean' || m.mode === 'probe' || (m.mode === 'meaning' && !m.sentence);
/** Hör-Karten (Politur P2): Ton ist die Frage; ohne Ton zeigt die Karte stattdessen die Textform (`textOf`). */
export const isHear = (mode: CardMode): boolean => mode === 'tone_mean' || mode === 'listen';

/**
 * „Kann gerade nicht hören“ (Politur P2): dieselbe Abfrage als Text – „Bedeutung lesen“ im selben Satz (Satz hören) bzw. das Wort als Text
 * (Hören → Bedeutung). Gebucht wird dann `meaning`; der Wechsel selbst hat keine Note. Andere Karten bleiben, wie sie sind.
 */
export function textOf(m: CardModel): CardModel {
  return isHear(m.mode) ? { ...m, mode: 'meaning', form: 'meaning' } : m;
}

export type CardModel = {
  path: string;
  mode: CardMode;
  /** Form, mit der die Antwort gebucht wird (Formen ohne eigene Darstellung fallen auf `gap`/`nosent`/`meaning` zurück, ehrlich gebucht). */
  form: Form;
  head: string;
  de: string;
  /** Englische Erklärung aus dem Wort-Dokument (`def`), leer ohne. Nur Anzeige (Einführungs- und Wortkarte). */
  def?: string;
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

/** Formen ohne Lernkarte: Anwenden und eigener Satz haben eine eigene Karte (`use.ts`, S5c); die übrigen kommen mit späteren Schritten. */
const LATER: ReadonlySet<Form> = new Set(['transfer', 'own', 'say', 'diplomatic', 'find_trap', 'situation']);

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Stichwort eines Dokuments (`vocab/*` → `word`, `chunk/*` → `en`). */
export const headOf = (path: string, doc: Doc): string => str(path.startsWith('chunk/') ? doc.en : doc.word);

/** Grundform zum Tippen ohne Satz (*to rely on sth* → *rely on*). */
export const baseAnswer = (head: string): string => headShown(head) || head.trim();

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
  const base = { path: task.path, head, de, def: str(doc.def), pos, teach, moreSentences: usable.length > 1, col: doc.col, ...open };
  const spec = FORM_SPEC[task.form];
  // Problemwort ab dem 3. Vergessen (Politur P2): ein Satz, den das Wort noch nie hatte, wenn es einen gibt.
  const unseen = isProblem(lex);
  const noSentence = (form: Form, mode: CardMode): CardModel => {
    const answer = baseAnswer(head);
    return { ...base, mode, form, sentence: null, answer, target: targetOf(lex, answer, pos, teach, null), cue: null, firstLetters: false };
  };
  if (task.form === 'probe') return noSentence('probe', 'probe');
  // Kontrastkarte: frischer Satz (nie der zuletzt gezeigte), „Gesucht: …“ immer (auch auf hohen Stufen) – die Falle ist der Grund der Karte.
  if (task.form === 'contrast') {
    const contrast = { w: lex.ct?.w ?? null, ff: teach.ff ?? null, pair: teach.pair ?? null };
    const cue = de ? { de, ff: !!teach.ff } : null;
    const s = chooseSentence(lex, usable, day, { fresh: true, avoid: x.avoid ?? null, unseen });
    if (!s) return { ...noSentence('contrast', 'nosent'), cue, contrast };
    return { ...base, mode: 'gap', form: 'contrast', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue, firstLetters: false, contrast };
  }
  if (task.intro) {
    const s = chooseSentence(lex, usable, day, { anchorOnly: true });
    if (!s) return { ...noSentence('intro', 'intro'), cue: cueOf({ ...lex, lv: 1 }, de, teach) };
    return {
      ...base,
      mode: 'intro',
      form: 'intro',
      sentence: s,
      answer: s.gap.answer,
      target: targetOf(lex, s.gap.answer, pos, teach, s.gap),
      cue: cueOf({ ...lex, lv: 1 }, de, teach),
      firstLetters: false,
    };
  }
  // Anki-Modus (S6b-3): Vorderseite das Wort, markiert im Satz (ohne nutzbaren Satz allein); Rückseite Bedeutung und Warum.
  if (task.form === 'flip') {
    const s = chooseSentence(lex, usable, day, { avoid: x.avoid ?? null });
    const answer = s ? s.gap.answer : baseAnswer(head);
    return { ...base, mode: 'flip', form: 'flip', sentence: s, answer, target: targetOf(lex, answer, pos, teach, s ? s.gap : null), cue: null, firstLetters: false };
  }
  // Verstehen-Spur: „Bedeutung lesen“ (Wort markiert im Satz) oder – mit Ton – eine der Hör-Formen (Politur P2, E3). Formen ohne eigene
  // Karte (Diktat, Bausteine) fallen auf „Bedeutung lesen“ zurück und werden so gebucht.
  if (spec.track === 'u') {
    // Hören → Bedeutung: nur das Wort als Klang, ohne Satz und ohne Text.
    if (task.form === 'tone_mean' && de) return noSentence('tone_mean', 'tone_mean');
    const s = chooseSentence(lex, usable, day, { avoid: x.avoid ?? null, unseen });
    // Satz hören → Wort tippen: der ganze Satz als Klang, im Text ist das Wort die Lücke.
    if (task.form === 'listen' && s) return { ...base, mode: 'listen', form: 'listen', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue: null, firstLetters: false };
    // Zweite Textform (Prüfbefund 13.11.2026, auch ohne Ton): jede zweite „Bedeutung“ zeigt das Wort ohne Satz – gebucht als `meaning`.
    if (task.form === 'meaning' && de && meaningBare(lex)) return noSentence('meaning', 'meaning');
    if (s && de) return { ...base, mode: 'meaning', form: 'meaning', sentence: s, answer: s.gap.answer, target: targetOf(lex, s.gap.answer, pos, teach, s.gap), cue: null, firstLetters: false };
    return noSentence('nosent', 'nosent');
  }
  if (task.form === 'nosent' || spec.sent === 'n') return noSentence('nosent', 'nosent');
  const s = chooseSentence(lex, usable, day, { anchorOnly: task.step === 1, fresh: task.step === 3, avoid: x.avoid ?? null, unseen });
  if (!s) return noSentence('nosent', 'nosent');
  // Gebucht wird, was gezeigt wird (Politur P2, Prüfbericht S2): Eine Wendung mit ganzer Lücke ist ein freier Abruf (`gap`), keine Teil-Lücke.
  // `cloze_part` (höchstens „Schwer“) gilt erst wieder, wenn es eine Karte gibt, die wirklich nur einen Teil der Wendung offen lässt.
  const form: Form = task.form === 'gap_hint' ? 'gap_hint' : 'gap';
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

/** Wortart der Karte → Anfang der Wortart im Wörterbuch („noun“, „verb“, „adj“, „adv“). */
const POS_DICT: Readonly<Record<string, string>> = { noun: 'n', verb: 'v', adj: 'adj', adv: 'adv' };

/** Antwort werten. `dunno` = „Weiß ich nicht“. */
export function evaluate(m: CardModel, given: string, dict: CheckDict, dunno = false): Check {
  if (dunno) return { outcome: 'dunno' };
  if (asksMeaning(m.mode)) {
    // Erst die gelernte Bedeutung; dann die Wörterbuch-Bedeutungen derselben Wortart (Emrah 05.11.2026: „grant“ → „gewähren“ war richtig).
    const own = checkMeaning(given, m.de);
    if (own.outcome !== 'wrong' || !dict.senses) return own;
    const pos = m.pos ? POS_DICT[m.pos] : null;
    const extra = dict.senses(baseAnswer(m.head)).filter((s) => !pos || s.pos.toLowerCase().startsWith(pos)).map((s) => s.de);
    if (!extra.length) return own;
    const alt = checkMeaning(given, extra.join('; '));
    // learning-scientist W7 SOLL 3: richtig, aber eine andere Bedeutung als die gelernte – das Warum sagt es („stimmt auch, gelernt: …“).
    return alt.outcome === 'ok' ? { ...alt, note: 'dict' } : own;
  }
  const c = checkAnswer(given, m.target, dict);
  // Verwechslungspaare, falsche Freunde und andere Partikel (note gesetzt) bleiben Fehler: das sind gewollte Fallen.
  if (m.mode !== 'nosent' || (c.outcome !== 'other' && c.outcome !== 'wrong') || c.note || !dict.senses) return c;
  // Emrah 07.11.2026 („robuster“ → „more robust“: „Ist doch eigentlich auch richtig?!“): ohne Satz ist es eine Übersetzung. Ein anderes
  // englisches Wort, dessen Wörterbuch-Bedeutung (gleiche Wortart) die deutsche Vorgabe trifft, passt auch (`syn`, Warum: „passt hier auch“).
  const hit = sameMeaningWord(given, m.de, m.pos, dict.senses);
  return hit ? { outcome: 'syn', hit, note: 'dict' } : c;
}

/** Deutscher Wortstamm ohne Beugungs- und Steigerungsendung (*robuster* → *robust*, *stabile* → *stabil*), nur bei genug Rest. */
function deStem(w: string): string {
  for (const end of ['eren', 'erer', 'ere', 'er', 'en', 'es', 'em', 'e']) if (w.endsWith(end) && w.length - end.length >= 4) return w.slice(0, -end.length);
  return w;
}

/** Englische Eingabe (ohne *more/most*, Artikel, *to*) mit Wörterbuch-Bedeutung, deren Stamm dem einer Vorgabe-Bedeutung gleicht. */
export function sameMeaningWord(given: string, de: string, pos: string | null | undefined, senses: NonNullable<CheckDict['senses']>): string | null {
  const g = given.trim().toLowerCase().replace(/\s+/g, ' ');
  const comparative = /^(more|most) /.test(g);
  const head = g.replace(/^(more|most|the|a|an|to) /, '');
  if (!head || head.split(' ').length > 3) return null;
  const want = new Set(meaningVariants(de).flatMap((v) => [v, deStem(v)]));
  if (!want.size) return null;
  const wantPos = pos ? POS_DICT[pos] : comparative ? 'adj' : null;
  const cands = [head, ...(head.endsWith('ier') ? [`${head.slice(0, -3)}y`] : []), ...(head.endsWith('er') ? [head.slice(0, -2), head.slice(0, -1)] : [])];
  for (const w of cands)
    for (const s of senses(w)) {
      if (wantPos && !s.pos.toLowerCase().startsWith(wantPos)) continue;
      if (meaningVariants(s.de).some((v) => want.has(v) || want.has(deStem(v)))) return given.trim();
    }
  return null;
}

// ---------------------------------------------------------------- Buchung und Band

/** Was beim Prüfen eingefroren wird (v3-bau §6 Nr. 3): Zeit, Dauer, Zeit bis zum ersten Zeichen, Hilfe. */
export type Frozen = { t: number; ms: number; fk: number; hint: number };

/** Antwort für den Planer. `override`: „Das wusste ich eigentlich“; `later`: „Später prüfen lassen“; `alsoRight`: Claude sagt „passt auch“. */
export function answerOf(m: CardModel, c: Check, f: Frozen, o: { override?: boolean; later?: boolean; alsoRight?: boolean; step?: boolean; unfair?: boolean; self?: Grade } = {}): Answer {
  const outcome: Outcome = o.alsoRight ? 'syn' : c.outcome;
  // M43 „Aufgabe war unfair“: Ausgang `unfair` plus Kennzeichen für die Inhaltsprüfung im Verlauf. Aufdecken: Selbsturteil mit FLAG.anki.
  const anki = m.form === 'flip' && o.self !== undefined && c.outcome !== 'unfair';
  const flags = (o.override ? FLAG.override : 0) | (o.later ? FLAG.later : 0) | (o.step ? FLAG.step : 0) | (c.outcome === 'unfair' || o.unfair ? FLAG.unfair : 0) | (anki ? FLAG.anki : 0);
  return {
    ...(anki ? { self: o.self } : {}),
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
  soon?: boolean;
}): Band | null {
  const m = x.m;
  // Bedeutung (gelesen oder gehört): Lösung ist die deutsche Bedeutung; Warum nennt Wort = Bedeutung.
  const meaning = asksMeaning(m.mode);
  const answer = meaning ? m.de : m.answer;
  const band = bandOf({
    check: x.check,
    given: x.given,
    answer,
    de: meaning ? m.answer : m.de,
    pos: m.pos,
    teach: m.teach,
    lang: x.lang,
    before: x.before,
    result: x.result,
    planned: x.planned,
    t: x.t,
    moreSentences: m.moreSentences,
    col: m.col,
    ...(x.meaningOf && !meaning ? { meaningOf: x.meaningOf } : {}),
    ...(meaning ? { meaning: true } : {}),
    ...(x.soon === false ? { soon: false } : {}),
  });
  // Hören → Bedeutung und Probe: dieselben Warum-Sätze, aber ohne „hier“ (es gab keinen Satz) – eigene Texte `vmWhyBare…`.
  if (band && bareMeaning(m) && band.why.kind === 'rule' && band.why.key.startsWith('vmWhyMean')) return { ...band, why: { ...band.why, key: band.why.key.replace(/^vmWhyMean/, 'vmWhyBare') } };
  return band;
}

/**
 * Was die Karte von selbst vorliest bzw. als Ton stellt (Politur P2, E3): Einführung = Wort, dann der Satz · Hören → Bedeutung = das Wort ·
 * Satz hören = der ganze Satz. `null` = die Karte hat keinen eigenen Ton. Derselbe Text geht ans Vorab-Rechnen (`prefetchSpeech`), damit der
 * Ton beim Erscheinen der Karte sofort spielt.
 */
export function audioOf(m: CardModel): string | null {
  const sentence = m.sentence ? m.sentence.gap.segs.map((g) => g.s).join('') : '';
  if (m.mode === 'tone_mean') return m.answer || null;
  if (m.mode === 'listen') return sentence || null;
  if (m.mode === 'intro') {
    const word = baseAnswer(m.head);
    return sentence ? `${word}. ${sentence}` : word || null;
  }
  return null;
}

/** Tipp-Zeile (`vmTip`/`vmTipOne`). */
export const tipFor = (m: CardModel) => tipOf(m.answer);

// ---------------------------------------------------------------- Entwurf (Browser), damit nichts verloren geht

/**
 * Offene Buchung, im Browser gemerkt, bis sie geschrieben ist. `kind`: Antwort, Einführung, Probe oder Verwendung (Anwenden / eigener Satz,
 * mit Claudes Urteil `u`; je Zielwort ein Entwurf).
 */
export type Draft = { v: 1; kind: 'answer' | 'intro' | 'probe' | 'use'; path: string; planned: boolean; a: Answer; u?: UseInput };

const isUseInput = (v: unknown): v is UseInput => {
  if (!v || typeof v !== 'object') return false;
  const u = v as Record<string, unknown>;
  return typeof u.t === 'number' && (u.form === 'transfer' || u.form === 'own') && typeof u.v === 'string' && typeof u.lvAt === 'number' && typeof u.evidenceOnly === 'boolean';
};

export function isDraft(v: unknown): v is Draft {
  if (!v || typeof v !== 'object') return false;
  const d = v as Record<string, unknown>;
  const a = d.a as Record<string, unknown> | undefined;
  const kindOk = d.kind === 'answer' || d.kind === 'intro' || d.kind === 'probe' || (d.kind === 'use' && isUseInput(d.u));
  // Aufdecken bucht nur mit gültigem Selbsturteil 1–4 (sonst gäbe gradeOf eine beliebige Note weiter).
  const selfOk = !a || a.form !== 'flip' || (typeof a.self === 'number' && [1, 2, 3, 4].includes(a.self));
  return (
    d.v === 1 &&
    kindOk &&
    selfOk &&
    typeof d.path === 'string' &&
    /^(vocab|chunk)\//.test(d.path) &&
    typeof d.planned === 'boolean' &&
    !!a &&
    typeof a.t === 'number' &&
    typeof a.form === 'string' &&
    typeof a.outcome === 'string'
  );
}

/** Muss der Entwurf noch gebucht werden? Antwort/Probe: das Lexem kennt diese Zeit noch nicht (`sync < t`); Einführung: noch nicht eingeführt. */
export function draftOpen(d: Draft, lex: Lex | null): boolean {
  if (!lex) return false;
  if (d.kind === 'intro') return lex.intro === null;
  return lex.sync < d.a.t;
}
