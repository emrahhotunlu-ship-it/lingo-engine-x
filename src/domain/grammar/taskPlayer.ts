import { givenOf } from '../c1x/book';
import { kwtWords } from '../c1x/kwtNorm';
import { toTask } from '../c1x/runtime';
import { scoreC1 } from '../c1x/score';
import type { C1Item, C1Response, Kwt } from '../c1x/types';
import { ruleMatches } from '../c1x/kinds/common';
import type { ExplanationModel, WhyRule } from '../explain/types';
import type { GrammarCheck, GrammarTask } from '../learn/types';
import type { Lang } from '../srs/types';
import { checkFind, checkGrammar, checkKwt } from './check';
import { grammarExplanation } from './explain';
import { c1CaseFix, c1Model, c1VariantModel, caseFix, isAbbrevKey, isVariant, kwtLayout, PART_B_MAX } from './learnerView';
import type { V2Task } from './patternTypes';
import { fromV2, kwtSpan } from './tasks';

// Aufgaben-Spieler (Paket Q0): Jede Aufgabe wird mit der Musterlösung, jeder Alternative und typischen Fehlern durch die ECHTE Prüf- und
// Anzeige-Logik geschickt (Prüfung: `checkGrammar`/`checkKwt`/`checkFind`/`scoreC1`; Anzeige: `grammarExplanation`, Varianten- und
// Schreibungs-Bausteine aus `learnerView.ts`, die auch `GrammarItem` und `useC1Item` benutzen). Rein; die Inhalte reicht der Aufrufer herein.
//
// Befundarten:
//  a   Angezeigte Begründung nennt eine andere Form als die Eingabe, und der Kopf sagt NICHT „Auch richtig“ (Widerspruch für den Lernenden).
//  a2  Wie a, aber unter „Auch richtig“: die Musterlösung steht daneben, die Begründung passt trotzdem nicht zur Eingabe (Inhalt nachschärfen).
//  b   Abschreiben: eine gültige Lösung (ohne Schlüsselwort) steht wörtlich schon im Ausgangssatz.
//  c   Abkürzung als Schlüsselwort (MBA) wird in falscher Schreibung angenommen, ohne dass die App die Schreibung zeigt.
//  d   Widersprüchliche Wortzahl-Angaben (mehr als ein Zähler, Zähler ≠ Aufgabenzeile, Lösung außerhalb der genannten Wortzahl, Teile bei kurzer Lösung).
//  e   Begründungstext schreibt das Schlüsselwort anders als `key`.
//  f   Typischer Fehler (aus einer `why.wrong`-Bedingung) bekommt keine Begründung „Deine Antwort“ (nur Hinweis, keine Abnahmebedingung).
//
// `before: true` spielt die Anzeige ohne die Q0-Korrekturen (keine Variante, keine Schreibung, alte Eingabeform mit Teil A/B und zwei Zählern):
// damit misst der Bericht „vorher“ und „nachher“ mit demselben Spieler.

export type FindingKind = 'a' | 'a2' | 'b' | 'c' | 'd' | 'e' | 'f';
export type Finding = { id: string; kind: FindingKind; path: 'lp2' | 'c1x'; input?: string; shown?: string; note: string };
export type PlayOpts = { lang: Lang; before?: boolean };

// ------------------------------------------------------------------ Hilfen

/** Wörter in Vergleichsform: Kurzformen wie bei Umformungen aufgelöst ('d tested = had tested, I'd be = I would be). */
const words = (s: string): string[] => kwtWords(s).join(' ').replace(/\bcan not\b/g, 'cannot').split(' ').filter(Boolean);
const contains = (hay: readonly string[], seq: readonly string[]): boolean => {
  if (!seq.length || seq.length > hay.length) return false;
  for (let i = 0; i + seq.length <= hay.length; i++) if (seq.every((w, j) => hay[i + j] === w)) return true;
  return false;
};

const whyLine = (m: ExplanationModel): string => {
  const l = m.lines.find((x) => x.k === 'why');
  // Wie `GrammarItem`: der Vorspann „Richtig:“ der Aufgabenbegründung fällt in der Anzeige weg.
  return l && l.k === 'why' ? l.text.replace(/^(?:richtig|right|correct)\s*:\s*/i, '') : '';
};

const ING = /\b\w+ing\b/;
const HAVE = /\b(?:have|has|had|having)\b/;
const BE = /\b(?:be|is|are|was|were|been|being|am|get|gets|got|gotten)\b/;

/**
 * Widerspricht die angezeigte Begründung der Eingabe? Zwei Prüfungen: (1) Sie zitiert ein Stück (≥ 2 Wörter) der Musterlösung, das in der
 * Eingabe nicht vorkommt; (2) sie nennt eine Zeitform/Bauform, die die Eingabe nicht hat (Verlaufsform ohne -ing, Perfekt ohne have, Passiv ohne be).
 * Gibt den Grund zurück oder `null`.
 */
export function contradicts(why: string, given: string, model: string, mode: 'all' | 'terms' = 'all'): string | null {
  if (!why.trim()) return null;
  // Dieselbe Form wie die Musterlösung (nur Kurzform: ’s going to = is going to) kann ihr nicht widersprechen.
  if (!isVariant(given, model)) return null;
  const w = words(why);
  const g = words(given);
  const m = words(model);
  const gs = new Set(g);
  for (let len = mode === 'terms' ? 0 : Math.min(m.length, 6); len >= 2; len--) {
    for (let i = 0; i + len <= m.length; i++) {
      const seq = m.slice(i, i + len);
      if (seq.some((x) => !gs.has(x)) && contains(w, seq) && !contains(g, seq)) return `zitiert „${seq.join(' ')}“ aus der Musterlösung`;
    }
  }
  // Nennt die Begründung die eingegebene Form selbst („Auch das Present Simple (signs off) geht“), widerspricht sie ihr nicht.
  if (g.length && contains(w, g)) return null;
  const low = why.toLowerCase();
  // Nennt die Begründung selbst eine zweite Möglichkeit („present perfect or present simple“, „auch möglich“), widerspricht sie nicht.
  if (/\bor\b|\boder\b|also (?:works|possible|correct)|auch (?:möglich|richtig)|geht auch/.test(low)) return null;
  // Ein 'd/'s (’d never flown, he'd not seen) kann had/has sein: zählt als have-Form.
  const gl = `${words(given).join(' ')} ${/'[ds]\b/.test(given.toLowerCase().replace(/[’‘]/g, "'")) ? 'had' : ''}`;
  const ml = words(model).join(' ');
  if (/continuous|progressive|verlaufsform/.test(low) && !ING.test(gl) && ING.test(ml)) return 'nennt die Verlaufsform, die Eingabe hat kein -ing';
  if (/perfect|perfekt/.test(low) && !HAVE.test(gl) && HAVE.test(ml)) return 'nennt das Perfekt, die Eingabe hat kein have';
  if (/passiv/.test(low) && !BE.test(gl) && BE.test(ml)) return 'nennt das Passiv, die Eingabe hat keine be-Form';
  return null;
}

/** Steht eine Lösung (ohne Schlüsselwort, mindestens 2 Wörter) wörtlich schon im Ausgangssatz? */
export function copyable(from: string, variant: string, key: string): string | null {
  const k = key.toLowerCase();
  const v = kwtWords(variant, [key]).filter((x) => x !== k);
  const f = kwtWords(from, [key]);
  return v.length >= 2 && contains(f, v) ? v.join(' ') : null;
}

/** Begründungstexte, die das Schlüsselwort anders schreiben als `key` (Abkürzung: jede Stelle; sonst nach „Schlüsselwort“/„key word“). */
export function keySpellings(texts: readonly string[], key: string, model: string): string[] {
  const out: string[] = [];
  const abbrev = isAbbrevKey(key, model);
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const t of texts) {
    if (abbrev) {
      for (const m of t.matchAll(new RegExp(`(?<![A-Za-z])${esc}(?![A-Za-z])`, 'gi'))) if (m[0] !== key) out.push(`„${m[0]}“ in: ${t}`);
    } else {
      for (const m of t.matchAll(new RegExp(`(?:schlüsselwort|key word|keyword)\\s+[„“"]?(${esc})(?![A-Za-z])`, 'gi'))) if (m[1] !== key) out.push(`„${m[1]}“ in: ${t}`);
    }
  }
  return out;
}

const whyTexts = (w: { ok: { de: string; en: string }; wrong: ReadonlyArray<{ de: string; en: string }> }): string[] => [w.ok.de, w.ok.en, ...w.wrong.flatMap((r) => [r.de, r.en])];

/** Ein typischer Fehler aus einer Bedingung: die `if`-Wörter (ohne Bedingung oder nur mit `not` gibt es keinen eigenen Fehlersatz). */
const trapFromRule = (r: WhyRule, key?: string): string | null => {
  if (!r.if || !r.if.length) return null;
  // Umformung: der typische Fehler enthält das Schlüsselwort (sonst greift immer nur die Regel „Schlüsselwort fehlt“).
  const t = key && !r.if.some((w) => w.toLowerCase() === key.toLowerCase()) ? `${r.if.join(' ')} ${key.toLowerCase()}` : r.if.join(' ');
  return ruleMatches(r, { given: t }) ? t : null;
};

// ------------------------------------------------------------------ LP2-Weg (GrammarItem)

type LegacyView = { verdict: GrammarCheck['verdict']; title: 'right' | 'alsoRight' | 'other'; why: string; yours: boolean; caseFixed: string | null };

function legacyCheck(task: GrammarTask, given: string): GrammarCheck {
  if (task.type === 'kwt') return checkKwt(task, given);
  if (task.type === 'find') return checkFind(task, { replacement: given });
  return checkGrammar(task, given);
}

/** Was `GrammarItem` nach dem Prüfen zeigt (Kopf, „Richtig, weil“-Zeile, ob „Deine Antwort“ eine Begründung hat). */
export function legacyView(task: GrammarTask, given: string, opts: PlayOpts): LegacyView {
  const c = legacyCheck(task, given);
  const kwtKey = task.x?.kind === 'kwt' ? task.x.key : null;
  const plainKind = c.kind === undefined || c.kind === 'contraction' || c.kind === 'uk';
  const variant = !opts.before && c.verdict === 'correct' && plainKind && isVariant(given, task.answer, kwtKey ? { kwtKey } : {});
  const verdict = c.verdict === 'correct' ? 'ok' : c.verdict === 'near' ? 'near' : 'wrong';
  const m = grammarExplanation({ task, verdict, given, variant, lang: opts.lang, learning: false });
  return {
    verdict: c.verdict,
    title: c.kind === 'other' ? 'other' : variant ? 'alsoRight' : 'right',
    why: whyLine(m),
    yours: m.lines.some((l) => l.k === 'yours'),
    caseFixed: !opts.before && kwtKey && c.verdict === 'correct' ? caseFix(given, kwtKey, task.answer) : null,
  };
}

/** Eine LP2-Aufgabe (`tasks-v2.json`: kwt, find, meaning) im LP2-Weg spielen. */
export function playV2(t: V2Task, opts: PlayOpts): Finding[] {
  const task = fromV2(t);
  if (!task) return [];
  const out: Finding[] = [];
  const add = (f: Omit<Finding, 'id' | 'path'>) => out.push({ id: t.id, path: 'lp2', ...f });
  if (t.type === 'meaning') {
    for (const pick of ['a', 'b', 'both'] as const) {
      if (pick === t.answer) continue;
      const m = grammarExplanation({ task, verdict: 'wrong', given: pick, picked: pick, lang: opts.lang, learning: false });
      if (!m.lines.some((l) => l.k === 'yours')) add({ kind: 'f', input: pick, note: 'falsche Wahl ohne eigene Begründung' });
    }
    return out;
  }
  const model = task.answer;
  for (const given of [model, ...task.accepted]) {
    if (!given.trim()) continue;
    const v = legacyView(task, given, opts);
    if (v.verdict !== 'correct') {
      add({ kind: 'd', input: given, note: `gültige Lösung wird nicht angenommen (${v.verdict})` });
      continue;
    }
    if (v.title !== 'right' || given === model) {
      if (v.title === 'alsoRight') {
        // Unter „Auch richtig“ steht die Musterlösung daneben: eine Begründung, die sie zitiert, ist stimmig; widersprüchlich ist nur eine Bauform,
        // die die Eingabe nicht hat („also Perfect Continuous“ zu „have gotten longer“).
        const why = contradicts(v.why, given, model, 'terms');
        if (why) add({ kind: 'a2', input: given, shown: v.why, note: why });
      }
      continue;
    }
    const why = contradicts(v.why, given, model);
    if (why) add({ kind: 'a', input: given, shown: v.why, note: why });
  }
  if (t.type === 'kwt') {
    for (const v of [t.answer, ...t.accepted]) {
      const c = copyable(t.from, v, t.key);
      if (c) add({ kind: 'b', input: v, note: `„${c}“ steht schon im Ausgangssatz` });
      // Angezeigt wird der Bereich aus `kwtSpan` (wie im c1x-Adapter); vorher die rohe Angabe `words`.
      const [lo, hi] = opts.before ? t.words : kwtSpan(t);
      const n = kwtWords(v, [t.key]).length;
      if (n < lo || n > hi) add({ kind: 'd', input: v, note: `${n} Wörter, die Aufgabe nennt ${lo}–${hi}` });
    }
    if (isAbbrevKey(t.key, t.answer)) {
      const low = t.answer.replace(new RegExp(t.key, 'g'), t.key.toLowerCase());
      const v = legacyView(task, low, opts);
      if (v.verdict === 'correct' && !v.caseFixed) add({ kind: 'c', input: low, note: `${t.key} klein angenommen, ohne Hinweis auf die Schreibung` });
    }
    for (const s of keySpellings(whyTexts(t.why), t.key, t.answer)) add({ kind: 'e', note: s });
    for (const r of t.why.wrong) {
      const trap = trapFromRule(r, t.key);
      if (!trap) continue;
      const v = legacyView(task, trap, opts);
      if (v.verdict === 'correct') add({ kind: 'f', input: trap, note: 'Fehler-Bedingung trifft eine angenommene Antwort' });
    }
  }
  return out;
}

/** Eine Startaufgabe (Lücke, Umformung, Korrektur) mit `accepted` spielen. */
export function playSeed(task: GrammarTask, id: string, opts: PlayOpts): Finding[] {
  if (task.type === 'mc' || task.type === 'meaning') return [];
  const out: Finding[] = [];
  for (const given of task.accepted) {
    if (!given.trim()) continue;
    const v = legacyView(task, given, opts);
    if (v.verdict !== 'correct' || v.title === 'other') continue;
    const why = contradicts(v.why, given, task.answer, v.title === 'alsoRight' ? 'terms' : 'all');
    if (why) out.push({ id, path: 'lp2', kind: v.title === 'alsoRight' ? 'a2' : 'a', input: given, shown: v.why, note: why });
  }
  return out;
}

// ------------------------------------------------------------------ c1x-Weg (useC1Item, kinds/*)

/** Gültige Antworten einer c1x-Aufgabe (Musterlösung zuerst) als Antwort der Art. */
function c1Valid(item: C1Item): C1Response[] {
  switch (item.kind) {
    case 'kwt':
      return item.keys.flatMap((k) => k.a.flatMap((a) => k.b.map((b) => ({ kind: 'kwt' as const, text: `${a} ${b}`.trim(), typed: true }))));
    case 'err': {
      if (!item.bad) return [];
      const at = errTap(item);
      return at === null ? [] : item.bad.fix.filter((f) => f.trim()).map((fix) => ({ kind: 'err' as const, tap: at, fix, typed: true }));
    }
    case 'ocl':
    case 'wf':
      return item.accept.map((text) => ({ kind: item.kind, text }));
    default:
      return [];
  }
}

/** Index des ersten Worts der Fehlerstelle (wie angetippt). */
function errTap(item: Extract<C1Item, { kind: 'err' }>): number | null {
  if (!item.bad) return null;
  const ws = item.text.split(/\s+/).filter(Boolean);
  const key = (w: string) => w.toLowerCase().replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
  const seq = item.bad.span.split(/\s+/).map(key);
  let nth = 0;
  for (let i = 0; i + seq.length <= ws.length; i++) {
    if (seq.every((w, j) => key(ws[i + j] as string) === w)) {
      nth++;
      if (nth === (item.bad.nth ?? 1)) return i;
    }
  }
  return null;
}

/** Was `useC1Item` nach dem Prüfen zeigt. */
export function c1View(item: C1Item, r: C1Response, opts: PlayOpts): { verdict: string; title: 'right' | 'alsoRight'; why: string; given: string; caseFixed: string | null } {
  const score = scoreC1(item, r);
  const variantModel = !opts.before && score.verdict === 'correct' ? c1VariantModel(item, r) : null;
  const given = givenOf(item, r);
  const verdict = score.verdict === 'correct' ? 'ok' : score.verdict === 'near' ? 'near' : 'wrong';
  const m = grammarExplanation({ task: toTask(item), verdict, given, variant: variantModel !== null, model: c1Model(item) ?? '', lang: opts.lang, learning: false });
  return { verdict: score.verdict, title: variantModel ? 'alsoRight' : 'right', why: whyLine(m), given, caseFixed: opts.before || score.verdict !== 'correct' ? null : c1CaseFix(item, r) };
}

/** Eine c1x-Aufgabe spielen (kwt, err, ocl, wf; andere Arten haben keine Varianten-Eingabe). */
export function playC1(item: C1Item, opts: PlayOpts): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, 'id' | 'path'>) => out.push({ id: item.id, path: 'c1x', ...f });
  const model = c1Model(item) ?? '';
  const valid = c1Valid(item);
  valid.forEach((r, i) => {
    const v = c1View(item, r, opts);
    const text = ('text' in r ? r.text : 'fix' in r ? r.fix : '') ?? '';
    if (v.verdict !== 'correct') {
      add({ kind: 'd', input: text, note: `gültige Lösung wird nicht angenommen (${v.verdict})` });
      return;
    }
    if (i === 0) return;
    const why = contradicts(v.why, item.kind === 'err' ? text : v.given, model, v.title === 'alsoRight' ? 'terms' : 'all');
    if (why) add({ kind: v.title === 'alsoRight' ? 'a2' : 'a', input: text, shown: v.why, note: why });
  });
  if (item.kind === 'kwt') out.push(...playKwtExtra(item, opts));
  return out;
}

function playKwtExtra(item: Kwt, opts: PlayOpts): Finding[] {
  const out: Finding[] = [];
  const add = (f: Omit<Finding, 'id' | 'path'>) => out.push({ id: item.id, path: 'c1x', ...f });
  const model = c1Model(item) ?? '';
  for (const k of item.keys) for (const a of k.a) for (const b of k.b) {
    const c = copyable(item.lead, `${a} ${b}`, item.key);
    if (c) add({ kind: 'b', input: `${a} ${b}`, note: `„${c}“ steht schon im Ausgangssatz` });
  }
  if (isAbbrevKey(item.key, model)) {
    const low = model.replace(new RegExp(item.key, 'g'), item.key.toLowerCase());
    const v = c1View(item, { kind: 'kwt', text: low, typed: true }, opts);
    if (v.verdict === 'correct' && !v.caseFixed) add({ kind: 'c', input: low, note: `${item.key} klein angenommen, ohne Hinweis auf die Schreibung` });
  }
  for (const s of keySpellings(whyTexts(item.why), item.key, model)) add({ kind: 'e', note: s });
  // Wortzähler: Handy und Laptop, niedrige und hohe Stufe.
  for (const inp of ['touch', 'desk'] as const) {
    for (const p of [0.5, 0.95]) {
      const lay = opts.before ? beforeLayout(item, inp, p) : kwtLayout(item, inp, p);
      const where = `${inp === 'touch' ? 'Handy' : 'Laptop'} p ${p}`;
      if (lay.counters.length > 1) add({ kind: 'd', note: `${where}: ${lay.counters.length} Wortzähler (${lay.counters.map((c) => `${c[0]}–${c[1]}`).join(' und ')})` });
      if (lay.counters.some((c) => c[0] !== lay.task[0] || c[1] !== lay.task[1]) && lay.counters.length === 1) add({ kind: 'd', note: `${where}: Zähler ≠ Aufgabenzeile` });
      if (lay.parts && kwtWords(model, [item.key]).length <= PART_B_MAX && inp === 'touch' && p > 0.7) add({ kind: 'd', note: `${where}: Teil A/B bei einer Lösung mit ${kwtWords(model, [item.key]).length} Wörtern` });
    }
  }
  const [lo, hi] = item.words ?? [3, 6];
  const n = kwtWords(model, [item.key]).length;
  if (n < lo || n > hi) add({ kind: 'd', note: `Musterlösung hat ${n} Wörter, die Aufgabe nennt ${lo}–${hi}` });
  for (const r of item.why.wrong) {
    const trap = trapFromRule(r, item.key);
    if (!trap) continue;
    const v = c1View(item, { kind: 'kwt', text: trap, typed: true }, opts);
    if (v.verdict === 'correct') add({ kind: 'f', input: trap, note: 'Fehler-Bedingung trifft eine angenommene Antwort' });
  }
  return out;
}

/** Eingabeform vor Q0: Handy p > 0,7 immer Teil A/B mit zwei Zählern (Teil B 1–max und gesamt). */
function beforeLayout(item: Kwt, inp: 'touch' | 'desk', p: number): { task: [number, number]; counters: Array<[number, number]>; parts: boolean } {
  const range = item.words ?? [3, 6];
  if (inp === 'desk' || p <= 0.7) return { task: range, counters: [range], parts: true };
  const partMax = Math.max(PART_B_MAX, ...item.keys.flatMap((k) => k.b.map((x) => kwtWords(x, [item.key]).length)));
  return { task: range, counters: [[1, partMax], range], parts: true };
}

/** Befunde je Art zählen. */
export function countKinds(fs: readonly Finding[]): Record<FindingKind, number> {
  const out: Record<FindingKind, number> = { a: 0, a2: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
  for (const f of fs) out[f.kind]++;
  return out;
}

// ------------------------------------------------------------------ Lernenden-Ansicht für die Gegenlesung (english-teacher, Q0)

const verdictWord = (v: string, title: string): string => (title === 'alsoRight' ? 'Auch richtig / Also correct' : v === 'correct' ? 'Richtig / Right' : v === 'near' ? 'Fast / Almost' : 'Noch nicht / Not yet');

/** Was der Lernende sieht: Musterlösung, jede Alternative und typische Fehler, je mit Kopf, Zusatzzeile und Begründung (Text, eine Zeile je Antwort). */
export function learnerSheet(x: { v2?: V2Task; c1?: C1Item; seed?: GrammarTask }, lang: Lang): string[] {
  const out: string[] = [];
  const line = (given: string, head: string, extra: string | null, why: string, yours: string | null) =>
    out.push(`  „${given}“ → ${head}${extra ? ` · ${extra}` : ''}${yours ? `\n      Deine Antwort: ${yours}` : ''}\n      Begründung: ${why || '(keine)'}`);
  const opts: PlayOpts = { lang };
  const wrongs = (rules: readonly WhyRule[], key?: string) => rules.map((r) => trapFromRule(r, key)).filter((t): t is string => !!t);
  const task = x.v2 ? fromV2(x.v2) : (x.seed ?? null);
  if (task && task.type !== 'meaning' && task.type !== 'mc') {
    out.push(`[LP2] ${task.type} · ${task.x?.kind === 'kwt' ? `Satz A: ${task.x.from} · Schlüsselwort ${task.x.key} · ${task.x.words[0]}–${task.x.words[1]} Wörter · ` : ''}${task.prompt}`);
    const caseKey = task.x?.kind === 'kwt' ? task.x.key : null;
    for (const given of [task.answer, ...task.accepted, ...wrongs(task.why?.wrong ?? [], caseKey ?? undefined)]) {
      if (!given.trim()) continue;
      const v = legacyView(task, given, opts);
      const m = grammarExplanation({ task, verdict: v.verdict === 'correct' ? 'ok' : v.verdict === 'near' ? 'near' : 'wrong', given, variant: v.title === 'alsoRight', lang, learning: false });
      const yours = m.lines.find((l) => l.k === 'yours');
      const extra = [v.title === 'alsoRight' ? (lang === 'de' ? `Deine Form passt. Musterlösung: ${task.answer}` : `Your version works. Model answer: ${task.answer}`) : null, v.caseFixed && caseKey ? (lang === 'de' ? `${caseKey} schreibt man groß (Abkürzung)` : `${caseKey} is written in capitals (abbreviation)`) : null].filter(Boolean).join(' · ') || null;
      line(given, verdictWord(v.verdict, v.title), extra, v.why, yours && yours.k === 'yours' ? yours.text : null);
    }
  }
  if (x.c1) {
    const item = x.c1;
    out.push(`[c1x] ${item.kind} ${item.id}${item.kind === 'kwt' ? ` · Satz A: ${item.lead} · Schlüsselwort ${item.key} · ${item.before} ___ ${item.after}` : item.kind === 'err' ? ` · ${item.text}` : ''}`);
    const model = c1Model(item) ?? '';
    const rs: C1Response[] = [...c1Valid(item)];
    if (item.kind === 'kwt') for (const t of [...(item.traps ?? []), ...wrongs(item.why.wrong, item.key)]) rs.push({ kind: 'kwt', text: t, typed: true });
    for (const r of rs) {
      const v = c1View(item, r, opts);
      const m = grammarExplanation({ task: toTask(item), verdict: v.verdict === 'correct' ? 'ok' : v.verdict === 'near' ? 'near' : 'wrong', given: v.given, variant: v.title === 'alsoRight', model, lang, learning: false });
      const yours = m.lines.find((l) => l.k === 'yours');
      line(v.given, verdictWord(v.verdict, v.title), v.title === 'alsoRight' ? (lang === 'de' ? `Deine Form passt. Musterlösung: ${model}` : `Your version works. Model answer: ${model}`) : null, v.why, yours && yours.k === 'yours' ? yours.text : null);
    }
  }
  return out;
}
