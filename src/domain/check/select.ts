import { TOPICS } from '../content';
import { topicP } from '../grammar/bkt';
import { allSeedTasks, forProfile, wantTypes, type InputProfile } from '../grammar/tasks';
import type { GrammarTask } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';
import { supports } from '../srs/modes';
import type { ExerciseId, Lang, TrainCard } from '../srs/types';
import { CHECK_PLAN } from './record';

// Aufgaben des Wochen-Checks (M10, Port von `startSession("check")` der alten App): 5 bekannte
// Wörter (ab Stufe 3 aktiv in der Lücke bzw. getippt, sonst Bedeutung wählen), 2 Wendungen
// (Kollokationen) und 5 Grammatikaufgaben aus bereits geübten Themen – verschachtelt (2 Wörter,
// 2 Grammatik, …). Ohne Tipps, ohne Wiederholung in der Runde: der Check misst, statt zu lehren.
// Karten, die heute ohnehin fällig sind, werden nach hinten gestellt, damit der Check der
// Pflicht „Wiederholen" nichts wegnimmt (zählt nie als Pflicht).

type Doc = Readonly<Record<string, unknown>>;

export type CheckItem = { kind: 'v'; key: string; ex: ExerciseId } | { kind: 'g'; task: GrammarTask };

export type SelectInput = {
  cards: readonly TrainCard[];
  grammarDocs: ReadonlyMap<string, Doc>;
  /** Weitere Aufgabenquellen (Tagesauftrag, Pool, erledigte Lektionen) vor den Startaufgaben. */
  sources: ReadonlyArray<readonly GrammarTask[]>;
  nowMs: number;
  /** Ende des Lerntags: Karten mit `due` davor gelten als heute fällig. */
  dayEndMs: number;
  lang: Lang;
  seed: string;
  /** Eingabeprofil der Runde (einmal eingefroren): `touch` stellt nie einen ganzen Satz (Lernplattform 2.0 §5.2). Ohne Angabe: Tastatur. */
  profile?: InputProfile;
};

/** Übungsart eines Wortes im Check – nie eine Art mit eingebauter Hilfe (`cloze_hint`). */
export function checkExercise(card: TrainCard, lang: Lang, poolSize: number): ExerciseId | null {
  const order: ExerciseId[] = card.stage >= 3 ? ['cloze', 'type', 'mc_de', 'mc_en'] : ['mc_de', 'mc_en', 'type'];
  return order.find((ex) => supports(card, ex, lang, poolSize)) ?? null;
}

const seenOf = (doc: Doc | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);

export function selectCheck(i: SelectInput): CheckItem[] {
  const rng = mulberry32(hash32(i.seed));
  const known = i.cards.filter((c) => !c.hidden && !c.isNew && c.stage >= 1);
  // Nur nicht heute fällige Karten: der Check darf der Pflicht „Wiederholen" nie Karten wegnehmen.
  const ordered = shuffle(known.filter((c) => c.fsrs.due >= i.dayEndMs), rng);
  const poolSize = i.cards.filter((c) => !c.hidden).length;

  const used = new Set<string>();
  const words: CheckItem[] = [];
  const collocs: CheckItem[] = [];
  for (const c of ordered) {
    if (collocs.length >= CHECK_PLAN.colloc) break;
    if (supports(c, 'colloc', i.lang, poolSize)) {
      collocs.push({ kind: 'v', key: c.key, ex: 'colloc' });
      used.add(c.key);
    }
  }
  for (const c of ordered) {
    if (words.length >= CHECK_PLAN.vocab) break;
    if (used.has(c.key)) continue;
    const ex = checkExercise(c, i.lang, poolSize);
    if (!ex) continue;
    words.push({ kind: 'v', key: c.key, ex });
    used.add(c.key);
  }
  const vocab = [...words, ...collocs];

  // Grammatik: geübte Themen (n > 0); gibt es weniger als 5, kommen die übrigen dazu.
  const trained = TOPICS.filter((t) => typeof i.grammarDocs.get(t.id)?.n === 'number' && (i.grammarDocs.get(t.id)?.n as number) > 0).map((t) => t.id);
  const rest = TOPICS.map((t) => t.id).filter((id) => !trained.includes(id));
  const topics = [...shuffle(trained, rng), ...(trained.length >= CHECK_PLAN.gram ? [] : shuffle(rest, rng))].slice(0, CHECK_PLAN.gram);
  // Quellen: Tagesauftrag und Pool vor den Startaufgaben; die Startaufgaben enthalten auch die neuen Arten (Schlüsselwort, Fehler
  // finden, Bedeutungspaar). Im Wochen-Check zählt je Aufgabe genau ein Muster (`pat`): Aufgaben mit Muster kommen zuerst.
  const profile = i.profile ?? 'keys';
  const forP = (l: readonly GrammarTask[]): GrammarTask[] => l.flatMap((t) => forProfile(t, profile) ?? []);
  const lists = [...i.sources, shuffle(allSeedTasks(), rng)].map(forP);
  const taken = new Set<string>();
  const gram: CheckItem[] = [];
  for (const [k, topic] of topics.entries()) {
    const seen = seenOf(i.grammarDocs.get(topic));
    // Die Wunschformen reihum (Gedächtnis: Bedeutungspaar/Lücke, Fehler finden, Schlüsselwort), damit auch find, kwt und meaning drankommen.
    const base = wantTypes(topicP(topic, i.grammarDocs.get(topic), i.nowMs), profile);
    const want = [...base.slice(k % base.length), ...base.slice(0, k % base.length)];
    let pick: GrammarTask | null = null;
    for (const pass of [0, 1]) {
      for (const list of lists) {
        const cands = list.filter((t) => t.topic === topic && !taken.has(t.key) && (pass === 1 || !seen.has(t.key))).sort((a, b) => (b.pat ? 1 : 0) - (a.pat ? 1 : 0));
        pick = want.map((ty) => cands.find((t) => t.type === ty)).find(Boolean) ?? cands[0] ?? null;
        if (pick) break;
      }
      if (pick) break;
    }
    if (!pick) continue;
    taken.add(pick.key);
    gram.push({ kind: 'g', task: { ...pick, errorT: null } });
  }

  // Verschachteln: 2 Wörter, 2 Grammatik, …
  const out: CheckItem[] = [];
  let v = 0;
  let g = 0;
  while (v < vocab.length || g < gram.length) {
    for (let k = 0; k < 2 && v < vocab.length; k++) out.push(vocab[v++] as CheckItem);
    for (let k = 0; k < 2 && g < gram.length; k++) out.push(gram[g++] as CheckItem);
  }
  return out;
}
