import { openTab } from './fixtures';
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// Hilfen für Heute und Trainer: Datenbank-Abzug und die erwartete Lösung je Übung,
// berechnet aus den Testdaten (nicht aus der Oberfläche).

type Doc = Record<string, unknown>;
export type Dump = Record<string, Doc>;

export const dump = (page: Page): Promise<Dump> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

export const writes = (page: Page): Promise<Array<{ op: string; path: string }>> =>
  page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { db: { writes(): Array<{ op: string; path: string }> } } }).__LINGO_FAKE__.db.writes()]);

const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

export const DAY = '2026-09-20';

/** Plan dieser App für den Stichtag mit fester Zielmenge (sonst berechnet die App ihn selbst). */
export const planPatch = (review: number) => ({
  newPerDay: 0,
  plan: { d: DAY, v: 1, ids: [], why: [], duty: review > 0 ? ['review'] : [], goal: { review }, lesson: null, at: 1 },
});

/** Karten, die an erster Stelle fällig sind und deren schwächste Übung feststeht. */
// `struggle` hat keinen Beispielsatz mit dem Wort: `type` („Wort schreiben“) gibt es nur ohne Satz (Lernplattform 2.0 §4.8).
export const FORCED: Record<string, { stage: number; xs: Record<string, { c: number; w: number }>; ex?: string }> = {
  deserve: { stage: 1, xs: { mc_en: { c: 0, w: 6 }, mc_de: { c: 6, w: 0 } } },
  convince: { stage: 2, xs: { mc_de: { c: 0, w: 6 }, cloze_hint: { c: 6, w: 0 }, mc_en: { c: 6, w: 0 } } },
  avoid: { stage: 3, xs: { cloze_hint: { c: 0, w: 6 }, type: { c: 6, w: 0 } } },
  overcome: { stage: 4, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } },
  struggle: { stage: 4, xs: { type: { c: 0, w: 6 }, cloze: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } }, ex: 'No sentence at all.' },
  handle: { stage: 4, xs: { colloc: { c: 0, w: 6 }, type: { c: 6, w: 0 }, cloze: { c: 6, w: 0 } } },
};

/**
 * Standard-Modus „Tippen“ (Anki-Regeln §1: `auto` deckt junge Karten auf). Die Tipp-Leiter mit ihren
 * Abfragearten wird so weiter geprüft; das Aufdecken prüft `anki.spec.ts`.
 */
export const TYPE_MODE: Record<string, Doc> = { 'app/decks': { v: 1, prefs: { mode: 'type', dir: 'de-en', grades: 4 } } };

export function forcedPatch(): Record<string, Doc> {
  const out: Record<string, Doc> = { ...TYPE_MODE };
  Object.entries(FORCED).forEach(([id, f], i) => {
    out[`vocab/${id}`] = { state: 'learning', stage: f.stage, S: 1, D: 5, due: 1_700_000_000_000 + i * 1000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: f.xs, ...(f.ex ? { ex: f.ex } : {}) };
  });
  return out;
}

const bracket = (ex: unknown) => /\[([^\]]+)\]/.exec(typeof ex === 'string' ? ex : '')?.[1]?.trim() ?? '';

/** Wendung ohne „…“ und Satzzeichen am Rand – so wird sie getippt (wie domain/chunks/situation.ts). */
export const typedForm = (en: string): string =>
  en
    .replace(/…|\.\.\./g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,;:.!?]+|[,;:.!?]+$/g, '')
    .trim();

/** Stelle der Wendung in der aufgewerteten Fassung (Testdaten: wörtlich enthalten). */
function chunkGap(d: Doc): string {
  const raw = (d.src as Doc | undefined)?.upgraded;
  const up = typeof raw === 'string' ? raw : '';
  const want = typedForm(String(d.en));
  const i = up.toLowerCase().indexOf(want.toLowerCase());
  return i >= 0 ? up.slice(i, i + want.length) : want;
}

/** Richtige Antwort je Übung – aus den Testdaten. `kind` = data-kind der Übung (vocab | chunk). */
export function expected(ex: string, id: string, col: number | null, kind: string = 'vocab', lang: string = 'de'): string {
  // Bedeutung als Option: Deutsch die erste Übersetzung, Englisch die Erklärung bis zum Semikolon.
  const meaning = (d: Doc) => (lang === 'en' ? (String(d.def).split(';')[0] ?? '') : (String(d.de).split(/[;,]/)[0] ?? '')).trim();
  if (kind === 'chunk') {
    const d = SEED[`chunk/${id}`] ?? {};
    switch (ex) {
      case 'mc_en':
      case 'ctx_mc':
      case 'listen_mc':
        return meaning(d);
      case 'mc_de':
      case 'type':
      case 'situation':
        return typedForm(String(d.en));
      case 'speed':
      case 'cloze':
      case 'cloze_hint':
      case 'match':
      case 'tiles':
      case 'dictation':
        return chunkGap(d);
      case 'produce':
      case 'complete':
        return typedForm(String(d.en));
      default:
        throw new Error(`unbekannte Übung ${ex} (Wendung)`);
    }
  }
  const d = SEED[`vocab/${id}`] ?? {};
  switch (ex) {
    case 'mc_en':
    case 'ctx_mc':
    case 'listen_mc':
      return meaning(d);
    case 'mc_de':
    case 'type':
      return String(d.word);
    case 'cloze':
    case 'cloze_hint':
    case 'match':
    case 'dictation':
    case 'spot':
      return bracket(d.ex);
    case 'speed':
      return bracket(d.ex) || String(d.word);
    case 'tiles':
      return bracket(d.ex) || String(d.word).replace(/^to\s+/i, '');
    case 'produce':
    case 'complete':
      return String(d.word).replace(/^to\s+/i, '');
    case 'colloc':
    case 'colloc_gap':
      {
        const gap = (Array.isArray(d.col) ? (d.col[col ?? 0] as Doc) : {}).gap;
        return typeof gap === 'string' ? gap : '';
      }
    default:
      throw new Error(`unbekannte Übung ${ex}`);
  }
}

/** Setzt die Lösung aus den Bausteinen (Buchstaben bzw. Wörter) per Tippen zusammen. */
export async function placeTiles(page: Page, answer: string, opts: { wrong?: boolean } = {}): Promise<void> {
  const words = /\s/.test(answer);
  const parts = words ? answer.split(/\s+/) : Array.from(answer);
  if (opts.wrong) {
    await page.locator('[data-testid="tile"][data-where="pool"]').first().click();
    return;
  }
  // Lange Wörter kommen als Zweiergruppen.
  const pool = await page.locator('[data-testid="tile"][data-where="pool"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
  const pairs = !words && pool.every((x) => x.length <= 2) && pool.some((x) => x.length === 2);
  const seq = pairs ? answer.match(/.{1,2}/g) ?? [] : parts;
  for (const p of seq) await page.locator(`[data-testid="tile"][data-where="pool"][data-tile="${p.replace(/"/g, '\\"')}"]`).first().click();
}

/** Satz für „Eigener Satz“, den die feste Testantwort als richtig wertet (Großbuchstabe, Punkt, Zielwort). */
export const produceSentence = (target: string): string => `In our team we ${target} every single week.`;

const isTouch = (page: Page): Promise<boolean> => page.evaluate(() => window.matchMedia('(pointer: coarse)').matches);

/** Beantwortet die aktuelle Übung (Tastatur); die App stuft selbst ein, Enter geht weiter. Rückgabe: Übungsart. */
export async function answerCurrent(page: Page, opts: { wrong?: boolean } = {}): Promise<string> {
  const { ex, step } = await answerOnly(page, opts);
  if (await isTouch(page)) await page.getByTestId('next').click();
  else await page.keyboard.press('Enter');
  await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(0);
  return ex;
}

/** Beantwortet die aktuelle Übung bis zum Ergebnis (ohne „Weiter"). */
export async function answerOnly(page: Page, opts: { wrong?: boolean } = {}): Promise<{ ex: string; step: string }> {
  // Erst antworten, wenn genau eine Übung steht (kein Übergang mehr läuft).
  await expect(page.locator('[data-step]')).toHaveCount(1);
  const step = await page.locator('[data-step]').getAttribute('data-step');
  const exEl = page.getByTestId('exercise');
  await expect(exEl).toBeVisible();
  const ex = (await exEl.getAttribute('data-ex')) ?? '';
  const id = (await exEl.getAttribute('data-card')) ?? '';
  const kind = (await exEl.getAttribute('data-kind')) ?? 'vocab';
  const colAttr = await page.locator('[data-col]').first().getAttribute('data-col').catch(() => null);
  const lang = await page.evaluate(() => document.documentElement.lang);
  const answer = expected(ex, id, colAttr === null ? null : Number(colAttr), kind, lang);
  if (['mc_en', 'ctx_mc', 'mc_de', 'colloc_gap', 'listen_mc', 'match'].includes(ex)) {
    const labels = (await page.getByTestId('choice').locator('[lang]').allInnerTexts()).map((l) => l.trim());
    const idx = labels.findIndex((l) => l === answer);
    expect(idx, `${ex} ${id}: „${answer}" in ${labels.join(' | ')}`).toBeGreaterThanOrEqual(0);
    const pick = opts.wrong ? (idx + 1) % labels.length : idx;
    await page.getByTestId('choice').nth(pick).click();
    await page.getByTestId('check').click();
  } else if (ex === 'find_trap') {
    const words = page.getByTestId('spot-word');
    const target = String(SEED[`vocab/${id}`]?.word ?? '').replace(/^to\s+/i, '');
    if (opts.wrong) await words.filter({ hasNotText: new RegExp(`^${target}`, 'i') }).first().click();
    else await words.filter({ hasText: new RegExp(`^${target}`, 'i') }).first().click();
    await page.getByTestId('check').click();
  } else if (ex === 'produce' || ex === 'complete') {
    await page.getByTestId(ex === 'complete' ? 'complete-input' : 'produce-input').fill(opts.wrong ? 'The meeting starts at nine.' : produceSentence(answer));
    await page.getByTestId('check').click();
  } else {
    await page.getByTestId('gap-input').click();
    await page.keyboard.type(opts.wrong ? 'zzzz' : answer, { delay: 30 });
    await page.keyboard.press('Enter');
    // Falsch getippt: erst ein Hinweis, dann der zweite Versuch (hier unverändert → Ergebnis).
    await expect(page.getByTestId('verdict').or(page.getByTestId('hint-line'))).toBeVisible();
    if (await page.getByTestId('hint-line').isVisible()) await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.getByTestId('next')).toBeVisible();
  // Keine Bewertungsknöpfe mehr (CLAUDE.md A7): die Note steht schon fest.
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  return { ex, step: step ?? '' };
}

/**
 * Rundgang durch die neuen Abfragearten (screens.spec, a11y.spec): je Art eine Karte, die als
 * erste fällig ist und deren schwächste Art feststeht – in dieser Reihenfolge. Dazu die Wendung
 * „aus der Situation“ und das Blatt einer Wendung in der Wortschatzliste.
 */
export const TOUR: ReadonlyArray<{ path: string; ex: string; stage: number; others: string[] }> = [
  // „Im Satz finden“, Tempo und Bausteine sind aus der Wörter-Leiter entfernt (Umbau Fokus).
  { path: 'vocab/deserve', ex: 'listen_mc', stage: 1, others: ['mc_en'] },
  { path: 'vocab/convince', ex: 'match', stage: 2, others: ['mc_de'] },
  { path: 'vocab/achieve', ex: 'dictation', stage: 5, others: ['produce'] },
  { path: 'vocab/affect', ex: 'produce', stage: 5, others: ['dictation'] },
  { path: 'chunk/c-non-negotiable', ex: 'situation', stage: 4, others: ['type', 'cloze'] },
];

export function tourPatch(): Record<string, Doc> {
  // Ohne „Automatisch weiter“ (M6): die Prüfung des Ergebnisses dauert länger als 1,2 s.
  const out: Record<string, Doc> = { ...TYPE_MODE, 'app/profile': { ...planPatch(TOUR.length), autoNext: false } };
  TOUR.forEach((t, i) => {
    const xs: Record<string, { c: number; w: number }> = { [t.ex]: { c: 0, w: 6 } };
    for (const o of t.others) xs[o] = { c: 6, w: 0 };
    out[t.path] = { state: 'learning', stage: t.stage, S: 1, D: 5, due: 1_680_000_000_000 + i * 1000, last: 1_679_900_000_000, reps: 3, lapses: 0, xs };
  });
  // Englische Oberfläche: die Absicht der Situationsübung braucht die englische Erklärung.
  out['chunk/c-non-negotiable'] = { ...out['chunk/c-non-negotiable'], def: 'not open to discussion or change' };
  return out;
}

/** Besucht jede neue Abfrageart (Frage und Ergebnis) und das Wendungsblatt; `scan` prüft den Zustand. */
export async function trainerTour(page: Page, scan: (name: string) => Promise<void>): Promise<void> {
  await page.getByTestId('start').click();
  await page.getByTestId('trainer').waitFor();
  const visited = new Set<string>();
  for (let i = 0; i < 30 && visited.size < TOUR.length; i++) {
    await expect(page.locator('[data-step]')).toHaveCount(1);
    const exEl = page.getByTestId('exercise');
    await expect(exEl).toBeVisible();
    const card = (await exEl.getAttribute('data-card')) ?? '';
    const t = TOUR.find((x) => x.path.endsWith(`/${card}`));
    // Wiedervorlage einer schon besuchten Karte (Lernschritte, F10): einfach lösen.
    if (!t || visited.has(t.path)) {
      await answerCurrent(page);
      continue;
    }
    visited.add(t.path);
    const progress = await page.getByTestId('trainer-progress').innerText();
    await expect(exEl, `${card} · Stufe ${await exEl.getAttribute('data-stage')} · ${progress} · Folge ${[...visited].join(',')}`).toHaveAttribute('data-ex', t.ex);
    // Kartenwechsel fertig eingeblendet (seitliche Überblendung), dann erst prüfen.
    await page.waitForFunction(() => {
      const el = document.querySelector<HTMLElement>('[data-step]');
      if (!el) return false;
      const cs = getComputedStyle(el);
      return cs.opacity === '1' && (cs.transform === 'none' || cs.transform === 'matrix(1, 0, 0, 1, 0, 0)');
    });
    // Wie learnTour: kurz warten, bis alle Übergänge (auch im Inhalt) stehen.
    await page.waitForTimeout(450);
    await scan(`trainer-${t.ex}`);
    // Tempo: dauert die Prüfung des Frage-Zustands länger als die Zeitgrenze, steht das Ergebnis schon.
    let timedOut = t.ex === 'speed' && (await page.getByTestId('verdict').isVisible());
    if (t.ex === 'speed' && !timedOut && Number((await page.getByTestId('speed-bar').getAttribute('data-left-ms').catch(() => '0')) ?? '0') < 3000) {
      // Zu knapp zum Tippen: den Ablauf abwarten (kein Wettlauf mit dem Balken).
      await expect(page.getByTestId('verdict')).toBeVisible();
      timedOut = true;
    }
    const step = timedOut ? ((await page.locator('[data-step]').getAttribute('data-step')) ?? '') : (await answerOnly(page)).step;
    await page.waitForTimeout(450);
    await scan(`trainer-${t.ex}-ergebnis`);
    if (await isTouch(page)) await page.getByTestId('next').click();
    else await page.keyboard.press('Enter');
    await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(0);
  }
  expect(visited.size).toBe(TOUR.length);
  await page.getByTestId('trainer-close').click();
  await openTab(page, 'vocab');
  await expect(page.getByTestId('vocab')).toBeVisible();
  await page.getByTestId('ws-all').click();
  await page.locator('[data-testid="vocab-filter"][data-filter="phrases"]').click();
  await page.locator('[data-testid="vocab-row"][data-word="c-i-take-your-point-but"]').click();
  await expect(page.getByTestId('chunk-origin')).toBeVisible();
  await page.waitForTimeout(450);
  await scan('wortschatz-wendung');
  await page.keyboard.press('Escape');
}
