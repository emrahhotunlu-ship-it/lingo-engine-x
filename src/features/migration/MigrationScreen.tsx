import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { Bar } from '../../ui/ProgressRing';
import { Skeleton } from '../../ui/Skeleton';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { toast } from '../../ui/Toast';
import { useCapabilities } from '../../platform/capabilities';
import type { SaveOutcome } from '../../platform/downloads';
import type { MigrationPlan } from '../../domain/migration/v1';
import { exportAll } from '../settings/exportData';
import { useMigration } from './store';

// Einmalige Umstellung mit Trockenlauf-Bericht (Kap. 9, Regel 3): erst zeigen, dann nach
// Bestätigung schreiben. Ein großer Knopf, klare Trennung „ergänzt" / „bleibt".

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.slow, ease: EASE_OUT }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6 py-6 sm:py-10"
    >
      <header className="flex flex-col gap-3">
        <p className="lx-eyebrow">{t('migEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('migTitle')}</h1>
        <p className="max-w-2xl text-base text-muted">{t('migLead')}</p>
      </header>

      {(state.phase === 'idle' || state.phase === 'reading' || state.phase === 'done') && <ReadingSkeleton label={t('migReading')} />}

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

      {(state.phase === 'review' || state.phase === 'running' || state.phase === 'busy' || state.phase === 'failed') && (
        <Report plan={state.plan} />
      )}

      {(state.phase === 'review' || state.phase === 'running' || state.phase === 'busy' || state.phase === 'failed') && (
        <Actions />
      )}
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
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="md:col-span-2" aria-labelledby="mig-found">
        <h2 id="mig-found" className="text-lg font-semibold">
          {t('migFoundTitle')}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
          {found.map((f) => (
            <div key={f.name} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
              <dt className="text-sm text-muted">{t(COLLECTION_LABEL[f.name] ?? 'colApp')}</dt>
              <dd className="lx-tnum text-base font-semibold">{num(f.total)}</dd>
            </div>
          ))}
        </dl>
        {plan.defaults.seedVocabNotInDb > 0 && <p className="mt-4 text-sm text-muted">{tn('migDefaultVocab', plan.defaults.seedVocabNotInDb)}</p>}
        {plan.defaults.topicsNotInDb > 0 && <p className="mt-1 text-sm text-muted">{tn('migDefaultTopics', plan.defaults.topicsNotInDb)}</p>}
      </Card>

      <Card aria-labelledby="mig-add">
        <h2 id="mig-add" className="flex items-center gap-2 text-lg font-semibold">
          <span className="text-accent-text">
            <Icon name="spark" />
          </span>
          {t('migAddTitle')}
        </h2>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted">
          {plan.fsrs.length > 0 && <li>{tn('migAddFsrs', plan.fsrs.length)}</li>}
          {plan.rescue.length > 0 && <li>{tn('migRescue', plan.rescue.length)}</li>}
          <li>{t('migAddSchema')}</li>
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
          {tagesauftrag > 0 && <li>{tn('migKeepDaily', tagesauftrag)}</li>}
        </ul>
      </Card>

      <Card className="md:col-span-2" aria-labelledby="mig-streak">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="mig-streak" className="text-lg font-semibold">
            {t('migStreakLabel')}
          </h2>
          <p className="lx-tnum flex items-center gap-3 text-2xl font-semibold" data-testid="mig-streak">
            <span>{tn('streakDays', plan.streak.before)}</span>
            <Icon name="arrowRight" className="text-subtle" />
            <span className={plan.streak.after >= plan.streak.before ? 'text-accent-text' : 'text-gold-text'}>
              {tn('streakDays', plan.streak.after)}
            </span>
          </p>
        </div>
      </Card>

      {plan.invalid.length > 0 && (
        <Card className="md:col-span-2" aria-labelledby="mig-invalid">
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
    </div>
  );
}

function Actions() {
  const { t, tn } = useT();
  const state = useMigration();
  const downloads = useCapabilities((s) => s.downloads);
  const [exporting, setExporting] = useState(false);

  if (state.phase !== 'review' && state.phase !== 'running' && state.phase !== 'busy' && state.phase !== 'failed') return null;
  const running = state.phase === 'running';

  const backup = async () => {
    setExporting(true);
    const outcome = await exportAll(state.snapshot);
    setExporting(false);
    toast(t(exportMessage[outcome]), outcome === 'saved' || outcome === 'declined' ? 'info' : 'error');
  };

  return (
    <div className="flex flex-col gap-4">
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
      {running && (
        <div className="flex flex-col gap-2" role="status">
          <Bar value={state.total ? state.done / state.total : 0} label={t('migProgress', { done: state.done, total: state.total })} />
          <p className="lx-tnum text-sm text-muted">{t('migProgress', { done: state.done, total: state.total })}</p>
        </div>
      )}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {downloads === 'ready' && (
          <Button icon="download" onClick={() => void backup()} busy={exporting} busyLabel={t('exportRunning')} disabled={running}>
            {t('migBackup')}
          </Button>
        )}
        {state.phase === 'failed' ? (
          <Button variant="primary" size="lg" icon="refresh" onClick={() => void state.dryRun()}>
            {t('migRetry')}
          </Button>
        ) : (
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => void state.run()} busy={running} busyLabel={t('migRunning')}>
            {t('migRun')}
          </Button>
        )}
      </div>
      <p className="text-xs text-subtle">{tn('migWrites', state.plan.writes)}</p>
    </div>
  );
}
