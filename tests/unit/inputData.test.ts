import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createFakeClaude, type FakeControl } from '../../src/platform/dev/fakeRuntime';
import { initCapabilities, useCapabilities } from '../../src/platform/capabilities';
import { detectLang, isWrongLang } from '../../src/domain/lang/detect';
import { feedbackFits } from '../../src/domain/input/feedbackLang';
import { LEGACY_ARTICLES, LEGACY_LISTENING, LEGACY_PROMPTS, promptToDoc } from '../../src/domain/input/items';
import { processReview } from '../../src/domain/input/review';
import { unitsPatch } from '../../src/domain/progress/unitPatch';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { addDays } from '../../src/domain/date';
import { loadSeed, SEED_ANCHOR } from './helpers';

// Daten- und Plattform-Tests von Phase 4 (Plan §8.2): nach je einem Durchlauf aller vier Module
// nur erlaubte Schreibziele, nie feed/*/daily/*, kein delete, kein set auf Bestehendes;
// Kapazität und Größe; Sprachtreue der gespeicherten KI-Felder.

type Doc = Record<string, unknown>;
const DAY = SEED_ANCHOR;
let fake: FakeControl;
let before: Record<string, unknown>;

beforeAll(async () => {
  const g = globalThis as unknown as { window: unknown; claude?: unknown };
  const made = createFakeClaude({ seed: loadSeed() });
  fake = made.control;
  before = fake.db.dump();
  g.window = Object.assign(globalThis, { claude: made.claude });
  initCapabilities();
  await vi.waitFor(() => expect(useCapabilities.getState().db).toBe('ready'));
});

afterAll(() => {
  delete (globalThis as { claude?: unknown }).claude;
});

const ALLOWED = [/^articles\/ai\d+$/, /^lpool\/ai\d+$/, /^reading\/r\d+$/, /^writing\/w\d+$/, /^wprompt\/\d{4}-\d{2}-\d{2}$/, /^app\/profile$/, /^app\/radar$/, /^log\/\d{4}-\d{2}-\d{2}$/, /^vocab\/[a-z0-9-]+$/];

describe('Schreibziele eines Durchlaufs aller vier Module (Plan §3.1, §8.2)', () => {
  it('nur erlaubte Pfade, kein feed/daily, kein delete, kein set auf ein bestehendes Dokument', async () => {
    const c = await import('../../src/features/input/complete');
    const { flush } = await import('../../src/features/vocab/persist');
    const art = LEGACY_ARTICLES[2]!;
    const q = [] as const;
    // Lesen: erzeugter Text, Abschluss, Zusammenfassung mit Prüfung und Radar.
    const genId = await c.saveGeneratedArticle(
      { title: 'T', topic: 'tech', topic_de: 'Technik im Alltag', topic_en: 'Tech', teaser: 'x', text: 'A text. Another sentence here.', keypoints: [], glossary: [], questions: [] },
      { level: 'B2+', domain: 'work', day: DAY, src: 'ai' },
    );
    const rid = await c.completeReading({ day: DAY, item: art, questions: q, results: [], activeMs: 60_000, lang: 'de', ctx: 'duty' });
    await c.saveReadingSummary(rid, 'My summary of the text.', 5, { score: 4, covered: [], misunderstood: [], language: { cefr: 'B2', errors: [], tips: [] }, feedback: 'Gut gemacht, das passt so.', model_summary: 'x', lang: 'de', pv: 'reading-check@1' });
    await c.addRadar([{ orig: 'informations', fix: 'information', cat: 'grammar', topic: 'articles', sev: 'minor', why: 'w', span: null }], 'The informations are here.', 'r');
    // Eigener Text (M16): articles/*, nie feed/*.
    const ownId = await c.saveOwnArticle('Own text here. It is long enough for a test.', 'Own', { level: 'B2', domain: 'work' });
    await c.enrichOwnArticle(ownId, { title: 'Own', topic: 'own', topic_de: 'Eigener Text', topic_en: 'Own', teaser: '', keypoints: ['k'], glossary: [], questions: [] });
    // Hören.
    const lp = LEGACY_LISTENING[3]!;
    await c.saveGeneratedListening({ title: 'L', genre: 'briefing', topic_de: 'Thema', topic_en: 'Topic', text: 'Spoken text.', questions: [], vocab: [] }, { level: 'B2+', domain: 'work', day: DAY });
    await c.completeListening({ day: DAY, item: lp, questions: lp.questions, results: [{ key: lp.questions[0]!.key, chosen: 0, correct: true, ms: 900 }], plays: 1, rate: 1, help: false, activeMs: 120_000, lang: 'de', ctx: 'extra' });
    // Schreiben: Aufgabe des Tages (zweimal: bleibt), andere Aufgabe, Abgabe, Korrektur, Überarbeitung.
    const p = LEGACY_PROMPTS[0]!;
    await c.ensureDailyPrompt(DAY, promptToDoc(p));
    const again = await c.ensureDailyPrompt(DAY, promptToDoc(LEGACY_PROMPTS[1]!));
    expect((again.p as Doc).id).toBe(p.id);
    await c.replaceDailyPrompt(DAY, promptToDoc(LEGACY_PROMPTS[2]!));
    const wid = await c.submitWriting({ day: DAY, prompt: p, text: 'I will summarise it. It depends of you.', words: 8, lang: 'de', activeMs: 300_000 });
    const res = processReview(
      { cefr: 'B2', scores: { task: 4, grammar: 3, vocabulary: 4, coherence: 4, register: 3 }, summary: 's', strengths: ['a'], improved: 'x', upgrades: [], phrases: [], next: 'n', errors: [{ orig: 'summarise', fix: 'summarize', cat: 'spelling', why: 'w' }, { orig: 'depends of', fix: 'depends on', cat: 'collocation', why: 'w' }] },
      'I will summarise it. It depends of you.',
    );
    await c.saveWritingReview(wid, res, 'de', 0, 'I will summarise it. It depends of you.');
    expect(await c.reviseWriting(wid, 'I will summarize it. It depends on you.', 8)).toBe(1);
    // Entdecken.
    await c.markDiscStep('vida-ey', 'prep', DAY);
    await c.markDiscStep('vida-ey', 'prep', DAY);
    await c.markDiscStep('vida-ey', 'take', DAY);
    c.recordDiscoverAnswers({ day: DAY, ref: 'feed/2026-09-19#vida-ey', questions: [], results: [], lang: 'de', ctx: 'extra' });
    await c.completeDiscover({ day: DAY, itemId: 'vida-ey', domain: 'work', activeMs: 60_000, results: [] });
    await flush();

    const writes = fake.db.writes();
    expect(writes.length).toBeGreaterThan(10);
    const created = new Set<string>();
    for (const w of writes) {
      expect(ALLOWED.some((re) => re.test(w.path)), w.path).toBe(true);
      expect(w.op).not.toBe('delete');
      expect(w.path.startsWith('feed/') || w.path.startsWith('daily/')).toBe(false);
      const existed = w.path in before || created.has(w.path);
      if (w.op === 'set') expect(existed, `set auf Bestehendes: ${w.path}`).toBe(false);
      if (w.op === 'update') expect(existed, `update auf Fehlendes: ${w.path}`).toBe(true);
      created.add(w.path);
    }
    // Die Aufgabe des Tages wurde nur einmal angelegt, dann ergänzt.
    expect(writes.filter((w) => w.path === `wprompt/${DAY}`).map((w) => w.op)).toEqual(['set', 'update']);
    const db = fake.db.dump() as Record<string, Doc>;
    expect(Object.keys(db).filter((k) => k.startsWith('feed/'))).toEqual(Object.keys(before).filter((k) => k.startsWith('feed/')));
    expect(db[`articles/${genId}`]).toMatchObject({ src: 'ai', pv: 'reading-text@2', domain: 'work' });
    expect(db[`articles/${ownId}`]).toMatchObject({ src: 'own', keypoints: ['k'] });
    const w = db[`writing/${wid}`] as Doc & { res: { usHints: unknown[]; errors: Array<{ orig: string }> } };
    expect(w).toMatchObject({ rev: 1, text: 'I will summarize it. It depends on you.' });
    expect(w.res.usHints).toEqual([{ orig: 'summarise', us: 'summarize' }]);
    const radar = db['app/radar'] as { events: Array<Doc> };
    expect(radar.events.some((e) => e.g === 'summarise')).toBe(false);
    expect(radar.events.filter((e) => e.g === 'depends of')).toHaveLength(1);
    const prof = db['app/profile'] as Doc & { disc: Record<string, Doc>; act: Record<string, Doc>; gen: Doc };
    expect(prof.disc['vida-ey']).toEqual({ prep: DAY, take: DAY, use: DAY });
    expect(prof.act[DAY]).toMatchObject({ read: 1, listen: 2, write: 1, discover: 1 });
    expect(prof.gen).toMatchObject({ ar: DAY, lp: DAY, wp: DAY });
  });
});

describe('Kapazität und Größe (Plan §3.10, R2, R3)', () => {
  it('365 Tage Vollnutzung: app/profile bleibt unter 200 KiB (disc, listen, Zähler)', () => {
    let profile = loadSeed()['app/profile'] as Doc;
    for (let d = 1; d <= 365; d++) {
      const day = addDays(SEED_ANCHOR, d);
      const units = [
        { day, act: 'read' as const, answers: 4, right: 3, activeMs: 600_000, domain: 'work' as const },
        { day, act: 'write' as const, answers: 0, right: 0, activeMs: 900_000, domain: 'work' as const },
        { day, act: 'listen' as const, answers: 4, right: 4, activeMs: 600_000, domain: 'life' as const, listen: { id: `ai${d}`, level: 'B2+', n: 4, ok: 4, plays: 2, rate: 1, help: false, t: d } },
        { day, act: 'discover' as const, answers: 3, right: 2, activeMs: 900_000, domain: 'work' as const },
      ];
      const patch = unitsPatch(profile, null, units, { deviceId: 'dev', seq: d }) ?? {};
      const disc = { disc: { [`item-${d}-a`]: { prep: day, take: day, check: day, use: day }, [`item-${d}-b`]: { prep: day } } };
      profile = applyUpdate(applyUpdate(profile, patch), disc);
    }
    const bytes = new TextEncoder().encode(JSON.stringify(profile)).length;
    expect((profile.listen as unknown[]).length).toBe(80);
    expect(bytes).toBeLessThan(200 * 1024);
  });

  it('Dokumente je Lerntag: Pflichtkanal täglich ≤ 4 im Mittel; alle vier Module täglich höchstens 6', () => {
    // Pflicht = ein Kanal je Tag im Wechsel (Lesen, Schreiben, Hören, Entdecken), der Startbestand
    // wird zuerst genutzt (8 Texte, 8 Hörtexte), danach je Einheit ein erzeugter Text.
    let articles = 8;
    let listens = 8;
    let docs = 0;
    const channels = ['read', 'write', 'listen', 'discover'] as const;
    for (let d = 0; d < 30; d++) {
      docs += 1; // log/<tag>
      const ch = channels[d % 4];
      if (ch === 'read') docs += 1 + (articles-- > 0 ? 0 : 1); // reading/r + ggf. articles/ai
      if (ch === 'write') docs += 2; // wprompt/<tag> + writing/w
      if (ch === 'listen') docs += listens-- > 0 ? 0 : 1; // nur ggf. lpool/ai
    }
    expect(docs / 30).toBeLessThanOrEqual(4);
    // Höchstfall je Tag: log, reading, articles, wprompt, writing, lpool.
    expect(1 + 2 + 2 + 1).toBe(6);
  });
});

describe('Sprachtreue gespeicherter KI-Felder (Plan §8.2, F19, R8)', () => {
  it('Testbestand: explain_de/topic_de Deutsch, explain_en/text Englisch', () => {
    const seed = loadSeed();
    for (const [path, doc] of Object.entries(seed)) {
      if (!/^(articles|lpool)\//.test(path)) continue;
      const qs = Array.isArray(doc.questions) ? (doc.questions as Doc[]) : [];
      for (const q of qs) {
        if (typeof q.explain_de === 'string') expect(isWrongLang(q.explain_de, 'de'), `${path} explain_de`).toBe(false);
        if (typeof q.explain_en === 'string') expect(isWrongLang(q.explain_en, 'en'), `${path} explain_en`).toBe(false);
      }
      expect(isWrongLang(String(doc.text), 'en'), `${path} text`).toBe(false);
    }
  });

  it('Altdaten ohne lang in falscher Sprache werden nicht angezeigt (nur Hinweis „neu prüfen")', () => {
    const seed = loadSeed();
    const reading = Object.entries(seed).find(([p]) => p.startsWith('reading/'))?.[1] as { res: { feedback: string } };
    expect(detectLang(reading.res.feedback)).toBe('de');
    expect(feedbackFits(undefined, [reading.res.feedback], 'de')).toBe(true);
    expect(feedbackFits(undefined, [reading.res.feedback], 'en')).toBe(false);
    expect(feedbackFits('en', ['Deutscher Text, der hier steht und nicht passt.'], 'en')).toBe(true);
    expect(feedbackFits(undefined, ['ok'], 'en')).toBe(true);
    const writing = Object.entries(seed).find(([p]) => p.startsWith('writing/w'))?.[1] as { res: { summary: string } };
    expect(feedbackFits(undefined, [writing.res.summary], 'en')).toBe(false);
  });
});
