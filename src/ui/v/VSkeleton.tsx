import type { CSSProperties, ReactNode } from 'react';

// D1 V-BAU: Lade-Skelett (`.sk`, Vorschau style.css:213–214; H1 `skeleton` screens.js:111–117). Statt Spinner (Kap. 3.4).
// Für Screenreader unsichtbar; der Bereich, der lädt, trägt `aria-busy` (siehe VLoading).

type Props = { width?: number | string; height?: number | string; round?: boolean; radius?: number; className?: string };

export function VSkeleton({ width = '100%', height = 16, round, radius, className }: Props) {
  const style: CSSProperties = { width, height };
  if (radius != null) style.borderRadius = radius;
  return <span className={`lx-v-sk${className ? ` ${className}` : ''}`} data-round={round ? '' : undefined} style={style} aria-hidden="true" />;
}

/** Bereich, der gerade lädt: Skelette darin, für Screenreader ein kurzer Text. */
export function VLoading({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className} aria-busy="true" role="status" aria-label={label}>
      {children}
    </div>
  );
}
