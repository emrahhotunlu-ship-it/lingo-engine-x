import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { drillTasks, type DrillTask } from '../../domain/patterns/drill';
import type { Mistake } from '../../domain/patterns/mistakes';
import type { Pattern } from '../../domain/patterns/patterns';
import { repairId } from '../../domain/repair/repair';
import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { RepairItem } from '../repair/RepairItem';
import { recordRepair, saveRepairs } from '../repair/store';
import { FreeItem } from './FreeItem';

// Kurzdrill einer Deutsch-Falle (Lernberatung 27.09., V3): eigene Sätze korrigieren (als
// Reparatur-Sätze mit Quelle `pattern` – sie kommen danach in die Wiederholung 1/3/9) und neue
// Sätze frei bilden (pattern-check@1). Keine Selbstbewertung, Überspringen ohne Vorwurf.

type Props = { pattern: Pattern; all: readonly Pattern[]; mistakes: readonly Mistake[]; rule: string | null; onDone: () => void };

export function PatternDrill({ pattern, all, mistakes, rule, onDone }: Props) {
  const { t } = useT();
  const [tasks] = useState<DrillTask[]>(() => drillTasks(pattern, mistakes, all));
  const [pos, setPos] = useState(0);
  const [ok, setOk] = useState(0);
  const [done, setDone] = useState(false);
  const cur = tasks[pos];
  const advance = () => {
    if (pos + 1 < tasks.length) setPos(pos + 1);
    else setDone(true);
  };
  const status = t('ptDrillStatus', { n: pos + 1, total: tasks.length });

  if (!tasks.length) {
    return (
      <Card className="flex flex-col gap-3" data-testid="pattern-drill" data-state="empty">
        <p className="text-sm text-muted">{t('ptDrillEmpty')}</p>
        <div>
          <Button variant="secondary" icon="arrowLeft" onClick={onDone} data-testid="pattern-drill-back">
            {t('ptDrillBack')}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <section className="flex flex-col gap-4" data-testid="pattern-drill" data-state={done ? 'done' : 'open'} data-id={pattern.id} aria-label={t('ptDrillTitle')}>
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.div key="end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
            <Card className="flex flex-col gap-4">
              <p className="lx-tnum text-base font-medium" role="status" data-testid="pattern-drill-end" data-ok={ok} data-total={tasks.length}>
                {t('ptDrillDone', { ok, total: tasks.length })}
              </p>
              <div>
                <Button variant="primary" icon="arrowLeft" onClick={onDone} data-testid="pattern-drill-back">
                  {t('ptDrillBack')}
                </Button>
              </div>
            </Card>
          </motion.div>
        ) : (
          cur && (
            <motion.div key={pos} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: DURATION.base, ease: EASE_OUT }}>
              {cur.kind === 'fix' ? (
                <RepairItem
                  item={{ id: repairId(cur.wrong), wrong: cur.wrong, right: cur.right, ...(rule ? { why: rule } : {}), src: 'pattern' }}
                  mode="step"
                  area="lesson"
                  source="app/patterns"
                  status={status}
                  onResult={({ ok: right }) => {
                    if (right) setOk((n) => n + 1);
                    // Der eigene Satz wird Reparatur-Satz (idempotent). Direkt nach dem Zeigen ist ein
                    // Treffer noch kein freier Abruf: nur ein Fehler wird eingetragen (wie RepairStep).
                    const add = { wrong: cur.wrong, right: cur.right, why: rule, src: 'pattern' as const, ctx: pattern.title_en };
                    void saveRepairs([add]).then(() => (right ? undefined : recordRepair(repairId(cur.wrong), false)));
                  }}
                  onNext={advance}
                  onSkip={advance}
                  nextLabel={t('ptNext')}
                />
              ) : (
                <FreeItem task={cur.task} pattern={pattern.title_en} example={pattern.examples[0] ? `${pattern.examples[0].wrong} => ${pattern.examples[0].right}` : ''} status={status} onResult={(right) => right && setOk((n) => n + 1)} onNext={advance} />
              )}
            </motion.div>
          )
        )}
      </AnimatePresence>
    </section>
  );
}
