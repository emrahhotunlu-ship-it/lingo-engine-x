import bankJson from '../../content/grammar-bank.json';
import extraJson from '../../content/grammar-extra.json';
import { TOPICS, topicById } from '../content';
import { splitWords } from '../answer/align';
import type { GrammarTask, GrammarTaskType, TaskSrc } from '../learn/types';
import { patsOf } from '../metrics/pattern';
import { hash32, mulberry32, shuffle } from '../random';
import { lemmaOf } from '../srs/context';
import { topicP } from './bkt';
import { dueErrors } from './errors';
import { isNewTopic, nextNewTopic } from './path';
import { legacyTaskKey } from './key';
import { familyOf, mapEntryOf, patternOf, patternsOf, v2Tasks } from './patterns';
import type { V2Task } from './patternTypes';
import { errorSpan } from './span';
import { asText } from '../text/str';
import { asList, asRecord, grammarJson, rulesJson, toolkitJson } from './raw';

// Aufgaben: Normalisierung (Port von `validG`, grammar.js:51) und Auswahl einer Runde
// (phase2-plan §5.2). Rein: Zeit und Startwert kommen als Parameter.

type Doc = Record<string, unknown>;

/** Eingabeprofil der Runde (gleiche Werte wie `platform/input`; die Domäne importiert es bewusst nicht, es ist nie planwirksam). */
export type InputProfile = 'touch' | 'keys';

const TYPES: readonly GrammarTaskType[] = ['mc', 'gap', 'transform', 'correct'];
const GAP_RE = /_{3,}/;

/** Teilt „Satz A → Satz B mit ___" in Ausgang und Ziel (ohne Pfeil: alles ist Ziel). */
export function splitTransform(prompt: string): { from: string; target: string } {
  const [a, b] = prompt.split('→');
  return b === undefined ? { from: '', target: prompt } : { from: (a ?? '').trim(), target: b.trim() };
}

/**
 * Wird die Aufgabe als ganzer Satz eingegeben? `correct` immer; `gap`/`transform` dann, wenn der
 * Zielsatz keine Lücke `___` hat (z. B. „Rewrite …: I'm sure he didn't …" → ganzer Satz).
 */
export function wholeSentence(t: Pick<GrammarTask, 'type' | 'prompt'>): boolean {
  if (t.type === 'correct') return true;
  if (t.type === 'mc' || t.type === 'meaning' || t.type === 'find' || t.type === 'kwt') return false;
  return !GAP_RE.test(t.type === 'transform' ? splitTransform(t.prompt).target : t.prompt);
}
const s = asText;
const strOrNull = (v: unknown): string | null => {
  const t = s(v).trim();
  return t ? t : null;
};

/**
 * Rohaufgabe (Seed, `daily/*`, Pool, Lektion, KI) → Aufgabe oder `null` (wie `validG`):
 * Thema bekannt, Typ gültig, Prompt und Lösung da; `mc` mit ≥ 2 Optionen und der Lösung darunter.
 */
export function normalizeTask(raw: unknown, src: TaskSrc, ref: string | null = null): GrammarTask | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const it = raw as Doc;
  const topic = s(it.topic);
  if (!topicById(topic)) return null;
  let type = TYPES.includes(it.type as GrammarTaskType) ? (it.type as GrammarTaskType) : null;
  const prompt = s(it.prompt).trim();
  const answer = s(it.answer).trim();
  if (!type || !prompt || !answer) return null;
  // Mehr als eine Lücke lässt sich mit einem Eingabefeld nicht lösen (Emrah 05.10.2026: „komme nicht an die zweite Lücke“): nie stellen.
  if ((type === 'gap' || type === 'mc') && (prompt.match(/_{3,}/g)?.length ?? 0) > 1) return null;
  if (type === 'transform' && (prompt.split('→').slice(1).join('→').match(/_{3,}/g)?.length ?? 0) > 1) return null;
  // Eine Lücke ohne `___` (Lektionen der alten App) wird als Umformung mit Ganzsatz-Eingabe gestellt.
  if (type === 'gap' && !GAP_RE.test(prompt)) type = 'transform';
  let options: string[] | null = null;
  if (type === 'mc') {
    options = Array.isArray(it.options) ? it.options.map(s).filter(Boolean) : [];
    if (options.length < 2 || !options.some((o) => o.trim() === answer)) return null;
  }
  const accepted = Array.isArray(it.accepted) ? it.accepted.map(s).map((x) => x.trim()).filter(Boolean) : [];
  const key = legacyTaskKey(prompt);
  const entry = mapEntryOf(topic, key);
  // Muster: aus der Zuordnungstabelle, sonst (Pool, Tagesauftrag) über die Signalwörter, nur bei eindeutigem Treffer (§3.3).
  const pat = entry?.pat ?? strOrNull(it.pat) ?? patternOf({ topic, prompt, answer })?.id ?? null;
  return {
    key,
    topic,
    type,
    prompt,
    answer,
    accepted,
    options,
    hint: strOrNull(it.hint_de) ?? strOrNull(it.hint),
    expl: { de: strOrNull(it.explanation_de) ?? strOrNull(it.expl), en: strOrNull(it.explanation_en) ?? strOrNull(it.expl_en) },
    src,
    ref: ref ?? strOrNull(it.ref),
    errorT: null,
    ...(pat ? { pat } : {}),
    ...(entry?.why ? { why: entry.why } : {}),
  };
}

/** Neue Aufgabe (`tasks-v2.json`) als Aufgabe der Runde. `prompt` trägt den Rahmensatz (kwt), den Satz (find) bzw. Satz a (meaning). */
export function fromV2(t: V2Task): GrammarTask | null {
  const base = { topic: t.topic, accepted: [] as string[], options: null, hint: null, expl: { de: t.why.ok.de, en: t.why.ok.en }, src: 'seed' as const, ref: 'content/grammar/tasks-v2', errorT: null, pat: t.pat, why: t.why };
  if (!topicById(t.topic)) return null;
  if (t.type === 'kwt') return { ...base, key: legacyTaskKey(t.frame), type: 'kwt', prompt: t.frame, answer: t.answer, accepted: [...t.accepted], x: { kind: 'kwt', from: t.from, key: t.key, words: [t.words[0], t.words[1]] } };
  if (t.type === 'find') return { ...base, key: legacyTaskKey(t.prompt), type: 'find', prompt: t.prompt, answer: t.answer ?? '', accepted: [...t.accepted], x: { kind: 'find', err: t.err ? [t.err[0], t.err[1]] : null, fixed: t.fixed ?? null } };
  return { ...base, key: legacyTaskKey(t.a), type: 'meaning', prompt: t.a, answer: t.answer, x: { kind: 'meaning', a: t.a, b: t.b, q: { de: t.q.de, en: t.q.en } } };
}

/** Aufgabe in der Speicherform der alten App (Pool-Eintrag, `validG`-Felder). */
export function toPoolItem(t: GrammarTask): Doc {
  const out: Doc = {
    topic: t.topic,
    type: t.type,
    prompt: t.prompt,
    options: t.options,
    answer: t.answer,
    accepted: t.accepted,
    hint_de: t.hint ?? '',
    explanation_de: t.expl.de ?? '',
    explanation_en: t.expl.en ?? '',
    src: t.src,
  };
  if (t.ref) out.ref = t.ref;
  if (t.pat) out.pat = t.pat;
  return out;
}

type RuleTrap = { bad?: unknown; good?: unknown; why?: unknown };
/** Fallen des Regelwerks je Thema (geparst beim ersten Gebrauch, `raw.ts`). */
function ruleTraps(): Record<string, { traps?: RuleTrap[] }> {
  return {
    ...(asRecord(toolkitJson().rules) as Record<string, { traps?: RuleTrap[] }>),
    ...(asRecord(rulesJson().rules) as Record<string, { traps?: RuleTrap[] }>),
  };
}

let seedCache: GrammarTask[] | null = null;
/**
 * Startaufgaben ohne KI: die 48 Aufgaben der alten App plus je Falle aus dem Regelwerk eine
 * Satzkorrektur (`bad` → `good`), wenige ergänzte Aufgaben (content/grammar-extra.json), die Grammatik-Bank (content/grammar-bank.json) und die
 * Aufgaben des C1-Werkzeugkastens (content/c1/toolkit.json). So hat
 * jedes Thema mindestens vier Aufgaben (Grundfassung, D11).
 */
export function seedTasks(): readonly GrammarTask[] {
  if (seedCache) return seedCache;
  const out: GrammarTask[] = [];
  const keys = new Set<string>();
  const push = (t: GrammarTask | null) => {
    if (t && !keys.has(t.key)) {
      keys.add(t.key);
      out.push(t);
    }
  };
  for (const g of asList(grammarJson().seedGrammar)) push(normalizeTask(g, 'seed'));
  for (const g of extraJson.tasks as unknown[]) push(normalizeTask(g, 'seed', 'content/grammar-extra'));
  // Grammatik-Bank (Ernte 03.10.2026, Umbau „Fokus“): 15 Aufgaben je Kernthema, Optionen fest gemischt.
  for (const g of bankJson.tasks as unknown[]) push(normalizeTask(g, 'seed', 'content/grammar-bank'));
  // C1-Werkzeugkasten (Lernberatung 27.09., Vorschlag 7): je Thema mindestens 12 Startaufgaben.
  for (const g of asList(toolkitJson().tasks)) push(normalizeTask(g, 'seed', 'content/c1'));
  const RULES = ruleTraps();
  for (const tp of TOPICS) {
    for (const trap of RULES[tp.id]?.traps ?? []) {
      const why = Array.isArray(trap.why) ? trap.why.map(s) : [];
      push(normalizeTask({ topic: tp.id, type: 'correct', prompt: s(trap.bad), answer: s(trap.good), expl: why[0], expl_en: why[1] }, 'seed', `rules/${tp.id}`));
    }
  }
  seedCache = out;
  return out;
}

let allCache: GrammarTask[] | null = null;
/** Startaufgaben plus die neuen Aufgabenarten (Schlüsselwort, Fehler finden, Bedeutungspaar; Lernplattform 2.0 §3.4). Die Quelle jeder Runde. */
export function allSeedTasks(): readonly GrammarTask[] {
  if (allCache) return allCache;
  const out = [...seedTasks()];
  const keys = new Set(out.map((t) => `${t.topic}|${t.key}`));
  for (const v of v2Tasks()) {
    const t = fromV2(v);
    if (t && !keys.has(`${t.topic}|${t.key}`)) {
      keys.add(`${t.topic}|${t.key}`);
      out.push(t);
    }
  }
  allCache = out;
  return out;
}

/**
 * Wunschformen nach Beherrschung (§4.7): unsicher erkennen, mittel ergänzen und finden, sicher selbst bauen.
 * `touch`: nie ein ganzer Satz (kein `correct`, keine Ganzsatz-Umformung), `keys` darf sie.
 */
export function wantTypes(p: number, profile: InputProfile = 'keys'): GrammarTaskType[] {
  if (p < 0.4) return ['meaning', 'mc', 'gap'];
  if (p <= 0.7) return ['gap', 'find', 'kwt'];
  return profile === 'touch' ? ['kwt', 'find'] : ['correct', 'kwt', 'find'];
}

/** Rückfall, wenn die gewünschten Formen fehlen (ersetzt `anySeed` ohne Typfilter): Reihenfolge nach Profil. */
const FALLBACK: Readonly<Record<InputProfile, readonly GrammarTaskType[]>> = {
  touch: ['kwt', 'find', 'gap', 'mc', 'meaning'],
  keys: ['correct', 'transform', 'kwt', 'find', 'gap', 'mc', 'meaning'],
};

/** Stufe mit Hilfe (Platzhalter von Anfang an sichtbar): p < .40. */
export const scaffolded = (p: number): boolean => p < 0.4;

export type RoundMode = 'duty' | 'xtra' | 'errors' | 'topic';

export type RoundInput = {
  mode: RoundMode;
  /** Nur bei `topic`: das Thema. */
  topic?: string | null;
  /**
   * Einführungsbremse (Gesamtkonzept 3.4): Ist der Wert gesetzt (auch `null`), kommen nur schon begonnene Themen
   * in die Runde, dazu höchstens dieses eine neue (`null` = heute kein neues Thema). Ohne Angabe gilt keine Bremse.
   */
  introduce?: string | null;
  /**
   * Nur bei `duty`: das auf „Heute" angekündigte Fokus-Thema („Claude's focus · …"). Es steht
   * vorn und bekommt etwa die Hälfte der Plätze; der Rest wird wie bisher aufgefüllt.
   */
  focusTopic?: string | null;
  grammarDocs: ReadonlyMap<string, Readonly<Doc>>;
  /** Offene Aufgaben aus `daily/*`, neueste Tage zuerst. */
  dailyOpen: readonly GrammarTask[];
  pool: readonly GrammarTask[];
  nowMs: number;
  size: number;
  /** Startwert, z. B. `${tag}|${modus}`. */
  seed: string;
  /** Höchstzahl der Fehlersätze (aus dem Plan, `errs`); Standard `ERRORS_PER_ROUND`. */
  errorsMax?: number;
  /** Eingefrorenes Grammatikthema des Tages (`u.gt`, §2.3): hat Vorrang vor `rankTopics` und `introTopic`. */
  gt?: { intro: string | null; pats: string[]; topics: string[] } | null;
  /** Einführung vorn: die ersten 4 Plätze (nach den Fehlersätzen) gehören diesen Mustern, ungemischt. */
  introBlock?: { topic: string; pats: string[] } | null;
  /** Eingabeprofil der Runde (einmal eingefroren): `touch` stellt nie einen ganzen Satz; `correct` wird zu `find`, wenn die Fehlerstelle eindeutig ist. */
  profile?: InputProfile;
  /** Lemmata der heute fälligen und neuen Karten: Gleichstand-Brecher (Kap. 2 Nr. 5). */
  wordsToday?: readonly string[];
  /** Schlüssel, die in dieser Runde nicht (mehr) vorkommen dürfen (z. B. die Aufgaben des Vortests). */
  exclude?: ReadonlySet<string>;
};

export const ROUND_SIZE = { duty: 6, xtra: 8, errors: 8, topic: 8 } as const;
export const ERRORS_PER_ROUND = 3;
/** So viele Plätze gehören der Einführung (nach dem Vortest, §5.3). */
export const INTRO_TASKS = 4;

const seenOf = (doc: Readonly<Doc> | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).map(s) : []);

/** Themen nach Bedarf: schwach, fällig, wenig geübt zuerst; Gleichstand per Startwert. */
export function rankTopics(i: Pick<RoundInput, 'grammarDocs' | 'nowMs' | 'seed' | 'introduce'>): Array<{ topic: string; p: number; need: number }> {
  const gated = i.introduce !== undefined;
  let pool = TOPICS.filter((tp) => !gated || !isNewTopic(i.grammarDocs.get(tp.id)) || tp.id === i.introduce);
  // Ganz am Anfang (noch nichts begonnen): das erste Thema des Pfads, damit die Runde nicht leer ist.
  if (!pool.length) {
    const first = nextNewTopic(i.grammarDocs);
    pool = TOPICS.filter((tp) => tp.id === first);
  }
  return pool.map((tp) => {
    const doc = i.grammarDocs.get(tp.id);
    const p = topicP(tp.id, doc, i.nowMs);
    const n = typeof doc?.n === 'number' ? doc.n : 0;
    const due = typeof doc?.due === 'number' ? doc.due : null;
    let need = (1 - p) * (tp.level === 'B1' ? 0.85 : 1);
    if (n < 3) need += 0.2;
    if (n && due !== null) need += due <= i.nowMs ? 0.18 : p > 0.6 ? -0.2 : 0;
    return { topic: tp.id, p, need, tie: hash32(`${i.seed}|${tp.id}`) };
  })
    .sort((a, b) => b.need - a.need || a.tie - b.tie)
    .map(({ topic, p, need }) => ({ topic, p, need }));
}

const asFindCache = new Map<string, GrammarTask | null>();
/** `correct` (ganzer Satz) als „Fehler finden“ für das Handy, wenn die Fehlerstelle eindeutig ist (§4.7); sonst `null`. */
export function asFind(t: GrammarTask): GrammarTask | null {
  if (t.type !== 'correct') return null;
  const ck = `${t.topic}|${t.key}`;
  const hit = asFindCache.get(ck);
  if (hit !== undefined) return hit;
  let out: GrammarTask | null = null;
  const span = errorSpan(t.prompt, t.answer);
  if (span) {
    const w = splitWords(t.prompt);
    const r = splitWords(t.answer);
    const tail = w.length - 1 - span[1];
    out = { ...t, type: 'find', answer: r.slice(span[0], Math.max(span[0], r.length - tail)).join(' '), accepted: [], options: null, x: { kind: 'find', err: span, fixed: t.answer } };
  }
  asFindCache.set(ck, out);
  return out;
}

/** Liste für das Eingabeprofil `touch`: ohne Ganzsatz-Aufgaben, `correct` wo möglich als `find`. */
const touchList = (list: readonly GrammarTask[]): GrammarTask[] =>
  list.flatMap((t) => {
    if (!wholeSentence(t)) return [t];
    const f = asFind(t);
    return f ? [f] : [];
  });

/** Aufgabe eines Fehlereintrags in der Form des Profils (nur `correct` ändert sich). */
export const forProfile = (t: GrammarTask, profile: InputProfile): GrammarTask | null => (profile === 'touch' && wholeSentence(t) ? asFind(t) : t);

type PickReq = { topic: string; prefer: readonly GrammarTaskType[]; strict?: boolean; pats?: readonly string[] | null; allowSeen?: boolean };

/** Auswahl-Werkzeuge einer Runde (gemeinsamer Zustand `used`, Quellenliste, Eignung). Für `selectRound` und `selectVortest`. */
function picker(i: Pick2) {
  const rng = mulberry32(hash32(i.seed));
  const used = new Set<string>(i.exclude ?? []);
  const profile: InputProfile = i.profile ?? 'keys';
  const prof = (l: readonly GrammarTask[]): readonly GrammarTask[] => (profile === 'touch' ? touchList(l) : l);
  const seed = prof(allSeedTasks());
  const sources: readonly (readonly GrammarTask[])[] = [prof(i.dailyOpen), prof(i.pool), shuffle(seed, rng)];
  const gt = i.gt ?? null;
  const block = i.mode === 'duty' ? (i.introBlock ?? (gt?.intro && gt.pats.length ? { topic: gt.intro, pats: gt.pats } : null)) : null;

  // Eingeführte Muster (§3.2): ab `pats[id].i`; ein begonnenes Thema ohne `pats` gilt als ganz eingeführt (Bestand);
  // das Muster des heutigen Einführungsschritts gilt ab sofort.
  const introCache = new Map<string, ReadonlySet<string> | 'all'>();
  const introducedOf = (topic: string): ReadonlySet<string> | 'all' => {
    const c = introCache.get(topic);
    if (c) return c;
    const doc = i.grammarDocs.get(topic);
    const pats = patsOf(doc);
    const set = new Set<string>();
    let all = false;
    if (isNewTopic(doc)) {
      if (block?.topic === topic) block.pats.forEach((p) => set.add(p));
      else if (gt?.intro === topic) gt.pats.forEach((p) => set.add(p));
      else if (i.introduce === topic) (patternsOf(topic)?.introPlan[0] ?? []).forEach((p) => set.add(p));
    } else if (!Object.keys(pats).length) all = true;
    else {
      for (const [id, e] of Object.entries(pats)) if (e.i !== undefined) set.add(id);
      if (block?.topic === topic) block.pats.forEach((p) => set.add(p));
    }
    const out = all ? 'all' : set;
    introCache.set(topic, out);
    return out;
  };
  /** Pflichtrunden stellen in Themen mit Musterdatei nur Aufgaben mit eingeführtem Muster (§3.3). */
  const eligible = (t: GrammarTask): boolean => {
    if (i.mode !== 'duty' || !patternsOf(t.topic)) return true;
    if (!t.pat) return false;
    const set = introducedOf(t.topic);
    return set === 'all' || set.has(t.pat);
  };

  const wordRes = (i.wordsToday ?? []).map(lemmaOf).filter((w) => w.length > 2).map((w) => new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  const wordHit = new Map<string, boolean>();
  const hitsWord = (t: GrammarTask): boolean => {
    if (!wordRes.length) return false;
    const k = `${t.topic}|${t.key}`;
    let v = wordHit.get(k);
    if (v === undefined) {
      const text = `${t.prompt} ${t.answer} ${t.x?.kind === 'kwt' ? t.x.from : ''}`;
      v = wordRes.some((re) => re.test(text));
      wordHit.set(k, v);
    }
    return v;
  };
  const dupBlocked = (t: GrammarTask): boolean => {
    const dup = mapEntryOf(t.topic, t.key)?.dup;
    return !!dup && used.has(dup.slice(dup.indexOf('|') + 1));
  };

  const fresh = (p: PickReq): GrammarTask | null => {
    const seen = p.allowSeen ? new Set<string>() : seenOf(i.grammarDocs.get(p.topic));
    const assigned = !!patternsOf(p.topic);
    // Zugeordnete Aufgaben vor nicht zugeordneten (nur in Themen mit Musterdatei), innerhalb davon gilt die Quellenreihenfolge.
    for (const onlyAssigned of assigned ? [true, false] : [false]) {
      for (const list of sources) {
        const cands = list.filter((t) => t.topic === p.topic && !used.has(t.key) && !seen.has(t.key) && eligible(t) && !dupBlocked(t) && (!onlyAssigned || !!t.pat) && (!p.pats || (!!t.pat && p.pats.includes(t.pat))));
        if (!cands.length) continue;
        for (const ty of p.prefer) {
          const of = cands.filter((t) => t.type === ty);
          if (of.length) return of.find(hitsWord) ?? of[0] ?? null;
        }
        if (!p.strict) return cands.find(hitsWord) ?? cands[0] ?? null;
      }
    }
    return null;
  };
  const anySeed = (topic: string): GrammarTask | null => seed.find((t) => t.topic === topic && !used.has(t.key) && eligible(t)) ?? null;
  const take = (t: GrammarTask | null): GrammarTask | null => {
    if (!t) return null;
    used.add(t.key);
    return t;
  };
  return { used, profile, sources, gt, block, fresh, anySeed, take, eligible };
}
type Pick2 = Pick<RoundInput, 'mode' | 'introduce' | 'grammarDocs' | 'dailyOpen' | 'pool' | 'seed' | 'gt' | 'introBlock' | 'profile' | 'wordsToday' | 'exclude'>;

/** Vorrang der Formen im Einführungsblock: erkennen (meaning, mc), ergänzen (gap), dann das Gegenstück (§5.3). */
const INTRO_FORMS: readonly (readonly GrammarTaskType[])[] = [['meaning', 'mc'], ['mc', 'meaning'], ['gap', 'kwt', 'find'], ['mc', 'meaning', 'find', 'kwt', 'gap']];

/** Vortest eines neuen Themas (§5.3): zwei getippte Aufgaben (Lücke oder Schlüsselwort) zu den heutigen Mustern, ohne Hilfe. */
export function selectVortest(i: Pick2 & { topic: string; pats: readonly string[] }): GrammarTask[] {
  const pk = picker({ ...i, mode: 'duty', introBlock: { topic: i.topic, pats: [...i.pats] } });
  const out: GrammarTask[] = [];
  const pats = i.pats.length ? i.pats : [null];
  for (let k = 0; k < 2; k++) {
    const pat = pats[k % pats.length] ?? null;
    const t = pk.take(pk.fresh({ topic: i.topic, prefer: k === 0 ? ['gap', 'kwt'] : ['kwt', 'gap'], strict: true, pats: pat ? [pat] : null, allowSeen: true })) ?? pk.take(pk.fresh({ topic: i.topic, prefer: ['gap', 'kwt'], strict: true, pats: i.pats.length ? i.pats : null, allowSeen: true }));
    if (t) out.push(t);
  }
  return out;
}

/**
 * Eine ungesehene Variante desselben Musters (gleiches Thema, gleiches Muster, bevorzugt gleiche Form) statt derselben Aufgabe
 * (Rundenende, §4.7). `null`, wenn es keine gibt oder die Aufgabe kein Muster hat.
 */
export function variantOf(t: GrammarTask, i: Pick2 & { exclude?: ReadonlySet<string> }): GrammarTask | null {
  if (!t.pat) return null;
  const pk = picker({ ...i, mode: 'xtra', exclude: new Set([...(i.exclude ?? []), t.key]) });
  return pk.fresh({ topic: t.topic, prefer: [t.type], strict: false, pats: [t.pat] });
}

/**
 * Runde zusammenstellen (§5.2). Quellen je Thema in dieser Reihenfolge: offene `daily`-Aufgaben,
 * Pool, Aufgaben erledigter Lektionen, Startaufgaben (ungesehen; notfalls auch gesehene, damit
 * die Runde voll wird). Fällige Fehler (höchstens `errorsMax`) stehen vorn; ab Box 1 wird bevorzugt eine
 * ungesehene Variante gleichen Themas, Musters und Typs gestellt. Verschachtelt: ≥ 3 Themen, höchstens
 * 2 gleiche hintereinander (nur ein sehr schwaches Thema, p < .35, beginnt mit 2 am Stück).
 * Mit Einführungsblock stehen nach den Fehlersätzen 4 Aufgaben zu den Mustern des Tages am Stück.
 */
export function selectRound(i: RoundInput): GrammarTask[] {
  const pk = picker(i);
  const { used, profile, gt, block, fresh, anySeed, take } = pk;

  // 1. Fällige Fehler.
  const errors: GrammarTask[] = [];
  const due = dueErrors(i.grammarDocs, i.nowMs).filter((d) => (i.mode === 'topic' ? d.topic === i.topic : true));
  const maxErr = i.mode === 'errors' ? i.size : Math.min(i.errorsMax ?? ERRORS_PER_ROUND, i.size);
  for (const d of due) {
    if (errors.length >= maxErr) break;
    const own = forProfile(d.task, profile);
    if (!own || used.has(own.key)) continue;
    used.add(own.key);
    const pat = typeof d.e.pat === 'string' && d.e.pat ? d.e.pat : null;
    const variant = d.box >= 1 ? fresh({ topic: d.topic, prefer: [own.type], strict: true, pats: pat ? [pat] : null }) : null;
    if (variant) {
      used.add(variant.key);
      errors.push({ ...variant, errorT: d.task.errorT });
    } else errors.push(own);
  }
  if (i.mode === 'errors') return errors;

  // 2. Themen der Runde.
  const ranked = rankTopics(i);
  let topics: string[];
  const intro = gt && i.mode === 'duty' ? gt.intro : i.introduce && topicById(i.introduce) ? i.introduce : null;
  // Mit Bremse ist ein neues Fokus-Thema nur erlaubt, wenn es das eine neue Thema des Tages ist.
  const focus = !gt && i.mode === 'duty' && i.focusTopic && topicById(i.focusTopic) && (i.introduce === undefined || !isNewTopic(i.grammarDocs.get(i.focusTopic)) || i.focusTopic === intro) ? i.focusTopic : null;
  if (i.mode === 'topic' && i.topic && topicById(i.topic)) topics = [i.topic];
  else if (gt && i.mode === 'duty' && gt.topics.some((t) => topicById(t))) topics = gt.topics.filter((t) => topicById(t)).slice(0, 3);
  else if (focus) {
    const order = ranked.map((r) => r.topic).filter((t) => t !== focus);
    topics = [focus, ...order.slice(0, 2)];
  } else {
    const order = ranked.map((r) => r.topic);
    topics = order.slice(0, 3);
    // Das eine neue Thema des Tages (nächstes im Pfad) steht immer dabei, als zweites.
    if (intro && !topics.includes(intro)) topics = [topics[0] ?? intro, intro, ...topics.slice(1, 2)].filter((t, k, a) => a.indexOf(t) === k);
    // Als zweites Thema bevorzugt der Familienpartner (gleiche Kontrastfamilie, Verwechslungsgefahr).
    if (i.mode === 'duty' && topics[0]) {
      const partner = familyOf(topics[0]).find((t) => ranked.some((r) => r.topic === t));
      const slot = topics[1] === intro ? 2 : 1;
      if (partner && !topics.includes(partner) && topics.length > slot) topics[slot] = partner;
    }
  }

  // 3. Einführungsblock (§5.3): 4 Aufgaben zu den Mustern des Tages am Stück.
  const blockTasks: GrammarTask[] = [];
  if (block && topicById(block.topic)) {
    const pats = block.pats.length ? block.pats : null;
    for (let k = 0; k < Math.min(INTRO_TASKS, Math.max(0, i.size - errors.length)); k++) {
      const pat = pats ? [pats[k % pats.length] as string] : null;
      const forms = INTRO_FORMS[k] as readonly GrammarTaskType[];
      const pick = take(fresh({ topic: block.topic, prefer: forms, pats: pat })) ?? take(fresh({ topic: block.topic, prefer: forms, pats })) ?? take(fresh({ topic: block.topic, prefer: forms, pats, allowSeen: true }));
      if (pick) blockTasks.push(pick);
    }
  }

  // 4. Aufgaben je Thema, Formen nach Beherrschung im Wechsel.
  const pOf = (t: string) => topicP(t, i.grammarDocs.get(t), i.nowMs);
  const perTopic = new Map<string, GrammarTask[]>(topics.map((t) => [t, []]));
  const slots = Math.max(0, i.size - errors.length - blockTasks.length);
  // Mit Fokus: jeder zweite Platz gehört dem Fokus-Thema (f, a, f, b, …).
  const turns = focus ? topics.filter((t) => t !== focus).flatMap((t) => [focus, t]) : [...topics];
  if (!turns.length) turns.push(...topics);
  let guard = 0;
  let k = 0;
  let placed = 0;
  while (placed < slots && turns.length && guard < slots * topics.length * 4 + 8) {
    guard++;
    const topic = turns[k % turns.length] as string;
    k++;
    const list = perTopic.get(topic) as GrammarTask[];
    const want = wantTypes(pOf(topic), profile);
    const type = want[list.length % want.length] as GrammarTaskType;
    const prefer = [...new Set([type, ...want, ...FALLBACK[profile]])];
    const pick = take(fresh({ topic, prefer }));
    if (pick) {
      list.push(pick);
      placed++;
    } else if (guard > slots * topics.length) {
      const again = take(anySeed(topic));
      if (again) {
        list.push(again);
        placed++;
      }
    }
  }

  // 5. Verschachteln.
  const queues = topics.map((t) => [...(perTopic.get(t) ?? [])]);
  const out: GrammarTask[] = [];
  const first = topics[0];
  if (first && topics.length > 1 && pOf(first) < 0.35 && (queues[0]?.length ?? 0) >= 2) {
    out.push(queues[0]!.shift() as GrammarTask, queues[0]!.shift() as GrammarTask);
  }
  let idx = out.length ? 1 : 0;
  let emptyTurns = 0;
  while (queues.some((q) => q.length) && emptyTurns <= queues.length) {
    const q = queues[idx % queues.length] as GrammarTask[];
    idx++;
    const next = q[0];
    if (!next) {
      emptyTurns++;
      continue;
    }
    const a = out[out.length - 1];
    const b = out[out.length - 2];
    // Höchstens zwei gleiche hintereinander – außer es gibt nichts anderes mehr.
    if (a && b && a.topic === next.topic && b.topic === next.topic && queues.some((o) => o !== q && o.length)) {
      emptyTurns++;
      continue;
    }
    out.push(q.shift() as GrammarTask);
    emptyTurns = 0;
  }
  return [...errors, ...blockTasks, ...out];
}

/**
 * Fokus-Thema der Pflicht-Grammatik aus dem eingefrorenen Plan: Begründung des Pflichtkanals
 * (`why[0]`) mit `['whyFocus', 0, 'grammar:<thema>']` – genau das, was „Heute" anzeigt.
 */
export function planFocusTopic(plan: { ids?: readonly string[]; why?: readonly (readonly (readonly unknown[])[])[] } | null | undefined): string | null {
  if (!plan || plan.ids?.[0] !== 'gram') return null;
  for (const w of plan.why?.[0] ?? []) {
    const ref = w[0] === 'whyFocus' && typeof w[2] === 'string' ? w[2] : '';
    const m = /^grammar:(.+)$/.exec(ref);
    if (m?.[1] && topicById(m[1])) return m[1];
  }
  return null;
}

/** Ungesehene Aufgaben eines Themas in allen Quellen (für „Neue Aufgaben" erst unter 8). */
export function unseenCount(topic: string, doc: Readonly<Doc> | undefined, lists: readonly (readonly GrammarTask[])[]): number {
  const seen = seenOf(doc);
  const keys = new Set<string>();
  for (const l of [...lists, allSeedTasks()]) for (const t of l) if (t.topic === topic && !seen.has(t.key)) keys.add(t.key);
  return keys.size;
}


/**
 * H3: Ist eine beendete Grammatikrunde nur „teilweise"? Abgebrochen mit offenen Aufgaben – oder als
 * Pflichtrunde mit weniger als `dutyMin` Antworten (z. B. zu wenige Aufgaben verfügbar). Eine
 * teilweise Runde zählt nie als erledigte Pflicht.
 */
export function gramRoundPartial(i: { aborted: boolean; pos: number; tasks: number; ctx: string; mode?: string; answers: number; dutyMin: number }): boolean {
  if (i.aborted && i.pos < i.tasks) return true;
  if (i.ctx !== 'duty' || i.answers >= i.dutyMin) return false;
  // Die reguläre Pflichtrunde zählt, wenn sie vollständig beantwortet ist – auch wenn es an dem
  // Tag weniger als `dutyMin` Aufgaben gab (sonst wäre die Pflicht unerfüllbar, Serie!).
  // Kurze Themen- oder Fehlerrunden erfüllen die Grammatik-Pflicht dagegen nicht.
  return i.mode !== 'duty';
}
