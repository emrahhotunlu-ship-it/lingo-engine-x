// Qualitäts-Sweep (MVP 07.10.2026): `extract <n> <größe>` zeigt Charge n der schwächsten Begründungen,
// `apply <patch.json>` schreibt verbesserte why-Texte in scripts/grammar/parts/** zurück (danach `npm run grammar:build`).
// Patch: { "<id>": { "ok": ["de","en"], "w": { "0": ["de","en"] } } }; id = v2-id oder `${thema}|${legacyTaskKey}`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { allSeedTasks, readJson, ROOT } from './lib.mjs';
import { wordCount } from './validate.mjs';

const PARTS = join(ROOT, 'scripts/grammar/parts');
const rd = (f) => JSON.parse(readFileSync(f, 'utf8'));
const path = readJson('src/content/grammar/path.json');
const rank = {};
let r = 0;
path.chapters.forEach((c) => c.topics.forEach((t) => (rank[t] = r++)));
const [cmd, a] = process.argv.slice(2);

if (cmd === 'extract') {
  const map = readJson('src/content/grammar/pattern-map.json');
  const v2 = readJson('src/content/grammar/tasks-v2.json').tasks;
  const done = existsSync(join(ROOT, 'scripts/grammar/sweep-done.json')) ? rd(join(ROOT, 'scripts/grammar/sweep-done.json')) : [];
  const items = [];
  const consider = (id, type, topic, front, answer, why, opts) => {
    const w = wordCount(why.ok.de);
    const arrow = /→/.test(why.ok.de);
    if (w >= 12 && !arrow) return;
    if (w >= 10 && !arrow) return;
    items.push({ id, type, topic, front, answer, opts, why, bad: 12 - w + (arrow ? 3 : 0) });
  };
  for (const t of allSeedTasks()) {
    const m = map[`${t.topic}|${t.key}`];
    if (m?.why) consider(`${t.topic}|${t.key}`, t.type, t.topic, t.prompt, t.answer, m.why, t.options);
  }
  for (const t of v2) consider(t.id, t.type, t.topic, t.prompt ?? t.frame ?? `${t.a} / ${t.b}`, t.answer, t.why, null);
  const todo = items.filter((x) => !done.includes(x.id)).sort((x, y) => rank[x.topic] - rank[y.topic] || y.bad - x.bad);
  console.error(`offen: ${todo.length}`);
  for (const x of todo.slice(0, Number(a))) {
    console.log(`#${x.id} [${x.type}] ${x.front}${x.opts ? ' {' + x.opts.join(' | ') + '}' : ''} => ${x.answer}`);
    console.log(`  ok: ${x.why.ok.de}`);
    x.why.wrong.forEach((w, i) => console.log(`  w${i} ${w.opt ?? w.if?.join('+') ?? (w.not ? '!' + w.not.join('/') : w.tap)}: ${w.de}`));
  }
} else if (cmd === 'apply') {
  const patch = rd(a);
  const doneF = join(ROOT, 'scripts/grammar/sweep-done.json');
  const done = existsSync(doneF) ? rd(doneF) : [];
  let n = 0;
  const byTopic = {};
  for (const id of Object.keys(patch)) byTopic[id.includes('|') ? id.split('|')[0] : null] ??= [];
  const topics = readJson('src/content/grammar/path.json').chapters.flatMap((c) => c.topics);
  const { legacyTaskKey } = await import('./lib.mjs');
  for (const topic of topics) {
    for (const [file, kind] of [['map.json', 'map'], ['v2.json', 'v2']]) {
      const f = join(PARTS, topic, file);
      if (!existsSync(f)) continue;
      const data = rd(f);
      let changed = false;
      const upd = (id, why) => {
        const p = patch[id];
        if (!p) return;
        if (p.ok) why.ok = { de: p.ok[0], en: p.ok[1] };
        for (const [i, v] of Object.entries(p.w ?? {})) if (why.wrong[i]) why.wrong[i] = { ...why.wrong[i], de: v[0], en: v[1] };
        changed = true; n++; done.push(id);
      };
      if (kind === 'map') for (const [prompt, e] of Object.entries(data)) if (e.why) upd(`${topic}|${legacyTaskKey(prompt)}`, e.why);
      else for (const t of data) upd(t.id, t.why);
      if (changed) writeFileSync(f, JSON.stringify(data, null, 1) + '\n');
    }
  }
  writeFileSync(doneF, JSON.stringify([...new Set(done)]));
  console.log(`angewendet: ${n} von ${Object.keys(patch).length}`);
}
