import { chunkContext } from './chunkCards';
import { findContext, senseFits } from './context';
import { gapUsable, lemmaFor } from './gapFit';
import { crossSentences } from './crossLink';
import { storedExamples } from './examples';
import { readWx } from '../tutor/acceptWordCtx';
import type { ContextSpan, ExerciseId, TrainCard } from './types';
import { hash32 } from '../random';
import { isFirstDay, leastRecent, sentKey, shownSentences } from './variety';
import { gapSentenceCandidates } from './gapSentence';

// Kontext-Wechsel (Emrah 02.10.2026, Prüfung Lernwissenschaft L2 und Englischlehrer „Transfer“): Wer ein Wort immer im selben Satz abfragt, lernt den Satz,
// nicht das Wort. Seit WL (19.10.2026, Befund: 97 % der Auswahlfragen und 61 von 102 Karten immer im selben Satz) wechselt der Satz ab der ersten Wiederholung
// an einem anderen Tag, bei JEDER Satzübung (auch Erkennen, Zuordnen, Hören, Aufdecken). Tag 1 bleibt der Ursprungssatz der Anker. Der Satz der letzten Antwort
// kommt nie noch einmal, solange es einen anderen gibt. Nur eine andere Ansicht: nichts wird geschrieben.
// V1: Aus dem Verlauf (`hist[].s`) wird der am längsten nicht gezeigte Satz gewählt, derselbe Stand zeigt denselben Satz (kein Zufall).
// Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (der Aufrufer reicht `origin` durch).

export const ROTATE_FROM_STAGE = 1;
/** Satzübungen, die den Satz wechseln dürfen. Ohne Satz (Wortbedeutung, Wortpartner, eigener Satz) gibt es nichts zu wechseln. */
export const ROTATING: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['mc_en', 'ctx_mc', 'listen_mc', 'match', 'flip', 'cloze_hint', 'cloze', 'cloze_part', 'tiles', 'speed', 'dictation', 'wordfam']);

/** Satzübungen mit Lücke: Der Satz muss die Lücke fair verdecken (`gapFit.ts`). */
export const GAP_EX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze_hint', 'cloze', 'cloze_part', 'tiles', 'speed', 'dictation', 'wordfam']);

/** Der Satz bricht ab oder beginnt mittendrin („… and then we left“, „We use it to …“): aus einem Lesetext geschnitten. */
export const isTruncated = (sentence: string): boolean => /^\s*(…|\.\.\.)/.test(sentence) || /(…|\.\.\.)\s*$/.test(sentence);

/** Der Ursprungssatz ist als Lücke brauchbar (sonst wechselt er nicht mit, `gapFit.ts`). */
const originUsable = (card: Pick<TrainCard, 'context' | 'word' | 'kind'>, needGap = true): boolean => !!card.context && !isTruncated(card.context.sentence) && (!needGap || gapUsable(card.context, lemmaFor({ word: card.word, kind: card.kind, lemma: '' })));

/** Stelle des Worts (bzw. der Wendung) in einem Satz, sonst `null`. */
function locateIn(card: Pick<TrainCard, 'word' | 'kind' | 'doc'>, sentence: string, needGap: boolean): ContextSpan | null {
  // Wendungen (Lernplattform 2.0 §4.8): die Stelle der Wendung über `locateChunk`, Vokabeln über das Wort (auch gebeugt).
  const hit = card.kind === 'chunk' ? chunkContext(sentence, card.word) : findContext(sentence, card.word);
  // Audit 12.10.2026: Nur Sätze, in denen das Wort in der Bedeutung der Karte steht (Nomen-Karte „decline“ nicht im Satz „started to decline“)
  // und deren Lücke genau das Wort verdeckt (kein zweites Vorkommen, kein beliebiges Objekt) wechseln mit dem Ursprungssatz ab.
  if (!hit) return null;
  if (card.kind !== 'chunk' && !senseFits(hit, card.doc.pos)) return null;
  // Für Arten ohne Lücke (Bedeutung wählen, Hören, Aufdecken …) genügt der passende Wortsinn; eine Lücke muss genau das Wort verdecken.
  return !needGap || gapUsable(hit, lemmaFor({ word: card.word, kind: card.kind, lemma: '' })) ? hit : null;
}

/**
 * Ursprungssatz zuerst, danach jeder gespeicherte Satz, in dem das Wort (auch gebeugt) vorkommt. Quellen (V1, „Mehrfachkombination“):
 * `xEx` (Claude, einmal gespeichert), die Beispielsätze der Wortpartner (`col[].ex`) und feste, geprüfte Sätze aus c1x-Aufgaben
 * (mcc/ocl/err/kwt), dem Satzbau-Pool und dem C1-Paket, in denen dieselbe Lexik vorkommt (`crossLink.ts`).
 */
export function contextsOf(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>, needGap = true): ContextSpan[] {
  const out: ContextSpan[] = originUsable(card, needGap) ? [card.context as ContextSpan] : [];
  const have = new Set(out.map((c) => c.sentence.toLowerCase()));
  const push = (sentence: string): void => {
    const c = locateIn(card, sentence, needGap);
    if (!c || have.has(c.sentence.toLowerCase())) return;
    have.add(c.sentence.toLowerCase());
    out.push(c);
  };
  for (const x of storedExamples(card.doc)) push(x.en);
  for (const x of readWx(card.doc)) push(x.en);
  // Sätze der Wortpartner: die Klammern markieren dort die Wendung, nicht das Wort, deshalb werden sie entfernt.
  if (Array.isArray(card.doc.col)) for (const c of card.doc.col) if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).ex === 'string') push((c as { ex: string }).ex.replace(/\[|\]/g, ''));
  for (const sentence of crossSentences(card)) push(sentence);
  return out;
}

/**
 * Satz für diese Übung. Tag 1 (noch keine Antwort an einem früheren Tag): der Ursprungssatz als Anker. Danach der am längsten nicht gezeigte Satz (V1);
 * der zuletzt gezeigte kommt nie, solange es einen anderen gibt. Gleichstand unter nie gezeigten Sätzen entscheidet ein fester Wert aus Karte und
 * Verlaufslänge (kein Zufall, aber auch nicht immer der erste). Ältere Einträge ohne `s` gelten als Ursprungssatz (`shownSentences`).
 * Ein abgeschnittener Ursprungssatz (mit „…“) wechselt mit, sobald es einen anderen Satz gibt. `day`: der Lerntag (aus dem Seed der Übung).
 */
export function rotatedContext(card: TrainCard, ex: ExerciseId, day?: string): ContextSpan | null {
  // Lückenaufgaben: nur EIN vollständiger, kurzer Satz (`gapSentence.ts`), auch vor der ersten Wiederholung.
  if (GAP_EX.has(ex)) return gapContext(card, day);
  if (card.stage < ROTATE_FROM_STAGE || !ROTATING.has(ex)) return card.context;
  const origin = card.context;
  const showable = originUsable(card, false);
  const all = contextsOf(card, false);
  // Tag 1: der Ursprungssatz ist der Anker.
  if (showable && isFirstDay(card.doc, day)) return origin;
  if (all.length < (showable ? 2 : 1)) return origin;
  // (Ist der Ursprungssatz abgeschnitten oder als Lücke unbrauchbar, steht er nicht in `all`; dann genügt ein einziger anderer Satz.)
  const used = shownSentences(card.doc, origin ? sentKey(origin.sentence) : null);
  // P52 (KI-Tutor T3): Ein neuer Claude-Satz des Wörter-Tutors (`wx`) für dieses schwache Wort kommt zuerst dran, solange er noch nie gezeigt wurde.
  const wxKeys = new Set(readWx(card.doc).map((x) => sentKey(x.en)));
  const freshWx = all.filter((c) => wxKeys.has(sentKey(c.sentence)) && !used.includes(sentKey(c.sentence)));
  return leastRecent(freshWx.length ? freshWx : all, (c) => sentKey(c.sentence), used, hash32(`${card.key}|${used.length}`)) ?? origin;
}

// ------------------------------------------------------------------ Satz einer Lückenaufgabe (Emrahs Meldung 25.10.2026)

const GAP_CACHE = new WeakMap<object, ContextSpan[]>();

/**
 * Sätze, die eine Lückenaufgabe zeigen darf: je Satz der Karte nur der eine Satz, in dem das Wort steht (`gapSentence`), vollständig (kein „…“)
 * und höchstens GAP_SENTENCE_MAX_WORDS Wörter lang, mit fairer Lücke (`gapUsable`). Der Ursprungssatz zuerst (auch wenn er aus einem längeren,
 * abgeschnittenen Auszug stammt: dann sein Satz der Lücke), danach die anderen Sätze der Karte (`contextsOf`). Rein; je Karten-Objekt gemerkt.
 */
export function gapContextsOf(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan[] {
  // Gemerkt je Karten-Objekt (die Karten einer Runde sind eingefroren; `supports` fragt oft).
  const hit = GAP_CACHE.get(card);
  if (hit) return hit;
  const lemma = lemmaFor({ word: card.word, kind: card.kind, lemma: '' });
  const out: ContextSpan[] = [];
  const have = new Set<string>();
  // Je Satz der erste brauchbare Kandidat: ganzer kurzer Mini-Kontext, sonst der Satz der Lücke allein (z. B. wenn das Wort im Nachbarsatz noch einmal steht).
  const push = (c: ContextSpan | null): void => {
    const g = gapSentenceCandidates(c).find((x) => gapUsable(x, lemma));
    if (!g || have.has(g.sentence.toLowerCase())) return;
    have.add(g.sentence.toLowerCase());
    out.push(g);
  };
  push(card.context);
  for (const c of contextsOf(card, false)) push(c);
  GAP_CACHE.set(card, out);
  return out;
}

/** Der Ursprungssatz (bzw. sein Satz der Lücke) taugt als Lücke? Dann ist er der Anker an Tag 0/1. */
export function originGap(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan | null {
  if (!card.context) return null;
  const first = gapContextsOf(card)[0];
  return first && gapSentenceCandidates(card.context).some((g) => g.sentence === first.sentence) ? first : null;
}

/**
 * Satz einer Lückenaufgabe: an Tag 0/1 (und mit `anchor`, z. B. Abruf 1 und Prüfabfrage) der Ursprungssatz, wenn er vollständig und kurz genug ist;
 * sonst wie `rotatedContext` der am längsten nicht gezeigte saubere Satz (deterministisch). `null`, wenn die Karte keinen sauberen Satz hat – dann
 * bietet `supports` keine Lückenaufgabe an (`modes.ts`), und es kommt z. B. Deutsch → Englisch tippen.
 */
export function gapContext(card: TrainCard, day?: string, anchor = false): ContextSpan | null {
  const all = gapContextsOf(card);
  if (!all.length) return null;
  const origin = originGap(card);
  if (origin && (anchor || card.stage < ROTATE_FROM_STAGE || isFirstDay(card.doc, day))) return origin;
  if (all.length === 1) return all[0] ?? null;
  const originKey = origin ? sentKey(origin.sentence) : card.context ? sentKey(card.context.sentence) : null;
  const used = shownSentences(card.doc, originKey);
  const wxKeys = new Set(readWx(card.doc).map((x) => sentKey(x.en)));
  const freshWx = all.filter((c) => wxKeys.has(sentKey(c.sentence)) && !used.includes(sentKey(c.sentence)));
  return leastRecent(freshWx.length ? freshWx : all, (c) => sentKey(c.sentence), used, hash32(`${card.key}|${used.length}`)) ?? all[0] ?? null;
}
