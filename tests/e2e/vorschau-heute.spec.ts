import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { MON, MON_9, NO_GRAMMAR_ERRORS, TUE_9, WEEK_W39, profileWith, reviewedLog, vgPlan } from './heuteHelpers';
import { LANGS, MODES, SIZES, axeFindings, box, compare, openVorschau, shotPath, type Check, type Lang, type Mode, type Size } from './vorschauHelpers';

// Vorschau-Paare „Heute“ (Relaunch Teil 1c, D2 V-HEUTE; docs/relaunch/stufe1c-plan.md §3.0/§3.1): H1 done und pause
// am Handy (390 × 844) und L1 done am Laptop (1440 × 900, 2560 × 1440), je in Dunkel, Gedämpft und Hell, DE und EN.
// Links die Vorschau (`openVorschau`), rechts die echte App mit Testdaten (`fixtures.boot`) im passenden Tageszustand. Gemessen wird per
// getBoundingClientRect (±2 px, Schrift exakt), was in beiden gleich aufgebaut ist; Inhalte (Thema, Zeilenzahl) sind echte Werte und dürfen
// abweichen. Dazu axe ohne Befund auf der Heute-Fläche, keine fremde Anfrage und kein Fehler im Browser. Bilder: test-results/vorschau/<paar>/.

type AppState = 'start' | 'mid' | 'ring' | 'done' | 'skeleton' | 'pause';
type Pair = { name: string; vorschau: string; app: AppState; phone: boolean; checks: Check[] };

/** Gemeinsame Handy-Messpunkte: Kopf und Tageskarte (H1 screens.js:174–176). */
const HEAD: Check[] = [
  { name: 'fragen', vorschau: '#ask-open', app: '[data-testid="open-companion"]', props: ['x', 'y', 'width', 'height', 'borderRadius'] },
  // Die Vorschau zieht `.phead` über die ganze Breite (Rand innen); gemessen werden Höhe und Lage des Inhalts (Titel, „Fragen“).
  { name: 'kopf', vorschau: '.phead', app: '.lx-vh-head', props: ['y', 'height'] },
  { name: 'titel', vorschau: '.phead h1', app: '.lx-vh-head h1', props: ['x', 'y', 'height', 'fontSize', 'lineHeight', 'fontWeight'] },
];
const WEEK_MORE: Check[] = [
  { name: 'woche', vorschau: '.week', app: '.lx-vh-week', props: ['x', 'width', 'height'] },
  { name: 'tag', vorschau: '.wd i', app: '.lx-vh-week .lx-v-wd i', props: ['x', 'width', 'height'] },
  { name: 'tagname', vorschau: '.wd', app: '.lx-vh-week .lx-v-wd', props: ['width', 'fontSize', 'fontWeight'] },
  { name: 'serie', vorschau: '.streak b', app: '.lx-vh-week .lx-v-streak b', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'trenner', vorschau: '.more-div', app: '.lx-vh-more-div', props: ['height', 'fontSize', 'fontWeight'] },
  { name: 'zeile', vorschau: '.row', app: '[data-testid="more-row"]', props: ['x', 'width'] },
  { name: 'zeilensymbol', vorschau: '.row .ri', app: '[data-testid="more-row"] .lx-v-row-ic', props: ['x', 'width', 'height', 'borderRadius'] },
  { name: 'zeilentitel', vorschau: '.row .rt b', app: '[data-testid="more-row"] .lx-v-row-t b', props: ['fontSize', 'fontWeight'] },
];

/** Laptop L1 (desk.js:96–106): Größen und Schrift (die Lage hängt an Seitenleiste und Spalte, beide eigene Pakete). */
const DESK: Check[] = [
  { name: 'titel', vorschau: '.dh1', app: '.lx-vh-head h1', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'fragen', vorschau: '#d-ask', app: '[data-testid="open-companion"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
  { name: 'ring', vorschau: '#ring', app: '[data-testid="today-ring"] .lx-v-ring', props: ['width', 'height'] },
  { name: 'ringzahl', vorschau: '.ringc b', app: '[data-testid="today-ring"] .lx-v-ringc b', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'thema', vorschau: '.dtopic .t', app: '[data-testid="today-topic"]', props: ['fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'tageskarte', vorschau: '.daycard', app: '[data-testid="today-card"]', props: ['borderRadius'] },
  { name: 'mitte', vorschau: '.l1mid .card', app: '.lx-vh-mid-card', props: ['borderRadius'] },
  { name: 'spaltentitel', vorschau: '.ctx h3', app: '.lx-vh-ctx h3', props: ['fontSize', 'fontWeight'] },
  { name: 'wochentag', vorschau: '.ctx .st', app: '.lx-vh-weeklist .lx-v-st', props: ['fontSize'] },
  { name: 'spaltenzeile', vorschau: '.ctx .row', app: '.lx-vh-ctx [data-testid="more-row"]', props: ['fontSize'] },
];

const PAIRS: Pair[] = [
  // Tagesanfang: Die Testdaten haben an diesem Dienstag keine laufende Serie (nie „Serie 0“), deshalb ohne Serienzahl.
  // Seit UX-Neuanfang B zeigt Heute vor dem Abschluss den Tagesweg statt des Rings (Vergleich: vorschau-neuanfang-heute.spec.ts).
  // Hier bleiben die Zustände mit Ring: Abschluss (DoneCard3) und Wiedereinstieg nach Pause (RestartCard).
  {
    name: 'heute-done',
    vorschau: 'h1-done',
    app: 'done',
    phone: true,
    checks: [
      ...HEAD,
      { name: 'tageskarte', vorschau: '.daycard', app: '[data-testid="today-card"]', props: ['x', 'y', 'width', 'borderRadius'] },
      { name: 'ring', vorschau: '#ring', app: '[data-testid="today-ring"] .lx-v-ring', props: ['x', 'y', 'width', 'height'] },
      { name: 'ringzahl', vorschau: '.ringc b', app: '[data-testid="today-ring"] .lx-v-ringc b', props: ['fontSize', 'lineHeight', 'fontWeight'] },
      { name: 'titel-karte', vorschau: '.dtopic .t', app: '[data-testid="balance"]', props: ['x', 'width', 'fontSize', 'lineHeight', 'fontWeight'] },
      { name: 'unterzeile', vorschau: '.dtopic .sub', app: '[data-testid="today-card"] .lx-vh-sub', props: ['fontSize', 'lineHeight'] },
      ...WEEK_MORE,
    ],
  },
  {
    name: 'heute-pause',
    vorschau: 'h1-pause',
    app: 'pause',
    phone: true,
    checks: [
      ...HEAD,
      { name: 'tageskarte', vorschau: '.daycard', app: '[data-testid="restart-card"]', props: ['x', 'y', 'width', 'borderRadius'] },
      { name: 'ring', vorschau: '#ring', app: '[data-testid="restart-ring"] .lx-v-ring', props: ['x', 'y', 'width', 'height'] },
      { name: 'ringzahl', vorschau: '.ringc b', app: '[data-testid="restart-ring"] .lx-v-ringc b', props: ['fontSize', 'lineHeight', 'fontWeight'] },
      { name: 'titel-karte', vorschau: '.dtopic .t', app: '[data-testid="restart-card"] .lx-vh-t', props: ['x', 'width', 'fontSize', 'lineHeight', 'fontWeight'] },
      { name: 'unterzeile', vorschau: '.dtopic .sub', app: '[data-testid="restart-card"] .lx-vh-sub', props: ['fontSize', 'lineHeight'] },
      { name: 'knopf', vorschau: '#today-go', app: '[data-testid="restart-start"]', props: ['x', 'width', 'height', 'fontSize', 'fontWeight', 'borderRadius'] },
    ],
  },
  { name: 'heute-l1-done', vorschau: 'l1-done', app: 'done', phone: false, checks: DESK.filter((c) => c.name !== 'thema') },
];

/** Öffnet die App im verlangten Tageszustand (Testdaten, Bewegung aus). */
async function openApp(page: Page, state: AppState, mode: Mode, lang: Lang): Promise<{ external: string[]; errors: string[] }> {
  const base = { migrated: true, theme: mode, lang } as const;
  let r: { external: string[]; errors: string[] };
  if (state === 'start') r = await boot(page, { ...base, now: TUE_9, fake: { patch: { ...WEEK_W39 } } });
  else if (state === 'mid' || state === 'ring') r = await boot(page, { ...base, now: MON_9, fake: { patch: { ...profileWith(MON, vgPlan(), []), ...reviewedLog(MON) } } });
  else if (state === 'done')
    r = await boot(page, { ...base, now: MON_9, fake: { patch: { ...profileWith(MON, vgPlan(), ['u-task', 'u-focus', 'u-again']), ...reviewedLog(MON), ...NO_GRAMMAR_ERRORS } } });
  else if (state === 'pause') r = await boot(page, { ...base, now: '2026-10-05T09:00:00+02:00' });
  else r = await boot(page, { ...base, fake: { useDelayMsBy: { db: 60_000 } } });
  if (state === 'skeleton') {
    await page.getByTestId('today-skeleton').waitFor();
  } else {
    await screen(page, 'today');
    await page.getByTestId(state === 'pause' ? 'restart-card' : 'today-card').waitFor();
    if (state === 'ring') {
      await page.locator('[data-testid="today-ring"] .lx-v-ring').click();
      await expect(page.getByTestId('duties')).toBeVisible();
    }
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
            const a = await openApp(ap, pair.app, mode, lang);
            await vp.screenshot({ path: shotPath(pair.name, size, mode, lang, 'vorschau') });
            await ap.screenshot({ path: shotPath(pair.name, size, mode, lang, 'app') });

            const findings: string[] = [];
            for (const c of pair.checks) findings.push(...compare(c.name, await box(vp, c.vorschau), await box(ap, c.app), c.props));
            expect(findings, `Abweichungen von der Vorschau (${pair.name}, ${size.name}, ${mode}, ${lang})`).toEqual([]);

            expect(await axeFindings(ap, '[data-testid="stage"]'), 'axe auf Heute').toEqual([]);
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
