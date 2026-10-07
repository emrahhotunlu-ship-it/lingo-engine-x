import type { UnitState } from '../metrics/definitions';

// Momente erkennen (Lernplattform 3.0 P56, Erlebnis-Engine §2.2/§4): Vorher/Nachher → Zustandswechsel. Rein und ohne Seiteneffekte; ob und wie ein
// Moment spielt (Stufe, Ton, Funken), entscheidet der Dirigent. Hier steht nur, OB sich etwas wirklich geändert hat (Kap. 2 Nr. 2: keine Feier ohne Grund).

const RANK: Readonly<Record<UnitState, number>> = { new: 0, learning: 1, safe: 2, firm: 3 };

export type StateUp = { id: string; from: UnitState; to: UnitState };

/** Einheiten, deren Zustand gestiegen ist (Neu → Lernt → Sicher → Fest). Fehlt der Vorher-Wert, zählt die Einheit als neu. Reihenfolge = Nachher. */
export function stateUps(before: ReadonlyMap<string, UnitState>, after: ReadonlyMap<string, UnitState>): StateUp[] {
  const out: StateUp[] = [];
  for (const [id, to] of after) {
    const from = before.get(id) ?? 'new';
    if (RANK[to] > RANK[from]) out.push({ id, from, to });
  }
  return out;
}

/** Höchstens so viele Ursprünge für Funken am Rundenende (EE4: nur, was gestiegen ist). */
export const ROUND_SPARK_MAX = 3;

/**
 * Funken am Rundenende: höchstens drei Ursprünge, die Festen zuerst (sie sind seltener und wichtiger), sonst in Anzeigereihenfolge.
 * Leere Liste = nichts ist gestiegen → keine Funken (die Karte erscheint trotzdem ruhig).
 */
export function roundSparks<T extends { to: UnitState }>(ups: readonly T[], max: number = ROUND_SPARK_MAX): T[] {
  const idx = ups.map((u, i) => [u, i] as const);
  idx.sort((a, b) => RANK[b[0].to] - RANK[a[0].to] || a[1] - b[1]);
  return idx.slice(0, Math.max(0, max)).map(([u]) => u);
}

export type DayPhase = 'open' | 'done';

/**
 * Tag geschafft (EE M7): nur beim Übergang „offen → fertig“ in dieser Sitzung. Wer die App am Abend schon fertig öffnet, sieht den stillen Ring
 * (`prev === null` oder `'done'`). `played` = heute schon gezeigt (Browser-Merker).
 */
export function dayMoment(prev: DayPhase | null, next: DayPhase, played: boolean): boolean {
  return prev === 'open' && next === 'done' && !played;
}

/** Zahlen-Rollen (EE M6): nur, wenn sich der Wert seit dem letzten Anzeigen geändert hat. Beim ersten Anzeigen rollt sie (es gibt kein „vorher“). */
export function numberRolls(lastShown: string | null, value: string): boolean {
  return lastShown !== value;
}

// ------------------------------------------------------------------ Aufstieg (EE M8)

/** Meilensteine mit eigener Aufstiegskarte. Kapitel und C1-reif mit Emblem; Wort-Marken ab 250 als Karte mit Zahl (Motivation §4.2: Emblem nur für Kapitel). */
export type LevelKind = { kind: 'chapter'; n: 1 | 2 | 3 | 4 | 5 | 6 | 7 } | { kind: 'c1' } | { kind: 'words'; n: number };

/** Ordnet eine Meilenstein-ID einer Aufstiegskarte zu; `null` = nur ein Satz (z. B. `fest100`, `topic1`). */
export function levelUpFor(id: string): LevelKind | null {
  const ch = /^ch([1-7])$/.exec(id);
  if (ch) return { kind: 'chapter', n: Number(ch[1]) as 1 | 2 | 3 | 4 | 5 | 6 | 7 };
  if (id === 'c1ready') return { kind: 'c1' };
  const f = /^fest(\d+)$/.exec(id);
  if (f) {
    const n = Number(f[1]);
    return n >= 250 ? { kind: 'words', n } : null;
  }
  return null;
}

/** Höchstens so viele gemerkte IDs je Gerät (EE §11). */
export const SEEN_MAX = 200;

/** Den ersten noch nicht gesehenen Aufstieg wählen (höchstens einer je Sitzung, EE M8). */
export function nextLevelUp(ids: readonly string[], seen: readonly string[]): { id: string; level: LevelKind } | null {
  const s = new Set(seen);
  for (const id of ids) {
    if (s.has(id)) continue;
    const level = levelUpFor(id);
    if (level) return { id, level };
  }
  return null;
}

/** Merkliste fortschreiben: neu hinten, älteste fallen bei mehr als 200 heraus; doppelte nie. */
export function markSeen(seen: readonly string[], id: string): string[] {
  if (seen.includes(id)) return [...seen];
  const out = [...seen, id];
  return out.length > SEEN_MAX ? out.slice(out.length - SEEN_MAX) : out;
}

/** Merkliste aus dem Browser lesen (tolerant). */
export function parseSeen(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-SEEN_MAX) : [];
  } catch {
    // Kaputter Merker: wie leer (es ist nur Bequemlichkeit).
    return [];
  }
}
