import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG AA in allen drei Modi (Kap. 8), direkt aus den Tokens in src/styles/index.css.

const css = readFileSync(new URL('../../src/styles/index.css', import.meta.url), 'utf8');

function tokens(theme: string): Record<string, string> {
  const selector = theme === 'dark' ? /:root,\s*:root\[data-theme='dark'\]\s*\{([^}]*)\}/ : new RegExp(`:root\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`);
  const block = selector.exec(css)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--lx-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

type RGBA = [number, number, number, number];
function parse(c: string): RGBA {
  const hex = /^#([0-9a-f]{6})$/i.exec(c);
  if (hex?.[1]) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const rgba = /^rgba\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)$/.exec(c);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])];
  throw new Error(`Farbe nicht lesbar: ${c}`);
}
const over = (top: RGBA, base: RGBA): RGBA => [0, 1, 2].map((i) => top[i]! * top[3] + base[i]! * (1 - top[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA) => {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratio = (a: RGBA, b: RGBA) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};

describe.each(['dark', 'dim', 'light'])('Kontraste im Modus %s', (theme) => {
  const t = tokens(theme);
  const bg = parse(t.bg ?? '');
  const surfaces: Array<[string, RGBA]> = [
    ['Hintergrund', bg],
    ['Glasfläche', over(parse(t.surface ?? ''), bg)],
    ['Glasfläche stark', over(parse(t['surface-strong'] ?? ''), bg)],
    ['Blatt', parse(t['surface-solid'] ?? '')],
  ];

  it('alle Tokens vorhanden', () => {
    for (const k of ['bg', 'surface', 'surface-strong', 'surface-solid', 'fg', 'fg-muted', 'fg-subtle', 'accent', 'accent-fg', 'accent-text', 'cyan-text', 'gold-text', 'danger-text', 'focus']) {
      expect(t[k], k).toBeTruthy();
    }
    for (const ch of ['cards', 'grammar', 'read', 'listen', 'write', 'speak', 'business', 'discover']) expect(t[`ch-${ch}`], ch).toBeTruthy();
  });

  it.each(['fg', 'fg-muted', 'fg-subtle', 'accent-text', 'cyan-text', 'gold-text', 'danger-text'])('Text %s ≥ 4,5:1 auf jeder Fläche', (key) => {
    for (const [name, s] of surfaces) expect(ratio(parse(t[key] ?? ''), s), `${key} auf ${name}`).toBeGreaterThanOrEqual(4.5);
  });

  it('Knopftext auf Akzent ≥ 4,5:1', () => {
    expect(ratio(parse(t['accent-fg'] ?? ''), parse(t.accent ?? ''))).toBeGreaterThanOrEqual(4.5);
  });

  it('Fokusrahmen und Kanalfarben ≥ 3:1 (Grafik, WCAG 1.4.11)', () => {
    for (const key of ['focus', 'ch-cards', 'ch-grammar', 'ch-read', 'ch-listen', 'ch-write', 'ch-speak', 'ch-business', 'ch-discover']) {
      for (const [name, s] of surfaces) expect(ratio(parse(t[key] ?? ''), s), `${key} auf ${name}`).toBeGreaterThanOrEqual(3);
    }
  });
});
