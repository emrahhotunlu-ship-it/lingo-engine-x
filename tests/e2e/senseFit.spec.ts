import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, type Lang, type Theme } from './fixtures';
import { planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Emrahs Meldungen 25.10.2026: (1) „declined“ in „The candidate declined to commit …“ zeigte „decline · Nomen · Rückgang“ – jetzt kommt die Bedeutung
// der Wendung bzw. die Verb-Bedeutung zuerst, das Nomen nur als „Auch“. (2) Einführungskarte „to adjust“: die deutsche Bedeutung groß und fett direkt
// unter dem Wort, der Beispielsatz kleiner mit markiertem Wort, „Kenne ich“ als echter Knopf; „Adjusted earnings …“ (Eigenschaftswort) ist kein Satz
// für die Verb-Karte.

const SHOTS = process.env.LX_SHOTS_DIR ?? '';
const NEW = { level: 'B2', state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20' };
const PHRASE = {
  ...NEW,
  word: 'to decline to commit to',
  pos: 'phrase',
  de: 'sich nicht festlegen wollen auf',
  def: 'refuse to promise something',
  ex: 'The candidate [declined to commit to] the start date until she reviewed the contract.',
  // Eine Wortpartner-Zeile macht die Karte ohne weitere Karten abfragbar (wie in introCard.spec.ts).
  col: [{ p: 'decline to commit to a date', de: 'sich auf keinen Termin festlegen wollen', gap: 'decline', opts: ['refuse', 'deny', 'reject'], ex: 'They [decline to commit to a date] for now.' }],
};
const ADJUST = {
  ...NEW,
  word: 'to adjust',
  pos: 'verb',
  de: 'anpassen',
  def: 'to change something slightly',
  ex: 'Adjusted earnings came to $1.08 per share, two cents below what analysts had expected.',
  xEx: [{ en: 'We adjusted the budget after the supplier declined our offer.', t: 1 }],
  col: [{ p: 'adjust the price', de: 'den Preis anpassen', gap: 'adjust', opts: ['fit', 'suit', 'tune'], ex: 'We [adjust the price] every quarter.' }],
};

async function openIntro(page: Page, doc: Record<string, unknown>, id: string, o: { theme?: Theme; lang?: Lang } = {}) {
  const { patch } = ankiPatch(0);
  const booted = await boot(page, { migrated: true, ...o, fake: { patch: { ...patch, 'app/profile': { ...planPatch(1), newPerDay: 2 }, [`vocab/${id}`]: doc } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  const ask = page.getByTestId('intro-ask-dontknow');
  const intro = page.getByTestId('intro');
  await expect(ask.or(intro)).toBeVisible();
  if (await ask.isVisible()) {
    await ask.click();
    await page.getByTestId('intro-ask-next').click();
  }
  await expect(intro).toBeVisible();
  return booted;
}

const tapWord = (page: Page, w: string) => page.getByTestId('origin-sentence').locator(`button.lx-word[data-word="${w}"]`);
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
};
const axe = async (page: Page): Promise<string[]> =>
  (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);

for (const vp of [
  { name: '390', viewport: { width: 390, height: 844 }, mobile: true },
  { name: '1440', viewport: { width: 1440, height: 900 }, mobile: false },
]) {
  test.describe(`Sinn-Auswahl ${vp.name}`, () => {
    test.use({ viewport: vp.viewport, hasTouch: vp.mobile, isMobile: vp.mobile });

    test('„declined“ in der Ziel-Wendung: Bedeutung der Wendung zuerst, Verb, Nomen nur als „Auch“', async ({ page }) => {
      const { errors } = await openIntro(page, PHRASE, 'to-decline-to-commit-to');
      await tapWord(page, 'declined').click();
      const lk = page.getByRole('dialog');
      await expect(lk.getByTestId('lk-part-meaning')).toHaveText('sich nicht festlegen wollen auf');
      await expect(lk.getByTestId('lk-headword')).toHaveText('decline');
      await expect(lk.getByTestId('lk-pos')).toHaveText('Verb');
      await expect(lk.getByTestId('lk-meaning')).not.toContainText('Rückgang');
      await expect(lk.getByTestId('lk-also')).toHaveAttribute('data-pos', 'noun');
      await expect(lk.getByTestId('lk-also')).toContainText('Rückgang');
      await shot(page, `popup-declined-phrase-${vp.name}`);
      expect(await axe(page)).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('„declined“ ohne Ziel-Wendung: Verb-Bedeutung (ablehnen) zuerst; „Adjusted earnings“ ist kein Satz für „to adjust“', async ({ page }) => {
      const { errors } = await openIntro(page, ADJUST, 'to-adjust');
      await expect(page.getByTestId('origin-sentence')).toHaveText('We adjusted the budget after the supplier declined our offer.');
      await tapWord(page, 'declined').click();
      const lk = page.getByRole('dialog');
      await expect(lk.getByTestId('lk-headword')).toHaveText('decline');
      await expect(lk.getByTestId('lk-pos')).toHaveText('Verb');
      await expect(lk.getByTestId('lk-meaning')).toContainText('ablehnen');
      await expect(lk.getByTestId('lk-part')).toHaveCount(0);
      await expect(lk.getByTestId('lk-also')).toContainText('Rückgang');
      await shot(page, `popup-declined-verb-${vp.name}`);
      expect(errors).toEqual([]);
    });
  });
}

const INTRO_MODES: Array<{ theme: Theme; lang: Lang; vp: { width: number; height: number }; mobile: boolean }> = [];
for (const theme of ['dark', 'light'] as const) for (const lang of ['de', 'en'] as const) for (const [w, h, m] of [[390, 844, true], [1440, 900, false]] as const) INTRO_MODES.push({ theme, lang, vp: { width: w, height: h }, mobile: m });

for (const m of INTRO_MODES) {
  test.describe(`Einführungskarte ${m.vp.width} ${m.theme} ${m.lang}`, () => {
    test.use({ viewport: m.vp, hasTouch: m.mobile, isMobile: m.mobile });
    test('Bedeutung groß direkt unter dem Wort, Satz kleiner mit markiertem Wort, „Kenne ich“ als Knopf ≥ 44 px', async ({ page }) => {
      const { errors } = await openIntro(page, ADJUST, 'to-adjust', { theme: m.theme, lang: m.lang });
      const word = await page.getByTestId('intro-title').boundingBox();
      const meaning = page.getByTestId('intro-meaning');
      await expect(meaning).toHaveText(m.lang === 'de' ? 'anpassen' : 'to change something slightly');
      await expect(page.getByTestId('intro-pos')).toHaveText(m.lang === 'de' ? 'Verb' : 'verb');
      const mb = await meaning.boundingBox();
      const ipa = await page.getByTestId('intro-ipa').boundingBox();
      const ex = await page.getByTestId('origin-sentence').boundingBox();
      if (!word || !mb || !ipa || !ex) throw new Error('box');
      // Reihenfolge: Wort → Bedeutung → Lautschrift → Beispielsatz
      expect(mb.y).toBeGreaterThan(word.y);
      expect(ipa.y).toBeGreaterThan(mb.y);
      expect(ex.y).toBeGreaterThan(ipa.y);
      // Bedeutung fett und größer als der Beispielsatz
      const [mw, ms, es] = await Promise.all([
        meaning.evaluate((el) => getComputedStyle(el).fontWeight),
        meaning.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        page.getByTestId('origin-sentence').evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
      ]);
      expect(Number(mw)).toBeGreaterThanOrEqual(700);
      expect(ms).toBeGreaterThan(es);
      await expect(page.getByTestId('origin-sentence').locator('mark, [data-hl]').first()).toBeVisible();
      const known = await page.getByTestId('intro-known').boundingBox();
      expect(known?.height ?? 0).toBeGreaterThanOrEqual(44);
      await shot(page, `intro-${m.vp.width}-${m.theme}-${m.lang}`);
      expect(await axe(page)).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
