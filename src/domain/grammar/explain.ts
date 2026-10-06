import type { ExplainExample, ExplainLine, ExplanationModel, ResultVerdict } from '../explain/types';
import type { GrammarTask } from '../learn/types';
import type { Lang } from '../srs/types';
import { formHint } from './rules';
import { hasSignal, patternById, patternOf, taskWhy, whyFor } from './patterns';
import type { Pattern } from './patternTypes';

// Erklär-Karte einer Grammatikaufgabe (Lernplattform 2.0 §3.1, §4.7). Rein und deterministisch: Aus Aufgabe, Urteil und Antwort
// entsteht ein `ExplanationModel` mit festen Zeilen (pattern → yours → why → mistake → contrast → note), Beispielen nur aus
// demselben Muster und den Signalwörtern, die im Satz aufleuchten. Wie viele Zeilen sichtbar sind, entscheidet `explainDepth` (P1).

const pick = (b: { de: string; en: string }, lang: Lang): string => (lang === 'de' ? b.de : b.en);

/** Der Satz der Aufgabe mit eingesetzter Lösung (für Beispielausschluss und Signalwörter). */
export function filledSentence(task: Pick<GrammarTask, 'prompt' | 'answer' | 'type'>): string {
  const p = task.type === 'transform' ? (task.prompt.split('→').pop() ?? task.prompt) : task.prompt;
  return /_{3,}/.test(p) ? p.replace(/_{3,}/, task.answer) : p;
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Beispiele nur aus diesem Muster (nie der Aufgabensatz selbst), höchstens `max`. */
export function patternExamples(p: Pattern, exclude: readonly string[] = [], max = 3): ExplainExample[] {
  const skip = new Set(exclude.map(norm));
  const out: ExplainExample[] = [];
  for (const e of p.ex) {
    if (skip.has(norm(e.en))) continue;
    out.push({ en: e.en, de: e.de ?? null, ctx: e.ctx });
  }
  if (out.length < max && !skip.has(norm(p.trap.good)) && !out.some((x) => norm(x.en) === norm(p.trap.good))) out.push({ en: p.trap.good, de: null, ctx: null });
  // Das kürzeste zuerst: Bei Tiefe „full“ ist nur das erste Beispiel offen und der Handy-Bildschirm knapp.
  return out.sort((a, b) => a.en.length - b.en.length).slice(0, Math.max(0, max));
}

/** Signalwörter des Musters, die im Satz der Aufgabe vorkommen (in der Schreibweise des Musters). */
export function markedSignals(p: Pattern, sentence: string): string[] {
  return p.signals.filter((s) => hasSignal(sentence, s));
}

type Input = {
  task: GrammarTask;
  verdict: ResultVerdict;
  given: string;
  picked?: string;
  tapped?: string;
  lang: Lang;
  /** Lernphase: die ersten Aufgaben eines Musters, dann gehört der typische Fehler dazu. */
  learning: boolean;
  /** Antwort von Claude (`explain-answer@1`) ersetzt die „Deine Antwort“-Zeile. */
  ai?: { text: string } | null;
};

export function grammarExplanation(i: Input): ExplanationModel {
  const { task, lang } = i;
  const pattern = patternOf(task);
  const why = taskWhy(task);
  const lines: ExplainLine[] = [];
  const sentence = filledSentence(task);
  let ai = false;
  let source: ExplanationModel['source'] = 'fallback';

  // 1. Muster
  if (pattern) {
    lines.push({ k: 'pattern', name: pick(pattern.name, lang), formula: pick(pattern.form, lang) || null });
    source = 'pattern';
  }

  // 2. Deine Antwort
  const shown = (i.picked ?? i.given).trim();
  const hit = i.verdict === 'wrong' ? whyFor(task, { given: i.given, picked: i.picked, tapped: i.tapped }).rule : null;
  if (i.ai && i.ai.text.trim() && i.verdict === 'wrong') {
    lines.push({ k: 'yours', given: shown, text: i.ai.text.trim() });
    ai = true;
  } else if (hit && shown) {
    lines.push({ k: 'yours', given: shown, text: pick(hit, lang) });
  }

  // 3. Warum (auch bei richtiger Antwort, dann mindestens diese Zeile)
  let whyText = why ? pick(why.ok, lang) : '';
  if (!whyText) {
    // Ohne aufgabengenaue Begründung: die Erklärung der Aufgabe; nie der ganze Kernsatz, wenn ein Muster bekannt ist.
    whyText = formHint({ topic: task.topic, expl: task.expl, prompt: task.prompt, pat: task.pat }, lang);
    if (whyText && source !== 'pattern') source = 'task';
  } else if (source !== 'pattern') source = 'task';
  if (whyText.trim()) lines.push({ k: 'why', text: whyText.trim() });

  // 4. Typischer Fehler (nur Lernphase)
  if (pattern && i.learning) lines.push({ k: 'mistake', bad: pattern.trap.bad, good: pattern.trap.good, cause: pick(pattern.trap.cause, lang) || null });

  // 5. Kontrast: das verwechselte Nachbarmuster, sonst der Kontrast des Musters
  if (pattern) {
    const nb = hit?.pat ? patternById(hit.pat.includes(':') ? hit.pat : `${task.topic}:${hit.pat}`) : null;
    const own = pattern.contrast;
    if (nb && nb.id !== pattern.id) {
      if (own && (own.with === nb.id || own.with.endsWith(`:${nb.id}`))) lines.push({ k: 'contrast', a: own.a, b: own.b, diff: pick(own.diff, lang) });
      else lines.push({ k: 'contrast', a: pattern.ex[0]?.en ?? pattern.trap.good, b: nb.ex[0]?.en ?? nb.trap.good, diff: pick(nb.name, lang) });
    } else if (own) lines.push({ k: 'contrast', a: own.a, b: own.b, diff: pick(own.diff, lang) });
  }

  // 6. Hinweise (US-Form)
  if (pattern?.usNote) lines.push({ k: 'note', text: pick(pattern.usNote, lang) });

  const examples = pattern ? patternExamples(pattern, [sentence, task.prompt, task.answer], 3) : [];
  const mark = pattern ? markedSignals(pattern, sentence) : [];
  return { lines, examples, mark, ai, source };
}
