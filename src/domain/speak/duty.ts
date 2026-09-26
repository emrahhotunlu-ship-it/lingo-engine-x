// Sprechen als Tagesaufgabe (Plan D4, §3.7): erledigt ist ein beendetes Gespräch mit
// mindestens 4 eigenen Zügen – ablesbar aus `log/<tag>` (Einträge `type:'speak'`).

export const SPEAK_DUTY_TURNS = 4;

type Entry = { type?: unknown; n?: unknown };

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function speakDutyDone(entries: readonly Entry[]): boolean {
  return entries.some((e) => e.type === 'speak' && num(e.n) >= SPEAK_DUTY_TURNS);
}

/** Gespräche und Business-Einheiten eines Tages (Tagesbilanz). */
export function activityCounts(entries: readonly Entry[]): { talks: number; biz: number } {
  let talks = 0;
  let biz = 0;
  for (const e of entries) {
    if (e.type === 'speak') talks++;
    else if (e.type === 'biz') biz++;
  }
  return { talks, biz };
}
