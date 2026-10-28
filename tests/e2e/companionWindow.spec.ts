import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, openTab } from './fixtures';
import type { InstallOptions } from '../../src/platform/dev/install';

// Begleiter als frei bewegliches Schwebefenster (Rückmeldung Emrah): verschieben, Größe ändern, minimieren,
// Vollbild, Lage je Gerät merken; die Aufgabe dahinter bleibt bedienbar. Dazu die Leseregel des Chats:
// beim Einlaufen der Antwort scrollt nichts von selbst nach unten.

type Box = { x: number; y: number; width: number; height: number };

async function start(page: Page, fake: InstallOptions = {}) {
  const booted = await boot(page, { migrated: true, fake });
  await screen(page, 'today');
  return booted;
}

const win = (page: Page) => page.getByTestId('companion');
async function box(page: Page): Promise<Box> {
  // Erst messen, wenn das Einblenden (leichte Verschiebung) und der Übergang zwischen den Lagen fertig sind.
  await page.waitForFunction(() => {
    const el = document.querySelector<HTMLElement>('[data-testid="companion"]');
    return !!el && getComputedStyle(el).transform === 'none' && el.getAnimations().length === 0;
  });
  const b = await win(page).boundingBox();
  if (!b) throw new Error('Fenster nicht sichtbar');
  return b;
}
async function drag(page: Page, from: { x: number; y: number }, dx: number, dy: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx / 2, from.y + dy / 2, { steps: 4 });
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 });
  await page.mouse.up();
}
/** Greifpunkt in der Kopfzeile: links beim Symbol der Überschrift, nie auf einem Knopf oder dem Kantenstreifen. */
async function grip(page: Page) {
  const b = await page.getByTestId('companion-grip').boundingBox();
  if (!b) throw new Error('Kopfzeile fehlt');
  return { x: b.x + 28, y: b.y + b.height / 2 };
}
const inView = (b: Box, w: number, h: number) => b.x >= -1 && b.y >= -1 && b.x + b.width <= w + 1 && b.y + b.height <= h + 1;

// Relaunch P2 S1-SHELL: ab 1024 px dockt Claude in die Kontextspalte (rahmen.spec.ts). Das frei bewegliche Schwebefenster gibt es am
// Laptop darunter (Schiene, 600–1023 px); deshalb läuft dieser Block bei 1000 px (vorher 1440 px).
test.describe('Schwebefenster · Desktop 1000', () => {
  test.use({ viewport: { width: 1000, height: 900 } });

  test('öffnet unten rechts ohne Scrim; die Aufgabe dahinter bleibt bedienbar; Seite wird nicht gesperrt', async ({ page }) => {
    const { errors, external } = await start(page);
    await page.getByTestId('open-companion').click();
    await expect(win(page)).toBeVisible();
    await expect(win(page)).toHaveAttribute('data-mode', 'float');
    await expect(win(page)).not.toHaveAttribute('aria-modal', 'true');
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    // Die Seite dahinter ist nicht „inert" und der Mittelpunkt der Seite liegt nicht unter einem Scrim.
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    expect(await page.evaluate(() => !document.elementFromPoint(300, 300)?.closest('[data-testid="companion"]'))).toBe(true);
    // Reiter wechseln, während das Fenster offen bleibt.
    await openTab(page, 'vocab');
    await expect(win(page)).toBeVisible();
    // Das Fenster liegt nicht mittig über der Aufgabe.
    const b = await box(page);
    expect(b.x + b.width / 2).toBeGreaterThan(1000 * 0.6);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('verschieben über die Kopfzeile, klemmt am Rand, Lage bleibt nach Neuladen', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    const before = await box(page);
    await drag(page, await grip(page), -500, -250);
    const moved = await box(page);
    expect(Math.round(moved.x)).toBe(Math.round(before.x - 500));
    expect(Math.round(moved.y)).toBe(Math.round(before.y - 250));
    expect(Math.round(moved.width)).toBe(Math.round(before.width));
    // Weit über den Rand ziehen: bleibt komplett sichtbar.
    await drag(page, await grip(page), -3000, -3000);
    const edge = await box(page);
    expect([Math.round(edge.x), Math.round(edge.y)]).toEqual([0, 0]);
    await drag(page, await grip(page), 400, 300);
    const placed = await box(page);
    // Neuladen: die Lage ist gemerkt (platform/storage), das Fenster öffnet dort wieder.
    await page.reload();
    await screen(page, 'today');
    await page.getByTestId('open-companion').click();
    const again = await box(page);
    expect([Math.round(again.x), Math.round(again.y), Math.round(again.width), Math.round(again.height)]).toEqual([Math.round(placed.x), Math.round(placed.y), Math.round(placed.width), Math.round(placed.height)]);
  });

  test('Größe ändern über Griff unten rechts und Kanten; Mindestgröße und Bildschirmgrenze', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    const b0 = await box(page);
    const h = await page.getByTestId('companion-resize').boundingBox();
    if (!h) throw new Error('Griff fehlt');
    // Griff ist gut greifbar (Finger).
    expect(h.width).toBeGreaterThanOrEqual(44);
    expect(h.height).toBeGreaterThanOrEqual(28);
    // Nach links oben ziehen am Griff unten rechts verkleinert (Ecke unten rechts folgt dem Zeiger).
    await drag(page, { x: h.x + h.width - 10, y: h.y + h.height / 2 }, -80, -100);
    const b1 = await box(page);
    expect(Math.round(b1.width)).toBe(Math.round(b0.width - 80));
    expect(Math.round(b1.height)).toBe(Math.round(b0.height - 100));
    expect([Math.round(b1.x), Math.round(b1.y)]).toEqual([Math.round(b0.x), Math.round(b0.y)]);
    // Linke Kante nach links: wird breiter.
    const left = { x: b1.x + 2, y: b1.y + b1.height / 2 };
    await drag(page, left, -150, 0);
    const b2 = await box(page);
    expect(Math.round(b2.width)).toBe(Math.round(b1.width + 150));
    // Sehr klein ziehen: Mindestgröße.
    await drag(page, { x: b2.x + b2.width - 4, y: b2.y + b2.height - 12 }, -2000, -2000);
    const b3 = await box(page);
    expect(Math.round(b3.width)).toBe(340);
    expect(Math.round(b3.height)).toBe(240);
    // Sehr groß ziehen: höchstens der Bildschirm.
    await drag(page, { x: b3.x + b3.width - 4, y: b3.y + b3.height - 12 }, 3000, 3000);
    const b4 = await box(page);
    expect(inView(b4, 1000, 900)).toBe(true);
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('Verkleinern zur Pille und wieder aufklappen; Tippen auf die Pille klappt auf', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    const full = await box(page);
    await page.getByTestId('companion-min').click();
    await expect(win(page)).toHaveAttribute('data-minimized', '');
    await expect(page.getByTestId('chat-input')).toBeHidden();
    const pill = await box(page);
    expect(pill.height).toBeLessThanOrEqual(60);
    expect(Math.round(pill.y + pill.height)).toBe(Math.round(full.y + full.height));
    await page.getByTestId('companion-min').click();
    await expect(win(page)).not.toHaveAttribute('data-minimized', '');
    expect(Math.round((await box(page)).height)).toBe(Math.round(full.height));
    await page.getByTestId('companion-min').click();
    // Tipp auf die Kopfzeile (ohne zu ziehen) öffnet wieder (erst messen, wenn die Pille ruht).
    await box(page);
    const g = await grip(page);
    await page.mouse.click(g.x, g.y);
    await expect(win(page)).not.toHaveAttribute('data-minimized', '');
    // Der Chat läuft weiter, auch wenn die Pille zu ist: Eingabe bleibt erhalten.
    await page.getByTestId('chat-input').fill('Entwurf bleibt');
    await page.getByTestId('companion-min').click();
    await page.getByTestId('companion-min').click();
    await expect(page.getByTestId('chat-input')).toHaveValue('Entwurf bleibt');
  });

  test('Vollbild ist modal wie früher (Scrim, Seite gesperrt), „Als Fenster“ bringt die Lage zurück', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    const float = await box(page);
    await page.getByTestId('companion-mode').click();
    await expect(win(page)).toHaveAttribute('data-mode', 'full');
    await expect(win(page)).toHaveAttribute('aria-modal', 'true');
    await expect.poll(async () => (await box(page)).width).toBeGreaterThanOrEqual(640);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBeGreaterThan(0);
    await page.getByTestId('companion-mode').click();
    await expect(win(page)).toHaveAttribute('data-mode', 'float');
    await expect.poll(async () => Math.round((await box(page)).width)).toBe(Math.round(float.width));
    const back = await box(page);
    expect([Math.round(back.x), Math.round(back.y)]).toEqual([Math.round(float.x), Math.round(float.y)]);
    // Die Wahl „Vollbild“ wird gemerkt.
    await page.getByTestId('companion-mode').click();
    await page.reload();
    await screen(page, 'today');
    await page.getByTestId('open-companion').click();
    await expect(win(page)).toHaveAttribute('data-mode', 'full');
  });

  test('Esc schließt nur, wenn der Fokus im Fenster liegt', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    await expect(page.getByTestId('chat-input')).toBeFocused();
    // Klick in die Aufgabe dahinter (leere Fläche links): Fokus verlässt das Fenster.
    await page.mouse.click(10, 500);
    await page.keyboard.press('Escape');
    await expect(win(page)).toBeVisible();
    // Zurück ins Fenster: Esc schließt.
    await page.getByTestId('chat-input').click();
    await page.keyboard.press('Escape');
    await expect(win(page)).toHaveCount(0);
  });

  test('Fenstergröße schrumpft: Lage wird in den sichtbaren Bereich geklemmt', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').click();
    await page.setViewportSize({ width: 700, height: 520 });
    await expect.poll(async () => inView(await box(page), 700, 520)).toBe(true);
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect.poll(async () => inView(await box(page), 1000, 900)).toBe(true);
  });

  test('reduzierte Bewegung: Umschalten geschieht sofort, ohne Übergang', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page);
    await page.getByTestId('open-companion').click();
    await page.getByTestId('companion-min').click();
    await expect(win(page)).toHaveAttribute('data-minimized', '');
    expect((await win(page).getAttribute('class')) ?? '').not.toContain('transition-[left');
  });

  test('Chat scrollt beim Einlaufen der Antwort NICHT mit: eigene Frage oben, Pille führt nach unten', async ({ page }) => {
    test.setTimeout(90_000);
    await start(page, { sampleTickMs: 120 });
    await page.getByTestId('open-companion').click();
    await page.getByTestId('chat-input').fill('zzlong bitte ausführlich');
    await page.getByTestId('chat-send').click();
    const log = page.getByTestId('chat-log');
    const q = page.locator('[data-testid="chat-msg"][data-role="user"]').last();
    // Eigene Frage steht am oberen Rand des Verlaufs.
    await expect
      .poll(async () => Math.round(((await q.boundingBox())?.y ?? 9999) - ((await log.boundingBox())?.y ?? 0)))
      .toBeLessThanOrEqual(24);
    const anchored = await log.evaluate((el) => el.scrollTop);
    // Antwort läuft ein, bis weit mehr Inhalt da ist als sichtbar – der Verlauf bleibt stehen.
    await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop), { timeout: 25_000 }).toBeGreaterThan(500);
    const streaming = page.locator('[data-testid="chat-msg"][data-state="streaming"]');
    await expect(streaming).toHaveCount(1);
    const during = await log.evaluate((el) => el.scrollTop);
    await page.waitForTimeout(1500);
    const later = await log.evaluate((el) => el.scrollTop);
    expect(Math.abs(during - anchored)).toBeLessThanOrEqual(1);
    expect(Math.abs(later - anchored)).toBeLessThanOrEqual(1);
    // Der Antwortanfang ist sichtbar, die Pille bietet „nach unten“ an.
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toBeInViewport({ ratio: 0.2 });
    await expect(page.getByTestId('chat-jump')).toBeVisible();
    await page.getByTestId('chat-jump').click();
    await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.scrollTop - el.clientHeight)).toBeLessThanOrEqual(48);
  });
});

test.describe('Schwebefenster · Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('unteres Drittel, kein Scrim; Griff unten rechts ändert die Größe; Kopfzeile ist Zieh-Griff (touch-action none)', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('open-companion').tap();
    await expect(win(page)).toBeVisible();
    const b = await box(page);
    expect(Math.round(b.height)).toBeGreaterThanOrEqual(Math.round(844 * 0.5));
    expect(b.y).toBeGreaterThan(844 * 0.25);
    // Aufgabe oben bleibt sichtbar und erreichbar (kein Scrim darüber).
    expect(await page.evaluate(() => !document.elementFromPoint(195, 120)?.closest('[data-testid="companion"]'))).toBe(true);
    expect(await page.evaluate(() => document.querySelectorAll('[inert]').length)).toBe(0);
    expect(await page.getByTestId('companion-grip').evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    const g = await page.getByTestId('companion-resize').boundingBox();
    expect(g?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(g?.height ?? 0).toBeGreaterThanOrEqual(28);
    // Größer ziehen (Ecke nach oben links des Griffs wäre kleiner, also nach oben/rechts nicht möglich: Höhe wächst nur nach unten bis Rand).
    // Deshalb erst hochschieben, dann am Griff wachsen.
    await drag(page, await grip(page), 0, -200);
    const up = await box(page);
    expect(Math.round(up.y)).toBe(Math.round(b.y - 200));
    const g2 = await page.getByTestId('companion-resize').boundingBox();
    if (!g2) throw new Error('Griff fehlt');
    await drag(page, { x: g2.x + g2.width - 10, y: g2.y + g2.height / 2 }, 0, 150);
    const grown = await box(page);
    expect(Math.round(grown.height)).toBe(Math.round(up.height + 150));
    expect(inView(grown, 390, 844)).toBe(true);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Vollbild am Handy wie früher: ganze Fläche; „Als Fenster“ zurück', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').tap();
    await page.getByTestId('companion-mode').tap();
    const f = await box(page);
    expect([Math.round(f.x), Math.round(f.y), Math.round(f.width), Math.round(f.height)]).toEqual([0, 0, 390, 844]);
    await page.getByTestId('companion-mode').tap();
    await expect(win(page)).toHaveAttribute('data-mode', 'float');
  });

  test('Lage nach Drehen: Querformat klemmt in den Bildschirm', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-companion').tap();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => inView(await box(page), 844, 390)).toBe(true);
  });
});
