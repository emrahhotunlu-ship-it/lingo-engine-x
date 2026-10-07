import { pickUnseen } from '../c1x/select';
import { toTask } from '../c1x/runtime';
import type { C1Kind } from '../c1x/types';
import type { GrammarTask } from '../learn/types';
import { patInfos } from './slotInput';
import { patternById } from './patterns';

// Eine Übungsrunde nur einer c1x-Art (Reiter Anwenden, z. B. „Satz-Umformung“ = `kwt`; Lernplattform 3.0 §2.5/P16). Freiwillig, nie Pflicht.
// Reihum über die eingeführten Muster (fälligste zuerst), je Muster eine ungesehene Aufgabe; erst wenn es nichts Ungesehenes mehr gibt, auch gesehene.

type Doc = Readonly<Record<string, unknown>>;

export type KindRoundInput = {
  kind: C1Kind;
  size: number;
  grammarDocs: ReadonlyMap<string, Doc>;
  seed: string;
  wordsToday?: readonly string[];
  bad?: ReadonlySet<string>;
};

const seenOf = (doc: Doc | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);

export function kindRound(i: KindRoundInput): GrammarTask[] {
  const pats = patInfos(i.grammarDocs)
    .filter((p) => !!p.entry && (p.entry.i !== undefined || (p.entry.n ?? 0) > 0))
    .sort((a, b) => (a.entry?.last ?? 0) - (b.entry?.last ?? 0) || a.id.localeCompare(b.id));
  const used = new Set<string>();
  const out: GrammarTask[] = [];
  for (const allowSeen of [false, true]) {
    let progress = true;
    while (out.length < i.size && progress) {
      progress = false;
      for (const p of pats) {
        if (out.length >= i.size) break;
        const topic = patternById(p.id)?.topic;
        if (!topic) continue;
        const item = pickUnseen({ pat: p.id, kind: i.kind, seen: seenOf(i.grammarDocs.get(topic)), used, seed: `${i.seed}|${out.length}`, allowSeen, ...(i.wordsToday ? { wordsToday: i.wordsToday } : {}), ...(i.bad ? { bad: i.bad } : {}) });
        if (!item) continue;
        const task = toTask(item, { ref: `grammar/${topic}` });
        used.add(task.key);
        out.push(task);
        progress = true;
      }
    }
  }
  return out;
}
