import type { ReactNode } from 'react';

// Blockliste der Tageseinheit (Prototyp v1 `.steps`): Punkt · Name mit kurzem Grund · Minuten.
// Zustand je Zeile ✓ erledigt · jetzt · offen – ein erledigter Schritt ist Zustand, kein Knopf
// (Kap. 2.2). Der Zustand steht nie nur in der Farbe: Symbol/Rahmen und Text für Vorleseprogramme.

export type StepState = 'done' | 'now' | 'open';

export type StepItem = {
  id: string;
  title: ReactNode;
  sub?: ReactNode;
  /** Rechts, z. B. „6 Min.“. */
  meta?: ReactNode;
  state: StepState;
};

type Props = {
  items: readonly StepItem[];
  /** Vorlesetext je Zustand (z. B. { done: 'erledigt', now: 'jetzt', open: 'offen' }). */
  stateLabels: Record<StepState, string>;
  label?: string;
  testId?: string;
};

const DOT: Record<StepState, string> = {
  done: 'border-ok bg-ok',
  now: 'border-accent shadow-[0_0_0_4px_var(--lx-accent-soft)]',
  open: 'border-subtle',
};

export function Steps({ items, stateLabels, label, testId = 'steps' }: Props) {
  return (
    <ol className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label={label} data-testid={testId}>
      {items.map((s) => (
        <li key={s.id} className="grid grid-cols-[1.375rem_1fr_auto] items-baseline gap-2.5 text-sm" data-state={s.state} data-step={s.id} aria-current={s.state === 'now' ? 'step' : undefined}>
          <span className={`inline-block size-3 translate-y-px rounded-full border-2 ${DOT[s.state]}`} aria-hidden="true" />
          <span className="flex min-w-0 flex-col">
            <span className={`font-semibold ${s.state === 'done' ? 'text-muted' : ''}`}>
              {s.title}
              <span className="sr-only"> · {stateLabels[s.state]}</span>
            </span>
            {s.sub && <span className="text-xs leading-snug text-muted">{s.sub}</span>}
          </span>
          {s.meta !== undefined ? <span className="lx-tnum text-xs whitespace-nowrap text-subtle">{s.meta}</span> : <span />}
        </li>
      ))}
    </ol>
  );
}
