import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Disclosure } from '../../ui/Disclosure';
import { Icon } from '../../ui/Icon';
import { Bar } from '../../ui/ProgressRing';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { toast } from '../../ui/Toast';
import { useCapabilities } from '../../platform/capabilities';
import type { SaveOutcome } from '../../platform/downloads';
import type { MigrationPlan, RescueSkipReason } from '../../domain/migration/v1';
import { exportAll } from '../settings/exportData';
import { useMigration } from './store';

// Einmalige Umstellung mit Trockenlauf-Bericht (Kap. 9, Regel 3): erst zeigen, dann nach
// Bestätigung schreiben. Oben das Wichtigste, unten fest der eine Knopf (Kap. 2.1),
// Einzelheiten eingeklappt. Nach dem Ausführen ist die Umstellung Zustand, kein Knopf.

const COLLECTION_LABEL: Record<string, MessageKey> = {
  vocab: 'colVocab',
  grammar: 'colGrammar',
  lesson: 'colLesson',
  log: 'colLog',
  daily: 'colDaily',
  feed: 'colFeed',
  writing: 'colWriting',
  chunk: 'colChunk',
  scene: 'colScene',
  preply: 'colPreply',
  articles: 'colArticles',
  reading: 'colReading',
  lpool: 'colLpool',
  wprompt: 'colWprompt',
  app: 'colApp',
};

/** Reihenfolge im Bericht: vom Wichtigsten (Lernstand) zum Nebensächlichen. */
const COLLECTION_ORDER = ['vocab', 'grammar', 'app', 'lesson', 'log', 'chunk', 'writing', 'preply', 'scene', 'reading', 'articles', 'lpool', 'wprompt', 'daily', 'feed'];
const orderOf = (name: string) => {
  const i = COLLECTION_ORDER.indexOf(name);
  return i === -1 ? COLLECTION_ORDER.length : i;
};

type ShownSkip = Exclude<RescueSkipReason, 'unchanged'>;
const SKIP_LABEL: Record<ShownSkip, MessageKey> = {
  not_merged: 'skipNotMerged',
  read_only: 'skipReadOnly',
  invalid: 'skipInvalid',
  db_invalid: 'skipDbInvalid',
  unknown_path: 'skipUnknown',
  missing_local: 'skipMissing',
};

export const exportMessage: Record<SaveOutcome, MessageKey> = {
  saved: 'exportSaved',
  declined: 'exportDeclined',
  unavailable: 'exportUnavailable',
  busy: 'exportBusy',
  error: 'exportFailed',
};

export function MigrationScreen() {
  const { t } = useT();
  const state = useMigration();
  const { dryRun } = state;

  useEffect(() => {
    if (useMigration.getState().phase === 'idle') void dryRun();
  }, [dryRun]);

  const hasPlan = state.phase === 'review' || state.phase === 'running' || state.phase === 'busy' || state.phase === 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="flex w-full max-w-3xl flex-col gap-6 pt-6 sm:pt-10"
    >
      <header className="flex flex-col gap-3">
        <p className="lx-eyebrow">{t('migEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('migTitle')}</h1>
        <p className="max-w-2xl text-base text-muted">{t('migLead')}</p>
      </header>

      {(state.phase === 'idle' || state.phase === 'reading') && <ReadingSkeleton label={t('migReading')} />}

      {state.phase === 'done' && (
        <Card role="status" data-testid="mig-done">
          <p className="flex items-center gap-2 text-lg font-semibold text-accent-text">
            <Icon name="check" size={22} />
            {t('migDoneTitle')}
          </p>
          <p className="mt-2 text-sm text-muted">{t('migDoneBody')}</p>
        </Card>
      )}

      {state.phase === 'readFailed' && (
        <Card role="alert">
          <p className="text-base text-danger-text">{t('migReadFailed', { msg: state.message })}</p>
          <div className="mt-4">
            <Button icon="refresh" onClick={() => void dryRun()}>
              {t('migRetry')}
            </Button>
          </div>
        </Card>
      )}

      {hasPlan && <Report plan={state.plan} />}
      {hasPlan && <ActionBar />}
    </motion.div>
  );
}

function ReadingSkeleton({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label={label}>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function Report({ plan }: { plan: MigrationPlan }) {
  const { t, tn, num } = useT();
  const found = [...plan.found].sort((a, b) => orderOf(a.name) - orderOf(b.name));
  const tagesauftrag = plan.untouched.daily + plan.untouched.feed;
  const activeVocab = plan.totals.vocab - plan.totals.vocabHidden;
  const skipped: Array<{ path: string; label: MessageKey }> = [
    ...plan.rescue.filter((r) => r.rest).map((r) => ({ path: r.path, label: 'skipPartial' as const })),
    ...plan.rescueSkipped.filter((s): s is { path: string; markedAt: number; reason: ShownSkip } => s.reason !== 'unchanged').map((s) => ({ path: s.path, label: SKIP_LABEL[s.reason] })),
  ];
  const streakChanged = plan.streak.after !== plan.streak.before;

  return (
    <div className="flex flex-col gap-4">
      <Card aria-labelledby="mig-summary" data-testid="mig-summary">
        <h2 id="mig-summary" className="lx-eyebrow">
          {t('migSummaryTitle')}
        </h2>
        <div className="mt-4 flex flex-col gap-1">
          <p className="text-sm text-muted">{t('migStreakKeeps')}</p>
          <p className="lx-tnum flex flex-wrap items-baseline gap-x-3 text-3xl font-semibold tracking-tight" data-testid="mig-streak">
            {streakChanged && (
              <>
                <span className="text-muted">{num(plan.streak.before)}</span>
                <Icon name="arrowRight" className="self-center text-subtle" />
              </>
            )}
            <span>{tn('streakDays', plan.streak.after)}</span>
          </p>
        </div>
        <p className="lx-tnum mt-4 text-base text-fg">
          {t('migCounts', { vocab: activeVocab, topics: plan.totals.grammar, done: plan.totals.lessonsDone, total: plan.totals.lessonsTotal })}
          {plan.totals.vocabHidden > 0 && <span className="text-muted"> · {tn('migHidden', plan.totals.vocabHidden)}</span>}
        </p>
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-cyan-text">
          <Icon name="shield" size={18} />
          {t('migNothingDeleted')}
        </p>
      </Card>

      {plan.blocked.length > 0 && (
        <Card role="alert" aria-labelledby="mig-blocked" data-testid="mig-blocked">
          <h2 id="mig-blocked" className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-gold-text">
              <Icon name="alert" />
            </span>
            {t('migBlockedTitle')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {plan.blocked.includes('profile_invalid') && <li>{t('migBlockedProfile')}</li>}
            {plan.blocked.includes('possibly_truncated') && <li>{t('migBlockedTruncated')}</li>}
            <li className="text-fg">{t('migBlockedNext')}</li>
          </ul>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-labelledby="mig-add">
          <h2 id="mig-add" className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-accent-text">
              <Icon name="plus" />
            </span>
            {t('migAddTitle')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            {plan.fsrs.length > 0 && <li>{t('migAddPlan')}</li>}
            {plan.rescue.length > 0 && <li>{tn('migRescue', plan.rescue.length)}</li>}
            <li>{t('migAddMark')}</li>
          </ul>
        </Card>

        <Card aria-labelledby="mig-keep">
          <h2 id="mig-keep" className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-cyan-text">
              <Icon name="shield" />
            </span>
            {t('migKeepTitle')}
          </h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
            <li>{t('migKeepBody')}</li>
            {plan.rescue.length > 0 && <li>{t('migRescueSafe')}</li>}
            {tagesauftrag > 0 && <li>{t('migKeepDaily', { n: tagesauftrag })}</li>}
          </ul>
        </Card>
      </div>

      {skipped.length > 0 && (
        <Card aria-labelledby="mig-skipped">
          <h2 id="mig-skipped" className="text-lg font-semibold">
            {t('migSkippedTitle')}
          </h2>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {skipped.map((s) => (
              <li key={s.path} className="break-all">
                <span className="text-fg">{s.path}</span> – {t(s.label)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {plan.invalid.length > 0 && (
        <Card aria-labelledby="mig-invalid">
          <h2 id="mig-invalid" className="flex items-center gap-2 text-lg font-semibold">
            <span className="text-gold-text">
              <Icon name="alert" />
            </span>
            {t('migInvalidTitle')} · <span className="lx-tnum">{num(plan.invalid.length)}</span>
          </h2>
          <p className="mt-2 text-sm text-muted">{t('migInvalidBody')}</p>
          <ul className="mt-3 flex flex-col gap-1 text-xs text-subtle">
            {plan.invalid.slice(0, 8).map((i) => (
              <li key={i.path} className="break-all">
                <span className="font-medium text-muted">{i.path}</span> – {i.issues[0]}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Disclosure label={t('migDetails')}>
        <dl className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {found.map((f) => (
            <div key={f.name} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
              <dt className="text-sm text-muted">{t(COLLECTION_LABEL[f.name] ?? 'colApp')}</dt>
              <dd className="lx-tnum text-sm font-semibold">{num(f.total)}</dd>
            </div>
          ))}
        </dl>
        {plan.defaults.seedVocabNotInDb > 0 && <p className="mt-3 text-sm text-muted">{tn('migDefaultVocab', plan.defaults.seedVocabNotInDb)}</p>}
        {plan.defaults.topicsNotInDb > 0 && <p className="mt-1 text-sm text-muted">{tn('migDefaultTopics', plan.defaults.topicsNotInDb)}</p>}
      </Disclosure>
    </div>
  );
}

/** Unten fest: der eine Knopf (Kap. 2.1). Im Code steht er zuerst – wie auf dem Bildschirm (Kap. 4.5). */
function ActionBar() {
  const { t } = useT();
  const state = useMigration();
  const downloads = useCapabilities((s) => s.downloads);
  const [exporting, setExporting] = useState(false);

  if (state.phase !== 'review' && state.phase !== 'running' && state.phase !== 'busy' && state.phase !== 'failed') return null;
  const running = state.phase === 'running';
  const blocked = state.plan.blocked.length > 0;

  const backup = async () => {
    setExporting(true);
    const outcome = await exportAll(state.snapshot);
    setExporting(false);
    toast(t(exportMessage[outcome]), outcome === 'saved' || outcome === 'declined' ? 'info' : 'error');
  };

  return (
    <div
      className="sticky bottom-0 z-10 -mx-4 flex flex-col gap-3 px-4 pt-6 pb-[max(env(safe-area-inset-bottom),1rem)] sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
      style={{ background: 'linear-gradient(to top, var(--lx-bg) 72%, transparent)' }}
      data-testid="mig-actions"
    >
      {state.phase === 'busy' && (
        <p role="status" className="text-sm text-gold-text">
          {t('migBusy')}
        </p>
      )}
      {state.phase === 'failed' && (
        <p role="alert" className="text-sm text-danger-text">
          {t('migFailed', { msg: state.message })}
        </p>
      )}
      {running ? (
        <div className="flex max-w-3xl flex-col gap-2" role="status">
          <Bar value={state.total ? state.done / state.total : 0} label={t('migProgress', { done: state.done, total: state.total })} duration={0.15} />
          <p className="lx-tnum text-sm text-muted">{t('migProgress', { done: state.done, total: state.total })}</p>
        </div>
      ) : (
        <div className="flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
          {!blocked &&
            (state.phase === 'failed' ? (
              <Button variant="primary" size="lg" icon="refresh" onClick={() => void state.dryRun()}>
                {t('migRetry')}
              </Button>
            ) : (
              <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => void state.run()}>
                {t('migRun')}
              </Button>
            ))}
          {downloads === 'ready' && (
            <Button
              variant={blocked ? 'primary' : 'secondary'}
              size={blocked ? 'lg' : 'md'}
              icon="download"
              onClick={() => void backup()}
              busy={exporting}
              busyLabel={t('exportRunning')}
            >
              {t('migBackup')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
