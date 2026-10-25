import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { answerOnly } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Emrahs Meldung 25.10.2026 (live v83, „Auch ne blöde Aufgabe“): Abruf 2 zeigte „…technique and ____. Their recommendations were based on …
// the system had obvious…“ ohne deutsche Bedeutung. Jetzt: „Gesucht: Einstellung“ als ruhige Zeile unter der Aufgabe und genau ein kurzer,
// vollständiger Satz (der abgeschnittene Auszug weicht einem anderen Satz der Karte). Übersprungen heißt „Nicht beantwortet“, nicht „–“.

type Doc = Record<string, unknown>;
const SHOTS = process.env.LX_SHOTS ?? '';
const SCOUTS = '…technique and [attitude]. Their recommendations were based on experience and, to a large extent, on gut feeling. Some scouts were brilliant at this, but the system had obvious…';
const CLEAN = 'A positive attitude helps in difficult negotiations.';
const fresh = (): Doc => ({ word: 'attitude', pos: 'noun', de: 'Einstellung', def: 'the way you think and feel about something', ex: SCOUTS, xEx: [{ en: CLEAN, t: 1 }], state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20', order: 0 });

const label = async (page: Page): Promise<string> => (await page.locator('[data-step]').innerText()).split('\n').find((l) => /Abruf/.test(l)) ?? '';

/** Spielt die Runde bis zu Abruf 2 der Testkarte. Einführung: „Weiß ich nicht“ → „Weiter“; Abruf 1 wird richtig getippt, andere Karten wie sonst. */
async function untilRecall2(page: Page): Promise<void> {
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    await expect(page.getByTestId('exercise').or(page.getByTestId('intro')).or(page.getByTestId('intro-ask-dontknow')).or(page.getByTestId('session-end')).first()).toBeVisible();
    if (await page.getByTestId('intro-ask-dontknow').isVisible()) {
      await page.getByTestId('intro-ask-dontknow').click();
      await page.getByTestId('intro-ask-next').click();
      continue;
    }
    if (await page.getByTestId('intro').isVisible()) {
      await page.getByTestId('intro-continue').click();
      continue;
    }
    if (await page.getByTestId('session-end').isVisible()) throw new Error(`Runde ohne Abruf 2: ${seen.join(', ')}`);
    await expect(page.locator('[data-step]')).toHaveCount(1);
    const card = (await page.getByTestId('exercise').getAttribute('data-card')) ?? '';
    seen.push(`${card}:${(await page.getByTestId('exercise').getAttribute('data-ex')) ?? ''}:${await label(page)}`);
    if (card === 'gc-attitude' && (await label(page)).includes('Abruf 2')) return;
    if (card === 'gc-attitude') {
      await page.getByTestId('gap-input').click();
      await page.keyboard.type('attitude', { delay: 20 });
      await page.keyboard.press('Enter');
    } else {
      await answerOnly(page);
    }
    await expect(page.getByTestId('verdict')).toBeVisible();
    await page.keyboard.press('Enter');
  }
  throw new Error('Abruf 2 nicht erreicht');
}

for (const width of [390, 1440]) {
  test(`Abruf 2 (${width}px): „Gesucht: Einstellung“ und genau ein kurzer, vollständiger Satz`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    const { patch } = ankiPatch(3);
    patch['vocab/gc-attitude'] = fresh();
    const profile = { newPerDay: 2, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: ['review'], goal: { review: 5, new: 2 }, lesson: null, at: 1 } };
    const { errors } = await boot(page, { migrated: true, fake: { patch: { ...patch, 'app/profile': profile } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await untilRecall2(page);

    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-ex', 'cloze');
    // Die Frage steht direkt unter der Aufgabe (Platz „aid“), nicht unter dem Satz.
    const sought = page.locator('[data-slot="aid"]').getByTestId('cue');
    await expect(sought).toHaveText('Gesucht: Einstellung');
    await expect(page.getByTestId('cue')).toHaveCount(1);
    const sentence = (await page.getByTestId('sentence').innerText()).replace(/\s+/g, ' ').trim();
    expect(sentence).not.toMatch(/…|\.\.\./);
    expect(sentence).not.toContain('recommendations');
    expect(sentence).toMatch(/^A positive ?helps in difficult negotiations\.$/);
    expect(sentence.split(' ').length).toBeLessThanOrEqual(22);
    // Gesucht steht über dem Satz.
    const [a, b] = await Promise.all([sought.boundingBox(), page.getByTestId('sentence').boundingBox()]);
    expect((a?.y ?? 0) < (b?.y ?? 0)).toBe(true);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/abruf2-${width}.png`, fullPage: true });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);

    // Nichts getippt, „Weiß ich nicht“: „Nicht beantwortet“ statt „–“; die Gesucht-Zeile bleibt stehen.
    await page.getByTestId('dont-know').click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(sought).toHaveText('Gesucht: Einstellung');
    await expect(page.getByTestId('diff-given')).toHaveText('Nicht beantwortet');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/abruf2-ergebnis-${width}.png`, fullPage: true });
    const axe2 = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(axe2.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
