import { describe, expect, it } from 'vitest';
import { ACT_EVENTS, ACT_MAILS, ACT_ROLES, ACT_TYPES, eventById, mailById, roleById, toneOptions } from '../../src/content/activation/pools';
import { sceneLeaks } from '../../src/content/activation/scenes';
import { activationUnitsOn, activationsOn, isActivationEx, lastActivation, naOf, unitsOfCode } from '../../src/domain/srs/actBase';
import { ACT_FMTS, STEP_FMTS, actDifferences, fmtOfCode, parseActCode, pickActBrief, stepOfFmt, vectorOf, type ActFmt } from '../../src/domain/srs/actBrief';
import { ACT_HARD_ISSUES, activateGrade, fitsShape, precheckAct, selfCheckAct, sentenceCount } from '../../src/domain/srs/actCheck';
import { EX_OF_FMT, actMeaning, buildActTask, canHideTarget, pickPartners, pickSource, type ActTask, type OwnSentence } from '../../src/domain/srs/actTask';
import { CODE_MAX, MIN_DIFFERENT, parseBrief, pickBrief } from '../../src/domain/srs/brief';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { ACT_BACKLOG_HIGH, ACT_BACKLOG_NONE, ACT_BACKLOG_UNITS, ACT_DAY_UNITS, MAINTENANCE_GAP_DAYS, MIN_GAP_DAYS, RETRY_GAP_DAYS, dueStep, isCoreWord, nextStep, planActivations, remainingToday } from '../../src/domain/srs/fahrplan';
import { checkExercise } from '../../src/domain/srs/guard';
import { CATALOG, availableExercises, makeEnv, supports } from '../../src/domain/srs/modes';
import type { QueueItem, TrainCard } from '../../src/domain/srs/types';
import { dayKey } from '../../src/domain/date';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { berlin } from './helpers';

// Wörter aktivieren, Stufe 2 (docs/umbau/aktivierung.md): Fahrplan A1–A5, Pools, Auswahl, Aufgaben, Vorprüfung, Wächter R14.

const NOW = berlin('2026-10-14', 9);
const DAY = 86_400_000;
const TODAY = dayKey(NOW);
type Doc = Record<string, unknown>;

/** Richtige Abrufe an `days` verschiedenen Tagen, dazu die Aktivierungen `acts` ([Tage zurück, Note, Art]). */
const histOf = (days: number, acts: Array<[number, number, string?, string?]> = []): Doc[] => [
  ...Array.from({ length: days }, (_, i) => ({ t: NOW - (i + 2) * DAY - 3600_000, m: 'cloze', g: 3, x: 'cloze' })),
  ...acts.map(([back, g, x, a]) => ({ t: NOW - back * DAY, m: 'produce', g, x: x ?? 'produce', ...(a ? { a } : {}) })),
].sort((p, q) => (p.t) - (q.t));
const doc = (over: Doc = {}): Doc => ({
  word: 'leverage',
  pos: 'noun',
  de: 'Hebelwirkung',
  def: 'the power to influence a result',
  ex: 'We use [leverage] in every price talk.',
  col: [],
  state: 'review',
  S: 10,
  D: 5,
  last: NOW - 3 * DAY,
  due: NOW - 1000,
  reps: 4,
  lapses: 0,
  modes: {},
  order: 900,
  src: 'ai',
  added: '2026-08-01',
  stage: 4,
  hist: histOf(4),
  intro: '2026-08-01',
  ...over,
});
const card = (over: Doc = {}, stage = 4, id = 'lev'): TrainCard => ({ ...(toTrainCard(id, doc(over), true, NOW) as TrainCard), stage: stage as TrainCard['stage'] });
const PAD = [
  ['pipeline', 'Pipeline', 'the list of possible deals'],
  ['renewal', 'Verlängerung', 'the act of continuing a contract'],
  ['stakeholder', 'Beteiligte', 'a person with an interest in a project'],
  ['milestone', 'Meilenstein', 'an important point in a project'],
  ['bottleneck', 'Engpass', 'a place where progress slows down'],
  ['forecast', 'Prognose', 'a statement about what will happen'],
];
const pool = (c: TrainCard): TrainCard[] => [
  c,
  ...PAD.map(([w, d, def], i) => card({ word: w, de: d, def, ex: `The [${w}] matters in every quarter.`, hist: histOf(4), due: NOW - (i + 2) * 1000 }, 4, `p${i}`)),
];
const dueQueue = (cs: readonly TrainCard[]): QueueItem[] => cs.map((c) => ({ key: c.key, reason: 'due', phase: 'quiz' }));
const byKey = (cs: readonly TrainCard[]): Map<string, TrainCard> => new Map(cs.map((c) => [c.key, c]));

describe('Pools als Daten', () => {
  it('Umfang und Zweisprachigkeit: 6 Rollen im Beruf, 16 Lagen im Beruf, 6 Textsorten, 20 Mails mit Antwortzielen; eindeutige Kennungen', () => {
    expect(ACT_ROLES.filter((r) => r.kind === 'job').map((r) => r.id)).toEqual(['buy', 'it', 'cfo', 'team', 'boss', 'partner']);
    expect(ACT_EVENTS.filter((e) => e.kind === 'job').length).toBeGreaterThanOrEqual(16);
    expect(ACT_EVENTS.filter((e) => e.kind === 'daily').length).toBeGreaterThanOrEqual(4);
    expect(ACT_TYPES.map((t) => t.id)).toEqual(['mail', 'slack', 'notes', 'linkedin', 'offer', 'summary']);
    expect(ACT_MAILS.length).toBeGreaterThanOrEqual(20);
    for (const list of [ACT_ROLES, ACT_EVENTS, ACT_TYPES, ACT_MAILS]) expect(new Set(list.map((x) => x.id)).size).toBe(list.length);
    for (const e of ACT_EVENTS) {
      expect(e.de.length, e.id).toBeGreaterThan(10);
      expect(e.en.length, e.id).toBeGreaterThan(10);
      expect(e.tones.length, e.id).toBeGreaterThanOrEqual(2);
      expect(eventById(e.id)).toBe(e);
    }
    for (const r of ACT_ROLES) {
      expect(r.de && r.en, r.id).toBeTruthy();
      expect(roleById(r.id)).toBe(r);
    }
    for (const m of ACT_MAILS) {
      expect(mailById(m.id)?.en.split(' ').length, m.id).toBeGreaterThan(15);
      // Zweisprachig, und nur Antwortziele, die zur Mail passen (Englischlehrer A2): mindestens zwei, höchstens drei, ohne Doppelte.
      expect(m.de.length, `${m.id} de`).toBeGreaterThan(20);
      expect(m.goals.length, `${m.id} goals`).toBeGreaterThanOrEqual(2);
      expect(new Set(m.goals).size).toBe(m.goals.length);
    }
  });
  it('Textsorten und Rollen haben Texte in beiden Oberflächensprachen; Anweisungen in drei Wortlauten je Art', () => {
    const d = de as Record<string, string>;
    const e = en as Record<string, string>;
    const keys = [
      ...ACT_TYPES.map((t) => `actType_${t.id}`),
      ...ACT_FMTS.flatMap((f) => [`actName_${f}`, 'act_' + f + '_1', 'act_' + f + '_2', 'act_' + f + '_3']),
      ...['s', 'q', 'n', 'i', 'k', 'p', 'o', 'r', 'c', 'e', 'x', 'a', 'd', 'f'].map((c) => `actShape_${c}`),
      ...[2, 3, 4, 5].map((n) => `purposeAct${n}`),
      'exName_act_scene', 'exName_act_rewrite', 'exName_act_impulse', 'exName_act_combo', 'exName_act_mail',
      'readyLabel', 'readyHelp', 'readyCount', 'readyRate', 'readyRateNone', 'exOwnFrom', 'trErr_word_choice',
      'ppAct_target', 'ppAct_targetHidden', 'ppAct_short', 'ppAct_same', 'ppAct_copied', 'ppAct_shape', 'ppAct_shape_ml', 'ppActFinal_target', 'ppActFinal_short', 'ppActFinal_same', 'ppActFinal_copied',
    ];
    for (const k of keys) {
      expect(d[k], `de ${k}`).toBeTruthy();
      expect(e[k], `en ${k}`).toBeTruthy();
    }
    // Die drei Wortlaute einer Art sind verschieden, und keiner nennt das Zielwort als Beispiel.
    for (const f of ACT_FMTS) expect(new Set([1, 2, 3].map((n) => d[`act_${f}_${n}`])).size).toBe(3);
  });
  it('Schritte kennen ihre Formate; Töne bleiben nie leer', () => {
    expect(STEP_FMTS[2]).toEqual(['sc']);
    expect(STEP_FMTS[3]).toEqual(['tw', 'rw', 'ex']);
    expect(STEP_FMTS[4]).toEqual(['im', 'lg']);
    expect(STEP_FMTS[5]).toEqual(['ml', 'kb']);
    for (const f of ACT_FMTS) expect(EX_OF_FMT[f]).toMatch(/^act_/);
    expect(stepOfFmt('lg')).toBe(4);
    for (const e of ACT_EVENTS) for (const r of ACT_ROLES) for (const t of ACT_TYPES) expect(toneOptions(e.tones, r.tones, t.tones).length).toBeGreaterThanOrEqual(1);
  });
});

describe('Auswahl der Vorgaben A2–A5 (rein, deterministisch)', () => {
  const target = { lemmas: ['leverage'], card: { lemma: 'leverage', pos: 'noun' } };
  it('gleiche Eingabe, gleiche Vorgabe (kein Würfeln beim Neuzeichnen)', () => {
    for (const f of ACT_FMTS) {
      expect(pickActBrief(f, 'vocab/lev', '2026-10-14|0', [], target)).toEqual(pickActBrief(f, 'vocab/lev', '2026-10-14|0', [], target));
    }
  });
  it('Codes sind lesbar, kürzer als 40 Zeichen und passen zum Format; „Eigener Satz“-Codes bleiben getrennt lesbar', () => {
    for (const f of ACT_FMTS) {
      const b = pickActBrief(f, 'vocab/lev', '2026-10-14|0', [], target);
      expect(b.code.length).toBeLessThan(CODE_MAX);
      expect(parseActCode(b.code)?.fmt).toBe(f);
      expect(parseBrief(b.code)).toBeNull();
      expect(fmtOfCode(b.code)).toBe(f);
    }
    expect(fmtOfCode('j05.q.c.pf')).toBe('pr');
    expect(parseActCode('j05.q.c.pf')).toBeNull();
    expect(parseActCode('sc.e99.cfo.-.n.pr.s')).toBeNull();
    expect(parseActCode('im.e01.cfo.-.n.pr.s')).toBeNull();
    expect(parseActCode('ml.m01.-.-.n.pr.a')?.fmt).toBe('ml');
    expect(parseActCode('sc.e01.cfo.mail.n.pr.s')).toBeNull();
  });
  it('nie dasselbe Muster zweimal hintereinander und mindestens 3 Merkmale verschieden (alle Formate, 40 Aktivierungen)', () => {
    for (const f of ACT_FMTS) {
      const used: string[] = [];
      let prev: string | null = null;
      for (let i = 0; i < 40; i++) {
        const b = pickActBrief(f, 'vocab/lev', `2026-10-${String((i % 28) + 1).padStart(2, '0')}|${i}`, used, { ...target, sourceTone: i % 3 === 0 ? 'f' : 'c' });
        expect(b.code, `${f} #${i}`).not.toBe(prev);
        if (prev) {
          const a = vectorOf(prev);
          const c = vectorOf(b.code);
          expect(actDifferences(a!, c!), `${f} #${i}: ${prev} → ${b.code}`).toBeGreaterThanOrEqual(MIN_DIFFERENT);
        }
        used.push(b.code);
        prev = b.code;
      }
    }
  });
  it('auch nach „Eigener Satz“ (anderes Muster) und zwischen den Formaten bleibt der Abstand', () => {
    const used = [pickBrief('vocab/lev', '2026-10-01|0', []).code];
    const first = pickActBrief('sc', 'vocab/lev', '2026-10-08|0', used, target);
    expect(actDifferences(vectorOf(used[0])!, vectorOf(first.code)!)).toBeGreaterThanOrEqual(MIN_DIFFERENT);
    const next = pickActBrief('tw', 'vocab/lev', '2026-10-20|0', [...used, first.code], target);
    expect(actDifferences(vectorOf(first.code)!, vectorOf(next.code)!)).toBeGreaterThanOrEqual(MIN_DIFFERENT);
  });
  it('der Ton wechselt beim „Ton wechseln“ immer zu einem anderen als dem der Quelle', () => {
    for (let i = 0; i < 20; i++) {
      for (const src of ['c', 'n', 'f'] as const) {
        const b = pickActBrief('tw', 'vocab/lev', `d${i}`, [], { ...target, sourceTone: src });
        expect(b.tone).not.toBe(src);
      }
    }
  });
  it('Lagen und Mails, die das Zielwort verraten, entfallen', () => {
    for (let i = 0; i < 40; i++) {
      const lg = pickActBrief('lg', 'vocab/x', `d${i}`, [], { lemmas: ['rollout'], card: { lemma: 'rollout', pos: 'noun' } });
      const ev = eventById(lg.event)!;
      expect(sceneLeaks(ev, 'rollout'), lg.event).toBe(false);
    }
    const ml = pickActBrief('ml', 'vocab/x', 'd', [], { lemmas: ['demo', 'renewal'], card: { lemma: 'demo', pos: 'noun' } });
    expect(mailById(ml.event)!.en.toLowerCase()).not.toContain('renewal');
  });
  it('Verlaufsform nur, wo sie zum Wort passt; beim Wenn-Satz keine Zeitform', () => {
    for (let i = 0; i < 60; i++) {
      const b = pickActBrief('sc', 'vocab/know', `d${i}`, [], { lemmas: ['know'], card: { lemma: 'know', pos: 'verb' } });
      expect(b.tense).not.toBe('co');
      if (b.shape === 'i') expect(b.tense).toBe('-');
    }
  });
});

describe('Fahrplan: Freigabe, Abstände, Vorrang, Tagesgrenze', () => {
  it('der nächste Schritt folgt der Zahl geschaffter Aktivierungen; A5 nur für Kernwörter', () => {
    expect([0, 1, 2, 3].map((n) => nextStep(n, false))).toEqual([1, 2, 3, 4]);
    expect(nextStep(4, false)).toBeNull();
    expect(nextStep(4, true)).toBe(5);
    expect(nextStep(5, true)).toBeNull();
    expect(isCoreWord(card({ src: 'lesson' }))).toBe(true);
    expect(isCoreWord(card({ src: 'lookup' }))).toBe(false);
    expect(isCoreWord(card({ src: 'lookup', core: true }))).toBe(true);
  });
  it('A1 braucht Stufe 3 und richtige Abrufe an zwei Tagen (Barcroft)', () => {
    expect(dueStep(card({ hist: histOf(2) }, 3), TODAY)).toEqual({ step: 1, maintenance: false });
    expect(dueStep(card({ hist: histOf(1) }, 3), TODAY)).toBeNull();
    expect(dueStep(card({ hist: histOf(4) }, 2), TODAY)).toBeNull();
  });
  it('A2 braucht Stufe 4, drei Abruftage und 5 Tage Abstand zur vorigen Aktivierung', () => {
    const mk = (back: number) => card({ hist: histOf(4, [[back, 3]]), na: 1 }, 4);
    expect(dueStep(mk(4), TODAY)).toBeNull();
    expect(dueStep(mk(5), TODAY)).toEqual({ step: 2, maintenance: false });
    expect(MIN_GAP_DAYS).toEqual({ 1: 0, 2: 5, 3: 10, 4: 14, 5: 14 });
    expect(dueStep(card({ hist: histOf(4, [[6, 3]]), na: 1 }, 3), TODAY)).toBeNull();
  });
  it('A3 nach 10 Tagen, A4 nach 14 Tagen und nur auf Stufe 5', () => {
    const a3 = (back: number) => card({ hist: histOf(4, [[back + 20, 3], [back, 3, 'act_scene', 'x']]), na: 2 }, 4);
    expect(dueStep(a3(9), TODAY)).toBeNull();
    expect(dueStep(a3(10), TODAY)?.step).toBe(3);
    const a4 = (back: number, stage: number) => card({ hist: histOf(5, [[back + 30, 3], [back, 3, 'act_rewrite']]), na: 3 }, stage);
    expect(dueStep(a4(13, 5), TODAY)).toBeNull();
    expect(dueStep(a4(14, 5), TODAY)?.step).toBe(4);
    expect(dueStep(a4(30, 4), TODAY)).toBeNull();
  });
  it('A5 nur für Kernwörter nach A4 und 14 Tagen Abstand', () => {
    const mk = (src: string) => card({ src, hist: histOf(6, [[40, 3], [14, 3, 'act_impulse']]), na: 4 }, 5);
    expect(dueStep(mk('lesson'), TODAY)).toEqual({ step: 5, maintenance: false });
    expect(dueStep(mk('lookup'), TODAY)).toBeNull();
  });
  it('nach einer gescheiterten Aktivierung wiederholt sich derselbe Schritt frühestens nach 3 Tagen', () => {
    const mk = (back: number) => card({ hist: histOf(4, [[back, 1]]), na: 0 }, 4);
    expect(RETRY_GAP_DAYS).toBe(3);
    expect(dueStep(mk(2), TODAY)).toBeNull();
    expect(dueStep(mk(3), TODAY)).toEqual({ step: 1, maintenance: false });
  });
  it('Fahrplan durch: nach 45 Tagen kommt eine Erhaltungs-Aktivierung (A4)', () => {
    const mk = (back: number) => card({ hist: histOf(6, [[back + 40, 3], [back, 3, 'act_impulse']]), na: 4, src: 'lookup' }, 5);
    expect(dueStep(mk(MAINTENANCE_GAP_DAYS - 1), TODAY)).toBeNull();
    expect(dueStep(mk(MAINTENANCE_GAP_DAYS), TODAY)).toEqual({ step: 4, maintenance: true });
  });
  it('heute schon aktiviert, Wendung oder ausgeblendet: nichts', () => {
    expect(dueStep(card({ hist: [...histOf(3), { t: NOW - 1000, m: 'produce', g: 3, x: 'produce' }] }, 4), TODAY)).toBeNull();
    expect(dueStep({ ...card(), kind: 'chunk' }, TODAY)).toBeNull();
    expect(dueStep({ ...card(), hidden: true }, TODAY)).toBeNull();
  });
  it('Zähler na: aus dem Zähler oder dem Verlauf, das Größere gilt; Aktivierungsarten werden gezählt', () => {
    expect(naOf({ na: 3 })).toBe(3);
    expect(naOf({ hist: [{ t: 1, g: 3, x: 'produce' }, { t: 2, g: 1, x: 'act_scene' }, { t: 3, g: 2, x: 'act_mail' }, { t: 4, g: 3, x: 'cloze' }] })).toBe(2);
    expect(naOf({ na: 1, hist: [{ t: 1, g: 3, x: 'produce' }, { t: 2, g: 2, x: 'act_scene' }] })).toBe(2);
    expect(['produce', 'act_scene', 'act_rewrite', 'act_impulse', 'act_combo', 'act_mail'].every(isActivationEx)).toBe(true);
    expect(isActivationEx('cloze')).toBe(false);
    expect(lastActivation({ hist: [{ t: 5, g: 2, x: 'act_scene' }, { t: 3, g: 3, x: 'produce' }] })).toMatchObject({ t: 5, g: 2 });
  });

  it('na zählt nur geprüfte Aktivierungen: Verlaufseinträge mit u = 1 (abgeschrieben, ungeprüft, mit Hilfe) steigern den Fahrplan nie (Lernwissenschaft H1)', () => {
    expect(naOf({ hist: [{ t: 1, g: 2, x: 'act_scene', u: 1 }, { t: 2, g: 3, x: 'act_scene' }] })).toBe(1);
    expect(naOf({ hist: [{ t: 1, g: 2, x: 'produce', u: 1 }] })).toBe(0);
    // der Abstand zählt trotzdem (letzte Aktivierung)
    expect(lastActivation({ hist: [{ t: 9, g: 2, x: 'act_scene', u: 1 }] })).toMatchObject({ t: 9, g: 2, u: true });
  });

  const plan = (cs: TrainCard[], over: Partial<Parameters<typeof planActivations>[0]> = {}) => planActivations({ queue: dueQueue(cs), cards: byKey(cs), pool: cs, day: TODAY, overdue: 0, ai: true, ...over });
  const stepped = (id: string, step: number): TrainCard => {
    const gap = [0, 0, 5, 10, 14, 14][step] ?? 0;
    const na = step - 1;
    // Frühere Aktivierungen: die letzte genau `gap` Tage zurück (Mindestabstand erreicht), die davor weiter zurück.
    const acts: Array<[number, number, string?, string?]> = Array.from({ length: na }, (_, i) => [i === na - 1 ? gap : gap + 20 * (na - i), 3, i === 0 ? 'produce' : 'act_scene']);
    return card({ word: `w${id}`, de: `Wort ${id}`, def: `meaning of ${id}`, ex: `A [w${id}] helps.`, src: step === 5 ? 'lesson' : 'ai', hist: histOf(6, acts), na }, step >= 4 ? 5 : 4, id);
  };
  it('Vorrang A4/A5 > A3 > A2 > A1, Obergrenze 4 Satz-Einheiten am Tag (Kundenmail zählt 2)', () => {
    const cs = [stepped('a', 1), stepped('b', 2), stepped('c', 3), stepped('d', 4), stepped('e', 5), stepped('f', 1), stepped('g', 2)];
    const p = plan(cs);
    // A5 (2 Einheiten, geplant mit dem Höchstwert) + A4 + A3 = 4 Einheiten; A2 und A1 passen nicht mehr.
    expect([...p.values()].map((d) => d.step).sort()).toEqual([3, 4, 5]);
    expect(p.has('vocab/a')).toBe(false);
    expect(p.has('vocab/b')).toBe(false);
    // Ohne A5: vier Aufgaben zu je einer Einheit.
    const small = plan([stepped('a', 1), stepped('b', 2), stepped('c', 3), stepped('d', 4), stepped('f', 1), stepped('g', 2)]);
    expect(small.size).toBe(ACT_DAY_UNITS);
    expect([...small.values()].map((d) => d.step).sort()).toEqual([2, 2, 3, 4]);
  });
  it('Satz-Einheiten: Kundenmail 2, Kombi-Satz 1,5, alles andere 1; bereits gemachte Aktivierungen heute zählen zur Grenze', () => {
    expect(unitsOfCode('ml.m01.-.-.f.-.a')).toBe(2);
    expect(unitsOfCode('kb.e01.cfo.-.n.-.-')).toBe(1.5);
    expect(unitsOfCode('sc.e01.cfo.-.n.pr.s')).toBe(1);
    const done = card({ word: 'done', hist: [...histOf(4), { t: NOW - 3600_000, m: 'produce', g: 3, x: 'act_scene', a: 'sc.e01.cfo.-.n.pr.s' }, { t: NOW - 7200_000, m: 'produce', g: 3, x: 'act_mail', a: 'ml.m01.-.-.f.-.a' }] }, 4, 'done');
    const cs = [done, stepped('a', 4), stepped('b', 4), stepped('c', 4), stepped('d', 4)];
    expect(activationsOn(cs.map((c) => c.doc), TODAY)).toBe(2);
    // 1 (Szene) + 2 (Mail) = 3 Einheiten gemacht: 1 Einheit frei = eine Aufgabe.
    expect(activationUnitsOn(cs.map((c) => c.doc), TODAY)).toBe(3);
    expect(plan(cs).size).toBe(1);
    expect(remainingToday(4, 0)).toBe(0);
    expect(remainingToday(1.5, 0)).toBe(2.5);
  });
  it('Aufholmodus: ab 40 Überfälligen höchstens 2 Einheiten und nur A4 (keine Kundenmail), ab 80 keine', () => {
    const cs = [stepped('a', 1), stepped('b', 2), stepped('c', 3), stepped('d', 4), stepped('e', 5), stepped('f', 4)];
    const high = plan(cs, { overdue: ACT_BACKLOG_HIGH });
    expect(high.size).toBe(ACT_BACKLOG_UNITS);
    expect([...high.values()].every((d) => d.step === 4)).toBe(true);
    expect(plan(cs, { overdue: ACT_BACKLOG_HIGH - 1 }).size).toBeGreaterThanOrEqual(3);
    expect(plan(cs, { overdue: ACT_BACKLOG_NONE }).size).toBe(0);
    expect(remainingToday(0, ACT_BACKLOG_HIGH)).toBe(2);
    expect(remainingToday(1, ACT_BACKLOG_HIGH)).toBe(1);
  });
  it('allow: Karten, die als Aufdeckkarte kommen, bekommen keinen Platz (Lernwissenschaft N1)', () => {
    const cs = [stepped('a', 2), stepped('b', 2)];
    const p = plan(cs, { allow: (k: string) => k === 'vocab/b' });
    expect([...p.keys()]).toEqual(['vocab/b']);
  });
  it('ersetzt nur FÄLLIGE Karten der Runde; ohne Claude gibt es keine Aktivierung; der Plan ist stabil', () => {
    const cs = [stepped('a', 2), stepped('b', 2)];
    const q: QueueItem[] = [
      { key: 'vocab/a', reason: 'due', phase: 'quiz' },
      { key: 'vocab/b', reason: 'new', phase: 'quiz' },
      { key: 'vocab/a', reason: 'again', phase: 'quiz' },
    ];
    const p = planActivations({ queue: q, cards: byKey(cs), pool: cs, day: TODAY, overdue: 0, ai: true });
    expect([...p.keys()]).toEqual(['vocab/a']);
    expect(planActivations({ queue: q, cards: byKey(cs), pool: cs, day: TODAY, overdue: 0, ai: false }).size).toBe(0);
    expect([...plan(cs).entries()]).toEqual([...plan(cs).entries()]);
  });
});

describe('Aufgaben A2–A5 bauen', () => {
  const base = card();
  const p = pool(base);
  const own: OwnSentence[] = [{ id: 'o1', text: 'Our leverage in the price talk grew after the pilot.', day: '2026-10-01', code: 'sc.e01.cfo.-.n.pr.s', reusable: true }];
  const mk = (step: 2 | 3 | 4 | 5, c = base, ownList: readonly OwnSentence[] = own): ActTask => {
    const t = buildActTask({ card: c, step, maintenance: false, pool: pool(c), day: TODAY, lang: 'de', own: ownList });
    expect(t, `Schritt ${step}`).not.toBeNull();
    return t!;
  };
  it('jeder Schritt liefert ein Format seiner Schritt-Gruppe mit stimmigen Zielwörtern', () => {
    const t2 = mk(2);
    expect(t2.fmt).toBe('sc');
    expect(t2.targets.map((x) => x.key)).toEqual([base.key]);
    expect(t2.showTarget).toBe(true);
    const t3 = mk(3);
    expect(STEP_FMTS[3]).toContain(t3.fmt);
    expect(t3.source?.text).toBeTruthy();
    const t4 = mk(4);
    expect(STEP_FMTS[4]).toContain(t4.fmt);
    expect(t4.showTarget).toBe(false);
    const t5 = mk(5);
    expect(STEP_FMTS[5]).toContain(t5.fmt);
    expect(t5.targets.length).toBeGreaterThanOrEqual(2);
    expect(t5.targets.length).toBeLessThanOrEqual(3);
    expect(new Set(t5.targets.map((x) => x.key)).size).toBe(t5.targets.length);
  });
  it('Umformen nimmt zuerst den jüngsten geprüften eigenen Satz, sonst einen Satz der Karte; ungeprüfte werden nie benutzt', () => {
    expect(pickSource(base, own, 'k')?.own).toBe(true);
    expect(pickSource(base, own, 'k')?.text).toBe(own[0]!.text);
    expect(pickSource(base, [{ ...own[0]!, reusable: false }], 'k')?.own).toBe(false);
    expect(pickSource(card({ word: 'zzquux', ex: '' }), [], 'k')).toBeNull();
  });
  it('Kombi-Satz und Kundenmail brauchen Partnerkarten aus anderen Karten; ohne Partner fällt A5 auf A4-Formate zurück', () => {
    const partners = pickPartners(base, p, TODAY, 'de', 2);
    expect(partners.length).toBe(2);
    expect(partners.every((x) => x.key !== base.key && x.lemma !== base.lemma)).toBe(true);
    expect(pickPartners(base, p, TODAY, 'de', 2).map((x) => x.key)).toEqual(partners.map((x) => x.key));
    const alone = buildActTask({ card: base, step: 5, maintenance: false, pool: [base], day: TODAY, lang: 'de', own: [] });
    expect(alone && STEP_FMTS[4]).toContain(alone!.fmt);
  });
  it('das Format wechselt reihum, bevor eines wiederkehrt', () => {
    const seen = new Set<string>();
    let c = base;
    for (let i = 0; i < 3; i++) {
      const t = buildActTask({ card: c, step: 3, maintenance: false, pool: pool(c), day: `2026-10-${10 + i}`, lang: 'de', own })!;
      seen.add(t.fmt);
      c = card({ hist: [...(c.doc.hist as Doc[]), { t: NOW - (10 - i) * DAY, m: 'produce', g: 3, x: EX_OF_FMT[t.fmt], a: t.code }] });
    }
    expect(seen.size).toBe(3);
  });
  it('gebaute Aufgaben bestehen den Wächter R14; jede Art kennt ihre Beschreibung', () => {
    for (const step of [2, 3, 4, 5] as const) {
      const t = mk(step);
      const e = buildExercise(base, EX_OF_FMT[t.fmt], 'de', p, 'seed', { act: t });
      expect(e.act?.code).toBe(t.code);
      expect(e.input).toBe('produce');
      expect(checkExercise(e, base, 'de'), `${t.fmt}`).toEqual([]);
    }
  });
  it('Wächter R14 weist kaputte Aufgaben ab', () => {
    const t = mk(4);
    const e = buildExercise(base, EX_OF_FMT[t.fmt], 'de', p, 'seed', { act: t });
    const bad = (a: Partial<ActTask>, rule = 'R14') => expect(checkExercise({ ...e, act: { ...t, ...a } }, base, 'de').map((v) => v.rule)).toContain(rule);
    bad({ code: 'kaputt' });
    bad({ showTarget: true });
    bad({ targets: [...t.targets, t.targets[0]!] });
    bad({ targets: [] });
    bad({ fmt: 'kb' });
    expect(checkExercise({ ...e, act: undefined }, base, 'de').map((v) => v.rule)).toContain('R14');
    expect(checkExercise({ ...e, sentence: { sentence: 'x leverage y', start: 2, end: 10, gap: 'leverage' } }, base, 'de').map((v) => v.rule)).toContain('R14');
    // Karte noch nicht an zwei Tagen abgerufen: kein freier Text beim ersten Lernen.
    const fresh = card({ hist: histOf(1) }, 3);
    expect(checkExercise(buildExercise(fresh, EX_OF_FMT[t.fmt], 'de', pool(fresh), 'seed', { act: t }), fresh, 'de').map((v) => v.rule)).toContain('R14');
    // Umformen ohne Ausgangssatz
    const t3 = mk(3);
    const e3 = buildExercise(base, EX_OF_FMT[t3.fmt], 'de', p, 'seed', { act: { ...t3, source: null } });
    expect(checkExercise(e3, base, 'de').map((v) => v.rule)).toContain('R14');
  });
  it('A4 zeigt nur eine Bedeutung, die das Wort nicht verrät', () => {
    const t = { de: 'Hebelwirkung', def: 'the leverage of a lever', meaning: 'the leverage of a lever', lemma: 'leverage' };
    expect(actMeaning(t, 'lg', 'en')).toBe('Hebelwirkung');
    expect(actMeaning({ ...t, de: 'leverage-Effekt' }, 'lg', 'de')).toBeNull();
    expect(actMeaning(t, 'im', 'de')).toBe('Hebelwirkung');
  });
  it('neue Arten sind nie automatisch wählbar (Stufe 0) und stehen im Katalog', () => {
    const env = makeEnv(true, true, true);
    for (const f of ACT_FMTS) {
      const ex = EX_OF_FMT[f];
      expect(CATALOG.find((d) => d.ex === ex)?.stage).toBe(0);
      expect(supports(base, ex, 'de', 8, env)).toBe(false);
      expect(availableExercises(card({}, 5), 'de', 8, env)).not.toContain(ex);
    }
  });
});

describe('Vorprüfung A2–A5 (ohne KI)', () => {
  const base = card();
  const task = (fmt: ActFmt, over: Partial<ActTask> = {}): ActTask => {
    const t = buildActTask({ card: base, step: stepOfFmt(fmt), maintenance: false, pool: pool(base), day: TODAY, lang: 'de', own: [{ id: 'o', text: 'We rely on leverage in every price talk.', day: '2026-10-01', code: 'sc.e01.cfo.-.n.pr.s', reusable: true }] })!;
    return { ...t, fmt, ...over };
  };
  it('alle Zielwörter müssen vorkommen (auch gebeugt); bei A4 meldet sie nur das Wort selbst', () => {
    const t = task('kb', { targets: [{ ...task('sc').targets[0]!, word: 'leverage', lemma: 'leverage' }, { ...task('sc').targets[0]!, key: 'vocab/p0', id: 'p0', word: 'pipeline', lemma: 'pipeline' }] });
    expect(precheckAct('We use leverage to grow the pipeline this quarter.', t, [], []).issue).toBeNull();
    const miss = precheckAct('We use leverage to grow the funnel this quarter.', t, [], []);
    expect(miss.issue).toBe('target');
    expect(miss.missing).toEqual(['pipeline']);
    expect(precheckAct('We use leverages and pipelines to grow this quarter.', t, [], []).issue).toBeNull();
  });
  it('zu kurz je Format; die Kundenmail braucht mindestens zwei Sätze', () => {
    const t = task('sc', { shape: 's' });
    expect(precheckAct('Leverage helps.', t, [], []).issue).toBe('short');
    const ml = task('ml', { targets: [{ ...t.targets[0]! }], shape: 'a' });
    expect(precheckAct('We will confirm the next step with our leverage and send a plan by Friday afternoon at the latest.', ml, [], []).issue).toBe('shape');
    expect(precheckAct('We will confirm the next step with our leverage today. I will send the plan by Friday afternoon at the latest.', ml, [], []).issue).toBeNull();
  });
  it('abgeschrieben: gegen gezeigte Sätze UND gegen frühere eigene Sätze', () => {
    const t = task('sc', { shape: 's' });
    const shown = ['We use leverage in every price talk.'];
    expect(precheckAct('We use leverage in every price talk.', t, shown, []).issue).toBe('copied');
    const own = ['Our small team gains leverage during every difficult contract meeting.'];
    expect(precheckAct('Our small team gains leverage during every difficult contract meeting.', t, [], own).issue).toBe('copied');
    expect(precheckAct('A weak supplier has no leverage against our new volume deal.', t, shown, own).issue).toBeNull();
  });
  it('Umformen: der Ausgangssatz selbst ist erlaubt, aber nicht unverändert', () => {
    const t = task('tw', { source: { text: 'We rely on leverage in every price talk.', own: true, day: '2026-10-01', tone: 'c' } });
    expect(precheckAct('We rely on leverage in every price talk.', t, [], []).issue).toBe('same');
    expect(precheckAct('Our approach relies on leverage whenever we discuss prices with a client.', t, ['We rely on leverage in every price talk.'], ['We rely on leverage in every price talk.']).issue).toBeNull();
  });
  it('Besonderheiten: Frage, Verneinung, Erweiterung, kürzer, anderer Anfang', () => {
    expect(fitsShape('Do we have leverage here?', { fmt: 'sc', shape: 'q', source: null })).toBe(true);
    expect(fitsShape('We have leverage here.', { fmt: 'sc', shape: 'q', source: null })).toBe(false);
    expect(fitsShape('We have no leverage here.', { fmt: 'sc', shape: 'n', source: null })).toBe(true);
    const src = { text: 'We use leverage in talks.', own: true, day: null, tone: '-' as const };
    expect(fitsShape('We use leverage in talks because the client depends on us.', { fmt: 'ex', shape: 'r', source: src })).toBe(true);
    expect(fitsShape('We use leverage in talks because we do.', { fmt: 'ex', shape: 'x', source: src })).toBe(false);
    expect(fitsShape('We use leverage.', { fmt: 'rw', shape: 'k', source: src })).toBe(true);
    expect(fitsShape('In talks, we use leverage.', { fmt: 'rw', shape: 'o', source: src })).toBe(true);
    expect(fitsShape('We use leverage often.', { fmt: 'rw', shape: 'o', source: src })).toBe(false);
  });
  it('Deutsch-Fehler sperren erst als Hinweis; harte Mängel sind Wort/Länge/abgeschrieben/unverändert', () => {
    expect(ACT_HARD_ISSUES.has('target') && ACT_HARD_ISSUES.has('short') && ACT_HARD_ISSUES.has('copied') && ACT_HARD_ISSUES.has('same')).toBe(true);
    expect(ACT_HARD_ISSUES.has('shape')).toBe(false);
    expect(ACT_HARD_ISSUES.has('german')).toBe(false);
    const t = task('sc', { shape: 's' });
    expect(precheckAct('We discussed about leverage with the new purchasing team yesterday.', t, [], []).issue).toBe('german');
  });
  it('Noten: nie Leicht, „wrong“ nur bei fehlendem oder falsch benutztem Hauptzielwort, mit Hinweis höchstens Schwer', () => {
    const ok = { used: true, correct: true };
    const bad = { used: true, correct: false };
    expect(activateGrade({ verdict: 'correct', targets: [ok] }, false)).toBe(3);
    expect(activateGrade({ verdict: 'correct', targets: [ok] }, true)).toBe(2);
    expect(activateGrade({ verdict: 'minor', targets: [ok] }, false)).toBe(2);
    expect(activateGrade({ verdict: 'wrong', targets: [bad] }, false)).toBe(1);
    expect(activateGrade({ verdict: 'wrong', targets: [{ used: false, correct: false }] }, false)).toBe(1);
    // Nur das Partnerwort ist falsch: das Hauptzielwort sitzt, die Karte bekommt aber höchstens „Schwer“ (der Text als Ganzes war nicht richtig).
    expect(activateGrade({ verdict: 'wrong', targets: [ok, bad] }, false)).toBe(2);
    for (const v of ['correct', 'minor', 'wrong'] as const) for (const h of [true, false]) expect(activateGrade({ verdict: v, targets: [ok, bad] }, h)).toBeLessThanOrEqual(3);
  });
  it('ohne Claude: höchstens Schwer und nur mit allen Wörtern, Länge und ohne Abschreiben', () => {
    const t = task('sc');
    expect(selfCheckAct('A weak supplier has no leverage against our new volume deal.', t, [], []).grade).toBe(2);
    expect(selfCheckAct('A weak supplier has no chance against our new volume deal.', t, [], []).grade).toBe(1);
    expect(selfCheckAct('We use leverage in every price talk.', t, ['We use leverage in every price talk.'], []).grade).toBe(1);
  });
});

describe('Prüfung 14.10.2026: Lernwissenschaft und Englischlehrer', () => {
  const ok = { used: true, correct: true };
  const bad = { used: true, correct: false };
  it('H2: Fehler nur am Partnerwort bestraft die Karte der Aufgabe nicht (mainVerdict)', () => {
    expect(activateGrade({ verdict: 'wrong', mainVerdict: 'correct', targets: [ok, bad] }, false)).toBe(3);
    expect(activateGrade({ verdict: 'wrong', mainVerdict: 'correct', targets: [ok, bad] }, true)).toBe(2);
    expect(activateGrade({ verdict: 'wrong', mainVerdict: 'minor', targets: [ok, bad] }, false)).toBe(2);
    // Hauptwort falsch: Nochmal, egal was das Gesamturteil sagt.
    expect(activateGrade({ verdict: 'correct', mainVerdict: 'correct', targets: [bad, ok] }, false)).toBe(1);
  });
  it('A4: ein richtiges Ersatzwort ist ein Teilerfolg (Schwer), kein Fehlschlag', () => {
    const miss = { used: false, correct: false };
    expect(activateGrade({ verdict: 'minor', alt: 'push back', targets: [miss] }, false)).toBe(2);
    expect(activateGrade({ verdict: 'wrong', alt: '', targets: [miss] }, false)).toBe(1);
  });
  it('M1: Wörter, die im Deutschen gleich lauten, bleiben nicht bei A4 hängen (Mini-Szene mit gezeigtem Wort ersetzt den Schritt)', () => {
    const c = card({ word: 'compliance', de: 'Compliance', def: 'compliance with the rules', ex: 'We take [compliance] seriously.', src: 'seed' }, 5);
    expect(canHideTarget(c, 'de')).toBe(false);
    expect(canHideTarget(card(), 'de')).toBe(true);
    const t = buildActTask({ card: c, step: 4, maintenance: false, pool: pool(c), day: TODAY, lang: 'de', own: [] });
    expect(t).not.toBeNull();
    expect(t!.fmt).toBe('sc');
    expect(t!.showTarget).toBe(true);
    // eine verdeckbare Karte bekommt weiter A4 ohne gezeigtes Wort
    const t4 = buildActTask({ card: card({}, 5), step: 4, maintenance: false, pool: pool(card({}, 5)), day: TODAY, lang: 'de', own: [] });
    expect(t4 && STEP_FMTS[4]).toContain(t4!.fmt);
    expect(t4!.showTarget).toBe(false);
  });
  it('A2: Antwortziele passen zur Mail; A3: keine Zeitform bei Kundenmail und Kombi-Satz', () => {
    for (const m of ACT_MAILS) {
      for (let i = 0; i < 6; i++) {
        const b = pickActBrief('ml', `vocab/k${i}`, `2026-10-${10 + i}|0`, [], { lemmas: ['zzquux'], core: true });
        const mail = mailById(b.event)!;
        expect(mail.goals, `${mail.id} ${b.shape}`).toContain(b.shape);
        expect(b.tense).toBe('-');
      }
      expect(m.goals.length).toBeGreaterThan(1);
    }
    for (let i = 0; i < 10; i++) expect(pickActBrief('kb', `vocab/k${i}`, `2026-10-${10 + i}|0`, [], { lemmas: ['zzquux'] }).tense).toBe('-');
  });
  it('A8/A9: Textsorte und Gegenüber passen zusammen; Kernwörter bekommen Lagen aus dem Beruf (A7)', () => {
    for (const f of ['tw', 'rw', 'ex'] as const) {
      for (let i = 0; i < 40; i++) {
        const b = pickActBrief(f, `vocab/k${i}`, `2026-09-${10 + (i % 20)}|${i}`, [], { lemmas: ['zzquux'], sourceTone: null });
        const type = ACT_TYPES.find((t) => t.id === b.type)!;
        if (type.roles) expect(type.roles, `${f} ${b.type} ${b.role}`).toContain(b.role);
      }
    }
    for (let i = 0; i < 40; i++) {
      const b = pickActBrief('sc', `vocab/k${i}`, `2026-09-${10 + (i % 20)}|${i}`, [], { lemmas: ['zzquux'], core: true });
      expect(eventById(b.event)?.kind).toBe('job');
    }
    expect(roleById('buy')?.en).toMatch(/prospect|client/);
    expect(roleById('staff')?.en).toBe('A customer service rep');
  });
  it('A6: sentenceCount zählt auch den letzten Satz ohne Schlusspunkt (Handy)', () => {
    expect(sentenceCount('Thanks for your email. I will send the agenda tomorrow')).toBe(2);
    expect(sentenceCount('Thanks for your email. I will send the agenda tomorrow.')).toBe(2);
    expect(sentenceCount('One sentence only')).toBe(1);
    expect(sentenceCount('Hello! Thanks? Yes')).toBe(3);
    expect(sentenceCount('   ')).toBe(0);
    const ml = { fmt: 'ml' as const, shape: 'a', source: null };
    expect(fitsShape('Thanks for your email. I will send the agenda tomorrow', ml)).toBe(true);
    expect(fitsShape('Thanks for your email', ml)).toBe(false);
  });
  it('Vorprüfung: weitere Verbinder, „kürzer“ heißt wirklich kürzer, anderer Anfang vergleicht zwei Wörter', () => {
    const src = { text: 'The team uses leverage in talks.', own: true, day: null, tone: '-' as const };
    expect(fitsShape('The team uses leverage in talks, thanks to a strong pilot result.', { fmt: 'ex', shape: 'r', source: src })).toBe(true);
    expect(fitsShape('The team uses leverage in talks, hence the better deal.', { fmt: 'ex', shape: 'c', source: src })).toBe(true);
    expect(fitsShape('The team uses leverage in talks, despite the weak start.', { fmt: 'ex', shape: 'x', source: src })).toBe(true);
    expect(fitsShape('The team uses leverage in talks.', { fmt: 'rw', shape: 'k', source: src })).toBe(false);
    expect(fitsShape('The team uses leverage.', { fmt: 'rw', shape: 'k', source: src })).toBe(true);
    // gleicher Anfang „The team“ → blockiert; „The rollout …“ ist ein anderer
    expect(fitsShape('The team always uses leverage.', { fmt: 'rw', shape: 'o', source: src })).toBe(false);
    expect(fitsShape('The rollout needs leverage in talks.', { fmt: 'rw', shape: 'o', source: src })).toBe(true);
  });
  it('A4: bei verdecktem Wort zählt ein Wort derselben Familie (postponement für postpone)', () => {
    const pc = card({ word: 'postpone', de: 'verschieben', def: 'to delay until later', ex: 'We [postpone] the launch.' }, 5);
    const t = buildActTask({ card: pc, step: 4, maintenance: false, pool: pool(pc), day: TODAY, lang: 'de', own: [] })!;
    const hidden: ActTask = { ...t, fmt: 'im', showTarget: false };
    expect(precheckAct('The postponement of the launch costs us two weeks of revenue.', hidden, [], []).issue).toBeNull();
    expect(precheckAct('We will push back the launch by two weeks because of the risk.', hidden, [], []).issue).toBe('target');
    // bei gezeigtem Wort gilt die Familie nicht
    expect(precheckAct('The postponement of the launch costs us two weeks of revenue.', { ...hidden, fmt: 'sc', showTarget: true }, [], []).issue).toBe('target');
  });
});
