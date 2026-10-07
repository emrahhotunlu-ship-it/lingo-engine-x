import type { C1Item, C1Kind } from '../../c1x/types';
import { chapterIndexOf } from '../chapters';
import { FORMAT_B, STAGE_B, type PlaceFmt, type PlaceItem } from './model';

// Einstufung, Aufgaben (Lernplattform 3.0 §4.2, P34/P35): die c1x-Aufgaben mit `pool: 'place'` als `PlaceItem` für das Verfahren (P33).
// Vier Arten gehören zum Vorrat: Auswahl (`mcc` → mc), offene Lücke (`ocl` → gap), Fehler finden (`err` → find) und Umformen (`kwt` → kwt).
// `b` im Inhalt ist die Schwierigkeit als Ganzes (Stufe + Formatwert + Lehrerkorrektur); daraus folgt die Lehrerkorrektur `adj` (−0,3 bis +0,3).

export const PLACE_KINDS = ['mcc', 'ocl', 'err', 'kwt'] as const satisfies readonly C1Kind[];
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const FMT_OF_KIND: Readonly<Record<PlaceKind, PlaceFmt>> = { mcc: 'mc', ocl: 'gap', err: 'find', kwt: 'kwt' };

export const isPlaceKind = (k: C1Kind): k is PlaceKind => (PLACE_KINDS as readonly C1Kind[]).includes(k);

/** Gehört die Aufgabe zum Einstufungsvorrat? */
export const isPlaceItem = (it: C1Item): boolean => it.pool === 'place' && isPlaceKind(it.kind) && it.area === 'gram' && !!it.topic;

/** Das Verfahrens-Gegenstück einer Inhaltsaufgabe; `null`, wenn sie nicht zum Vorrat gehört. */
export function toPlaceItem(it: C1Item): PlaceItem | null {
  if (!isPlaceItem(it) || !isPlaceKind(it.kind) || !it.topic) return null;
  const fmt = FMT_OF_KIND[it.kind];
  const base = STAGE_B[it.level] + FORMAT_B[fmt];
  const adj = it.b === undefined ? 0 : Math.round((it.b - base) * 100) / 100;
  return { id: it.id, topic: it.topic, chapter: Math.max(1, chapterIndexOf(it.topic) + 1), level: it.level, fmt, adj: Math.min(0.3, Math.max(-0.3, adj)), pool: 'place' };
}

/** Der Vorrat aus beliebigen Aufgaben (Reihenfolge nach Kennung, damit Wahl und Tests wiederholbar sind). */
export function placeItems(items: readonly C1Item[]): { items: PlaceItem[]; byId: Map<string, C1Item> } {
  const byId = new Map<string, C1Item>();
  const out: PlaceItem[] = [];
  for (const it of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    const p = toPlaceItem(it);
    if (!p || byId.has(it.id)) continue;
    byId.set(it.id, it);
    out.push(p);
  }
  return { items: out, byId };
}
