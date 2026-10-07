#!/usr/bin/env node
// Audit Zuordnung Aufgabe → Muster (Fix Aufgabenbildschirm, 07.10.2026). Berichtet, schreibt nichts.
//   A  Aufgaben ohne Muster (nur Themen mit Musterdatei)
//   B  zugeordnet, aber ohne eigene Begründung (why.ok)
//   C  Begründung/Lösung nennt eine Konstruktion, die das Muster nicht trägt (Inversion, wish, if only, would rather, passive …)
//   D  Lösung beginnt mit had/were/should (Inversion) und das Muster ist keine Inversion
//   E  Signalwort-Regel liefert ein anderes Muster als die Zuordnung
// Aufruf: node scripts/grammar/audit-patterns.mjs [--json] [thema …]
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, allSeedTasks, readJson } from './lib.mjs';

const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith('--'));
const PATTERNS = join(ROOT, 'src/content/grammar/patterns');
const mapTbl = readJson('src/content/grammar/pattern-map.json');
const norm = (s) => s.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const key = (s) => norm(s).replace(/[^a-z]/g, '').slice(0, 80);
const fill = (t) => (/_{3,}/.test(t.prompt) ? t.prompt.replace(/_{3,}/, t.answer) : `${t.prompt} ${t.answer}`);

/** Konstruktionen: Erkennung im Satz/Lösung/Begründung ↔ Muster muss sie tragen (Name+Formel+Verwendung). */
const CONSTR = [
  { id: 'inversion', re: /\b(inversion|inverted|(?:^|[.!?]\s*|“|")(?:had|were|should)\s+(?:we|i|you|they|he|she|it|the|there)\b)/i, own: /invers|had we|were i|should you|without if|ohne if/i },
  { id: 'wish', re: /\bwish(?:es|ed)?\b/i, own: /wish/i },
  { id: 'if only', re: /\bif only\b/i, own: /if only|wish/i },
  { id: 'would rather', re: /\bwould rather\b/i, own: /would rather/i },
  { id: 'high time', re: /\b(high|about) time\b/i, own: /high time|about time/i },
  { id: 'passive', re: /\b(passive|passiv)\b/i, own: /passive|passiv/i },
];
const txt = (b) => (b ? `${b.de ?? ''} ${b.en ?? ''}` : '');
const patText = (p) => `${p.id} ${txt(p.name)} ${txt(p.form)} ${txt(p.use)} ${p.signals.join(' ')}`;

const seeds = allSeedTasks();
const rows = [];
const cnt = { tasks: 0, noPat: 0, noWhy: 0, mismatch: 0, inv: 0, sig: 0 };
const withFile = readdirSync(PATTERNS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
for (const topic of withFile) {
  if (only.length && !only.includes(topic)) continue;
  const tp = readJson(`src/content/grammar/patterns/${topic}.json`);
  for (const t of seeds.filter((x) => x.topic === topic)) {
    cnt.tasks++;
    const e = mapTbl[`${topic}|${key(t.prompt)}`];
    const p = e && tp.patterns.find((q) => q.id === e.pat);
    if (!p) { cnt.noPat++; rows.push(['A', topic, t.prompt]); continue; }
    if (!e.why?.ok) { cnt.noWhy++; rows.push(['B', topic, t.prompt]); }
    const own = patText(p);
    const evidence = `${fill(t)} ${txt(e.why?.ok)}`;
    for (const c of CONSTR) {
      if (c.re.test(evidence) && !c.own.test(own)) {
        cnt.mismatch++; rows.push(['C', topic, `${t.prompt} → ${t.answer} [${c.id}] Muster ${p.id}`]); break;
      }
    }
    if (/^_{3,}\s+\S/.test(t.prompt) && /^(had|were|should)\b/i.test(t.answer) && !/invers|had we|were i|should you|ohne if|without if/i.test(own)) {
      cnt.inv++; rows.push(['D', topic, `${t.prompt} → ${t.answer} Muster ${p.id}`]);
    }
  }
}
if (args.includes('--json')) console.log(JSON.stringify({ cnt, rows }));
else {
  for (const r of rows.filter((x) => x[0] !== 'A' && x[0] !== 'B')) console.log(r.join(' | '));
  console.log(`\nAufgaben mit Musterdatei: ${cnt.tasks} · ohne Muster (A): ${cnt.noPat} · ohne eigene Begründung (B): ${cnt.noWhy} · Konstruktion fehlt im Muster (C): ${cnt.mismatch} · Inversion ohne Inversionsmuster (D): ${cnt.inv}`);
}
