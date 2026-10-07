import { addLocalDays } from '../date';
import type { ErrorEntry } from '../grammar/errors';
import { c1ItemById } from './preload';
import { kindsFor, pickUnseen } from './select';
import type { C1Input, C1Item, C1Kind } from './types';
import { c1Key } from './runtime';

// Die Fehlerschleife der c1x-Aufgaben (Lernplattform 3.0 §3.4, P13): ein Fehlersatz kommt im SELBEN Baustein zurück. Rein.
//
//   Box 0 (neuer Eintrag, morgen)   dieselbe Aufgabe (derselbe Baustein, Eingabeform des Geräts)
//   Box 1 (nach 3 Tagen)            eine ungesehene Aufgabe desselben Musters und DERSELBEN Art; keine da: eine ANDERE Art desselben Musters;
//                                   keine da: (Claude-Variante nur im Extra, Aufruf von außen); keine da: dieselbe Aufgabe frühestens nach 14 Tagen
//   Box ≥ 2 (nach 9 Tagen)          die produktive Art (`ocl` oder `kwt`, getippt) desselben Musters; sonst wie Box 1
// (Box = Feld `box` des Fehlereintrags; LP3 nennt die Intervalle 1/3/9 Tage.) Der freie Satz zum Muster (Satz-Klinik) kommt mit P46.

export type RepeatHow = 'same' | 'sameKind' | 'otherKind' | 'productive';
export type RepeatPick = { item: C1Item; how: RepeatHow };

/** Mindestabstand, bevor dieselbe Aufgabe wieder als Ersatz dient (Tage). */
export const SAME_AGAIN_DAYS = 14;
const PRODUCTIVE: readonly C1Kind[] = ['ocl', 'kwt'];

export type RepeatCtx = {
  seen: ReadonlySet<string>;
  bad?: ReadonlySet<string>;
  used?: ReadonlySet<string>;
  seed: string;
  nowMs: number;
  inp: C1Input;
  /** p des Themas (für die Stufenwahl der anderen Art). */
  p?: number;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * Die Aufgabe für die Wiederholung eines Fehlereintrags mit `cid`. `null`, wenn die ursprüngliche Aufgabe nicht (mehr) aufzulösen ist
 * (noch nicht geladen, verdichtet, entfernt): dann gilt der Fehlersatz-Text (`errorTask`).
 */
export function repeatPick(e: Pick<ErrorEntry, 'cid' | 'box' | 't' | 'last' | 'pat'>, c: RepeatCtx): RepeatPick | null {
  const cid = typeof e.cid === 'string' ? e.cid : null;
  if (!cid) return null;
  const own = c1ItemById(cid);
  if (!own) return null;
  const box = num(e.box) ?? 0;
  const pat = own.pat;
  const common = { pat, seen: c.seen, ...(c.bad ? { bad: c.bad } : {}), used: new Set([...(c.used ?? []), c1Key(own.id)]), seed: `${c.seed}|${cid}` };
  const sameKind = (k: C1Kind): RepeatPick | null => {
    const it = pickUnseen({ ...common, kind: k });
    return it ? { item: it, how: k === own.kind ? 'sameKind' : 'otherKind' } : null;
  };
  const otherKinds = (): RepeatPick | null => {
    for (const k of kindsFor(c.p ?? 0.5, c.inp, pat)) {
      if (k === own.kind) continue;
      const r = sameKind(k);
      if (r) return r;
    }
    return null;
  };
  const sameAgain = (): RepeatPick | null => {
    const last = num(e.last) ?? num(e.t) ?? 0;
    return c.nowMs >= addLocalDays(last, SAME_AGAIN_DAYS) ? { item: own, how: 'same' } : null;
  };
  if (box <= 0) return { item: own, how: 'same' };
  if (box >= 2) {
    for (const k of PRODUCTIVE) {
      const it = pickUnseen({ ...common, kind: k });
      if (it) return { item: it, how: 'productive' };
    }
  }
  return sameKind(own.kind) ?? otherKinds() ?? sameAgain();
}
