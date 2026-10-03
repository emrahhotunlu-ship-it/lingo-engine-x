import { topicById } from '../content';
import { detectLang } from '../lang/detect';
import type { GrammarTask } from '../learn/types';
import type { Lang } from '../srs/types';
import { asList, asRecord, rulesJson, toolkitJson } from './raw';

// Regelwerk der alten App typisiert (content/legacy/rules.json) und die Hilfen nach dem Prüfen
// (phase2-plan §5.0): eine Zeile Form-Hinweis, 2–3 Beispiele, „Auch richtig". Texte immer in der
// Oberflächensprache; passt die Sprache eines gespeicherten Texts nicht, gilt das Regelwerk
// (Sprachtreue, Kap. 10 und Kap. 15 „gemischte Sprache").

type Pair = [de: string, en: string];
type RawRule = {
  core?: Pair;
  why?: Pair;
  contrast?: Pair;
  steps?: [string[], string[]];
  forms?: Array<[Pair, string, string]>;
  signals?: Array<[string, Pair]>;
  traps?: Array<{ bad: string; good: string; why: Pair }>;
  alts?: Array<{ note: Pair }>;
};
type AltFamily = { id: string; topics: string[]; note: Pair };

// Regelblätter des C1-Werkzeugkastens (content/c1/toolkit.json) im selben Format, nur ergänzt.
// Geparst erst beim ersten Gebrauch (`raw.ts`, leistung.md §4 Nr. 5).
let rawCache: { rules: Record<string, RawRule>; altFamilies: AltFamily[] } | null = null;
function raw(): { rules: Record<string, RawRule>; altFamilies: AltFamily[] } {
  if (rawCache) return rawCache;
  const legacy = rulesJson();
  rawCache = {
    rules: { ...(asRecord(toolkitJson().rules) as Record<string, RawRule>), ...(asRecord(legacy.rules) as Record<string, RawRule>) },
    altFamilies: asList(legacy.altFamilies) as AltFamily[],
  };
  return rawCache;
}

/** „Auch richtig“-Familien des Regelwerks. */
export function altFamilies(): readonly AltFamily[] {
  return raw().altFamilies;
}

export type Rule = {
  topic: string;
  core: string;
  why: string;
  contrast: string;
  steps: string[];
  forms: Array<{ name: string; pattern: string; ex: string }>;
  signals: Array<{ signal: string; meaning: string }>;
  traps: Array<{ bad: string; good: string; why: string }>;
  alts: string[];
};

const pick = (p: Pair | undefined, lang: Lang): string => (p ? (lang === 'de' ? p[0] : p[1]) : '');

/**
 * Deutsche Fachwörter in den Formmustern der alten App (`forms[][1]`, z. B. „have/has + 3. Form").
 * Die Inhalte bleiben unverändert; die Oberfläche setzt je Kennung den Text aus i18n
 * (`grTerm_<id>`) ein – auf Englisch „past participle" statt „3. Form" (Sprachtreue, Kap. 10).
 */
export const PATTERN_TERMS: ReadonlyArray<readonly [de: string, id: string]> = [
  ['normale Wortstellung', 'wordOrder'],
  ['verschobene Zeit', 'backshift'],
  ['eines von vielen', 'oneOfMany'],
  ['bekannt, einzigartig', 'knownUnique'],
  ['allgemein, abstrakt', 'generalAbstract'],
  ['ohne Komma', 'noComma'],
  ['mit Kommas', 'withCommas'],
  ['Präposition', 'preposition'],
  ['Fragewort', 'questionWord'],
  ['Grundform', 'base'],
  ['3. Form', 'pp'],
  ['2. Form', 'past'],
  ['Beruf', 'job'],
];

/** Formmuster mit übersetzten Fachwörtern (`term(id)` liefert den Text der Oberflächensprache). */
export function localizePattern(pattern: string, term: (id: string) => string): string {
  let out = pattern;
  for (const [de, id] of PATTERN_TERMS) if (out.includes(de)) out = out.split(de).join(term(id));
  return out;
}

/** Regelblatt eines Themas in der Oberflächensprache; `null` für unbekannte Themen. */
export function ruleOf(topic: string, lang: Lang): Rule | null {
  const r = raw().rules[topic];
  const tp = topicById(topic);
  if (!r || !tp) return null;
  return {
    topic,
    core: pick(r.core, lang) || (lang === 'de' ? (tp.rule ?? '') : ((tp as { rule_en?: string }).rule_en ?? tp.rule ?? '')),
    why: pick(r.why, lang),
    contrast: pick(r.contrast, lang),
    steps: r.steps ? (lang === 'de' ? r.steps[0] : r.steps[1]) : [],
    forms: (r.forms ?? []).map(([name, pattern, ex]) => ({ name: pick(name, lang), pattern, ex })),
    signals: (r.signals ?? []).map(([signal, m]) => ({ signal, meaning: pick(m, lang) })),
    traps: (r.traps ?? []).map((t) => ({ bad: t.bad, good: t.good, why: pick(t.why, lang) })),
    alts: (r.alts ?? []).map((a) => pick(a.note, lang)).filter(Boolean),
  };
}

/** Passt der Text zur Sprache? Kurze oder unklare Texte gelten als passend. */
function langOk(text: string, lang: Lang): boolean {
  const d = detectLang(text);
  return d === 'unknown' || d === lang;
}

/**
 * Eine Zeile Form-Hinweis: die Erklärung der Aufgabe in der Oberflächensprache; fehlt sie oder
 * steht sie in der falschen Sprache, der Kernsatz des Regelwerks.
 */
export function formHint(task: Pick<GrammarTask, 'topic' | 'expl'>, lang: Lang): string {
  const own = lang === 'de' ? task.expl.de : task.expl.en;
  if (own && own.trim() && langOk(own, lang)) return own.trim();
  return ruleOf(task.topic, lang)?.core ?? '';
}

/**
 * 2–3 englische Beispielsätze zum Thema (Formen, gute Fassung der Fallen, Themenbeispiele),
 * ohne den Satz der Aufgabe selbst. Deterministisch, damit dieselbe Aufgabe dieselben Beispiele zeigt.
 */
export function examplesFor(topic: string, opts: { exclude?: string; max?: number; offset?: number } = {}): string[] {
  const r = raw().rules[topic];
  const tp = topicById(topic);
  const all: string[] = [];
  const push = (x: unknown) => {
    const t = typeof x === 'string' ? x.trim() : '';
    if (t && !all.includes(t) && t !== opts.exclude?.trim()) all.push(t);
  };
  for (const f of r?.forms ?? []) push(f[2]);
  for (const t of r?.traps ?? []) push(t.good);
  for (const e of tp?.ex ?? []) push(e);
  const max = Math.max(1, Math.min(3, opts.max ?? 3));
  if (all.length <= max) return all;
  const start = (opts.offset ?? 0) % all.length;
  return [...all.slice(start), ...all.slice(0, start)].slice(0, max);
}

/** Alle englischen Beispielsätze eines Themas (Formen, Fallen, Themenbeispiele), ohne Doppelte. */
export function ruleExamples(topic: string, max = 6): string[] {
  const r = raw().rules[topic];
  const out: string[] = [];
  const push = (x: unknown) => {
    const t = typeof x === 'string' ? x.trim() : '';
    if (t && !out.includes(t)) out.push(t);
  };
  for (const f of r?.forms ?? []) push(f[2]);
  for (const t of r?.traps ?? []) push(t.good);
  for (const e of topicById(topic)?.ex ?? []) push(e);
  return out.slice(0, max);
}

/** „Auch richtig": weitere akzeptierte Lösungen der Aufgabe und die Hinweise des Regelwerks. */
export function alsoRight(task: Pick<GrammarTask, 'topic' | 'answer' | 'accepted'>, lang: Lang): { answers: string[]; notes: string[] } {
  const answers = [...new Set(task.accepted.map((a) => a.trim()).filter((a) => a && a !== task.answer.trim()))];
  return { answers, notes: ruleOf(task.topic, lang)?.alts ?? [] };
}

/** Hinweis einer „Auch richtig"-Familie (für `checkGrammar` kind `alt`). */
export function altNote(id: string, lang: Lang): string {
  return pick(altFamilies().find((f) => f.id === id)?.note, lang);
}
