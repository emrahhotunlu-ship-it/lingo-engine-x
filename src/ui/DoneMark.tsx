// Abschlussmoment der Zwischenkarte (UX-Audit U3): ein Ring füllt sich bis zum Tagesstand (~250 ms), danach zeichnet sich das Häkchen.
// Erfolgsfarbe Smaragd (`--lx-ok`). Bei reduzierter Bewegung bzw. Effekt-Stufe „Aus“ nur sanftes Überblenden (styles/parts/u3.css).

export function DoneMark({ done, total, label }: { done: number; total: number; label: string }) {
  const frac = total > 0 ? Math.min(1, Math.max(0, done / total)) : 1;
  return (
    <svg
      className="lx-done"
      width="56"
      height="56"
      viewBox="0 0 56 56"
      role="img"
      aria-label={label}
      data-testid="done-mark"
      data-frac={frac.toFixed(2)}
      style={{ ['--lx-done-to' as string]: String(100 * (1 - frac)) }}
    >
      <circle className="lx-done-track" cx="28" cy="28" r="24" pathLength={100} />
      <circle className="lx-done-ring" cx="28" cy="28" r="24" pathLength={100} transform="rotate(-90 28 28)" />
      <path className="lx-done-check" d="M18 28.5l6.5 6.5L38 21.5" pathLength={1} />
    </svg>
  );
}
