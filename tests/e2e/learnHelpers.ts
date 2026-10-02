import { openLearnPage } from './fixtures';
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// Hilfen für die Phase-2-Bildschirme (Kurs, Lektion, Grammatik, Übungen). Die richtigen
// Antworten stammen aus den Testdaten und den Voreinstellungen – nie aus der Oberfläche,
// denn dort darf die Lösung vor dem Prüfen nicht stehen (U-04).

type Doc = Record<string, unknown>;
const json = (rel: string): unknown => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const SEED = json('../../seed/sample-data.json') as Record<string, Doc>;
const COURSE = json('../../src/content/legacy/course.json') as { lessons: Array<{ id: string; grammar: string; words: Array<[string, string]> }> };

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

// ------------------------------------------------------------------ Lektion

export const lessonMeta = (id: string) => {
  const m = COURSE.lessons.find((l) => l.id === id);
  if (!m) throw new Error(`Lektion ${id} fehlt`);
  return m;
};

const core = (en: string) => en.replace(/^to\s+/i, '').replace(/\b(something|someone|somebody|sth|sb)\b/gi, '').replace(/\s+/g, ' ').trim();

/** Gespeicherter Inhalt `lesson/l07` im Format der alten App (jedes Zielwort in genau einer Zeile). */
export function storedL07(): Doc {
  const m = lessonMeta('l07');
  const lines = [
    { sp: 'Anna', en: 'Every document we receive is scanned first.', de: 'Jedes Dokument, das wir bekommen, wird zuerst gescannt.' },
    { sp: 'Ben', en: 'Then we process it automatically in the cloud.', de: 'Dann verarbeiten wir es automatisch in der Cloud.' },
    { sp: 'Anna', en: 'What happens to an invoice after that?', de: 'Was passiert danach mit einer Rechnung?' },
    { sp: 'Ben', en: 'We store all files in one central archive.', de: 'Wir speichern alle Dateien in einem zentralen Archiv.' },
    { sp: 'Anna', en: 'Can special cases be handled quickly?', de: 'Können Sonderfälle schnell bearbeitet werden?' },
    { sp: 'Ben', en: 'Nothing is paid without an approval from the finance team.', de: 'Nichts wird ohne Freigabe der Finanzabteilung bezahlt.' },
    { sp: 'Anna', en: 'And every step is logged in the audit trail.', de: 'Und jeder Schritt wird im Prüfpfad protokolliert.' },
    { sp: 'Ben', en: 'Exactly, and the data is backed up every night.', de: 'Genau, und die Daten werden jede Nacht gesichert.' },
  ];
  const words = m.words.map(([en, de]) => {
    const c = core(en);
    const line = lines.find((l) => l.en.includes(c))?.en ?? '';
    return { en, de, pos: 'phrase', def: '', ex: line.replace(c, `[${c}]`) };
  });
  return {
    v: 1,
    t: 1789900000000,
    words,
    dialogue: { title: 'How invoices are processed', lines },
    questions: [
      { q: 'Wo werden alle Dateien gespeichert?', options: ['In einem zentralen Archiv', 'Auf Papier', 'Beim Kunden', 'Nirgendwo'], answer: 'In einem zentralen Archiv', lang: 'de', q_alt: 'Where are all files stored?', options_alt: ['In one central archive', 'On paper', 'At the customer', 'Nowhere'], answer_alt: 'In one central archive' },
      { q: 'Wann werden die Daten gesichert?', options: ['Einmal im Jahr', 'Jede Nacht', 'Nie', 'Jede Stunde'], answer: 'Jede Nacht', lang: 'de', q_alt: 'When is the data backed up?', options_alt: ['Once a year', 'Every night', 'Never', 'Every hour'], answer_alt: 'Every night' },
    ],
    tasks: [
      { topic: 'passive', type: 'mc', prompt: 'The invoices ___ every morning by our team.', options: ['check', 'are checked', 'are checking', 'checked'], answer: 'are checked', accepted: [], hint: '', expl: 'Wer prüft, ist egal → Passiv: are + Partizip.', expl_en: 'Who checks does not matter → passive: are + past participle.', src: 'lesson' },
      { topic: 'passive', type: 'gap', prompt: 'The contract ___ (sign) yesterday afternoon.', options: null, answer: 'was signed', accepted: [], hint: '(sign)', expl: 'Vergangenheit, Handelnder egal → was + Partizip.', expl_en: 'Past, actor unimportant → was + past participle.', src: 'lesson' },
      { topic: 'passive', type: 'transform', prompt: 'Someone stores the files in the cloud. → The files ___ in the cloud.', options: null, answer: 'are stored', accepted: [], hint: '', expl: 'Das Objekt wird zum Subjekt → are + Partizip.', expl_en: 'The object becomes the subject → are + past participle.', src: 'lesson' },
      { topic: 'passive', type: 'correct', prompt: 'The data is back up every night.', options: null, answer: 'The data is backed up every night.', accepted: [], hint: '', expl: 'Passiv braucht das Partizip: backed up.', expl_en: 'The passive needs the past participle: backed up.', src: 'lesson' },
    ],
    output: {
      de: 'Erkläre einem Kunden, wie Rechnungen bei euch bearbeitet werden.',
      en: 'Explain to a customer how invoices are processed at your company.',
      mustUse: ['invoice', 'approval', 'audit trail'],
    },
  };
}

/** Eigener Text für den Schritt „Anwenden" (lang genug, alle Pflichtwörter, kein Abschreiben). */
export const L07_OUTPUT =
  'Each invoice is checked by our accounting team first. After that an approval is requested from the manager, and every change is recorded in the audit trail so that nothing gets lost later.';

/** Eine Wortübung der Lektion beantworten (Bedeutung wählen bzw. Lücke), dann weiter. */
async function answerLessonWord(page: Page, words: ReadonlyArray<{ en: string; de: string }>): Promise<void> {
  const ex = page.getByTestId('exercise');
  const kind = (await ex.getAttribute('data-ex')) ?? '';
  const card = (await ex.getAttribute('data-card')) ?? '';
  const slug = (w: string) => w.toLowerCase().replace(/^to\s+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const w = words.find((x) => slug(x.en) === card);
  if (kind === 'mc_en' || kind === 'mc_de' || kind === 'colloc') {
    const labels = (await page.getByTestId('choice').allInnerTexts()).map((l) => l.replace(/^\d+\s*/, '').trim());
    const want = kind === 'mc_de' ? (w?.en ?? '') : (w?.de ?? '');
    let idx = labels.findIndex((l) => l === want || want.startsWith(l) || l.startsWith(want.split(/[;,]/)[0] ?? '\u0000'));
    if (idx < 0) idx = 0;
    await page.getByTestId('choice').nth(idx).click();
  } else {
    await typeInGap(page, w ? core(w.en) : 'zzzz');
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  // „Automatisch weiter“ (M6) wechselt nach 1,2 s – unter Last manchmal vor dem Klick. Dann ist der
  // Wechsel schon passiert; in jedem Fall muss das Ergebnis dieser Übung verschwinden.
  const verdict = await page.getByTestId('verdict').elementHandle();
  await page.getByTestId('next').click({ timeout: 2_000 }).catch(() => undefined);
  await verdict?.waitForElementState('hidden');
}

/**
 * Eine geöffnete Lektion vom Start bis zur Zusammenfassung durchspielen (ohne KI).
 * `words`: Zielwörter (für die Wortübungen), `solve`: Lösungen der Grammatikaufgaben.
 */
export async function playLesson(page: Page, o: { words: ReadonlyArray<{ en: string; de: string }>; solve: (shown: string) => string | null; answers?: Record<string, string>; output: string; onGrammar?: (phase: 'before' | 'after') => Promise<void>; aiCheck?: boolean }): Promise<void> {
  const lesson = page.getByTestId('lesson');
  await expect(page.getByTestId('lesson-start')).toBeVisible();
  await page.getByTestId('lesson-start').click();
  // Wörter: Einführung und Übungen, bis der Schritt fertig ist.
  await expect(lesson).toHaveAttribute('data-step', 'words');
  const stepNext = (step: string) => page.locator(`[data-testid="lesson-step"][data-step="${step}"]`).getByTestId('lesson-next');
  for (let i = 0; i < 60; i++) {
    const next = stepNext('words');
    const intro = page.getByTestId('intro-continue');
    const ex = page.getByTestId('exercise');
    await expect(next.or(intro).or(ex).first()).toBeVisible();
    if (await next.isVisible()) break;
    if (await intro.isVisible()) {
      await intro.click();
      continue;
    }
    await answerLessonWord(page, o.words);
  }
  await stepNext('words').click();
  // Dialog: Text zeigen (falls erst Hören), alle Fragen beantworten.
  await expect(lesson).toHaveAttribute('data-step', 'dialog');
  const show = page.getByTestId('lesson-show-text');
  await expect(show.or(page.getByTestId('dialog-line').first()).first()).toBeVisible();
  if (await show.isVisible()) await show.click();
  await expect(page.getByTestId('dialog-line').first()).toBeVisible();
  const qs = page.getByTestId('lesson-question');
  const nQ = await qs.count();
  for (let i = 0; i < nQ; i++) {
    const q = qs.nth(i);
    const qText = (await q.locator('p').first().innerText()).trim();
    const want = o.answers?.[qText];
    const labels = (await q.getByTestId('choice').allInnerTexts()).map((l) => l.replace(/^\d+\s*/, '').trim());
    const idx = Math.max(0, want ? labels.indexOf(want) : 0);
    await q.getByTestId('choice').nth(idx).click();
    await expect(q.getByTestId('verdict')).toBeVisible();
  }
  await expect(page.getByTestId('dialog-line').first()).toBeVisible();
  await stepNext('dialog').click();
  // Grammatik: Aufgaben bis „weiter zu Anwenden".
  await expect(lesson).toHaveAttribute('data-step', 'grammar');
  for (let i = 0; i < 8; i++) {
    const next = stepNext('grammar');
    await expect(next.or(page.getByTestId('gr-item')).first()).toBeVisible();
    if (await next.isVisible()) break;
    if (o.onGrammar) await o.onGrammar('before');
    await answerGrammar(page, o.solve);
    if (o.onGrammar) await o.onGrammar('after');
    await nextItem(page);
    await expect(page.getByTestId('gr-item').getByTestId('verdict')).toHaveCount(0);
  }
  await stepNext('grammar').click();
  // Anwenden: eigener Text, Selbstprüfung ohne KI.
  await expect(lesson).toHaveAttribute('data-step', 'output');
  await page.getByTestId('output-input').fill(o.output);
  await expect(page.getByTestId('must-use').first()).toHaveAttribute('data-used', '');
  if (o.aiCheck) {
    // Rückmeldung von Claude (lesson-production@1).
    await page.getByTestId('output-check').click();
    await expect(page.getByTestId('output-ai')).toBeVisible();
  } else await page.getByTestId('output-self').click();
  await expect(page.getByTestId('model-text')).toBeVisible();
  await stepNext('output').click();
  await expect(lesson).toHaveAttribute('data-step', 'summary');
  await expect(page.getByTestId('summary')).toBeVisible();
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
export function orderSolution(tiles: readonly string[], _end = ''): number[] | null {
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

export type LearnScreen = 'lernen' | 'kurs' | 'lektion' | 'grammatik' | 'regelblatt' | 'grammatik-aufgabe' | 'wissen' | 'wortschatz' | 'lueckenjagd' | 'satzbau';

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
  await page.getByTestId('hub-course').click();
  await expect(page.getByTestId('course')).toBeVisible();
  await settle();
  await visit('kurs');
  await page.locator('[data-testid="lesson-row"][data-state="next"]').click();
  await expect(page.getByTestId('lesson-intro')).toBeVisible();
  await settle();
  await visit('lektion');
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('course')).toBeVisible();
  await hub();
  await page.getByTestId('hub-grammar').click();
  await expect(page.getByTestId('grammar')).toBeVisible();
  await settle();
  await visit('grammatik');
  await page.locator('[data-testid="topic"][data-topic="passive"]').click();
  await expect(page.getByTestId('rule-sheet')).toBeVisible();
  await settle();
  await visit('regelblatt');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('rule-sheet')).toHaveCount(0);
  await page.getByTestId('gr-start').click();
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await settle();
  await visit('grammatik-aufgabe');
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('grammar')).toBeVisible();
  await page.getByTestId('open-wissen').click();
  await expect(page.getByTestId('wissen')).toBeVisible();
  await settle();
  await visit('wissen');
  await hub();
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('vocab')).toBeVisible();
  await settle();
  await visit('wortschatz');
  for (const [kind, name] of [['cloze', 'lueckenjagd'], ['order', 'satzbau']] as const) {
    await hub();
    await page.getByTestId(`hub-drill-${kind}`).click();
    await expect(page.getByTestId('drill-item')).toBeVisible();
    await settle();
    await visit(name);
    await page.getByTestId('round-close').click();
    await expect(page.getByTestId('drill')).toHaveCount(0);
  }
}
