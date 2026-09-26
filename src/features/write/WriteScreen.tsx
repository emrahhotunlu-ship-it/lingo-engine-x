import { useEffect, useMemo, useRef, useState } from 'react';
import { useAsk } from '../../ai/useAsk';
import { useNav, type UnitCtx } from '../../app/nav';
import { promptFromDoc, promptToDoc, LEGACY_PROMPTS } from '../../domain/input/items';
import { pickPrompt } from '../../domain/input/select';
import type { WritingPrompt } from '../../domain/input/types';
import { normalizeWriting } from '../../domain/input/writingRecord';
import { hash32 } from '../../domain/random';
import { useT } from '../../i18n';
import { writingPrompt, WRITE_GENRES } from '../../prompts/writingPrompt';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';
import { toast } from '../../ui/Toast';
import { AiRunPanel } from '../input/AiRunPanel';
import { ensureDailyPrompt, replaceDailyPrompt } from '../input/complete';
import { ensureLibrary, useInputLibrary } from '../input/library';
import { UnitShell } from '../input/UnitShell';
import { useInputContext } from '../input/useInputContext';
import { nextT } from '../vocab/persist';
import { WriteUnit } from './WriteUnit';

// Schreiben (Kap. 6.8, Plan §4.3, F18, M12): eine Aufgabe je Lerntag in `wprompt/<tag>` –
// beim ersten Öffnen deterministisch aus dem Startbestand angelegt, stabil über Geräte.
// „Andere Aufgabe" und „Eigenes Thema" ersetzen sie, solange heute noch kein Text abgegeben ist.

type Doc = Readonly<Record<string, unknown>>;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function WriteScreen({ ctx }: { ctx: UnitCtx }) {
  const { t } = useT();
  const go = useNav((s) => s.go);
  const input = useInputContext();
  const status = useInputLibrary((s) => s.status);
  const writing = useInputLibrary((s) => s.docs.writing);
  const wprompt = useInputLibrary((s) => s.docs.wprompt);
  const gen = useAsk(writingPrompt);
  const [changing, setChanging] = useState(false);
  const ensured = useRef<string | null>(null);

  useEffect(() => {
    void ensureLibrary();
  }, []);

  const storedDoc = wprompt.get(input.day);
  const stored = useMemo(() => (storedDoc ? promptFromDoc(storedDoc.p) : null), [storedDoc]);

  const tasks = useMemo(() => [...writing.entries()].map(([id, d]) => normalizeWriting(id, d)).filter((w) => w.kind === 'task'), [writing]);
  const today = useMemo(() => tasks.filter((w) => w.date === input.day).sort((a, b) => b.t - a.t)[0] ?? null, [tasks, input.day]);

  // Die Aufgabe des Tages anlegen, falls es sie noch nicht gibt (einmal je Lerntag).
  const fallback = useMemo(() => {
    const usedAt = new Map<string, number>();
    for (const w of tasks) if (w.promptId) usedAt.set(w.promptId, Math.max(usedAt.get(w.promptId) ?? 0, w.t));
    return pickPrompt({ day: input.day, prompts: LEGACY_PROMPTS, usedAt, target: input.target, domain: input.domain });
  }, [tasks, input.day, input.target, input.domain]);
  useEffect(() => {
    if (status !== 'ready' || stored || !fallback || ensured.current === input.day) return;
    ensured.current = input.day;
    ensureDailyPrompt(input.day, promptToDoc(fallback)).catch(() => {
      ensured.current = null;
    });
  }, [status, stored, fallback, input.day]);

  if (status === 'idle' || status === 'loading') {
    return (
      <div className="flex flex-col gap-4 py-8" role="status" aria-label={t('inSkeleton')} data-testid="unit-skeleton">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-28 w-full max-w-2xl" />
        <Skeleton className="h-40 w-full max-w-2xl" />
      </div>
    );
  }
  if (status === 'error') {
    return (
      <UnitShell kind="write" ctx={ctx} state="error" title={t('ch_write')} onClose={() => go({ name: 'today' })}>
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-danger-text">{t('inLoadFailed')}</p>
          <Button icon="refresh" onClick={() => void ensureLibrary(true)}>
            {t('inReload')}
          </Button>
        </div>
      </UnitShell>
    );
  }

  // Die heutige Abgabe gehört zu ihrer Aufgabe; sonst die gespeicherte bzw. die berechnete.
  const prompt: WritingPrompt | null = today ? (LEGACY_PROMPTS.find((p) => p.id === today.promptId) ?? (stored?.id === today.promptId ? stored : null) ?? stored) : (stored ?? fallback);
  if (!prompt) return null;

  const replace = async (ownTopic: string) => {
    const genres = WRITE_GENRES;
    const genre = genres[hash32(`${input.day}|${nextT()}`) % genres.length] ?? 'email';
    const out = await gen.run({ level: input.target, domain: input.domain, genre, avoid: tasks.slice(0, 20).map((w) => w.title), context: input.context, ownTopic });
    if (!out) return;
    setChanging(true);
    try {
      const p: WritingPrompt = {
        id: `ai${nextT()}`,
        genre: out.genre,
        level: out.level,
        domain: input.domain,
        title: { de: out.title_de, en: out.title_en },
        task: { de: out.task_de, en: out.task_en },
        words: out.words,
        focus: { de: out.focus_de, en: out.focus_en },
        useful: out.useful,
        src: 'ai',
      };
      await replaceDailyPrompt(input.day, promptToDoc(p));
    } catch {
      toast(t('inSaveFailed'), 'error');
    } finally {
      setChanging(false);
    }
  };

  const todayDoc: Doc | undefined = today ? writing.get(today.id) : undefined;
  return (
    <WriteUnit
      key={today ? `done-${today.id}` : `p-${prompt.id}`}
      prompt={prompt}
      ctx={ctx}
      day={input.day}
      writingId={today?.id ?? null}
      rev={num(todayDoc?.rev)}
      changePrompt={
        today
          ? null
          : {
              busy: changing || gen.phase === 'queued' || gen.phase === 'thinking' || gen.phase === 'streaming' || gen.phase === 'slow',
              onOther: () => void replace(''),
              onOwn: (topic) => void replace(topic),
              panel: <AiRunPanel phase={gen.phase} error={gen.error} onStop={gen.stop} onRetry={() => void replace('')} skeleton={false} />,
            }
      }
    />
  );
}
