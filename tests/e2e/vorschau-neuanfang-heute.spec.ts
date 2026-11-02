import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { TUE_9, WEEK_W39 } from './heuteHelpers';
import { axeFindings, box, compare, shotPath, type Check, type Mode, type Size } from './vorschauHelpers';

// UX-Neuanfang B (Emrah 02.11.2026 „Passt, so einbauen“): Heute gegen die freigegebene Vorschau `5Zwv5noCiNwzrzzfQsfzXy`
// (Quelle docs/relaunch/vorschau-neuanfang/vorschau.html). Links die Vorschau, rechts die echte App mit Testdaten am Tagesanfang.
// Verglichen werden Größen und Schriftwerte des Tageswegs (die Vorschau setzt eine andere Schrift und 16 px Seitenrand, deshalb keine Lagen).
// Dazu: genau ein Hauptknopf, axe ohne Befund, keine fremde Anfrage, kein Fehler im Browser. Bilder: test-results/vorschau/<paar>/.

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const ORIGIN = 'https://neuanfang.artifact.test';
// Die Vorschau lädt eine Webschrift von außen; hier ohne sie (gemessen werden nur Größen, keine Schriftbreiten).
const HTML = readFileSync(`${ROOT}docs/relaunch/vorschau-neuanfang/vorschau.html`, 'utf8').replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, '');

const PHONE: Check[] = [
  { name: 'titel', vorschau: '.hello .t-title', app: '[data-testid="today-topic"]', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'datum', vorschau: '.hello .row .t-meta', app: '[data-testid="hello-date"]', props: ['fontSize'] },
  { name: 'schritt-x-von-n', vorschau: '.hello > .t-meta', app: '[data-testid="today-title"]', props: ['fontSize'] },
  { name: 'karte', vorschau: 'section.card', app: '.lx-vh-pathcard', props: ['borderRadius'] },
  { name: 'punkt', vorschau: '.st .dot', app: '.lx-vh-dot', props: ['width', 'height', 'borderRadius', 'fontSize', 'fontWeight'] },
  { name: 'schrittname', vorschau: '.st h3', app: '.lx-vh-st-n', props: ['fontSize', 'fontWeight'] },
  { name: 'minuten', vorschau: '.st .min', app: '.lx-vh-st-min', props: ['fontSize'] },
  { name: 'aktuell', vorschau: '.st.now', app: '.lx-vh-st[data-st="now"]', props: ['borderRadius'] },
  { name: 'balken', vorschau: '.bar', app: '.lx-vh-bar', props: ['height', 'borderRadius'] },
  { name: 'knopf', vorschau: '[data-act="start"]', app: '[data-testid="start"]', props: ['height'] },
  { name: 'freiwillig', vorschau: '.sec .t-label', app: '.lx-vh-label', props: ['fontSize', 'fontWeight'] },
];
/** Ab 1.280 px stehen die freiwilligen Angebote rechts in der Kontextspalte (eigener Aufbau). */
const DESK: Check[] = PHONE.filter((c) => c.name !== 'freiwillig');

const SIZES: Array<Size & { checks: Check[] }> = [
  { name: '390', width: 390, height: 844, checks: PHONE },
  { name: '1440', width: 1440, height: 900, checks: DESK },
];
const MODES: Mode[] = ['dark', 'dim', 'light'];

async function openPreview(page: Page, mode: Mode): Promise<{ external: string[]; errors: string[] }> {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
      return;
    }
    external.push(url.href);
    await route.abort();
  });
  await page.emulateMedia({ colorScheme: mode === 'light' ? 'light' : 'dark', reducedMotion: 'reduce' });
  await page.goto(`${ORIGIN}/#heute`);
  await page.locator('.path .st').first().waitFor();
  return { external, errors };
}

for (const size of SIZES) {
  for (const mode of MODES) {
    test(`Vorschau-Paar heute-neuanfang · ${size.name} · ${mode}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce', locale: 'de-DE' });
      const vp = await ctx.newPage();
      const ap = await ctx.newPage();
      const v = await openPreview(vp, mode);
      const a = await boot(ap, { migrated: true, theme: mode, lang: 'de', now: TUE_9, fake: { patch: { ...WEEK_W39 } } });
      await screen(ap, 'today');
      await ap.getByTestId('today-card').waitFor();
      await ap.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(document.getAnimations().map((x) => x.finished.catch(() => undefined)));
      });
      await vp.screenshot({ path: shotPath('heute-neuanfang', size, mode, 'de', 'vorschau') });
      await ap.screenshot({ path: shotPath('heute-neuanfang', size, mode, 'de', 'app') });

      const findings: string[] = [];
      for (const c of size.checks) findings.push(...compare(c.name, await box(vp, c.vorschau), await box(ap, c.app), c.props));
      expect(findings, `Abweichungen von der Vorschau (heute-neuanfang, ${size.name}, ${mode})`).toEqual([]);

      // Aufbau wie die Vorschau: drei Schritte, der erste ist dran, ein Hauptknopf „Los: …“, kein Ring mehr.
      await expect(ap.getByTestId('duty')).toHaveCount(3);
      await expect(ap.locator('.lx-vh-st[data-st="now"]')).toHaveCount(1);
      await expect(ap.locator('main .lx-v-btn[data-variant="pri"]')).toHaveCount(1);
      await expect(ap.getByTestId('start')).toHaveText(/^Los: /);
      await expect(ap.getByTestId('today-ring')).toHaveCount(0);

      expect(await axeFindings(ap, '[data-testid="stage"]'), 'axe auf Heute').toEqual([]);
      expect([...v.external.filter((u) => !u.startsWith('https://fonts.')), ...a.external], 'fremde Anfragen').toEqual([]);
      expect([...v.errors, ...a.errors], 'Fehler im Browser').toEqual([]);
      await ctx.close();
    });
  }
}
