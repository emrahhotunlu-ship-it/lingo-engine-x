import { loadPacked } from '../../content/store';
import type { C1Item } from '../../domain/c1x/types';
import type { Fehlersatz } from '../../domain/repair/fehlersaetze';
import { kwtForRepair, type RepairKwt } from '../../domain/c1/check/repairKwt';
import { logWarn } from '../../platform/diagnostics';

// Emrah 12.11.2026: Fehler aus Umformungen des Einstufungstests kommen mit Ausgangssatz und Schlüsselwort zurück. Dafür wird der Check-Vorrat
// (`c1x-check`) einmal nachgeladen und nur hier gehalten – er kommt nie in den Aufgaben-Speicher des Trainings (CheckScreen.tsx).

let items: readonly C1Item[] | null = null;
let loading: Promise<void> | null = null;

/** Lädt den Check-Vorrat einmal (nur wenn es Fehlersätze aus dem Einstufungstest gibt). Löst immer auf; Fehler stehen im Protokoll. */
export function preloadCheckRepairs(): Promise<void> {
  if (items || loading) return loading ?? Promise.resolve();
  loading = loadPacked<C1Item>('c1x-check')
    .then((doc) => {
      items = doc?.items ?? [];
    })
    .catch((err: unknown) => {
      logWarn('grammar:check-repairs', err);
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Original-Umformung zu einem Fehlersatz aus dem Einstufungstest (sofort; `null`, solange der Vorrat nicht geladen ist). */
export const checkKwtOf = (f: Fehlersatz): RepairKwt | null => (items ? kwtForRepair(items, f) : null);
