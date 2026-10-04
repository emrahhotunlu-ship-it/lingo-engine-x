import { beforeAll, describe, expect, it } from 'vitest';
import { FLUENCY_QUESTIONS } from '../../src/content/fluency/questions';
import { validateDoc } from '../../src/data/validate';
import { newChunkDoc } from '../../src/domain/chunks/newChunk';
import { appendSpoken, FLUENCY_ROUNDS, isCompleteSentence, questionFor, roundStats, timeLeft, trend } from '../../src/domain/fluency/fluency';
import { compactFluency, FLUENCY_DOC_MAX_BYTES, fluencyId, fluencyPath, upsertFluencyItem, type FluencyItem } from '../../src/domain/fluency/fluencyDoc';
import { cleanMeetingInput, compactMeetings, listMeetings, MEETING_DEBRIEF_MAX, MEETING_DOC_MAX_BYTES, meetingId, meetingPath, patchMeetingItem, readMeeting, upsertMeetingItem, withDebrief, type MeetingItem } from '../../src/domain/meeting/meetingDoc';
import { roundBonus } from '../../src/domain/progress/profilePatch';
import { addRepairs } from '../../src/domain/repair/repair';
import { repairsFromCorrections } from '../../src/domain/say/say';
import { compactList, jsonBytes } from '../../src/domain/monthDoc';
import { clearLog, getLog } from '../../src/platform/diagnostics';
import { registerCannedReplies } from '../../src/platform/dev/cannedReplies';
import { createFakeSample } from '../../src/platform/dev/fakeSample';
import { fluencyCheck, fluencyCheckSchema, type FluencyCheckVars } from '../../src/prompts/fluencyCheck';
import { meetingDebrief, meetingDebriefSchema, type MeetingDebriefVars } from '../../src/prompts/meetingDebrief';
import { meetingPrep, meetingPrepSchema, type MeetingPrepVars } from '../../src/prompts/meetingPrep';
import { TEMPLATES } from '../../src/prompts/registry';

// Flüssigkeit 90 – 60 – 45 und „Mein nächster Termin“ (Lernberatung 27.09., V6/V4): Fragen,
// Kennzahlen ohne KI, Zeitbalken, Monatsdokumente (tolerant, gekappt, registriert), Vorlagen und
// feste Testantworten, Reparatur-Sätze mit Quelle `fluency`, Wendungen mit Ursprungssatz.

describe('Fragen', () => {
  it('etwa 25 Berufsfragen und wenige Alltagsfragen, eindeutige Kennungen, beide Sprachen', () => {
    const job = FLUENCY_QUESTIONS.filter((q) => q.kind === 'job');
    const life = FLUENCY_QUESTIONS.filter((q) => q.kind === 'life');
    expect(job.length).toBeGreaterThanOrEqual(24);
    expect(life.length).toBeGreaterThanOrEqual(3);
    expect(life.length).toBeLessThan(job.length / 3);
    expect(new Set(FLUENCY_QUESTIONS.map((q) => q.id)).size).toBe(FLUENCY_QUESTIONS.length);
    for (const q of FLUENCY_QUESTIONS) {
      expect(q.en).toMatch(/[?.]$/);
      expect(q.de.length).toBeGreaterThan(15);
    }
  });

  it('Frage des Tages fest je Tag, „Andere Frage“ wechselt', () => {
    const a = questionFor(FLUENCY_QUESTIONS, '2026-09-28');
    expect(questionFor(FLUENCY_QUESTIONS, '2026-09-28')).toEqual(a);
    expect(questionFor(FLUENCY_QUESTIONS, '2026-09-28', 1)?.id).not.toBe(a?.id);
    expect(questionFor([], '2026-09-28')).toBeNull();
  });
});

describe('Kennzahlen ohne KI', () => {
  it('Runden 90 – 60 – 45', () => {
    expect([...FLUENCY_ROUNDS]).toEqual([90, 60, 45]);
  });

  it('Zeitbalken: Rest, Anteil, bei 0 vorbei (nie negativ)', () => {
    expect(timeLeft(1000, 1000, 90_000)).toEqual({ leftMs: 90_000, share: 1, over: false });
    expect(timeLeft(1000, 46_000, 90_000)).toMatchObject({ leftMs: 45_000, share: 0.5, over: false });
    expect(timeLeft(1000, 200_000, 90_000)).toEqual({ leftMs: 0, share: 0, over: true });
  });

  it('gesprochene Stücke: groß am Anfang, Punkt am Ende, mit Leerzeichen angehängt', () => {
    expect(appendSpoken('', 'we save a lot of time')).toBe('We save a lot of time.');
    expect(appendSpoken('We save time.', 'is that clear?')).toBe('We save time. Is that clear?');
    expect(appendSpoken('Text', '   ')).toBe('Text');
  });

  it('vollständiger Satz: Satzzeichen, mindestens drei Wörter, kein hängendes Wort', () => {
    expect(isCompleteSentence('We save a lot of time.')).toBe(true);
    expect(isCompleteSentence('Yes, sure.')).toBe(false);
    expect(isCompleteSentence('We save time because')).toBe(false);
    expect(isCompleteSentence('We save time and.')).toBe(false);
  });

  it('Wörter, Wörter pro Minute und ganze Sätze je Runde', () => {
    const text = 'The cloud is cheaper. It is also safer: backups run every night. And the best part is that';
    const s = roundStats(text, 30_000);
    expect(s.words).toBe(18);
    expect(s.wpm).toBe(36);
    expect(s.sentences).toBe(3);
    expect(s.full).toBe(2);
    expect(s.fullShare).toBeCloseTo(2 / 3);
    expect(roundStats('', 45_000)).toEqual({ words: 0, wpm: 0, sentences: 0, full: 0, fullShare: 0 });
    // Sehr kurze Zeit: mindestens 5 s gerechnet (keine Fantasiewerte).
    expect(roundStats('One two three four five.', 100).wpm).toBe(60);
  });

  it('Tendenz ruhig: ±5 % gilt als gleich', () => {
    expect(trend(100, 110)).toBe('up');
    expect(trend(100, 103)).toBe('same');
    expect(trend(100, 80)).toBe('down');
    expect(trend(0, 10)).toBe('up');
  });
});

const fItem = (i: number, over: Partial<FluencyItem> = {}): FluencyItem => ({
  id: fluencyId('cloud-archive', 1_790_000_000_000 + i),
  t: 1_790_000_000_000 + i,
  day: '2026-09-27',
  q: 'cloud-archive',
  kind: 'job',
  rounds: FLUENCY_ROUNDS.map((sec) => ({ sec, text: 'x'.repeat(1400), ms: sec * 1000, words: 100, wpm: 90, sentences: 6, full: 5 })),
  fb: { progress: 'Klarer.', missing: [], corrections: [] },
  ms: 195_000,
  lang: 'de',
  ai: true,
  ...over,
});

describe('Monatsdokument fluency/<JJJJ-MM>', () => {
  it('anlegen, ersetzen (idempotent), gültig nach Schema, registrierter Pfad', () => {
    expect(fluencyPath('2026-09-27')).toBe('fluency/2026-09');
    const a = upsertFluencyItem(undefined, fItem(1));
    expect(a && 'set' in a).toBe(true);
    const doc = (a as { set: Record<string, unknown> }).set;
    expect(validateDoc('fluency/2026-09', doc).ok).toBe(true);
    const b = upsertFluencyItem(doc, fItem(1, { ai: false }));
    expect((b as { update: { items: unknown[] } }).update.items).toHaveLength(1);
    expect(upsertFluencyItem({ items: 'kaputt' }, fItem(2))).toBeNull();
    expect(validateDoc('fluency/2026-09', { items: [{ id: 'x', rounds: 'nope' }] }).ok).toBe(false);
  });

  it('Dokument mit unerwartetem Aufbau (Schema verletzt) wird nie überschrieben', () => {
    expect(upsertFluencyItem({ v: 1, month: '2026-09', items: [{ id: 5 }] }, fItem(2))).toBeNull();
  });

  it('gekappt auf ≤ 200 KiB: zuerst Rückmeldungen, dann Texte der ältesten', () => {
    const many = Array.from({ length: 80 }, (_, i) => fItem(i));
    const out = compactFluency(many, '2026-09') as FluencyItem[];
    expect(jsonBytes({ v: 1, month: '2026-09', items: out })).toBeLessThanOrEqual(FLUENCY_DOC_MAX_BYTES);
    expect(out.length).toBe(80);
    expect(out[0]?.fb).toBeNull();
    expect(out[0]?.rounds[0]?.text).toBe('');
    expect(out[79]?.rounds[0]?.text.length).toBe(1400);
  });
});

const mItem = (i: number, over: Partial<MeetingItem> = {}): MeetingItem => ({
  id: meetingId(1_790_000_000_000 + i),
  t: 1_790_000_000_000 + i,
  day: '2026-09-27',
  who: 'Partner in UK',
  topic: 'Er will Rabatt, ich will Laufzeit',
  tricky: 'Wettbewerber ist billiger',
  notes: '',
  when: '',
  prep: { phrases: [{ en: 'in return for', de: 'im Gegenzug für', def: 'as an exchange', example: 'A lower rate in return for a longer term. '.repeat(20) }], objections: [{ q: 'Why three years?', why: 'Risiko.', answers: ['Fair point.'] }], scene: { title: 'x'.repeat(2000) } },
  sceneId: null,
  debrief: [],
  lang: 'de',
  ...over,
});

describe('Monatsdokument meeting/<JJJJ-MM>', () => {
  it('Eingabe: Pflichtfelder, Kappung, Datum nur als JJJJ-MM-TT', () => {
    expect(cleanMeetingInput({ who: ' ', topic: 'x', tricky: '', notes: '', when: '' })).toBeNull();
    const c = cleanMeetingInput({ who: 'Oliver', topic: 't'.repeat(500), tricky: '', notes: '', when: 'morgen' });
    expect(c?.topic.length).toBe(300);
    expect(c?.when).toBe('');
    expect(cleanMeetingInput({ who: 'Oliver', topic: 'Rabatt', tricky: '', notes: '', when: '2026-10-02' })?.when).toBe('2026-10-02');
  });

  it('anlegen, gültig, Szene und Nachbesprechung nachtragen, Liste neueste zuerst', () => {
    expect(meetingPath('2026-09-27')).toBe('meeting/2026-09');
    const doc = (upsertMeetingItem(undefined, mItem(1)) as { set: Record<string, unknown> }).set;
    expect(validateDoc('meeting/2026-09', doc).ok).toBe(true);
    const two = { ...doc, items: (upsertMeetingItem(doc, mItem(2)) as { update: { items: unknown[] } }).update.items };
    const withScene = patchMeetingItem(two, mItem(1).id, (it) => ({ ...it, sceneId: 'sc-ai1' }));
    const items = (withScene as { update: { items: Array<Record<string, unknown>> } }).update.items;
    expect(items.find((x) => x.id === mItem(1).id)?.sceneId).toBe('sc-ai1');
    expect(patchMeetingItem(two, 'unbekannt', (it) => it)).toBeNull();
    expect(patchMeetingItem(undefined, mItem(1).id, (it) => it)).toBeNull();
    const list = listMeetings(new Map([['2026-09', { ...two, items }]]));
    expect(list.map((m) => m.id)).toEqual([mItem(2).id, mItem(1).id]);
    const read = readMeeting(list[1]);
    expect(read?.sceneId).toBe('sc-ai1');
    expect(read?.prep?.phrases[0]?.def).toBe('as an exchange');
    expect(readMeeting({ id: 'x', day: '2026-09-27' })).toBeNull();
  });

  it('ungültiges Dokument: weder Upsert noch Nachtrag; Vorbereitung als Feld lässt Szene und Nachbesprechung stehen', () => {
    const bad = { v: 1, month: '2026-09', items: [{ id: 5, who: 'x' }, { id: mItem(1).id, day: '2026-09-27' }] };
    expect(upsertMeetingItem(bad, mItem(2))).toBeNull();
    expect(patchMeetingItem(bad, mItem(1).id, (it) => ({ ...it, sceneId: 'sc' }))).toBeNull();
    const deb = [{ t: 1, want: 'w', en: 'We are on the same page.', phrase: 'on the same page', de: 'einig', def: 'agreeing', why: 'x' }];
    const doc = (upsertMeetingItem(undefined, mItem(1, { prep: null, sceneId: 'sc-ai1', debrief: deb })) as { set: Record<string, unknown> }).set;
    const prep = mItem(1).prep;
    const r = patchMeetingItem(doc, mItem(1).id, (it) => ({ ...it, prep }));
    const it0 = (r as { update: { items: Array<Record<string, unknown>> } }).update.items[0];
    expect(it0?.sceneId).toBe('sc-ai1');
    expect(it0?.debrief).toEqual(deb);
    expect(it0?.prep).toEqual(prep);
  });

  it('gekappt: Nachbesprechungen werden vor dem Entfernen ganzer Termine gekürzt; Entfernen wird gemeldet', () => {
    const e = (t: number) => ({ t, want: 'w'.repeat(300), en: 'e'.repeat(300), phrase: 'p', de: 'd', def: 'f', why: 'y'.repeat(200) });
    const many = Array.from({ length: 40 }, (_, i) => mItem(i, { prep: null, debrief: Array.from({ length: 24 }, (_, k) => e(k)) }));
    clearLog();
    const out = compactMeetings(many, '2026-09') as MeetingItem[];
    expect(out).toHaveLength(40);
    expect(out[0]?.debrief).toHaveLength(1);
    expect(getLog().some((l) => l.scope === 'compact:drop')).toBe(false);
    const dropped = compactList([{ x: 'a'.repeat(100) }, { x: 'b'.repeat(100) }], [], 150, (items) => ({ month: '2026-09', items }));
    expect(dropped).toHaveLength(1);
    expect(getLog().find((l) => l.scope === 'compact:drop')?.level).toBe('warn');
  });

  it('Nachbesprechung: angehängt, höchstens 24 je Termin, leer → nichts', () => {
    const e = (t: number) => ({ t, want: 'w', en: 'We are on the same page.', phrase: 'on the same page', de: 'einig', def: 'agreeing', why: 'x' });
    expect(withDebrief({ id: 'a' }, [])).toBeNull();
    const many = withDebrief({ id: 'a', debrief: Array.from({ length: 23 }, (_, i) => e(i)) }, [e(100), e(101)]);
    expect((many?.debrief as unknown[]).length).toBe(MEETING_DEBRIEF_MAX);
  });

  it('gekappt auf ≤ 200 KiB: zuerst die Szene, dann Einwände, dann die Vorbereitung der ältesten', () => {
    const many = Array.from({ length: 150 }, (_, i) => mItem(i));
    const out = compactMeetings(many, '2026-09') as MeetingItem[];
    expect(jsonBytes({ v: 1, month: '2026-09', items: out })).toBeLessThanOrEqual(MEETING_DOC_MAX_BYTES);
    expect(out.length).toBe(150);
    expect(out[0]?.prep?.scene ?? null).toBeNull();
    expect(out[149]?.prep?.scene).not.toBeNull();
    expect(out.every((m) => m.who === 'Partner in UK')).toBe(true);
  });
});

describe('Vorlagen und feste Antworten', () => {
  const sample = createFakeSample(() => 'ok', () => ({}), 0);
  beforeAll(() => registerCannedReplies());

  it('registriert, eindeutige Kennungen, Stufen wie vorgegeben', () => {
    const ids = TEMPLATES.map((t) => t.id);
    for (const id of ['fluency-check', 'meeting-prep', 'meeting-debrief']) expect(ids).toContain(id);
    expect(fluencyCheck.tier).toBe('default');
    expect(meetingPrep.tier).toBe('complex');
    expect(meetingDebrief.tier).toBe('default');
  });

  const rounds = [
    { sec: 90, text: 'The cloud is more cheaper than your server room. We are doing this since ten years and the most companies save money.' },
    { sec: 60, text: 'The cloud is cheaper. We have done this for ten years.' },
    { sec: 45, text: 'Cheaper, safer, and we know how.' },
  ];

  it('fluency-check@1: Kopfzeile, drei Runden im Rahmen, feste Antwort besteht das Schema (DE/EN), Fehler wörtlich', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v: FluencyCheckVars = { question: 'Why should a mid-sized company move its archive to the cloud?', rounds, uiLang };
      const p = fluencyCheck.build(v);
      expect(p.startsWith('[fluency-check@1]')).toBe(true);
      expect(p.match(/<<<TEXT/g)).toHaveLength(3);
      expect(p).toContain('British spelling and British words are ALWAYS correct');
      const r = fluencyCheckSchema(v).safeParse(await sample.json<unknown>(p));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      expect(r.data.missing).toHaveLength(2);
      expect(r.data.corrections.length).toBe(3);
      for (const c of r.data.corrections) expect(rounds.map((x) => x.text).join('\n')).toContain(c.wrong);
    }
  });

  it('fluency-check@1 tolerant: Wendung ohne Beispielsatz fällt weg, zu viele Fehler gekürzt, falsche Sprache abgelehnt', () => {
    const v = { uiLang: 'de' as const, rounds: [{ sec: 90, text: 'w0 w1 w2 w3 w4' }] };
    const bad = { phrase: 'the bottom line is', de: 'unterm Strich', def: 'the main point', example: 'This sentence does not have it.' };
    const good = { phrase: 'pay for itself', de: 'sich rechnen', def: 'to save as much as it costs', example: 'It will pay for itself.' };
    const four = Array.from({ length: 5 }, (_, i) => ({ wrong: `w${i}`, right: `r${i}`, why: 'Hier fehlt das Hilfsverb im Satz.' }));
    const r = fluencyCheckSchema(v).parse({ progress: 'Runde 3 ist deutlich knapper und klarer.', missing: [bad, good], corrections: four });
    expect(r.missing).toEqual([good]);
    expect(r.corrections).toHaveLength(3);
    expect(fluencyCheckSchema(v).safeParse({ progress: 'In round three you got to the point much faster.', missing: [], corrections: [] }).success).toBe(false);
  });

  it('fluency-check: nur Korrekturen, deren „wrong“ wörtlich in einer Runde steht', () => {
    const v = { uiLang: 'de' as const, rounds };
    const r = fluencyCheckSchema(v).parse({
      progress: 'Runde 3 ist deutlich knapper und klarer.',
      missing: [],
      corrections: [
        { wrong: 'more cheaper', right: 'cheaper', why: 'Doppelte Steigerung ist falsch.' },
        { wrong: 'we was very happy', right: 'we were very happy', why: 'Das steht in keiner Runde.' },
      ],
    });
    expect(r.corrections.map((c) => c.wrong)).toEqual(['more cheaper']);
  });

  it('Reparatur-Sätze mit Quelle fluency (ganzer eigener Satz)', () => {
    const all = rounds.map((x) => x.text).join('\n\n');
    const r = repairsFromCorrections(all, [{ wrong: 'more cheaper', right: 'cheaper', why: 'Doppelte Steigerung.' }], 'Why the cloud?', 'fluency');
    expect(r[0]).toMatchObject({ wrong: 'The cloud is more cheaper than your server room.', right: 'The cloud is cheaper than your server room.', src: 'fluency' });
    expect(addRepairs([], r, 1)?.[0]?.src).toBe('fluency');
    expect(roundBonus({ day: '2026-09-27', act: 'fluency', partial: false, n: 3, right: 3, activeMs: 195_000 })).toBe(15);
  });

  const prepVars = (uiLang: 'de' | 'en'): MeetingPrepVars => ({ ctx: 'Head of Business Development, cloud DMS', who: 'Partner in UK', topic: 'Er will Rabatt, ich will Laufzeit', tricky: 'Wettbewerber ist 15 % billiger', notes: 'Call am Donnerstag', uiLang });

  it('meeting-prep@1: Kopfzeile, Eingaben im Rahmen, feste Antwort besteht das Schema; jede Wendung steht im Beispielsatz', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v = prepVars(uiLang);
      const p = meetingPrep.build(v);
      expect(p.startsWith('[meeting-prep@1]')).toBe(true);
      expect(p).toContain('With whom: Partner in UK');
      expect(meetingPrep.cache).toBe(false);
      const r = meetingPrepSchema(v).safeParse(await sample.json<unknown>(p));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      expect(r.data.phrases.length).toBeGreaterThanOrEqual(6);
      expect(r.data.objections).toHaveLength(3);
      expect(r.data.scene.persona.name).toBeTruthy();
      // Jede Wendung ergibt eine Wendungs-Karte mit Ursprungssatz.
      for (const ph of r.data.phrases) {
        const made = newChunkDoc({ en: ph.en, de: ph.de, def: ph.def, kind: 'phrase', register: 'neutral', why: '', whyLang: uiLang, level: 'C1', src: { kind: 'meeting', ref: 'meeting/2026-09#mt-1', title: 'Partner', utterance: '', upgraded: ph.example }, nowMs: 1 });
        expect(made, ph.en).not.toBeNull();
      }
    }
  });

  it('meeting-prep@1: weniger als vier brauchbare Wendungen → ungültig (einmaliger Neuversuch des KI-Tors)', async () => {
    const out = JSON.parse(await sample(meetingPrep.build(prepVars('de'))).then((r) => r.text)) as { phrases: Array<{ example: string }> };
    out.phrases = out.phrases.map((x) => ({ ...x, example: 'This sentence has nothing in it at all.' }));
    expect(meetingPrepSchema({ uiLang: 'de' }).safeParse(out).success).toBe(false);
  });

  it('meeting-debrief@1: freie Eingabe auf Deutsch, feste Antwort besteht das Schema (DE/EN), Wendung steht im Satz', async () => {
    for (const uiLang of ['de', 'en'] as const) {
      const v: MeetingDebriefVars = { who: 'Partner in UK', topic: 'Rabatt gegen Laufzeit', want: 'Ich wollte sagen, dass Rabatt nur mit Laufzeit geht.\nUnd dass ich mich bis Freitag melde.', uiLang };
      const p = meetingDebrief.build(v);
      expect(p.startsWith('[meeting-debrief@1]')).toBe(true);
      expect(p).toContain('<<<TEXT');
      const r = meetingDebriefSchema(v).safeParse(await sample.json<unknown>(p));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      if (!r.success) continue;
      expect(r.data.items).toHaveLength(2);
      for (const it of r.data.items) expect(it.en.toLowerCase()).toContain(it.phrase.toLowerCase());
    }
  });

  it('meeting-debrief@1 tolerant: Wendung nicht im Satz → nur der Satz bleibt', () => {
    const r = meetingDebriefSchema({ uiLang: 'de' }).parse({ items: [{ want: 'Um Bedenkzeit bitten.', en: 'Let me think about it and come back to you.', phrase: 'not there', de: 'x', def: 'y', why: 'Klingt ruhig und verbindlich.' }] });
    expect(r.items[0]).toMatchObject({ phrase: '', de: '', def: '' });
  });
});
