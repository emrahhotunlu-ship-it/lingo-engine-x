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

// „Claude merkt sich“ (Backlog B5): Fakten aus früheren Gesprächen und Terminen (`app/memory`,
// domain/memory). Die Vorlagen hängen sie als eine eigene Zeile an – nie in den Berufskontext
// gemischt, damit dessen Kürzung sie nicht abschneidet. Höchstens MEMORY_PROMPT_FACTS Fakten,
// zusammen ≤ MEMORY_LINE_MAX Zeichen.

export const MEMORY_PROMPT_FACTS = 12;
export const MEMORY_LINE_MAX = 1_200;

/** Zeile für die Vorlagen; '' ohne Fakten. */
export function memoryLine(facts: readonly string[] | null | undefined): string {
  const list = (facts ?? []).map((f) => clip(f, 160)).filter(Boolean).slice(0, MEMORY_PROMPT_FACTS);
  if (!list.length) return '';
  const lead = 'What you already know about the learner from earlier conversations (use it naturally when it fits; never list it back, never invent more):';
  let out = lead;
  for (const f of list) {
    const next = `${out}\n- ${f}`;
    if (next.length > MEMORY_LINE_MAX) break;
    out = next;
  }
  return out === lead ? '' : out;
}
