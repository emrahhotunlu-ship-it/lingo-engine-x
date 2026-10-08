#!/usr/bin/env node
// Mechanische Kontrolle der kwt (Logik wie check-gate1-kwt.mjs, für beliebige Dateien): Lösung 3–6 Wörter (Cambridge-Zählung), Teil A ≤ 3 Wörter,
// Bausteine = erste Lösung (ohne Schlüsselwort), Großschreibung. Aufruf: node scripts/c1x/check-kwt.mjs [Datei …] (Standard: die C1-Check-Formen).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, joinAB, kwtNorm, words } from './lib.mjs';

const args = process.argv.slice(2);
const files = args.length ? args : ['anchor', 'a', 'b', 'c'].map((f) => join(ROOT, 'src/content/c1x/src/check', `${f}.json`));
const items = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).items.filter((i) => i.kind === 'kwt'));
const bad = [];
let sols = 0;
for (const it of items) {
  const first = it.keys[0];
  for (const k of it.keys) {
    for (const a of k.a) {
      if (words(a).length > 3 && k !== first) bad.push(`${it.id}: Teil A „${a}“ hat ${words(a).length} Wörter`);
      if (words(a).length > 3 && k === first && a === k.a[0]) bad.push(`${it.id}: erstes Teil A „${a}“ > 3 Wörter`);
      for (const b of k.b) {
        sols++;
        const n = kwtNorm(joinAB(a, b)).length;
        if (n < 3 || n > 6) bad.push(`${it.id}: Lösung „${joinAB(a, b)}“ hat ${n} Wörter`);
      }
    }
  }
  const sol = words(joinAB(first.a[0], first.b[0])).filter((w) => w !== it.key.toLowerCase());
  const tiles = it.tiles.map((t) => t.toLowerCase());
  if ([...sol].sort().join('|') !== [...tiles].sort().join('|')) bad.push(`${it.id}: Bausteine [${it.tiles}] ≠ erste Lösung [${sol}]`);
  for (const t of it.tiles) if (t === 'i') bad.push(`${it.id}: Baustein „i“ klein`);
  const full = `${it.before} ${joinAB(first.a[0], first.b[0])} ${it.after}`.trim();
  if (it.before.trim()) {
    if (!/^[A-Z]/.test(full)) bad.push(`${it.id}: Satz B beginnt klein: „${full}“`);
  } else {
    // Die Lücke steht am Satzanfang: der erste Baustein (oder das Schlüsselwort) muss groß erscheinen.
    const w0 = words(first.a[0])[0] ?? '';
    const shown = w0 === it.key.toLowerCase() ? it.key : (it.tiles.find((t) => t.toLowerCase() === w0) ?? w0);
    if (!/^[A-Z]/.test(shown)) bad.push(`${it.id}: erstes Wort am Satzanfang klein: „${shown}“`);
  }
  if (!/^[A-Z]/.test(it.lead)) bad.push(`${it.id}: Satz A beginnt klein`);
  if (/\bi\b/.test(`${it.lead} ${full}`)) bad.push(`${it.id}: „i“ klein im Satz`);
  // Wörter, die im Satz groß stehen (Namen, Wochentage, Monate), müssen als Baustein groß sein.
  for (const w of full.split(/\s+/)) {
    const c = w.replace(/[.,;:!?"“”']/g, '');
    if (/^[A-Z][a-z]+$/.test(c) && !full.startsWith(w)) {
      const t = it.tiles.find((x) => x.toLowerCase() === c.toLowerCase());
      if (t && t !== c) bad.push(`${it.id}: Baustein „${t}“ ≠ Satz „${c}“`);
    }
  }
}
console.log(`${items.length} kwt, ${sols} Lösungen geprüft`);
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log('mechanische Kontrolle: ohne Befund');
