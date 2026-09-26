import type { ReactNode } from 'react';

// Rahmen mit den vier Pflichtfragen an fester Stelle (Kap. 2.4, Architektur-Entwurf §6.5):
// Was soll ich tun? · Wozu dient das? · Was hatte ich, was ist richtig? · Warum ist das so?

type Props = {
  ladder: ReactNode;
  task: ReactNode;
  purposeLabel: string;
  purpose: ReactNode;
  body: ReactNode;
  actions?: ReactNode;
  resultLabel: string;
  result?: ReactNode;
  whyLabel: string;
  why?: ReactNode;
  rating?: ReactNode;
  footer?: ReactNode;
  /** Kennzeichen für Tests und Diagnose (Übungsart, Karte, Kollokation). */
  meta?: { ex: string; card: string; col?: number | undefined };
};

export function ExerciseFrame({ ladder, task, purposeLabel, purpose, body, actions, resultLabel, result, whyLabel, why, rating, footer, meta }: Props) {
  return (
    <article className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7" data-testid="exercise" data-ex={meta?.ex} data-card={meta?.card} data-col={meta?.col}>
      <header className="flex flex-col gap-3">
        {ladder}
        <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task">
          {task}
        </h2>
        <p className="text-sm text-muted" data-testid="purpose">
          <span className="font-medium text-fg">{purposeLabel}</span> {purpose}
        </p>
      </header>
      <div className="flex flex-col gap-4">{body}</div>
      {actions}
      {result && (
        <section aria-label={resultLabel} className="flex flex-col gap-2 border-t border-line pt-4" data-testid="result">
          {result}
        </section>
      )}
      {why && (
        <section aria-label={whyLabel} className="flex flex-col gap-1.5" data-testid="why">
          <p className="lx-eyebrow">{whyLabel}</p>
          {why}
        </section>
      )}
      {rating}
      {footer && <footer className="text-xs text-subtle">{footer}</footer>}
    </article>
  );
}
