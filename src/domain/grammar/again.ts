import type { GrammarTask } from '../learn/types';
import { hash32 } from '../random';
import { patternOf } from './patterns';
import { allSeedTasks } from './tasks';

// „Gleich nochmal“ der Fehler-Karte (Politur P3): nach einem Fehler derselbe Punkt in einem NEUEN Satz – aus dem geprüften Vorrat, nicht von
// Claude erzeugt. Ein Lückensatz desselben Musters (genau eine Lücke), bevorzugt ungesehen; nie die Aufgabe selbst und nie eine, die in
// dieser Runde noch kommt. Das Muster ist `task.pat`, bei älteren Aufgaben ohne `pat` das eindeutig erkannte (`patternOf`: Zuordnungstabelle,
// sonst Signalwörter; lieber keins als ein falsches). Rein und für dieselbe Aufgabe stabil. Die kleine Übung zählt nicht und wird nicht gebucht.

/** `hint`: das Stichwort der Vorrat-Aufgabe (z. B. „(sign)“), wenn es nicht schon im Satz steht; sonst `null`. */
export type AgainTask = { en: string; answer: string; accepted: readonly string[]; hint: string | null };

const oneGap = (prompt: string): boolean => (prompt.match(/_{3,}/g)?.length ?? 0) === 1 && !prompt.includes('→');

type Ref = Pick<GrammarTask, 'topic' | 'prompt'> & { pat?: string | null | undefined; answer?: string; src?: string };
const patIdOf = (t: Ref): string | null => {
  const { pat, ...rest } = t;
  return patternOf(pat ? { ...rest, pat } : rest)?.id ?? null;
};

/** Lückensätze des Vorrats je `thema|muster` (einmal gebaut; der Vorrat ändert sich zur Laufzeit nicht). */
let index: Map<string, GrammarTask[]> | null = null;
function gapsByPattern(): Map<string, GrammarTask[]> {
  if (index) return index;
  const out = new Map<string, GrammarTask[]>();
  for (const t of allSeedTasks()) {
    if (t.type !== 'gap' || t.c1 || !oneGap(t.prompt)) continue;
    const id = patIdOf(t);
    if (!id) continue;
    const k = `${t.topic}|${id}`;
    const list = out.get(k);
    if (list) list.push(t);
    else out.set(k, [t]);
  }
  index = out;
  return out;
}

export function againFromPool(task: Pick<GrammarTask, 'key' | 'topic' | 'prompt'> & { pat?: string | null | undefined; answer?: string; src?: string }, o: { seen?: ReadonlySet<string>; avoid?: ReadonlySet<string> } = {}): AgainTask | null {
  const pat = patIdOf(task);
  if (!pat) return null;
  const cands = (gapsByPattern().get(`${task.topic}|${pat}`) ?? []).filter((t) => t.key !== task.key && !o.avoid?.has(t.key) && t.prompt !== task.prompt);
  if (!cands.length) return null;
  const rank = (t: GrammarTask): number => (o.seen?.has(t.key) ? 1 : 0);
  const pick = [...cands].sort((a, b) => rank(a) - rank(b) || hash32(`${task.key}|${a.key}`) - hash32(`${task.key}|${b.key}`))[0];
  if (!pick) return null;
  const hint = pick.hint?.trim() && !pick.prompt.includes(pick.hint.trim()) ? pick.hint.trim() : null;
  return { en: pick.prompt, answer: pick.answer, accepted: pick.accepted, hint };
}
