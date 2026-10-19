import { typedForm } from '../chunks/situation';
import { counts } from './cards';
import { stageOf } from './ladder';
import { isFunctionGap } from './partner';

import { isFutureFsrs, isNewState, readFsrs } from './scheduler';
import type { ChunkInfo, ContextSpan, Lang, TrainCard } from './types';

// Wendungen (`chunk/<id>`, altapp-analyse §5) als Trainerkarten (phase1-plan §4.1, phase3-plan
// Z. 25): dieselbe FSRS-Planung wie Vokabeln. Die Planungsfelder der alten App (S, D, due, last,
// state, reps, lapses, stage) werden gelesen; `fsrs` kommt beim ersten Schreiben zusätzlich dazu.
//
// Ursprungssatz: die aufgewertete Fassung (`src.upgraded`), wenn sie die Wendung enthält – die
// Lücke ist genau die Stelle der Wendung im Satz. Sonst gibt es keinen Kontext (Satzübungen
// entfallen, die eigene Äußerung steht nur als Zusatzzeile auf dem Wortblatt).

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

/** Platzhalter in Wendungen („meet sb halfway“): stehen im Satz für 1–4 Wörter. */
const PLACEHOLDERS = new Set(['sb', 'sth', 'someone', 'something', 'somebody', "one's", "someone's"]);
const WILDCARD_MAX = 4;

type Tok = { w: string; start: number; end: number };

const normWord = (w: string) => w.toLowerCase().replace(/[’‘`´]/g, "'").replace(/^'+|'+$/g, '');

function words(s: string): Tok[] {
  const out: Tok[] = [];
  for (const m of s.matchAll(/[A-Za-z0-9’'‘`´-]+/g)) {
    const w = normWord(m[0]);
    if (w) out.push({ w, start: m.index, end: m.index + m[0].length });
  }
  return out;
}

/** Leichte Beugung am ersten und letzten Wort („meets a deadline“, „pushed back“). */
function sameWord(text: string, want: string, flex: boolean): boolean {
  if (text === want) return true;
  if (!flex || want.length < 3) return false;
  const base = want.replace(/e$/, '');
  return [want + 's', want + 'es', want + 'ed', want + 'd', base + 'ing', base + 'ed', want + want.slice(-1) + 'ed', want + want.slice(-1) + 'ing'].includes(text) || (want.endsWith('y') && [want.slice(0, -1) + 'ies', want.slice(0, -1) + 'ied'].includes(text));
}

/** Ein festes Wort der Wendung im Satz (ohne Platzhalter): Wortlaut im Satz und Stelle. */
export type ChunkWordSpan = { w: string; start: number; end: number };

/**
 * Stelle der Wendung im Satz (Zeichen-Offsets) mit der Stelle jedes festen Worts, ohne Groß/klein, Satzzeichen und „…“.
 * Platzhalter passen auf 1–4 Wörter; erstes und letztes Wort dürfen gebeugt sein.
 */
export function locateChunkWords(sentence: string, phrase: string): { start: number; end: number; words: ChunkWordSpan[] } | null {
  const t = words(sentence);
  const p = words(typedForm(phrase)).map((x) => x.w);
  if (!p.length || p.every((w) => PLACEHOLDERS.has(w))) return null;
  const last = p.length - 1;
  const match = (i: number, k: number, acc: number[]): { end: number; acc: number[] } | null => {
    if (k === p.length) return { end: i, acc };
    const w = p[k] as string;
    if (PLACEHOLDERS.has(w) && k > 0 && k < last) {
      for (let n = 1; n <= WILDCARD_MAX && i + n <= t.length; n++) {
        const r = match(i + n, k + 1, acc);
        if (r !== null) return r;
      }
      return null;
    }
    const tok = t[i];
    if (!tok || !sameWord(tok.w, w, k === 0 || k === last)) return null;
    return match(i + 1, k + 1, [...acc, i]);
  };
  for (let i = 0; i < t.length; i++) {
    const r = match(i, 0, []);
    if (r !== null) {
      const a = t[i] as Tok;
      const b = t[r.end - 1] as Tok;
      return { start: a.start, end: b.end, words: r.acc.map((j) => ({ w: sentence.slice((t[j] as Tok).start, (t[j] as Tok).end), start: (t[j] as Tok).start, end: (t[j] as Tok).end })) };
    }
  }
  return null;
}

/** Stelle der Wendung im Satz (Zeichen-Offsets). */
export function locateChunk(sentence: string, phrase: string): { start: number; end: number } | null {
  const hit = locateChunkWords(sentence, phrase);
  return hit ? { start: hit.start, end: hit.end } : null;
}

// ------------------------------------------------------------------ Kern und Rahmen (WL, 19.10.2026)

/** Präpositionen und Partikeln: Sie gehören zum Rahmen der Wendung („meet ___ halfway“, „push back“). */
const FRAME_WORDS = new Set([
  'in', 'on', 'at', 'for', 'with', 'by', 'from', 'about', 'into', 'over', 'up', 'out', 'off', 'down', 'back', 'away', 'through', 'across', 'against', 'along', 'around',
  'between', 'of', 'onto', 'upon', 'under', 'within', 'without', 'after', 'before', 'behind', 'beyond', 'toward', 'towards', 'to',
]);

/** Partikeln, die hinter dem Verb zum Kern gehören (nicht die Präpositionen in/on/at/for …). */
const VERB_PARTICLES = new Set(['back', 'up', 'out', 'off', 'down', 'away', 'over', 'through']);

export type ChunkPart = { text: string; kind: 'core' | 'frame' | 'slot' | 'fixed' };
/** Angaben aus dem Paket, die die Zerlegung steuern: Kategorie (`phrasal`, `frame`, …) und das Wort der Partnerwort-Lücke (`gap.at`). */
export type ChunkHints = { cat?: string | undefined; at?: string | undefined };

/**
 * Die Wendung in Teile: Kern (Inhaltswörter), Rahmen (feste kleine Wörter: Präposition, Partikel, Artikel, Hilfsverb) und Platzhalter („sb“, „sth“). Rein, nur Anzeige.
 * - `frame` (feste Formeln wie „that said“, „I see where you are coming from“): nicht zerlegt, alle Teile `fixed`.
 * - `phrasal`: Verb und Partikel sind Kern, nur eine abhängige Präposition am Ende („push back ON“) ist Rahmen.
 * - Besteht die Wendung nur aus Rahmenwörtern („in return for“), ist das längste Wort der Kern.
 */
export function chunkParts(phrase: string, hints: ChunkHints = {}): ChunkPart[] {
  const toks = typedForm(phrase).split(/\s+/).filter(Boolean);
  if (hints.cat === 'frame') return toks.map((text) => ({ text, kind: PLACEHOLDERS.has(normWord(text)) ? 'slot' : 'fixed' }));
  const parts: ChunkPart[] = toks.map((text, i) => {
    const w = normWord(text);
    if (PLACEHOLDERS.has(w)) return { text, kind: 'slot' };
    if (hints.cat === 'phrasal') return { text, kind: (i === toks.length - 1 && i >= 2 && FRAME_WORDS.has(w)) || isFunctionGap(w) ? 'frame' : 'core' };
    return { text, kind: FRAME_WORDS.has(w) || isFunctionGap(w) ? 'frame' : 'core' };
  });
  // Ohne Kategorie „phrasal“: Eine Partikel gleich hinter dem Verb (push BACK the go-live, hand OVER the keys) gehört zum Kern, nie zum Rahmen.
  if (hints.cat !== 'phrasal') {
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i] as ChunkPart;
      if (part.kind === 'frame' && VERB_PARTICLES.has(normWord(part.text)) && parts[i - 1]?.kind === 'core' && i < parts.length - 1) part.kind = 'core';
    }
  }
  if (parts.length && !parts.some((x) => x.kind === 'core')) {
    const longest = parts.reduce<number>((best, x, i) => (x.kind === 'frame' && x.text.length > (parts[best]?.text.length ?? 0) ? i : best), 0);
    const hit = parts[longest];
    if (hit && hit.kind === 'frame') hit.kind = 'core';
  }
  return parts;
}

/**
 * Wörter der Wendung im Satz, die als einzelne Lücke taugen (nie Artikel, Hilfsverben, Platzhalter), in der Reihenfolge, in der sie gefragt werden:
 * zuerst das Wort der Partnerwort-Lücke aus dem Paket (`gap.at`), dann bei `phrasal` die abhängige Präposition, sonst Kernwörter, zuletzt Präpositionen/Partikeln.
 * Bei `frame` nur Schlüsselwörter vor den kleinen Wörtern. `[]`, wenn die Wendung im Satz nicht steht.
 */
export function chunkGapWords(sentence: string, phrase: string, hints: ChunkHints = {}): ChunkWordSpan[] {
  const hit = locateChunkWords(sentence, phrase);
  if (!hit) return [];
  const usable = hit.words.filter((x) => {
    const w = normWord(x.w);
    return w.length >= 2 && w !== 'to' && !PLACEHOLDERS.has(w) && !isFunctionGap(w);
  });
  const small = (x: ChunkWordSpan): boolean => FRAME_WORDS.has(normWord(x.w));
  let ordered = [...usable.filter((x) => !small(x)), ...usable.filter(small)];
  if (hints.cat === 'phrasal') {
    const last = usable.at(-1);
    const dependent = last && small(last) && typedForm(phrase).split(/\s+/).length >= 2 ? last : undefined;
    if (dependent) ordered = [dependent, ...usable.filter((x) => x !== dependent)];
  }
  // Feste Formeln: „let“ (Let me …, Let us …) ist nie die erste Lücke.
  if (hints.cat === 'frame') ordered = [...ordered.filter((x) => normWord(x.w) !== 'let'), ...ordered.filter((x) => normWord(x.w) === 'let')];
  const at = hints.at ? normWord(hints.at) : '';
  if (at) {
    const first = ordered.find((x) => normWord(x.w) === at) ?? ordered.find((x) => at.length >= 4 && normWord(x.w).startsWith(at.slice(0, 4)));
    if (first) ordered = [first, ...ordered.filter((x) => x !== first)];
  }
  return ordered;
}

export function chunkContext(sentence: string | null, en: string): ContextSpan | null {
  if (!sentence) return null;
  // Klammern der alten App gehören nie in den angezeigten Satz.
  sentence = sentence.replace(/[[\]]/g, '');
  const hit = locateChunk(sentence, en);
  if (!hit) return null;
  return { sentence, start: hit.start, end: hit.end, gap: sentence.slice(hit.start, hit.end) };
}

function chunkInfo(doc: Doc): ChunkInfo {
  const src = obj(doc.src);
  const whyLang = doc.whyLang === 'en' ? 'en' : doc.whyLang === 'de' ? 'de' : null;
  const scene = str(src.scene);
  const kind = str(src.kind) ?? (scene ? 'scene' : typeof doc.src === 'string' ? String(doc.src) : 'chunk');
  return {
    register: str(doc.register),
    why: str(doc.why),
    whyLang: whyLang ?? (str(doc.why) ? 'de' : null),
    utterance: str(src.utterance),
    upgraded: str(src.upgraded),
    scene,
    sceneTitle: str(src.sceneTitle),
    srcKind: kind,
    title: str(src.sceneTitle) ?? str(src.title),
  };
}

/** Anlegedatum als Lerntag-Text (für die Reihenfolge neuer Karten). */
function createdKey(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return new Date(v).toISOString().slice(0, 10);
  return '';
}

export function toChunkCard(id: string, doc: Doc, nowMs: number): TrainCard | null {
  const en = str(doc.en);
  if (!en || isFutureFsrs(doc)) return null;
  const fsrs = readFsrs(doc, nowMs);
  const hist = Array.isArray(doc.hist) ? doc.hist : [];
  const last = hist[hist.length - 1] as Record<string, unknown> | undefined;
  const info = chunkInfo(doc);
  return {
    kind: 'chunk',
    key: `chunk/${id}`,
    id,
    path: `chunk/${id}`,
    inDb: true,
    word: en,
    lemma: typedForm(en),
    pos: null,
    de: str(doc.de),
    def: str(doc.def),
    context: chunkContext(info.upgraded, en),
    col: [],
    src: info.srcKind,
    fsrs,
    stage: stageOf(doc),
    isNew: isNewState(fsrs),
    hidden: doc.hidden === true,
    xs: counts(doc.xs),
    modes: counts(doc.modes),
    lastMode: last && typeof last.m === 'string' ? last.m : null,
    lastEx: last && typeof last.x === 'string' ? last.x : null,
    chunk: info,
    intro: str(doc.intro),
    order: num(doc.order, 900),
    added: createdKey(doc.created),
    doc,
  };
}

/** Alle Wendungen (auch ausgeblendete – die Runde filtert). Ungültige Dokumente sind ausgeschlossen. */
export function buildChunkCards(dbChunks: ReadonlyMap<string, Doc>, nowMs: number, invalidIds?: ReadonlySet<string>): TrainCard[] {
  const out: TrainCard[] = [];
  for (const [id, doc] of dbChunks) {
    if (invalidIds?.has(id)) continue;
    const card = toChunkCard(id, doc, nowMs);
    if (card) out.push(card);
  }
  return out;
}

/** Englische Erklärung der Wendung nur zeigen, wenn sie in der Oberflächensprache vorliegt (Kap. 10). */
export function chunkWhy(card: Pick<TrainCard, 'chunk'>, lang: Lang): string | null {
  const c = card.chunk;
  if (!c?.why) return null;
  return c.whyLang === lang ? c.why : null;
}
