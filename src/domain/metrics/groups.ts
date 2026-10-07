import { PACK, PACK_CATS, type PackCat } from '../c1pack/pack';
import type { TrainCard } from '../srs/types';
import { unitState, type UnitState } from './definitions';

// Meisterschaft je Wortgruppe (Motivation §4.6): Neu · Lernt · Sicher · Fest. Die Summe der vier Zustände ist immer die Gruppengröße.
// Gruppen sind die sieben Kategorien des C1-Pakets; eine Karte gehört dazu über `origin.ref`/`src.ref` = `c1pack/<id>`.

export type GroupMastery = { group: PackCat; size: number } & Record<UnitState, number>;

const REF = 'c1pack/';
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Paket-Eintrag, zu dem die Karte gehört (oder `null`). */
export function packIdOf(card: Pick<TrainCard, 'doc'>): string | null {
  for (const k of ['origin', 'src'] as const) {
    const o = card.doc[k];
    const ref = isObj(o) ? o.ref : undefined;
    if (typeof ref === 'string' && ref.startsWith(REF)) return ref.slice(REF.length);
  }
  return null;
}

/** Zustände einer Gruppe; nicht angelegte oder ausgeblendete Einträge zählen als Neu. `entries` ist nur für Tests austauschbar. */
export function groupMastery(group: PackCat, cards: readonly TrainCard[], entries: ReadonlyArray<{ id: string; cat: PackCat }> = PACK): GroupMastery {
  const ids = new Set(entries.filter((e) => e.cat === group).map((e) => e.id));
  const out: GroupMastery = { group, size: ids.size, new: 0, learning: 0, safe: 0, firm: 0 };
  const seen = new Set<string>();
  for (const c of cards) {
    const id = packIdOf(c);
    if (!id || !ids.has(id) || seen.has(id) || c.hidden) continue;
    seen.add(id);
    out[unitState(c)]++;
  }
  out.new += ids.size - seen.size;
  return out;
}

/** Alle sieben Gruppen. */
export const allGroups = (cards: readonly TrainCard[], entries?: ReadonlyArray<{ id: string; cat: PackCat }>): GroupMastery[] => PACK_CATS.map((g) => groupMastery(g, cards, entries));
