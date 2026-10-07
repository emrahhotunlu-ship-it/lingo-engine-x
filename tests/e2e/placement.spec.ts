import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { dump, writes } from './trainerHelpers';

// Einstufung (Lernplattform 3.0 P34): zwei Teile in einem Blatt, am Handy nur Tippen (außer einem einzelnen Wort), Abbrechen schreibt nichts,
// das Ergebnis geht nur nach `app/c1.place`, der Ergebnis-Bildschirm nennt kein Niveau. Schalter `program` per `lx:flags`.

const start = async (page: Page, flags = 'program') => {
  const booted = await boot(page, { migrated: true, localStorage: { 'lx:flags': flags } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  return booted;
};

/** Teil 1: alle Wörter durchgehen (jedes zweite „Kenne ich“, der Rest „Kenne ich nicht“). */
async function doWords(page: Page): Promise<void> {
  await page.getByTestId('place-go').click();
  await expect(page.getByTestId('place-words')).toBeVisible();
  for (let k = 0; k < 60; k++) {
    if ((await page.getByTestId('place-words').count()) === 0) break;
    const word = page.getByTestId('place-word-now');
    await expect(word).toBeVisible();
    await page.getByTestId(k % 2 === 0 ? 'place-word-yes' : 'place-word-no').click();
  }
}

/** Teil 2: jede Aufgabe auf einfache Weise beantworten, bis das Ergebnis da ist. */
async function doGrammar(page: Page, max = 40): Promise<number> {
  let n = 0;
  for (let k = 0; k < max; k++) {
    if (await page.getByTestId('place-result').count()) break;
    const item = page.getByTestId('place-item');
    await expect(item.or(page.getByTestId('place-result'))).toBeVisible();
    if (!(await item.count())) break;
    const kind = await item.getAttribute('data-kind');
    if (kind === 'mcc') {
      await page.getByTestId('place-option').nth(n % 4).click();
      await page.getByTestId('place-next').click();
    } else if (kind === 'ocl') {
      await page.getByTestId('place-gap').fill('the');
      await page.getByTestId('place-next').click();
    } else if (kind === 'err') {
      await page.getByTestId('place-none').click();
      await page.getByTestId('place-next').click();
    } else {
      await page.getByTestId('place-dontknow').click();
    }
    n++;
  }
  return n;
}

test.describe('Handy 390', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Einladung, beide Teile, Ergebnis ohne Niveau, Speichern nur nach app/c1.place', async ({ page }) => {
    const { errors } = await start(page);
    const card = page.getByTestId('place-card');
    await expect(card).toBeVisible();
    const before = await dump(page);
    await page.getByTestId('place-start').click();
    await expect(page.getByTestId('place-intro')).toBeVisible();
    await doWords(page);
    await expect(page.getByTestId('place-part')).toContainText('Teil 2 von 2');
    const asked = await doGrammar(page);
    expect(asked).toBeGreaterThanOrEqual(14);
    expect(asked).toBeLessThanOrEqual(22);
    const res = page.getByTestId('place-result');
    await expect(res).toBeVisible();
    // Kein Niveau, nur Belastbarkeit, Wortschatz-Spanne, Startkapitel, Kurzweg.
    const text = (await res.innerText()).replace(/\s+/g, ' ');
    expect(text).not.toMatch(/\b(A2|B1|B2|C1|C2)\b/);
    await expect(page.getByTestId('place-res-grammar')).toContainText('Antworten');
    await expect(page.getByTestId('place-res-words')).toContainText('häufigsten Wörter');
    await expect(page.getByTestId('place-res-start')).toContainText('Du beginnst mit Kapitel');
    // Vor dem Speichern ist nichts geschrieben.
    expect((await writes(page)).filter((w) => w.path === 'app/c1')).toHaveLength(0);
    await page.getByTestId('place-save').click();
    await expect(page.getByTestId('placement')).toHaveCount(0);
    const after = await dump(page);
    const c1 = after['app/c1'] as { place?: { d?: string; n?: number; se?: number; skip?: string[]; vw?: number[]; th?: number } } | undefined;
    expect(c1?.place?.n).toBe(asked);
    expect(c1?.place?.vw).toHaveLength(2);
    expect(Array.isArray(c1?.place?.skip)).toBe(true);
    // Nur app/c1 hat sich durch die Einstufung geändert: kein Thema (grammar/…) wurde angefasst.
    const grammarBefore = Object.keys(before).filter((k) => k.startsWith('grammar/')).sort();
    const grammarAfter = Object.keys(after).filter((k) => k.startsWith('grammar/')).sort();
    expect(grammarAfter).toEqual(grammarBefore);
    expect((await writes(page)).filter((w) => w.path.startsWith('grammar/'))).toHaveLength(0);
    // Danach: Karte „Einstufung vom …“ mit „Ergebnis ansehen“; Neu einstufen erst nach drei Monaten.
    await expect(page.getByTestId('place-done')).toBeVisible();
    await expect(page.getByTestId('place-card')).toHaveCount(0);
    await expect(page.getByTestId('place-retake-from')).toBeVisible();
    await expect(page.getByTestId('place-retake')).toHaveCount(0);
    await page.getByTestId('place-see').click();
    await expect(page.getByTestId('place-result')).toBeVisible();
    await expect(page.getByTestId('place-save')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Abbrechen schreibt nichts: in Teil 1, in Teil 2 und mit Escape', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('place-start').click();
    await page.getByTestId('place-go').click();
    await page.getByTestId('place-word-yes').click();
    await page.getByTestId('place-cancel').click();
    await expect(page.getByTestId('placement')).toHaveCount(0);

    await page.getByTestId('place-start').click();
    await doWords(page);
    await expect(page.getByTestId('place-item')).toBeVisible();
    await page.getByTestId('place-option').first().click();
    await page.getByTestId('place-next').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('placement')).toHaveCount(0);

    await page.getByTestId('place-start').click();
    await doWords(page);
    await page.getByTestId('place-cancel').click();
    await expect(page.getByTestId('placement')).toHaveCount(0);

    expect((await writes(page)).filter((w) => w.path === 'app/c1')).toHaveLength(0);
    expect((await dump(page))['app/c1']).toBeUndefined();
    // Nach dem Abbruch beginnt alles von vorn.
    await page.getByTestId('place-start').click();
    await expect(page.getByTestId('place-intro')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('„Später“ blendet die Einladung für heute aus und schreibt nichts in die Datenbank', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('place-later').click();
    await expect(page.getByTestId('place-card')).toHaveCount(0);
    expect((await dump(page))['app/c1']).toBeUndefined();
    expect(errors).toEqual([]);
  });

  test('ohne Schalter erscheint nichts', async ({ page }) => {
    await start(page, 'kwt');
    await expect(page.getByTestId('learn-hub')).toBeVisible();
    await expect(page.getByTestId('place-card')).toHaveCount(0);
  });

  test('Handy 360: kein Querscrollen und axe 0 in allen Schritten', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    const { errors } = await start(page);
    const axe = async (): Promise<string[]> => (await new AxeBuilder({ page }).include('[data-testid="placement"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id);
    await page.getByTestId('place-start').click();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    await page.getByTestId('place-go').click();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    for (let k = 0; k < 60 && (await page.getByTestId('place-words').count()); k++) await page.getByTestId('place-word-no').click();
    // Eine Aufgabe jeder Art prüfen, sobald sie dran ist.
    const seen = new Set<string>();
    for (let k = 0; k < 24 && (await page.getByTestId('place-result').count()) === 0; k++) {
      const item = page.getByTestId('place-item');
      await expect(item.or(page.getByTestId('place-result'))).toBeVisible();
      if (!(await item.count())) break;
      const kind = (await item.getAttribute('data-kind')) ?? '';
      if (!seen.has(kind)) {
        seen.add(kind);
        expect(await layoutProblems(page), kind).toEqual([]);
        expect(await axe(), kind).toEqual([]);
      }
      await page.getByTestId('place-dontknow').click();
    }
    await expect(page.getByTestId('place-result')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    expect(seen.size).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop 1280', () => {
  test.setTimeout(120_000);
  test.use({ viewport: { width: 1280, height: 800 } });

  test('läuft auch mit Maus und Tastatur: Wort mit Enter, Ergebnis speichern', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('place-start').click();
    await doWords(page);
    // Offene Lücke mit Enter abschicken (wenn eine dran kommt), sonst weiter wie am Handy.
    let n = 0;
    for (let k = 0; k < 30 && (await page.getByTestId('place-result').count()) === 0; k++) {
      const item = page.getByTestId('place-item');
      await expect(item.or(page.getByTestId('place-result'))).toBeVisible();
      if (!(await item.count())) break;
      const kind = await item.getAttribute('data-kind');
      if (kind === 'ocl') {
        await page.getByTestId('place-gap').fill('to');
        await page.getByTestId('place-gap').press('Enter');
      } else await page.getByTestId('place-dontknow').click();
      n++;
    }
    expect(n).toBeGreaterThan(0);
    await expect(page.getByTestId('place-result')).toBeVisible();
    await page.getByTestId('place-save').click();
    await expect.poll(async () => ((await dump(page))['app/c1'] as { place?: unknown } | undefined)?.place !== undefined).toBe(true);
    expect(errors).toEqual([]);
  });
});
