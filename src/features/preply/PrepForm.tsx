import { useMemo, useState } from 'react';
import { useAiAvailable, useAiScope } from '../../ai/scope';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import { useLive } from '../../data/live';
import { LESSONS } from '../../domain/content';
import type { ImportView } from '../../domain/preply/docs';
import { useT } from '../../i18n';
import { logWarn } from '../../platform/diagnostics';
import type { PrepCtx } from '../../prompts/preplyPrep';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { createPlan } from './actions';
import { usePreply } from './store';

// „Stunde vorbereiten" (Phase 5 §8.3): Anlass wählen (freies Gespräch, aktuelle Lektion, eigenes
// Thema, letzter Import, „Zu: …" von überall – M18), Dauer, dann „Plan erstellen" (ein Aufruf).

type CtxChoice = 'free' | 'lesson' | 'topic' | 'import' | 'about';
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

export function PrepForm({ last, onCreated }: { last: ImportView | null; onCreated: (id: string) => void }) {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const scope = useAiScope();
  const course = useLive((s) => s.docs['app/course']);
  const pending = usePreply((s) => s.pendingTopic);
  const [choice, setChoice] = useState<CtxChoice>(pending ? 'about' : 'free');
  const [topic, setTopic] = useState('');
  const [minutes, setMinutes] = useState<25 | 50 | 60>(50);
  const [phase, setPhase] = useState<AiPhase | 'idle'>('idle');
  const [error, setError] = useState<AiMessageKey | null>(null);
  const [ctl, setCtl] = useState<AbortController | null>(null);

  // Neuer Anlass „Zu: …" (M18) wählt sich selbst vor (abgeleiteter Zustand, einmal je `seq`).
  const [seenSeq, setSeenSeq] = useState(pending?.seq ?? 0);
  if (pending && pending.seq !== seenSeq) {
    setSeenSeq(pending.seq);
    setChoice('about');
  }

  const lesson = useMemo(() => {
    const done = obj(obj(course).done);
    return LESSONS.find((l) => !done[l.id]) ?? null;
  }, [course]);

  const options: Array<{ id: CtxChoice; label: string }> = [
    ...(pending ? [{ id: 'about' as const, label: t('ppCtxAbout', { title: pending.title }) }] : []),
    { id: 'free', label: t('ppCtxFree') },
    ...(lesson ? [{ id: 'lesson' as const, label: t('ppCtxLesson', { title: lang === 'de' ? lesson.de : lesson.en }) }] : []),
    { id: 'topic', label: t('ppCtxTopic') },
    ...(last ? [{ id: 'import' as const, label: t('ppCtxImport', { title: last.title || t('ppImportUntitled') }) }] : []),
  ];

  const ctxOf = (): PrepCtx => {
    if (choice === 'about' && pending) return { kind: 'topic', title: pending.title };
    if (choice === 'lesson' && lesson) return { kind: 'lesson', title: lesson.en, topic: lesson.grammar };
    if (choice === 'topic') return { kind: 'topic', title: topic.trim() };
    if (choice === 'import' && last) return { kind: 'import', title: last.title };
    return { kind: 'free' };
  };

  const busy = phase === 'queued' || phase === 'thinking' || phase === 'streaming' || phase === 'slow';
  const canCreate = ai && !busy && (choice !== 'topic' || topic.trim().length > 1);

  const create = async () => {
    const c = scope.controller();
    setCtl(c);
    setError(null);
    setPhase('queued');
    try {
      const id = await createPlan({ ctx: ctxOf(), minutes, signal: c.signal, onPhase: (p) => setPhase(p) });
      setPhase('idle');
      usePreply.setState({ pendingTopic: null });
      onCreated(id);
    } catch (err) {
      setPhase('idle');
      if (isAiFailure(err) && err.kind === 'cancelled') return;
      if (!isAiFailure(err)) logWarn('preply:create', err);
      setError(isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed');
    } finally {
      setCtl(null);
    }
  };

  if (busy) {
    return (
      <Card channel="speak" className="flex flex-col gap-4" aria-busy="true">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted" role="status" data-testid="ai-phase" data-ai-phase={phase}>
            {phase === 'slow' ? t('aiSlow') : phase === 'queued' ? t('aiQueued') : t('aiThinking')}
          </p>
          {phase === 'slow' && (
            <Button variant="ghost" onClick={() => ctl?.abort()} data-testid="ai-stop">
              {t('aiStop')}
            </Button>
          )}
        </div>
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </Card>
    );
  }

  return (
    <Card channel="speak" className="flex flex-col gap-5" data-testid="pp-prep">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" id="pp-ctx-label">
          {t('ppCtxLabel')}
        </p>
        <div role="radiogroup" aria-labelledby="pp-ctx-label" className="flex flex-wrap gap-2" data-testid="pp-ctx">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={choice === o.id}
              onClick={() => setChoice(o.id)}
              className={`inline-flex min-h-11 max-w-full items-center rounded-2xl border px-4 py-2 text-left text-sm break-words ${choice === o.id ? 'border-transparent bg-accent-soft font-semibold text-accent-text' : 'border-line text-fg hover:bg-surface'}`}
              data-value={o.id}
            >
              <span className="min-w-0">{o.label}</span>
            </button>
          ))}
        </div>
        {choice === 'topic' && (
          <input
            type="text"
            value={topic}
            maxLength={120}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t('ppTopicPlaceholder')}
            aria-label={t('ppCtxTopic')}
            className="min-h-11 rounded-xl border border-line bg-surface-solid px-3 text-base outline-none focus:border-[var(--lx-fg-subtle)]"
            data-testid="pp-topic"
          />
        )}
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold" id="pp-min-label">
          {t('ppHowLong')}
        </p>
        <div role="radiogroup" aria-labelledby="pp-min-label" className="flex gap-2" data-testid="pp-minutes">
          {([25, 50, 60] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={minutes === m}
              onClick={() => setMinutes(m)}
              className={`min-h-11 flex-1 rounded-xl border text-sm ${minutes === m ? 'border-transparent bg-accent-soft font-semibold text-accent-text' : 'border-line hover:bg-surface'}`}
              data-value={m}
            >
              {t('ppMin', { n: m })}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p className="text-sm text-danger-text" role="alert" data-testid="ai-error">
          {t(error)}
        </p>
      )}
      {ai ? (
        <div>
          <Button variant="primary" size="lg" icon="sparkle" onClick={() => void create()} disabled={!canCreate} data-testid="pp-create" data-ai="">
            {error ? t('aiRetry') : t('ppCreate')}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t('aiUnavailable')}</p>
      )}
    </Card>
  );
}
