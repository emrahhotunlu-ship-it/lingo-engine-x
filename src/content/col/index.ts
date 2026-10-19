import { lemmaOf } from '../../domain/srs/context';
import charge1 from './charge1.json';

// Wortpartner-Charge `col` (S4, wort-lernen-plan.md, Stufe 2): geprüfte Kollokationen für vorhandene Karten OHNE `col`.
// Schlüssel ist das Kartenwort (klein, ohne „to "), keine Karten-ID: echte IDs gehören nicht ins Repository. Geschrieben wird
// nur über `colChargeOp` (ergänzend, gleiche Prüfung wie Claudes Wortpartner); `en` ist eine Lesehilfe für die Gegenlesung.

export type ColChargeEntry = { p: string; de: string; gap: string; opts: string[]; ex: string };
type RawItem = { word: string; col: Array<ColChargeEntry & { en?: string }> };

const key = (w: string): string => lemmaOf(w).toLowerCase().replace(/\s+/g, ' ');

const byWord = new Map<string, ColChargeEntry[]>();
for (const it of (charge1 as { items: RawItem[] }).items) {
  byWord.set(
    key(it.word),
    it.col.map(({ p, de, gap, opts, ex }) => ({ p, de, gap, opts: [...opts], ex })),
  );
}

/** Alle Wörter der Charge (Schlüsselform). */
export const COL_CHARGE_WORDS: readonly string[] = [...byWord.keys()];

/** Wortpartner der Charge für ein Kartenwort (`to ` und Groß/klein egal) – als Rohdaten für `colChargeOp`, sonst `null`. */
export function colChargeFor(word: string): ColChargeEntry[] | null {
  const hit = byWord.get(key(word));
  return hit ? hit.map((c) => ({ ...c, opts: [...c.opts] })) : null;
}
