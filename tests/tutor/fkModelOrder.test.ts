import { describe, expect, it } from 'vitest';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { berlin } from '../unit/helpers';

// „Fehler korrigieren“ liest dasselbe Lernermodell (Tutor-Engine v3 S2 a): am selben Fälligkeitstag kommt das schwächere Muster zuerst.
// Ohne Modell bleibt die Reihenfolge „älteste Fälligkeit zuerst“. Alle Daten sind erfunden.

const TODAY = '2026-10-19';
const NOW = berlin(TODAY, 18);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const err = (q: string, ans: string, given: string, t: number, due: number, pat: string): Doc => ({ q, given, ans, t, src: 'test', box: 0, due, pat });

describe('Fehlersätze nach dem Lernermodell', () => {
  const t = NOW - 3 * DAY;
  const g = new Map<string, Doc>([
    [
      'passive',
      {
        errors: [
          err('The report ___ (send) to the board yesterday.', 'was sent', 'sent', t, berlin('2026-10-18', 8), 'strong'),
          err('The invoices ___ (check) every month by our team.', 'are checked', 'checked', t + 1000, berlin('2026-10-18', 9), 'weak'),
          err('The new office ___ (open) next spring, the plan says.', 'will be opened', 'opens', t + 2000, berlin('2026-10-17', 9), 'strong'),
        ],
      },
    ],
  ]);
  const ids = (pOf?: (p: string) => number | undefined): string[] => dueFehlersaetze({ grammarDocs: g, repairDoc: null, nowMs: NOW, today: TODAY, ...(pOf ? { pOf } : {}) }).map((f) => `${f.pat}@${new Date(f.due).getDate()}`);

  it('ohne Modell: älteste Fälligkeit zuerst', () => {
    expect(ids()).toEqual(['strong@17', 'strong@18', 'weak@18']);
  });
  it('mit Modell: Fälligkeitstag zuerst, dann das schwächere Muster', () => {
    expect(ids((p) => (p === 'weak' ? 0.2 : 0.9))).toEqual(['strong@17', 'weak@18', 'strong@18']);
  });
  it('unbekanntes Muster gilt als stark (keine Bevorzugung ohne Beleg)', () => {
    expect(ids(() => undefined)).toEqual(['strong@17', 'strong@18', 'weak@18']);
  });
});
