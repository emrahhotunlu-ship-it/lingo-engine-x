import { useEffect, useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useSettings } from '../../app/settings';
import type { UnitCtx } from '../../app/nav';
import { TOPICS } from '../../domain/content';
import { usedChunks } from '../../domain/text/chunkMatch';
import { processErrors } from '../../domain/input/review';
import { wordCount } from '../../domain/text/textStats';
import type { FeedItem } from '../../domain/input/types';
import { EnglishText } from '../../engine/EnglishText';
import { MarkedText } from '../../engine/MarkedText';
import { useT } from '../../i18n';
import { KEY_PREFIX, local } from '../../platform/storage';
import { speak, unlockSpeech, useSpeech } from '../../platform/speech';
import { applyCheck, type ApplyCheckOut } from '../../prompts/applyCheck';
import { Button, IconButton } from '../../ui/Button';
import { ExternalLink } from '../../ui/ExternalLink';
import { Icon } from '../../ui/Icon';
import { AiRunPanel } from '../../ui/AiRunPanel';
import { markTaskSeen, startAiTask, stopAiTask, useAiTasks } from '../../app/shell/aiTasks';
import { ChunkList } from '../input/ChunkList';
import { addRadar } from '../input/complete';
import { clearDraft, loadDraft } from '../input/draft';
import { DraftArea, type DraftHandle } from '../input/DraftArea';

// Die vier Schritte eines Beitrags (Kap. 6.9, Plan §4.4): Vorbereiten (Kernwendungen),
// Aufnehmen (Zusammenfassung, Zitat mit Quelle und Link bzw. Hörhilfe), Anwenden (eigener Text,
// Wendungen haken sich ab) und das Ergebnis mit optionaler Prüfung (App-Aufgabe, M14).

const SENT = (id: string) => `${KEY_PREFIX}disc-sent:${id}`;

/** Der abgegebene Text bleibt nur in diesem Browser sichtbar (kein eigenes Dokument, Plan §3.1). */
export function saveSent(itemId: string, text: string): void {
  local.set(SENT(itemId), text);
}
export function loadSent(itemId: string): string {
  return local.get(SENT(itemId)) ?? '';
}

export function PrepStep({ item, sourceRef, onNext }: { item: FeedItem; sourceRef: string; onNext: () => void }) {
  const { t, lang } = useT();
  const rows = item.chunks.map((c) => ({ en: c.en, de: c.de, note: lang === 'de' ? c.note_de : c.note_en }));
  return (
    <>
      {rows.length > 0 && (
        <section className="flex flex-col gap-2">
          <p className="lx-eyebrow">{t('dcChunks')}</p>
          <ChunkList rows={rows} sourceText={item.gist} area="discover" sourceRef={sourceRef} title={item.title} saveAll />
        </section>
      )}
      <div>
        <Button variant="primary" iconAfter="arrowRight" onClick={onNext} data-testid="next">
          {t('inNext')}
        </Button>
      </div>
    </>
  );
}

export function TakeStep({ item, sourceRef, onNext }: { item: FeedItem; sourceRef: string; onNext: () => void }) {
  const { t, lang } = useT();
  const speech = useSpeech((s) => s.status);
  const guide = item.guide[lang] ?? [];
  return (
    <>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="lx-eyebrow">{t('dcSummary')}</p>
          {speech === 'ready' && (
            <IconButton
              icon="speaker"
              label={t('inSpeak')}
              onClick={() => {
                unlockSpeech();
                void speak(item.gist);
              }}
            />
          )}
        </div>
        <EnglishText text={item.gist} area="discover" source={sourceRef} title={item.title} className="max-w-[68ch] text-base leading-relaxed" testId="gist" />
      </section>
      {item.kind === 'article' && item.excerpt && (
        <figure className="flex flex-col gap-1 border-l-2 border-[var(--lx-ch-discover)] pl-4" data-testid="excerpt">
          <blockquote lang="en" className="text-base italic">
            {item.excerpt}
          </blockquote>
          {item.excerptBy && <figcaption className="text-sm text-muted">— {item.excerptBy}</figcaption>}
        </figure>
      )}
      {item.kind !== 'article' && guide.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="guide">
          <p className="lx-eyebrow">{t('dcGuide')}</p>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
            {guide.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
        </section>
      )}
      <ExternalLink href={item.url}>
        {t('dcOpen')}
        {item.source ? ` · ${item.source}` : ''}
      </ExternalLink>
      <div>
        <Button variant="primary" iconAfter="arrowRight" onClick={onNext} data-testid="next">
          {t('inNext')}
        </Button>
      </div>
    </>
  );
}

export function UseStep({ item, busy, failed, onSubmit, onRetry }: { item: FeedItem; busy: boolean; failed: boolean; onSubmit: (text: string) => void; onRetry: () => void }) {
  const { t, tn, lang } = useT();
  const draftKey = `discover:${item.itemId}`;
  const [text, setText] = useState(() => loadDraft(draftKey));
  const [handle, setHandle] = useState<DraftHandle | null>(null);
  const used = useMemo(() => usedChunks(text, item.taskChunks), [text, item.taskChunks]);
  const n = wordCount(text);
  const task = item.task[lang] ?? t('dcTaskFallback');
  return (
    <>
      <p className="text-base" lang={lang} data-testid="use-task">
        {task}
      </p>
      {item.taskChunks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="lx-tnum text-xs font-medium text-muted">{t('dcUseChunks', { used: used.filter(Boolean).length, n: item.taskChunks.length })}</p>
          <ul className="flex flex-wrap gap-2">
            {item.taskChunks.map((c, i) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => handle?.insert(c)}
                  aria-label={t('wrInsert', { p: c })}
                  data-testid="task-chunk"
                  data-used={String(!!used[i])}
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm ${used[i] ? 'bg-accent-soft text-accent-text' : 'bg-surface text-fg hover:bg-surface-strong'}`}
                  lang="en"
                >
                  {used[i] && <Icon name="check" size={14} />}
                  {c}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <DraftArea value={text} onChange={setText} label={t('wrDraftLabel')} draftKey={draftKey} rows={6} disabled={busy} handle={setHandle} />
      {failed && (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-danger-text">{t('inSaveFailed')}</p>
          <Button icon="refresh" onClick={onRetry}>
            {t('aiRetry')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          iconAfter="arrowRight"
          disabled={n < 20}
          busy={busy}
          onClick={() => {
            clearDraft(draftKey);
            onSubmit(text.trim());
          }}
          data-testid="submit"
        >
          {t('dcSubmit')}
        </Button>
        {n < 20 && <p className="text-xs text-muted">{t('dcMinWords')}</p>}
        <span className="sr-only">{tn('inWords', n)}</span>
      </div>
    </>
  );
}

const TOPIC_IDS = TOPICS.map((tp) => tp.id);

export function DoneStep({ item, sourceRef, sent, ctx }: { item: FeedItem; sourceRef: string; sent: string; ctx: UnitCtx }) {
  const { t } = useT();
  const ai = useAiAvailable();
  const key = `discover:${item.itemId}`;
  const task = useAiTasks((s) => s.tasks[key]);
  useEffect(() => {
    if (task && task.status !== 'running') markTaskSeen(key);
  }, [task, key]);

  const check = () => {
    const uiLang = useSettings.getState().lang;
    void startAiTask({
      key,
      kind: 'discover',
      route: { name: 'discoverItem', feedId: item.feedId, itemId: item.itemId, ctx },
      template: applyCheck,
      vars: { task_en: item.task.en ?? '', chunks: item.taskChunks, gist: item.gist, text: sent, uiLang, topics: TOPIC_IDS },
      save: async (data) => {
        const { errors } = processErrors(data.errors.map((e) => ({ ...e, sev: 'minor' as const })), sent);
        await addRadar(errors, sent, 'w');
      },
    });
  };
  const result = task?.status === 'done' ? (task.data as ApplyCheckOut | undefined) : undefined;

  return (
    <section className="flex flex-col gap-4" data-testid="discover-done">
      <div className="lx-glass flex flex-col gap-1 rounded-[var(--radius-card)] p-5" data-testid="unit-done" data-state="done">
        <p className="lx-eyebrow text-accent-text">{t('dcItemDone')}</p>
      </div>
      {sent && (
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('wrDraftLabel')}</p>
          {result ? <ApplyResult out={result} text={sent} sourceRef={sourceRef} title={item.title} /> : <EnglishText text={sent} area="discover" source={sourceRef} title={item.title} className="text-base" />}
        </div>
      )}
      {task?.status === 'running' && <AiRunPanel phase={task.phase} error={null} onStop={() => stopAiTask(key)} note={t('inAiBackground')} />}
      {task?.status === 'error' && <AiRunPanel phase="error" error={task.error} onRetry={check} />}
      {sent && ai && !task && (
        <div>
          <Button onClick={check} data-testid="apply-check" data-ai="">
            {t('inCheck')}
          </Button>
        </div>
      )}
    </section>
  );
}

function ApplyResult({ out, text, sourceRef, title }: { out: ApplyCheckOut; text: string; sourceRef: string; title: string }) {
  const { t, lang } = useT();
  const [active, setActive] = useState<number | null>(null);
  const { errors } = useMemo(() => processErrors(out.errors.map((e) => ({ ...e, sev: 'minor' as const })), text), [out.errors, text]);
  const act = active !== null ? errors[active] : undefined;
  return (
    <div className="flex flex-col gap-3" data-testid="apply-result" data-verdict={out.verdict}>
      <p className="text-lg font-semibold">{t(`dcVerdict_${out.verdict}`)}</p>
      <MarkedText
        text={text}
        marks={errors.flatMap((e, i) => (e.span ? [{ i, span: e.span, sev: e.sev }] : []))}
        active={active}
        onMark={(i) => setActive(active === i ? null : i)}
        area="discover"
        source={sourceRef}
        title={title}
        label={(i) => `${errors[i]?.orig ?? ''} → ${errors[i]?.fix ?? ''}`}
        className="text-base"
      />
      {act && (
        <div className="rounded-xl bg-surface-strong px-3 py-2 text-sm" data-testid="error-detail">
          <p>
            <span className="text-muted">{t('wrYouWrote')}: </span>
            <span lang="en" className="lx-diff-off">
              {act.orig}
            </span>
          </p>
          <p>
            <span className="text-muted">{t('wrBetter')}: </span>
            <span lang="en" className="font-medium text-accent-text">
              {act.fix}
            </span>
          </p>
          {act.why && <p className="text-muted">{act.why}</p>}
        </div>
      )}
      {out.chunks.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {out.chunks.map((c) => (
            <li key={c.chunk} className="flex items-start gap-2">
              <span className={c.used && c.natural ? 'text-accent-text' : 'text-subtle'} aria-hidden="true">
                <Icon name="check" size={16} />
              </span>
              <span>
                <span lang="en" className="font-medium">
                  {c.chunk}
                </span>
                <span className="text-muted" lang={lang}>
                  {' '}
                  – {c.note}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {out.improved && (
        <div className="flex flex-col gap-1">
          <p className="lx-eyebrow">{t('wrImproved')}</p>
          <EnglishText text={out.improved} area="discover" source={sourceRef} title={title} className="text-base" />
        </div>
      )}
      {out.tip && <p className="text-sm">{out.tip}</p>}
    </div>
  );
}
