import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Flüssigkeit 90 – 60 – 45 und „Mein nächster Termin“ (Lernberatung 27.09., V6/V4):
// - Flüssigkeit: drei Runden (90/60/45 s) mit Zeitbalken, Spracheingabe (wenn verfügbar), bei 0
//   gesperrt ohne Textverlust, Kennzahlen ohne KI, fluency-check@1 → fehlende Wendungen „Merken“,
//   Korrekturen → `app/repair` (Quelle `fluency`), `fluency/<Monat>`, Log und `act.fluency`.
// - Termin: Eingabe → meeting-prep@1 → Wendungen („Alle merken“), Einwände, Generalprobe im
//   Rollenspiel; „Meine Termine“ → Nachbesprechung (meeting-debrief@1) → Wendungen sofort.
// - Ohne Spracheingabe bzw. ohne Claude: tippen, Kennzahlen, Speichern ohne Vorbereitung.
// Die Einstiege unter „Sprechen“ setzt der Navigations-Umbau; hier springt der Test-Einstieg
// `__LINGO_GO__` (nur mit eingespieltem Entwicklungs-Adapter) direkt hin.

type Doc = Record<string, unknown>;
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

/** Monotone Uhr vorspulen (der Zeitbalken folgt `performance.now`, `Date` ist in Tests angehalten). */
async function installSkip(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const orig = performance.now.bind(performance);
    let off = 0;
    performance.now = () => orig() + off;
    (window as unknown as { __lxSkip: (ms: number) => void }).__lxSkip = (ms: number) => {
      off += ms;
    };
  });
}
const skip = (page: Page, ms: number) => page.evaluate((m) => (window as unknown as { __lxSkip: (ms: number) => void }).__lxSkip(m), ms);
const open = async (page: Page, name: 'fluency' | 'meeting') => {
  await screen(page, 'today');
  await page.waitForFunction(() => typeof (window as unknown as { __LINGO_GO__?: unknown }).__LINGO_GO__ === 'function');
  await page.evaluate((n) => (window as unknown as { __LINGO_GO__: (n: string) => void }).__LINGO_GO__(n), name);
  await expect(page.getByTestId(name)).toBeVisible();
};
const sttSay = (page: Page, text: string) => page.evaluate((t) => (window as unknown as { __LINGO_FAKE__: { sttSay(t: string): void } }).__LINGO_FAKE__.sttSay(t), text);
const items = (d: Record<string, Doc>, path: string): Doc[] => ((d[path]?.items as Doc[] | undefined) ?? []);
const axeOk = async (page: Page, sel: string) => {
  const axe = await new AxeBuilder({ page }).include(sel).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
};

const ROUND1 = 'The cloud is more cheaper than your server room. We are doing this since ten years and the most companies save money.';

test('Flüssigkeit (Handy, DE, Spracheingabe, Claude): drei Runden, Zeit um ohne Textverlust, Rückmeldung, Wendung, Reparatur-Sätze', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  await installSkip(page);
  const { errors, external } = await boot(page, { migrated: true, lang: 'de', fake: { stt: 'ok' } });
  await open(page, 'fluency');
  const fl = page.getByTestId('fluency');
  await expect(fl).toHaveAttribute('data-phase', 'ready');
  await expect(page.getByTestId('fluency-status')).toContainText('Runde 1 von 3 · 90 s');
  await expect(page.getByTestId('task')).toHaveText('Beantworte die Frage frei auf Englisch – gesprochen oder getippt.');
  await expect(page.getByTestId('purpose')).toHaveCount(0);
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('purpose')).toBeVisible();
  // Frage antippbar (englische Wörter), andere Frage möglich.
  const q1 = await page.getByTestId('fluency-question').getAttribute('data-q');
  await page.getByTestId('fluency-other').click();
  await expect(page.getByTestId('fluency-question')).not.toHaveAttribute('data-q', q1 ?? '');
  await page.getByTestId('fluency-question').locator('button.lx-word').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await layoutProblems(page)).toEqual([]);

  // Runde 1: sprechen (jede Pause wird ein Satz), dann tippen, dann läuft die Zeit ab.
  await page.getByTestId('fluency-start').click();
  await expect(fl).toHaveAttribute('data-phase', 'run');
  await expect(page.getByTestId('fluency-timer')).toBeVisible();
  await expect(page.getByTestId('fluency-draft')).toBeFocused();
  await page.getByTestId('mic').click();
  await sttSay(page, 'the cloud is more cheaper than your server room');
  await expect(page.getByTestId('fluency-draft')).toHaveValue('The cloud is more cheaper than your server room.');
  await page.getByTestId('fluency-draft').fill(ROUND1);
  await page.screenshot({ path: 'test-results/screens/fluency-run-390.png', fullPage: true });
  await skip(page, 91_000);
  await expect(page.getByTestId('fluency-timer')).toHaveAttribute('data-over', '');
  await expect(page.getByTestId('fluency-timeup')).toBeVisible();
  await expect(page.getByTestId('fluency-draft')).toBeDisabled();
  await expect(page.getByTestId('fluency-draft')).toHaveValue(ROUND1);
  await page.getByTestId('fluency-next').click();

  // Runde 2 (60 s) und 3 (45 s): dieselbe Antwort kürzer, vorzeitig beendet.
  await expect(page.getByTestId('fluency-status')).toContainText('Runde 2 von 3 · 60 s');
  await expect(page.getByTestId('task')).toHaveText('Dieselbe Antwort noch einmal – jetzt in 60 Sekunden.');
  await expect(page.getByTestId('fluency-last')).toContainText('Runde 1: 22 Wörter');
  await page.getByTestId('fluency-start').click();
  await page.getByTestId('fluency-draft').fill('The cloud is cheaper. We have done this for ten years.');
  await page.getByTestId('fluency-end').click();
  await expect(page.getByTestId('fluency-status')).toContainText('Runde 3 von 3 · 45 s');
  await page.getByTestId('fluency-start').click();
  await page.getByTestId('fluency-draft').fill('Cheaper, safer, and we know how.');
  await page.getByTestId('fluency-end').click();

  // Ergebnis: ruhige Kennzahlen, Rückmeldung, fehlende Wendungen, Korrekturen.
  await expect(fl).toHaveAttribute('data-phase', 'result');
  await expect(page.getByTestId('fluency-stat')).toHaveCount(3);
  await expect(page.getByTestId('fluency-stat').first()).toHaveAttribute('data-words', '22');
  await expect(page.getByTestId('fluency-progress')).toContainText('Runde 3');
  await expect(page.getByTestId('fluency-phrase')).toHaveCount(2);
  await expect(page.getByTestId('fluency-correction')).toHaveCount(3);
  await expect(page.getByTestId('fluency-repairs')).toHaveAttribute('data-n', '3');
  await page.getByTestId('fluency-phrase').first().getByTestId('take-chunk').locator('button').click();
  await expect(page.getByTestId('fluency-phrase').first().getByTestId('take-chunk')).toHaveAttribute('data-state', 'taken');
  expect(await layoutProblems(page)).toEqual([]);
  await axeOk(page, '[data-testid="fluency"]');
  await page.screenshot({ path: 'test-results/screens/fluency-result-390.png', fullPage: true });

  const d = await dump(page);
  const f = items(d, 'fluency/2026-09');
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ kind: expect.any(String), ai: true, lang: 'de' });
  expect((f[0]?.rounds as Doc[]).map((r) => r.sec)).toEqual([90, 60, 45]);
  expect((f[0]?.rounds as Doc[])[0]?.text).toBe(ROUND1);
  expect((f[0]?.fb as Doc | null)?.progress).toBeTruthy();
  const rep = items(d, 'app/repair').filter((r) => r.src === 'fluency');
  expect(rep.map((r) => r.wrong)).toContain('The cloud is more cheaper than your server room.');
  expect(d['chunk/c-the-bottom-line-is']).toMatchObject({ en: 'the bottom line is', origin: { kind: 'fluency' } });
  const log = (d['log/2026-09-20']?.entries as Doc[] | undefined) ?? [];
  expect(log.some((e) => e.type === 'fluency' && e.n === 3)).toBe(true);
  expect(((d['app/profile']?.act as Record<string, Doc>)['2026-09-20'] ?? {}).fluency).toBe(1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Flüssigkeit (Desktop, EN, ohne Spracheingabe, ohne Claude): tippen, Kennzahlen, gespeichert', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { errors, external } = await boot(page, { migrated: true, lang: 'en', fake: { stt: 'absent', capabilities: { sample: false } } });
  await open(page, 'fluency');
  await expect(page.getByTestId('fluency-status')).toContainText('Round 1 of 3 · 90 s');
  for (const [i, text] of ['We move the archive to the cloud because it is safer and cheaper. Backups run every night.', 'It is safer and cheaper. Backups run every night.', 'Safer, cheaper, nightly backups.'].entries()) {
    await page.getByTestId('fluency-start').click();
    await expect(page.getByTestId('mic')).toHaveCount(0);
    await page.getByTestId('fluency-draft').fill(text);
    await page.getByTestId('fluency-end').click();
    if (i < 2) await expect(page.getByTestId('fluency')).toHaveAttribute('data-round', String(i + 2));
  }
  await expect(page.getByTestId('fluency')).toHaveAttribute('data-phase', 'result');
  await expect(page.getByTestId('fluency-noai')).toBeVisible();
  await expect(page.getByTestId('fluency-feedback')).toHaveCount(0);
  await expect(page.getByTestId('fluency-stat').first()).toHaveAttribute('data-full', '2');
  expect(await layoutProblems(page)).toEqual([]);
  await axeOk(page, '[data-testid="fluency"]');
  await page.screenshot({ path: 'test-results/screens/fluency-result-noai-1280.png', fullPage: true });
  const f = items(await dump(page), 'fluency/2026-09');
  expect(f).toHaveLength(1);
  expect(f[0]).toMatchObject({ ai: false, fb: null, lang: 'en' });
  await page.getByTestId('fluency-back').click();
  await screen(page, 'speak');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Termin (Handy, DE, Claude): Vorbereitung, alle Wendungen merken, Generalprobe, Nachbesprechung über „Meine Termine“', async ({ page }) => {
  await page.setViewportSize(MOBILE);
  const { errors, external } = await boot(page, { migrated: true, lang: 'de' });
  await open(page, 'meeting');
  // Keine Termine → gleich die Eingabe.
  await expect(page.getByTestId('meeting')).toHaveAttribute('data-view', 'form');
  await expect(page.getByTestId('task')).toHaveText('Beschreib deinen nächsten Termin in zwei Minuten.');
  await page.getByTestId('meeting-create').click();
  await expect(page.getByTestId('meeting-required')).toBeVisible();
  await page.getByTestId('meeting-who').fill('Partner in UK');
  await page.getByTestId('meeting-topic').fill('Er will Rabatt, ich will Laufzeit');
  await page.getByTestId('meeting-tricky').fill('Wettbewerber ist 15 % billiger');
  await page.getByTestId('meeting-notes').fill('Videocall am Donnerstag, 30 Minuten');
  expect(await layoutProblems(page)).toEqual([]);
  await axeOk(page, '[data-testid="meeting"]');
  await page.getByTestId('meeting-create').click();

  const detail = page.getByTestId('meeting-detail');
  await expect(detail).toBeVisible();
  await expect(page.getByTestId('meeting-phrase')).toHaveCount(7);
  await expect(page.getByTestId('meeting-objection')).toHaveCount(3);
  await page.getByTestId('meeting-phrase').first().locator('button.lx-word').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByTestId('meeting-take-all').click();
  await expect(page.getByTestId('meeting-take-all-done')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  await axeOk(page, '[data-testid="meeting"]');
  await page.screenshot({ path: 'test-results/screens/meeting-prep-390.png', fullPage: true });

  let d = await dump(page);
  const m = items(d, 'meeting/2026-09');
  expect(m).toHaveLength(1);
  expect(m[0]).toMatchObject({ who: 'Partner in UK', topic: 'Er will Rabatt, ich will Laufzeit', sceneId: null, lang: 'de' });
  expect(d['chunk/c-meet-you-halfway']).toMatchObject({ en: 'meet you halfway', origin: { kind: 'meeting' }, src: { upgraded: 'I am happy to meet you halfway on the setup fee.' } });

  // Generalprobe: Szene im Format von scene-gen@2, startet im Rollenspiel.
  await page.getByTestId('meeting-rehearsal-start').click();
  await screen(page, 'roleplay');
  await expect(page.getByTestId('roleplay')).not.toHaveAttribute('data-state', 'missing');
  await expect(page.getByTestId('roleplay')).toContainText('Oliver Grant');
  d = await dump(page);
  const sceneId = items(d, 'meeting/2026-09')[0]?.sceneId as string;
  expect(sceneId).toMatch(/^sc-ai/);
  expect(d[`scene/${sceneId}`]).toMatchObject({ src: 'ai', pv: 'meeting-prep@1', meeting: m[0]?.id, persona: { name: 'Oliver Grant' } });

  // Später: „Meine Termine“ → Nachbesprechung.
  await page.evaluate(() => (window as unknown as { __LINGO_GO__: (n: string) => void }).__LINGO_GO__('meeting'));
  await expect(page.getByTestId('meeting')).toHaveAttribute('data-view', 'list');
  await expect(page.getByTestId('meeting-item')).toHaveCount(1);
  await expect(page.getByTestId('meeting-item')).toContainText('Vorbereitet');
  await page.getByTestId('meeting-item').click();
  await page.getByTestId('meeting-debrief-input').fill('Ich wollte sagen, dass Rabatt nur mit längerer Laufzeit geht.\nUnd dass ich mich bis Freitag melde.');
  await page.getByTestId('meeting-debrief-go').click();
  await expect(page.getByTestId('meeting-debrief-item')).toHaveCount(2);
  await expect(page.getByTestId('meeting-debrief-saved')).toHaveAttribute('data-n', '2');
  await expect(page.getByTestId('meeting-debrief-prev')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  await page.screenshot({ path: 'test-results/screens/meeting-debrief-390.png', fullPage: true });
  d = await dump(page);
  expect((items(d, 'meeting/2026-09')[0]?.debrief as Doc[]).map((x) => x.phrase)).toEqual(['in return for', "I'll get back to you"]);
  const back = Object.entries(d).find(([k, v]) => k.startsWith('chunk/') && v.en === "I'll get back to you")?.[1];
  expect(back).toMatchObject({ origin: { kind: 'meeting' }, src: { upgraded: "Let me take this back to my team and I'll get back to you by Friday." } });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Termin (Desktop, EN, ohne Claude): speichern ohne Vorbereitung, Nachbesprechung braucht Claude', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  const { errors, external } = await boot(page, { migrated: true, lang: 'en', fake: { capabilities: { sample: false } } });
  await open(page, 'meeting');
  await expect(page.getByTestId('meeting-noai')).toBeVisible();
  await expect(page.getByTestId('meeting-create')).toHaveCount(0);
  await page.getByTestId('meeting-who').fill('CFO of a logistics company');
  await page.getByTestId('meeting-topic').fill('Renewal of the archive contract');
  await page.getByTestId('meeting-when').fill('2026-10-02');
  await page.getByTestId('meeting-save-only').click();
  await expect(page.getByTestId('meeting-detail')).toBeVisible();
  await expect(page.getByTestId('meeting-phrases')).toHaveCount(0);
  await expect(page.getByTestId('meeting-rehearsal')).toHaveCount(0);
  await expect(page.getByTestId('meeting-debrief-input')).toBeDisabled();
  await expect(page.getByTestId('meeting-debrief-go')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  await axeOk(page, '[data-testid="meeting"]');
  await page.getByTestId('meeting-close').click();
  await expect(page.getByTestId('meeting-item')).toContainText('Not prepared');
  await expect(page.getByTestId('meeting-item')).toContainText('2026-10-02');
  await page.screenshot({ path: 'test-results/screens/meeting-list-noai-1280.png', fullPage: true });
  const m = items(await dump(page), 'meeting/2026-09');
  expect(m[0]).toMatchObject({ who: 'CFO of a logistics company', when: '2026-10-02', prep: null, debrief: [] });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
