import { validateDoc } from '../../data/validate';
import { learningDayEnd } from '../date';
import { readFsrs } from './scheduler';

// „Morgen wieder“ am Wortblatt (plan.md N25): Die Karte ist am nächsten Lerntag (04:00) fällig.
// Nur per `writer.transform` auf dem frischen Stand; `fsrs` wird ergänzt, `due` der alten App
// gespiegelt (A6.14). `last` bleibt, damit der FSRS-Stand gültig bleibt; nichts gelöscht, keine
// Bewertung erfunden (Stufe, Zähler und Verlauf bleiben unverändert).

type Doc = Record<string, unknown>;
export type CardOp = { update: Doc } | null;

export function tomorrowOp(cur: Readonly<Doc> | undefined, path: string, nowMs: number): CardOp {
  if (!cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  if (cur.state === 'new') return null;
  const due = learningDayEnd(nowMs) + 60_000;
  const f = readFsrs(cur, nowMs);
  if (f.due === due && cur.due === due) return null;
  const last = typeof cur.last === 'number' && cur.last > 0 ? cur.last : null;
  return { update: { due, fsrs: { ...f, due, last, src: 'lx' } } };
}
