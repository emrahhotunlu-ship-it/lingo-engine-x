import { describe, expect, it } from 'vitest';
import { ACTIVATION_SCENES, sceneText } from '../../src/content/activation/scenes';
import { cardPatch } from '../../src/domain/srs/applyReview';
import { ACTIVATION_MIN_DAYS, CODE_MAX, DAILY_SHARE, FORMS, MIN_DIFFERENT, TENSES, TONES, activationReady, briefCodesOf, differences, parseBrief, pickBrief, recallDays } from '../../src/domain/srs/brief';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildExercise } from '../../src/domain/srs/exercise';
import { checkExercise } from '../../src/domain/srs/guard';
import { availableExercises, makeEnv, supports } from '../../src/domain/srs/modes';
import { COPY_LIMIT, fitsForm, germanHints, jaccard, precheckProduce, selfCheckProduce, shownSentences } from '../../src/domain/srs/produce';
import type { Exercise, TrainCard } from '../../src/domain/srs/types';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { briefVarsOf, errTypeOf, produceCheckV2, PRODUCE_CHECK_V2_EXAMPLE, type ProduceCheckV2Vars } from '../../src/prompts/produceCheckV2';
import { TEMPLATES } from '../../src/prompts/registry';
import { berlin } from './helpers';

// Wörter aktivieren, Stufe 1 (docs/umbau/aktivierung.md): „Eigener Satz“ am Handy, variable Vorgaben, Abschreibprüfung, produce-check@2.

const NOW = berlin('2026-10-14', 9);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;

/** Verlauf mit richtigen Abrufen an `days` verschiedenen Tagen. */
const histDays = (days: number, extra: Doc[] = []): Doc[] => [...Array.from({ length: days }, (_, i) => ({ t: NOW - (i + 2) * DAY, m: 'cloze', g: 3, x: 'cloze' })).reverse(), ...extra];
const doc = (over: Doc = {}): Doc => ({ word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], state: 'review', S: 10, D: 5, last: NOW - 3 * DAY, due: NOW - 1000, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: histDays(3), intro: '2026-08-01', ...over });
const card = (over: Doc = {}, stage = 4): TrainCard => ({ ...(toTrainCard('lev', doc(over), true, NOW) as TrainCard), stage: stage as TrainCard['stage'] });
const pool = (c: TrainCard): TrainCard[] => [c, ...Array.from({ length: 6 }, (_, i) => ({ ...(toTrainCard(`p${i}`, doc({ word: `padword${i}`, de: `Füllwort ${i}`, def: `filler number ${i}`, ex: `A [padword${i}] is here.` }), true, NOW) as TrainCard) }))];

describe('Lagen als Daten', () => {
  it('mindestens 12 Beruf- und 4 Alltag-Lagen, zweisprachig, eindeutige Kennungen', () => {
    expect(ACTIVATION_SCENES.filter((s) => s.kind === 'job').length).toBeGreaterThanOrEqual(12);
    expect(ACTIVATION_SCENES.filter((s) => s.kind === 'daily').length).toBeGreaterThanOrEqual(4);
    expect(new Set(ACTIVATION_SCENES.map((s) => s.id)).size).toBe(ACTIVATION_SCENES.length);
    for (const s of ACTIVATION_SCENES) {
      expect(s.de.length, s.id).toBeGreaterThan(10);
      expect(s.en.length, s.id).toBeGreaterThan(10);
      expect(sceneText(s.id, 'en')).toBe(s.en);
    }
  });
  it('alle Marken haben Texte in beiden Sprachen', () => {
    const keys = [...FORMS.map((f) => `brForm_${f}`), ...TONES.map((t) => `brTone_${t}`), ...TENSES.map((t) => `brTense_${t}`), 'brLage', 'brShort', 'task_produce_1', 'task_produce_2', 'task_produce_3', 'trProduceWhyBetter', 'trProduceErrMain'];
    for (const k of keys) {
      expect((de as Record<string, string>)[k], `de ${k}`).toBeTruthy();
      expect((en as Record<string, string>)[k], `en ${k}`).toBeTruthy();
    }
    for (const t of ['prep', 'false_friend', 'word_order', 'tense', 'register', 'collocation', 'article', 'misc']) {
      expect((de as Record<string, string>)[`trErr_${t}`]).toBeTruthy();
      expect((en as Record<string, string>)[`trErr_${t}`]).toBeTruthy();
    }
  });
});

describe('Auswahl der Vorgaben (rein, deterministisch)', () => {
  it('gleiche Eingabe, gleiche Vorgabe (kein Würfeln beim Neuzeichnen)', () => {
    const used = ['j01.s.n.pr', 'd02.q.c.pa'];
    expect(pickBrief('lev', '2026-10-14|0', used)).toEqual(pickBrief('lev', '2026-10-14|0', used));
    expect(pickBrief('lev', '2026-10-14|0', [])).toEqual(pickBrief('lev', '2026-10-14|0', []));
  });

  it('40 Aktivierungen hintereinander: nie dasselbe Muster, immer mindestens 3 von 4 Merkmalen anders, Code unter 40 Zeichen', () => {
    const used: string[] = [];
    for (let i = 0; i < 40; i++) {
      const b = pickBrief('lev', `2026-10-${String(14 + (i % 10)).padStart(2, '0')}|${i % 3}`, used);
      const prev = parseBrief(used.at(-1));
      expect(b.code.length).toBeLessThan(CODE_MAX);
      expect(parseBrief(b.code)).not.toBeNull();
      if (prev) {
        expect(b.code).not.toBe(prev.code);
        expect(differences(b, prev), `${prev.code} → ${b.code}`).toBeGreaterThanOrEqual(MIN_DIFFERENT);
      }
      used.push(b.code);
    }
  });

  it('Wenn-Satz trägt keine Zeitform, alle anderen Formen genau eine (ab der zweiten Aktivierung)', () => {
    const used: string[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const b = pickBrief(`k${i % 5}`, `d${i}`, used);
      expect(b.form === 'i' ? b.tense === '-' : used.length < 1 === (b.tense === '-'), b.code).toBe(true);
      seen.add(b.form);
      used.push(b.code);
    }
    expect([...seen].sort()).toEqual(['i', 'n', 'q', 's']);
  });

  it('Beruf etwa zwei Drittel, Alltag etwa ein Drittel; alle Lagen kommen vor', () => {
    let daily = 0;
    const scenes = new Set<string>();
    const N = 900;
    for (let i = 0; i < N; i++) {
      const b = pickBrief(`card${i}`, `2026-10-${(i % 28) + 1}`, []);
      scenes.add(b.scene);
      if (b.scene.startsWith('d')) daily++;
    }
    expect(daily / N).toBeGreaterThan(DAILY_SHARE - 0.08);
    expect(daily / N).toBeLessThan(DAILY_SHARE + 0.08);
    expect(scenes.size).toBe(ACTIVATION_SCENES.length);
  });

  it('die Lage wechselt reihum: bei 6 Aktivierungen derselben Karte keine Wiederholung innerhalb der Art', () => {
    const used: string[] = [];
    const jobs: string[] = [];
    for (let i = 0; i < 30; i++) {
      const b = pickBrief('lev', `x${i}`, used);
      used.push(b.code);
      if (b.scene.startsWith('j')) jobs.push(b.scene);
    }
    // Die Berufslagen werden nie zweimal hintereinander gezeigt (hier sind es die zwischengeschobenen Alltagslagen, die Reihenfolge bleibt).
    for (let i = 1; i < jobs.length; i++) expect(jobs[i]).not.toBe(jobs[i - 1]);
  });

  it('der Wortlaut (1–3) wechselt mit jeder Aktivierung', () => {
    const used: string[] = [];
    let last = -1;
    for (let i = 0; i < 9; i++) {
      const b = pickBrief('lev', 'x', used);
      expect(b.wording).toBeGreaterThanOrEqual(0);
      expect(b.wording).toBeLessThan(3);
      expect(b.wording).not.toBe(last);
      last = b.wording;
      used.push(b.code);
    }
  });

  it('fremde oder zu lange Codes im Verlauf werden ignoriert', () => {
    expect(parseBrief('j01.q.c.pf')).not.toBeNull();
    expect(parseBrief('zz9.q.c.pf')).toBeNull();
    expect(parseBrief('j01.i.c.pf')).toBeNull();
    expect(parseBrief('j01.s.c.-')).not.toBeNull(); // gestaffelt: erste Aktivierung ohne Zeitform
    expect(parseBrief('j01.s.-.-')).not.toBeNull();
    expect(parseBrief('j01.s.x.pr')).toBeNull();
    expect(parseBrief('x'.repeat(50))).toBeNull();
    expect(briefCodesOf({ hist: [{ t: 2, a: 'j02.s.n.pr' }, { t: 1, a: 'kaputt' }, { t: 3, g: 3 }] })).toEqual(['j02.s.n.pr']);
    expect(() => pickBrief('k', 'd', ['kaputt', 'j01.s.n.pr'])).not.toThrow();
  });
});

describe('Verlaufseintrag und Aufgabe', () => {
  it('der Code der Vorgabe steht im Verlaufseintrag der Karte (kurz, HIST_MAX bleibt)', () => {
    const c = card();
    const e = buildExercise(c, 'produce', 'de', pool(c), 'seed');
    expect(e.brief).toBeDefined();
    const patch = cardPatch({ ...c.doc }, { t: NOW, day: '2026-10-14', kind: 'v', id: 'lev', ex: 'produce', grade: 3, given: 'x', ans: '', ms: 1000, lang: 'de', ctx: 'rev', act: e.brief!.code });
    const hist = patch.hist as Doc[];
    expect(hist.at(-1)?.a).toBe(e.brief!.code);
    expect(String(hist.at(-1)?.a).length).toBeLessThan(CODE_MAX);
    expect(hist.length).toBeLessThanOrEqual(12);
  });

  it('dieselbe Karte am selben Tag baut dieselbe Aufgabe; nach einer Antwort kommt eine andere Vorgabe', () => {
    const c = card();
    const a = buildExercise(c, 'produce', 'de', pool(c), 'seed').brief!;
    expect(buildExercise(c, 'produce', 'de', pool(c), 'seed').brief).toEqual(a);
    const answered = card({ hist: [...(c.doc.hist as Doc[]), { t: NOW, m: 'produce', g: 3, x: 'produce', a: a.code }] });
    const b = buildExercise(answered, 'produce', 'de', pool(answered), 'seed').brief!;
    expect(b.code).not.toBe(a.code);
    expect(differences(a, b)).toBeGreaterThanOrEqual(MIN_DIFFERENT);
  });
});

describe('Barcroft-Leitplanke: kein freier Satz beim ersten Lernen', () => {
  it('Verlauf zählt richtige Abrufe an verschiedenen Tagen; Aufdecken und gleicher Tag zählen nicht', () => {
    expect(recallDays({ hist: histDays(3) })).toBe(3);
    expect(recallDays({ hist: [{ t: NOW, g: 3 }, { t: NOW + 1000, g: 3 }] })).toBe(1);
    expect(recallDays({ hist: [{ t: NOW, g: 1 }, { t: NOW - DAY, g: 3, x: 'flip' }, { t: NOW - 2 * DAY, g: 3, x: 'known' }] })).toBe(0);
    expect(recallDays({})).toBe(0);
  });

  it('produce nur ab Stufe 3 und mit mindestens zwei richtigen Abruf-Tagen', () => {
    const env = makeEnv(true, true, true);
    expect(ACTIVATION_MIN_DAYS).toBe(2);
    expect(supports(card({ hist: histDays(2) }, 5), 'produce', 'de', 100, env)).toBe(true);
    expect(supports(card({ hist: histDays(1) }, 5), 'produce', 'de', 100, env)).toBe(false);
    expect(supports(card({ hist: [] }, 5), 'produce', 'de', 100, env)).toBe(false);
    expect(supports(card({ hist: histDays(3) }, 2), 'produce', 'de', 100, env)).toBe(false);
    expect(activationReady({ stage: 3, doc: { hist: histDays(2) } })).toBe(true);
    // Heute eingeführte Karte (Schritt „Neue Wörter“): ein einziger Tag, nie ein freier Satz.
    const fresh = card({ hist: [{ t: NOW - 1000, g: 3, x: 'mc_en' }, { t: NOW - 500, g: 3, x: 'cloze_hint' }, { t: NOW, g: 3, x: 'cloze' }], intro: '2026-10-14', state: 'learning' }, 3);
    for (const stage of [1, 2, 3, 4, 5] as const) expect(availableExercises({ ...fresh, stage }, 'de', 100, env)).not.toContain('produce');
  });

  it('am Handy ist der eigene Satz erlaubt, ohne KI und ohne Bedeutung nicht', () => {
    const c = card({}, 5);
    expect(availableExercises(c, 'de', 100, makeEnv(true, true, true))).toContain('produce');
    expect(availableExercises(c, 'de', 100, makeEnv(true, false, true))).not.toContain('produce');
    expect(supports(card({ de: null, def: null }, 5), 'produce', 'de', 100, makeEnv(true, true, true))).toBe(false);
  });

  it('„Satz vervollständigen“ ohne Satzanfang gibt es nicht mehr', () => {
    expect(supports(card({ word: 'reliable', de: 'zuverlässig', ex: 'Our supplier is very [reliable].' }, 5), 'complete', 'de', 100)).toBe(false);
  });
});

describe('Wächter kennt die neue Art (R13)', () => {
  const c = card({}, 5);
  const e = (): Exercise => buildExercise(c, 'produce', 'de', pool(c), 'seed');
  const rules = (x: Exercise, k = c) => [...new Set(checkExercise(x, k, 'de').map((v) => v.rule))];
  it('gute Aufgabe: keine Verstöße, keine Lücken- oder Lösungsregel', () => {
    expect(checkExercise(e(), c, 'de')).toEqual([]);
    expect(checkExercise(e(), c, 'en')).toEqual([]);
  });
  it('fehlende oder widersprüchliche Vorgabe, unbekannte Lage, unreife Karte: R13', () => {
    const { brief: _drop, ...noBrief } = e();
    void _drop;
    expect(rules(noBrief as Exercise)).toContain('R13');
    const b = e().brief!;
    expect(rules({ ...e(), brief: { ...b, scene: 'x99' } })).toContain('R13');
    expect(rules({ ...e(), brief: { ...b, form: 'i', tense: 'pr' } })).toContain('R13');
    expect(rules({ ...e(), meaning: null })).toContain('R13');
    expect(rules({ ...e(), accepted: ['x'] })).toContain('R13');
    const fresh = card({ hist: [] }, 5);
    expect(rules({ ...e(), card: fresh }, fresh)).toContain('R13');
  });
});

describe('Vorprüfung ohne KI', () => {
  const c = card({ word: 'to leverage', ex: 'We [leverage] our network in every price talk.' }, 5);
  const shown = shownSentences(c, [{ en: 'The team can leverage its strong brand in the new market.', t: 1 }]);
  const form = { form: 'q' as const };

  it('gezeigte Sätze: Ursprungssatz und Claude-Beispiele', () => {
    expect(shown.some((s) => s.includes('price talk'))).toBe(true);
    expect(shown.some((s) => s.includes('strong brand'))).toBe(true);
  });
  it('Wort fehlt, zu kurz, abgeschrieben, falsche Form, Deutsch-Fehler, sonst frei', () => {
    expect(precheckProduce('The meeting starts at nine tomorrow.', c, shown).issue).toBe('target');
    expect(precheckProduce('We leverage it.', c, shown).issue).toBe('short');
    expect(precheckProduce('We leverage our network in every price talk.', c, shown).issue).toBe('copied');
    expect(precheckProduce('The team can leverage its strong brand in new markets.', c, shown).issue).toBe('copied');
    expect(precheckProduce('Our client leverages old contacts at work.', c, shown, form).issue).toBe('form');
    expect(precheckProduce('Can our client leverage old contacts at work?', c, shown, form).issue).toBeNull();
    const g = precheckProduce('We discuss about how our client can leverage old contacts.', c, shown);
    expect(g.issue).toBe('german');
    expect(g.hints).toContain('discuss_about');
    expect(precheckProduce('Our client could leverage old contacts at work.', c, shown).issue).toBeNull();
  });
  it('Schwelle 0,6 gegen irgendeinen gezeigten Satz', () => {
    expect(COPY_LIMIT).toBe(0.6);
    expect(jaccard('a b c d e', 'a b c d e')).toBe(1);
    expect(jaccard('We leverage our network', 'You leverage their contacts')).toBeLessThan(COPY_LIMIT);
    const sc = selfCheckProduce('The team can leverage its strong brand in the new market.', c, shown);
    expect(sc.notCopied).toBe(false);
    expect(sc.grade).toBe(2);
  });
  it('kurze Sätze ab 4 Wörtern sind lang genug', () => {
    expect(selfCheckProduce('We leverage our contacts.', c, shown).longEnough).toBe(true);
    expect(selfCheckProduce('We leverage it.', c, shown).longEnough).toBe(false);
  });
  it('Satzformen: Frage, Verneinung, Wenn-Satz', () => {
    expect(fitsForm('Can you send it?', 'q')).toBe(true);
    expect(fitsForm('You can send it.', 'q')).toBe(false);
    expect(fitsForm('We never leverage it.', 'n')).toBe(true);
    expect(fitsForm("We don't leverage it.", 'n')).toBe(true);
    expect(fitsForm('We leverage it.', 'n')).toBe(false);
    expect(fitsForm('If we leverage it, we win.', 'i')).toBe(true);
    expect(fitsForm('We leverage it.', 'i')).toBe(false);
    expect(fitsForm('We leverage it.', 's')).toBe(true);
  });
  it('typische Deutsch-Fehler', () => {
    for (const [text, id] of [
      ['We depend from our suppliers.', 'depend_from'],
      ['I live here since two years.', 'since_duration'],
      ['We need more informations.', 'informations'],
      ['I want that you call him.', 'want_that'],
      ['If you will call, I will answer.', 'if_will'],
      ['I am agree with you.', 'am_agree'],
      ['Please explain me the plan.', 'explain_me'],
    ] as const) expect(germanHints(text), text).toContain(id);
    expect(germanHints('We depend on our suppliers and have lived here for two years.')).toEqual([]);
    expect(germanHints('Please explain it to me.')).toEqual([]);
  });
});

describe('produce-check@2', () => {
  const vars: ProduceCheckV2Vars = { target: 'leverage', meaning: 'nutzen', sentence: 'We leverage our network.', uiLang: 'de', kind: 'word' };
  const ok = { verdict: 'minor', usesTarget: true, fixed: 'We leverage our network well.', why: 'Das Wort passt; es fehlt nur ein Wort am Ende.', better: 'We leverage our network more effectively.', whyBetter: 'Die Fassung klingt im Beruf natürlicher.', errType: 'word_order' };

  it('Kopfzeile @2, quick, Vorgaben und Hinweise stehen im Prompt', () => {
    const b = pickBrief('lev', 'd', []);
    const p = produceCheckV2.build({ ...vars, brief: briefVarsOf(b), hints: ['"discuss about" (discuss takes no preposition)'] });
    expect(p.split('\n')[0]).toBe('[produce-check@2]');
    expect(produceCheckV2.tier).toBe('quick');
    expect(p).toMatch(/^Assignment: situation: .+ \| form: .+ \| tone: .+ \| tense: .+$/m);
    expect(p).toContain('discuss about');
    expect(p).toContain('whyBetter');
    expect(p).toContain(PRODUCE_CHECK_V2_EXAMPLE);
    expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES);
    expect(produceCheckV2.build(vars)).not.toContain('Assignment:');
  });
  it('das Beispiel-JSON besteht das Schema; ein Registereintrag ersetzt @1', () => {
    for (const uiLang of ['de', 'en'] as const) expect(produceCheckV2.schema({ ...vars, uiLang }).safeParse(JSON.parse(PRODUCE_CHECK_V2_EXAMPLE)).success).toBe(true);
    const mine = TEMPLATES.filter((t) => t.id === 'produce-check');
    expect(mine.map((t) => t.version)).toEqual([2]);
  });
  it('drei Schichten und Fehlerklasse', () => {
    const r = produceCheckV2.schema(vars).safeParse(ok);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.errType).toBe('word_order');
    // C1-Fassung ohne Begründung (und umgekehrt) ist unvollständig
    expect(produceCheckV2.schema(vars).safeParse({ ...ok, whyBetter: '' }).success).toBe(false);
    expect(produceCheckV2.schema(vars).safeParse({ ...ok, better: '', whyBetter: 'Die Fassung ist besser.' }).success).toBe(false);
    expect(produceCheckV2.schema(vars).safeParse({ ...ok, better: '', whyBetter: '' }).success).toBe(true);
  });
  it('Fehlerklasse tolerant: Alias, unbekannt → other, fehlt bei Fehler → other, bei „correct“ immer null', () => {
    expect(errTypeOf('Preposition')).toBe('prep');
    expect(errTypeOf('false friend')).toBe('false_friend');
    expect(errTypeOf('banana')).toBe('other');
    expect(errTypeOf(null)).toBeNull();
    const s = produceCheckV2.schema(vars);
    const miss = s.safeParse({ ...ok, errType: undefined });
    expect(miss.success && miss.data.errType).toBe('other');
    const good = s.safeParse({ ...ok, verdict: 'correct', fixed: '', errType: 'prep' });
    expect(good.success && good.data.errType).toBeNull();
  });
  it('Widerspruch „correct“ ohne Zielwort ungültig; Sprachtreue der Erklärung', () => {
    expect(produceCheckV2.schema(vars).safeParse({ ...ok, verdict: 'correct', usesTarget: false }).success).toBe(false);
    const english = { ...ok, why: 'The target word is used correctly but the end of the sentence is missing something.', whyBetter: 'This version sounds more natural at work and is more precise.' };
    expect(produceCheckV2.schema({ ...vars, uiLang: 'de' }).safeParse(english).success).toBe(false);
    expect(produceCheckV2.schema({ ...vars, uiLang: 'en' }).safeParse(english).success).toBe(true);
  });
});
