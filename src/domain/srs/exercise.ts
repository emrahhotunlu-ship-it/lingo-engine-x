import { hash32, mulberry32, shuffle } from '../random';
import { typedForm } from '../chunks/situation';
import { meaningOf, shortMeaning } from './cards';
import { exerciseDef } from './modes';
import { familyFrom, partnerOf, trapTask } from './partner';
import { packExtraOf } from '../c1pack/packFields';
import { rotatedContext } from './rotate';
import type { CheckResult, Colloc, Exercise, ExerciseId, Lang, Option, SituationTask, Stage, Tile, TrainCard } from './types';

// Übung aus Karte und Art bauen (Lern-Entwurf §4.4 Ablenker). Zufall mit Startwert:
// dieselbe Karte am selben Tag zeigt dieselben Optionen in derselben Reihenfolge.

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const contentWords = (s: string) => new Set(norm(s).split(/[^a-zäöüß]+/).filter((w) => w.length >= 4));

function sharesWord(a: string, b: string): boolean {
  const wa = contentWords(a);
  for (const w of contentWords(b)) if (wa.has(w)) return true;
  return false;
}

/** Einzelne Bedeutungen („umgehen mit, erledigen" → umgehen mit · erledigen), ohne „sich"/„to". */
export function meaningParts(m: string | null | undefined): string[] {
  if (!m) return [];
  return m
    .split(/[,;/]|\bor\b|\boder\b/)
    .map((p) => norm(p.replace(/\(.*?\)/g, ' ')).replace(/^(to|sich|etw\.?|jdn\.?|jdm\.?)\s+/, ''))
    .filter((p) => p.length >= 3);
}

/** Überschneiden sich zwei Bedeutungen (eine enthält die andere)? */
function meaningsOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = meaningParts(a);
  const pb = meaningParts(b);
  return pa.some((x) => pb.some((y) => x === y || (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y))));
}

/** Gleicher deutscher Wortanfang (überzeug-/überred-): höchstens als Notlösung Ablenker. */
function sameGermanStem(a: string | null | undefined, b: string | null | undefined): boolean {
  const first = (m: string | null | undefined) => meaningParts(m).map((p) => p.split(' ')[0] ?? '').filter((w) => w.length >= 6);
  const fa = first(a);
  const fb = first(b);
  return fa.some((x) => fb.some((y) => x.slice(0, 4) === y.slice(0, 4)));
}

const GENERIC = new Set(['something', 'someone', 'somebody', 'that', 'this', 'with', 'from', 'about', 'which', 'your', 'very', 'into', 'more', 'have', 'been', 'what', 'when', 'them', 'they', 'their']);

/** Englische Definitionen, die sich stark gleichen („to make someone …", B5). */
export function defsClash(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const wa = norm(a).split(/[^a-z']+/).filter(Boolean);
  const wb = norm(b).split(/[^a-z']+/).filter(Boolean);
  if (wa.length >= 3 && wb.length >= 3 && wa.slice(0, 3).join(' ') === wb.slice(0, 3).join(' ')) return true;
  const ca = new Set(wa.filter((w) => w.length >= 4 && !GENERIC.has(w)));
  const cb = wb.filter((w) => w.length >= 4 && !GENERIC.has(w));
  const shared = cb.filter((w) => ca.has(w)).length;
  return shared >= 2 && shared >= Math.min(ca.size, new Set(cb).size) / 2;
}

/** Synonym-Gefahr zwischen zwei Karten: hart ausschließen. */
function tooClose(a: TrainCard, b: TrainCard): boolean {
  return meaningsOverlap(a.de, b.de) || meaningsOverlap(a.def, b.def) || defsClash(a.def, b.def);
}

/** Abzug für Karten, die nur als Notlösung Ablenker sein sollen. */
const stemPenalty = (a: TrainCard, b: TrainCard): number => (sameGermanStem(a.de, b.de) ? 10 : 0);

type Scored = { card: TrainCard; label: string; score: number };
const m = (c: TrainCard, lang: Lang) => meaningOf(c, lang) ?? '';

function pick(candidates: Scored[], n: number): Scored[] {
  const seen = new Set<string>();
  const out: Scored[] = [];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const k = norm(c.label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

/** Drei Bedeutungen anderer Karten als Ablenker (gleiche Wortart bevorzugt, keine Synonyme). */
function meaningDistractors(card: TrainCard, pool: readonly TrainCard[], lang: Lang, rng: () => number): Option[] {
  const target = meaningOf(card, lang) ?? '';
  const targetLabel = shortMeaning(target, lang);
  const cands: Scored[] = [];
  for (const c of pool) {
    const m = meaningOf(c, lang);
    if (c.key === card.key || !m) continue;
    const label = shortMeaning(m, lang);
    if (norm(label) === norm(targetLabel) || sharesWord(m, target) || norm(c.lemma) === norm(card.lemma) || tooClose(card, c)) continue;
    const score =
      (c.kind === card.kind ? 4 : 0) + (c.pos && c.pos === card.pos ? 3 : 0) + (Math.abs(label.length - targetLabel.length) <= 12 ? 2 : 0) + (c.stage === card.stage ? 1 : 0) + rng() * 0.5 - stemPenalty(card, c);
    cands.push({ card: c, label, score });
  }
  return pick(cands, 3).map((d, i) => ({ id: `d${i}`, label: d.label, lang, correct: false, fromWord: d.card.word, fromMeaning: m(d.card, lang) }));
}


/** Drei englische Wörter anderer Karten als Ablenker. */
function wordDistractors(card: TrainCard, pool: readonly TrainCard[], lang: Lang, rng: () => number): Option[] {
  const cands: Scored[] = [];
  const head = norm(card.lemma).slice(0, 5);
  const target = meaningOf(card, lang) ?? '';
  for (const c of pool) {
    if (c.key === card.key) continue;
    if (norm(c.lemma) === norm(card.lemma) || norm(c.lemma).slice(0, 5) === head) continue;
    const cm = meaningOf(c, lang);
    if (cm && target && sharesWord(cm, target)) continue;
    if (tooClose(card, c)) continue;
    // Wendungen bekommen Wendungen als Ablenker, Wörter Wörter (sonst verrät die Länge die Lösung).
    const sameKind = c.kind === card.kind ? 4 : 0;
    const score = sameKind + (c.pos && c.pos === card.pos ? 3 : 0) + (Math.abs(c.word.length - card.word.length) <= 3 ? 2 : 0) + (c.stage === card.stage ? 1 : 0) + rng() * 0.5 - stemPenalty(card, c);
    cands.push({ card: c, label: c.kind === 'chunk' ? typedForm(c.word) : c.word, score });
  }
  return pick(cands, 3).map((d, i) => ({ id: `d${i}`, label: d.label, lang: 'en', correct: false, fromWord: d.card.word, fromMeaning: m(d.card, lang) }));
}

/**
 * Ablenker in der Form der Lösung (match): steht im Satz „relied“, heißen die Ablenker „trusted“
 * statt „trust“ – sonst verrät die Endung die Lösung. Nur einzelne Wörter mit regelmäßiger Endung.
 */
export function inflectLike(solution: string, lemma: string, other: string): string {
  const sol = solution.toLowerCase();
  const lem = lemma.toLowerCase().replace(/^to\s+/, '');
  const oth = other.replace(/^to\s+/i, '');
  if (sol === lem || /\s/.test(sol) || /\s/.test(oth)) return oth;
  const group = sol.endsWith('ing') ? 'ing' : sol.endsWith('ed') ? 'ed' : sol.endsWith('s') && !sol.endsWith('ss') ? 's' : null;
  if (!group) return oth;
  return regularForm(oth, group);
}

/** Regelmäßige Form eines einzelnen Worts: -ing, -ed, -s (e-Wegfall, y → ies/ied, -es nach Zischlaut). */
export function regularForm(w: string, group: 'ing' | 'ed' | 's'): string {
  const low = w.toLowerCase();
  const consY = /[^aeiou]y$/.test(low);
  if (group === 'ing') return low.endsWith('ie') ? `${w.slice(0, -2)}ying` : low.endsWith('e') && !low.endsWith('ee') ? `${w.slice(0, -1)}ing` : `${w}ing`;
  if (group === 'ed') return consY ? `${w.slice(0, -1)}ied` : low.endsWith('e') ? `${w}d` : `${w}ed`;
  return consY ? `${w.slice(0, -1)}ies` : /(s|x|z|ch|sh)$/.test(low) ? `${w}es` : `${w}s`;
}

const FOREIGN = 'etaoinshrdlucmfwyp';
const FILLER_WORDS = ['a', 'the', 'to', 'of'];
const TILE_LETTERS_MAX = 14;

/**
 * Bausteine (phase1-plan §4.2): ein Wort mit ≤ 14 Buchstaben → Buchstaben plus 2 fremde
 * Buchstaben; längere Wörter → Zweiergruppen ohne Fremde; Mehrwort und Wendungen → Wörter plus
 * 2 Fremdwörter. Nie in Lösungsreihenfolge.
 */
export function buildTiles(solution: string, otherWords: readonly string[], rng: () => number): { tiles: Tile[]; mode: 'letters' | 'words' } {
  const sol = solution.trim();
  let parts: string[];
  let extra: string[] = [];
  let mode: 'letters' | 'words' = 'letters';
  if (/\s/.test(sol)) {
    mode = 'words';
    parts = sol.split(/\s+/);
    const low = new Set(parts.map((p) => p.toLowerCase()));
    const pool = [...otherWords.filter((w) => /^[a-z'-]+$/i.test(w) && !low.has(w.toLowerCase())), ...FILLER_WORDS.filter((w) => !low.has(w))];
    const uniq = [...new Set(pool)];
    extra = shuffle(uniq, rng).slice(0, 2);
  } else if (sol.length <= TILE_LETTERS_MAX) {
    parts = Array.from(sol);
    const used = new Set(parts.map((c) => c.toLowerCase()));
    const free = Array.from(FOREIGN).filter((c) => !used.has(c));
    extra = shuffle(free, rng).slice(0, 2);
  } else {
    parts = [];
    for (let i = 0; i < sol.length; i += 2) parts.push(sol.slice(i, i + 2));
  }
  const all: Tile[] = [...parts.map((text, id) => ({ id, text, distractor: false })), ...extra.map((text, k) => ({ id: parts.length + k, text, distractor: true }))];
  let mixed = shuffle(all, rng);
  const inOrder = (xs: readonly Tile[]) => xs.filter((x) => !x.distractor).map((x) => x.text).join('\u0000') === parts.join('\u0000');
  if (all.length > 1 && inOrder(mixed)) mixed = [...mixed.slice(1), mixed[0] as Tile];
  if (all.length > 1 && inOrder(mixed)) mixed = [...mixed].reverse();
  return { tiles: mixed, mode };
}

/** Zusammengesetzte Antwort aus gesetzten Bausteinen. */
export function tilesAnswer(tiles: readonly Tile[], placed: readonly number[], mode: 'letters' | 'words'): string {
  const byId = new Map(tiles.map((t) => [t.id, t.text]));
  const parts = placed.map((id) => byId.get(id) ?? '');
  return mode === 'words' ? parts.join(' ') : parts.join('');
}

/** Zeitgrenze für `speed`: clamp(4000 + 400·Länge, 6000, 14000) ms. */
export const speedLimitMs = (solution: string): number => Math.min(14_000, Math.max(6_000, 4_000 + 400 * solution.length));

/** Szene einer Wendung für die Situationsübung (Titel, Lage, Gegenüber in Oberflächensprache). */
export type SceneLookup = (id: string) => { title: string; situation: string; counterpart: string } | null;

function situationTask(card: TrainCard, lang: Lang, sceneOf?: SceneLookup): SituationTask {
  const c = card.chunk;
  const scene = c?.scene && sceneOf ? sceneOf(c.scene) : null;
  return {
    sceneTitle: scene?.title || c?.sceneTitle || c?.scene || '',
    situation: scene?.situation ?? '',
    counterpart: scene?.counterpart ?? '',
    intent: meaningOf(card, lang) ?? '',
    then: c?.utterance ?? '',
    upgraded: c?.upgraded ?? '',
  };
}

function pickColloc(card: TrainCard, rng: () => number): Colloc | null {
  return partnerOf(card, Math.floor(rng() * 1000));
}

/** Lösungsform einer freistehenden Abfrage (ohne Satz): Wort bzw. Wendung ohne „…“. */
const bareAnswer = (card: TrainCard): string => (card.kind === 'chunk' ? typedForm(card.word) : card.word);

/** `origin`: immer der Ursprungssatz (Prüfabfrage und Kontrolle nach dem Aufdecken), sonst wechselt der Satz ab Stufe 3 (`rotate.ts`). */
export function buildExercise(card: TrainCard, ex: ExerciseId, lang: Lang, pool: readonly TrainCard[], seed: string, opts: { sceneOf?: SceneLookup; origin?: boolean } = {}): Exercise {
  const def = exerciseDef(ex);
  const rng = mulberry32(hash32(`${card.key}|${ex}|${seed}`));
  const meaning = meaningOf(card, lang);
  const stage = Math.max(1, card.stage) as Stage;
  const base: Exercise = { ex, input: def.input, card, stage, sentence: null, meaning, firstLetter: null, colloc: null, options: [], accepted: [] };
  const ctx = opts.origin ? card.context : rotatedContext(card, ex);

  switch (ex) {
    case 'listen_mc':
    case 'mc_en': {
      const label = shortMeaning(meaning ?? '', lang);
      const correct: Option = { id: 'ok', label, lang, correct: true };
      const options = shuffle([correct, ...meaningDistractors(card, pool, lang, rng)], rng);
      if (ex === 'listen_mc') return { ...base, sentence: card.context, options, accepted: [label], speak: card.context?.sentence ?? bareAnswer(card) };
      return { ...base, sentence: card.context, options, accepted: [label] };
    }
    case 'spot': {
      const gap = card.context?.gap ?? card.word;
      return { ...base, sentence: card.context, accepted: [gap] };
    }
    case 'match': {
      const answer = card.context?.gap ?? bareAnswer(card);
      const correct: Option = { id: 'ok', label: answer, lang: 'en', correct: true };
      const ds = wordDistractors(card, pool, lang, rng).map((d) => ({ ...d, label: card.context ? inflectLike(answer, card.lemma, d.label) : d.label }))
        .filter((d) => norm(d.label) !== norm(answer));
      return { ...base, sentence: card.context, options: shuffle([correct, ...ds], rng), accepted: [answer] };
    }
    case 'tiles': {
      const answer = ctx?.gap ?? (card.kind === 'chunk' ? typedForm(card.word) : card.lemma);
      const others = pool.filter((c) => c.key !== card.key).map((c) => c.lemma);
      const { tiles } = buildTiles(answer, others, rng);
      return { ...base, sentence: ctx, tiles, accepted: [answer] };
    }
    case 'dictation': {
      const gap = ctx?.gap ?? card.word;
      return { ...base, sentence: ctx, accepted: [gap], speak: ctx?.sentence ?? gap };
    }
    case 'speed': {
      if (ctx) return { ...base, sentence: ctx, accepted: [ctx.gap], limitMs: speedLimitMs(ctx.gap) };
      const accepted = [bareAnswer(card)];
      if (card.lemma !== accepted[0]) accepted.push(card.lemma);
      return { ...base, accepted, limitMs: speedLimitMs(accepted[0] ?? card.word) };
    }
    case 'produce':
      return { ...base, accepted: [] };
    case 'situation': {
      const typed = typedForm(card.word);
      return { ...base, accepted: [...new Set([typed, card.word])].filter(Boolean), situation: situationTask(card, lang, opts.sceneOf) };
    }
    case 'mc_de': {
      const label = bareAnswer(card);
      const correct: Option = { id: 'ok', label, lang: 'en', correct: true };
      return { ...base, options: shuffle([correct, ...wordDistractors(card, pool, lang, rng)], rng), accepted: [label] };
    }
    case 'colloc_gap':
    case 'colloc': {
      // Die Lücke steht nur am Partnerwort. `colloc` (Stufe 4) wird getippt; die Optionen dienen dort nur als Tipp 2.
      const c = pickColloc(card, rng);
      const answer = c?.ctx?.gap ?? c?.gap ?? '';
      const opts = (c?.opts ?? []).filter((o) => norm(o) !== norm(answer)).slice(0, 3);
      const options: Option[] = [{ id: 'ok', label: answer, lang: 'en', correct: true }, ...opts.map((o, i) => ({ id: `d${i}`, label: o, lang: 'en' as const, correct: false }))];
      return { ...base, sentence: c?.ctx ?? null, colloc: c, options: shuffle(options, rng), accepted: [answer] };
    }
    case 'ctx_mc': {
      // „Was heißt das hier?“: Satz mit markiertem Wort, drei deutsche Optionen (die richtige und zwei andere).
      const label = shortMeaning(meaning ?? '', lang);
      const correct: Option = { id: 'ok', label, lang, correct: true };
      return { ...base, sentence: card.context, options: shuffle([correct, ...meaningDistractors(card, pool, lang, rng).slice(0, 2)], rng), accepted: [label] };
    }
    case 'complete': {
      const starts = packExtraOf(card)?.starts ?? [];
      const start = starts.length ? (starts[Math.floor(rng() * starts.length)] ?? null) : null;
      return { ...base, start, accepted: [] };
    }
    case 'wordfam': {
      const gap = ctx?.gap ?? card.word;
      return { ...base, sentence: ctx, accepted: [gap], famFrom: familyFrom(card) };
    }
    case 'find_trap': {
      const t = trapTask(card);
      const sentence = t ? { sentence: t.sentence, start: t.start, end: t.end, gap: t.sentence.slice(t.start, t.end) } : null;
      return { ...base, sentence, accepted: [sentence?.gap ?? card.word], trap: t };
    }
    case 'cloze_hint':
    case 'cloze': {
      const gap = ctx?.gap ?? card.word;
      return { ...base, sentence: ctx, firstLetter: ex === 'cloze_hint' ? gap.slice(0, 1) : null, accepted: [gap] };
    }
    case 'type': {
      const accepted = [bareAnswer(card)];
      if (card.lemma !== card.word) accepted.push(card.lemma);
      return { ...base, accepted };
    }
    case 'flip':
      // Anki (anki-regeln §1): Vorderseite Bedeutung + Ursprungssatz mit Lücke, Rückseite voll.
      return { ...base, sentence: card.context, accepted: [card.context?.gap ?? bareAnswer(card)] };
  }
}

/**
 * Urteil einer Auswahl. Falsch gewählt, aber die Option bedeutet dasselbe wie die Lösung
 * (z. B. „to persuade" für „überzeugen", wenn doch einmal ein Synonym unter den Optionen ist):
 * „fast richtig" mit ehrlicher Begründung statt „Noch nicht" (B5).
 */
export function choiceVerdict(e: Pick<Exercise, 'ex' | 'card' | 'meaning'>, chosen: Option): CheckResult {
  if (chosen.correct) return { verdict: 'correct' };
  if (e.ex === 'mc_de' || e.ex === 'mc_en' || e.ex === 'listen_mc' || e.ex === 'match') {
    const other = chosen.fromMeaning ?? (e.ex === 'mc_en' || e.ex === 'listen_mc' ? chosen.label : null);
    if (meaningsOverlap(other, e.meaning)) return { verdict: 'near', kind: 'synonym', ...(chosen.fromWord ? { otherWord: chosen.fromWord } : {}) };
  }
  return { verdict: 'wrong' };
}

// ------------------------------------------------------------------ Bausteine per Tastatur (Emrah 02.10.2026)

const tileKey = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'").replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');

/**
 * Welcher noch freie Baustein passt zu dem, was getippt wurde? Wörter: ganzes Wort (Groß-/Kleinschreibung und
 * Satzzeichen am Rand egal); Buchstaben: ein Zeichen. Gleiche Bausteine werden der Reihe nach vergeben.
 * `null`, wenn kein freier Baustein passt.
 */
export function pickTile(tiles: readonly Tile[], placed: readonly number[], token: string, mode: 'letters' | 'words'): number | null {
  const want = mode === 'letters' ? token.toLowerCase() : tileKey(token);
  if (!want) return null;
  const free = tiles.filter((t) => !placed.includes(t.id));
  const hit = free.find((t) => (mode === 'letters' ? t.text.toLowerCase() : tileKey(t.text)) === want);
  return hit ? hit.id : null;
}

/** Ist `token` (ganze Wörter) der Anfang eines noch freien Mehrwort-Bausteins, sodass weitergetippt werden darf? */
export function isTilePrefix(tiles: readonly Tile[], placed: readonly number[], token: string): boolean {
  const want = tileKey(token);
  if (!want) return false;
  return tiles.some((t) => !placed.includes(t.id) && tileKey(t.text).startsWith(`${want} `));
}
