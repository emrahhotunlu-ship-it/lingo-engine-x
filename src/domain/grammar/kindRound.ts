import { c1Items } from '../c1x/preload';
import { hash32 } from '../random';
import { pickUnseen, trainable } from '../c1x/select';
import { toTask } from '../c1x/runtime';
import type { C1Item, C1Kind } from '../c1x/types';
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
  /** Lexik-Aufgaben (`wf`), die schon im Verlauf stehen (`doneLexIds`): sie kommen erst wieder dran, wenn nichts Neues mehr da ist. */
  lexDone?: ReadonlySet<string>;
};

const seenOf = (doc: Doc | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);

/**
 * Runde der Wortschatz-Art `wf` (Wort umbauen): die Aufgaben gehören zu keinem Grammatikthema, deshalb wird nicht über Muster, sondern über
 * die Lexik-Muster `lx.wf-*` gemischt. Neues zuerst, Wörter von heute bevorzugt, höchstens zwei gleiche Muster hintereinander, stabiler Startwert.
 */
function lexRound(i: KindRoundInput): GrammarTask[] {
  const words = (i.wordsToday ?? []).map((w) => w.toLowerCase());
  const hit = (it: C1Item): number => (words.length && words.some((w) => (it.lex ?? []).some((l) => l.toLowerCase().includes(w))) ? 0 : 1);
  const pool = c1Items(i.kind)
    .filter((it) => it.area === 'lex' && trainable(it, i.bad))
    .map((it) => ({
      it,
      key: [i.lexDone?.has(it.id) ? 1 : 0, hit(it), hash32(`${i.seed}|${it.id}`)],
    }))
    .sort((a, b) => a.key[0]! - b.key[0]! || a.key[1]! - b.key[1]! || a.key[2]! - b.key[2]!);
  const out: C1Item[] = [];
  const rest = pool.map((x) => x.it);
  while (out.length < i.size && rest.length) {
    const last2 = out.slice(-2).map((x) => x.pat);
    const at = rest.findIndex((x) => !(last2.length === 2 && last2[0] === last2[1] && last2[1] === x.pat));
    out.push(...rest.splice(at < 0 ? 0 : at, 1));
  }
  return out.map((it) => toTask(it, { ref: 'content/c1x' }));
}

export function kindRound(i: KindRoundInput): GrammarTask[] {
  if (i.kind === 'wf') return lexRound(i);
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
        const item = pickUnseen({
          pat: p.id,
          kind: i.kind,
          seen: seenOf(i.grammarDocs.get(topic)),
          used,
          seed: `${i.seed}|${out.length}`,
          allowSeen,
          ...(i.wordsToday ? { wordsToday: i.wordsToday } : {}),
          ...(i.bad ? { bad: i.bad } : {}),
        });
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
