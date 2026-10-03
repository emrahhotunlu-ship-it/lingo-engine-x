import type { ReactNode } from 'react';

// Kleine Überschrift in Großbuchstaben (Prototyp v1 `.eyebrow`), optional mit einer ruhigen
// Angabe rechts („2 von 5 · ca. 27 Min.“). Farbe nur über Tokens (G10).

type Props = {
  children: ReactNode;
  /** Rechts daneben, klein und grau (z. B. Minuten, Zähler). */
  meta?: ReactNode;
  /** `accent` z. B. für „✓ Fertig für heute“. */
  tone?: 'default' | 'accent';
  as?: 'p' | 'h2' | 'h3';
  testId?: string;
};

export function Eyebrow({ children, meta, tone = 'default', as: Tag = 'p', testId }: Props) {
  const text = <Tag className={`lx-eyebrow m-0 ${tone === 'accent' ? 'text-accent-text' : 'text-subtle'}`} data-testid={testId}>{children}</Tag>;
  if (meta === undefined || meta === null) return text;
  return (
    <div className="flex items-baseline justify-between gap-3">
      {text}
      <span className="lx-tnum text-xs text-subtle">{meta}</span>
    </div>
  );
}
