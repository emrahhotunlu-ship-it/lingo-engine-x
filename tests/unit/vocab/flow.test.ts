import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { answerOf, baseAnswer, canonDe, cardOf, checkMeaning, type Draft, draftOpen, evaluate, isDraft, meaningVariants, planCtxOf, previewOf, resultOf } from '../../../src/modules/vocab/domain/flow';
import { applyAnswer, emptyLex, FLAG, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import type { Task } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { replayDraft, writeAnswer, writeIntro, writeProbe } from '../../../src/modules/vocab/data/store';
import { teachOf } from '../../../src/modules/vocab/content';

// V3 Schritt 2b-1: Ablauf einer Lernkarte rein gerechnet (cardOf, Bedeutung prüfen, Buchung, Band) und die Buchungswege Einführung,
// „Kenne ich schon“ und Nachbuchen eines Entwurfs (v3-bau.md §1–3, §6).

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/scope', planned: true, load: () => 0, siblings: new Set(), ...over });
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const task = (over: Partial<Task> = {}): Task => ({ path: 'vocab/scope', form: 'gap', step: 0, intro: false, planned: true, why: 'due', sent: 's', cue: false, ...over });
const doc: Doc = { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }] };

function learned(t: number): Lex {
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  return applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
}
const fresh = (): Lex => emptyLex('w', 'core', T0 - 5 * D);

describe('cardOf', () => {
  it('Einführung im Ankersatz, Lücke = Wort, „Gesucht“ auf Deutsch', () => {
    const m = cardOf({ task: task({ form: 'intro', intro: true }), doc, lex: fresh(), teach: {}, nowMs: T0, sbGate: null })!;
    expect(m.mode).toBe('intro');
    expect(m.sentence?.sent.key).toBe('a');
    expect(m.answer.toLowerCase()).toBe('scope');
    expect(m.cue?.de).toContain('Umfang');
  });
  it('„Kenne ich schon“: ohne Satz, gesucht die Grundform', () => {
    const m = cardOf({ task: task({ form: 'probe', intro: true }), doc: { ...doc, word: 'to rely on sth' }, lex: fresh(), teach: {}, nowMs: T0, sbGate: null })!;
    expect(m.mode).toBe('probe');
    expect(m.sentence).toBeNull();
    expect(m.answer).toBe('rely on');
  });
  it('Lücke mit Anfangsbuchstaben bucht Tipp; Wiederkehr nie im selben Satz', () => {
    const lex = learned(T0 - 10 * D);
    const m = cardOf({ task: task({ form: 'gap_hint' }), doc, lex, teach: {}, nowMs: T0, sbGate: null, avoid: 'a' })!;
    expect(m.mode).toBe('gap');
    expect(m.firstLetters).toBe(true);
    expect(m.sentence?.sent.key).not.toBe('a');
    const a = answerOf(m, { outcome: 'ok' }, { t: T0, ms: 5000, fk: 900, hint: 0 });
    expect(a.hint).toBe(1);
  });
  it('kein brauchbarer Satz → ohne Satz; Verstehen-Formen → Bedeutung', () => {
    const lex = learned(T0 - 10 * D);
    const bare = { word: 'scope', de: 'Umfang' };
    expect(cardOf({ task: task(), doc: bare, lex, teach: {}, nowMs: T0, sbGate: null })!.mode).toBe('nosent');
    // Formen ohne eigene Karte (Diktat, Bausteine) fallen auf „Bedeutung lesen“ zurück; Satz hören hat seit Politur P2 eine eigene Karte.
    const m = cardOf({ task: task({ form: 'dictation' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(m.mode).toBe('meaning');
    expect(m.form).toBe('meaning');
  });
  it('Kontrastkarte: Lücke im frischen Satz, „Gesucht“ immer, Falle und Verwechslung mitgegeben; ohne Satz ohne Satz', () => {
    const lex = { ...learned(T0 - 10 * D), lv: 6, ct: { at: T0 - D, w: 'become' } };
    const m = cardOf({ task: task({ form: 'contrast' }), doc, lex, teach: { ff: 'bekommen' }, nowMs: T0, sbGate: null })!;
    expect(m.form).toBe('contrast');
    expect(m.mode).toBe('gap');
    expect(m.cue).toMatchObject({ ff: true });
    expect(m.contrast).toEqual({ w: 'become', ff: 'bekommen', pair: null });
    const bare = cardOf({ task: task({ form: 'contrast' }), doc: { word: 'scope', de: 'Umfang' }, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect([bare.mode, bare.form]).toEqual(['nosent', 'contrast']);
  });
  it('Politur P2 (Prüfbericht S2): Wendung mit ganzer Lücke wird als freier Abruf gebucht – „Gut“, Aufstieg möglich, kein „knapp“ bei richtig', () => {
    const chunk: Doc = { en: 'to weigh up the options', de: 'die Möglichkeiten abwägen', ex: 'We should weigh up the options before we decide.', wx: [{ en: 'Let us weigh up the options first.', de: 'Wägen wir erst die Möglichkeiten ab.' }] };
    const lex: Lex = { ...learned(T0 - 10 * D), k: 'ch', lv: 2, b: { ...learned(T0 - 10 * D).b!, due: T0 - D } };
    // Auch ein alter Plan-Eintrag oder Entwurf mit der Form „Teil einer Wendung“ zeigt die ganze Lücke und bucht sie als Lücke.
    const m = cardOf({ task: task({ path: 'chunk/weigh-up', form: 'cloze_part' }), doc: chunk, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect([m.mode, m.form]).toEqual(['gap', 'gap']);
    expect(m.answer.toLowerCase()).toBe('weigh up the options');
    const check = evaluate(m, 'weigh up the options', dict);
    expect(check.outcome).toBe('ok');
    const a = answerOf(m, check, { t: T0, ms: 6000, fk: 1200, hint: 0 });
    const r = resultOf(lex, a, ctx({ path: 'chunk/weigh-up' }));
    expect(r.grade).toBe(3);
    expect(r.lex.lv).toBe(3);
    const band = previewOf({ m, check, given: 'weigh up the options', lang: 'de', before: lex, result: r, planned: true, t: T0 })!;
    expect(band.tone).toBe('ok');
    expect(band.next).toMatchObject({ kind: 'date' });
    if (band.next.kind === 'date') expect(band.next.extra).not.toBe('tight');
    // Vorher: als Teil-Lücke gebucht → höchstens „Schwer“, kein Aufstieg, Band „knapp“.
    const old = applyAnswer(lex, { ...a, form: 'cloze_part' }, ctx({ path: 'chunk/weigh-up' }));
    expect([old.grade, old.lex.lv]).toEqual([2, 2]);
  });
  it('Formen mit späterer eigener Karte → null', () => {
    for (const form of ['transfer', 'own'] as const) expect(cardOf({ task: task({ form }), doc, lex: learned(T0 - 10 * D), teach: {}, nowMs: T0, sbGate: null })).toBeNull();
  });
});

describe('Bedeutung prüfen', () => {
  it('Varianten ohne Klammern, Artikel und Platzhalter', () => {
    expect(meaningVariants('das Angebot (Preis); Kostenvoranschlag / sich etw. leisten oder gönnen')).toEqual(['angebot', 'kostenvoranschlag', 'leisten', 'gönnen']);
    expect(canonDe('Der Umfang!')).toBe('umfang');
    expect(canonDe('Groesse')).toBe('grösse');
  });
  it('genau, Teil mit Kern, Tippfehler, falsch, leer', () => {
    expect(checkMeaning('umfang', 'Umfang, Rahmen').outcome).toBe('ok');
    expect(checkMeaning('Rahmen', 'Umfang, Rahmen').outcome).toBe('ok');
    expect(checkMeaning('Lieferzeit', 'die Lieferzeit (Dauer bis zur Lieferung)').outcome).toBe('ok');
    expect(checkMeaning('Fristverlängerung', 'Fristverlängerung beantragen').outcome).toBe('ok');
    expect(checkMeaning('Umfnag', 'Umfang').outcome).toBe('typo');
    expect(checkMeaning('Preis', 'Umfang, Rahmen').outcome).toBe('wrong');
    expect(checkMeaning('  ', 'Umfang').outcome).toBe('dunno');
  });
  it('evaluate: Bedeutung über checkMeaning, sonst checkAnswer; „Weiß ich nicht“', () => {
    const lex = learned(T0 - 10 * D);
    const mm = cardOf({ task: task({ form: 'meaning' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(evaluate(mm, 'Rahmen', dict).outcome).toBe('ok');
    const mg = cardOf({ task: task(), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    expect(evaluate(mg, 'scope', dict).outcome).toBe('ok');
    expect(evaluate(mg, 'scope', dict, true).outcome).toBe('dunno');
  });
});

describe('Buchung und Band', () => {
  it('answerOf: Einspruch-Flags, „auch richtig“ zählt als syn, Satzschlüssel', () => {
    const lex = learned(T0 - 10 * D);
    const m = cardOf({ task: task(), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    const f = { t: T0, ms: 7000, fk: 1200, hint: 0 };
    expect(answerOf(m, { outcome: 'wrong' }, f, { override: true }).flags).toBe(FLAG.override);
    expect(answerOf(m, { outcome: 'wrong' }, f, { later: true }).flags).toBe(FLAG.later);
    expect(answerOf(m, { outcome: 'wrong' }, f, { alsoRight: true }).outcome).toBe('syn');
    expect(answerOf(m, { outcome: 'ok' }, f).sentence).toBe(m.sentence!.sent.key);
  });
  it('Band aus demselben Ergebnis wie die Buchung (planCtxOf = Schreibweg)', async () => {
    const lex = learned(T0 - 10 * D);
    lex.b!.due = T0 - D;
    lex.u.due = T0 - D;
    const cat = new Catalog([{ path: 'vocab/scope', lex, order: 0 }]);
    const m = cardOf({ task: task(), doc, lex, teach: teachOf('scope'), nowMs: T0, sbGate: null })!;
    const a = answerOf(m, evaluate(m, 'scope', dict), { t: T0, ms: 6000, fk: 1000, hint: 0 });
    const pre = resultOf(lex, a, planCtxOf(cat, {}, 'vocab/scope', T0, DEFAULT_CFG, true));
    const band = previewOf({ m, check: { outcome: 'ok' }, given: 'scope', lang: 'de', before: lex, result: pre, planned: true, t: T0 })!;
    expect(band.verdict).toBe('ok');
    const h = createMemoryDb({ seed: { 'vocab/scope': { ...doc, lex } } });
    const r = await writeAnswer({ writer: createWriter(h.db), device: 'phone' }, 'vocab/scope', a, { cfg: DEFAULT_CFG, cat, med: {}, planned: true });
    expect(r!.lex.b!.due).toBe(pre.lex.b!.due);
    expect(r!.lex.u.due).toBe(pre.lex.u.due);
  });
  it('Bedeutungs-Band: Lösung ist die deutsche Bedeutung', () => {
    const lex = learned(T0 - 10 * D);
    lex.u.due = T0 - D;
    const m = cardOf({ task: task({ form: 'meaning' }), doc, lex, teach: {}, nowMs: T0, sbGate: null })!;
    const c = evaluate(m, 'Preis', dict);
    const a = answerOf(m, c, { t: T0, ms: 6000, fk: 1000, hint: 0 });
    const band = previewOf({ m, check: c, given: 'Preis', lang: 'de', before: lex, result: resultOf(lex, a, ctx()), planned: true, t: T0 })!;
    expect(band.verdict).toBe('notYet');
    expect(band.line).toEqual({ kind: 'swap', given: 'Preis', answer: 'Umfang, Rahmen' });
  });
  it('baseAnswer', () => {
    expect(baseAnswer('to bring sth forward')).toBe('bring forward');
    expect(baseAnswer('scope')).toBe('scope');
  });
});

describe('Buchungswege Einführung, „Kenne ich schon“, Entwurf', () => {
  const setup = (lex: Lex) => {
    const h = createMemoryDb({ seed: { 'vocab/scope': { ...doc, lex } } });
    const cat = new Catalog([{ path: 'vocab/scope', lex, order: 0 }]);
    return { h, cat, deps: { writer: createWriter(h.db), device: 'phone' } };
  };
  const lexIn = (h: ReturnType<typeof createMemoryDb>) => (h.dump()['vocab/scope'] as Doc).lex as Lex;
  const vlogCount = (h: ReturnType<typeof createMemoryDb>) => Object.entries(h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).reduce((n, [, d]) => n + Object.values((d).e as Doc).filter(Boolean).length, 0);

  it('Einführung: Lernschritt A, keine Note, ein Verlaufseintrag; zweimal → nur einmal', async () => {
    const { h, cat, deps } = setup(fresh());
    const a = { t: T0, form: 'intro' as const, outcome: 'wrong' as const, hint: 0, ms: 4000, fk: 1500, sentence: 'a' };
    const r = await writeIntro(deps, 'vocab/scope', a, cat);
    expect(r!.grade).toBeNull();
    expect(lexIn(h).step?.n).toBe(1);
    expect(lexIn(h).intro).not.toBeNull();
    expect(await writeIntro(deps, 'vocab/scope', a, cat)).toBeNull();
    expect(vlogCount(h)).toBe(1);
  });
  it('„Kenne ich schon“ richtig → Verstehen „Gut“, Stufe 2, Benutzen morgen, Verlauf als `meaning`; falsch → nur Verlauf, Lexem unverändert', async () => {
    const s1 = setup(fresh());
    const ok = { t: T0, form: 'probe' as const, outcome: 'ok' as const, hint: 0, ms: 4000, fk: 1500, sentence: null };
    const r = await writeProbe(s1.deps, 'vocab/scope', ok, { cfg: DEFAULT_CFG, cat: s1.cat, med: {}, planned: true });
    expect(lexIn(s1.h).lv).toBe(2);
    expect(r!.booked).toEqual(['u']);
    expect(lexIn(s1.h).b!.reps).toBe(0);
    const rows = Object.entries(s1.h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).flatMap(([, d]) => Object.values((d).e as Doc).filter(Boolean) as unknown[][]);
    expect(rows.map((x) => [x[2], x[3], x[4]])).toEqual([[0, 'meaning', 3]]);
    const s2 = setup(fresh());
    const before = lexIn(s2.h);
    expect(await writeProbe(s2.deps, 'vocab/scope', { ...ok, outcome: 'wrong' }, { cfg: DEFAULT_CFG, cat: s2.cat, med: {}, planned: true })).toBeNull();
    expect(lexIn(s2.h)).toEqual(before);
    expect(vlogCount(s2.h)).toBe(1);
  });
  it('Antwort doppelt (Weiter und Verlassen zugleich) → einmal gebucht', async () => {
    const lex = learned(T0 - 10 * D);
    lex.b!.due = T0 - D;
    const { h, cat, deps } = setup(lex);
    const a = { t: T0, form: 'gap' as const, outcome: 'ok' as const, hint: 0, ms: 4000, fk: 1500, sentence: 'a' };
    const o = { cfg: DEFAULT_CFG, cat, med: {}, planned: true };
    await Promise.all([writeAnswer(deps, 'vocab/scope', a, o), writeAnswer(deps, 'vocab/scope', a, o)]);
    expect(vlogCount(h)).toBe(1);
    expect(lexIn(h).ev.f.length).toBe(lex.ev.f.length + 1);
  });
  it('Entwurf: Prüfung, offen nur ohne Buchung, Nachbuchen genau einmal', async () => {
    const lex = learned(T0 - 10 * D);
    lex.b!.due = T0 - D;
    const d: Draft = { v: 1, kind: 'answer', path: 'vocab/scope', planned: true, a: { t: T0, form: 'gap', outcome: 'ok', hint: 0, ms: 4000, fk: 1500, sentence: 'a' } };
    expect(isDraft(d)).toBe(true);
    expect(isDraft({ ...d, path: 'app/profile' })).toBe(false);
    expect(isDraft({ ...d, a: null })).toBe(false);
    // Anki-Entwurf (S6b-3): Aufdecken braucht ein Selbsturteil 1–4.
    expect(isDraft({ ...d, a: { ...d.a, form: 'flip', self: 3, flags: 8 } })).toBe(true);
    expect(isDraft({ ...d, a: { ...d.a, form: 'flip' } })).toBe(false);
    expect(isDraft({ ...d, a: { ...d.a, form: 'flip', self: 5 } })).toBe(false);
    expect(draftOpen(d, lex)).toBe(true);
    expect(draftOpen(d, null)).toBe(false);
    const { h, cat, deps } = setup(lex);
    expect(await replayDraft(deps, d, { cfg: DEFAULT_CFG, cat, med: {} })).not.toBeNull();
    expect(draftOpen(d, cat.get('vocab/scope')!.lex)).toBe(false);
    expect(await replayDraft(deps, d, { cfg: DEFAULT_CFG, cat, med: {} })).toBeNull();
    expect(vlogCount(h)).toBe(1);
    expect(draftOpen({ ...d, kind: 'intro' }, fresh())).toBe(true);
  });
});
