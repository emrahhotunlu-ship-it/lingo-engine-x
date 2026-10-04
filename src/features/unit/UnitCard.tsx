import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import type { ScreenProps } from '../../app/registry';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { SessionEnd } from '../../ui/SessionEnd';
import { toast } from '../../ui/Toast';
import { ExerciseTop } from '../learn/ui';
import { useToday } from '../today/state';
import { blockName, blockWhy } from './labels';
import { continueUnit } from './run';
import { unitPlanOf, isUnitPlan } from '../../domain/unit/plan';
import { unitRows } from '../../domain/unit/rows';

// Zwischenkarte der Tageseinheit (plan.md §1.5, Route `unitCard`): „✓ Wiederholen geschafft – Als Nächstes: …“
// mit „Weiter“; nach dem letzten Block das gemeinsame Ende (`SessionEnd`). ✕ führt immer zu Heute, nichts geht
// verloren. Seit dem Fokus-Umbau gibt es keine Wochenthema-Bestätigung mehr.

function leaveToToday(t: (k: MessageKey) => string): void {
  toast(t('nbHeuteSaved'));
  useNav.getState().go({ name: 'today' });
}

function Next() {
  const { t } = useT();
  const api = useHiddenInput();
  const view = useToday((s) => s);
  const plan = isUnitPlan(view.plan) ? view.plan : null;
  if (!plan) {
    return (
      <SessionEnd right={view.balance.correct} total={view.balance.answers} ms={view.balance.minutes * 60_000} next={{ label: t('nbHeuteEndBack'), run: () => useNav.getState().go({ name: 'today' }) }} />
    );
  }
  const up = unitPlanOf(plan, null);
  const rows = unitRows(plan, view.duties.items) ?? [];
  const nextRow = rows.find((r) => r.state !== 'done') ?? null;
  const prev = [...rows].reverse().find((r) => r.state === 'done') ?? null;
  if (!nextRow) {
    return (
      <div data-testid="unit-end">
        <SessionEnd
          right={view.balance.correct}
          total={view.balance.answers}
          ms={Math.max(1, view.balance.minutes) * 60_000}
          next={{ label: t('nbHeuteEndBack'), run: () => useNav.getState().go({ name: 'today' }) }}
        />
      </div>
    );
  }
  const b = up.blocks.find((x) => x.channel === nextRow.id);
  return (
    <section className="flex flex-col gap-5" data-testid="unit-between" data-next={nextRow.id}>
      <div className="lx-glass flex flex-col items-center gap-2 rounded-[var(--radius-card)] px-5 py-7 text-center">
        {prev && <p className="lx-eyebrow text-accent-text">✓ {t('nbHeuteBetweenDone', { block: blockName(prev.kind, prev.block, t) })}</p>}
        <h2 className="text-xl font-semibold tracking-tight">{t('nbHeuteRing', { done: view.duties.done, total: view.duties.total, min: rows.filter((r) => r.state !== 'done').reduce((s, r) => s + r.min, 0) })}</h2>
        <p className="text-sm text-muted">{t('nbHeuteBetweenNext', { block: blockName(nextRow.kind, nextRow.block, t), why: b ? blockWhy(b, t, plan.goal.review, b.kind === 'review' && b.min * 60 > up.reviewSec) : '' })}</p>
      </div>
      <Button variant="primary" size="lg" className="w-full" iconAfter="arrowRight" onClick={() => continueUnit(api)} data-testid="unit-next">
        {t('nbHeuteBetweenGo')}
      </Button>
    </section>
  );
}

export function UnitCardScreen({ route }: ScreenProps<'unitCard'>) {
  const { t } = useT();
  const total = useToday((s) => s.duties.total);
  const done = useToday((s) => s.duties.done);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-4 sm:py-8" data-testid="unit-card" data-step={route.step}>
      <ExerciseTop onClose={() => leaveToToday(t)} closeLabel={t('nbHeuteClose')} closeTestId="unit-close" progress={total ? { n: Math.min(total, done), total } : null} ctx="duty" />
      <StepBoundary resetKey={route.step} scope="unitCard" onSkip={() => leaveToToday(t)}>
        <Next />
      </StepBoundary>
    </div>
  );
}
