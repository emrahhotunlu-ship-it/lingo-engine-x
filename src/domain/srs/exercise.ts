import { collocAlternatives } from './collocEquiv';
import { hash32, mulberry32, shuffle } from '../random';
import { typedForm } from '../chunks/situation';
import { acceptedWithAlternatives } from '../chunks/alternatives';
import { meaningForTask, shortMeaning } from './cards';
import { exerciseDef } from './modes';
import { familyFrom, partnerOf, trapTask } from './partner';
import { packExtraOf } from '../c1pack/packFields';
import { GAP_EX, gapContext, isTruncated, rotatedContext } from './rotate';
import { chunkGapWords } from './chunkCards';
import type { ActTask } from './actTask';
import { briefCodesOf, pickBrief } from './brief';
import { findContext, formsOf, locate } from './context';
import { gapUsable, lemmaFor } from './gapFit';
import { readCfx, readWx } from '../tutor/acceptWordCtx';
import { poolNorm } from '../drills/orderPool';
import { sayItIntent } from './sayIt';
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
export function meaningsOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = meaningParts(a);
  const pb = meaningParts(b);
  return pa.some((x) => pb.some((y) => x === y || (x.length >= 5 && y.includes(x)) || (y.length >= 5 && x.includes(y))));
}

/**
 * Bedeutungs-Zwillinge (Emrahs Meldung 25.10.2026, „Gesucht: …“): andere Karten derselben Art und Wortart, deren deutsche Hauptbedeutung genau
 * gleich ist („put off“ und „to postpone“: verschieben). Bei „Gesucht: verschieben“ passt dann beides; die Antwort mit dem Zwilling ist „fast
 * richtig“ (wie eine gleichwertige Variante), nicht falsch. Streng: nur die jeweils erste Bedeutung, genau gleich. Rein, sortiert, ohne Dubletten.
 */
export function meaningTwins(card: Pick<TrainCard, 'kind' | 'pos' | 'lemma' | 'de'>, pool: readonly Pick<TrainCard, 'kind' | 'pos' | 'lemma' | 'de' | 'hidden'>[]): string[] {
  const head = meaningParts(card.de)[0];
  if (!head) return [];
  const out = new Set<string>();
  for (const o of pool) {
    if (o.hidden || o.kind !== card.kind || (o.pos ?? '') !== (card.pos ?? '') || norm(o.lemma) === norm(card.lemma)) continue;
    if (meaningParts(o.de)[0] === head) out.add(o.lemma);
  }
  return [...out].sort();
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
const m = (c: TrainCard, lang: Lang) => meaningForTask(c, lang) ?? '';

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
  const target = meaningForTask(card, lang) ?? '';
  // Sprachtreue (Audit 12.10.2026): Fehlt der Karte die Bedeutung in der Oberflächensprache (Rückfall auf die andere), stehen ALLE Optionen in dieser
  // Sprache; sonst nur Karten, die die Bedeutung in der Oberflächensprache haben (nie „to push yourself …“ neben „blieb hinter den Erwartungen zurück“).
  const tongue = tongueOf(card, lang);
  const own = (c: TrainCard): string | null => (tongue === 'de' ? c.de : c.def);
  const cands: Scored[] = [];
  const targetLabel = shortMeaning(target, tongue);
  for (const c of pool) {
    const m = own(c);
    if (c.key === card.key || !m) continue;
    const label = shortMeaning(m, tongue);
    if (norm(label) === norm(targetLabel) || sharesWord(m, target) || norm(c.lemma) === norm(card.lemma) || tooClose(card, c)) continue;
    const score =
      (c.kind === card.kind ? 4 : 0) + (c.pos && c.pos === card.pos ? 3 : 0) + (Math.abs(label.length - targetLabel.length) <= 12 ? 2 : 0) + (c.stage === card.stage ? 1 : 0) + rng() * 0.5 - stemPenalty(card, c);
    cands.push({ card: c, label, score });
  }
  return pick(cands, 3).map((d, i) => ({ id: `d${i}`, label: d.label, lang: tongue, correct: false, fromWord: d.card.word, fromMeaning: own(d.card) ?? '' }));
}

/** Sprache der Bedeutungs-Optionen: die Oberflächensprache, bei fehlender Bedeutung die andere (gleichwertig, `meaningForTask`). */
export const tongueOf = (card: Pick<TrainCard, 'de' | 'def'>, lang: Lang): Lang => ((lang === 'de' ? card.de : card.def) ? lang : lang === 'de' ? 'en' : 'de');

/** Drei englische Wörter anderer Karten als Ablenker. */
function wordDistractors(card: TrainCard, pool: readonly TrainCard[], lang: Lang, rng: () => number, skip?: (c: TrainCard) => boolean): Option[] {
  const cands: Scored[] = [];
  const head = norm(card.lemma).slice(0, 5);
  const target = meaningForTask(card, lang) ?? '';
  for (const c of pool) {
    if (c.key === card.key || skip?.(c)) continue;
    if (norm(c.lemma) === norm(card.lemma) || norm(c.lemma).slice(0, 5) === head) continue;
    const cm = meaningForTask(c, lang);
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

export type TileMark = 'ok' | 'near' | 'off';

/** Vergleichseinheiten: Wörter (Bindestrich trennt, Groß/klein und Satzzeichen am Rand egal) bzw. Buchstaben. */
const unitsOf = (s: string, mode: 'letters' | 'words'): string[] =>
  mode === 'letters' ? Array.from(s.replace(/\s+/g, '').toLowerCase()) : s.split(/[\s-]+/).map((w) => tileKey(w)).filter(Boolean);

/** Längste gemeinsame Teilfolge: welche Stellen von `a` gehören dazu (gleiche Einheiten sind gleichwertig, z. B. zwei „a“). */
function lcsHits(a: readonly string[], b: readonly string[]): boolean[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const hit = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      hit[i] = true;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++;
    else j++;
  }
  return hit;
}

/**
 * Markierung je gelegtem Baustein nach dem Prüfen (Emrahs Meldung 21.10.2026: nicht mehr alles rot). Verglichen wird mit der nächstliegenden gültigen
 * Lösung (`targets`, längste gemeinsame Teilfolge); gleiche Bausteine (zwei „a“) sind gleichwertig und vertauschbar.
 * `ok` = steht in der richtigen Reihenfolge, `near` = Wort der Lösung an falscher Stelle, `off` = gehört nicht hinein (Ablenker, zu viel).
 */
export function tileMarks(tiles: readonly Tile[], placed: readonly number[], targets: readonly string[], mode: 'letters' | 'words'): Record<number, TileMark> {
  const byId = new Map(tiles.map((t) => [t.id, t.text]));
  const per = placed.map((id) => unitsOf(byId.get(id) ?? '', mode));
  const flat = per.flat();
  const owner = per.flatMap((u, k) => u.map(() => k));
  let best: { hit: boolean[]; units: string[]; score: number } | null = null;
  for (const t of targets) {
    const units = unitsOf(t, mode);
    if (!units.length) continue;
    const hit = lcsHits(flat, units);
    const n = hit.filter(Boolean).length;
    // Mehr Treffer gewinnt; bei Gleichstand die Lösung, deren Länge näher an der gelegten liegt (die erste Lösung bei völligem Gleichstand).
    const score = n * 1000 - Math.abs(units.length - flat.length);
    if (!best || score > best.score) best = { hit, units, score };
  }
  const out: Record<number, TileMark> = {};
  if (!best) {
    for (const id of placed) out[id] = 'off';
    return out;
  }
  const win = best;
  // Was von der Lösung noch nicht getroffen ist (Mehrfachmenge): ein Baustein daraus steht an falscher Stelle.
  const rest = new Map<string, number>();
  for (const u of win.units) rest.set(u, (rest.get(u) ?? 0) + 1);
  flat.forEach((u, i) => {
    if (win.hit[i]) rest.set(u, (rest.get(u) ?? 0) - 1);
  });
  placed.forEach((id, k) => {
    const idx = owner.flatMap((o, i) => (o === k ? [i] : []));
    if (idx.length && idx.every((i) => win.hit[i])) {
      out[id] = 'ok';
      return;
    }
    const misplaced = idx.some((i) => {
      const u = flat[i] as string;
      if (win.hit[i] || (rest.get(u) ?? 0) <= 0) return false;
      rest.set(u, (rest.get(u) ?? 0) - 1);
      return true;
    });
    out[id] = misplaced || idx.some((i) => win.hit[i]) ? 'near' : 'off';
  });
  return out;
}

/**
 * Anzeige nach dem Prüfen (UX-Prüfung WL2 S1): Wörter der nächstliegenden Lösung, die weder richtig noch an falscher Stelle liegen – sie fehlen in der Zeile.
 * Gleiche Auswahl der Lösung wie `tileMarks` (Bewertung unverändert). Nur für Wort-Bausteine; Buchstaben-Bausteine geben nichts zurück.
 */
export function tileMissing(tiles: readonly Tile[], placed: readonly number[], targets: readonly string[], mode: 'letters' | 'words'): string[] {
  if (mode !== 'words') return [];
  const byId = new Map(tiles.map((t) => [t.id, t.text]));
  const flat = placed.flatMap((id) => unitsOf(byId.get(id) ?? '', mode));
  let best: { hit: boolean[]; target: string; units: string[]; score: number } | null = null;
  for (const t of targets) {
    const units = unitsOf(t, mode);
    if (!units.length) continue;
    const hit = lcsHits(flat, units);
    const score = hit.filter(Boolean).length * 1000 - Math.abs(units.length - flat.length);
    if (!best || score > best.score) best = { hit, target: t, units, score };
  }
  if (!best) return [];
  const win = best;
  const rest = new Map<string, number>();
  for (const u of win.units) rest.set(u, (rest.get(u) ?? 0) + 1);
  // Getroffene und an falscher Stelle gelegte Wörter der Lösung sind da; der Rest fehlt.
  flat.forEach((u) => {
    if ((rest.get(u) ?? 0) > 0) rest.set(u, (rest.get(u) ?? 0) - 1);
  });
  const out: string[] = [];
  for (const w of win.target.split(/[\s-]+/)) {
    const u = tileKey(w);
    if (!u || (rest.get(u) ?? 0) <= 0) continue;
    rest.set(u, (rest.get(u) ?? 0) - 1);
    out.push(w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') || w);
  }
  return out;
}

/**
 * Gibt es eine gültige, kürzere Lösung, die sich aus den Bausteinen legen lässt (UX-Prüfung WL2 S2)? Dann darf die Zahl der Plätze nicht als
 * „genau so viele“ gelesen werden – die Ansicht sagt „bis zu …“.
 */
export function tileShorterAlt(tiles: readonly Tile[], targets: readonly string[], mode: 'letters' | 'words'): boolean {
  const full = tiles.filter((t) => !t.distractor).flatMap((t) => unitsOf(t.text, mode)).length;
  const pool = new Map<string, number>();
  for (const t of tiles) for (const u of unitsOf(t.text, mode)) pool.set(u, (pool.get(u) ?? 0) + 1);
  return targets.some((target) => {
    const units = unitsOf(target, mode);
    if (!units.length || units.length >= full) return false;
    const left = new Map(pool);
    return units.every((u) => {
      const n = left.get(u) ?? 0;
      left.set(u, n - 1);
      return n > 0;
    });
  });
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
    intent: meaningForTask(card, lang) ?? '',
    then: c?.utterance ?? '',
    upgraded: c?.upgraded ?? '',
  };
}

function pickColloc(card: TrainCard, rng: () => number): Colloc | null {
  return partnerOf(card, Math.floor(rng() * 1000));
}

/** Lösungen einer Wendungs-Abfrage: die Lösung, dazu gleichwertige Fassungen, wenn die Lücke die ganze Wendung ist (`content/chunkAlt.ts`). */
const chunkAccepted = (card: TrainCard, answer: string): string[] => (card.kind === 'chunk' ? acceptedWithAlternatives(card.word, answer) : [answer]);

/** Lösungsform einer freistehenden Abfrage (ohne Satz): Wort bzw. Wendung ohne „…“. */
const bareAnswer = (card: TrainCard): string => (card.kind === 'chunk' ? typedForm(card.word) : card.word);

/** Übungen, in denen die Bedeutung die Frage ist (Hinweis über der Lücke, Frage über den Optionen): sie darf die Antwort nicht enthalten. */
const CUE_EX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze', 'cloze_part', 'cloze_hint', 'wordfam', 'dictation', 'tiles', 'match', 'mc_de', 'type', 'colloc', 'colloc_gap']);

/**
 * Bedeutung als Hinweis ohne die Lösung (Audit 12.10.2026): Deutsche Bedeutungen enthalten oft das englische Wort selbst („feiner Unterschied,
 * Nuance“, „Anleger, Pier“): dieser Teil entfällt, solange noch ein anderer bleibt. Englische Definitionen, die das Wort enthalten („turn a
 * device on or off with a switch“), zeigen an seiner Stelle „…“. Die Karte selbst bleibt unverändert.
 */
export function cueMeaning(card: Pick<TrainCard, 'lemma' | 'word' | 'def'>, meaning: string | null): string | null {
  if (!meaning) return meaning;
  const lem = norm(card.lemma);
  const wordN = norm(card.word.replace(/^to\s+/i, ''));
  let out = meaning;
  const parts = meaning.split(/\s*([,;])\s*/);
  const texts = parts.filter((_, i) => i % 2 === 0);
  const same = (p: string) => {
    const n = norm(p.replace(/\(.*?\)/g, ' ').replace(/^to\s+/i, ''));
    return n === lem || n === wordN;
  };
  if (texts.length > 1 && texts.some(same) && !texts.every(same)) {
    let acc = '';
    texts.forEach((p, i) => {
      if (!same(p)) acc += acc ? `${parts[2 * i - 1] ?? ','} ${p}` : p;
    });
    out = acc;
  }
  // Englische Definition (nicht die deutsche Bedeutung): das Wort selbst wird zu „…“.
  if (card.def && meaning === card.def) {
    const core = lem.split(/\s+/).filter(Boolean);
    if (core.length === 1 && core[0] && core[0].length >= 4 && /^[a-z'-]+$/.test(core[0])) {
      const forms = formsOf(core[0]).map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      out = out.replace(new RegExp(`(^|[^A-Za-z'])(?:${forms.join('|')})(?![A-Za-z'])`, 'gi'), '$1…');
    } else if (core.length > 1) {
      const hit = locate(out, core.join(' '));
      if (hit) out = `${out.slice(0, hit.start)}…${out.slice(hit.end)}`;
    }
  }
  return out;
}

/** Kennung der Vorlage, aus der `wx`/`cfx` stammen (P52). */
export const WORD_CTX_TPL = 'word-ctx@1';

/**
 * Text-Schlüssel der Übungsart für Aufgabe und Bezeichnung (Rückmeldung 1, 10.10.2026): „Satz vervollständigen“ ohne Satzanfang
 * ist in Wahrheit „eigener Satz“ – dann heißt sie auch so (`produce`). Die Aufgabe baut diese Fälle nicht mehr (`supports`), alte Daten und
 * Tests bleiben lesbar.
 */
export const exTextKey = (e: Pick<Exercise, 'ex' | 'start'> & { sentence?: Exercise['sentence'] }): string =>
  e.ex === 'cloze_part' ? 'cloze' : e.ex === 'complete' && !e.start?.trim() ? 'produce' : e.ex === 'match' && e.sentence === null ? 'mc_de' : e.ex; // „Zuordnen“ ohne Satz hat keine Lücke: Aufgabe wie „Wort wählen“ (Audit 12.10.2026)

/**
 * `origin`: immer der Ursprungssatz (Prüfabfrage und Einführung), sonst wechselt der Satz ab der ersten Wiederholung an einem anderen Tag (`rotate.ts`, Tag 1
 * bleibt der Ursprungssatz der Anker). Zeigt die Übung einen Satz von Claude, trägt sie `ai` (Kennzeichnung und „Melden“, P52).
 */
export function buildExercise(card: TrainCard, ex: ExerciseId, lang: Lang, pool: readonly TrainCard[], seed: string, opts: { sceneOf?: SceneLookup; origin?: boolean; act?: ActTask } = {}): Exercise {
  const e = buildRaw(card, ex, lang, pool, seed, opts);
  if (e.ai || !e.sentence) return e;
  const k = poolNorm(e.sentence.sentence);
  const wx = readWx(card.doc).find((x) => poolNorm(x.en) === k);
  return wx ? { ...e, ai: { tpl: WORD_CTX_TPL, kind: 'wx', en: wx.en } } : e;
}

/**
 * „Welches Wort passt?“ (P52): der Kontrast-Satz von Claude enthält das verwechselte Wort; die Lücke steht dort, die Optionen sind dieses Wort
 * (richtig) und das Kartenwort. `null` ohne brauchbaren Kontrast-Satz.
 */
export function contrastOf(card: TrainCard): { cfx: ReturnType<typeof readCfx>[number]; span: NonNullable<Exercise['sentence']> } | null {
  for (const c of readCfx(card.doc)) {
    const span = findContext(c.en, c.w);
    if (span && !findContext(c.en, card.word)) return { cfx: c, span };
  }
  return null;
}

function buildRaw(card: TrainCard, ex: ExerciseId, lang: Lang, pool: readonly TrainCard[], seed: string, opts: { sceneOf?: SceneLookup; origin?: boolean; act?: ActTask }): Exercise {
  const def = exerciseDef(ex);
  const rng = mulberry32(hash32(`${card.key}|${ex}|${seed}`));
  const meaning = meaningForTask(card, lang);
  const stage = Math.max(1, card.stage) as Stage;
  // Fragt die Übung nach dem Wort, steht die Bedeutung als Frage da und darf die Antwort nicht enthalten (`cueMeaning`); als richtige Option bleibt sie vollständig.
  const base: Exercise = { ex, input: def.input, card, stage, sentence: null, meaning: CUE_EX.has(ex) ? cueMeaning(card, meaning) : meaning, firstLetter: null, colloc: null, options: [], accepted: [] };
  // Eine Lücke, die mehr verdeckt als das Wort der Karte (beliebiges Objekt) oder das Wort ein zweites Mal zeigt, ist keine Lücke (`gapFit.ts`).
  const day = /^(\d{4}-\d{2}-\d{2})\|/.exec(seed)?.[1];
  // Lückenaufgaben (Emrahs Meldung 25.10.2026): nur EIN vollständiger, kurzer Satz; der Ursprungssatz bleibt Anker, wenn er das ist (`gapContext`).
  const rawCtx = GAP_EX.has(ex) ? gapContext(card, day, !!opts.origin) : opts.origin ? card.context : rotatedContext(card, ex, day);
  // Wendungen (WL): Bis Stufe 2 ist nur EIN Wort der Wendung die Lücke (Stütze, Bausteine); `cloze_part` (Stufe 3) ist ein freies Einzelwort. Das wechselnde Wort ergibt sich aus der
  // Zahl der bisherigen Wiederholungen; Stufe 3 zeigt sonst die ganze Wendung mit Stütze (Anfangsbuchstabe je Wort, Bausteine); `cloze` ist immer die ganze Wendung (Tor: Stufe 3 erst
  // nach einem `cloze_part`-Tag, `modes.ts`). Findet sich kein einzelnes Wort, gibt es nie still eine ganze Wendung ohne Satz (Kap. 15): `cloze_part` wird zur Stütz-Lücke (`cloze_hint`).
  const wordGap = card.kind === 'chunk' && !!rawCtx && (ex === 'cloze_part' || ((ex === 'cloze_hint' || ex === 'tiles') && stage <= 2));
  const single = wordGap && rawCtx ? chunkWordGap(card, rawCtx, knownHeadwords(pool)) : null;
  const singleOk = !!single && gapUsable(single, lemmaFor(card));
  if (ex === 'cloze_part' && !singleOk) return buildRaw(card, 'cloze_hint', lang, pool, seed, opts);
  const ctx = singleOk ? single : rawCtx && gapUsable(rawCtx, lemmaFor(card)) ? rawCtx : null;

  switch (ex) {
    case 'listen_mc':
    case 'mc_en': {
      const label = shortMeaning(meaning ?? '', tongueOf(card, lang));
      const correct: Option = { id: 'ok', label, lang: tongueOf(card, lang), correct: true };
      const options = shuffle([correct, ...meaningDistractors(card, pool, lang, rng)], rng);
      if (ex === 'listen_mc') return { ...base, sentence: rawCtx, options, accepted: [label], speak: rawCtx?.sentence ?? bareAnswer(card) };
      return { ...base, sentence: rawCtx, options, accepted: [label] };
    }
    case 'fits': {
      // Satz mit hervorgehobenem Wort; Ja = das Kartenwort steht in seinem Satz, Nein = es steht im Satz einer anderen Karte (Wortart und Beugung passen, die Bedeutung nicht).
      const here = rawCtx ?? card.context;
      const foil = rng() < 0.5 ? fitsFoil(card, pool, lang, rng) : null;
      const truth = !foil;
      const span = foil ? foil.span : here;
      const yes: Option = { id: 'yes', label: 'yes', lang: 'de', correct: truth };
      const no: Option = { id: 'no', label: 'no', lang: 'de', correct: !truth };
      return { ...base, sentence: span, options: [yes, no], accepted: [truth ? 'yes' : 'no'], fits: { truth, foil: foil ? { word: foil.other.word, meaning: m(foil.other, lang) || null } : null } };
    }
    case 'spot': {
      const gap = card.context?.gap ?? card.word;
      return { ...base, sentence: card.context, accepted: [gap] };
    }
    case 'match': {
      // P52: ab Stufe 2 darf der Satz ein Claude-Satz des Wörter-Tutors sein (`rotate.ts`), sonst der Ursprungssatz.
      const answer = ctx?.gap ?? bareAnswer(card);
      const correct: Option = { id: 'ok', label: answer, lang: 'en', correct: true };
      // Ein Ablenker, dessen Wort schon im Satz steht („decline“ ← „customer complaints“), ist keine Wahl (Audit 12.10.2026).
      const inSentence = ctx ? (c: TrainCard): boolean => locate(ctx.sentence, typedForm(c.lemma || c.word)) !== null : undefined;
      const ds = wordDistractors(card, pool, lang, rng, inSentence).map((d) => ({ ...d, label: ctx ? inflectLike(answer, card.lemma, d.label) : d.label }))
        .filter((d) => norm(d.label) !== norm(answer));
      return { ...base, sentence: ctx, options: shuffle([correct, ...ds], rng), accepted: [answer] };
    }
    case 'contrast': {
      const c = contrastOf(card);
      if (!c) return buildRaw(card, 'match', lang, pool, seed, opts);
      const answer = c.span.gap;
      const other = pool.find((p) => norm(p.word) === norm(c.cfx.w) || norm(p.lemma) === norm(c.cfx.w));
      const wrong: Option = { id: 'd0', label: inflectLike(answer, c.cfx.w, card.word), lang: 'en', correct: false, fromWord: card.word, ...(meaning ? { fromMeaning: meaning } : {}) };
      const otherMeaning = other ? meaningForTask(other, lang) : null;
      const right: Option = { id: 'ok', label: answer, lang: 'en', correct: true, fromWord: other?.word ?? c.cfx.w, ...(otherMeaning ? { fromMeaning: otherMeaning } : {}) };
      return {
        ...base,
        meaning: null,
        sentence: c.span,
        options: shuffle([right, wrong], rng),
        accepted: [answer],
        ai: { tpl: WORD_CTX_TPL, kind: 'cfx', en: c.cfx.en },
        contrastWhy: c.cfx.why,
      };
    }
    case 'tiles': {
      const answer = ctx?.gap ?? (card.kind === 'chunk' ? typedForm(card.word) : card.lemma);
      const others = pool.filter((c) => c.key !== card.key).map((c) => c.lemma);
      const { tiles } = buildTiles(answer, others, rng);
      // Gleichwertige Fassungen der ganzen Wendung gelten auch (Emrah 21.10.2026: „a quarter percentage point“), soweit die Bausteine sie hergeben.
      return { ...base, sentence: ctx, tiles, accepted: chunkAccepted(card, answer) };
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
      // Wörter aktivieren: Lage, Satzform, Ton und Zeitform wechseln von Mal zu Mal (deterministisch aus Karte, Seed und Verlauf).
      return { ...base, accepted: [], brief: pickBrief(card.key, seed, briefCodesOf(card.doc), card) };
    case 'act_scene':
    case 'act_rewrite':
    case 'act_impulse':
    case 'act_combo':
    case 'act_mail':
      // Wörter aktivieren, Stufe 2: die Aufgabe kommt fertig vom Fahrplan (`actTask.ts`); ohne sie meldet der Wächter R14 und es folgt eine andere Art.
      return { ...base, accepted: [], ...(opts.act ? { act: opts.act } : {}) };
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
      // Gleichwertige Partner (hold/have a meeting, meet/hit a deadline) gelten als richtig und erscheinen nie als falscher Ablenker (Auswertung 15.10.2026).
      const alts = c ? collocAlternatives(c.p, answer, c.ctx ? { sentence: c.ctx.sentence, start: c.ctx.start } : undefined) : [];
      const opts = (c?.opts ?? []).filter((o) => norm(o) !== norm(answer) && !alts.includes(norm(o))).slice(0, 3);
      const options: Option[] = [{ id: 'ok', label: answer, lang: 'en', correct: true }, ...opts.map((o, i) => ({ id: `d${i}`, label: o, lang: 'en' as const, correct: false }))];
      return { ...base, sentence: c?.ctx ?? null, colloc: c, options: shuffle(options, rng), accepted: [answer, ...alts] };
    }
    case 'ctx_mc': {
      // „Was heißt das hier?“: Satz mit markiertem Wort, drei deutsche Optionen (die richtige und zwei andere).
      const label = shortMeaning(meaning ?? '', tongueOf(card, lang));
      const correct: Option = { id: 'ok', label, lang: tongueOf(card, lang), correct: true };
      return { ...base, sentence: rawCtx, options: shuffle([correct, ...meaningDistractors(card, pool, lang, rng).slice(0, 2)], rng), accepted: [label] };
    }
    case 'say_it': {
      // Deutsche Absicht: die gespeicherte Übersetzung eines Satzes der Karte (`sayItIntent`, zuerst der Satz der Übung). Der englische Satz ist das Beispiel.
      // Ohne Übersetzung bietet `supports` die Übung nicht an; der leere Fall bleibt nur als Absicherung (die Oberfläche zeigt dann keine Absicht).
      const intent = sayItIntent(card, rawCtx);
      const target = card.kind === 'chunk' ? typedForm(card.word) : card.word;
      return { ...base, sentence: null, accepted: [target], sayIt: { de: intent?.de ?? '', model: intent?.model ?? null } };
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
    case 'cloze_part':
    case 'cloze': {
      const gap = ctx?.gap ?? card.word;
      return { ...base, sentence: ctx, firstLetter: ex === 'cloze_hint' ? gap.slice(0, 1) : null, accepted: chunkAccepted(card, gap) };
    }
    case 'type': {
      const accepted = chunkAccepted(card, bareAnswer(card));
      if (card.lemma !== card.word) accepted.push(card.lemma);
      return { ...base, accepted };
    }
    case 'flip':
      // Anki (anki-regeln §1): Vorderseite Bedeutung + Ursprungssatz mit Lücke, Rückseite voll.
      return { ...base, sentence: rawCtx, accepted: [rawCtx?.gap ?? bareAnswer(card)] };
  }
}

/**
 * Hinweis unter einer Lückenaufgabe (Rückmeldung 11.10.2026): Er beschreibt immer das, was in der Lücke steht. Bei Wortpartner-Lücken
 * ist das nicht das Kartenwort („deserve“), sondern der Partner („break“) – dann gilt die Bedeutung der ganzen Wendung (`Colloc.de`,
 * nur Deutsch), und fehlt sie, gibt es keinen Hinweis. Sonst (Lücke = Kartenwort) die Bedeutung der Karte.
 */
export function gapCue(e: Pick<Exercise, 'ex' | 'meaning' | 'colloc'>, lang: Lang): { kind: 'word' | 'phrase'; text: string } | null {
  if (e.ex === 'colloc' || e.ex === 'colloc_gap') {
    // Paket-Lücke (`index` −1): Die Verbindung IST die Wendung der Karte, die Lücke liegt darin – ihre Bedeutung ist die der Karte
    // („address ___ concerns“ ← „Bedenken ansprechen“; ohne sie waren solve/address/fix gleich gut, Audit 12.10.2026).
    if (e.colloc && e.colloc.index < 0) return e.meaning ? { kind: 'phrase', text: e.meaning } : null;
    const de = e.colloc ? e.colloc.de.trim() : '';
    return lang === 'de' && de ? { kind: 'phrase', text: de } : null;
  }
  return e.meaning ? { kind: 'word', text: e.meaning } : null;
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

/** Stichwörter der schon gelernten Wörter (Karten, die nicht neu sind): Ein bekanntes Kernwort einer Wendung wird nicht als Erstes abgefragt. */
function knownHeadwords(pool: readonly TrainCard[]): Set<string> {
  const out = new Set<string>();
  for (const c of pool) if (c.kind === 'vocab' && !c.isNew) for (const w of [c.lemma, c.word]) out.add(norm(w).replace(/^to /, ''));
  return out;
}

/**
 * Das wechselnde Wort der Wendung als Lücke: reihum durch die Lückenwörter, nach der Zahl der bisherigen Wiederholungen (`reps`, wächst auch, wenn `hist` bei 12 gedeckelt ist).
 * Reihenfolge nach Paketangaben (`gap.at` zuerst, `phrasal`: abhängige Präposition, `frame`: Schlüsselwörter, `chunkGapWords`). Wörter, die schon eine bekannte Wortkarte sind, kommen
 * nur dran, wenn es kein anderes gibt (bei bekanntem Kernwort fragt die App zuerst das Rahmenwort bzw. den Partner).
 */
export function chunkWordGap(card: Pick<TrainCard, 'word' | 'doc'>, ctx: NonNullable<TrainCard['context']>, known: ReadonlySet<string> = new Set()): NonNullable<TrainCard['context']> | null {
  const extra = packExtraOf(card);
  const cands = chunkGapWords(ctx.sentence, card.word, { cat: extra?.cat, at: extra?.gap?.at });
  if (!cands.length) return null;
  const unknown = cands.filter((x) => !known.has(norm(x.w)));
  const list = unknown.length ? unknown : cands;
  const fsrs = card.doc.fsrs as { reps?: unknown } | undefined;
  const reps = Math.max(typeof card.doc.reps === 'number' ? card.doc.reps : 0, typeof fsrs?.reps === 'number' ? fsrs.reps : 0, 0);
  const w = list[reps % list.length] as (typeof list)[number];
  return { sentence: ctx.sentence, start: w.start, end: w.end, gap: ctx.sentence.slice(w.start, w.end) };
}

// ------------------------------------------------------------------ „Passt das Wort in diesen Satz?“ (fits, WL 19.10.2026)

/** Texte der Karte, in denen ein Nachbarwort-Paar belegt sein kann (wie der Wächter R5). */
function attestedTexts(card: TrainCard): string[] {
  const d = card.doc;
  const xs = Array.isArray(d.xEx) ? (d.xEx as { en?: unknown }[]).map((x) => x.en) : [];
  const cs = Array.isArray(d.col) ? (d.col as { ex?: unknown }[]).map((x) => x.ex) : [];
  return [d.ex, ...xs, ...cs, card.context?.sentence].filter((x): x is string => typeof x === 'string').map((x) => ` ${norm(x.replace(/[[\]]/g, '')).replace(/[^a-zäöüß0-9' ]+/g, ' ').replace(/\s+/g, ' ')} `);
}

/**
 * Ein Satz einer anderen Karte, in den das Kartenwort NICHT passt: gleiche Wortart, ähnliche Beugung, keine Synonyme, und das Kartenwort bildet mit den
 * Nachbarwörtern kein belegtes Paar (sonst könnte es doch passen). `null`, wenn es keinen sicheren Satz gibt – dann fragt die App nur „passt“.
 */
function fitsFoil(card: TrainCard, pool: readonly TrainCard[], lang: Lang, rng: () => number): { span: NonNullable<Exercise['sentence']>; other: TrainCard } | null {
  if (!card.pos) return null;
  const head = norm(card.lemma).slice(0, 5);
  const target = meaningForTask(card, lang) ?? '';
  const texts = attestedTexts(card);
  const cands = shuffle(
    pool.filter((c) => c.key !== card.key && c.kind === 'vocab' && c.pos === card.pos && c.context && !isTruncated(c.context.sentence) && !/\s/.test(c.context.gap)),
    rng,
  );
  for (const c of cands) {
    const ctx = c.context as NonNullable<TrainCard['context']>;
    if (norm(c.lemma).slice(0, 5) === head || norm(c.lemma) === norm(card.lemma) || tooClose(card, c)) continue;
    const cm = meaningForTask(c, lang);
    if (cm && target && sharesWord(cm, target)) continue;
    if (!gapUsable(ctx, lemmaFor(c))) continue;
    // Beugung: nur regelmäßige Formen (-ed, -ing, -s) oder die Grundform lassen sich sauber übertragen, sonst verriete die Endung das „Nein“.
    const sol = ctx.gap.toLowerCase();
    const lem = c.lemma.toLowerCase().replace(/^to\s+/, '');
    const regular = sol === lem || /(ing|ed)$/.test(sol) || (/s$/.test(sol) && !/ss$/.test(sol));
    if (!regular) continue;
    const word = inflectLike(ctx.gap, c.lemma, card.lemma);
    if (!word || norm(word) === norm(ctx.gap)) continue;
    const sentence = `${ctx.sentence.slice(0, ctx.start)}${word}${ctx.sentence.slice(ctx.end)}`;
    const prev = norm(ctx.sentence.slice(0, ctx.start)).split(/[^a-zäöüß0-9']+/).filter(Boolean).at(-1);
    const next = norm(ctx.sentence.slice(ctx.end)).split(/[^a-zäöüß0-9']+/).filter(Boolean)[0];
    const w = norm(word);
    if ((prev && texts.some((t) => t.includes(` ${prev} ${w} `))) || (next && texts.some((t) => t.includes(` ${w} ${next} `)))) continue;
    return { span: { sentence, start: ctx.start, end: ctx.start + word.length, gap: word }, other: c };
  }
  return null;
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
