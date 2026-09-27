import { motion } from 'framer-motion';
import { useId, useState } from 'react';
import { useAiAvailable } from '../../ai/scope';
import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { dayKeyNoon } from '../../domain/date';
import type { Pattern, PatternsDoc } from '../../domain/patterns/patterns';
import { useT } from '../../i18n';
import { Button, IconButton } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Icon } from '../../ui/Icon';
import { DURATION, EASE_OUT } from '../../ui/motion';
import { Skeleton } from '../../ui/Skeleton';
import { useHotkeys } from '../../engine/useHotkeys';
import { AiRunPanel } from '../input/AiRunPanel';
import { FocusList, TrendLine } from './parts';
import { PatternDrill } from './PatternDrill';
import { isRunning, recognizePatterns, stopPatterns, usePatternsRun } from './store';
import { usePatternData } from './usePatternData';

// „Deine Deutsch-Fallen“ (Lernberatung 27.09., V3): Wochenfokus, höchstens 8 Muster mit Regel,
// eigenem Beispiel und Verlauf („letzte Woche 3× → diese Woche 1×“, lokal gezählt), je Muster
// ein Kurzdrill. Neu erkannt wird nur auf Knopfdruck (bzw. einmal je Woche aus „Dein Stand“).

const ruleOf = (doc: PatternsDoc, p: Pattern, lang: 'de' | 'en'): string | null => (!doc.lang || doc.lang === lang ? p.rule || null : null);

export function PatternsScreen() {
  const { t, lang, date } = useT();
  const route = useNav((s) => s.route);
  const go = useNav((s) => s.go);
  const today = useClock((s) => s.today);
  const ai = useAiAvailable();
  const data = usePatternData();
  const run = usePatternsRun();
  const [info, setInfo] = useState(false);
  const infoId = useId();
  const id = route.name === 'patterns' ? route.id : undefined;
  const doc = data.doc;
  const items = doc?.items ?? [];
  const active = id ? items.find((p) => p.id === id) : undefined;
  const running = isRunning(run.phase);
  const close = () => (active ? go({ name: 'patterns' }) : go({ name: 'overview' }));
  useHotkeys({ escape: close }, () => false);

  const recognize = () => void recognizePatterns({ refresh: run.phase === 'error' });

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="patterns"
      data-view={active ? 'drill' : 'list'}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={active ? 'arrowLeft' : 'close'} label={active ? t('ptDrillBack') : t('ptClose')} onClick={close} data-testid="patterns-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: 'var(--lx-ch-grammar)' }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {active ? (lang === 'en' ? active.title_en : active.title_de) : t('ptTitle')}
          </h1>
          <button
            type="button"
            className="inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={t('ptInfo')}
            aria-expanded={info}
            aria-controls={`${infoId}-purpose`}
            onClick={() => setInfo((v) => !v)}
            data-testid="patterns-info"
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {active ? (
          <p className="lx-tnum text-xs font-medium text-muted">
            {t('ptKind')} · {t('ptDrillTitle')}
          </p>
        ) : (
          <p className="text-sm text-muted">{t('ptLead')}</p>
        )}
        {info && (
          <p id={`${infoId}-purpose`} className="text-sm text-muted" data-testid="patterns-purpose">
            {t('ptPurpose')}
          </p>
        )}
      </header>

      <div className="flex max-w-3xl flex-col gap-4">
        {active && doc ? (
          <PatternDrill key={active.id} pattern={active} all={items} mistakes={data.mistakes} rule={ruleOf(doc, active, lang)} onDone={() => go({ name: 'patterns' })} />
        ) : data.status === 'loading' && !doc ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <>
            {running && <AiRunPanel phase={run.phase === 'reading' || run.phase === 'saving' ? 'thinking' : run.phase} error={null} onStop={stopPatterns} />}
            {!running && run.error && (
              <p className={`text-sm ${run.error === 'patternsFew' ? 'text-muted' : 'text-danger-text'}`} role="alert" data-testid="patterns-error" data-error={run.error}>
                {t(run.error)}
              </p>
            )}

            {!running && data.focus.length > 0 && (
              <Card channel="speak" className="flex flex-col gap-2" data-testid="patterns-focus">
                <p className="lx-eyebrow">{t('ptFocusTitle')}</p>
                <FocusList points={data.focus} />
                <p className="text-xs text-subtle">{t('ptFocusLead')}</p>
              </Card>
            )}

            {!running && doc && items.length > 0 && (
              <ul className="flex flex-col gap-3" data-testid="patterns-list">
                {items.map((p) => {
                  const rule = ruleOf(doc, p, lang);
                  const ex = p.examples[0];
                  return (
                    <li key={p.id}>
                      <Card channel="grammar" as="article" className="flex flex-col gap-3" data-testid="pattern" data-id={p.id}>
                        <div className="flex flex-col gap-1">
                          <h2 className="text-base font-semibold tracking-tight">{lang === 'en' ? p.title_en : p.title_de}</h2>
                          <TrendLine doc={doc} id={p.id} today={today} testId="pattern-trend" />
                        </div>
                        {rule ? (
                          <p className="text-sm leading-relaxed" data-testid="pattern-rule">
                            {rule}
                          </p>
                        ) : (
                          p.rule && <p className="text-xs text-subtle">{t('ptRuleOnly', { lang: doc.lang === 'en' ? t('cmpLangEn') : t('cmpLangDe') })}</p>
                        )}
                        {ex && (
                          <p className="text-sm leading-relaxed" lang="en" data-testid="pattern-example">
                            <span className="text-muted">{t('ptExample')}: </span>
                            <span className="lx-diff-off">{ex.wrong}</span>
                            <span className="text-muted"> → </span>
                            <strong className="font-semibold">{ex.right}</strong>
                          </p>
                        )}
                        <div>
                          <Button variant="secondary" icon="target" onClick={() => go({ name: 'patterns', id: p.id })} data-testid="pattern-practice">
                            {t('ptPractice')}
                          </Button>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}

            {!running && (!doc || !items.length) && (
              <p className="text-sm text-muted" data-testid="patterns-empty">
                {t('ptEmpty')}
              </p>
            )}

            {!running && (
              <div className="flex flex-wrap items-center gap-3">
                {ai ? (
                  <Button variant={items.length ? 'secondary' : 'primary'} icon="sparkle" onClick={recognize} data-testid="patterns-recognize" data-ai="">
                    {items.length ? t('ptRecognizeAgain') : t('ptRecognize')}
                  </Button>
                ) : (
                  <p className="text-sm text-muted">{t('ptNoAi')}</p>
                )}
                {doc?.d && items.length > 0 && <p className="text-xs text-subtle">{t('ptUpdated', { date: date(dayKeyNoon(doc.d)) })}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </motion.section>
  );
}
