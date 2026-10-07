import { expect, test, type Page } from '@playwright/test';
import { boot, openTab, screen, type Theme } from './fixtures';
import { tourPatch, trainerTour } from './trainerHelpers';
import { skipMiniLesson } from './learnHelpers';

// UX-Regeln R1–R12 als Rundgang (docs/umbau/05-ux-ist-und-ziel.md §3.7, Anhang B): 390 × 844 mit Touch, Dunkel
// und Hell. Hier geprüft: R1 (höchstens ein gefüllter Hauptknopf im Bild), R2 (Hauptknopf im sichtbaren Bereich),
// R7 (nichts doppelt, Zustandstexte der Leiste), R8 (alle Tippziele ≥ 44 pt), R9 (nichts springt), dazu kein
// waagrechter Bildlauf. Die Messfunktion ist die aus Anhang B, erweitert um Ziele in Texten und Verdeckung.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Bekannte Befunde in Bereichen anderer Arbeitspakete (Heute-Karte, W3); hier nicht verdeckt, sondern gemeldet. */
const KNOWN_DUPES: string[] = [];
/** Die Zahl fälliger Fehlersätze steht je Thema im Pfad und einmal als Summe in der Zeile „Fehler korrigieren“ (gleicher Text bei gleicher Zahl). */
const DUE_BADGE = /^\d+ (Fehlersatz|Fehlersätze) fällig$/;

type Measure = {
  primary: Array<{ id: string; bottom: number; top: number }>;
  /** Gefüllte Knöpfe einer Übung außerhalb der ActionBar (Lernplattform 2.0 §10.4 P8). */
  outside: string[];
  exercise: boolean;
  small: Array<{ label: string; w: number; h: number }>;
  dupes: string[];
  vvh: number;
  scrollW: number;
  clientW: number;
};

/** Messung eines Bildschirms (Viewport-Koordinaten). */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const vis = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"], [inert], .sr-only, [data-hscroll-hidden]');
    };
    const vvh = window.visualViewport?.height ?? window.innerHeight;
    const inView = (r: DOMRect): boolean => r.bottom > 0 && r.top < vvh && r.right > 0 && r.left < window.innerWidth;
    const sel = 'button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio]';
    const label = (el: Element): string => `${el.tagName.toLowerCase()}${el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : ''} „${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30)}“`;
    const small: Array<{ label: string; w: number; h: number }> = [];
    for (const el of Array.from(document.querySelectorAll(sel))) {
      if (!vis(el)) continue;
      // Das verborgene Eingabefeld der Lücke liegt unter der Lücke (HiddenInput) und ist kein eigenes Ziel.
      if (el.getAttribute('data-testid') === 'gap-input') continue;
      const r = el.getBoundingClientRect();
      if (!inView(r)) continue;
      // Die Trefferfläche antippbarer Wörter reicht per ::after über die Zeile hinaus (index.css `.lx-word::after`).
      const after = parseFloat(getComputedStyle(el, '::after').height);
      const hitH = el.classList.contains('lx-word') && Number.isFinite(after) ? Math.max(r.height, after) : r.height;
      // Inline-Wörter im Fließtext (R8): Zeilenhöhe ≥ 32 pt statt 44.
      const inline = el.classList.contains('lx-word') || el.getAttribute('data-testid') === 'spot-word';
      const min = inline ? 31.5 : 43.5;
      if ((inline ? hitH : Math.min(r.width, r.height)) < min) small.push({ label: label(el), w: Math.round(r.width), h: Math.round(r.height) });
    }
    const primary = Array.from(document.querySelectorAll('button'))
      .filter((b) => vis(b) && /(^|\s)bg-accent(\s|$)/.test(b.className) && inView(b.getBoundingClientRect()))
      .map((b) => ({ id: b.getAttribute('data-testid') ?? b.textContent?.trim().slice(0, 20) ?? '?', bottom: b.getBoundingClientRect().bottom, top: b.getBoundingClientRect().top }));
    const outside = Array.from(document.querySelectorAll('button'))
      .filter((b) => vis(b) && /(^|\s)bg-accent(\s|$)/.test(b.className) && !b.closest('.lx-actionbar'))
      .map((b) => b.getAttribute('data-testid') ?? b.textContent?.trim().slice(0, 20) ?? '?');
    // R7: gleicher Text (≥ 12 Zeichen) höchstens einmal je Bild; Reiter und Ränder ausgenommen.
    const counts = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.children.length > 0 || !vis(el) || el.closest('nav, [data-testid="tabbar"], select, option')) continue;
      const r = el.getBoundingClientRect();
      if (!inView(r)) continue;
      const tx = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
      // Ein einzelnes Wort (Lemma, Lösung) ist kein „Text“: es steht bewusst im Vergleich und in der Wortzeile.
      if (tx.length >= 12 && /\s/.test(tx)) counts.set(tx, (counts.get(tx) ?? 0) + 1);
    }
    return {
      primary,
      outside,
      exercise: !!document.querySelector('[data-testid="exercise"]'),
      small,
      dupes: [...counts].filter(([, n]) => n > 1).map(([tx]) => tx),
      vvh,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });
}

/** Prüft R1, R2, R7 (Duplikate), R8 und den waagrechten Bildlauf für den aktuellen Bildschirm. */
async function rules(page: Page, name: string, theme: Theme): Promise<void> {
  const m = await measure(page);
  const at = `${name} (${theme})`;
  expect(m.primary.map((p) => p.id), `R1 ${at}: gefüllte Hauptknöpfe im Bild`).toHaveLength(Math.min(m.primary.length, 1));
  if (m.exercise) expect(m.outside, `${at}: gefüllter Knopf außerhalb der ActionBar`).toEqual([]);
  for (const p of m.primary) expect(p.bottom, `R2 ${at}: Hauptknopf „${p.id}“ im sichtbaren Bereich`).toBeLessThanOrEqual(m.vvh + 0.5);
  expect(m.small, `R8 ${at}: Ziele unter 44 pt`).toEqual([]);
  expect(m.dupes.filter((d) => !KNOWN_DUPES.includes(d) && !DUE_BADGE.test(d)), `R7 ${at}: doppelter Text`).toEqual([]);
  expect(m.scrollW, `${at}: waagrechter Bildlauf`).toBeLessThanOrEqual(m.clientW + 1);
}

/** R9: Das bediente Element springt nicht (Prüfen-Knopf, Satzzeile) und kein Layout-Versatz ohne Eingabe. */
async function noJump(page: Page, name: string): Promise<void> {
  const box = async (sel: string) => (await page.locator(sel).first().boundingBox()) ?? null;
  const bar0 = await box('[data-testid="check"]');
  const line0 = await box('[data-testid="tile-line"]');
  expect(bar0, `${name}: Prüfen-Knopf`).not.toBeNull();
  const pool = page.locator('[data-testid="tile"][data-where="pool"]');
  const n = Math.min(await pool.count(), 3);
  for (let i = 0; i < n; i++) {
    await pool.first().click();
    const b = await box('[data-testid="check"]');
    const l = await box('[data-testid="tile-line"]');
    expect(Math.abs((b?.y ?? 0) - (bar0?.y ?? 0)), `R9 ${name}: Prüfen springt nach Baustein ${i + 1}`).toBeLessThanOrEqual(2);
    expect(Math.abs((l?.height ?? 0) - (line0?.height ?? 0)), `R9 ${name}: Satzzeile ändert die Höhe`).toBeLessThanOrEqual(2);
    expect(Math.abs((l?.y ?? 0) - (line0?.y ?? 0)), `R9 ${name}: Satzzeile springt`).toBeLessThanOrEqual(2);
  }
  // Solange nicht alle Plätze belegt sind, ist „Prüfen“ gedimmt (nicht ausgeblendet, nicht aktiv).
  if ((await page.locator('[data-testid="tile-slot"]').count()) > 0) await expect(page.getByTestId('check'), `R7 ${name}: Prüfen gedimmt`).toBeDisabled();
  // Zurücklegen, damit der Rundgang die Übung wie gewohnt lösen kann.
  const placed = page.locator('[data-testid="tile"][data-where="line"]');
  while ((await placed.count()) > 0) await placed.first().click();
}

for (const theme of ['dark', 'light'] as const) {
  test(`Rundgang ${theme}: Heute, Wörter, Grammatik, Anwenden, Fortschritt (R1, R2, R7, R8, kein Bildlauf)`, async ({ page }) => {
    test.slow();
    const { errors } = await boot(page, { migrated: true, theme });
    await screen(page, 'today');
    await page.waitForTimeout(450);
    await rules(page, 'Heute', theme);
    for (const [id, name] of [
      ['vocab', 'Wörter-Hub'],
      ['learn', 'Grammatik'],
      ['apply', 'Anwenden'],
      ['progress', 'Fortschritt'],
    ] as const) {
      await openTab(page, id);
      await page.waitForTimeout(450);
      await rules(page, name, theme);
    }
    expect(errors).toEqual([]);
  });
}

for (const theme of ['dark', 'light'] as const) {
  test(`Rundgang ${theme}: Wörter-Übungen (Frage und Ergebnis) mit Aktionsleiste, Zustandstexte, nichts springt`, async ({ page }) => {
    test.slow();
    const { errors } = await boot(page, { migrated: true, theme, fake: { patch: tourPatch(true) } });
    await screen(page, 'today');
    await trainerTour(page, async (name) => {
      await rules(page, name, theme);
      const result = name.endsWith('-ergebnis');
      const bar = page.getByTestId('actionbar');
      // Auswahl-Fragen (Antippen) haben keinen Hauptknopf: dort steht keine Leiste.
      if (name.startsWith('trainer-') && (result || (await page.getByTestId('check').count()) > 0)) {
        await expect(bar, `R2 ${name}: Aktionsleiste steht`).toBeVisible();
        const bb = await bar.boundingBox();
        expect((bb?.y ?? 0) + (bb?.height ?? 0), `R2 ${name}: Leiste am unteren Rand`).toBeGreaterThanOrEqual(843);
        // R7: Zustandstexte – vor dem Prüfen „Prüfen“ (oder Auswahl ohne Knopf), danach „Weiter“.
        if (result) await expect(bar.getByTestId('next'), `R7 ${name}: Weiter nach dem Prüfen`).toContainText('Weiter');
        else await expect(page.getByTestId('check'), `R7 ${name}`).toContainText('Prüfen');
        if (name === 'trainer-tiles') await noJump(page, name);
      }
    });
    expect(errors).toEqual([]);
  });
}

test('Rundgang: Grammatik-Übung (Frage und Ergebnis) und Zähler mit festem Nenner (R4)', async ({ page }) => {
  test.slow();
  const { errors } = await boot(page, { migrated: true, theme: 'dark' });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.getByTestId('hub-next-start').click();
  await skipMiniLesson(page);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await page.waitForTimeout(450);
  const total0 = (await page.getByTestId('round-progress').innerText()).split('/')[1]?.trim();
  await rules(page, 'Grammatik-Aufgabe', 'dark');
  // Falsch antworten: Nenner bleibt, n fällt nie, Wiederholungen stehen separat.
  const seen: number[] = [];
  for (let i = 0; i < 12 && !(await page.getByTestId('summary').isVisible()); i++) {
    await expect(page.getByTestId('gr-item')).toBeVisible();
    const [n, total] = (await page.getByTestId('round-progress').innerText()).split('/').map((x) => Number(x.trim()));
    seen.push(n ?? 0);
    expect(String(total), 'R4: Nenner fest').toBe(total0);
    const item = page.getByTestId('gr-item');
    const kind = (await item.getAttribute('data-type')) ?? '';
    if (kind === 'mc' || kind === 'meaning') {
      await item.getByTestId('choice').first().click();
      await page.getByTestId('check').click();
    } else if (kind === 'find') {
      // Schritt 1: Stelle antippen (liegt sie richtig, folgt Schritt 2 mit der Lücke); bei Fehlversuch erst die Leitfrage, dann die Auflösung.
      await item.getByTestId('spot-word').first().click();
      await page.getByTestId('check').click();
      const replace = item.getByTestId('spot-replace');
      const near = item.locator('[data-testid="hint-line"][data-tone="near"]');
      await expect(item.getByTestId('verdict').or(near).or(replace).first()).toBeVisible();
      if (await replace.isVisible()) {
        await page.getByTestId('gap-input').focus();
        await page.keyboard.type('zzzz', { delay: 10 });
        await page.getByTestId('check').click();
        await expect(item.getByTestId('verdict').or(near).first()).toBeVisible();
        if (await near.isVisible()) await page.getByTestId('check').click();
      } else if (await near.isVisible()) {
        await item.getByTestId('spot-word').first().click();
        await page.getByTestId('check').click();
      }
    } else {
      const input = item.getByTestId('correct-input');
      if (await input.count()) await input.fill('zzzz wrong');
      else {
        await page.getByTestId('gap-input').focus();
        await page.keyboard.type('zzzz', { delay: 10 });
      }
      await page.getByTestId('check').click();
      await expect(item.getByTestId('verdict').or(item.locator('[data-testid="hint-line"][data-tone="near"]'))).toBeVisible();
      if (await item.locator('[data-testid="hint-line"][data-tone="near"]').isVisible()) await page.getByTestId('check').click();
    }
    await expect(item.getByTestId('verdict')).toBeVisible();
    await page.waitForTimeout(450);
    if (i === 0) {
      await rules(page, 'Grammatik-Ergebnis', 'dark');
      await expect(page.getByTestId('next')).toContainText('Weiter');
    }
    await page.getByTestId('next').click();
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  for (let i = 1; i < seen.length; i++) expect(seen[i], `R4: n fällt nie (${seen.join(',')})`).toBeGreaterThanOrEqual(seen[i - 1] ?? 0);
  expect(errors).toEqual([]);
});
