import { motion, useReducedMotion } from 'framer-motion';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useLive } from '../../data/live';
import { useSharedTarget } from '../../engine/shared';
import type { ExplainDepth, ExplanationModel, ResultVerdict } from '../../domain/explain/types';
import type { WordOp } from '../../domain/learn/types';
import type { UnitState } from '../../domain/metrics';
import { useT } from '../../i18n';
import { useMediaQuery, useSplitLayout } from '../../platform/input';
import { ActionBar, PrimaryAction } from '../ActionBar';
import { Button } from '../Button';
import { Icon } from '../Icon';
import { Skeleton } from '../Skeleton';
import { Comparison } from './Comparison';
import { ExerciseMenu } from './ExerciseMenu';
import { ExerciseStatus } from './ExerciseStatus';
import { Examples } from './Examples';
import { Explanation } from './Explanation';
import { HintLine } from './HintLine';
import { shouldAutoAdvance } from './autoAdvance';
import { visibleLines } from './explainDepth';
import { useAutoAdvance } from './useAutoAdvance';
import { Verdict } from './Verdict';

// Das eine Übungsgerüst (Lernplattform 2.0 §4.2). Es erzwingt Reihenfolge und Darstellung (`data-slot`):
// status · task · aid · prompt · answer · secondary · hint · verdict · comparison · explanation · examples · menu.
// Keine Übung baut Karte, Kopf, Urteil oder Erklärung selbst. Eine Glasebene je Übung; das Ergebnis ist ein
// Abschnitt DERSELBEN Karte (Linie oben), nie eine zweite Karte. Haptik, Ton und `role="status"` kommen
// nur aus `Verdict`.

export type ExerciseArea = 'words' | 'grammar';
export type ShellStatus = {
  area: ExerciseArea;
  /** `null` = keine Punkte (nie ein falsches „Neu“). */
  state: UnitState | null;
  kindLabel: string;
  topic?: string | null;
  pattern?: string | null;
  badge?: string | null;
};
export type ShellAction = { label: string; onClick: () => void; testId: string; disabled?: boolean; busy?: boolean; busyLabel?: string };
export type ShellSecondary = { id: 'hint' | 'dontKnow' | 'noError' | 'skip' | 'replay' | 'reset' | 'noSound'; label: string; onClick: () => void; testId: string; disabled?: boolean };
export type ShellMenuId = 'override' | 'copyOnce' | 'translate' | 'moreInfo' | 'askClaude' | 'wholeTopic';
export type ShellFeedback = {
  verdict: ResultVerdict;
  sub?: string | null;
  comparison?: { given: string; ops: WordOp[] } | null;
  explanation?: ExplanationModel | null;
  depth: ExplainDepth;
  menu?: Partial<Record<ShellMenuId, () => void>>;
  nextIn?: string | null;
  /**
   * Die Übung meldet: keine Hilfe genutzt. Zusammen mit Urteil `ok`, Tiefe `min` und `app/profile.autoNext`
   * ≠ false (`shouldAutoAdvance`) läuft dann der 4-s-Zeitgeber; ein Menü oder Aufklappbereich hält ihn an.
   */
  auto?: boolean;
};
export type ShellState = 'loading' | 'answering' | 'busy' | 'retry' | 'result' | 'aiError';
export type ExerciseShellProps = {
  meta: { ex: string; id: string; stage?: number; kind?: string };
  status: ShellStatus;
  task: { text: string; purpose: string };
  aid?: ReactNode | null;
  prompt: ReactNode;
  answer: ReactNode;
  hint?: { text: string; tone: 'hint' | 'near' } | null;
  secondary?: ShellSecondary[];
  primary: ShellAction;
  barOverride?: ReactNode;
  feedback?: ShellFeedback | null;
  side?: ReactNode | null;
  layout?: 'auto' | 'stack' | 'split';
  /** Skelett in Kartengröße statt Inhalt (nie ein Leerbild). */
  loading?: boolean;
  /** Optional: `retry` (Hinweis mit Leitfrage, Eingabe bleibt) und `aiError`; sonst aus `feedback`/`primary.busy` abgeleitet. */
  state?: ShellState;
};

export function deriveShellState(p: Pick<ExerciseShellProps, 'loading' | 'state' | 'feedback' | 'primary'>): ShellState {
  if (p.loading) return 'loading';
  if (p.state === 'aiError' || p.state === 'retry') return p.state;
  if (p.feedback) return 'result';
  if (p.primary.busy) return 'busy';
  return p.state ?? 'answering';
}

export function ExerciseShell(props: ExerciseShellProps) {
  const { meta, status, task, aid = null, prompt, answer, hint = null, secondary = [], primary, barOverride, feedback = null, side = null, layout = 'auto' } = props;
  const { t } = useT();
  const state = deriveShellState(props);
  const profileSplit = useSplitLayout();
  const split = layout === 'split' || (layout === 'auto' && profileSplit);
  const tablet = useMediaQuery('(min-width: 768px)');
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [folds, setFolds] = useState(0);
  const onFold = useCallback((open: boolean) => setFolds((n) => Math.max(0, n + (open ? 1 : -1))), []);
  const reduce = useReducedMotion();
  // Kap. 4.4: Die Heldenkarte von Heute gleitet in die erste Übung (nur direkt nach dem Start; Grammatik und Drills nehmen sie vorher selbst).
  const { ref: sharedRef, shared } = useSharedTarget<HTMLElement>('lx-hero');
  const autoPref = useLive((s) => s.docs['app/profile']?.autoNext);

  const resultKey = feedback ? `${meta.id}:${feedback.verdict}:${feedback.sub ?? ''}` : `${meta.id}:answering`;
  const auto = feedback
    ? shouldAutoAdvance({ verdict: feedback.verdict, hintLevel: feedback.auto ? 0 : 1, depth: feedback.depth, autoNextPref: autoPref as boolean | null | undefined, menuOpen, foldOpen: folds > 0 })
    : false;
  const { running, fire } = useAutoAdvance({ active: auto, onNext: primary.onClick, nextTestId: primary.testId, resetKey: resultKey });

  // Am Handy rollt das Urteil beim Erscheinen unter den Kopf.
  const resultRef = useRef<HTMLElement>(null);
  const hasResult = feedback !== null;
  useEffect(() => {
    if (!hasResult || split || tablet) return;
    resultRef.current?.scrollIntoView?.({ block: 'start', behavior: 'auto' });
  }, [hasResult, resultKey, split, tablet]);

  if (state === 'loading') {
    return (
      <article className="lx-glass lx-exercise flex flex-col gap-4" data-testid="exercise" data-area={status.area} data-state="loading" aria-busy="true" aria-label={t('exLoading')} data-ex={meta.ex} data-card={meta.id}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-14 w-full" />
      </article>
    );
  }

  const learning = status.state === 'new' || status.state === 'learning';
  const showSecondary = secondary.slice(0, 2);
  const secondaryNode =
    showSecondary.length > 0 && !feedback ? (
      <div className="flex flex-wrap items-center gap-x-2" data-slot="secondary" role="group" aria-label={t('exSecondaryLabel')}>
        {showSecondary.map((s) => (
          <Button key={s.id} variant="ghost" onClick={s.onClick} disabled={s.disabled} data-testid={s.testId} data-secondary={s.id}>
            {s.label}
          </Button>
        ))}
      </div>
    ) : null;
  const asideSecondary = tablet && secondaryNode;

  const depthLines = feedback?.explanation ? visibleLines(feedback.explanation, feedback.depth, { learning }) : null;
  const result =
    feedback !== null ? (
      <motion.section
        key={resultKey}
        ref={resultRef}
        className="lx-card relative flex scroll-mt-4 flex-col gap-3 overflow-hidden p-4"
        data-testid="result"
        aria-label={t('exExplanationLabel')}
        data-verdict={feedback.verdict}
        {...(reduce ? {} : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22 } })}
      >
        <div data-slot="verdict" className={`-mx-4 -mt-4 px-4 py-3.5 pr-14 ${feedback.verdict === 'ok' ? 'bg-ok-soft' : feedback.verdict === 'near' ? 'bg-near-soft' : feedback.verdict === 'wrong' ? 'bg-wrong-soft' : ''}`}>
          <Verdict verdict={feedback.verdict} sub={feedback.sub ?? null} />
          {feedback.nextIn && (
            <p className="lx-t-meta mt-0.5 text-muted" data-testid="next-in">
              {feedback.nextIn}
            </p>
          )}
        </div>
        {feedback.comparison && (
          <div data-slot="comparison">
            <Comparison given={feedback.comparison.given} ops={feedback.comparison.ops} />
          </div>
        )}
        {feedback.explanation && (
          <div data-slot="explanation">
            <Explanation model={feedback.explanation} depth={feedback.depth} learning={learning} onFoldChange={onFold} />
          </div>
        )}
        {feedback.explanation && feedback.explanation.examples.length > 0 && (
          <div data-slot="examples">
            <Examples items={feedback.explanation.examples} open={depthLines?.examplesOpen ?? 0} onFoldChange={onFold} />
          </div>
        )}
        {feedback.menu && Object.keys(feedback.menu).length > 0 && (
          <div className="absolute right-1 top-2">
            <ExerciseMenu items={feedback.menu} onOpenChange={setMenuOpen} />
          </div>
        )}
      </motion.section>
    ) : null;

  const errorNode =
    state === 'aiError' ? (
      <p className="lx-t-support rounded-[var(--radius-control)] bg-surface p-3 text-muted" role="alert" data-testid="ai-error" data-slot="hint">
        {t('exAiError')}
      </p>
    ) : null;

  const main = (
    <>
      <div data-slot="status">
        <ExerciseStatus {...status} />
      </div>
      <div data-slot="task" className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <h2 className="lx-t-task" data-testid="task">
            {task.text}
          </h2>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('exInfo')}
            aria-expanded={info}
            aria-controls={infoId}
            onClick={() => setInfo((v) => !v)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={infoId} className="lx-t-support text-muted" data-testid="purpose">
            {task.purpose}
          </p>
        )}
      </div>
      {aid && <div data-slot="aid">{aid}</div>}
      <div data-slot="prompt" className="lx-t-prompt">
        {prompt}
      </div>
      <div data-slot="answer">{answer}</div>
      {!asideSecondary && secondaryNode}
      {hint && state !== 'aiError' && (
        <div data-slot="hint" data-state={state === 'retry' ? 'retry' : undefined}>
          <HintLine text={hint.text} tone={hint.tone} />
        </div>
      )}
      {errorNode}
      {!split && result}
    </>
  );

  const bar = (
    <ActionBar stateKey={feedback ? 'next' : 'main'} placement={split ? 'column' : 'fixed'} aside={asideSecondary || undefined}>
      {barOverride ?? (
        <PrimaryAction
          onClick={feedback ? fire : primary.onClick}
          disabled={primary.disabled}
          busy={primary.busy}
          busyLabel={primary.busyLabel}
          iconAfter={feedback ? 'arrowRight' : undefined}
          testId={primary.testId}
          data-auto={running ? '' : undefined}
          className="overflow-hidden"
        >
          {primary.label}
          {running && <span className="lx-autonext" aria-hidden="true" data-testid="autonext" />}
        </PrimaryAction>
      )}
    </ActionBar>
  );

  return (
    <article
      ref={sharedRef}
      className="lx-glass lx-exercise flex flex-col gap-4 outline-none"
      tabIndex={-1}
      data-shared={shared ? '' : undefined}
      data-testid="exercise"
      data-area={status.area}
      data-state={state}
      data-ex={meta.ex}
      data-card={meta.id}
      data-stage={meta.stage}
      data-kind={meta.kind}
    >
      <div className="lx-split" data-split={split || undefined}>
        <div data-col="main" className="flex min-w-0 flex-col gap-4">
          {main}
          {split && bar}
        </div>
        {split && (
          <aside data-col="side" className="flex min-w-0 flex-col gap-4" aria-label={t('exSideLabel')}>
            {feedback ? result : (side ?? <p className="lx-t-support lx-inset text-muted" data-testid="side-placeholder">{t('exSidePlaceholder')}</p>)}
          </aside>
        )}
      </div>
      {split && (
        <p className="lx-t-meta text-subtle" data-testid="keys-hint">
          {t('exKeysHint')}
        </p>
      )}
      {!split && bar}
    </article>
  );
}
