#!/usr/bin/env node
// Warum-Länge (Relaunch Stufe 1, P3 S1-BAND, docs/relaunch/stufe1-plan.md §6.4): Das Band ist für 140 Zeichen gebaut
// (`WhyRule.de/en` in src/domain/explain/types.ts), das Ziel sind 120. Dieses Skript LISTET alle Warum-Texte über 120 Zeichen
// für den Inhaltsstrang; es kürzt nichts und ändert keine Datei (Stufe 1 ändert keine Inhalte).
//
// Gelesen werden alle JSON-Dateien unter src/content/: jede `why`-Angabe ({ ok: {de,en}, wrong: [{de,en,…}] }) und jede
// Regel-Liste `wrong: [{de,en}]`. Ausgabe: eine Zeile je Text (Länge, Sprache, Datei, Pfad, Anfang), am Ende die Summen.
// Optionen: --limit <n> (Standard 120) · --json (maschinenlesbar).

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const CONTENT = join(ROOT, 'src', 'content');
const args = process.argv.slice(2);
const at = args.indexOf('--limit');
const LIMIT = at >= 0 ? Number(args[at + 1]) : 120;
const AS_JSON = args.includes('--json');

/** @param {string} dir @returns {string[]} */
function jsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...jsonFiles(p));
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

/** @param {unknown} v */
const isBi = (v) => !!v && typeof v === 'object' && typeof v.de === 'string' && typeof v.en === 'string';

/** Sammelt Warum-Texte: `why.ok`, `why.wrong[]` und jede Liste `wrong: [{de,en}]`. */
function collect(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => collect(x, `${path}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k;
    if (k === 'why' && v && typeof v === 'object' && !Array.isArray(v) && isBi(v.ok)) out.push({ path: `${p}.ok`, rule: v.ok });
    if (k === 'wrong' && Array.isArray(v)) v.forEach((r, i) => isBi(r) && out.push({ path: `${p}[${i}]`, rule: r }));
    collect(v, p, out);
  }
}

const rows = [];
let total = 0;
for (const file of jsonFiles(CONTENT).sort()) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`übersprungen (kein gültiges JSON): ${relative(ROOT, file)} – ${err instanceof Error ? err.message : String(err)}`);
    continue;
  }
  const found = [];
  collect(data, '', found);
  const seen = new Set();
  for (const f of found) {
    if (seen.has(f.path)) continue;
    seen.add(f.path);
    total += 1;
    for (const lang of ['de', 'en']) {
      const text = f.rule[lang];
      const len = [...text].length;
      if (len > LIMIT) rows.push({ file: relative(ROOT, file), path: f.path, lang, len, text });
    }
  }
}

rows.sort((a, b) => b.len - a.len || a.file.localeCompare(b.file));
if (AS_JSON) {
  console.log(JSON.stringify({ limit: LIMIT, texts: total, over: rows.length, rows }, null, 2));
} else {
  for (const r of rows) console.log(`${String(r.len).padStart(3)}  ${r.lang}  ${r.file}  ${r.path}  ${r.text.slice(0, 60)}${r.text.length > 60 ? '…' : ''}`);
  const de = rows.filter((r) => r.lang === 'de').length;
  console.log(`\nWarum-Texte geprüft: ${total} · über ${LIMIT} Zeichen: ${rows.length} (de ${de}, en ${rows.length - de}) · längster: ${rows[0] ? `${rows[0].len} Zeichen (${rows[0].lang}, ${rows[0].file})` : '–'}`);
  console.log('Nur Liste, nichts gekürzt (Stufe 1 ändert keine Inhalte).');
}
