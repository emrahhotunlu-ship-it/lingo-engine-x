import type { HeatCell } from '../../domain/progress/history';

// Aktivität als Kalender-Raster (Plan §10.2): Spalten = Wochen, Zeilen = Mo–So. Stufe nie nur
// über Farbe: jede Zelle trägt ihren Wert im Titel, dazu die Legende „weniger … mehr".

type Props = { weeks: readonly HeatCell[][]; label: string; cellLabel: (c: HeatCell) => string; less: string; more: string; testId?: string };

const OPACITY = [0, 0.25, 0.45, 0.7, 1];
const S = 12;
const G = 3;

export function Heatmap({ weeks, label, cellLabel, less, more, testId }: Props) {
  const w = weeks.length * (S + G);
  const h = 7 * (S + G);
  return (
    <figure className="flex flex-col gap-2" data-testid={testId}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className="h-auto w-full max-w-[40rem]">
        {weeks.map((col, x) =>
          col.map((c) => {
            const dow = (new Date(`${c.d}T12:00:00Z`).getUTCDay() + 6) % 7;
            return (
              <rect key={c.d} x={x * (S + G)} y={dow * (S + G)} width={S} height={S} rx={3} fill={c.level ? 'var(--lx-accent)' : 'var(--lx-track)'} fillOpacity={c.level ? OPACITY[c.level] : 1}>
                <title>{cellLabel(c)}</title>
              </rect>
            );
          }),
        )}
      </svg>
      <figcaption className="flex items-center gap-2 text-xs text-muted" aria-hidden="true">
        <span>{less}</span>
        {OPACITY.map((o, i) => (
          <span key={i} className="inline-block size-3 rounded-[3px]" style={{ background: i ? 'var(--lx-accent)' : 'var(--lx-track)', opacity: i ? o : 1 }} />
        ))}
        <span>{more}</span>
      </figcaption>
    </figure>
  );
}
