import { useMemo, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useLive } from '../../data/live';
import { readAssess } from '../../domain/assessment/envelope';
import { DIMS, type Confidence } from '../../domain/assessment/types';
import { EnglishText } from '../../engine/EnglishText';
import { useHiddenInput } from '../../engine/HiddenInput';
import { useT, type MessageKey } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { actionRoute, startAction } from './actionRoute';
import { runAssess, stopAssess, useAssessRun } from './assessRun';

// Reiter „Urteil" (Kap. 5, Plan §10): Gesamtstufe mit Begründung und Trend, sechs Fertigkeiten mit
// Belastbarkeit, Stärken, Blocker mit „Üben", Fokus. Eine große Zahl (die Stufe), Belastbarkeit als
// Punkte MIT Text (nie nur Farbe). Gespeicherte Texte nur in ihrer eigenen Sprache (Kap. 10).

const CONF_KEY: Record<Confidence, MessageKey> = { thin: 'confThin', fair: 'confFair', good: 'confGood' };
const CONF_DOTS: Record<Confidence, number> = { thin: 1, fair: 2, good: 3 };
const TREND_KEY = { up: 'trendUp', flat: 'trendFlat', down: 'trendDown' } as const;

export function Dots({ n, label }: { n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="lx-dots" aria-hidden="true">
        {[1, 2, 3].map((k) => (
          <span key={k} className="lx-dot" data-on={k <= n ? '' : undefined} />
        ))}
      </span>
      {label}
    </span>
  );
}

/** Zweck nur hinter dem Info-Symbol (A7, Trainer-Rückmeldung). */
export function InfoToggle({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-end gap-2">
      <IconButton icon="info" label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && <p className="max-w-md text-right text-xs text-muted">{text}</p>}
    </div>
  );
}

const dayMs = (d: string | null): number => (d ? Date.parse(`${d}T12:00:00`) : 0);

export function JudgeTab() {
  const { t, tn, lang, date } = useT();
  const api = useHiddenInput();
  const doc = useLive((s) => s.docs['app/assess']);
  const a = useMemo(() => readAssess(doc), [doc]);
  const run = useAssessRun();
  const ai = useAiAvailable();
  const running = run.phase === 'locking' || run.phase === 'gathering' || run.phase === 'asking' || run.phase === 'saving';
  const same = a?.lang === lang;
  const d = a?.data;

  const renew = ai && (
    <div className="flex flex-wrap items-center gap-3">
      {running ? (
        <>
          <p role="status" className="text-sm text-muted" data-testid="assess-phase" data-ai-phase={run.aiPhase ?? run.phase}>
            {run.answers > 0 ? t('assessThinking', { n: run.answers }) : t('assessThinkingShort')}
            <span className="mt-1 block text-xs" data-testid="assess-duration">
              {run.aiPhase === 'slow' ? t('assessSlow') : t('assessDuration')}
            </span>
          </p>
          <Button variant="ghost" icon="stop" onClick={stopAssess} data-testid="assess-stop">
            {t('assessStop')}
          </Button>
        </>
      ) : (
        <Button variant={a ? 'secondary' : 'primary'} icon="sparkle" onClick={() => void runAssess('manual')} data-testid="assess-renew" data-ai="">
          {a ? t('assessRenew') : t('assessFirst')}
        </Button>
      )}
    </div>
  );

  const notes = (
    <>
      {run.phase === 'busy' && (
        <p className="text-sm text-muted" role="status" data-testid="assess-busy">
          {t('assessBusyOther')}
        </p>
      )}
      {run.phase === 'error' && (
        <p className="text-sm text-danger-text" role="status" data-testid="assess-error">
          {t('assessFailed')}
          {run.error && run.error !== 'assessFailed' ? ` ${t(run.error)}` : ''}
        </p>
      )}
    </>
  );

  if (!a || !d) {
    return (
      <div className="flex flex-col gap-4" data-testid="judge">
        <Card className="flex flex-col gap-4">
          {running ? <Skeleton className="h-10 w-40" /> : <p className="text-base text-muted">{t('assessNone')}</p>}
          {renew}
          {!ai && <p className="text-sm text-muted">{t('assessNoAi')}</p>}
          {notes}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="judge">
      <Card className="flex flex-col gap-4" aria-labelledby="judge-level">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p id="judge-level" className="lx-eyebrow">
              {t('assessOverall')}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-5xl font-semibold tracking-tight" data-testid="assess-cefr" data-cefr={d.cefr ?? ''}>
                {d.cefr ?? '–'}
              </span>
              {d.trend && (
                <span className="text-sm text-muted" data-testid="assess-trend" data-trend={d.trend}>
                  {t(TREND_KEY[d.trend])}
                </span>
              )}
            </p>
          </div>
          <InfoToggle label={t('assessInfoLabel')} text={t('assessInfo')} />
        </div>
        {same && d.level && <p className="text-base text-fg">{d.level}</p>}
        {!same && <p className="text-sm text-muted">{t('assessOtherLang')}</p>}
        <p className="text-xs text-subtle" data-testid="assess-stamp">
          {t('assessStamp', { date: date(dayMs(a.d)) })}
          {a.tier && a.tier !== 'complex' ? ` · ${t('assessLowerTier')}` : ''}
        </p>
        {renew}
        {!ai && <p className="text-sm text-muted">{t('assessNoAi')}</p>}
        {notes}
      </Card>

      {same && (d.levelWhy || d.trendWhy || d.today) && (
        <Card className="flex flex-col gap-3">
          {d.levelWhy && (
            <div>
              <h3 className="lx-eyebrow">{t('assessWhy')}</h3>
              <p className="mt-1 text-sm text-muted">{d.levelWhy}</p>
            </div>
          )}
          {d.trendWhy && (
            <div>
              <h3 className="lx-eyebrow">{t('assessTrendWhy')}</h3>
              <p className="mt-1 text-sm text-muted">{d.trendWhy}</p>
            </div>
          )}
          {d.today && (
            <div>
              <h3 className="lx-eyebrow">{t('assessTodayTip')}</h3>
              <p className="mt-1 text-sm text-muted">{d.today}</p>
            </div>
          )}
        </Card>
      )}

      <Card aria-labelledby="judge-dims">
        <h2 id="judge-dims" className="lx-eyebrow">
          {t('assessDims')}
        </h2>
        <ul className="mt-2 grid sm:grid-cols-2 sm:gap-x-6">
          {DIMS.map((id) => {
            const x = d.dims.find((y) => y.id === id) ?? { id, level: null, confidence: 'thin' as Confidence, why: null };
            return (
              <li key={id} className="flex flex-col gap-1 border-t border-line py-3" data-testid="dim" data-id={id} data-level={x.level ?? ''} data-confidence={x.confidence}>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{t(`dim_${id}` as MessageKey)}</span>
                  <span className={`text-lg font-semibold ${x.level ? '' : 'text-muted'}`}>{x.level ?? '–'}</span>
                </span>
                {x.level ? <Dots n={CONF_DOTS[x.confidence]} label={t(CONF_KEY[x.confidence])} /> : <span className="text-xs text-muted">{t('dimNoEvidence')}</span>}
                {same && x.level && x.why && <span className="text-xs text-subtle">{x.why}</span>}
              </li>
            );
          })}
        </ul>
      </Card>

      {same && d.focus && (
        <Card channel="grammar" aria-labelledby="judge-focus" data-testid="focus">
          <p id="judge-focus" className="lx-eyebrow">
            {t('focusTitle')} · {tn('focusDays', d.focus.days)}
          </p>
          <h3 className="mt-2 text-lg font-semibold">{d.focus.title}</h3>
          <p className="mt-1 text-sm text-muted">{d.focus.why}</p>
          <p className="mt-2 text-xs text-subtle">{t('focusNext')}</p>
          {actionRoute(d.focus.action) && d.focus.action && (
            <div className="mt-3">
              <Button icon="arrowRight" onClick={() => startAction(d.focus?.action ?? '', api)} data-testid="focus-practice">
                {t('practice')}
              </Button>
            </div>
          )}
        </Card>
      )}

      {same && d.strengths.length > 0 && (
        <Card aria-labelledby="judge-strengths">
          <h2 id="judge-strengths" className="lx-eyebrow">
            {t('assessStrengths')}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {d.strengths.map((s, i) => (
              <li key={i} data-testid="strength">
                <p className="text-sm font-medium">{s.title}</p>
                <p className="text-sm text-muted">{s.why}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {same && d.blockers.length > 0 && (
        <Card aria-labelledby="judge-blockers">
          <h2 id="judge-blockers" className="lx-eyebrow">
            {t('assessBlockers')}
          </h2>
          <ul className="mt-3 flex flex-col gap-5">
            {d.blockers.map((b, i) => (
              <li key={i} className="flex flex-col gap-2" data-testid="blocker">
                <p className="text-base font-semibold">{b.title}</p>
                <div>
                  <p className="text-xs text-subtle" data-label="">
                    {t('blockerWhyC1')}
                  </p>
                  <p className="text-sm text-muted">{b.why}</p>
                </div>
                {b.fix && (
                  <div>
                    <p className="text-xs text-subtle" data-label="">
                      {t('blockerFix')}
                    </p>
                    <EnglishText text={b.fix} area="lookup" source="assess" className="text-sm text-fg" />
                  </div>
                )}
                {actionRoute(b.action) && b.action && (
                  <div>
                    <Button icon="arrowRight" onClick={() => startAction(b.action ?? '', api)} data-testid="blocker-practice">
                      {t('practice')}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
