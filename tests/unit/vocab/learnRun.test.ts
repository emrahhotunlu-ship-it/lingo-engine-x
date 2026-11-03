import { describe, expect, it } from 'vitest';
import { createWriter, type Writer } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { type CheckDict } from '../../../src/modules/vocab/domain/check';
import { applyAnswer, emptyLex, introduce, FLAG, type PlanCtx, STEP_LATER } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import type { Draft } from '../../../src/modules/vocab/domain/flow';
import { type DraftStore, LearnRun, type LearnStart, readDrafts, writeGate } from '../../../src/modules/vocab/ui/learnRun';

// Wörter-Modul V3 Schritt 2b-2: Steuerung einer Lernrunde (ohne React): Sperre, Karte → Prüfen → Band → Weiter, Buchung genau einmal,
// Entwurf im Browser bis zur Buchung, Nachbuchen beim Start, Einführung/„Kenne ich schon“, Einspruch und Rücknahme.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const dict: CheckDict = { isWord: () => false, misspell: new Map(), confusable: new Map(), toUS: (w) => w };
const ctx = (): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/scope', planned: true, load: () => 0, siblings: new Set() });
const base: Doc = { word: 'scope', de: 'Umfang, Rahmen', pos: 'noun', ex: 'We need to define the scope of the project.', wx: [{ en: 'The scope is too wide.', de: 'Der Umfang ist zu groß.' }] };
const PROFILE: Doc = { vcfg: { min: 15, ret: 0.9, mod: 1 } };
const SCHEMA: Doc = { vocabModule: { v: 1, t: 1, state: 'done' } };

function learned(t: number): Lex {
  let l = introduce(emptyLex('w', 'core', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
  l.b!.due = T0 - D;
  return l;
}

function memStore(init: string | null = null): DraftStore & { value: string | null } {
  const s = {
    value: init,
    get: () => s.value,
    set: (v: string) => {
      s.value = v;
    },
    remove: () => {
      s.value = null;
    },
  };
  return s;
}

function setup(lex: Lex, o: { drafts?: DraftStore & { value: string | null }; writer?: Writer } = {}) {
  const docOf = { ...base, lex };
  const h = createMemoryDb({ seed: { 'vocab/scope': docOf } });
  const drafts = o.drafts ?? memStore();
  let now = T0;
  const run = new LearnRun({ deps: { writer: o.writer ?? createWriter(h.db), device: 'phone' }, dict, lang: () => 'de', drafts, readDay: () => Promise.resolve(null), now: () => (now += 1000) });
  const start = (kind: LearnStart['kind'] = 'word', profile: Doc | null = PROFILE, schema: Doc | null = SCHEMA) =>
    run.start({ kind, docs: [['vocab/scope', docOf]], profile, schema, paths: ['vocab/scope'] });
  const vlog = () => Object.entries(h.dump()).filter(([p]) => /^vlog\/\d/.test(p)).reduce((n, [, d]) => n + Object.values(d.e as Doc).filter(Boolean).length, 0);
  const lexIn = () => (h.dump()['vocab/scope'] as Doc).lex as Lex;
  return { h, run, drafts, start, vlog, lexIn };
}

describe('writeGate', () => {
  it('aus ohne Schalter, Umrechnung offen ohne Marke „done“, sonst frei', () => {
    expect(writeGate(null, SCHEMA)).toBe('off');
    expect(writeGate({ vcfg: { min: 15, ret: 0.9, mod: 0 } }, SCHEMA)).toBe('off');
    expect(writeGate(PROFILE, null)).toBe('migrate');
    expect(writeGate(PROFILE, { vocabModule: { v: 1, t: 1, state: 'running' } })).toBe('migrate');
    expect(writeGate(PROFILE, { vocabModule: 'done' })).toBe('migrate');
    expect(writeGate(PROFILE, SCHEMA)).toBe('ok');
  });
});

describe('readDrafts', () => {
  it('Liste, Einzelentwurf, Kaputtes', () => {
    const d: Draft = { v: 1, kind: 'answer', path: 'vocab/scope', planned: true, a: { t: T0, form: 'gap', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: 'a' } };
    expect(readDrafts(memStore(JSON.stringify([d])))).toEqual([d]);
    expect(readDrafts(memStore(JSON.stringify(d)))).toEqual([d]);
    expect(readDrafts(memStore(JSON.stringify([d, { v: 9 }])))).toEqual([d]);
    expect(readDrafts(memStore('{kaputt'))).toEqual([]);
    expect(readDrafts(memStore())).toEqual([]);
  });
});

describe('LearnRun', () => {
  it('Sperre: Schalter aus bzw. Umrechnung offen → ruhiger Hinweis, nichts geschrieben', async () => {
    const a = setup(learned(T0 - 10 * D));
    await a.start('word', { vcfg: { min: 15, ret: 0.9, mod: 0 } });
    expect(a.run.get()).toEqual({ k: 'closed', why: 'off' });
    const b = setup(learned(T0 - 10 * D));
    await b.start('word', PROFILE, null);
    expect(b.run.get()).toEqual({ k: 'closed', why: 'migrate' });
    expect(a.vlog() + b.vlog()).toBe(0);
  });

  it('Karte → Prüfen → Band → Weiter: genau eine Buchung, Entwurf danach leer, Runde zu Ende', async () => {
    const s = setup(learned(T0 - 10 * D));
    await s.start();
    const v = s.run.get();
    expect(v.k).toBe('card');
    if (v.k !== 'card') return;
    expect(v.kind).toBe('answer');
    s.run.check(v.card.answer, { ms: 5000, fk: 1500 });
    const b = s.run.get();
    expect(b.k).toBe('band');
    if (b.k !== 'band') return;
    expect(b.check.outcome).toBe('ok');
    expect(s.vlog()).toBe(0);
    s.run.next();
    // Entwurf liegt bis zur Buchung im Browser.
    expect(readDrafts(s.drafts)).toHaveLength(1);
    await s.run.settled();
    expect(s.vlog()).toBe(1);
    expect(s.drafts.value).toBeNull();
    expect(s.run.get()).toMatchObject({ k: 'done', n: 1, fresh: 0, review: 1, extra: 0 });
  });

  it('Rundenende (V3 Schritt 4b): einmal gemeldet mit Lerntag, Anzahl, Richtigen und aktiver Zeit; Teilrunde nur mit Antwort', async () => {
    const s = setup(learned(T0 - 10 * D));
    expect(s.run.report(true)).toBeNull();
    await s.start('pflicht');
    // Noch keine Antwort: Verlassen meldet nichts (zählt weder für Heute noch für die Serie).
    expect(s.run.report(true)).toBeNull();
    const v = s.run.get();
    if (v.k === 'start') s.run.begin();
    const c = s.run.get();
    expect(c.k).toBe('card');
    if (c.k !== 'card') return;
    s.run.check(c.card.answer, { ms: 5000, fk: 1500 });
    s.run.next();
    await s.run.settled();
    expect(s.run.get().k).toBe('done');
    const r = s.run.report(false);
    expect(r).toMatchObject({ kind: 'pflicht', day: '2026-11-02', n: 1, right: 1, partial: false });
    expect(r!.activeMs).toBeGreaterThan(0);
    // Genau einmal: ein späteres Verlassen meldet nichts mehr.
    expect(s.run.report(true)).toBeNull();
    expect(s.run.report(false)).toBeNull();
  });

  it('„Warum heute?“: fällige Karte nennt Fälligkeit, letzten freien Abruf und Stufe mit Spur', async () => {
    const s = setup(learned(T0 - 10 * D));
    await s.start('pflicht');
    // Erster Start am Lerntag: Start-Bildschirm (Bild B8) mit den Zahlen des eingefrorenen Plans, dann „Los geht's“.
    const st = s.run.get();
    expect(st.k).toBe('start');
    if (st.k === 'start') expect(st.s).toMatchObject({ due: 1, fresh: 0, back: true, sp: null });
    s.run.begin();
    const r = s.run.reason();
    expect(r?.code).toBe('due');
    const keys = r?.parts.map((p) => p.key) ?? [];
    expect(keys[0]).toMatch(/^vmRsDue/);
    // Lernschritte am Einführungstag sind kein freier Abruf (ev.f bleibt leer); ohne Fehler heißt es schlicht „noch nicht“.
    expect(keys).toContain('vmRsNotYetFree');
    expect(keys.some((k) => k.startsWith('vmRsStage'))).toBe(true);
  });

  it('„Warum heute?“ nach einem Fehler: „seit dem letzten Fehler noch nicht“', async () => {
    const lex = learned(T0 - 10 * D);
    lex.b!.lapses = 1;
    const s = setup(lex);
    await s.start('pflicht');
    s.run.begin();
    expect(s.run.reason()?.parts.map((p) => p.key)).toContain('vmRsNeverFree');
  });

  const unfairEntries = (s: ReturnType<typeof setup>) =>
    Object.entries(s.h.dump())
      .filter(([p]) => /^vlog\/\d/.test(p))
      .flatMap(([, d]) => Object.values(d.e as Doc).filter(Boolean));

  it('Vorab-Einfrieren (Heute, Befund ux 4b Nr. 1): friert vmod/day ein und liefert dieselben Minuten wie danach der Start; gesperrt → null', async () => {
    const s = setup(learned(T0 - 10 * D));
    const min = await s.run.prepare({ docs: [['vocab/scope', { ...base, lex: s.lexIn() }]], profile: PROFILE, schema: SCHEMA });
    expect(min).toBeGreaterThanOrEqual(1);
    expect((s.h.dump()['vmod/day'])?.d).toBeTruthy();
    // Zweite Runde auf derselben Datenbank: Start-Bildschirm mit derselben Minutenzahl (der gespeicherte Plan gilt).
    let now = T0 + 5000;
    const run2 = new LearnRun({ deps: { writer: createWriter(s.h.db), device: 'phone' }, dict, lang: () => 'de', drafts: memStore(), readDay: () => Promise.resolve(null), now: () => (now += 1000) });
    await run2.start({ kind: 'pflicht', docs: [['vocab/scope', { ...base, lex: s.lexIn() }]], profile: PROFILE, schema: SCHEMA });
    const v = run2.get();
    expect(v.k).toBe('start');
    if (v.k === 'start') expect(v.s.min).toBe(min);
    const off = setup(learned(T0 - 10 * D));
    expect(await off.run.prepare({ docs: [], profile: null, schema: SCHEMA })).toBeNull();
    expect(off.h.dump()['vmod/day']).toBeUndefined();
  });

  it('Start nur beim ersten Öffnen am Lerntag; Abschluss nennt Minuten, Pflicht, Gestolpertes mit nächstem Lerntag und morgen', async () => {
    const s = setup(learned(T0 - 10 * D));
    await s.start('pflicht');
    expect(s.run.get().k).toBe('start');
    s.run.begin();
    // Erste Abfrage falsch, danach alles richtig bis zum Ende der Runde.
    let first = true;
    for (let i = 0; i < 20; i++) {
      const v = s.run.get();
      if (v.k !== 'card') break;
      s.run.check(first ? 'zzzz' : v.card.answer, { ms: 5000, fk: 1500 });
      first = false;
      s.run.next();
    }
    await s.run.settled();
    const d = s.run.get();
    expect(d.k).toBe('done');
    if (d.k !== 'done') return;
    expect(d.sum).toMatchObject({ duty: true, learned: [], slips: { n: 1, list: [{ w: 'scope' }] } });
    expect(d.sum!.min).toBeGreaterThanOrEqual(1);
    expect(d.sum!.slips.list[0]!.day > d.sum!.today).toBe(true);
    expect(d.sum!.tomorrow).not.toBeNull();
    // Zweites Öffnen am selben Lerntag (es ist schon gebucht): direkt zur Karte bzw. zum Abschluss, kein Start-Bildschirm.
    const again = setup(s.lexIn());
    await again.start('pflicht');
    expect(again.run.get().k).not.toBe('start');
  });

  it('„Aufgabe melden“ nach FALSCHER Antwort löscht den Fehler nicht: Weg „Später prüfen lassen“ (Wiederkehr in neuem Satz), Verlauf mit `unfair`', async () => {
    const lex = learned(T0 - 10 * D);
    const s = setup(lex);
    await s.start();
    if (s.run.get().k !== 'card') throw new Error('Karte erwartet');
    s.run.check('qqqq', { ms: 5000, fk: 1500 });
    expect(s.run.canUnfair()).toBe(true);
    expect(s.run.unfair()).toBe('again');
    await s.run.settled();
    const after = s.lexIn();
    // Keine Note, kein Termin, keine Stufe – aber ein Lernschritt: das Wort kommt in dieser Runde in einem anderen Satz wieder.
    expect(after.step?.n).toBe(STEP_LATER);
    expect(after.u).toEqual(lex.u);
    expect(after.b).toEqual(lex.b);
    expect(after.lv).toBe(lex.lv);
    const entries = unfairEntries(s);
    expect(entries).toHaveLength(1);
    // Ergebnis der Prüfung bleibt stehen (ehrlicher Verlauf); Kennzeichen „unfair“ + „später“ für Inhaltsprüfung und Auswertung.
    expect((entries[0] as unknown[])[11]).toBe(FLAG.unfair | FLAG.later);
  });

  it('„Aufgabe melden“ nach richtiger Antwort und vor dem Prüfen: zählt nicht (keine Note, kein Termin), Satz gemerkt, zählt nicht im Abschluss', async () => {
    const lex = learned(T0 - 10 * D);
    const s = setup(lex);
    await s.start();
    const v = s.run.get();
    if (v.k !== 'card') throw new Error('Karte erwartet');
    s.run.check(v.card.answer, { ms: 5000, fk: 1500 });
    expect(s.run.unfair()).toBe('void');
    await s.run.settled();
    const after = s.lexIn();
    expect({ ...after, sn: lex.sn, sync: lex.sync }).toEqual(lex);
    expect(unfairEntries(s)).toHaveLength(1);
    expect(s.run.get()).toMatchObject({ k: 'done', n: 1, fresh: 0, review: 0, extra: 0 });

    const s2 = setup(learned(T0 - 10 * D));
    await s2.start();
    expect(s2.run.unfair()).toBe('void');
    await s2.run.settled();
    expect(s2.lexIn().u).toEqual(lex.u);
  });

  it('Verlassen bucht die offene Antwort genau einmal (auch zweimal Verlassen und danach Weiter)', async () => {
    const s = setup(learned(T0 - 10 * D));
    await s.start();
    const v = s.run.get();
    if (v.k !== 'card') throw new Error(v.k);
    s.run.check(v.card.answer, { ms: 5000, fk: 1500 });
    await Promise.all([s.run.leave(), s.run.leave()]);
    s.run.next();
    await s.run.settled();
    expect(s.vlog()).toBe(1);
    expect(s.drafts.value).toBeNull();
  });

  it('Buchung schlägt fehl → Entwurf bleibt; nächster Start bucht ihn nach (genau einmal)', async () => {
    const lex = learned(T0 - 10 * D);
    const drafts = memStore();
    const broken = new Proxy({}, { get: () => () => Promise.reject(new Error('offline')) }) as Writer;
    const s1 = setup(lex, { drafts, writer: broken });
    await s1.start();
    const v = s1.run.get();
    if (v.k !== 'card') throw new Error(v.k);
    s1.run.check(v.card.answer, { ms: 5000, fk: 1500 });
    s1.run.next();
    await s1.run.settled();
    expect(readDrafts(drafts)).toHaveLength(1);
    const kept = drafts.value;
    const s2 = setup(lex, { drafts });
    await s2.start();
    expect(s2.vlog()).toBe(1);
    expect(drafts.value).toBeNull();
    // Die Runde rechnet mit dem nachgebuchten Stand: heute schon gebucht → keine zweite Buchung über den Entwurf.
    const s3 = setup(s2.lexIn(), { drafts: memStore(kept) });
    await s3.start();
    expect(s3.vlog()).toBe(0);
  });

  it('Neues Wort: Einführung mit „Kenne ich schon“; Probe falsch → noch einmal als Einführung (ohne zweite Probe), dann Lernschritt A', async () => {
    const s = setup(emptyLex('w', 'core', T0 - 5 * D));
    await s.start('more5');
    const v = s.run.get();
    if (v.k !== 'card') throw new Error(v.k);
    expect(v.kind).toBe('intro');
    expect(v.canProbe).toBe(true);
    s.run.probe();
    const p = s.run.get();
    if (p.k !== 'card') throw new Error(p.k);
    expect(p.kind).toBe('probe');
    expect(p.canProbe).toBe(false);
    s.run.check('wrongword', { ms: 3000, fk: 1000 });
    const pb = s.run.get();
    if (pb.k !== 'band') throw new Error(pb.k);
    expect(pb.band.knewIt).toBe(false);
    expect(pb.band.next).toEqual({ kind: 'step', mode: 'same', thenTomorrow: false });
    s.run.next();
    const again = s.run.get();
    if (again.k !== 'card') throw new Error(again.k);
    expect(again.kind).toBe('intro');
    expect(again.canProbe).toBe(false);
    s.run.check(again.card.answer, { ms: 3000, fk: 1000 });
    s.run.next();
    await s.run.settled();
    expect(s.lexIn().step?.n).toBe(1);
    expect(s.lexIn().intro).not.toBeNull();
    // Probe (nur Verlauf) + Einführung
    expect(s.vlog()).toBe(2);
  });

  it('„Das wusste ich eigentlich“: wählen ändert nur „Kommt wieder“, Rücknahme stellt das Band wieder her; gebucht wird die gewählte Fassung', async () => {
    const s = setup(learned(T0 - 10 * D));
    await s.start();
    const v = s.run.get();
    if (v.k !== 'card') throw new Error(v.k);
    const ans = v.card.answer;
    s.run.check(`${ans}xx`, { ms: 5000, fk: 1500 });
    const b = s.run.get();
    if (b.k !== 'band') throw new Error(b.k);
    expect(b.band.knewIt).toBe(true);
    s.run.choose('knewIt');
    const k = s.run.get();
    if (k.k !== 'band') throw new Error(k.k);
    expect(k.choice).toBe('knewIt');
    expect(k.band.verdict).toBe(b.band.verdict);
    s.run.choose(null);
    const u = s.run.get();
    if (u.k !== 'band') throw new Error(u.k);
    expect(u.choice).toBeNull();
    expect(u.band.next).toEqual(b.band.next);
    s.run.choose('knewIt');
    s.run.next();
    await s.run.settled();
    expect(s.vlog()).toBe(1);
  });

  it('übernommenes Wort zum ersten Mal hier (K10): erst die Einführungskarte ohne Buchung, dann die Abfrage; einmal je Runde', async () => {
    const lex = learned(T0 - 10 * D);
    lex.mig = { t: T0 - D, from: 'srs1', h: 2, full: 1 };
    const s = setup(lex);
    await s.start();
    const v = s.run.get();
    expect(v.k).toBe('card');
    if (v.k !== 'card') return;
    expect(v.kind).toBe('answer');
    expect(v.teach?.head).toBe('scope');
    s.run.teachSeen();
    const w = s.run.get();
    expect(w).toMatchObject({ k: 'card', kind: 'answer', n: v.n, teach: null });
    expect(w.k === 'card' && w.task).toBe(v.task);
    await s.run.settled();
    expect(s.vlog()).toBe(0);
    if (w.k !== 'card') return;
    s.run.check(w.card.answer, { ms: 5000, fk: 1500 });
    s.run.next();
    await s.run.settled();
    expect(s.vlog()).toBe(1);
  });

  it('K10: nicht bei Wörtern ohne Umstellung und nicht, wenn das Wort nach der Umstellung schon geübt wurde', async () => {
    const a = setup(learned(T0 - 10 * D));
    await a.start();
    const va = a.run.get();
    expect(va.k === 'card' && va.teach).toBeFalsy();
    const lex = learned(T0 - 10 * D);
    lex.mig = { t: T0 - 11 * D, from: 'srs1', h: 0, full: 1 };
    const b = setup(lex);
    await b.start();
    const vb = b.run.get();
    expect(vb.k === 'card' && vb.teach).toBeFalsy();
  });
});
