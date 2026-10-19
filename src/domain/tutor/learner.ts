import { addDays, dayKey } from '../date';
import { entriesOf, type ActEntry } from '../activation/actDoc';
import { certainty, topicP } from '../grammar/bkt';
import { patternById, patternOf, patternsOf, topicsWithPatterns } from '../grammar/patterns';
import { patInfos } from '../grammar/slotInput';
import { currentChapter } from '../grammar/slotPlan';
import { cardStatusFrom, type CardEvidence } from '../metrics/cardStatus';
import { patsOf, patternState, type PatEntry, type PatternState } from '../metrics/pattern';
import { DONT_KNOW } from '../progress/logPatch';
import { toTrainCard } from '../srs/cards';
import type { TrainCard } from '../srs/types';
import { parseCollocs } from '../srs/context';
import { usesChunk } from '../text/chunkMatch';
import { readCtx2, type Ctx2 } from './ctx2';
import type { DiagEntry } from './diag';
import { errorEvidence, hypothesesOf, logEvidence, logSig, type Evidence, type Hypothesis } from './hypotheses';
import { wordEvidence } from './learnerWords';
import { isUseId, type PatternId, type UseId } from './tutorTypes';

export { wordFest, wordStatus, wordTier } from './learnerWords';

// Lernermodell der Tutor-Engine (docs/umbau/tutor-engine-v3.md §6.2). Rein und deterministisch: gleiche Quellen und gleiche Uhrzeit ergeben
// dasselbe Modell; nichts wird gelesen oder geschrieben, es gibt keinen Zufall. Aufgerufen wird es nur bei Rundenstart und bei jeder Rückmeldung.
//
// Leistung (§6.2 „Leistung“): `live.ts` liefert bei jeder Änderung neue Maps und neue Dokument-Objekte. Deshalb wird je Dokument zwischengespeichert,
// mit Schlüssel Pfad + Signatur (Zahl der Einträge und letzter Zeitstempel bzw. `last`). Zwischengespeichert wird nur, was NICHT von der Uhrzeit
// abhängt (Zeilen, Muster je Antwort, Belege, Wendungen); alles Zeitabhängige (Abrufwahrscheinlichkeit, Fenster, Zustände) wird jedes Mal neu gerechnet.
//
// Quellen und Ableitung:
//   patterns  je Muster aller Themen mit Musterdatei: p (Thema-p als Vorwissen, mit den letzten ≤ 5 Ergebnissen des Musters verrechnet),
//             Sicherheit 0–5 (`certainty`), Quote der letzten 28 Tage aus dem Protokoll (nur getippte feste Aufgaben, keine Claude-Aufgaben),
//             freie Tage (getippt richtig: Protokoll ∪ `pats.dd`),
//             letzter Fehler (Protokoll und Fehlersätze), Zustand (`patternState`, die eine Stelle dafür).
//   words     je Vokabel über `toTrainCard` + `cardStatus` (die eine Stelle für den Wortstatus); ausgeblendete Karten fehlen.
//   uses      Gebrauchsmuster `use:<erstes>+<letztes Wort>` aus den Wendungen der Karten (`col`), belegt durch eigene Sätze (`act/…`) und Fehlerbelege.
//   hyps      Fehlerannahmen (`hypotheses.ts`, §3.3).
//   pace      Median der Antwortzeit je Aufgabenart (`g:<art>`, `v:<modus>`), nur 0 < ms ≤ 60 s.
//   proofs    Fortschrittsbeleg je Muster (`progressProof`): „vor 3 Wochen 4 von 9, jetzt 8 von 9“, nur aus getippten Antworten im Protokoll.
//   goals     aktuelles Kapitel (`currentChapter`, `null`, solange kein Muster eingeführt ist), C1-Ziele (folgen mit S3), Berufsprofil (`ctx2`).

type Doc = Readonly<Record<string, unknown>>;

export type { Hypothesis } from './hypotheses';

export type PatternKnow = {
  pat: PatternId;
  p: number;
  certainty: 0 | 1 | 2 | 3 | 4 | 5;
  q28: { n: number; ok: number };
  freeDays: number;
  lastWrong: number | null;
  /** Konzept: `TopicState`; im Code heißt derselbe Zustand `PatternState` (new | learning | safe | firm). */
  state: PatternState;
};
export type UseKnow = { id: UseId; seen: number; freeOk: number; lastWrong: number | null; cards: readonly string[] };
export type WordKnow = {
  id: string;
  R: number | null;
  freeDays: number;
  sentences: number;
  stage: number;
  status: 'recognize' | 'withHelp' | 'free' | 'newSentence' | 'used';
  head: 'good' | 'shaky' | 'forgotten' | 'noGap';
};
export type LearnerModel = {
  asOf: number;
  day: string;
  patterns: ReadonlyMap<PatternId, PatternKnow>;
  uses: ReadonlyMap<UseId, UseKnow>;
  words: ReadonlyMap<string, WordKnow>;
  hyps: readonly Hypothesis[];
  pace: Readonly<Record<string, number>>;
  goals: { chapter: number | null; c1: readonly PatternId[]; ctx: Ctx2 | null };
  /** Fortschrittsbelege je Muster (S2); fehlt ein Muster, reichen die Daten nicht (nie erfunden). Ältere Aufrufer ohne Feld: keine Belege. */
  proofs?: ReadonlyMap<PatternId, ProgressProof>;
};

/**
 * Fortschrittsbeleg (Tutor-Engine v3 S2): zwei Fenster aus getippten Antworten auf EIN Muster. „Jetzt“ = die letzten 7 Lerntage, „damals“ = die
 * jüngsten Antworten, die mindestens 14 Tage zurückliegen (im 56-Tage-Fenster). Je Fenster höchstens 9 Antworten (die jüngsten), mindestens 4.
 * `weeks` = ganze Wochen zwischen dem jüngsten Tag von „damals“ und heute (mindestens 2).
 */
export type ProgressProof = { thenOk: number; thenN: number; nowOk: number; nowN: number; weeks: number; trend: 'up' | 'flat' | 'down' };
export type LearnerSources = {
  /** `grammar/<thema>` nach Thema. */
  grammarDocs: ReadonlyMap<string, Doc>;
  /** `log/<tag>` nach Tag; ausgewertet werden nur die letzten 56 Lerntage. */
  logs: ReadonlyMap<string, Doc>;
  /** `vocab/<id>` nach id. */
  vocab: ReadonlyMap<string, Doc>;
  /** `act/<JJJJ-MM>[-b…]` nach Pfad. */
  act: ReadonlyMap<string, Doc>;
  profile: Doc | null;
  /** Wochen-Diagnosen (`diag.ts`); fließen erst mit den Prüfaufgaben (S5) ein. */
  diag: readonly DiagEntry[];
};

export const LOG_WINDOW_DAYS = 56;
export const Q_WINDOW_DAYS = 28;
export const PACE_MAX_MS = 60_000;
/** Vorwissen-Gewicht des Thema-p bei der Muster-Schätzung (wie zwei Antworten). */
const PRIOR_WEIGHT = 2;
const CACHE_MAX = 8000;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const arr = (v: unknown): Doc[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Kleiner Zwischenspeicher mit Pfad und Signatur; der älteste Eintrag fällt bei Überlauf heraus. */
function cached<T>(cache: Map<string, { sig: string; v: T }>, path: string, sig: string, make: () => T): T {
  const hit = cache.get(path);
  if (hit && hit.sig === sig) return hit.v;
  const v = make();
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(path, { sig, v });
  return v;
}

/**
 * Vorstufe ohne Signatur: Unveränderte Dokumente kommen als dasselbe Objekt (contract/db.d.ts, „compare with ===“). Ist das Objekt schon
 * bekannt (unter demselben Pfad), gilt das gespeicherte Ergebnis; sonst rechnet `make` (mit Signatur-Zwischenspeicher) und merkt es sich.
 */
function byDoc<T>(wm: WeakMap<object, { path: string; v: T }>, path: string, doc: Doc, make: () => T): T {
  const hit = wm.get(doc);
  if (hit && hit.path === path) return hit.v;
  const v = make();
  wm.set(doc, { path, v });
  return v;
}
const LOG_BY_DOC = new WeakMap<object, { path: string; v: { dg: LogDigest; ev: Evidence[] } }>();
const GRAMMAR_BY_DOC = new WeakMap<object, { path: string; v: GrammarDigest }>();
const ACT_BY_DOC = new WeakMap<object, { path: string; v: ActEntry[] }>();

// ------------------------------------------------------------------ Protokoll (log/<tag>)

/** Getippte Aufgabenarten (keine Auswahl, kein Bedeutungspaar, kein Antippen). */
const TYPED: ReadonlySet<string> = new Set(['gap', 'transform', 'correct', 'kwt', 'ocl', 'err']);

/** `typed`: getippte feste Aufgabe (für die 28-Tage-Quote, §1.1) · `free`: getippt richtig, ohne Übersteuerung (freier Tag). */
type GRow = { t: number; day: string; pat: string | null; ok: boolean; typed: boolean; free: boolean };
type LogDigest = { g: GRow[]; pace: Array<[string, number]> };

function patOfEntry(e: Doc): string | null {
  const pat = str(e.pat);
  if (pat && patternById(pat)) return patternById(pat)?.id ?? null;
  const topic = str(e.topic);
  const q = str(e.q);
  if (!topic || !q || !patternsOf(topic)) return null;
  return patternOf({ topic, prompt: q, answer: str(e.ans), src: str(e.src), ...(pat ? { pat } : {}) })?.id ?? null;
}

const LOG_CACHE = new Map<string, { sig: string; v: LogDigest }>();
function logDigest(path: string, doc: Doc, sig: string): LogDigest {
  const entries = arr(doc.entries);
  return cached(LOG_CACHE, path, sig, () => {
    const g: GRow[] = [];
    const pace: Array<[string, number]> = [];
    for (const e of entries) {
      const t = num(e.t);
      if (!t) continue;
      const k = str(e.k);
      const ms = num(e.ms);
      if (ms > 0 && ms <= PACE_MAX_MS) {
        if (k === 'g' && str(e.type)) pace.push([`g:${str(e.type)}`, ms]);
        else if (k === 'v' && str(e.m)) pace.push([`v:${str(e.m)}`, ms]);
      }
      if (k !== 'g') continue;
      const given = str(e.given);
      const typed = (TYPED.has(str(e.type)) || e.free === true) && given !== DONT_KNOW;
      const free = typed && e.ok === true && e.override !== true;
      g.push({ t, day: dayKey(t), pat: patOfEntry(e), ok: e.ok === true, typed: typed && e.ai !== true, free });
    }
    return { g, pace };
  });
}

// ------------------------------------------------------------------ Grammatik-Dokumente (grammar/<thema>)

type ErrRow = { t: number; pat: string | null };
type GrammarDigest = { errs: ErrRow[]; ev: Evidence[] };
const GRAMMAR_CACHE = new Map<string, { sig: string; v: GrammarDigest }>();
function grammarDigest(topic: string, doc: Doc): GrammarDigest {
  const errors = arr(doc.errors);
  return cached(GRAMMAR_CACHE, `grammar/${topic}`, logSig(errors), () => {
    const errs: ErrRow[] = [];
    for (const e of errors) {
      const t = num(e.t);
      if (!t || e.void) continue;
      const pat = str(e.pat);
      errs.push({ t, pat: pat ? (patternById(pat)?.id ?? null) : patOfEntry({ ...e, topic }) });
    }
    // Alle Belege ohne Abgleich mit dem Protokoll; das Herausfiltern doppelter Zeitpunkte geschieht danach (es hängt an den Protokollen).
    return { errs, ev: errorEvidence(topic, doc, new Set()) };
  });
}

// ------------------------------------------------------------------ Vokabeln (vocab/<id>)

const ARTICLES = new Set(['a', 'an', 'the', 'sb', 'sth', 'someone', 'something', 'somebody', 'smb', 'smth', 'one', "one's", 'your', 'my']);

/** Gebrauchsmuster einer Wendung: `use:<erstes>+<letztes Wort>` ohne „to“ am Anfang, ohne Artikel und Platzhalter; sonst `null`. */
export function toUseId(phrase: string): UseId | null {
  const words = phrase
    .toLowerCase()
    .replace(/[“”"…]|\.\.\./g, ' ')
    .replace(/[^a-z' -]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words[0] === 'to' && words.length > 2) words.shift();
  const core = words.filter((w) => !ARTICLES.has(w));
  if (core.length < 2) return null;
  const id = `use:${core[0] ?? ''}+${core[core.length - 1] ?? ''}`;
  return isUseId(id) ? id : null;
}

type VocabStatic = { sentences: number; uses: Array<{ id: UseId; p: string }> };
/** Sätze mit guter Antwort und Gebrauchsmuster der Wendungen (zwischengespeichert mit der Karte, `wordStatic`). */
function vocabStaticOf(doc: Doc): VocabStatic {
  const sent = new Set<string>();
  for (const h of arr(doc.hist)) if (num(h.g) >= 2 && str(h.s)) sent.add(str(h.s));
  const uses: VocabStatic['uses'] = [];
  for (const c of parseCollocs(doc.col)) {
    const u = toUseId(c.p);
    if (u && !uses.some((x) => x.id === u)) uses.push({ id: u, p: c.p });
  }
  return { sentences: sent.size, uses };
}

// Karte und Beleg-Teil des Wortstatus je Dokument (Leistung, §6.2): `toTrainCard` und der Verlauf-Teil von `cardStatus` hängen nicht von der Uhrzeit ab,
// solange `due` gesetzt ist (sonst setzt die Umrechnung alter Werte `due` auf „jetzt“ – dann gehört die Uhrzeit mit in die Signatur). Die Abruf-
// wahrscheinlichkeit und alles daraus rechnet `cardStatusFrom` jedes Mal neu.
// Zwei Stufen: (1) dasselbe Dokument-Objekt (unveränderte Dokumente kommen laut contract/db.d.ts als dasselbe Objekt) → sofort;
// (2) neues Objekt → Signatur als Liste von Einzelwerten, verglichen mit `===` (ohne Zahl-zu-Text-Umwandlung, die bei 5.000 Karten teuer ist).
// Die Signatur deckt alle Felder ab, die Karte und Beleg lesen (Planung alt und neu, Stufe, Verlauf je Eintrag, Satz-Felder für den
// Ursprungssatz, ausgeblendet, eigene Sätze). Ein Objekt im Wert (statt Zahl/Text) trifft nie: dann wird sicher neu gerechnet.
type WordStatic = { card: TrainCard | null; ev: CardEvidence | null; vs: VocabStatic };
type WordEntry = { sig: unknown[]; v: WordStatic; nowDep: boolean };
const WORD_CACHE = new Map<string, WordEntry>();
const WORD_BY_DOC = new WeakMap<object, WordEntry>();

const hasDue = (doc: Doc): boolean => typeof doc.due === 'number' && Number.isFinite(doc.due) && doc.due > 0;

function wordSig(doc: Doc, now: number): unknown[] {
  const f = obj(doc.fsrs);
  const s: unknown[] = [doc.word, doc.pos, doc.stage, doc.S, doc.D, doc.due, doc.last, doc.state, doc.reps, doc.lapses, doc.hidden, doc.na, doc.ex, doc.ac, doc.pa, doc.fsrs === undefined];
  s.push(f.v, f.due, f.stability, f.difficulty, f.state, f.reps, f.lapses, f.last, f.scheduledDays, f.learningSteps, f.src);
  const hist = Array.isArray(doc.hist) ? (doc.hist as unknown[]) : [];
  s.push(hist.length);
  for (const raw of hist) {
    const h = obj(raw);
    s.push(h.t, h.g, h.x, h.m, h.u, typeof h.ci === 'number', h.s);
  }
  const xEx = Array.isArray(doc.xEx) ? (doc.xEx as unknown[]) : [];
  s.push(xEx.length);
  for (const x of xEx) s.push(obj(x).en);
  const col = Array.isArray(doc.col) ? (doc.col as unknown[]) : [];
  s.push(col.length);
  for (const c of col) s.push(obj(c).p, obj(c).ex, obj(c).de, obj(c).gap);
  if (!hasDue(doc)) s.push(now);
  return s;
}

function sameSig(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (x !== y && !(typeof x === 'number' && typeof y === 'number' && Number.isNaN(x) && Number.isNaN(y))) return false;
  }
  return true;
}

function wordStatic(id: string, doc: Doc, now: number): WordStatic {
  const byDoc = WORD_BY_DOC.get(doc);
  if (byDoc && !byDoc.nowDep) return byDoc.v;
  const path = `vocab/${id}`;
  const sig = wordSig(doc, now);
  const hit = WORD_CACHE.get(path);
  if (hit && sameSig(hit.sig, sig)) {
    WORD_BY_DOC.set(doc, hit);
    return hit.v;
  }
  const card = toTrainCard(id, doc, true, now);
  const entry: WordEntry = { sig, v: { card, ev: card ? wordEvidence(card) : null, vs: vocabStaticOf(doc) }, nowDep: !hasDue(doc) };
  if (WORD_CACHE.size >= CACHE_MAX && !hit) WORD_CACHE.delete(WORD_CACHE.keys().next().value as string);
  WORD_CACHE.set(path, entry);
  WORD_BY_DOC.set(doc, entry);
  return entry.v;
}

// ------------------------------------------------------------------ Eigene Sätze (act/…)

const ACT_CACHE = new Map<string, { sig: string; v: ActEntry[] }>();
function actEntries(path: string, doc: Doc): ActEntry[] {
  return byDoc(ACT_BY_DOC, path, doc, () => actEntriesSig(path, doc));
}
function actEntriesSig(path: string, doc: Doc): ActEntry[] {
  const keys = Object.keys(obj(doc.e));
  let max = '';
  for (const k of keys) if (k > max) max = k;
  return cached(ACT_CACHE, path, `${keys.length}:${max}`, () => entriesOf(path, doc as Record<string, unknown>));
}

// ------------------------------------------------------------------ Modell

/** Sortierte Schlüssel einer Map; dieselbe (unveränderte) Map wird nur einmal sortiert. Die Map wird nie verändert (Lieferungen sind fest). */
const SORTED = new WeakMap<object, string[]>();
function sortedKeys(m: ReadonlyMap<string, unknown>): readonly string[] {
  const hit = SORTED.get(m);
  if (hit && hit.length === m.size) return hit;
  const keys = [...m.keys()].sort();
  SORTED.set(m, keys);
  return keys;
}

/** `usesChunk` mit Gedächtnis (Satz und Wendung ändern sich nicht; rein). */
const CHUNK_MEMO = new Map<string, boolean>();
function usesChunkMemo(s: string, p: string): boolean {
  const k = `${p}\u0000${s}`;
  const hit = CHUNK_MEMO.get(k);
  if (hit !== undefined) return hit;
  const v = usesChunk(s, p);
  if (CHUNK_MEMO.size >= CACHE_MAX) CHUNK_MEMO.clear();
  CHUNK_MEMO.set(k, v);
  return v;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : Math.round(((s[m - 1] as number) + (s[m] as number)) / 2);
}

const bitsOf = (e: PatEntry | undefined): number[] => {
  const k = Math.min(5, num(e?.k));
  const out: number[] = [];
  for (let b = 0; b < k; b++) out.push((num(e?.r) >> b) % 2);
  return out;
};

/** Je Fenster höchstens so viele Antworten (die jüngsten) und mindestens so viele, sonst kein Beleg. */
export const PROOF_MAX = 9;
export const PROOF_MIN = 4;
const PROOF_NOW_DAYS = 7;
const PROOF_GAP_DAYS = 14;
/** Ab diesem Unterschied der Quoten (20 Prozentpunkte) gilt der Verlauf als besser bzw. schlechter. */
const PROOF_TREND = 0.2;

const dayDiff = (a: string, b: string): number => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

/**
 * Fortschrittsbeleg aus Antwortzeilen eines Musters (rein). Gezählt werden nur getippte Antworten (`typed`); `null`, wenn eines der beiden
 * Fenster weniger als `PROOF_MIN` Antworten hat. Zeilen nach `today` zählen nicht.
 */
export function progressProof(rows: ReadonlyArray<{ t: number; day: string; ok: boolean; typed: boolean }>, today: string): ProgressProof | null {
  const typed = rows.filter((r) => r.typed && r.day <= today).sort((a, b) => a.t - b.t);
  const nowFrom = addDays(today, -(PROOF_NOW_DAYS - 1));
  const thenTo = addDays(today, -PROOF_GAP_DAYS);
  const nowRows = typed.filter((r) => r.day >= nowFrom).slice(-PROOF_MAX);
  const thenRows = typed.filter((r) => r.day <= thenTo).slice(-PROOF_MAX);
  if (nowRows.length < PROOF_MIN || thenRows.length < PROOF_MIN) return null;
  const nowOk = nowRows.filter((r) => r.ok).length;
  const thenOk = thenRows.filter((r) => r.ok).length;
  const lastThen = thenRows[thenRows.length - 1]?.day ?? thenTo;
  const weeks = Math.max(2, Math.round(dayDiff(lastThen, today) / 7));
  const d = nowOk / nowRows.length - thenOk / thenRows.length;
  return { thenOk, thenN: thenRows.length, nowOk, nowN: nowRows.length, weeks, trend: d >= PROOF_TREND ? 'up' : d <= -PROOF_TREND ? 'down' : 'flat' };
}

const sortedMap = <K extends string, V>(entries: Array<[K, V]>): Map<K, V> => new Map(entries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));

export function buildLearnerModel(src: LearnerSources, now: number): LearnerModel {
  const today = dayKey(now);
  const logFrom = addDays(today, -(LOG_WINDOW_DAYS - 1));
  const qFrom = addDays(today, -(Q_WINDOW_DAYS - 1));

  // Protokolle im Fenster (Dokumentschlüssel = Lerntag; die Zeilen tragen ihren eigenen Tag aus dem Zeitstempel).
  const logKeys = [...src.logs.keys()].filter((d) => d >= logFrom && d <= today).sort();
  const rows: GRow[] = [];
  const paceIn = new Map<string, number[]>();
  const evidence: Evidence[] = [];
  const seenT = new Set<number>();
  for (const day of logKeys) {
    const doc = src.logs.get(day) as Doc;
    const path = `log/${day}`;
    const { dg, ev } = byDoc(LOG_BY_DOC, path, doc, () => {
      const sig = logSig(arr(doc.entries));
      return { dg: logDigest(path, doc, sig), ev: logEvidence(path, doc, sig) };
    });
    for (const r of dg.g) {
      if (r.t > now) continue;
      rows.push(r);
      seenT.add(r.t);
    }
    for (const [k, ms] of dg.pace) {
      const l = paceIn.get(k);
      if (l) l.push(ms);
      else paceIn.set(k, [ms]);
    }
    for (const e of ev) evidence.push(e);
  }

  // Grammatik-Dokumente: Fehlersätze (letzter Fehler je Muster) und Belege, die nicht schon im Protokoll stehen.
  const errLast = new Map<string, number>();
  for (const topic of [...src.grammarDocs.keys()].sort()) {
    const gdoc = src.grammarDocs.get(topic) as Doc;
    const dg = byDoc(GRAMMAR_BY_DOC, `grammar/${topic}`, gdoc, () => grammarDigest(topic, gdoc));
    for (const e of dg.errs) if (e.pat && e.t <= now && e.t > (errLast.get(e.pat) ?? 0)) errLast.set(e.pat, e.t);
    for (const e of dg.ev) if (!seenT.has(e.t)) evidence.push(e);
  }

  // Muster.
  const byPat = new Map<string, GRow[]>();
  for (const r of rows) {
    if (!r.pat) continue;
    const l = byPat.get(r.pat);
    if (l) l.push(r);
    else byPat.set(r.pat, [r]);
  }
  const patterns: Array<[PatternId, PatternKnow]> = [];
  const proofs: Array<[PatternId, ProgressProof]> = [];
  for (const topic of topicsWithPatterns()) {
    const doc = src.grammarDocs.get(topic);
    const pats = patsOf(doc);
    const tp = topicP(topic, doc, now);
    for (const p of patternsOf(topic)?.patterns ?? []) {
      const entry = pats[p.id];
      const bits = bitsOf(entry);
      const pEst = bits.length ? (tp * PRIOR_WEIGHT + bits.reduce((a, b) => a + b, 0)) / (PRIOR_WEIGHT + bits.length) : tp;
      const mine = byPat.get(p.id) ?? [];
      const q = mine.filter((r) => r.typed && r.day >= qFrom);
      const free = new Set<string>([...(entry?.dd ?? []), ...mine.filter((r) => r.free).map((r) => r.day)]);
      let lastWrong = errLast.get(p.id) ?? 0;
      for (const r of mine) if (!r.ok && r.t > lastWrong) lastWrong = r.t;
      const proof = progressProof(mine, today);
      if (proof) proofs.push([p.id, proof]);
      patterns.push([
        p.id,
        {
          pat: p.id,
          p: Math.round(pEst * 1000) / 1000,
          certainty: certainty(pEst, { n: num(entry?.n), recent: bits }).word,
          q28: { n: q.length, ok: q.filter((r) => r.ok).length },
          freeDays: free.size,
          lastWrong: lastWrong || null,
          state: patternState(entry, today),
        },
      ]);
    }
  }

  // Wörter und Wendungen.
  const words: Array<[string, WordKnow]> = [];
  const cardUses = new Map<string, VocabStatic['uses']>();
  const useCards = new Map<UseId, Set<string>>();
  for (const id of sortedKeys(src.vocab)) {
    const doc = src.vocab.get(id) as Doc;
    const ws = wordStatic(id, doc, now);
    const card = ws.card;
    if (!card || card.hidden || !ws.ev) continue;
    const vs = ws.vs;
    const st = cardStatusFrom(card, ws.ev, now);
    const status: WordKnow['status'] = st.own ? 'used' : st.newSentence ? 'newSentence' : st.freeDays > 0 ? 'free' : st.helped ? 'withHelp' : 'recognize';
    words.push([id, { id, R: st.r, freeDays: st.freeDays, sentences: vs.sentences, stage: card.stage, status, head: st.mind === 'none' ? 'noGap' : st.mind }]);
    if (vs.uses.length) cardUses.set(`vocab/${id}`, vs.uses);
    for (const u of vs.uses) {
      const s = useCards.get(u.id);
      if (s) s.add(id);
      else useCards.set(u.id, new Set([id]));
    }
  }

  // Eigene Sätze: Gebrauch der Wendungen (gesehen, richtige Tage).
  const useSeen = new Map<UseId, number>();
  const useOkDays = new Map<UseId, Map<string, number>>();
  for (const path of [...src.act.keys()].sort()) {
    for (const e of actEntries(path, src.act.get(path) as Doc)) {
      if (e.t > now) continue;
      const targets: Array<[string, string]> = e.ts?.length ? e.ts.map(([k, v]) => [k, v]) : [[e.c, e.v]];
      for (const [cardKey, verdict] of targets) {
        for (const u of cardUses.get(cardKey) ?? []) {
          if (!usesChunkMemo(e.s, u.p)) continue;
          useSeen.set(u.id, (useSeen.get(u.id) ?? 0) + 1);
          if (verdict === 'c') {
            const days = useOkDays.get(u.id) ?? new Map<string, number>();
            days.set(e.d, Math.max(days.get(e.d) ?? 0, e.t));
            useOkDays.set(u.id, days);
          }
        }
      }
    }
  }

  // Annahmen.
  const freeDaysAfter = (id: string, t: number): number => {
    if (isUseId(id)) return [...(useOkDays.get(id)?.values() ?? [])].filter((x) => x > t).length;
    return new Set((byPat.get(id) ?? []).filter((r) => r.free && r.t > t).map((r) => r.day)).size;
  };
  const hyps = hypothesesOf(
    [...evidence].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)),
    now,
    freeDaysAfter,
  );

  // Gebrauchsmuster: aus Karten, eigenen Sätzen und Fehlerbelegen.
  const useWrong = new Map<UseId, { n: number; last: number }>();
  for (const e of evidence) {
    if (!isUseId(e.from) || e.t > now) continue;
    const w = useWrong.get(e.from) ?? { n: 0, last: 0 };
    useWrong.set(e.from, { n: w.n + 1, last: Math.max(w.last, e.t) });
  }
  const useIds = new Set<UseId>([...useCards.keys(), ...useWrong.keys()]);
  const uses: Array<[UseId, UseKnow]> = [...useIds].map((id) => [
    id,
    {
      id,
      seen: (useSeen.get(id) ?? 0) + (useWrong.get(id)?.n ?? 0),
      freeOk: useOkDays.get(id)?.size ?? 0,
      lastWrong: useWrong.get(id)?.last ?? null,
      cards: [...(useCards.get(id) ?? [])].sort(),
    },
  ]);

  // Tempo.
  const pace: Record<string, number> = {};
  for (const k of [...paceIn.keys()].sort()) pace[k] = median(paceIn.get(k) as number[]);

  // Ziele.
  const infos = patInfos(src.grammarDocs);
  const anyIntro = infos.some((p) => !!p.entry && (p.entry.i !== undefined || num(p.entry.n) > 0));

  return {
    asOf: now,
    day: today,
    patterns: sortedMap(patterns),
    uses: sortedMap(uses),
    // Schon sortiert (Schleife über die sortierten Kennungen).
    words: new Map(words),
    hyps,
    pace,
    goals: { chapter: anyIntro ? currentChapter(infos, today) : null, c1: [], ctx: readCtx2(src.profile) },
    proofs: sortedMap(proofs),
  };
}
