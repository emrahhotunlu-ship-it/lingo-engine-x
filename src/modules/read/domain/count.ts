import { isDayKey } from '../shared';
import { monthOfDay, READ_COLLECTION } from './paths';

// Zählung und Lade-Art der Sammlung `read` (Plan §11 Nachtrag L3).
//
// Problem: `read` steht in COLLECTIONS (Schema-Zuordnung). Alles, was „alle Sammlungen“ liest (Sicherung, Umstellung, Diagnose-Zählung),
// würde sonst bei jedem Start auch die Artikeltexte laden (≈ 10 KB je Artikel, ≈ 1 MB je 33 Tage). Deshalb gilt `read` als „träge“
// Sammlung: sie wird nur vom Modul gelesen (je Dokument, bei Bedarf). Die Datenbank kennt keine reine Zählabfrage (contract/db.d.ts:
// `QuerySnapshot` liefert immer die Dokumente), also führt `read/p` die Liste der Lerntage (`days`), aus der sich die Dokumentzahl ergibt.

export { READ_COLLECTION as READ_LAZY_COLLECTION };

type Doc = Record<string, unknown>;

/** Lerntage mit Tagesdokument aus `read/p` (gültige Schlüssel, aufsteigend, eindeutig). */
export function readDaysOf(prefs: Doc | undefined | null): string[] {
  const raw = prefs && Array.isArray(prefs.days) ? (prefs.days as unknown[]) : [];
  return [...new Set(raw.filter((d): d is string => typeof d === 'string' && isDayKey(d)))].sort();
}

/** Zahl der Lektionen im Kursfortschritt `read/cp` (je angefangener Lektion gibt es ein Lektionsdokument `read/c-…`). */
export function progressLessonCount(progress: Doc | undefined | null): number {
  if (!progress) return 0;
  const ids = new Set<string>();
  for (const it of Array.isArray(progress.items) ? (progress.items as unknown[]) : []) {
    const id = it && typeof it === 'object' ? (it as Doc).id : null;
    if (typeof id === 'string' && id) ids.add(id);
  }
  return ids.size;
}

/**
 * Anzahl der Dokumente der Sammlung `read`: `p` selbst + ein Tagesdokument je Lerntag + ein Monatsindex je Monat; dazu, wenn `read/cp` vorhanden ist,
 * `cp` selbst und ein Lektionsdokument je Lektion im Fortschritt. Nicht ableitbar sind die Routine-Dokumente `read/r-…` (höchstens etwa 45, die Routine räumt
 * selbst auf) und noch nicht begonnene Lektionen; die Grenzen des Wächters (3.500/4.300 von 5.000) lassen dafür Platz.
 * Ohne `read/p` gibt es (noch) nichts zu zählen – ausgenommen der Kursfortschritt allein.
 */
export function readDocCountOf(prefs: Doc | undefined | null, progress?: Doc | null): number {
  const course = progress ? 1 + progressLessonCount(progress) : 0;
  if (!prefs) return course;
  const days = readDaysOf(prefs);
  const months = new Set(days.map(monthOfDay));
  return 1 + days.length + months.size + course;
}
