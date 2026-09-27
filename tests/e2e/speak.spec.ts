import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, type Lang, type Theme } from './fixtures';
import { DAY, dump } from './trainerHelpers';

// Sprechen (Phase 3, Plan §9.2): Übersicht, Einweisung, Rollenspiel mit Analysen, Mitnehmen,
// Bericht mit Speichern, Fehlerpfade (Analyse fällt aus, ohne KI, langsam/Stopp, gesperrt),
// Fortsetzen nach Neuladen, Scrollverhalten, neue Szene. Satzmuster der nachgebildeten Analyse:
// „must …“ → Fehler, „I think“ → Kleinigkeit, sonst sauber.

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });
type Doc = Record<string, unknown>;

async function openHub(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-speak').click();
  await screen(page, 'speak');
  await expect(page.getByTestId('scene-card').first()).toBeVisible();
}

async function startScene(page: Page, id = 'sc-vida'): Promise<void> {
  await page.locator(`[data-testid="scene-card"][data-scene="${id}"]`).click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]').first()).toBeVisible();
}

async function say(page: Page, text: string): Promise<void> {
  const before = await page.locator('[data-testid="rp-turn"][data-role="persona"]').count();
  await page.getByTestId('composer-input').fill(text);
  await page.getByTestId('composer-send').click();
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]')).toHaveCount(before + 1);
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
}

const SENTENCES = ['That depends on your test team and the exposure.', 'I think the budget is not the problem here.', 'We must delay the start by two weeks.', 'The penalty risk is real for your company.'];

test('Übersicht: Szenen aus Inhalt und Datenbank, KI-Szene, unvollständige Szene ohne Start', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openHub(page);
  await expect(page.getByTestId('speak-status')).toHaveAttribute('data-done', 'false');
  await expect(page.getByTestId('scene-card')).toHaveCount(6);
  await expect(page.locator('[data-testid="scene-card"][data-src="ai"]')).toHaveCount(1);
  await expect(page.locator('[data-testid="scene-card"][data-src="legacy"]')).toHaveCount(4);
  await page.locator('[data-testid="scene-card"][data-scene="sc-broken"]').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-start')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await expect(page.getByTestId('useful-phrase')).toHaveCount(5);
  await expect(page.getByTestId('scene-create')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Gespräch: 4 Züge, Analysen der Reihe nach, drei Schichten, Wort-Antippen, Mitnehmen, Bericht, gespeichert', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors, external } = await boot(page, { migrated: true });
  await openHub(page);
  await startScene(page);
  await expect(page.getByTestId('rp-turn').first()).toContainText('Let me be direct');
  for (const s of SENTENCES) await say(page, s);
  const chips = page.getByTestId('an-chip');
  await expect(chips).toHaveCount(4);
  await expect(chips.nth(0)).toHaveAttribute('data-state', 'clean', { timeout: 15_000 });
  await expect(chips.nth(1)).toHaveAttribute('data-state', 'minor');
  await expect(chips.nth(2)).toHaveAttribute('data-state', 'errors');
  await expect(chips.nth(3)).toHaveAttribute('data-state', 'clean');

  // Aufklappen (Handy inline): drei Schichten.
  await chips.nth(2).click();
  const card = page.locator('[data-testid="analysis"][data-state="errors"]');
  await expect(card.getByTestId('an-error')).toHaveCount(1);
  await expect(card.getByTestId('an-upgraded')).toContainText('push back the go-live');
  await expect(card.getByTestId('an-change')).toHaveCount(1);
  await expect(card.getByTestId('an-lands')).toBeVisible();
  // Vorhandene Wendung: Zustand, kein Knopf.
  await expect(card.locator('[data-testid="take-chunk"][data-state="exists"]')).toBeVisible();
  await expect(card.locator('[data-testid="take-chunk"][data-state="exists"] button')).toHaveCount(0);
  // Wort antippen öffnet die Nachschlage-Ansicht.
  await card.getByTestId('an-upgraded').locator('button.lx-word[data-lookup="exposure"]').click();
  await expect(page.getByTestId('lk-headword')).toBeVisible();
  await page.getByTestId('lk-close').click();

  // Sauberer Satz: neue Wendung mitnehmen → Zustand ohne Knopf, Dokument mit Ursprungssatz.
  await chips.nth(0).click();
  const clean = page.locator('[data-testid="analysis"][data-idx="1"]');
  const take = clean.locator('[data-testid="take-chunk"]').first();
  await expect(take).toHaveAttribute('data-state', 'idle');
  await take.getByRole('button').click();
  await expect(take).toHaveAttribute('data-state', 'taken');
  await expect(take.locator('button')).toHaveCount(0);
  // Ausgeblendete Wendung: „Wieder aufnehmen“.
  await expect(clean.locator('[data-testid="take-chunk"][data-state="hidden"] button')).toBeVisible();
  const chunk = (await dump(page))['chunk/c-sign-off-on'] as Doc;
  expect(chunk).toMatchObject({ en: 'sign off on', state: 'new', whyLang: 'de' });
  expect(String((chunk.src as Doc).upgraded)).toContain('sign off on');
  expect((chunk.src as Doc).utterance).toBe(SENTENCES[0]);

  await page.screenshot({ path: `${SHOTS}/sprechen-rollenspiel-390.png`, fullPage: true });
  expect(await layoutProblems(page)).toEqual([]);

  // Beenden → Bericht (fester Teil + KI-Teil), Speichern.
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toBeVisible();
  await expect(page.getByTestId('report-stats')).toContainText('4 Züge');
  await expect(page.getByTestId('report-ai')).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
  await expect(page.getByTestId('report-goal')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/sprechen-bericht-390.png`, fullPage: true });
  const d = await dump(page);
  const talk = d['talk/2026-09'] as { runs: Doc[] };
  const run = talk.runs.find((r) => r.day === DAY)!;
  expect(run).toMatchObject({ scene: 'sc-vida', turns: 4, clean: 2, lang: 'de', tier: 'quick', v: 1 });
  expect(run.taken).toEqual(['sign off on']);
  await expect.poll(async () => ((await dump(page))['talk/2026-09'] as { runs: Doc[] }).runs.find((r) => r.day === DAY)?.report).toBeTruthy();
  const log = d[`log/${DAY}`] as { entries: Doc[] };
  const e = log.entries.find((x) => x.type === 'speak')!;
  expect(e).toMatchObject({ type: 'speak', id: 'sc-vida', n: 4, ctx: 'spk' });
  expect(e.k).toBeUndefined();
  expect(((d['app/profile'] as Doc).act as Record<string, Doc>)[DAY]).toMatchObject({ speak: 1 });
  expect((d['scene/sc-vida'] as Doc).runs).toBe(1);
  const radar = (d['app/radar'] as { events: Doc[] }).events;
  expect(radar.some((r) => r.s === 'k' && r.c === 'modals' && String(r.q).includes('must delay'))).toBe(true);

  // Heute: Das Gespräch zählt nicht als „Wiederholen“; Angebote erst nach der Pflicht (Kap. 2.1).
  await page.getByTestId('report-home').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveText(/0 von 3 · es fehlt: Wiederholen/);
  await expect(page.getByTestId('today-offers')).toHaveCount(0);
  // Reiter „Sprechen“: erledigt ist Zustand, kein Knopf (Kap. 2.2).
  await page.getByTestId('tab-speak').click();
  await screen(page, 'speak');
  await expect(page.getByTestId('speak-status')).toHaveAttribute('data-done', 'true');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Analyse fällt aus: Gespräch läuft weiter, Chips „fehlgeschlagen“, „Analyse erneut“ klappt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { sampleFail: { 'turn-analysis': 'upstream_error' } } });
  await openHub(page);
  await startScene(page);
  await say(page, SENTENCES[0]!);
  await say(page, SENTENCES[2]!);
  const chips = page.getByTestId('an-chip');
  await expect(chips.nth(0)).toHaveAttribute('data-state', 'failed');
  await expect(chips.nth(1)).toHaveAttribute('data-state', 'failed');
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { setSampleFail(id: string, c: null): void } }).__LINGO_FAKE__.setSampleFail('turn-analysis', null));
  const idx = await chips.nth(1).getAttribute('data-idx');
  await chips.nth(1).click();
  await page.locator(`[data-testid="analysis"][data-idx="${idx ?? ''}"]`).getByTestId('an-retry').click();
  await expect(chips.nth(1)).toHaveAttribute('data-state', 'errors');
});

test('Ohne Claude: Hinweis statt Start-Knopf; abgelehnt mitten im Gespräch → gesperrt, beendbar', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openHub(page);
  await expect(page.getByTestId('speak-noai').first()).toBeVisible();
  await expect(page.getByTestId('scene-create')).toHaveCount(0);
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-start')).toHaveCount(0);
});

test('Zustimmung verweigert (not_granted): Gespräch gesperrt, Satz zurück im Feld, Beenden möglich', async ({ page }) => {
  await boot(page, { migrated: true, fake: { sampleMode: 'not_granted' } });
  await openHub(page);
  await startScene(page);
  await page.getByTestId('composer-input').fill('Hello there, Reinhard.');
  await page.getByTestId('composer-send').click();
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'blocked');
  await expect(page.getByTestId('rp-blocked')).toBeVisible();
  await expect(page.getByTestId('rp-end')).toBeEnabled();
});

test('Langsam: Hinweis mit Stopp, eigener Satz zurück im Feld', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { sampleDelayMs: 20_000 } });
  await openHub(page);
  await startScene(page);
  await page.getByTestId('composer-input').fill('We can keep the date if we start testing now.');
  await page.getByTestId('composer-send').click();
  await expect(page.getByTestId('rp-thinking')).toBeVisible();
  await expect(page.getByTestId('rp-slow')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('rp-slow').getByTestId('rp-stop').click();
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
  await expect(page.getByTestId('composer-input')).toHaveValue('We can keep the date if we start testing now.');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(0);
});

test('Neu laden mitten im Gespräch: „Fortsetzen“ stellt die Züge wieder her', async ({ page }) => {
  await boot(page, { migrated: true });
  await openHub(page);
  await startScene(page);
  await say(page, SENTENCES[0]!);
  await say(page, SENTENCES[1]!);
  await page.reload();
  await openHub(page);
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await expect(page.getByTestId('rp-resume')).toBeVisible();
  await page.getByTestId('rp-resume').click();
  await screen(page, 'roleplay');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(2);
  await expect(page.getByTestId('rp-turn-count')).toHaveText('Zug 3');
});

test('Scrollen: hochgescrollt + neue Antwort → keine Bewegung, Pille „Neue Antwort“', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await boot(page, { migrated: true });
  await openHub(page);
  await startScene(page);
  for (const s of SENTENCES.slice(0, 3)) await say(page, s);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 200)).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForTimeout(200);
  await page.getByTestId('composer-input').fill('Which date would work for you then?');
  await page.getByTestId('composer-send').click();
  await expect(page.getByTestId('rp-newer')).toBeVisible();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
  await page.getByTestId('rp-newer').click();
  await expect.poll(() => page.evaluate(() => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60)).toBe(true);
});

test('Neue Szene: KI-Karte erscheint, scene/sc-ai… ist gespeichert', async ({ page }) => {
  await boot(page, { migrated: true });
  await openHub(page);
  await page.getByTestId('scene-create').click();
  await page.getByTestId('scene-create-wish').fill('Budget talk with my finance director');
  await page.getByTestId('scene-create-submit').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing')).toContainText('Thomas Brandt');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="scene-card"][data-src="ai"]')).toHaveCount(2);
  const ids = Object.keys(await dump(page)).filter((p) => p.startsWith('scene/sc-ai'));
  expect(ids).toHaveLength(2);
});

test('Übung „aus der Situation“: Runde bis zum Ende speichert Aktivität und Minuten', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openHub(page);
  const before = (await dump(page))['app/profile'] as { act?: Record<string, Record<string, number>>; minutes?: Record<string, number> };
  const actOf = (p: typeof before) => p.act?.[DAY]?.speak ?? 0;
  const minOf = (p: typeof before) => p.minutes?.[DAY] ?? 0;
  await page.getByTestId('situation-start').click();
  const drill = page.getByTestId('situation-drill');
  for (let i = 0; i < 12; i++) {
    await expect(drill).toHaveAttribute('data-state', /asking|done/);
    if ((await drill.getAttribute('data-state')) === 'done') break;
    await page.getByTestId('situation-input').fill('I see what you mean');
    await page.getByTestId('situation-check').click();
    await expect(drill).toHaveAttribute('data-state', 'checked');
    await page.getByTestId('situation-next').click();
  }
  await expect(page.getByTestId('situation-result')).toBeVisible();
  await expect.poll(async () => actOf((await dump(page))['app/profile'] as typeof before)).toBe(actOf(before) + 1);
  expect(minOf((await dump(page))['app/profile'] as typeof before)).toBeGreaterThanOrEqual(minOf(before) + 1);
  // Schließen nach dem Ende speichert nicht ein zweites Mal.
  await drill.getByRole('button').last().click();
  await page.waitForTimeout(300);
  expect(actOf((await dump(page))['app/profile'] as typeof before)).toBe(actOf(before) + 1);
  expect(errors).toEqual([]);
});

const LOOKS: Array<{ width: number; theme: Theme; lang: Lang }> = [
  { width: 390, theme: 'light', lang: 'en' },
  { width: 1440, theme: 'dark', lang: 'de' },
  { width: 2560, theme: 'dim', lang: 'en' },
];

for (const s of LOOKS) {
  test(`Rollenspiel rendert · ${s.width}px · ${s.theme} · ${s.lang} · axe`, async ({ browser }) => {
    const mobile = s.width < 768;
    const context = await browser.newContext({ viewport: { width: s.width, height: 900 }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: s.lang === 'de' ? 'de-DE' : 'en-US' });
    const page = await context.newPage();
    const { errors, external } = await boot(page, { migrated: true, theme: s.theme, lang: s.lang });
    await openHub(page);
    expect(await layoutProblems(page)).toEqual([]);
    const hubAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(hubAxe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await startScene(page);
    await say(page, SENTENCES[2]!);
    await expect(page.getByTestId('an-chip').first()).toHaveAttribute('data-state', 'errors');
    if (s.width >= 1024) await expect(page.getByTestId('analysis-panel').getByTestId('an-upgraded')).toBeVisible();
    else await page.getByTestId('an-chip').first().click();
    expect(await layoutProblems(page)).toEqual([]);
    const rpAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(rpAxe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/sprechen-${s.width}-${s.theme}-${s.lang}.png`, fullPage: true });
    if (s.lang === 'en') expect(/[äöüÄÖÜß]|\b(und|nicht|Gespräch|Züge|Szene)\b/.exec(await page.locator('main').innerText())?.[0] ?? null).toBeNull();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await context.close();
  });
}
