#!/usr/bin/env node
// P41 Inhalt C1-Check (Lernplattform 3.0 §4.3): baut die Check-Formen A–C aus scripts/c1x/check/{anchor,a,b,c}.mjs nach
// src/content/c1x/src/check/{anchor,a,b,c}.json. Aufruf: node scripts/c1x/build-check.mjs [--check].
//
// Aufbau: 4 Ankeraufgaben (je 1 mcc · ocl · wf · kwt, `probe: true` OHNE `form`, stehen in jeder Form) + je Form 26 eigene Aufgaben
// (7 mcc · 7 ocl · 7 wf · 5 kwt, `probe: true`, `form: 'A'|'B'|'C'`). Eine Form = 30 Aufgaben = 8 mcc + 8 ocl + 8 wf + 6 kwt = 36 Punkte.
// Kennungen fortlaufend über alle Arten ab 2001 (Bereich 2001–2399 für die Formen A–L, docs/umbau/c1x-schema.md).
//
// Quellformate (Feld `k` nennt die Art):
//   mcc: { k, p: Muster oder 'lx.<slug>', area?: 'lex', lex?, lv, dom, t: Satz mit ___, o: [[Lösung], [falsch, Kategorie, 'DE || EN'] × 3], ok: 'DE || EN' }
//   ocl: { k, p, lv, dom, cls, a: [Lösungen], t: Satz mit ___, c: { Chip: 'DE || EN' (genau 3) }, ok: 'DE || EN' }
//   wf:  { k, p: 'lx.wf-*', lv, dom, t, stem, a: [Lösungen], pos, parts, fam: [Wortfamilie], w: { Familienwort: 'DE || EN' }, ok: 'DE || EN' }
//   kwt: { k, p, lv, dom, lead, key, before, after, a: [Teil A], b: [Teil B], v?: [{a, b}], x: [Ablenker], traps: [[Text, DE, EN]], ok: [DE, EN], tiles? }
//
// Vorprüfungen hier: Anzahl je Form und Art, alle sieben Kapitel je Form (mit Ankern), Dubletten (Altbestand, alle übrigen c1x-Inhalte, untereinander),
// keine Lösung verrät eine andere Aufgabe derselben Form, kwt-Mechanik (wie die Kapitelprüfung), Lösungsposition der mcc ausgeglichen.
// Die eigentliche Prüfung (Schema, checkC1Content, Wertung) macht tests/unit/c1xContent.test.ts, die Check-Regeln tests/unit/c1Check.test.ts.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, chapterOf, contractedForms, hasBritish, joinAB, kwtNorm, legacyCorpus, norm, patternIndex, words } from './lib.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const START = 2001;
const LIMIT = 2399;
const FILES = ['anchor', 'a', 'b', 'c'];
const PER_FORM = { mcc: 7, ocl: 7, wf: 7, kwt: 5 };
const PER_ANCHOR = { mcc: 1, ocl: 1, wf: 1, kwt: 1 };
const CHAPTERS = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7'];
// Lösungsposition der mcc: jeder Platz gleich oft, gemischt.
const POS = [0, 1, 2, 3, 2, 0, 3, 1];

const idx = patternIndex();
const corpus = legacyCorpus();
const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const wc = (s) => words(s).length;
const uniq = (arr) => [...new Set(arr)];
const seenSent = new Map();

function existingC1x() {
  const out = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'check') walk(p);
      } else if (e.name.endsWith('.json')) {
        for (const it of JSON.parse(readFileSync(p, 'utf8')).items) {
          for (const s of [it.text, it.lead, it.sa, it.sb, it.a]) if (typeof s === 'string') out.add(norm(s.replace(/_{3,}/g, ' ')));
        }
      }
    }
  };
  walk(join(ROOT, 'src/content/c1x/src'));
  return out;
}
const existing = existingC1x();

const bi = (s, id) => {
  const [de, en] = s.split(' || ');
  if (!de || !en) fail(id, `Text ohne „ || “: ${s.slice(0, 40)}`);
  return { de: (de ?? '').trim(), en: (en ?? '').trim() };
};

function dupCheck(id, ...sentences) {
  for (const s of sentences) {
    const n = norm(s.replace(/_{3,}/g, ' '));
    if (corpus.has(n)) fail(id, `Dublette zu vorhandenem Inhalt: „${s}“`);
    if (existing.has(n)) fail(id, `Dublette zu vorhandener c1x-Aufgabe: „${s}“`);
    if (seenSent.has(n)) fail(id, `Dublette zu ${seenSent.get(n)}: „${s}“`);
    seenSent.set(n, id);
  }
}

function lengths(id, why) {
  if (why.ok.de.length > 240 || why.ok.en.length > 240) fail(id, `why.ok zu lang (${why.ok.de.length}/${why.ok.en.length}, max 240)`);
  for (const r of why.wrong) if (r.de.length > 140 || r.en.length > 140) fail(id, `Begründung zu lang (${r.de.length}/${r.en.length}, max 140): ${r.de.slice(0, 30)}`);
}

function base(src, id, kind, form) {
  const gram = src.area !== 'lex' && !src.p.startsWith('lx.');
  const item = { id, kind, area: gram ? 'gram' : 'lex', pat: src.p };
  if (gram) {
    const topic = idx[src.p]?.topic;
    if (!topic) fail(id, `unbekanntes Muster ${src.p}`);
    item.topic = topic;
  } else if (!src.p.startsWith('lx.')) fail(id, 'lex braucht lx.<slug>');
  if (src.lex?.length) item.lex = src.lex;
  Object.assign(item, { level: src.lv ?? 'B2+', dom: src.dom ?? 'biz', src: 'seed', probe: true });
  if (form) item.form = form;
  return item;
}

// ---------- mcc ----------
let mccN = 0;
function buildMcc(src, id, form) {
  const item = base(src, id, 'mcc', form);
  if (src.o.length !== 4) fail(id, 'genau 4 Optionen');
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t.replace(/_{3,}/g, 'x'));
  if (n < 8 || n > 30) fail(id, `${n} Wörter (8–30)`);
  const pos = POS[mccN++ % POS.length];
  const [right, ...wrong] = src.o;
  const opts = wrong.map((w) => w[0]);
  opts.splice(pos, 0, right[0]);
  Object.assign(item, { text: src.t, options: opts, answer: pos });
  item.why = { ok: bi(src.ok, id), wrong: wrong.map((w) => ({ opt: w[0], cat: w[1], ...bi(w[2], id) })) };
  if (hasBritish(src.t) || opts.some(hasBritish)) fail(id, 'britische Schreibung');
  lengths(id, item.why);
  dupCheck(id, src.t);
  return item;
}

// ---------- ocl ----------
function buildOcl(src, id, form) {
  const item = base(src, id, 'ocl', form);
  const chips = Object.keys(src.c);
  if (chips.length !== 3) fail(id, 'genau 3 Chips');
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t.replace(/_{3,}/g, 'x'));
  if (n < 8 || n > 30) fail(id, `${n} Wörter (8–30)`);
  for (const a of src.a) if (!/^[A-Za-z']+$/.test(a)) fail(id, `Lösung „${a}“ nicht [A-Za-z']`);
  for (const c of chips) if (src.a.map((x) => x.toLowerCase()).includes(c.toLowerCase())) fail(id, `Chip „${c}“ ist eine Lösung`);
  Object.assign(item, { text: src.t, accept: src.a, cls: src.cls, chips });
  item.why = { ok: bi(src.ok, id), wrong: chips.map((c) => ({ if: [c], ...bi(src.c[c], id) })) };
  if (hasBritish(src.t)) fail(id, 'britische Schreibung');
  lengths(id, item.why);
  dupCheck(id, src.t);
  return item;
}

// ---------- wf ----------
function buildWf(src, id, form) {
  const item = base(src, id, 'wf', form);
  if (!src.p.startsWith('lx.wf-')) fail(id, 'wf braucht lx.wf-<art>');
  item.lex = src.lex ?? [src.a[0]];
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t.replace(/_{3,}/g, 'x'));
  if (n < 6 || n > 30) fail(id, `${n} Wörter (6–30)`);
  for (const a of src.a) if (!src.fam.includes(a)) fail(id, `Lösung „${a}“ fehlt in fam`);
  const wrongFam = src.fam.filter((f) => !src.a.includes(f));
  for (const f of wrongFam) if (!src.w[f]) fail(id, `Familienwort „${f}“ ohne Begründung`);
  for (const k of Object.keys(src.w)) if (!wrongFam.includes(k)) fail(id, `Begründung für „${k}“, das kein falsches Familienwort ist`);
  Object.assign(item, { text: src.t, stem: src.stem, accept: src.a, pos: src.pos, parts: src.parts, family: src.fam });
  item.why = { ok: bi(src.ok, id), wrong: wrongFam.map((f) => ({ if: [f], ...bi(src.w[f], id) })) };
  if (hasBritish(src.t) || src.a.some(hasBritish)) fail(id, 'britische Schreibung');
  lengths(id, item.why);
  dupCheck(id, src.t);
  return item;
}

// ---------- kwt (wie scripts/c1x/build-gate1.mjs) ----------
function scoreKwt(item, input) {
  const key = item.key.toLowerCase();
  const toks = kwtNorm(input);
  if (!toks.includes(key)) return { got: 0, reason: 'key' };
  if (toks.length < 3 || toks.length > 6) return { got: 0, reason: 'length' };
  const starts = (arr, pre) => pre.length > 0 && pre.length <= arr.length && pre.every((w, i) => arr[i] === w);
  const ends = (arr, suf) => suf.length > 0 && suf.length <= arr.length && suf.every((w, i) => arr[arr.length - suf.length + i] === w);
  let best = 0;
  for (const k of item.keys) {
    for (const a of k.a.map(kwtNorm)) {
      for (const b of k.b.map(kwtNorm)) {
        const whole = [...a, ...b];
        const full = whole.length === toks.length && whole.every((w, i) => w === toks[i]);
        const got = full ? 2 : starts(toks, a) || ends(toks, b) ? 1 : 0;
        if (got > best) best = got;
      }
    }
  }
  return { got: best, reason: best < 2 ? 'part' : undefined };
}

function buildKwt(src, id, form) {
  const item0 = base(src, id, 'kwt', form);
  const variants = [{ a: src.a, b: src.b }, ...(src.v ?? [])].map((v) => {
    // nc: keine Kurzformen erzeugen (das Schlüsselwort selbst würde verkürzt, z. B. WOULD → wouldn't, 'd).
    if (src.nc) return { a: v.a, b: v.b };
    const A = uniq(v.a.flatMap((x) => contractedForms(x)));
    const B = v.b.flatMap((x) => contractedForms(x));
    for (const a of v.a) {
      const last = a.split(' ').pop();
      for (const b of v.b) {
        for (const f of contractedForms(`${last} ${b}`)) if (f.startsWith(`${last}'`)) B.push(f.slice(last.length));
      }
    }
    const bl = (src.before.trim().split(/\s+/).pop() ?? '').toLowerCase();
    if (['i', 'you', 'we', 'they', 'he', 'she', 'it'].includes(bl)) {
      for (const x of [...A]) {
        for (const f of contractedForms(`${bl} ${x}`).filter((q) => q.startsWith(`${bl}'`))) {
          const g = f.slice(bl.length);
          if (words(joinAB(g, '')).includes(src.key.toLowerCase())) A.push(g);
        }
      }
    }
    return { a: uniq(A), b: uniq(B) };
  });
  const tiles = src.tiles ?? words(`${variants[0].a[0]} ${variants[0].b[0]}`).filter((w) => w !== src.key.toLowerCase());
  const traps = (src.traps ?? []).map((t) => ({ text: t[0], de: t[1], en: t[2], if: t[3] }));
  const item = {
    ...item0, lead: src.lead, key: src.key, before: src.before, after: src.after, keys: variants, tiles, extra: src.x,
    traps: traps.map((t) => t.text),
    why: { ok: { de: src.ok[0], en: src.ok[1] }, wrong: traps.map((t) => ({ if: t.if ?? uniq(words(t.text)), de: t.de, en: t.en })) },
  };
  checkKwt(item);
  return item;
}

function checkKwt(it) {
  const id = it.id;
  if (!/^[A-Z']+$/.test(it.key)) fail(id, 'Schlüsselwort muss GROSS sein');
  const lw = wc(it.lead);
  if (lw < 6 || lw > 25) fail(id, `Satz A hat ${lw} Wörter (6–25)`);
  if (words(it.lead).includes(it.key.toLowerCase())) fail(id, 'Schlüsselwort steht schon in Satz A');
  const combos = [];
  for (const k of it.keys) {
    if (!k.a.length || !k.b.length) fail(id, 'Variante ohne Teil A oder B');
    for (const a of k.a) for (const b of k.b) combos.push(joinAB(a, b));
  }
  if (!it.keys[0].a.every((a) => wc(a) <= 3)) fail(id, 'Teil A länger als 3 Wörter');
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
  for (const a of it.keys.flatMap((k) => k.a)) if (scoreKwt(it, a).got === 2) fail(id, `Teil A „${a}“ allein gibt 2 Punkte`);
  if (!it.traps.length) fail(id, 'keine typische Falle');
  for (const t of it.traps) {
    if (scoreKwt(it, t).got >= 2) fail(id, `Falle „${t}“ gibt volle Punkte`);
    if (combos.some((c) => norm(c) === norm(t))) fail(id, `Falle „${t}“ ist eine Lösung`);
    if (!words(t).includes(it.key.toLowerCase())) fail(id, `Falle „${t}“ enthält das Schlüsselwort nicht`);
    const tl = kwtNorm(t).length;
    if (tl < 3 || tl > 6) fail(id, `Falle „${t}“ hat ${tl} Wörter (3–6)`);
  }
  const sol = new Set(uniq(combos.flatMap((c) => [...words(c), ...kwtNorm(c)])));
  if (!it.extra || it.extra.length < 2 || it.extra.length > 4) fail(id, 'extra muss 2–4 Ablenker haben');
  for (const x of it.extra ?? []) if (sol.has(x.toLowerCase())) fail(id, `Ablenker „${x}“ steht in einer Lösung`);
  for (const t of [it.lead, it.before, it.after, ...combos, ...it.traps, it.why.ok.en, ...it.why.wrong.map((w) => w.en)]) if (hasBritish(t)) fail(id, `britische Schreibung in „${t}“`);
  lengths(id, it.why);
  dupCheck(id, it.lead, full0);
}

// ---------- Verraten: eine Lösung darf in keiner anderen Aufgabe derselben Form sichtbar stehen ----------
// Geprüft wird die ganze Lösung (mcc-Antwort, jede ocl-/wf-Lösung, jede kwt-Lösung, als Wortfolge) gegen die sichtbaren Sätze und Optionen der
// anderen Aufgaben; einzelne Funktionswörter (had, would, being, before …) zählen nicht, sie kommen in fast jedem Satz vor.
const FUNCTION = new Set(['about', 'after', 'before', 'being', 'better', 'could', 'having', 'never', 'other', 'should', 'since', 'their', 'there', 'these', 'those', 'under', 'unless', 'until', 'where', 'whether', 'which', 'while', 'whose', 'within', 'would']);
const visible = (it) => [it.text, it.lead, it.before, it.after, ...(it.options ?? []), ...(it.chips ?? [])].filter((s) => typeof s === 'string').map(norm);
function solutions(it) {
  if (it.kind === 'mcc') return [it.options[it.answer]];
  if (it.kind === 'ocl' || it.kind === 'wf') return it.accept;
  return it.keys.flatMap((k) => k.a.flatMap((a) => k.b.map((b) => joinAB(a, b))));
}
function giveAway(form, list) {
  for (const it of list) {
    for (const s of solutions(it).map(norm)) {
      if (!s.includes(' ') && (s.length <= 4 || FUNCTION.has(s))) continue;
      for (const other of list) {
        if (other === it) continue;
        if (visible(other).some((v) => ` ${v} `.includes(` ${s} `))) fail(it.id, `Form ${form}: Lösung „${s}“ steht sichtbar in ${other.id}`);
      }
    }
  }
}

// ---------- Lauf ----------
const out = [];
let n = START;
for (const f of FILES) {
  const mod = await import(pathToFileURL(join(ROOT, 'scripts/c1x/check', `${f}.mjs`)).href);
  const items = [];
  for (const src of mod.items) {
    const id = `${src.k}-${String(n++).padStart(4, '0')}`;
    try {
      const build = { mcc: buildMcc, ocl: buildOcl, wf: buildWf, kwt: buildKwt }[src.k];
      if (!build) fail(id, `unbekannte Art ${src.k}`);
      else items.push(build(src, id, mod.meta.form));
    } catch (e) {
      fail(id, `Quelle unlesbar (${f}.mjs): ${e.message}`);
    }
  }
  out.push({ file: mod.meta.file, form: mod.meta.form, items });
}
if (n - 1 > LIMIT) fail('ids', `Kennungen bis ${n - 1}, erlaubt bis ${LIMIT}`);

const anchor = out.find((x) => x.form === null);
for (const set of out) {
  const want = set.form === null ? PER_ANCHOR : PER_FORM;
  for (const [k, c] of Object.entries(want)) {
    const got = set.items.filter((x) => x.kind === k).length;
    if (got !== c) fail(set.file, `${got} ${k} statt ${c}`);
  }
  if (set.form === null) continue;
  const all = [...anchor.items, ...set.items];
  const chapters = new Set(all.filter((x) => x.area === 'gram').map((x) => chapterOf(x.topic)));
  for (const c of CHAPTERS) if (!chapters.has(c)) fail(set.file, `Kapitel ${c} fehlt in Form ${set.form}`);
  const pats = all.map((x) => x.pat);
  const dupPat = pats.filter((p, i) => pats.indexOf(p) !== i && !p.startsWith('lx.wf-'));
  if (dupPat.length) fail(set.file, `Muster doppelt in Form ${set.form}: ${uniq(dupPat).join(', ')}`);
  giveAway(set.form, all);
}

const flat = out.flatMap((x) => x.items);
const posCount = [0, 0, 0, 0];
for (const x of flat) if (x.kind === 'mcc') posCount[x.answer]++;
const biz = flat.filter((x) => x.dom === 'biz').length;
console.log(`check: ${flat.length} Aufgaben (${out.map((x) => `${x.file} ${x.items.length}`).join(', ')}), Kennungen ${START}–${n - 1}`);
console.log(`mcc-Lösungsposition ${posCount.join('/')}, Beruf ${biz} (${Math.round((biz / flat.length) * 100)} %), Alltag ${flat.length - biz}`);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:\n${errors.join('\n')}`);
  process.exit(1);
}
if (!CHECK_ONLY) {
  const dir = join(ROOT, 'src/content/c1x/src/check');
  mkdirSync(dir, { recursive: true });
  for (const set of out) writeFileSync(join(dir, `${set.file}.json`), `${JSON.stringify({ v: 1, items: set.items }, null, 1)}\n`);
  console.log('geschrieben.');
}
