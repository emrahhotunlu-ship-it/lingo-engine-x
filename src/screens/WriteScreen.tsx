import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { ExerciseBar } from '../ui/ExerciseBar';
import { useAsk } from '../ai/useAsk';
import { useAiAvailable } from '../ai/scope';
import { useClock } from '../app/clock';
import { go, openWord, setAskContext } from '../app/route';
import { emptyDay, monthOf, saveDay, saveRepair, saveWriting, useCoach } from '../coach/store';
import { planAdd, repairFromError } from '../coach/repair';
import {
  buildEntry,
  lastWritten,
  pickPrompt,
  planWritingSave,
  taskFromInput,
  taskFromPrompt,
  usedWords,
  wordCount,
  WRITE_MAX_CHARS,
  WRITE_MIN_SUBMIT,
  type WriteReview,
  type WriteTask,
} from '../coach/writing';
import { writeReview } from '../prompts/write';
import { logError } from '../platform/diagnostics';
import { KEY_PREFIX, local } from '../platform/storage';
import { countAiCall } from './aiCount';
import { StepHead } from './Exercise';
import { TapText } from './parts';
import { catKey } from './writeLabels';

// Schreibauftrag (docs/neustart.md §5 Nr. 13): kurze Aufgabe, eigener Text, GENAU EINE KI-Korrektur
// auf Knopfdruck. Danach: Fehler mit Warum, der korrigierte Text, höchstens zwei C1-Aufwertungen,
// Niveau und Lob. Jeder Fehler kommt als Reparatur-Aufgabe zurück (coach/repair).
// Der Entwurf wird nur als Bequemlichkeit im Browser gemerkt, nie als Lernstand.

const draftKeyOf = (taskId: string): string => `${KEY_PREFIX}write-draft:${taskId}`;

export function WriteScreen({ from }: { from?: { day: string; id: string } | undefined }) {
  const today = useClock((s) => s.today);
  const { t, lang } = useT();
  const item = useCoach((s) => (from ? s.input.find((d) => d.d === from.day)?.items.find((i) => i.id === from.id) : undefined));
  // Aufgabenliste beim Öffnen einfrieren: Nach dem Speichern darf sich die Aufgabe nicht ändern.
  const [last] = useState(() => lastWritten(useCoach.getState().writing));
  const [skip, setSkip] = useState(0);
  const [round, setRound] = useState(0);
  const [fromInput, setFromInput] = useState(!!from);
  const task = useMemo<WriteTask>(() => (fromInput && item ? taskFromInput(item) : taskFromPrompt(pickPrompt(today, last, skip), lang)), [fromInput, item, today, last, skip, lang]);

  return (
    <div className="mx-auto max-w-2xl px-4 pt-3" data-testid="write">
      <ExerciseBar onClose={() => go(from ? { name: 'input' } : { name: 'home' })} closeLabel={t('cClose')} closeTestId="write-close" note={t('schExtra')} />
      <WriteBody
        key={`${task.id}-${round}`}
        task={task}
        canSwap={!fromInput}
        onSwap={() => setSkip((n) => n + 1)}
        onAnother={() => {
          setFromInput(false);
          setSkip((n) => n + 1);
          setRound((n) => n + 1);
        }}
        onDone={() => go(from ? { name: 'input' } : { name: 'home' })}
      />
    </div>
  );
}

function WriteBody({ task, canSwap, onSwap, onAnother, onDone }: { task: WriteTask; canSwap: boolean; onSwap: () => void; onAnother: () => void; onDone: () => void }) {
  const { t, tn, lang } = useT();
  const today = useClock((s) => s.today);
  const available = useAiAvailable();
  const ask = useAsk(writeReview);
  const draftKey = draftKeyOf(task.id);
  const [text, setText] = useState(() => local.get(draftKey) ?? '');
  const [submitted, setSubmitted] = useState(false);
  const startedAt = useRef<number | null>(null);
  const n = wordCount(text);
  const busy = ask.phase === 'queued' || ask.phase === 'thinking' || ask.phase === 'streaming' || ask.phase === 'slow';
  const review = ask.phase === 'done' ? ask.data : null;
  const shown = lang === 'de' ? task.task_de : task.task_en;
  const taskLine = task.input ? t('schTaskInput', { title: task.input.title }) : shown;
  const used = useMemo(() => usedWords(text, task.words), [text, task.words]);

  useEffect(() => setAskContext(`Writing task: ${task.task_en}`.slice(0, 600)), [task]);

  // Entwurf: nur Bequemlichkeit (Browser-Speicher), nie Lernstand.
  useEffect(() => {
    if (submitted) return;
    const id = window.setTimeout(() => {
      if (text.trim()) local.set(draftKey, text);
      else local.remove(draftKey);
    }, 400);
    return () => window.clearTimeout(id);
  }, [text, submitted, draftKey]);

  async function submit() {
    const clean = text.trim();
    if (wordCount(clean) < WRITE_MIN_SUBMIT || busy) return;
    countAiCall(today);
    const result = await ask.run({ task_en: task.task_en, text: clean, uiLang: lang });
    if (!result) return;
    // Ergebnis ist da: Entwurf verwerfen, Ergebnis zeigen; gespeichert wird im Hintergrund.
    setSubmitted(true);
    local.remove(draftKey);
    try {
      const now = Date.now();
      const entry = buildEntry({ now, day: today, task, text: clean, review: result, lang });
      await saveWriting(today, planWritingSave(useCoach.getState().writing[monthOf(today)], entry));
      await saveRepair(planAdd(useCoach.getState().repair, result.errors.map((e) => repairFromError(e, lang, now))));
      const mins = Math.min(30, Math.max(1, Math.round((now - (startedAt.current ?? now)) / 60_000)));
      const cur = useCoach.getState().days[today] ?? emptyDay();
      await saveDay(today, { ...cur, min: cur.min + mins });
    } catch (err) {
      logError('write:save', err);
    }
  }

  const tooShort = n < WRITE_MIN_SUBMIT;
  const countTone = n === 0 ? 'text-muted' : n < task.min ? 'text-muted' : n <= task.max ? 'text-accent-text' : 'text-gold-text';

  return (
    <div className="lx-glass mt-3 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="write-card">
      <StepHead kind="write" lv={null} />
      <p className="text-base leading-relaxed" data-testid="write-task" lang={lang}>
        {taskLine}
      </p>
      {canSwap && n === 0 && !review && !busy && (
        <div className="mt-2">
          <Button variant="ghost" icon="refresh" onClick={onSwap} data-testid="write-swap">
            {t('schOtherTask')}
          </Button>
        </div>
      )}

      {review ? (
        <ReviewView review={review} />
      ) : (
        <>
          {task.words.length > 0 && (
            <div className="mt-4">
              <p className="lx-eyebrow text-muted">{t('schKeyWords')}</p>
              <ul className="mt-2 flex flex-wrap gap-2" data-testid="write-words">
                {task.words.map((w) => (
                  <li key={w.en}>
                    <button
                      type="button"
                      onClick={() => openWord(w.en)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs hover:bg-surface ${used.has(w.en) ? 'border-accent bg-accent-soft' : 'border-line'}`}
                      data-used={used.has(w.en) ? '1' : '0'}
                    >
                      {used.has(w.en) && <Icon name="check" size={14} className="text-accent-text" />}
                      <span lang="en" className="font-semibold">
                        {w.en}
                      </span>
                      <span className="text-muted">{w.de}</span>
                      {used.has(w.en) && <span className="sr-only">{t('schUsed')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="write-input" className="sr-only">
              {t('schInputLabel')}
            </label>
            <textarea
              id="write-input"
              value={text}
              onChange={(e) => {
                if (startedAt.current === null) startedAt.current = Date.now();
                setText(e.target.value.slice(0, WRITE_MAX_CHARS));
              }}
              disabled={busy}
              rows={9}
              lang="en"
              autoCapitalize="sentences"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t('schPlaceholder')}
              className="block w-full resize-y rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-base leading-relaxed text-fg outline-none focus:border-accent disabled:opacity-70"
              data-testid="write-input"
            />
            <p className={`mt-1.5 text-xs ${countTone}`} data-testid="write-count">
              {t('schCount', { n, min: task.min, max: task.max })}
            </p>
          </div>

          {!available && <p className="mt-3 text-sm text-muted">{t('schNoAi')}</p>}
          {available && tooShort && n > 0 && <p className="mt-3 text-sm text-muted">{t('schNeedMore', { n: WRITE_MIN_SUBMIT })}</p>}

          {busy ? (
            <div className="mt-4" role="status" data-testid="write-busy">
              <p className="text-sm text-muted">{ask.phase === 'queued' ? t('aiQueued') : t('schReading')}</p>
              {ask.phase === 'slow' && <p className="mt-1 text-sm text-muted">{t('aiSlow')}</p>}
              <div className="mt-3">
                <Button variant="ghost" icon="stop" onClick={ask.stop} data-testid="write-stop">
                  {t('aiStop')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {ask.phase === 'error' ? (
                <>
                  <p className="w-full text-sm text-danger-text" role="alert" data-testid="write-error">
                    {t(ask.error ?? 'aiFailed')}
                  </p>
                  <Button variant="primary" size="lg" icon="refresh" onClick={() => void submit()} disabled={!available || tooShort} data-testid="write-retry">
                    {t('aiRetry')}
                  </Button>
                </>
              ) : (
                <Button variant="primary" size="lg" icon="sparkle" onClick={() => void submit()} disabled={!available || tooShort} data-testid="write-submit">
                  {t('schCorrect')}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {review && (
        <div className="mt-6 border-t border-line/60 pt-4">
          {review.errors.length > 0 && (
            <p className="text-sm text-muted" data-testid="write-repair-note">
              {tn('schRepairNote', review.errors.length)}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onDone} data-testid="write-done">
              {t('schDone')}
            </Button>
            <Button variant="ghost" icon="edit" onClick={onAnother} data-testid="write-another">
              {t('schAnother')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewView({ review }: { review: WriteReview }) {
  const { t, tn } = useT();
  return (
    <div className="mt-5 space-y-6" data-testid="write-result">
      <div>
        {review.level && (
          <p className="text-base font-semibold" data-testid="write-level">
            {t('schLevel', { level: review.level })}
          </p>
        )}
        {review.praise && <p className="mt-1 text-sm text-muted">{review.praise}</p>}
      </div>

      <section aria-labelledby="write-errors-h">
        <h2 id="write-errors-h" className="lx-eyebrow text-muted" data-testid="write-errors-title">
          {review.errors.length === 0 ? t('schNoErrors') : tn('schErrors', review.errors.length)}
        </h2>
        {review.errors.length > 0 && (
          <ul className="mt-3 space-y-3">
            {review.errors.map((e) => (
              <li key={`${e.orig}|${e.fix}`} className="rounded-[var(--radius-control)] border border-line/70 p-3.5 text-sm" data-testid="write-error-item" data-cat={e.cat}>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted">
                  <span className="rounded-full bg-surface px-2 py-0.5">{t(catKey(e.cat))}</span>
                </p>
                <p className="mt-1.5 leading-relaxed" lang="en">
                  <span className="text-danger-text line-through decoration-1">{e.orig}</span>
                  <span className="mx-2 text-subtle" aria-hidden="true">
                    →
                  </span>
                  <span className="font-semibold text-accent-text">{e.fix}</span>
                </p>
                {e.why && (
                  <p className="mt-1.5 text-muted">
                    <span className="font-semibold text-fg">{t('schWhy')}: </span>
                    {e.why}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="write-corrected-h">
        <h2 id="write-corrected-h" className="lx-eyebrow text-muted">
          {t('schCorrectedTitle')}
        </h2>
        <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed" data-testid="write-corrected">
          <TapText text={review.corrected} />
        </p>
      </section>

      {review.upgrades.length > 0 && (
        <section aria-labelledby="write-up-h">
          <h2 id="write-up-h" className="lx-eyebrow text-muted">
            {t('schUpgradesTitle')}
          </h2>
          <ul className="mt-3 space-y-3">
            {review.upgrades.map((u) => (
              <li key={u.weak} className="rounded-[var(--radius-control)] border border-line/70 p-3.5 text-sm" data-testid="write-upgrade">
                <p className="text-2xs text-muted">{t('schUpgradeWeak')}</p>
                <p className="leading-relaxed" lang="en">
                  {u.weak}
                </p>
                <p className="mt-2 text-2xs text-muted">{t('schUpgradeStrong')}</p>
                <p className="font-semibold leading-relaxed text-accent-text">
                  <TapText text={u.strong} />
                </p>
                {u.why && <p className="mt-1.5 text-muted">{u.why}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
