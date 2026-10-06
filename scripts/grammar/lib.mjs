// Gemeinsame Helfer der Grammatik-Skripte (Port von `legacyNorm`/`legacyTaskKey`, src/domain/grammar/key.ts).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

export function legacyNorm(s) {
  let x = String(s ?? '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
  x = x
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/n't\b/g, ' not')
    .replace(/'ll\b/g, ' will')
    .replace(/'ve\b/g, ' have')
    .replace(/'re\b/g, ' are')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\bcan not\b/g, 'cannot');
  return x.replace(/[.,!?;:"]/g, '').replace(/\s+/g, ' ').trim();
}
export const legacyTaskKey = (prompt) => legacyNorm(prompt).replace(/[^a-z]/g, '').slice(0, 80);

/** Alle vorhandenen Startaufgaben in der Reihenfolge von `seedTasks()` (Quelle je Aufgabe mitgeführt), roh normalisiert wie `normalizeTask`. */
export function allSeedTasks() {
  const TYPES = ['mc', 'gap', 'transform', 'correct'];
  const GAP = /_{3,}/;
  const out = [];
  const keys = new Set();
  const topics = new Set(readJson('src/content/c1/toolkit.json').topics.map((t) => t.id));
  for (const t of readJson('src/content/legacy/course.json').topics ?? []) topics.add(t.id);
  const push = (raw, origin) => {
    if (!raw || typeof raw !== 'object') return;
    let type = TYPES.includes(raw.type) ? raw.type : null;
    const prompt = String(raw.prompt ?? '').trim();
    const answer = String(raw.answer ?? '').trim();
    if (!type || !prompt || !answer) return;
    if ((type === 'gap' || type === 'mc') && (prompt.match(/_{3,}/g)?.length ?? 0) > 1) return;
    if (type === 'transform' && (prompt.split('→').slice(1).join('→').match(/_{3,}/g)?.length ?? 0) > 1) return;
    if (type === 'gap' && !GAP.test(prompt)) type = 'transform';
    const key = legacyTaskKey(prompt);
    if (keys.has(key)) return;
    keys.add(key);
    out.push({ ...raw, type, prompt, answer, key, origin });
  };
  for (const g of readJson('src/content/legacy/grammar.json').seedGrammar ?? []) push(g, 'legacy/grammar');
  for (const g of readJson('src/content/grammar-extra.json').tasks ?? []) push(g, 'grammar-extra');
  for (const g of readJson('src/content/grammar-bank.json').tasks ?? []) push(g, 'grammar-bank');
  for (const g of readJson('src/content/c1/toolkit.json').tasks ?? []) push(g, 'c1/toolkit');
  const rules = { ...readJson('src/content/c1/toolkit.json').rules, ...readJson('src/content/legacy/rules.json').rules };
  for (const [topic, r] of Object.entries(rules)) {
    for (const trap of r.traps ?? []) {
      push({ topic, type: 'correct', prompt: trap.bad, answer: trap.good, expl: trap.why?.[0], expl_en: trap.why?.[1] }, `rules/${topic}`);
    }
  }
  return out;
}
