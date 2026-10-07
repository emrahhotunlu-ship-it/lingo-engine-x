import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, type BootOptions } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem, typeInGap } from './learnHelpers';

// c1x-Rahmen (Lernplattform 3.0 P14): Eine Aufgabe des Aufgabensystems c1x läuft im Übungsgerüst: Prüfen → Teilpunkte → Erklär-Karte → Buchen →
// Fehlersatz → Wiederholung im selben Baustein. Die Aufgaben kommen über einen Fehlersatz mit `cid` (die Rundenwahl selbst baut P15); die Arten
// schalten die Funktionsschalter per `localStorage` `lx:flags` ein.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const grammarDoc = (topic: string, errors: Doc[]): Doc => ({
  id: topic,
  p: 0.5,
  anchor: 0.5,
  anchorD: '2026-09-15',
  n: 4,
  c: 3,
  due: OLD,
  last: OLD,
  recent: [1, 1, 0, 1],
  seen: [],
  seenText: [],
  hist: [{ d: '2026-09-15', p: 0.5 }],
  errors,
});

const KWT_ERROR: Doc = { q: 'The company ___ planning to move its headquarters.', given: '', ans: 'is said to be', t: OLD, due: OLD, box: 0, src: 'seed', cid: 'kwt-9001', pat: 'pp.personal', pts: [0, 2] };
const ERR_ERROR: Doc = { q: "I'm really looking forward to hear from you.", given: '', ans: "I'm really looking forward to hearing from you.", t: OLD + 1, due: OLD + 1, box: 0, src: 'seed', cid: 'err-9001', pat: 'gi.prep-ing', pts: [0, 2] };

async function start(page: Page, errors: Doc[], topic: string, extra: BootOptions = {}): ReturnType<typeof bootAt> {
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { ...extra, fake: { patch: { [`grammar/${topic}`]: grammarDoc(topic, errors) } } });
}
const flags = (v: string): BootOptions => ({ localStorage: { 'lx:flags': v } });

const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');
/** Der Protokolleintrag zu einer c1x-Aufgabe (das Speichern läuft kurz nach dem Weiter). */
const entryOf = async (page: Page, cid: string): Promise<Doc> => {
  await expect.poll(async () => (await logOf(page)).some((e) => e.cid === cid)).toBe(true);
  return (await logOf(page)).find((e) => e.cid === cid) as Doc;
};

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('kwt: richtig → Teilpunkte 2 von 2, Erklär-Karte mit Muster und Warum, Buchung mit pts, Fehlersatz rückt eine Box vor', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('kwt,err'));
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'kwt');
    // Aufgabenzeile, Schlüsselwort, Satz A: Status → Aufgabe → Satz → Eingabe in fester Reihenfolge; die Lösung steht nicht im DOM.
    await expect(item.getByTestId('task')).toContainText('3–6');
    await expect(item.getByTestId('kwt-key')).toHaveText('SAID');
    await expect(item.getByTestId('transform-from')).toContainText('People say');
    await expect(page.getByTestId('result')).toHaveCount(0);
    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain('is said to be');
    await expect(page.getByTestId('check')).toBeDisabled();
    await typeInGap(page, 'is said to be');
    await expect(page.getByTestId('word-counter')).toHaveAttribute('data-ok', 'true');
    await page.getByTestId('check').click();
    const verdict = item.getByTestId('verdict');
    await expect(verdict).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('verdict-sub')).toContainText('2 von 2');
    await expect(item.getByTestId('part-bar').locator('li')).toHaveCount(2);
    await expect(item.getByTestId('part-bar').locator('[data-ok="true"]')).toHaveCount(2);
    await expect(item.getByTestId('explanation')).toBeVisible();
    // UX-Prüfung W2: die Zählweise steht unter „Mehr“.
    await item.locator('[data-testid="examples-more"], [data-testid="explanation-more"]').first().click();
    await expect(item.getByTestId('cambridge-note')).toBeVisible();
    // Bei richtiger Antwort ohne Auswahlmöglichkeiten gibt es keine „Warum nicht …?“-Liste (die Falle wird nur gezeigt, wenn sie getroffen wurde).
    await expect(item.getByTestId('why-list')).toHaveCount(0);
    await nextItem(page);
    const d = await dump(page);
    const doc = d['grammar/passive-plus'] as Doc;
    const err = (doc.errors as Doc[])[0] as Doc;
    expect(err.box).toBe(1);
    expect(doc.seen).toContain('c1:kwt-9001');
    const e = await entryOf(page, 'kwt-9001');
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'kwt', cid: 'kwt-9001', pat: 'pp.personal', free: true, dev: 'k' });
    expect(errors).toEqual([]);
  });

  test('kwt: nur Teil A richtig → „Fast“, 1 von 2, Teilpunkte ✓ ✕, die Falle wird erklärt; Buchung zählt nicht als richtig', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('kwt'));
    const item = page.getByTestId('gr-item');
    await typeInGap(page, 'is said that it is');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
    await expect(item.getByTestId('verdict-sub')).toContainText('1 von 2');
    const bar = item.getByTestId('part-bar');
    await expect(bar.locator('[data-part="a"]')).toHaveAttribute('data-ok', 'true');
    await expect(bar.locator('[data-part="b"]')).toHaveAttribute('data-ok', 'false');
    await expect(bar.locator('[data-part="a"]')).toContainText('✓');
    await expect(bar.locator('[data-part="b"]')).toContainText('✕');
    await item.locator('[data-testid="examples-more"], [data-testid="explanation-more"]').first().click();
    await expect(item.getByTestId('why-list')).toContainText('It');
    await nextItem(page);
    const d = await dump(page);
    const err = ((d['grammar/passive-plus'] as Doc).errors as Doc[])[0] as Doc;
    expect(err.box).toBe(0);
    expect(err.done).toBeFalsy();
    const e = await entryOf(page, 'kwt-9001');
    expect(e).toMatchObject({ ok: false, pts: [1, 2], c1k: 'kwt', cid: 'kwt-9001' });
    expect(errors).toEqual([]);
  });

  test('kwt: ganz falsch → erst ein Hinweis (Eingabe bleibt), dann der zweite Versuch; richtig nach Hinweis zählt als nicht richtig', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('kwt'));
    const item = page.getByTestId('gr-item');
    await typeInGap(page, 'is going to');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('hint-line')).toBeVisible();
    await expect(item.getByTestId('verdict')).toHaveCount(0);
    await expect(page.getByTestId('check')).toBeVisible();
    // Nach dem Hinweis: neu tippen (Eingabe leeren), richtig.
    await page.getByTestId('gap-input').focus();
    for (let i = 0; i < 'is going to'.length; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type('is said to be', { delay: 10 });
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    const e = await entryOf(page, 'kwt-9001');
    expect(e).toMatchObject({ pts: [2, 2], c1k: 'kwt' });
    const err = (((await dump(page))['grammar/passive-plus'] as Doc).errors as Doc[])[0] as Doc;
    // „Richtig erst nach Hinweis“ zählt für den Fehlersatz als falsch: Box bleibt 0.
    expect(err.box).toBe(0);
    expect(errors).toEqual([]);
  });

  test('„Weiß ich nicht“ bucht 0 von 2 und lässt den Fehlersatz stehen', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('kwt'));
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'dontKnow');
    await nextItem(page);
    const e = await entryOf(page, 'kwt-9001');
    expect(e).toMatchObject({ ok: false, pts: [0, 2], c1k: 'kwt' });
    expect(errors).toEqual([]);
  });

  test('err: Wort antippen und Korrektur tippen → 2 von 2; die Eingabe der Korrektur ist ohne Wahl gesperrt', async ({ page }) => {
    const { errors } = await start(page, [ERR_ERROR], 'gerund-inf', flags('err'));
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'err');
    await expect(item.getByTestId('err-fix')).toBeDisabled();
    await expect(page.getByTestId('check')).toBeDisabled();
    await item.getByTestId('spot-word').nth(5).click();
    await expect(item.getByTestId('err-fix')).toBeEnabled();
    await item.getByTestId('err-fix').fill('hearing');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('part-bar').locator('[data-ok="true"]')).toHaveCount(2);
    await nextItem(page);
    const e = await entryOf(page, 'err-9001');
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'err', cid: 'err-9001', pat: 'gi.prep-ing' });
    expect(errors).toEqual([]);
  });

  test('err: richtiges Wort, falsche Korrektur → 1 von 2; „Kein Fehler“ bei einem Satz mit Fehler → 0 (übersehen)', async ({ page }) => {
    const { errors } = await start(page, [ERR_ERROR], 'gerund-inf', flags('err'));
    const item = page.getByTestId('gr-item');
    await item.getByTestId('spot-word').nth(5).click();
    await item.getByTestId('err-fix').fill('heard');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
    await expect(item.getByTestId('verdict-sub')).toContainText('1 von 2');
    expect(errors).toEqual([]);
  });

  test('ohne eingeschalteten Schalter bleibt der Fehlersatz ein gewöhnlicher Fehlersatz (kein c1x-Rahmen)', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('{"c1xKinds":{"kwt":false}}'));
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    await expect(item).not.toHaveAttribute('data-c1x', /.+/);
    expect(errors).toEqual([]);
  });
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('kwt am Handy: Satz, Schlüsselwort und Eingabe ohne Querscrollen, Prüfen unten erreichbar', async ({ page }) => {
    const { errors } = await start(page, [KWT_ERROR], 'passive-plus', flags('kwt'));
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'kwt');
    await expect(item.getByTestId('kwt-key')).toBeVisible();
    await expect(page.getByTestId('check')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(errors).toEqual([]);
  });
});

test('Unbekannte Seite zeigt keinen Fehler: boot ohne Fehlersatz', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  expect(errors).toEqual([]);
});
