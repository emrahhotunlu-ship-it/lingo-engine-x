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
import { AiRunPanel } from '../../ui/AiRunPanel';
import { TitleActions } from '../system/Chrome';
import { FocusList, TrendLine } from './parts';
import { PatternDrill } from './PatternDrill';
import { isRunning, recognizePatterns, stopPatterns, usePatternsRun } from './store';
import { usePatternData } from './usePatternData';
import { TRAPS, trapById } from '../../content/nb/traps';

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
  // Startsatz-Falle (N43): ohne eigene Muster und ohne KI übbar.
  const startTrap = id && !active ? trapById(id) : null;
  const running = isRunning(run.phase);
  const close = () => (active || startTrap ? go({ name: 'patterns' }) : go({ name: 'overview' }));
  useHotkeys({ escape: close }, () => false);

  const recognize = () => void recognizePatterns({ refresh: run.phase === 'error' });

  return (
    <motion.section
      className="flex flex-col gap-5 py-4 sm:py-8"
      data-testid="patterns"
      data-view={active || startTrap ? 'drill' : 'list'}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: DURATION.base, ease: EASE_OUT }}
      aria-labelledby={`${infoId}-title`}
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <IconButton icon={active || startTrap ? 'arrowLeft' : 'close'} label={active || startTrap ? t('ptDrillBack') : t('ptClose')} onClick={close} data-testid="patterns-close" className="-ml-2" />
          <span className="inline-block h-4 w-0.5 rounded-full" style={{ background: 'var(--lx-ch-grammar)' }} aria-hidden="true" />
          <h1 id={`${infoId}-title`} className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
            {active ? (lang === 'en' ? active.title_en : active.title_de) : startTrap ? startTrap.title[lang] : t('ptTitle')}
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
          <TitleActions />
        </div>
        {active || startTrap ? (
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
        {startTrap ? (
          <PatternDrill key={startTrap.id} pattern={null} trapId={startTrap.id} all={items} mistakes={data.mistakes} rule={startTrap.why[lang]} onDone={() => go({ name: 'patterns' })} />
        ) : active && doc ? (
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

            {!running && (
              <section className="flex flex-col gap-2" data-testid="patterns-start" aria-labelledby={`${infoId}-start`}>
                <h2 id={`${infoId}-start`} className="lx-eyebrow">
                  {t('nbLernenStartSet')}
                </h2>
                <p className="text-sm text-muted">{t('nbLernenStartSetLead')}</p>
                <ul className="lx-glass flex flex-col divide-y divide-line overflow-hidden rounded-[var(--radius-card)]">
                  {TRAPS.map((tr) => (
                    <li key={tr.id}>
                      <button type="button" onClick={() => go({ name: 'patterns', id: tr.id })} data-testid={`pattern-start-${tr.id}`} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-strong">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-medium">{tr.title[lang]}</span>
                          <span className="text-sm text-muted">{tr.why[lang]}</span>
                        </span>
                        <Icon name="arrowRight" size={16} className="flex-none text-subtle" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
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
