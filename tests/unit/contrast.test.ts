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

// Farbthemen (M21): jeder Akzentsatz in jedem Modus, auf den Flächen dieses Modus.
function paletteTokens(palette: string, theme: string): Record<string, string> {
  const sel = theme === 'dark' ? `:root\\[data-palette='${palette}'\\]\\s*\\{([^}]*)\\}` : `:root\\[data-palette='${palette}'\\]\\[data-theme='${theme}'\\]\\s*\\{([^}]*)\\}`;
  const block = new RegExp(sel).exec(css)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/--lx-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

describe.each(['ocean', 'plum', 'graphite'])('Farbthema %s', (palette) => {
  it.each(['dark', 'dim', 'light'])('Modus %s: Akzent lesbar (Text ≥ 4,5:1, Knopf ≥ 4,5:1, Fläche ≥ 3:1)', (theme) => {
    const own = paletteTokens(palette, theme);
    for (const k of ['accent', 'accent-fg', 'accent-text', 'accent-soft', 'bg-glow-1']) expect(own[k], `${palette}/${theme} ${k}`).toBeTruthy();
    const t = { ...tokens(theme), ...own };
    const bg = parse(t.bg ?? '');
    const surfaces: Array<[string, RGBA]> = [
      ['Hintergrund', bg],
      ['Glasfläche', over(parse(t.surface ?? ''), bg)],
      ['Glasfläche stark', over(parse(t['surface-strong'] ?? ''), bg)],
      ['Blatt', parse(t['surface-solid'] ?? '')],
      ['Akzent weich', over(parse(t['accent-soft'] ?? ''), bg)],
    ];
    for (const [name, s] of surfaces) {
      expect(ratio(parse(t['accent-text'] ?? ''), s), `accent-text auf ${name}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(parse(t.accent ?? ''), s), `accent auf ${name}`).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(parse(t['accent-fg'] ?? ''), parse(t.accent ?? '')), 'Knopftext auf Akzent').toBeGreaterThanOrEqual(4.5);
  });
});

it('Salbei ist der Standard: ohne eigenen Block gelten die Grund-Tokens (Smaragd)', () => {
  expect(css.includes(`[data-palette='sage']`)).toBe(false);
  expect(tokens('dark').accent).toBe('#10b981');
});

// Lernplattform 2.0 §7: Bedeutungsfarben (ok · near · wrong · hint) je Modus, von keiner Palette überschrieben.
function resolved(theme: string): Record<string, string> {
  const t = tokens(theme);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(t)) {
    let val = v;
    for (let i = 0; i < 4; i++) {
      const m = /^var\(--lx-([\w-]+)\)$/.exec(val);
      if (!m) break;
      val = t[m[1] ?? ''] ?? val;
    }
    out[k] = val;
  }
  return out;
}

describe.each(['dark', 'dim', 'light'])('Bedeutungsfarben im Modus %s', (theme) => {
  const t = resolved(theme);
  const bg = parse(t.bg ?? '');
  const surfaces: Array<[string, RGBA]> = [
    ['Hintergrund', bg],
    ['Glasfläche', over(parse(t.surface ?? ''), bg)],
    ['Blatt', parse(t['surface-solid'] ?? '')],
  ];

  it.each(['ok-text', 'near-text', 'wrong-text', 'hint-text'])('Text %s ≥ 4,5:1 auf Hintergrund und Fläche', (key) => {
    for (const [name, s] of surfaces) expect(ratio(parse(t[key] ?? ''), s), `${key} auf ${name}`).toBeGreaterThanOrEqual(4.5);
  });

  // Der Text von Optionen, Lücken und Bausteinen bleibt in der Schriftfarbe; nur Zeichen und Rand tragen die Bedeutung.
  it('Schriftfarbe auf der weichen Füllung (ok, near, wrong, hint) bleibt ≥ 4,5:1', () => {
    for (const k of ['ok', 'near', 'wrong', 'hint']) {
      const fill = over(parse(t[`${k}-soft`] ?? ''), bg);
      expect(ratio(parse(t.fg ?? ''), fill), `fg auf ${k}-soft`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('Rahmenfarben ok/wrong ≥ 3:1 (Grafik, WCAG 1.4.11)', () => {
    for (const k of ['ok', 'wrong']) for (const [name, s] of surfaces) expect(ratio(parse(t[k] ?? ''), s), `${k} auf ${name}`).toBeGreaterThanOrEqual(3);
  });

  it('Markierung `--lx-mark` ist vorhanden und der Schriftfarbe-Kontrast darauf bleibt ≥ 4,5:1', () => {
    const fill = over(parse(t.mark ?? ''), bg);
    expect(ratio(parse(t.fg ?? ''), fill)).toBeGreaterThanOrEqual(4.5);
  });

  it('Auswahl ist neutral: Rahmen `--lx-fg` unterscheidet sich von `--lx-ok`, Fläche `--lx-line-strong` von `--lx-ok-soft`', () => {
    expect(t.fg).not.toBe(t.ok);
    expect(t['line-strong']).not.toBe(t['ok-soft']);
  });
});

describe('Keine Palette überschreibt Bedeutungsfarben', () => {
  it('kein Palettenblock setzt --lx-ok*, --lx-near*, --lx-wrong*, --lx-hint* oder --lx-mark', () => {
    const blocks = [...css.matchAll(/:root\[data-palette='[\w-]+'\](?:\[data-theme='[\w-]+'\])?\s*\{([^}]*)\}/g)].map((m) => m[1] ?? '');
    expect(blocks.length).toBeGreaterThanOrEqual(9);
    for (const b of blocks) expect(b).not.toMatch(/--lx-(ok|near|wrong|hint|mark)\b/);
  });
});
