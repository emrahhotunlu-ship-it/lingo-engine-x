import contextJson from '../content/legacy/context.json';
import { clip } from './common';

// Beruflicher Kontext für Vorlagen, die Beispiele aus dem Arbeitsalltag brauchen (Phase 5 §6,
// Funktionsabgleich M22). Quelle ist `app/profile.ctx` (Freitext ≤ 400, von der alten App
// übernommen und später in den Einstellungen änderbar); fehlt er, gilt der Standardtext der
// alten App aus content/legacy/context.json.

export const WORK_MAX = 400;
export const DEFAULT_WORK: string = typeof contextJson.defaultCtx === 'string' && contextJson.defaultCtx.trim() ? contextJson.defaultCtx.trim() : 'professional in an international company';

export function workContext(profileCtx: unknown): string {
  const s = typeof profileCtx === 'string' ? clip(profileCtx, WORK_MAX) : '';
  return s || clip(DEFAULT_WORK, WORK_MAX);
}
