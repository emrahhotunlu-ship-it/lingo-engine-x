import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, openEntry } from './fixtures';
import { dump, forcedPatch, planPatch } from './trainerHelpers';
import type { InstallOptions } from '../../src/platform/dev/install';

// Phase 5: Claude-Begleiter (Plan §8.1, §10.2 companion.spec.ts, C-01 … C-10).
// Gegen den Produktions-Build mit eingespieltem Adapter (feste Antworten: cannedCompanion.ts).

type Call = { id: string | null; tier: string; input: string; cache?: unknown; turns?: number; roles?: string[] };
const calls = (page: Page): Promise<Call[]> =>
  page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls]);
const chatCalls = async (page: Page) => (await calls(page)).filter((c) => c.id === 'companion-chat');
const subs = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { activeSubscriptions(): number } } }).__LINGO_FAKE__.db.activeSubscriptions());
const subPaths = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { activePaths(): string[] } } }).__LINGO_FAKE__.db.activePaths());
type Msg = { role: string; content: string; t?: number; lang?: string; stopped?: boolean };
const chatDoc = async (page: Page) => (await dump(page))['app/chat'] as { msgs: Msg[]; since?: number };

async function start(page: Page, fake: InstallOptions = {}) {
  const booted = await boot(page, { migrated: true, fake });
  await screen(page, 'today');
  return booted;
}

async function openAndSend(page: Page, text: string) {
  await page.getByTestId('open-companion').click();
  await expect(page.getByTestId('companion')).toBeVisible();
  await page.getByTestId('chat-input').fill(text);
  await page.getByTestId('chat-send').click();
}

test.describe('Desktop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('C-01 Kopf-Knopf öffnet, „sieht gerade: Heute", Esc schließt, Fokus zurück; Overlay ≥ 640 px breit', async ({ page }) => {
    const { errors, external } = await start(page);
    const opener = page.getByTestId('open-companion');
    await opener.click();
    const dlg = page.getByTestId('companion');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('role', 'dialog');
    await expect(page.getByTestId('seeing')).toHaveAttribute('data-area', 'today');
    await expect(page.getByTestId('seeing')).toContainText('sieht gerade: Heute');
    const box = await dlg.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(640);
    // Verlauf aus app/chat (Altnachrichten ohne t/lang).
    await expect(page.locator('[data-testid="chat-msg"][data-role="user"]')).toHaveCount(2);
    expect(await layoutProblems(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('C-02 Senden → Denkt nach → Antwort; ein Aufruf default/cache:false, Schritte user…user; app/chat +2 mit t/lang', async ({ page }) => {
    const { errors } = await start(page, { sampleDelayMs: 600 });
    await openAndSend(page, 'Was heißt leverage?');
    await expect(page.getByTestId('ai-phase')).toContainText('Denkt nach');
    const reply = page.locator('[data-testid="chat-msg"][data-role="assistant"]').last();
    await expect(reply).toHaveAttribute('data-state', 'done');
    await expect(reply).toContainText('leverage');
    const c = await chatCalls(page);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ tier: 'default', cache: false });
    expect(c[0]!.roles?.[0]).toBe('user');
    expect(c[0]!.roles?.at(-1)).toBe('user');
    await expect.poll(async () => (await chatDoc(page)).msgs.length).toBe(6);
    const doc = await chatDoc(page);
    expect(doc.msgs.slice(-2).map((m) => [m.role, typeof m.t, m.lang])).toEqual([
      ['user', 'number', 'de'],
      ['assistant', 'number', 'de'],
    ]);
    // Englische Stellen der fertigen Antwort sind antippbar.
    await expect(reply.locator('button.lx-word').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('C-03 Kein Scroll-Springen: hochgescrollt bleibt die Ansicht stehen, Pille führt nach unten', async ({ page }) => {
    await start(page, { sampleTickMs: 150 });
    await openAndSend(page, 'zzlong bitte ausführlich');
    const log = page.getByTestId('chat-log');
    await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.clientHeight), { timeout: 20_000 }).toBeGreaterThan(700);
    await log.evaluate((el) => (el.scrollTop = el.scrollTop - 400));
    const before = await log.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(2000);
    const after = await log.evaluate((el) => el.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
    await expect(page.getByTestId('chat-jump')).toBeVisible();
    await page.getByTestId('chat-jump').click();
    await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(48);
  });

  test('C-04 Übung offen: Schutzregel, keine Lösung; Öffnen zählt als Hilfe; nach dem Prüfen mit Lösung', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), 'vocab/avoid': forcedPatch()['vocab/avoid'] ?? {} } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze_hint');
    await page.getByTestId('open-companion').click();
    await expect(page.getByTestId('seeing')).toHaveAttribute('data-area', 'trainer');
    await page.getByTestId('chat-suggestion').first().click();
    const reply = page.locator('[data-testid="chat-msg"][data-role="assistant"]').last();
    await expect(reply).toContainText('[no-solution]');
    const first = (await chatCalls(page))[0]!;
    expect(first.input).toContain('has NOT checked');
    expect(first.input).toContain('___');
    expect(first.input).not.toContain('Solution:');
    expect(first.input.toLowerCase()).not.toMatch(/\bavoid\b/);
    await page.keyboard.press('Escape');
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('avoid', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
    const grade = Number(await page.getByTestId('due-in').getAttribute('data-grade'));
    expect(grade).toBeLessThanOrEqual(2);
    await openAndSend(page, 'Warum?');
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toContainText('[solution-ok]');
    const second = (await chatCalls(page))[1]!;
    expect(second.input).toContain('Solution: avoid');
    expect(second.input).not.toContain('has NOT checked');
  });

  test('C-05 Wort antippen → „Claude fragen" → Begleiter mit Bezug, genau ein Aufruf sofort', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    // Englisches Zitat in einer Seed-Antwort ist antippbar („sign off on something").
    await page.locator('[data-testid="chat-msg"][data-role="assistant"] button.lx-word', { hasText: 'something' }).first().click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.getByTestId('lk-ask').click();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    const user = page.locator('[data-testid="chat-msg"][data-role="user"]').last();
    await expect(user).toContainText('Erkläre mir „something“ in diesem Satz');
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    expect(await chatCalls(page)).toHaveLength(1);
    expect((await chatCalls(page))[0]!.input).toContain('Question is about: "something"');
    // Das Wort gilt nur für diese eine Frage (Befund 27.09.: Claude antwortete auf den alten Bezug).
    await expect(page.getByTestId('chat-attach')).toHaveCount(0);
    await page.getByTestId('chat-input').fill('Was heißt deadline?');
    await page.getByTestId('chat-send').click();
    await expect.poll(async () => (await chatCalls(page)).length).toBe(2);
    expect((await chatCalls(page))[1]!.input).not.toContain('Question is about');
  });

  test('C-06 Antwort in anderer Sprache wird eingeklappt, „Auf Deutsch neu fragen"', async ({ page }) => {
    await start(page);
    await openAndSend(page, 'zzen please');
    const reply = page.locator('[data-testid="chat-msg"][data-role="assistant"]').last();
    await expect(reply).toHaveAttribute('data-state', 'foreign');
    await expect(reply).toHaveAttribute('data-lang', 'en');
    await expect(reply.getByTestId('chat-foreign-toggle')).toContainText('Antwort auf Englisch');
    await expect(reply).not.toContainText('Sure!');
    await reply.getByTestId('chat-foreign-toggle').click();
    await expect(reply).toContainText('Sure!');
    await expect(reply.getByTestId('chat-ask-again')).toContainText('Auf Deutsch neu fragen');
    const doc = await chatDoc(page);
    expect(doc.msgs.at(-1)?.lang).toBe('en');
  });

  test('C-07 Stopp mitten im Streamen → gestoppt gespeichert, kein weiterer Aufruf', async ({ page }) => {
    await start(page, { sampleTickMs: 150 });
    await openAndSend(page, 'zzlong');
    await expect(page.locator('[data-testid="chat-msg"][data-state="streaming"]')).toContainText('Ausführlich', { timeout: 10_000 });
    await page.getByTestId('chat-stop').click();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'stopped');
    await expect.poll(async () => (await chatDoc(page)).msgs.at(-1)?.stopped).toBe(true);
    await page.waitForTimeout(500);
    expect(await chatCalls(page)).toHaveLength(1);
  });

  test('C-08 „Neues Gespräch" setzt since; der nächste Aufruf enthält den alten Verlauf nicht', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    await page.getByTestId('chat-new').click();
    await expect.poll(async () => typeof (await chatDoc(page)).since).toBe('number');
    await expect(page.getByTestId('chat-earlier')).toBeVisible();
    await page.getByTestId('chat-input').fill('Neue Frage');
    await page.getByTestId('chat-send').click();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    const c = (await chatCalls(page))[0]!;
    expect(c.input).not.toContain('sign off on');
    expect(c.turns).toBe(2);
  });

  test('C-09 Schließen während des Streamens: die Antwort kommt an und steht in app/chat; C-10 Abos', async ({ page }) => {
    await start(page, { sampleTickMs: 60 });
    const base = await subs(page);
    await page.getByTestId('open-companion').click();
    await expect.poll(() => subs(page)).toBe(base + 1);
    await page.getByTestId('chat-input').fill('Erklär mir leverage');
    await page.getByTestId('chat-send').click();
    await expect(page.locator('[data-testid="chat-msg"][data-state="streaming"]')).toBeVisible();
    await page.getByTestId('companion-close').click();
    await expect(page.getByTestId('companion')).toHaveCount(0);
    await expect.poll(() => subs(page)).toBe(base);
    // C-10: Grundstock auf „Heute“ – je Dokument bzw. Sammlung genau EIN Abo (Kap. 3.4), keine Dopplung.
    // Neubau: 6 Live-Dokumente (profile, course, assess, schema, repair, memory – „Claude merkt sich“
    // liest app/memory synchron aus dem Live-Stand, prompts/work.ts) + 4 Sammlungen (vocab, grammar,
    // archive, chunk) + Tagesprotokoll log/<heute> + app/week (Wochenplan) + app/decks (Stapel) = 13,
    // weit unter der Vertragsgrenze von 64 je Ansicht (db.d.ts). Früher (Phase 5) waren es ≤ 10.
    const paths = await subPaths(page);
    expect(paths).toHaveLength(base);
    expect(paths.filter((p, i) => paths.indexOf(p) !== i), 'doppelte Abos').toEqual([]);
    expect(base).toBeLessThanOrEqual(13);
    await expect.poll(async () => (await chatDoc(page)).msgs.length, { timeout: 15_000 }).toBe(6);
    expect((await chatDoc(page)).msgs.at(-1)?.stopped).toBeUndefined();
  });

  test('Fehler: upstream_error → „unterbrochen" mit Teiltext + Erneut senden (ein Aufruf je Klick)', async ({ page }) => {
    await start(page, { sampleFailOnce: { 'companion-chat': 'upstream_error' } });
    await openAndSend(page, 'Hallo');
    await expect(page.getByTestId('chat-error')).toBeVisible();
    await expect(page.getByTestId('chat-error')).toContainText('unterbrochen');
    await page.getByTestId('chat-retry').click();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    expect(await chatCalls(page)).toHaveLength(2);
  });

  test('rate_limited → Hinweis „ausgelastet", Senden gesperrt, kein automatischer Aufruf', async ({ page }) => {
    await start(page, { sampleFailOnce: { 'companion-chat': 'rate_limited' } });
    await openAndSend(page, 'Hallo');
    await expect(page.getByTestId('chat-error')).toContainText('ausgelastet');
    await expect(page.getByTestId('chat-paused')).toBeVisible();
    await page.getByTestId('chat-input').fill('Noch einmal');
    await expect(page.getByTestId('chat-send')).toBeDisabled();
    await page.waitForTimeout(500);
    expect(await chatCalls(page)).toHaveLength(1);
  });

  test('not_granted → Begleiter-Knopf verschwindet', async ({ page }) => {
    await start(page, { sampleFailOnce: { 'companion-chat': 'not_granted' } });
    await openAndSend(page, 'Hallo');
    await expect(page.getByTestId('chat-error')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('open-companion')).toHaveCount(0);
    await expect(page.locator('[data-ai]')).toHaveCount(0);
  });
});

test.describe('Handy 390 (Touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('C-02 mobil: Vollbild-Blatt, Senden per Knopf, Antwort gespeichert, kein Querscrollen', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('open-companion').tap();
    const dlg = page.getByTestId('companion');
    await expect(dlg).toBeVisible();
    const box = await dlg.boundingBox();
    expect(Math.round(box?.width ?? 0)).toBe(390);
    await page.getByTestId('chat-input').fill('Was heißt leverage?');
    await page.getByTestId('chat-send').tap();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    expect(await layoutProblems(page)).toEqual([]);
    await expect.poll(async () => (await chatDoc(page)).msgs.length).toBe(6);
    expect(errors).toEqual([]);
  });

  /** Unteres Ende des Verlaufs sichtbar, keine Pille „Neue Antwort". */
  async function expectAtEnd(page: Page) {
    const log = page.getByTestId('chat-log');
    await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(48);
    await expect(page.getByTestId('chat-jump')).toHaveCount(0);
    const last = page.locator('[data-testid="chat-msg"][data-role="assistant"]').last();
    await expect(last).toBeInViewport({ ratio: 0.3 });
  }

  test('erste Frage nach dem Öffnen: Frage und Antwort bleiben sichtbar; Vorschläge danach kompakt', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('open-companion').tap();
    await expect(page.getByTestId('companion')).toBeVisible();
    const chips = page.getByTestId('chat-suggestions');
    await page.getByTestId('chat-input').fill('Was heißt leverage?');
    await page.getByTestId('chat-send').tap();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-testid="chat-msg"][data-role="user"]').last()).toContainText('Was heißt leverage?');
    await expectAtEnd(page);
    // Nach dem ersten Senden: Vorschläge in einer Zeile, höchstens etwa ein Achtel der Höhe.
    await expect(chips).toHaveAttribute('data-compact', '');
    const box = await chips.boundingBox();
    expect(box?.height ?? 999).toBeLessThanOrEqual(844 / 8);
    // Zweite Frage über einen Vorschlag: wieder am Ende.
    await chips.getByTestId('chat-suggestion').first().tap();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    await expectAtEnd(page);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('„Claude fragen" aus dem Wort-Popup: Frage und Antwort am Ende sichtbar', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('open-companion').tap();
    await page.locator('[data-testid="chat-msg"][data-role="assistant"] button.lx-word', { hasText: 'something' }).first().tap();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.getByTestId('lk-ask').tap();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    await expectAtEnd(page);
    expect(errors).toEqual([]);
  });
});

test.describe('Handy 390: Begleiter sieht Phase-2–4-Bildschirme (Prüfbericht W1)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const seeing = async (page: Page) => {
    await page.getByTestId('open-companion').click();
    await expect(page.getByTestId('companion')).toBeVisible();
    const s = page.getByTestId('seeing');
    const out = { area: await s.getAttribute('data-area'), text: await s.innerText() };
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('companion')).toHaveCount(0);
    return out;
  };

  test('Grammatikaufgabe und Rollenspiel melden ihren Kontext statt „Heute"; offene Aufgabe mit Schutzregel', async ({ page }) => {
    const { errors } = await start(page);
    await openEntry(page, 'hub-grammar');
    await expect(page.getByTestId('grammar')).toBeVisible();
    expect(await seeing(page)).toMatchObject({ area: 'grammar', text: 'sieht gerade: Grammatik' });
    await page.getByTestId('gr-start').click();
    await expect(page.getByTestId('gr-item')).toBeVisible();
    const g = await seeing(page);
    expect(g.area).toBe('grammar');
    expect(g.text).toMatch(/^sieht gerade: Grammatik · \S/);
    // Offene Aufgabe: Claude bekommt die Schutzregel und die Aufgabe, nie die Lösung.
    await openAndSend(page, 'Hilf mir');
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toContainText('[no-solution]');
    expect((await chatCalls(page))[0]!.input).toContain('has NOT checked');
    expect((await chatCalls(page))[0]!.input).not.toContain('Solution:');
    await page.keyboard.press('Escape');
    await page.getByTestId('round-close').click();

    await page.getByTestId('tab-speak').click();
    await expect(page.getByTestId('scene-card').first()).toBeVisible();
    expect(await seeing(page)).toMatchObject({ area: 'speak', text: 'sieht gerade: Sprechen' });
    await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
    await page.getByTestId('briefing-start').click();
    await screen(page, 'roleplay');
    const r = await seeing(page);
    expect(r.area).toBe('speak');
    expect(r.text).toMatch(/^sieht gerade: Sprechen · \S/);
    expect(errors).toEqual([]);
  });
});
