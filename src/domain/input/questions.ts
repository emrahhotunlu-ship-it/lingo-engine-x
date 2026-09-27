import { hash32, mulberry32, shuffle } from '../random';
import type { Question, QuestionType } from './types';

// Verständnisfragen (Plan §4.1/§4.4): zwei Altformate werden auf eine Form gebracht.
// - Hörtexte/Artikel (lpool, articles, passages.json): {q, options[], answer: Optionstext, type, explain_de, explain_en}
// - Beiträge des Tagesauftrags (feed): {q_de, q_en, opts_de[], opts_en[], a: Index, why_de, why_en}
// Die Reihenfolge der Optionen wird mit festem Startwert gemischt (Altdaten haben die Lösung oft
// an erster Stelle) – vor der Wahl verrät nichts im DOM die Lösung (DOM-Vertrag).

type Doc = Readonly<Record<string, unknown>>;
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : []);

const TYPES: readonly QuestionType[] = ['gist', 'detail', 'inference', 'keypoint', 'vocab'];
const asType = (v: unknown): QuestionType => (TYPES.includes(v as QuestionType) ? (v as QuestionType) : 'detail');

const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().toLowerCase() === b.replace(/\s+/g, ' ').trim().toLowerCase();

/** Frage aus Hörtext/Artikel; `null`, wenn sie unvollständig ist oder die Lösung keine Option ist. */
export function normalizeLegacyQuestion(raw: unknown, key: string): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Doc;
  const q = str(r.q);
  const options = strList(r.options);
  if (!q || options.length < 2 || new Set(options.map((o) => o.toLowerCase())).size !== options.length) return null;
  let answer = -1;
  if (typeof r.answer === 'number' && Number.isInteger(r.answer)) answer = r.answer;
  else if (typeof r.answer === 'string') answer = options.findIndex((o) => same(o, r.answer as string));
  if (answer < 0 || answer >= options.length) return null;
  const explain: Question['explain'] = {};
  if (str(r.explain_de)) explain.de = str(r.explain_de);
  if (str(r.explain_en)) explain.en = str(r.explain_en);
  return { key, q, qLang: 'en', options, answer, type: asType(r.type), explain };
}

/**
 * Frage aus einem Beitrag in der Oberflächensprache (`q_<ui>`, `opts_<ui>`, Rückfall auf die
 * andere Sprache). `null`, wenn unvollständig oder `a` kein gültiger Index ist.
 */
export function normalizeFeedQuestion(raw: unknown, key: string, uiLang: 'de' | 'en'): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Doc;
  const other = uiLang === 'de' ? 'en' : 'de';
  let lang: 'de' | 'en' = uiLang;
  let q = str(r[`q_${uiLang}`]);
  let options = strList(r[`opts_${uiLang}`]);
  if (!q || options.length < 2) {
    lang = other;
    q = str(r[`q_${other}`]);
    options = strList(r[`opts_${other}`]);
  }
  const a = r.a;
  if (!q || options.length < 2 || typeof a !== 'number' || !Number.isInteger(a) || a < 0 || a >= options.length) return null;
  const explain: Question['explain'] = {};
  if (str(r.why_de)) explain.de = str(r.why_de);
  if (str(r.why_en)) explain.en = str(r.why_en);
  return { key, q, qLang: lang, options, answer: a, type: 'detail', explain };
}

/** Liste normalisieren, ungültige Fragen fallen weg. */
export function normalizeQuestions(raw: unknown, prefix: string): Question[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r, i) => normalizeLegacyQuestion(r, `${prefix}#${i}`)).filter((q): q is Question => q !== null);
}

/** Optionen mit festem Startwert mischen; die Lösung wandert mit. */
export function shuffleOptions(q: Question, seed: string): Question {
  const order = shuffle(
    q.options.map((_, i) => i),
    mulberry32(hash32(`${seed}|${q.key}`)),
  );
  return { ...q, options: order.map((i) => q.options[i] ?? ''), answer: order.indexOf(q.answer) };
}

export function gradeChoice(q: Question, chosen: number): boolean {
  return chosen === q.answer;
}
