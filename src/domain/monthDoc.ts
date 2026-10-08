import { logWarn } from '../platform/diagnostics';

// Gemeinsame Hilfen für Monatsdokumente (`talk/`, `say/`, `tones/` …; A6.6: wachsende Ströme zusammenfassen).
// Ein Eintrag wird über `id` eingefügt oder ersetzt (idempotent); zu große Dokumente werden verdichtet.

type Doc = Record<string, unknown>;

const encoder = new TextEncoder();
export const jsonBytes = (v: unknown): number => encoder.encode(JSON.stringify(v)).length;

/** Monatsschlüssel eines Lerntags: '2026-09-30' → '2026-09'. */
export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const tOf = (v: unknown): number => {
  const t = obj(v).t;
  return typeof t === 'number' && Number.isFinite(t) ? t : 0;
};

/** Liste mit `item` (gleiche `id` wird ersetzt), nach Zeit sortiert. */
export function upsertById(list: readonly unknown[], item: { id: string; t: number }): unknown[] {
  const rest = list.filter((x) => obj(x).id !== item.id);
  // Überschreiben mit gleicher Kennung ergänzt den alten Eintrag (unbekannte Felder bleiben), statt ihn ganz zu ersetzen.
  const old = list.find((x) => obj(x).id === item.id);
  return [...rest, old ? { ...obj(old), ...item } : item].sort((a, b) => tOf(a) - tOf(b));
}

/**
 * Verdichtet eine Liste von Einträgen, bis sie (als Dokument) unter `maxBytes` liegt. `steps`
 * sind Felder, die nacheinander beim jeweils ältesten Eintrag geleert werden, der sie noch hat.
 */
export function compactList(list: readonly unknown[], steps: ReadonlyArray<(item: Doc) => Doc | null>, maxBytes: number, wrap: (items: unknown[]) => Doc): unknown[] {
  let items = list.map((x) => ({ ...obj(x) }));
  for (const step of steps) {
    let i = 0;
    while (jsonBytes(wrap(items)) > maxBytes && i < items.length) {
      const next = step(items[i] as Doc);
      if (next) items = items.map((x, k) => (k === i ? next : x));
      i++;
    }
  }
  // Letzte Rettung: älteste Einträge entfernen (ohne sie wäre das Dokument nicht schreibbar) – nie still.
  const before = items.length;
  while (items.length > 1 && jsonBytes(wrap(items)) > maxBytes) items = items.slice(1);
  if (items.length < before) {
    const month = obj(wrap([])).month;
    logWarn('compact:drop', new Error(`${before - items.length} oldest entries removed to stay under ${maxBytes} bytes`), typeof month === 'string' ? month : undefined);
  }
  return items;
}
