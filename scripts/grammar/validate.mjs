// Prüfung der Grammatik-Inhalte (Lernplattform 2.0 §3.2–§3.9, Abnahme P2). Wird vom Test `tests/unit/grammarContent.test.ts`
// und vom Befehl `npm run grammar:check -- <thema>` benutzt. Liefert eine Liste von Befunden (leer = in Ordnung).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, allSeedTasks, legacyNorm, legacyTaskKey } from './lib.mjs';
import {
  PatternMapSchema,
  TopicPatternsSchema,
  V2TaskSchema,
  TaskWhySchema,
} from '../../src/domain/grammar/patternTypes.ts';

const read = (f) => JSON.parse(readFileSync(f, 'utf8'));
export const PARTS = join(ROOT, 'scripts/grammar/parts');
export const PATTERNS = join(ROOT, 'src/content/grammar/patterns');

/** Britische Schreibweisen (US-Englisch, A7 26.09.): Wortstämme, die in englischen Feldern nicht vorkommen dürfen. */
export const BRITISH =
  /\b\w*(colour|favour|behaviour|honour|labour|neighbour|humour|flavour)\w*|\b\w*(organis|realis(e|ed|es|ing|ation|ations)|recognis|apologis|prioritis|summaris|minimis|maximis|finalis|customis|optimis)\w*|\b(whilst|amongst|learnt|spelt|burnt|dreamt|towards|telly|lorry|programme|centre|cheque|licence|defence|offence)\b/i;
const BRITISH_STEMS = BRITISH;

/** Wörter mit mindestens einem Buchstaben oder einer Ziffer. */
export const wordCount = (s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
const GERMAN = /\b(statt|ohne|sonst|jetzt|früher|dann|der|die|das|und|ist|nicht|wird|ein|eine|mit|zu|den|dem|steht|sind|für|von|auf|im|wie|nur|aber|auch|nach|vor|bei|als|oder|wenn)\b/i;
const withoutQuotes = (s) => s.replace(/[“„][^”“]*[”“]/g, ' ');
const segmentOk = (sentence, chunks) => {
  const norm = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const words = norm(sentence).split(' ').filter(Boolean);
  const parts = chunks.map((c) => norm(c).split(' ').filter(Boolean));
  const used = new Array(chunks.length).fill(false);
  const go = (i) => {
    if (i === words.length) return used.every(Boolean);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k];
      if (used[k] || i + p.length > words.length || !p.every((w, j) => words[i + j] === w)) continue;
      used[k] = true;
      if (go(i + p.length)) return true;
      used[k] = false;
    }
    return false;
  };
  return go(0);
};
export { segmentOk };

export const patternFiles = () => (existsSync(PATTERNS) ? readdirSync(PATTERNS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort() : []);
export const partTopics = () => (existsSync(PARTS) ? readdirSync(PARTS).filter((d) => existsSync(join(PARTS, d, 'map.json'))).sort() : []);

const allPatternIds = () => {
  const ids = new Set();
  for (const t of patternFiles()) {
    for (const p of read(join(PATTERNS, `${t}.json`)).patterns ?? []) {
      ids.add(`${t}:${p.id}`);
      ids.add(p.id);
    }
  }
  return ids;
};

const enFieldsOf = (obj, path = '') => {
  const out = [];
  if (typeof obj === 'string') return out;
  if (Array.isArray(obj)) obj.forEach((v, i) => out.push(...enFieldsOf(v, `${path}[${i}]`)));
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      if (k === 'en' && typeof v === 'string') out.push([`${path}.en`, v]);
      else out.push(...enFieldsOf(v, `${path}.${k}`));
    }
  }
  return out;
};

/** Prüft Muster, Zuordnung, neue Aufgaben und Satzbau-Sätze eines Themas aus den Teilen. */
export function validateTopic(topic) {
  const problems = [];
  const bad = (m) => problems.push(`${topic}: ${m}`);
  const pFile = join(PATTERNS, `${topic}.json`);
  if (!existsSync(pFile)) return [`${topic}: Musterdatei fehlt`];
  const parsed = TopicPatternsSchema.safeParse(read(pFile));
  if (!parsed.success) return [`${topic}: Musterdatei ungültig: ${JSON.stringify(parsed.error.issues.slice(0, 5))}`];
  const tp = parsed.data;
  if (tp.topic !== topic) bad('topic im Dateiinhalt weicht ab');
  const ids = tp.patterns.map((p) => p.id);
  if (new Set(ids).size !== ids.length) bad('doppelte Muster-Kennung');
  const prefix = ids[0]?.split('.')[0];
  if (!ids.every((i) => i.split('.')[0] === prefix)) bad('Muster-Kennungen ohne gemeinsames Präfix');
  if ([...tp.order].sort().join() !== [...ids].sort().join()) bad('order enthält nicht genau alle Muster');
  const intro = tp.introPlan.flat();
  if ([...intro].sort().join() !== [...ids].sort().join()) bad('introPlan enthält nicht genau alle Muster einmal');
  const known = allPatternIds();
  for (const p of tp.patterns) {
    if (p.contrast && !known.has(p.contrast.with)) bad(`${p.id}: contrast.with „${p.contrast.with}“ unbekannt`);
    if (wordCount(p.name.de) > 8 || wordCount(p.name.en) > 8) bad(`${p.id}: name zu lang (> 8 Wörter)`);
    if (p.ex.some((e) => wordCount(e.en) > 16)) bad(`${p.id}: Beispiel zu lang (> 16 Wörter)`);
    if (p.trap.bad.trim() === p.trap.good.trim()) bad(`${p.id}: trap bad = good`);
    if (p.signals.some((s) => !s.trim())) bad(`${p.id}: leeres Signalwort`);
  }
  for (const [path, v] of enFieldsOf(tp)) {
    if (BRITISH_STEMS.test(v)) bad(`britische Schreibweise ${path}: ${v}`);
    if (/"/.test(v)) bad(`gerades Anführungszeichen ${path}`);
  }
  for (const p of tp.patterns) {
    for (const f of ['use', 'nudge']) {
      if (!GERMAN.test(p[f].de) && wordCount(p[f].de) > 3) bad(`${p.id}.${f}.de wirkt nicht deutsch: ${p[f].de}`);
      if (/\b(und|der|die|das|ist|nicht|wird|steht)\b/i.test(withoutQuotes(p[f].en))) bad(`${p.id}.${f}.en wirkt nicht englisch: ${p[f].en}`);
    }
  }

  const seeds = allSeedTasks().filter((t) => t.topic === topic);
  const byPrompt = new Map(seeds.map((t) => [t.prompt, t]));
  const seedKeys = new Set(seeds.map((t) => t.key));

  // ---------------------------------------------------------------- Zuordnung
  const mapFile = join(PARTS, topic, 'map.json');
  if (!existsSync(mapFile)) return [...problems, `${topic}: map.json fehlt`];
  const map = read(mapFile);
  const mp = PatternMapSchema.safeParse(Object.fromEntries(Object.entries(map).map(([k, v]) => [`${topic}|${k}`, v])));
  if (!mp.success) bad(`map.json ungültig: ${JSON.stringify(mp.error.issues.slice(0, 4))}`);
  for (const t of seeds) if (!map[t.prompt]) bad(`Aufgabe ohne Muster: ${t.prompt}`);
  for (const [prompt, e] of Object.entries(map)) {
    const t = byPrompt.get(prompt);
    if (!t) {
      bad(`map.json: Aufgabe nicht gefunden: ${prompt}`);
      continue;
    }
    if (!ids.includes(e.pat)) bad(`map.json: unbekanntes Muster ${e.pat} bei „${prompt}“`);
    if (e.dup && !byPrompt.has(e.dup)) bad(`map.json: dup nicht gefunden: ${e.dup}`);
    if (!e.why) {
      bad(`map.json: why fehlt bei „${prompt}“`);
      continue;
    }
    checkWhy(e.why, `„${prompt}“`, t.type === 'mc' ? t.options : null, t.type === 'mc' ? t.answer : null);
    if (t.type === 'mc') {
      for (const o of t.options) {
        if (o.trim() !== t.answer.trim() && !e.why.wrong.some((r) => r.opt === o)) bad(`why.wrong deckt falsche Option „${o}“ nicht ab: ${prompt}`);
      }
    } else if (e.why.wrong.length < 1) bad(`why.wrong leer: ${prompt}`);
  }

  function checkWhy(why, where, options, answer) {
    const r = TaskWhySchema.safeParse(why);
    if (!r.success) return bad(`why ungültig ${where}: ${JSON.stringify(r.error.issues.slice(0, 3))}`);
    const texts = [['ok', why.ok], ...why.wrong.map((w, i) => [`wrong[${i}]`, w])];
    for (const [n, x] of texts) {
      if (x.de.length > 100 || x.en.length > 100) bad(`why.${n} zu lang (> 100 Zeichen) ${where}`);
      if (BRITISH_STEMS.test(x.en)) bad(`britische Schreibweise in why.${n} ${where}`);
      if (/"/.test(x.de + x.en)) bad(`gerades Anführungszeichen in why.${n} ${where}`);
      if (/\b(und|der|die|das|ist|nicht|wird|steht)\b/i.test(withoutQuotes(x.en))) bad(`why.${n}.en wirkt nicht englisch ${where}: ${x.en}`);
      if (!GERMAN.test(x.de)) bad(`why.${n}.de wirkt nicht deutsch ${where}: ${x.de}`);
    }
    for (const w of why.wrong) {
      if (w.opt && options && (!options.includes(w.opt) || w.opt.trim() === answer.trim())) bad(`why.wrong.opt „${w.opt}“ keine falsche Option ${where}`);
      if (w.pat && !known.has(w.pat) && !ids.includes(w.pat)) bad(`why.wrong.pat „${w.pat}“ unbekannt ${where}`);
      if (!w.if && !w.not && !w.opt && !w.tap && !w.pat) bad(`why.wrong-Regel ohne Bedingung ${where}`);
    }
    if (why.ok.de.trim() === why.ok.en.trim()) bad(`why.ok in beiden Sprachen gleich ${where}`);
  }

  // ---------------------------------------------------------------- neue Aufgaben
  const v2Raw = existsSync(join(PARTS, topic, 'v2.json')) ? read(join(PARTS, topic, 'v2.json')) : [];
  const v2Keys = new Set();
  const v2Ids = new Set();
  const per = Object.fromEntries(ids.map((i) => [i, { kwt: 0, find: 0, meaning: 0 }]));
  let finds = 0;
  let clean = 0;
  for (const raw of v2Raw) {
    const t = V2TaskSchema.safeParse({ ...raw, topic });
    const label = raw.id ?? raw.prompt ?? raw.frame ?? raw.a ?? '?';
    if (!t.success) {
      bad(`v2 ungültig (${label}): ${JSON.stringify(t.error.issues.slice(0, 3))}`);
      continue;
    }
    const x = t.data;
    if (v2Ids.has(x.id)) bad(`v2: doppelte id ${x.id}`);
    v2Ids.add(x.id);
    if (!ids.includes(x.pat)) bad(`v2 ${x.id}: unbekanntes Muster ${x.pat}`);
    else per[x.pat][x.type]++;
    checkWhy(x.why, x.id, null, null);
    const front = x.type === 'kwt' ? x.frame : x.type === 'find' ? x.prompt : x.a;
    const key = legacyTaskKey(front);
    if (seedKeys.has(key)) bad(`v2 ${x.id}: Satz steht schon als Startaufgabe: ${front}`);
    if (v2Keys.has(key)) bad(`v2 ${x.id}: Schlüssel doppelt: ${front}`);
    v2Keys.add(key);
    for (const [path, v] of enFieldsOf(x)) if (BRITISH_STEMS.test(v)) bad(`v2 ${x.id}: britische Schreibweise ${path}`);
    for (const s of x.type === 'kwt' ? [x.from, x.frame, x.answer, ...x.accepted] : x.type === 'find' ? [x.prompt, x.fixed ?? '', x.answer ?? ''] : [x.a, x.b]) {
      if (BRITISH_STEMS.test(s)) bad(`v2 ${x.id}: britische Schreibweise: ${s}`);
      if (/"/.test(s)) bad(`v2 ${x.id}: gerades Anführungszeichen: ${s}`);
    }
    if (x.type === 'kwt') {
      if ((x.frame.match(/___/g) ?? []).length !== 1) bad(`v2 ${x.id}: Rahmen braucht genau eine Lücke`);
      const lower = (s) => s.toLowerCase().replace(/[’‘]/g, "'");
      const wordIn = (s, w) => new RegExp(`(^|[^a-z'])${w.toLowerCase()}($|[^a-z'])`).test(lower(s));
      if (wordIn(x.frame, x.key)) bad(`v2 ${x.id}: Schlüsselwort steht schon im Rahmen`);
      for (const a of [x.answer, ...x.accepted]) {
        const n = a.trim().split(/\s+/).length;
        if (n < x.words[0] || n > x.words[1]) bad(`v2 ${x.id}: „${a}“ hat ${n} Wörter, erlaubt ${x.words.join('–')}`);
        if (!wordIn(a, x.key)) bad(`v2 ${x.id}: „${a}“ enthält das Schlüsselwort ${x.key} nicht`);
      }
      if (x.words[0] > x.words[1] || x.words[1] > 5) bad(`v2 ${x.id}: Wortzahl ${x.words.join('–')} (Cambridge: 2–5)`);
      if (x.from.trim().toLowerCase() === x.frame.replace('___', x.answer).trim().toLowerCase()) bad(`v2 ${x.id}: Lösung = Ausgangssatz`);
    }
    if (x.type === 'find') {
      finds++;
      const toks = x.prompt.split(' ');
      if (x.err === null) {
        clean++;
        if (x.answer !== undefined || x.fixed !== undefined) bad(`v2 ${x.id}: fehlerfreier Satz darf kein answer/fixed haben`);
      } else {
        const [a, b] = x.err;
        if (a < 0 || b < a || b >= toks.length) bad(`v2 ${x.id}: err außerhalb des Satzes`);
        else {
          if (b - a + 1 > 4) bad(`v2 ${x.id}: Fehlerbereich länger als 4 Wörter`);
          if (x.answer === undefined || x.fixed === undefined) bad(`v2 ${x.id}: answer und fixed nötig`);
          else {
            const rebuilt = [...toks.slice(0, a), ...(x.answer.trim() ? x.answer.trim().split(' ') : []), ...toks.slice(b + 1)].join(' ');
            if (rebuilt !== x.fixed) bad(`v2 ${x.id}: fixed passt nicht zu err/answer: „${rebuilt}“ ≠ „${x.fixed}“`);
            if (x.fixed === x.prompt) bad(`v2 ${x.id}: fixed = prompt`);
          }
        }
      }
    }
    if (x.type === 'meaning') {
      if (x.a.trim() === x.b.trim()) bad(`v2 ${x.id}: a = b`);
      if (x.why.wrong.length < 1) bad(`v2 ${x.id}: why.wrong leer`);
    } else if (x.why.wrong.length < 1) bad(`v2 ${x.id}: why.wrong leer`);
  }
  for (const [pid, c] of Object.entries(per)) {
    if (c.kwt < 2) bad(`${pid}: weniger als 2 kwt (${c.kwt})`);
    if (c.find < 2) bad(`${pid}: weniger als 2 find (${c.find})`);
    if (c.meaning < 1) bad(`${pid}: kein meaning`);
  }
  if (finds && (clean / finds < 0.15 || clean / finds > 0.35)) bad(`fehlerfreie find-Aufgaben: ${clean} von ${finds} (erwartet etwa ein Viertel)`);

  // ---------------------------------------------------------------- Satzbau
  const ordFile = join(PARTS, topic, 'order.json');
  const ord = existsSync(ordFile) ? read(ordFile) : [];
  if (ord.length < 6) bad(`Satzbau: ${ord.length} Sätze, verlangt 6`);
  let traps = 0;
  const enSeen = new Set();
  for (const o of ord) {
    const w = (m) => bad(`Satzbau „${o.en}“: ${m}`);
    if (!ids.includes(o.pat)) w(`unbekanntes Muster ${o.pat}`);
    if (!Array.isArray(o.chunks) || o.chunks.length < 5 || o.chunks.length > 9) w('5–9 Bausteine nötig');
    else {
      for (const c of o.chunks) {
        if (wordCount(c) > 5) w(`Baustein zu lang: ${c}`);
        if (/[.,;:!?"]/.test(c)) w(`Satzzeichen im Baustein: ${c}`);
      }
      if (!segmentOk(o.en, o.chunks)) w('Bausteine gehen im Satz nicht genau auf');
      for (const a of o.alt ?? []) if (!segmentOk(a, o.chunks)) w(`alt geht nicht auf: ${a}`);
    }
    if (!!(o.alt && o.alt.length) === !!(o.single && o.single.trim())) w('genau eines von alt/single');
    if (o.single && o.single.trim().length < 15) w('single zu kurz');
    const words = (o.de ?? '').split(/\s+/).filter(Boolean).length;
    if (words < 4 || words > 18 || !/[.?!)]$/.test(o.de ?? '')) w('deutsche Bedeutung: 4–18 Wörter und Satzzeichen am Ende');
    if (!Array.isArray(o.why) || o.why.length !== 2 || o.why[0].length < 20 || o.why[1].length < 20) w('why: [de, en] mit je mehr als 20 Zeichen');
    for (const s of [o.en, o.de, ...(o.why ?? []), o.bad ?? '']) if (/"/.test(s)) w('gerades Anführungszeichen');
    if (BRITISH_STEMS.test(o.en) || BRITISH_STEMS.test(o.why?.[1] ?? '')) w('britische Schreibweise');
    if (enSeen.has(o.en)) w('doppelt');
    enSeen.add(o.en);
    if (o.bad && (segmentOk(o.bad, o.chunks) && [o.en, ...(o.alt ?? [])].some((a) => legacyNorm(a) === legacyNorm(o.bad)))) w('bad ist eine gültige Fassung');
    if (o.trap) {
      traps++;
      if (!(o.chunks ?? []).includes(o.trap.tile)) w(`trap.tile „${o.trap.tile}“ ist kein Baustein`);
      const t = TaskWhySchema.shape.ok.safeParse(o.trap.why);
      if (!t.success) w('trap.why: {de, en} nötig');
      if (!o.trap.instead) w('trap.instead fehlt');
    }
  }
  if (ord.length && traps < 1) bad('Satzbau: mindestens 1 Satz mit trap');
  return problems;
}

if (process.argv[1] && process.argv[1].endsWith('validate.mjs')) {
  const topics = process.argv.slice(2);
  const all = topics.length ? topics : partTopics();
  let n = 0;
  for (const t of all) {
    for (const p of validateTopic(t)) {
      console.log(p);
      n++;
    }
  }
  console.log(n ? `${n} Befunde` : `Alles in Ordnung (${all.join(', ')})`);
  process.exit(n ? 1 : 0);
}
