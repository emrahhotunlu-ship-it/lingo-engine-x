// Gemeinsame Hilfen für die c1x-Inhalte `kwt` und `err` (P18). Rein, ohne Abhängigkeiten.
// Prüft nach dem Entwurf in docs/umbau/lernplattform-3.md §3 und c1-aufgaben.md §3.4/§3.5. Sobald das echte Schema
// (src/domain/c1x/schema.ts, checkContent) auf dem Branch liegt, gilt dieses; dieser Prüfer bleibt als zweite Kontrolle.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('../../', import.meta.url).pathname;

export const KAP13 = [
  'pres-simple-cont', 'past-simple-perfect', 'pres-perf-cont', 'future-forms', 'time-clauses',
  'c1-hedging', 'future-perf-cont', 'past-perfect', 'used-to', 'c1-diplomacy',
  'conditionals', 'cond-alt', 'mixed-cond',
];

const AUX = { have: "'ve", has: "'s", had: "'d", would: "'d", will: "'ll", am: "'m", is: "'s", are: "'re" };
const PRON = new Set(['i', 'you', 'we', 'they', 'he', 'she', 'it']);
const NEG = [
  ['do not', "don't"], ['does not', "doesn't"], ['did not', "didn't"], ['is not', "isn't"], ['are not', "aren't"],
  ['was not', "wasn't"], ['were not', "weren't"], ['have not', "haven't"], ['has not', "hasn't"], ['had not', "hadn't"],
  ['would not', "wouldn't"], ['will not', "won't"], ['could not', "couldn't"], ['should not', "shouldn't"],
  ['must not', "mustn't"], ['need not', "needn't"],
];

/** Wörter eines Satzes: Kleinschreibung, Satzzeichen weg (Apostrophe in Wörtern bleiben), typografische Apostrophe vereinheitlicht. */
export function words(s) {
  return s
    .replace(/[’‘`]/g, "'")
    .toLowerCase()
    .replace(/[“”"]/g, '')
    .replace(/[.,;:!?()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}
export const norm = (s) => words(s).join(' ');

export const PP = /^(been|gone|done|seen|known|taken|given|made|got|gotten|had|checked|asked|worked|used|met|left|written|finished|sent|signed|decided|started|told|said|become|come|run|won|lost|held|paid|read|built|brought|thought|found|kept|put|set|begun|spoken|grown|chosen|driven|eaten|fallen|forgotten|hidden|shown|thrown|worn|[a-z]+ed)$/;

/** kwtNorm: Kurzformen ausschreiben, so wie Cambridge zählt (I'd = 2 Wörter). 's nach Pronomen = is/has, sonst Genitiv (1 Wort). */
export function kwtNorm(s) {
  const raw = words(s);
  const out = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const nx = raw[i + 1] ?? '';
    if (w === 'cannot') out.push('can', 'not');
    else if (w === "'d") out.push(PP.test(nx) ? 'had' : 'would');
    else if (w === "'ll") out.push('will');
    else if (w === "'ve") out.push('have');
    else if (w === "'re") out.push('are');
    else if (w === "'m") out.push('am');
    else if (w === "'s") out.push(PP.test(nx) ? 'has' : 'is');
    else if (w === "can't") out.push('can', 'not');
    else if (w === "won't") out.push('will', 'not');
    else if (w === "shan't") out.push('shall', 'not');
    else if (/n't$/.test(w)) out.push(w.slice(0, -3), 'not');
    else if (/'ll$/.test(w)) out.push(w.slice(0, -3), 'will');
    else if (/'re$/.test(w)) out.push(w.slice(0, -3), 'are');
    else if (/'ve$/.test(w)) out.push(w.slice(0, -3), 'have');
    else if (/'m$/.test(w)) out.push(w.slice(0, -2), 'am');
    else if (/'d$/.test(w)) out.push(w.slice(0, -2), PP.test(nx) ? 'had' : 'would');
    else if (/'s$/.test(w) && PRON.has(w.slice(0, -2))) out.push(w.slice(0, -2), PP.test(nx) ? 'has' : 'is');
    else out.push(w);
  }
  return out;
}

/** Fügt Teil A und Teil B zusammen; beginnt B mit Apostroph, wird angeheftet. */
export const joinAB = (a, b) => (b.startsWith("'") ? `${a}${b}` : `${a} ${b}`);

/** Kurzform-Varianten einer ausgeschriebenen Wortfolge (verneint, Pronomen + Hilfsverb). */
export function contractedForms(s) {
  const set = new Set([s]);
  let cur = [s];
  for (const [full, short] of NEG) {
    const next = [];
    for (const t of cur) {
      if (new RegExp(`\\b${full}\\b`).test(t)) next.push(t.replace(new RegExp(`\\b${full}\\b`, 'g'), short));
    }
    for (const t of next) { set.add(t); cur.push(t); }
  }
  for (const t of [...set]) {
    const ws = t.split(' ');
    for (let i = 0; i < ws.length - 1; i++) {
      const p = ws[i].toLowerCase();
      const a = ws[i + 1].toLowerCase();
      if (PRON.has(p) && AUX[a] && ws[i + 2] !== 'not' && !(a === 'had' && ws[i + 2] && /^(a|an|the|some|no)$/.test(ws[i + 2].toLowerCase()) ) && !(a === 'is' && p === 'i')) {
        if (a === 'am' && p !== 'i') continue;
        if (a === 'are' && !/^(you|we|they)$/.test(p)) continue;
        if (a === 'is' && !/^(he|she|it)$/.test(p)) continue;
        if (a === 'has' && !/^(he|she|it)$/.test(p)) continue;
        if (a === 'have' && /^(he|she|it)$/.test(p)) continue;
        if (a === 'had' && (!ws[i + 2] || !PP.test(ws[i + 2].toLowerCase()))) continue;
        const copy = ws.slice();
        copy.splice(i, 2, ws[i] + AUX[a]);
        set.add(copy.join(' '));
      }
    }
  }
  return [...set];
}

/** `kwt`-Wertung nach c1-aufgaben.md §3.4: 0–2 Punkte, beste ganze Variante. */
export function scoreKwt(item, input) {
  const key = item.key.toLowerCase().replace(/’/g, "'");
  if (!words(input).includes(key)) return { got: 0, max: 2, reason: 'key' };
  const n = kwtNorm(input);
  if (n.length < 3 || n.length > 6) return { got: 0, max: 2, reason: 'length' };
  let best = 0;
  const starts = (arr, pre) => pre.length <= arr.length && pre.every((w, i) => arr[i] === w);
  const ends = (arr, suf) => suf.length <= arr.length && suf.every((w, i) => arr[arr.length - suf.length + i] === w);
  for (const k of item.keys) {
    const A = k.a.map((x) => kwtNorm(x));
    const B = k.b.map((x) => kwtNorm(x));
    let p = 0;
    if (A.some((a) => starts(n, a))) p++;
    if (B.some((b) => ends(n, b))) p++;
    if (A.some((a) => B.some((b) => n.length === a.length + b.length && starts(n, a) && ends(n, b)))) p = 2;
    else if (p === 2) p = 2;
    best = Math.max(best, p);
  }
  return { got: best, max: 2, reason: best < 2 ? 'part' : undefined };
}

/** `err`-Wertung nach §3.5: Fundort (tap) + Korrektur (fix), fehlerfrei = „Kein Fehler“. */
export function scoreErr(item, tap, fix) {
  if (!item.bad) return tap === 'none' ? { got: 2, max: 2 } : { got: 0, max: 2, reason: 'falseAlarm' };
  if (tap === 'none') return { got: 0, max: 2, reason: 'missed' };
  const ws = item.text.split(/\s+/);
  const spanLen = item.bad.span.split(/\s+/).length;
  const start = findSpan(item.text, item.bad);
  let p = 0;
  if (start >= 0 && tap >= start && tap < start + spanLen) p++;
  if (p === 1 && item.bad.fix.some((f) => norm(f) === norm(fix))) p++;
  return { got: p, max: 2, reason: p < 2 ? 'part' : undefined, ws };
}

/** Wortindex (0-basiert) des Beginns der Fehlerstelle; −1 wenn nicht gefunden. */
export function findSpan(text, bad) {
  const tw = text.split(/\s+/);
  const sw = bad.span.split(/\s+/);
  let seen = 0;
  const want = bad.nth ?? 1;
  const clean = (w) => w.replace(/[.,;:!?"“”]/g, '').toLowerCase();
  for (let i = 0; i + sw.length <= tw.length; i++) {
    if (sw.every((s, j) => clean(tw[i + j]) === clean(s))) { seen++; if (seen === want) return i; }
  }
  return -1;
}

/** Satz mit eingesetzter Korrektur. */
export function applyFix(text, bad, fix) {
  const tw = text.split(/\s+/);
  const start = findSpan(text, bad);
  const sl = bad.span.split(/\s+/).length;
  const last = tw[start + sl - 1];
  const tail = /[.,;:!?]+$/.exec(last)?.[0] ?? '';
  const head = tw.slice(0, start);
  const rest = tw.slice(start + sl);
  const mid = fix === '' ? [] : [fix + tail];
  if (fix === '' && tail && head.length) head[head.length - 1] += tail;
  return [...head, ...mid, ...rest].join(' ');
}

const BRITISH = /\b(colour|favour|honour|organis\w*|realis(e|ed|es|ing|ation)|recognis\w*|analys(e|ed|es|ing)\b|programme|centre|licence|behaviour|labour|cheque|whilst|amongst|learnt|spelt|dreamt|fulfil\b|enrol\b|catalogue|grey|travell\w*|cancell\w*|modell\w*|judgement|storey|tyre|kerb|aluminium|maths|autumn|fortnight|lorry|flat\b)\b/i;
export const hasBritish = (s) => BRITISH.test(s);

/** Alle bereits vorhandenen englischen Sätze (Dubletten-Korpus). */
export function legacyCorpus() {
  const set = new Set();
  const add = (s) => { if (typeof s === 'string' && s.length > 12) set.add(norm(s.replace(/___/g, ' '))); };
  const t2 = JSON.parse(readFileSync(join(ROOT, 'src/content/grammar/tasks-v2.json'), 'utf8')).tasks;
  for (const t of t2) { add(t.from); add(t.frame); add(t.prompt); add(t.fixed); add(t.a); add(t.b); }
  for (const t of JSON.parse(readFileSync(join(ROOT, 'src/content/nb/transforms.json'), 'utf8'))) { add(t.a); add(t.gap); }
  for (const f of ['src/content/grammar-bank.json', 'src/content/grammar-extra.json']) {
    try { collect(JSON.parse(readFileSync(join(ROOT, f), 'utf8')), add); } catch { /* optional */ }
  }
  for (const f of readdirSync(join(ROOT, 'src/content/grammar/patterns'))) {
    const d = JSON.parse(readFileSync(join(ROOT, 'src/content/grammar/patterns', f), 'utf8'));
    for (const p of d.patterns) { add(p.trap.bad); add(p.trap.good); for (const e of p.ex) add(e.en); }
  }
  return set;
}
function collect(x, add) {
  if (typeof x === 'string') add(x);
  else if (Array.isArray(x)) x.forEach((y) => collect(y, add));
  else if (x && typeof x === 'object') Object.values(x).forEach((y) => collect(y, add));
}

/** Muster-Karte: pat → { topic, name }. */
export function patternIndex() {
  const idx = {};
  for (const f of readdirSync(join(ROOT, 'src/content/grammar/patterns'))) {
    const d = JSON.parse(readFileSync(join(ROOT, 'src/content/grammar/patterns', f), 'utf8'));
    for (const p of d.patterns) idx[p.id] = { topic: d.topic, name: p.name.en };
  }
  return idx;
}

export function chapterOf(topic) {
  const p = JSON.parse(readFileSync(join(ROOT, 'src/content/grammar/path.json'), 'utf8'));
  return p.chapters.find((c) => c.topics.includes(topic))?.id;
}
