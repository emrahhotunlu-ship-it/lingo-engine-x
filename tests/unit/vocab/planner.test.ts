import { vmodDayWriteSchema } from '../../../src/modules/vocab/data/schemas';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayStartOf } from '../../../src/domain/date';
import { dayWeight, pickDay } from '../../../src/modules/vocab/domain/balance';
import { capDays } from '../../../src/modules/vocab/domain/cap';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan, MIN_NEW } from '../../../src/modules/vocab/domain/day';
import { corridor, fuzzRange } from '../../../src/modules/vocab/domain/fuzz';
import { FORM_SPEC, gradeOf } from '../../../src/modules/vocab/domain/grade';
import { type Answer, applyAnswer, emptyLex, evidencePlans, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { book, newTrack, retr } from '../../../src/modules/vocab/domain/tracks';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';

// Wörter-Modul V1, Planer (plan.md §4; Abnahme V1 in §10: Planer, Geschwister, Fuzz-Korridor nach Ankis Testwerten, nie über dem Deckel,
// Lastausgleich, eine Buchung je Tag; Methoden M1, M7, M8, M10, M11, M15, M77).

const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });
const ans = (t: number, over: Partial<Answer> = {}): Answer => ({ t, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'x#0', ...over });

/** Ein Lexem, eingeführt und mit erster Buchung (Schritt B) am Tag `t`. */
function learned(t = T0): Lex {
  let l = introduce(emptyLex('w', 'edge', t), t);
  l = applyAnswer(l, ans(t + 60_000, { form: 'gap_hint' }), ctx()).lex; // Schritt A bucht nicht
  l = applyAnswer(l, ans(t + 300_000), ctx()).lex; // Schritt B bucht
  return l;
}

describe('ts-fsrs ist exakt 5.4.2 (M1)', () => {
  it('package.json ohne ^ oder ~', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '../../../package.json'), 'utf8')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['ts-fsrs']).toBe('5.4.2');
  });
});

describe('Fuzz-Korridor (M10)', () => {
  it('Ankis Testwerte: 7 → 5–9, 17 → 14–20, 37 → 33–41', () => {
    expect(fuzzRange(7)).toEqual([5, 9]);
    expect(fuzzRange(17)).toEqual([14, 20]);
    expect(fuzzRange(37)).toEqual([33, 41]);
    expect(fuzzRange(2)).toEqual([2, 2]);
  });
  it('mit Deckel einseitig, nie über dem Deckel; Deckel 1 ohne Streuung', () => {
    expect(corridor(10, 1)).toEqual([1, 1]);
    for (const cap of [3, 7, 21])
      for (let ivl = 1; ivl <= 80; ivl++) {
        const [lo, hi] = corridor(ivl, cap);
        expect(hi).toBeLessThanOrEqual(cap);
        expect(lo).toBeGreaterThanOrEqual(1);
        if (ivl >= cap) expect(hi).toBe(cap);
      }
  });
  it('gleiche Eingabe → gleicher Tag (100 Wiederholungen)', () => {
    const x = { lo: 5, hi: 9, load: (i: number) => i, siblings: new Set<number>(), seed: 'vocab/a|b|3' };
    const first = pickDay(x);
    for (let i = 0; i < 100; i++) expect(pickDay(x)).toBe(first);
  });
});

describe('Lastausgleich in Minuten, Geschwister, Ruhetag (M8, M11)', () => {
  it('meidet den vollen Tag', () => {
    const load = (i: number) => (i === 6 ? 30 : 2);
    const picks = Array.from({ length: 200 }, (_, k) => pickDay({ lo: 5, hi: 7, load, siblings: new Set(), seed: `s${k}` }));
    expect(picks.filter((d) => d === 6).length).toBeLessThan(10);
  });
  it('Geschwister: nie am selben Tag, wenn ein anderer Tag frei ist; Nachbartage gedämpft', () => {
    const picks = Array.from({ length: 300 }, (_, k) => pickDay({ lo: 4, hi: 9, load: () => 1, siblings: new Set([6]), seed: `g${k}` }));
    expect(picks.includes(6)).toBe(false);
    expect(dayWeight(5, { lo: 4, hi: 9, load: () => 1, siblings: new Set([6]), seed: '' })).toBeLessThan(dayWeight(9, { lo: 4, hi: 9, load: () => 1, siblings: new Set([6]), seed: '' }) * 0.3 * (9 / 5));
  });
  it('Ruhetag bekommt fast nichts (≤ 25 % des Mittels)', () => {
    const picks = Array.from({ length: 400 }, (_, k) => pickDay({ lo: 4, hi: 9, load: () => 1, siblings: new Set(), rest: (i) => i === 7, seed: `r${k}` }));
    expect(picks.filter((d) => d === 7).length).toBeLessThanOrEqual(0.25 * (400 / 6));
  });
});

describe('Abstands-Deckel 1 / 3 / 7 / 21 (M77)', () => {
  it('nach Tagen mit freiem Abruf', () => {
    const l = emptyLex('w', 'edge', T0);
    expect(capDays({ ...l, ev: { f: [], o: 0, s: 0 } })).toBe(1);
    expect(capDays({ ...l, ev: { f: ['2026-11-03'], o: 0, s: 0 } })).toBe(3);
    expect(capDays({ ...l, ev: { f: ['a', 'b'], o: 0, s: 0 } })).toBe(7);
    expect(capDays({ ...l, ev: { f: ['a', 'b', 'c', 'd'], o: 0, s: 0 } })).toBe(21);
    expect(capDays({ ...l, lv: 6, ev: { f: [], o: 0, s: 0 } })).toBeNull();
  });
  it('kein Termin über dem Deckel (Folgetag nach der Einführung, M77)', () => {
    const l = learned();
    expect(l.b).not.toBeNull();
    expect(dayKey(l.b!.due)).toBe(addDays(dayKey(T0), 1));
    expect(dayKey(l.u.due) <= addDays(dayKey(T0), 1)).toBe(true);
  });
});

describe('Eine Buchung je Spur und Lerntag (plan.md §4.2 Nr. 2)', () => {
  it('drei Antworten am selben Tag → genau ein reps++', () => {
    let l = learned(T0 - 5 * D);
    const t = T0;
    const reps0 = l.b!.reps;
    for (let k = 0; k < 3; k++) l = applyAnswer(l, ans(t + k * 60_000), ctx()).lex;
    expect(l.b!.reps).toBe(reps0 + 1);
  });
  it('4 × Again an einem Tag → dasselbe d wie 1 × Again', () => {
    const base = learned(T0 - 5 * D);
    let one = applyAnswer(base, ans(T0, { outcome: 'wrong' }), ctx()).lex;
    let four = base;
    for (let k = 0; k < 4; k++) four = applyAnswer(four, ans(T0 + k * 60_000, { outcome: 'wrong' }), ctx()).lex;
    expect(four.b!.d).toBe(one.b!.d);
    expect(four.u.d).toBe(one.u.d);
    one = four;
    expect(one.b!.due).toBeLessThanOrEqual(dayStartOf(addDays(dayKey(T0), 1)));
  });
  it('Schritt A bucht nie; die erste Buchung ist Schritt B', () => {
    let l = introduce(emptyLex('w', 'edge', T0), T0);
    l = applyAnswer(l, ans(T0 + 60_000, { form: 'gap_hint' }), ctx()).lex;
    expect(l.u.reps).toBe(0);
    expect(l.b).toBeNull();
    const r = applyAnswer(l, ans(T0 + 300_000), ctx());
    expect(r.booked).toEqual(['b', 'u']);
    expect(r.lex.lv).toBe(3);
  });
  it('ohne Planwirkung (N2): keine Buchung, nur Verlauf', () => {
    const base = learned(T0 - 5 * D);
    const r = applyAnswer(base, ans(T0), ctx({ planned: false }));
    expect(r.booked).toEqual([]);
    expect(r.note).toBe(0);
    expect(r.lex.b).toEqual(base.b);
  });
});

describe('Zwei Spuren, Kopplung nur nach oben (M7)', () => {
  it('Good auf Benutzen bucht Good auf Verstehen; Again auf Benutzen bucht auf Verstehen nichts', () => {
    const base = learned(T0 - 5 * D);
    const good = applyAnswer(base, ans(T0), ctx());
    expect(good.booked).toEqual(['b', 'u']);
    const bad = applyAnswer(base, ans(T0, { outcome: 'wrong' }), ctx());
    expect(bad.booked).toEqual(['b']);
    expect(bad.lex.u).toEqual(base.u);
  });
  it('Ausnahme „anderes Wort“: Again auch auf Verstehen', () => {
    const r = applyAnswer(learned(T0 - 5 * D), ans(T0, { outcome: 'other' }), ctx());
    expect(r.booked).toEqual(['b', 'u']);
  });
  it('Verstehen zählt nie für Benutzen; Auswahl ändert FSRS nie', () => {
    const base = learned(T0 - 5 * D);
    const m = applyAnswer(base, ans(T0, { form: 'meaning' }), ctx());
    expect(m.booked).toEqual(['u']);
    expect(m.lex.b).toEqual(base.b);
    const c = applyAnswer(base, ans(T0, { form: 'choice' }), ctx());
    expect(c.booked).toEqual([]);
    expect(c.lex.u).toEqual(base.u);
    expect(c.lex.b).toEqual(base.b);
  });
  it('Anki-Runde (F3) wirkt nur auf Verstehen, setzt nur dayU; Benutzen am selben Tag bleibt möglich', () => {
    const base = learned(T0 - 5 * D);
    const a = applyAnswer(base, ans(T0, { form: 'flip', self: 3 }), ctx());
    expect(a.booked).toEqual(['u']);
    expect(a.lex.dayU).toBe(dayKey(T0));
    expect(a.lex.day).toBe(base.day);
    const b = applyAnswer(a.lex, ans(T0 + 60_000), ctx());
    expect(b.booked).toEqual(['b']); // Verstehen heute schon gebucht (dayU)
  });
  it('Anki „Nochmal“: die Wiederholung kurz danach bucht Benutzen nicht und senkt die Stufe nicht ein zweites Mal', () => {
    const base = learned(T0 - 5 * D);
    const a = applyAnswer(base, ans(T0, { form: 'flip', self: 1 }), ctx());
    expect(a.booked).toEqual(['u']);
    expect(a.lex.step?.n).toBeGreaterThanOrEqual(10);
    const ok = applyAnswer(a.lex, ans(T0 + 120_000), ctx());
    expect(ok.booked).toEqual([]);
    expect(ok.lex.b).toEqual(a.lex.b);
    const bad = applyAnswer(a.lex, ans(T0 + 120_000, { outcome: 'wrong' }), ctx());
    expect(bad.booked).toEqual([]);
    expect(bad.lex.lv).toBe(a.lex.lv);
    expect(bad.lex.lc).toBe(a.lex.lc);
  });
  it('3 Sätze eines Lexems ergeben genau 1 Plan-Eintrag je Spur (M6)', () => {
    const l = learned(T0 - 3 * D);
    const cat = new Catalog([{ path: 'vocab/x', lex: { ...l, sn: [['x#0', '2026-10-30'], ['x#1', '2026-10-31'], ['x#2', '2026-11-01']] }, order: 1 }]);
    const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    expect(plan.plan.filter((e) => e[0] === 'vocab/x')).toHaveLength(1);
  });
});

describe('Vorgezogen gleitend (M15)', () => {
  it('früher Abruf → kleinerer Stabilitätszuwachs als fälliger', () => {
    const t = book(newTrack(T0), 3, T0, 0.9).track;
    const tt = book(t, 3, T0 + 6 * D, 0.9).track;
    const early = book(tt, 3, (tt.last as number) + 1 * D, 0.9).track;
    const onTime = book(tt, 3, tt.due, 0.9).track;
    expect(early.s).toBeLessThan(onTime.s);
    expect(retr(tt, tt.due)).toBeGreaterThan(0.85);
  });
});

describe('Note und Spur je Form (plan.md §5)', () => {
  it('Auswahl und Einführung haben keine Spur; Lücke mit Anfangsbuchstabe höchstens Hard', () => {
    expect(FORM_SPEC.choice.track).toBeNull();
    expect(gradeOf({ form: 'gap_hint', outcome: 'ok', hint: 0 })).toBe(2);
    expect(gradeOf({ form: 'gap', outcome: 'ok', hint: 1 })).toBe(2);
    expect(gradeOf({ form: 'gap', outcome: 'typo', hint: 0 })).toBe(2);
    expect(gradeOf({ form: 'gap', outcome: 'syn', hint: 0 })).toBeNull();
    expect(gradeOf({ form: 'listen', outcome: 'ok', hint: 0, speed: 'fast', easyOk: true })).toBe(3);
    expect(gradeOf({ form: 'gap', outcome: 'colloc', hint: 0, isColloc: true })).toBe(1);
    expect(gradeOf({ form: 'gap', outcome: 'colloc', hint: 0, isColloc: false })).toBe(2);
  });
});

describe('Lernschritte (M9, Regel)', () => {
  it('nach Fehler Wiederkehr, höchstens 4 Versuche je Tag, danach morgen ohne Stufenverlust', () => {
    let l = learned(T0 - 5 * D);
    l = { ...l, lv: 4 };
    let r = applyAnswer(l, ans(T0, { outcome: 'wrong' }), ctx());
    expect(r.lex.lv).toBe(3);
    expect(r.lex.step?.n).toBe(11);
    for (let k = 1; k < 4; k++) r = applyAnswer(r.lex, ans(T0 + k * 60_000, { outcome: 'wrong' }), ctx());
    expect(r.lex.step).toBeNull();
    expect(r.lex.lv).toBe(3); // weitere Fehler am selben Tag kosten keine Stufe
  });
});

describe('Abstieg kürzt die Belege (learning-scientist V1, Befund 7)', () => {
  it('Stufe 3 mit 3 Beleg-Tagen, Fehler → Stufe 2, ev.f leer, Deckel 1', () => {
    const l = { ...learned(T0 - 20 * D), lv: 3, ev: { f: ['2026-10-20', '2026-10-24', '2026-10-28'], o: 0, s: 0 } };
    const r = applyAnswer(l, ans(T0, { outcome: 'wrong' }), ctx());
    expect(r.lex.lv).toBe(2);
    expect(r.lex.ev.f).toEqual([]);
    expect(capDays(r.lex)).toBe(1);
  });
});

describe('Tagesplan (M12, M13, M21)', () => {
  const mk = (n: number, dueOffset: number, pri: Lex['pri'] = 'edge') =>
    Array.from({ length: n }, (_, i) => {
      const l = learned(T0 - 10 * D);
      return { path: `vocab/w${pri}${dueOffset}-${i}`, lex: { ...l, pri, u: { ...l.u, due: T0 + dueOffset * D }, b: { ...l.b!, due: T0 + dueOffset * D } }, order: i };
    });
  const fresh = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `vocab/new-${i}`, lex: emptyLex('w', 'edge', T0), order: 1000 + i }));

  it('mindestens 2 neue, auch bei großem Rückstand', () => {
    const cat = new Catalog([...mk(200, -3), ...fresh(10)]);
    const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    expect(plan.fresh).toBe(MIN_NEW);
  });
  it('Kontingent 0 → keine neuen', () => {
    const cat = new Catalog([...mk(5, -1), ...fresh(10)]);
    expect(buildDayPlan(cat, T0, { ...DEFAULT_CFG, newPerDay: 0 }, {}).plan.fresh).toBe(0);
  });
  it('Rückstand: höchstens 2 Tagesbudgets; nur Randwörter werden verschoben, Kernwörter zuerst', () => {
    const cat = new Catalog([...mk(60, -3, 'core'), ...mk(140, -3, 'edge'), ...fresh(3)]);
    const { plan, moves } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    expect(plan.min).toBeLessThanOrEqual(2 * DEFAULT_CFG.min + 0.1);
    expect(moves.length).toBeGreaterThan(0);
    for (const m of moves) expect(m.path).toMatch(/edge/);
    const corePlanned = plan.plan.filter((e) => e[0].includes('core')).length;
    expect(corePlanned).toBe(60);
    for (const m of moves) expect(m.to > dayKey(T0) && m.to <= addDays(dayKey(T0), 7)).toBe(true);
    // Start-Bildschirm (V3 Schritt 4): `sp` zählt den ganzen Rückstand je Lerntag (Verschobene am Zieltag, nicht verschobene morgen).
    const sp = plan.sp ?? [];
    expect(sp.reduce((a, x) => a + x[1], 0)).toBe(200 - plan.due);
    for (const [d] of sp) expect(d > dayKey(T0) && d <= addDays(dayKey(T0), 7)).toBe(true);
    expect(vmodDayWriteSchema.safeParse({ v: 1, ...plan }).success).toBe(true);
  });
  it('ohne Rückstand kein `sp`', () => {
    expect(buildDayPlan(new Catalog([...mk(5, -1), ...fresh(3)]), T0, DEFAULT_CFG, {}).plan.sp).toBeUndefined();
  });
  it('Neuzeichnen würfelt nicht: gleicher Stand → gleicher Plan (Kap. 15)', () => {
    const cat = new Catalog([...mk(30, -1), ...fresh(8)]);
    expect(buildDayPlan(cat, T0, DEFAULT_CFG, {}).plan).toEqual(buildDayPlan(cat, T0 + 3_600_000, DEFAULT_CFG, {}).plan);
  });
  it('nie Kollokation am Einführungstag ihres Kernworts, nie zwei verwechselbare neue', () => {
    const a = { path: 'vocab/decision', lex: emptyLex('w', 'edge', T0), order: 1 };
    const b = { path: 'vocab/make-a-decision', lex: { ...emptyLex('col', 'edge', T0), core: 'vocab/decision' }, order: 2 };
    const c = { path: 'vocab/affect', lex: { ...emptyLex('w', 'edge', T0), pair: 'vocab/effect' }, order: 3 };
    const d = { path: 'vocab/effect', lex: emptyLex('w', 'edge', T0), order: 4 };
    const { plan } = buildDayPlan(new Catalog([a, b, c, d]), T0, DEFAULT_CFG, {});
    const ids = plan.plan.filter((e) => e[1] === 'n').map((e) => e[0]);
    expect(ids).toContain('vocab/decision');
    expect(ids).not.toContain('vocab/make-a-decision');
    expect(ids.includes('vocab/affect') && ids.includes('vocab/effect')).toBe(false);
  });
});

describe('reportEvidence: Planwirkung nur unter vier Bedingungen (plan.md §2.2)', () => {
  const l = learned(T0 - 10 * D);
  it('vorgegebenes Wort (cued), nicht getippt, gesehen → keine Planwirkung', () => {
    expect(evidencePlans(l, { kind: 'used', typed: true, cued: true, t: T0 })).toBe(false);
    expect(evidencePlans(l, { kind: 'used', typed: false, cued: false, t: T0 })).toBe(false);
    expect(evidencePlans(l, { kind: 'seen', typed: true, cued: false, t: T0 })).toBe(false);
  });
  it('getippt, frei, heute ohne Buchung, R < 0,95 → Planwirkung; heute schon gebucht → keine', () => {
    expect(evidencePlans(l, { kind: 'recalled', typed: true, cued: false, t: T0 })).toBe(true);
    expect(evidencePlans({ ...l, day: dayKey(T0) }, { kind: 'recalled', typed: true, cued: false, t: T0 })).toBe(false);
  });
});

describe('Kontrastkarte lex.ct (M14, V3 Schritt 3)', () => {
  it('Verwechslung mit einem anderen Wort öffnet eine Kontrastkarte; „Das wusste ich eigentlich“ nicht', () => {
    const r = applyAnswer(learned(T0 - 5 * D), ans(T0, { outcome: 'other', hit: 'become' }), ctx());
    expect(r.lex.ct).toEqual({ at: T0, w: 'become' });
    const o = applyAnswer(learned(T0 - 5 * D), ans(T0, { outcome: 'other', hit: 'become', flags: 2 }), ctx());
    expect(o.lex.ct).toBeUndefined();
  });
  it('die Kontrastkarte selbst: keine Note, keine Buchung, Plan unverändert, Karte danach geschlossen', () => {
    const l = { ...learned(T0 - 5 * D), ct: { at: T0 - D, w: 'become' } };
    const r = applyAnswer(l, ans(T0, { form: 'contrast', outcome: 'wrong' }), ctx());
    expect(r.grade).toBeNull();
    expect(r.booked).toEqual([]);
    expect(r.lex.ct).toBeUndefined();
    expect([r.lex.u, r.lex.b, r.lex.lv, r.lex.lc, r.lex.day]).toEqual([l.u, l.b, l.lv, l.lc, l.day]);
  });
  it('Kontrastkarte falsch: Termin höchstens morgen (Verwechslung besteht weiter); richtig: Termin unverändert', () => {
    const l = { ...learned(T0 - 5 * D), ct: { at: T0 - D, w: 'become' } };
    const far = { ...l, u: { ...l.u, due: T0 + 9 * D }, b: { ...l.b!, due: T0 + 9 * D } };
    const bad = applyAnswer(far, ans(T0, { form: 'contrast', outcome: 'wrong' }), ctx()).lex;
    expect(bad.b!.due).toBeLessThanOrEqual(dayStartOf(addDays(dayKey(T0), 1)));
    expect(bad.u.due).toBeLessThanOrEqual(dayStartOf(addDays(dayKey(T0), 1)));
    const good = applyAnswer(far, ans(T0, { form: 'contrast', outcome: 'ok' }), ctx()).lex;
    expect([good.u.due, good.b!.due]).toEqual([far.u.due, far.b.due]);
  });
  it('fällige Abfrage richtig schließt einen Kontrast von einem früheren Tag; am Tag der Verwechslung nicht; gemeldete Kontrastkarte schließt ihn', () => {
    const l = learned(T0 - 5 * D);
    const t = l.b!.due + 3600_000;
    expect(applyAnswer({ ...l, ct: { at: t - 2 * D, w: 'become' } }, ans(t), ctx()).lex.ct).toBeUndefined();
    expect(applyAnswer({ ...l, ct: { at: t - 60_000, w: 'become' } }, ans(t), ctx()).lex.ct).toEqual({ at: t - 60_000, w: 'become' });
    expect(applyAnswer({ ...l, ct: { at: t - 2 * D, w: 'become' } }, ans(t, { form: 'contrast', outcome: 'unfair' }), ctx()).lex.ct).toBeUndefined();
  });
  it('Leech bei einer Lehrer-Falle (ff/Paar) öffnet eine Kontrastkarte ohne Verwechslungswort; ohne Falle nicht', () => {
    let a = learned(T0 - 40 * D);
    let b = a;
    for (let i = 0; i < 6; i++) {
      const t = T0 - (30 - i * 4) * D;
      a = applyAnswer({ ...a, day: null }, ans(t, { outcome: 'wrong' }), ctx({ ff: true })).lex;
      b = applyAnswer({ ...b, day: null }, ans(t, { outcome: 'wrong' }), ctx()).lex;
    }
    expect(a.lc).toBe(b.lc);
    expect(a.lc).toBe(6);
    expect(a.ct).toMatchObject({ w: null });
    expect(b.ct).toBeUndefined();
  });
});
