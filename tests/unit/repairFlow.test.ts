import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { entryCardKey, repairLogEntry } from '../../src/domain/progress/logPatch';
import { checkRepairLocal, wordDistance } from '../../src/domain/repair/check';
import { pickDailyRepairs, repairsDoneToday, repairsDutyToday, repairStats, REPAIR_PER_DAY } from '../../src/domain/repair/daily';
import { addRepairs, repairId, reviewRepair, type RepairItem } from '../../src/domain/repair/repair';
import { repairsFromPreply, repairsFromTalk, repairsFromText, repairsFromWriting, splitSentences } from '../../src/domain/repair/sources';
import { repairCheckReply } from '../../src/platform/dev/canned/repairCheck';
import { repairCheck } from '../../src/prompts/repairCheck';
import { TEMPLATES } from '../../src/prompts/registry';

const DAY = 86_400_000;
const T = 1_790_000_000_000;

describe('Reparatur-Sätze: Quellen (V2)', () => {
  it('Sätze trennen, auch ohne Schlusszeichen und über Zeilen', () => {
    expect(splitSentences('Hi there. We must delay it!\nThanks').map((s) => s.text)).toEqual(['Hi there.', 'We must delay it!', 'Thanks']);
  });

  it('Text: nur der betroffene Satz, alle Korrekturen darin, Stil fällt weg', () => {
    const r = repairsFromText(
      'Hello Anna. We are working on it since two years and I look forward to hear from you. Best regards.',
      [
        { wrong: 'are working', right: 'have been working', why: 'Dauer bis jetzt.', cat: 'grammar' },
        { wrong: 'since two years', right: 'for two years', why: 'Zeitraum → for.', cat: 'grammar' },
        { wrong: 'Best regards', right: 'Kind regards', why: 'Ton.', cat: 'register' },
        { wrong: 'nicht im Text', right: 'x', cat: 'grammar' },
      ],
      'write',
      'Mail',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      wrong: 'We are working on it since two years and I look forward to hear from you.',
      right: 'We have been working on it for two years and I look forward to hear from you.',
      why: 'Dauer bis jetzt. Zeitraum → for.',
      src: 'write',
      fix: ['have been working', 'for two years'],
    });
  });

  it('Gespräch: nur fertige, englische Analysen mit Fehlern; Großschreibung bleibt', () => {
    const turns = [
      { role: 'persona', text: 'Why?' },
      { role: 'me', text: 'We must delay the start.' },
      { role: 'persona', text: 'Hm.' },
      { role: 'me', text: 'I think so.' },
      { role: 'me', text: 'Das ist schwer.' },
    ];
    const analyses = {
      1: { state: 'done', data: { english: true, errors: [{ wrong: 'We must', right: 'we need to', cat: 'modals-deduction', why: 'Klingt wie ein Befehl.' }] } },
      3: { state: 'done', data: { english: true, errors: [{ wrong: 'I think', right: 'In my view', cat: 'register', why: 'Ton.' }] } },
      4: { state: 'done', data: { english: false, errors: [] } },
    };
    const r = repairsFromTalk(turns, analyses, 'Delay talk');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ wrong: 'We must delay the start.', right: 'We need to delay the start.', src: 'talk', ctx: 'Delay talk' });
  });

  it('Schreiben und Preply', () => {
    expect(repairsFromWriting('It depends of the budget.', [{ orig: 'depends of', fix: 'depends on', cat: 'collocation', why: 'depend on' }], 'Mail')[0]?.right).toBe('It depends on the budget.');
    const p = repairsFromPreply(
      [
        { wrong: 'It depends of the budget.', right: 'It depends on the budget.', why: 'depend on' },
        { wrong: 'Same.', right: 'same', why: '' },
      ],
      [1, 0, 0, 5],
      'Stunde',
    );
    expect(p).toEqual([{ wrong: 'It depends of the budget.', right: 'It depends on the budget.', why: 'depend on', src: 'preply', ctx: 'Stunde' }]);
  });

  it('korrigierte Stellen werden mitgespeichert und gelesen (Schema)', () => {
    const l = addRepairs([], [{ wrong: 'We must delay it.', right: 'We need to delay it.', src: 'talk', fix: ['need to', 'nicht drin'] }], T)!;
    expect(l[0]!.fix).toEqual(['need to']);
    expect(validateDoc('app/repair', { items: l }).ok).toBe(true);
  });
});

describe('Reparatur-Sätze: lokale Prüfung', () => {
  const item = { wrong: 'We are working on it since two years.', right: 'We have been working on it for two years.', fix: ['have been working', 'for two years'] };
  it('gleich nach Normalisierung → exact', () => {
    expect(checkRepairLocal('we have been working on it for two years', item)).toBe('exact');
  });
  it('kleine Abweichung, korrigierte Stelle stimmt → close', () => {
    expect(checkRepairLocal("We've been working on it for two years now.", { ...item, fix: ['for two years'] })).toBe('close');
    expect(checkRepairLocal('We have been working on this for two years.', item)).toBe('close');
  });
  it('Fehler noch drin oder zu weit weg → no', () => {
    expect(checkRepairLocal('We are working on it since two years.', item)).toBe('no');
    expect(checkRepairLocal('We have been working on it since two years.', item)).toBe('no');
    expect(checkRepairLocal('Something completely different here today.', item)).toBe('no');
    expect(checkRepairLocal('', item)).toBe('no');
  });
  it('ohne gespeicherte Stellen: aus dem Unterschied abgeleitet; britisch gilt', () => {
    const it2 = { wrong: 'We must organise the meeting.', right: 'We need to organize the meeting.' };
    expect(checkRepairLocal('We need to organise the meeting.', it2)).toBe('exact');
    expect(checkRepairLocal('We need to organize this meeting.', it2)).toBe('close');
    expect(checkRepairLocal('We need to organize this new big meeting.', it2)).toBe('no');
    expect(checkRepairLocal('We must organize the meeting.', it2)).toBe('no');
  });
  it('Wortabstand', () => {
    expect(wordDistance(['a', 'b', 'c'], ['a', 'x', 'c', 'd'])).toBe(2);
  });
});

describe('Reparatur-Sätze: tägliche Wiederholung und Stand', () => {
  const list: RepairItem[] = Array.from({ length: 6 }, (_, i) => ({ id: repairId(`w${i}`), wrong: `w${i} x`, right: `r${i} y`, src: 'talk' as const, t: T, box: 0, due: T + i }));
  it('höchstens 4 je Tag, älteste zuerst, heute geübte zählen mit', () => {
    const doc = { items: list };
    expect(pickDailyRepairs(doc, T + DAY, new Set())).toHaveLength(REPAIR_PER_DAY);
    expect(pickDailyRepairs(doc, T + DAY, new Set([list[0]!.id])).map((e) => e.id)).toEqual([list[1]!.id, list[2]!.id, list[3]!.id]);
    expect(pickDailyRepairs(doc, T + DAY, new Set(), 2)).toHaveLength(2);
    expect(pickDailyRepairs(doc, T - 2 * DAY, new Set())).toHaveLength(0);
    expect(pickDailyRepairs(null, T, new Set())).toEqual([]);
  });
  it('freiwillige Runde (xtra) verbraucht den Pflicht-Platz nicht', () => {
    const doc = { items: list };
    const xtra = list.slice(0, 5).map((e) => repairLogEntry({ t: T, ok: true, lang: 'de', id: e.id, q: 'a', given: 'b', ans: 'c', g: 3, ms: 1, ctx: 'xtra' }));
    expect(repairsDutyToday(xtra).size).toBe(0);
    expect(repairsDoneToday(xtra).size).toBe(5);
    // geübte Sätze kommen nicht doppelt, Platz bleibt aber voll
    const picked = pickDailyRepairs(doc, T + DAY, repairsDoneToday(xtra), REPAIR_PER_DAY, repairsDutyToday(xtra));
    expect(picked.map((e) => e.id)).toEqual([list[5]!.id]);
  });
  it('Protokoll: zählt als Karte „repair/<id>“ zu Wiederholen', () => {
    const e = repairLogEntry({ t: T, ok: true, lang: 'de', id: 'rabc', q: 'old', given: 'new', ans: 'better', g: 3, ms: 1200, ctx: 'rev' });
    expect(entryCardKey(e)).toBe('repair/rabc');
    expect([...repairsDoneToday([e, { type: 'chunk', id: 'x' }])]).toEqual(['rabc']);
    expect(validateDoc('log/2026-09-27', { date: '2026-09-27', entries: [e] }).ok).toBe(true);
  });
  it('Stand: offen und sicher', () => {
    let l = addRepairs([], [{ wrong: 'a b', right: 'c d', src: 'say' }, { wrong: 'e f', right: 'g h', src: 'say' }], T)!;
    const id = l[0]!.id;
    for (const d of [1, 4, 13]) l = reviewRepair(l, id, true, T + d * DAY)!;
    expect(repairStats({ items: l })).toEqual({ open: 1, safe: 1 });
    expect(repairStats(undefined)).toEqual({ open: 0, safe: 0 });
  });
});

describe('repair-check@1', () => {
  const vars = (given: string, uiLang: 'de' | 'en' = 'de') => ({ wrong: 'We must delay the start.', right: 'We need to delay the start.', why: 'Klingt wie ein Befehl.', given, uiLang });
  it('registriert, quick, Kopfzeile, Datenzeilen', () => {
    expect(TEMPLATES.map((t) => t.id)).toContain('repair-check');
    const p = repairCheck.build(vars('We have to delay the start.'));
    expect(p.split('\n')[0]).toBe('[repair-check@1]');
    expect(repairCheck.tier).toBe('quick');
    expect(p).toMatch(/^Learner rewrite: We have to delay the start\.$/m);
  });
  it('feste Antwort besteht das Schema, in der Sprache der Oberfläche', () => {
    for (const lang of ['de', 'en'] as const) {
      const ok = repairCheck.schema(vars('x', lang)).safeParse(JSON.parse(repairCheckReply(repairCheck.build(vars('We have to delay the start.', lang)))));
      expect(ok.success && ok.data.ok).toBe(true);
      const no = repairCheck.schema(vars('x', lang)).safeParse(JSON.parse(repairCheckReply(repairCheck.build(vars('We must delay the start.', lang)))));
      expect(no.success && no.data.ok).toBe(false);
    }
    expect(repairCheck.schema(vars('x')).safeParse({ ok: 'yes', note: 'Der Fehler ist behoben, alles gut.' }).success).toBe(true);
  });
});
