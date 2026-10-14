import { askJson, isAiFailure } from './shared';
import type { AiMessageKey, AiPhase } from './shared';
import { readApply } from './prompt';
import type { ReadApplyOut, ReadApplyVars } from './prompt';

// „Claude prüfen“ im Schritt Anwenden (Paket L8): ein kleiner `quick`-Aufruf, nur auf Tipp, nie automatisch wiederholt (A6 Nr. 3:
// nur ein Schemaverstoß löst im KI-Tor den einen zweiten Versuch aus). Die Musterlösung und die lokale Prüfung stehen schon vorher da;
// fällt Claude aus, bleibt die Lektion bedienbar.

export type ApplyCheckResult = { ok: true; data: ReadApplyOut } | { ok: false; cancelled: boolean; key: AiMessageKey | null };

export async function checkApplyWithClaude(vars: ReadApplyVars, signal: AbortSignal, onPhase?: (p: AiPhase) => void, refresh = false): Promise<ApplyCheckResult> {
  try {
    const res = await askJson({ template: readApply, vars, signal, priority: 'user', ...(onPhase ? { onPhase } : {}), refresh });
    return { ok: true, data: res.data };
  } catch (err) {
    if (isAiFailure(err)) return { ok: false, cancelled: err.kind === 'cancelled', key: err.messageKey };
    return { ok: false, cancelled: false, key: 'aiFailed' };
  }
}
