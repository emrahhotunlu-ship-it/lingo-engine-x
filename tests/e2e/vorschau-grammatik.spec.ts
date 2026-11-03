import { expect, test, type Page } from '@playwright/test';
import { boot, openTab, screen } from './fixtures';
import { LANGS, MODES, SIZES, axeFindings, box, compare, openVorschau, shotPath, type Check, type Lang, type Mode, type Size } from './vorschauHelpers';

// Vorschau-Paare „Grammatik“ (Relaunch Teil 1c, D5 V-GRAMMATIK; docs/relaunch/stufe1c-plan.md §3.0/§3.1, Auftrag docs/umbau/auftraege/d5.md):
// H6 `path` und `chapter` am Handy (390 × 844), L4 `main` am Laptop (1440 × 900, 2560 × 1440), je Dunkel, Gedämpft, Hell, DE und EN.
// Links die Vorschau, rechts die echte App mit Testdaten. Gemessen wird, was gleich aufgebaut ist (±2 px, Schrift exakt); Inhalte (Thema,
// Kapitelnamen, Anzahl Kapitel 7 statt 8) sind echte Werte und dürfen abweichen – deshalb keine y-Werte unterhalb der ersten Karte. Die Karte
// „Du bist hier“ trägt in der App den Hauptknopf (Vorschau ohne), ihre Höhe wird darum nicht verglichen.
// Dazu axe ohne Befund, keine fremde Anfrage, kein Fehler im Browser. Bilder: test-results/vorschau/<paar>/.

type AppState = 'path' | 'chapter';
type Pair = { name: string; vorschau: string; app: AppState; phone: boolean; checks: Check[] };

const HEAD: Check[] = [
  { name: 'kopf', vorschau: '.phead', app: '.lx-vh-head', props: ['y', 'height'] },
  { name: 'titel', vorschau: '.phead h1', app: '.lx-vh-head h1', props: ['x', 'y', 'height', 'fontSize', 'lineHeight', 'fontWeight'] },
  // Großpaket B1: im Kopf stehen Übersetzer · Fragen · Zahnrad – „Fragen“ sitzt weiter links als in der Vorschau, verglichen wird die Form.
  { name: 'fragen', vorschau: '#ask-open', app: '[data-testid="open-companion"]', props: ['width', 'height', 'borderRadius'] },
];
const HERE: Check[] = [
  { name: 'hierkarte', vorschau: '.scroll .card', app: '[data-testid="hub-next-topic"]', props: ['x', 'y', 'width', 'borderRadius'] },
  { name: 'hierlabel', vorschau: '.scroll .card .lbl', app: '[data-testid="hub-next-topic"] .lx-vg-lbl', props: ['x', 'y', 'fontSize', 'fontWeight'] },
  { name: 'hierthema', vorschau: '.scroll .card .h2', app: '[data-testid="hub-next-topic"] .lx-vg-h2', props: ['x', 'y', 'fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'hierzeile', vorschau: '.scroll .card .p2', app: '[data-testid="hub-next-line"]', props: ['x', 'fontSize', 'lineHeight'] },
  // Höhe nicht: in der Vorschau fällt `.bar` (flex: 1 in der Spalte) auf 0 px zusammen; die App zeigt 6 px wie `.bar` gemeint ist.
  { name: 'balken', vorschau: '.scroll .card .bar', app: '[data-testid="here-steps"]', props: ['x', 'width'] },
];
const LIST: Check[] = [
  { name: 'listenlabel', vorschau: '.scroll .lbl[style*="padding"]', app: '.lx-vg-pathlbl', props: ['x', 'fontSize', 'fontWeight'] },
  { name: 'zeile', vorschau: '#ch-1', app: '[data-testid="path-chapter"]', props: ['x', 'width', 'height'] },
  { name: 'kachel', vorschau: '#ch-1 .ri', app: '[data-testid="path-chapter"] .lx-vg-num', props: ['width', 'height', 'borderRadius', 'fontSize', 'fontWeight'] },
  { name: 'kapitelname', vorschau: '#ch-1 .rt b', app: '[data-testid="path-chapter"] .lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
  { name: 'kapitelstand', vorschau: '#ch-1 .rt span', app: '[data-testid="path-chapter-sub"]', props: ['fontSize'] },
  { name: 'gesperrt', vorschau: '#ch-2 .rt b', app: '[data-testid="path-chapter"][data-kind="later"] .lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
  // Höhe nicht: die Vorschau hat 41 px (2,75em), die App hält die Mindestgröße 44 px für Bedienelemente (stufe1-plan §6.6).
  { name: 'mehr', vorschau: '#g-more', app: '[data-testid="hub-extra"]', props: ['fontSize', 'fontWeight', 'borderRadius'] },
];
const DETAIL: Check[] = [
  { name: 'kapitellabel', vorschau: '.springopen .lbl', app: '[data-testid="chapter-eyebrow"]', props: ['x', 'fontSize', 'fontWeight'] },
  { name: 'kapiteltitel', vorschau: '.springopen .h2', app: '.lx-vg-dh2', props: ['x', 'fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'themenkarte', vorschau: '.springopen .card', app: '.lx-vg-topics', props: ['x', 'width', 'borderRadius'] },
  // Höhe nicht: sie hängt am Themennamen (die Vorschau bricht „past simple vs. present perfect“ um); die Mindesthöhe 58 px ist gleich.
  { name: 'thema', vorschau: '.springopen .st', app: '[data-testid="chapter-topic"]', props: ['x', 'width', 'fontSize'] },
  { name: 'themenmin', vorschau: '.springopen .st:last-child', app: '[data-testid="chapter-topic"]:last-child', props: ['height'] },
  { name: 'themenzeichen', vorschau: '.springopen .st .mk', app: '[data-testid="chapter-topic"] .lx-v-st-mk', props: ['x', 'width', 'height'] },
  { name: 'fehlerzeile', vorschau: '#ch-errors', app: '[data-testid="chapter-errors"]', props: ['x', 'width', 'height'] },
  { name: 'fehlertitel', vorschau: '#ch-errors .rt b', app: '[data-testid="chapter-errors"] .lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
  { name: 'lehrerzeile', vorschau: '#ch-teacher', app: '[data-testid="chapter-teacher"]', props: ['x', 'width', 'height'] },
];
/** Laptop: Größen und Schrift (die Lage hängt an Seitenleiste und Spalte des Rahmens). */
const DESK: Check[] = [
  { name: 'titel', vorschau: '.dh1', app: '.lx-vh-head h1', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'hierkarte', vorschau: '.dscroll .card', app: '[data-testid="hub-next-topic"]', props: ['borderRadius'] },
  { name: 'hierthema', vorschau: '.dscroll .card .h2', app: '[data-testid="hub-next-topic"] .lx-vg-h2', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'zeile', vorschau: '#dch-2', app: '[data-testid="path-chapter"][data-kind="later"]', props: ['height'] },
  { name: 'kachel', vorschau: '#dch-1 .ri', app: '[data-testid="path-chapter"] .lx-vg-num', props: ['width', 'height', 'borderRadius', 'fontSize', 'fontWeight'] },
  { name: 'kapitelname', vorschau: '#dch-1 .rt b', app: '[data-testid="path-chapter"] .lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
  { name: 'spaltentitel', vorschau: '.ctx .h2', app: '[data-testid="learn-context"] .lx-vg-dh2', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'spaltenthema', vorschau: '.ctx .st', app: '[data-testid="learn-context"] [data-testid="chapter-topic"]', props: ['fontSize'] },
  { name: 'spaltenzeile', vorschau: '#d-ch-errors', app: '[data-testid="learn-context"] [data-testid="chapter-errors"]', props: ['height'] },
];

const PAIRS: Pair[] = [
  { name: 'grammatik-h6-path', vorschau: 'h6-path', app: 'path', phone: true, checks: [...HEAD, ...HERE, ...LIST] },
  { name: 'grammatik-h6-chapter', vorschau: 'h6-chapter', app: 'chapter', phone: true, checks: DETAIL },
  { name: 'grammatik-l4-main', vorschau: 'l4-main', app: 'path', phone: false, checks: DESK },
];

async function openApp(page: Page, state: AppState, mode: Mode, lang: Lang, desk: boolean): Promise<{ external: string[]; errors: string[] }> {
  const r = await boot(page, { migrated: true, theme: mode, lang });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.getByTestId('path-chapters').waitFor();
  if (desk) await page.getByTestId('learn-context').waitFor();
  if (state === 'chapter') {
    await page.locator('[data-testid="path-chapter"][data-status="current"]').click();
    await page.getByTestId('chapter-page').waitFor();
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
  return r;
}

const deskSize = (s: Size) => s.width >= 600;

for (const pair of PAIRS) {
  test.describe(`Vorschau-Paar ${pair.name}`, () => {
    for (const size of SIZES) {
      if (deskSize(size) === pair.phone) continue;
      for (const mode of MODES) {
        for (const lang of LANGS) {
          test(`${size.name} · ${mode} · ${lang}`, async ({ browser }) => {
            const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce', locale: lang === 'de' ? 'de-DE' : 'en-US' });
            const vp = await ctx.newPage();
            const ap = await ctx.newPage();
            const v = await openVorschau(vp, pair.vorschau, mode, lang);
            const a = await openApp(ap, pair.app, mode, lang, !pair.phone);
            await vp.screenshot({ path: shotPath(pair.name, size, mode, lang, 'vorschau') });
            await ap.screenshot({ path: shotPath(pair.name, size, mode, lang, 'app') });

            const findings: string[] = [];
            for (const c of pair.checks) findings.push(...compare(c.name, await box(vp, c.vorschau), await box(ap, c.app), c.props));
            expect(findings, `Abweichungen von der Vorschau (${pair.name}, ${size.name}, ${mode}, ${lang})`).toEqual([]);

            expect(await axeFindings(ap, '[data-testid="stage"]'), 'axe auf der Bühne').toEqual([]);
            if (!pair.phone) expect(await axeFindings(ap, '[data-testid="context-column"]'), 'axe in der Kontextspalte').toEqual([]);
            expect([...v.external, ...a.external], 'fremde Anfragen').toEqual([]);
            expect([...v.errors, ...a.errors], 'Fehler im Browser').toEqual([]);
            await ctx.close();
          });
        }
      }
    }
  });
}
