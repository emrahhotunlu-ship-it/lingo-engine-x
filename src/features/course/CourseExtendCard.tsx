import { useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useAsk } from '../../ai/useAsk';
import { useT } from '../../i18n';
import { courseExtend } from '../../prompts/courseExtend';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { Skeleton } from '../../ui/Skeleton';
import { extendVars, saveExtension, useExtensionState } from './extendCourse';

// „Kurs erweitern“ (Kap. 6.2): Sind alle Lektionen erledigt, steht das Angebot deutlich am Ende
// des Kurses; vorher ruhig „auf Wunsch“. Nur solange keine erweiterte Lektion offen ist. Während
// der Anfrage: „Denkt nach …“, Skelett und Stopp (A6.2); Fehler → „Erneut versuchen“ (A6.3).

export function CourseExtendCard() {
  const { t, lang } = useT();
  const ai = useAiAvailable();
  const { allowed, allDone } = useExtensionState();
  const ask = useAsk(courseExtend);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done' | 'failed'>('idle');
  const [unit, setUnit] = useState(0);
  const running = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow' || saved === 'saving';

  if (saved === 'done') {
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-sm" data-testid="course-extend-done">
        <Icon name="check" size={18} className="flex-none text-accent-text" />
        {t('ceCreated', { unit })}
      </p>
    );
  }
  if (!allowed || !ai) return null;

  const submit = async () => {
    setSaved('idle');
    const vars = await extendVars();
    const out = await ask.run(vars);
    if (!out) return;
    setSaved('saving');
    const created = await saveExtension(out, vars, lang);
    setUnit(vars.unitN);
    setSaved(created.length ? 'done' : 'failed');
  };

  return (
    <section
      className={`flex flex-col gap-3 rounded-[var(--radius-card)] px-4 py-4 ${allDone ? 'lx-glass ring-1 ring-accent' : 'border border-line'}`}
      data-testid="course-extend"
      data-all-done={allDone || undefined}
      aria-labelledby="course-extend-title"
    >
      <h2 id="course-extend-title" className="flex items-center gap-2 text-base font-semibold">
        <Icon name="sparkle" size={18} className="text-accent-text" />
        {allDone ? t('ceDoneTitle') : t('ceTitle')}
      </h2>
      <p className="text-sm text-muted">{allDone ? t('ceDoneLead') : t('ceLead')}</p>
      {running && (
        <div role="status" className="flex flex-col gap-2" data-testid="course-extend-running">
          <p className="text-sm text-muted">{ask.phase === 'slow' ? t('aiSlow') : t('aiThinking')}</p>
          <Skeleton className="h-16 w-full" />
          {saved !== 'saving' && (
            <div>
              <Button icon="stop" onClick={ask.stop}>
                {t('aiStop')}
              </Button>
            </div>
          )}
        </div>
      )}
      {ask.error && !running && (
        <p role="alert" className="text-sm text-danger-text">
          {t(ask.error)}
        </p>
      )}
      {saved === 'failed' && (
        <p role="alert" className="text-sm text-danger-text">
          {t('saveFailed')}
        </p>
      )}
      {!running && (
        <div>
          <Button variant={allDone ? 'primary' : 'secondary'} icon="sparkle" onClick={() => void submit()} data-testid="course-extend-submit" data-ai="">
            {ask.error || saved === 'failed' ? t('aiRetry') : t('ceSubmit')}
          </Button>
        </div>
      )}
    </section>
  );
}
