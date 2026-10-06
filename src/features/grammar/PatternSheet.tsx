import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { errorsOf, liveErrorsOf } from '../../domain/grammar/errors';
import { patternsOf } from '../../domain/grammar/patterns';
import type { Pattern, TopicPatterns } from '../../domain/grammar/patternTypes';
import { patsOf, patternState, type PatternState } from '../../domain/metrics/pattern';
import { EnglishText } from '../../engine/EnglishText';
import { useT, type MessageKey } from '../../i18n';
import { Button } from '../../ui/Button';
import { STATE_DOTS } from '../../ui/exercise';

// Themenblatt (Lernplattform 2.0 §5.5): ersetzt den Querschnitt des Regelblatts, wenn das Thema eine Musterdatei hat.
// Reihenfolge: „Das kannst du danach“ (canDo) und Muster-Chips mit Zustand → je Muster eine Karte in fester Reihenfolge
// (Name · Form · Wofür · Beispiele · Typischer Fehler mit deutscher Ursache · Nicht verwechseln · „Üben“) → eigene Fehler bei
// ihrem Muster → „So entscheidest du“. Schreibt nichts.

const WORD: Record<PatternState, MessageKey> = { new: 'exStateNew', learning: 'exStateLearning', safe: 'exStateSafe', firm: 'exStateFirm' };

function Dots({ state }: { state: PatternState }) {
  return (
    <span className="lx-dots" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="lx-dot" data-on={i < STATE_DOTS[state] || undefined} />
      ))}
    </span>
  );
}

export function PatternSheetBody({ topic, tp, onPractice, readOnly = false }: { topic: string; tp?: TopicPatterns | null; onPractice?: (patId: string) => void; readOnly?: boolean }) {
  const { t, lang } = useT();
  const day = useClock((s) => s.today);
  const doc = useLive((s) => s.collections.grammar?.get(topic));
  const data = tp ?? patternsOf(topic);
  if (!data) return null;
  const pats = patsOf(doc);
  const pick = (b: { de: string; en: string }): string => (lang === 'de' ? b.de : b.en);
  const states = data.patterns.map((p) => patternState(pats[p.id], day));
  const safe = states.filter((s) => s === 'safe' || s === 'firm').length;
  const errs = liveErrorsOf(doc, topic).filter((e) => e.done !== true);
  const byPat = (id: string) => errs.filter((e) => e.pat === id);
  const known = new Set(data.patterns.map((p) => p.id));
  const loose = errs.filter((e) => !(typeof e.pat === 'string' && known.has(e.pat)));
  const src = { area: 'trainer' as const, source: `grammar/${topic}` };
  const decide = lang === 'de' ? data.decide.de : data.decide.en;
  void errorsOf;

  const card = (p: Pattern, i: number) => {
    const state = states[i] ?? 'new';
    const own = byPat(p.id);
    return (
      <section key={p.id} className="lx-inset flex flex-col gap-3" data-testid="pattern-block" data-pat={p.id} data-state={state}>
        <header className="flex flex-col gap-1">
          <h3 className="lx-t-task">{pick(p.name)}</h3>
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-[var(--radius-inline)] bg-hint-soft px-1.5 text-hint-text" lang="en" data-testid="pattern-formula">
              {pick(p.form)}
            </span>
            <span className="lx-t-meta flex items-center gap-1.5 text-muted">
              <Dots state={state} />
              {t(WORD[state])}
            </span>
          </p>
        </header>
        <p className="lx-t-support" lang={lang}>
          <span className="font-semibold">{t('gxSheetUse')}: </span>
          {pick(p.use)}
        </p>
        {p.signals.length > 0 && (
          <p className="lx-t-meta text-muted" lang="en">
            <span lang={lang}>{t('gxSheetSignals')}: </span>
            {p.signals.join(' · ')}
          </p>
        )}
        <ul className="m-0 flex list-none flex-col gap-1 p-0" aria-label={t('gxSheetExamples')}>
          {p.ex.slice(0, 2).map((e) => (
            <li key={e.en}>
              <EnglishText as="span" className="lx-t-support" text={e.en} {...src} />
              {e.de && (
                <span className="lx-t-meta ml-2 text-muted" lang="de">
                  {e.de}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="lx-t-support flex flex-col gap-0.5" data-testid="pattern-trap">
          <span className="font-semibold">{t('gxSheetTrap')}</span>
          <span className="lx-diff-off" lang="en">
            {p.trap.bad}
          </span>
          <EnglishText as="span" className="font-semibold" text={p.trap.good} {...src} />
          <span className="text-muted" lang={lang}>
            {pick(p.trap.cause)}
          </span>
        </p>
        {p.contrast && (
          <p className="lx-t-support flex flex-col gap-0.5" data-testid="pattern-contrast">
            <span className="font-semibold">{t('gxSheetContrast')}</span>
            <span lang="en">
              {p.contrast.a} <span aria-hidden="true">≠</span> {p.contrast.b}
            </span>
            <span className="text-muted" lang={lang}>
              {pick(p.contrast.diff)}
            </span>
          </p>
        )}
        {own.length > 0 && (
          <div className="flex flex-col gap-1" data-testid="pattern-own-errors">
            <span className="lx-t-support font-semibold">{t('gxSheetOwn')}</span>
            {own.slice(-3).map((e) => (
              <span key={String(e.t)} className="lx-t-support" lang="en">
                <span className="lx-diff-off">{typeof e.given === 'string' && e.given.trim() ? e.given : '…'}</span>
                <span className="text-muted"> → </span>
                <span className="font-semibold">{typeof e.ans === 'string' ? e.ans : ''}</span>
              </span>
            ))}
          </div>
        )}
        {!readOnly && onPractice && (
          <div>
            <Button variant="secondary" iconAfter="arrowRight" onClick={() => onPractice(p.id)} data-testid="pattern-practice" data-pat={p.id}>
              {t('gxSheetPractice')}
            </Button>
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5" data-testid="pattern-sheet" data-topic={topic}>
      <section className="flex flex-col gap-2">
        <h3 className="lx-eyebrow">{t('gxSheetCanDo')}</h3>
        <p className="lx-t-body font-medium" lang={lang}>
          {pick(data.canDo)}
        </p>
        <p className="lx-t-meta text-muted" data-testid="pattern-safe-count">
          {t('gxSheetSafe', { n: safe, total: data.patterns.length })}
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {data.patterns.map((p, i) => (
            <li key={p.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1" data-testid="pattern-chip" data-state={states[i]}>
              <Dots state={states[i] ?? 'new'} />
              <span className="lx-t-support">{pick(p.name)}</span>
            </li>
          ))}
        </ul>
      </section>
      {data.patterns.map(card)}
      {loose.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="own-errors">
          <h3 className="lx-eyebrow">{t('gxSheetOwn')}</h3>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {loose.slice(-5).reverse().map((e) => (
              <li key={String(e.t)} className="lx-t-support flex flex-col gap-0.5">
                <span lang="en">{typeof e.q === 'string' ? e.q : ''}</span>
                <span>
                  <span className="lx-diff-off" lang="en">
                    {typeof e.given === 'string' && e.given.trim() ? e.given : '…'}
                  </span>
                  <span className="text-muted"> → </span>
                  <span className="font-semibold" lang="en">
                    {typeof e.ans === 'string' ? e.ans : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {decide.length > 0 && (
        <section className="flex flex-col gap-2" data-testid="pattern-decide">
          <h3 className="lx-eyebrow">{t('gxSheetDecide')}</h3>
          <ol className="m-0 flex list-decimal flex-col gap-1 pl-5 lx-t-support" lang={lang}>
            {decide.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
