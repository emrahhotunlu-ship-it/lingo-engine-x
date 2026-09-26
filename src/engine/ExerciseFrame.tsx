import { useId, useState, type ReactNode } from 'react';
import { Icon } from '../ui/Icon';

// Rahmen einer Übung (Kap. 2.4 in der Fassung von CLAUDE.md A7 „Emrahs Rückmeldung"):
// oben der Status (Sicherheit, Abfrageart), dann die Aufgabe in einer kurzen Zeile –
// „Wozu?" nur hinter dem Info-Symbol –, die Aufgabe selbst, nach dem Prüfen Ergebnis
// (Was hatte ich, was ist richtig?) und Hilfe (Bedeutung, Form, Beispiele) und „Weiter".

type Props = {
  status: ReactNode;
  task: ReactNode;
  infoLabel: string;
  purpose: ReactNode;
  body: ReactNode;
  actions?: ReactNode;
  resultLabel: string;
  result?: ReactNode;
  /** Meta für Tests und Diagnose (Übungsart, Karte, Kollokation, Stufe). */
  meta?: { ex: string; card: string; col?: number | undefined; stage?: number | undefined };
};

export function ExerciseFrame({ status, task, infoLabel, purpose, body, actions, resultLabel, result, meta }: Props) {
  const [info, setInfo] = useState(false);
  const infoId = useId();
  return (
    <article
      className="lx-glass flex flex-col gap-5 rounded-[var(--radius-card)] p-5 sm:p-7"
      data-testid="exercise"
      data-ex={meta?.ex}
      data-card={meta?.card}
      data-col={meta?.col}
      data-stage={meta?.stage}
    >
      <header className="flex flex-col gap-2">
        {status}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight sm:text-xl" data-testid="task">
            {task}
          </h2>
          <button
            type="button"
            className="-m-2 inline-flex size-11 flex-none items-center justify-center rounded-full text-subtle transition-colors hover:text-fg"
            aria-label={infoLabel}
            aria-expanded={info}
            aria-controls={infoId}
            onClick={() => setInfo((v) => !v)}
            data-testid="purpose-info"
          >
            <Icon name="info" size={18} />
          </button>
        </div>
        {info && (
          <p id={infoId} className="text-sm text-muted" data-testid="purpose">
            {purpose}
          </p>
        )}
      </header>
      <div className="flex flex-col gap-4">{body}</div>
      {actions}
      {result && (
        <section aria-label={resultLabel} className="flex flex-col gap-3 border-t border-line pt-4" data-testid="result">
          {result}
        </section>
      )}
    </article>
  );
}
