import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { HTML, serveDist } from './dist';

// Vergleichsgerüst „App gegen Vorschau“ (Relaunch Teil 1c, D1 V-BAU; docs/relaunch/stufe1c-plan.md §3.0).
//
// - Die Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 läuft als Testseite unter VORSCHAU_ORIGIN: `page.route` liefert
//   docs/relaunch/vorschau/vorschau.html (gebaut aus docs/relaunch/vorschau/src/* mit `node docs/relaunch/vorschau/build.mjs`).
//   Modus, Sprache und Bewegung „aus“ kommen über ihre eigenen Einstellungen (localStorage `lx-vorschau-1`), der Bildschirm über `#<id>-<variante>`.
// - Die App-Seite ist entweder die echte App (`fixtures.boot`, ab D2) oder die Baustein-Galerie (`openGalerie`): das CSS aus dist/ (also genau
//   das ausgelieferte Stylesheet) plus tests/e2e/vorschauGalerie.tsx, beim Testlauf gebündelt. Nichts davon gelangt in den Build.
// - Messhelfer: `box()` liest getBoundingClientRect und die berechneten Schriftwerte; `expectSameBox()` vergleicht ±2 px, Schriftgröße exakt.
// - Jede fremde Anfrage wird abgebrochen und gezählt (beide Seiten laden nichts von außen).
//
// Neue Paare (D2 ff.): in tests/e2e/vorschau.spec.ts an PAIRS anhängen (Vorschau-Bildschirm, App-Seite, Messpunkte).

export const VORSCHAU_ORIGIN = 'https://vorschau.artifact.test';
export const GALERIE_ORIGIN = 'https://galerie.artifact.test';

export type Mode = 'dark' | 'dim' | 'light';
export type Lang = 'de' | 'en';
export type Size = { name: string; width: number; height: number };

export const SIZES: Size[] = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
  { name: '2560', width: 2560, height: 1440 },
];
export const MODES: Mode[] = ['dark', 'dim', 'light'];
export const LANGS: Lang[] = ['de', 'en'];

/** Die Vorschau nennt Gedämpft „muted“, die App „dim“. */
const PREVIEW_MODE: Record<Mode, string> = { dark: 'dark', dim: 'muted', light: 'light' };

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const VORSCHAU_HTML = readFileSync(`${ROOT}docs/relaunch/vorschau/vorschau.html`, 'utf8');
/** Pfad des Stylesheets aus dem gebauten dist/index.html (Mehr-Datei-Build). */
const CSS_HREF = /href="\.\/(style-[\w-]+\.css)"/.exec(HTML)?.[1];

/** Bilder der Vergleichspaare (nicht im Repository; der Bericht nimmt eine Auswahl). */
export const SHOT_DIR = `${ROOT}test-results/vorschau`;

let galerieJs: Promise<string> | null = null;
/** Bündelt tests/e2e/vorschauGalerie.tsx (React + Bausteine) einmal je Testprozess als IIFE. */
function bundleGalerie(): Promise<string> {
  galerieJs ??= (async () => {
    const { build } = await import('vite');
    const res = await build({
      configFile: false,
      logLevel: 'silent',
      root: ROOT,
      define: { 'process.env.NODE_ENV': '"production"' },
      build: {
        write: false,
        minify: false,
        emptyOutDir: false,
        copyPublicDir: false,
        lib: { entry: `${ROOT}tests/e2e/vorschauGalerie.tsx`, formats: ['iife'], name: 'VorschauGalerie', fileName: () => 'galerie.js' },
      },
    });
    const outputs = (Array.isArray(res) ? res : [res]) as Array<{ output?: Array<{ type: string; code?: string }> }>;
    const chunk = outputs.flatMap((o) => o.output ?? []).find((c) => c.type === 'chunk');
    if (!chunk?.code) throw new Error('Galerie ließ sich nicht bündeln');
    return chunk.code;
  })();
  return galerieJs;
}

export type Opened = { external: string[]; errors: string[] };

function watch(page: Page, external: string[], errors: string[]) {
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  void external;
}

/** Öffnet einen Vorschau-Bildschirm (`h1-ring`, `l8-main` …) in Modus und Sprache, Bewegung aus. */
export async function openVorschau(page: Page, screen: string, mode: Mode, lang: Lang): Promise<Opened> {
  const external: string[] = [];
  const errors: string[] = [];
  watch(page, external, errors);
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === VORSCHAU_ORIGIN && url.pathname === '/') {
      const body =
        `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` +
        `</head><body>${VORSCHAU_HTML}</body></html>`;
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
      return;
    }
    external.push(url.href);
    await route.abort();
  });
  await page.addInitScript(
    ([m, l]) => {
      // Demo-Antwort „falsch“ wie im Ist-Vergleich (stufe1c-plan.md §1). Die Vorführleiste öffnet sich nur bei Handy-Bildschirmen ab 1100 px;
      // das Gerüst öffnet Handy-Bildschirme nur bei 390 px und Laptop-Bildschirme (L…) bei 1440/2560 px.
      window.localStorage.setItem('lx-vorschau-1', JSON.stringify({ demo: 'wrong', mode: m, motion: 'off', accent: 'iris', tab4: 'praxis', lang: l }));
    },
    [PREVIEW_MODE[mode], lang] as [string, string],
  );
  await page.goto(`${VORSCHAU_ORIGIN}/#${screen}`);
  await page.locator('#lx > *').first().waitFor();
  await settle(page);
  return { external, errors };
}

/** Öffnet die Baustein-Galerie (`teil`: heute | kacheln | hinweis | alle) mit dem CSS aus dist/. */
export async function openGalerie(page: Page, teil: string, mode: Mode, lang: Lang): Promise<Opened> {
  if (!CSS_HREF) throw new Error('dist/index.html ohne Stylesheet: erst `npm run build` (Mehr-Datei)');
  const external: string[] = [];
  const errors: string[] = [];
  watch(page, external, errors);
  const js = await bundleGalerie();
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === GALERIE_ORIGIN && url.pathname === '/galerie.html') {
      const body =
        `<!doctype html><html lang="${lang}" data-theme="${mode}" data-accent="iris" data-fx="off"><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Galerie</title>` +
        `<link rel="stylesheet" href="./${CSS_HREF}">` +
        `<style>@media (min-width: 600px) { main { max-width: 45rem !important; } }</style>` +
        `</head><body class="bg-bg text-fg" style="margin:0;background:var(--bg);color:var(--fg)"><div id="root"></div><script src="./galerie.js"></script></body></html>`;
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body });
      return;
    }
    if (url.origin === GALERIE_ORIGIN && url.pathname === '/galerie.js') {
      await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: js });
      return;
    }
    if (await serveDist(route, GALERIE_ORIGIN)) return;
    external.push(url.href);
    await route.abort();
  });
  await page.goto(`${GALERIE_ORIGIN}/galerie.html#teil=${teil}&lang=${lang}`);
  await page.locator('#root[data-ready] [data-galerie]').first().waitFor();
  await settle(page);
  return { external, errors };
}

/** Schrift geladen und alle Animationen am Ende (Bewegung ist auf beiden Seiten aus; Rest-Einblendungen abwarten). */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

export type Box = { x: number; y: number; width: number; height: number; fontSize: string; lineHeight: string; fontWeight: string; borderRadius: string };

/** Maße eines Elements (erstes Vorkommen). */
export async function box(page: Page, selector: string): Promise<Box> {
  const loc = page.locator(selector).first();
  await expect(loc, `fehlt: ${selector}`).toBeAttached();
  return loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { x: r.x, y: r.y, width: r.width, height: r.height, fontSize: cs.fontSize, lineHeight: cs.lineHeight, fontWeight: cs.fontWeight, borderRadius: cs.borderTopLeftRadius };
  });
}

export type Check = {
  /** Kurzname im Befund. */
  name: string;
  vorschau: string;
  app: string;
  /** Verglichene Größen: Breite/Höhe ±2 px, x/y ±2 px (nur wo die Lage gleich ist), Schriftwerte exakt. */
  props: Array<keyof Box>;
};

/** Vergleicht zwei Messungen: Längen ±2 px, Schriftgröße, Zeilenhöhe, Gewicht und Radius exakt. Gibt die Befunde zurück. */
export function compare(name: string, v: Box, a: Box, props: Array<keyof Box>, tol = 2): string[] {
  const out: string[] = [];
  for (const p of props) {
    const vv = v[p];
    const av = a[p];
    if (typeof vv === 'number' && typeof av === 'number') {
      if (Math.abs(vv - av) > tol) out.push(`${name}.${p}: Vorschau ${vv.toFixed(1)} · App ${av.toFixed(1)}`);
    } else if (vv !== av) out.push(`${name}.${p}: Vorschau ${String(vv)} · App ${String(av)}`);
  }
  return out;
}

/** axe (WCAG 2.1 AA) ohne Befund; liefert die Befunde als lesbare Liste. */
export async function axeFindings(page: Page, include?: string): Promise<string[]> {
  let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  if (include) b = b.include(include);
  const res = await b.analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

/**
 * Kontrast von Rändern und Zeichen (≥ 3:1, WCAG 1.4.11): Farbe `prop` des Elements gegen die Fläche `bgSelector`.
 * Farben werden über eine Leinwand in sRGB umgerechnet (auch oklch mit Alpha, über dem Grund gemischt).
 */
export async function nonTextContrast(page: Page, selector: string, prop: 'stroke' | 'color' | 'border-color' | 'background-color', bgSelector: string): Promise<number> {
  return page.evaluate(
    ([sel, p, bgSel]) => {
      const el = document.querySelector(sel);
      const bgEl = document.querySelector(bgSel);
      if (!el || !bgEl) return 0;
      const fg = getComputedStyle(el).getPropertyValue(p);
      const bg = getComputedStyle(bgEl).backgroundColor;
      const cv = document.createElement('canvas');
      cv.width = cv.height = 1;
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      if (!ctx) return 0;
      const px = (colors: string[]) => {
        ctx.clearRect(0, 0, 1, 1);
        for (const c of colors) {
          ctx.fillStyle = c;
          ctx.fillRect(0, 0, 1, 1);
        }
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0];
      };
      const lum = ([r, g, b]: number[]) => {
        const f = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(r ?? 0) + 0.7152 * f(g ?? 0) + 0.0722 * f(b ?? 0);
      };
      const lb = lum(px([bg]));
      const lf = lum(px([bg, fg]));
      return (Math.max(lb, lf) + 0.05) / (Math.min(lb, lf) + 0.05);
    },
    [selector, prop, bgSelector] as [string, string, string],
  );
}

/** Bildpfad eines Paars: test-results/vorschau/<paar>/<größe>-<modus>-<sprache>-<seite>.png */
export function shotPath(pair: string, size: Size, mode: Mode, lang: Lang, side: 'vorschau' | 'app'): string {
  const dir = `${SHOT_DIR}/${pair}`;
  mkdirSync(dir, { recursive: true });
  return `${dir}/${size.name}-${mode}-${lang}-${side}.png`;
}
