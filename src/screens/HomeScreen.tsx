import { useEffect } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { useCoach, emptyDay } from '../coach/store';
import { addDays } from '../domain/date';
import { pct, stageOf, streakOf, stubborn, todayPlan, vocabNow, VOCAB_C1 } from '../coach/derived';
import { viewOf } from '../coach/cardView';
import { STAGE_KEYS } from './PlanScreen';

// Heute (docs/neustart.md §4, Kap. 2.1): ein Satz vom Trainer, EIN großer Knopf, darunter der Weg
// zu C1. Erledigt heißt erledigt: Nach dem Kern-Training ist der Knopf ein Zustand, kein Auftrag.

function hello(now: number): 'cHelloMorning' | 'cHelloDay' | 'cHelloEvening' {
  const h = new Date(now).getHours();
  return h < 11 ? 'cHelloMorning' : h < 18 ? 'cHelloDay' : 'cHelloEvening';
}

export function HomeScreen() {
  const { t, tn, num } = useT();
  const now = useClock((s) => s.now);
  const today = useClock((s) => s.today);
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const days = useCoach((s) => s.days);
  const imported = !!profile?.imported;
  const day = days[today] ?? emptyDay();
  const yesterday = days[addDays(today, -1)];
  const placed = !!profile?.placement;
  const plan = todayPlan(cards, profile, day, now);
  const streak = streakOf(days, profile?.imported?.days ?? [], today);
  const done = day.core === 1;
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
    <div className="mx-auto max-w-3xl px-4 pt-6" data-testid="home">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{t(hello(now))}</h1>
        {streak.count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-text" data-testid="streak">
            <Icon name="bolt" size={14} />
            {tn('cStreak', streak.count)}
          </span>
        )}
      </div>

      <section className="lx-glass mt-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="today-card">
        {done ? (
          <div data-testid="today-done">
            <p className="flex items-center gap-2 text-lg font-semibold text-accent-text">
              <Icon name="check" size={22} /> {t('cDoneTitle')}
            </p>
            <p className="mt-2 text-sm text-muted">{t('cDoneText', { ans: day.ans, pct: pct(day.ok, day.ans), min: day.min })}</p>
            <div className="mt-5">
              <Button variant="secondary" icon="plus" onClick={() => go({ name: 'session', extra: true })} data-testid="extra-new">
                {t('cExtraNew')}
              </Button>
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
            <div className="mt-6">
              {placed ? (
                <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'session' })} data-testid="start-training">
                  {day.ans > 0 ? t('cCtaContinue') : t('cCtaTrain')}
                </Button>
              ) : (
                <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={() => go({ name: 'placement' })} disabled={!imported} data-testid="start-placement">
                  {t('cCtaPlace')}
                </Button>
              )}
            </div>
          </>
        )}
      </section>

      {placed && (
        <button
          type="button"
          onClick={() => go({ name: 'plan' })}
          className="mt-4 block w-full rounded-[var(--radius-card)] border border-line/70 p-5 text-left transition-colors hover:bg-surface"
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
  );
}
