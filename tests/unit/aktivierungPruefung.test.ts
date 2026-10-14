import { describe, expect, it } from 'vitest';
import { ACTIVATION_SCENES, sceneById, sceneLeaks, tonesOf } from '../../src/content/activation/scenes';
import { STAGE_TENSE, STAGE_TONE, allowsContinuous, differences, pickBrief } from '../../src/domain/srs/brief';
import { toTrainCard } from '../../src/domain/srs/cards';
import { checkExercise } from '../../src/domain/srs/guard';
import { BLOCKING_HINTS, closestShown, germanHints, precheckProduce, selfCheckProduce, targetSkip, usesTarget } from '../../src/domain/srs/produce';
import type { TrainCard } from '../../src/domain/srs/types';
import { producedToday } from '../../src/features/vocab/session';
import { BETTER_MAX_WORDS, briefVarsOf, produceCheckV2, type ProduceCheckV2Vars } from '../../src/prompts/produceCheckV2';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';
import { berlin } from './helpers';

// Wörter aktivieren, Stufe 1: Abarbeitung der Prüfbefunde (Englischlehrer A1–A10, E; Lernwissenschaft H1–H3, M1–M6, N1–N4; Datenwächter).

const NOW = berlin('2026-10-14', 9);
const DAY = 86_400_000;
type Doc = Record<string, unknown>;
const doc = (over: Doc = {}): Doc => ({ word: 'leverage', pos: 'noun', de: 'Hebelwirkung', def: 'the power to influence a result', ex: 'We use [leverage] in every price talk.', col: [], state: 'review', S: 10, D: 5, last: NOW - 3 * DAY, due: NOW - 1000, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 4, hist: [], intro: '2026-08-01', ...over });
const card = (over: Doc = {}): TrainCard => toTrainCard('x', doc(over), true, NOW) as TrainCard;

describe('Deutsch-Fehler-Muster: korrektes Englisch wird nie gemeldet (Lehrer A1–A6)', () => {
  const CORRECT = [
    "I'm not sure if the client will sign.",
    'Can you check if the system will scale?',
    'Let me know if he will join.',
    'I wonder if they will agree to the price.',
    'If you will follow me, I will show you the room.',
    'Our clients describe us as reliable.',
    "Since two weeks have passed, I'd like to follow up.",
    'We process payment advices and remittance advices every day.',
    "Is there anything else you want that we haven't covered?",
    'It depends of course on the price.',
    "Let's agree on a price.",
    'This evidences a clear trend.',
    'If you call me, we will help you.',
    'We have worked together for two years and since 2022 without issues.',
    'Please explain it to me.',
    'We became a customer last year.',
  ];
  it.each(CORRECT)('%s', (s) => {
    expect(germanHints(s, 10), s).toEqual([]);
  });

  const WRONG: ReadonlyArray<[string, string]> = [
    ['We discuss about the budget.', 'discuss_about'],
    ['It depends from the price.', 'depend_from'],
    ['We need more informations and softwares.', 'informations'],
    ['They sent hardwares and feedbacks.', 'informations'],
    ['The study shows evidences of growth.', 'informations'],
    ["I'm agree with you.", 'am_agree'],
    ["We're agree on that.", 'am_agree'],
    ['I am agree.', 'am_agree'],
    ['I became an email from the client.', 'become_get'],
    ['We become a discount next week.', 'become_get'],
    ['If the client will sign, we will start.', 'if_will'],
    ['I live here since two years.', 'since_duration'],
    ['He is here since months.', 'since_duration'],
    ['I want that you call him.', 'want_that'],
    ['I would like that you call him.', 'want_that'],
    ['Please say me the price.', 'explain_me'],
  ];
  it.each(WRONG)('%s → %s', (s, id) => {
    expect(germanHints(s, 10), s).toContain(id);
  });

  it('nur eindeutige Muster sperren lokal; if_will, want_that, since_duration, explain_me nur als Hinweis', () => {
    expect([...BLOCKING_HINTS].sort()).toEqual(['am_agree', 'become_get', 'depend_from', 'discuss_about', 'informations']);
    const c = card({ word: 'to sign', ex: 'We [sign] the contract today.' });
    const soft = precheckProduce('If the client will sign, we will start the project.', c, []);
    expect(soft.issue).toBeNull();
    expect(soft.hints).toContain('if_will');
    expect(soft.block).toEqual([]);
    const hard = precheckProduce('We discuss about when the client will sign.', c, []);
    expect(hard.issue).toBe('german');
    expect(hard.block).toEqual(['discuss_about']);
  });

  it('der Hinweistext fordert zum Prüfen auf statt zu behaupten', () => {
    expect(de.ppGerman).toMatch(/^Prüf kurz/);
    expect(en.ppGerman).toMatch(/^Quick check/);
    expect(en.gh_if_will).toContain('whether');
  });
});

describe('Wort fehlt bei getrennten Verben (Lernwissenschaft H3)', () => {
  const c = card({ word: 'follow up', ex: 'We [follow up] with every lead.' });
  it('„follow it up“ und „carry the plan out“ gelten als benutzt', () => {
    expect(usesTarget('Please follow it up with the client tomorrow.', c)).toBe(true);
    expect(usesTarget('I will follow up tomorrow.', c)).toBe(true);
    expect(usesTarget('Please call the client tomorrow.', c)).toBe(false);
    const c2 = card({ word: 'carry out', ex: 'We [carry out] the plan.' });
    expect(usesTarget('They carried the whole plan out on time.', c2)).toBe(true);
  });
});

describe('Abschreibprüfung über Inhaltswörter (Lernwissenschaft N4)', () => {
  const c = card({ word: 'leverage', ex: 'We use leverage in every price talk.' });
  const skip = targetSkip(c);
  it('Zielwort und Funktionswörter zählen nicht mit', () => {
    expect(skip.size).toBeGreaterThan(0);
    // Gleiches Gerüst, getauschtes Subjekt: abgeschrieben.
    expect(closestShown('They use leverage in every price talk.', ['We use leverage in every price talk.'], skip)?.copied).toBe(true);
    // Ein eigener Satz mit demselben Zielwort und denselben Funktionswörtern ist keine Kopie.
    expect(closestShown('Our team can leverage the new report in a call with the client.', ['We use leverage in every price talk.'], skip)?.copied).toBe(false);
  });
  it('weniger als zwei neue Inhaltswörter gelten als abgeschrieben', () => {
    expect(closestShown('We use leverage in every price talk today.', ['We use leverage in every price talk.'], skip)?.copied).toBe(true);
  });
  it('selfCheckProduce und Vorprüfung nutzen dieselbe Regel', () => {
    const shown = ['We use leverage in every price talk.'];
    expect(selfCheckProduce('They use leverage in every price talk.', c, shown).notCopied).toBe(false);
    expect(precheckProduce('They use leverage in every price talk.', c, shown).issue).toBe('copied');
    expect(precheckProduce('Our team can leverage the new report in a call with the client.', c, shown).issue).toBeNull();
  });
});

describe('Lagen (Lehrer B, E)', () => {
  it('neue Verkaufs- und Alltagslagen j15–j21, d06–d09, zweisprachig, mit mindestens zwei Tönen', () => {
    for (const id of ['j15', 'j16', 'j17', 'j18', 'j19', 'j20', 'j21', 'd06', 'd07', 'd08', 'd09']) {
      const s = sceneById(id);
      expect(s, id).toBeDefined();
      expect(s!.de.length).toBeGreaterThan(15);
      expect(s!.en.length).toBeGreaterThan(15);
      expect(s!.de).not.toBe(s!.en);
    }
    for (const s of ACTIVATION_SCENES) expect(tonesOf(s).length, s.id).toBeGreaterThanOrEqual(2);
    expect(ACTIVATION_SCENES.filter((s) => s.kind === 'job').length).toBeGreaterThanOrEqual(20);
    expect(ACTIVATION_SCENES.filter((s) => s.kind === 'daily').length).toBeGreaterThanOrEqual(9);
  });
  it('US-Englisch: keine britischen oder deutsch geprägten Wörter in den Lagen', () => {
    const all = ACTIVATION_SCENES.map((s) => s.en).join(' ');
    expect(all).not.toMatch(/\b(parcel|colour|favour|programme|centre|take in)\b/i);
    expect(sceneById('j10')!.en).toMatch(/meeting/);
    expect(sceneById('d05')!.en).toMatch(/package/);
  });
  it('Lage verrät das Zielwort → wird übersprungen', () => {
    expect(sceneLeaks(sceneById('j03')!, 'budget')).toBe(true);
    expect(sceneLeaks(sceneById('j04')!, 'risk')).toBe(true);
    expect(sceneLeaks(sceneById('j13')!, 'complain')).toBe(true);
    expect(sceneLeaks(sceneById('j03')!, 'leverage')).toBe(false);
    for (let i = 0; i < 80; i++) {
      const b = pickBrief(`k${i}`, `d${i}`, [], { lemma: 'budget' });
      expect(b.scene, b.code).not.toBe('j03');
    }
  });
});

describe('Staffelung der Vorgaben (Lernwissenschaft M3)', () => {
  const run = (key: string, n: number, c: { lemma?: string; pos?: string | null } = {}): ReturnType<typeof pickBrief>[] => {
    const used: string[] = [];
    const out: ReturnType<typeof pickBrief>[] = [];
    for (let i = 0; i < n; i++) {
      const b = pickBrief(key, `d${i}`, used, c);
      out.push(b);
      used.push(b.code);
    }
    return out;
  };
  it('1. Mal Lage + Form (Aussage/Frage), 2. Mal dazu Zeitform, ab 3. Mal dazu Ton', () => {
    expect(STAGE_TENSE).toBe(1);
    expect(STAGE_TONE).toBe(2);
    for (let k = 0; k < 30; k++) {
      const [a, b, c, d] = run(`k${k}`, 4);
      expect(['s', 'q']).toContain(a!.form);
      expect(a!.tone).toBe('-');
      expect(a!.tense).toBe('-');
      expect(b!.tone).toBe('-');
      expect(b!.form).not.toBe('i');
      expect(b!.tense).not.toBe('-');
      for (const x of [c!, d!]) {
        expect(x.tone).not.toBe('-');
        expect(x.form === 'i' ? x.tense === '-' : x.tense !== '-').toBe(true);
      }
    }
  });
  it('mindestens drei Merkmale anders als beim Vorgänger, auch in den gestaffelten ersten Malen', () => {
    for (let k = 0; k < 40; k++) {
      const list = run(`card${k}`, 8);
      for (let i = 1; i < list.length; i++) expect(differences(list[i]!, list[i - 1]!), `${list[i - 1]!.code} → ${list[i]!.code}`).toBeGreaterThanOrEqual(3);
    }
  });
  it('der Prompt kennt „free“ für fehlenden Ton und fehlende Zeit', () => {
    const v = briefVarsOf(run('x', 1)[0]!);
    expect(v?.tone).toBe('free');
    expect(v?.tense).toBe('free');
  });
});

describe('Töne passen zur Lage (Lehrer A7)', () => {
  it('der Ton kommt immer aus den erlaubten Tönen der Lage; nie „formell“ unter Freunden, nie „locker“ gegenüber dem Finanzchef', () => {
    const seen = new Map<string, Set<string>>();
    for (let k = 0; k < 120; k++) {
      const used: string[] = [];
      for (let i = 0; i < 6; i++) {
        const b = pickBrief(`w${k}`, `t${k}-${i}`, used);
        used.push(b.code);
        if (b.tone === '-') continue;
        expect(tonesOf(sceneById(b.scene)!), b.code).toContain(b.tone);
        (seen.get(b.scene) ?? seen.set(b.scene, new Set()).get(b.scene)!).add(b.tone);
      }
    }
    expect(seen.get('d01')?.has('f') ?? false).toBe(false);
    expect(seen.get('d05')?.has('f') ?? false).toBe(false);
    expect(seen.get('j03')?.has('c') ?? false).toBe(false);
    expect(seen.get('j14')?.has('c') ?? false).toBe(false);
    expect(seen.get('j13')?.has('c') ?? false).toBe(false);
  });
});

describe('Verlaufsform nicht bei Zustandsverben und Adjektiven (Lehrer A8)', () => {
  it('Zustandsverben, Adjektive und Adverbien bekommen nie „Verlaufsform“', () => {
    expect(allowsContinuous({ lemma: 'know' })).toBe(false);
    expect(allowsContinuous({ lemma: 'consist of' })).toBe(false);
    expect(allowsContinuous({ lemma: 'reluctant', pos: 'adj' })).toBe(false);
    expect(allowsContinuous({ lemma: 'negotiate', pos: 'verb' })).toBe(true);
    for (const c of [{ lemma: 'know', pos: 'verb' }, { lemma: 'reluctant', pos: 'adj' }, { lemma: 'belong to', pos: 'verb' }]) {
      for (let k = 0; k < 40; k++) {
        const used: string[] = [];
        for (let i = 0; i < 8; i++) {
          const b = pickBrief(`z${k}`, `y${i}`, used, c);
          used.push(b.code);
          expect(b.tense, `${c.lemma} ${b.code}`).not.toBe('co');
        }
      }
    }
  });
  it('für gewöhnliche Verben kommt die Verlaufsform vor', () => {
    let co = 0;
    for (let k = 0; k < 40; k++) {
      const used: string[] = [];
      for (let i = 0; i < 8; i++) {
        const b = pickBrief(`z${k}`, `y${i}`, used, { lemma: 'negotiate', pos: 'verb' });
        used.push(b.code);
        if (b.tense === 'co') co++;
      }
    }
    expect(co).toBeGreaterThan(0);
  });
  it('Wächter R13 meldet die Verlaufsform bei einem Zustandsverb', () => {
    const c = card({ word: 'know', pos: 'verb', ex: 'I [know] the client well.' });
    const e = {
      ex: 'produce',
      brief: { scene: 'j01', form: 's', tone: 'n', tense: 'co', wording: 0, code: 'j01.s.n.co' },
      meaning: 'wissen',
      accepted: [],
      options: [],
    } as unknown as Parameters<typeof checkExercise>[0];
    expect(checkExercise(e, { ...c, stage: 5, doc: { ...c.doc, hist: [{ t: NOW - 3 * DAY, g: 3 }, { t: NOW - 5 * DAY, g: 3 }] } }, 'de').map((v) => v.rule)).toContain('R13');
  });
});

describe('Tagesdeckel für eigene Sätze (Lernwissenschaft M2)', () => {
  it('zählt Einträge x=produce von heute über alle Karten (alle Runden), nicht von gestern', () => {
    const day = '2026-10-14';
    const mk = (i: number, hist: Doc[]) => card({ word: `w${i}`, hist });
    const pool = [
      mk(1, [{ t: NOW, g: 3, x: 'produce' }, { t: NOW - DAY, g: 3, x: 'produce' }]),
      mk(2, [{ t: NOW - 1000, g: 2, x: 'produce' }, { t: NOW, g: 3, x: 'cloze' }]),
      mk(3, []),
    ];
    expect(producedToday(pool, day)).toBe(2);
    expect(producedToday([], day)).toBe(0);
  });
});

describe('Prompt produce-check@2 (Lehrer D, Lernwissenschaft H2, M5, M6)', () => {
  const vars: ProduceCheckV2Vars = { target: 'leverage', meaning: 'nutzen', sentence: 'We leverage our network.', uiLang: 'de', kind: 'word', brief: briefVarsOf({ scene: 'j01', form: 's', tone: 'n', tense: 'pr' }) };
  const p = produceCheckV2.build(vars);
  it('falsch NUR bei fehlendem, falsch benutztem Zielwort oder falscher Bedeutung; sonst minor', () => {
    expect(p).toMatch(/"wrong" ONLY if the target is missing, misused or has the wrong meaning/);
    expect(p).toMatch(/ignoring the assignment is "minor", never "wrong"|Any other error, or ignoring the assignment, is "minor", never "wrong"/);
    expect(p).toMatch(/Ignoring the assignment alone never lowers "correct" to "minor"/);
  });
  it('Zeitform-Ausnahmen, Ton-Definition, Tippfehler, keine erfundenen Fakten, Priorität, konkretes Lob, Anführungszeichen', () => {
    expect(p).toContain('stative verbs in the continuous');
    expect(p).toContain('present continuous for arrangements');
    expect(p).toContain('"if" meaning "whether" does not count');
    expect(p).toContain('casual = chat with a colleague');
    expect(p).toContain('no "hereby"');
    expect(p).toContain('phone typos');
    expect(p).toContain('do not add facts, numbers, names or content');
    expect(p).toContain('Priority: target misused > error that changes meaning');
    expect(p).toContain('name the specific thing that works');
    expect(p).toContain('Quote English words in "…"');
  });
  it('C1-Fassung nur wenn wirklich besser und mit denselben Vorgaben', () => {
    expect(p).toContain('never just a synonym or taste');
    expect(p).toContain('the assigned form, tone and tense');
    expect(p).toContain(`at most ${BETTER_MAX_WORDS} words`);
  });
  const ok = { verdict: 'minor', usesTarget: true, fixed: 'We leverage our network well.', why: 'Das Wort passt; es fehlt nur ein Wort am Ende.', better: 'We leverage our network more effectively.', whyBetter: 'Die Fassung klingt im Beruf natürlicher.', errType: 'word_order' };
  const s = produceCheckV2.schema(vars);
  it('better muss das Zielwort behalten und höchstens 25 Wörter haben (Schemaverletzung sonst)', () => {
    expect(s.safeParse(ok).success).toBe(true);
    expect(s.safeParse({ ...ok, better: 'We make the most of our network.' }).success).toBe(false);
    expect(s.safeParse({ ...ok, better: `We leverage ${'our very large network '.repeat(7)}.` }).success).toBe(false);
    expect(s.safeParse({ ...ok, better: '', whyBetter: '' }).success).toBe(true);
    // Zielwort gebeugt und getrennte Wendung bleiben erlaubt
    expect(s.safeParse({ ...ok, better: 'Leveraging our network pays off.' }).success).toBe(true);
    const phr = produceCheckV2.schema({ ...vars, target: 'follow up', kind: 'phrase' });
    expect(phr.safeParse({ ...ok, better: 'Please follow it up soon.' }).success).toBe(true);
  });
  it('modelTier bleibt quick (begründet in docs/entscheidungen.md)', () => {
    expect(produceCheckV2.tier).toBe('quick');
  });
});

describe('Texte (Lehrer B, C)', () => {
  it('Anweisungen und Rückmeldungen in beiden Sprachen, US-Englisch', () => {
    expect(de.trProduceMissing).toBe('Das Wort kommt in deinem Satz nicht vor.');
    expect(en.trProduceMissing).toBe('Your sentence doesn’t use the word.');
    expect(de.trProduceLocalNote).toContain('das Wort');
    expect(en.trProduceLocalNote).toContain('the word');
    expect(en.task_produce_1).toContain('instructions');
    expect(en.task_produce_2).toMatch(/^What would you say in this situation\?/);
    expect(de.task_produce_2).toMatch(/^Was würdest du in dieser Lage sagen\?/);
    expect(en.brTense_pr).toBe('Present simple');
    expect(en.brTense_pa).toBe('Past simple');
    expect(en.brTense_co).toBe('Present continuous');
    expect(de.ppForm_i).toMatch(/unless/);
    expect(en.ppForm_i).toMatch(/unless/);
    for (const k of ['gh_informations'] as const) {
      expect(de[k]).toContain('software');
      expect(en[k]).toContain('software');
    }
  });
});
