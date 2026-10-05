import { dayKey } from '../date';
import { dueErrors, type ErrorEntry } from '../grammar/errors';
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
const GAP = '___';

/** Aus einem Grammatik-Fehler (Lücke oder Satzkorrektur) die beiden Sätze „falsch → richtig“ bilden. */
function sentences(e: ErrorEntry, q: string, fill: string): { wrong: string; right: string } {
  if (!q.includes(GAP)) return { wrong: q, right: fill };
  const given = str(e.given).trim();
  return { wrong: q.replace(GAP, given || '…'), right: q.replace(GAP, fill) };
}

export function dueFehlersaetze(i: { grammarDocs: ReadonlyMap<string, Doc>; repairDoc: Doc | null | undefined; nowMs: number; today: string; limit?: number }): Fehlersatz[] {
  const out: Fehlersatz[] = [];
  for (const r of dueRepairs(readRepairs(i.repairDoc ?? undefined), i.nowMs)) {
    if (dayKey(r.t) === i.today) continue;
    out.push({ id: r.id, wrong: r.wrong, right: r.right, ...(r.why ? { why: r.why } : {}), due: r.due, store: 'repair', src: r.src, ...(r.fix ? { fix: r.fix } : {}) });
  }
  for (const d of dueErrors(i.grammarDocs, i.nowMs)) {
    const t = typeof d.e.t === 'number' ? d.e.t : null;
    if (t === null || dayKey(t) === i.today) continue;
    const q = str(d.e.q).trim();
    const { wrong, right } = sentences(d.e, q, d.task.answer);
    if (!wrong || !right || repairNorm(wrong) === repairNorm(right)) continue;
    out.push({ id: `g:${d.topic}:${t}`, wrong, right, due: d.due, store: 'grammar', src: 'lesson', topic: d.topic, errorT: t });
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
