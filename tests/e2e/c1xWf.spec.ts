import AxeBuilder from '@axe-core/playwright';
import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openApplyFolds, openTab } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem, typeInGap } from './learnHelpers';

// wf (Wort umbauen), P38: ein Wort in die Lücke tippen (Handy 390 px), Stamm-Chip, Hinweisleiter (Wortart/Vorsilbe, dann Platzhalter),
// Zerlegung und Wortfamilie nach dem Prüfen, Begründung auch bei richtig, Buchung (Fehlersatz, Karte, Verlauf) und Kachel „Wortbildung“.
// Die Aufgaben kommen über einen Fehlersatz mit `cid` (wie bei ocl/mcc); ihre Inhalte stammen aus den Inhaltsdateien, nie aus der Oberfläche.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

type Wf = {
  id: string;
  text: string;
  stem: string;
  accept: string[];
  family: string[];
  pos: string;
  pat: string;
  parts: { pre?: string };
  lex: string[];
};
function wfBy(word: string): Wf {
  const dir = new URL('../../src/content/c1x/src/wf/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
      items: Wf[];
    };
    const hit = doc.items.find((i) => i.accept[0] === word);
    if (hit) return hit;
  }
  throw new Error(`wf-Aufgabe für ${word} nicht gefunden`);
}

const errorOf = (it: Wf): Doc => ({
  q: it.text,
  given: '',
  ans: it.accept[0],
  t: OLD,
  due: OLD,
  box: 0,
  src: 'seed',
  cid: it.id,
  pat: it.pat,
  pts: [0, 1],
});
const topicDoc = (topic: string, errors: Doc[]): Doc => ({
  id: topic,
  p: 0.5,
  anchor: 0.5,
  anchorD: '2026-09-15',
  n: 8,
  c: 6,
  due: OLD,
  last: OLD,
  recent: [1, 1, 1, 1],
  seen: [],
  seenText: [],
  hist: [{ d: '2026-09-15', p: 0.5 }],
  errors,
});

async function start(page: Page, it: Wf, extra: Record<string, Doc> = {}, theme: 'dark' | 'light' = 'dark') {
  return bootAt(
    page,
    { name: 'grammarSession', mode: 'errors' },
    {
      theme,
      fake: {
        patch: {
          'grammar/passive-plus': topicDoc('passive-plus', [errorOf(it)]),
          ...extra,
        },
      },
    },
  );
}
const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');
const entryOf = async (page: Page, cid: string): Promise<Doc> => {
  await expect
    .poll(async () => (await logOf(page)).some((e) => e.cid === cid), {
      timeout: 25_000,
    })
    .toBe(true);
  return (await logOf(page)).find((e) => e.cid === cid) as Doc;
};

const PRE = wfBy('unauthorized');
const ADV = wfBy('securely');
const NOUN = wfBy('compliance');

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Frage: Stamm-Chip in Großbuchstaben, Lücke im Satz, Prüfen erst nach Eingabe, die Lösung steht nicht im DOM, kein Überlauf, axe 0', async ({ page }) => {
    const { errors } = await start(page, PRE);
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'wf');
    await expect(item.getByTestId('wf-stem')).toHaveText(PRE.stem);
    await expect(item.getByTestId('gap')).toHaveAttribute('data-state', 'input');
    await expect(page.getByTestId('check')).toBeDisabled();
    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain('unauthorized');
    // Nur ein Wort tippbar: höchstens 16 Zeichen.
    await typeInGap(page, 'abcdefghijklmnopqrstuvwxyz');
    await expect(page.getByTestId('gap-input')).toHaveValue('abcdefghijklmnop');
    await expect(page.getByTestId('check')).toBeEnabled();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await page.waitForTimeout(400);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Hinweisleiter: Stufe 1 nennt Wortart und „mit Vorsilbe“, Stufe 2 zeigt Platzhalter mit dem ersten Buchstaben', async ({ page }) => {
    const { errors } = await start(page, PRE);
    const item = page.getByTestId('gr-item');
    await page.getByTestId('hint').click();
    await expect(item.getByTestId('hint-line')).toContainText('Adjektiv');
    await expect(item.getByTestId('hint-line')).toContainText('Mit Vorsilbe');
    await page.getByTestId('hint').click();
    const slots = item.locator('[data-testid="gap"] [data-slot]');
    await expect(slots).toHaveCount((PRE.accept[0] ?? '').length);
    await expect(item.locator('[data-testid="gap"] .lx-slot-hint')).toHaveText('u');
    expect(errors).toEqual([]);
  });

  test('richtig getippt: 1 von 1, Zerlegung und Wortfamilie, Begründung auch bei richtig, Buchung mit pts und free', async ({ page }) => {
    const { errors } = await start(page, PRE);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, PRE.accept[0] ?? '');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    // Zerlegung: un · authorize · d (Kern in der Mitte), darunter die Wortfamilie.
    const split = item.getByTestId('morph-split');
    await expect(split).toBeVisible();
    await expect(split.getByTestId('morph-piece')).toHaveText(['un', 'authorize', 'd']);
    await expect(split.getByTestId('morph-piece').nth(1)).toHaveAttribute('data-role', 'core');
    await expect(item.getByTestId('wf-family')).toContainText('authorization');
    // Das Warum steht auch bei richtiger Antwort (Kap. 2 Nr. 4).
    await expect(item.getByTestId('explanation')).toBeVisible();
    await nextItem(page);
    const e = await entryOf(page, PRE.id);
    expect(e).toMatchObject({
      ok: true,
      pts: [1, 1],
      c1k: 'wf',
      cid: PRE.id,
      free: true,
      dev: 't',
    });
    expect(errors).toEqual([]);
  });

  test('falsche Wortart derselben Familie: erst ein Hinweis, dann zweiter Versuch; Ergebnis „falsche Wortart“, Lösung und Fehlersatz', async ({ page }) => {
    const { errors } = await start(page, ADV);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, 'secure');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('hint-line')).toBeVisible();
    await expect(item.getByTestId('verdict')).toHaveCount(0);
    await page.getByTestId('gap-input').focus();
    for (let i = 0; i < 'secure'.length; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('security', { delay: 10 });
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(item.getByTestId('wf-solution')).toContainText('securely');
    await expect(item.getByTestId('morph-split').getByTestId('morph-piece')).toHaveText(['secure', 'ly']);
    await expect(item.getByTestId('verdict-sub')).toContainText('falsche Wortart');
    await nextItem(page);
    const e = await entryOf(page, ADV.id);
    expect(e).toMatchObject({ ok: false, pts: [0, 1], c1k: 'wf', cid: ADV.id });
    expect(errors).toEqual([]);
  });

  test('Tippfehler ist „Fast“ (Rechtschreibung zählt), ohne Fehlersatz-Sprung nach oben', async ({ page }) => {
    const { errors } = await start(page, NOUN);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, 'complience');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
    await expect(item.getByTestId('wf-solution')).toContainText('compliance');
    expect(errors).toEqual([]);
  });

  test('Wortkarte: bucht genau eine volle Wiederholung auf die vorhandene Karte und einen Verlauf in out/<Monat>', async ({ page }) => {
    const base = SEED['vocab/deserve'] as Doc;
    const card: Doc = {
      ...base,
      id: 'compliance',
      word: 'compliance',
      de: 'Einhaltung',
      ex: 'Full [compliance] with the rules is required.',
      col: [],
    };
    const hist0 = (card.hist as unknown[]).length;
    const { errors } = await start(page, NOUN, { 'vocab/compliance': card });
    await typeInGap(page, 'compliance');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('gr-item').getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    await expect.poll(async () => ((await dump(page))['vocab/compliance']?.hist as unknown[] | undefined)?.length ?? 0, { timeout: 25_000 }).toBe(hist0 + 1);
    await expect.poll(async () => (((await dump(page))['out/2026-09']?.items as Doc[] | undefined) ?? []).filter((i) => i.k === 'wf').length, { timeout: 25_000 }).toBe(1);
    const out = (((await dump(page))['out/2026-09'] as Doc).items as Doc[]).find((i) => i.k === 'wf') as Doc;
    expect(out).toMatchObject({ k: 'wf', ok: true, text: 'compliance' });
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Enter prüft, Weiter bucht (Laptop)', async ({ page }) => {
    const { errors } = await start(page, PRE);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, PRE.accept[0] ?? '');
    await page.keyboard.press('Enter');
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    const e = await entryOf(page, PRE.id);
    expect(e).toMatchObject({ ok: true, pts: [1, 1], c1k: 'wf', dev: 'k' });
    expect(errors).toEqual([]);
  });

  test('hell: Stamm-Chip, Lücke und Zerlegung sind lesbar (axe 0)', async ({ page }) => {
    const { errors } = await start(page, PRE, {}, 'light');
    const item = page.getByTestId('gr-item');
    const scan = async () => {
      await page.waitForTimeout(600);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
    };
    expect(await scan()).toEqual([]);
    await typeInGap(page, 'unauthorised');
    await page.keyboard.press('Enter');
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('verdict-sub')).toContainText('unauthorized');
    expect(await scan()).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('reduzierte Bewegung: die Zerlegung steht sofort da (ohne Animation)', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { errors } = await start(page, PRE);
    await typeInGap(page, PRE.accept[0] ?? '');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('morph-split')).toHaveAttribute('data-motion', 'off');
    await expect(page.getByTestId('morph-piece')).toHaveCount(3);
    expect(errors).toEqual([]);
  });
});

test.describe('Anwenden', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('die Kachel „Wortbildung“ startet eine wf-Runde', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await openTab(page, 'apply');
    await openApplyFolds(page);
    await page.getByTestId('training-wordform').click();
    await expect(page.getByTestId('gr-item')).toHaveAttribute('data-c1x', 'wf');
    expect(errors).toEqual([]);
  });
});
