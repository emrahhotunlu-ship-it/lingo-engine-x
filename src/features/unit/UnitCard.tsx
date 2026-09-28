import { useState } from 'react';
import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import type { ScreenProps } from '../../app/registry';
import { THEMES } from '../../content/nb/themes';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { SessionEnd } from '../../ui/SessionEnd';
import { toast } from '../../ui/Toast';
import { ExerciseTop } from '../learn/ui';
import { useToday } from '../today/state';
import { chooseTheme } from '../week/store';
import { useWeekState } from '../week/useWeekState';
import { blockName, blockWhy } from './labels';
import { continueUnit, markConfirmed } from './run';
import { unitPlanOf, isUnitPlan } from '../../domain/unit/plan';
import { unitRows } from '../../domain/unit/rows';

// Zwischen- und Bestätigungskarte der Tageseinheit (plan.md §1.5, Route `unitCard`):
// - `confirm`: am ersten Lerntag der Woche vor Block 1 – Vorschlag, „Passt“, „Anderes wählen“ (M10).
// - `next`: „✓ Wiederholen geschafft – Als Nächstes: …“ mit „Weiter“; nach dem letzten Block das
//   gemeinsame Ende (`SessionEnd`). ✕ führt immer zu Heute, nichts geht verloren.

const KIND_KEY: Record<string, MessageKey> = { job: 'nbHeuteKindJob', bridge: 'nbHeuteKindBridge', life: 'nbHeuteKindLife' };

function leaveToToday(t: (k: MessageKey) => string): void {
  toast(t('nbHeuteSaved'));
  useNav.getState().go({ name: 'today' });
}

function Confirm() {
  const { t, lang } = useT();
  const api = useHiddenInput();
  const { pick, day } = useWeekState();
  const [other, setOther] = useState(false);
  const choose = (id: (typeof THEMES)[number]['id'], by: 'auto' | 'user') => {
    void chooseTheme(id, by, day);
    markConfirmed(day);
    continueUnit(api);
  };
  const th = pick.theme;
  return (
    <section className="flex flex-col gap-5" data-testid="unit-confirm" data-theme-id={pick.id}>
      <div className="lx-glass flex flex-col gap-3 rounded-[var(--radius-card)] p-5">
        <p className="lx-eyebrow">{t('nbHeuteConfirmEyebrow')} · {t(KIND_KEY[th.kind] ?? 'nbHeuteKindJob')}</p>
        <h2 className="text-xl font-semibold tracking-tight text-balance">{th.title[lang]}</h2>
        <p className="text-sm text-muted">{th.task[lang]}</p>
        <p className="text-xs text-subtle">{t('nbHeuteConfirmLead')}</p>
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('nbHeuteConfirmPhrases')}</p>
          <ul className="flex flex-wrap gap-2">
            {th.phrases.slice(0, 5).map((p) => (
              <li key={p.en} className="lx-chip" lang="en">
                <EnglishText as="span" text={p.en} area="lesson" source="unit" />
              </li>
            ))}
          </ul>
        </div>
      </div>
      {!other ? (
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" className="w-full" onClick={() => choose(pick.id, 'auto')} data-testid="unit-confirm-ok">
            {t('nbHeuteConfirmOk')}
          </Button>
          <Button variant="ghost" onClick={() => setOther(true)} data-testid="unit-confirm-other">
            {t('nbHeuteConfirmOther')}
          </Button>
        </div>
      ) : (
        <section className="flex flex-col gap-2" aria-label={t('nbHeuteConfirmPick')}>
          <p className="lx-eyebrow">{t('nbHeuteConfirmPick')}</p>
          <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
            {THEMES.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => choose(x.id, 'user')} data-testid="unit-theme" data-theme-id={x.id} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-strong">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">{x.title[lang]}</span>
                    <span className="text-xs text-muted">{t(KIND_KEY[x.kind] ?? 'nbHeuteKindJob')}</span>
                  </span>
                  {x.id === pick.id && <Icon name="check" size={16} className="text-accent-text" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

function Next() {
  const { t } = useT();
  const api = useHiddenInput();
  const view = useToday((s) => s);
  const { week, targets } = useWeekState();
  const plan = isUnitPlan(view.plan) ? view.plan : null;
  if (!plan) {
    return (
      <SessionEnd right={view.balance.correct} total={view.balance.answers} ms={view.balance.minutes * 60_000} next={{ label: t('nbHeuteEndBack'), run: () => useNav.getState().go({ name: 'today' }) }} />
    );
  }
  const up = unitPlanOf(plan, week);
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
          takeaways={
            <ul className="flex flex-wrap gap-2" lang="en">
              {targets.phrases.slice(0, 3).map((p) => (
                <li key={p} className="lx-chip">
                  <EnglishText as="span" text={p} area="lesson" source="unit" />
                </li>
              ))}
            </ul>
          }
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
        <p className="text-sm text-muted">{t('nbHeuteBetweenNext', { block: blockName(nextRow.kind, nextRow.block, t), why: b ? blockWhy(b, t, plan.goal.review) : '' })}</p>
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
        {route.step === 'confirm' ? <Confirm /> : <Next />}
      </StepBoundary>
    </div>
  );
}
