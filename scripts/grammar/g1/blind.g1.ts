import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { scoreC1 } from '../../../src/domain/c1x/score';
import { errFixed } from '../../../src/domain/c1x/kinds/err';
import type { C1Item, C1Response } from '../../../src/domain/c1x/types';
import { checkFind, checkGrammar, checkKwt, checkMeaning } from '../../../src/domain/grammar/check';
import { allSeedTasks } from '../../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../../src/domain/learn/types';

// G1 (Großpaket G, docs/umbau/grammatik/grosspaket-g.md): jede Grammatik-Aufgabe blind lösen lassen.
//  export: schreibt `<G1_OUT>/blind-NN.json` (Lernenden-Sicht ohne Lösung, je Charge 150) und `<G1_OUT>/keys.json` (Lösungen, nur für den Abgleich).
//  score:  liest `<G1_OUT>/answers-NN.json` ({id: Antwort}), schickt jede Antwort durch die ECHTE Prüfung (checkGrammar/checkKwt/checkFind/
//          checkMeaning/scoreC1) und schreibt `<G1_OUT>/mismatch.json` (blind gelöst, aber nicht als richtig gewertet) samt Musterlösung.

const OUT = process.env.G1_OUT ?? '';
const MODE = process.env.G1_MODE ?? '';
const BATCH = 150;

type Blind = { id: string; kind: string; topic: string; task: string; options?: string[]; answerFormat: string };
type Key = { id: string; model: string; accepted?: readonly string[] };

const C1X = 'src/content/c1x/src';
function c1xAll(): C1Item[] {
  const out = new Map<string, C1Item>();
  for (const dir of readdirSync(C1X)) {
    const d = join(C1X, dir);
    if (!existsSync(d) || !dir.match(/^[a-z]+$/)) continue;
    for (const f of readdirSync(d).filter((x) => x.endsWith('.json')).sort()) {
      const doc = JSON.parse(readFileSync(join(d, f), 'utf8')) as { items?: C1Item[] };
      for (const it of doc.items ?? []) if (['kwt', 'err', 'ocl', 'wf', 'mcc'].includes(it.kind) && !out.has(it.id)) out.set(it.id, it);
    }
  }
  return [...out.values()];
}

const tid = (t: GrammarTask) => `g:${t.topic}|${t.key}`;
const words = (s: string) => s.split(/\s+/).filter(Boolean);
const bare = (w: string) => w.toLowerCase().replace(/[^a-z0-9'’-]/g, '').replace(/’/g, "'");

function blindTask(t: GrammarTask): Blind {
  const base = { id: tid(t), topic: t.topic };
  switch (t.type) {
    case 'mc':
      return { ...base, kind: 'mc', task: t.prompt, options: t.options ?? [], answerFormat: 'genau eine Option (Text wie angegeben)' };
    case 'gap':
      return { ...base, kind: 'gap', task: t.prompt + (t.hint ? `\n(Hinweis, auf Anfrage sichtbar: ${t.hint})` : ''), answerFormat: 'nur das, was in die Lücke gehört' };
    case 'transform':
      return { ...base, kind: 'transform', task: t.prompt + (t.hint ? `\n(Hinweis: ${t.hint})` : ''), answerFormat: 'was die Aufgabe verlangt (Lücke oder ganzer Satz, wie im Aufgabentext)' };
    case 'correct':
      return { ...base, kind: 'correct', task: `Der Satz enthält einen Fehler. Schreibe den ganzen Satz richtig:\n${t.prompt}`, answerFormat: 'der ganze korrigierte Satz' };
    case 'kwt': {
      const x = t.x?.kind === 'kwt' ? t.x : null;
      return { ...base, kind: 'kwt', task: `Satz A: ${x?.from}\nSchlüsselwort: ${x?.key} (muss vorkommen, nicht verändern)\nSatz B: ${t.prompt}\nWörter in der Lücke: ${x?.words[0]}–${x?.words[1]} (inkl. Schlüsselwort)`, answerFormat: 'nur der Lückentext' };
    }
    case 'find':
      return { ...base, kind: 'find', task: `Finde den Fehler (oder „kein Fehler“) und korrigiere ihn:\n${t.prompt}${t.goal ? `\nZiel: ${t.goal.de}` : ''}`, answerFormat: '{"wrong": "<falsche Wörter genau wie im Satz>" oder null, "fix": "<Ersatz für genau diese Wörter>"}' };
    case 'meaning': {
      const x = t.x?.kind === 'meaning' ? t.x : null;
      return { ...base, kind: 'meaning', task: `Satz a: ${x?.a}\nSatz b: ${x?.b}\nFrage: ${x?.q.de}`, answerFormat: '"a", "b" oder "both"' };
    }
  }
}

function blindC1(it: C1Item): Blind | null {
  const base = { id: `c:${it.id}`, topic: it.topic ?? '' };
  switch (it.kind) {
    case 'mcc':
      return { ...base, kind: 'mcc', task: it.text, options: [...it.options], answerFormat: 'genau eine Option (Text wie angegeben)' };
    case 'ocl':
      return { ...base, kind: 'ocl', task: `Ein Wort fehlt (Funktionswort): ${it.text}`, answerFormat: 'genau ein Wort' };
    case 'wf':
      return { ...base, kind: 'wf', task: `Bilde aus dem Stammwort ${it.stem} die passende Form: ${it.text}`, answerFormat: 'genau die Form für die Lücke' };
    case 'kwt':
      return { ...base, kind: 'kwt', task: `Satz A: ${it.lead}\nSchlüsselwort: ${it.key} (muss vorkommen, nicht verändern)\nSatz B: ${it.before} ___ ${it.after}\nWörter in der Lücke: ${it.words ? `${it.words[0]}–${it.words[1]}` : '3–6'} (inkl. Schlüsselwort)`, answerFormat: 'nur der Lückentext' };
    case 'err':
      return { ...base, kind: 'err', task: `Finde den Fehler (oder „kein Fehler“) und korrigiere ihn:\n${it.text}${it.goal ? `\nZiel: ${it.goal.de}` : ''}`, answerFormat: '{"wrong": "<falsche Wörter genau wie im Satz>" oder null, "fix": "<Ersatz für genau diese Wörter>"}' };
    default:
      return null;
  }
}

/** Alle Bereiche [von, bis] der Wörter `wrong` im Satz (Leerzeichen-Wörter, Satzzeichen egal). */
function spansOf(sentence: string, wrong: string): Array<[number, number]> {
  const hay = words(sentence).map(bare);
  const need = words(wrong).map(bare).filter(Boolean);
  const out: Array<[number, number]> = [];
  if (!need.length) return out;
  for (let i = 0; i + need.length <= hay.length; i++) if (need.every((w, j) => hay[i + j] === w)) out.push([i, i + need.length - 1]);
  return out;
}
const RANK = (v: string) => (v === 'correct' ? 0 : v.startsWith('near') ? 1 : v.includes('judge') ? 2 : 3);
const best = (vs: string[]): string => vs.sort((a, b) => RANK(a) - RANK(b))[0] ?? 'wrong(span-not-found)';

type Ans = string | { wrong: string | null; fix?: string };
const asText = (a: Ans): string => (typeof a === 'string' ? a : JSON.stringify(a));

function scoreTask(t: GrammarTask, a: Ans): string {
  if (t.type === 'mc') return typeof a === 'string' && a.trim() === t.answer.trim() ? 'correct' : 'wrong';
  if (t.type === 'meaning') return checkMeaning(t, (typeof a === 'string' ? a : '').trim().toLowerCase() as 'a' | 'b' | 'both').verdict;
  if (t.type === 'find') {
    const o = typeof a === 'string' ? (a.trim().toLowerCase().startsWith('kein') || a.trim() === 'null' ? { wrong: null } : { wrong: a }) : a;
    if (!o.wrong) return checkFind(t, { tapped: 'none' }).verdict;
    return best(spansOf(t.prompt, o.wrong).map((span) => findOne(t, span, o.fix ?? '')));
  }
  const r = t.type === 'kwt' ? checkKwt(t, asText(a)) : checkGrammar(t, asText(a));
  return r.verdict + (r.needsJudge ? '(judge)' : '');
}

function findOne(t: GrammarTask, span: [number, number], fix: string): string {
  {
    const s1 = checkFind(t, { tapped: span });
    if (!s1.found) return 'wrong(loc)';
    const fixTask = s1.altErr ? { ...t, answer: t.x?.kind === 'find' ? (t.x.errAlt?.find((x) => x.err[0] === s1.altErr?.[0])?.answer ?? t.answer) : t.answer, accepted: [...(t.x?.kind === 'find' ? (t.x.errAlt?.find((x) => x.err[0] === s1.altErr?.[0])?.accepted ?? []) : [])] } : t;
    const s2 = checkFind(fixTask, { replacement: fix });
    if (s2.verdict === 'wrong' && !s1.altErr && t.x?.kind === 'find' && t.x.err) {
      // Ganzer Satz des Lösers gegen die richtigen ganzen Sätze (andere Stellengrenze, gleiche Korrektur).
      const w = words(t.prompt);
      const e = t.x.err;
      const sent = (a: number, b: number, f: string) => [...w.slice(0, a), ...words(f), ...w.slice(b + 1)].map(bare).filter(Boolean).join(' ');
      const goals = new Set([t.answer, ...t.accepted].map((f) => sent(e[0], e[1], f)));
      if (goals.has(sent(span[0], span[1], fix))) return 'correct';
    }
    return s2.verdict + (s2.needsJudge ? '(judge)' : '');
  }
}

function scoreItem(it: C1Item, a: Ans): string {
  let r: C1Response;
  if (it.kind === 'mcc') r = { kind: 'mcc', pick: it.options.findIndex((o) => o.trim() === asText(a).trim()) };
  else if (it.kind === 'err') {
    const o = typeof a === 'string' ? (a.trim().toLowerCase().startsWith('kein') || a.trim() === 'null' ? { wrong: null } : { wrong: a }) : a;
    if (!o.wrong) r = { kind: 'err', tap: 'none' };
    else {
      const fix = o.fix ?? '';
      const spans = spansOf(it.text, o.wrong);
      // Gleicher Satz wie eine Musterkorrektur? Dann ist es nur eine andere Abgrenzung der Fehlerstelle, kein Inhaltsproblem.
      const sk = (x: string) => words(x).map(bare).join(' ');
      const ws = words(it.text);
      const same = it.bad && spans.some(([a, b]) => it.bad?.fix.some((f) => sk([...ws.slice(0, a), fix, ...ws.slice(b + 1)].join(' ')) === sk(errFixed(it, f))));
      if (same) return 'correct';
      return best(spans.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => scoreC1(it, { kind: 'err', tap: a + k, fix, typed: true }).verdict)));
    }
  } else if (it.kind === 'kwt') r = { kind: 'kwt', text: asText(a), typed: true };
  else if (it.kind === 'ocl' || it.kind === 'wf') r = { kind: it.kind, text: asText(a) };
  else return 'skip';
  return scoreC1(it, r).verdict;
}

function c1Model(it: C1Item): string {
  switch (it.kind) {
    case 'mcc':
      return it.options[it.answer];
    case 'ocl':
    case 'wf':
      return it.accept.join(' | ');
    case 'kwt':
      return it.keys.map((k) => `${k.a[0]} ${k.b[0]}`).join(' | ');
    case 'err':
      return it.bad ? `${it.bad.span} → ${it.bad.fix.join(' | ')}` : 'kein Fehler';
    default:
      return '';
  }
}

it('G1', () => {
  if (!MODE || !OUT) return;
  mkdirSync(OUT, { recursive: true });
  const tasks = allSeedTasks();
  const items = c1xAll();
  if (MODE === 'locate') {
    // Wo liegt eine Aufgabe? (Quelle `ref`, Art, Felder) – für das Einspielen der Lehrer-Urteile.
    writeFileSync(join(OUT, 'locate.json'), JSON.stringify(Object.fromEntries(tasks.map((t) => [tid(t), { ref: t.ref, type: t.type, prompt: t.prompt, answer: t.answer, accepted: t.accepted, x: t.x ?? null }]))));
    return;
  }
  if (MODE === 'export') {
    const blind: Blind[] = [...tasks.map(blindTask), ...items.map(blindC1).filter((b): b is Blind => !!b)];
    const keys: Key[] = [...tasks.map((t) => ({ id: tid(t), model: t.type === 'find' ? (t.x?.kind === 'find' && t.x.err ? `${t.prompt.split(/\s+/).slice(t.x.err[0], t.x.err[1] + 1).join(' ')} → ${t.answer}` : 'kein Fehler') : t.answer, accepted: t.accepted })), ...items.map((i) => ({ id: `c:${i.id}`, model: c1Model(i) }))];
    for (let i = 0; i * BATCH < blind.length; i++) writeFileSync(join(OUT, `blind-${String(i + 1).padStart(2, '0')}.json`), JSON.stringify(blind.slice(i * BATCH, (i + 1) * BATCH), null, 1));
    writeFileSync(join(OUT, 'keys.json'), JSON.stringify(keys));
    console.warn(`G1 export: ${blind.length} Aufgaben, ${Math.ceil(blind.length / BATCH)} Chargen`);
    expect(blind.length).toBeGreaterThan(2000);
    return;
  }
  const byT = new Map(tasks.map((t) => [tid(t), t]));
  const byC = new Map(items.map((i) => [`c:${i.id}`, i]));
  const keys = new Map((JSON.parse(readFileSync(join(OUT, 'keys.json'), 'utf8')) as Key[]).map((k) => [k.id, k]));
  const mism: Array<{ id: string; verdict: string; blind: string; model: string; accepted?: readonly string[] }> = [];
  let n = 0;
  for (const f of readdirSync(OUT).filter((x) => /^answers-\d+\.json$/.test(x)).sort()) {
    const ans = JSON.parse(readFileSync(join(OUT, f), 'utf8')) as Record<string, Ans>;
    for (const [id, a] of Object.entries(ans)) {
      n++;
      const t = byT.get(id);
      const it = byC.get(id);
      const v = t ? scoreTask(t, a) : it ? scoreItem(it, a) : 'unknown-id';
      if (v !== 'correct') mism.push({ id, verdict: v, blind: asText(a), model: keys.get(id)?.model ?? '', accepted: keys.get(id)?.accepted });
    }
  }
  writeFileSync(join(OUT, 'mismatch.json'), JSON.stringify(mism, null, 1));
  console.warn(`G1 score: ${n} Antworten, ${mism.length} Abweichungen`);
});
