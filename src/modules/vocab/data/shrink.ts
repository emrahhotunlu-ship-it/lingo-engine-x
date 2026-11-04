import { dayKey, logError, type Writer } from '../shared';
import { shrinkDayPlan, SHORT_DAY_MIN, type DayPlan } from '../domain/day';
import { VMOD_DAY_PATH } from '../registry';
import { vmodDayWriteSchema } from './schemas';

// Kurzer Tag (2A): den heutigen Wörter-Plan in `vmod/day` einmal verkleinern. Nur ein heutiger Plan wird ersetzt; ein Plan eines anderen Tages
// oder ohne Liste bleibt unberührt (dann friert die Runde wie immer ein).

/** Liefert die neuen Wörter-Minuten oder `null` (kein heutiger Plan, schon klein genug, nicht speicherbar). */
export async function shrinkToday(writer: Writer, nowMs: number, targetMin: number = SHORT_DAY_MIN): Promise<number | null> {
  const day = dayKey(nowMs);
  let out: number | null = null;
  await writer.transform(VMOD_DAY_PATH, (cur) => {
    if (!cur || cur.d !== day || !Array.isArray(cur.plan)) return null;
    const next = shrinkDayPlan(cur as unknown as DayPlan, targetMin);
    if (!next) {
      out = typeof cur.min === 'number' ? cur.min : null;
      return null;
    }
    const ok = vmodDayWriteSchema.safeParse({ ...next, v: 1 });
    if (!ok.success) {
      logError('vocab:shrink-day', ok.error, VMOD_DAY_PATH);
      return null;
    }
    out = ok.data.min;
    return { replace: ok.data };
  });
  return out;
}
