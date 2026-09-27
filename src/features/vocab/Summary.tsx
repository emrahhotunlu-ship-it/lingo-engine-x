import { useT } from '../../i18n';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/Icon';
import { useHotkeys } from '../../engine/useHotkeys';
import { useHiddenInput } from '../../engine/HiddenInput';
import { usePending, retryFailed } from './persist';
import { useSession } from './session';
import { SummaryActions } from '../learn/ui';

// Zusammenfassung am Rundenende: Anzahl, Trefferquote, nicht Gespeichertes mit „Erneut speichern".

export function Summary({ onBack }: { onBack: () => void }) {
  const { t, tn } = useT();
  const api = useHiddenInput();
  const results = useSession((s) => s.results);
  const round = useSession((s) => s.round);
  const cards = useSession((s) => s.cards);
  const failedCards = usePending((s) => s.failedCards);
  const failed = usePending((s) => s.failed);
  useHotkeys({ enter: onBack }, api.isInput);
  const n = results.length;
  const right = results.filter((r) => r.ok).length;
  const pct = n ? Math.round((right / n) * 100) : 0;
  // Je Wort ein Chip (auch wenn es in der Runde mehrfach kam); rot, sobald ein Versuch falsch war.
  const chips = [...results.reduce((m, r) => m.set(r.key, { key: r.key, word: r.word, ok: (m.get(r.key)?.ok ?? true) && r.ok }), new Map<string, { key: string; word: string; ok: boolean }>()).values()];
  const seeds = new Map<string, Record<string, unknown>>();
  for (const c of cards.values()) if (!c.inDb) seeds.set(c.id, { ...c.doc });
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="summary">
      <header className="flex items-start gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-text">
          <Icon name="check" size={22} />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{n ? t('sumTitle') : t('sumEmpty')}</h2>
          {n > 0 && (
            <p className="lx-tnum text-base text-muted" data-testid="summary-stats">
              {t('sumStats', { n, pct })}
            </p>
          )}
          {round === 'pflicht' && n > 0 && <p className="text-sm text-accent-text">{t('sumDoneToday')}</p>}
        </div>
      </header>
      {n > 0 && (
        <ul className="flex flex-wrap gap-2" lang="en">
          {chips.map((r) => (
            <li key={r.key} className={`rounded-full border px-3 py-1 text-sm ${r.ok ? 'border-line text-fg' : 'border-line text-danger-text'}`} data-testid="summary-chip" data-ok={r.ok ? '' : undefined}>
              {r.word}
            </li>
          ))}
        </ul>
      )}
      {(failedCards.length > 0 || failed) && (
        <div className="flex flex-col gap-2 rounded-xl bg-danger-soft p-3" role="alert">
          <p className="text-sm">{failedCards.length ? tn('sumNotSaved', failedCards.length) : t('tdNotSaved')}</p>
          <div>
            <Button onClick={() => void retryFailed(seeds)} icon="refresh">
              {t('tdRetrySave')}
            </Button>
          </div>
        </div>
      )}
      {/* M11: „Weiter: nächster Pflichtschritt" – sonst „Zurück zu Heute". */}
      <SummaryActions onBack={onBack} />
    </article>
  );
}
