import { useState } from 'react';
import { useNav } from '../../app/nav';
import { StepBoundary } from '../../app/shell/Boundary';
import type { ScreenProps } from '../../app/registry';
import { unitDone } from '../../app/unit/done';
import { normText } from '../../domain/week';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { toast } from '../../ui/Toast';
import { ExerciseTop, TaskLine } from '../learn/ui';
import { useToday } from '../today/state';
import { useUnitRun } from './runStore';

// Eigene Ersatzschritte der Tageseinheit (Route `unitStep`), solange die Anbieter der Pakete fehlen
// oder nicht machbar sind – ohne KI erfüllbar (G6, M4):
// - `again` (Block 5): aus dem Kopf neu formulieren, beide Fassungen nebeneinander; Korrekturen aus
//   Block 3 werden lokal geprüft (S4). Es entstehen KEINE Karten aus ungeprüftem Text (M4c).
// - `check`: Wochen-Check ohne genug Stoff – kurzer Hinweis, der Block zählt.

type T = (k: MessageKey, v?: Record<string, string | number>) => string;

function leave(t: T): void {
  toast(t('nbHeuteSaved'));
  useNav.getState().go({ name: 'today' });
}

const DRAFT_MAX = 1500;

function AgainStep() {
  const { t } = useT();
  const day = useToday((s) => s.day);
  const task = useUnitRun((s) => (s.day === day ? s.task : null));
  const draft = useUnitRun((s) => s.draft);
  const [shown, setShown] = useState(false);
  const text = draft.slice(0, DRAFT_MAX);
  const norm = normText(text);
  const fixes = (task?.fixes ?? []).slice(0, 3).map((f) => ({ f, ok: norm.includes(normText(f.right)) && !(f.mine && norm.includes(normText(f.mine))) }));
  return (
    <section className="flex flex-col gap-4" data-testid="unit-again">
      <TaskLine task={t('nbHeuteAgainTask')} purpose={t('nbHeuteAgainPurpose')} />
      {!task && <p className="text-sm text-muted">{t('nbHeuteAgainNoFirst')}</p>}
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{t('nbHeuteAgainLabel')}</span>
        <textarea
          value={draft}
          onChange={(e) => useUnitRun.setState({ draft: e.target.value.slice(0, DRAFT_MAX) })}
          rows={5}
          lang="en"
          data-testid="unit-again-text"
          className="rounded-[var(--radius-control)] border border-line bg-surface p-3 text-base"
        />
      </label>
      {!shown ? (
        <Button variant="primary" size="lg" className="w-full" disabled={norm.split(' ').filter(Boolean).length < 3} onClick={() => setShown(true)} data-testid="unit-again-compare">
          {t('nbHeuteAgainCompare')}
        </Button>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2" data-testid="unit-again-both">
            {task && (
              <div className="rounded-[var(--radius-control)] border border-line p-3 text-sm" lang="en">
                <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainFirst')}</p>
                {task.text}
              </div>
            )}
            <div className="rounded-[var(--radius-control)] bg-accent-soft p-3 text-sm" lang="en">
              <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainSecond')}</p>
              {text}
            </div>
            {task?.better && (
              <div className="rounded-[var(--radius-control)] border border-line p-3 text-sm sm:col-span-2" lang="en">
                <p className="mb-1 text-xs text-muted">{t('nbHeuteAgainModel')}</p>
                {task.better}
              </div>
            )}
          </div>
          {fixes.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm" aria-label={t('nbHeuteAgainFixes')}>
              {fixes.map(({ f, ok }) => (
                <li key={f.right} data-ok={ok ? 'true' : 'false'}>
                  <span lang="en" className="font-medium">
                    {f.right}
                  </span>{' '}
                  · <span className={ok ? 'text-accent-text' : 'text-gold-text'}>{ok ? t('nbHeuteAgainFixOk') : t('nbHeuteAgainFixOpen')}</span>
                  <span className="block text-muted">{f.why}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="primary" size="lg" className="w-full" onClick={() => unitDone(5)} data-testid="unit-again-done">
            {t('nbHeuteAgainDone')}
          </Button>
        </>
      )}
    </section>
  );
}

function CheckEmpty({ block }: { block: number }) {
  const { t } = useT();
  return (
    <section className="flex flex-col gap-4" data-testid="unit-check-empty">
      <p className="text-base">{t('nbHeuteCheckEmpty')}</p>
      <Button variant="primary" size="lg" className="w-full" onClick={() => unitDone(block === 3 ? 3 : 3)} data-testid="unit-check-empty-ok">
        {t('nbHeuteCheckEmptyOk')}
      </Button>
    </section>
  );
}

export function UnitStepScreen({ route }: ScreenProps<'unitStep'>) {
  const { t } = useT();
  const total = useToday((s) => s.duties.total);
  const done = useToday((s) => s.duties.done);
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 py-4 sm:py-8" data-testid="unit-step" data-step={route.step}>
      <ExerciseTop onClose={() => leave(t)} closeLabel={t('nbHeuteClose')} closeTestId="unit-close" progress={total ? { n: Math.min(total, done + 1), total } : null} ctx="duty" />
      <StepBoundary resetKey={`${route.step}-${route.block}`} scope="unitStep" onSkip={() => leave(t)}>
        {route.step === 'again' ? <AgainStep /> : <CheckEmpty block={route.block} />}
      </StepBoundary>
    </div>
  );
}
