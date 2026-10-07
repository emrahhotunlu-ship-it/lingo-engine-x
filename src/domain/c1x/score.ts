import { scoreCnet } from './kinds/cnet';
import { scoreErr } from './kinds/err';
import { scoreKwt } from './kinds/kwt';
import { scoreMcc } from './kinds/mcc';
import { scoreOcl } from './kinds/ocl';
import { scorePair } from './kinds/pair';
import { scorePara } from './kinds/para';
import { scoreReg } from './kinds/reg';
import { scoreWf } from './kinds/wf';
import type { C1Item, C1Response, C1Score } from './types';
import type { Verdict } from '../grade';

/**
 * Wertung einer c1x-Aufgabe (rein). Die Antwort muss zur Art der Aufgabe passen; eine fremde Antwort zählt als nicht gegeben (0 Punkte).
 * `max` kommt aus der Aufgabe und der Antwortform (z. B. `pair` am Laptop mit Transfer = 3).
 */
export function scoreC1(item: C1Item, r: C1Response): C1Score {
  if (r.kind !== item.kind) return { got: 0, max: maxOf(item), parts: [], verdict: 'wrong', free: false };
  switch (item.kind) {
    case 'mcc':
      return scoreMcc(item, r as Extract<C1Response, { kind: 'mcc' }>);
    case 'ocl':
      return scoreOcl(item, r as Extract<C1Response, { kind: 'ocl' }>);
    case 'wf':
      return scoreWf(item, r as Extract<C1Response, { kind: 'wf' }>);
    case 'kwt':
      return scoreKwt(item, r as Extract<C1Response, { kind: 'kwt' }>);
    case 'err':
      return scoreErr(item, r as Extract<C1Response, { kind: 'err' }>);
    case 'pair':
      return scorePair(item, r as Extract<C1Response, { kind: 'pair' }>);
    case 'cnet':
      return scoreCnet(item, r as Extract<C1Response, { kind: 'cnet' }>);
    case 'reg':
      return scoreReg(item, r as Extract<C1Response, { kind: 'reg' }>);
    case 'para':
      return scorePara(item, r as Extract<C1Response, { kind: 'para' }>);
  }
}

/** Höchstpunktzahl der Aufgabe in ihrer üblichen Form (Handy; `pair` mit Transfer und `para`/`reg` am Laptop haben mehr). */
export function maxOf(item: C1Item): number {
  switch (item.kind) {
    case 'kwt':
    case 'err':
    case 'pair':
      return 2;
    case 'cnet':
      return item.right.length;
    case 'reg':
      return item.segs.length;
    default:
      return 1;
  }
}

/** „Richtig“ heißt: volle Punktzahl und nicht „nicht sicher prüfbar“. Alles andere ist „Fast“ oder falsch (Buchung P13). */
export const verdictOf = (s: C1Score): Verdict => s.verdict;
export const isFull = (s: C1Score): boolean => s.verdict === 'correct';
