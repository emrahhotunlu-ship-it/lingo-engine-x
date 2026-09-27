import { useT } from '../i18n';
import { Button } from './Button';
import { topFixes, topUpgrades, type Feedback } from './feedback/types';

// Gemeinsame Rückmeldung nach dem Prüfen (docs/neubau/plan.md §4.10, N05). WP0a: Vertrag mit den
// endgültigen Eigenschaften und schlichter Darstellung; die Optik nach v1 und „Warum?“ (WhyLink,
// N07) folgen in WP0b. Sortiert und kappt selbst: ≤ 3 Korrekturen, ≤ 2 Verbesserungen.
// Prüfbefund M9: Nach JEDEM Versuch – auch bei `ok` – stehen Lösung und `Fix.why` (Begründung auch
// bei richtiger Antwort, Kap. 2.4); nur „Deine Antwort“ entfällt bei `ok`.

export type FeedbackPanelProps = {
  fb: Feedback;
  onNext?: () => void;
  /** Beschriftung des Weiter-Knopfs (Standard „Weiter“). */
  nextLabel?: string;
  /** „Warum?“ – öffnet das Claude-Blatt mit `fb.why.question` (P6 verdrahtet es). */
  onWhy?: (question: string) => void;
};

const VERDICT = { ok: 'nbShFbOk', close: 'nbShFbClose', wrong: 'nbShFbWrong', unchecked: 'nbShFbUnchecked' } as const;

export function FeedbackPanel({ fb, onNext, nextLabel, onWhy }: FeedbackPanelProps) {
  const { t } = useT();
  const fixes = topFixes(fb.fixes);
  const upgrades = topUpgrades(fb.upgrades);
  return (
    <section className="flex flex-col gap-3" data-testid="feedback" data-verdict={fb.verdict} aria-live="polite">
      <p className="font-semibold" data-testid="feedback-verdict">
        {t(VERDICT[fb.verdict])}
      </p>
      {fb.effect && <p className="text-sm text-muted">{fb.effect}</p>}
      {fb.mine && fb.verdict !== 'ok' && (
        <p className="text-sm" data-testid="feedback-mine">
          <span className="text-muted">{t('nbShFbMine')}: </span>
          {fb.mine}
        </p>
      )}
      {fb.solution && (
        <p className="text-sm" data-testid="feedback-solution">
          <span className="text-muted">{t('nbShFbSolution')}: </span>
          <span className="font-medium">{fb.solution}</span>
        </p>
      )}
      {fixes.length > 0 && (
        <ul className="flex flex-col gap-2" data-testid="feedback-fixes">
          {fixes.map((f, i) => (
            <li key={`${f.kind}-${i}`} className="text-sm" data-kind={f.kind}>
              {/* Bei richtiger Antwort (M9) steht nur die richtige Form mit Begründung. */}
              {f.mine && f.mine !== f.right && (
                <>
                  <span className="line-through decoration-danger-text/60">{f.mine}</span>
                  {' → '}
                </>
              )}
              <span className="font-medium">{f.right}</span>
              <span className="block text-muted">{f.why}</span>
            </li>
          ))}
        </ul>
      )}
      {upgrades.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="feedback-upgrades">
          <p className="lx-eyebrow">{t('nbShFbUpgrades')}</p>
          {upgrades.map((u, i) => (
            <p key={i} className="text-sm">
              {u.to}
              {u.note && <span className="block text-muted">{u.note}</span>}
            </p>
          ))}
        </div>
      )}
      {fb.retryHint && <p className="text-sm text-muted">{fb.retryHint}</p>}
      <div className="flex flex-wrap items-center gap-3">
        {onNext && (
          <Button variant="primary" onClick={onNext} data-testid="next">
            {nextLabel ?? t('nbShNext')}
          </Button>
        )}
        {fb.again && (
          <Button variant="secondary" onClick={fb.again} data-testid="feedback-again">
            {t('nbShFbAgain')}
          </Button>
        )}
        {fb.why && onWhy && (
          <Button variant="ghost" onClick={() => onWhy(fb.why?.question ?? '')} data-testid="feedback-why">
            {t('nbShFbWhy')}
          </Button>
        )}
      </div>
    </section>
  );
}
