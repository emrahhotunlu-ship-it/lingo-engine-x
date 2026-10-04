import { useEffect } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { useCoach, emptyDay } from '../coach/store';
import { addDays } from '../domain/date';
import { inputOf, isCore, pct, stageOf, streakOf, stubborn, todayPlan, vocabNow, VOCAB_C1 } from '../coach/derived';
import { logKey } from './InputScreen';
import { viewOf } from '../coach/cardView';
import { STAGE_KEYS } from './PlanScreen';
import { TEST_BUILD } from '../app/testBuild';
import { TestSkipButton } from './TestTools';

// Heute (docs/neustart.md §4, Kap. 2.1): ein Satz vom Trainer, EIN großer Knopf, darunter der Weg
// zu C1. Erledigt heißt erledigt: Nach dem Kern-Training ist der Knopf ein Zustand, kein Auftrag.

function hello(now: number): 'cHelloMorning' | 'cHelloDay' | 'cHelloEvening' {
  const h = new Date(now).getHours();
  return h < 11 ? 'cHelloMorning' : h < 18 ? 'cHelloDay' : 'cHelloEvening';
}

function Part({ n, done, title, sub, testId }: { n: number; done: boolean; title: string; sub: string; testId: string }) {
  return (
    <li className="flex items-start gap-3" data-testid={testId} data-done={done ? '1' : '0'}>
      <span className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full text-2xs font-semibold ${done ? 'bg-accent text-accent-fg' : 'border border-line text-muted'}`}>
        {done ? <Icon name="check" size={14} /> : n}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${done ? 'text-muted line-through decoration-1' : ''}`}>{title}</span>
        {sub && !done && <span className="block truncate text-xs text-muted">{sub}</span>}
      </span>
    </li>
  );
}

export function HomeScreen() {
  const { t, tn, num } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const days = useCoach((s) => s.days);
  const importFailed = useCoach((s) => s.importFailed === true);
  const imported = !!profile?.imported || importFailed;
  const day = days[today] ?? emptyDay();
  const yesterday = days[addDays(today, -1)];
  const placed = !!profile?.placement;
  const plan = todayPlan(cards, profile, day, now);
  const streak = streakOf(days, profile?.imported?.days ?? [], today);
  const input = useCoach((s) => s.input);
  const inlog = useCoach((s) => s.inlog);
  const todaysInput = inputOf(input, today);
  const openInput = todaysInput.find((it) => !inlog.it[logKey(today, it)]);
  const done = isCore(day, todaysInput.length > 0);
  const trainingDone = day.w === 1 && day.g === 1;
  const inputDone = day.i === 1 || (todaysInput.length > 0 && !openInput);
  const hard = stubborn(cards)
    .map((id) => viewOf(id, cards.get(id))?.word)
    .filter(Boolean)
    .join(', ');

  useEffect(() => setAskContext(''), []);

  const brief: string[] = [];
  if (!placed) brief.push(t('cBriefPlace'));
  else if (!done) {
    if (yesterday && yesterday.ans > 0) brief.push(t('cBriefYesterday', { pct: pct(yesterday.ok, yesterday.ans) }));
    if (plan.fresh === 0) brief.push(t('cBriefPlanNoNew', { due: plan.due, min: plan.minutes }));
    else if (plan.due === 0) brief.push(t('cBriefPlanNew', { new: plan.fresh, min: plan.minutes }));
    else brief.push(t('cBriefPlan', { due: plan.due, new: plan.fresh, min: plan.minutes }));
    if (hard) brief.push(t('cBriefStubborn', { words: hard }));
  }

  const stage = stageOf(profile?.planStart, today);
  const vocab = vocabNow(profile, cards);

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6 lg:max-w-5xl lg:pt-10" data-testid="home">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t(hello(now))}</h1>
        {streak.count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-text" data-testid="streak">
            <Icon name="bolt" size={14} />
            {tn('cStreak', streak.count)}
          </span>
        )}
      </div>

      <div className={placed ? 'lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-6' : 'lg:max-w-3xl'}>
        <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="today-card">
          {done ? (
            <div data-testid="today-done">
              <p className="flex items-center gap-2 text-lg font-semibold text-accent-text">
                <Icon name="check" size={22} /> {t('cDoneTitle')}
              </p>
              <p className="mt-2 text-sm text-muted">{t('cDoneText', { ans: day.ans, pct: pct(day.ok, day.ans), min: day.min })}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="secondary" icon="plus" onClick={() => go({ name: 'session', extra: true })} data-testid="extra-new">
                  {t('cExtraNew')}
                </Button>
                <Button variant="secondary" icon="bolt" onClick={() => go({ name: 'blitz' })} data-testid="open-blitz">
                  {t('cBlitz')}
                </Button>
                {openInput && (
                  <Button variant="ghost" icon="book" onClick={() => go({ name: 'input' })}>
                    {t('cCtaInput')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2 text-base leading-relaxed text-fg" data-testid="brief">
                {brief.map((b) => (
                  <p key={b}>{b}</p>
                ))}
                {!imported && <p className="text-sm text-muted">{t('cImporting')}</p>}
              </div>
              {placed && (
                <ol className="mt-5 space-y-2" data-testid="parts">
                  <Part n={1} done={trainingDone} title={t('cPartTraining')} sub={t('cPartTrainingSub', { min: plan.minutes + 7 })} testId="part-training" />
                  <Part
                    n={2}
                    done={inputDone}
                    title={t('cPartInput')}
                    sub={openInput ? t('cPartInputSub', { title: openInput.title, min: openInput.mins }) : todaysInput.length ? '' : t('cPartInputNone')}
                    testId="part-input"
                  />
                </ol>
              )}
              <div className="mt-6">
                {placed && !trainingDone ? (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'session' })} data-testid="start-training">
                    {day.ans > 0 ? t('cCtaContinue') : t('cCtaTrain')}
                  </Button>
                ) : placed ? (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'input' })} data-testid="start-input">
                    {t('cCtaInput')}
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'placement' })} disabled={!imported} data-testid="start-placement">
                    {t('cCtaPlace')}
                  </Button>
                )}
              </div>
              {TEST_BUILD && !placed && (
                <div className="mt-3">
                  <TestSkipButton />
                </div>
              )}
            </>
          )}
        </section>

        {placed && (
          <button
            type="button"
            onClick={() => go({ name: 'plan' })}
            className="mt-4 block w-full rounded-[var(--radius-card)] border border-line/70 p-5 text-left transition-colors hover:bg-surface lg:mt-5"
            data-testid="home-way"
          >
            <div className="flex items-center justify-between text-xs text-muted">
              <span className="lx-eyebrow">{t('cHomeWay')}</span>
              <span>{t('cHomeStage', { n: stage, name: t(STAGE_KEYS[stage - 1]!) })}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-track" role="progressbar" aria-valuemin={0} aria-valuemax={VOCAB_C1} aria-valuenow={vocab} aria-label={t('cRmVocab')}>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (vocab / VOCAB_C1) * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted">{t('cRmVocabText', { now: num(vocab), target: num(VOCAB_C1) })}</p>
          </button>
        )}
      </div>
    </div>
  );
}
