#!/usr/bin/env node
// Zuordnungsskript Aufgabe → Muster (Lernplattform 2.0 §3.3, P2 Schritt 2). Es ordnet nichts still zu, sondern berichtet:
//   1. je Thema mit Musterdatei: wie viele Aufgaben die Zuordnung (scripts/grammar/parts/<thema>/map.json) abdeckt, welche fehlen,
//      und was die Signalwort-Regel für die fehlenden vorschlägt (nur bei eindeutigem Treffer, dieselbe Regel wie `patternOf` im Code);
//   2. wie gut die Regel auf dem schon Zugeordneten trifft (Abdeckung und Treffsicherheit, Grundlage für Stufe 2);
//   3. Beinahe-Doppel (mehr als 80 % gleiche Wörter) innerhalb eines Themas, ohne `dup` in der Zuordnung;
//   4. Muster ohne vorhandene Aufgabe (dort tragen nur neue Aufgaben das Muster);
//   5. Themen ohne Musterdatei mit Zahl ihrer Aufgaben (Arbeitsvorrat für Stufe 2).
// Mit `--draft` schreibt es für fehlende Aufgaben mit eindeutigem Vorschlag `parts/<thema>/map.draft.json` ({ prompt: { pat } }),
// das von Hand mit `why` vervollständigt und nach `map.json` übernommen wird. Aufruf: node scripts/grammar/map-patterns.mjs [--draft] [thema …]
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, allSeedTasks, readJson } from './lib.mjs';

const args = process.argv.slice(2);
const draft = args.includes('--draft');
const only = args.filter((a) => !a.startsWith('--'));
const PATTERNS = join(ROOT, 'src/content/grammar/patterns');
const PARTS = join(ROOT, 'scripts/grammar/parts');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasSignal = (text, sig) => {
  const s = sig.trim();
  return s !== '' && new RegExp(`(^|[^A-Za-z'])${esc(s).replace(/\s+/g, '\\s+')}($|[^A-Za-z'])`, 'i').test(text);
};
const sentenceOf = (t) => (/_{3,}/.test(t.prompt) ? t.prompt.replace(/_{3,}/, t.answer) + ' ' + t.answer : t.prompt);
const words = (s) => new Set(s.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean));
const similarity = (a, b) => {
  const A = words(a);
  const B = words(b);
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / Math.max(1, Math.max(A.size, B.size));
};
function suggest(tp, text) {
  const scored = tp.patterns.map((p) => ({ id: p.id, n: p.signals.filter((s) => hasSignal(text, s)).length }));
  const best = Math.max(0, ...scored.map((x) => x.n));
  if (best <= 0) return null;
  const top = scored.filter((x) => x.n === best);
  return top.length === 1 ? top[0].id : null;
}

const seeds = allSeedTasks();
const withFile = existsSync(PATTERNS) ? readdirSync(PATTERNS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort() : [];
let issues = 0;
for (const topic of withFile) {
  if (only.length && !only.includes(topic)) continue;
  const tp = readJson(`src/content/grammar/patterns/${topic}.json`);
  const mapFile = join(PARTS, topic, 'map.json');
  const map = existsSync(mapFile) ? readJson(`scripts/grammar/parts/${topic}/map.json`) : {};
  const tasks = seeds.filter((t) => t.topic === topic);
  const missing = tasks.filter((t) => !map[t.prompt]);
  console.log(`\n== ${topic}: ${tasks.length - missing.length} von ${tasks.length} Aufgaben zugeordnet (${Math.round(((tasks.length - missing.length) / Math.max(1, tasks.length)) * 100)} %)`);
  const drafts = {};
  for (const t of missing) {
    const s = suggest(tp, sentenceOf(t));
    console.log(`   fehlt: ${t.prompt}  →  ${s ? `Vorschlag ${s}` : 'kein eindeutiger Treffer, von Hand'}`);
    if (s) drafts[t.prompt] = { pat: s };
    issues++;
  }
  if (draft && Object.keys(drafts).length) {
    writeFileSync(join(PARTS, topic, 'map.draft.json'), JSON.stringify(drafts, null, 1) + '\n');
    console.log(`   Entwurf geschrieben: scripts/grammar/parts/${topic}/map.draft.json`);
  }
  // Treffsicherheit der Regel auf dem Zugeordneten
  let hit = 0;
  let right = 0;
  for (const t of tasks.filter((x) => map[x.prompt])) {
    const s = suggest(tp, sentenceOf(t));
    if (s) {
      hit++;
      if (s === map[t.prompt].pat) right++;
    }
  }
  const mapped = tasks.length - missing.length;
  console.log(`   Signalwort-Regel: Treffer bei ${hit} von ${mapped} (${Math.round((hit / Math.max(1, mapped)) * 100)} %), davon richtig ${right} (${Math.round((right / Math.max(1, hit)) * 100)} %)`);
  // Beinahe-Doppel
  for (let i = 0; i < tasks.length; i++) {
    for (let j = i + 1; j < tasks.length; j++) {
      const a = tasks[i];
      const b = tasks[j];
      const sim = similarity(sentenceOf(a), sentenceOf(b));
      if (sim > 0.8 && !map[a.prompt]?.dup && !map[b.prompt]?.dup) {
        console.log(`   Beinahe-Doppel (${Math.round(sim * 100)} %): „${a.prompt}“ ~ „${b.prompt}“`);
        issues++;
      }
    }
  }
  const used = new Set(Object.values(map).map((e) => e.pat));
  for (const p of tp.patterns) if (!used.has(p.id)) console.log(`   Muster ohne vorhandene Aufgabe: ${p.id} (nur neue Aufgaben)`);
}

if (!only.length) {
  const counts = new Map();
  for (const t of seeds) if (!withFile.includes(t.topic)) counts.set(t.topic, (counts.get(t.topic) ?? 0) + 1);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`\n== Themen ohne Musterdatei (Stufe 2): ${counts.size} Themen, ${total} Aufgaben`);
  console.log('   ' + [...counts].map(([t, n]) => `${t} ${n}`).join(' · '));
}
console.log(issues ? `\n${issues} offene Punkte (siehe oben).` : '\nKeine offenen Punkte bei den Themen mit Musterdatei.');
