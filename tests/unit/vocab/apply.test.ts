import { describe, expect, it } from 'vitest';
import { dayKey } from '../../../src/domain/date';
import { applyUse, EV_MAX, evidenceOf, frameFor, outcomeOfUse, situationFor, weekStartOf, type UseInput } from '../../../src/modules/vocab/domain/apply';
import { canAscend } from '../../../src/modules/vocab/domain/ladder';
import { type Answer, applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex, type LexKind } from '../../../src/modules/vocab/domain/types';

// Großpaket A Schritt 5b: Urteil je Zielwort → Note und Belege (plan.md §7, Synthese §2.5).

const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });
const ans = (t: number, over: Partial<Answer> = {}): Answer => ({ t, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'x#0', ...over });

/** Gelerntes Lexem (Benutzen vorhanden) auf Stufe `lv`, zuletzt vor 10 Tagen gebucht, Benutzen fällig in `dueIn` Tagen. */
function word(lv: number, o: { k?: LexKind; dueIn?: number; ev?: Partial<Lex['ev']>; pri?: Lex['pri'] } = {}): Lex {
  const t = T0 - 30 * D;
  let l = introduce(emptyLex(o.k ?? 'w', o.pri ?? 'edge', t), t);
  l = applyAnswer(l, ans(t + 60_000, { form: 'gap_hint' }), ctx()).lex;
  l = applyAnswer(l, ans(t + 300_000), ctx()).lex;
  return { ...l, lv, day: dayKey(T0 - 10 * D), step: null, b: { ...l.b!, due: T0 + (o.dueIn ?? 2) * D }, ev: { f: [], o: 0, s: 0, ...o.ev } };
}

const use = (over: Partial<UseInput> = {}): UseInput => ({ t: T0, form: 'transfer', v: 'ok', err: null, at: '', evade: false, spoken: false, lvAt: 5, evidenceOnly: false, ...over });

describe('Urteil → Ausgang', () => {
  it('Tabelle aus plan.md §7 (Register zählt als richtig, außer bei Wendungen)', () => {
    expect(outcomeOfUse('ok', null, 'w', false)).toBe('ok');
    expect(outcomeOfUse('wrong', 'sense', 'w', false)).toBe('other');
    expect(outcomeOfUse('wrong', 'word', 'w', false)).toBe('other');
    expect(outcomeOfUse('odd', 'form', 'w', false)).toBe('infl');
    expect(outcomeOfUse('odd', 'prep', 'pv', false)).toBe('prep');
    expect(outcomeOfUse('odd', 'colloc', 'col', false)).toBe('colloc');
    expect(outcomeOfUse('odd', 'register', 'w', false)).toBe('ok');
    expect(outcomeOfUse('odd', 'register', 'ch', false)).toBe('odd');
    expect(outcomeOfUse('odd', 'other', 'w', false)).toBe('odd');
    expect(outcomeOfUse('thin', null, 'w', false)).toBeNull();
    expect(outcomeOfUse('unused', null, 'w', false)).toBeNull();
    expect(outcomeOfUse('unused', null, 'w', true)).toBe('evade');
  });
});

describe('Anwenden: Note und Buchung', () => {
  it('richtig → Good auf Benutzen und Verstehen, nie Easy, keine Wiederkehr', () => {
    const r = applyUse(word(6, { dueIn: 2 }), use(), ctx());
    expect(r.grade).toBe(3);
    expect(r.booked).toEqual(['b', 'u']);
    expect(r.lex.day).toBe(dayKey(T0));
    expect(r.lex.step).toBeNull();
    // auch fällig, lange Pause, hohe Stufe: kein Easy (kein Zeit-Urteil beim Schreiben)
    const r2 = applyUse(word(6, { dueIn: -1 }), use({ form: 'own' }), ctx());
    expect(r2.grade).toBe(3);
  });

  it('falsches Wort → Again auch auf Verstehen, Kontrastkarte mit dem verwechselten Wort; falscher Sinn ohne Kontrastkarte', () => {
    const r = applyUse(word(5), use({ v: 'wrong', err: 'word', at: 'effect' }), ctx());
    expect(r.grade).toBe(1);
    expect(r.booked).toEqual(['b', 'u']);
    expect(r.lex.ct).toMatchObject({ w: 'effect' });
    expect(r.lex.step).toBeNull(); // Anwenden: keine Wiederkehr in derselben Runde
    expect(applyUse(word(5), use({ v: 'wrong', err: 'sense', at: 'postpone' }), ctx()).lex.ct).toBeUndefined();
  });

  it('eigener Satz falsch → Wiederkehr nach Fehler bleibt (eine Karte, ein Wort)', () => {
    const r = applyUse(word(5), use({ form: 'own', v: 'wrong', err: 'sense', at: 'postpone' }), ctx());
    expect(r.grade).toBe(1);
    expect(r.lex.step).toMatchObject({ n: 11 });
  });

  it('fast richtig: Beugung Hard; Kollokation je Art (Einzelwort Hard + Partner, Kollokation Again); Ton bei Wendung Hard', () => {
    expect(applyUse(word(5), use({ v: 'odd', err: 'form', at: 'postponed' }), ctx()).grade).toBe(2);
    const w = applyUse(word(5), use({ v: 'odd', err: 'colloc', at: 'do a decision' }), ctx());
    expect(w.grade).toBe(2);
    expect(w.events).toContain('partner');
    expect(applyUse(word(5, { k: 'col' }), use({ v: 'odd', err: 'colloc', at: 'do a decision' }), ctx()).grade).toBe(1);
    expect(applyUse(word(5), use({ v: 'odd', err: 'register', at: 'x' }), ctx()).grade).toBe(3);
    expect(applyUse(word(5, { k: 'ch' }), use({ v: 'odd', err: 'register', at: 'x' }), ctx()).grade).toBe(2);
  });

  it('zu dünn und nicht benutzt: keine Note, nichts verändert', () => {
    const l = word(5);
    for (const v of ['thin', 'unused'] as const) {
      const r = applyUse(l, use({ v }), ctx());
      expect(r.grade).toBeNull();
      expect(r.booked).toEqual([]);
      expect(r.lex).toEqual(l);
    }
  });

  it('ausgewichen: erstes Mal ohne Note, dasselbe Ersatzwort ein zweites Mal Hard (M41)', () => {
    const r1 = applyUse(word(5), use({ v: 'unused', evade: true, at: 'delay' }), ctx());
    expect(r1.grade).toBeNull();
    expect(r1.booked).toEqual([]);
    expect(r1.lex.fq?.ew).toContain('delay');
    const later = { ...r1.lex, day: dayKey(T0 - D) };
    const r2 = applyUse(later, use({ t: T0 + 3 * D, v: 'unused', evade: true, at: 'delay' }), ctx());
    expect(r2.grade).toBe(2);
  });

  it('nur Beleg: keine Planwirkung, aber Beleg ab Stufe 5', () => {
    const l = word(5);
    const r = applyUse(l, use({ evidenceOnly: true }), ctx());
    expect(r.booked).toEqual([]);
    expect(r.grade).toBeNull();
    expect(r.lex.b).toEqual(l.b);
    expect(r.lex.ev.o).toBe(1);
    expect(r.ev).toBe('o');
  });
});

describe('Belege für Stufe 7 (ev.o / ev.s)', () => {
  it('nur geprüftes ok, nur ab Stufe 5 beim Schreiben; gesprochen zählt doppelt (geschrieben + gesprochen)', () => {
    expect(evidenceOf(word(4), use({ lvAt: 4 }))).toBeNull();
    expect(evidenceOf(word(5), use({ v: 'odd', err: 'form' }))).toBeNull();
    expect(evidenceOf(word(5), use({ v: 'thin' }))).toBeNull();
    const r = applyUse(word(5), use({ spoken: true }), ctx());
    expect(r.lex.ev).toMatchObject({ o: 1, s: 1 });
  });

  it('ein trivialer oder abgeschriebener Satz (thin) zählt nicht; ohne Claude geprüft gibt es keinen Aufruf', () => {
    expect(applyUse(word(6), use({ v: 'thin', form: 'own' }), ctx()).lex.ev.o).toBe(0);
  });

  it('später geprüft: zählt die Stufe beim Schreiben, nicht die beim Prüfen', () => {
    // geschrieben auf Stufe 4, inzwischen 6: kein Beleg
    expect(applyUse(word(6), use({ lvAt: 4, evidenceOnly: true }), ctx()).lex.ev.o).toBe(0);
    // geschrieben auf Stufe 5, inzwischen nach einem Fehler 4: Beleg, aber keine Planwirkung
    const r = applyUse(word(4), use({ lvAt: 5, evidenceOnly: true }), ctx());
    expect(r.lex.ev.o).toBe(1);
    expect(r.booked).toEqual([]);
  });

  it('höchstens einmal je Wort und Tag', () => {
    const r1 = applyUse(word(5), use({ form: 'own' }), ctx());
    expect(r1.lex.ev.o).toBe(1);
    const r2 = applyUse(r1.lex, use({ form: 'own', t: T0 + 600_000 }), ctx());
    expect(r2.lex.ev.o).toBe(1);
    expect(applyUse(word(5), use({ evDone: true }), ctx()).lex.ev.o).toBe(0);
  });

  it('gedeckelt', () => {
    expect(applyUse(word(6, { ev: { o: EV_MAX, s: EV_MAX } }), use({ spoken: true }), ctx()).lex.ev).toMatchObject({ o: EV_MAX, s: EV_MAX });
  });

  it('der zweite gute Satz hebt 6 → 7 mit derselben Antwort (fällig); Kernwort braucht einen gesprochenen', () => {
    const edge = applyUse(word(6, { dueIn: -1, ev: { o: 1 } }), use({ form: 'own', lvAt: 6 }), ctx());
    expect(edge.lex.lv).toBe(7);
    const core = applyUse(word(6, { dueIn: -1, ev: { o: 1 }, pri: 'core' }), use({ form: 'own', lvAt: 6 }), ctx());
    expect(core.lex.lv).toBe(6);
    expect(canAscend(core.lex)).toBe(false);
    const coreSpoken = applyUse(word(6, { dueIn: -1, ev: { o: 1 }, pri: 'core' }), use({ form: 'own', lvAt: 6, spoken: true }), ctx());
    expect(coreSpoken.lex.lv).toBe(7);
  });

  it('Anwenden mit Termin in 1–3 Tagen bucht, hebt aber keine Stufe (nicht fällig)', () => {
    const r = applyUse(word(6, { dueIn: 2, ev: { o: 1 } }), use({ lvAt: 6 }), ctx());
    expect(r.lex.ev.o).toBe(2);
    expect(r.lex.lv).toBe(6);
  });
});

describe('Rahmen und Lage', () => {
  it('Wochenbeginn Montag', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
  });

  it('Arbeits-Textsorten im festen Wechsel; ab Freitag einmal Alltag je Woche', () => {
    const work = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'].map((d) => frameFor(d, null));
    expect(new Set(work)).toEqual(new Set(['mail', 'slack', 'call', 'pitch']));
    expect(frameFor('2026-11-06', null)).toBe('life');
    expect(frameFor('2026-11-06', '2026-10-31')).toBe('life');
    expect(frameFor('2026-11-07', '2026-11-06')).not.toBe('life');
    expect(frameFor('2026-11-03', null)).not.toBe('life');
  });

  it('Lage fest je Rahmen und Tag, im Bereich', () => {
    for (const d of ['2026-11-02', '2026-11-03', '2026-12-24']) {
      const i = situationFor('mail', d, 6);
      expect(i).toBe(situationFor('mail', d, 6));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(6);
    }
    expect(situationFor('mail', '2026-11-02', 0)).toBe(0);
  });
});
