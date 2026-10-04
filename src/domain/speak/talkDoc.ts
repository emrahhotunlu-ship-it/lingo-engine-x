import { compactList, jsonBytes, monthOf, obj, upsertById } from '../monthDoc';
import type { TalkRun } from './types';

// Gesprächsläufe als Monatsdokument `talk/<JJJJ-MM>` (Plan §3.4, A6.6: wachsende Ströme
// zusammenfassen). Ein Lauf wird über `id` eingefügt oder ersetzt (idempotent). Solange das
// Dokument größer als 200 KiB wäre, wird verdichtet: zuerst die Zeilen des ältesten Laufs mit
// Zeilen, danach Stärken und Fokus des ältesten Berichts. Die Kennzahlen bleiben immer.

type Doc = Record<string, unknown>;

export const TALK_DOC_MAX_BYTES = 200 * 1024;
export const LINE_MAX = 200;
export const LINES_MAX = 16;

// Wiederausfuhr, damit bestehende Importe gültig bleiben (neuer Ort: domain/monthDoc.ts).
export { compactList, jsonBytes, monthOf, upsertById };

const TALK_STEPS: ReadonlyArray<(r: Doc) => Doc | null> = [
  (r) => (Array.isArray(r.lines) && r.lines.length ? { ...r, lines: [] } : null),
  (r) => {
    const rep = obj(r.report);
    if (!r.report || (!Array.isArray(rep.focus) && !Array.isArray(rep.strengths))) return null;
    const next: Doc = { ...rep };
    delete next.focus;
    delete next.strengths;
    return { ...r, report: next };
  },
];

export function compactRuns(runs: readonly unknown[], month = '0000-00'): unknown[] {
  return compactList(runs, TALK_STEPS, TALK_DOC_MAX_BYTES, (items) => ({ v: 1, month, runs: items }));
}

/** Schreibvorgang für `talk/<Monat>` aus dem frischen Stand (writer.transform). */
export function upsertRun(cur: Doc | undefined, run: TalkRun): { set: Doc } | { update: Doc } | null {
  const month = monthOf(run.day);
  if (!cur) return { set: { v: 1, month, runs: compactRuns([run], month) } };
  if (cur.runs != null && !Array.isArray(cur.runs)) return null;
  const list = Array.isArray(cur.runs) ? cur.runs : [];
  return { update: { runs: compactRuns(upsertById(list, run), month) } };
}

/** Text auf höchstens `max` Zeichen kürzen (mit …). */
export function cut(s: string, max: number): string {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}
