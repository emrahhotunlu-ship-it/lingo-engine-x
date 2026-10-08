import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { dayKey } from '../../src/domain/date';
import { slotPlan, type PatInfo } from '../../src/domain/grammar/slotPlan';
import { isWrongLang } from '../../src/domain/lang/detect';
import { lastWeekOf, newFestWords, weekFacts } from '../../src/domain/progress/weekly';
import { bigNumber, teacherName, focusFor, focusOptions, focusTopicOf, focusWeekOf, readWf, teacherText, weeklyUse, weekly3, wfOp } from '../../src/domain/progress/weekly3';
import type { Confusion } from '../../src/domain/tutor/confusion';
import { patternsOf, topicsWithPatterns } from '../../src/domain/grammar/patterns';

// P50 (Lernplattform 3.0, Wochenrückblick 3.0): große Zahl, neu Feste, Text für den Lehrer (reines Englisch), Fokuswahl (wirkt erst ab dem nächsten Plan).
// Die Zeitumstellung ist der 25.10.2026 (die Woche vom 19. bis 25.10. hat einen Tag mit 25 Stunden).

type Doc = Record<string, unknown>;
const at = (iso: string): number => Date.parse(iso);
const hist = (rows: Array<[string, number]>): Doc[] => rows.map(([d, vu]) => ({ d, vu }));

describe('Fenster: die letzte abgeschlossene Woche über die Zeitumstellung', () => {
  it('am Montag 26.10. (04:00 und später) ist KW 43 (19.–25.10.) die letzte Woche; vor 04:00 noch KW 42', () => {
    expect(lastWeekOf(dayKey(at('2026-10-26T04:00:00+01:00'))).w).toBe('2026-W43');
    expect(lastWeekOf(dayKey(at('2026-10-26T03:59:00+01:00'))).w).toBe('2026-W42');
    const w = lastWeekOf('2026-10-26');
    expect(w.days[0]).toBe('2026-10-19');
    expect(w.days[6]).toBe('2026-10-25');
    expect(w.days).toHaveLength(7);
  });

  it('neu Fest am Tag der Zeitumstellung (ff = 25.10.) zählt in KW 43, ff am 26.10. nicht', () => {
    const days = lastWeekOf('2026-10-26').days;
    const vocab = new Map<string, Doc>([
      ['a', { word: 'alpha', ff: '2026-10-25' }],
      ['b', { word: 'beta', ff: '2026-10-26' }],
      ['c', { word: 'gamma', ff: '2026-10-19' }],
    ]);
    expect(newFestWords({ days, vocab }).map((w) => w.word)).toEqual(['gamma', 'alpha']);
  });
});

describe('große Zahl „+n fest“', () => {
  const days = lastWeekOf('2026-10-26').days;
  it('Wochenende gegen den Wert vor der Woche; negativ nach einer Pause', () => {
    expect(bigNumber(hist([['2026-10-18', 100], ['2026-10-25', 131]]), days, 5)).toEqual({ n: 31, src: 'vu' });
    expect(bigNumber(hist([['2026-10-17', 100], ['2026-10-22', 96]]), days, 0)).toEqual({ n: -4, src: 'vu' });
  });
  it('nimmt den letzten Wert der Woche und den letzten davor, nicht den ersten', () => {
    expect(bigNumber(hist([['2026-10-10', 80], ['2026-10-17', 100], ['2026-10-20', 110], ['2026-10-24', 120]]), days, 0)).toEqual({ n: 20, src: 'vu' });
    // Ein Vergleichswert, der mehr als 3 Tage vor der Woche liegt, ist kein Wochenvergleich.
    expect(bigNumber(hist([['2026-10-14', 100], ['2026-10-24', 120]]), days, 5)).toEqual({ n: 5, src: 'ff' });
  });
  it('ohne Vergleichswert gilt die Zahl der neu Festen (ff), sonst nichts', () => {
    expect(bigNumber(hist([['2026-10-25', 131]]), days, 4)).toEqual({ n: 4, src: 'ff' });
    expect(bigNumber(hist([['2026-09-01', 50], ['2026-10-25', 131]]), days, 4)).toEqual({ n: 4, src: 'ff' });
    expect(bigNumber(undefined, days, 0)).toBeNull();
    expect(bigNumber([{ d: 'kaputt', vu: 3 }, { d: '2026-10-25' }], days, 0)).toBeNull();
  });
});

describe('Text für den Lehrer (feste Vorlage, reines Englisch)', () => {
  const note = "This month I'm working on tenses: Past Simple versus Present Perfect. Could you create speaking situations where I need them?";

  it('erste Zeile die Kapitel-Notiz, darunter der Wochentext; alle Teile', () => {
    const t = teacherText({
      note,
      practiced: ['wish + past perfect', 'mixed conditionals', 'inversion', 'fourth'],
      fest: ['leverage', 'upsell', 'churn', 'onboarding', 'roadmap', 'sunset', 'pivot'],
      tricky: { names: ['the definite article', 'the indefinite article'], example: { q: 'We need ___ approval.', given: 'the', ans: 'an' } },
    });
    const [first, second] = t.split('\n\n');
    expect(first).toBe(note);
    expect(second).toContain('This week I worked on wish + past perfect, mixed conditionals, and inversion.');
    expect(second).not.toContain('fourth');
    expect(second).toContain('Words and phrases I can now recall reliably: leverage, upsell, churn, onboarding, roadmap, and 2 more.');
    expect(second).toContain('Still tricky: the definite article versus the indefinite article. For example, in "We need ___ approval." I wrote "the" instead of "an".');
    expect(second).toMatch(/Could we practice this in our next lesson, maybe in a short role-play\?$/);
    expect(t.split('\n\n')).toHaveLength(2);
  });

  it('fehlt ein Teil, entfällt seine Zeile; ohne Inhalt bleibt nur die Notiz; ohne alles leer', () => {
    expect(teacherText({ note, practiced: [], fest: [], tricky: null })).toBe(note);
    expect(teacherText({ note: null, practiced: [], fest: [], tricky: null })).toBe('');
    const t = teacherText({ note: null, practiced: ['inversion'], fest: [], tricky: null });
    expect(t).toBe('This week I worked on inversion.');
    expect(t).not.toContain('Could we practice');
  });

  it('ein Beispiel mit deutscher oder unsinniger Antwort wird weggelassen, der Rest bleibt', () => {
    const t = teacherText({ note: null, practiced: [], fest: [], tricky: { names: ['present perfect'], example: { q: 'We ___ the report yet.', given: 'haben nicht fertig gemacht heute', ans: 'have not finished' } } });
    expect(t).toContain('Still tricky: present perfect.');
    expect(t).not.toContain('For example');
    const quoted = teacherText({ note: null, practiced: [], fest: [], tricky: { names: ['present perfect'], example: { q: 'He said "yes".', given: 'x', ans: 'y' } } });
    expect(quoted).not.toContain('For example');
  });

  it('ein nicht belegtes Paar behauptet keine Verwechslung', () => {
    const t = teacherText({ note: null, practiced: [], fest: [], tricky: { names: ['the definite article', 'the indefinite article'], example: null, confirmed: false } });
    expect(t).toContain('Still tricky: the definite article, especially how it differs from the indefinite article.');
    expect(t).not.toContain('versus');
    expect(teacherText({ note: null, practiced: [], fest: [], tricky: { names: ['a', 'b'], example: null, confirmed: true } })).toContain('Still tricky: a versus b.');
  });

  it('Sprachtest: reines Englisch, kein Deutsch, kein „verfehlt“, kein Ausrufezeichen, nie Selbstkritik', () => {
    const t = teacherText({
      note,
      practiced: ['wish + past perfect'],
      fest: ['leverage', 'roadmap'],
      tricky: { names: ['the definite article', 'the indefinite article'], example: { q: 'We need ___ approval.', given: 'the', ans: 'an' } },
    });
    expect(isWrongLang(t, 'en')).toBe(false);
    expect(t).not.toMatch(/[äöüÄÖÜß]/);
    expect(t).not.toMatch(/verfehl|!/i);
    expect(t).not.toMatch(/\b(und|der|die|das|nicht|ich|diese|woche)\b/i);
  });
});

describe('Fokus: Wahl, Woche, Wirkung erst ab dem nächsten Plan', () => {
  it('wfOp: ersetzt nur den Eintrag derselben Woche, löscht nie, keine Obergrenze, keine Änderung → null', () => {
    const t0 = at('2026-10-26T09:00:00+01:00');
    const a = wfOp({}, { w: '2026-W44', a: 'art.definite', t: t0 });
    expect(a).toEqual({ wf: [{ w: '2026-W44', a: 'art.definite', t: t0 }] });
    const cur = { wf: a?.wf };
    expect(wfOp(cur, { w: '2026-W44', a: 'art.definite', t: t0 + 1000 })).toBeNull();
    const b = wfOp(cur, { w: '2026-W44', a: 'art.zero', t: t0 + 2000 });
    expect(b?.wf).toEqual([{ w: '2026-W44', a: 'art.zero', t: t0 + 2000 }]);
    // „Die App entscheidet“ = leere Musterkennung; ohne vorherige Wahl ist das keine Änderung.
    expect(wfOp({}, { w: '2026-W44', a: '', t: t0 })).toBeNull();
    expect(wfOp(cur, { w: '2026-W44', a: '', t: t0 + 3000 })?.wf).toEqual([{ w: '2026-W44', a: '', t: t0 + 3000 }]);
    // Nur `wf` wird geschrieben: der gespeicherte Plan (`plan`) bleibt unberührt.
    expect(Object.keys(b ?? {})).toEqual(['wf']);
    // Nichts gelöscht: 20 Wochen bleiben alle stehen.
    let doc: Doc = {};
    for (let k = 0; k < 20; k++) doc = { ...doc, ...(wfOp(doc, { w: `2026-W${String(10 + k).padStart(2, '0')}`, a: 'art.zero', t: t0 + k * 1000 }) ?? {}) };
    expect(readWf(doc.wf)).toHaveLength(20);
    expect((doc.wf as unknown[]).length).toBe(20);
  });

  it('wfOp: unbekannte Felder und unlesbare Einträge bleiben, nur der Eintrag der Woche wird per Spread geändert', () => {
    const t0 = at('2026-10-26T09:00:00+01:00');
    const junk = [null, 'x', { w: 'kaputt', t: 1 }];
    const old = { w: '2026-W43', a: 'art.zero', t: t0 - 7 * 86_400_000, fremd: { k: 1 } };
    const mine = { w: '2026-W44', a: 'art.definite', t: t0, notiz: 'bleibt' };
    const doc = { wf: [...junk, old, mine] };
    const r = wfOp(doc, { w: '2026-W44', a: 'art.zero', t: t0 + 5000 });
    expect(r?.wf).toEqual([...junk, old, { ...mine, a: 'art.zero', t: t0 + 5000 }]);
    const add = wfOp(doc, { w: '2026-W45', a: 'art.zero', t: t0 + 9000 });
    expect(add?.wf).toEqual([...junk, old, mine, { w: '2026-W45', a: 'art.zero', t: t0 + 9000 }]);
  });

  it('readWf liest tolerant (kaputte Einträge fallen weg)', () => {
    expect(readWf('x')).toEqual([]);
    expect(readWf([{ w: 'kaputt', a: 'x', t: 1 }, { w: '2026-W44', a: 'art.zero' }, { w: '2026-W44', a: 'art.zero', t: 5 }, null])).toEqual([{ w: '2026-W44', a: 'art.zero', t: 5 }]);
  });

  it('die Wahl zählt für die Woche, in der sie fällt; ab Sonntag für die kommende', () => {
    expect(focusWeekOf('2026-10-24')).toBe('2026-W43'); // Samstag
    expect(focusWeekOf('2026-10-25')).toBe('2026-W44'); // Sonntag (Tag der Zeitumstellung) → kommende Woche
    expect(focusWeekOf('2026-10-26')).toBe('2026-W44'); // Montag
  });

  it('gespeicherter Plan von heute bleibt eingefroren: nur Pläne, die NACH der Wahl angelegt wurden, bekommen den Fokus', () => {
    const t = at('2026-10-27T10:00:00+01:00');
    const wf = [{ w: '2026-W44', a: 'art.definite', t }];
    const day = '2026-10-27';
    // Plan von heute wurde um 08:00 angelegt: vor der Wahl.
    expect(focusFor(wf, { planAt: at('2026-10-27T08:00:00+01:00'), day })).toBeNull();
    // Plan von morgen (Mi, 05:00) wird nach der Wahl angelegt.
    expect(focusFor(wf, { planAt: at('2026-10-28T05:00:00+01:00'), day: '2026-10-28' })).toBe('art.definite');
    // Ohne gespeicherten Plan, bei „Die App entscheidet“, andere Woche, unbekanntes Muster: kein Fokus.
    expect(focusFor(wf, { planAt: null, day })).toBeNull();
    expect(focusFor([{ w: '2026-W44', a: '', t }], { planAt: t + 1, day })).toBeNull();
    expect(focusFor(wf, { planAt: t + 1, day: '2026-11-02' })).toBeNull();
    expect(focusFor([{ w: '2026-W44', a: 'fake.pattern', t }], { planAt: t + 1, day })).toBeNull();
    expect(focusTopicOf('art.definite')).toBe('articles');
    expect(focusTopicOf(null)).toBeNull();
  });

  it('Grenze 04:00: eine Wahl um 03:50 gehört zum Vortag (Sonntag → kommende Woche), ein Plan um 03:55 noch zum Sonntag, einer um 05:00 zum Montag', () => {
    const tChosen = at('2026-10-26T03:50:00+01:00');
    expect(dayKey(tChosen)).toBe('2026-10-25');
    const wf = [{ w: focusWeekOf(dayKey(tChosen)), a: 'art.definite', t: tChosen }];
    expect(wf[0]?.w).toBe('2026-W44');
    expect(focusFor(wf, { planAt: at('2026-10-26T03:55:00+01:00'), day: dayKey(at('2026-10-26T03:55:00+01:00')) })).toBeNull();
    expect(focusFor(wf, { planAt: at('2026-10-26T05:00:00+01:00'), day: dayKey(at('2026-10-26T05:00:00+01:00')) })).toBe('art.definite');
  });

  it('der Fokus belegt Platz 3 der Prioritätstabelle, aber nur mit Fokus; ohne bleibt der Plan, wie er war (slotPlan mit eingefrorenen Eingaben)', () => {
    const pats: PatInfo[] = ['art.definite', 'art.indefinite', 'art.zero', 'art.fixed', 'art.sound'].map((id, k) => ({ id, chapter: 0, entry: { n: 5 + k, c: 3, last: at('2026-10-20T10:00:00+02:00') + k * 1000, i: '2026-10-01', r: 0, k: 0, dd: [] } }));
    const base = { n: 6, ctx: 'duty' as const, weekday: 3, today: '2026-10-28', pats, seed: 'seed-1' };
    const without = slotPlan({ ...base, focus: null });
    const frozen = slotPlan({ ...base, focus: focusFor([{ w: '2026-W44', a: 'art.fixed', t: at('2026-10-28T10:00:00+01:00') }], { planAt: at('2026-10-28T08:00:00+01:00'), day: '2026-10-28' }) });
    expect(frozen).toEqual(without);
    const chosen = slotPlan({ ...base, focus: focusFor([{ w: '2026-W44', a: 'art.fixed', t: at('2026-10-27T10:00:00+01:00') }], { planAt: at('2026-10-28T08:00:00+01:00'), day: '2026-10-28' }) });
    const third = chosen[2];
    expect(third).toMatchObject({ role: 'focus', pat: 'art.fixed' });
  });
});

describe('Vorschläge für den Fokus', () => {
  const grammar = new Map<string, Doc>([
    ['articles', { pats: { 'art.definite': { n: 10, c: 4, last: 3000, i: '2026-10-01' }, 'art.indefinite': { n: 8, c: 3, last: 2000, i: '2026-10-01' }, 'art.zero': { n: 6, c: 6, r: 31, k: 5, dd: ['2026-10-10', '2026-10-12'], s: '2026-10-12', last: 4000, i: '2026-10-01' } } }],
  ]);
  const pair = { a: 'art.indefinite', b: 'art.definite', n: 4, confirmed: true, weeks: [0, 1, 1, 2] as [number, number, number, number], ex: [] };

  it('A = Verwechslungspaar, B = schwächstes Muster des Kapitels (nicht dasselbe); sonst zwei schwache Muster; nur eingeführte', () => {
    const o = focusOptions({ grammar, today: '2026-10-27', confusion: { pairs: [pair] } });
    expect(o).toHaveLength(2);
    expect(o[0]).toMatchObject({ id: 'confusion', pat: 'art.indefinite', other: 'art.definite', confirmed: true });
    const un = focusOptions({ grammar, today: '2026-10-27', confusion: { pairs: [{ ...pair, confirmed: false }] } });
    expect(un[0]).toMatchObject({ id: 'confusion', confirmed: false });
    expect(o[1]).toMatchObject({ id: 'weak', pat: 'art.definite' });
    expect(typeof o[1]?.chapter).toBe('number');
    const w = focusOptions({ grammar, today: '2026-10-27', confusion: null });
    expect(w.map((x) => x.id)).toEqual(['weak', 'weak']);
    expect(new Set(w.map((x) => x.pat)).size).toBe(2);
    // Nicht eingeführte Muster stehen nie zur Wahl; ein Paar mit unbekanntem Muster auch nicht.
    expect(focusOptions({ grammar: new Map(), today: '2026-10-27', confusion: { pairs: [pair] } })).toEqual([]);
    expect(focusOptions({ grammar, today: '2026-10-27', confusion: { pairs: [{ ...pair, a: 'dip.hoping' }] } }).every((x) => x.pat !== 'dip.hoping')).toBe(true);
  });
});

describe('Einsatz-Satz und Gesamtbild', () => {
  it('ein Satz je Kalenderwoche, im Wechsel; ohne Kapitel nichts', () => {
    const a = weeklyUse(0, '2026-W43');
    const b = weeklyUse(0, '2026-W44');
    expect(a?.sentence).toBeTruthy();
    expect(b?.sentence).toBeTruthy();
    expect(a?.sentence).not.toBe(b?.sentence);
    expect(weeklyUse(99, '2026-W43')).toBeNull();
  });

  it('weekly3: Zahl, Namen, Text und Vorschläge aus einem Aufruf; ohne Daten ohne Zahl, aber mit Kapitel-Notiz', () => {
    const today = '2026-10-26';
    const vocab = new Map<string, Doc>([['a', { word: 'leverage', ff: '2026-10-22' }]]);
    const chunk = new Map<string, Doc>([['x', { en: 'on the same page', ff: '2026-10-20' }]]);
    const grammar = new Map<string, Doc>([['articles', { pats: { 'art.definite': { n: 10, c: 9, last: at('2026-10-21T10:00:00+02:00'), i: '2026-10-01', s: '2026-10-21', r: 31, k: 5, dd: ['2026-10-20', '2026-10-21'] } } }]]);
    const conf: Confusion = { window: { from: '', to: '', prevFrom: '', prevTo: '' }, pairs: [], pats: [{ pat: 'art.definite', n: 10, w: 4, prevN: 0, prevW: 0, weeks: [0, 1, 1, 2] }], lines: [], ids: [], allowed: [], mapped: 4 };
    const w = weekly3({ today, nowMs: at('2026-10-26T10:00:00+01:00'), vocab, chunk, grammar, profile: { history: hist([['2026-10-18', 200], ['2026-10-25', 203]]) }, confusion: conf, fixed: 2 });
    expect(w.w).toBe('2026-W43');
    expect(w.big).toEqual({ n: 3, src: 'vu' });
    expect(w.fest.map((f) => f.label)).toEqual(['on the same page', 'leverage']);
    expect(w.patternsSafe).toEqual(['art.definite']);
    expect(w.fixed).toBe(2);
    expect(w.teacher).toContain('This week I worked on');
    expect(w.teacher).toContain('Still tricky:');
    expect(isWrongLang(w.teacher, 'en')).toBe(false);
    const empty = weekly3({ today, nowMs: at('2026-10-26T10:00:00+01:00'), vocab: new Map(), chunk: new Map(), grammar: new Map(), profile: {}, confusion: null, fixed: 0 });
    expect(empty.big).toBeNull();
    expect(empty.fest).toEqual([]);
    expect(empty.options).toEqual([]);
  });

  it('weekFacts über die Zeitumstellung: ff am 25.10. in KW 43', () => {
    const days = lastWeekOf('2026-10-26').days;
    const f = weekFacts({ days, vocab: new Map([['a', { word: 'alpha', ff: '2026-10-25' }]]), grammar: new Map(), writing: new Map(), talk: new Map(), profile: {} });
    expect(f.map((x) => x.id)).toEqual(['vw:a']);
  });
});

describe('Wortwahl: nie „verfehlt“, nie Ausrufezeichen', () => {
  it('kein Text der Oberfläche (DE und EN) enthält „verfehlt“ in den neuen Bereichen', () => {
    const mine = (o: Record<string, string>): string[] => Object.entries(o).filter(([k]) => /^(moWk|ttDx)/.test(k)).map(([, v]) => v);
    const all = [...mine(de), ...mine(en)];
    expect(all.length).toBeGreaterThan(40);
    expect(all.filter((v) => /verfehl|!/i.test(v))).toEqual([]);
  });
});

describe('Namen für den Lehrer', () => {
  it('bei keinem Kontrastpaar des Kurses sind die beiden Namen gleich, und keiner ist leer', () => {
    const pairs: Array<[string, string]> = [];
    for (const topic of topicsWithPatterns()) {
      for (const p of patternsOf(topic)?.patterns ?? []) {
        const w = p.contrast?.with;
        if (w) pairs.push([p.id, w.includes(':') ? w.slice(w.indexOf(':') + 1) : w]);
      }
    }
    expect(pairs.length).toBeGreaterThan(20);
    const same = pairs.filter(([a, b]) => teacherName(a) === teacherName(b));
    expect(same).toEqual([]);
    for (const [a, b] of pairs) {
      expect(teacherName(a).length).toBeGreaterThan(1);
      expect(teacherName(b).length).toBeGreaterThan(1);
    }
  });

  it('Form und Verwendung bleiben zusammen: „the · unique things“ wird „the (unique things)“', () => {
    expect(teacherName('art.the-unique')).not.toBe(teacherName('art.definite'));
    expect(teacherName('unbekannt.id')).toBe('unbekannt.id');
  });
});
