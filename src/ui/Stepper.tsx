import { Icon } from './Icon';

// Schritte einer Einheit (Plan §6.1/§6.2): erledigte Schritte sind Zustand mit Häkchen, nie ein
// Knopf (Kap. 2.2). Der aktuelle Schritt ist hervorgehoben; Text statt nur Farbe.

export type StepItem = { id: string; label: string; state: 'done' | 'current' | 'todo' };

export function Stepper({ steps, label }: { steps: readonly StepItem[]; label: string }) {
  return (
    <ol aria-label={label} className="flex flex-wrap items-center gap-x-1 gap-y-2" data-testid="stepper">
      {steps.map((s, i) => (
        <li
          key={s.id}
          data-testid="step"
          data-step={s.id}
          data-state={s.state}
          aria-current={s.state === 'current' ? 'step' : undefined}
          className="flex items-center gap-1"
        >
          <span
            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
              s.state === 'current' ? 'bg-surface-strong text-fg' : s.state === 'done' ? 'text-accent-text' : 'text-subtle'
            }`}
          >
            {s.state === 'done' ? <Icon name="check" size={14} /> : <span aria-hidden="true">{i + 1}</span>}
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span aria-hidden="true" className="text-subtle">
              ·
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
