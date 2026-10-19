import type { UnitState } from '../../domain/metrics/definitions';
import { STATE_DOTS } from '../../ui/exercise';

// Gefüllte Punkte von vier: Neu 1, Lernt 2, Wackelt 2 (bernstein), Sicher 3, Fest 4. Neu und Lernt neutral, nur Sicher und Fest grün.

export function StateDots({ state }: { state: UnitState }) {
  return (
    <span className="lx-dots" aria-hidden="true" data-unsure={state === 'new' || state === 'learning' || undefined} data-wobbly={state === 'wobbly' || undefined}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="lx-dot" data-on={i < STATE_DOTS[state] || undefined} />
      ))}
    </span>
  );
}
