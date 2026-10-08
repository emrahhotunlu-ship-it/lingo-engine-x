import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DayRing } from '../../src/ui/DayRing';

// UX-Prüfung W1: Der geschlossene Tagesring ist EIN Kreis mit EINEM Verlauf, ohne runde Enden (keine Knubbel bei 12/3/6/9 Uhr).

const html = (closed: boolean): string => renderToStaticMarkup(createElement(DayRing, { fills: [1, 1, 1, 1], label: 'Ring', closed }));

describe('DayRing geschlossen', () => {
  it('ein Kreis, ein Verlauf, keine runden Enden, keine Bogen', () => {
    const s = html(true);
    expect(s.match(/<circle/g)).toHaveLength(1);
    expect(s.match(/<linearGradient/g)).toHaveLength(1);
    expect(s).not.toMatch(/stroke-linecap/);
    expect(s).not.toMatch(/stroke-dasharray/);
    expect(s).toContain('data-closed="true"');
  });
  it('offen: vier Bogen mit Spur und Füllung', () => {
    const s = html(false);
    expect(s.match(/<circle/g)).toHaveLength(8);
    expect(s.match(/<linearGradient/g)).toHaveLength(4);
  });
});
