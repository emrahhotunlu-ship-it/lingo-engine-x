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

  // Zustandsabzeichen (Verdict, Heute-Häkchen, erledigter Ring) tragen --fg-on auf ok · near · bad. Pflicht ≥ 3:1 (Symbol), Ziel und Stand ≥ 4,5:1.
  it('Schrift auf Zustandsfarbe (--fg-on auf ok · near · bad) ≥ 3:1, Ziel ≥ 4,5:1', () => {
    for (const k of ['ok', 'near', 'bad']) {
      expect(on(t['fg-on'] ?? '', parse(t[k] ?? '')), `fg-on auf ${k}`).toBeGreaterThanOrEqual(3);
      expect(on(t['fg-on'] ?? '', parse(t[k] ?? '')), `fg-on auf ${k} (Ziel)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // Bernstein darf nicht wie „fast richtig“ aussehen (Nora, 28.10.2026): Farbton-Abstand act ↔ near ≥ 25°.
  it('Handlungsfarbe und „fast richtig“ liegen im Farbton ≥ 25° auseinander', () => {
    const hue = (c: string): number => Number(/^oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(c)?.[1]);
    const d = Math.abs(hue(t.act ?? '') - hue(t.near ?? ''));
    expect(Math.min(d, 360 - d)).toBeGreaterThanOrEqual(25);
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

  it('Iris ist der Standard-Akzent: oklch(0.56 0.18 275), ohne eigenen Iris-Block (Nora, 28.10.2026)', () => {
    expect(BASE.act).toBe('oklch(0.56 0.18 275)');
    expect(BASE['swatch-iris']).toBe(BASE.act);
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

// Iris 0,56/0,18 (Nora, 28.10.2026) statt 0,62/0,16: weiße Knopfschrift wie in der freigegebenen Vorschau.
// Messwerte für den Bericht: Weiß auf Iris 0,56 hält 4,5:1, Iris 0,56 hält 3:1 auf dunklem und hellem Grund, aber nicht auf dem
// gedämpften Grund – dort bleibt Iris 0,62/0,16 mit dunkler Knopfschrift (Weiß auf 0,62 nur 3,67:1).
/** Messwerte (Kontrastverhältnis, gerundet) für den Bericht P1, Nachprüfung Nora 28.10.2026. */
const MEASURED = {
  weissAuf56: 4.76,
  weissAuf62: 3.67,
  dunkelAuf62: 5.15,
  iris56AufDunkel: 3.94,
  iris56AufHell: 4.56,
  iris56AufGedaempft: 2.93,
  iris62AufGedaempft: 3.8,
};
describe('Iris 0,56/0,18 mit weißer Knopfschrift, Ausnahme Gedämpft', () => {
  const WHITE = 'oklch(0.99 0.005 275)';
  const DARK = 'oklch(0.16 0.03 275)';
  const r2 = (n: number): number => Math.round(n * 100) / 100;

  it.each(['dark', 'light'] as const)('%s: Knopfschrift weiß, ≥ 4,5:1 auf Iris 0,56', (mode) => {
    const t = tokens(mode, 'iris');
    expect(t.act).toBe('oklch(0.56 0.18 275)');
    expect(t['act-fg']).toBe(WHITE);
    expect(on(WHITE, parse(t.act ?? ''))).toBeGreaterThanOrEqual(4.5);
  });

  it('Gedämpft: Iris 0,62/0,16 mit dunkler Knopfschrift (Weiß hielte, Iris 0,56 aber nicht 3:1 auf dem Grund)', () => {
    const t = tokens('dim', 'iris');
    expect(t.act).toBe('oklch(0.62 0.16 275)');
    expect(t['act-fg']).toBe(DARK);
    expect(on(DARK, parse(t.act ?? ''))).toBeGreaterThanOrEqual(4.5);
    expect(on('oklch(0.56 0.18 275)', parse(t.bg ?? ''))).toBeLessThan(3);
  });

  it('Messwerte (festgehalten)', () => {
    const iris56 = parse('oklch(0.56 0.18 275)');
    const iris62 = parse('oklch(0.62 0.16 275)');
    const m = {
      weissAuf56: r2(ratio(parse(WHITE), iris56)),
      weissAuf62: r2(ratio(parse(WHITE), iris62)),
      dunkelAuf62: r2(ratio(parse(DARK), iris62)),
      iris56AufDunkel: r2(ratio(iris56, parse(tokens('dark', 'iris').bg ?? ''))),
      iris56AufHell: r2(ratio(iris56, parse(tokens('light', 'iris').bg ?? ''))),
      iris56AufGedaempft: r2(ratio(iris56, parse(tokens('dim', 'iris').bg ?? ''))),
      iris62AufGedaempft: r2(ratio(iris62, parse(tokens('dim', 'iris').bg ?? ''))),
    };
    expect(m).toEqual(MEASURED);
  });
});
