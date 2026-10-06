import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

// Die eine Hauptkarte eines Bildschirms (Prototyp v1 `.card.hero`): feste Fläche, feine Kante,
// Eyebrow + Angabe rechts, Titel, Inhalt, darunter der eine gefüllte Knopf. Keine Karte in einer
// Karte (plan.md §1.4 Nr. 5). Farbe nur über Tokens (G10).

type Props = {
  eyebrow?: ReactNode;
  /** Rechts neben der Eyebrow („2 von 5 · ca. 27 Min.“). */
  meta?: ReactNode;
  /** `done`: Eyebrow in Akzentfarbe (z. B. „✓ Fertig für heute“) – Zustand, kein Knopf. */
  tone?: 'default' | 'done';
  title?: ReactNode;
  children?: ReactNode;
  /** Der eine Hauptknopf (meist `<Button variant="primary" size="lg" …/>`). */
  action?: ReactNode;
  testId?: string;
  className?: string;
  as?: 'section' | 'div' | 'article';
};

export function HeroCard({ eyebrow, meta, tone = 'default', title, children, action, testId, className, as: Tag = 'section' }: Props) {
  return (
    <Tag className={`lx-card flex flex-col gap-3.5 p-[1.125rem] ${className ?? ''}`} data-testid={testId} data-tone={tone}>
      {eyebrow !== undefined && (
        <Eyebrow meta={meta} tone={tone === 'done' ? 'accent' : 'default'}>
          {eyebrow}
        </Eyebrow>
      )}
      {title !== undefined && <h2 className="m-0 text-lg leading-snug font-semibold tracking-[-0.01em]">{title}</h2>}
      {children}
      {action && <div className="flex flex-col [&>*]:w-full">{action}</div>}
    </Tag>
  );
}
