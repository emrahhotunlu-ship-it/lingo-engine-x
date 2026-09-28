import type { ReactNode } from 'react';
import { useT } from '../i18n';
import { Button } from './Button';
import { Eyebrow } from './Eyebrow';

// Gemeinsames Ende einer Runde (N06, plan.md §4.10, Prototyp v1): Kacheln Richtig · Zeit · Neu,
// „Das nimmst du mit“ (antippbar – die Übung reicht antippbare Wörter herein), GENAU EIN nächster
// Schritt als gefüllter Knopf, optional ein ruhiger zweiter Weg. Kein Konfetti.
// <SessionEnd right={n} total={m} ms={…} newItems={string[]} takeaways={…} next={{ label, run }} />

export type SessionEndProps = {
  right: number;
  total: number;
  /** Aktive Zeit der Runde in ms. */
  ms: number;
  /** Neu hinzugekommene Karten/Wendungen (Anzeige, höchstens 8). */
  newItems?: string[];
  /** Was bleiben soll (z. B. 1–3 Wendungen oder ein Satz; Wörter antippbar über `EnglishText`). */
  takeaways?: ReactNode;
  /** Der eine Hauptknopf (z. B. „Weiter: Block 3“ oder „Zurück zu Heute“). */
  next: { label: string; run: () => void };
  /** Optional ein ruhiger zweiter Weg. */
  secondary?: { label: string; run: () => void };
  /** Überschrift (Standard „Geschafft“), z. B. „✓ Wiederholen geschafft“. */
  title?: string;
};

function Tile({ value, label, testId }: { value: ReactNode; label: string; testId: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[var(--radius-control)] bg-surface px-2 py-3 text-center" data-testid={testId}>
      <span className="lx-tnum text-xl font-semibold tracking-tight">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

export function SessionEnd({ right, total, ms, newItems = [], takeaways, next, secondary, title }: SessionEndProps) {
  const { t } = useT();
  const min = Math.max(1, Math.round(ms / 60_000));
  const shown = newItems.slice(0, 8);
  return (
    <section className="lx-card flex flex-col gap-4 p-[1.125rem]" data-testid="session-end" data-right={right} data-total={total}>
      <Eyebrow tone="accent">{title ?? t('nbShEndTitle')}</Eyebrow>
      <p className="sr-only" data-testid="session-end-score">
        {t('nbShEndScore', { right, total })} · {t('nbShEndMinutes', { min })}
      </p>
      <div className="grid grid-cols-3 gap-2" aria-hidden="true">
        <Tile value={`${right}/${total}`} label={t('nbShEndRight')} testId="session-end-right" />
        <Tile value={t('nbShEndMin', { min })} label={t('nbShEndTime')} testId="session-end-time" />
        <Tile value={newItems.length} label={t('nbShEndNewShort')} testId="session-end-newcount" />
      </div>
      {shown.length > 0 && (
        <div className="flex flex-col gap-2" data-testid="session-end-new">
          <Eyebrow>{t('nbShEndNew')}</Eyebrow>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {shown.map((w) => (
              <li key={w} className="inline-flex min-h-9 items-center rounded-full bg-surface-strong px-3 text-sm" lang="en">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      {takeaways && (
        <div className="flex flex-col gap-2" data-testid="session-end-takeaways">
          <Eyebrow>{t('nbShEndTakeaways')}</Eyebrow>
          {takeaways}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" iconAfter="arrowRight" onClick={next.run} data-testid="session-end-next" className="w-full sm:w-full">
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
