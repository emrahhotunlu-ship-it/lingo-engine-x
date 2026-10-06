#!/usr/bin/env node
// Baut die Inhaltsdateien der Grammatik aus den Teilen unter scripts/grammar/parts/<thema>/ (Lernplattform 2.0 §3.3, §3.4, §3.6):
//   map.json   Zuordnung vorhandener Aufgaben: { "<Aufgabensatz>": { pat, why?, dup? } }  (Schlüssel = prompt, hier wird `${thema}|${legacyTaskKey}` daraus)
//   v2.json    neue Aufgaben (kwt/find/meaning)
//   order.json Satzbau-Sätze mit `pat` und `trap`
// → src/content/grammar/pattern-map.json, src/content/grammar/tasks-v2.json und die Einträge mit `pat` in src/content/c1/order.json.
// Wiederholbar: Einträge von order.json mit `pat` werden bei jedem Lauf ersetzt, alles andere bleibt unberührt.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, legacyTaskKey } from './lib.mjs';

const PARTS = join(ROOT, 'scripts/grammar/parts');
const topics = existsSync(PARTS) ? readdirSync(PARTS).filter((d) => existsSync(join(PARTS, d, 'map.json'))).sort() : [];
const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
const dump = (v) => JSON.stringify(v, null, 1) + '\n';

const map = {};
const v2 = [];
const order = [];
for (const topic of topics) {
  const dir = join(PARTS, topic);
  for (const [prompt, e] of Object.entries(read(join(dir, 'map.json')))) {
    const key = `${topic}|${legacyTaskKey(prompt)}`;
    if (map[key]) throw new Error(`doppelter Schlüssel ${key}`);
    map[key] = e.dup ? { ...e, dup: `${topic}|${legacyTaskKey(e.dup)}` } : e;
  }
  if (existsSync(join(dir, 'v2.json'))) for (const t of read(join(dir, 'v2.json'))) v2.push({ ...t, topic });
  if (existsSync(join(dir, 'order.json'))) for (const o of read(join(dir, 'order.json'))) order.push({ ...o, topic });
}
writeFileSync(join(ROOT, 'src/content/grammar/pattern-map.json'), dump(map));
writeFileSync(join(ROOT, 'src/content/grammar/tasks-v2.json'), dump({ v: 1, tasks: v2 }));

const orderPath = join(ROOT, 'src/content/c1/order.json');
const cur = read(orderPath);
cur.items = [...cur.items.filter((i) => !i.pat), ...order];
writeFileSync(orderPath, dump(cur));
console.log(`Themen: ${topics.join(', ')} · Zuordnungen: ${Object.keys(map).length} · neue Aufgaben: ${v2.length} · Satzbau-Sätze: ${order.length}`);
