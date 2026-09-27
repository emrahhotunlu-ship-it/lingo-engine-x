import { lessonDoneOn } from '../course/courseDone';
import { addDays, dayKey, isDayKey, legacyDayKey } from '../date';
import { isDutyChannel } from './channels';
import { isPhase2Plan } from './buildPlan';
import type { DutyId, StoredPlan } from './types';

// Pflicht und Serie (phase2-plan §6.3, Daten-Entwurf §7, verbindlich; behebt ALARM B1/B2).
//
// Regel 1 – `pflicht[day] = 1` wird nur gesetzt (nie 0, nie entfernt), wenn es an dem Tag eigene
// Aktivität gibt UND (a) alle Punkte aus `plan.duty` erfüllt sind, oder (b) „Wiederholen" erschöpft
// ist und die übrigen Punkte erfüllt sind, oder (c) `plan.duty` leer ist.
// Regel 2 – `pflichtSince` (einmal je Datenbank): nur mit einem gespeicherten Phase-2-Plan von heute
// (die neue Pflicht greift also erst am Lerntag NACH der Auslieferung), dessen Pflicht ohne KI und
// Sprachausgabe erfüllbar ist; Wert = spätester aus heute (beide Tageswechsel), Umstellungstag und
// letztem Aktivtag – nie rückwirkend.
// Regel 3 – `computeStreak` bleibt unverändert.

type Doc = Record<string, unknown>;

const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const pos = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Eigene Aktivität an diesem Tag nach der alten Regel (`days` oder `xpDays`). */
export function hasActivity(profile: Readonly<Doc>, day: string): boolean {
  return pos(obj(profile.days)[day]) || pos(obj(profile.xpDays)[day]);
}

/** Ist `pflicht[day]` schon gesetzt? */
export const pflichtMarked = (profile: Readonly<Doc> | null | undefined, day: string): boolean => !!obj(profile?.pflicht)[day];

export type PflichtInput = {
  day: string;
  plan: StoredPlan | null;
  /** Frischer Stand des Profils (einschließlich des gerade geschriebenen Stapels). */
  profile: Readonly<Doc>;
  /** Der Stapel selbst bringt Aktivität für `day`. */
  batchActivity: boolean;
  /** „Wiederholen" nach `deriveToday` erfüllt. */
  reviewDone: boolean;
  /** Die Pflichtrunde „Wiederholen" ist erschöpft. */
  exhausted: boolean;
  course: Readonly<Doc> | null | undefined;
  /** Eine Lektion wurde heute abgeschlossen, ist aber noch im Puffer. */
  pendingLessonDay: boolean;
  /** Pflichtkanal-Runde heute abgeschlossen, noch im Puffer. */
  pendingChannelDone?: boolean;
};

export function pflichtFor(i: PflichtInput): boolean {
  if (!i.plan || i.plan.d !== i.day) return false;
  if (!(i.batchActivity || hasActivity(i.profile, i.day))) return false;
  if (i.plan.duty.length === 0) return true; // (c)
  const act = obj(obj(i.profile.act)[i.day]);
  return i.plan.duty.every((d) => {
    if (d === 'review') return i.reviewDone || i.exhausted; // (a)/(b)
    if (d === 'lesson') return lessonDoneOn(i.course, i.day) || i.pendingLessonDay;
    const ch = d.slice(3);
    return (typeof act[ch] === 'number' && (act[ch]) >= 1) || !!i.pendingChannelDone;
  });
}

/** Alle Pflichtpunkte ohne KI und ohne Sprachausgabe erfüllbar? (Voraussetzung für `pflichtSince`.) */
export function dutiesFeasible(plan: StoredPlan | null, env: { tts: boolean; ai: boolean }, data?: { cloze: number; order: number }): boolean {
  if (!plan) return false;
  void env; // Wiederholen, Lektion (Grundfassung) und die Pflichtkanäle brauchen weder KI noch Sprachausgabe.
  return plan.duty.every((d) => {
    if (d === 'review' || d === 'lesson') return true;
    const ch = d.slice(3);
    if (!isDutyChannel(ch)) return false;
    if (!data) return true;
    return ch === 'gram' || (ch === 'cloze' && data.cloze >= 8) || (ch === 'order' && data.order >= 6);
  });
}

/** Toleranz für nachgehende Uhren anderer Geräte (Tage). */
export const SKEW_DAYS = 2;

/** Größter Datumsschlüssel ≤ `max` in den Zähl-Feldern des Profils. */
function lastActiveDay(profile: Readonly<Doc>, max: string): string | null {
  let best: string | null = null;
  for (const field of ['days', 'xpDays', 'minutes', 'act', 'pflicht']) {
    for (const k of Object.keys(obj(profile[field]))) {
      if (isDayKey(k) && k <= max && (!best || k > best)) best = k;
    }
  }
  return best;
}

/** Wert für `pflichtSince`: nie vor heute, dem Umstellungstag oder dem letzten Aktivtag (behebt B2/S4). */
export function pflichtSinceValue(i: { nowMs: number; cutover: string | null; profile: Readonly<Doc> }): string {
  const legacy = legacyDayKey(i.nowMs);
  const cands = [legacy, dayKey(i.nowMs)];
  if (isDayKey(i.cutover)) cands.push(i.cutover);
  // Aktivtage bis 2 Tage nach dem eigenen Kalendertag zählen mit: Geht die Uhr dieses Geräts nach,
  // während ein anderes schon am nächsten Tag geübt hat, wird so trotzdem nie rückwirkend gesetzt (S4).
  // Weiter in der Zukunft liegende Schlüssel sind Datenmüll und zählen nicht.
  const last = lastActiveDay(i.profile, addDays(legacy, SKEW_DAYS));
  if (last) cands.push(last);
  return cands.sort().at(-1) as string;
}

export type SinceGate = { ok: true } | { ok: false; reason: 'no_schema' | 'already_set' | 'no_plan_today' | 'phase1_plan' | 'not_feasible' };

/** Darf `pflichtSince` jetzt gesetzt werden? (Regel 2, alle Voraussetzungen) */
export function pflichtSinceGate(i: { schema: Readonly<Doc> | null | undefined; plan: StoredPlan | null; today: string; tts: boolean; ai: boolean; data?: { cloze: number; order: number } }): SinceGate {
  const s = i.schema;
  if (!s || typeof s.version !== 'number' || s.version < 1) return { ok: false, reason: 'no_schema' };
  if (s.pflichtSince != null) return { ok: false, reason: 'already_set' };
  if (!i.plan || i.plan.d !== i.today) return { ok: false, reason: 'no_plan_today' };
  if (!isPhase2Plan(i.plan)) return { ok: false, reason: 'phase1_plan' };
  if (!dutiesFeasible(i.plan, { tts: i.tts, ai: i.ai }, i.data)) return { ok: false, reason: 'not_feasible' };
  return { ok: true };
}

/** Schreibweg `app/schema.pflichtSince` im `transform` (nur einmal, nie geändert). */
export function pflichtSinceOp(cur: Readonly<Doc> | undefined, value: string): { update: Doc } | null | 'conflict' {
  if (!cur) return null;
  if (isDayKey(cur.pflichtSince)) return null;
  if (cur.pflichtSince != null) return 'conflict';
  return { update: { pflichtSince: value } };
}

/**
 * Planleiste in Pflichtrunden: „Pflicht 2 von 3" (M11) – der Schritt, an dem man gerade ist.
 * Ist der Pflichtpunkt dieser Runde schon erledigt (Zusammenfassung), zählt er als erledigter
 * Schritt und nicht als „nächster" – sonst stünde „3 von 3", obwohl noch etwas offen ist.
 */
export function dutyStep(duties: { done: number; total: number; items: ReadonlyArray<{ id: DutyId; state: 'done' | 'open' }> }, duty?: DutyId | null): number {
  const cur = duty ? duties.items.find((i) => i.id === duty) : undefined;
  const n = cur?.state === 'done' ? duties.done : duties.done + 1;
  return Math.max(1, Math.min(duties.total, n));
}
