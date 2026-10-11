import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { patternById } from '../../domain/grammar/patterns';
import { lastWeekOf, weekFacts } from '../../domain/progress/weekly';
import { FEST_NAMES_MAX, weekly3 } from '../../domain/progress/weekly3';
import { useT } from '../../i18n';
import { AiMark } from '../../ui/AiMark';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Chip } from '../../ui/Chips';
import { Eyebrow } from '../../ui/Eyebrow';
import { Skeleton } from '../../ui/Skeleton';
import { useConfusion } from '../tutor/diagnoseStore';
import { useChosenChapter } from '../c1/chosen';
import { FocusPick } from './FocusPick';
import { TeacherCard } from './TeacherCard';
import { useWeeklyText } from './useWeeklyText';

// Wochenrückblick 3.0 (Lernplattform 3.0 P50, Motivation §4.9 mit K-15). Von oben: Zeitraum, EINE große Zahl („+31 fest“), neu Feste mit Namen,
// neu sichere Muster, Claudes Text (nur mit KI), „Für deinen Lehrer“ (eine Karte), Fokus für die Woche, Einsatz-Satz. Ohne `sample` ist alles
// außer Claudes Text da. Auf dem Laptop: links die Zahlen, rechts Text, Lehrer, Fokus und Einsatz.

type Doc = Record<string, unknown>;
const EMPTY = new Map<string, Doc>();
const obj = (v: unknown): Doc => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {});
const dayMs = (d: string) => Date.parse(`${d}T12:00:00`);

export function WeeklyReview3() {
  const { t, lang, date, num } = useT();
  const today = useClock((s) => s.today);
  const now = useClock((s) => s.now);
  const profile = useLive((s) => s.docs['app/profile']);
  const vocab = useLive((s) => s.collections.vocab) ?? EMPTY;
  const chunk = useLive((s) => s.collections.chunk) ?? EMPTY;
  const grammar = useLive((s) => s.collections.grammar) ?? EMPTY;
  const schema = useLive((s) => s.docs['app/schema']);
  const liveStatus = useLive((s) => s.status);
  const conf = useConfusion(true);
  const chosen = useChosenChapter();

  const facts = useMemo(
    () => weekFacts({ days: lastWeekOf(today).days, vocab, chunk, grammar, writing: EMPTY, talk: EMPTY, profile: obj(profile), pflichtSince: typeof obj(schema).pflichtSince === 'string' ? (obj(schema).pflichtSince as string) : null }).filter((f) => f.kind !== 'time'),
    [today, vocab, chunk, grammar, profile, schema],
  );
  const fixed = useMemo(() => facts.reduce((n, f) => (f.kind === 'fixed' ? n + f.n : n), 0), [facts]);
  const w = useMemo(
    () => weekly3({ today, nowMs: now, vocab, chunk, grammar, profile: obj(profile), confusion: conf.confusion, fixed, chosen }),
    [today, now, vocab, chunk, grammar, profile, conf.confusion, fixed, chosen],
  );
  const text = useWeeklyText(w.w, facts);

  const first = w.days[0] ?? today;
  const last = w.days[6] ?? today;
  const names = w.fest.slice(0, FEST_NAMES_MAX);
  const moreNames = w.fest.length - names.length;
  const nameOf = (id: string): string => patternById(id)?.name[lang] ?? id;
  const empty = w.fest.length === 0 && w.patternsSafe.length === 0;
  const bigNeg = w.big !== null && w.big.n < 0;
  const loading = liveStatus !== 'ready';

  return (
    <div className="flex flex-col gap-4" data-testid="wk3" data-week={w.w} data-state={loading ? 'loading' : 'ready'}>
      <Eyebrow testId="wk-range">{t('moWkRange', { w: Number(w.w.slice(6)), from: date(dayMs(first)), to: date(dayMs(last)) })}</Eyebrow>
      {loading ? (
        <div className="flex flex-col gap-2" role="status" aria-label={t('moWkLoading')} data-testid="wk-loading">
          <Skeleton className="h-16 w-40" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
          <div className="flex flex-col gap-4" data-testid="wk-left">
            <Card channel="cards" className="flex flex-col gap-3" aria-labelledby="wk-big-label" data-testid="wk-numbers">
              {w.big ? (
                <div className="flex flex-col gap-1" data-testid="wk-big" data-n={w.big.n} data-src={w.big.src}>
                  <p className="m-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="lx-tnum text-5xl font-semibold tracking-tight" aria-label={w.big.n < 0 ? t('moWkBigAriaNeg', { n: num(Math.abs(w.big.n)) }) : t('moWkBigAria', { n: num(w.big.n) })}>
                      {w.big.n < 0 ? t('moWkBigNeg', { n: num(Math.abs(w.big.n)) }) : t('moWkBig', { n: num(w.big.n) })}
                    </span>
                    <span id="wk-big-label" className="text-base font-medium text-muted">
                      {t('moWkBigLabel')}
                    </span>
                  </p>
                  {bigNeg && <p className="m-0 text-sm text-muted">{t('moWkBigNegNote')}</p>}
                  {w.big.src === 'ff' && <p className="m-0 text-xs text-subtle">{t('moWkBigFfNote')}</p>}
                </div>
              ) : (
                <h2 id="wk-big-label" className="m-0 text-lg font-semibold">
                  {t('nbProfilWeekly')}
                </h2>
              )}
              {names.length > 0 && (
                <div className="flex flex-col gap-2" data-testid="wk-names">
                  <p className="lx-eyebrow m-0 text-subtle">{t('moWkNamesTitle')}</p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {names.map((n) => (
                      <li key={n.id} data-testid="wk-name" data-unit={n.unit}>
                        <Chip>{n.label}</Chip>
                      </li>
                    ))}
                    {moreNames > 0 && (
                      <li className="inline-flex items-center text-sm text-muted" data-testid="wk-names-more">
                        {t('moWkNamesMore', { n: moreNames })}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {w.patternsSafe.length > 0 && (
                <div className="flex flex-col gap-2" data-testid="wk-patterns">
                  <p className="lx-eyebrow m-0 text-subtle">{t('moWkPatternsTitle')}</p>
                  <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                    {w.patternsSafe.map((p) => (
                      <li key={p} data-testid="wk-pattern" data-pat={p}>
                        <Chip tone="accent">{nameOf(p)}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {w.fixed > 0 && (
                <p className="lx-tnum m-0 text-sm" data-testid="wk-fixed">
                  {t('moWkFixed', { n: num(w.fixed) })}
                </p>
              )}
              {empty && !w.big && (
                <p className="m-0 text-sm text-muted" data-testid="wk-empty">
                  {t('moWkEmpty')}
                </p>
              )}
            </Card>
            {text.stored || (text.wants && !text.failed) || text.failed ? (
              <Card className="flex flex-col gap-3" aria-labelledby="wk-claude-title" data-testid="wk-claude">
                <h2 id="wk-claude-title" className="m-0 text-lg font-semibold">
                  {t('moWkClaudeTitle')}
                </h2>
                {text.stored && (
                  <div className="flex flex-col gap-2" data-testid="weekly-text">
                    <p className="m-0 text-base font-medium">{text.stored.text.headline}</p>
                    <ul className="m-0 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                      {text.stored.text.learned.map((l, i) => (
                        <li key={i}>{l.text}</li>
                      ))}
                    </ul>
                    <p className="m-0 text-sm">
                      <span className="text-muted">{t('weeklyNext')}: </span>
                      {text.stored.text.next}
                    </p>
                    <AiMark variant="diag" tpl={text.stored.pv} />
                  </div>
                )}
                {!text.stored && text.wants && !text.failed && (
                  <p className="m-0 text-sm text-muted" role="status">
                    {t('weeklyWriting')}
                  </p>
                )}
                {text.failed && (
                  <div role="alert" className="flex flex-wrap items-center gap-3" data-testid="weekly-error">
                    <p className="m-0 text-sm text-muted">{t('weeklyFailed')}</p>
                    <Button variant="secondary" icon="refresh" data-ai="" data-testid="weekly-retry" onClick={text.retry}>
                      {t('aiRetry')}
                    </Button>
                  </div>
                )}
              </Card>
            ) : null}
          </div>
          <div className="flex flex-col gap-4" data-testid="wk-right">
            <TeacherCard text={w.teacher} />
            <FocusPick options={w.options} today={today} profileWf={obj(profile).wf} />
            {w.use && (
              <Card channel="business" className="flex flex-col gap-2" aria-labelledby="wk-use-title" data-testid="wk-use">
                <h2 id="wk-use-title" className="m-0 text-lg font-semibold">
                  {t('moWkUseTitle')}
                </h2>
                <p className="m-0 text-sm text-muted">{t('moWkUseWhere', { situation: w.use.situation[lang] })}</p>
                <p className="m-0 text-base" lang="en" data-testid="wk-use-sentence">
                  {w.use.sentence}
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
