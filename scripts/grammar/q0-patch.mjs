#!/usr/bin/env node
// Inhaltskorrekturen ohne Neubau (Paket Q0). `npm run grammar:build` darf NICHT laufen: die ausgelieferte Datei
// src/content/grammar/tasks-v2.json war neuer als die Teile unter scripts/grammar/parts/ (Lehrer-Korrekturen wurden direkt in die
// ausgelieferte Datei geschrieben, stand.md „Generator driftet“), ein Neubau hätte sie überschrieben; außerdem baut er pattern-map.json und
// order.json neu. Dieses Werkzeug schreibt jede Änderung an BEIDE Stellen, Aufgabe für Aufgabe über die `id`:
//
//   node scripts/grammar/q0-patch.mjs sync            Teile ← ausgelieferte Datei (einmalig: holt die Drift zurück, gleiche Reihenfolge)
//   node scripts/grammar/q0-patch.mjs check           meldet Abweichungen zwischen Teilen und ausgelieferter Datei (Exit 1 bei Drift)
//   node scripts/grammar/q0-patch.mjs apply <p.json>  Patch { "<id>": { …Felder, die ersetzt werden… } } auf tasks-v2 (+ Teile) bzw. c1x-Quellen
//
// Startaufgaben mit Muster-Zuordnung (`<thema>|<Aufgabenschlüssel>`, z. B. `passive|thecontract…`): Felder des Eintrags (meist `why`) in
// scripts/grammar/parts/<thema>/map.json UND src/content/grammar/pattern-map.json.
// c1x-Aufgaben (`kwt-0001`, `err-0039` …) liegen nur in src/content/c1x/src/<art>/*.json; der Build packt sie (scripts/content).
// Ein Feldwert `null` löscht das Feld. Danach `npm run grammar:check` und der Aufgaben-Spieler (tests/unit/taskPlayer.test.ts).
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, legacyTaskKey } from './lib.mjs';

const PARTS = join(ROOT, 'scripts/grammar/parts');
const SHIPPED = join(ROOT, 'src/content/grammar/tasks-v2.json');
const C1X = join(ROOT, 'src/content/c1x/src');

// Einrückung der Datei bleibt erhalten (die Teile sind mit 0, 1 oder 2 Leerzeichen je Ebene geschrieben), damit der Unterschied nur die Änderung zeigt.
const read = (f) => {
  const raw = readFileSync(f, 'utf8');
  const second = raw.split('\n')[1] ?? '';
  const unit = /^\s*/.exec(second)[0].length;
  return { raw, data: JSON.parse(raw), nl: raw.endsWith('\n'), unit };
};
const files = new Map();
const write = (f, data, nl) => {
  const unit = files.get(f) ?? 1;
  const text = JSON.stringify(data, null, 1).replace(/^( +)/gm, (sp) => ' '.repeat(sp.length * unit));
  writeFileSync(f, text + (nl ? '\n' : ''));
};
const readKeep = (f) => {
  const r = read(f);
  if (!files.has(f)) files.set(f, r.unit);
  return r;
};
const topics = () => readdirSync(PARTS).filter((d) => existsSync(join(PARTS, d, 'v2.json'))).sort();
const strip = (t) => {
  const rest = { ...t };
  delete rest.topic;
  return rest;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function partsFlat() {
  const out = [];
  for (const topic of topics()) {
    const f = join(PARTS, topic, 'v2.json');
    const { data } = read(f);
    data.forEach((t, i) => out.push({ topic, file: f, i, t }));
  }
  return out;
}

const [cmd, arg] = process.argv.slice(2);

if (cmd === 'check' || cmd === 'sync') {
  const shipped = read(SHIPPED);
  const flat = partsFlat();
  if (flat.length !== shipped.data.tasks.length) throw new Error(`Anzahl verschieden: Teile ${flat.length}, ausgeliefert ${shipped.data.tasks.length}`);
  const drift = [];
  flat.forEach((p, k) => {
    const s = shipped.data.tasks[k];
    if (s.topic !== p.topic) throw new Error(`Reihenfolge verschieden an Stelle ${k}: ${p.topic} / ${s.topic}`);
    if (!same(strip(s), p.t)) drift.push({ p, s });
  });
  if (cmd === 'check') {
    for (const { p, s } of drift) console.log(`Drift ${p.topic}: ${p.t.id} ↔ ${s.id}`);
    console.log(`Drift: ${drift.length}`);
    process.exit(drift.length ? 1 : 0);
  }
  const byFile = new Map();
  for (const { p, s } of drift) {
    if (!byFile.has(p.file)) byFile.set(p.file, readKeep(p.file));
    byFile.get(p.file).data[p.i] = strip(s);
  }
  for (const [f, { data, nl }] of byFile) write(f, data, nl);
  console.log(`Teile aus der ausgelieferten Datei übernommen: ${drift.length} Aufgaben in ${byFile.size} Dateien`);
} else if (cmd === 'apply') {
  const patch = JSON.parse(readFileSync(arg, 'utf8'));
  const ids = new Set(Object.keys(patch));
  const setFields = (t, fields) => {
    for (const [k, v] of Object.entries(fields)) {
      if (v === null) delete t[k];
      else t[k] = v;
    }
  };
  const shipped = readKeep(SHIPPED);
  const hit = new Set();
  for (const t of shipped.data.tasks) {
    if (!ids.has(t.id)) continue;
    setFields(t, patch[t.id]);
    hit.add(t.id);
  }
  write(SHIPPED, shipped.data, shipped.nl);
  const partHit = new Set();
  for (const topic of topics()) {
    const f = join(PARTS, topic, 'v2.json');
    const r = readKeep(f);
    let changed = false;
    for (const t of r.data) {
      if (!ids.has(t.id)) continue;
      setFields(t, patch[t.id]);
      partHit.add(t.id);
      changed = true;
    }
    if (changed) write(f, r.data, r.nl);
  }
  for (const id of hit) if (!partHit.has(id)) throw new Error(`${id}: in tasks-v2.json, aber nicht in den Teilen`);
  const c1Hit = new Set();
  for (const kind of readdirSync(C1X)) {
    const dir = join(C1X, kind);
    if (!existsSync(dir) || kind.endsWith('.md')) continue;
    for (const file of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const f = join(dir, file);
      const r = readKeep(f);
      let changed = false;
      for (const it of r.data.items ?? []) {
        if (!ids.has(it.id)) continue;
        setFields(it, patch[it.id]);
        c1Hit.add(it.id);
        changed = true;
      }
      if (changed) write(f, r.data, r.nl);
    }
  }
  const mapHit = new Set();
  const mapIds = [...ids].filter((id) => id.includes('|'));
  if (mapIds.length) {
    const pm = join(ROOT, 'src/content/grammar/pattern-map.json');
    const shippedMap = readKeep(pm);
    for (const id of mapIds) {
      const [topic, key] = id.split('|');
      const f = join(PARTS, topic, 'map.json');
      if (!existsSync(f) || !shippedMap.data[id]) continue;
      const r = readKeep(f);
      const prompt = Object.keys(r.data).find((p) => legacyTaskKey(p) === key);
      if (!prompt) continue;
      setFields(r.data[prompt], patch[id]);
      setFields(shippedMap.data[id], patch[id]);
      write(f, r.data, r.nl);
      mapHit.add(id);
    }
    write(pm, shippedMap.data, shippedMap.nl);
  }
  const missing = [...ids].filter((id) => !hit.has(id) && !c1Hit.has(id) && !mapHit.has(id));
  console.log(`geändert: tasks-v2 ${hit.size} (Teile ${partHit.size}), c1x ${c1Hit.size}, Zuordnungen ${mapHit.size}${missing.length ? ` · nicht gefunden: ${missing.join(', ')}` : ''}`);
  if (missing.length) process.exit(1);
} else {
  console.error('Aufruf: q0-patch.mjs sync | check | apply <patch.json>');
  process.exit(2);
}
