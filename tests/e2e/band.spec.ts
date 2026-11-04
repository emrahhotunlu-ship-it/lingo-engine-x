import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, screen, type Lang } from './fixtures';
import { typeInGap } from './learnHelpers';
import { expected, forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// Rückmeldung nach dem Prüfen (UX-Neuanfang B, freigegebene Vorschau `5Zwv5noCiNwzrzzfQsfzXy`, Emrah 02.11.2026).
// Ersetzt das feste Band (Relaunch P3): Die Erklärung kommt von selbst und steht ganz da, nichts ist abgeschnitten.
// - Handy: EINE Rückmeldung im Fluss (`data-flow`) in fester Reihenfolge: Urteil mit „Wieder in …“ · Lösung · Warum · Merke ·
//   (Claude-Erklärung) · „Mehr“ (klappt an Ort und Stelle auf) · „Frag Claude“ mit Schnellfragen. Unten fest nur „Weiter“.
// - Wort falsch / Lösung gezeigt / fast richtig, Deutsch und Englisch, 390×844 und 390×700; längste C1-Rückmeldung (err-0039);
//   Grammatik mit dem längsten echten Warum (259 Zeichen, grammar-bank.json tasks[47], past-perfect).
// - Laptop (1024 und 1440, Feinzeiger): Vollbild ohne Navigationsleiste; Mitte Urteil und Lösung, rechts „Erklärung“ und
//   „Frag Claude“ (immer sichtbar, mit Eingabe). Dockt der Begleiter an, rückt die Erklärung in die Mitte (`data-noside`).
// Kern (Emrah 03.11.2026, Vorschau 9pdpfT8E): die Rückmeldung ist EINE Karte – Urteilsstreifen oben, darin Lösung · Warum · Merke ·
//   „Mehr“; „Kommt … wieder“ unter der Karte; „Frag Claude dazu“ steht neben „Weiter“ (keine Schnellfragen, keine eigene Seitenspalte).

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
const topicDoc = (id: string, errors: Doc[]): Doc => ({
  id,
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

// Längstes echtes Warum (audit-why-length): grammar-bank.json tasks[47], 259 Zeichen auf Deutsch.
const PP_DE =
  'Nach „It was the first time …“ steht das Past Perfect, weil die Erfahrung vor dem Zeitpunkt in der Vergangenheit liegt. „has handled“ gehört zur Gegenwart („It is the first time she has handled …“); in einer Vergangenheitsgeschichte muss es eine Stufe zurück.';
const PP_EN =
  'After "It was the first time …" we use the Past Perfect, because the experience comes before the past moment. "has handled" belongs to the present ("It is the first time she has handled …"); in a story in the past it has to go one step back.';
const PP_ERR: Doc = { q: 'It was the first time she ___ such a large account.', given: 'has handled', ans: 'had handled', t: OLD, due: OLD, box: 0, src: 'seed', expl: { de: PP_DE, en: PP_EN } };

async function longest(page: Page, choice: 'has signed off' | 'will sign off') {
  const booted = await bootAt(
    page,
    { name: 'grammarSession', mode: 'errors' },
    { localStorage: { 'lx:flags': 'err' }, fake: { patch: { 'grammar/time-clauses': topicDoc('time-clauses', [ERR_LONG]) } } },
  );
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
const OVERCOME = {
  'vocab/overcome': {
    na: 9,
    hist: [],
    state: 'learning',
    stage: 4,
    S: 1,
    D: 5,
    due: 1_700_000_000_000,
    last: 1_699_900_000_000,
    reps: 3,
    lapses: 0,
    xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } },
  },
};

type WordCase = 'wrong' | 'shown' | 'near' | 'right';
async function word(page: Page, kind: WordCase, lang: Lang) {
  const booted = await boot(page, { migrated: true, lang, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
  const answer = expected('cloze', 'overcome', null, 'vocab', lang);
  if (kind === 'shown') await page.getByTestId('dont-know').click();
  else {
    await typeInGap(page, kind === 'right' ? answer : kind === 'near' ? answer.slice(0, -1) : 'zzzz');
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

type Flow = { position: string; vh: number; barTop: number; flowBottom: number; whyText: string; whyClipped: boolean; order: string[]; band: number; sheet: number };
/** Misst die Rückmeldung im Fluss, nachdem sie ganz nach unten gerollt wurde. */
const measureFlow = (page: Page): Promise<Flow> =>
  page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 250));
    const res = document.querySelector<HTMLElement>('[data-testid="result"]');
    const bar = document.querySelector<HTMLElement>('[data-testid="actionbar"]');
    const why = res?.querySelector<HTMLElement>('[data-block="why"]');
    const order = [...(res?.querySelectorAll<HTMLElement>('[data-block="verdict"], [data-block="why"], [data-block="remember"], [data-slot="more"], [data-testid="claude-ask-inline"]') ?? [])].map(
      (el) => el.getAttribute('data-block') ?? el.getAttribute('data-slot') ?? el.getAttribute('data-testid') ?? '',
    );
    const lastBottom = [...(res?.children ?? [])].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0);
    return {
      position: res ? getComputedStyle(res).position : '',
      vh: window.innerHeight,
      barTop: Math.round(bar?.getBoundingClientRect().top ?? window.innerHeight),
      flowBottom: Math.round(lastBottom),
      whyText: (why?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      whyClipped: !!why && why.scrollHeight > why.clientHeight + 2,
      order,
      band: document.querySelectorAll('.lx-band, [data-testid="band-more"]').length,
      sheet: document.querySelectorAll('[role="dialog"]').length,
    };
  });

/** Die gemeinsamen Regeln für die Rückmeldung am Handy. Gibt die Messung zurück. */
async function flowRules(page: Page, label: string): Promise<Flow> {
  const res = page.getByTestId('result');
  await expect(res).toBeVisible();
  const m = await measureFlow(page);
  test.info().annotations.push({ type: 'flow', description: `${label}: Warum ${m.whyText.length} Zeichen, Reihenfolge ${m.order.join(' · ')}` });
  // Im Fluss, kein festes Band, kein Blatt.
  expect(m.position).not.toBe('fixed');
  expect(m.band, 'altes Band oder Mehr-Blatt').toBe(0);
  expect(m.sheet, 'Dialog').toBe(0);
  // Reihenfolge: Urteil · Warum · Merke · Mehr (was jeweils da ist).
  const want = ['verdict', 'why', 'remember', 'more'];
  expect(m.order).toEqual(want.filter((x) => m.order.includes(x)));
  // Die dritte Frage hat ihren Platz: Warum oder Merke steht sichtbar da, nichts ist abgeschnitten.
  expect(
    m.order.some((x) => x === 'why' || x === 'remember'),
    'Warum/Merke',
  ).toBe(true);
  expect(m.whyClipped, 'Warum abgeschnitten').toBe(false);
  // Hilfe ist sichtbar, ohne erst einen Knopf zu suchen (Emrah 02.11.2026): Kern – „Frag Claude dazu“ neben „Weiter“.
  await expect(page.getByTestId('actionbar').getByTestId('claude-ask-about')).toBeVisible();
  // Ganz unten gerollt verschwindet nichts hinter der festen Leiste; dort steht nur „Weiter“. Erneut messen, bis das Einrollen nach dem
  // Prüfen und die Erklärung von Claude fertig sind (beide ändern Lage und Höhe noch kurz).
  await expect
    .poll(
      async () => {
        const n = await measureFlow(page);
        return n.flowBottom - n.barTop;
      },
      { timeout: 5000 },
    )
    .toBeLessThanOrEqual(1);
  await expect(page.getByTestId('actionbar').getByTestId('next')).toBeVisible();
  return m;
}

for (const vh of [844, 700] as const) {
  test.describe(`Handy 390×${vh}`, () => {
    test.use({ viewport: { width: 390, height: vh }, hasTouch: true });

    for (const lang of ['de', 'en'] as const) {
      for (const kind of ['wrong', 'shown', 'near'] as const) {
        test(`Wort ${kind} (${lang}): Rückmeldung im Fluss, Warum ganz da, Frag Claude sichtbar, unten nur Weiter`, async ({ page }) => {
          const { errors } = await word(page, kind, lang);
          const res = page.getByTestId('result');
          // Gleich nach dem Prüfen stehen Urteil und Lösung im Bild, unter der Übungsleiste.
          await expect(res.locator('[data-slot="verdict"]')).toBeInViewport();
          // Die Lösung steht in der Lücke bzw. im Vergleich (UX-Neuanfang D), nicht in einer eigenen Bandzeile.
          if (kind !== 'near') await expect(page.getByTestId('exercise')).toContainText(expected('cloze', 'overcome', null, 'vocab', lang));
          // Kern: „Wieder in …“ steht unter der Karte.
          await expect(page.getByTestId('next-in')).toBeVisible();
          await flowRules(page, `390×${vh} Wort ${kind} ${lang}`);
          if (vh === 844) expect(await layoutProblems(page), 'Layout').toEqual([]);
          expect(errors, 'Fehler').toEqual([]);
        });
      }
    }

    for (const choice of ['has signed off', 'will sign off'] as const) {
      test(`längste C1-Rückmeldung (err-0039, ${choice}): Regeln im Fluss`, async ({ page }) => {
        const { errors } = await longest(page, choice);
        await flowRules(page, `390×${vh} err-0039 ${choice}`);
        expect(errors, 'Fehler').toEqual([]);
      });
    }
  });
}

test.describe('Handy 390×700: längstes Warum (Grammatik, 259 Zeichen)', () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

  test('das Warum steht ganz da; „Mehr“ klappt an Ort und Stelle auf, kein Blatt', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { fake: { patch: { 'grammar/past-perfect': topicDoc('past-perfect', [PP_ERR]) } } });
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const choice = item.getByTestId('choice').filter({ hasText: 'had handled' });
    if (await choice.count()) await choice.first().click();
    else await typeInGap(page, 'had handled');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('result')).toBeVisible();
    await page.waitForTimeout(400);
    await flowRules(page, '390×700 Grammatik past-perfect');
    // Hinweis: Für diese Aufgabe gewinnt die kuratierte Muster-Begründung (Tutor-Engine) über den 259-Zeichen-Text der Bank.
    const res = page.getByTestId('result');
    const more = res.getByTestId('explanation-more');
    if (await more.count()) {
      await more.click();
      await expect(more).toHaveAttribute('aria-expanded', 'true');
      await expect(res.getByTestId('more-body')).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Handy 390×844: Verhalten', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('nach dem Prüfen: Urteil im Bild unter der Leiste; Esc klappt „Mehr“ zu, die Rückmeldung bleibt', async ({ page }) => {
    await longest(page, 'will sign off');
    const res = page.getByTestId('result');
    const pos = await page.evaluate(() => ({
      verdict: document.querySelector('[data-testid="result"] [data-slot="verdict"]')?.getBoundingClientRect().top ?? -1,
      bar: document.querySelector('[data-testid="exercise-bar"]')?.getBoundingClientRect().bottom ?? 0,
    }));
    expect(pos.verdict).toBeGreaterThanOrEqual(pos.bar - 1);
    // Die Rückmeldung verschwindet nicht von selbst.
    await page.waitForTimeout(3000);
    await expect(res).toBeVisible();
    const more = res.getByTestId('explanation-more');
    if (await more.count()) {
      await more.click();
      await expect(res.getByTestId('more-body')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(more).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await expect(res).toBeVisible();
  });

  test('„Frag Claude dazu“ öffnet den Begleiter zur Aufgabe', async ({ page }) => {
    await word(page, 'wrong', 'de');
    await page.getByTestId('claude-ask-about').click();
    await expect(page.getByTestId('companion')).toBeVisible();
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

  // G2 Nora M2 (Kap. 2 Nr. 4, §6.4): das Warum steht auch bei richtiger Antwort – nicht nur ein Merke-Satz.
  test('richtig: das Warum steht da (Form des Kartenworts)', async ({ page }) => {
    const { errors } = await word(page, 'right', 'de');
    const why = page.getByTestId('result').locator('[data-block="why"]');
    await expect(why.getByTestId('word-form-why')).toBeVisible();
    await expect(why.getByTestId('word-form-why')).toContainText('overcome');
    expect(errors).toEqual([]);
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

// Laptop (Feinzeiger): Vollbild ohne Navigationsleiste. Kern: EINE Rückmeldekarte – Urteilsstreifen oben, darunter links Lösung und
// Warum, rechts (falls vorhanden) Regel bzw. Wortkarte; „Frag Claude dazu“ und „Weiter“ unten. Vor dem Prüfen steht „Frag Claude“ oben.
for (const width of [1024, 1440] as const) {
  const h = width === 1024 ? 768 : 900;
  test.describe(`Laptop ${width}×${h}`, () => {
    test.use({ viewport: { width, height: h }, hasTouch: false });

    test('Vollbild ohne Leiste; Erklärung in der Karte, „Mehr“ an Ort und Stelle, ⓘ ohne Dialog, Urteil im Bild', async ({ page }) => {
      const { errors } = await longest(page, 'will sign off');
      await expect(page.getByTestId('tabbar')).toHaveCount(0);
      const res = page.getByTestId('result');
      await expect(res.locator('[data-block="why"], [data-block="remember"]').first()).toBeVisible();
      await expect(page.locator('[data-col="side"]')).toHaveCount(0);
      await expect(page.getByTestId('claude-ask-about')).toBeVisible();
      await expect(page.getByTestId('next')).toBeVisible();
      const more = res.getByTestId('explanation-more');
      if (await more.count()) {
        await more.click();
        await expect(more).toHaveAttribute('aria-expanded', 'true');
        await expect(res.getByTestId('more-body')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(more).toHaveAttribute('aria-expanded', 'false');
      }
      await expect(res.locator('[data-slot="verdict"]')).toBeInViewport();
      const pos = await page.evaluate(() => ({
        verdict: document.querySelector('[data-testid="result"] [data-slot="verdict"]')?.getBoundingClientRect().top ?? -1,
        bar: document.querySelector('[data-testid="exercise-bar"]')?.getBoundingClientRect().bottom ?? 0,
      }));
      expect(pos.verdict).toBeGreaterThanOrEqual(pos.bar);
      await expect(page.getByRole('dialog')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('vor dem Prüfen: „Frag Claude“ steht oben in der Übungsleiste', async ({ page }) => {
      await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
      await screen(page, 'today');
      await page.getByTestId('start').click();
      await screen(page, 'trainer');
      await expect(page.getByTestId('tabbar')).toHaveCount(0);
      await expect(page.getByTestId('exercise-bar').locator('.lx-kask')).toBeVisible();
    });

    test('Begleiter aus „Frag Claude dazu“: die Erklärung bleibt sichtbar', async ({ page }) => {
      const { errors } = await longest(page, 'will sign off');
      await page.getByTestId('claude-ask-about').click();
      await expect(page.getByTestId('companion')).toBeVisible();
      await expect(page.getByTestId('result').locator('[data-block="why"], [data-block="remember"]').first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  });
}

// Tablet quer mit Touch: wie am Handy – die Rückmeldung im Fluss, „Mehr“ klappt an Ort und Stelle auf, keine Kontextspalte, kein Blatt.
test.describe('Tablet quer 1024 mit Touch', () => {
  test.use({ viewport: { width: 1024, height: 768 }, hasTouch: true });

  test('Rückmeldung im Fluss; „Mehr“ klappt auf, ohne Spalte und ohne Blatt', async ({ page }) => {
    const { errors } = await longest(page, 'will sign off');
    const res = page.getByTestId('result');
    await expect(res).toBeVisible();
    await expect(res.locator('[data-block="why"], [data-block="remember"]').first()).toBeVisible();
    const more = res.getByTestId('explanation-more');
    if (await more.count()) {
      await more.click();
      await expect(res.getByTestId('more-body')).toBeVisible();
    }
    await expect(page.getByTestId('context-more')).toHaveCount(0);
    await expect(page.getByTestId('band-more')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
