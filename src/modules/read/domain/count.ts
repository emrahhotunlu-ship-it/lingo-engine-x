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

/**
 * Anzahl der Dokumente der Sammlung `read`: `p` selbst + ein Tagesdokument je Lerntag + ein Monatsindex je Monat.
 * Ohne `read/p` gibt es (noch) nichts zu zählen.
 */
export function readDocCountOf(prefs: Doc | undefined | null): number {
  if (!prefs) return 0;
  const days = readDaysOf(prefs);
  const months = new Set(days.map(monthOfDay));
  return 1 + days.length + months.size;
}
