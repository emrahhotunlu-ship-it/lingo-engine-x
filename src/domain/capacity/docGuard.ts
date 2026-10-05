import { logWarn } from '../../platform/diagnostics';

// Wächter auf die GESAMT-Dokumentenzahl (Prüfbefund S8, A6.6: höchstens 5.000 Dokumente je Artefakt). Vorher zählte nur die
// Kartenzahl; Protokolle, Sätze, Aufträge usw. fehlten. Ab 3.500 Dokumenten gibt es eine Warnung, ab 4.300 werden keine neuen
// Karten mehr angelegt – nie still: jeder abgewiesene Versuch wird protokolliert und ruhig gemeldet (`onDocBlocked`).
// Der Zählerstand wird von `features/capacity/docTotal.ts` gepflegt; hier steht nur die Regel und der Zustand.

export const DOC_WARN_TOTAL = 3500;
export const DOC_BLOCK_TOTAL = 4300;

export type DocGate = 'ok' | 'warn' | 'full';

export const docGateOf = (total: number): DocGate => (total >= DOC_BLOCK_TOTAL ? 'full' : total >= DOC_WARN_TOTAL ? 'warn' : 'ok');

let known = 0;
let listener: ((total: number) => void) | null = null;

/** Aktuell bekannte Gesamtzahl (0 = noch unbekannt, dann gilt nichts als voll). */
export function setDocTotal(total: number): void {
  known = Number.isFinite(total) && total > 0 ? Math.round(total) : 0;
}
export const docTotal = (): number => known;
export const docGate = (): DocGate => docGateOf(known);

/** Der Aufrufer meldet den Hinweis an die Oberfläche (Toast). */
export function onDocBlocked(fn: ((total: number) => void) | null): void {
  listener = fn;
}

/** Eine neue Karte wurde wegen der Grenze nicht angelegt: protokollieren und ruhig melden. */
export function reportDocBlocked(what: string): void {
  logWarn('capacity:docs', { code: 'docs_full', message: `${known} Dokumente (Sperre ab ${DOC_BLOCK_TOTAL}) – ${what} nicht angelegt` }, what);
  listener?.(known);
}

/** Darf eine neue Karte angelegt werden? Sonst ist schon gemeldet und protokolliert. */
export function mayCreateDoc(what: string): boolean {
  if (docGate() !== 'full') return true;
  reportDocBlocked(what);
  return false;
}
