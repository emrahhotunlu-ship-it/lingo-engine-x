import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { checkRepairLocal, isUnchanged } from '../../src/domain/repair/check';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { heldRepairRows, newlyGated, repairGate, type GateInput } from '../../src/domain/repair/gate';
import { dueRepairs, readRepairs, type RepairItem } from '../../src/domain/repair/repair';
import { sampleFile } from '../../src/domain/tutor/quality';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { getLog } from '../../src/platform/diagnostics';

// Eintritts-Wächter für Fehlersätze (Rückmeldung Emrah 19.10.2026, Live v81): „by Friday“ war für eine Frist richtig, der gespeicherte Eintrag
// verlangte „until Friday“, die unveränderte Antwort hieß „Fast richtig“ und die Begründung („Subjekt … Rechtschreibfehler“) passte nicht.

const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
const { saveRepairs, holdGatedRepairs } = await import('../../src/features/repair/store');

/** Emrahs Eintrag, wie er gespeichert war (Gold-Fall). */
const EMRAH: GateInput = {
  wrong: 'Hi John, the list with the document types is needed by friday, otherwise the project start will have a delay.',
  right: 'Hi John, the list with the document types is needed until friday, otherwise the project start will have a delay.',
  why: 'Das Subjekt „list“ ist Singular, daher „is“. Rechtschreibfehler.',
  src: 'say',
};

describe('repairGate: Gold-Fall Emrah (by → until bei Frist)', () => {
  it('sperrt den Eintrag als umgedrehte Regel', () => {
    expect(repairGate(EMRAH)).toEqual({ reason: 'reverse_rule', detail: 'l1:bis-by-until' });
  });
  it('sperrt ihn auch, wenn der Originalsatz zusätzlich „are“ hatte (echter Fehler + falsche Korrektur)', () => {
    expect(repairGate({ ...EMRAH, wrong: EMRAH.wrong.replace('is needed', 'are needed') })?.reason).toBe('reverse_rule');
  });
  it('ohne die Frist-Regel fällt die unpassende Begründung auf (Wortwechsel, Begründung nennt nur Subjekt und Rechtschreibung)', () => {
    const hit = repairGate({ ...EMRAH, wrong: EMRAH.wrong.replace('by friday', 'on friday'), right: EMRAH.right.replace('until friday', 'by friday') });
    expect(hit).toEqual({ reason: 'why_mismatch', detail: 'on→by' });
  });
});

describe('repairGate: Gegenbeispiele bleiben vorlegbar', () => {
  const ok: GateInput[] = [
    // Richtige Richtung: until → by bei einer Frist.
    { wrong: 'Please send the contract until Friday.', right: 'Please send the contract by Friday.', why: '„bis“ als Frist heißt „by“.', src: 'say' },
    // Dauer: until ist richtig, by war falsch.
    { wrong: 'The office is closed by Friday.', right: 'The office is closed until Friday.', why: 'Bis dahin andauernd: until.', src: 'say' },
    { wrong: 'We have to wait by Monday for the answer.', right: 'We have to wait until Monday for the answer.', why: 'wait until', src: 'write' },
    // Verneinung: not … until („erst“).
    { wrong: "We won't know the result by Friday.", right: "We won't know the result until Friday.", why: 'not until = erst', src: 'talk' },
    // Kongruenz mit passender Begründung.
    { wrong: 'The list with the document types are needed by Friday.', right: 'The list with the document types is needed by Friday.', why: 'Das Subjekt „list“ ist Singular, daher „is“.', src: 'say' },
    // Tippfehler mit Tippfehler-Begründung.
    { wrong: 'We will recieve the invoice next week.', right: 'We will receive the invoice next week.', why: 'Rechtschreibfehler.', src: 'write' },
    // Freie Begründung, die das Wort nicht wörtlich nennt: wird nicht beurteilt.
    { wrong: 'I am working here since three years.', right: 'I have been working here for three years.', why: 'Zeitraum bis jetzt: Present Perfect Continuous mit Dauer.', src: 'say' },
  ];
  for (const c of ok) it(c.wrong, () => expect(repairGate(c)).toBeNull());

  it('Lehrer-Korrekturen werden nicht geprüft', () => {
    expect(repairGate({ ...EMRAH, src: 'teacher' })).toBeNull();
    expect(repairGate({ ...EMRAH, src: 'preply' })).toBeNull();
  });
});

describe('repairGate: weitere Gründe', () => {
  it('„richtige“ Fassung mit bekanntem Übertragungsfehler (l1)', () => {
    expect(repairGate({ wrong: 'We discussed the price with them.', right: 'We discussed about the price with them.', why: null, src: 'say' })).toEqual({ reason: 'right_l1', detail: 'l1:discuss-about' });
  });
  it('„richtige“ Fassung mit eindeutigem Fehler (Selbstprüfung, für ältere Einträge)', () => {
    expect(repairGate({ wrong: 'The list of documents were sent.', right: 'The list of documents are ready now.', why: null, src: 'write' })?.reason).toBe('right_error');
  });
  it('Tippfehler-Begründung bei einem Präpositionstausch', () => {
    expect(repairGate({ wrong: 'We will meet on the office tomorrow.', right: 'We will meet in the office tomorrow.', why: 'Spelling mistake.', src: 'write' })).toEqual({ reason: 'why_mismatch', detail: 'on→in' });
    expect(repairGate({ wrong: 'We will meet on the office tomorrow.', right: 'We will meet in the office tomorrow.', why: '„in the office“: im Gebäude.', src: 'write' })).toBeNull();
  });
});

const item = (over: Partial<RepairItem> & Pick<RepairItem, 'wrong' | 'right'>): RepairItem => ({ id: `r-${over.wrong.length}`, src: 'say', t: 1, box: 0, due: 0, ...over });

describe('Vorlegen: gesperrte Einträge kommen nicht, ohne gelöscht zu werden', () => {
  const now = Date.parse('2026-10-19T10:00:00+02:00');
  const bad = item({ id: 'rbad', wrong: EMRAH.wrong, right: EMRAH.right, why: EMRAH.why!, t: now - 3 * 86_400_000 });
  const good = item({ id: 'rgood', wrong: 'The list are needed by Friday.', right: 'The list is needed by Friday.', why: 'list ist Singular: is', t: now - 3 * 86_400_000 });
  const heldOk = item({ id: 'rheld', wrong: 'We need it by Monday at noon.', right: 'We need it by Monday at noon, please.', held: { r: 'why_mismatch', t: 5 }, t: now - 3 * 86_400_000 });

  it('dueRepairs und dueFehlersaetze lassen sie aus', () => {
    expect(dueRepairs([bad, good, heldOk], now).map((e) => e.id)).toEqual(['rgood']);
    const list = dueFehlersaetze({ grammarDocs: new Map(), repairDoc: { items: [bad, good, heldOk] }, nowMs: now, today: '2026-10-19' });
    expect(list.map((f) => f.id)).toEqual(['rgood']);
  });
  it('newlyGated nennt nur offene Einträge ohne Merker; die Lehrer-Liste zeigt beide', () => {
    expect(newlyGated([bad, good, heldOk]).map((x) => x.id)).toEqual(['rbad']);
    expect(heldRepairRows([bad, good, heldOk]).map((r) => [r.id, r.reason])).toEqual([
      ['rbad', 'reverse_rule'],
      ['rheld', 'why_mismatch'],
    ]);
  });
  it('die Stichproben-Datei trägt die zurückgehaltenen Sätze', () => {
    const f = sampleFile(now, [], heldRepairRows([bad]));
    const body = JSON.parse(f.data) as { heldRepairs?: Array<{ wrong: string; reason: string }> };
    expect(body.heldRepairs?.[0]).toMatchObject({ wrong: EMRAH.wrong, reason: 'reverse_rule' });
  });
});

describe('Unveränderte Antwort', () => {
  it('ist nie bestanden, auch nicht „Fast richtig“', () => {
    expect(isUnchanged(EMRAH.wrong, EMRAH.wrong)).toBe(true);
    expect(isUnchanged(`  ${EMRAH.wrong.toUpperCase().replace(/[.,]/g, '')} `, EMRAH.wrong)).toBe(true);
    expect(checkRepairLocal(EMRAH.wrong, { wrong: EMRAH.wrong, right: EMRAH.right })).toBe('no');
    expect(checkRepairLocal(EMRAH.wrong, { wrong: EMRAH.wrong, right: EMRAH.right, fix: ['is'] })).toBe('no');
  });
  it('eine echte Änderung ist nicht „unverändert“', () => {
    expect(isUnchanged(EMRAH.right, EMRAH.wrong)).toBe(false);
    expect(isUnchanged('', EMRAH.wrong)).toBe(false);
  });
});

describe('Schreibwege: Anlegen und Vorlegen stellen still ruhend', () => {
  let h: MemoryDbHandle;
  const items = (): Array<Record<string, unknown>> => ((h.dump()['app/repair'] as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []);
  beforeEach(() => {
    h = createMemoryDb({ seed: {} });
    holder.writer = createWriter(h.db);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    holder.writer = null;
  });

  it('saveRepairs speichert den fragwürdigen Eintrag mit Merker und meldet ihn im Protokoll', async () => {
    expect(await saveRepairs([{ wrong: EMRAH.wrong, right: EMRAH.right, why: EMRAH.why ?? null, src: 'say' }])).toBe(true);
    const [e] = items();
    expect(e).toMatchObject({ wrong: EMRAH.wrong, right: EMRAH.right, box: 0, held: { r: 'reverse_rule', d: 'l1:bis-by-until' } });
    expect(getLog().some((l) => l.scope === 'repair:gate' && l.code === 'reverse_rule')).toBe(true);
    expect(dueRepairs(readRepairs({ items: items() }), Date.now() + 5 * 86_400_000)).toEqual([]);
  });

  it('holdGatedRepairs setzt den Merker an einem alten Eintrag, ohne Box, Fälligkeit oder andere Einträge zu ändern', async () => {
    const old = { id: 'rold', wrong: EMRAH.wrong, right: EMRAH.right, why: EMRAH.why, src: 'say', t: 10, box: 1, due: 20, extra: 'bleibt' };
    const fine = { id: 'rfine', wrong: 'The list are needed by Friday.', right: 'The list is needed by Friday.', src: 'say', t: 10, box: 0, due: 20 };
    await holder.writer!.set('app/repair', { items: [old, fine] });
    expect(await holdGatedRepairs({ items: [old, fine] })).toBe(true);
    const [a, b] = items();
    expect(a).toMatchObject({ id: 'rold', box: 1, due: 20, extra: 'bleibt', held: { r: 'reverse_rule' } });
    expect(b).toEqual(fine);
    // Idempotent: ein zweiter Lauf schreibt nichts mehr.
    const before = JSON.stringify(items());
    expect(await holdGatedRepairs({ items: items() })).toBe(true);
    expect(JSON.stringify(items())).toBe(before);
  });
});
