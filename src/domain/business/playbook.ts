import data from '../../content/business/playbooks.json';
import type { DrillItem, Playbook, PlaybookNode } from './types';

// Phrasen-Baukasten (Plan D9): Entscheidungsbäume als INHALT, zweisprachig, ohne KI nutzbar.

export const PLAYBOOKS = (data as unknown as { playbooks: Playbook[] }).playbooks;

export const playbookById = (id: string): Playbook | undefined => PLAYBOOKS.find((p) => p.id === id);

export function nodeOf(pb: Playbook, id: string): PlaybookNode | undefined {
  return Object.hasOwn(pb.nodes, id) ? pb.nodes[id] : undefined;
}

/** Alle vom Start aus erreichbaren Knoten; wirft bei Zyklus oder fehlendem Ziel (Test). */
export function walk(pb: Playbook): string[] {
  const seen: string[] = [];
  const visit = (id: string, path: readonly string[]) => {
    if (path.includes(id)) throw new Error(`${pb.id}: cycle at ${id}`);
    const n = nodeOf(pb, id);
    if (!n) throw new Error(`${pb.id}: missing node ${id}`);
    if (!seen.includes(id)) seen.push(id);
    if (n.kind === 'question') for (const o of n.options) visit(o.next, [...path, id]);
  };
  visit(pb.root, []);
  return seen;
}

/** Großer Anfangsbuchstabe – alle Antworten im Drill sehen gleich aus (verrät nichts). */
export const sentenceCase = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export type DrillQuestion = DrillItem & { order: [number, number, number] };

/** Fragen des Drills; die Reihenfolge der Antworten ist je Frage fest verschoben (deterministisch). */
export function drillQuestions(pb: Playbook, seed: number): DrillQuestion[] {
  return pb.drill.map((d, i) => {
    const r = (seed + i * 7) % 3;
    const order: [number, number, number] = r === 0 ? [0, 1, 2] : r === 1 ? [2, 0, 1] : [1, 2, 0];
    return { ...d, order };
  });
}

export function drillScore(answers: ReadonlyArray<{ chosen: number; answer: number }>): { n: number; right: number } {
  return { n: answers.length, right: answers.filter((a) => a.chosen === a.answer).length };
}
