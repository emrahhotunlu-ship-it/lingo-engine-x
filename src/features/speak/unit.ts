import { unitDone } from '../../app/unit/done';
import type { UnitBlockKind, UnitBlockNo, UnitCtx, UnitTaskResult } from '../../app/unit/types';
import { logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';

// Block 3 der Tageseinheit aus Paket P5 (Neubau N75, plan.md §1.5, §4.10): Sag es, 90/60/45,
// Drei Tonlagen, Generalprobe (Termin) und Rollenspiel. Jeder Anbieter baut SYNCHRON im Klick
// (iPhone-Tastatur) und liefert die Route mit `unit: <Block>`; die Übung meldet am Ende
// `unitDone(block, UnitTaskResult)` über den festen Meldepunkt `app/unit/done.ts`.
//
// Den Zusammenhang (`UnitCtx`: Thema, Ziele, Wendungen aus Block 2) merkt sich das Modul im
// Speicher und – nur als Bequemlichkeit fürs Neuladen – in `lx:p5unit`. Fehlt er (anderes Gerät,
// gelöschter Speicher), baut die Übung ihn aus den Daten des Tages neu (Wochenthema, 5 Wendungen, M8).
//
// Rückfälle ohne KI (M4a) entscheidet P1 mit `resolveBlock`: Rollenspiel/Generalprobe → Einwand-
// Training, Tonlagen → Posteingang. Deshalb melden diese drei ohne KI `feasible = false`.

export type P5UnitKind = Extract<UnitBlockKind, 'task.say' | 'task.fluency' | 'task.tones' | 'task.meeting' | 'task.roleplay'>;

type Active = { kind: P5UnitKind; ctx: UnitCtx; t: number };

const KEY = `${KEY_PREFIX}p5unit`;
let active: Active | null = null;

function isActive(x: unknown): x is Active {
  if (!x || typeof x !== 'object') return false;
  const a = x as Record<string, unknown>;
  const c = a.ctx as Record<string, unknown> | undefined;
  return typeof a.kind === 'string' && typeof a.t === 'number' && !!c && typeof c.day === 'string' && typeof c.block === 'number';
}

/** Zusammenhang eines gestarteten Blocks merken (im Klick, vor `go`). */
export function beginUnit(kind: P5UnitKind, ctx: UnitCtx): void {
  active = { kind, ctx, t: Date.now() };
  try {
    local.set(KEY, JSON.stringify(active));
  } catch (err) {
    logWarn('unit:p5:begin', err, kind);
  }
}

/** Gemerkter Zusammenhang für diese Übung und diesen Lerntag (sonst `null`). */
export function unitCtxOf(kind: P5UnitKind, day: string): UnitCtx | null {
  const a = active ?? (() => {
    const raw = local.getJson<unknown>(KEY);
    return isActive(raw) ? raw : null;
  })();
  if (!a || a.kind !== kind || a.ctx.day !== day) return null;
  active = a;
  return a.ctx;
}

/** Block abschließen: Ergebnis an P1 melden (zählt `act['u-task']`, Zwischenkarte). */
export function finishUnit(kind: P5UnitKind, block: UnitBlockNo, result: UnitTaskResult): void {
  if (active?.kind === kind) active = null;
  local.remove(KEY);
  unitDone(block, result);
}

/** Blocknummer aus einem Routen-Parameter (nur 1–5, sonst `null` = freies Üben). */
export function unitBlockOf(v: unknown): UnitBlockNo | null {
  return v === 1 || v === 2 || v === 3 || v === 4 || v === 5 ? v : null;
}

/** Welcher Block läuft im Rollenspiel: Generalprobe oder Rollenspiel (für `UnitTaskResult.kind`). */
export function roleplayUnitKind(day: string): 'task.meeting' | 'task.roleplay' {
  return unitCtxOf('task.meeting', day) ? 'task.meeting' : 'task.roleplay';
}
