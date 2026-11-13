import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { TUE_9 } from './heuteHelpers';
import { skipMiniLesson } from './learnHelpers';

// UI-Stichprobe (Emrah 07.11.2026: „als Framework bauen … Stichproben statt kompletter Suite“). Alle Übungskarten laufen durch EINEN Rahmen
// (`ExerciseShell`): eine Änderung dort wirkt überall. Deshalb prüft diese Datei wenige typische Karten (Wort-Lücke, Grammatik-Lücke,
// Anwenden) in je zwei Zuständen auf iPad hochkant, iPhone und Laptop gegen die automatischen Regeln aus `docs/umbau/touch/pruefliste.md`.
// Aufruf: `npm run test:ui` (wenige Minuten). Die volle Suite läuft nur vor dem Live-Gang.

type Device = { name: string; w: number; h: number; touch: boolean };
const DEVICES: Device[] = [
  { name: 'iPad hochkant', w: 704, h: 1000, touch: true },
  { name: 'iPhone', w: 390, h: 844, touch: true },
  { name: 'Laptop', w: 1440, h: 900, touch: false },
];

/** Automatische Regeln der Prüfliste (A1, B5–B7, B9, D13–D15). Liefert die Verstöße als Text. */
async function uiRules(page: Page, d: Device, state: 'task' | 'result'): Promise<string[]> {
  // Erst messen, wenn Einblendungen fertig sind (sonst überlappen gleitende Teile kurz).
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined))));
  await page.waitForTimeout(250);
  return page.evaluate(
    ({ touch, state }) => {
      const out: string[] = [];
      const vis = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        // Inhalt eines zugeklappten <details> hat in Chromium noch Maße, ist aber unsichtbar (nur die Überschrift `summary` zählt).
        const shut = el.closest('details:not([open])');
        if (shut && !el.closest('summary')) return false;
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only, [hidden]');
      };
      const ex = document.querySelector<HTMLElement>('[data-testid="exercise"]');
      if (!ex) return ['keine Übungskarte'];
      // A1: am Touch-Gerät öffnet keine Karte die Tastatur von selbst.
      if (touch && state === 'task' && (document.activeElement as HTMLElement | null)?.dataset.testid === 'gap-input') out.push('A1: Lücke hat ohne Tipp den Fokus');
      // D13/B6: Knöpfe mindestens 44 px hoch und innerhalb ihrer Fläche (Karte bzw. Rückmeldekarte), mit 4 px Luft.
      const box = (state === 'result' ? ex.querySelector('.lx-kcard.lx-result') : null) ?? ex;
      const b = box.getBoundingClientRect();
      const buttons = [...ex.querySelectorAll<HTMLElement>('button, [role="button"]')].filter((el) => vis(el) && getComputedStyle(el).display !== 'inline' && !el.closest('[data-slot="prompt"]') && !el.hasAttribute('data-word'));
      for (const btn of buttons) {
        const r = btn.getBoundingClientRect();
        // WCAG 2.5.8 Ausnahme „inline“: antippbare Wörter im Satz sind Text, keine Knöpfe.
        if (getComputedStyle(btn).display === 'inline' || btn.closest('[data-slot="prompt"]')) continue;
        const id = btn.dataset.testid ?? btn.textContent?.trim().slice(0, 20) ?? '?';
        if (r.height < 43.5 && !btn.closest('.lx-kintro, [data-slot="more"], .lx-gap, [data-testid="vm-wordcard"]') && !btn.classList.contains('lx-vu-why')) out.push(`D13: Knopf „${id}“ nur ${Math.round(r.height)} px hoch`);
        const inside = btn.closest('.lx-actionbar-column, .lx-actionbar') ? r.left >= ex.getBoundingClientRect().left - 1 && r.right <= ex.getBoundingClientRect().right + 1 : r.left >= b.left + 4 - 0.5 && r.right <= b.right - 4 + 0.5;
        if (!inside) out.push(`B6: Knopf „${id}“ ragt über die Kante`);
      }
      // D13: Knöpfe überlappen sich nicht.
      for (let i = 0; i < buttons.length; i++)
        for (let j = i + 1; j < buttons.length; j++) {
          const a = buttons[i]!.getBoundingClientRect();
          const c = buttons[j]!.getBoundingClientRect();
          if (buttons[i]!.contains(buttons[j]!) || buttons[j]!.contains(buttons[i]!)) continue;
          if (a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1) out.push(`D13: „${buttons[i]!.dataset.testid}“ überlappt „${buttons[j]!.dataset.testid}“ (${Math.round(a.top)}–${Math.round(a.bottom)} / ${Math.round(c.top)}–${Math.round(c.bottom)})`);
        }
      // D15: am Touch-Gerät haftet/schwebt die Knopfzeile nie.
      if (touch)
        for (const bar of document.querySelectorAll<HTMLElement>('.lx-actionbar-column, .lx-actionbar')) {
          const pos = getComputedStyle(bar).position;
          if (vis(bar) && (pos === 'fixed' || pos === 'sticky')) out.push(`D15: Knopfzeile ist ${pos}`);
          if (vis(bar) && getComputedStyle(bar).boxShadow !== 'none' && bar.classList.contains('lx-actionbar-column')) out.push('B5: Knopfzeile hat eine eigene Fläche');
        }
      // B7: Rückmeldung als geschlossene Karte (ohne Seitenspalte), Urteil darin.
      if (state === 'result' && window.innerWidth < 1024) {
        const card = ex.querySelector<HTMLElement>('.lx-kcard.lx-result');
        const strip = ex.querySelector<HTMLElement>('.lx-kstrip');
        if (!card || !strip) out.push('B7: keine Rückmeldekarte');
        else {
          const cs = getComputedStyle(card);
          if (cs.display === 'contents' || cs.borderBottomWidth === '0px') out.push('B7: Rückmeldekarte unten offen');
          if (!card.contains(strip)) out.push('B7: Urteil steht nicht in der Karte');
        }
        for (const el of ex.querySelectorAll<HTMLElement>('.lx-kleft, .lx-kbody')) if (getComputedStyle(el).display === 'contents') out.push('B7: Inhalt ohne Rahmen (display: contents)');
      }
      // B9: Bereichsname nicht doppelt sichtbar.
      const area = ex.querySelector<HTMLElement>('[data-testid="ex-area"]');
      if (area && vis(area) && document.querySelector('[data-testid="exercise-bar"]')) out.push('B9: Bereich doppelt');
      return out;
    },
    { touch: d.touch, state },
  );
}

const axe = async (page: Page) =>
  (await new AxeBuilder({ page }).include('[data-testid="exercise"]').withTags(['wcag2a', 'wcag2aa']).analyze()).violations.map((v) => v.id);

async function setup(page: Page, d: Device): Promise<void> {
  if (d.touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setEmitTouchEventsForMouse', { enabled: true, configuration: 'mobile' });
  }
}
const press = async (page: Page, d: Device, id: string) => (d.touch ? page.getByTestId(id).first().tap() : page.getByTestId(id).first().click());

for (const d of DEVICES) {
  test.describe(`UI-Stichprobe ${d.name}`, () => {
    test.use({ viewport: { width: d.w, height: d.h }, hasTouch: d.touch, isMobile: d.touch });

    test('Wörter: Lücke vor und nach dem Prüfen', async ({ page }) => {
      await setup(page, d);
      const { errors } = await boot(page, { migrated: true, vocabAuto: true, localStorage: { 'lx:input': d.touch ? 'touch' : 'keys' } });
      await screen(page, 'today');
      await press(page, d, 'tab-vocab');
      await expect(page.getByTestId('vocab-home')).toBeVisible();
      await press(page, d, (await page.getByTestId('vh-go').isVisible()) ? 'vh-go' : 'vh-more');
      // Erste Karte mit Lücke (Einführungen werden übersprungen).
      for (let i = 0; i < 6 && !(await page.getByTestId('vm-check').isVisible().catch(() => false)); i++) {
        // Politur P2: Vorkarte „Kennst du es schon?“ vor neuen Einzelwörtern → „Nein, neu“.
        if (await page.getByTestId('vm-know-no').isVisible().catch(() => false)) await press(page, d, 'vm-know-no');
        else if (await page.getByTestId('vm-intro-go').isVisible().catch(() => false)) await press(page, d, 'vm-intro-go');
        else await page.waitForTimeout(300);
      }
      await expect(page.getByTestId('vm-check')).toBeVisible();
      expect(await uiRules(page, d, 'task')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      if (d.touch) await page.getByTestId('gap-input').tap();
      await page.keyboard.type('zzz');
      await press(page, d, 'vm-check');
      await expect(page.getByTestId('result')).toBeVisible();
      expect(await uiRules(page, d, 'result')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      // C11: ohne Seitenspalte liegt Claudes Erklärung unter „Mehr“ und startet erst beim Aufklappen.
      if (d.touch) {
        await expect(page.getByTestId('tutor-text')).toHaveCount(0);
        await press(page, d, 'explanation-more');
        await expect(page.getByTestId('more-body')).toBeVisible();
      }
      expect(await axe(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Grammatik: Lücke vor und nach dem Prüfen', async ({ page }) => {
      await setup(page, d);
      const { errors } = await boot(page, { migrated: true, vocabAuto: true, grammarNew: true, localStorage: { 'lx:input': d.touch ? 'touch' : 'keys' } });
      await screen(page, 'today');
      await press(page, d, 'tab-learn');
      await press(page, d, 'hub-next-start');
      // Politur P3: am ersten Tag des Fokus-Themas steht vorn die kurze Regel; danach die erste Aufgabe.
      await skipMiniLesson(page);
      await expect(page.getByTestId('exercise')).toBeVisible();
      expect(await uiRules(page, d, 'task')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      // Stufe „Verstehen“ beginnt oft mit einer Auswahl: bis zur ersten Lücke weitergehen (höchstens 3 Aufgaben).
      for (let i = 0; i < 3 && (await page.getByTestId('gr-item').getAttribute('data-type')) !== 'gap'; i++) {
        await press(page, d, 'choice');
        await press(page, d, 'check');
        await expect(page.getByTestId('gr-item').getByTestId('verdict')).toBeVisible();
        await press(page, d, 'next');
        await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
      }
      const typed = (await page.getByTestId('gr-item').getAttribute('data-type')) === 'gap' && (await page.getByTestId('gap-input').isVisible());
      if (typed) {
        if (d.touch) await page.getByTestId('gap-input').tap();
        await page.keyboard.type('zzz');
        await press(page, d, 'check');
        // Erster Versuch falsch: zuerst die Leitfrage (Zweitversuch), dann das Urteil.
        await expect(page.getByTestId('result').or(page.getByTestId('hint-line')).first()).toBeVisible();
        if (!(await page.getByTestId('result').count())) await press(page, d, 'check');
      } else await press(page, d, 'choice');
      await expect(page.getByTestId('result')).toBeVisible();
      // Politur P3: bei klar falscher Antwort die EINE flache Fehler-Karte – EIN geprüfter Satz warum (die Lösung steht nur im Satz),
      // „Gleich nochmal“ und Claude erst auf Tipp; die Regel erst auf Tipp.
      if (typed) {
        await expect(page.getByTestId('mistake-why')).toBeVisible();
        await expect(page.getByTestId('mistake-spot')).toHaveCount(0);
        await expect(page.getByTestId('rule-side')).toHaveCount(0);
        if (d.touch) expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).not.toBe('mistake-again-input');
      }
      if (process.env.SHOT) await page.screenshot({ path: `/dev/shm/lx/shots/ui-${d.w}-gram.png`, fullPage: true });
      expect(await uiRules(page, d, 'result')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Anwenden: Aufgabe ohne Tastatur von selbst', async ({ page }) => {
      await setup(page, d);
      const { errors } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': d.touch ? 'touch' : 'keys' }, fake: { patch: { 'app/profile': { apc: { n: 1, d: '2026-09-21' } } } } });
      await screen(page, 'today');
      const link = page.locator('[data-testid="today-practice"]:visible, [data-testid="ctx-today-practice"]:visible').first();
      if (d.touch) await link.tap();
      else await link.click();
      await screen(page, 'apply');
      // Großpaket P, P4: Pflicht sind die Brücken-Sätze; die Aufgabe öffnet ebenso ohne Tastatur.
      await press(page, d, 'ax-today-start');
      await screen(page, 'applyBridge');
      await expect(page.getByTestId('bx-item')).toBeVisible();
      if (d.touch) expect(await page.evaluate(() => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''))).toBe(false);
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
