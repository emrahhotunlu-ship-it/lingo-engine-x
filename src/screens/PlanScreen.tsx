import { useEffect } from 'react';
import { useT } from '../i18n';
import { Button } from '../ui/Button';
import { useClock } from '../app/clock';
import { go, setAskContext } from '../app/route';
import { useCoach } from '../coach/store';
import { forecastDays, grammarSolid, inputHours, INPUT_HOURS_TARGET, learnedSince, stageOf, vocabNow, VOCAB_C1 } from '../coach/derived';
import { topicById } from '../coach/grammar';
import { dayKeyNoon } from '../domain/date';

// Fahrplan zu C1 (docs/neustart.md §7): vier Etappen à drei Monate, Messwerte je Säule, Prognose.

export const STAGE_KEYS = ['cStage1', 'cStage2', 'cStage3', 'cStage4'] as const;
const STAGE_TEXT = ['cStage1Text', 'cStage2Text', 'cStage3Text', 'cStage4Text'] as const;

function Meter({ label, value, max, text, testId }: { label: string; value: number; max: number; text: string; testId: string }) {
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, max ? (value / max) * 100 : 0)}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-muted">{text}</p>
    </div>
  );
}

export function PlanScreen() {
  const { t, num, lang } = useT();
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const profile = useCoach((s) => s.profile);
  const cards = useCoach((s) => s.cards);
  const days = useCoach((s) => s.days);
  const inlog = useCoach((s) => s.inlog);
  useEffect(() => setAskContext(''), []);

  const p = profile?.placement;
  if (!p) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-6" data-testid="plan">
        <h1 className="text-xl font-semibold tracking-tight">{t('cRmTitle')}</h1>
        <p className="mt-4 text-sm text-muted">{t('cRmNoPlace')}</p>
        <div className="mt-5">
          <Button variant="primary" onClick={() => go({ name: 'placement' })}>
            {t('cCtaPlace')}
          </Button>
        </div>
      </div>
    );
  }

  const stage = stageOf(profile?.planStart, today);
  const vocab = vocabNow(profile, cards);
  const grammar = useCoach((s) => s.grammar);
  const g = grammarSolid(profile, grammar?.t);
  const fc = forecastDays(profile, cards, days, today);
  const fmtMonth = (ms: number) => new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { month: 'long', year: 'numeric' }).format(ms);
  const start = profile?.planStart ? new Intl.DateTimeFormat(lang === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(dayKeyNoon(profile.planStart)) : '';

  return (
    <div className="mx-auto max-w-3xl px-4 pt-6" data-testid="plan">
      <h1 className="text-xl font-semibold tracking-tight">{t('cRmTitle')}</h1>
      <p className="mt-1 text-sm text-muted">
        {start && t('cRmStart', { date: start })} · {t('cPlLevel', { level: p.level })}
      </p>

      <section className="lx-glass mt-5 space-y-6 rounded-[var(--radius-card)] p-5 sm:p-7">
        <Meter
          label={t('cRmVocab')}
          value={vocab}
          max={VOCAB_C1}
          text={`${t('cRmVocabText', { now: num(vocab), target: num(VOCAB_C1) })} · ${t('cRmLearned', { n: learnedSince(cards, p.at) })}`}
          testId="meter-vocab"
        />
        <Meter
          label={t('cRmInput')}
          value={inputHours(inlog, today)}
          max={INPUT_HOURS_TARGET}
          text={t('cRmInputText', { h: inputHours(inlog, today), target: INPUT_HOURS_TARGET })}
          testId="meter-input"
        />
        <Meter label={t('cRmGrammar')} value={g.solid} max={g.total} text={t('cRmGrammarText', { n: g.solid, total: g.total })} testId="meter-grammar" />
        {g.weakest.length > 0 && (
          <div>
            <h3 className="lx-eyebrow text-muted">{t('cRmFocus')}</h3>
            <ul className="mt-2 flex flex-wrap gap-2">
              {g.weakest.map((id) => {
                const topic = topicById(id);
                return (
                  <li key={id} className="rounded-full bg-surface px-3 py-1 text-xs text-fg">
                    {topic ? (lang === 'de' ? topic.name : topic.name_en) : id}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="text-sm text-fg" data-testid="forecast">
          {fc === null ? t('cRmForecastNone') : t('cRmForecast', { when: fmtMonth(now + fc * 86_400_000) })}
        </p>
      </section>

      <ol className="mt-6 space-y-3" aria-label={t('cRmTitle')}>
        {STAGE_KEYS.map((key, i) => {
          const n = i + 1;
          const current = n === stage;
          const past = n < stage;
          return (
            <li
              key={key}
              className={`rounded-[var(--radius-card)] border p-4 ${current ? 'border-accent/60 bg-accent-soft' : 'border-line/70'} ${past ? 'opacity-70' : ''}`}
              aria-current={current ? 'step' : undefined}
              data-testid={`stage-${n}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  {t('cRmStageOf', { n })}: {t(key)}
                </h2>
                <span className="text-2xs text-muted">{t('cStageMonths', { from: i * 3 + 1, to: i * 3 + 3 })}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{t(STAGE_TEXT[i]!)}</p>
            </li>
          );
        })}
      </ol>

      <div className="mt-6">
        <Button variant="ghost" icon="refresh" onClick={() => go({ name: 'placement' })} data-testid="place-again">
          {t('cRmPlaceAgain')}
        </Button>
      </div>
    </div>
  );
}
