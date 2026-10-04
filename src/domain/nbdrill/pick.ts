// Auswahl der Aufgaben einer Runde (rein): reihum durch die Liste, damit an aufeinanderfolgenden
// Runden andere Aufgaben kommen. `offset` ist ein Rundenzähler (Bequemlichkeit, lokal gemerkt).

export function pickRotating<T>(list: readonly T[], n: number, offset: number): T[] {
  if (!list.length || n <= 0) return [];
  const k = Math.min(n, list.length);
  const start = (((Math.floor(offset) * k) % list.length) + list.length) % list.length;
  return Array.from({ length: k }, (_, i) => list[(start + i) % list.length] as T);
}

/** Erst die Einträge, die `prefer` erfüllen (z. B. Thema der Woche), dann die übrigen. */
export function preferFirst<T>(list: readonly T[], prefer: (x: T) => boolean): T[] {
  return [...list.filter(prefer), ...list.filter((x) => !prefer(x))];
}
