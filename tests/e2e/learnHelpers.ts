import { openLearnPage, openTab } from './fixtures';
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// Hilfen für die Phase-2-Bildschirme (Kurs, Lektion, Grammatik, Übungen). Die richtigen
// Antworten stammen aus den Testdaten und den Voreinstellungen – nie aus der Oberfläche,
// denn dort darf die Lösung vor dem Prüfen nicht stehen (U-04).

type Doc = Record<string, unknown>;
const json = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const SEED = json('../../seed/sample-data.json') as Record<string, Doc>;

/** Buchstaben und Ziffern, klein – Lücken, Satzzeichen und Leerraum fallen weg. */
export const squash = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');

type Known = { prompt: string; answer: string };

/** Alle Aufgaben mit Lösung, die eine Runde stellen kann (Voreinstellungen, Seed, zusätzliche). */
function collectTasks(extra: readonly Doc[]): Known[] {
  const out: Known[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (!v || typeof v !== 'object') return;
    const o = v as Doc;
    if (typeof o.prompt === 'string' && typeof o.answer === 'string') out.push({ prompt: o.prompt, answer: o.answer });
    // Fehler der alten Form: Frage `q`, Lösung `ans`.
    if (typeof o.q === 'string' && typeof o.ans === 'string') out.push({ prompt: o.q, answer: o.ans });
    // Fallen im Regelwerk werden zu Satzkorrekturen (`bad` → `good`).
    if (typeof o.bad === 'string' && typeof o.good === 'string') out.push({ prompt: o.bad, answer: o.good });
    Object.values(o).forEach(walk);
  };
  walk(json('../../src/content/legacy/grammar.json'));
  walk(json('../../src/content/grammar-extra.json'));
  walk(json('../../src/content/grammar-bank.json'));
  // C1-Werkzeugkasten (Lernberatung 27.09.): Aufgaben und Beispielsätze fließen auch in den Satzbau.
  walk(json('../../src/content/c1/toolkit.json'));
  walk(json('../../src/content/legacy/rules.json'));
  // C1-Werkzeugkasten (Lernberatung 27.09., Vorschlag 7): Aufgaben und Fallen der Regelblätter.
  walk(json('../../src/content/c1/toolkit.json'));
  walk(SEED);
  walk(extra);
  return out;
}

/** Lösung einer Aufgabe über ihren sichtbaren Wortlaut. */
export function grammarKey(extra: readonly Doc[] = []): (shown: string) => string | null {
  const tasks = collectTasks(extra).map((t) => ({ key: squash(t.prompt.replace('→', ' ')), answer: t.answer }));
  return (shown) => {
    const k = squash(shown);
    return tasks.find((t) => t.key === k)?.answer ?? null;
  };
}

/** Sichtbarer Aufgabentext eines `gr-item` (Ausgangssatz + Satz mit Lücke bzw. zu korrigierender Satz). */
export async function shownPrompt(page: Page): Promise<string> {
  const item = page.getByTestId('gr-item');
  if ((await item.getAttribute('data-type')) === 'correct') return item.getByTestId('correct-input').inputValue();
  // Umformung ohne Lücke: Auftrag steht über dem leeren Ganzsatz-Feld.
  if (await item.locator('[data-testid="correct-input"][data-whole]').count()) return item.getByTestId('transform-from').innerText();
  const from = item.getByTestId('transform-from');
  const pre = (await from.count()) ? await from.innerText() : '';
  return `${pre} ${await item.getByTestId('sentence').innerText()}`;
}

/**
 * Eine Grammatikaufgabe beantworten: richtig (Lösung aus den Testdaten), falsch oder frei
 * (`given`). Wartet auf das Ergebnis; weiter geht es mit `next`. Rückgabe: Typ und Lösung.
 */
export async function answerGrammar(page: Page, solve: (shown: string) => string | null, opts: { wrong?: boolean; given?: string } = {}): Promise<{ type: string; answer: string | null }> {
  const item = page.getByTestId('gr-item');
  await expect(item).toHaveCount(1);
  const type = (await item.getAttribute('data-type')) ?? '';
  const answer = solve(await shownPrompt(page));
  const text = opts.given ?? (opts.wrong || !answer ? 'zzzz wrong' : answer);
  if (type === 'mc') {
    const labels = (await item.getByTestId('choice').allInnerTexts()).map((l) => l.replace(/^\d+\s*/, '').trim());
    let idx = labels.findIndex((l) => l === answer);
    if (idx < 0) idx = 0;
    if (opts.wrong) idx = (idx + 1) % labels.length;
    await item.getByTestId('choice').nth(idx).click();
  } else if (type === 'correct' || (await item.getByTestId('correct-input').count())) {
    await item.getByTestId('correct-input').fill(text);
    await item.getByTestId('check').click();
  } else {
    await typeInGap(page, text);
    await item.getByTestId('check').click();
  }
  // Falsch getippt: erst ein Hinweis, dann der zweite Versuch (hier unverändert → Ergebnis).
  if (type !== 'mc') {
    await expect(item.getByTestId('verdict').or(item.getByTestId('retry-hint'))).toBeVisible();
    if (await item.getByTestId('retry-hint').isVisible()) await item.getByTestId('check').click();
  }
  await expect(item.getByTestId('verdict')).toBeVisible();
  return { type, answer };
}

/** In die Lücke tippen: das verborgene Eingabefeld liegt über der Lücke, sobald sie gebunden ist. */
export async function typeInGap(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('gap-input');
  await expect(input).not.toHaveAttribute('aria-hidden', 'true');
  await input.focus();
  await page.keyboard.type(text, { delay: 10 });
}

/** Weiter zur nächsten Aufgabe (ohne auf den automatischen Wechsel zu warten). */
export async function nextItem(page: Page): Promise<void> {
  const btn = page.getByTestId('next');
  if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => undefined);
}

// ------------------------------------------------------------------ Übungen

/** Alle Sätze, aus denen Übungen gebaut werden können (Seed, Voreinstellungen, gelöste Aufgaben). */
function corpus(extra: readonly Doc[] = []): string[] {
  const out = new Set<string>();
  const plain = (s: string) => s.replace(/[[\]]/g, '').replace(/\s+/g, ' ').trim();
  const walk = (v: unknown): void => {
    if (typeof v === 'string') {
      if (v.includes(' ')) out.add(plain(v));
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (!v || typeof v !== 'object') return;
    const o = v as Doc;
    if (typeof o.prompt === 'string' && typeof o.answer === 'string') {
      const target = o.type === 'transform' ? (o.prompt.split('→')[1] ?? '') : o.prompt;
      if (/_{3,}/.test(target)) out.add(plain(target.replace(/_{3,}/, o.answer.trim()).replace(/\s*\([^)]*\)/g, '')));
    }
    // Der Fehlersatz einer Satzkorrektur („Rarely we have seen …“) ist nie eine Lösung für Satzbau.
    const skip = o.type === 'correct' ? 'prompt' : null;
    Object.entries(o).forEach(([k, x]) => {
      if (k !== skip) walk(x);
    });
  };
  for (const f of ['grammar', 'rules', 'vocab', 'context', 'course', 'passages', 'scenes', 'feed-seed']) walk(json(`../../src/content/legacy/${f}.json`));
  walk(json('../../src/content/grammar-extra.json'));
  walk(json('../../src/content/grammar-bank.json'));
  // C1-Werkzeugkasten (Lernberatung 27.09.): Aufgaben und Beispielsätze fließen auch in den Satzbau.
  walk(json('../../src/content/c1/toolkit.json'));
  walk(SEED);
  walk(extra);
  return [...out];
}

let corpusCache: string[] | null = null;
const allSentences = (): string[] => (corpusCache ??= corpus());

/** Lösung der Lückenjagd: der Satz mit genau diesem Anfang und Ende; die Lücke ist der Rest. */
export async function clozeSolution(page: Page): Promise<string | null> {
  const [pre, post] = await page.getByTestId('sentence').evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    const gap = c.querySelector('[data-testid="gap"]');
    gap?.replaceWith(document.createTextNode('\u0000'));
    const [a, b] = (c.textContent ?? '').replace(/\s+/g, ' ').split('\u0000');
    return [a ?? '', b ?? ''];
  });
  const a = pre.trimStart();
  const b = post.trimEnd();
  for (const s of allSentences()) {
    if (s.length > a.length + b.length && s.startsWith(a.trimEnd()) && s.endsWith(b.trimStart())) {
      const mid = s.slice(a.trimEnd().length, s.length - b.trimStart().length).trim();
      if (mid && !mid.includes('  ')) return mid;
    }
  }
  return null;
}

type PoolJson = { items?: Array<{ chunks: string[]; en: string; alt?: string[] }> };

const normTile = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Indizes der Bausteine in der Reihenfolge eines Satzes (jeder Baustein genau einmal); `null`, wenn es nicht aufgeht. */
function sequenceOf(tiles: readonly string[], sentence: string): number[] | null {
  const used = new Array<boolean>(tiles.length).fill(false);
  const seq: number[] = [];
  const dfs = (rest: string): boolean => {
    if (!rest) return used.every(Boolean);
    for (let i = 0; i < tiles.length; i++) {
      if (used[i]) continue;
      const t = normTile(tiles[i] ?? '');
      if (rest === t || rest.startsWith(`${t} `)) {
        used[i] = true;
        seq.push(i);
        if (dfs(rest.slice(t.length).trimStart())) return true;
        used[i] = false;
        seq.pop();
      }
    }
    return false;
  };
  return dfs(normTile(sentence)) ? [...seq] : null;
}

/**
 * Alle gültigen Reihenfolgen der Bausteine für den Satzbau (Indizes in `tiles`), die Hauptfassung zuerst.
 * Gelesen wird der feste Pool `src/content/c1/order.json`; leer, wenn die Bausteine zu keinem Eintrag passen.
 */
export function orderSolutions(tiles: readonly string[]): number[][] {
  const pool = json('../../src/content/c1/order.json') as PoolJson;
  const key = (xs: readonly string[]) => xs.map(normTile).sort().join('|');
  const want = key(tiles);
  for (const it of pool.items ?? []) {
    if (key(it.chunks) !== want) continue;
    return [it.en, ...(it.alt ?? [])].map((s) => sequenceOf(tiles, s)).filter((s): s is number[] => s !== null);
  }
  return [];
}

/** Hauptfassung der Reihenfolge (Indizes in die Bausteine); `null`, wenn unbekannt. */
export function orderSolution(tiles: readonly string[]): number[] | null {
  return orderSolutions(tiles)[0] ?? null;
}

/**
 * `performance.now()` vorstellen (der Sprint misst damit). Nach dem Start eingespielt, damit die
 * Testuhr von Playwright (setFixedTime) darunter liegt und weiterläuft.
 */
export const shiftPerf = (page: Page, ms: number): Promise<void> =>
  page.evaluate((d) => {
    const w = window as unknown as { __perfShift?: number };
    if (w.__perfShift === undefined) {
      const orig = performance.now.bind(performance);
      w.__perfShift = 0;
      performance.now = () => orig() + (w.__perfShift ?? 0);
    }
    w.__perfShift += d;
  }, ms);

// ------------------------------------------------------------------ Rundgang (Bildschirm-Matrix, axe)

export type LearnScreen = 'lernen' | 'regelblatt' | 'minilektion' | 'grammatik-aufgabe' | 'wissen' | 'wortschatz' | 'lueckenjagd' | 'satzbau';

/**
 * Nach dem Start einer Themenrunde: ist das Thema neu, steht vor der ersten Aufgabe die Mini-Lektion
 * („Los“). Diese Funktion klickt sie weg (sonst nichts) und wartet auf die Aufgabe.
 */
export async function skipMiniLesson(page: Page): Promise<void> {
  const mini = page.getByTestId('mini-go');
  const item = page.getByTestId('gr-item').or(page.getByTestId('summary'));
  await expect(mini.or(item).first()).toBeVisible();
  if (await mini.isVisible()) await mini.click();
  await expect(item.first()).toBeVisible();
}

/** Alle Phase-2-Bildschirme nacheinander öffnen; `visit` prüft jeden (Seite ist ruhig). */
export async function learnTour(page: Page, visit: (name: LearnScreen) => Promise<void>): Promise<void> {
  const settle = () => page.waitForTimeout(450);
  const hub = async () => {
    await openLearnPage(page);
    await expect(page.getByTestId('learn-hub')).toBeVisible();
    await settle();
  };
  await hub();
  await visit('lernen');
  await page.locator('[data-testid="topic"][data-topic="passive"]').click();
  await expect(page.getByTestId('rule-sheet')).toBeVisible();
  await settle();
  await visit('regelblatt');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('rule-sheet')).toHaveCount(0);
  // Ein neues Thema beginnt mit der Mini-Lektion (nur wenn es noch keine Antworten gibt).
  await page.getByTestId('hub-next-start').click();
  const mini = page.getByTestId('mini-go');
  await expect(mini.or(page.getByTestId('gr-item')).first()).toBeVisible();
  if (await mini.isVisible()) {
    await settle();
    await visit('minilektion');
    await mini.click();
  }
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await settle();
  await visit('grammatik-aufgabe');
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await hub();
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('vocab')).toBeVisible();
  await settle();
  await visit('wortschatz');
  for (const [kind, name] of [['cloze', 'lueckenjagd'], ['order', 'satzbau']] as const) {
    await openTab(page, 'apply');
    await settle();
    await page.getByTestId(`hub-drill-${kind}`).click();
    await expect(page.getByTestId('drill-item')).toBeVisible();
    await settle();
    await visit(name);
    await page.getByTestId('round-close').click();
    await expect(page.getByTestId('drill')).toHaveCount(0);
  }
}
