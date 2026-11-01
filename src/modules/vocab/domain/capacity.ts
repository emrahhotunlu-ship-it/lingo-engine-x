// Kapazitätsanzeige (N8; A6 Nr. 6; plan.md §3.6): Dokumente gesamt, Warnschwellen 4.000 / 4.500, Jahre bis zur Grenze, `vlog`-Größe.

export const DOC_LIMIT = 5000;
export const WARN_1 = 4000;
export const WARN_2 = 4500;

export type Capacity = { total: number; level: 'ok' | 'warn' | 'high'; yearsLeft: number | null; vlogBytes: number; vlogDocs: number; perYear: number };

/** `perYear` = erwartete neue Dokumente je Jahr (neue Lexeme je Tag × 365 + 365 `log/<Tag>` + 24 `vlog`). */
export function capacity(total: number, vlogSizes: readonly number[], newPerDay: number): Capacity {
  const perYear = Math.round(newPerDay * 365 + 365 + 24);
  const level = total >= WARN_2 ? 'high' : total >= WARN_1 ? 'warn' : 'ok';
  return { total, level, yearsLeft: perYear > 0 ? Math.max(0, Math.round(((DOC_LIMIT - total) / perYear) * 10) / 10) : null, vlogBytes: vlogSizes.reduce((a, b) => a + b, 0), vlogDocs: vlogSizes.length, perYear };
}
