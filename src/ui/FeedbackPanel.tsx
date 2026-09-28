import { useState } from 'react';
import { useT } from '../i18n';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { topFixes, topUpgrades, type Feedback, type Upgrade } from './feedback/types';
import { WhyLink } from './WhyLink';

// Gemeinsame Rückmeldung nach dem Prüfen (N05, plan.md §4.10, Lehrer-Rückmeldestil):
// 1. Urteil mit Symbol, dann die Wirkung in einem Satz.
// 2. Erst Hinweis (`retryHint`) + zweiter Versuch, dann die Lösung.
// 3. Höchstens 3 Korrekturen, sortiert Bedeutung > Falle > Ziel > Form (sortiert und kappt selbst).
// 4. Höchstens 2 Aufwertungen mit „Merken“.
// 5. „Nochmal, aber besser“ und „Warum?“ (N07, ohne KI unsichtbar).
// Prüfbefund M9: Nach JEDEM Versuch – auch bei `ok` – stehen Lösung und `Fix.why` (Kap. 2.4); nur
// „Deine Antwort“ entfällt bei `ok`. Farbe nur als Streifen + Symbol, nie als Fläche (N05).

export type FeedbackPanelProps = {
  fb: Feedback;
  onNext?: () => void;
  /** Beschriftung des Weiter-Knopfs (Standard „Weiter“). */
  nextLabel?: string;
  /**
   * „Warum?“ selbst behandeln (sonst öffnet `WhyLink` das Claude-Blatt auf „Fragen“ mit
   * `fb.why.question`).
   */
  onWhy?: (question: string) => void;
  /** „Merken“ an einer Aufwertung (z. B. als Karte speichern); ohne Angabe kein Knopf. */
  onKeep?: (u: Upgrade) => void;
  testId?: string;
};

type Tone = { key: 'nbShFbOk' | 'nbShFbClose' | 'nbShFbWrong' | 'nbShFbUnchecked'; icon: IconName; stripe: string; text: string };

const TONE: Record<Feedback['verdict'], Tone> = {
  ok: { key: 'nbShFbOk', icon: 'check', stripe: 'var(--lx-accent)', text: 'text-accent-text' },
  close: { key: 'nbShFbClose', icon: 'alert', stripe: 'var(--lx-gold-text)', text: 'text-gold-text' },
  wrong: { key: 'nbShFbWrong', icon: 'close', stripe: 'var(--lx-danger-text)', text: 'text-danger-text' },
  unchecked: { key: 'nbShFbUnchecked', icon: 'info', stripe: 'var(--lx-fg-subtle)', text: 'text-muted' },
};

export function FeedbackPanel({ fb, onNext, nextLabel, onWhy, onKeep, testId = 'feedback' }: FeedbackPanelProps) {
  const { t } = useT();
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set());
  const fixes = topFixes(fb.fixes);
  const upgrades = topUpgrades(fb.upgrades);
  const tone = TONE[fb.verdict];
  // Hinweis-Phase: noch keine Lösung, ein zweiter Versuch ist offen.
  const hintPhase = !!fb.retryHint && !fb.solution && fb.verdict !== 'ok';
  const question = fb.why?.question ?? '';
  return (
    <section
      className="lx-card flex flex-col gap-3 p-4"
      style={{ boxShadow: `inset 3px 0 0 0 ${tone.stripe}` }}
      data-testid={testId}
      data-verdict={fb.verdict}
      data-phase={hintPhase ? 'hint' : 'solution'}
      aria-live="polite"
    >
      <div className="flex flex-col gap-1">
        <p className={`m-0 flex items-center gap-2 text-base font-semibold ${tone.text}`} data-testid="feedback-verdict">
          <Icon name={tone.icon} size={18} />
          <span className="text-fg">{t(tone.key)}</span>
        </p>
        {fb.effect && (
          <p className="m-0 text-[0.9375rem] text-muted" data-testid="feedback-effect">
            {fb.effect}
          </p>
        )}
      </div>
      {fb.retryHint && (
        <p className="m-0 text-[0.9375rem]" data-testid="feedback-hint">
          <span className="font-semibold">{t('nbShFbHint')}: </span>
          {fb.retryHint}
        </p>
      )}
      {fb.mine && fb.verdict !== 'ok' && (
        <p className="m-0 text-[0.9375rem]" data-testid="feedback-mine">
          <span className="text-muted">{t('nbShFbMine')}: </span>
          <span lang="en">{fb.mine}</span>
        </p>
      )}
      {fb.solution && (
        <p className="m-0 text-[0.9375rem]" data-testid="feedback-solution">
          <span className="text-muted">{t('nbShFbSolution')}: </span>
          <span className="font-semibold" lang="en">
            {fb.solution}
          </span>
        </p>
      )}
      {fixes.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-2.5 p-0" data-testid="feedback-fixes" aria-label={t('nbShFbFixes')}>
          {fixes.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="flex gap-2.5 text-[0.9375rem]" data-kind={f.kind} data-trap={f.trapId}>
              <span className="lx-tnum w-4 flex-none text-subtle">{fixes.length > 1 ? `${i + 1}.` : '·'}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span lang="en">
                  {/* Bei richtiger Antwort (M9) steht nur die richtige Form mit Begründung. */}
                  {f.mine && f.mine !== f.right && (
                    <>
                      <span className="text-muted line-through decoration-danger-text/60">{f.mine}</span>
                      {' → '}
                    </>
                  )}
                  <span className="font-semibold">{f.right}</span>
                </span>
                <span className="text-sm text-muted" data-testid="feedback-why-text">
                  {f.why}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
      {upgrades.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3" data-testid="feedback-upgrades">
          <p className="lx-eyebrow m-0 text-subtle">{t('nbShFbUpgrades')}</p>
          {upgrades.map((u, i) => {
            const done = kept.has(u.to);
            return (
              <div key={i} className="flex items-start justify-between gap-3 text-[0.9375rem]" data-testid="feedback-upgrade">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span lang="en">{u.to}</span>
                  {u.note && <span className="text-sm text-muted">{u.note}</span>}
                </span>
                {onKeep && (
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => {
                      onKeep(u);
                      setKept((s) => new Set(s).add(u.to));
                    }}
                    className={`inline-flex min-h-9 flex-none items-center gap-1 rounded-full px-3 text-xs font-semibold ${done ? 'text-muted' : 'bg-accent-soft text-accent-text'}`}
                    data-testid="feedback-keep"
                  >
                    {done ? t('nbShFbKept') : t('nbShFbKeep')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
      {(onNext || fb.again || question) && (
        <div className="flex flex-col gap-2 pt-1">
          {onNext && (
            <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={onNext} data-testid="next" className="w-full sm:w-full">
              {nextLabel ?? t('nbShNext')}
            </Button>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {fb.again && (
              <Button variant="secondary" icon="refresh" onClick={fb.again} data-testid="feedback-again">
                {hintPhase ? t('nbShFbRetry') : t('nbShFbAgain')}
              </Button>
            )}
            {question &&
              (onWhy ? (
                <Button variant="ghost" icon="sparkle" onClick={() => onWhy(question)} data-testid="feedback-why">
                  {t('nbShFbWhy')}
                </Button>
              ) : (
                <WhyLink question={question} />
              ))}
          </div>
        </div>
      )}
    </section>
  );
}
