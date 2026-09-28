import type { ChartItem } from './content';
import { chartGeometry } from './logic';

// Einfaches Balken- oder Liniendiagramm, lokal als SVG gezeichnet (B9, Lehrer I8). Farben nur über
// Design-Tokens (hell/dunkel/gedämpft), Werte als Zahl über jedem Punkt – nie nur Farbe.

const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));

export function ChartSvg({ chart, label }: { chart: ChartItem; label: string }) {
  const g = chartGeometry(chart);
  const line = g.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return (
    <figure className="flex flex-col gap-2" data-testid="sptask-figure" data-kind={chart.kind}>
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm" lang="en">
        <span className="font-semibold">{chart.title}</span>
        <span className="text-xs text-muted">{chart.unit}</span>
      </figcaption>
      <svg viewBox={`0 0 ${g.w} ${g.h}`} role="img" aria-label={label} className="h-auto w-full text-fg">
        {g.grid.map((y) => (
          <line key={y} x1={8} x2={g.w - 8} y1={y} y2={y} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="3 4" />
        ))}
        <line x1={8} x2={g.w - 8} y1={g.base} y2={g.base} stroke="currentColor" strokeOpacity={0.4} />
        {chart.kind === 'bar'
          ? g.bars.map((b) => <rect key={b.label} x={b.x} y={b.y} width={b.w} height={Math.max(0, b.h)} rx={3} fill="var(--lx-accent, currentColor)" />)
          : <path d={line} fill="none" stroke="var(--lx-accent, currentColor)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
        {chart.kind === 'line' && g.points.map((p) => <circle key={p.label} cx={p.x} cy={p.y} r={3.5} fill="var(--lx-accent, currentColor)" />)}
        {g.points.map((p) => (
          <text key={`v-${p.label}`} x={p.x} y={p.y - 6} textAnchor="middle" fontSize={10} fill="currentColor" className="lx-tnum">
            {fmt(p.value)}
          </text>
        ))}
        {g.points.map((p) => (
          <text key={`l-${p.label}`} x={p.x} y={g.base + 15} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>
            {p.label}
          </text>
        ))}
      </svg>
    </figure>
  );
}
