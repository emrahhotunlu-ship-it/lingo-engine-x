import { ActionBar } from './ActionBar';

// Die Noten stehen in der festen Aktionsleiste unten (4 Knöpfe, je ≥ 44 px), der Hinweis darüber im Inhalt.
// Hülle der Bewertungsknöpfe im Aufdecken-Modus (Prototyp v1 `.grades`, architektur.md §4.1):
// Nochmal · Schwer · Gut · Leicht, je mit Intervall; der Vorschlag der App ist hervorgehoben.
// Nur Darstellung – Tasten 1–4, Wischen, Vorschlag und Speichern gehören P3 (anki-regeln.md).
// Zwei Knöpfe (N30): „Nicht gewusst“ = 1 und „Gewusst“ = Vorschlag.

export type Grade = 1 | 2 | 3 | 4;

export type GradeOption = {
  grade: Grade;
  label: string;
  /** Intervall („1 Min.“, „3 Tage“), aus `formatInterval` von P3. */
  interval?: string;
};

type Props = {
  options: readonly GradeOption[];
  /** Vorschlag der App (hervorgehoben, nie „Nochmal“). */
  suggest?: Grade | null;
  onGrade: (grade: Grade) => void;
  label: string;
  /** Satz unter den Knöpfen („Vorschlag aus deiner Antwortzeit: Gut · Wischen: …“). */
  note?: string;
  disabled?: boolean;
  testId?: string;
};

export function GradeButtons({ options, suggest = null, onGrade, label, note, disabled, testId = 'grades' }: Props) {
  const cols = options.length <= 2 ? 'grid-cols-2' : 'grid-cols-4';
  return (
    <div className="flex flex-col gap-2">
      <ActionBar stateKey="grades" testId={`${testId}-bar`}>
      <div role="group" aria-label={label} className={`lx-actionbar-main grid ${cols} gap-2`} data-testid={testId}>
        {options.map((o) => {
          const isSuggest = suggest === o.grade;
          return (
            <button
              key={o.grade}
              type="button"
              disabled={disabled}
              onClick={() => onGrade(o.grade)}
              data-testid={`grade-${o.grade}`}
              data-grade={o.grade}
              data-suggest={isSuggest ? '' : undefined}
              aria-keyshortcuts={String(o.grade)}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[var(--radius-control)] border-2 bg-surface-strong px-1 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                isSuggest ? 'border-accent' : 'border-transparent'
              } ${o.grade === 1 ? 'text-danger-text' : 'text-fg'}`}
            >
              <span>{o.label}</span>
              {o.interval && <small className="lx-tnum text-xs font-medium text-muted">{o.interval}</small>}
            </button>
          );
        })}
      </div>
      </ActionBar>
      {note && (
        <p className="m-0 text-center text-xs text-subtle" data-testid={`${testId}-note`}>
          {note}
        </p>
      )}
    </div>
  );
}
