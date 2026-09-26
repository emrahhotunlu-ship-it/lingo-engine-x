import { describe, expect, it } from 'vitest';
import { cacheFor } from '../../src/ai/gate';
import { createWriter } from '../../src/data/writer';
import { checkWithHint } from '../../src/domain/answer/check';
import { answerDiff, charDiff } from '../../src/domain/answer/diff';
import { formKind } from '../../src/domain/answer/form';
import { maskOf } from '../../src/domain/answer/mask';
import { cachePatch, compactLookup, jsonBytes, LOOKUP_COMPACT_BYTES, LOOKUP_COMPACT_KEEP, LOOKUP_MAX_BYTES, LOOKUP_MAX_KEYS, type LookupEntry } from '../../src/domain/lookup/cache';
import { posHint } from '../../src/domain/lookup/resolve';
import { shortMeaning, toTrainCard } from '../../src/domain/srs/cards';
import { confidenceOf } from '../../src/domain/srs/confidence';
import { buildExercise, choiceVerdict, defsClash } from '../../src/domain/srs/exercise';
import { saveCardOp } from '../../src/domain/srs/newCard';
import { reviewFsrs } from '../../src/domain/srs/scheduler';
import type { TrainCard } from '../../src/domain/srs/types';
import { tokenize } from '../../src/domain/text/tokenize';
import { hintOffset } from '../../src/engine/KineticGap';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { WORD_LOOKUP_EXAMPLE, wordLookup } from '../../src/prompts/wordLookup';
import { berlin } from './helpers';

// Befunde aus Daten-, Plattform- und UX-Prüfung des umgebauten Vokabeltrainers.

const NOW = berlin('2026-09-20', 21);
const DAY = 86_400_000;

describe('B1: vorgegebener Anfangsbuchstabe ist keine Falle', () => {
  const deps = { lemma: 'avoid' };
  it('„void" bei gezeigtem „a" ist richtig, gewertet wird „avoid"', () => {
    expect(checkWithHint('void', ['avoid'], deps, 'a')).toEqual({ result: { verdict: 'correct' }, effective: 'avoid' });
    expect(checkWithHint('avoid', ['avoid'], deps, 'a')).toEqual({ result: { verdict: 'correct' }, effective: 'avoid' });
  });
  it('ohne Hinweis oder bei falscher Eingabe bleibt es bei der normalen Prüfung', () => {
    expect(checkWithHint('void', ['avoid'], deps, null).result.verdict).not.toBe('correct');
    expect(checkWithHint('prevent', ['avoid'], deps, 'a')).toMatchObject({ result: { verdict: 'wrong' }, effective: 'prevent' });
    // Tippfehler im Rest: fast richtig, Markierung bezieht sich auf die gewertete Eingabe.
    const typo = checkWithHint('vodi', ['avoid'], deps, 'a');
    expect(typo.result.verdict).toBe('near');
    expect(typo.effective).toBe('avodi');
  });
  it('Platz 1 bleibt stehen, solange der Buchstabe nicht mitgetippt ist', () => {
    const mask = maskOf('avoid', { firstLetter: true });
    expect(hintOffset(mask, '')).toBe(0);
    expect(hintOffset(mask, 'v')).toBe(1);
    expect(hintOffset(mask, 'A')).toBe(0);
    expect(hintOffset(maskOf('avoid'), 'v')).toBe(0);
  });
});

describe('B4/F5: Sicherheit passt zum Ergebnis', () => {
  const base = { v: 1, due: NOW, stability: 10, difficulty: 5, state: 2, reps: 5, lapses: 0, last: NOW - 10 * DAY, scheduledDays: 10, learningSteps: 0, src: 'lx' };
  it('nach „Nochmal" höchstens unsicher, obwohl die Abrufwahrscheinlichkeit bei 1 liegt', () => {
    const after = reviewFsrs(base, 1, NOW);
    expect(after.state).toBe(3);
    expect(confidenceOf({ isNew: false, stage: 4, fsrs: after }, NOW + 60_000)).toBe(1);
    // Vorher sicher, direkt nach richtiger Antwort weiter mindestens „wird fester".
    const good = reviewFsrs(base, 3, NOW);
    expect(confidenceOf({ isNew: false, stage: 4, fsrs: good }, NOW + 60_000)).toBeGreaterThanOrEqual(2);
  });
  it('unter einem Tag Abstand zählt die Abrufwahrscheinlichkeit nicht', () => {
    const fresh = { ...base, stability: 0.2, last: NOW - 3_600_000 };
    expect(confidenceOf({ isNew: false, stage: 3, fsrs: fresh }, NOW)).toBe(2);
  });
});

function card(id: string, doc: Record<string, unknown>): TrainCard {
  const c = toTrainCard(id, { stage: 3, S: 10, D: 5, last: NOW - 5 * DAY, due: NOW, state: 'review', ...doc }, true, NOW);
  if (!c) throw new Error(id);
  return c;
}

describe('B5: keine Synonyme als Ablenker', () => {
  const convince = card('convince', { word: 'to convince', de: 'überzeugen', def: 'to make someone believe that something is true', pos: 'verb', ex: 'He [convinced] me.' });
  const persuade = card('persuade', { word: 'to persuade', de: 'überreden', def: 'to make someone agree to do something', pos: 'verb', ex: 'I [persuaded] him.' });
  const others = [
    card('avoid', { word: 'to avoid', de: 'vermeiden', def: 'to stay away from something or not do it', pos: 'verb' }),
    card('deserve', { word: 'to deserve', de: 'verdienen', def: 'to earn something because of what you did', pos: 'verb' }),
    card('overcome', { word: 'to overcome', de: 'überwinden', def: 'to successfully deal with a problem or fear', pos: 'verb' }),
    card('postpone', { word: 'to postpone', de: 'verschieben', def: 'to move an event to a later time', pos: 'verb' }),
    card('handle', { word: 'to handle', de: 'umgehen mit, erledigen', def: 'to deal with a situation or task', pos: 'verb' }),
  ];
  const pool = [convince, persuade, ...others];

  it('„to make someone …" gilt als zu ähnlich', () => {
    expect(defsClash(convince.def, persuade.def)).toBe(true);
    expect(defsClash(convince.def, others[1]!.def)).toBe(false);
  });

  it('Wort wählen und Bedeutung wählen: to persuade steht nie neben to convince (viele Startwerte)', () => {
    for (let i = 0; i < 40; i++) {
      for (const lang of ['de', 'en'] as const) {
        const de = buildExercise(convince, 'mc_de', lang, pool, `seed-${i}`);
        expect(de.options.map((o) => o.label)).not.toContain('to persuade');
        const en = buildExercise(convince, 'mc_en', lang, pool, `seed-${i}`);
        expect(en.options.some((o) => o.fromWord === 'to persuade')).toBe(false);
      }
    }
  });

  it('wird doch ein Synonym gewählt: fast richtig mit Begründung, nicht falsch', () => {
    const ex = { ex: 'mc_de' as const, card: convince, meaning: 'überzeugen, überreden' };
    expect(choiceVerdict(ex, { id: 'd0', label: 'to persuade', lang: 'en', correct: false, fromWord: 'to persuade', fromMeaning: 'überreden' })).toEqual({
      verdict: 'near',
      kind: 'synonym',
      otherWord: 'to persuade',
    });
    expect(choiceVerdict(ex, { id: 'd1', label: 'to avoid', lang: 'en', correct: false, fromWord: 'to avoid', fromMeaning: 'vermeiden' }).verdict).toBe('wrong');
    expect(choiceVerdict(ex, { id: 'ok', label: 'to convince', lang: 'en', correct: true }).verdict).toBe('correct');
  });
});

describe('B6: englische Optionen vollständig', () => {
  it('ganze erste Definition, Kommas bleiben, nie mitten im Wort gekürzt', () => {
    const def = 'to sell a customer a more expensive or additional product';
    expect(shortMeaning(def, 'en')).toBe(def);
    expect(shortMeaning('to deal with a situation, or a task; to touch', 'en')).toBe('to deal with a situation, or a task');
    expect(shortMeaning('umgehen mit, erledigen', 'de')).toBe('umgehen mit');
    const long = shortMeaning('word '.repeat(40).trim(), 'en');
    expect(long.endsWith('word…')).toBe(true);
  });
});

describe('H2/H3: Markierung und Formhinweis', () => {
  it('Tippfehler: fehlender Buchstabe wird eingefügt gezeigt', () => {
    const d = charDiff('strugle', 'struggle');
    expect(d.map((p) => p.text).join('')).toBe('struggle');
    expect(d.filter((p) => p.kind !== 'ok')).toEqual([{ text: 'g', kind: 'missing' }]);
    expect(charDiff('avodi', 'avoid').some((p) => p.kind !== 'ok')).toBe(true);
  });
  it('„to" vor dem Verb ist keine andere Form (kein Formhinweis bei to struggle)', () => {
    expect(formKind('to struggle', 'struggle', 'verb')).toBeNull();
    expect(formKind('persuaded', 'persuade', 'verb')).toBe('past');
    expect(answerDiff('strugle', 'struggle').every((p) => p.ok)).toBe(true);
  });
});

describe('H5: -ing/-ed ohne Artikel → Verb zuerst', () => {
  it('avoid driving → Verb, the meeting → Nomen', () => {
    const a = tokenize('Try to avoid driving in rush hour.');
    expect(posHint(a, a.findIndex((t) => t.text === 'driving'))).toBe('verb');
    const b = tokenize('We moved the meeting.');
    expect(posHint(b, b.findIndex((t) => t.text === 'meeting'))).toBe('noun');
  });
});

describe('Daten: „Als Karte speichern" und app/lookup', () => {
  const made = { doc: { word: 'x', ex: 'A [x] here.', origin: { v: 1, kind: 'lookup', t: 1 } } };
  it('ausgeblendete Karte bleibt unberührt', () => {
    expect(saveCardOp({ word: 'x', ex: '', hidden: true }, made)).toBeNull();
    expect(saveCardOp({ word: 'x', ex: '' }, made)).toEqual({ update: { ex: 'A [x] here.', origin: made.doc.origin } });
  });

  const entry = (t: number): LookupEntry => ({ lemma: 'w', pos: 'noun', de: 'Wort', def: 'a word', level: 'B2', t, pv: 'word-lookup@1' });

  it('verdrängte null-Schlüssel zählen mit: zu viele → einmal verdichten (replace)', () => {
    const items: Record<string, unknown> = {};
    for (let i = 0; i < LOOKUP_MAX_KEYS; i++) items[`gone${i}`] = null;
    for (let i = 0; i < 10; i++) items[`k${i}`] = entry(100 + i);
    const cur = { items, other: 'bleibt' };
    const op = cachePatch(cur, 'neu', entry(999));
    expect(op && 'replace' in op).toBe(true);
    if (!op || !('replace' in op)) return;
    const next = op.replace as { items: Record<string, unknown>; other: string };
    expect(next.other).toBe('bleibt');
    expect(Object.values(next.items).every((v) => v !== null)).toBe(true);
    expect(Object.keys(next.items)).toHaveLength(11);
    expect(next.items.neu).toMatchObject({ t: 999 });
  });

  it('Bytes zählen mit: über der Grenze → verdichten auf die neuesten Einträge', () => {
    const items: Record<string, unknown> = {};
    const big = (t: number) => ({ ...entry(t), def: 'd'.repeat(190), note_de: 'n'.repeat(190), ex: 'e'.repeat(230) });
    for (let i = 0; i < 390; i++) items[`k${i}`] = big(i + 1);
    const cur = { items };
    expect(jsonBytes(cur)).toBeGreaterThan(LOOKUP_MAX_BYTES);
    const op = cachePatch(cur, 'neu', entry(10_000));
    expect(op && 'replace' in op).toBe(true);
    const next = compactLookup(cur, 'neu', entry(10_000));
    expect(jsonBytes(next)).toBeLessThanOrEqual(LOOKUP_COMPACT_BYTES + 200);
    const keys = Object.keys(next.items as object);
    expect(keys.length).toBeLessThanOrEqual(LOOKUP_COMPACT_KEEP);
    expect(keys).toContain('neu');
    expect(keys).toContain('k389');
    expect(keys).not.toContain('k0');
  });

  it('normale Größe: weiter nur update', () => {
    const op = cachePatch({ items: { a: entry(1) } }, 'b', entry(2));
    expect(op).toEqual({ update: { items: { b: entry(2) } } });
  });

  it('Writer: replace ersetzt nur aus dem frischen Stand; gleicher Stand → unverändert', async () => {
    const h = createMemoryDb({ seed: { 'app/lookup': { items: { a: null, b: entry(1) } } } });
    const w = createWriter(h.db);
    expect(await w.transform('app/lookup', (cur) => ({ replace: { ...cur, items: { b: entry(1) } } }))).toBe('updated');
    expect((await h.db.doc('app/lookup').get()).data()).toEqual({ items: { b: entry(1) } });
    expect(await w.transform('app/lookup', (cur) => ({ replace: { ...cur } }))).toBe('unchanged');
  });
});

describe('word-lookup@1: gespeicherte Felder nur auf Englisch', () => {
  it('deutscher Beispielsatz oder deutsche Definition werden zurückgewiesen', () => {
    const base = JSON.parse(WORD_LOOKUP_EXAMPLE) as Record<string, string>;
    const s = wordLookup.schema({ word: 'reliable', sentence: 'x', uiLang: 'de' });
    expect(s.safeParse({ ...base, sense: 'Hier heißt es, dass man sich auf ihn verlassen kann.' }).success).toBe(true);
    expect(s.safeParse({ ...base, ex: 'Der neue Lieferant ist sehr zuverlässig und das ist gut.' }).success).toBe(false);
    expect(s.safeParse({ ...base, def: 'ist eine Person, auf die man sich verlassen kann' }).success).toBe(false);
  });
});

describe('H-A: „Erneut versuchen" überspringt den Zwischenspeicher', () => {
  it('refresh mit derselben gcTime, sonst unverändert', () => {
    expect(cacheFor({ gcTime: 86_400_000 }, true)).toEqual({ gcTime: 86_400_000, refresh: true });
    expect(cacheFor({ gcTime: 86_400_000 }, false)).toEqual({ gcTime: 86_400_000 });
    expect(cacheFor(true, true)).toEqual({ gcTime: 300_000, refresh: true });
    expect(cacheFor(false, true)).toBe(false);
  });
});
