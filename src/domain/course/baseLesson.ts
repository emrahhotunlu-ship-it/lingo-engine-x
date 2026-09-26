import { slug } from '../content';
import { ruleExamples } from '../grammar/rules';
import { seedTasks } from '../grammar/tasks';
import type { GrammarTask, LessonContent, LessonMeta } from '../learn/types';
import { findContext } from '../srs/context';

// Grundfassung einer Lektion ohne KI (phase2-plan D11, wie `fallbackLesson` der alten App,
// lesson.js:95). Sie wird nie gespeichert und macht jede Lektion ohne KI vollständig machbar:
// - Wörter aus dem Lehrplan, Bedeutung/Satz aus der vorhandenen Karte, sonst ohne Satz,
// - statt Dialog 4–6 „Beispiele" zur Zielstruktur aus dem Regelwerk (keine Fragen),
// - mindestens 4 Grammatikaufgaben aus Pool und Startaufgaben, höchstens 1 Multiple Choice
//   (mehr nur, wenn es sonst nicht genug gibt),
// - Produktion: das Can-Do-Ziel als Aufgabe, die ersten drei Zielwörter als Pflichtwörter.

type Doc = Record<string, unknown>;

export const BASE_TASKS = 4;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Zielwort ohne führendes „to " und ohne Platzhalter wie „something". */
export function coreWord(en: string): string {
  return en
    .replace(/^to\s+/i, '')
    .replace(/\b(something|someone|somebody|sth|sb)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Aufgabe als gelöster Satz (Lücke gefüllt, Hinweis in Klammern entfernt); `null`, wenn das nicht geht. */
export function solvedSentence(t: Pick<GrammarTask, 'type' | 'prompt' | 'answer'>): string | null {
  if (t.type === 'correct') return t.answer.trim();
  const target = t.type === 'transform' ? (t.prompt.split('→')[1] ?? '') : t.prompt;
  if (!/_{3,}/.test(target)) return null;
  return target
    .replace(/_{3,}/, t.answer.trim())
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function lessonTasks(topic: string, pool: readonly GrammarTask[], seen: ReadonlySet<string>): GrammarTask[] {
  const all = [...pool.filter((t) => t.topic === topic), ...seedTasks().filter((t) => t.topic === topic)];
  const uniq: GrammarTask[] = [];
  for (const t of all) if (!uniq.some((u) => u.key === t.key)) uniq.push(t);
  const ordered = [...uniq.filter((t) => !seen.has(t.key)), ...uniq.filter((t) => seen.has(t.key))];
  const out: GrammarTask[] = [];
  let mc = 0;
  for (const t of ordered) {
    if (out.length >= BASE_TASKS) break;
    if (t.type === 'mc' && mc >= 1) continue;
    if (t.type === 'mc') mc++;
    out.push(t);
  }
  for (const t of ordered) {
    if (out.length >= BASE_TASKS) break;
    if (!out.includes(t)) out.push(t);
  }
  return out.map((t) => ({ ...t, src: t.src === 'pool' ? 'pool' : 'seed' }));
}

export function baseLesson(
  meta: LessonMeta,
  deps: { vocab?: ReadonlyMap<string, Readonly<Doc>>; pool?: readonly GrammarTask[]; seen?: ReadonlySet<string> } = {},
): LessonContent {
  const words = meta.words.map(([en, de]) => {
    const card = deps.vocab?.get(slug(en));
    const ex = str(card?.ex);
    return {
      en,
      de: str(card?.de) || de,
      pos: str(card?.pos) || 'phrase',
      def: str(card?.def),
      // Nur ein Satz, in dem das Wort wirklich steht (Kap. 15: Karten mit Ursprungssatz).
      ex: ex && findContext(ex, en) ? ex : '',
    };
  });
  const examples = ruleExamples(meta.grammar, 6);
  // Zu wenige Beispiele im Regelwerk: gelöste Startaufgaben als ganze Sätze ergänzen.
  for (const t of seedTasks()) {
    if (examples.length >= 4) break;
    if (t.topic !== meta.grammar) continue;
    const s = solvedSentence(t);
    if (s && !examples.includes(s)) examples.push(s);
  }
  return {
    words,
    dialogue: { title: meta.en, lines: examples.map((en) => ({ sp: '', en, de: '' })) },
    questions: [],
    tasks: lessonTasks(meta.grammar, deps.pool ?? [], deps.seen ?? new Set()),
    output: { de: meta.cando_de, en: meta.cando_en, mustUse: meta.words.slice(0, 3).map(([en]) => coreWord(en)) },
    source: 'base',
  };
}
