import { hash32, mulberry32, shuffle } from '../random';
import { meaningOf, shortMeaning } from './cards';
import { exerciseDef } from './modes';
import type { CheckResult, Colloc, Exercise, ExerciseId, Lang, Option, Stage, TrainCard } from './types';

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
      (c.pos && c.pos === card.pos ? 3 : 0) + (Math.abs(label.length - targetLabel.length) <= 12 ? 2 : 0) + (c.stage === card.stage ? 1 : 0) + rng() * 0.5 - stemPenalty(card, c);
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
    const score = (c.pos && c.pos === card.pos ? 3 : 0) + (Math.abs(c.word.length - card.word.length) <= 3 ? 2 : 0) + (c.stage === card.stage ? 1 : 0) + rng() * 0.5 - stemPenalty(card, c);
    cands.push({ card: c, label: c.word, score });
  }
  return pick(cands, 3).map((d, i) => ({ id: `d${i}`, label: d.label, lang: 'en', correct: false, fromWord: d.card.word, fromMeaning: m(d.card, lang) }));
}

function pickColloc(card: TrainCard, rng: () => number): Colloc | null {
  const usable = card.col.filter((c) => c.ctx && c.opts.length >= 2);
  if (!usable.length) return null;
  return usable[Math.floor(rng() * usable.length)] ?? usable[0] ?? null;
}

export function buildExercise(card: TrainCard, ex: ExerciseId, lang: Lang, pool: readonly TrainCard[], seed: string): Exercise {
  const def = exerciseDef(ex);
  const rng = mulberry32(hash32(`${card.key}|${ex}|${seed}`));
  const meaning = meaningOf(card, lang);
  const stage = Math.max(1, card.stage) as Stage;
  const base: Exercise = { ex, input: def.input, card, stage, sentence: null, meaning, firstLetter: null, colloc: null, options: [], accepted: [] };

  switch (ex) {
    case 'mc_en': {
      const label = shortMeaning(meaning ?? '', lang);
      const correct: Option = { id: 'ok', label, lang, correct: true };
      return { ...base, sentence: card.context, options: shuffle([correct, ...meaningDistractors(card, pool, lang, rng)], rng), accepted: [label] };
    }
    case 'mc_de': {
      const correct: Option = { id: 'ok', label: card.word, lang: 'en', correct: true };
      return { ...base, options: shuffle([correct, ...wordDistractors(card, pool, lang, rng)], rng), accepted: [card.word] };
    }
    case 'colloc': {
      const c = pickColloc(card, rng);
      const answer = c?.ctx?.gap ?? c?.gap ?? '';
      const opts = (c?.opts ?? []).filter((o) => norm(o) !== norm(answer)).slice(0, 3);
      const options: Option[] = [{ id: 'ok', label: answer, lang: 'en', correct: true }, ...opts.map((o, i) => ({ id: `d${i}`, label: o, lang: 'en' as const, correct: false }))];
      return { ...base, sentence: c?.ctx ?? null, colloc: c, options: shuffle(options, rng), accepted: [answer] };
    }
    case 'cloze_hint':
    case 'cloze': {
      const gap = card.context?.gap ?? card.word;
      return { ...base, sentence: card.context, firstLetter: ex === 'cloze_hint' ? gap.slice(0, 1) : null, accepted: [gap] };
    }
    case 'type': {
      const accepted = [card.word];
      if (card.lemma !== card.word) accepted.push(card.lemma);
      return { ...base, accepted };
    }
  }
}

/**
 * Urteil einer Auswahl. Falsch gewählt, aber die Option bedeutet dasselbe wie die Lösung
 * (z. B. „to persuade" für „überzeugen", wenn doch einmal ein Synonym unter den Optionen ist):
 * „fast richtig" mit ehrlicher Begründung statt „Noch nicht" (B5).
 */
export function choiceVerdict(e: Pick<Exercise, 'ex' | 'card' | 'meaning'>, chosen: Option): CheckResult {
  if (chosen.correct) return { verdict: 'correct' };
  if (e.ex === 'mc_de' || e.ex === 'mc_en') {
    const other = chosen.fromMeaning ?? (e.ex === 'mc_en' ? chosen.label : null);
    if (meaningsOverlap(other, e.meaning)) return { verdict: 'near', kind: 'synonym', ...(chosen.fromWord ? { otherWord: chosen.fromWord } : {}) };
  }
  return { verdict: 'wrong' };
}
