import { kindEnabled } from '../../app/flags';
import type { C1Kind } from '../../domain/c1x/types';
import { useErrUi } from './kinds/Err';
import { useKwtUi } from './kinds/Kwt';
import { useStubUi } from './kinds/Stub';
import type { C1KindEntry } from './types';

// Welche Aufgabenarten der Rahmen kennt (Lernplattform 3.0 P14). Jede Art ist ein Hook (`kinds/<Art>.tsx`); im Build bietet die Registry keine Art an,
// deren Funktionsschalter (`app/flags.ts`) aus ist. Ein Rumpf ohne eigene Oberfläche zeigt nur im Entwicklungsmodus „noch nicht verfügbar“.

const stub: C1KindEntry = { useUi: useStubUi };
const ENTRIES: Record<C1Kind, C1KindEntry> = {
  mcc: stub,
  ocl: stub,
  wf: stub,
  kwt: { useUi: useKwtUi },
  err: { useUi: useErrUi },
  pair: stub,
  cnet: stub,
  reg: stub,
  para: stub,
};

/** Der Hook der Art, wenn sie angeboten wird (eingeschaltet; im Entwicklungsmodus auch die Rümpfe), sonst `null`. */
export function kindEntry(kind: C1Kind): C1KindEntry | null {
  if (kindEnabled(kind)) return ENTRIES[kind];
  return import.meta.env.DEV ? ENTRIES[kind] : null;
}

/** Die angebotenen Arten (eingeschaltet). */
export const availableKinds = (): C1Kind[] => (Object.keys(ENTRIES) as C1Kind[]).filter((k) => kindEnabled(k));
