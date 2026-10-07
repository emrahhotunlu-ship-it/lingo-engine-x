#!/usr/bin/env node
// P18 Inhalt K1: baut `kwt` und `err` (Kapitel 1–3) aus den Quelldateien scripts/c1x/k1/*.mjs nach
// src/content/c1x/src/{kwt,err}/k1-*.json und prüft jede Aufgabe. Aufruf: node scripts/c1x/build-k1.mjs [--check]
// Quellformat und Prüfregeln: docs/umbau/lernplattform-3.md §3 (Schema-Entwurf), c1-aufgaben.md §3.4/§3.5.
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  ROOT, KAP13, words, norm, kwtNorm, joinAB, contractedForms, scoreKwt, scoreErr, findSpan, applyFix, hasBritish,
  legacyCorpus, patternIndex, chapterOf,
} from './lib.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const idx = patternIndex();
const corpus = legacyCorpus();
const errors = [];
const warns = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const wc = (s) => words(s).length;
const seenSent = new Map();

const uniq = (arr) => [...new Set(arr)];

// ---------- kwt ----------
function buildKwt(src, id) {
  const topic = idx[src.p]?.topic;
  if (!topic) fail(id, `unbekanntes Muster ${src.p}`);
  else if (!KAP13.includes(topic)) fail(id, `Thema ${topic} nicht in Kapitel 1–3`);
  const variants = [{ a: src.a, b: src.b }, ...(src.v ?? [])].map((v) => {
    if (src.nc) return { a: v.a, b: v.b };
    // Kurzformen automatisch ergänzen (Teil A, Teil B und über die Grenze A|B)
    const A = uniq(v.a.flatMap((x) => contractedForms(x)));
    let B = v.b.flatMap((x) => contractedForms(x));
    for (const a of v.a) {
      const last = a.split(' ').pop();
      for (const b of v.b) {
        const j = contractedForms(`${last} ${b}`);
        for (const f of j) if (f.startsWith(last + "'")) B.push(f.slice(last.length));
      }
    }
    // am Lückenanfang nach einem Pronomen (before endet auf I/you/…): „'d have caught“, „'ll be“ usw.
    const bl = (src.before.trim().split(/\s+/).pop() ?? '').toLowerCase();
    if (['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(bl)) {
      for (const x of [...A]) {
        const parts = x.split(' ');
        const alt = contractedForms(`${bl} ${x}`).filter((f) => f.startsWith(bl + "'"));
        for (const f of alt) { const g = f.slice(bl.length); if (words(joinAB(g, '')).includes(src.key.toLowerCase())) A.push(g); void parts; }
      }
    }
    return { a: uniq(A), b: uniq(B) };
  });
  const tilesSrc = variants[0].a[0] + ' ' + variants[0].b[0];
  const tiles = src.tiles ?? words(tilesSrc).filter((w) => w !== src.key.toLowerCase());
  const traps = (src.traps ?? []).map((t) => ({ text: t[0], de: t[1], en: t[2], if: t[3] }));
  const item = {
    id, kind: 'kwt', area: 'gram', pat: src.p, topic, level: src.lv ?? 'C1', dom: src.dom ?? 'biz', src: 'seed',
    lead: src.lead, key: src.key, before: src.before, after: src.after,
    keys: variants, tiles, extra: src.x,
    traps: traps.map((t) => t.text),
    why: {
      ok: { de: src.ok[0], en: src.ok[1] },
      wrong: traps.map((t) => ({ if: t.if ?? uniq(words(t.text)), de: t.de, en: t.en })),
    },
  };
  if (src.trapId) item.trap = src.trapId;
  if (src.h) item._h = 1;
  return item;
}

function checkKwt(it, src) {
  const id = it.id;
  if (!/^[A-Z']+$/.test(it.key)) fail(id, 'Schlüsselwort muss GROSS sein');
  const lw = wc(it.lead);
  if (lw < 6 || lw > 25) fail(id, `Satz A hat ${lw} Wörter (6–25)`);
  if (words(it.lead).includes(it.key.toLowerCase())) fail(id, 'Schlüsselwort steht schon in Satz A');
  if (!it.after || !it.after.trim()) fail(id, 'after fehlt');
  const combos = [];
  for (const k of it.keys) {
    if (!k.a.length || !k.b.length) fail(id, 'Variante ohne Teil A oder B');
    for (const a of k.a) for (const b of k.b) combos.push(joinAB(a, b));
  }
  if (!it.keys[0].a.every((a) => wc(a) <= 3)) fail(id, 'Teil A länger als 3 Wörter');
  if (it.keys.some((k) => k.b.some((b) => !b.trim()))) fail(id, 'leerer Teil B');
  for (const c of combos) {
    const n = kwtNorm(c).length;
    if (n < 3 || n > 6) fail(id, `Lösung „${c}“ hat ${n} Wörter (3–6)`);
    const s = scoreKwt(it, c);
    if (s.got !== 2) fail(id, `Lösung „${c}“ erreicht ${s.got}/2 (${s.reason})`);
    if (!words(c).includes(it.key.toLowerCase())) fail(id, `Lösung „${c}“ enthält das Schlüsselwort nicht unverändert`);
  }
  const full0 = `${it.before} ${combos[0]} ${it.after}`.trim();
  const bw = wc(full0);
  if (bw < 6 || bw > 25) fail(id, `Satz B hat ${bw} Wörter (6–25)`);
  if (norm(full0) === norm(it.lead)) fail(id, 'Satz B gleicht Satz A');
  if (norm(it.lead).includes(norm(combos[0]))) fail(id, 'Lösung steht wörtlich in Satz A');
  // Teil A/B einzeln dürfen nicht schon 2 Punkte geben
  for (const a of it.keys.flatMap((k) => k.a)) {
    const s = scoreKwt(it, a);
    if (s.got === 2) fail(id, `Teil A „${a}“ allein gibt 2 Punkte`);
  }
  // Fallen
  if (!it.traps.length) fail(id, 'keine typische Falle');
  for (const t of it.traps) {
    const s = scoreKwt(it, t);
    if (s.got >= 2) fail(id, `Falle „${t}“ gibt volle Punkte`);
    if (combos.some((c) => norm(c) === norm(t))) fail(id, `Falle „${t}“ ist eine Lösung`);
    if (!words(t).includes(it.key.toLowerCase())) fail(id, `Falle „${t}“ enthält das Schlüsselwort nicht (nie erreichbar)`);
    const tl = kwtNorm(t).length;
    if (tl < 3 || tl > 6) fail(id, `Falle „${t}“ hat ${tl} Wörter (3–6, sonst zählt zuerst „length“)`);
  }
  // Ablenker
  const sol = new Set(uniq(combos.flatMap((c) => kwtNorm(c))));
  const solRaw = new Set(uniq(combos.flatMap((c) => words(c))));
  if (!it.extra || it.extra.length < 2 || it.extra.length > 4) fail(id, 'extra muss 2–4 Ablenker haben');
  for (const x of it.extra ?? []) {
    if (solRaw.has(x.toLowerCase()) || sol.has(x.toLowerCase())) fail(id, `Ablenker „${x}“ steht in einer Lösung`);
  }
  // Texte
  for (const t of [it.lead, it.before, it.after, ...combos, ...it.traps, it.why.ok.en, ...it.why.wrong.map((w) => w.en)]) {
    if (hasBritish(t)) fail(id, `britische Schreibung/Wortwahl in „${t}“`);
  }
  if (it.why.ok.de.length > 300 || it.why.ok.en.length > 300) fail(id, 'why.ok zu lang (>300)');
  for (const w of it.why.wrong) {
    if (w.de.length > 140 || w.en.length > 140) fail(id, `Falle-Begründung zu lang: ${w.de.length}/${w.en.length}`);
    if (!w.de || !w.en) fail(id, 'Begründung ohne de/en');
  }
  // Dubletten
  for (const s of [it.lead, full0]) {
    const n = norm(s);
    if (corpus.has(n)) fail(id, `Dublette zu vorhandenem Inhalt: „${s}“`);
    if (seenSent.has(n)) fail(id, `Dublette zu ${seenSent.get(n)}: „${s}“`);
    seenSent.set(n, id);
  }
}

// ---------- err ----------
let posCounter = 0;
function buildErr(src, id) {
  const topic = idx[src.p]?.topic;
  if (!topic) fail(id, `unbekanntes Muster ${src.p}`);
  else if (!KAP13.includes(topic)) fail(id, `Thema ${topic} nicht in Kapitel 1–3`);
  const it = {
    id, kind: 'err', area: 'gram', pat: src.p, topic, level: src.lv ?? 'C1', dom: src.dom ?? 'biz', src: 'seed',
    text: src.text, bad: null,
  };
  if (src.bad) {
    const [span, fix, ch1, ch2] = [src.bad.span, src.bad.fix, src.bad.ch[0], src.bad.ch[1]];
    const arr = [fix[0], ch1, ch2];
    const rot = src.pos ?? (posCounter++ % 3); // Lösungsposition 0/1/2 reihum für gleichmäßige Verteilung
    const ordered = [];
    ordered[rot] = fix[0];
    const rest = [ch1, ch2];
    for (let i = 0; i < 3; i++) if (ordered[i] === undefined) ordered[i] = rest.shift();
    it.bad = { span, ...(src.bad.nth ? { nth: src.bad.nth } : {}), fix, choices: ordered };
    it.why = {
      ok: { de: src.ok[0], en: src.ok[1] },
      wrong: [
        { opt: ch1, de: src.c1[0], en: src.c1[1] },
        { opt: ch2, de: src.c2[0], en: src.c2[1] },
        { tap: '*', de: `Der Fehler steckt bei „${span}“, nicht hier.`, en: `The mistake is at “${span}”, not here.` },
        { tap: 'none', de: src.miss?.[0] ?? `Doch, hier steckt ein Fehler: „${span}“ ist falsch.`, en: src.miss?.[1] ?? `There is a mistake: “${span}” is wrong.` },
      ],
    };
    void arr;
  } else {
    it.why = {
      ok: { de: src.ok[0], en: src.ok[1] },
      wrong: (src.fa ?? []).map((f) => ({ tap: f[0], de: f[1], en: f[2] })),
    };
  }
  if (src.trapId) it.trap = src.trapId;
  if (src.h) it._h = 1;
  return it;
}

function checkErr(it) {
  const id = it.id;
  const w = wc(it.text);
  if (w < 6 || w > 25) fail(id, `Satz hat ${w} Wörter (6–25)`);
  if (hasBritish(it.text)) fail(id, `britische Schreibung in „${it.text}“`);
  if (corpus.has(norm(it.text))) fail(id, `Dublette zu vorhandenem Inhalt: „${it.text}“`);
  if (seenSent.has(norm(it.text))) fail(id, `Dublette zu ${seenSent.get(norm(it.text))}`);
  seenSent.set(norm(it.text), id);
  if (it.why.ok.de.length > 300 || it.why.ok.en.length > 300) fail(id, 'why.ok zu lang');
  for (const r of it.why.wrong) {
    if (r.de.length > 140 || r.en.length > 140) fail(id, `Regel zu lang (${r.de.length}/${r.en.length}): ${r.opt ?? r.tap}`);
  }
  if (!it.bad) {
    if (!it.why.wrong.length) fail(id, 'fehlerfreier Satz ohne Fehlalarm-Begründung (fa)');
    for (const r of it.why.wrong) {
      if (r.tap && r.tap !== '*' && !it.text.split(/\s+/).map((w) => w.replace(/[.,;:!?"“”]/g, '').toLowerCase()).includes(r.tap.toLowerCase())) fail(id, `fa-Wort „${r.tap}“ steht nicht im Satz`);
    }
    const s = scoreErr(it, 'none');
    if (s.got !== 2) fail(id, 'Kein Fehler ≠ 2/2');
    return;
  }
  const b = it.bad;
  const start = findSpan(it.text, b);
  if (start < 0) { fail(id, `Spanne „${b.span}“ nicht im Satz`); return; }
  const fixed = applyFix(it.text, b, b.fix[0]);
  if (norm(fixed) === norm(it.text)) fail(id, 'Korrektur ändert den Satz nicht');
  if (!b.choices.includes(b.fix[0])) fail(id, 'fix[0] nicht in choices');
  const inFix = b.choices.filter((c) => b.fix.some((f) => norm(f) === norm(c)));
  if (inFix.length !== 1) fail(id, `${inFix.length} choices sind richtig (genau 1 erlaubt)`);
  if (new Set(b.choices.map(norm)).size !== 3) fail(id, 'choices nicht verschieden');
  if (b.choices.some((c) => norm(c) === norm(b.span))) fail(id, 'eine Wahl gleicht dem Fehler');
  for (const c of b.choices) if (hasBritish(c)) fail(id, 'britische Schreibung in choices');
  if (scoreErr(it, start, b.fix[0]).got !== 2) fail(id, 'Fundort + Korrektur ≠ 2/2');
  if (scoreErr(it, start, 'zzz').got !== 1) fail(id, 'nur Fundort ≠ 1/2');
  if (scoreErr(it, 'none').got !== 0) fail(id, '„Kein Fehler“ im Fehlersatz ≠ 0');
  if (it.why.wrong.some((r) => r.opt && !b.choices.includes(r.opt))) fail(id, 'opt-Regel ohne passende Wahl');
  // Fehlstelle: der Satz mit falscher Wahl darf nicht dem richtigen gleichen
  for (const c of b.choices.filter((x) => !inFix.includes(x))) {
    if (norm(applyFix(it.text, b, c)) === norm(fixed)) fail(id, 'falsche Wahl ergibt den richtigen Satz');
  }
}

// ---------- Lauf ----------
const out = { kwt: {}, err: {} };
const stats = { kwt: { total: 0, harvest: 0, byTopic: {} }, err: { total: 0, harvest: 0, free: 0, byTopic: {}, pos: [0, 0, 0] } };
for (const kind of ['kwt', 'err']) {
  const dir = join(ROOT, 'scripts/c1x/k1');
  const files = readdirSync(dir).filter((f) => f.startsWith(kind + '-') && f.endsWith('.mjs')).sort();
  for (const f of files) {
    const m = await import(pathToFileURL(join(dir, f)).href);
    const built = [];
    m.items.forEach((s, i) => {
      const id = `${kind}-${String(m.meta.start + i).padStart(4, '0')}`;
      try {
        const it = kind === 'kwt' ? buildKwt(s, id) : buildErr(s, id);
        kind === 'kwt' ? checkKwt(it, s) : checkErr(it);
        built.push(it);
      } catch (e) { fail(id, `Quelle unlesbar: ${e.message}`); }
    });
    out[kind][m.meta.file] = built;
    const free = built.filter((x) => kind === 'err' && !x.bad).length;
    console.log(`${kind}/${m.meta.file}: ${built.length} Aufgaben${kind === 'err' ? `, davon ${free} fehlerfrei (${Math.round((free / built.length) * 100)} %)` : ''}`);
    for (const it of built) {
      stats[kind].total++;
      if (it._h) stats[kind].harvest++;
      stats[kind].byTopic[it.topic] = (stats[kind].byTopic[it.topic] ?? 0) + 1;
      if (kind === 'err' && !it.bad) stats.err.free++;
      if (kind === 'err' && it.bad) stats.err.pos[it.bad.choices.indexOf(it.bad.fix[0])]++;
    }
  }
}
console.log(JSON.stringify(stats));
for (const w of warns) console.warn('WARN ' + w);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:\n` + errors.join('\n'));
  process.exit(1);
}
if (!CHECK_ONLY) {
  for (const kind of ['kwt', 'err']) {
    for (const [file, items] of Object.entries(out[kind])) {
      const dir = join(ROOT, 'src/content/c1x/src', kind);
      mkdirSync(dir, { recursive: true });
      const clean = items.map(({ _h, ...r }) => r);
      writeFileSync(join(dir, `${file}.json`), JSON.stringify({ v: 1, items: clean }, null, 1) + '\n');
    }
  }
  console.log('geschrieben.');
}
