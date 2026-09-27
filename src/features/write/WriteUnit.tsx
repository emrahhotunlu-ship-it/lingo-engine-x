import { useMachine } from '@xstate/react';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useNav, type UnitCtx } from '../../app/nav';
import { useSettings } from '../../app/settings';
import { TOPICS } from '../../domain/content';
import { usedChunks } from '../../domain/input/chunkMatch';
import { processReview } from '../../domain/input/review';
import { wordCount } from '../../domain/input/textStats';
import type { WritingPrompt } from '../../domain/input/types';
import { normalizeWriting } from '../../domain/input/writingRecord';
import { EnglishText } from '../../engine/EnglishText';
import { useT } from '../../i18n';
import { writingReview } from '../../prompts/writingReview';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useActiveClock } from '../input/activeClock';
import { AiRunPanel } from '../input/AiRunPanel';
import { markTaskSeen, startAiTask, stopAiTask, useAiTasks } from '../input/aiTasks';
import { reviseWriting, saveWritingReview, submitWriting } from '../input/complete';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea, type DraftHandle } from '../input/DraftArea';
import { useInputLibrary } from '../input/library';
import { StatusLine } from '../input/StatusLine';
import { UnitShell } from '../input/UnitShell';
import { writeMachine } from './machine';
import { PromptCard } from './PromptCard';
import { ReviewView } from './ReviewView';
import { repairsFromWriting } from '../../domain/repair/sources';
import { RepairStep } from '../repair/RepairStep';
import { saveRepairs } from '../repair/store';

// Eine Schreib-Einheit (Plan §4.3): Aufgabe → eigener Text (Wendungs-Chips haken sich ab und
// fügen sich per Tipp ein, M12) → Abgeben (erledigt, F6) → Korrektur als App-Aufgabe (M14) →
// freiwillig überarbeiten. Ohne KI: gespeichert, Selbstkontrolle statt Urteil.

type Props = {
  prompt: WritingPrompt;
  ctx: UnitCtx;
  day: string;
  writingId: string | null;
  rev: number;
  changePrompt: { busy: boolean; onOther: () => void; onOwn: (topic: string) => void; panel: ReactNode } | null;
};

const TOPIC_IDS = TOPICS.map((tp) => tp.id);

/** Korrektur als App-Aufgabe starten (auf Abgeben/Prüfen hin, nie automatisch). */
function startReview(id: string, text: string, rev: number, prompt: WritingPrompt, ctx: UnitCtx): void {
  const uiLang = useSettings.getState().lang;
  void startAiTask({
    key: `write:${id}`,
    kind: 'write',
    route: { name: 'write', ctx },
    template: writingReview,
    vars: {
      title_en: prompt.title.en,
      task_en: prompt.task.en,
      genre: prompt.genre,
      level: prompt.level,
      words: prompt.words,
      focus_en: prompt.focus.en ?? '',
      useful: prompt.useful,
      text,
      uiLang,
      topics: TOPIC_IDS,
    },
    save: async (data) => {
      const res = processReview(data, text);
      await saveWritingReview(id, res, uiLang, rev, text);
      // Lernberatung V2: echte Fehler aus dem eigenen Text werden Reparatur-Sätze.
      const repairs = repairsFromWriting(text, res.errors, prompt.title.en);
      if (repairs.length) await saveRepairs(repairs);
    },
  });
}

export function WriteUnit({ prompt, ctx, day, writingId, rev, changePrompt }: Props) {
  const { t, lang } = useT();
  const back = useNav((s) => s.back);
  const ai = useAiAvailable();
  const clock = useActiveClock();
  const draftKey = `write:${prompt.id}`;
  const [text, setText] = useState(() => loadDraft(draftKey));
  const draft = useRef<DraftHandle>(null);
  const live = useRef({ prompt, day, ctx, ai });
  useEffect(() => {
    live.current = { prompt, day, ctx, ai };
  }, [prompt, day, ctx, ai]);

  const submit = useCallback(
    async (body: string) => {
      const l = live.current;
      const id = await submitWriting({ day: l.day, prompt: l.prompt, text: body, words: wordCount(body), lang: useSettings.getState().lang, activeMs: clock.ms() });
      clearDraft(`write:${l.prompt.id}`);
      if (l.ai) startReview(id, body, 0, l.prompt, l.ctx);
      return id;
    },
    [clock],
  );
  const revise = useCallback(async (id: string, body: string) => {
    const l = live.current;
    const next = await reviseWriting(id, body, wordCount(body));
    clearDraft(`write:rev:${id}`);
    if (l.ai) startReview(id, body, next, l.prompt, l.ctx);
    return next;
  }, []);

  const [state, send] = useMachine(writeMachine, { input: { start: writingId ? 'submitted' : 'drafting', writingId, rev, submit, revise } });
  const stateName = typeof state.value === 'string' ? state.value : 'drafting';
  const id = state.context.writingId;
  const doc = useInputLibrary((s) => (id ? s.docs.writing.get(id) : undefined));
  const view = useMemo(() => (id && doc ? normalizeWriting(id, doc) : null), [id, doc]);
  const task = useAiTasks((s) => (id ? s.tasks[`write:${id}`] : undefined));
  const [revText, setRevText] = useState('');

  useEffect(() => {
    if (task && task.status !== 'running' && stateName === 'submitted') markTaskSeen(task.key);
  }, [task, stateName]);

  const [min, max] = prompt.words;
  const n = wordCount(stateName === 'revising' ? revText : text);
  const minSubmit = Math.ceil(min * 0.6);
  const used = usedChunks(stateName === 'revising' ? revText : text, prompt.useful);
  const close = () => back();
  const status = <StatusLine channel="write" level={prompt.level} domain={prompt.domain} minutes={15} />;

  const chips = (
    <div className="flex flex-col gap-2">
      <p className="lx-eyebrow">{t('wrUseful')}</p>
      <ul className="flex flex-wrap gap-2">
        {prompt.useful.map((u, i) => (
          <li key={u} className={`inline-flex min-h-11 items-center gap-0.5 rounded-full pl-3 text-sm transition-colors ${used[i] ? 'bg-accent-soft text-accent-text' : 'bg-surface text-fg'}`}>
            {/* Wörter antippbar (A7), Einfügen über den eigenen Knopf daneben. */}
            {used[i] && <Icon name="check" size={14} className="mr-1" />}
            <EnglishText as="span" text={u} area="write" source={null} title={prompt.title.en} />
            <button
              type="button"
              onClick={() => draft.current?.insert(u)}
              aria-label={t('wrInsert', { p: u })}
              title={t('wrInsert', { p: u })}
              data-testid="useful-chip"
              data-used={String(!!used[i])}
              className="inline-flex size-11 flex-none items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-fg"
            >
              <Icon name="plus" size={16} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  let body: ReactNode;
  let task_: string | undefined = t('wrTask');
  if (stateName === 'drafting' || stateName === 'submitting') {
    body = (
      <div className="flex max-w-3xl flex-col gap-5">
        <PromptCard prompt={prompt} canChange={!!changePrompt} busy={!!changePrompt?.busy} onOther={() => changePrompt?.onOther()} onOwn={(tp) => changePrompt?.onOwn(tp)} />
        {changePrompt?.panel}
        {prompt.useful.length > 0 && chips}
        <DraftArea value={text} onChange={setText} label={t('wrDraftLabel')} draftKey={draftKey} min={min} max={max} handle={draft} disabled={stateName === 'submitting'} />
        {state.context.failed && (
          <p className="text-sm text-danger-text" role="alert">
            {t('inSaveFailed')}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary" size="lg" iconAfter="arrowRight" disabled={n < minSubmit} busy={stateName === 'submitting'} onClick={() => send({ type: 'SUBMIT', text: text.trim() })} data-testid="submit">
            {t('wrSubmit')}
          </Button>
          {n < minSubmit && <p className="text-xs text-muted">{t('wrSubmitHint', { n: minSubmit })}</p>}
        </div>
      </div>
    );
  } else if (stateName === 'revising' || stateName === 'resubmitting') {
    body = (
      <div className="flex max-w-3xl flex-col gap-5">
        {/* Beim Überarbeiten bleibt die Aufgabenstellung sichtbar (nicht mehr wechselbar). */}
        <PromptCard prompt={prompt} canChange={false} busy={false} onOther={() => undefined} onOwn={() => undefined} />
        {prompt.useful.length > 0 && chips}
        <DraftArea value={revText} onChange={setRevText} label={t('wrDraftLabel')} draftKey={`write:rev:${id ?? ''}`} min={min} max={max} handle={draft} disabled={stateName === 'resubmitting'} />
        {state.context.failed && (
          <p className="text-sm text-danger-text" role="alert">
            {t('inSaveFailed')}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" iconAfter="arrowRight" disabled={n < minSubmit} busy={stateName === 'resubmitting'} onClick={() => send({ type: 'RESUBMIT', text: revText.trim() })} data-testid="resubmit">
            {ai ? t('wrResubmit') : t('wrSubmit')}
          </Button>
          <Button variant="ghost" onClick={() => send({ type: 'CANCEL' })}>
            {t('inBack')}
          </Button>
        </div>
      </div>
    );
  } else {
    task_ = undefined;
    const res = view?.res ?? null;
    const resRev = doc?.res && typeof doc.res === 'object' ? (doc.res as Record<string, unknown>).rev : undefined;
    const stale = typeof resRev === 'number' && view ? resRev !== view.rev : false;
    const running = task?.status === 'running';
    const wordsNow = view?.words ?? 0;
    const usedNow = view ? usedChunks(view.text, prompt.useful).filter(Boolean).length : 0;
    body = (
      <div className="flex max-w-3xl flex-col gap-5" data-testid="write-result">
        <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
          <p className="lx-eyebrow text-accent-text">{t('inDoneToday')}</p>
          <p className="text-lg font-semibold">{prompt.title[lang]}</p>
          {view && (
            <p className="lx-tnum text-sm text-muted">
              {t('wrWords', { n: view.words, min, max })}
              {view.rev > 0 ? ` · ${t('wrRev', { n: view.rev + 1 })}` : ''}
            </p>
          )}
        </div>
        {running && <AiRunPanel phase={task.phase} error={null} onStop={() => stopAiTask(task.key)} note={t('inAiBackground')} />}
        {task?.status === 'error' && view && <AiRunPanel phase="error" error={task.error} onRetry={() => startReview(view.id, view.text, view.rev, prompt, ctx)} />}
        {res && view && (
          <ReviewView res={res} text={view.text} area="write" sourceRef={`writing/${view.id}`} title={prompt.title.en} stale={stale} onRecheck={ai ? () => startReview(view.id, view.text, view.rev, prompt, ctx) : null} />
        )}
        {res && view && !stale && !running && (
          <RepairStep key={`${view.id}-${view.rev}`} candidates={repairsFromWriting(view.text, res.errors, prompt.title.en)} area="write" source={`writing/${view.id}`} />
        )}
        {!res && !running && view && (
          <div className="flex flex-col gap-3" data-testid="no-review">
            {ai ? (
              task?.status !== 'error' && (
                <div>
                  <Button onClick={() => startReview(view.id, view.text, view.rev, prompt, ctx)} data-testid="review-start" data-ai="">
                    {t('inCheck')}
                  </Button>
                </div>
              )
            ) : (
              <p className="text-sm text-muted" data-testid="saved-no-check">
                {t('inSavedNoCheck')}
              </p>
            )}
            <div className="flex flex-col gap-1" data-testid="checklist">
              <p className="lx-eyebrow">{t('wrChecklist')}</p>
              <p className="text-sm">{wordsNow >= min ? `✓ ${t('wrLengthOk')}` : `· ${t('wrLengthShort')}`}</p>
              {prompt.useful.length > 0 && <p className="text-sm">{t('wrChunksUsed', { used: usedNow, n: prompt.useful.length })}</p>}
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {view && !running && (
            <Button
              icon="refresh"
              onClick={() => {
                setRevText(view.text);
                send({ type: 'REVISE' });
              }}
              data-testid="revise"
            >
              {t('wrRevise')}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <UnitShell kind="write" ctx={ctx} state={stateName} title={t('ch_write')} seeDetail={`${prompt.title.en}\n${prompt.task.en}`} onClose={close} status={status} task={task_} purpose={t('wrPurpose')}>
      {body}
    </UnitShell>
  );
}
