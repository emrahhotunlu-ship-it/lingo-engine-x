import { addDays, dayKey, logError, type Writer } from '../shared';
import { capPlanToDone, nextPace } from '../domain/pace';
import type { Form, FormStats } from '../domain/types';
import { shrinkDayPlan, SHORT_DAY_MIN, type DayPlan } from '../domain/day';
import { VMOD_DAY_PATH, VMOD_PACE_PATH } from '../registry';
import { vmodDayWriteSchema, vmodPaceWriteSchema } from './schemas';

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

/**
 * Zeitdeckel (Emrah 07.11.2026, Tageszeit „A“): Die Wörter-Zeit ist um – der heutige Plan behält nur die erledigten Einträge (`isDone`), der Rest
 * kommt am nächsten Lerntag (Verteilung `sp` zählt ihn dort, wie beim kurzen Tag). Nur ein heutiger Plan wird ersetzt. Liefert den neuen Plan
 * oder `null` (nichts zu kürzen, kein heutiger Plan, nicht speicherbar).
 */
export async function capToday(writer: Writer, seen: DayPlan, isDone: (path: string, track: string) => boolean): Promise<DayPlan | null> {
  const day = seen.d;
  let out: DayPlan | null = null;
  await writer.transform(VMOD_DAY_PATH, (cur) => {
    // data-guard 07.11.2026: nur genau den Plan kürzen, den diese Runde kennt (gleicher Tag, gleiche Einträge) – sonst (Tageswechsel, anderes
    // Gerät hat inzwischen neu geplant oder schon gekürzt) nichts anfassen; dann endet nur die Runde.
    if (!cur || cur.d !== day || !Array.isArray(cur.plan) || !samePlan(cur.plan, seen.plan)) return null;
    const p = cur as unknown as DayPlan;
    const c = capPlanToDone(p.plan, (e) => isDone(e[0], e[1]));
    if (!c) return null;
    const per = p.plan.length ? p.min / p.plan.length : 0;
    const tomorrow = addDays(day, 1);
    const sp = new Map<string, number>(p.sp ?? []);
    sp.set(tomorrow, (sp.get(tomorrow) ?? 0) + c.dropped);
    const spList = [...sp.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, 8);
    const fresh = c.kept.filter((e) => e[1] === 'n').length;
    const next: DayPlan = {
      ...p,
      plan: c.kept,
      min: Math.round(c.kept.length * per * 10) / 10,
      due: Math.min(p.due, c.kept.length - fresh),
      fresh,
      ahead: Math.min(p.ahead, Math.max(0, c.kept.length - fresh)),
      sp: spList,
      why: p.why.endsWith('· time cap') ? p.why : `${p.why} · time cap`.slice(0, 200),
    };
    const ok = vmodDayWriteSchema.safeParse({ ...next, v: 1 });
    if (!ok.success) {
      logError('vocab:cap-day', ok.error, VMOD_DAY_PATH);
      return null;
    }
    out = next;
    return { replace: ok.data };
  });
  return out;
}

const samePlan = (a: unknown[], b: readonly (readonly unknown[])[]): boolean =>
  a.length === b.length && a.every((e, i) => Array.isArray(e) && e[0] === b[i]?.[0] && e[1] === b[i]?.[1]);

/** `vmod/pace` lesen (tolerant: ungültig = keine Messwerte). */
export function readPace(raw: unknown): FormStats | null {
  const r = vmodPaceWriteSchema.safeParse(raw);
  return r.success ? (r.data.med) : null;
}

/** Messwerte einer Runde einrechnen und speichern (frisch gelesen; unerwarteter Aufbau wird nie angefasst). */
export async function writePace(writer: Writer, nowMs: number, obs: ReadonlyMap<Form, readonly number[]>): Promise<void> {
  if (![...obs.values()].some((xs) => xs.length >= 2)) return;
  await writer.createIfMissing(VMOD_PACE_PATH, { v: 1, med: {}, n: {}, t: nowMs });
  await writer.transform(VMOD_PACE_PATH, (cur) => {
    if (!cur) return null;
    const old = vmodPaceWriteSchema.safeParse(cur);
    if (!old.success) {
      logError('vocab:pace', new Error('db_invalid'), VMOD_PACE_PATH);
      return null;
    }
    const next = nextPace(old.data.med, obs);
    if (!next) return null;
    const ok = vmodPaceWriteSchema.safeParse({ v: 1, med: next.med, n: next.n, t: nowMs });
    if (!ok.success) {
      logError('vocab:pace', ok.error, VMOD_PACE_PATH);
      return null;
    }
    // Nur Werte ergänzen oder ändern, nie Formen entfernen: `update` reicht (`replace` ist nur für `vmod/day` erlaubt).
    return { update: { v: 1, med: ok.data.med, n: ok.data.n, t: ok.data.t } };
  });
}
