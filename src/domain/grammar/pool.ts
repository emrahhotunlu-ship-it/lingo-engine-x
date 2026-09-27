import { validateDoc } from '../../data/validate';
import type { GrammarTask, TaskSrc } from '../learn/types';
import { asText } from '../text/str';
import { legacyTaskKey } from './key';
import { normalizeTask, toPoolItem } from './tasks';

// Aufgaben-Pool `app/pool` (phase2-plan §4.10): Aufgaben aus dem Tagesauftrag (`daily/*`) und
// aus „Neue Aufgaben" (KI). Rein; ausgeführt unter `acquire` in EINEM `transform`.
// - verdichten: nur Aufgaben entfernen, deren Schlüssel im `seen` ihres Themas steht,
// - ergänzen: gültige Aufgaben, die weder im Pool noch in `seen` stehen,
// - Obergrenze 90; Unverbrauchtes wird nie verworfen: Was nicht passt, bleibt im Tagesauftrag
//   liegen (`open`) und wird von der Runde direkt von dort genommen.

type Doc = Record<string, unknown>;

export const POOL_MAX = 90;

export type IntakeBatch = {
  /** Lerntag des Tagesauftrags (`daily/<day>`), `null` für KI-Aufgaben. */
  day: string | null;
  src: Extract<TaskSrc, 'daily' | 'ai'>;
  items: readonly unknown[];
  /** Fingerabdruck des Tagesauftrags (FNV über den Inhalt). */
  hash?: number;
  /** Anzahl neuer Wörter im Tagesauftrag (nur Bericht). */
  words?: number;
};

export type DailyMark = { h: number; t: number; w: number; g: number; open: number; bad: number };

export type PoolIntake = {
  op: { set: Doc } | { update: Doc } | null;
  /** Vorhandenes Dokument mit unerwartetem Aufbau – nie angefasst. */
  invalid: boolean;
  added: number;
  removed: number;
  /** Gültig und neu, aber kein Platz mehr (bleibt im Tagesauftrag). */
  open: number;
  bad: number;
  marks: Record<string, DailyMark>;
};

const topicOf = (it: unknown): string => (it && typeof it === 'object' ? asText((it as Doc).topic) : '');
const promptOf = (it: unknown): string => (it && typeof it === 'object' ? asText((it as Doc).prompt) : '');

/** Pool ohne Aufgaben, die im `seen` ihres Themas stehen (nur diese werden entfernt). */
export function compactPool(items: readonly unknown[], seen: ReadonlyMap<string, ReadonlySet<string>>): unknown[] {
  return items.filter((it) => !seen.get(topicOf(it))?.has(legacyTaskKey(promptOf(it))));
}

/** Pool-Aufgaben als Aufgaben der Runde (ungültige ausgelassen). */
export function poolTasks(doc: Readonly<Doc> | undefined): GrammarTask[] {
  const items = Array.isArray(doc?.items) ? (doc.items as unknown[]) : [];
  const out: GrammarTask[] = [];
  for (const it of items) {
    const t = normalizeTask(it, 'pool');
    if (t) out.push(t);
  }
  return out;
}

export function poolIntake(
  cur: Readonly<Doc> | undefined,
  batches: readonly IntakeBatch[],
  seen: ReadonlyMap<string, ReadonlySet<string>>,
  nowMs: number,
): PoolIntake {
  const res: PoolIntake = { op: null, invalid: false, added: 0, removed: 0, open: 0, bad: 0, marks: {} };
  if (cur && !validateDoc('app/pool', cur).ok) return { ...res, invalid: true };
  const before = Array.isArray(cur?.items) ? (cur.items as unknown[]) : [];
  const items = compactPool(before, seen);
  res.removed = before.length - items.length;
  const keys = new Set(items.map((it) => legacyTaskKey(promptOf(it))));

  for (const b of batches) {
    let g = 0;
    let open = 0;
    let bad = 0;
    const ref = b.day ? `daily/${b.day}` : null;
    for (const raw of b.items) {
      const t = normalizeTask(raw, b.src, ref);
      if (!t) {
        bad++;
        continue;
      }
      g++;
      if (keys.has(t.key) || seen.get(t.topic)?.has(t.key)) continue;
      if (items.length >= POOL_MAX) {
        open++;
        continue;
      }
      keys.add(t.key);
      items.push(toPoolItem({ ...t, src: b.src, ref }));
      res.added++;
    }
    res.open += open;
    res.bad += bad;
    if (b.day) res.marks[b.day] = { h: b.hash ?? 0, t: nowMs, w: b.words ?? 0, g, open, bad };
  }

  const hasMarks = Object.keys(res.marks).length > 0;
  if (!cur) {
    if (!items.length && !hasMarks) return res;
    res.op = { set: { items, t: nowMs, ...(hasMarks ? { lxDaily: res.marks } : {}) } };
    return res;
  }
  if (!res.added && !res.removed && !hasMarks) return res;
  const update: Doc = {};
  if (res.added || res.removed) {
    update.items = items;
    update.t = nowMs;
  }
  if (hasMarks) update.lxDaily = res.marks;
  res.op = { update };
  return res;
}
