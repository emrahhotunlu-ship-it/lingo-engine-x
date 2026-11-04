import { useClock } from '../../app/clock';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { validateDoc } from '../../data/validate';
import { readPlan } from '../../domain/plan/buildPlan';
import { hasActivity } from '../../domain/plan/pflicht';
import { shortDayAllowed, shortDayPlan } from '../../domain/plan/shortDay';
import type { StoredPlan } from '../../domain/plan/types';
import { shrinkToday, vocabModuleOn } from '../../modules/vocab/api';
import { logError } from '../../platform/diagnostics';
import { useGrammarSession } from '../grammar/session';
import { useUnitRun } from '../unit/runStore';
import { syncTodayDocForDay } from './startDoc';
import { saveLocalPlan, useTodayPlan } from './store';

// Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): der Tagesweg von heute einmal auf ca. 10 Minuten – nach dem Muster der Kapitelwahl
// (`c1/chapterRun.ts refreezeToday`): nur der Plan, den dieses Gerät kennt, nur unberührt, in EINEM `transform` zusammen mit dem
// Wochenzähler `app/profile.kt = {Tag: 1}` (nur ergänzend, nie gelöscht). Danach der heutige Wörter-Plan des Moduls (api.shrinkToday, Wörter-Modul an).

type Doc = Record<string, unknown>;
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});

/** Ist heute noch nichts angefasst? Keine Aktivität im Profil, kein Eintrag in `act[heute]`, keine laufende Einheit oder Grammatik-Runde. */
export function untouchedToday(profile: Doc | null | undefined, today: string, view: { done: number; fills: readonly number[] }): boolean {
  if (view.done > 0 || view.fills.some((f) => f > 0)) return false;
  const p = obj(profile);
  if (hasActivity(p, today)) return false;
  if (Object.values(obj(obj(p.act)[today])).some((v) => typeof v === 'number' && v > 0)) return false;
  const run = useUnitRun.getState();
  const gs = useGrammarSession.getState();
  return !(run.day === today && run.block !== null) && !(gs.active && gs.day === today);
}

/** Tagesweg von heute verkürzen. `true`, wenn der neue Plan gespeichert ist. */
export async function takeShortDay(today: string, view: { done: number; fills: readonly number[] }): Promise<boolean> {
  const tp = useTodayPlan.getState();
  const plan = tp.day === today && tp.status === 'ready' ? tp.plan : null;
  const profile = useLive.getState().docs['app/profile'];
  if (!plan || !shortDayAllowed({ plan, today, kt: profile?.kt, untouched: untouchedToday(profile, today, view) })) return false;
  const writer = getWriter();
  if (!writer) return false;
  let next: StoredPlan | null = null;
  try {
    await writer.transform('app/profile', (doc) => {
      if (!doc || !validateDoc('app/profile', doc).ok) return null;
      const stored = readPlan(doc.plan, today);
      // Ist der Plan von heute noch nicht gespeichert (gleich nach dem Öffnen), gilt die Kopie dieses Geräts; sie wird hier verkürzt gespeichert,
      // und das spätere Speichern lässt den vorhandenen Plan stehen. Ein gespeicherter Plan muss derselbe sein, den dieses Gerät zeigt.
      if (stored && stored.at !== plan.at) return null;
      const raw = stored ? (doc.plan as Doc) : (plan as unknown as Doc);
      const cur = stored ?? plan;
      // Frisch geprüft: noch nicht kurz, heute nichts angefasst, Wochengrenze.
      if (!shortDayAllowed({ plan: cur, today, kt: doc.kt, untouched: untouchedToday(doc, today, view) })) return null;
      const upd = shortDayPlan(raw);
      if (!upd) return null;
      next = readPlan(upd, today);
      return next ? { update: { plan: upd, kt: { [today]: 1 } } } : null;
    });
  } catch (err) {
    logError('today:short-day', err, 'app/profile');
    return false;
  }
  const done: StoredPlan | null = next;
  if (!done) return false;
  // Gespeichert ist der kurze Tag ab hier (Plan und `kt`); die Ansicht folgt nur, solange noch derselbe Lerntag gilt.
  if (vocabModuleOn(profile)) {
    // Wörter-Plan: einmal wiederholen, sonst bliebe er voll (data-guard S2). Steht er noch nicht, plant die Runde am kurzen Tag ohnehin 5 Minuten.
    for (let k = 0; k < 2; k++) {
      try {
        await shrinkToday(writer, useClock.getState().now);
        break;
      } catch (err) {
        logError('today:short-day-words', err, k ? 'zweiter Versuch' : undefined);
      }
    }
  }
  if (useTodayPlan.getState().day === today) {
    useTodayPlan.setState({ plan: done });
    saveLocalPlan(done);
    void syncTodayDocForDay(today, 'plan');
  }
  return true;
}
