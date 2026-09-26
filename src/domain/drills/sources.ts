import { solvedSentence } from '../course/baseLesson';
import { ruleExamples } from '../grammar/rules';
import { seedTasks } from '../grammar/tasks';
import { TOPICS } from '../content';
import type { GrammarTask } from '../learn/types';
import type { TrainCard } from '../srs/types';

// Satzmaterial der Übungen (phase2-plan §5.4, §5.6): nur aus dem, was die App schon hat –
// ohne KI. Bekanntes zuerst (Karten, die schon gelernt werden), dann Lektionen, dann Regelwerk.

export type DrillSentence = { s: string; src: 'card' | 'lesson' | 'rule' | 'grammar'; ref: string | null; words: number };

const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Satz ohne Klammer-Markierungen, einfache Leerzeichen. */
export function plainSentence(raw: string): string {
  return raw
    .replace(/[[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Taugt der Satz als Übungssatz? Großbuchstabe/Anführung am Anfang, Satzzeichen am Ende, nichts Technisches. */
export function isCleanSentence(s: string, min: number, max: number): boolean {
  const w = wordCount(s);
  if (w < min || w > max) return false;
  if (!/^[A-Z"'“]/.test(s) || !/[.!?]["”']?$/.test(s)) return false;
  if (/[<>{}[\]|_…]/.test(s) || /\d\d\d/.test(s)) return false;
  return true;
}

function collect(push: (s: string, src: DrillSentence['src'], ref: string | null) => void, i: SourceInput): void {
  // 1. Beispielsätze eigener Karten: gelernte zuerst (fällige vor den übrigen), neue zuletzt.
  const cards = [...i.cards].filter((c) => !c.hidden && typeof c.doc.ex === 'string');
  const known = cards.filter((c) => !c.isNew).sort((a, b) => a.fsrs.due - b.fsrs.due || (a.key < b.key ? -1 : 1));
  const fresh = cards.filter((c) => c.isNew);
  for (const c of [...known, ...fresh]) push(plainSentence(String(c.doc.ex)), 'card', `vocab/${c.id}`);
  // 2. Dialogzeilen der letzten Lektionen.
  for (const l of i.lessonLines ?? []) push(plainSentence(l.en), 'lesson', l.ref);
}

export type SourceInput = {
  cards: readonly TrainCard[];
  /** Dialogzeilen der letzten 3 Lektionen (neueste zuerst). */
  lessonLines?: ReadonlyArray<{ en: string; ref: string }>;
};

/** Diktatsätze: 8–16 Wörter, bekannter Wortschatz zuerst. */
export function dictationSentences(i: SourceInput): DrillSentence[] {
  const out: DrillSentence[] = [];
  const seen = new Set<string>();
  collect((s, src, ref) => {
    const k = s.toLowerCase();
    if (seen.has(k) || !isCleanSentence(s, 8, 16)) return;
    seen.add(k);
    out.push({ s, src, ref, words: wordCount(s) });
  }, i);
  return out;
}

/**
 * Satzbau-Sätze: 6–12 Wörter (mit 1–2 Ablenkern 7–14 Bausteine) aus dem Regelwerk (Formen,
 * gute Fassung der Fallen), eingesetzten Grammatik-Lösungen und Dialogzeilen.
 */
export function orderSentences(i: { lessonLines?: ReadonlyArray<{ en: string; ref: string }>; extraTasks?: readonly GrammarTask[] }): DrillSentence[] {
  const out: DrillSentence[] = [];
  const seen = new Set<string>();
  const push = (raw: string, src: DrillSentence['src'], ref: string | null) => {
    const s = plainSentence(raw);
    const k = s.toLowerCase();
    if (seen.has(k) || !isCleanSentence(s, 6, 12)) return;
    seen.add(k);
    out.push({ s, src, ref, words: wordCount(s) });
  };
  for (const tp of TOPICS) for (const ex of ruleExamples(tp.id, 12)) push(ex, 'rule', `rules/${tp.id}`);
  for (const t of [...(i.extraTasks ?? []), ...seedTasks()]) {
    const s = solvedSentence(t);
    if (s) push(s, 'grammar', `grammar/${t.topic}`);
  }
  for (const l of i.lessonLines ?? []) push(l.en, 'lesson', l.ref);
  return out;
}
