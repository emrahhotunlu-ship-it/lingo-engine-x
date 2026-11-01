// Verzeichnis der Verlaufsdokumente (V3 Schritt 1, data-guard V1 B2): `vlog` ist eine TRÄGE Sammlung (src/data/paths.ts LAZY_COLLECTIONS).
// Start, Zählung und Umstellung lesen sie nie als Ganzes (≈ 1,8 MB je Jahr). Stattdessen steht jedes Dokument in `vmod/ix`
// (`{v: 1, docs: {"2026-11-a": 1, "2026-11-a2": 1, …}}`, Map: zwei Geräte verschmelzen beim `update`). Gezählt wird aus dem Verzeichnis,
// gesichert wird Dokument für Dokument (Verzeichnis + Suche in den letzten Halbmonaten, damit nie still etwas fehlt).
// Bewusst ohne Abhängigkeiten: die Datenschicht lädt diese Datei über `registry.ts`.

export const VLOG_INDEX_PATH = 'vmod/ix';
/** Dokumentkennung ohne `vlog/`: Monat, Hälfte, optional Fortsetzung 2–9. */
export const VLOG_ID_RE = /^\d{4}-(?:0[1-9]|1[0-2])-[ab][2-9]?$/;
/** Fehlt das Verzeichnis, sucht die Sicherung so viele Monate zurück. */
export const VLOG_PROBE_MONTHS = 24;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Gültige Kennungen aus dem Verzeichnis, sortiert. */
export function vlogIdsOf(ix: unknown): string[] {
  if (!isObj(ix) || !isObj(ix.docs)) return [];
  return Object.keys(ix.docs)
    .filter((k) => VLOG_ID_RE.test(k) && ix.docs && (ix.docs as Record<string, unknown>)[k] !== null)
    .sort();
}

export const vlogDocCountOf = (ix: unknown): number => vlogIdsOf(ix).length;

/** Kennung → Basis (ohne Fortsetzung) und Teil. */
export function splitVlogId(id: string): { base: string; part: number } {
  const last = id.slice(-1);
  return /[2-9]/.test(last) ? { base: id.slice(0, -1), part: Number(last) } : { base: id, part: 1 };
}

/** Die Monate `JJJJ-MM` von `month` rückwärts, `n` Stück. */
export function monthsBack(month: string, n: number): string[] {
  let y = Number(month.slice(0, 4));
  let m = Number(month.slice(5, 7));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

/**
 * Erste Suchrunde der Sicherung: alles aus dem Verzeichnis samt Teil 1 jeder eingetragenen Fortsetzung (`-a2` ohne `-a` verliert so nichts),
 * dazu IMMER die Halbmonate (Teil 1) der letzten 24 Monate (ein verlorener Verzeichnis-Eintrag, etwa beim gleichzeitigen ersten Anlegen auf
 * zwei Geräten, fehlt so nicht in der Sicherung; das kostet nur beim Export 48 Lesezugriffe).
 */
export function vlogProbeIds(listed: readonly string[], today: string): string[] {
  const months = monthsBack(today.slice(0, 7), VLOG_PROBE_MONTHS);
  const set = new Set(listed);
  for (const id of listed) set.add(splitVlogId(id).base);
  for (const mo of months) for (const h of ['a', 'b']) set.add(`${mo}-${h}`);
  return [...set].sort();
}

/** Nächste Fortsetzung, die gesucht werden muss, wenn `id` existiert (oder `null` nach Teil 9). */
export function nextVlogPart(id: string): string | null {
  const { base, part } = splitVlogId(id);
  return part < 9 ? `${base}${part + 1}` : null;
}

/** Pfad eines Verlaufsdokuments aus der Kennung (und zurück): die Datenschicht schreibt den Pfad nicht selbst (Isolation). */
export const vlogPath = (id: string): string => `vlog/${id}`;
export const vlogIdOfPath = (path: string): string => path.slice('vlog/'.length);
