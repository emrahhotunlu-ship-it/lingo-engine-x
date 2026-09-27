import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useLive } from '../../data/live';
import { readRepairs, repairId, type NewRepair, type RepairItem as Repair } from '../../domain/repair/repair';
import type { WordTapArea } from '../../engine/wordTap';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { RepairItem, type RepairView } from './RepairItem';
import { recordRepair, saveRepairs } from './store';

// Schritt „Nochmal, aber besser" (Lernberatung 27.09., V2) direkt nach der Rollenspiel-
// Auswertung und nach der Schreibkorrektur: bis zu 3 eigene Sätze mit Korrektur neu
// formulieren. Das Ergebnis zählt als erste Wiederholung (`recordRepair`). Überspringen ist
// jederzeit erlaubt, ohne Vorwurf. Schon einmal geübte Sätze kommen hier nicht noch einmal.

export const STEP_MAX = 3;

type Props = {
  candidates: readonly NewRepair[];
  area: WordTapArea;
  source: string | null;
};

/** Kandidaten, die noch nie geübt wurden (einmal beim Öffnen festgelegt). */
function pick(candidates: readonly NewRepair[]): Array<RepairView & { add: NewRepair }> {
  const known = new Map<string, Repair>(readRepairs(useLive.getState().docs['app/repair'] ?? undefined).map((e) => [e.id, e]));
  const out: Array<RepairView & { add: NewRepair }> = [];
  for (const c of candidates) {
    const id = repairId(c.wrong);
    const k = known.get(id);
    // Seit dem (erneuten) Anlegen schon geübt → nicht noch einmal.
    if (k && !k.done && (k.last ?? 0) >= k.t) continue;
    if (out.some((o) => o.id === id)) continue;
    out.push({ id, wrong: c.wrong.trim(), right: c.right.trim(), ...(c.why ? { why: c.why } : {}), src: c.src, ...(c.fix?.length ? { fix: [...c.fix] } : {}), add: c });
    if (out.length >= STEP_MAX) break;
  }
  return out;
}

export function RepairStep({ candidates, area, source }: Props) {
  const { t } = useT();
  const [items] = useState(() => pick(candidates));
  const [pos, setPos] = useState(0);
  const [end, setEnd] = useState<'done' | 'skipped' | null>(null);
  if (!items.length) return null;
  const cur = items[pos];
  const advance = () => {
    if (pos + 1 < items.length) setPos(pos + 1);
    else setEnd('done');
  };

  return (
    <section className="flex flex-col gap-4" data-testid="repair-step" data-state={end ?? 'open'} aria-labelledby="repair-step-title">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="repair-step-title" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <Icon name="refresh" size={18} />
            {t('rxStepTitle')}
          </h2>
          {!end && (
            <Button variant="ghost" onClick={() => setEnd('skipped')} data-testid="repair-step-skip">
              {t('rxSkipAll')}
            </Button>
          )}
        </div>
        {!end && <p className="text-sm text-muted">{t('rxStepLead')}</p>}
      </header>
      <AnimatePresence mode="wait" initial={false}>
        {end ? (
          <motion.p key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base, ease: EASE_OUT }} className="text-sm text-muted" data-testid="repair-step-end" role="status">
            {end === 'done' ? t('rxStepDone') : t('rxStepSkipped')}
          </motion.p>
        ) : (
          cur && (
            <motion.div key={cur.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
              <RepairItem
                item={cur}
                mode="step"
                area={area}
                source={source}
                status={items.length > 1 ? t('rxCount', { n: pos + 1, total: items.length }) : undefined}
                onResult={({ ok }) => {
                  // Erst sicherstellen, dass der Satz gespeichert ist (idempotent), dann die Wiederholung.
                  void saveRepairs([cur.add]).then(() => recordRepair(cur.id, ok));
                }}
                onNext={advance}
                onSkip={advance}
              />
            </motion.div>
          )
        )}
      </AnimatePresence>
    </section>
  );
}
