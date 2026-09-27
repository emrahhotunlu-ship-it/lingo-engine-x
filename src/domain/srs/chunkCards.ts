import { typedForm } from '../chunks/situation';
import { counts } from './cards';
import { stageOf } from './ladder';

/**
 * Wendungen überspringen die Auswahlstufen (Lernberatung 27.09., „weglassen"): Erkennen und
 * Zuordnen (1–2) sind für neue Business-Wendungen fast verschenkte Zeit – abgefragt wird ab
 * „Mit Stütze abrufen" (3). Die gespeicherte Stufe bleibt unverändert (Kap. 9); nach einem
 * Treffer auf Stufe 3 steigt sie regulär (nextStage).
 */
export const chunkStage = (s: Stage): Stage => (s === 1 || s === 2 ? 3 : s);
import { isFutureFsrs, isNewState, readFsrs } from './scheduler';
import type { ChunkInfo, ContextSpan, Lang, Stage, TrainCard } from './types';

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

/**
 * Stelle der Wendung im Satz (Zeichen-Offsets), ohne Groß/klein, Satzzeichen und „…“.
 * Platzhalter passen auf 1–4 Wörter; erstes und letztes Wort dürfen gebeugt sein.
 */
export function locateChunk(sentence: string, phrase: string): { start: number; end: number } | null {
  const t = words(sentence);
  const p = words(typedForm(phrase)).map((x) => x.w);
  if (!p.length || p.every((w) => PLACEHOLDERS.has(w))) return null;
  const last = p.length - 1;
  const match = (i: number, k: number): number | null => {
    if (k === p.length) return i;
    const w = p[k] as string;
    if (PLACEHOLDERS.has(w) && k > 0 && k < last) {
      for (let n = 1; n <= WILDCARD_MAX && i + n <= t.length; n++) {
        const r = match(i + n, k + 1);
        if (r !== null) return r;
      }
      return null;
    }
    const tok = t[i];
    if (!tok || !sameWord(tok.w, w, k === 0 || k === last)) return null;
    return match(i + 1, k + 1);
  };
  for (let i = 0; i < t.length; i++) {
    const endIdx = match(i, 0);
    if (endIdx !== null) {
      const a = t[i] as Tok;
      const b = t[endIdx - 1] as Tok;
      return { start: a.start, end: b.end };
    }
  }
  return null;
}

export function chunkContext(sentence: string | null, en: string): ContextSpan | null {
  if (!sentence) return null;
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
    stage: chunkStage(stageOf(doc)),
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
