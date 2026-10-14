import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { applyUpdate, MAX_CARD_BYTES } from '../../domain/srs/applyReview';
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
      const r = await writer.transform(path, (cur) => {
        const op = colChargeOp(cur, it.word, it.col);
        if (!op || !cur) return null;
        // Wie beim Antwort-Schreiben: Das Ergebnis muss das Karten-Schema bestehen und unter 64 KiB bleiben (Datenwächter 14.10.2026, Warnung 7).
        const merged = applyUpdate(cur, op.update);
        if (!validateDoc(path, merged).ok || new TextEncoder().encode(JSON.stringify(merged)).length >= MAX_CARD_BYTES) {
          logWarn('data:col', { code: 'invalid_result', message: `${path}: Ergebnis ungültig oder zu groß, nichts geschrieben` }, path);
          return null;
        }
        return op;
      });
      (r === 'updated' ? out.written : out.skipped).push(it.id);
      if (r !== 'updated') logWarn('data:col', { code: 'skipped', message: `${path}: nichts geschrieben (Karte fehlt, ausgeblendet, hat schon Wortpartner oder keine gültigen)` }, path);
    } catch (err) {
      logError('data:col', err, path);
      out.failed.push(it.id);
    }
  }
  return out;
}
