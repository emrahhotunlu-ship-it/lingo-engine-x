import { dayKey } from '../date';
import { whyOfError } from '../grammar/errorWhy';
import type { Lang } from '../srs/types';
import { dueErrors, errorSentences } from '../grammar/errors';
import { dueRepairs, readRepairs, repairNorm, type RepairSrc } from './repair';

// Fehlersätze (Schritt „Fehler korrigieren“): EINE Liste aus beiden Speichern, `app/repair` (eigene Sätze, Boxen 1/3/9) und
// `grammar/<thema>.errors` (falsche Grammatik-Antworten, gleiche Boxen). Rein, schreibt nichts. Sätze vom Anlegetag (Lerntag) kommen
// nie (verteilt statt massiert), nichts doppelt, älteste Fälligkeit zuerst. Jeder Satz weiß, in welchen Speicher seine Antwort gehört.

type Doc = Readonly<Record<string, unknown>>;

export type Fehlersatz = {
  /** Eindeutig über beide Speicher: `app/repair`-Kennung bzw. `g:<thema>:<t>`. */
  id: string;
  wrong: string;
  right: string;
  why?: string;
  due: number;
  store: 'repair' | 'grammar';
  /** Herkunft für die Anzeige: bei Grammatik-Fehlern `lesson`. */
  src: RepairSrc;
  fix?: string[];
  /** Nur Grammatik: Thema und Zeitstempel des Fehlereintrags (Schlüssel für `reviewError`). */
  topic?: string;
  errorT?: number;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');


export function dueFehlersaetze(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; nowMs: number; today: string; limit?: number; lang?: Lang }): Fehlersatz[] {
  const out: Fehlersatz[] = [];
  for (const r of dueRepairs(readRepairs(i.repairDoc ?? undefined), i.nowMs)) {
    if (dayKey(r.t) === i.today) continue;
    out.push({ id: r.id, wrong: r.wrong, right: r.right, ...(r.why ? { why: r.why } : {}), due: r.due, store: 'repair', src: r.src, ...(r.fix ? { fix: r.fix } : {}) });
  }
  for (const d of dueErrors(i.grammarDocs, i.nowMs)) {
    const t = typeof d.e.t === 'number' ? d.e.t : null;
    if (t === null || dayKey(t) === i.today) continue;
    const q = str(d.e.q).trim();
    const { wrong, right } = errorSentences(q, str(d.e.given), d.task.answer);
    if (!wrong || !right || repairNorm(wrong) === repairNorm(right)) continue;
    const why = whyOfError(d.topic, d.e, i.lang ?? 'de');
    out.push({ id: `g:${d.topic}:${t}`, wrong, right, ...(why ? { why } : {}), due: d.due, store: 'grammar', src: 'lesson', topic: d.topic, errorT: t });
  }
  const seen = new Set<string>();
  const list = out
    .sort((a, b) => a.due - b.due)
    .filter((f) => {
      const k = repairNorm(f.wrong);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  return i.limit === undefined ? list : list.slice(0, i.limit);
}

/**
 * Fällige Grammatik-Fehlersätze: derselbe Filter wie `dueFehlersaetze` (Sätze vom Anlegetag nie, gültige Sätze, nichts doppelt), nur ohne
 * Reparatur-Sätze. Grundlage der Einführungsbremse „ab 10 fälligen Grammatikfehlern kein neues Thema“ (`grammar/path`).
 */
export function grammarFehlersaetzeDue(i: { grammarDocs: ReadonlyMap<string, Doc>; nowMs: number; today: string }): number {
  return dueFehlersaetze({ grammarDocs: i.grammarDocs, repairDoc: null, nowMs: i.nowMs, today: i.today }).length;
}
