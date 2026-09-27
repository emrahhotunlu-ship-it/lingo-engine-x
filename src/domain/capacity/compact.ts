import { jsonEqual } from '../equal';
import { isDayKey } from '../date';
import { DAY_MAPS, jsonBytes } from './profileSize';
import { compactSeq } from '../progress/profilePatch';

// Auslagern alter Profiljahre (Plan §12.3, W5): rein. Kalenderjahre ≤ laufendes Jahr − 2 wandern
// aus den Tageskarten nach `archive/profile-<JJJJ>`. Nichts geht verloren: Profil ⊕ Archive =
// Original (Test). Serie, Verlauf und Export lesen beides zusammen (`mergeArchives`).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

export type DayMapKey = (typeof DAY_MAPS)[number];
export type ArchiveDoc = { v: 1; year: number; from: 'app/profile'; t: number } & Record<DayMapKey, Doc>;
export type CompactPlan = { years: number[]; archives: Record<string, ArchiveDoc>; removeKeys: Record<DayMapKey, string[]>; bytesMoved: number };

export const archivePath = (year: number): string => `archive/profile-${year}`;

export function compactPlan(profile: Doc, today: string, t: number): CompactPlan {
  const maxYear = Number(today.slice(0, 4)) - 2;
  const archives: Record<string, ArchiveDoc> = {};
  const removeKeys = Object.fromEntries(DAY_MAPS.map((k) => [k, [] as string[]])) as unknown as Record<DayMapKey, string[]>;
  let bytesMoved = 0;
  for (const k of DAY_MAPS) {
    for (const [d, v] of Object.entries(obj(profile[k]))) {
      if (!isDayKey(d)) continue;
      const y = Number(d.slice(0, 4));
      if (y > maxYear) continue;
      const path = archivePath(y);
      const a = (archives[path] ??= { v: 1, year: y, from: 'app/profile', t, days: {}, xpDays: {}, minutes: {}, act: {}, pflicht: {} });
      a[k][d] = v;
      removeKeys[k].push(d);
      bytesMoved += jsonBytes({ [d]: v });
    }
  }
  const years = Object.values(archives)
    .map((a) => a.year)
    .sort((a, b) => a - b);
  return { years, archives, removeKeys, bytesMoved };
}

/** Profil ohne die ausgelagerten Schlüssel (ganzes Dokument, für `set`). */
export function profileWithout(profile: Doc, plan: CompactPlan): Doc {
  const out: Doc = { ...profile };
  for (const k of DAY_MAPS) {
    if (!plan.removeKeys[k].length) continue;
    const m = { ...obj(profile[k]) };
    for (const d of plan.removeKeys[k]) delete m[d];
    out[k] = m;
  }
  // H2: stillgelegte Folgenummern (`null`) fallen beim Verdichten weg.
  const seq = compactSeq(profile.lxSeq);
  if (seq) out.lxSeq = seq;
  return out;
}

/** Liegt jeder auszulagernde Wert inhaltsgleich im Archiv (Schritt 3 und 4 in §12.3)? */
export function archivesCover(profile: Doc, plan: CompactPlan, archives: Readonly<Record<string, Doc | null>>): boolean {
  for (const k of DAY_MAPS) {
    for (const d of plan.removeKeys[k]) {
      const a = archives[archivePath(Number(d.slice(0, 4)))];
      if (!a || !jsonEqual(obj(a[k])[d], obj(profile[k])[d])) return false;
    }
  }
  return true;
}

/** Tageskarten aus Profil und Archiven zusammengeführt (Profil gewinnt bei gleichem Tag). */
export function mergeArchives(profile: Doc | null | undefined, archives: Iterable<Doc>): Doc {
  const p = profile ?? {};
  const out: Doc = { ...p };
  let any = false;
  for (const a of archives) {
    for (const k of DAY_MAPS) {
      const src = obj(a[k]);
      if (!Object.keys(src).length) continue;
      any = true;
      out[k] = { ...src, ...obj(out[k]) };
    }
  }
  return any ? out : p;
}
