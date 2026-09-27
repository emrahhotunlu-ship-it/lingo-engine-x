import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { Button } from './Button';

// Gemeinsames Ende einer Runde (docs/neubau/plan.md §4.10, N06). WP0a: Vertrag mit den
// endgültigen Eigenschaften und schlichter Darstellung; die Optik nach v1 folgt in WP0b.
// <SessionEnd right={n} total={m} ms={…} newItems={string[]} takeaways={…} next={{ label, run }} />

export type SessionEndProps = {
  right: number;
  total: number;
  /** Aktive Zeit der Runde in ms. */
  ms: number;
  /** Neu hinzugekommene Karten/Wendungen (Anzeige, höchstens einige). */
  newItems?: string[];
  /** Was bleiben soll (z. B. 1–3 Wendungen oder ein Satz). */
  takeaways?: ReactNode;
  /** Der eine Hauptknopf (z. B. „Weiter: Block 3“ oder „Zurück zu Heute“). */
  next: { label: string; run: () => void };
  /** Optional ein ruhiger zweiter Weg. */
  secondary?: { label: string; run: () => void };
};

export function SessionEnd({ right, total, ms, newItems = [], takeaways, next, secondary }: SessionEndProps) {
  const { t } = useT();
  const min = Math.max(1, Math.round(ms / 60_000));
  return (
    <section className="flex flex-col gap-4" data-testid="session-end" data-right={right} data-total={total}>
      <h2 className="text-2xl font-semibold tracking-tight">{t('nbShEndTitle')}</h2>
      <p className="lx-tnum text-muted" data-testid="session-end-score">
        {t('nbShEndScore', { right, total })} · {t('nbShEndMinutes', { min })}
      </p>
      {newItems.length > 0 && (
        <div className="flex flex-col gap-1" data-testid="session-end-new">
          <p className="lx-eyebrow">{t('nbShEndNew')}</p>
          <ul className="flex flex-wrap gap-2">
            {newItems.slice(0, 8).map((w) => (
              <li key={w} className="lx-chip">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      {takeaways && (
        <div className="flex flex-col gap-1" data-testid="session-end-takeaways">
          <p className="lx-eyebrow">{t('nbShEndTakeaways')}</p>
          {takeaways}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="primary" size="lg" onClick={next.run} data-testid="session-end-next">
          {next.label}
        </Button>
        {secondary && (
          <Button variant="ghost" onClick={secondary.run} data-testid="session-end-secondary">
            {secondary.label}
          </Button>
        )}
      </div>
    </section>
  );
}
