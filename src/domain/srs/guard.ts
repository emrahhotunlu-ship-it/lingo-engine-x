import { logWarn } from '../../platform/diagnostics';
import { meaningForTask } from './cards';
import { formsOf, hasGapPlaceholder, locate, senseFits } from './context';
import { buildExercise, gapCue, meaningParts, tongueOf } from './exercise';
import type { SceneLookup } from './exercise';
import { coreWords, gapUsable, lemmaFor } from './gapFit';
import { availableExercises, CATALOG, exerciseDef, NO_ENV, retiredFor, supports } from './modes';
import type { ExerciseEnv } from './modes';
import { toUS } from '../answer/spelling';
import { isFunctionGap } from './partner';
import { activationReady, allowsContinuous, parseBrief } from './brief';
import { ACT_MAX_TARGETS, actMeaning, EX_OF_FMT, type ActTask } from './actTask';
import { HIDES_TARGET, MULTI_TARGET, NEEDS_SOURCE, parseActCode } from './actBrief';
import { eventById } from '../../content/activation/pools';
import { sceneById } from '../../content/activation/scenes';
import type { Exercise, ExerciseId, Lang, TrainCard } from './types';

// Wächter (Entscheidung Q1/Q5, 12.10.2026): Jede gebaute Vokabel-Aufgabe wird vor dem Zeigen gegen feste Regeln R1–R12 des Audits geprüft.
// `checkExercise` ist rein (keine Datenbank, kein Zufall). `guardedExercise` baut die Aufgabe, prüft sie und wählt bei einem Verstoß die
// nächste Aufgabenart (feste Reihenfolge, höchstens MAX_TRIES Versuche, keine Schleife); am Ende steht `type`, das immer geht.
//
//  R1  Lücke/Kästchen passen zu den festen Wörtern der Karte (nicht mehr Wörter, kein beliebiges Objekt)
//  R2  Lösung ist aus dem Sichtbaren ableitbar (keine Zahl/kein Name verdeckt, ein Hinweis ist da, Lösung vorhanden)
//  R3  Lösung gehört zur Karte bzw. zur Lücke (Lösung = Lücke im Satz, enthält eine Form des Kartenworts)
//  R4  nichts verraten (Kartenwort sichtbar außerhalb der Lücke, Lösung im Hinweis oder im Satz, richtige Option doppelt)
//  R5  Ablenker eindeutig falsch (nicht = Lösung, nicht im Satz, nicht ebenfalls belegt, kein Synonym)
//  R6  Wortart des Satzes passt zur Karte
//  R7  Satz sauber (kein Deutsch, keine Bedienzeichen, nicht verklebt, nicht zu lang)
//  R8  keine Funktionswort-Lücke
//  R9  Hinweis meint das Wort in der Lücke (Wortpartner: nicht die Bedeutung des Kartenworts), Satz enthält die geübte Wendung
//  R10 Aufdeck-Karte: Vorder- und Rückseite passen zusammen (Bedeutung vorhanden, verrät das Wort nicht, Rückseite zeigt das Kartenwort)
//  R11 Sprachtreue: Optionen und Hinweise in einer Sprache, passend zur Oberflächensprache bzw. dem Rückfall der Karte
//  R12 Auswahl hat genau eine richtige Option, mindestens 3 Optionen (Kontrast: 2), keine doppelten Optionen
//  R14 Aktivierungs-Aufgabe A2–A5 (Stufe 2): Vorgabe vollständig und lesbar, Zielwörter 1–3 und verschieden, Quelle beim Umformen, A4 verrät das Wort nicht
//  R13 „Eigener Satz“ (Wörter aktivieren): Vorgabe vollständig und stimmig (Lage bekannt, Wenn-Satz ohne Zeitform, Code lesbar, Bedeutung da),
//      Leitplanke: nur bei Karten mit mindestens 2 richtigen Abrufen an verschiedenen Tagen (Barcroft, tagesaufbau.md T2); keine Lücke, keine Lösung
// Nicht prüfbar im Programm: ob ein Satz inhaltlich sinnvoll ist (Satzsinn), ob eine Claude-Antwort stimmt, ob mehrere Präpositionen
// vertretbar wären (R8b, nur Hinweis im Audit).

export type GuardRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10' | 'R11' | 'R12' | 'R13' | 'R14';
export type Violation = { rule: GuardRule; why: string };

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, ' ').trim();
const bare = (t: string): string => t.toLowerCase().replace(/[^a-zäöüß0-9'-]/g, '');
const toks = (s: string): string[] => s.split(/\s+/).filter(Boolean);

/** Übungen mit einer Lücke auf dem Kartenwort in einem Satz. */
const GAP_EX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze', 'cloze_hint', 'wordfam', 'dictation', 'tiles', 'speed', 'match']);
/** Übungen, in denen die Bedeutung die Frage ist und die Antwort das Wort/die Wendung: der Hinweis darf es nicht enthalten. */
const WORD_ANSWER: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze', 'cloze_hint', 'wordfam', 'tiles', 'match', 'mc_de', 'type', 'speed']);
const MEANING_OPTIONS: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['mc_en', 'ctx_mc', 'listen_mc']);
const WORD_OPTIONS: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['mc_de', 'match', 'colloc_gap', 'colloc', 'contrast']);

const DE_ONLY = new Set(['nicht', 'und', 'eine', 'für', 'wird', 'sich', 'auch', 'oder', 'dem', 'von']);
const DE_STRONG = new Set([...DE_ONLY, 'der', 'ist', 'ein', 'ich', 'wir', 'mit', 'zu', 'auf', 'bei', 'sind', 'werden']);
const NAMES = /\b(?:iPhone|iPad|LinkedIn|PowerPoint|YouTube|McD\w*|MacB\w*|eBay|iOS|WhatsApp|DeepMind|PayPal|FedEx|JavaScript|OpenAI|SharePoint|HubSpot|iCloud)\b/g;

/** Mängel eines gezeigten Satzes (R7). Ergänzt `hasGapPlaceholder` (eingeklebter Bildschirmtext, Lückenzeichen). */
function sentenceDefects(s: string): string[] {
  const out: string[] = [];
  if (hasGapPlaceholder(s)) out.push('Lücken-/Bildschirmtext im Satz');
  const words = s.toLowerCase().split(/[^a-zäöüß]+/);
  const de = [...new Set(words.filter((w) => DE_STRONG.has(w)))];
  if (de.length >= 2 || de.some((w) => DE_ONLY.has(w))) out.push(`deutsche Wörter (${de.join(',')})`);
  if (/[+✓✔✕✗×▶►→←↑↓•·©®™]/.test(s)) out.push('Bedienzeichen');
  if (/[a-zäöü][.!?][A-ZÄÖÜ]/.test(s)) out.push('Sätze verklebt');
  if (/[a-zäöü][A-ZÄÖÜ][a-zäöü]/.test(s.replace(NAMES, ''))) out.push('Klein- direkt vor Großbuchstabe (verklebt)');
  if (/[[\]]|_{2}|\?\?|\(\?\)/.test(s)) out.push('Klammer/Platzhalter');
  if (s.length > 260) out.push(`sehr lang (${s.length})`);
  return out;
}

const gapOf = (e: Exercise): string | null => (e.sentence ? e.sentence.sentence.slice(e.sentence.start, e.sentence.end) : null);
const restOf = (e: Exercise): string => (e.sentence ? `${e.sentence.sentence.slice(0, e.sentence.start)} | ${e.sentence.sentence.slice(e.sentence.end)}` : '');

// Britische Formen zählen als richtig (A7.3): Vergleich in US-Schreibweise.
// Unregelmäßige Formen (overcome → overcame) haben denselben Wortanfang: vier gemeinsame Buchstaben genügen.
const matchesLemma = (g: string, lemmaTokens: readonly string[]): boolean =>
  lemmaTokens.some((l) => formsOf(l.toLowerCase()).some((f) => toUS(f.toLowerCase()) === toUS(bare(g))) || (bare(g).length >= 4 && l.length >= 4 && bare(g).slice(0, 4) === l.toLowerCase().slice(0, 4)));
const hasWords = (text: string, phrase: string): boolean => (` ${text.replace(/[^a-zäöüß0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `).includes(` ${phrase} `);
const meaningsShare = (a: string, b: string): boolean => {
  const pb = meaningParts(b);
  return meaningParts(a).some((x) => pb.includes(x));
};

/** Texte der Karte, in denen ein Ablenker mit seinem Nachbarwort belegt sein kann. */
function cardTexts(card: TrainCard): string[] {
  const d = card.doc;
  const xs = Array.isArray(d.xEx) ? (d.xEx as { en?: unknown }[]).map((x) => x.en) : [];
  const cs = Array.isArray(d.col) ? (d.col as { ex?: unknown }[]).map((x) => x.ex) : [];
  return [d.ex, ...xs, ...card.col.map((c) => c.p), ...cs].filter((x): x is string => typeof x === 'string').map((x) => norm(x.replace(/[[\]]/g, '')));
}

const ACT_EX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['act_scene', 'act_rewrite', 'act_impulse', 'act_combo', 'act_mail']);

/** R14: eine Aktivierungs-Aufgabe muss vollständig, lesbar und ohne Leck sein. */
function checkAct(e: Exercise, card: TrainCard, lang: Lang, add: (rule: GuardRule, why: string) => void): void {
  const a: ActTask | undefined = e.act;
  if (!a) {
    add('R14', 'Aufgabe der Aktivierung ohne Beschreibung');
    return;
  }
  if (!ACT_EX.has(e.ex) || EX_OF_FMT[a.fmt] !== e.ex) add('R14', `Format „${a.fmt}“ passt nicht zur Art „${e.ex}“`);
  const p = parseActCode(a.code);
  if (!p) add('R14', `Code der Vorgabe nicht lesbar („${a.code}“)`);
  else if (p.fmt !== a.fmt) add('R14', 'Code und Format widersprechen sich');
  if (a.targets[0]?.key !== card.key) add('R14', 'erstes Zielwort ist nicht die Karte der Aufgabe');
  const n = a.targets.length;
  if (n < 1 || n > ACT_MAX_TARGETS) add('R14', `${n} Zielwörter`);
  if (new Set(a.targets.map((t) => t.key)).size !== n || new Set(a.targets.map((t) => t.lemma.toLowerCase())).size !== n) add('R14', 'Zielwörter nicht verschieden');
  if (MULTI_TARGET.has(a.fmt) && n < 2) add('R14', 'Kombi-Aufgabe mit nur einem Zielwort');
  if (!MULTI_TARGET.has(a.fmt) && n !== 1) add('R14', 'Aufgabe mit einem Zielwort trägt mehrere');
  if (NEEDS_SOURCE.has(a.fmt) && (!a.source || a.source.text.trim().split(/\s+/).length < 4)) add('R14', 'Umformen ohne brauchbaren Ausgangssatz');
  if (!e.meaning) add('R14', 'keine Bedeutung zum Zielwort');
  if (e.sentence || e.options.length || e.accepted.length) add('R14', 'Aktivierung darf keine Lücke, Optionen oder Lösung tragen');
  if (!activationReady(card)) add('R14', 'Karte noch nicht an zwei Tagen richtig abgerufen (kein freier Satz beim ersten Lernen)');
  if (HIDES_TARGET.has(a.fmt)) {
    if (a.showTarget) add('R14', 'A4 zeigt das Zielwort');
    for (const t of a.targets) if (!actMeaning(t, a.fmt, lang)) add('R14', 'A4: Bedeutung verrät das Zielwort');
    const ev = eventById(a.event);
    if (ev && a.fmt === 'lg' && a.targets.some((t) => hasWords(`${ev.en} ${ev.de}`.toLowerCase(), t.lemma.toLowerCase()))) add('R14', 'A4: Lage verrät das Zielwort');
  }
}

/** Prüft eine gebaute Aufgabe gegen R1–R12 (und R13/R14). Rein; leer = darf gezeigt werden. */
export function checkExercise(e: Exercise, card: TrainCard, lang: Lang): Violation[] {
  const out: Violation[] = [];
  const add = (rule: GuardRule, why: string) => out.push({ rule, why });
  const lemma = lemmaFor(card);
  const core = coreWords(lemma);
  const gap = gapOf(e);
  const cue = gapCue(e, lang);
  const sol = e.accepted[0] ?? '';
  const isColloc = e.ex === 'colloc' || e.ex === 'colloc_gap';
  const ownGap = GAP_EX.has(e.ex) && e.sentence !== null && gap !== null;

  // ---- Lücke auf dem Kartenwort (R1, R2, R3, R4, R8)
  if (ownGap && e.sentence && gap !== null) {
    if (core.length && toks(gap).length > core.length) add('R1', `Lücke verdeckt ${toks(gap).length} Wörter, die Karte hat ${core.length} feste`);
    else if (!gapUsable(e.sentence, lemma)) add('R4', 'Kartenwort steht außerhalb der Lücke noch einmal im Satz');
    if ((/\d/.test(gap) && !/\d/.test(card.word)) || (toks(gap).some((g, i) => /^[A-ZÄÖÜ]/.test(g) && !(i === 0 && e.sentence!.start === 0)) && !/^[A-ZÄÖÜ]/.test(card.word))) add('R2', 'Lösung enthält Zahl oder Eigennamen');
    if (!cue && !e.firstLetter && e.ex !== 'dictation' && e.ex !== 'tiles' && !(e.ex === 'match' && e.meaning)) add('R2', 'Lücke ohne Hinweis');
    if (e.ex !== 'match' && !e.meaning && e.ex !== 'dictation') add('R2', 'keine Bedeutung als Hinweis');
    if (core.length && !toks(gap).some((g) => matchesLemma(g, core)) && !norm(card.word).split(' ').some((w) => toUS(bare(w)) === toUS(bare(gap)))) add('R3', `Lösung „${gap}“ enthält keine Form von „${lemma}“`);
    if (isFunctionGap(gap) && !isFunctionGap(lemma)) add('R8', 'Funktionswort als Lösung');
  }

  // ---- Lösung vorhanden (R2) und nicht im Hinweis (R4)
  const typed = e.input === 'typed' || e.input === 'tiles' || e.input === 'choice';
  if (typed && e.ex !== 'complete' && e.ex !== 'produce' && e.ex !== 'situation' && !sol.trim()) add('R2', 'keine Lösung');
  if (WORD_ANSWER.has(e.ex) && core.length) {
    const hay = [e.meaning ?? '', cue?.text ?? ''].join(' | ');
    const hit = core.length === 1 ? core[0]!.length >= 4 && toks(hay).some((w) => formsOf(core[0]!.toLowerCase()).includes(bare(w))) : core.join('').length >= 4 && locate(hay, core.join(' ')) !== null;
    if (hit) add('R4', 'Hinweis enthält das gesuchte Wort selbst');
  }

  // ---- Wortpartner-Lücke (R2, R3, R4, R8, R9)
  if (isColloc && e.colloc) {
    const c = e.colloc;
    if (sol && isFunctionGap(sol)) add('R8', 'Funktionswort als Partner-Lösung');
    if (gap !== null && norm(gap) !== norm(sol)) add('R3', `Lösung „${sol}“ weicht von der Satzlücke „${gap}“ ab`);
    if (!cue) add('R2', 'Partner-Lücke ohne Bedeutungs-Hinweis');
    if (cue && c.index >= 0 && lang === 'de' && card.de && meaningsShare(c.de, card.de)) add('R9', 'Hinweis ist die Bedeutung des Kartenworts, Lücke ist das Partnerwort');
    if (c.index >= 0 && c.p) {
      const others = toks(c.p).filter((w) => bare(w) !== bare(sol) && bare(w).length >= 4);
      const sent = norm(e.sentence?.sentence ?? '');
      if (others.length && others.every((w) => !sent.includes(bare(w).slice(0, Math.max(3, bare(w).length - 2))))) add('R9', 'Satz enthält die geübte Wendung nicht');
    }
    if (sol.length >= 3 && e.sentence && locate(restOf(e), sol)) add('R4', 'Lösung steht im Satz noch einmal sichtbar');
    if (cue && sol.length >= 3 && locate(cue.text, sol)) add('R4', 'Hinweis enthält die Lösung');
  } else if (isColloc) {
    add('R3', 'Wortpartner-Aufgabe ohne Wortpartner');
  }

  // ---- Sätze (R6, R7)
  if (e.sentence && e.ex !== 'find_trap') {
    if (e.ex !== 'contrast' && !(e.ex === 'fits' && e.fits?.truth === false) && !isColloc && !senseFits(e.sentence, card.doc.pos)) add('R6', 'Wortart des Satzes passt nicht zur Karte');
    const sd = sentenceDefects(e.sentence.sentence);
    if (sd.length) add('R7', sd.join('; '));
  }
  if (e.ex === 'find_trap' && e.sentence) {
    const sd = sentenceDefects(e.sentence.sentence);
    if (sd.length) add('R7', sd.join('; '));
  }
  if (e.ex === 'wordfam' && e.famFrom && e.famFrom.pos === (card.pos ?? '').slice(0, 4)) add('R6', 'Familienglied hat dieselbe Wortart wie die Lösung');

  // ---- Ablenker (R5) und Optionen (R4, R11, R12)
  if (e.options.length || e.input === 'choice') {
    const labels = e.options.map((o) => norm(o.label));
    const correct = e.options.filter((o) => o.correct);
    const minOpts = e.ex === 'contrast' || e.ex === 'fits' ? 2 : 3;
    if (e.input === 'choice' && e.options.length < minOpts) add('R12', `nur ${e.options.length} Optionen`);
    if (e.input === 'choice' && correct.length !== 1) add('R12', `${correct.length} richtige Optionen`);
    if (new Set(labels).size !== labels.length) {
      const okLabel = correct[0] ? norm(correct[0].label) : null;
      if (okLabel !== null && labels.filter((l) => l === okLabel).length > 1) add('R4', 'richtige Option doppelt');
      else add('R12', 'doppelte Optionen');
    }
    const okMeaning = correct[0]?.label ?? '';
    const texts = WORD_OPTIONS.has(e.ex) && e.sentence ? cardTexts(card) : [];
    const sw = e.sentence ? toks(e.sentence.sentence.slice(e.sentence.end)).map(bare) : [];
    const pw = e.sentence ? toks(e.sentence.sentence.slice(0, e.sentence.start)).map(bare) : [];
    const own = meaningForTask(card, lang) ?? '';
    for (const o of e.options) {
      if (o.correct) continue;
      const ol = norm(o.label);
      if (WORD_OPTIONS.has(e.ex)) {
        if (e.accepted.some((a) => norm(a) === ol)) add('R5', `Ablenker „${o.label}“ ist die Lösung`);
        else if (sol && formsOf(sol.toLowerCase()).includes(ol)) add('R5', `Ablenker „${o.label}“ ist eine Form der Lösung`);
        if (e.sentence && ol.length >= 4 && e.ex !== 'contrast' && locate(restOf(e), o.label)) add('R5', `Ablenker „${o.label}“ steht schon im Satz`);
        const bi1 = sw[0] ? `${ol} ${sw[0]}` : '';
        const bi0 = pw.length ? `${pw[pw.length - 1]} ${ol}` : '';
        if ((bi1 && texts.some((t) => hasWords(t, bi1))) || (bi0 && texts.some((t) => hasWords(t, bi0)))) add('R5', `Ablenker „${o.label}“ ist mit dem Nachbarwort ebenfalls belegt`);
        if (e.ex !== 'contrast' && e.ex !== 'colloc' && e.ex !== 'colloc_gap' && o.fromMeaning && own && meaningsShare(o.fromMeaning, own)) add('R5', `Ablenker „${o.label}“ bedeutet dasselbe wie die Lösung`);
      } else if (MEANING_OPTIONS.has(e.ex)) {
        if (meaningParts(o.label).some((p) => meaningParts(okMeaning).includes(p))) add('R5', `Ablenker „${o.label}“ bedeutet dasselbe wie die Lösung`);
      }
    }
    if (MEANING_OPTIONS.has(e.ex)) {
      const tongue = tongueOf(card, lang);
      if (e.options.some((o) => o.lang !== tongue)) add('R11', 'Optionen in gemischten Sprachen');
    }
  }

  // ---- Sprachtreue des Hinweises (R11)
  if (lang === 'en' && card.def && e.meaning && /[äöüß]/i.test(e.meaning) && !/[äöüß]/i.test(card.def)) add('R11', 'englische Oberfläche zeigt deutsche Bedeutung, obwohl eine englische Definition da ist');

  // ---- Eigener Satz (R13): ohne Lücke und Lösung; die Vorgaben müssen stimmen, und frisch gelernte Wörter bekommen ihn nie
  if (e.ex === 'produce') {
    const b = e.brief;
    if (!b) add('R13', 'Vorgaben (Lage, Form, Ton, Zeit) fehlen');
    else {
      if (!sceneById(b.scene)) add('R13', `unbekannte Lage „${b.scene}“`);
      if (!parseBrief(b.code)) add('R13', `Code der Vorgabe nicht lesbar („${b.code}“)`);
      if (b.form === 'i' && b.tense !== '-') add('R13', 'Wenn-Satz und Zeitform widersprechen sich');
      if (b.tense === 'co' && !allowsContinuous(card)) add('R13', 'Verlaufsform bei Zustandsverb oder Adjektiv');
    }
    if (!e.meaning) add('R13', 'keine Bedeutung zum Zielwort');
    if (e.sentence || e.options.length || e.accepted.length) add('R13', 'eigener Satz darf keine Lücke, Optionen oder Lösung tragen');
    if (!activationReady(card)) add('R13', 'Karte noch nicht an zwei Tagen richtig abgerufen (kein freier Satz beim ersten Lernen)');
  }

  // ---- Aktivierungs-Aufgaben A2–A5 (R14)
  if (e.act || ACT_EX.has(e.ex)) checkAct(e, card, lang, add);

  // ---- Aufdeck-Karte (R10)
  if (e.ex === 'flip') {
    if (!e.meaning) add('R10', 'Vorderseite ohne Bedeutung');
    if (e.meaning && core.length === 1 && core[0]!.length >= 4 && toks(e.meaning).some((w) => formsOf(core[0]!.toLowerCase()).includes(bare(w))) && lang === 'en') add('R10', 'Vorderseite verrät das Wort');
    if (!sol.trim()) add('R10', 'Rückseite ohne Wort');
    if (e.sentence) {
      const sd = sentenceDefects(e.sentence.sentence);
      if (sd.length) add('R7', sd.join('; '));
    }
  }
  return out;
}

// ------------------------------------------------------------------ Bericht (Diagnose), begrenzt

const MAX_LOGGED = 120;
const logged = new Set<string>();
const stats = { checked: 0, blocked: 0, fallbacks: 0, byRule: {} as Partial<Record<GuardRule, number>> };

/** Zähler des Wächters seit dem Laden der Seite (für die Diagnose). */
export function guardStats(): Readonly<typeof stats> {
  return stats;
}
/** Nur für Tests. */
export function resetGuardLog(): void {
  logged.clear();
  stats.checked = 0;
  stats.blocked = 0;
  stats.fallbacks = 0;
  stats.byRule = {};
}

/** Prüft, zählt und meldet Verstöße (je Karte × Aufgabe × Regel einmal je Seitenaufruf, höchstens MAX_LOGGED Meldungen; nur Karten-ID, kein Inhalt außer Regeltext). */
export function reportViolations(e: Exercise, card: TrainCard, lang: Lang): Violation[] {
  const v = checkExercise(e, card, lang);
  stats.checked++;
  if (!v.length) return v;
  stats.blocked++;
  for (const x of v) {
    stats.byRule[x.rule] = (stats.byRule[x.rule] ?? 0) + 1;
    const k = `${card.key}|${e.ex}|${x.rule}`;
    if (logged.has(k) || logged.size >= MAX_LOGGED) continue;
    logged.add(k);
    logWarn('guard', { code: x.rule, message: `Aufgabe ${e.ex} nicht gezeigt: ${x.why}` }, `card=${card.id}`);
  }
  return v;
}

// ------------------------------------------------------------------ Rückfall

/** Höchstens so viele Aufgaben werden je Karte gebaut und geprüft, bevor `type` folgt. */
export const MAX_TRIES = 6;

/** Reihenfolge der Ersatz-Aufgaben: erst Arten der Karte für ihre Stufe (gleiche Eingabeart zuerst), dann der Rest des Katalogs. Ohne `type`. */
export function fallbackChain(card: TrainCard, ex: ExerciseId, lang: Lang, poolSize: number, env: ExerciseEnv = NO_ENV): ExerciseId[] {
  const input = exerciseDef(ex).input;
  const stage = Math.max(1, card.stage);
  const ok = (x: ExerciseId): boolean => x !== ex && x !== 'type' && !retiredFor(card, x) && supports(card, x, lang, poolSize, env);
  const first = availableExercises({ ...card, stage: card.stage }, lang, poolSize, env).filter(ok);
  const rest = CATALOG.filter((d) => ok(d.ex) && !first.includes(d.ex))
    .sort((a, b) => Math.abs(a.stage - stage) - Math.abs(b.stage - stage))
    .map((d) => d.ex);
  const all = [...first, ...rest];
  return [...all.filter((x) => exerciseDef(x).input === input), ...all.filter((x) => exerciseDef(x).input !== input)];
}

type BuildOpts = { sceneOf?: SceneLookup; origin?: boolean; act?: ActTask };

/**
 * Baut `ex`; fällt die Aufgabe beim Wächter durch, kommt die nächste Aufgabenart (Reihenfolge `fallbackChain`), zuletzt `type`
 * (Bedeutung → Wort tippen, braucht keinen Satz). Gleicher Startwert, gleiches Ergebnis. Aufdeck-Karten (`flip`) werden gemeldet,
 * aber nie ersetzt (der Nutzer hat den Aufdeck-Modus gewählt); die letzte Ersatz-Aufgabe `type` wird nicht mehr abgewiesen.
 */
export function guardedExercise(card: TrainCard, ex: ExerciseId, lang: Lang, pool: readonly TrainCard[], seed: string, opts: BuildOpts = {}, env: ExerciseEnv = NO_ENV): Exercise {
  const first = buildExercise(card, ex, lang, pool, seed, opts);
  if (ex === 'flip') {
    reportViolations(first, card, lang);
    return first;
  }
  if (!reportViolations(first, card, lang).length) return first;
  const chain = fallbackChain(card, ex, lang, pool.length - 1, env).slice(0, MAX_TRIES - 2);
  for (const next of chain) {
    const e = buildExercise(card, next, lang, pool, seed, opts);
    if (!reportViolations(e, card, lang).length) {
      stats.fallbacks++;
      return e;
    }
  }
  stats.fallbacks++;
  return buildExercise(card, 'type', lang, pool, seed, opts);
}
