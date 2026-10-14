import { useRef, useState } from 'react';
import { AiRunPanel, Button, EnglishText, Icon, isBusy, useAiAvailable, useAiScope, useT } from '../sharedUi';
import type { AiMessageKey, AiPhase } from '../shared';
import { checkApplyWithClaude } from '../applyCheck';
import type { ReadApplyOut } from '../prompt';
import { checkApply } from '../domain/apply';
import type { ApplyProblem } from '../domain/apply';
import type { Lesson } from '../domain/lesson';
import type { WarmupItem } from '../domain/warmup';
import { warmupRight } from '../domain/warmup';
import { WARMUP_GAP } from '../domain/warmup';

// Bausteine einer Kurslektion (Paket L8): Ziel, Aufwärmen, Sprachtipp, Anwenden mit „Claude prüfen“, Fortschrittszeilen.
// Der Text, die Ansichten, das Antippen der Wörter und die Prüffragen kommen vom Leser (ReaderView); hier steht nur, was eine Lektion zusätzlich hat.

const CARD = 'lx-card flex flex-col gap-3 p-4';
const H2 = 'm-0 text-base font-semibold text-fg';

// ---------------------------------------------------------------- Ziel und Wendungen

export function GoalCard({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  return (
    <section className={CARD} aria-labelledby="lsn-goal-h" data-testid="lsn-goal">
      <div className="flex flex-col gap-1">
        <h2 id="lsn-goal-h" className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">
          {t('rdcGoalLabel')}
        </h2>
        <p className="m-0 text-base leading-6 text-fg" lang="de" data-testid="lsn-goal-text">
          {lesson.goal}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcPhrasesLabel')}</p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0" data-testid="lsn-phrases">
          {lesson.phrases.map((p) => (
            <li key={p.w} className="rounded-full bg-surface-strong px-3 py-1 text-sm text-fg" lang="en" data-testid="lsn-phrase">
              {p.w}
            </li>
          ))}
        </ul>
        <p className="m-0 text-xs text-muted">{t('rdcPhrasesHint')}</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- Aufwärmen

type WarmState = { value: string; checked: boolean; right: boolean };

export function WarmupCard({ items }: { items: readonly WarmupItem[] }) {
  const { t } = useT();
  const [open, setOpen] = useState(true);
  const [state, setState] = useState<Record<string, WarmState>>({});
  if (items.length === 0) return null;
  const set = (id: string, patch: Partial<WarmState>) => setState((s) => ({ ...s, [id]: { value: '', checked: false, right: false, ...s[id], ...patch } }));
  return (
    <section className={CARD} aria-labelledby="lsn-warm-h" data-testid="lsn-warmup">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 id="lsn-warm-h" className={H2}>
            {t('rdcWarmTitle')}
          </h2>
          <p className="m-0 text-xs text-muted">{t('rdcWarmHint')}</p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open} data-testid="lsn-warm-toggle" className="shrink-0">
          {open ? t('rdcWarmSkip') : t('rdcWarmShow')}
        </Button>
      </div>
      {open
        ? items.map((it, i) => {
            const st = state[it.id] ?? { value: '', checked: false, right: false };
            const parts = it.gap.split(WARMUP_GAP);
            return (
              <form
                key={it.id}
                className="flex flex-col gap-2"
                data-testid="lsn-warm-item"
                data-state={st.checked ? (st.right ? 'right' : 'wrong') : 'open'}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (st.checked || !st.value.trim()) return;
                  set(it.id, { checked: true, right: warmupRight(it, st.value) });
                }}
              >
                <p className="m-0 text-2xs uppercase tracking-wide text-subtle">{t('rdcWarmN', { n: i + 1 })}</p>
                <p className="m-0 text-base leading-7 text-fg" lang="en" data-testid="lsn-warm-gap">
                  {parts[0]}
                  <span className="mx-0.5 inline-block min-w-16 border-b-2 border-line-strong text-center align-baseline text-accent-text">{st.checked ? it.answer : ' '}</span>
                  {parts[1]}
                </p>
                {it.de ? <p className="m-0 text-xs text-muted">{t('rdcWarmMeaning', { de: it.de })}</p> : null}
                {st.checked ? (
                  <p className={`m-0 flex items-center gap-1.5 text-sm font-medium ${st.right ? 'text-ok-text' : 'text-wrong-text'}`} role="status" data-testid="lsn-warm-result">
                    <Icon name={st.right ? 'check' : 'close'} size={16} />
                    {st.right ? t('rdcWarmRight') : t('rdcWarmWrong', { answer: it.answer })}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      className="lx-field min-w-0 flex-1"
                      value={st.value}
                      onChange={(e) => set(it.id, { value: e.target.value })}
                      placeholder={t('rdcWarmPlaceholder')}
                      aria-label={t('rdcWarmN', { n: i + 1 })}
                      lang="en"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      data-testid="lsn-warm-input"
                    />
                    <Button type="submit" variant="secondary" data-testid="lsn-warm-check">
                      {t('rdcWarmCheck')}
                    </Button>
                  </div>
                )}
              </form>
            );
          })
        : null}
    </section>
  );
}

// ---------------------------------------------------------------- Sprachtipp

export function TipCard({ lesson }: { lesson: Lesson }) {
  const { t } = useT();
  const { wrong, right, why } = lesson.tip;
  return (
    <section className={CARD} aria-labelledby="lsn-tip-h" data-testid="lsn-tip">
      <h2 id="lsn-tip-h" className={H2}>
        {t('rdcTipTitle')}
      </h2>
      <dl className="m-0 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipWrong')}</dt>
          <dd className="m-0 flex items-start gap-1.5 text-wrong-text" data-testid="lsn-tip-wrong">
            <Icon name="close" size={16} className="mt-1 flex-none" />
            <span lang="en" className="line-through decoration-1">
              {wrong}
            </span>
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipRight')}</dt>
          <dd className="m-0 flex items-start gap-1.5 text-ok-text" data-testid="lsn-tip-right">
            <Icon name="check" size={16} className="mt-1 flex-none" />
            <EnglishText as="span" text={right} area="read" source={lesson.id} title={lesson.title} className="font-medium" />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcTipWhy')}</dt>
          <dd className="m-0 text-fg" lang="de" data-testid="lsn-tip-why">
            {why}
          </dd>
        </div>
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------- Anwenden

const PROBLEM_KEY: Record<ApplyProblem, 'rdcApplyEmpty' | 'rdcApplyShort' | 'rdcApplyNotEnglish' | 'rdcApplyLong'> = {
  empty: 'rdcApplyEmpty',
  tooShort: 'rdcApplyShort',
  notEnglish: 'rdcApplyNotEnglish',
  tooLong: 'rdcApplyLong',
};

type ClaudeState = { phase: AiPhase | 'idle'; error: AiMessageKey | null; data: ReadApplyOut | null };

export type ApplyCardProps = {
  lesson: Lesson;
  /** Der abgeschickte Text (aus dem Fortschritt) oder `null`. */
  submitted: string | null;
  /** Der Text wird abgeschickt (lokal geprüft, mindestens zwei Sätze). Darf asynchron speichern. */
  onSubmit: (text: string) => void;
};

export function ApplyCard({ lesson, submitted, onSubmit }: ApplyCardProps) {
  const { t, lang } = useT();
  const aiOn = useAiAvailable();
  const scope = useAiScope();
  const ctl = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState('');
  const [problem, setProblem] = useState<ApplyProblem | null>(null);
  const [claude, setClaude] = useState<ClaudeState>({ phase: 'idle', error: null, data: null });
  const sent = submitted !== null;
  const text = sent ? submitted : draft;
  const local = checkApply(text, lesson.apply.targets);

  const send = () => {
    const c = checkApply(draft, lesson.apply.targets);
    if (!c.ok) {
      setProblem(c.problem);
      return;
    }
    setProblem(null);
    onSubmit(draft.trim());
  };

  const runClaude = (retry = false) => {
    if (ctl.current || !sent) return;
    const c = scope.controller();
    ctl.current = c;
    setClaude({ phase: 'queued', error: null, data: null });
    void checkApplyWithClaude({ situation: lesson.apply.situation, targets: lesson.apply.targets, model: lesson.apply.model, text: submitted }, c.signal, (p) => setClaude((s) => (s.phase === 'idle' ? s : { ...s, phase: p })), retry).then((res) => {
      ctl.current = null;
      if (res.ok) setClaude({ phase: 'idle', error: null, data: res.data });
      else setClaude({ phase: 'idle', error: res.cancelled ? null : (res.key ?? 'aiFailed'), data: null });
    });
  };
  const stop = () => ctl.current?.abort();

  return (
    <section className={CARD} aria-labelledby="lsn-apply-h" data-testid="lsn-apply" data-sent={sent || undefined}>
      <div className="flex flex-col gap-1">
        <h2 id="lsn-apply-h" className={H2}>
          {t('rdcApplyTitle')}
        </h2>
        <p className="m-0 text-xs text-muted">{t('rdcApplyHint')}</p>
      </div>
      <p className="m-0 text-base leading-6 text-fg" lang="de" data-testid="lsn-apply-situation">
        {lesson.apply.situation}
      </p>
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-label={t('rdcApplyTargets')} data-testid="lsn-apply-targets">
        {lesson.apply.targets.map((w, i) => {
          const hit = sent && local.hits[i] === true;
          const miss = sent && local.hits[i] === false;
          return (
            <li key={w} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm ${hit ? 'bg-ok-soft text-fg' : miss ? 'bg-surface-strong text-muted' : 'bg-accent-soft text-accent-text'}`} lang="en" data-testid="lsn-apply-target" data-state={hit ? 'used' : miss ? 'missing' : undefined}>
              {hit ? <Icon name="check" size={14} /> : null}
              <span>{w}</span>
              {hit ? <span className="sr-only">{t('rdcApplyUsed')}</span> : miss ? <span className="sr-only">{t('rdcApplyMissing')}</span> : null}
            </li>
          );
        })}
      </ul>
      <textarea
        className="lx-field min-h-28 w-full resize-y text-base leading-6"
        value={text}
        readOnly={sent}
        maxLength={700}
        onChange={(e) => {
          setDraft(e.target.value);
          if (problem) setProblem(null);
        }}
        placeholder={t('rdcApplyPlaceholder')}
        aria-label={t('rdcApplyTitle')}
        lang="en"
        autoCapitalize="sentences"
        autoCorrect="off"
        spellCheck={false}
        data-testid="lsn-apply-input"
      />
      {problem ? (
        <p className="m-0 text-sm text-danger-text" role="alert" data-testid="lsn-apply-problem">
          {t(PROBLEM_KEY[problem])}
        </p>
      ) : null}
      {sent ? (
        <div className="flex flex-col gap-3" data-testid="lsn-apply-feedback">
          <p className="m-0 inline-flex items-center gap-1.5 text-sm font-medium text-ok-text" role="status">
            <Icon name="check" size={16} />
            {t('rdcApplySent')}
          </p>
          {local.hits.some((h) => !h) ? (
            <p className="m-0 text-sm text-muted" data-testid="lsn-apply-missing">
              {t('rdcApplyMissingList', { list: lesson.apply.targets.filter((_, i) => !local.hits[i]).join(' · ') })}
            </p>
          ) : (
            <p className="m-0 text-sm text-ok-text" data-testid="lsn-apply-allused">
              {t('rdcApplyAllUsed')}
            </p>
          )}
          <div className="flex flex-col gap-1.5 border-l-2 border-line-strong pl-3" data-testid="lsn-model">
            <p className="m-0 text-2xs font-semibold uppercase tracking-wide text-subtle">{t('rdcModelTitle')}</p>
            <EnglishText as="p" text={lesson.apply.model.join(' ')} area="read" source={lesson.id} title={lesson.title} className="m-0 text-base leading-7 text-fg" />
            <p className="m-0 text-xs text-muted">{t('rdcModelHint')}</p>
          </div>
          {aiOn ? (
            <div className="flex flex-col gap-2" data-testid="lsn-claude">
              {claude.data ? null : isBusy(claude.phase) ? null : (
                <div>
                  <Button variant="secondary" icon="sparkle" onClick={() => runClaude(false)} data-testid="lsn-claude-go" data-ai="">
                    {t('rdcClaude')}
                  </Button>
                </div>
              )}
              <AiRunPanel phase={claude.phase} error={claude.error} onStop={stop} onRetry={() => runClaude(true)} skeleton={false} />
              {claude.data ? <ClaudeReply data={claude.data} lang={lang} /> : null}
            </div>
          ) : (
            <p className="m-0 text-xs text-muted" data-testid="lsn-claude-off">
              {t('rdcClaudeOff')}
            </p>
          )}
        </div>
      ) : (
        <div>
          <Button variant="primary" onClick={send} data-testid="lsn-apply-send">
            {t('rdcApplySend')}
          </Button>
        </div>
      )}
    </section>
  );
}

function ClaudeReply({ data, lang }: { data: ReadApplyOut; lang: 'de' | 'en' }) {
  const { t } = useT();
  const verdict = data.verdict === 'right' ? t('rdcClaudeRight') : data.verdict === 'almost' ? t('rdcClaudeAlmost') : t('rdcClaudeWrong');
  return (
    <div className="flex flex-col gap-2 text-sm" role="status" data-testid="lsn-claude-reply" data-verdict={data.verdict} data-lang={lang}>
      <p className={`m-0 flex items-center gap-1.5 font-semibold ${data.verdict === 'right' ? 'text-ok-text' : 'text-fg'}`}>
        <Icon name={data.verdict === 'right' ? 'check' : 'sparkle'} size={16} />
        {verdict}
      </p>
      <p className="m-0 text-muted">
        <span className="font-semibold">{t('rdcClaudeFixed')}:</span> <span lang="en" data-testid="lsn-claude-fixed">{data.fixed}</span>
      </p>
      <p className="m-0 text-muted">
        <span className="font-semibold">{t('rdcClaudeC1')}:</span> <span lang="en" data-testid="lsn-claude-c1">{data.c1}</span>
      </p>
      <p className="m-0 text-fg">
        <span className="font-semibold">{t('rdcClaudeWhy')}:</span> <span lang="de" data-testid="lsn-claude-why">{data.why}</span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Stand der Lektion (Zustand, kein Knopf)

export type StepState = { read: boolean; questions: number; applied: boolean; done: boolean };

export function StepsCard({ steps, onToCourse, onNext }: { steps: StepState; onToCourse: () => void; onNext: (() => void) | null }) {
  const { t } = useT();
  const row = (ok: boolean, label: string, id: string) => (
    <li key={id} className={`flex items-center gap-2 text-sm ${ok ? 'text-ok-text' : 'text-muted'}`} data-testid="lsn-step" data-step={id} data-state={ok ? 'done' : 'open'}>
      {ok ? <Icon name="check" size={16} /> : <span aria-hidden="true" className="inline-block size-4 flex-none rounded-full border border-line-strong" />}
      <span>{label}</span>
    </li>
  );
  return (
    <section className={CARD} aria-labelledby="lsn-steps-h" data-testid="lsn-steps" data-done={steps.done || undefined}>
      <h2 id="lsn-steps-h" className={H2}>
        {steps.done ? t('rdcDoneTitle') : t('rdcStepsTitle')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {row(steps.read, t('rdcStepRead'), 'read')}
        {row(steps.questions >= 3, t('rdcStepQuestions', { n: Math.min(3, steps.questions) }), 'questions')}
        {row(steps.applied, t('rdcStepApply'), 'apply')}
      </ul>
      {steps.done ? (
        <div className="flex flex-col gap-2 [&>*]:w-full">
          <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext ?? onToCourse} data-testid="lsn-end" data-kind={onNext ? 'next' : 'course'}>
            {onNext ? t('rdcNextLesson') : t('rdcToCourse')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
