// Messung der Aufgaben-Qualität (MVP-Sweep 07.10.2026). Nur Lesen. `node scripts/grammar/measure.mjs [--json datei]`
import { writeFileSync } from 'node:fs';
import { allSeedTasks, readJson } from './lib.mjs';
import { BRITISH, wordCount } from './validate.mjs';

const map = readJson('src/content/grammar/pattern-map.json');
const v2 = readJson('src/content/grammar/tasks-v2.json').tasks;
const retired = new Set((readJson('src/content/grammar/retired.json').retired ?? []).map((r) => r.key));
const path = readJson('src/content/grammar/path.json');
const rank = {};
let r = 0;
path.chapters.forEach((c, ci) => c.topics.forEach((t) => (rank[t] = ci * 10 + r++ * 0.001)));

const rows = [];
for (const t of allSeedTasks()) {
  const key = `${t.topic}|${t.key}`;
  if (retired.has(key)) continue;
  const m = map[key];
  const wy = m?.why;
  const exp = String(t.expl ?? '');
  const eff = wy ? String(wy.ok?.de ?? '') : exp;
  const words = wordCount(eff);
  const flags = [];
  if (!m?.pat) flags.push('nopat');
  if (!wy) flags.push('nowhy');
  if (!wy && words < 12) flags.push('short');
  if (!wy && /^[^.]{0,60}→/.test(exp) && words < 18) flags.push('arrow');
  if (wy && t.type === 'mc') {
    const covered = new Set(wy.wrong.filter((w) => w.opt).map((w) => w.opt));
    const missing = (t.options ?? []).filter((o) => o !== t.answer && !covered.has(o));
    if (missing.length) flags.push('mc-uncovered');
  }
  if (BRITISH.test(`${t.prompt} ${t.answer} ${(t.options ?? []).join(' ')} ${(t.accepted ?? []).join(' ')}`)) flags.push('british');
  if (t.type === 'gap' && /\([a-z ]+\)\s*$|\(\w+\)/.test(t.prompt) === false && !t.hint && !(t.accepted ?? []).length && /'/.test(t.answer)) flags.push('noaccepted');
  const ans = t.answer.toLowerCase();
  if (t.type === 'gap' && t.hint && new RegExp(`\\b${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(String(t.hint).toLowerCase())) flags.push('leak');
  rows.push({ src: 'seed', key, topic: t.topic, type: t.type, origin: t.origin, words, flags, prompt: t.prompt, rank: rank[t.topic] ?? 999 });
}
for (const t of v2) {
  const flags = [];
  const w = wordCount(t.why?.ok?.de ?? '');
  if (w < 8) flags.push('short');
  if (!t.why?.wrong?.length) flags.push('nowrong');
  rows.push({ src: 'v2', key: t.id, topic: t.topic, type: t.type, words: w, flags, prompt: t.prompt ?? t.frame ?? t.a, rank: rank[t.topic] ?? 999 });
}
const bad = rows.filter((x) => x.flags.some((f) => ['nowhy', 'short', 'nopat', 'mc-uncovered', 'british', 'leak', 'nowrong', 'arrow'].includes(f)));
const by = (fn) => rows.reduce((a, x) => ((a[fn(x)] ??= { n: 0, bad: 0 }), a[fn(x)].n++, bad.includes(x) && a[fn(x)].bad++, a), {});
const cnt = {};
for (const x of rows) for (const f of x.flags) cnt[f] = (cnt[f] ?? 0) + 1;
console.log('Aufgaben gesamt', rows.length, '· seed', rows.filter((x) => x.src === 'seed').length, '· v2', rows.filter((x) => x.src === 'v2').length);
console.log('Flags', cnt, '· auffällig', bad.length);
console.log('Je Art (seed)', by((x) => x.src + ':' + x.type));
const topics = by((x) => x.topic);
console.log('Je Thema (auffällig/gesamt, Pfadreihenfolge):');
Object.entries(topics).sort((a, b) => (rank[a[0]] ?? 999) - (rank[b[0]] ?? 999)).forEach(([k, v]) => console.log(' ', k.padEnd(16), v.bad, '/', v.n));
const i = process.argv.indexOf('--json');
if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(rows, null, 1));
