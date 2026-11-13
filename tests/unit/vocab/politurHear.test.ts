import { describe, expect, it } from 'vitest';
import { vmDe as de } from '../../../src/i18n/parts/vm.de';
import { vmEn as en } from '../../../src/i18n/parts/vm.en';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { audioOf, bareMeaning, cardOf, evaluate, isHear, previewOf, resultOf, textOf, planCtxOf } from '../../../src/modules/vocab/domain/flow';
import { emptyFq, LADDER_U, meaningBare, NO_CARD, pickForm } from '../../../src/modules/vocab/domain/forms';
import { applyAnswer, emptyLex, type PlanCtx, PROBE_CHECK_DAYS } from '../../../src/modules/vocab/domain/planner';
import { looksClose, pickOptions } from '../../../src/modules/vocab/domain/pick';
import { isProblem, PROBLEM_AT, PROBLEM_CLEAR_S, PROBLEM_REST_DAYS } from '../../../src/modules/vocab/domain/leech';
import type { Task } from '../../../src/modules/vocab/domain/session';
import { addDays, dayKey, dayStartOf } from '../../../src/domain/date';
import { DEFAULT_CFG, type Form, type Lex } from '../../../src/modules/vocab/domain/types';
import { sentencesOf } from '../../../src/modules/vocab/domain/card';
import { D, learned, play, T0, wordDoc, world } from './p2World';

// Politur P2 Punkte 5–8 (Emrahs Entscheidung E3 vom 13.11.2026, Prüfbericht S4–S7): Hören, „Kennst du es schon?“, schärfere Auswahl,
// Problemwörter. Erfundene Daten.

type Doc = Record<string, unknown>;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const task = (over: Partial<Task> = {}): Task => ({ path: 'vocab/scope', form: 'gap', step: 0, intro: false, planned: true, why: 'due', sent: 's', cue: false, ...over });
const doc: Doc = { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }] };
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/scope', planned: true, load: () => 0, siblings: new Set(), ...over });
/** Gelerntes Wort, nur Verstehen heute fällig (Benutzen erst in 20 Tagen), zuletzt mit `last` abgefragt. */
const uDue = (path: string, last: Form = 'meaning', h: Partial<Record<Form, [number, number]>> = {}): Lex => {
  const l = learned(path, T0 - 10 * D);
  return { ...l, b: { ...l.b!, due: T0 + 20 * D }, fq: { ...emptyFq(), l: last, h } };
};

describe('Hören: Formen der Verstehen-Spur (P2 Nr. 5b, S4)', () => {
  it('mit Ton wechselt die Spur je Wort zur schwächeren Form, nie zweimal dieselbe; ohne Ton nur „Bedeutung lesen“', () => {
    const base = uDue('vocab/scope');
    // Zuletzt „Bedeutung lesen“ → die nächste ist eine Hör-Form.
    expect(pickForm(base, 'u', { de: true, audio: true }).form).toBe('tone_mean');
    // Schwächere Form gewinnt: „Hören → Bedeutung“ sitzt (3 von 3), „Satz hören“ noch nicht (0 von 2).
    const weak = uDue('vocab/scope', 'meaning', { tone_mean: [3, 3], listen: [2, 0] });
    expect(pickForm(weak, 'u', { de: true, audio: true }).form).toBe('listen');
    // Nie zweimal dieselbe: zuletzt „Satz hören“ → nicht wieder „Satz hören“, auch wenn es die schwächste ist.
    const again = uDue('vocab/scope', 'listen', { tone_mean: [3, 3], listen: [2, 0], meaning: [3, 3] });
    expect(pickForm(again, 'u', { de: true, audio: true }).form).not.toBe('listen');
    // Ohne Ton: keine Hör-Form (Gerät stumm).
    expect(pickForm({ ...base, fq: { ...emptyFq(), l: 'gap' } }, 'u', { de: true }).form).toBe('meaning');
    // Formen ohne Karte (Diktat, Bausteine) werden nie gewählt; jede Stufe hat mit Ton mindestens zwei stellbare Formen.
    for (const lv of [1, 2, 3, 4, 5, 6, 7]) {
      const forms = LADDER_U[lv]!.filter((f) => !NO_CARD.has(f));
      expect(forms.length, `Stufe ${lv}`).toBeGreaterThanOrEqual(2);
      expect(forms).toContain('listen');
    }
  });

  it('ohne Ton zwei Textformen je Stufe (Prüfbefund 13.11.2026): „Bedeutung“ abwechselnd im Satz und ohne Satz, gebucht als `meaning`', () => {
    // „Hören → Bedeutung“ steht auf jeder Stufe (auch 1–2).
    for (const lv of [1, 2, 3, 4, 5, 6, 7]) expect(LADDER_U[lv], `Stufe ${lv}`).toContain('tone_mean');
    // Ohne Ton wählt die Spur immer `meaning` – die Darstellung wechselt mit jeder `meaning`-Abfrage des Worts.
    const shown: string[] = [];
    let lex = uDue('vocab/scope', 'gap');
    for (let i = 0; i < 4; i++) {
      const f = pickForm(lex, 'u', { de: true }).form;
      expect(f).toBe('meaning');
      const card = cardOf({ task: task({ form: f }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
      expect([card.mode, card.form]).toEqual(['meaning', 'meaning']);
      expect(bareMeaning(card)).toBe(meaningBare(lex));
      shown.push(card.sentence ? 'satz' : 'ohne');
      lex = { ...lex, fq: { ...lex.fq!, l: 'meaning', h: { ...lex.fq!.h, meaning: [i + 1, i + 1] } } };
    }
    expect(shown).toEqual(['satz', 'ohne', 'satz', 'ohne']);
    // Ohne Satz: gefragt ist die Bedeutung des Worts (Antwort = Stichwort, geprüft wird die deutsche Bedeutung).
    const bareLex = { ...lex, fq: { ...lex.fq!, h: { meaning: [1, 1] as [number, number] } } };
    const bareCard = cardOf({ task: task({ form: 'meaning' }), doc, lex: bareLex, teach: {}, nowMs: T0, sbGate: null })!;
    expect([bareCard.sentence, bareCard.answer]).toEqual([null, 'scope']);
    expect(evaluate(bareCard, 'Umfang', dict).outcome).toBe('ok');
  });

  it('Karten: „Hören → Bedeutung“ ohne Satz und Text, „Satz hören“ mit Lücke; Textform bei „Kann gerade nicht hören“', () => {
    const lex = uDue('vocab/scope');
    const tone = cardOf({ task: task({ form: 'tone_mean' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect([tone.mode, tone.form, tone.sentence, tone.answer]).toEqual(['tone_mean', 'tone_mean', null, 'scope']);
    expect(audioOf(tone)).toBe('scope');
    const listen = cardOf({ task: task({ form: 'listen' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect([listen.mode, listen.form]).toEqual(['listen', 'listen']);
    expect(listen.sentence).not.toBeNull();
    // Der Ton ist der GANZE Satz (mit dem Wort), der Text zeigt das Wort als Lücke.
    expect(audioOf(listen)?.toLowerCase()).toContain('scope');
    expect(listen.sentence!.gap.segs.some((g) => g.t === 'gap')).toBe(true);
    expect([isHear(tone.mode), isHear(listen.mode)]).toEqual([true, true]);
    // „Kann gerade nicht hören“: dieselbe Abfrage als „Bedeutung lesen“, gebucht als `meaning`.
    expect([textOf(tone).mode, textOf(tone).form, textOf(tone).sentence]).toEqual(['meaning', 'meaning', null]);
    expect([textOf(listen).mode, textOf(listen).form]).toEqual(['meaning', 'meaning']);
    expect(textOf(listen).sentence?.sent.key).toBe(listen.sentence?.sent.key);
    // Ohne Satz gibt es „Satz hören“ nicht (fällt auf die Textform zurück, die das Lexem hat).
    const bare = cardOf({ task: task({ form: 'listen' }), doc: { word: 'scope', de: 'Umfang' }, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(bare.mode).not.toBe('listen');
  });

  it('Notenregeln: „Hören → Bedeutung“ prüft die deutsche Bedeutung (bis „Leicht“), „Satz hören“ das Wort (höchstens „Gut“); Warum ohne „hier“', () => {
    const lex = uDue('vocab/scope');
    const tone = cardOf({ task: task({ form: 'tone_mean' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(evaluate(tone, 'Umfang', dict).outcome).toBe('ok');
    expect(evaluate(tone, 'scope', dict).outcome).toBe('wrong');
    const listen = cardOf({ task: task({ form: 'listen' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(evaluate(listen, listen.answer, dict).outcome).toBe('ok');
    const cat = new Catalog([{ path: 'vocab/scope', lex, order: 0 }]);
    const t = T0 + 3600_000;
    const fast = { t, ms: 2500, fk: 600, hint: 0, sentence: null };
    const rTone = resultOf(lex, { ...fast, form: 'tone_mean', outcome: 'ok' }, planCtxOf(cat, {}, 'vocab/scope', t, DEFAULT_CFG, true));
    const rListen = resultOf(lex, { ...fast, form: 'listen', outcome: 'ok', sentence: listen.sentence!.sent.key }, planCtxOf(cat, {}, 'vocab/scope', t, DEFAULT_CFG, true));
    expect(rTone.booked).toEqual(['u']);
    expect(rListen.booked).toEqual(['u']);
    expect(rListen.grade).toBeLessThanOrEqual(3);
    const band = previewOf({ m: tone, check: { outcome: 'ok' }, given: 'Umfang', lang: 'de', before: lex, result: rTone, planned: true, t });
    expect(band?.why.kind === 'rule' && band.why.key).toBe('vmWhyBareOk');
    // Lösung ist die Bedeutung; das Warum nennt Wort = Bedeutung.
    expect(band?.why.kind === 'rule' && band.why.vars).toMatchObject({ word: 'scope' });
  });

  it('Einführung liest Wort, dann Satz', () => {
    const m = cardOf({ task: task({ form: 'intro', intro: true }), doc, lex: emptyLex('w', 'core', T0), teach: {}, nowMs: T0, sbGate: null })!;
    expect(audioOf(m)).toBe('scope. We need to define the scope of the project.');
  });

  it('Runde: Hör-Karte nur mit Ton; ohne Ton beim Zeigen Textform; „Kann gerade nicht hören“ ohne Note und für den Rest der Runde', async () => {
    let sound = true;
    const docs = [wordDoc(0, uDue('vocab/scope')), wordDoc(1, uDue('vocab/invoice')), wordDoc(2, uDue('vocab/deadline'))];
    const w = world({ docs, env: { audio: () => sound } });
    await w.start('more5');
    let v = w.run.get();
    if (v.k === 'start') {
      w.run.begin();
      v = w.run.get();
    }
    if (v.k !== 'card') throw new Error(v.k);
    expect(isHear(v.card.mode)).toBe(true);
    expect(w.run.autoAudio()).toBe(true);
    const before = w.tuples().length;
    w.run.cantHear();
    const t1 = w.run.get();
    if (t1.k !== 'card') throw new Error(t1.k);
    expect([t1.card.mode, t1.card.form]).toEqual(['meaning', 'meaning']);
    // Der Wechsel bucht nichts.
    await w.run.settled();
    expect(w.tuples().length).toBe(before);
    w.run.check(t1.card.de.split(',')[0]!, { ms: 4000, fk: 1200 });
    w.run.next();
    // Rest der Runde: Textformen, obwohl der Plan Hör-Formen vorsah.
    const t2 = w.run.get();
    if (t2.k !== 'card') throw new Error(t2.k);
    expect(isHear(t2.card.mode)).toBe(false);
    expect(w.run.autoAudio()).toBe(false);
    // Geplant mit Ton, beim Zeigen stumm: gleich die Textform (ohne Note).
    sound = true;
    const w2 = world({ docs, env: { audio: () => sound } });
    await w2.start();
    expect(w2.run.get().k).toBe('start');
    sound = false;
    w2.run.begin();
    const first = w2.run.get();
    if (first.k !== 'card') throw new Error(first.k);
    expect(first.card.mode).toBe('meaning');
    // Ohne Ton schon beim Planen: keine Hör-Form.
    const w3 = world({ docs, env: { audio: () => false } });
    await w3.start('more5');
    const mute = w3.run.get();
    if (mute.k !== 'card') throw new Error(mute.k);
    expect(isHear(mute.card.mode)).toBe(false);
  });
});

describe('„Kennst du es schon?“ vor der Einführung (P2 Nr. 6, S5)', () => {
  it('Vorkarte nur vor neuen Einzelwörtern; „Nein, neu“ → Einführung; „Ja, prüf mich“ richtig → Verstehen „Gut“, Stufe 2, Benutzen morgen als Lücke', async () => {
    const w = world({ fresh: 2 });
    await w.start('new5');
    let v = w.run.get();
    if (v.k === 'start') {
      w.run.begin();
      v = w.run.get();
    }
    if (v.k !== 'card') throw new Error(v.k);
    expect([v.kind, v.ask, v.canProbe]).toEqual(['intro', true, true]);
    const first = v.task.path;
    w.run.probe();
    const p = w.run.get();
    if (p.k !== 'card') throw new Error(p.k);
    expect([p.kind, p.card.mode, p.ask]).toEqual(['probe', 'probe', false]);
    // Gefragt ist die Bedeutung (das Wort stand auf der Vorkarte).
    w.run.check(p.card.de.split(',')[0]!, { ms: 4000, fk: 1500 });
    const b = w.run.get();
    if (b.k !== 'band') throw new Error(b.k);
    expect(b.check.outcome).toBe('ok');
    w.run.next();
    await w.run.settled();
    // Band: kommt am nächsten Lerntag wieder (Benutzen-Kontrolle).
    expect(b.band.next).toEqual({ kind: 'date', day: addDays(dayKey(T0), 1), extra: null });
    const lex = w.lexIn(first);
    expect(lex.lv).toBe(2);
    expect(PROBE_CHECK_DAYS).toBe(1);
    expect(lex.b?.due).toBe(dayStartOf(addDays(dayKey(T0), 1)));
    expect(lex.b?.reps).toBe(0);
    expect(lex.u.reps).toBe(1);
    // Verlauf: als Form `meaning`, Spur Verstehen, Note „Gut“.
    const probeRow = w.tuples().find((x) => x[1] === first);
    expect([probeRow?.[2], probeRow?.[3], probeRow?.[4]]).toEqual([0, 'meaning', 3]);
    // Das zweite Wort: „Nein, neu“ → die Einführungskarte, ohne Vorkarte.
    const n = w.run.get();
    if (n.k !== 'card') throw new Error(n.k);
    expect(n.ask).toBe(true);
    w.run.knowNo();
    const intro = w.run.get();
    if (intro.k !== 'card') throw new Error(intro.k);
    expect([intro.kind, intro.ask, intro.canProbe]).toEqual(['intro', false, false]);
    expect(intro.card.mode).toBe('intro');
  });
  it('Probe nicht bestanden: das Band sagt „Jetzt lernst du es neu.“ (nicht „Kommt gleich noch einmal …“), danach die Einführung', async () => {
    const w = world({ fresh: 1 });
    await w.start('new5');
    let v = w.run.get();
    if (v.k === 'start') {
      w.run.begin();
      v = w.run.get();
    }
    if (v.k !== 'card') throw new Error(v.k);
    w.run.probe();
    w.run.check('zzzz', { ms: 4000, fk: 1500 });
    const b = w.run.get();
    if (b.k !== 'band') throw new Error(b.k);
    expect(b.band.next).toEqual({ kind: 'relearn' });
    w.run.next();
    const intro = w.run.get();
    if (intro.k !== 'card') throw new Error(intro.k);
    expect(intro.kind).toBe('intro');
    expect(de.vmNextRelearn).toBe('Jetzt lernst du es neu.');
    expect(en.vmNextRelearn.length).toBeGreaterThan(0);
  });

  it('„Ja, prüf mich“ falsch → normale Einführung (keine zweite Probe), Wendungen ohne Vorkarte', async () => {
    const w = world({ fresh: 1 });
    await w.start('new5');
    let v = w.run.get();
    if (v.k === 'start') {
      w.run.begin();
      v = w.run.get();
    }
    if (v.k !== 'card') throw new Error(v.k);
    w.run.probe();
    w.run.check('Kühlschrank', { ms: 4000, fk: 1500 });
    w.run.next();
    const intro = w.run.get();
    if (intro.k !== 'card') throw new Error(intro.k);
    expect([intro.kind, intro.ask ?? false, intro.canProbe]).toEqual(['intro', false, false]);
    const chunk: [string, Doc] = ['chunk/in-charge', { en: 'in charge of', de: 'verantwortlich für', ex: 'She is in charge of the budget.', order: 0, lex: emptyLex('ch', 'edge', T0 - 5 * D) }];
    const c = world({ docs: [chunk] });
    await c.start('new5');
    let cv = c.run.get();
    if (cv.k === 'start') {
      c.run.begin();
      cv = c.run.get();
    }
    if (cv.k !== 'card') throw new Error(cv.k);
    expect([cv.kind, cv.ask ?? false]).toEqual(['intro', false]);
  });
});

describe('Auswahl-Karte (P2 Nr. 7, S6)', () => {
  const T = { path: 'vocab/adopt', de: 'übernehmen, annehmen', pos: 'verb', head: 'adopt' };
  it('Ablenker: Verwechslungspartner vor gleicher Wortart vor eingeführt vor ähnlich; nie dieselbe Bedeutung', () => {
    const pool = [
      { path: 'vocab/a', de: 'Tisch', pos: 'noun', head: 'table', intro: true },
      { path: 'vocab/b', de: 'laufen', pos: 'verb', head: 'run' },
      { path: 'vocab/c', de: 'anpassen', pos: 'verb', head: 'adapt', intro: true },
      { path: 'vocab/d', de: 'verlangen', pos: 'verb', head: 'demand', intro: true },
      { path: 'vocab/e', de: 'Stuhl', pos: 'noun', head: 'chair', near: true },
      { path: 'vocab/f', de: 'annehmen', pos: 'verb', head: 'assume', intro: true },
    ];
    const m = pickOptions(T, pool, 'seed')!;
    const dis = m.options.filter((_, i) => i !== m.right);
    // near (Stuhl) zuerst, dann gleiche Wortart + eingeführt + ähnlich (anpassen), dann gleiche Wortart + eingeführt (verlangen).
    expect(dis.sort()).toEqual(['Stuhl', 'anpassen', 'verlangen'].sort());
    // „annehmen“ ist eine Bedeutung des Ziels → nie Ablenker.
    expect(m.options).not.toContain('annehmen');
    expect(looksClose(pool[2]!, T)).toBe(true);
    expect(looksClose(pool[0]!, T)).toBe(false);
  });

  it('falsche Wahl → Einführung kurz noch einmal (keine Buchung), dann weiter; auch für Wendungen gibt es eine Auswahl', async () => {
    const w = world({ due: 4, fresh: 1 });
    await w.start('new5');
    const seen: string[] = [];
    let wrongOnce = false;
    for (let i = 0; i < 80; i++) {
      const v = w.run.get();
      if (v.k === 'start') w.run.begin();
      else if (v.k === 'pick') {
        seen.push('pick');
        w.run.pickChoose(wrongOnce ? v.right : (v.right + 1) % v.options.length);
        wrongOnce = true;
        await w.run.settled();
        const before = w.tuples().length;
        w.run.pickNext();
        const again = w.run.get();
        if (again.k !== 'card') throw new Error(again.k);
        expect([again.kind, again.again]).toEqual(['intro', true]);
        expect(again.task.path).toBe(v.path);
        expect(w.run.autoAudio()).toBe(false);
        await w.run.settled();
        // Nur der Auswahl-Eintrag (Form `choice`), keine zweite Einführung.
        expect(w.tuples().length).toBe(before);
        w.run.againSeen();
        seen.push('again');
      } else if (v.k === 'card') {
        if (v.ask) w.run.knowNo();
        else if (v.kind === 'intro') w.run.introSeen({ ms: 4000, fk: 0 });
        else {
          w.run.check(v.card.mode === 'meaning' ? v.card.de.split(',')[0]! : v.card.answer, { ms: 5000, fk: 1500 });
          w.run.next();
        }
      } else break;
    }
    expect(seen).toEqual(['pick', 'again']);
    // Wendung: Auswahl aus anderen Wendungen.
    const ch = (id: string, en: string, de: string, lex: Lex): [string, Doc] => [`chunk/${id}`, { en, de, ex: `We talked about ${en} today.`, order: 0, lex }];
    const docs = [
      ch('a', 'in charge of', 'verantwortlich für', emptyLex('ch', 'edge', T0 - 5 * D)),
      ch('b', 'on behalf of', 'im Namen von', learned('chunk/b', T0 - 10 * D, T0 + 20 * D)),
      ch('c', 'in line with', 'im Einklang mit', learned('chunk/c', T0 - 10 * D, T0 + 20 * D)),
      ch('d', 'at short notice', 'kurzfristig', learned('chunk/d', T0 - 10 * D, T0 + 20 * D)),
    ];
    const c = world({ docs });
    await c.start('new5');
    const order = play(c);
    expect(order).toContain('pick:chunk/a');
  });
});

describe('Problemwörter ab dem 3. Vergessen (P2 Nr. 8, S7)', () => {
  const lapse = (l: Lex, t: number, c: PlanCtx = ctx()) => applyAnswer(l, { t, form: 'gap', outcome: 'wrong', hint: 0, ms: 6000, fk: 2000, sentence: 'a' }, c);
  it('ab dem 3. Fehler: Ereignis, Kontrastkarte bei Falle; nach dem 2. noch nicht', () => {
    const l0 = learned('vocab/scope', T0 - 10 * D);
    const two = lapse({ ...l0, lc: 1 }, T0, ctx({ ff: true }));
    expect(two.lex.lc).toBe(2);
    expect(two.events).not.toContain('leech');
    expect(two.lex.ct).toBeUndefined();
    const three = lapse({ ...l0, lc: 2 }, T0, ctx({ ff: true }));
    expect(three.lex.lc).toBe(PROBLEM_AT);
    expect(isProblem(three.lex)).toBe(true);
    expect(three.events).toContain('leech');
    expect(three.lex.ct).toEqual({ at: T0, w: null });
    // Ohne Falle: kein Kontrast (nichts gegenüberzustellen), aber das Ereignis.
    const plain = lapse({ ...l0, lc: 2 }, T0);
    expect(plain.events).toContain('leech');
    expect(plain.lex.ct).toBeUndefined();
    // Verwechselt mit einem anderen echten Wort: Gegenüberstellung mit genau diesem Wort.
    const other = applyAnswer({ ...l0, lc: 2 }, { t: T0, form: 'gap', outcome: 'other', hit: 'range', hint: 0, ms: 6000, fk: 2000, sentence: 'a' }, ctx());
    expect(other.lex.ct).toEqual({ at: T0, w: 'range' });
  });
  it('Problemwort nicht für immer (Prüfbefund 13.11.2026): ab 21 Tagen Stabilität der führenden Spur ist es keins mehr', () => {
    const l0 = learned('vocab/scope', T0 - 10 * D);
    const b = l0.b!;
    expect(isProblem({ ...l0, lc: 3, b: { ...b, s: 5 } })).toBe(true);
    expect(isProblem({ ...l0, lc: 3, b: { ...b, s: PROBLEM_CLEAR_S - 0.1 } })).toBe(true);
    expect(isProblem({ ...l0, lc: 3, b: { ...b, s: PROBLEM_CLEAR_S } })).toBe(false);
    expect(isProblem({ ...l0, lc: 9, b: { ...b, s: 40 } })).toBe(false);
    expect(isProblem({ ...l0, lc: 2, b: { ...b, s: 1 } })).toBe(false);
    // Ohne Benutzen-Spur zählt Verstehen.
    expect(isProblem({ ...l0, lc: 3, b: null, u: { ...l0.u, s: 30 } })).toBe(false);
    expect(isProblem({ ...l0, lc: 3, b: null, u: { ...l0.u, s: 2 } })).toBe(true);
  });

  it('neuer Satz bevorzugt: ein Problemwort bekommt einen Satz, den es noch nie hatte', () => {
    const three: Doc = { ...doc, wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }, { en: 'Let us narrow the scope first.', de: 'Lass uns zuerst den Umfang eingrenzen.' }] };
    const keys = sentencesOf(three, T0, null).map((x) => x.key);
    expect(keys).toHaveLength(3);
    const [a, k1, k2] = keys as [string, string, string];
    // Gezeigt: Anker vor 12 Tagen, der zweite Satz vor 40 Tagen (lange genug her, um wieder dran zu sein); der dritte nie.
    const base = { ...learned('vocab/scope', T0 - 50 * D), sn: [[a, dayKey(T0 - 12 * D)], [k1, dayKey(T0 - 40 * D)]] as [string, string][] };
    const normal = cardOf({ task: task(), doc: three, lex: { ...base, lc: 1 }, teach: {}, nowMs: T0, sbGate: null, avoid: null })!;
    const problem = cardOf({ task: task(), doc: three, lex: { ...base, lc: 3 }, teach: {}, nowMs: T0, sbGate: null, avoid: null })!;
    expect(problem.sentence?.sent.key).toBe(k2);
    // Die Satzwahl bevorzugt nie gezeigte Sätze schon von sich aus (der älteste zuerst); für Problemwörter ist es jetzt fest, auch bei der
    // Wiederkehr am selben Tag und an den ersten beiden Tagen (dort sonst der Ankersatz).
    expect(normal.sentence?.sent.key).toBe(k2);
    const fresh = { ...base, intro: dayKey(T0 - D), lc: 3 };
    expect(cardOf({ task: task(), doc: three, lex: fresh, teach: {}, nowMs: T0, sbGate: null, avoid: null })!.sentence?.sent.key).toBe(k2);
    expect(cardOf({ task: task(), doc: three, lex: { ...fresh, lc: 0 }, teach: {}, nowMs: T0, sbGate: null, avoid: null })!.sentence?.sent.key).toBe(a);
  });

  it(`Verwechslungspartner ruht ${PROBLEM_REST_DAYS} Lerntage nach dem Vergessen des Problemworts, danach wieder`, () => {
    const day = dayKey(T0);
    const partner = { ...learned('vocab/affect', T0 - 20 * D), pair: 'vocab/effect', lc: 0 };
    const lapsed = lapse({ ...learned('vocab/effect', T0 - 20 * D), pair: 'vocab/affect', lc: 2 }, T0, ctx({ path: 'vocab/effect' })).lex;
    expect(lapsed.lc).toBe(3);
    const cat = new Catalog([
      { path: 'vocab/affect', lex: partner, order: 1, trap: 'pair' },
      { path: 'vocab/effect', lex: lapsed, order: 2, trap: 'pair' },
    ]);
    expect([1, 2, 3].map((i) => cat.rests('vocab/affect', addDays(day, i)))).toEqual([true, true, false]);
    // Ohne Tag (alte Aufrufer): nur die alte Regel (≥ 6 Fehler).
    expect(cat.rests('vocab/affect')).toBe(false);
    // Das Problemwort selbst ruht nie; nach einer richtigen Antwort (Termin weiter als morgen) endet die Pause.
    expect(cat.rests('vocab/effect', addDays(day, 1))).toBe(false);
    const ok = applyAnswer(lapsed, { t: T0 + D + 3600_000, form: 'gap', outcome: 'ok', hint: 0, ms: 5000, fk: 1500, sentence: '1' }, ctx({ path: 'vocab/effect' })).lex;
    const after = new Catalog([
      { path: 'vocab/affect', lex: partner, order: 1, trap: 'pair' },
      { path: 'vocab/effect', lex: ok, order: 2, trap: 'pair' },
    ]);
    if ((ok.b ?? ok.u).sd > 1) expect(after.rests('vocab/affect', addDays(day, 2))).toBe(false);
  });
});
