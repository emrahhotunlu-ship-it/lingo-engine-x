import { expect, test } from '@playwright/test';
import {
  LANGS,
  MODES,
  SIZES,
  axeFindings,
  box,
  compare,
  nonTextContrast,
  openGalerie,
  openVorschau,
  shotPath,
  type Check,
  type Size,
} from './vorschauHelpers';

// Vergleichsgerüst App ↔ Vorschau (Relaunch Teil 1c, D1 V-BAU; docs/relaunch/stufe1c-plan.md §3.0).
// Je Paar und je Größe (390×844, 1440×900, 2560×1440), Modus (Dunkel, Gedämpft, Hell) und Sprache (DE, EN):
//  - ein Bild der Vorschau und eines der App (test-results/vorschau/<paar>/…),
//  - Maße per getBoundingClientRect gegen die Vorschau (±2 px, Schriftgröße exakt) – jede Abweichung ist ein Befund,
//  - axe ohne Befund und Kontrast von Zeichen ≥ 3:1 auf der App-Seite,
//  - keine fremde Anfrage und kein Fehler im Browser auf beiden Seiten.
// D1 liefert die Probe-Paare der Bausteine (Galerie tests/e2e/vorschauGalerie.tsx). D2 ff. hängen ihre Bildschirm-Paare an PAIRS an
// (App-Seite dann über fixtures.boot statt openGalerie: Feld `app` als Funktion).

type Side = { vorschau: string; checks: Check[] };
type Pair = { name: string; teil: string; phone?: Side; desk?: Side };

const PAIRS: Pair[] = [
  {
    // H1 `ring` (screens.js:117–176): Kopf, Tageskarte mit Ring und Blockliste, Hauptknopf, Wochenstreifen, Zeilen.
    name: 'heute-bausteine',
    teil: 'heute',
    phone: {
      vorschau: 'h1-ring',
      checks: [
        { name: 'kopf', vorschau: '.phead', app: '.lx-v-phead', props: ['x', 'y', 'width', 'height'] },
        { name: 'titel', vorschau: '.phead h1', app: '.lx-v-phead h1', props: ['height', 'fontSize', 'lineHeight', 'fontWeight'] },
        { name: 'fragen', vorschau: '#ask-open', app: '.lx-v-phead .lx-v-iconbtn', props: ['x', 'y', 'width', 'height', 'borderRadius'] },
        { name: 'tageskarte', vorschau: '.daycard', app: '[data-galerie="heute"] .lx-v-card', props: ['x', 'y', 'width', 'height', 'borderRadius'] },
        { name: 'ring', vorschau: '#ring', app: '[data-testid="g-ring"]', props: ['x', 'y', 'width', 'height'] },
        { name: 'ringzahl', vorschau: '.ringc b', app: '.lx-v-ringc b', props: ['x', 'y', 'fontSize', 'lineHeight', 'fontWeight'] },
        { name: 'ringtext', vorschau: '.ringc span', app: '.lx-v-ringc span', props: ['fontSize', 'fontWeight'] },
        { name: 'block', vorschau: '.st', app: '.lx-v-st', props: ['x', 'y', 'width', 'height', 'fontSize'] },
        { name: 'blockzeichen', vorschau: '.st .mk', app: '.lx-v-st-mk', props: ['x', 'y', 'width', 'height'] },
        { name: 'blockzeit', vorschau: '.st .sm', app: '.lx-v-st-sm', props: ['fontSize'] },
        { name: 'knopf', vorschau: '#today-go', app: '[data-testid="g-go"]', props: ['x', 'y', 'width', 'height', 'fontSize', 'fontWeight', 'borderRadius'] },
        { name: 'woche', vorschau: '.week', app: '.lx-v-week', props: ['x', 'y', 'width', 'height'] },
        { name: 'tag', vorschau: '.wd i', app: '.lx-v-wd i', props: ['x', 'y', 'width', 'height'] },
        { name: 'tagname', vorschau: '.wd', app: '.lx-v-wd', props: ['width', 'fontSize', 'fontWeight'] },
        { name: 'serie', vorschau: '.streak b', app: '.lx-v-streak b', props: ['x', 'y', 'fontSize', 'lineHeight', 'fontWeight'] },
        // Über den Zeilen steht in der Vorschau die Trennzeile „Wenn du mehr willst“ (D2), daher ohne y.
        { name: 'zeile', vorschau: '.row', app: '.lx-v-row', props: ['x', 'width', 'height'] },
        { name: 'zeilensymbol', vorschau: '.row .ri', app: '.lx-v-row-ic', props: ['width', 'height', 'borderRadius'] },
        { name: 'zeilentitel', vorschau: '.row .rt b', app: '.lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
      ],
    },
    desk: {
      // L1 `main` (desk.js:81–106): Ring 13em, Hauptknopf mit Laptop-Maßen.
      vorschau: 'l1-main',
      checks: [
        { name: 'ring', vorschau: '#ring', app: '[data-testid="g-ring"]', props: ['width', 'height'] },
        { name: 'knopf', vorschau: '#d-go', app: '[data-testid="g-go"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
      ],
    },
  },
  {
    // H14 `main` (screens.js:963–971) / L8 `main` (desk.js:368–384): Kacheln.
    name: 'fortschritt-kacheln',
    teil: 'kacheln',
    phone: {
      vorschau: 'h14-main',
      checks: [
        { name: 'kachel', vorschau: '#tile-w', app: '.lx-v-tile', props: ['width', 'height', 'borderRadius'] },
        { name: 'kachelkopf', vorschau: '#tile-w .th', app: '.lx-v-tile-h', props: ['height', 'fontSize', 'lineHeight', 'fontWeight'] },
        { name: 'kachelzahl', vorschau: '#tile-w .big', app: '.lx-v-tile-big', props: ['height', 'fontSize', 'lineHeight', 'fontWeight'] },
        { name: 'kachelweg', vorschau: '#tile-w .way', app: '.lx-v-tile-way', props: ['fontSize', 'lineHeight'] },
        { name: 'kachelzeile', vorschau: '#tile-g .one', app: '.lx-v-tile:nth-child(2) .lx-v-tile-one', props: ['fontSize', 'lineHeight'] },
      ],
    },
    desk: {
      vorschau: 'l8-main',
      checks: [
        { name: 'kachel', vorschau: '#tile-g', app: '.lx-v-tile:nth-child(2)', props: ['height', 'borderRadius'] },
        { name: 'kachelzahl', vorschau: '#tile-w .big', app: '.lx-v-tile-big', props: ['fontSize', 'lineHeight', 'fontWeight'] },
        { name: 'kachelkopf', vorschau: '#tile-w .th', app: '.lx-v-tile-h', props: ['fontSize'] },
      ],
    },
  },
  {
    // H16 `noai` (screens.js:1051–1057): Hinweis und „Erneut versuchen“.
    name: 'ausfall-hinweis',
    teil: 'hinweis',
    phone: {
      vorschau: 'h16-noai',
      checks: [
        { name: 'hinweis', vorschau: '.notice', app: '.lx-v-notice', props: ['x', 'width', 'height', 'fontSize', 'lineHeight', 'borderRadius'] },
        { name: 'erneut', vorschau: '#retry', app: '[data-galerie="hinweis"] > div:nth-child(3) .lx-v-btn', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
      ],
    },
  },
];

const deskSize = (s: Size) => s.width >= 600;

for (const pair of PAIRS) {
  test.describe(`Vorschau-Paar ${pair.name}`, () => {
    for (const size of SIZES) {
      const side = deskSize(size) ? pair.desk : pair.phone;
      if (!side) continue;
      for (const mode of MODES) {
        for (const lang of LANGS) {
          test(`${size.name} · ${mode} · ${lang}`, async ({ browser }) => {
            const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce', locale: lang === 'de' ? 'de-DE' : 'en-US' });
            const vp = await ctx.newPage();
            const ap = await ctx.newPage();
            const v = await openVorschau(vp, side.vorschau, mode, lang);
            const a = await openGalerie(ap, pair.teil, mode, lang);
            await vp.screenshot({ path: shotPath(pair.name, size, mode, lang, 'vorschau') });
            await ap.screenshot({ path: shotPath(pair.name, size, mode, lang, 'app') });

            const findings: string[] = [];
            for (const c of side.checks) findings.push(...compare(c.name, await box(vp, c.vorschau), await box(ap, c.app), c.props));
            expect(findings, `Abweichungen von der Vorschau (${pair.name}, ${size.name}, ${mode}, ${lang})`).toEqual([]);

            expect(await axeFindings(ap), 'axe auf der App-Seite').toEqual([]);
            expect([...v.external, ...a.external], 'fremde Anfragen').toEqual([]);
            expect([...v.errors, ...a.errors], 'Fehler im Browser').toEqual([]);
            await ctx.close();
          });
        }
      }
    }
  });
}

test.describe('Baustein-Galerie: Bedienung, Kontrast, Bewegung', () => {
  for (const mode of MODES) {
    test(`Kontrast von Zeichen ≥ 3:1 und axe (${mode})`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage();
      const o = await openGalerie(page, 'alle', mode, 'de');
      // Ring (erledigte Segmente), laufender Block und gewählter Chip-Rand gegen ihre Fläche.
      expect(await nonTextContrast(page, '.lx-v-ring-on', 'stroke', '[data-galerie="heute"] .lx-v-card')).toBeGreaterThanOrEqual(3);
      expect(await nonTextContrast(page, '.lx-v-st[data-state="run"] .lx-v-st-mk', 'color', '[data-galerie="heute"] .lx-v-card')).toBeGreaterThanOrEqual(3);
      expect(await nonTextContrast(page, '.lx-v-btn[data-variant="pri"]', 'background-color', 'body')).toBeGreaterThanOrEqual(3);
      expect(await axeFindings(page)).toEqual([]);
      expect(o.external).toEqual([]);
      expect(o.errors).toEqual([]);
      await ctx.close();
    });
  }

  test('Ring öffnet und schließt die Blockliste; Blatt mit Esc, Fokus kehrt zurück', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await openGalerie(page, 'heute', 'dark', 'de');
    const ring = page.getByTestId('g-ring');
    await expect(ring).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.lx-v-statelist')).toBeVisible();
    await ring.click();
    await expect(ring).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.lx-v-statelist')).toHaveCount(0);
    await ring.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.lx-v-statelist')).toBeVisible();

    const row = page.locator('.lx-v-row').first();
    await row.click();
    const sheet = page.getByTestId('g-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet).toBeFocused();
    // Griff, Titel und Fuß wie die Vorschau (style.css:299–304).
    const grab = await box(page, '.lx-v-grab');
    expect([grab.width, grab.height]).toEqual([40, 5]);
    expect((await box(page, '.lx-v-sheet h2')).fontSize).toBe('22px');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(row).toBeFocused();
    // Antippen der abgedunkelten Fläche schließt ebenfalls.
    await row.click();
    await page.mouse.click(195, 40);
    await expect(sheet).toHaveCount(0);
    await ctx.close();
  });

  test('Bewegung: bei reduced-motion nur Einblenden, sonst Zeichnen und Federn', async ({ browser }) => {
    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p1 = await reduced.newPage();
    await openGalerie(p1, 'heute', 'dark', 'de');
    expect(await p1.locator('.lx-v-ring-on').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('lx-v-fade');
    expect(await p1.locator('.lx-v-statelist').evaluate((el) => getComputedStyle(el).animationName)).toBe('lx-v-fade');
    await reduced.close();

    const full = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
    const p2 = await full.newPage();
    await openGalerie(p2, 'heute', 'dark', 'de');
    // Effekte „Aus“ (data-fx) hat Vorrang wie in der App; für die Probe einschalten.
    await p2.evaluate(() => document.documentElement.setAttribute('data-fx', 'full'));
    expect(await p2.locator('.lx-v-ring-on').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('lx-v-ring-draw');
    expect(await p2.locator('.lx-v-statelist').evaluate((el) => getComputedStyle(el).animationName)).toBe('lx-v-spring-open');
    await full.close();
  });

  test('Zielgröße: jedes bedienbare Element der Galerie ≥ 44 px (Chips mit Trefferfläche)', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await openGalerie(page, 'alle', 'dark', 'de');
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('main button')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          const before = getComputedStyle(el, '::before');
          // Unsichtbare Trefferfläche (Chips): inset -5px oben und unten.
          const extra = before.content !== 'none' && before.position === 'absolute' ? -2 * parseFloat(before.top || '0') : 0;
          return { name: el.textContent?.trim() || el.getAttribute('aria-label') || el.className, w: r.width, h: r.height + extra };
        })
        .filter((b) => b.h < 44 || b.w < 44),
    );
    expect(small).toEqual([]);
    await ctx.close();
  });
});
