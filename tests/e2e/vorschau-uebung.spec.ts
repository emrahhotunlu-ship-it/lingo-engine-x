import { expect, test, type Page } from '@playwright/test';
import { bootAt, type Lang } from './fixtures';
import { typeInGap } from './learnHelpers';
import { expected, planPatch, TYPE_MODE } from './trainerHelpers';
import { boot, screen } from './fixtures';
import { LANGS, MODES, axeFindings, box, compare, openVorschau, shotPath, type Check, type Mode, type Size } from './vorschauHelpers';

// Vorschau-Paare der Übungsseite (Relaunch Teil 1c, D3 V-UEBUNG; docs/relaunch/stufe1c-plan.md §3.0/§3.1, Auftrag docs/umbau/auftraege/d3.md).
// Pflicht: H3×2, H4×4, H5×1, L3×2. Die App-Seite ist die echte App (Testdaten, fester Fehlersatz bzw. feste Wortkarte), die Vorschau läuft wie
// in vorschau.spec.ts. Die Inhalte unterscheiden sich (anderer Satz), deshalb werden Maße, Lage am Rand und Schrift verglichen, nicht die Lage
// im Satz. Lage nach oben (y) nur dort, wo beide Seiten denselben Aufbau darüber haben. Die gezeichnete Tastatur der Vorschau gibt es in der
// App nicht (die echte Tastatur des Geräts) – deshalb keine y-Werte für die Knopfzeile.

type AppState = 'gram-task' | 'gram-hint' | 'gram-band' | 'word-band' | 'intro';
type Pair = { name: string; vorschau: string; app: AppState; sizes: Size[]; checks: Check[] };

const PHONE: Size[] = [{ name: '390', width: 390, height: 844 }];
const DESK: Size[] = [
  { name: '1440', width: 1440, height: 900 },
  { name: '2560', width: 2560, height: 1440 },
];

// Gemeinsame Messpunkte am Handy.
const HEAD: Check[] = [
  // Höhe hängt am Inhalt (die Vorschau bricht „… · Schritt 3 von 7“ um), daher ohne Höhe.
  { name: 'blockzeile', vorschau: '.blockline', app: '[data-testid="status"]', props: ['x', 'y', 'fontSize', 'fontWeight'] },
  { name: 'aufgabe', vorschau: '.instr p', app: '[data-testid="task"]', props: ['x', 'fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'wozu', vorschau: '#why', app: '[data-testid="purpose-info"] .lx-vu-why-face', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
  { name: 'satz', vorschau: '.sent', app: '[data-slot="prompt"]', props: ['x', 'fontSize', 'lineHeight', 'fontWeight'] },
  { name: 'balken', vorschau: '.ex-top .bar', app: '.lx-segs', props: ['height'] },
];
const FOOT: Check[] = [
  { name: 'pruefen', vorschau: '#check', app: '[data-testid="check"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
  { name: 'tipp', vorschau: '#hint', app: '[data-testid="hint"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
  { name: 'weissnicht', vorschau: '#idk', app: '[data-testid="dont-know"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
];
// Band (h4-band, h4-more, h3-before) entfällt: seit dem UX-Neuanfang B steht die Rückmeldung im Fluss (freigegebene Vorschau
// `5Zwv5noCiNwzrzzfQsfzXy`, Emrah 02.11.2026); sie wird in band.spec.ts geprüft.

const PAIRS: Pair[] = [
  // H4 Grammatik-Block (screens.js:298–370).
  { name: 'h4-task', vorschau: 'h4-task', app: 'gram-task', sizes: PHONE, checks: [...HEAD, ...FOOT] },
  {
    name: 'h4-hint',
    vorschau: 'h4-hint',
    app: 'gram-hint',
    sizes: PHONE,
    checks: [
      ...HEAD,
      { name: 'hinweisband', vorschau: '#hintband', app: '.lx-hintband', props: ['x', 'width', 'borderRadius'] },
      { name: 'hinweistext', vorschau: '#hintband span', app: '.lx-hintband [data-testid="hint-line"]', props: ['fontSize', 'fontWeight'] },
      { name: 'pruefen', vorschau: '#check', app: '[data-testid="check"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
    ],
  },
  { name: 'h3-after', vorschau: 'h3-after', app: 'gram-task', sizes: PHONE, checks: [...HEAD, ...FOOT] },
  // H5 Grammatik-Erklärung (screens.js:375–427) gegen die Einführung `IntroFlow` (vorhandene Felder).
  {
    name: 'h5-explain',
    vorschau: 'h5-explain',
    app: 'intro',
    sizes: PHONE,
    checks: [
      { name: 'blockzeile', vorschau: '.blockline', app: '[data-testid="intro-line"]', props: ['x', 'y', 'height', 'fontSize', 'fontWeight'] },
      { name: 'frage', vorschau: '.ex-body h2', app: '[data-testid="intro-flow"] [data-testid="task"]', props: ['x', 'fontSize', 'lineHeight', 'fontWeight'] },
      { name: 'karte', vorschau: '.ex-body .card', app: '[data-testid="intro-card"]', props: ['x', 'width', 'borderRadius'] },
      { name: 'kleinueberschrift', vorschau: '.ex-body .card .lbl', app: '.lx-vu-lbl', props: ['fontSize', 'fontWeight'] },
      { name: 'punkte', vorschau: '.pagedots i.on', app: '[data-testid="intro-dots"] i[data-on]', props: ['width', 'height', 'borderRadius'] },
      { name: 'weiter', vorschau: '#ex-next', app: '[data-testid="intro-next"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
    ],
  },
  // L3 Grammatik-Übung am Laptop (desk.js:229–268): Rückmeldung auf der Bühne, Spalte Regel/Heute, Tastenzeile.
  {
    name: 'l3-hint',
    vorschau: 'l3-hint',
    app: 'gram-hint',
    sizes: DESK,
    checks: [
      { name: 'blockzeile', vorschau: '.blockline', app: '[data-testid="status"]', props: ['fontSize', 'fontWeight'] },
      { name: 'aufgabe', vorschau: '.instr p', app: '[data-testid="task"]', props: ['fontSize', 'fontWeight'] },
      { name: 'satz', vorschau: '.sent', app: '[data-slot="prompt"]', props: ['fontSize'] },
      { name: 'spaltentitel', vorschau: '.ctx h3', app: '.lx-vu-ctx-h', props: ['fontSize', 'fontWeight'] },
      { name: 'pruefen', vorschau: '#d-check', app: '[data-testid="check"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
    ],
  },
  {
    name: 'l3-band',
    vorschau: 'l3-band',
    app: 'gram-band',
    sizes: DESK,
    checks: [
      { name: 'rueckmeldung', vorschau: '#d-verdict', app: '[data-testid="result"]', props: ['borderRadius'] },
      { name: 'urteil', vorschau: '#d-verdict .verdict', app: '[data-testid="result"] [data-testid="verdict"]', props: ['fontSize', 'fontWeight'] },
      { name: 'spaltentitel', vorschau: '.ctx h3', app: '.lx-vu-ctx-h', props: ['fontSize', 'fontWeight'] },
      { name: 'weiter', vorschau: '#d-next', app: '[data-testid="next"]', props: ['height', 'fontSize', 'fontWeight', 'borderRadius'] },
    ],
  },
];

const OLD = Date.parse('2020-01-01T10:00:00+01:00');
// Ein fester Fehlersatz mit Stichwort, wie die Vorschau („We ___ (send) the revised quote yesterday.“).
const ERR = { q: 'We ___ the revised quote yesterday.', given: 'have sent', ans: 'sent', cue: 'send', t: OLD, due: OLD, box: 0, src: 'seed' };
const topicDoc = (id: string) => ({ id, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [ERR] });
/** overcome: Stufe 4, freie Lücke (wie band.spec). */
const OVERCOME = { 'vocab/overcome': { na: 9, hist: [], state: 'learning', stage: 4, S: 1, D: 5, due: 1_700_000_000_000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } } };

async function openApp(page: Page, st: AppState, mode: Mode, lang: Lang) {
  const theme = mode;
  if (st === 'word-band') {
    await boot(page, { migrated: true, lang, theme, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await typeInGap(page, 'zzzz');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hint-line')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('result')).toBeVisible();
    void expected;
  } else if (st === 'intro') {
    await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'time-clauses' }, { lang, theme });
    await expect(page.getByTestId('intro-flow')).toBeVisible();
  } else {
    await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { lang, theme, fake: { patch: { 'grammar/past-simple-perfect': topicDoc('past-simple-perfect') } } });
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    if (st !== 'gram-task') {
      await typeInGap(page, 'zzzz wrong');
      await page.getByTestId('check').click();
      await expect(page.locator('[data-testid="hint-line"]')).toBeVisible();
      if (st !== 'gram-hint') {
        await page.getByTestId('check').click();
        await expect(item.getByTestId('result')).toBeVisible();
      }
    }
  }
  await page.evaluate(async () => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
}

for (const pair of PAIRS) {
  test.describe(`Vorschau-Paar Übung ${pair.name}`, () => {
    for (const size of pair.sizes) {
      for (const mode of MODES) {
        for (const lang of LANGS) {
          test(`${size.name} · ${mode} · ${lang}`, async ({ browser }) => {
            const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, reducedMotion: 'reduce', locale: lang === 'de' ? 'de-DE' : 'en-US' });
            const vp = await ctx.newPage();
            const ap = await ctx.newPage();
            const v = await openVorschau(vp, pair.vorschau, mode, lang);
            await openApp(ap, pair.app, mode, lang);
            await vp.screenshot({ path: shotPath(`uebung-${pair.name}`, size, mode, lang, 'vorschau') });
            await ap.screenshot({ path: shotPath(`uebung-${pair.name}`, size, mode, lang, 'app') });
            const findings: string[] = [];
            for (const c of pair.checks) findings.push(...compare(c.name, await box(vp, c.vorschau), await box(ap, c.app), c.props));
            expect(findings, `Abweichungen von der Vorschau (${pair.name}, ${size.name}, ${mode}, ${lang})`).toEqual([]);
            expect(await axeFindings(ap, '[data-testid="exercise"], [data-testid="intro-flow"]'), 'axe auf der App-Seite').toEqual([]);
            expect([...v.external], 'fremde Anfragen der Vorschau').toEqual([]);
            expect([...v.errors], 'Fehler im Browser (Vorschau)').toEqual([]);
            await ctx.close();
          });
        }
      }
    }
  });
}
