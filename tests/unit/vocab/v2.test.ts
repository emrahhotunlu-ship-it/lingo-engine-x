import { describe, expect, it } from 'vitest';
import { addDays, dayKey, dayStartOf } from '../../../src/domain/date';
import { toUSText } from '../../../src/domain/text/british';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { type CheckDict, checkAnswer, damerau, type Target } from '../../../src/modules/vocab/domain/check';
import { available, emptyFq, formLevel, LADDER_B, LADDER_U, leaks, pickForm, pickSentence, updateFq, NO_CARD } from '../../../src/modules/vocab/domain/forms';
import { baseGrade, easyAllowed, FORM_SPEC, gradeOf, isFreeGood, speedOf } from '../../../src/modules/vocab/domain/grade';
import { isLeechCount, leechTreatment } from '../../../src/modules/vocab/domain/leech';
import { type Answer, applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, FORMS, type Form, type Lex, type LexKind, OUTCOMES, type Outcome } from '../../../src/modules/vocab/domain/types';
import { lexWriteSchema } from '../../../src/modules/vocab/data/schemas';

// Wörter-Modul V2 (plan.md §5, §10 Zeile V2; synthese M2/M23, M14, M22, M25–M31, M36, M38–M41, M44, M45, M56, M57, M78–M81, M80 Marke).

const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });
const ans = (t: number, over: Partial<Answer> = {}): Answer => ({ t, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'x#1', ...over });

function learned(t = T0, k: LexKind = 'w'): Lex {
  let l = introduce(emptyLex(k, 'edge', t), t);
  l = applyAnswer(l, ans(t + 60_000, { form: 'gap_hint' }), ctx()).lex;
  l = applyAnswer(l, ans(t + 300_000), ctx()).lex;
  return l;
}
const CAPPED_OK = (f: Form) => FORM_SPEC[f].max > 2;
const at = (l: Lex, lv: number, us = 10, bs = 10): Lex => ({ ...l, lv, u: { ...l.u, s: us }, b: l.b ? { ...l.b, s: bs } : l.b });

describe('Tabelle „Spur je Form“ (plan.md §5, english-teacher V0 Befund 2)', () => {
  // Unabhängig vom Code aufgeschrieben: Form → [Spur, höchste Note].
  const EXPECT: Record<Form, [string | null, number]> = {
    gap: ['b', 4], nosent: ['b', 4], partner: ['b', 4], family: ['b', 4], situation: ['b', 4], own: ['b', 4], say: ['b', 4], transfer: ['b', 4], de_sent: ['b', 4], diplomatic: ['b', 4], probe: ['b', 4],
    gap_hint: ['b', 2], cloze_part: ['b', 2], complete: ['b', 2], prep: ['b', 2], count: ['b', 2], particle: ['b', 2],
    listen: ['u', 3], dictation: ['u', 3], tiles: ['u', 2], meaning: ['u', 4], tone_mean: ['u', 4], flip: ['u', 4],
    choice: [null, 1], find_trap: [null, 1], contrast: [null, 1], intro: [null, 1],
  };
  it.each(FORMS.map((f) => [f]))('%s: Spur und höchste Note', (f) => {
    expect([FORM_SPEC[f].track, FORM_SPEC[f].max]).toEqual(EXPECT[f]);
  });
  it('Auswahl, Falle finden, Kontrast und Einführung haben nie eine Note (M2, M23)', () => {
    for (const f of ['choice', 'find_trap', 'contrast', 'intro'] as Form[]) for (const o of OUTCOMES) expect(gradeOf({ form: f, outcome: o, hint: 0 })).toBeNull();
  });
  it('keine Form liegt über ihrer höchsten Note', () => {
    for (const f of FORMS) for (const o of OUTCOMES) for (const speed of [null, 'fast', 'slow'] as const) {
      const g = gradeOf({ form: f, outcome: o, hint: 0, speed, easyOk: true, self: 4 });
      if (g !== null) expect(g, `${f}/${o}`).toBeLessThanOrEqual(FORM_SPEC[f].max);
    }
  });
});

describe('Formen je Stufe (M22)', () => {
  it('jede Stufe hat ≥ 2 Formen je Spur, die Grundformen stehen jedem Lexem zur Verfügung', () => {
    const l = at(learned(), 1);
    for (let lv = 1; lv <= 7; lv++) {
      expect(LADDER_B[lv]!.length, `B${lv}`).toBeGreaterThanOrEqual(2);
      expect(LADDER_U[lv]!.length, `U${lv}`).toBeGreaterThanOrEqual(2);
      // Ohne jeden Zusatzinhalt (nur Satz und deutscher Chunk) hat jede Stufe ab 2 mindestens 2 stellbare Benutzen-Formen.
      // Stufe 3 bekommt „ohne Satz“ als zweite Form, wenn sonst nur eine stellbar ist (pickForm).
      const extra = lv === 3 ? 1 : 0;
      if (lv >= 2) expect(LADDER_B[lv]!.filter((f) => f !== 'intro' && f !== 'probe' && available(f, { ...l, lv }, { de: true })).length + extra, `B${lv}`).toBeGreaterThanOrEqual(2);
    }
  });
  it('Stufe 3 nur mit Grundinhalt: Lücke und „ohne Satz“ wechseln sich ab (≥ 2 Abfragearten)', () => {
    const l = { ...at(learned(), 3), fq: { ...emptyFq(), l: 'gap' as Form } };
    expect(pickForm(l, 'b', { de: true }).form).toBe('nosent');
  });
  it('schwächste Form zuerst, nie zweimal in Folge', () => {
    const l = at(learned(), 3);
    const fq = { ...emptyFq(), h: { gap: [10, 9] as [number, number], nosent: [4, 1] as [number, number] } };
    expect(pickForm({ ...l, fq }, 'b', { de: true }).form).toBe('nosent');
    expect(pickForm({ ...l, fq: { ...fq, l: 'nosent' } }, 'b', { de: true }).form).not.toBe('nosent');
    // Folge über viele Abfragen: keine Form zweimal hintereinander
    let x = { ...l, fq: emptyFq() };
    let last: Form | null = null;
    for (let i = 0; i < 30; i++) {
      const f = pickForm(x, 'b', { de: true, partner: true, starts: true }).form;
      expect(f).not.toBe(last);
      last = f;
      const [n, ok] = x.fq.h[f] ?? [0, 0];
      x = { ...x, fq: { ...x.fq, l: f, h: { ...x.fq.h, [f]: [n + 1, ok + (i % 3 ? 1 : 0)] } } };
    }
  });
  it('ab Stufe 4 jeder 3. Benutzen-Abruf ohne Satz (M27); Satzbindung erzwingt 2 Termine ohne Satz (M57)', () => {
    const l = at(learned(), 4);
    const seq = [0, 1, 2, 3, 4, 5].map((c) => FORM_SPEC[pickForm({ ...l, fq: { ...emptyFq(), c } }, 'b', { de: true, deSent: true }).form].sent);
    expect(seq).toEqual(['s', 's', 'n', 's', 's', 'n']);
    expect(FORM_SPEC[pickForm({ ...l, fq: { ...emptyFq(), c: 0, nb: 2 } }, 'b', { de: true }).form].sent).toBe('n');
  });
  it('schwere Formen ab Stufe 4 nur mit u.s ≥ 3 Tagen, sonst Formen der Stufe 3', () => {
    expect(formLevel(at(learned(), 5, 2))).toBe(3);
    expect(formLevel(at(learned(), 5, 3))).toBe(5);
  });
  it('M78–M81 nur nach Lehrer-Charge 3 und mit geprüften Daten; Umstellform nur bei sep 1', () => {
    const pv = { ...at(learned(T0, 'pv'), 3), gr: { pat: 'set sth up', sep: 1 as const } };
    expect(available('particle', pv, { grOn: false })).toBe(false);
    expect(available('particle', pv, { grOn: true })).toBe(true);
    const word = { ...at(learned(), 3), gr: { pat: 'depend on sth' } };
    expect(available('prep', word, { grOn: true })).toBe(true);
    expect(available('prep', { ...word, gr: { pat: 'discuss sth' } }, { grOn: true })).toBe(false);
    expect(available('count', { ...word, gr: { cnt: 'u' } }, { grOn: true })).toBe(true);
    expect(available('count', { ...word, gr: { cnt: 'uc' } }, { grOn: true })).toBe(false);
    const swapOf = (sep: 0 | 1) => pickForm({ ...pv, gr: { sep }, fq: { ...emptyFq(), l: 'gap', e: ['order'], h: { particle: [1, 0], gap: [9, 9], cloze_part: [9, 9], partner: [9, 9] } } }, 'b', { grOn: true, de: true });
    // ohne Fehlerprofil keine gezielte Form (M78: „gezielt nach dem Fehlerprofil des Lexems“)
    expect(pickForm({ ...pv, fq: { ...emptyFq(), l: 'gap' } }, 'b', { grOn: true, de: true }).form).not.toBe('particle');
    expect(swapOf(1)).toMatchObject({ form: 'particle', swap: true });
    expect(swapOf(0)).toMatchObject({ form: 'particle', swap: false });
  });
  it('Formen mit höchstens Hard nie zweimal hintereinander; Trefferquote zählt richtige Antworten auch dort (Blocker 1)', () => {
    const l = { ...at(learned(T0, 'col'), 3), fq: { ...emptyFq(), l: 'cloze_part' as Form, h: { cloze_part: [5, 5] as [number, number], gap: [5, 5] as [number, number] } } };
    expect(CAPPED_OK(pickForm(l, 'b', { de: true }).form)).toBe(true);
  });
  it('Politur P2 (Prüfbericht S2): „Teil einer Wendung“ hat noch keine Karte und wird nicht gewählt – Wendungen wechseln wie Wörter zwischen Lücke und „ohne Satz“', () => {
    const col = at(learned(T0, 'col'), 3);
    expect(NO_CARD.has('cloze_part')).toBe(true);
    for (const k of ['col', 'pv', 'ch', 'w'] as const) expect(available('cloze_part', { ...col, k }, { de: true, partner: true, grOn: true })).toBe(false);
    let x = { ...col, fq: emptyFq() };
    const seen: Form[] = [];
    for (let i = 0; i < 6; i++) {
      const f = pickForm(x, 'b', { de: true }).form;
      seen.push(f);
      x = { ...x, fq: { ...x.fq, l: f, h: { ...x.fq.h, [f]: [i + 1, i + 1] } } };
    }
    expect(new Set(seen)).toEqual(new Set<Form>(['gap', 'nosent']));
    expect(seen.every((f) => FORM_SPEC[f].free && FORM_SPEC[f].max === 4)).toBe(true);
  });
  it('Satzbindung wirkt auch auf Stufe 2–3 und baut sich nach 2 Abrufen ohne Satz ab (Befund 5, Nachprüfung 1)', () => {
    const l = { ...at(learned(), 3), fq: { ...emptyFq(), nb: 2, l: 'gap' as Form } };
    expect(FORM_SPEC[pickForm(l, 'b', { de: true }).form].sent).toBe('n');
    const l2 = { ...at(learned(), 2), fq: { ...emptyFq(), nb: 2, l: 'gap' as Form } };
    let fq = updateFq(l2, { form: 'nosent', track: 'b', correct: true, anchor: null, wrong: false, counted: true });
    fq = updateFq({ ...l2, fq }, { form: 'nosent', track: 'b', correct: true, anchor: null, wrong: false, counted: true });
    expect(fq.nb).toBe(0);
  });
  it('„Gesucht: …“ bis Stufe 4, ab Stufe 5 ohne deutsche Bedeutung (M25)', () => {
    expect(pickForm(at(learned(), 4), 'b', { de: true }).cue).toBe(true);
    const f5 = pickForm({ ...at(learned(), 5), fq: emptyFq() }, 'b', { de: true });
    expect(f5.cue).toBe(false);
  });
  it('nur Verstehen fällig: nie eine Auswahl', () => {
    for (let lv = 1; lv <= 7; lv++) expect(FORM_SPEC[pickForm(at(learned(), lv), 'u', { audio: true }).form].track).toBe('u');
  });
});

describe('Satzwechsel und Leck-Prüfung (M57)', () => {
  it('Tag 0–1 Ankersatz, danach ein Satz, der 30 Tage nicht kam', () => {
    const l = learned();
    const keys = ['x#0', 'x#1', 'x#2'];
    expect(pickSentence(l, keys, dayKey(T0))).toBe('x#0');
    expect(pickSentence(l, keys, addDays(dayKey(T0), 1))).toBe('x#0');
    const later = addDays(dayKey(T0), 10);
    const s = pickSentence({ ...l, sn: [['x#0', addDays(dayKey(T0), 1)], ['x#1', addDays(dayKey(T0), 5)]] }, keys, later);
    expect(s).toBe('x#2');
  });
  it('Schritt B und Wiederkehr an Tag 0–1 in einem neuen Satz (Befund 4)', () => {
    const l = learned();
    expect(pickSentence(l, ['x#0', 'x#1', 'x#2'], dayKey(T0), { fresh: true })).toBe('x#1');
  });
  it('Leck: das Ziel steht außerhalb der Lücke noch einmal', () => {
    expect(leaks('Our lead times are long, so we must cut the [lead time].', 'lead time')).toBe(true);
    expect(leaks('We need to cut the [lead time] for spare parts.', 'lead time')).toBe(false);
  });
});

describe('Notentabelle (M38): alle Ausgänge × Stufen', () => {
  // Erwartete Note in der Form `gap` (Benutzen, bis Easy) für ein Einzelwort, ohne Hinweis, normale Zeit.
  const BASE: Record<Outcome, number | null> = { ok: 3, typo: 2, spell: 2, infl: 2, hyph: 2, pos: 1, other: 1, wrong: 1, dunno: 1, colloc: 2, prep: 2, plural: 2, order: 2, syn: null, evade: null, unfair: null, asr: null, odd: 2 };
  for (let lv = 1; lv <= 7; lv++)
    it(`Stufe ${lv}`, () => {
      for (const o of OUTCOMES) {
        const easyOk = easyAllowed(lv, true, 30);
        expect(gradeOf({ form: 'gap', outcome: o, hint: 0, k: 'w', easyOk }), `${o}`).toBe(BASE[o]);
        // Hinweis → Hard (M44); langsam → Hard; schnell → Easy nur ab Stufe 5 (M39)
        if (o === 'ok') {
          expect(gradeOf({ form: 'gap', outcome: o, hint: 1, easyOk })).toBe(2);
          expect(gradeOf({ form: 'gap', outcome: o, hint: 0, speed: 'slow', easyOk })).toBe(2);
          expect(gradeOf({ form: 'gap', outcome: o, hint: 0, speed: 'fast', easyOk })).toBe(lv >= 5 ? 4 : 3);
        }
      }
    });
  it('Kollokationsfehler nach Art (M56): Lexem = Kollokation → Again, Einzelwort → Hard', () => {
    expect(baseGrade('colloc', { k: 'col', form: 'gap' })).toBe(1);
    expect(baseGrade('colloc', { k: 'pv', form: 'gap' })).toBe(1);
    expect(baseGrade('colloc', { k: 'w', form: 'gap' })).toBe(2);
  });
  it('Muster, Plural, Stellung: Hard am Einzelwort, Again in der Form, die danach fragt (M78, M79, M81)', () => {
    expect(baseGrade('prep', { k: 'w', form: 'gap' })).toBe(2);
    expect(baseGrade('prep', { k: 'w', form: 'prep' })).toBe(1);
    expect(baseGrade('prep', { k: 'pv', form: 'gap' })).toBe(1);
    expect(baseGrade('plural', { k: 'w', form: 'count' })).toBe(1);
    expect(baseGrade('order', { k: 'pv', form: 'particle' })).toBe(1);
    expect(baseGrade('order', { k: 'pv', form: 'gap' })).toBe(2);
  });
  it('zweiter Versuch (M45): Fehler, dann richtig → Again; erster nur Tippfehler → Hard', () => {
    expect(gradeOf({ form: 'gap', outcome: 'ok', hint: 0, first: 'wrong' })).toBe(1);
    expect(gradeOf({ form: 'gap', outcome: 'ok', hint: 0, first: 'typo' })).toBe(2);
  });
  it('Ausweichwort: erstes ohne Note, zweites gleiches Hard (M41)', () => {
    expect(gradeOf({ form: 'gap', outcome: 'evade', hint: 0 })).toBeNull();
    expect(gradeOf({ form: 'gap', outcome: 'evade', hint: 0, evadeRepeat: true })).toBe(2);
  });
  it('Aufstiegs-Tag: nur frei, ohne Hilfe; Tippfehler zählt, Rechtschreibliste nicht', () => {
    expect(isFreeGood('gap', 'typo', 0)).toBe(true);
    expect(isFreeGood('gap', 'spell', 0)).toBe(false);
    expect(isFreeGood('gap_hint', 'ok', 0)).toBe(false);
  });
});

describe('Zeit in der Note (M39)', () => {
  it('Zeit bis zum ersten Zeichen, Kappung 45 s, Schwellen 2× / 0,6×, erste 20 Antworten ohne Wirkung', () => {
    expect(speedOf(9000, 4000, 19)).toBeNull();
    expect(speedOf(9000, 4000, 20)).toBe('slow');
    expect(speedOf(2000, 4000, 20)).toBe('fast');
    expect(speedOf(5000, 4000, 20)).toBeNull();
    expect(speedOf(120_000, 30_000, 50)).toBeNull(); // gekappt bei 45 s < 2 × 30 s
  });
  it('Easy nur ab Stufe 5, fällig, nicht in den ersten 21 Tagen', () => {
    expect(easyAllowed(5, true, 21)).toBe(true);
    expect(easyAllowed(4, true, 40)).toBe(false);
    expect(easyAllowed(5, false, 40)).toBe(false);
    expect(easyAllowed(5, true, 20)).toBe(false);
  });
  it('im Planer: langsam gibt Hard, schnell auf Stufe 5 nach 21 Tagen Easy', () => {
    const base = learned();
    const t = T0 + 30 * D;
    const l5: Lex = { ...base, lv: 5, u: { ...base.u, s: 30, due: t - D }, b: { ...base.b!, s: 25, due: t - D } };
    const fk = { med: { gap: 4000 }, n: { gap: 40 } };
    expect(applyAnswer(l5, ans(t, { fk: 1500 }), ctx({ fk })).grade).toBe(4);
    expect(applyAnswer(l5, ans(t, { fk: 12_000 }), ctx({ fk })).grade).toBe(2);
    expect(applyAnswer({ ...l5, lv: 4 }, ans(t, { fk: 1500 }), ctx({ fk })).grade).toBe(3);
  });
});

describe('Tippfehler-Regeln (a)–(h) in fester Reihenfolge (M40)', () => {
  const WORDS = new Set(['contact', 'contract', 'affect', 'effect', 'decide', 'decision', 'manage', 'manager', 'postpone', 'postponed', 'lead', 'time', 'times', 'give', 'hold', 'make', 'do', 'presentation', 'decision', 'up', 'set', 'it', 'discuss', 'about', 'the', 'plan', 'problem', 'bottleneck', 'information', 'recipe', 'organize', 'follow', 'setup', 'receive']);
  const dict: CheckDict = {
    isWord: (w) => w.split(' ').every((x) => WORDS.has(x)),
    misspell: new Map([['adress', 'address'], ['responsability', 'responsibility'], ['comittee', 'committee']]),
    confusable: new Map([['affect', ['effect']], ['effect', ['affect']], ['contract', ['contact']], ['contact', ['contract']]]),
    toUS: toUSText,
  };
  const T = (answer: string, over: Partial<Target> = {}): Target => ({ answer, k: 'w', ...over });
  const out = (raw: string, t: Target) => checkAnswer(raw, t, dict).outcome;

  it('(g) Artikel, Groß/klein, typografischer Apostroph werden angeglichen', () => {
    expect(out('The lead time', T('lead time'))).toBe('ok');
    expect(out('LEAD TIME', T('lead time'))).toBe('ok');
    expect(out('it’s', T("it's"))).toBe('ok');
  });
  it('(h) britische Schreibweise ist richtig', () => {
    expect(out('organise', T('organize'))).toBe('ok');
    expect(checkAnswer('organise', T('organize'), dict).note).toBe('uk');
  });
  it('(c) Beugung: lead times → Beugung, nicht anderes Wort; postpone statt postponed → Hard + Grammatik', () => {
    expect(out('lead times', T('lead time'))).toBe('infl');
    expect(out('postpone', T('postponed'))).toBe('infl');
    expect(gradeOf({ form: 'gap', outcome: 'infl', hint: 0 })).toBe(2);
  });
  it('(f) Bindestrich/Leerzeichen: follow up ↔ follow-up ist Formfehler (Wortart), e-mail ↔ email richtig', () => {
    expect(out('follow up', T('follow-up', { pos: 'noun' }))).toBe('hyph');
    expect(out('setup', T('set up', { k: 'pv' }))).toBe('hyph');
    expect(out('email', T('e-mail', { pos: 'noun' }))).toBe('ok');
  });
  it('(b) bekannte Rechtschreibfehler deutscher Lerner: Formfehler aus der Liste, nie „fast richtig“', () => {
    expect(out('adress', T('address'))).toBe('spell');
    expect(out('responsability', T('responsibility'))).toBe('spell');
  });
  it('(e) anderes echtes Wort: contract/contact, affect/effect → nie Tippfehler', () => {
    expect(out('contract', T('contact'))).toBe('other');
    expect(out('affect', T('effect'))).toBe('other');
  });
  it('(a) Tippfehler: ein Fehler ab 5 Buchstaben, Vertauschung zählt 1 (lead tmie, recieve)', () => {
    expect(damerau('recieve', 'receive')).toBe(1);
    expect(out('lead tmie', T('lead time'))).toBe('typo');
    expect(out('recieve', T('receive'))).toBe('typo');
    expect(out('tme', T('time'))).toBe('wrong'); // unter 5 Buchstaben kein Tippfehler
  });
  it('(d) Wortart oder Ableitung: manage statt manager, decide statt decision → Again', () => {
    expect(out('manage', T('manager'))).toBe('pos');
    expect(out('decide', T('decision'))).toBe('pos');
    expect(gradeOf({ form: 'gap', outcome: 'pos', hint: 0 })).toBe(1);
  });
  it('Reihenfolge: die Liste des Lehrers steht vor (c): informations → „Plural falsch“ (M79), nicht Beugung', () => {
    expect(out('informations', T('information', { uncount: true }))).toBe('plural');
    expect(out('information', T('information', { uncount: true }))).toBe('ok');
  });
  it('M81: set up it → Stellungsfehler mit Erklärung', () => {
    expect(out('set up it', T('set it up', { k: 'pv' }))).toBe('order');
  });
  it('M78: discuss about the plan → Präposition/Muster', () => {
    expect(out('discuss about the plan', T('discuss the plan', { k: 'col' }))).toBe('prep');
  });
  it('M56: hold a presentation → Kollokationsfehler; take a decision → Auch richtig (UK)', () => {
    expect(out('hold a presentation', T('give a presentation', { k: 'col', colloc: ['hold a presentation'] }))).toBe('colloc');
    expect(out('do a decision', T('make a decision', { k: 'col' }))).toBe('colloc');
    const uk = checkAnswer('take a decision', T('make a decision', { k: 'col', uk: ['take a decision'] }), dict);
    expect(uk).toMatchObject({ outcome: 'syn', note: 'uk' });
  });
  it('english-teacher V2: a/an vor nicht Zählbarem ist „Plural falsch“ (M79), nie richtig', () => {
    expect(out('a feedback', T('feedback', { uncount: true }))).toBe('plural');
    expect(out('an advice', T('advice', { uncount: true }))).toBe('plural');
    expect(out('the feedback', T('feedback', { uncount: true }))).toBe('ok');
  });
  it('english-teacher V2: -er/-ing beim Nomen/Verb ist Ableitung (d), keine Beugung', () => {
    expect(out('manager', T('manage', { pos: 'verb' }))).toBe('pos');
    expect(out('meet', T('meeting', { pos: 'noun' }))).toBe('pos');
    expect(out('cheaper', T('cheap', { pos: 'adj' }))).toBe('infl');
  });
  it('english-teacher V2: Artikel und Pronomen sind Grammatik, kein falsches Partnerwort', () => {
    expect(out('raise a question', T('raise the question', { k: 'col' }))).toBe('infl');
    expect(out('make a offer', T('make an offer', { k: 'col' }))).toBe('typo');
    expect(out('make offer', T('make an offer', { k: 'col' }))).toBe('infl');
  });
  it('english-teacher V2: überflüssige Präposition auch beim Einzelwort (*discuss about*), nicht wenn die Präposition die Lösung ist', () => {
    expect(out('discuss about', T('discuss'))).toBe('prep');
    expect(out('until', T('by'))).not.toBe('prep');
  });
  it('english-teacher V2: Kurzformen in beiden Lesarten (*she\'s been*, *I\'d sent*, *let\'s*)', () => {
    expect(out("she's been", T('she has been'))).toBe('ok');
    expect(out("I'd already sent", T('I had already sent'))).toBe('ok');
    expect(out("let's circle back", T('let us circle back'))).toBe('ok');
    expect(out("I'm writing", T('I am writing'))).toBe('ok');
  });
  it('Nachprüfung: mitgetipptes Nachbarwort ist kein Fehler; Langform gegen Kurzform in der Lösung; Partikel vor Präposition; Komparativ ohne Wortart', () => {
    expect(checkAnswer('to discuss', T('discuss', { before: 'to', pos: 'verb' }), dict)).toMatchObject({ outcome: 'ok', note: 'gap' });
    expect(out('responsible for', T('responsible', { after: 'for' }))).toBe('ok');
    expect(out('she has been', T("she's been"))).toBe('ok');
    expect(checkAnswer('take on', T('take over', { k: 'pv' }), dict)).toMatchObject({ outcome: 'other', note: 'particle' });
    expect(out('cheaper', T('cheap'))).toBe('infl');
  });
  it('M81: anderer Partikel beim Phrasal Verb ist ein anderes Verb (Again)', () => {
    expect(out('set out', T('set up', { k: 'pv' }))).toBe('other');
    expect(baseGrade('colloc', { k: 'pv', form: 'gap' })).toBe(1);
    expect(baseGrade('colloc', { k: 'ch', form: 'gap' })).toBe(1);
  });
  it('M41: Synonym des Satzes → Auch richtig; Ausweichwort → evade', () => {
    expect(out('turnaround time', T('lead time', { syn: ['turnaround time'] }))).toBe('syn');
    expect(out('problem', T('bottleneck', { evade: ['problem'] }))).toBe('evade');
  });
});

describe('Planer mit V2-Regeln', () => {
  it('Auch richtig: keine Note, keine Buchung, Wiederkehr nach 3–5 Karten (M41)', () => {
    const l = learned();
    const t = l.b!.due + 3600_000;
    const r = applyAnswer(l, ans(t, { outcome: 'syn' }), ctx());
    expect(r.grade).toBeNull();
    expect(r.booked).toEqual([]);
    expect(r.lex.step?.gap).toBeGreaterThanOrEqual(3);
    expect(r.lex.step?.gap).toBeLessThanOrEqual(5);
  });
  it('zweites gleiches Ausweichwort → Hard (M41)', () => {
    const l = learned();
    const t = l.b!.due + 3600_000;
    const r1 = applyAnswer(l, ans(t, { outcome: 'evade', hit: 'problem' }), ctx());
    expect(r1.grade).toBeNull();
    expect(r1.lex.fq?.ew).toContain('problem');
    const later = r1.lex.b!.due + 3600_000;
    const r2 = applyAnswer({ ...r1.lex, day: null }, ans(later, { outcome: 'evade', hit: 'problem' }), ctx());
    expect(r2.grade).toBe(2);
  });
  it('„Aufgabe war unfair“: ohne Planwirkung, kein Lernschritt, Ereignis an die Inhaltsprüfung (M43)', () => {
    const l = learned();
    const t = l.b!.due + 3600_000;
    const r = applyAnswer(l, ans(t, { outcome: 'unfair' }), ctx());
    expect(r.booked).toEqual([]);
    // Nur der gemeldete Satz wird gemerkt (die nächste Abfrage nimmt einen anderen); Termine, Stufe und Lernschritt bleiben.
    expect({ ...r.lex, sn: l.sn, sync: l.sync }).toEqual(l);
    expect(r.events).toContain('unfair');
  });
  it('abgelehnte Spracherkennung ist nie ein Fehler (M31)', () => {
    const l = learned();
    const r = applyAnswer(l, ans(l.b!.due + 3600_000, { form: 'say', outcome: 'asr' }), ctx());
    expect(r.lex).toEqual(l);
  });
  it('Auswahl ändert S, D und due nie (M2/M23)', () => {
    const l = learned();
    const r = applyAnswer(l, ans(l.b!.due + 3600_000, { form: 'choice', outcome: 'ok' }), ctx());
    expect([r.lex.u, r.lex.b]).toEqual([l.u, l.b]);
    expect(r.booked).toEqual([]);
  });
  it('zweiter Versuch: kein Beleg-Tag, kein Aufstieg (learning-scientist V2 Befund 2)', () => {
    const l = { ...learned(), lv: 3, ev: { f: [addDays(dayKey(T0), 1)], o: 0, s: 0 } };
    const t = l.b!.due + 3600_000;
    const r = applyAnswer(l, ans(t, { outcome: 'ok', first: 'wrong' }), ctx());
    expect(r.lex.ev.f).toEqual(l.ev.f);
    expect(r.lex.lv).toBe(3);
  });
  it('nach einem Formfehler mit Hard kommt die Form in der Runde noch einmal (M53, Befund 6)', () => {
    const l = learned();
    const r = applyAnswer(l, ans(l.b!.due + 3600_000, { outcome: 'spell' }), ctx());
    expect(r.grade).toBe(2);
    expect(r.lex.step?.gap).toBe(4);
  });
  it('zweiter Versuch kostet keine Stufe (M45)', () => {
    const l = { ...learned(), lv: 4 };
    const t = l.b!.due + 3600_000;
    const r = applyAnswer(l, ans(t, { outcome: 'ok', first: 'wrong' }), ctx());
    expect(r.grade).toBe(1);
    expect(r.lex.lv).toBe(4);
  });
  it('Kollokationsfehler am Einzelwort: Hard und Partner markieren (M56)', () => {
    const l = learned();
    const r = applyAnswer(l, ans(l.b!.due + 3600_000, { outcome: 'colloc' }), ctx());
    expect(r.grade).toBe(2);
    expect(r.events).toContain('partner');
    const c = applyAnswer({ ...learned(T0, 'col') }, ans(l.b!.due + 3600_000, { outcome: 'colloc' }), ctx());
    expect(c.grade).toBe(1);
  });
  it('Satzbindung: richtig im Ankersatz, zweimal in Folge falsch in neuen Sätzen → 2 Termine ohne Satz (M57)', () => {
    let l = { ...learned(), lv: 4, u: { ...learned().u, s: 10 } };
    const next = (x: Lex, over: Partial<Answer>) => applyAnswer({ ...x, day: null }, ans(x.b!.due + 3600_000, over), ctx());
    l = next(l, { anchor: true, sentence: 'x#0' }).lex;
    const r1 = next(l, { outcome: 'wrong', anchor: false, sentence: 'x#2' });
    expect(r1.lex.fq?.nb).toBe(0);
    const r2 = next(r1.lex, { outcome: 'wrong', anchor: false, sentence: 'x#3' });
    expect(r2.lex.fq?.nb).toBe(2);
    expect(r2.events).toContain('bound');
    // dazwischen ein Treffer im neuen Satz setzt die Folge zurück
    const ok = next(next(r1.lex, { anchor: false, sentence: 'x#4' }).lex, { outcome: 'wrong', anchor: false, sentence: 'x#5' });
    expect(ok.lex.fq?.nb).toBe(0);
  });
  it('lex mit fq besteht das strenge Schreib-Schema', () => {
    const l = learned();
    const r = applyAnswer(l, ans(l.b!.due + 3600_000, { outcome: 'evade', hit: 'problem' }), ctx());
    expect(lexWriteSchema.safeParse(r.lex).success).toBe(true);
  });
});

describe('Problemwörter und Paare (M14)', () => {
  it('beim 6. Fehler neue Darstellung, danach alle 4', () => {
    expect([5, 6, 7, 9, 10, 14].map(isLeechCount)).toEqual([false, true, false, false, true, true]);
    const l = { ...learned(), lc: 5 };
    const t = l.b!.due + 3600_000;
    const r = applyAnswer(l, ans(t, { outcome: 'wrong' }), ctx());
    expect(r.lex.lc).toBe(6);
    expect(r.events).toContain('leech');
  });
  it('falscher Freund → Kontrastkarte; echtes Paar → Kontrast und Paar-Regel; sonst Werkstatt', () => {
    expect(leechTreatment('ff')).toBe('contrast');
    expect(leechTreatment('pair')).toBe('contrast');
    expect(leechTreatment(null)).toBe('workshop');
  });
  it('Paar-Regel: das zweite Wort ruht, bis das Problemwort 7 Tage hält; falsche Freunde ruhen nie', () => {
    const a = { ...learned(), pair: 'vocab/effect', lc: 0 };
    const leech = { ...learned(), pair: 'vocab/affect', lc: 6, b: { ...learned().b!, s: 3 } };
    const cat = new Catalog([
      { path: 'vocab/affect', lex: a, order: 1, trap: 'pair' },
      { path: 'vocab/effect', lex: leech, order: 2, trap: 'pair' },
    ]);
    expect(cat.rests('vocab/affect')).toBe(true);
    expect(cat.rests('vocab/effect')).toBe(false);
    const held = new Catalog([
      { path: 'vocab/affect', lex: a, order: 1, trap: 'pair' },
      { path: 'vocab/effect', lex: { ...leech, b: { ...leech.b, s: 8 } }, order: 2, trap: 'pair' },
    ]);
    expect(held.rests('vocab/affect')).toBe(false);
    const ff = new Catalog([
      { path: 'vocab/affect', lex: a, order: 1, trap: 'ff' },
      { path: 'vocab/effect', lex: leech, order: 2, trap: 'pair' },
    ]);
    expect(ff.rests('vocab/affect')).toBe(false);
  });
  it('ruhendes Lexem kommt nicht in den Tagesplan', async () => {
    const { buildDayPlan } = await import('../../../src/modules/vocab/domain/day');
    const due = dayStartOf(dayKey(T0 + 5 * D));
    const a = { ...learned(), pair: 'vocab/effect', u: { ...learned().u, due }, b: { ...learned().b!, due } };
    const leech = { ...learned(), pair: 'vocab/affect', lc: 7, b: { ...learned().b!, s: 2, due: due + 30 * D }, u: { ...learned().u, due: due + 30 * D } };
    const cat = new Catalog([
      { path: 'vocab/affect', lex: a, order: 1, trap: 'pair' },
      { path: 'vocab/effect', lex: leech, order: 2, trap: 'pair' },
    ]);
    const p = buildDayPlan(cat, T0 + 5 * D + 3600_000, DEFAULT_CFG, {}).plan;
    expect(p.plan.map((e) => e[0])).not.toContain('vocab/affect');
  });
});
