import type { ReactNode } from 'react';
import { EnglishText } from './EnglishText';
import type { WordTapArea } from './wordTap';

// Eigener Text mit markierten Stellen einer Korrektur (Plan §4.3 Nr. 4, R7): nur Stellen, die
// im Text wirklich gefunden wurden (`span`), sind markiert – Farbe nach Schwere. Tippen auf eine
// Stelle öffnet ihre Erklärung. Alle anderen Wörter bleiben antippbar (Wort-Antippen).

export type Mark = { i: number; span: [number, number]; sev: 'minor' | 'major' };

type Props = {
  text: string;
  marks: readonly Mark[];
  active: number | null;
  onMark: (i: number) => void;
  area: WordTapArea;
  source: string;
  title: string;
  label: (i: number) => string;
  className?: string;
};

export function MarkedText({ text, marks, active, onMark, area, source, title, label, className }: Props) {
  const sorted = [...marks].sort((a, b) => a.span[0] - b.span[0]);
  const parts: ReactNode[] = [];
  let pos = 0;
  for (const m of sorted) {
    const [s, e] = m.span;
    if (s < pos || e > text.length || e <= s) continue;
    if (s > pos) parts.push(<EnglishText key={`t-${pos}`} text={text.slice(pos, s)} area={area} source={source} title={title} as="span" />);
    parts.push(
      <button
        key={`m-${m.i}`}
        type="button"
        data-testid="error-mark"
        data-sev={m.sev}
        data-i={m.i}
        aria-pressed={active === m.i}
        aria-label={label(m.i)}
        onClick={() => onMark(m.i)}
        className={`rounded-[0.3em] px-0.5 text-left underline decoration-2 underline-offset-4 ${
          m.sev === 'major' ? 'bg-danger-soft decoration-[var(--lx-danger-text)]' : 'bg-gold-soft decoration-[var(--lx-gold-text)]'
        } ${active === m.i ? 'ring-2 ring-[var(--lx-focus)]' : ''}`}
        lang="en"
      >
        {text.slice(s, e)}
      </button>,
    );
    pos = e;
  }
  if (pos < text.length) parts.push(<EnglishText key={`t-${pos}`} text={text.slice(pos)} area={area} source={source} title={title} as="span" />);
  return (
    <p lang="en" className={`whitespace-pre-wrap leading-relaxed ${className ?? ''}`} data-testid="marked-text">
      {parts}
    </p>
  );
}
