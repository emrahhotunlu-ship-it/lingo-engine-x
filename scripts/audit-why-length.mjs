#!/usr/bin/env node
// Warum-Länge (Relaunch Stufe 1, P3 S1-BAND, docs/relaunch/stufe1-plan.md §6.4): Das Band ist für 140 Zeichen gebaut
// (`WhyRule.de/en` in src/domain/explain/types.ts), das Ziel sind 120. Dieses Skript LISTET alle Warum-Texte über 120 Zeichen
// für den Inhaltsstrang; es kürzt nichts und ändert keine Datei (Stufe 1 ändert keine Inhalte).
//
// Gelesen werden alle JSON-Dateien unter src/content/: jede `why`-Angabe ({ ok: {de,en}, wrong: [{de,en,…}] }) und jede
// Regel-Liste `wrong: [{de,en}]` (Art `why`), dazu (Korrekturrunde P3, Punkt 18) die Merke-Zeilen der Muster (`name` + `form`, so wie
// das Band sie als „Merke“ zeigt; Art `merke`) und die Aufgaben-Erklärungen `expl`/`expl_en` (Art `expl`).
// Ausgabe: eine Zeile je Text (Länge, Art, Sprache, Datei, Pfad, Anfang), am Ende die Summen je Art.
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

/** Sammelt Warum-Texte (`why.ok`, `why.wrong[]`, Listen `wrong: [{de,en}]`), Merke-Zeilen (`name` + `form`) und `expl`/`expl_en`. */
function collect(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((x, i) => collect(x, `${path}[${i}]`, out));
    return;
  }
  if (!node || typeof node !== 'object') return;
  // Muster mit Name und Form: das Band zeigt „Merke  <Name>: <Form>“ (resultPlan, Zeile `pattern`).
  if (isBi(node.name) && isBi(node.form) && typeof node.id === 'string') {
    out.push({ path: `${path}.name+form`, kind: 'merke', rule: { de: `${node.name.de}: ${node.form.de}`, en: `${node.name.en}: ${node.form.en}` } });
  }
  if (typeof node.expl === 'string' || typeof node.expl_en === 'string') {
    out.push({ path: `${path}.expl`, kind: 'expl', rule: { de: typeof node.expl === 'string' ? node.expl : '', en: typeof node.expl_en === 'string' ? node.expl_en : '' } });
  }
  for (const [k, v] of Object.entries(node)) {
    const p = path ? `${path}.${k}` : k;
    if (k === 'why' && v && typeof v === 'object' && !Array.isArray(v) && isBi(v.ok)) out.push({ path: `${p}.ok`, kind: 'why', rule: v.ok });
    if (k === 'wrong' && Array.isArray(v)) v.forEach((r, i) => isBi(r) && out.push({ path: `${p}[${i}]`, kind: 'why', rule: r }));
    collect(v, p, out);
  }
}

const rows = [];
let total = 0;
/** @type {Record<string, number>} */
const perKind = { why: 0, merke: 0, expl: 0 };
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
    perKind[f.kind] = (perKind[f.kind] ?? 0) + 1;
    for (const lang of ['de', 'en']) {
      const text = f.rule[lang];
      const len = [...text].length;
      if (len > LIMIT) rows.push({ file: relative(ROOT, file), path: f.path, kind: f.kind, lang, len, text });
    }
  }
}

rows.sort((a, b) => b.len - a.len || a.file.localeCompare(b.file));
if (AS_JSON) {
  const kinds = Object.fromEntries(Object.keys(perKind).map((k) => [k, { texts: perKind[k], over: rows.filter((r) => r.kind === k).length, longest: rows.find((r) => r.kind === k)?.len ?? 0 }]));
  console.log(JSON.stringify({ limit: LIMIT, texts: total, over: rows.length, longest: rows[0]?.len ?? 0, kinds, rows }, null, 2));
} else {
  for (const r of rows) console.log(`${String(r.len).padStart(3)}  ${r.kind.padEnd(5)}  ${r.lang}  ${r.file}  ${r.path}  ${r.text.slice(0, 60)}${r.text.length > 60 ? '…' : ''}`);
  const de = rows.filter((r) => r.lang === 'de').length;
  console.log(`\nTexte geprüft: ${total} · über ${LIMIT} Zeichen: ${rows.length} (de ${de}, en ${rows.length - de}) · längster: ${rows[0] ? `${rows[0].len} Zeichen (${rows[0].kind}, ${rows[0].lang}, ${rows[0].file})` : '–'}`);
  for (const k of Object.keys(perKind)) {
    const r = rows.filter((x) => x.kind === k);
    console.log(`  ${k}: ${perKind[k]} Texte · über ${LIMIT}: ${r.length} · längster: ${r[0] ? `${r[0].len} Zeichen (${r[0].lang}, ${r[0].file} ${r[0].path})` : '–'}`);
  }
  console.log('Nur Liste, nichts gekürzt (Stufe 1 ändert keine Inhalte).');
}
