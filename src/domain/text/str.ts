// Beliebiger gelesener Wert → Text (Zahlen und Wahrheitswerte als Text, alles andere leer).
// Für tolerant gelesene Altdaten, ohne je „[object Object]" zu erzeugen.
export function asText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  return '';
}
