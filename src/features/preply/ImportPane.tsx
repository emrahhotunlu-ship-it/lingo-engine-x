import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import { useAiAvailable } from '../../ai/scope';
import { RAW_MAX } from '../../prompts/preplyImport';
import { useT, type MessageKey } from '../../i18n';
import { KEY_PREFIX, local } from '../../platform/storage';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import type { ApplyTarget } from './actions';
import { ImportReview } from './ImportReview';
import type { importMachine } from './importMachine';

// „Übernehmen" (Phase 5 §8.3): Lehrer-Text einfügen → Analysieren (complex, bis zu 2 Min.) →
// Vorschau mit Einzelauswahl → Übernehmen. Entwurf lokal (`lx:draft:preply-import`).

export const DRAFT_KEY = `${KEY_PREFIX}draft:preply-import`;

type Props = { snap: SnapshotFrom<typeof importMachine>; send: ActorRefFrom<typeof importMachine>['send'] };

const TARGET_KEY: Record<ApplyTarget, MessageKey> = { vocab: 'piTargetVocab', grammar: 'piTargetGrammar', radar: 'piTargetRadar', pool: 'piTargetPool', import: 'piTargetImport' };

export function ImportPane({ snap, send }: Props) {
  const { t, num } = useT();
  const ai = useAiAvailable();
  const ctx = snap.context;

  if (snap.matches('analyzing')) {
    return (
      <Card channel="speak" className="flex flex-col gap-4" aria-busy="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status" data-testid="ai-phase" data-ai-phase={ctx.phase ?? 'queued'}>
            {ctx.phase === 'slow' ? t('aiSlow') : `${t('aiThinking')} ${t('piLong')}`}
          </p>
          <Button variant="ghost" onClick={() => send({ type: 'STOP' })} data-testid="ai-stop">
            {t('aiStop')}
          </Button>
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </Card>
    );
  }

  if ((snap.matches('review') || snap.matches('applying')) && ctx.pi) {
    return (
      <ImportReview
        pi={ctx.pi}
        sel={ctx.sel}
        busy={snap.matches('applying')}
        onToggle={(group, i) => send({ type: 'TOGGLE', group, i })}
        onApply={() => send({ type: 'APPLY' })}
        onLater={() => send({ type: 'LATER' })}
      />
    );
  }

  if (snap.matches('applied') && ctx.res) {
    const r = ctx.res;
    return (
      <Card channel="speak" className="flex flex-col gap-3" data-testid="pi-applied">
        <p className="text-lg font-semibold">{t('piApplied', { n: r.c + r.t + r.w })}</p>
        <ul className="flex flex-col gap-1 text-sm text-muted">
          {r.c > 0 && <li>{t('piAppliedErrors', { n: r.c })}</li>}
          {r.w > 0 && <li>{t('piAppliedCards', { n: r.w })}</li>}
          {r.t > 0 && <li>{t('piAppliedExercises', { n: r.t })}</li>}
          {r.poolFull > 0 && <li data-testid="pi-pool-full">{t('piPoolFull', { n: r.poolFull })}</li>}
          {r.replaced > 0 && <li>{t('piReplaced', { n: r.replaced })}</li>}
        </ul>
        <div>
          <Button variant="secondary" onClick={() => send({ type: 'RESET' })} data-testid="pi-new">
            {t('piNew')}
          </Button>
        </div>
      </Card>
    );
  }

  if (snap.matches('partial')) {
    return (
      <Card channel="speak" className="flex flex-col gap-3" role="alert" data-testid="pi-partial">
        <p className="text-base font-semibold text-danger-text">{t('piPartial')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
          {ctx.failed.map((f) => (
            <li key={f}>{t(TARGET_KEY[f])}</li>
          ))}
        </ul>
        <div>
          <Button variant="primary" onClick={() => send({ type: 'RETRY' })} data-testid="pi-retry-apply">
            {t('piRetryApply')}
          </Button>
        </div>
      </Card>
    );
  }

  // editing
  const raw = ctx.raw;
  const edit = (v: string) => {
    send({ type: 'EDIT', raw: v });
    if (v) local.set(DRAFT_KEY, v);
    else local.remove(DRAFT_KEY);
  };
  return (
    <Card channel="speak" className="flex flex-col gap-3" data-testid="pi-edit">
      <label htmlFor="pi-raw" className="text-sm font-semibold">
        {t('piPaste')}
      </label>
      <textarea
        id="pi-raw"
        value={raw}
        onChange={(e) => edit(e.target.value)}
        rows={9}
        className="w-full resize-y rounded-2xl border border-line bg-surface-solid px-4 py-3 text-base leading-relaxed text-fg outline-none focus:border-[var(--lx-fg-subtle)]"
        data-testid="pi-raw"
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className={`lx-tnum text-xs ${raw.length > RAW_MAX ? 'text-gold-text' : 'text-subtle'}`} data-testid="pi-count">
          {t('tlCount', { n: num(raw.length), max: num(RAW_MAX) })}
          {raw.length > RAW_MAX ? ` · ${t('piTooLong', { n: num(RAW_MAX) })}` : ''}
        </span>
        {ai ? (
          <Button variant="primary" icon="sparkle" onClick={() => send({ type: 'ANALYZE' })} disabled={!raw.trim()} data-testid="pi-analyze" data-ai="">
            {ctx.error ? t('aiRetry') : t('piAnalyze')}
          </Button>
        ) : (
          <span className="text-sm text-muted">{t('aiUnavailable')}</span>
        )}
      </div>
      {ctx.error && (
        <p className="text-sm text-danger-text" role="alert" data-testid="ai-error">
          {t(ctx.error)}
        </p>
      )}
      <p className="text-xs text-subtle">{t('piLong')}</p>
    </Card>
  );
}
