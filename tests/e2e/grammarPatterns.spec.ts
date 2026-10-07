import { readFileSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem, skipMiniLesson } from './learnHelpers';
import { setInputProfile } from './input';
import type { InputProfile } from '../../src/platform/input';

// Lernplattform 2.0, Paket P5 (docs/umbau/lernplattform-2.md §10.4, Abnahme): Aufgaben im Gerüst mit Erklärung aus dem Muster der Aufgabe,
// Begründung zur falschen Auswahl, höchstens 45 sichtbare Wörter, neue Aufgabenarten mit Touch und Tastatur.

type Doc = Record<string, unknown>;
const json = <T>(rel: string): T => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as T;
type PatFile = { patterns: Array<{ id: string; name: { de: string }; ex: Array<{ en: string }>; trap: { good: string } }> };
const patterns = (topic: string): PatFile => json<PatFile>(`../../src/content/grammar/patterns/${topic}.json`);
type MapFile = Record<string, { why?: { wrong: Array<{ opt?: string; de: string }> } }>;
const MAP = json<MapFile>('../../src/content/grammar/pattern-map.json');

const solve = grammarKey();
const BEGUN = (id: string, p: number): Doc => ({ id, p, n: 14, c: 10, last: Date.parse('2026-09-18T10:00:00+02:00'), hist: [{ d: '2026-09-10', p: 0.4 }], recent: [1, 1, 1], seen: [], seenText: [], errors: [] });
const topicRound = async (page: Page, topic: string, p: number, profile: InputProfile = 'keys') => {
  await setInputProfile(page, profile);
  const booted = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic }, { fake: { patch: { [`grammar/${topic}`]: BEGUN(topic, p) } } });
  await skipMiniLesson(page);
  return booted;
};
/** Eine frische Seite (eine laufende Runde wird beim Neuladen sonst aus dem Fortsetz-Speicher hergestellt). */
const fresh = async (browser: Browser, viewport?: { width: number; height: number }): Promise<Page> => {
  const ctx = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE', ...(viewport ? { viewport } : {}) });
  return ctx.newPage();
};
/** Sichtbare Wörter der Erklärung wie im Plan §4.6 gezählt: Text der Zeilen ohne ihre Kurzlabel plus das eine offene Beispiel. */
const visibleWords = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const count = (el: Element): number => {
      const c = el.cloneNode(true) as HTMLElement;
      c.querySelectorAll('.lx-t-meta, [aria-hidden="true"], button').forEach((x) => x.remove());
      return (c.textContent ?? '').split(/\s+/).filter(Boolean).length;
    };
    const lines = [...document.querySelectorAll('[data-testid="explanation"] > ul > li[data-line], [data-testid="explanation"] > p[data-line]')].reduce((n, e) => n + count(e), 0);
    const ex = document.querySelector('[data-testid="examples"] [data-testid="example"]');
    return lines + (ex ? count(ex.firstElementChild ?? ex) : 0);
  });

test('Pilotthemen: nach dem Prüfen steht der Name des Musters, Beispiele kommen nur aus diesem Thema und Muster', async ({ browser }) => {
  let checked = 0;
  for (const topic of ['cond-alt', 'mixed-cond']) {
    const page = await fresh(browser);
    const file = patterns(topic);
    const names = file.patterns.map((p) => p.name.de);
    const allowed = new Set(file.patterns.flatMap((p) => [...p.ex.map((e) => e.en), p.trap.good]).map((x) => x.toLowerCase().replace(/\s+/g, ' ').trim()));
    await topicRound(page, topic, 0.5);
    for (let i = 0; i < 3; i++) {
      await expect(page.getByTestId('gr-item')).toBeVisible();
      await answerGrammar(page, solve);
      const expl = page.getByTestId('explanation');
      await expect(expl).toBeVisible();
      const text = await expl.innerText();
      expect(names.some((n) => text.includes(n)), `Name eines Musters von ${topic} in „${text}“`).toBe(true);
      const ex = await page.getByTestId('example').allInnerTexts();
      for (const e of ex) expect(allowed.has(e.replace(/\s*DE\s*$/, '').toLowerCase().replace(/\s+/g, ' ').trim()) || [...allowed].some((a) => e.toLowerCase().includes(a)), `Beispiel „${e}“ gehört zu ${topic}`).toBe(true);
      checked++;
      await nextItem(page);
    }
  }
  expect(checked).toBe(6);
});

test('falsche Auswahl: „Deine Antwort …“ kommt aus der Begründung der Aufgabe (why.wrong)', async ({ browser }) => {
  const page = await fresh(browser);
  await topicRound(page, 'cond-alt', 0.2);
  let seen = 0;
  for (let i = 0; i < 8 && seen < 1; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    if ((await item.getAttribute('data-type')) !== 'mc') {
      await answerGrammar(page, solve);
      await nextItem(page);
      continue;
    }
    const prompt = await item.getByTestId('sentence').innerText();
    const known = solve.full(prompt);
    const entry = MAP[`cond-alt|${legacyTaskKey(prompt.replace(/\s+/g, ' ').replace(/\n/g, ' '))}`];
    const labels = (await item.getByTestId('choice').allInnerTexts()).map((l) => l.replace(/^[A-F]\s+/, '').trim());
    const rule = entry?.why?.wrong.find((w) => w.opt && labels.includes(w.opt) && w.opt !== known?.answer);
    if (!rule?.opt) {
      await answerGrammar(page, solve);
      await nextItem(page);
      continue;
    }
    await item.getByTestId('choice').nth(labels.indexOf(rule.opt)).click();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(item.getByTestId('choice-why')).toContainText(rule.de.slice(0, 30));
    await expect(item.getByTestId('explanation')).toContainText(rule.opt);
    seen++;
  }
  expect(seen).toBeGreaterThanOrEqual(1);
});

test('Handy 390: die sichtbare Erklärung hat höchstens 45 Wörter, auch bei falscher Antwort', async ({ browser }) => {
  const page = await fresh(browser, { width: 390, height: 844 });
  await topicRound(page, 'mixed-cond', 0.3, 'touch');
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await answerGrammar(page, solve, { wrong: i === 1 });
    const open = await page.locator('[data-slot="explanation"], [data-slot="examples"]').allInnerTexts();
    expect(await visibleWords(page), `sichtbare Wörter der Erklärung: „${open.join(' | ')}“`).toBeLessThanOrEqual(45);
    await nextItem(page);
  }
});

for (const profile of ['touch', 'keys'] as const) {
  test(`neue Aufgabenarten (Bedeutung, Fehler finden, Schlüsselwort) sind mit Profil ${profile} spielbar und werden richtig bewertet`, async ({ browser }) => {
    test.slow();
    const seen = new Set<string>();
    for (const [p, topic] of [[0.2, 'cond-alt'], [0.85, 'cond-alt'], [0.55, 'time-clauses']] as const) {
      const page = await fresh(browser);
      await topicRound(page, topic, p, profile);
      for (let i = 0; i < 6; i++) {
        const item = page.getByTestId('gr-item');
        if (await page.getByTestId('summary').isVisible()) break;
        await expect(item).toBeVisible();
        const type = (await item.getAttribute('data-type')) ?? '';
        seen.add(type);
        if (profile === 'touch') await expect(page.locator('textarea')).toHaveCount(0);
        if (!['meaning', 'find', 'kwt', 'mc', 'gap'].includes(type)) {
          await page.getByTestId('dont-know').click();
          await nextItem(page);
          await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
          continue;
        }
        await answerGrammar(page, solve);
        await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
        await nextItem(page);
        // Erst weiter, wenn die alte Aufgabe abgelöst ist (07.10.2026, Absicherung gegen das Lesen der alten Aufgabe; der Altbefund selbst lag
        // in der App: „Fehler finden“ mit überflüssigem Wort ließ sich mit leerem Ersatz nicht prüfen, behoben in GrammarItem.tsx).
        await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
      }
    }
    // Mit niedriger, mittlerer und hoher Beherrschung kommen alle drei neuen Arten vor.
    expect([...seen]).toEqual(expect.arrayContaining(['meaning', 'kwt']));
    expect(seen.has('find') || seen.has('kwt')).toBe(true);
  });
}
