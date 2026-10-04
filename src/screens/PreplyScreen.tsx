import { useEffect, useMemo, useRef, useState } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { toast } from '../ui/Toast';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { saveCards, savePreply, useCoach } from '../coach/store';
import { LESSON_MINUTES, lessonKey, prepData, prepText, recentLessons, validMinutes, weekStats } from '../coach/preply';
import { parseWordLines, planOwnWords, type OwnPlan } from '../coach/vocab';
import { dayKeyNoon } from '../domain/date';
import { logWarn } from '../platform/diagnostics';

// Preply-Brücke (ohne KI): Vor der Stunde ein fertiger Text für den Lehrer zum Kopieren, nach der
// Stunde Dauer und neue Wörter eintragen. Eine gehaltene Stunde zählt nur als Extra für den Fahrplan.

type Result = { min: number; plan: OwnPlan; bad: string[] };
type Duration = number | 'other' | null;

const fieldClass = 'mt-1 block w-full rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5 text-base text-fg outline-none focus:border-accent';

export function PreplyScreen() {
  const { t, tn, lang, date } = useT();
  const today = useClock((s) => s.today);
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const grammar = useCoach((s) => s.grammar);
  const inlog = useCoach((s) => s.inlog);
  const preply = useCoach((s) => s.preply);
  useEffect(() => setAskContext(''), []);

  const data = useMemo(() => prepData({ cards, profile, grammar: grammar?.t, inlog, today }), [cards, profile, grammar, inlog, today]);
  const text = useMemo(() => prepText(data, lang), [data, lang]);
  const thin = !data.words.length && !data.grammar.length && !data.read.length;
  const week = weekStats(preply, today);

  // Kopieren (Rückfall: Text markieren, damit er von Hand kopiert werden kann).
  const area = useRef<HTMLTextAreaElement>(null);
  const [copy, setCopy] = useState<'idle' | 'ok' | 'fail'>('idle');
  async function copyText() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopy('ok');
      toast(t('brgCopied'));
    } catch (err) {
      logWarn('preply:copy', err);
      setCopy('fail');
      area.current?.focus();
      area.current?.select();
    }
  }

  // Nach der Stunde.
  const [duration, setDuration] = useState<Duration>(null);
  const [other, setOther] = useState('');
  const [lines, setLines] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const minutes = duration === 'other' ? validMinutes(other) : duration;

  async function saveLesson() {
    if (minutes === null || busy) return;
    setBusy(true);
    try {
      const now = Date.now();
      const parsed = parseWordLines(lines);
      const plan = planOwnWords(parsed.words, useCoach.getState().cards, now);
      await saveCards(plan.create);
      await savePreply(lessonKey(today, now), { d: today, min: minutes, n: plan.create.length });
      setResult({ min: minutes, plan, bad: parsed.bad });
      setLines('');
      setDuration(null);
      setOther('');
    } finally {
      setBusy(false);
    }
  }

  const recent = recentLessons(preply);
  const durations: ReadonlyArray<{ value: Duration; label: string }> = [...LESSON_MINUTES.map((m) => ({ value: m, label: t('brgMinutes', { n: m }) })), { value: 'other', label: t('brgOther') }];

  return (
    <div className="mx-auto max-w-3xl px-4 pt-4" data-testid="preply">
      <Button variant="ghost" icon="arrowLeft" onClick={() => go({ name: 'home' })} data-testid="preply-back">
        {t('brgBack')}
      </Button>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{t('brgTitle')}</h1>
      <p className="mt-1 text-sm text-fg" data-testid="preply-week">
        {week.count > 0 ? tn('brgWeek', week.count, { min: week.min }) : t('brgWeekNone')}
      </p>
      <p className="mt-1 text-xs text-muted">{t('brgExtra')}</p>

      <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-6" aria-labelledby="brg-before">
        <h2 id="brg-before" className="text-base font-semibold">
          {t('brgBeforeTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('brgBeforeLead')}</p>
        {thin && <p className="mt-2 text-sm text-muted">{t('brgThin')}</p>}
        <label className="mt-4 block text-xs text-muted" htmlFor="preply-text">
          {t('brgTextLabel')}
        </label>
        <textarea
          id="preply-text"
          ref={area}
          readOnly
          value={text}
          rows={12}
          onFocus={(e) => e.currentTarget.select()}
          className="mt-1 block w-full resize-y rounded-[var(--radius-control)] border border-line bg-surface p-3 text-sm leading-relaxed text-fg outline-none focus:border-accent"
          data-testid="preply-text"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" icon={copy === 'ok' ? 'check' : 'copy'} onClick={() => void copyText()} data-testid="preply-copy">
            {copy === 'ok' ? t('brgCopied') : t('brgCopy')}
          </Button>
          {copy === 'fail' && (
            <p className="text-sm text-danger-text" role="status" data-testid="preply-copy-fail">
              {t('brgCopyFail')}
            </p>
          )}
        </div>
      </section>

      <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-6" aria-labelledby="brg-after">
        <h2 id="brg-after" className="text-base font-semibold">
          {t('brgAfterTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('brgAfterLead')}</p>
        <div className="mt-4">
          <p className="text-sm font-medium" id="brg-duration">
            {t('brgDuration')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="brg-duration" data-testid="preply-duration">
            {durations.map((d) => (
              <button
                key={String(d.value)}
                type="button"
                role="radio"
                aria-checked={duration === d.value}
                onClick={() => setDuration(d.value)}
                data-testid={`dur-${String(d.value)}`}
                className={`min-h-10 rounded-full border px-4 text-sm transition-colors ${duration === d.value ? 'border-accent bg-accent-soft text-fg' : 'border-line text-muted hover:text-fg'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {duration === 'other' && (
            <div className="mt-3 max-w-[10rem]">
              <label className="block text-xs text-muted" htmlFor="preply-other">
                {t('brgOtherLabel')}
              </label>
              <input id="preply-other" type="number" inputMode="numeric" min={5} max={240} value={other} onChange={(e) => setOther(e.target.value)} className={fieldClass} data-testid="preply-other" />
            </div>
          )}
        </div>
        <label className="mt-4 block text-sm font-medium" htmlFor="preply-words">
          {t('brgWordsLabel')}
        </label>
        <textarea
          id="preply-words"
          value={lines}
          onChange={(e) => setLines(e.target.value)}
          rows={5}
          placeholder={t('brgWordsPh')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={`${fieldClass} resize-y`}
          data-testid="preply-words"
        />
        <div className="mt-4">
          <Button variant="primary" busy={busy} disabled={minutes === null} onClick={() => void saveLesson()} data-testid="preply-save">
            {t('brgSave')}
          </Button>
        </div>

        {result && (
          <div className="mt-5 rounded-[var(--radius-control)] bg-surface p-3 text-sm" role="status" data-testid="preply-result">
            <p className="flex items-center gap-2 font-semibold text-accent-text">
              <Icon name="check" size={16} /> {t('brgSaved', { min: result.min })}
            </p>
            {result.plan.create.length > 0 && <p className="mt-1">{tn('brgCreated', result.plan.create.length)}</p>}
            {result.plan.duplicates.length > 0 && (
              <ul className="mt-1 space-y-0.5 text-muted" data-testid="preply-dups">
                {result.plan.duplicates.map((d) => (
                  <li key={d.word}>{t('brgDupLine', { word: d.word })}</li>
                ))}
              </ul>
            )}
            {[...result.bad, ...result.plan.invalid].length > 0 && (
              <ul className="mt-1 space-y-0.5 text-muted" data-testid="preply-bad">
                {[...result.bad, ...result.plan.invalid].map((l) => (
                  <li key={l}>{t('brgBadLine', { line: l })}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="mt-6" aria-labelledby="brg-recent">
          <h2 id="brg-recent" className="lx-eyebrow text-muted">
            {t('brgRecent')}
          </h2>
          <ul className="mt-2 space-y-1 text-sm" data-testid="preply-recent">
            {recent.map(([k, r]) => (
              <li key={k}>{t('brgRecentRow', { date: date(dayKeyNoon(r.d)), min: r.min, n: r.n })}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
