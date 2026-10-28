import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// WCAG AA (Kap. 8) für die Relaunch-Tokens (P1 S1-TOK): 3 Modi × 2 Akzente, direkt aus den OKLCH-Werten in src/styles/index.css.
// Fließtext ≥ 4,5:1, große Schrift und Bedienelemente (Knopf-Fläche, Kanalfarben, Fokus) ≥ 3:1 (WCAG 1.4.3 und 1.4.11).

const css = readFileSync(new URL('../../src/styles/index.css', import.meta.url), 'utf8');

const MODES = ['dark', 'dim', 'light'] as const;
const ACCENTS = ['iris', 'amber'] as const;
type Mode = (typeof MODES)[number];
type AccentName = (typeof ACCENTS)[number];
type Tokens = Record<string, string>;

function block(selector: string): Tokens {
  const re = new RegExp(`${selector}\\s*\\{([^}]*)\\}`);
  const body = re.exec(css)?.[1] ?? '';
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1] ?? '', (m[2] ?? '').trim()]));
}

const BASE = block(`:root,\\s*:root\\[data-theme='dark'\\]`);
const MODE_BLOCK: Record<Mode, Tokens> = { dark: {}, dim: block(`:root\\[data-theme='dim'\\]`), light: block(`:root\\[data-theme='light'\\]`) };
const AMBER = block(`:root\\[data-accent='amber'\\]`);
const LIGHT_AMBER = block(`:root\\[data-theme='light'\\]\\[data-accent='amber'\\]`);

/** Werte, wie sie im Browser auf <html data-theme=… data-accent=…> gelten (spätere, spezifischere Blöcke gewinnen). */
function tokens(mode: Mode, accent: AccentName): Tokens {
  return { ...BASE, ...MODE_BLOCK[mode], ...(accent === 'amber' ? AMBER : {}), ...(accent === 'amber' && mode === 'light' ? LIGHT_AMBER : {}) };
}

type RGBA = [number, number, number, number];

/** OKLCH → sRGB (0–255), Björn Ottosson; außerhalb von sRGB wird beschnitten wie im Browser ohne Gamut-Mapping. */
function oklch(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const enc = (x: number): number => {
    const v = Math.min(1, Math.max(0, x));
    return (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055) * 255;
  };
  return [enc(lin[0]!), enc(lin[1]!), enc(lin[2]!)];
}

function parse(c: string): RGBA {
  const m = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(c);
  if (!m) throw new Error(`Farbe nicht lesbar (nur feste OKLCH-Werte erlaubt): ${c}`);
  return [...oklch(Number(m[1]), Number(m[2]), Number(m[3])), m[4] === undefined ? 1 : Number(m[4])];
}
const over = (top: RGBA, base: RGBA): RGBA => [0, 1, 2].map((i) => top[i]! * top[3] + base[i]! * (1 - top[3])).concat(1) as RGBA;
const lum = ([r, g, b]: RGBA): number => {
  const ch = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const ratio = (a: RGBA, b: RGBA): number => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (l1 + 0.05) / (l2 + 0.05);
};
const on = (fg: string, bg: RGBA): number => ratio(over(parse(fg), bg), bg);

const TEXT = ['fg', 'fg-2', 'fg-3', 'act-text', 'ok', 'near', 'bad', 'ch-words'];
const CONTROLS = ['act', 'act-text', 'ch-gram', 'ch-listen', 'ch-speak'];

describe.each(MODES.flatMap((m) => ACCENTS.map((a) => [m, a] as const)))('Modus %s · Akzent %s', (mode, accent) => {
  const t = tokens(mode, accent);
  const bg = parse(t.bg ?? '');
  // Flächen, auf denen Text steht: Grund, Karte, Karte hervorgehoben (die Brücke legt --lx-surface auf surface-2).
  const textSurfaces: Array<[string, RGBA]> = [
    ['bg', bg],
    ['surface', parse(t.surface ?? '')],
    ['surface-2', parse(t['surface-2'] ?? '')],
  ];
  const controlSurfaces = textSurfaces.slice(0, 2);

  it('alle Tokens vorhanden und als feste OKLCH-Werte lesbar', () => {
    for (const k of ['bg', 'bg-deep', 'surface', 'surface-2', 'surface-3', 'line', 'line-2', 'fg', 'fg-2', 'fg-3', 'fg-on', 'act', 'act-fg', 'act-text', 'act-soft', 'ok', 'ok-soft', 'near', 'near-soft', 'bad', 'bad-soft', 'ch-words', 'ch-gram', 'ch-listen', 'ch-speak', 'mark', 'words-soft', 'kb', 'kb-key', 'kb-key-2', 'kb-fg', 'scrim']) {
      expect(t[k], k).toBeTruthy();
      expect(() => parse(t[k] ?? ''), k).not.toThrow();
    }
    expect(t.shadow).toBeTruthy();
  });

  it.each(TEXT)('Fließtext %s ≥ 4,5:1 auf Grund und Karten', (key) => {
    for (const [name, s] of textSurfaces) expect(on(t[key] ?? '', s), `${key} auf ${name}`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(CONTROLS)('Bedienelement/große Schrift %s ≥ 3:1 auf Grund und Karte', (key) => {
    for (const [name, s] of controlSurfaces) expect(on(t[key] ?? '', s), `${key} auf ${name}`).toBeGreaterThanOrEqual(3);
  });

  it('Knopfschrift auf der Handlungsfarbe ≥ 4,5:1', () => {
    expect(on(t['act-fg'] ?? '', parse(t.act ?? ''))).toBeGreaterThanOrEqual(4.5);
  });

  it('Schrift auf Zustandsfarbe (--fg-on auf ok · near · bad) ≥ 4,5:1', () => {
    for (const k of ['ok', 'near', 'bad']) expect(on(t['fg-on'] ?? '', parse(t[k] ?? '')), `fg-on auf ${k}`).toBeGreaterThanOrEqual(4.5);
  });

  it('Schrift auf weichen Füllungen (ok · near · bad · mark · act-soft) ≥ 4,5:1', () => {
    for (const k of ['ok-soft', 'near-soft', 'bad-soft', 'mark', 'act-soft']) {
      const fill = over(parse(t[k] ?? ''), bg);
      expect(on(t.fg ?? '', fill), `fg auf ${k}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(on(t['act-text'] ?? '', over(parse(t['act-soft'] ?? ''), bg)), 'act-text auf act-soft').toBeGreaterThanOrEqual(4.5);
  });

  // Farbige Schrift auf ihrer eigenen weichen Füllung (Formel-Chip, Fehler-Zeile, Richtig-Hinweis) auf Grund und Karten.
  it('Zustandsschrift auf eigener Füllung (ok · near · bad · ch-words) ≥ 4,5:1', () => {
    for (const [k, soft] of [['ok', 'ok-soft'], ['near', 'near-soft'], ['bad', 'bad-soft'], ['ch-words', 'words-soft']] as const) {
      for (const [name, s] of textSurfaces) expect(on(t[k] ?? '', over(parse(t[soft] ?? ''), s)), `${k} auf ${soft} über ${name}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Auswahlgruppe (Segmented): nicht gewählte Werte in fg-2 auf der Spur (line-2) über Grund und Karten.
  it('Zweitschrift auf der Spur (fg-2 auf line-2) ≥ 4,5:1', () => {
    for (const [name, s] of textSurfaces) expect(on(t['fg-2'] ?? '', over(parse(t['line-2'] ?? ''), s)), `fg-2 auf line-2 über ${name}`).toBeGreaterThanOrEqual(4.5);
  });

  it('Bildschirmtastatur: Tastenschrift ≥ 4,5:1 auf beiden Tastenflächen', () => {
    for (const k of ['kb-key', 'kb-key-2']) expect(on(t['kb-fg'] ?? '', parse(t[k] ?? '')), `kb-fg auf ${k}`).toBeGreaterThanOrEqual(4.5);
  });

  it('Auswahl bleibt neutral: Schrift unterscheidet sich von Richtig, Linie von der weichen Richtig-Füllung', () => {
    expect(t.fg).not.toBe(t.ok);
    expect(t['line-2']).not.toBe(t['ok-soft']);
  });
});

describe('Grundregeln der Token-Blöcke', () => {
  it('Dunkel steht im blanken :root (Standard ohne gespeicherte Wahl)', () => {
    expect(BASE.bg).toBe('oklch(0.165 0.012 268)');
    expect(css).toMatch(/:root,\s*:root\[data-theme='dark'\]\s*\{\s*color-scheme: dark;/);
  });

  it('Iris ist der Standard-Akzent: oklch(0.62 0.16 275), ohne eigenen Iris-Block', () => {
    expect(BASE.act).toBe('oklch(0.62 0.16 275)');
    expect(css.includes(`[data-accent='iris']`)).toBe(false);
  });

  it('die alten Farbthemen (ocean, plum, graphite) gibt es nicht mehr', () => {
    expect(css).not.toMatch(/data-palette/);
  });

  it('Akzent-Blöcke setzen nur Handlungsfarben, nie Bedeutungs- oder Grundfarben', () => {
    for (const b of [AMBER, LIGHT_AMBER]) for (const k of Object.keys(b)) expect(k, k).toMatch(/^act(-fg|-text|-soft)?$/);
  });

  it('keine Relative-Color-Syntax (from …) in den Tokens', () => {
    expect(css).not.toMatch(/oklch\(\s*from\b/);
  });
});

// Messung Iris 0,6 (Vorschau) gegen 0,62 (App-Vorgabe), festgehalten für den Bericht P1:
// Weiße Knopfschrift erreicht auf keiner der beiden 4,5:1, darum ist --act-fg dunkel. 0,62 ist auf dunklem und gedämpftem Grund
// besser, auf hellem Grund knapp schlechter (bleibt aber ≥ 3:1 auf Grund und Karte).
describe('Messung Iris 0,6 gegen 0,62', () => {
  const iris = (l: number): RGBA => parse(`oklch(${l} 0.16 275)`);
  const r = (fg: string, l: number): number => Math.round(ratio(parse(fg), iris(l)) * 100) / 100;
  const MEASURE: Record<string, [string, number, number]> = {
    'weiße Schrift (Vorschau act-fg 0.99) auf Iris': ['oklch(0.99 0.005 275)', 3.98, 3.67],
    'dunkle Schrift (App act-fg) auf Iris': ['oklch(0.16 0.03 275)', 4.74, 5.15],
    'Iris auf dunklem Grund': ['oklch(0.165 0.012 268)', 4.7, 5.1],
    'Iris auf gedämpftem Grund': ['oklch(0.285 0.01 268)', 3.5, 3.8],
    'Iris auf hellem Grund': ['oklch(0.975 0.004 268)', 3.82, 3.52],
  };
  it.each(Object.entries(MEASURE))('%s', (_name, [fg, at60, at62]) => {
    expect(r(fg, 0.6)).toBeCloseTo(at60, 1);
    expect(r(fg, 0.62)).toBeCloseTo(at62, 1);
  });
  it('Folgerung: nur dunkle Knopfschrift besteht 4,5:1, mit 0,62 deutlicher als mit 0,6', () => {
    expect(r('oklch(0.99 0.005 275)', 0.62)).toBeLessThan(4.5);
    expect(r('oklch(0.99 0.005 275)', 0.6)).toBeLessThan(4.5);
    expect(r('oklch(0.16 0.03 275)', 0.62)).toBeGreaterThanOrEqual(4.5);
    expect(r('oklch(0.16 0.03 275)', 0.62)).toBeGreaterThan(r('oklch(0.16 0.03 275)', 0.6));
  });
});
