import { create } from 'zustand';
import { useSettings } from '../../app/settings';
import { getWriter } from '../../data';
import { invalidIdsOf, useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { dayKey } from '../../domain/date';
import { buildPlan, readPlan } from '../../domain/plan/buildPlan';
import type { StoredPlan } from '../../domain/plan/types';
import { buildTrainCards } from '../../domain/srs/cards';
import { planRound } from '../../domain/srs/queue';
import { logError, logWarn } from '../../platform/diagnostics';

// Tagesplan: einmal je Lerntag festgelegt und in app/profile.plan gespeichert, nie neu
// gewürfelt (Kap. 15). Ist das Speichern nicht möglich, gilt der lokal berechnete Plan für
// den Tag (eingefroren), und nichts wird überschrieben.

type PlanState = { day: string | null; plan: StoredPlan | null; status: 'idle' | 'building' | 'ready' | 'local' | 'error' };

export const useTodayPlan = create<PlanState>(() => ({ day: null, plan: null, status: 'idle' }));

export async function ensureDay(nowMs: number): Promise<void> {
  const today = dayKey(nowMs);
  const cur = useTodayPlan.getState();
  if (cur.day === today && cur.status !== 'idle') return;
  useTodayPlan.setState({ day: today, plan: null, status: 'building' });

  const live = useLive.getState();
  const profile = live.docs['app/profile'];
  let built: ReturnType<typeof buildPlan>;
  try {
    const kept = readPlan(profile?.plan, today);
    if (kept) {
      useTodayPlan.setState({ day: today, plan: kept, status: 'ready' });
      return;
    }
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
    const round = planRound({
      cards,
      nowMs,
      newPerDay: typeof profile?.newPerDay === 'number' ? profile.newPerDay : 5,
      introducedToday: cards.filter((c) => c.intro === today).length,
      introducedLessonToday: cards.filter((c) => c.intro === today && c.src === 'lesson').length,
      lang: useSettings.getState().lang,
    });
    built = buildPlan({ today, existing: profile?.plan, round, nowMs });
  } catch (err) {
    // Nie endlos im Ladezustand: Hinweis mit „Erneut versuchen" (Kap. 3.4, keine stillen Fehler).
    logError('today:plan', err, 'Aufbau');
    if (useTodayPlan.getState().day === today) useTodayPlan.setState({ day: today, plan: null, status: 'error' });
    return;
  }
  let final: StoredPlan = built.plan;
  let status: PlanState['status'] = 'ready';
  const writer = getWriter();
  try {
    if (!writer) throw new Error('Kein Schreibzugriff');
    let invalid = false;
    await writer.transform('app/profile', (doc) => {
      if (!doc) return null;
      if (!validateDoc('app/profile', doc).ok) {
        invalid = true;
        return null;
      }
      const other = readPlan(doc.plan, today);
      if (other) {
        final = other;
        return null;
      }
      return { update: { plan: built.plan } };
    });
    if (invalid) {
      status = 'local';
      logWarn('today:plan', { code: 'invalid_document', message: 'Profil ungültig – Tagesplan nur lokal' }, 'app/profile');
    }
  } catch (err) {
    status = 'local';
    logError('today:plan', err, 'app/profile');
  }
  if (useTodayPlan.getState().day === today) useTodayPlan.setState({ day: today, plan: final, status });
}

/** Nach einem Fehler beim Aufbau: einmal neu versuchen (nur per Knopf, nie automatisch). */
export function retryPlan(nowMs: number): void {
  useTodayPlan.setState({ status: 'idle' });
  void ensureDay(nowMs);
}
