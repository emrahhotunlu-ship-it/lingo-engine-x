import { describe, expect, it } from 'vitest';
import { trapById } from '../../src/content/nb/traps';
import { dueErrors } from '../../src/domain/grammar/errors';
import {
  againChecks,
  againSource,
  buildFocus,
  checkFocus,
  corrections,
  FOCUS_MAIN,
  fixedNow,
  focusSolution,
  repairSrcOf,
  sentenceAt,
  unitRepairs,
  type FixLike,
  type FocusTask,
} from '../../src/domain/repair/unit';

// Blöcke 4 und 5 der Tageseinheit (plan.md §1.5, N41/N42; Prüfung M4b/c, M6, M9, S4).

const DAY = '2026-09-28';
const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-09-28T10:00:00+02:00');

const FIX_TRAP: FixLike = { kind: 'trap', mine: 'Please send me the actual version.', right: 'Please send me the current version.', why: '„actual“ heißt „tatsächlich“.', trapId: 'f01' };
const FIX_FORM: FixLike = { kind: 'form', mine: 'He go to the office.', right: 'He goes to the office.', why: '3. Person: -s.' };

function grammarDocs(n = 3): Map<string, Record<string, unknown>> {
  const errors = [
    { q: 'She ___ (work) here since May.', given: 'works', ans: 'has worked', t: NOW - 3 * DAY_MS, src: 'duty' },
    { q: 'By June, I ___ my course.', given: 'finish', ans: 'will have finished', t: NOW - 4 * DAY_MS, src: 'duty' },
    { q: 'If I ___ (know), I would have called.', given: 'knew', ans: 'had known', t: NOW - 5 * DAY_MS, src: 'duty' },
  ].slice(0, n);
  return new Map([['future-forms', { errors }]]);
}

const kinds = (tasks: readonly FocusTask[]) => tasks.map((t) => t.kind);

describe('Block 4: Aufgaben', () => {
  it('Korrekturen zuerst; eine Fallen-Korrektur bekommt den Mini-Drill mit 3 Sätzen der Falle; auf 3 Hauptaufgaben aufgefüllt', () => {
    const tasks = buildFocus({ day: DAY, task: { text: 'x', fixes: [FIX_FORM, FIX_TRAP] }, due: dueErrors(grammarDocs(), NOW) });
    // Falle vor Form (Bedeutung > Falle > Ziel > Form), danach der Mini-Drill, dann die zweite Korrektur, dann ein fälliger Fehler.
    expect(kinds(tasks)).toEqual(['fix', 'trap', 'trap', 'trap', 'fix', 'grammar']);
    const first = tasks[0]!;
    expect(first.kind === 'fix' && first.trapId).toBe('f01');
    const drill = tasks.slice(1, 4);
    expect(drill.every((t) => t.kind === 'trap' && t.trapId === 'f01' && t.drill)).toBe(true);
    expect(drill.map((t) => (t.kind === 'trap' ? t.wrong : ''))).toEqual(trapById('f01')!.drills.map((d) => d.wrong));
    expect(tasks.filter((t) => !(t.kind === 'trap' && t.drill))).toHaveLength(FOCUS_MAIN);
  });

  it('erkennt die Falle auch ohne trapId im falschen Text', () => {
    const tasks = buildFocus({ day: DAY, task: { text: 'x', fixes: [{ ...FIX_TRAP, trapId: undefined, kind: 'form' }] }, due: [] });
    expect(tasks[0]?.kind === 'fix' && tasks[0].trapId).toBe('f01');
    expect(tasks.filter((t) => t.kind === 'trap' && t.drill)).toHaveLength(3);
  });

  it('ohne Korrekturen (ohne KI): Fallen im eigenen Text, danach fällige Fehler (M4b, M6)', () => {
    const text = 'Hi Anna. Did you become my email? I will send the actual version tomorrow.';
    const tasks = buildFocus({ day: DAY, task: { text, fixes: [] }, due: dueErrors(grammarDocs(), NOW) });
    const own = tasks.filter((t) => t.kind === 'own');
    expect(own.map((t) => (t.kind === 'own' ? t.trapId : ''))).toEqual(['f03', 'f01']);
    expect(own[0]?.kind === 'own' && own[0].sentence).toBe('Did you become my email?');
    // Mini-Drill nach der ersten Falle, dann die zweite, dann ein fälliger Fehler.
    expect(kinds(tasks)).toEqual(['own', 'trap', 'trap', 'trap', 'own', 'grammar']);
  });

  it('nichts von Block 3: immer 3 Aufgaben – fällige Fehler, dann Fallensätze der Woche', () => {
    const two = buildFocus({ day: DAY, task: null, due: dueErrors(grammarDocs(2), NOW), weekTraps: ['f05', 'p-own-1'] });
    expect(kinds(two)).toEqual(['grammar', 'grammar', 'trap']);
    expect(two[2]?.kind === 'trap' && two[2].trapId).toBe('f05');
    const none = buildFocus({ day: DAY, task: null, due: [] });
    expect(none).toHaveLength(3);
    expect(none.every((t) => t.kind === 'trap' && !t.drill)).toBe(true);
    expect(new Set(none.map((t) => t.id)).size).toBe(3);
    // Derselbe Tag ergibt dieselben Sätze (nichts neu würfeln, Kap. 15).
    expect(buildFocus({ day: DAY, task: null, due: [] }).map((t) => t.id)).toEqual(none.map((t) => t.id));
  });

  it('zweites Gerät ohne ctx.task: die Reparatur-Sätze von heute sind die Korrekturen', () => {
    const repairDoc = {
      items: [
        { id: 'r1', wrong: 'We discussed about the price.', right: 'We discussed the price.', why: 'discuss ohne about', src: 'say', t: NOW - 60_000, box: 0, due: NOW + DAY_MS },
        { id: 'r2', wrong: 'Old sentence.', right: 'Older sentence.', src: 'say', t: NOW - 3 * DAY_MS, box: 0, due: NOW },
      ],
    };
    const fixes = corrections({ day: DAY, task: null, repairDoc });
    expect(fixes.map((f) => f.mine)).toEqual(['We discussed about the price.']);
    const tasks = buildFocus({ day: DAY, task: null, repairDoc, due: [] });
    expect(tasks[0]?.kind).toBe('fix');
  });

  it('gleiche Korrektur nur einmal, höchstens 3', () => {
    const fixes = corrections({ day: DAY, task: { text: '', fixes: [FIX_FORM, FIX_FORM, FIX_TRAP, { ...FIX_FORM, mine: 'a b', right: 'a c' }, { ...FIX_FORM, mine: 'd e', right: 'd f' }] } });
    expect(fixes).toHaveLength(3);
    expect(new Set(fixes.map((f) => f.mine)).size).toBe(3);
  });

  it('Satz um eine Stelle', () => {
    expect(sentenceAt('One. Two three? Four', 6)).toBe('Two three?');
    expect(sentenceAt('No end here', 3)).toBe('No end here');
  });
});

describe('Block 4: Prüfen', () => {
  it('Korrektur: exakt richtig, UK-Form richtig, alte Form falsch', () => {
    const t = buildFocus({ day: DAY, task: { text: 'x', fixes: [FIX_FORM] }, due: [] })[0]!;
    if (t.kind !== 'fix') throw new Error('fix erwartet');
    expect(checkFocus(t, 'He goes to the office.')).toBe('ok');
    expect(checkFocus(t, 'He go to the office.')).toBe('wrong');
    expect(checkFocus(t, '')).toBe('wrong');
    expect(focusSolution(t)).toBe('He goes to the office.');
  });

  it('Fallensatz: jede erlaubte Lösung zählt', () => {
    const trap = trapById('f01')!;
    const t: FocusTask = { kind: 'trap', id: 'x', trapId: 'f01', wrong: trap.drills[0]!.wrong, right: trap.drills[0]!.right, n: 1, of: 3, drill: true };
    expect(checkFocus(t, trap.drills[0]!.right[1]!)).toBe('ok');
    expect(checkFocus(t, trap.drills[0]!.wrong)).toBe('wrong');
  });

  it('eigener Satz ohne KI: Falle weg = ungeprüft gespeichert, Falle noch drin = falsch', () => {
    const t: FocusTask = { kind: 'own', id: 'own:f03', sentence: 'Did you become my email?', match: 'become my email', trapId: 'f03' };
    expect(checkFocus(t, 'Did you get my email?')).toBe('unchecked');
    expect(checkFocus(t, 'Did you become my email?')).toBe('wrong');
    expect(focusSolution(t)).toBe(trapById('f03')!.right);
  });
});

describe('Block 5: Nochmal, aber besser', () => {
  it('bessere Fassung aus Block 3; je Korrektur lokal „jetzt richtig?“ (S4)', () => {
    const src = againSource({ day: DAY, task: { text: 'He go to the office. Please send me the actual version.', better: 'He goes to the office. Please send me the current version.', fixes: [FIX_FORM, FIX_TRAP] } });
    expect(src.betterFrom).toBe('task');
    const checks = againChecks('He goes to the office every day. Please send me the actual version.', src.fixes);
    expect(checks.map((c) => [c.fix.kind, c.ok])).toEqual([
      ['trap', false],
      ['form', true],
    ]);
  });

  it('ohne KI: Startsatz-Lösung der Falle im Text; ohne Falle keine bessere Fassung', () => {
    const src = againSource({ day: DAY, task: { text: 'Did you become my email?', fixes: [] } });
    expect(src).toMatchObject({ better: trapById('f03')!.right, betterFrom: 'trap', fixes: [] });
    expect(againSource({ day: DAY, task: { text: 'All good here.', fixes: [] } }).better).toBeNull();
  });

  it('fixedNow: richtige Stelle da, falsche weg; Ergänzung eines Worts zählt', () => {
    expect(fixedNow('We discussed the price.', { mine: 'discussed about the price', right: 'discussed the price' })).toBe(true);
    expect(fixedNow('We discussed about the price.', { mine: 'discussed about the price', right: 'discussed the price' })).toBe(false);
    expect(fixedNow('explain it to me', { mine: 'explain me', right: 'explain it to me' })).toBe(true);
  });

  it('Reparatur-Karten nur aus belegten Korrekturen und verpassten Startsatz-Sätzen – nie aus eigenem Text (M4c)', () => {
    const trap = trapById('f03')!;
    const out = unitRepairs({ fixes: [FIX_FORM], src: repairSrcOf('task.say'), missedTraps: [{ trapId: 'f03', wrong: trap.drills[0]!.wrong, right: trap.drills[0]!.right }], lang: 'de' });
    expect(out).toEqual([
      { wrong: FIX_FORM.mine, right: FIX_FORM.right, why: FIX_FORM.why, src: 'say' },
      { wrong: trap.drills[0]!.wrong, right: trap.drills[0]!.right[0], why: trap.why.de, src: 'pattern', ctx: trap.title.en },
    ]);
    expect(unitRepairs({ fixes: [], src: 'say', lang: 'de' })).toEqual([]);
    expect(repairSrcOf('task.tones')).toBe('tone');
    expect(repairSrcOf(undefined)).toBe('say');
  });
});
