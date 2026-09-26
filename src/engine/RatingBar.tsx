import type { Grade } from '../domain/srs/types';

// Nochmal/Schwer/Gut/Leicht mit Vorschlag und Abständen. Ein Tippen übernimmt die Note und
// geht weiter; Enter übernimmt den Vorschlag, Ziffern 1–4 wählen (Lern-Entwurf §2.3).

type Props = {
  labels: Record<Grade, string>;
  intervals: Record<Grade, string>;
  suggested: Grade;
  allowed: readonly Grade[];
  onRate: (g: Grade) => void;
  groupLabel: string;
};

export function RatingBar({ labels, intervals, suggested, allowed, onRate, groupLabel }: Props) {
  return (
    <div role="group" aria-label={groupLabel} className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="rating">
      {([1, 2, 3, 4] as const).map((g) => {
        const ok = allowed.includes(g);
        const isSuggested = g === suggested;
        return (
          <button
            key={g}
            type="button"
            disabled={!ok}
            data-grade={g}
            data-suggested={isSuggested || undefined}
            onClick={() => onRate(g)}
            className={`lx-rate ${isSuggested ? 'lx-rate-suggested' : ''}`}
          >
            <span className="text-sm font-semibold">
              <span className="lx-tnum mr-1.5 text-subtle" aria-hidden="true">
                {g}
              </span>
              {labels[g]}
            </span>
            <span className="lx-tnum text-xs text-muted">{intervals[g]}</span>
          </button>
        );
      })}
    </div>
  );
}
