import { getWriter } from '../../data';
import { colChargeOp } from '../../domain/srs/collocs';
import { logError, logWarn } from '../../platform/diagnostics';

// Schreibweg der Inhaltscharge `col` (Wortpartner für Karten ohne `col`, Wörter aktivieren Stufe 2). VORBEREITET, noch nicht aufgerufen: Die Inhalte folgen als
// Charge mit Gegenlesung durch den Englischlehrer. Ein `transform` je Karte auf dem frischen Stand, nur ergänzend (`colChargeOp`), nie löschen oder ersetzen.

export type ColChargeItem = { id: string; word: string; col: unknown };
export type ColChargeResult = { written: string[]; skipped: string[]; failed: string[] };

export async function applyColCharge(items: readonly ColChargeItem[]): Promise<ColChargeResult> {
  const out: ColChargeResult = { written: [], skipped: [], failed: [] };
  const writer = getWriter();
  if (!writer) return { ...out, failed: items.map((i) => i.id) };
  for (const it of items) {
    const path = `vocab/${it.id}`;
    try {
      const r = await writer.transform(path, (cur) => colChargeOp(cur, it.word, it.col));
      (r === 'updated' ? out.written : out.skipped).push(it.id);
      if (r !== 'updated') logWarn('data:col', { code: 'skipped', message: `${path}: nichts geschrieben (Karte fehlt, ausgeblendet, hat schon Wortpartner oder keine gültigen)` }, path);
    } catch (err) {
      logError('data:col', err, path);
      out.failed.push(it.id);
    }
  }
  return out;
}
