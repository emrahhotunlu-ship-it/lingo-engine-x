#!/usr/bin/env node
// P43 Inhalt Kapitelprüfungs-Vorrat 1: baut die Prüfungsaufgaben (`pool: 'gate'`) für die Themen der Kapitel 1–3 aus den Quelldateien
// scripts/c1x/gate1/*.mjs nach src/content/c1x/src/gate/k1.json. Aufruf: node scripts/c1x/build-gate1.mjs [--check].
// Je Thema genau 8 Aufgaben in der Reihenfolge ocl · kwt · err · ocl · kwt · err · ocl · kwt (jedes Paar der Auswahl `gatePair` mischt zwei Arten, vier Versuche
// ziehen nie dieselbe Aufgabe). Die Kennungen laufen quer über alle Arten fortlaufend ab 0701 (die Auswahl sortiert nach der Nummer).
// Quellformate (Feld `k` nennt die Art):
//   ocl: { k, p, lv, dom, cls, a: [Lösungen], t: Satz mit ___, c: { Chip: 'DE || EN' (genau 3) }, ok: 'DE || EN' }
//   kwt: { k, p, lv, dom, lead, key, before, after, a: [Teil A], b: [Teil B], v?: [{a, b}], x: [Ablenker], traps: [[Text, DE, EN]], ok: [DE, EN], trapId? }
//   err: { k, p, lv, dom, text, bad: { span, fix: [], ch: [Chip, Chip] } | null, ok: [DE, EN], c1: [DE, EN], c2: [DE, EN], fa?: [[Wort, DE, EN]], miss?: [DE, EN] }
// Die Kennzeichnung `pool: 'gate'` macht die Aufgaben für jede Übungsrunde unsichtbar (Test c1xSelect). Die eigentliche Prüfung (Schema, checkC1Content, Wertung,
// Dubletten) macht tests/unit/c1xContent.test.ts; hier stehen die Formatwandlung und Vorprüfungen.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, applyFix, contractedForms, findSpan, hasBritish, joinAB, kwtNorm, legacyCorpus, norm, patternIndex, scoreErr, words } from './lib.mjs';

const CHECK_ONLY = process.argv.includes('--check');
const START = 701;
const TOPICS = [
  'pres-simple-cont', 'past-simple-perfect', 'pres-perf-cont', 'past-perfect', 'used-to', 'prep-time', 'stative-adv',
  'future-forms', 'future-perf-cont', 'time-clauses', 'future-past', 'c1-precision',
  'conditionals', 'cond-alt', 'mixed-cond', 'c1-diplomacy',
];
const KIND_ORDER = ['ocl', 'kwt', 'err', 'ocl', 'kwt', 'err', 'ocl', 'kwt'];
const FREE_ERR_TARGET = [8, 12]; // fehlerfreie err-Sätze insgesamt (von 32): 25–35 % im Gesamtbestand

const idx = patternIndex();
const corpus = legacyCorpus();
const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);
const wc = (s) => words(s).length;
const uniq = (arr) => [...new Set(arr)];
const seenSent = new Map();

// Hauptsätze aller bisherigen c1x-Inhalte (außer der Datei, die dieser Lauf neu schreibt) gegen Dubletten.
function existingC1x() {
  const out = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.json') && !p.endsWith('/gate/k1.json')) {
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

function base(src, id, kind) {
  const topic = idx[src.p]?.topic;
  if (!topic) fail(id, `unbekanntes Muster ${src.p}`);
  else if (!TOPICS.includes(topic)) fail(id, `Thema ${topic} nicht in Kapitel 1–3`);
  return { id, kind, area: 'gram', pat: src.p, topic, level: src.lv ?? 'B2+', dom: src.dom ?? 'biz', src: 'seed', pool: 'gate' };
}

function dupCheck(id, ...sentences) {
  for (const s of sentences) {
    const n = norm(s.replace(/_{3,}/g, ' '));
    if (corpus.has(n)) fail(id, `Dublette zu vorhandenem Inhalt: „${s}“`);
    if (existing.has(n)) fail(id, `Dublette zu vorhandener c1x-Aufgabe: „${s}“`);
    if (seenSent.has(n)) fail(id, `Dublette zu ${seenSent.get(n)}: „${s}“`);
    seenSent.set(n, id);
  }
}

// ---------- ocl ----------
function buildOcl(src, id) {
  const item = base(src, id, 'ocl');
  const chips = Object.keys(src.c);
  if (chips.length !== 3) fail(id, 'genau 3 Chips');
  if ((src.t.match(/_{3,}/g) ?? []).length !== 1) fail(id, 'genau eine Lücke');
  const n = wc(src.t.replace(/_{3,}/g, 'x'));
  if (n < 8 || n > 30) fail(id, `${n} Wörter (8–30)`);
  for (const a of src.a) if (!/^[A-Za-z']+$/.test(a)) fail(id, `Lösung „${a}“ nicht [A-Za-z']`);
  for (const c of chips) if (src.a.map((x) => x.toLowerCase()).includes(c.toLowerCase())) fail(id, `Chip „${c}“ ist eine Lösung`);
  Object.assign(item, { text: src.t, accept: src.a, cls: src.cls, chips });
  item.why = { ok: bi(src.ok, id), wrong: chips.map((c) => ({ if: [c], ...bi(src.c[c], id) })) };
  const w = [item.why.ok, ...item.why.wrong];
  if (w[0].de.length > 240 || w[0].en.length > 240) fail(id, 'why.ok zu lang (>240)');
  for (const r of item.why.wrong) if (r.de.length > 140 || r.en.length > 140) fail(id, `Chip-Begründung zu lang ${r.de.length}/${r.en.length}`);
  if (hasBritish(src.t)) fail(id, 'britische Schreibung');
  // Jede Lösung setzt einen grammatisch ganzen Satz zusammen: nur die Wortzahl und Dubletten prüft der Bau.
  dupCheck(id, src.t);
  return item;
}

// ---------- kwt ----------
// Wertung wie src/domain/c1x/kinds/kwt.ts: 2 Punkte nur für die GANZE Lösung (Teil A + Teil B), 1 Punkt, wenn nur A am Anfang oder B am Ende sitzt.
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

function buildKwt(src, id) {
  const item0 = base(src, id, 'kwt');
  const variants = [{ a: src.a, b: src.b }, ...(src.v ?? [])].map((v) => {
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
  if (src.trapId) item.trap = src.trapId;
  checkKwt(item);
  return item;
}

function checkKwt(it) {
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
  const solRaw = new Set(uniq(combos.flatMap((c) => words(c))));
  const sol = new Set(uniq(combos.flatMap((c) => kwtNorm(c))));
  if (!it.extra || it.extra.length < 2 || it.extra.length > 4) fail(id, 'extra muss 2–4 Ablenker haben');
  for (const x of it.extra ?? []) if (solRaw.has(x.toLowerCase()) || sol.has(x.toLowerCase())) fail(id, `Ablenker „${x}“ steht in einer Lösung`);
  for (const t of [it.lead, it.before, it.after, ...combos, ...it.traps, it.why.ok.en, ...it.why.wrong.map((w) => w.en)]) if (hasBritish(t)) fail(id, `britische Schreibung in „${t}“`);
  if (it.why.ok.de.length > 240 || it.why.ok.en.length > 240) fail(id, `why.ok zu lang (${it.why.ok.de.length}/${it.why.ok.en.length}, max 240)`);
  for (const w of it.why.wrong) if (w.de.length > 140 || w.en.length > 140) fail(id, `Falle-Begründung zu lang: ${w.de.length}/${w.en.length}`);
  dupCheck(id, it.lead, full0);
}

// ---------- err ----------
let posCounter = 0;
function buildErr(src, id) {
  const item0 = base(src, id, 'err');
  const it = { ...item0, text: src.text, bad: null };
  if (src.bad) {
    const [span, fix, ch1, ch2] = [src.bad.span, src.bad.fix, src.bad.ch[0], src.bad.ch[1]];
    const rot = src.pos ?? (posCounter++ % 3);
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
  } else {
    it.why = {
      ok: { de: src.ok[0], en: src.ok[1] },
      wrong: [...(src.fa ?? []).map((f) => ({ tap: f[0], de: f[1], en: f[2] })), { tap: '*', de: 'Der Satz ist richtig: An dieser Stelle steckt kein Fehler.', en: 'The sentence is correct: there is no mistake at this spot.' }],
    };
  }
  if (src.trapId) it.trap = src.trapId;
  checkErr(it);
  return it;
}

function checkErr(it) {
  const id = it.id;
  const w = wc(it.text);
  if (w < 6 || w > 25) fail(id, `Satz hat ${w} Wörter (6–25)`);
  if (hasBritish(it.text)) fail(id, 'britische Schreibung');
  dupCheck(id, it.text);
  if (it.why.ok.de.length > 240 || it.why.ok.en.length > 240) fail(id, `why.ok zu lang (${it.why.ok.de.length}/${it.why.ok.en.length}, max 240)`);
  for (const r of it.why.wrong) if (r.de.length > 140 || r.en.length > 140) fail(id, `Regel zu lang (${r.de.length}/${r.en.length}): ${r.opt ?? r.tap}`);
  if (!it.bad) {
    if (!it.why.wrong.length) fail(id, 'fehlerfreier Satz ohne Fehlalarm-Begründung (fa)');
    for (const r of it.why.wrong) {
      if (r.tap && r.tap !== '*' && !it.text.split(/\s+/).map((x) => x.replace(/[.,;:!?"“”]/g, '').toLowerCase()).includes(r.tap.toLowerCase())) fail(id, `fa-Wort „${r.tap}“ steht nicht im Satz`);
    }
    if (scoreErr(it, 'none').got !== 2) fail(id, 'Kein Fehler ≠ 2/2');
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
  if (scoreErr(it, start, b.fix[0]).got !== 2) fail(id, 'Fundort + Korrektur ≠ 2/2');
  if (scoreErr(it, start, 'zzz').got !== 1) fail(id, 'nur Fundort ≠ 1/2');
  if (scoreErr(it, 'none').got !== 0) fail(id, '„Kein Fehler“ im Fehlersatz ≠ 0');
  for (const c of b.choices.filter((x) => !inFix.includes(x))) if (norm(applyFix(it.text, b, c)) === norm(fixed)) fail(id, 'falsche Wahl ergibt den richtigen Satz');
}

// ---------- Lauf ----------
const dir = join(ROOT, 'scripts/c1x/gate1');
const files = readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
const sources = [];
for (const f of files) {
  const m = await import(pathToFileURL(join(dir, f)).href);
  for (const s of m.items) sources.push({ ...s, _file: f });
}
const built = [];
// Ergänzungen tragen eine feste Nummer (`n`, ab 0829) und stehen hinter den 8 Grundaufgaben je Thema; die Grundaufgaben zählen fortlaufend ab 0701.
let baseN = 0;
sources.forEach((s) => {
  const id = `${s.k}-${String(s.n ?? START + baseN++).padStart(4, '0')}`;
  try {
    built.push(s.k === 'ocl' ? buildOcl(s, id) : s.k === 'kwt' ? buildKwt(s, id) : buildErr(s, id));
  } catch (e) {
    fail(id, `Quelle unlesbar (${s._file}): ${e.message}`);
  }
});

// Aufbau: 8 je Thema in KIND_ORDER, jedes Thema der Liste, in der Reihenfolge der Liste.
const byTopic = new Map();
const extraIds = new Set(sources.filter((x) => x.n !== undefined).map((x, i) => `${x.k}-${String(x.n).padStart(4, '0')}`));
for (const it of built) if (!extraIds.has(it.id)) byTopic.set(it.topic, [...(byTopic.get(it.topic) ?? []), it]);
for (const t of TOPICS) {
  const list = byTopic.get(t) ?? [];
  if (list.length !== 8) fail(t, `${list.length} statt 8 Aufgaben`);
  list.forEach((it, i) => { if (it.kind !== KIND_ORDER[i]) fail(it.id, `Platz ${i + 1} im Thema ${t} soll ${KIND_ORDER[i]} sein, ist ${it.kind}`); });
  if (list.length === 8) {
    const pats = new Set(list.map((x) => x.pat));
    if (pats.size < 3) fail(t, `nur ${pats.size} verschiedene Muster (mindestens 3)`);
  }
}
for (const t of byTopic.keys()) if (!TOPICS.includes(t)) fail(t, 'Thema nicht in der Liste');
const order = built.filter((x) => !extraIds.has(x.id)).map((x) => x.topic);
const topicOrder = TOPICS.flatMap((t) => order.filter((x) => x === t));
if (JSON.stringify(order) !== JSON.stringify(topicOrder)) fail('Reihenfolge', 'Aufgaben müssen nach der Themenliste geordnet stehen');

const errs = built.filter((x) => x.kind === 'err');
const ids = built.map((x) => x.id);
if (new Set(ids).size !== ids.length) fail('ids', 'doppelte Kennung');
const free = errs.filter((x) => !x.bad).length;
if (free < FREE_ERR_TARGET[0] || free > FREE_ERR_TARGET[1]) fail('err', `${free} fehlerfreie von ${errs.length} (Ziel ${FREE_ERR_TARGET[0]}–${FREE_ERR_TARGET[1]})`);
const posCount = [0, 0, 0];
for (const x of errs) if (x.bad) posCount[x.bad.choices.indexOf(x.bad.fix[0])]++;
const kinds = Object.fromEntries(['ocl', 'kwt', 'err'].map((k) => [k, built.filter((x) => x.kind === k).length]));
console.log(`gate/k1: ${built.length} Aufgaben ${JSON.stringify(kinds)}, err fehlerfrei ${free}/${errs.length}, Lösungsposition der Chips ${posCount.join('/')}`);
const dom = built.filter((x) => x.dom === 'biz').length;
console.log(`Beruf ${dom} (${Math.round((dom / built.length) * 100)} %), Alltag ${built.length - dom}`);
if (errors.length) {
  console.error(`\n${errors.length} Fehler:\n${errors.join('\n')}`);
  process.exit(1);
}
if (!CHECK_ONLY) {
  const out = join(ROOT, 'src/content/c1x/src/gate');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'k1.json'), `${JSON.stringify({ v: 1, items: built }, null, 1)}\n`);
  console.log('geschrieben.');
}
