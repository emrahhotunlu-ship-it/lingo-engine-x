import { useId } from 'react';
import { Disclosure } from '../Disclosure';

// Liniendiagramm in SVG (Plan §10.2): Werte 0–1 über Kalendertage, optional eine markierte
// Nahtstelle. `role="img"` mit Beschreibung; dieselben Werte als Tabelle im Aufklapper.

export type LineSeries = { key: string; label: string; color: string; points: ReadonlyArray<{ d: string; v: number }> };

type Props = {
  series: readonly LineSeries[];
  from: string;
  to: string;
  label: string;
  seam?: { d: string; label: string } | null;
  tableLabel: string;
  dateLabel: string;
  formatDate: (d: string) => string;
  testId?: string;
};

const W = 640;
const H = 200;
const PAD = { l: 32, r: 8, t: 10, b: 22 };

const dayNum = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

export function LineChart({ series, from, to, label, seam, tableLabel, dateLabel, formatDate, testId }: Props) {
  const id = useId();
  const x0 = dayNum(from);
  const span = Math.max(1, dayNum(to) - x0);
  const x = (d: string) => PAD.l + ((dayNum(d) - x0) / span) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - Math.max(0, Math.min(1, v))) * (H - PAD.t - PAD.b);
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.d)))].sort();
  return (
    <figure className="flex flex-col gap-3" data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t`} className="h-auto w-full" preserveAspectRatio="none">
        <title id={`${id}-t`}>{label}</title>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} stroke="var(--lx-border)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(g) + 4} textAnchor="end" fontSize={10} fill="var(--lx-fg-subtle)" className="lx-tnum">
              {Math.round(g * 100)}
            </text>
          </g>
        ))}
        {seam && (
          <g>
            <line x1={x(seam.d)} x2={x(seam.d)} y1={PAD.t} y2={H - PAD.b} stroke="var(--lx-fg-subtle)" strokeDasharray="3 4" strokeWidth={1} />
            <text x={Math.min(W - PAD.r - 4, x(seam.d) + 4)} y={H - 6} fontSize={10} fill="var(--lx-fg-subtle)" textAnchor={x(seam.d) > W * 0.7 ? 'end' : 'start'}>
              {seam.label}
            </text>
          </g>
        )}
        {series.map((s) =>
          s.points.length > 1 ? (
            <polyline key={s.key} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" points={s.points.map((p) => `${x(p.d).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')} />
          ) : s.points.length === 1 ? (
            <circle key={s.key} cx={x(s.points[0]!.d)} cy={y(s.points[0]!.v)} r={3} fill={s.color} />
          ) : null,
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </figcaption>
      <Disclosure label={tableLabel}>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">{label}</caption>
            <thead>
              <tr className="text-subtle">
                <th scope="col" className="py-1 font-medium">
                  {dateLabel}
                </th>
                {series.map((s) => (
                  <th key={s.key} scope="col" className="py-1 text-right font-medium">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d) => (
                <tr key={d} className="border-t border-line">
                  <td className="py-1 pr-2 text-muted">{formatDate(d)}</td>
                  {series.map((s) => {
                    const p = s.points.find((q) => q.d === d);
                    return (
                      <td key={s.key} className="lx-tnum py-1 text-right text-muted">
                        {p ? `${Math.round(p.v * 100)} %` : '–'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Disclosure>
    </figure>
  );
}
