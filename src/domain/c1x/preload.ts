import { logWarn } from '../../platform/diagnostics';
import { loadPacked, packedSupported } from '../../content/store';
import { legacyV2Items } from './legacyV2';
import { C1_KINDS, type C1Item, type C1Kind } from './types';

// Der Speicher der geladenen c1x-Aufgaben (Lernplattform 3.0 P13). Der Rundenbau ist synchron; deshalb lädt `preloadC1x(kinds)` die
// gepackten Bündel (`loadPacked('c1x-<art>')`) vorher in den Speicher. Dazu kommen immer die LP2-Aufgaben aus dem Nur-Lese-Adapter (kwt, err).
// Ohne `DecompressionStream` (Safari < 16.4) bleiben die gepackten Bündel leer (Meldung im Protokoll); Pflichtrunde und `slotPlan` laufen trotzdem.

const byKind = new Map<C1Kind, C1Item[]>();
const byId = new Map<string, C1Item>();
const loaded = new Set<C1Kind>();

function add(item: C1Item): void {
  if (byId.has(item.id)) return;
  byId.set(item.id, item);
  const list = byKind.get(item.kind) ?? [];
  list.push(item);
  byKind.set(item.kind, list);
}

/** Meldet weitere Aufgaben an (z. B. beantwortete Claude-Aufgaben aus `c1gen/<Monat>`). Schon bekannte IDs bleiben. */
export function registerC1Items(items: readonly C1Item[]): void {
  for (const it of items) add(it);
}

/** Lädt die Bündel der genannten Arten (je Art einmal). Löst immer auf; Fehler stehen im Protokoll. */
export async function preloadC1x(kinds: readonly C1Kind[]): Promise<void> {
  for (const it of legacyV2Items()) if (kinds.includes(it.kind)) add(it);
  if (!packedSupported()) {
    if (kinds.some((k) => !loaded.has(k))) logWarn('c1x:preload', { message: 'DecompressionStream fehlt: nur die LP2-Aufgaben stehen zur Verfügung.' });
    for (const k of kinds) loaded.add(k);
    return;
  }
  await Promise.all(
    kinds
      .filter((k) => !loaded.has(k))
      .map(async (k) => {
        loaded.add(k);
        const doc = await loadPacked<C1Item>(`c1x-${k}`);
        if (doc) registerC1Items(doc.items);
        else loaded.delete(k);
      }),
  );
}

/** Alle bisher geladenen Aufgaben einer Art (sofort, ohne Laden). */
export const c1Items = (kind: C1Kind): readonly C1Item[] => byKind.get(kind) ?? [];
/** Eine Aufgabe nach ihrer ID, sonst `null` (noch nicht geladen, verdichtet oder entfernt). */
export const c1ItemById = (id: string): C1Item | null => byId.get(id) ?? null;
/** Alle geladenen Aufgaben. */
export const allC1Items = (): readonly C1Item[] => C1_KINDS.flatMap((k) => c1Items(k));

/** Nur für Tests. */
export function resetC1Store(): void {
  byKind.clear();
  byId.clear();
  loaded.clear();
}
