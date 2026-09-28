import { getWriter } from '../../../data';
import { useLive } from '../../../data/live';
import { hiddenOp, knownOp, resetOp, type CardOp } from '../../../domain/srs/vocabList';
import { newVocabDoc, saveCardOp } from '../../../domain/srs/newCard';
import { editOp, tomorrowOp } from '../../../domain/srs/cardOps';
import type { GenWord } from '../../../prompts/wordGen';
import type { TrainCard } from '../../../domain/srs/types';
import { logError } from '../../../platform/diagnostics';

// Schreibwege des Wortschatz-Bereichs (M1/M2): jeweils ein `transform` auf dem frischen Stand.
// Nie gelöscht; ungültige oder ausgeblendete Dokumente bleiben unberührt (vocabList.ts).

type Doc = Record<string, unknown>;

async function run(path: string, op: (cur: Readonly<Doc> | undefined) => CardOp, scope: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    const out = await writer.transform(path, op);
    return out !== 'unchanged';
  } catch (err) {
    logError(scope, err, path);
    return false;
  }
}

export const setHidden = (card: TrainCard, hidden: boolean): Promise<boolean> => run(card.path, (cur) => hiddenOp(cur, card.path, card.inDb ? null : { ...card.doc }, hidden), 'vocab:hide');

export const resetCard = (card: TrainCard): Promise<boolean> => run(card.path, (cur) => resetOp(cur, card.path, Date.now()), 'vocab:reset');

export const markKnown = (card: TrainCard, day: string): Promise<boolean> => run(card.path, (cur) => knownOp(cur, card.path, card.inDb ? null : { ...card.doc }, Date.now(), day), 'vocab:known');

/** „Morgen wieder“ (N25): am nächsten Lerntag fällig, nur `due`/`fsrs` (A6.14). */
export const againTomorrow = (card: TrainCard): Promise<boolean> => run(card.path, (cur) => tomorrowOp(cur, card.path, Date.now()), 'vocab:tomorrow');

/** Karte bearbeiten (N31): Bedeutung und Ursprungssatz, per `transform`. */
export async function editCard(card: TrainCard, lang: 'de' | 'en', e: { meaning: string; sentence: string }): Promise<'ok' | 'sentence' | 'meaning' | 'failed'> {
  const writer = getWriter();
  if (!writer) return 'failed';
  let err: 'sentence' | 'meaning' | undefined;
  try {
    await writer.transform(card.path, (cur) => {
      const r = editOp(cur, card.path, lang, e);
      err = r.error;
      return r.op;
    });
    return err ?? 'ok';
  } catch (x) {
    logError('vocab:edit', x, card.path);
    return 'failed';
  }
}

export type AddOutcome = 'created' | 'extended' | 'exists' | 'invalid' | 'failed';

/** Neue Karte (eigenes Wort oder von Claude). Ohne Satz mit dem Wort gibt es keine Karte (Kap. 15). */
export async function addWord(w: { word: string; de: string; pos?: string | null; def?: string | null; ex: string; level?: string | null }, src: 'user' | 'ai' | 'job', today: string): Promise<AddOutcome> {
  const made = newVocabDoc({ word: w.word, de: w.de, pos: w.pos ?? null, def: w.def ?? null, level: w.level ?? null, ex: w.ex, surface: null, src, origin: { v: 1, kind: src === 'user' ? 'user' : 'ai', t: Date.now() }, today });
  if (!made) return 'invalid';
  const writer = getWriter();
  if (!writer) return 'failed';
  const path = `vocab/${made.id}`;
  let outcome: AddOutcome = 'exists';
  try {
    await writer.transform(path, (cur) => {
      const op = saveCardOp(cur, made);
      outcome = !op ? 'exists' : 'set' in op ? 'created' : 'extended';
      return op;
    });
    return outcome;
  } catch (err) {
    logError('vocab:add', err, path);
    return 'failed';
  }
}

export const addGenerated = (w: GenWord, src: 'ai' | 'job', today: string): Promise<AddOutcome> => addWord(w, src, today);

/** Bekannte Wörter für „nicht vorschlagen" (≤ 200, zuletzt hinzugefügte zuerst). */
export function knownWords(): string[] {
  const vocab = useLive.getState().collections.vocab ?? new Map<string, Doc>();
  return [...vocab.values()]
    .map((d) => (typeof d.word === 'string' ? d.word : ''))
    .filter(Boolean)
    .reverse()
    .slice(0, 200);
}
