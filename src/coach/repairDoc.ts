import { z } from 'zod';

// Aufbau des Dokuments coach/repair und sein Einlesen. Getrennt von der Logik in repair.ts, damit der
// Datenzugang (store.ts) keine Grammatik-Inhalte laden muss.

export type RepairBox = 1 | 3 | 9;

export type RepairRec = {
  /** Schlüssel gegen Doppelte: `w-…` (Schreiben) oder `g-…` (Grammatik-Aufgabe). */
  k: string;
  orig: string;
  fix: string;
  why: string;
  /** Sprache von `why` (leer = beide, z. B. bei Aufgaben aus der Grammatik). */
  wl: 'de' | 'en' | '';
  cat: string;
  src: 'write' | 'grammar';
  /** Grammatik-Thema (nur bei `src: 'grammar'`). */
  topic: string;
  box: RepairBox;
  due: number;
  add: number;
  done: 0 | 1;
};
export type RepairDoc = Readonly<Record<string, RepairRec>>;

const num = z.number().finite();
export const repairSchema = z.looseObject({
  k: z.string(),
  orig: z.string(),
  fix: z.string(),
  why: z.string().default(''),
  wl: z.enum(['de', 'en', '']).default(''),
  cat: z.string().default('other'),
  src: z.enum(['write', 'grammar']),
  topic: z.string().default(''),
  box: z.union([z.literal(1), z.literal(3), z.literal(9)]),
  due: num,
  add: num,
  done: z.union([z.literal(0), z.literal(1)]).default(0),
});

export function parseRepairDoc(data: Record<string, unknown>): { slots: Record<string, RepairRec>; invalid: string[] } {
  const slots: Record<string, RepairRec> = {};
  const invalid: string[] = [];
  const raw = data.e;
  if (raw && typeof raw === 'object') {
    for (const [slot, value] of Object.entries(raw as Record<string, unknown>)) {
      const r = repairSchema.safeParse(value);
      if (r.success) slots[slot] = r.data;
      else invalid.push(slot);
    }
  }
  return { slots, invalid };
}

