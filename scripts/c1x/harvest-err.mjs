#!/usr/bin/env node
// Ernte-Skript für `err`: listet Kandidaten für „Fehler finden“ aus den Regel-Fallen (legacy/rules.json, c1/toolkit.json)
// und den Drills der Deutsch-Fallen (nb/traps.ts) für die Themen der Kapitel 1–3. Gibt je Kandidat Satz, Fassung und die
// automatisch ermittelte einzelne Abweichung (Wortvergleich) aus; Kandidaten mit mehr als einer Abweichung werden markiert.
// Aufruf: node scripts/c1x/harvest-err.mjs   (nur Ausgabe, schreibt nichts; ausgewählte Sätze wandern von Hand in scripts/c1x/k1/err-*.mjs)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, KAP13, words } from './lib.mjs';

const J = (f) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'));
const rules = { ...J('src/content/legacy/rules.json').rules, ...J('src/content/c1/toolkit.json').rules };

function diff(bad, good) {
  const a = words(bad);
  const b = words(good);
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  return { span: a.slice(i, a.length - j).join(' '), fix: b.slice(i, b.length - j).join(' ') };
}

let n = 0;
for (const topic of KAP13) {
  for (const t of rules[topic]?.traps ?? []) {
    const d = diff(t.bad, t.good.replace(/^…\s*/, ''));
    n++;
    console.log(`${topic}\n  falsch: ${t.bad}\n  richtig: ${t.good}\n  Spanne: „${d.span}“ → „${d.fix}“\n`);
  }
}
console.log(`${n} Kandidaten aus den Regel-Fallen (Themen Kap. 1–3).`);
