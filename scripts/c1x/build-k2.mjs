#!/usr/bin/env node
// P21 Inhalt K2: baut `ocl` und `mcc` (Kapitel 1–3) aus den Quelldateien scripts/c1x/k2/*.mjs nach src/content/c1x/src/{ocl,mcc}/k2-*.json.
// Aufruf: node scripts/c1x/build-k2.mjs [--check]. Die eigentliche Prüfung (Schema, checkC1Content, Wertung, Dubletten, Lösungsposition) macht
// tests/unit/c1xContent.test.ts; hier stehen nur die Formatwandlung und ein paar schnelle Vorprüfungen.
//
// Quellformat ocl: { p: Muster, lv, dom, t: Satz mit ___, a: [Lösungen], cls, c: { Chip: 'DE || EN', … (genau 3) }, ok: 'DE || EN', lex?: [...] }
// Quellformat mcc: { p: Muster oder 'lx.<slug>', lv, dom, area?: 'lex', lex?: [...], t: Satz mit ___, o: [[Wort, Kategorie|null, 'DE || EN'] × 4, Lösung zuerst], ok: 'DE || EN' }
// Die Lösung steht in der Quelle immer zuerst; der Build setzt sie auf den geplanten Platz (jeder Platz genau ein Viertel).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const ROOT = new URL('../../', import.meta.url).pathname;
const CHECK_ONLY = process.argv.includes('--check');
const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const bi = (s, id) => {
  const [de, en] = s.split(' || ');
  if (!de || !en) fail(id, `Text ohne „ || “: ${s.slice(0, 40)}`);
  return { de: (de ?? '').trim(), en: (en ?? '').trim() };
};
const wc = (s) => s.split(/\s+/).filter(Boolean).length;

// Themen der Kapitel 1–3 je Muster (aus src/content/grammar/patterns/*.json)
const topicOfPattern = new Map();
const KAP13 = ['pres-simple-cont', 'past-simple-perfect', 'pres-perf-cont', 'future-forms', 'time-clauses', 'c1-hedging', 'future-perf-cont', 'past-perfect', 'used-to', 'c1-diplomacy', 'conditionals', 'cond-alt', 'mixed-cond', 'relative'];
for (const t of KAP13) {
  const d = JSON.parse(readFileSync(join(ROOT, 'src/content/grammar/patterns', `${t}.json`), 'utf8'));
  for (const p of d.patterns) topicOfPattern.set(p.id, t);
}

// Platzfolge: acht Plätze enthalten jeden Platz genau zweimal, gemischt.
const POS = [0, 1, 2, 3, 2, 0, 3, 1];

function base(src, id, kind, i) {
  const gram = src.area !== 'lex';
  const item = { id, kind, area: gram ? 'gram' : 'lex', pat: src.p };
  if (gram) {
    const topic = topicOfPattern.get(src.p);
    if (!topic) fail(id, `unbekanntes Muster ${src.p}`);
    item.topic = topic;
  } else if (!src.p.startsWith('lx.')) fail(id, 'lex braucht lx.<slug>');
  if (src.lex?.length) item.lex = src.lex;
  Object.assign(item, { level: src.lv ?? 'B2+', dom: src.dom ?? 'biz', src: 'seed' });
  void i;
  return item;
}

function buildOcl(src, id) {
  const item = base(src, id, 'ocl');
  const chips = Object.keys(src.c);
  if (chips.length !== 3) fail(id, 'genau 3 Chips');
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t);
  if (n < 8 || n > 30) fail(id, `${n} Wörter`);
  Object.assign(item, { text: src.t, accept: src.a, cls: src.cls, chips });
  item.why = {
    ok: bi(src.ok, id),
    wrong: chips.map((c) => ({ if: [c], ...bi(src.c[c], id) })),
  };
  return item;
}

function buildMcc(src, id, pos) {
  const item = base(src, id, 'mcc');
  if (src.o.length !== 4) fail(id, 'genau 4 Optionen');
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t);
  if (n < 8 || n > 30) fail(id, `${n} Wörter`);
  const [right, ...wrong] = src.o;
  const words = wrong.map((w) => w[0]);
  words.splice(pos, 0, right[0]);
  Object.assign(item, { text: src.t, options: words, answer: pos });
  // Ein calque-Ablenker nur, wo ein Deutscher es wirklich sagt (Gegenlesung K2): nicht erzwungen; der Test verlangt ihn bei mindestens 80 % der Aufgaben.
  item.why = {
    ok: bi(src.ok, id),
    wrong: wrong.map((w) => ({ opt: w[0], cat: w[1], ...bi(w[2], id) })),
  };
  return item;
}

async function main() {
  const dir = join(ROOT, 'scripts/c1x/k2');
  const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
  const out = { ocl: [], mcc: [] };
  let oclN = 0;
  let mccN = 0;
  for (const f of files) {
    const kind = f.startsWith('ocl') ? 'ocl' : 'mcc';
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const items = [];
    for (const src of mod.items) {
      if (kind === 'ocl') {
        oclN++;
        items.push(buildOcl(src, `ocl-${String(oclN).padStart(4, '0')}`));
      } else {
        const pos = POS[mccN % POS.length];
        mccN++;
        items.push(buildMcc(src, `mcc-${String(mccN).padStart(4, '0')}`, pos));
      }
    }
    out[kind].push({ file: `${mod.meta.file}.json`, items });
  }
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`ocl ${oclN}, mcc ${mccN}`);
  if (CHECK_ONLY) return;
  for (const kind of ['ocl', 'mcc']) {
    mkdirSync(join(ROOT, 'src/content/c1x/src', kind), { recursive: true });
    for (const f of out[kind]) writeFileSync(join(ROOT, 'src/content/c1x/src', kind, f.file), `${JSON.stringify({ v: 1, items: f.items }, null, 1)}\n`);
  }
}
main();
