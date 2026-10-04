import { useMemo, useState } from 'react';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { useLive } from '../../data/live';
import { repairsDoneToday } from '../../domain/repair/daily';
import { dueRepairs, readRepairs, type RepairItem as Repair } from '../../domain/repair/repair';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT } from '../../i18n';
import { SessionEnd } from '../../ui/SessionEnd';
import { ExerciseTop } from '../learn/ui';
import { flush } from '../progress/persist';
import { commitRepairAnswer } from '../repair/review';
import { RepairItem } from '../repair/RepairItem';

// „Fehler korrigieren“ im Reiter „Anwenden“ (Plan docs/umbau/anwenden-plan.md, Stufe 2, Übung 1): die fälligen
// Reparatur-Sätze (`app/repair`, Boxen 1/3/9) als freie, freiwillige Runde. Keine eigene Zählung und keine zweite Quelle:
// Antworten laufen über `commitRepairAnswer` mit `ctx:'xtra'` (zählt nie zu „Wiederholen“ der Pflicht, erzeugt keine
// Karten und keinen Rückstand). Was heute schon geübt wurde, kommt nicht noch einmal.

export const REPAIR_ROUND_MAX = 5;

/** Fällige Reparatur-Sätze, die heute noch nicht geübt wurden (rein aus den Live-Daten). */
export function useOpenRepairs(): Repair[] {
  const repairDoc = useLive((s) => s.docs['app/repair']);
  const dayDoc = useLive((s) => s.day?.doc);
  const now = useClock((s) => s.now);
  return useMemo(() => {
    const entries = Array.isArray(dayDoc?.entries) ? (dayDoc.entries as Array<{ type?: unknown; id?: unknown }>) : [];
    const done = repairsDoneToday(entries);
    return dueRepairs(readRepairs(repairDoc ?? undefined), now).filter((e) => !done.has(e.id));
  }, [repairDoc, dayDoc, now]);
}

export function RepairRoundScreen() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const back = useNav((s) => s.back);
  const today = useClock((s) => s.today);
  const open = useOpenRepairs();
  // Einmal beim Öffnen festlegen: die Liste ändert sich während der Runde, die Runde nicht.
  const [items] = useState(() => open.slice(0, REPAIR_ROUND_MAX));
  const [pos, setPos] = useState(0);
  const [right, setRight] = useState(0);
  const [startedAt] = useState(() => performance.now());

  const leave = () => {
    api.blur();
    void flush();
    back();
  };
  const cur = items[pos];
  const finished = pos >= items.length;
  const [endedAt, setEndedAt] = useState(0);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 py-4 sm:py-8" data-testid="repair-round" data-state={finished ? 'done' : 'open'}>
      <ExerciseTop onClose={leave} progress={items.length && !finished ? { n: pos + 1, total: items.length } : null} ctx="xtra" />
      {!items.length ? (
        <p className="lx-glass rounded-[var(--radius-card)] p-5 text-sm text-muted" data-testid="repair-round-empty">
          {t('apRepairNone')}
        </p>
      ) : finished ? (
        <SessionEnd right={right} total={items.length} ms={Math.max(1, endedAt - startedAt)} next={{ label: t('lrBackToApply'), run: leave }} />
      ) : (
        cur && (
          <RepairItem
            key={cur.id}
            item={cur}
            mode="review"
            area="trainer"
            source={null}
            onResult={({ ok, given, ms }) => {
              commitRepairAnswer({ item: cur, ok, given, ms, day: today, lang, ctx: 'xtra', first: pos === 0 });
              if (ok) setRight((n) => n + 1);
            }}
            onNext={() => {
              setPos((p) => p + 1);
              setEndedAt(performance.now());
              api.blur();
            }}
          />
        )
      )}
    </div>
  );
}
