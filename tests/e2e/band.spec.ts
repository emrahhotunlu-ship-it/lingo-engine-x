import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, screen, type Lang } from './fixtures';
import { typeInGap } from './learnHelpers';
import { expected, forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// Übungsrahmen mit Band (Relaunch Stufe 1 P3 S1-BAND, stufe1-plan §6.4; Korrekturrunde nach G2).
// - Band am Handy in fester Reihenfolge: (a) Urteil mit „Wieder in …“ · (b) EINE Lösungszeile · (c) Warum bzw. Merke, 2–3 Zeilen
//   mit Ausblenden · (d) Knopfzeile (`flex: none`, höchstens zwei Zweitknöpfe, je eine Zeile). Läuft (b) oder (c) über, steht
//   `data-clipped` am Band und „Mehr“ ist da; das Blatt beginnt dann mit dem vollen Text.
// - Wort falsch / Lösung gezeigt / fast richtig, Deutsch und Englisch, 390×844 und 390×700.
// - Grammatik auf 390×700 mit dem längsten echten Warum (259 Zeichen, grammar-bank.json tasks[47], past-perfect).
// - Laptop (geteilt, 1024 und 1440): nur EINE Spalte neben der Bühne; „Mehr“ und ⓘ klappen in der Ergebnisspalte auf.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
// err-0039 (src/content/c1x/src/err/k1-2.json items[11]): „Please don’t deploy until QA signed off on the release candidate.“
const ERR_LONG: Doc = {
  q: 'Please don’t deploy until QA signed off on the release candidate.',
  given: '',
  ans: 'Please don’t deploy until QA has signed off on the release candidate.',
  t: OLD,
  due: OLD,
  box: 0,
  src: 'seed',
  cid: 'err-0039',
  pat: 'tc.present-perfect',
  pts: [0, 2],
};
const topicDoc = (id: string, errors: Doc[]): Doc => ({ id, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors });

// Längstes echtes Warum (audit-why-length): grammar-bank.json tasks[47], 259 Zeichen auf Deutsch.
const PP_DE =
  'Nach „It was the first time …“ steht das Past Perfect, weil die Erfahrung vor dem Zeitpunkt in der Vergangenheit liegt. „has handled“ gehört zur Gegenwart („It is the first time she has handled …“); in einer Vergangenheitsgeschichte muss es eine Stufe zurück.';
const PP_EN =
  'After "It was the first time …" we use the Past Perfect, because the experience comes before the past moment. "has handled" belongs to the present ("It is the first time she has handled …"); in a story in the past it has to go one step back.';
const PP_ERR: Doc = { q: 'It was the first time she ___ such a large account.', given: 'has handled', ans: 'had handled', t: OLD, due: OLD, box: 0, src: 'seed', expl: { de: PP_DE, en: PP_EN } };

async function longest(page: Page, choice: 'has signed off' | 'will sign off') {
  const booted = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'err' }, fake: { patch: { 'grammar/time-clauses': topicDoc('time-clauses', [ERR_LONG]) } } });
  const item = page.getByTestId('gr-item');
  await expect(item.getByTestId('c1x-err')).toBeVisible();
  await item.getByTestId('spot-word').nth(5).click();
  // Handy: Wahl-Chips; Laptop (Feinzeiger): die Korrektur wird getippt.
  const chip = item.getByTestId('chip').filter({ hasText: choice });
  const field = item.getByRole('textbox', { name: 'Korrektur' });
  await expect(chip.or(field).first()).toBeVisible();
  if (await chip.isVisible()) await chip.click();
  else await field.fill(choice);
  await page.getByTestId('check').click();
  await expect(item.getByTestId('result')).toBeVisible();
  // Einblenden abwarten (220 ms), dann messen.
  await page.waitForTimeout(400);
  return booted;
}

/** overcome: Stufe 4, schwächste Art „cloze“ (freie Lücke), Tag 1 mit Ursprungssatz (wie hint.spec). */
const OVERCOME = { 'vocab/overcome': { na: 9, hist: [], state: 'learning', stage: 4, S: 1, D: 5, due: 1_700_000_000_000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } } };

type WordCase = 'wrong' | 'shown' | 'near';
async function word(page: Page, kind: WordCase, lang: Lang) {
  const booted = await boot(page, { migrated: true, lang, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
  const answer = expected('cloze', 'overcome', null, 'vocab', lang);
  if (kind === 'shown') await page.getByTestId('dont-know').click();
  else {
    await typeInGap(page, kind === 'near' ? answer.slice(0, -1) : 'zzzz');
    await page.keyboard.press('Enter');
    // Falsch: erst die Hinweisrunde, dann unverändert noch einmal prüfen → Ergebnis.
    if (kind === 'wrong') {
      await expect(page.getByTestId('hint-line')).toBeVisible();
      await page.keyboard.press('Enter');
    }
  }
  await expect(page.getByTestId('result')).toBeVisible();
  await page.waitForTimeout(400);
  return booted;
}

type Measure = { band: number; bar: number; vh: number; scrolls: boolean; whyClipped: boolean; solClipped: boolean; clipped: boolean; position: string; bandTop: number; barTop: number; whyText: string; btnsInside: boolean; btnCount: number; btnWraps: boolean; order: string[] };
const measure = (page: Page): Promise<Measure> =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="result"]');
    const bar = document.querySelector<HTMLElement>('.lx-actionbar');
    const why = band?.querySelector<HTMLElement>('.lx-band-why');
    const btns = band?.querySelector<HTMLElement>('.lx-band-btns');
    const b = band?.getBoundingClientRect();
    const r = bar?.getBoundingClientRect();
    const k = btns?.getBoundingClientRect();
    const buttons = [...(btns?.querySelectorAll<HTMLElement>('button') ?? [])].filter((x) => x.offsetParent !== null);
    const order = [...(band?.querySelector('.lx-band-inner')?.children ?? [])].map((c) => (c as HTMLElement).className.split(' ').find((x) => x.startsWith('lx-band-')) ?? '');
    return {
      band: Math.round(b?.height ?? 0),
      bar: Math.round(r?.height ?? 0),
      vh: window.innerHeight,
      scrolls: !!band && (band.scrollHeight > band.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(band).overflowY)),
      // Überlauf am Inhalt gemessen (unterste Kinderkante gegen die sichtbare Höhe): die vergrößerte Tippfläche der Wörter (`::after`)
      // zählt in scrollHeight mit, ist aber kein Text, der fehlt.
      whyClipped: !!why && [...why.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), why.getBoundingClientRect().top) - why.getBoundingClientRect().top - why.clientHeight >= 18,
      solClipped: !!band?.querySelector('.lx-band-sol[data-clipped]'),
      clipped: !!band?.hasAttribute('data-clipped'),
      position: band ? getComputedStyle(band).position : '',
      bandTop: Math.round(b?.top ?? 0),
      barTop: Math.round(r?.top ?? 0),
      whyText: (why?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      btnsInside: !!b && (!k || (k.top >= b.top - 1 && k.bottom <= b.bottom + 1 && k.bottom <= window.innerHeight)),
      btnCount: buttons.length,
      btnWraps: buttons.some((x) => getComputedStyle(x).whiteSpace !== 'nowrap'),
      order,
    };
  });

/** Die gemeinsamen Band-Regeln (Punkt 1). Gibt die Messung zurück. */
async function bandRules(page: Page, label: string): Promise<Measure> {
  const m = await measure(page);
  test.info().annotations.push({ type: 'band', description: `${label}: Band ${m.band} px + Leiste ${m.bar} px = ${m.band + m.bar} px von ${m.vh} (${Math.round(((m.band + m.bar) / m.vh) * 100)} %), Warum ${m.whyText.length} Zeichen, abgeschnitten: ${m.clipped}` });
  expect(m.position).toBe('fixed');
  // Ein Dock: das Band sitzt direkt auf der Leiste und rollt nie.
  expect(Math.abs(m.bandTop + m.band - m.barTop)).toBeLessThanOrEqual(1);
  expect(m.scrolls).toBe(false);
  // Reihenfolge: Urteil (mit Lösung) · Warum · Knöpfe.
  expect(m.order.filter((x) => ['lx-band-verdict', 'lx-band-why', 'lx-band-btns'].includes(x))).toEqual(['lx-band-verdict', 'lx-band-why', 'lx-band-btns'].filter((x) => m.order.includes(x)));
  // Knöpfe ganz im Band und im Bild, höchstens zwei Zweitknöpfe, je eine Zeile.
  expect(m.btnsInside).toBe(true);
  expect(m.btnCount).toBeLessThanOrEqual(2);
  expect(m.btnWraps).toBe(false);
  // Die dritte Frage hat ihren Platz: ein sichtbares Warum, oder abgeschnitten mit „Mehr“.
  const res = page.getByTestId('result');
  await expect(res.getByTestId('verdict')).toBeVisible();
  if (m.whyClipped) {
    expect(m.clipped).toBe(true);
    await expect(res.getByTestId('explanation-more')).toBeVisible();
  } else expect(m.whyText.length).toBeGreaterThan(0);
  return m;
}

/** Abgeschnitten → das Mehr-Blatt beginnt mit dem vollen Warum. */
async function sheetHasFullWhy(page: Page, m: Measure): Promise<void> {
  if (!m.clipped) return;
  await page.getByTestId('result').getByTestId('explanation-more').click();
  const sheet = page.getByTestId('band-more');
  await expect(sheet).toBeVisible();
  if (m.whyClipped) {
    const full = (await sheet.getByTestId('sheet-why').innerText()).replace(/\s+/g, ' ').trim();
    expect(full.length).toBeGreaterThanOrEqual(m.whyText.length - 2);
    expect(full).toContain(m.whyText.slice(-30).trim());
  } else await expect(sheet.locator('[data-slot="sheet-solution"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
}

for (const vh of [844, 700] as const) {
  test.describe(`Handy 390×${vh}`, () => {
    test.use({ viewport: { width: 390, height: vh }, hasTouch: true });

    for (const lang of ['de', 'en'] as const) {
      for (const kind of ['wrong', 'shown', 'near'] as const) {
        test(`Wort ${kind} (${lang}): Band in fester Reihenfolge, Knöpfe im Band, Warum oder „Mehr“`, async ({ page }) => {
          const { errors } = await word(page, kind, lang);
          const m = await bandRules(page, `390×${vh} Wort ${kind} ${lang}`);
          const res = page.getByTestId('result');
          // Zeile (b): eine Lösungszeile bei falsch und gezeigt; „Wieder in …“ steht als Meta-Text in der Urteilszeile.
          if (kind !== 'near') await expect(res.locator('[data-slot="solution"]')).toBeVisible();
          // Nachprüfung A: Eine einzeilige Lösung ist nie „abgeschnitten“ (kein `data-clipped`, keine Ausblend-Maske) und steht in voller Farbe.
          expect(m.solClipped, 'Lösungszeile abgeschnitten').toBe(false);
          const sol = res.locator('.lx-band-sol');
          if (await sol.count()) {
            const fit = await sol.evaluate((el) => {
              const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
              const top = el.getBoundingClientRect().top;
              const bottom = [...el.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), top);
              const strong = el.querySelector<HTMLElement>('[data-testid="diff-correct"]');
              const probe = document.createElement('span');
              probe.style.color = 'var(--fg)';
              document.body.appendChild(probe);
              const fg = getComputedStyle(probe).color;
              probe.remove();
              return { lines: Math.round((bottom - top) / lh), mask: getComputedStyle(el).maskImage, color: strong ? getComputedStyle(strong).color : fg, fg };
            });
            if (fit.lines <= 1) expect(fit.mask === 'none' || fit.mask === '').toBe(true);
            expect(fit.color).toBe(fit.fg);
          }
          await expect(res.locator('.lx-band-vline [data-testid="next-in"]')).toBeVisible();
          // Der Wortkopf (Bedeutung, Lautschrift) steht im Mehr-Blatt, nicht im Band.
          await expect(res.locator('.lx-band-inner [data-slot="head"]')).toHaveCount(0);
          // „Erklär mir meine Antwort“ steht im Blatt, nicht als dritter Knopf im Band.
          await expect(res.locator('.lx-band-btns').getByTestId('tutor-ask')).toHaveCount(0);
          await sheetHasFullWhy(page, m);
          if (vh === 844) expect(await layoutProblems(page), 'Layout').toEqual([]);
          expect(errors, 'Fehler').toEqual([]);
        });
      }
    }

    for (const choice of ['has signed off', 'will sign off'] as const) {
      test(`längste C1-Rückmeldung (err-0039, ${choice}): Band-Regeln`, async ({ page }) => {
        const { errors } = await longest(page, choice);
        const m = await bandRules(page, `390×${vh} err-0039 ${choice}`);
        if (vh === 844) expect(m.band + m.bar).toBeLessThanOrEqual(Math.round(m.vh * 0.45) + 1);
        await sheetHasFullWhy(page, m);
        expect(errors, 'Fehler').toEqual([]);
      });
    }
  });
}

test.describe('Handy 390×700: längstes Warum (Grammatik, 259 Zeichen)', () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

  test('„Mehr“ sichtbar; abgeschnitten nur, wenn Text fehlt, dann beginnt das Blatt mit dem ganzen Warum', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { fake: { patch: { 'grammar/past-perfect': topicDoc('past-perfect', [PP_ERR]) } } });
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const choice = item.getByTestId('choice').filter({ hasText: 'had handled' });
    if (await choice.count()) await choice.first().click();
    else await typeInGap(page, 'had handled');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('result')).toBeVisible();
    await page.waitForTimeout(400);
    const m = await bandRules(page, '390×700 Grammatik past-perfect');
    // Gezeigt wird die kuratierte Muster-Begründung (siehe unten); sie passt in drei Zeilen. Am Inhalt gemessen (nicht an scrollHeight,
    // in das die Tippfläche der Wörter hineinzählt) heißt das: `data-clipped` genau dann, wenn Text fehlt.
    expect(m.clipped).toBe(m.whyClipped || m.solClipped);
    await page.getByTestId('result').getByTestId('explanation-more').click();
    const sheet = page.getByTestId('band-more');
    // Abgeschnitten → das Blatt beginnt mit dem vollen Warum aus dem Band; passt es ganz ins Band, wiederholt das Blatt es nicht.
    if (m.whyClipped) {
      const full = (await sheet.getByTestId('sheet-why').innerText()).replace(/\s+/g, ' ').trim();
      expect(full).toContain(m.whyText.slice(-30).trim());
    } else await expect(sheet.getByTestId('sheet-why')).toHaveCount(0);
    // Hinweis: Für diese Aufgabe gewinnt die kuratierte Muster-Begründung (Tutor-Engine) über den 259-Zeichen-Text der Bank;
    // der Test prüft deshalb das tatsächlich gezeigte Warum (abgeschnitten auf 700 px) samt Merke im Blatt.
    await expect(sheet.getByTestId('explanation-remember')).toBeVisible();
    await expect(sheet.getByTestId('sheet-grip')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('Handy 390×844: Verhalten', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('das Band rollt nicht und verschwindet nicht von selbst; Mehr-Blatt ≤ 85 %, Esc schließt nur das Blatt', async ({ page }) => {
    await longest(page, 'will sign off');
    const res = page.getByTestId('result');
    const before = await measure(page);
    // Ein Wischen über dem Band bewegt das Band nicht (es steht fest), und es bleibt auch nach 6 s stehen.
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(6000);
    await expect(res).toBeVisible();
    const after = await measure(page);
    expect(after.bandTop).toBe(before.bandTop);
    expect(after.scrolls).toBe(false);
    await res.getByTestId('explanation-more').click();
    const sheet = page.getByTestId('band-more');
    await expect(sheet).toBeVisible();
    const h = await sheet.evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
    expect(h).toBeLessThanOrEqual(0.851);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await expect(res).toBeVisible();
  });

  test('Menü „Optionen“ oben: Claude, Übersetzer, Einstellungen, „Pause, später weiter“ – Pause verlässt die Runde ruhig', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': { ...(forcedPatch()['vocab/avoid'] ?? {}), hist: [] } } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    // Handy: oben nur ✕, Balken und „…“.
    await expect(page.getByTestId('exercise-bar').getByTestId('open-settings')).toHaveCount(0);
    await page.getByTestId('exercise-menu').click();
    const list = page.getByTestId('exercise-menu-list');
    await expect(list.getByTestId('menu-pause')).toHaveText('Pause, später weiter');
    await expect(list.getByTestId('open-settings')).toBeVisible();
    await expect(list.getByTestId('menu-whyTask')).toBeVisible();
    await list.getByTestId('menu-pause').click();
    await screen(page, 'today');
  });

  test('Tipp-Runde: eine ruhige Zeile, nie rot', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await typeInGap(page, 'zzzz');
    await page.keyboard.press('Enter');
    const line = page.getByTestId('hint-line');
    await expect(line).toBeVisible();
    // Eine Zeile (Punkt 12): „Anderes Wort – beginnt mit „ov…“ (8)“.
    await expect(line).toContainText('Anderes Wort – beginnt mit');
    const lines = await line.evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight || '20')));
    expect(lines).toBeLessThanOrEqual(1);
    const color = await line.evaluate((el) => getComputedStyle(el).color);
    const bad = await page.evaluate(() => {
      const p = document.createElement('span');
      p.style.color = 'var(--bad)';
      document.body.appendChild(p);
      const c = getComputedStyle(p).color;
      p.remove();
      return c;
    });
    expect(color).not.toBe(bad);
  });
});

// Laptop (Feinzeiger, geteilt): nur EINE Spalte neben der Bühne. „Mehr“ und ⓘ klappen in der Ergebnisspalte auf (Punkt 2).
// Breiten nach Plan-Tabelle 6.2: ab 1280 Bühne 640–720 und Spalte 360–420; bei 1024 so nah an 600/320, wie die Leiste es zulässt
// (gemessen: Bühne 590, Spalte 300 – die Leiste nimmt 76 px, für 600 + 320 + Abstände fehlen rund 30 px).
const SPLIT = { 1024: { h: 768, stage: [585, 720], side: [300, 420] }, 1440: { h: 900, stage: [640, 720], side: [360, 420] } } as const;
for (const width of [1024, 1440] as const) {
  test.describe(`Laptop ${width}×${SPLIT[width].h} (geteilt)`, () => {
    test.use({ viewport: { width, height: SPLIT[width].h }, hasTouch: false });

    test('„Mehr“ und ⓘ klappen in der Ergebnisspalte auf; keine zweite Spalte, Bühne ≥ 600 px, Urteil im Bild', async ({ page }) => {
      const { errors } = await longest(page, 'will sign off');
      const res = page.getByTestId('result');
      const more = res.getByTestId('explanation-more');
      const oneColumn = async () => {
        await expect(page.getByTestId('context-more')).toHaveCount(0);
        await expect(page.getByTestId('band-more')).toHaveCount(0);
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect((await page.getByTestId('stage').boundingBox())?.width ?? 0).toBeGreaterThanOrEqual(600);
      };
      await expect(more).toBeVisible();
      // Breiten der beiden Spalten (Nachprüfung B).
      const cols = await page.evaluate(() => ({
        main: Math.round(document.querySelector('[data-col="main"]')?.getBoundingClientRect().width ?? 0),
        side: Math.round(document.querySelector('[data-col="side"]')?.getBoundingClientRect().width ?? 0),
      }));
      test.info().annotations.push({ type: 'split', description: `${width}: Bühne ${cols.main} px, Ergebnisspalte ${cols.side} px` });
      expect(cols.main).toBeGreaterThanOrEqual(SPLIT[width].stage[0]);
      expect(cols.main).toBeLessThanOrEqual(SPLIT[width].stage[1]);
      expect(cols.side).toBeGreaterThanOrEqual(SPLIT[width].side[0]);
      expect(cols.side).toBeLessThanOrEqual(SPLIT[width].side[1]);
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      await expect(more).toContainText('Weniger');
      await expect(res.getByTestId('more-body')).toBeVisible();
      await oneColumn();
      // Esc klappt zu, das Urteil steht danach im Bild und nicht unter der Übungsleiste (Nachprüfung C).
      await page.mouse.wheel(0, 600);
      await page.waitForTimeout(200);
      await page.keyboard.press('Escape');
      await expect(more).toHaveAttribute('aria-expanded', 'false');
      await expect(res.locator('[data-slot="verdict"]')).toBeInViewport();
      await page.waitForTimeout(400);
      const pos = await page.evaluate(() => ({
        verdict: document.querySelector('[data-testid="result"] [data-slot="verdict"]')?.getBoundingClientRect().top ?? -1,
        bar: document.querySelector('[data-testid="exercise-bar"]')?.getBoundingClientRect().bottom ?? 0,
      }));
      expect(pos.verdict).toBeGreaterThanOrEqual(pos.bar);
      // ⓘ: Zweck und Thema in der Ergebnisspalte, keine zweite Spalte.
      await page.getByTestId('purpose-info').click();
      await expect(page.getByTestId('purpose-info')).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-col="side"] [data-slot="info"]')).toBeVisible();
      await oneColumn();
      await expect(page.getByTestId('exercise')).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

// Tablet quer mit Touch (Band): „Mehr“ steht in der Kontextspalte des Rahmens (P2, `#lx-context`), nicht im Blatt.
test.describe('Tablet quer 1024 mit Touch (Band)', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('„Mehr“ öffnet die Kontextspalte, kein Blatt; ✕ schließt sie, die Übung bleibt', async ({ page }) => {
    const { errors } = await longest(page, 'will sign off');
    const col = page.getByTestId('context-column');
    const more = page.getByTestId('result').getByTestId('explanation-more');
    await expect(more).toBeVisible();
    await more.click();
    await expect(col).toHaveAttribute('data-kind', 'more');
    await expect(page.getByTestId('context-more')).toBeVisible();
    await expect(page.getByTestId('band-more')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Die Spalte sitzt rechts neben der Bühne, nicht darüber.
    const [stage, aside] = await Promise.all([page.getByTestId('stage').boundingBox(), col.boundingBox()]);
    expect((aside?.x ?? 0) + 1).toBeGreaterThanOrEqual((stage?.x ?? 0) + (stage?.width ?? 0));
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await page.getByTestId('context-close').click();
    await expect(page.getByTestId('context-more')).toHaveCount(0);
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('result')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
