import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem, typeInGap } from './learnHelpers';

// ocl (Kleines Wort) und mcc (Passendes Wort), P20: Eingabe, Hinweisleiter, Begründung je Option, Buchung und Wortkarten-Brücke.
// Die Aufgaben kommen über einen Fehlersatz mit `cid` (wie bei kwt/err); ihre Inhalte stammen aus den Inhaltsdateien, nie aus der Oberfläche.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

type Mcc = { id: string; kind: 'mcc'; text: string; options: string[]; answer: number; pat: string; topic?: string; lex?: string[] };
type Ocl = { id: string; kind: 'ocl'; text: string; accept: string[]; pat: string; topic: string };
function itemOf<T extends Mcc | Ocl>(kind: T['kind'], id: string): T {
  const dir = new URL(`../../src/content/c1x/src/${kind}/`, import.meta.url);
  for (const f of readdirSync(dir)) {
    const doc = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: Array<Mcc | Ocl> };
    const hit = doc.items.find((i) => i.id === id);
    if (hit) return hit as T;
  }
  throw new Error(`Aufgabe ${id} nicht gefunden`);
}

const errorOf = (it: Mcc | Ocl, ans: string): Doc => ({ q: it.text, given: '', ans, t: OLD, due: OLD, box: 0, src: 'seed', cid: it.id, pat: it.pat, pts: [0, 1] });
const topicDoc = (topic: string, errors: Doc[]): Doc => ({ id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors });

async function start(page: Page, it: Mcc | Ocl, extra: Record<string, Doc> = {}) {
  const topic = it.topic ?? 'passive-plus';
  const ans = it.kind === 'mcc' ? (it.options[it.answer] ?? '') : (it.accept[0] ?? '');
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'mcc,ocl' }, fake: { patch: { [`grammar/${topic}`]: topicDoc(topic, [errorOf(it, ans)]), ...extra } } });
}
const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');
const entryOf = async (page: Page, cid: string): Promise<Doc> => {
  await expect.poll(async () => (await logOf(page)).some((e) => e.cid === cid), { timeout: 25_000 }).toBe(true);
  return (await logOf(page)).find((e) => e.cid === cid) as Doc;
};

const MCC = itemOf<Mcc>('mcc', 'mcc-0049');
const WRONG = MCC.options.findIndex((_, i) => i !== MCC.answer);
const OCL = itemOf<Ocl>('ocl', 'ocl-0007');

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('mcc: vier Karten, Prüfen erst nach der Wahl; falsche Wahl zeigt alle Begründungen mit Kategorie; Buchung ist kein freier Abruf', async ({ page }) => {
    const { errors } = await start(page, MCC);
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'mcc');
    await expect(item.getByTestId('choice')).toHaveCount(4);
    await expect(page.getByTestId('check')).toBeDisabled();
    // Die Lösung steht vor dem Prüfen nicht im Satz (die Lücke ist leer).
    await expect(item.getByTestId('gap')).toHaveAttribute('data-state', 'input');
    await item.getByTestId('choice').nth(WRONG).click();
    await expect(item.getByTestId('gap')).toContainText(MCC.options[WRONG] ?? '');
    await expect(page.getByTestId('check')).toBeEnabled();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(item.getByTestId('gap')).toHaveAttribute('data-state', 'reveal');
    // UX-Prüfung B1 (07.10.2026): „Warum nicht …?“ steht unter „Mehr“ und nennt nur die ANDEREN Optionen (die eigene Wahl erklärt „Deine Antwort“).
    await item.locator('[data-testid="examples-more"], [data-testid="explanation-more"]').first().click();
    const why = item.getByTestId('why-list');
    await expect(why.locator('li')).toHaveCount(2);
    await expect(why).toContainText('Deutsch gedacht');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    await nextItem(page);
    const e = await entryOf(page, MCC.id);
    expect(e).toMatchObject({ ok: false, pts: [0, 1], c1k: 'mcc', cid: MCC.id, dev: 't' });
    expect(e.free).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test('mcc: Hinweis 2 graut genau eine falsche Option aus; sie lässt sich nicht wählen, die Lösung bleibt frei', async ({ page }) => {
    const { errors } = await start(page, MCC);
    const item = page.getByTestId('gr-item');
    await page.getByTestId('hint').click();
    await page.getByTestId('hint').click();
    const dim = item.locator('[data-testid="choice"][data-state="dim"]');
    await expect(dim).toHaveCount(1);
    await expect(dim).toBeDisabled();
    await expect(item.getByTestId('choice').nth(MCC.answer)).toBeEnabled();
    await expect(item.getByTestId('choice').nth(MCC.answer)).not.toHaveAttribute('data-state', 'dim');
    expect(errors).toEqual([]);
  });

  test('ocl: Hinweis 1 nennt die Wortklasse, Hinweis 2 zeigt Platzhalter mit dem ersten Buchstaben; die Lösung steht nicht im DOM', async ({ page }) => {
    const { errors } = await start(page, OCL);
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'ocl');
    await expect(page.getByTestId('check')).toBeDisabled();
    expect((await page.locator('main').innerText()).toLowerCase()).not.toContain(`when ${OCL.accept[0]} the client`);
    await page.getByTestId('hint').click();
    await expect(item.getByTestId('hint-line')).toContainText('Hilfsverb');
    await page.getByTestId('hint').click();
    const slots = item.locator('[data-testid="gap"] [data-slot]');
    await expect(slots).toHaveCount((OCL.accept[0] ?? '').length);
    await expect(item.locator('[data-testid="gap"] .lx-slot-hint')).toHaveText((OCL.accept[0] ?? '').charAt(0));
    expect(errors).toEqual([]);
  });

  test('ocl: richtig getippt → 1 von 1, freier Abruf, Buchung mit pts und free', async ({ page }) => {
    const { errors } = await start(page, OCL);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, OCL.accept[0] ?? '');
    await expect(page.getByTestId('check')).toBeEnabled();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    const e = await entryOf(page, OCL.id);
    expect(e).toMatchObject({ ok: true, pts: [1, 1], c1k: 'ocl', cid: OCL.id, free: true, dev: 't' });
    expect(errors).toEqual([]);
  });

  test('mcc im Wortschatz: bucht genau eine Wiederholung auf die vorhandene Karte (nicht fällig, Auswahl, nie „Leicht“) und einen Verlaufseintrag in out/<Monat>', async ({ page }) => {
    const lex = itemOf<Mcc>('mcc', 'mcc-0091');
    expect(lex.lex).toEqual(['possibly']);
    const base = SEED['vocab/deserve'] as Doc;
    const card: Doc = { ...base, id: 'possibly', word: 'possibly', de: 'möglicherweise', ex: 'We could [possibly] move it.', col: [] };
    const hist0 = (card.hist as unknown[]).length;
    const { errors } = await start(page, lex, { 'vocab/possibly': card });
    const item = page.getByTestId('gr-item');
    await expect(item).toHaveAttribute('data-c1x', 'mcc');
    await item.getByTestId('choice').nth(lex.answer).click();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    await expect.poll(async () => ((await dump(page))['vocab/possibly']?.hist as unknown[] | undefined)?.length ?? 0, { timeout: 25_000 }).toBe(hist0 + 1);
    const hist = ((await dump(page))['vocab/possibly']?.hist as Doc[]) ?? [];
    const last = hist[hist.length - 1] as Doc;
    expect(last.g).toBeLessThanOrEqual(3);
    // Die Auswahl ersetzt den freien Abruf nicht: höchstens „Gut“, Wiederholung nur einmal.
    await expect.poll(async () => (((await dump(page))['out/2026-09']?.items as Doc[] | undefined) ?? []).filter((i) => i.k === 'mcc').length, { timeout: 25_000 }).toBe(1);
    const out = (((await dump(page))['out/2026-09'] as Doc).items as Doc[]).find((i) => i.k === 'mcc') as Doc;
    expect(out).toMatchObject({ k: 'mcc', ok: true, text: 'possibly' });
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('mcc: Tasten 1–4 wählen, Enter prüft, Enter geht weiter', async ({ page }) => {
    const { errors } = await start(page, MCC);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('choice')).toHaveCount(4);
    await page.keyboard.press(String(MCC.answer + 1));
    await expect(item.getByTestId('gap')).toContainText(MCC.options[MCC.answer] ?? '');
    await page.keyboard.press('Enter');
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    // Richtig: trotzdem „Warum nicht …?“ der anderen Optionen (Kap. 2 Nr. 4), seit der UX-Prüfung W2 unter „Mehr“.
    await item.locator('[data-testid="examples-more"], [data-testid="explanation-more"]').first().click();
    await expect(item.getByTestId('why-list').locator('li')).toHaveCount(3);
    // Der Tipp auf „Mehr“ hat den Fokus genommen; Enter soll wieder „Weiter“ bedeuten.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Enter');
    const e = await entryOf(page, MCC.id);
    expect(e).toMatchObject({ ok: true, pts: [1, 1], c1k: 'mcc', dev: 'k' });
    expect(e.free).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test('ocl: erst ein Hinweis nach falscher Eingabe (Eingabe bleibt), dann der zweite Versuch', async ({ page }) => {
    const { errors } = await start(page, OCL);
    const item = page.getByTestId('gr-item');
    await typeInGap(page, 'has');
    await page.getByTestId('check').click();
    await expect(item.getByTestId('hint-line')).toBeVisible();
    await expect(item.getByTestId('verdict')).toHaveCount(0);
    await page.getByTestId('gap-input').focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
    await page.keyboard.type(OCL.accept[0] ?? '', { delay: 10 });
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    expect(errors).toEqual([]);
  });
});
