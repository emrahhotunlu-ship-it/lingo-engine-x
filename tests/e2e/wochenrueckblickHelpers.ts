import { expect, type Page } from '@playwright/test';
import { bootAt, type BootOptions } from './fixtures';

// Gemeinsame Bausteine für den Wochenrückblick 3.0 (P50): Testdaten der Woche 14.–20.09.2026 und das Öffnen der Seite mit Schalter `weekly3`.

export type Doc = Record<string, unknown>;
export const NOW = '2026-09-21T10:00:00+02:00';
const T = (iso: string): number => Date.parse(iso);
export const FLAGS = { 'lx:flags': JSON.stringify({ weekly3: true }) };

const pat = (n: number, c: number, last: string, extra: Doc = {}): Doc => ({ n, c, last: T(last), i: '2026-09-01', r: 0, k: 0, dd: [], ...extra });

/** Testdaten für die Woche 14.–20.09.: drei neu feste Wörter, eine Wendung, ein neu sicheres Muster, zwei schwache Muster, Verlauf mit `vu`. */
export function reviewPatch(): Record<string, Doc> {
  return {
    'vocab/deserve': { ff: '2026-09-15' },
    'vocab/convince': { ff: '2026-09-17' },
    'vocab/avoid': { ff: '2026-09-18' },
    'vocab/overcome': { ff: '2026-09-02' },
    'chunk/zz-page': { en: 'on the same page', de: 'auf dem gleichen Stand', ff: '2026-09-16' },
    'grammar/articles': {
      id: 'articles',
      p: 0.5,
      n: 20,
      errors: [],
      pats: {
        'art.definite': pat(10, 9, '2026-09-18T10:00:00+02:00', { r: 31, k: 5, dd: ['2026-09-16', '2026-09-18'], s: '2026-09-18' }),
        'art.indefinite': pat(8, 3, '2026-09-19T10:00:00+02:00'),
        'art.zero': pat(6, 2, '2026-09-17T10:00:00+02:00'),
      },
    },
    'app/profile': {
      history: [
        { d: '2026-09-10', vu: 80 },
        { d: '2026-09-13', vu: 100 },
        { d: '2026-09-20', vu: 131 },
      ],
    },
  };
}

export async function openReview(page: Page, o: BootOptions & { patch?: Record<string, Doc>; bare?: boolean } = {}) {
  const { patch, fake, localStorage, bare, ...rest } = o;
  const f = { ...(fake === false ? {} : (fake ?? {})), patch: { ...(bare ? {} : reviewPatch()), ...(fake === false ? {} : (fake?.patch ?? {})), ...(patch ?? {}) } };
  const booted = await bootAt(page, { name: 'weekly' }, { now: NOW, ...rest, localStorage: { ...FLAGS, ...(localStorage ?? {}) }, fake: f });
  await expect(page.getByTestId('wk3')).toHaveAttribute('data-state', 'ready');
  return booted;
}

