import { describe, expect, it } from 'vitest';
import course from '../../src/content/legacy/course.json';
import { containsPhrase } from '../../src/domain/chunks/newChunk';
import type { LessonMeta } from '../../src/domain/learn/types';
import { cardExamples } from '../../src/prompts/cardExamples';
import { shortenText } from '../../src/prompts/common';
import { grammarItems } from '../../src/prompts/grammarItems';
import { grammarJudge } from '../../src/prompts/grammarJudge';
import { lessonContent } from '../../src/prompts/lessonContent';
import { lessonProduction } from '../../src/prompts/lessonProduction';
import { mnemonic } from '../../src/prompts/mnemonic';
import { threeLayersSchema } from '../../src/prompts/threeLayers';
import { translate } from '../../src/prompts/translate';
import { spellingCorrection, wordGen } from '../../src/prompts/wordGen';
import { wordLookup } from '../../src/prompts/wordLookup';

// Realistische Modellantworten aus der Prüfung der KI-Vorlagen (B1, W1–W8, Hinweise), die an zu
// strengen Schemas scheiterten: Der Nutzer sah „Die Antwort von Claude war unvollständig“.
// Grundsatz: tolerant lesen, sinnvoll normalisieren, nur ablehnen, was wirklich unbrauchbar ist.

type Parseable = { safeParse(v: unknown): { success: boolean; data?: unknown; error?: { issues: unknown[] } } };
function ok<T = Record<string, unknown>>(schema: Parseable, value: unknown): T {
  const r = schema.safeParse(value);
  expect(r.success, JSON.stringify(r.error?.issues.slice(0, 3))).toBe(true);
  return r.data as T;
}
const bad = (schema: Parseable, value: unknown) => expect(schema.safeParse(value).success).toBe(false);

describe('translate@2 (W1, W2, B1)', () => {
  const vDe = { text: 'Kannst du mir bis Freitag Bescheid geben?', from: 'de', register: 'neutral', uiLang: 'de' } as const;
  const s = translate.schema(vDe);
  const base = { source: 'de', translation: 'Can you let me know by Friday?', register: 'neutral', alternatives: [{ text: 'Could you get back to me by Friday?', register: 'formal', note: 'höflicher' }], notes: [], terms: [] };

  it('W1: abweichende Ausgangssprache bei fester Richtung wird übernommen, Ziel ist die andere Sprache', () => {
    const r = ok<{ source: string }>(translate.schema({ text: 'Keep up the good work', from: 'de', register: 'neutral', uiLang: 'de' }), {
      source: 'en',
      translation: 'Mach weiter so!',
      register: 'neutral',
      alternatives: [{ text: 'Weiter so, gute Arbeit!', register: 'casual', note: 'locker' }],
      notes: ['Der Text ist bereits Englisch; hier die deutsche Übersetzung.'],
      terms: [],
    });
    expect(r.source).toBe('en');
    expect(ok<{ source: string }>(translate.schema({ ...vDe, from: 'auto' }), { ...base, source: 'German' }).source).toBe('de');
  });

  it('W2: keine Alternativen, „informal“, lange Hinweise bis 300 Zeichen', () => {
    ok(translate.schema({ text: 'Danke!', from: 'auto', register: 'neutral', uiLang: 'de' }), { ...base, translation: 'Thanks!', alternatives: [] });
    const r = ok<{ alternatives: Array<{ register: string }> }>(s, { ...base, alternatives: [{ text: 'Lmk by Friday?', register: 'informal', note: 'nur im Chat' }] });
    expect(r.alternatives[0]?.register).toBe('casual');
    expect(ok<{ register: string }>(s, { ...base, register: 'Formal' }).register).toBe('formal');
    ok(s, { ...base, notes: ['Im amerikanischen Englisch klingt „let me know“ freundlich und neutral; „notify me“ wirkt dagegen sehr förmlich und passt eher zu automatischen Systemnachrichten.'] });
    bad(s, { ...base, notes: ['x'.repeat(301)] });
  });

  it('B1: Hinweise mit englischen Wendungen in der jeweils anderen Sprache', () => {
    ok(s, { ...base, alternatives: [{ text: 'Could you get back to me by Friday?', register: 'formal', note: 'formeller; get back to me is common in emails' }] });
    ok(translate.schema({ text: 'Das müssen wir noch mit dem Vorstand abstimmen.', from: 'de', register: 'formal', uiLang: 'en' }), {
      ...base,
      translation: 'We still need to align this with the executive board.',
      notes: ['Vorstand ist hier the executive board, nicht die Aufsichtsrat-Ebene.'],
    });
    // Ganze Texte in falscher Sprache bleiben verboten (Kap. 10).
    bad(s, { ...base, notes: ['This phrase is much more natural in American business English than the literal version.'] });
  });
});

describe('word-lookup@2 (W3, B1)', () => {
  const v = { word: 'reliable', sentence: 'The system is reliable.', uiLang: 'de' } as const;
  const base = { lemma: 'reliable', pos: 'adj', ipa: 'rɪˈlaɪəbəl', level: 'B2', de: 'zuverlässig', def: 'able to be trusted to work well', ex: 'Our new archive system has proven highly reliable.', sense: 'Hier heißt es, dass man sich auf das System verlassen kann.', note: 'Oft mit „highly“ oder „fully“ kombiniert.' };
  const s = wordLookup.schema(v);

  it('Stufe tolerant: „B2–C1“ → B2, „N/A“/""/null → ""', () => {
    expect(ok<{ level: string }>(s, { ...base, level: 'B2–C1' }).level).toBe('B2');
    expect(ok<{ level: string }>(s, { ...base, lemma: 'Anna', pos: 'proper noun', level: 'N/A', de: 'Anna (Vorname)', note: '' }).level).toBe('');
    expect(ok<{ level: string }>(s, { ...base, level: '' }).level).toBe('');
    expect(ok<{ level: string }>(s, { ...base, level: null }).level).toBe('');
  });

  it('fehlende Notiz → "", deutscher Hinweis mit englischer Wendung ist Deutsch', () => {
    const { note: _drop, ...noNote } = base;
    void _drop;
    expect(ok<{ note: string }>(s, noNote).note).toBe('');
    ok(s, { ...base, note: 'Typisch: follow up on something, follow up with someone.' });
    ok(s, { ...base, note: 'Statt make a decision nie do a decision sagen.' });
    bad(s, { ...base, sense: "'Reliable' means here that you can count on the system to work." });
  });

  it('Prompt verlangt "" für nicht anwendbare Stufen und “…” für englische Wendungen', () => {
    const p = wordLookup.build(v);
    expect(p.split('\n')[0]).toBe('[word-lookup@2]');
    expect(p).toContain('or "" if not applicable');
    expect(p).toContain('English words and phrases in “…”');
  });
});

describe('word-gen@2 (W4)', () => {
  const g = { mode: 'general', count: 5, known: ['agenda'] } as const;
  const w = (o: object) => ({ word: 'stakeholder', pos: 'noun', de: 'Beteiligte(r)', def: 'a person with an interest in a project', ex: 'We invited every stakeholder to the kickoff meeting on Monday.', level: 'B2', ...o });
  const s = wordGen.schema(g);

  it('Stufe tolerant: „B2+“ → B2, A2 erlaubt', () => {
    expect(ok<{ words: Array<{ level: string }> }>(s, { words: [w({ level: 'B2+' })] }).words[0]?.level).toBe('B2');
    expect(ok<{ words: Array<{ level: string }> }>(s, { words: [w({ level: 'A2' })] }).words[0]?.level).toBe('A2');
  });

  it('Wort im Beispiel auch unregelmäßig gebeugt oder mit Platzhalter', () => {
    ok(s, { words: [w({ word: 'to undertake', pos: 'verb', ex: 'The team undertook a full review of the contracts last quarter.' })] });
    ok(s, { words: [w({ word: 'to keep sb in the loop', pos: 'phrase', ex: 'Please keep me in the loop about the migration.' })] });
    ok(wordGen.schema({ mode: 'fill', count: 1, known: [], word: 'to get sth off the ground' }), {
      words: [w({ word: 'to get something off the ground', pos: 'phrase', de: 'etwas auf den Weg bringen', ex: 'We finally got the pilot project off the ground in May.' })],
    });
    bad(s, { words: [w({ ex: 'We invited every partner to the kickoff meeting on Monday.' })] });
  });

  it('ungültige Einzelwörter fallen weg, statt den Stapel abzulehnen', () => {
    const r = ok<{ words: Array<{ word: string }> }>(s, {
      words: [w({}), w({ word: 'bottleneck', ex: 'Das ist ein Engpass in unserem Prozess, leider.' }), w({ word: 'leverage', pos: 'verb', ex: 'We can leverage our partner network to reach new clients.' })],
    });
    expect(r.words.map((x) => x.word)).toEqual(['stakeholder', 'leverage']);
    bad(s, { words: [w({ ex: 'Nothing to see here, sorry about that.' })] });
  });

  it('fill: Tippfehler – die korrigierte Schreibweise wird akzeptiert und übernommen', () => {
    ok(wordGen.schema({ mode: 'fill', count: 1, known: [], word: 'recieve' }), { words: [w({ word: 'receive', pos: 'verb', de: 'erhalten', ex: 'We will receive the signed contract on Monday.' })] });
    expect(spellingCorrection('recieve', 'receive')).toBe('receive');
    expect(spellingCorrection('to chair', 'chair')).toBeNull();
    bad(wordGen.schema({ mode: 'fill', count: 1, known: [], word: 'deadline' }), { words: [w({})] });
  });
});

describe('grammar-judge (W5, Hinweis Begründung)', () => {
  const v = { topic: 'passive', type: 'transform', prompt: 'They signed the contract. → The contract ___.', answer: 'was signed', accepted: [], given: 'has been signed', uiLang: 'de' } as const;
  const s = grammarJudge.schema(v);

  it('„wrong“ + acceptable → near', () => {
    expect(ok<{ verdict: string }>(s, { verdict: 'wrong', acceptable: true, corrected: 'was signed', why: 'Richtiges Englisch, aber nicht die geübte Zeitform.' }).verdict).toBe('near');
  });

  it('zu lange Begründung wird auf ganze Sätze gekürzt', () => {
    const why = 'Deine Form ist grammatisch korrekt, aber der Ausgangssatz steht im Simple Past. Beim Umformen ins Passiv bleibt die Zeitform gleich, also brauchst du hier „was signed“ statt „has been signed“ als Lösung.';
    expect(ok<{ why: string }>(s, { verdict: 'near', acceptable: true, corrected: 'was signed', why }).why).toBe('Deine Form ist grammatisch korrekt, aber der Ausgangssatz steht im Simple Past.');
    expect(shortenText('eins zwei drei vier fünf', 3, 300)).toBe('eins zwei drei…');
  });
});

describe('mnemonic (Hinweis Länge, B1)', () => {
  it('bis 320 Zeichen; deutsche Merkhilfe mit englischem Zitat in geraden Anführungszeichen', () => {
    const s2 =
      'Denk an einen Stromlinien-Zug, der ohne Widerstand durch den Wind gleitet: Wer einen Prozess streamlines, entfernt alles Überflüssige, bis jeder einzelne Schritt im Büro reibungslos, schnell und ohne unnötige Umwege abläuft – genau wie der Zug.';
    ok(mnemonic.schema({ word: 'to streamline', meaning: 'straffen', sentence: '', uiLang: 'de' }), { text: s2 });
    ok(mnemonic.schema({ word: 'bottleneck', meaning: 'Engpass', sentence: '', uiLang: 'de' }), {
      text: "Bottleneck = 'bottle neck': the neck of a bottle is narrow, so everything gets stuck there – ein Engpass.",
    });
  });
});

describe('card-examples (B2-Liste, tolerant)', () => {
  const s = cardExamples.schema({ word: 'reliable', pos: 'adj', meaning: 'zuverlässig', sentence: 'The system is reliable.' });
  it('fünf Sätze → die ersten vier; Objekte {en} → Text', () => {
    const five = ['Our supplier has always been reliable, even during the holidays.', 'We need reliable data before we present the numbers to the board.', 'She is one of the most reliable people on our team.', 'Is the new server reliable enough for production?', 'A reliable partner makes every rollout easier.'];
    expect(ok<{ examples: string[] }>(s, { examples: five }).examples).toHaveLength(4);
    expect(ok<{ examples: string[] }>(s, { examples: [{ en: five[0] }, { en: five[1] }] }).examples).toEqual(five.slice(0, 2));
  });
});

// ---------------------------------------------------------------- Phase 2: Aufgaben und Lektion

const item = (o: object) => ({
  topic: 'passive',
  type: 'gap',
  prompt: 'The new contract ___ (sign) yesterday.',
  answer: 'was signed',
  accepted: [],
  options: null,
  hint_de: '(sign)',
  explanation_de: '„yesterday“ zeigt eine abgeschlossene Zeit, und der Vertrag handelt nicht selbst → was + 3. Form.',
  explanation_en: '“yesterday” shows finished time, so we use was + past participle.',
  src: 'ai',
  ...o,
});

describe('grammar-items@2 (W8)', () => {
  const v = { topic: 'passive', nameEn: 'Passive voice', ruleEn: 'be + past participle', examples: ['The report was sent.'], p: 0.5, types: ['gap', 'transform'], seenText: [], errors: [], count: 6 } as const;
  const s = grammarItems.schema(v);
  const six = (x: object) => ({ items: [item({}), item({}), item({}), item({}), item({}), x] });

  it('options [] → null, accepted als Text → Liste, mc-Antwort ohne Groß/klein', () => {
    const a = ok<{ items: Array<{ options: unknown; accepted: string[]; answer: string }> }>(s, six(item({ options: [] })));
    expect(a.items[5]?.options).toBeNull();
    expect(ok<{ items: Array<{ accepted: string[] }> }>(s, six(item({ accepted: 'got signed' }))).items[5]?.accepted).toEqual(['got signed']);
    const mc = ok<{ items: Array<{ answer: string }> }>(s, six(item({ type: 'mc', options: ['Was signed', 'signed', 'has signed', 'is signing'], answer: 'was signed', prompt: 'The contract ___ yesterday.' })));
    expect(mc.items[5]?.answer).toBe('Was signed');
  });

  it('ungültige Einträge fallen einzeln weg; zu wenige gültige → Fehler', () => {
    const r = ok<{ items: unknown[] }>(s, six(item({ prompt: 'The new contract ___ ___ (sign) yesterday.' })));
    expect(r.items).toHaveLength(5);
    expect(ok<{ items: unknown[] }>(s, six(item({ topic: 'Passive voice' }))).items).toHaveLength(5);
    expect(ok<{ items: unknown[] }>(s, six(item({ type: 'mc', options: ['was signed', 'signed', 'has signed', 'is signing', 'had signed'], answer: 'was signed', prompt: 'The contract ___ yesterday.' }))).items).toHaveLength(5);
    bad(s, { items: [item({}), item({}), item({ options: ['a'] })] });
  });

  it('Prompt: Version 2, englische Wendungen in “…”', () => {
    const p = grammarItems.build(v);
    expect(p.split('\n')[0]).toBe('[grammar-items@2]');
    expect(p).toContain('put English words and phrases in “…”');
  });
});

const meta = (course as unknown as { lessons: LessonMeta[] }).lessons[0]!;
function lesson(o: Record<string, unknown> = {}) {
  const lines = [
    ['Anna', "Good morning, everyone. I'll chair the meeting today, so let's look at the agenda."],
    ['Tom', 'Thanks, Anna. How many attendees have we been expecting?'],
    ['Anna', "Six. First, let's go over what we have been working on."],
    ['Tom', 'We have been testing the new archive module since Monday.'],
    ['Anna', 'Great. Any action items from last week?'],
    ['Tom', 'Yes, two. Lisa has been talking to the client about the rollout.'],
    ['Anna', 'Okay. Let me recap: testing continues, and Lisa follows up.'],
    ['Tom', 'Sounds good. I have been preparing the slides for Friday too.'],
  ].map(([sp, en]) => ({ sp, en, de: 'Übersetzung.' }));
  const q = {
    q: 'Was hat Tom seit Montag gemacht?',
    options: ['Das Archivmodul getestet', 'Folien erstellt', 'Mit dem Kunden gesprochen', 'Das Meeting geleitet'],
    answer: 'Das Archivmodul getestet',
    lang: 'de',
    q_alt: 'What has Tom been doing since Monday?',
    options_alt: ['Testing the archive module', 'Making slides', 'Talking to the client', 'Chairing the meeting'],
    answer_alt: 'Testing the archive module',
  };
  const task = { topic: 'pres-perf-cont', type: 'gap', prompt: 'We ___ (work) on the rollout since March.', answer: 'have been working', accepted: [], options: null, hint: '(work)', expl: '„since March“ zeigt eine Dauer bis jetzt → have been + -ing.', expl_en: '“since March” shows a duration up to now, so we use have been + -ing.' };
  return {
    words: meta.words.map(([en, de]) => ({ en, de, pos: 'noun', def: 'x', ex: 'y' })),
    dialogue: { title: 'Weekly meeting', lines },
    questions: [q, q],
    tasks: [task, task, task, task],
    output: { de: 'Schreibe eine kurze E-Mail an dein Team und fasse zusammen, woran ihr gerade arbeitet.', en: 'Write a short email to your team summarizing what you have been working on.', mustUse: ['agenda', 'attendee', 'action item'] },
    ...o,
  };
}

describe('lesson-content@2 (W6, W8, Hinweis Sprecher)', () => {
  const v = { meta, grammarName: 'Present perfect continuous', ruleEn: 'have/has been + -ing', uiLang: 'de', mix: null } as const;
  const s = lessonContent.schema(v);
  const base = lesson();

  it('Voraussetzung: Lektion l01 mit den erwarteten Zielwörtern', () => {
    expect(meta.grammar).toBe('pres-perf-cont');
    expect(meta.words.map(([en]) => en)).toEqual(expect.arrayContaining(['agenda', 'to chair a meeting', 'to recap']));
    ok(s, base);
  });

  it('W6: Pflichtwörter ohne „to“ oder gebeugt werden den Vorgaben zugeordnet, Unbekanntes verworfen', () => {
    const out = (mustUse: string[]) => ok<{ output: { mustUse: string[] } }>(s, lesson({ output: { ...base.output, mustUse } })).output.mustUse;
    expect(out(['agenda', 'chair a meeting', 'recap'])).toEqual(['agenda', 'to chair a meeting', 'to recap']);
    expect(out(['agenda', 'attendees', 'action items'])).toEqual(['agenda', 'attendee', 'action item']);
    expect(out(['agenda', 'banana', 'recap', 'Recap'])).toEqual(['agenda', 'to recap']);
    bad(s, lesson({ output: { ...base.output, mustUse: ['banana', 'agenda'] } }));
  });

  it('Wörter ohne „to“ werden auf die Vorgabe zurückgeführt; lange Sprechernamen erlaubt', () => {
    const r = ok<{ words: Array<{ en: string }> }>(s, lesson({ words: meta.words.map(([en, de]) => ({ en: en.replace(/^to /, ''), de, pos: 'verb', def: 'x', ex: 'y' })) }));
    expect(r.words.map((w) => w.en)).toEqual(meta.words.map(([en]) => en));
    ok(s, lesson({ dialogue: { title: 'x', lines: base.dialogue.lines.map((l) => ({ ...l, sp: 'Head of Business Development' })) } }));
  });

  it('W8: ungültige Aufgaben fallen weg (mc mit 3 Optionen), mc-Antwort ohne Groß/klein', () => {
    const t0 = base.tasks[0]!;
    const r = ok<{ tasks: unknown[] }>(s, lesson({ tasks: [...base.tasks.slice(0, 3), { ...t0, type: 'mc', options: ['have been working', 'worked', 'are working'], answer: 'have been working' }] }));
    expect(r.tasks).toHaveLength(3);
    const mc = ok<{ tasks: Array<{ answer: string; options: string[] | null }> }>(s, lesson({ tasks: [...base.tasks.slice(0, 3), { ...t0, type: 'mc', options: ['Have been working', 'worked', 'are working', 'work'], answer: 'have been working' }] }));
    expect(mc.tasks[3]?.answer).toBe('Have been working');
    const gapWithEmptyOptions = ok<{ tasks: Array<{ options: unknown }> }>(s, lesson({ tasks: [...base.tasks.slice(0, 3), { ...t0, options: [] }] }));
    expect(gapWithEmptyOptions.tasks[3]?.options).toBeNull();
    bad(s, lesson({ tasks: [t0, t0, { ...t0, prompt: 'No blank here at all, sorry.' }] }));
  });

  it('Prompt: Version 2', () => {
    expect(lessonContent.build(v).split('\n')[0]).toBe('[lesson-content@2]');
  });
});

describe('lesson-production@2 (W6, Hinweis CEFR)', () => {
  const v = { taskEn: 'Write a short email', mustUse: ['agenda', 'to recap', 'action item'], structure: 'present perfect continuous', text: 'Hi team, to recap our meeting: we have been working on the agenda. Action items follow.', candoEn: 'I can...', uiLang: 'de' } as const;
  const base = {
    cefr: 'B2',
    scores: { task: 80, grammar: 70, vocabulary: 75, coherence: 80, register: 85 },
    errors: [{ wrong: 'Action items follow.', right: 'The action items are below.', why: 'Klingt natürlicher.', cat: 'wordchoice', sev: 'minor' }],
    upgrades: [],
    mustUsed: ['agenda', 'to recap', 'action item'],
    structureUsed: true,
    cando: 'partly',
    candoWhy: 'Der Text ist kurz, erfüllt aber die Aufgabe teilweise.',
    model: 'Hi team, to recap our meeting: we have been working on the new agenda all week.',
  };
  const s = lessonProduction.schema(v);

  it('Pflichtwörter ohne „to“ oder in der Mehrzahl werden zugeordnet', () => {
    expect(ok<{ mustUsed: string[] }>(s, { ...base, mustUsed: ['agenda', 'recap', 'action items'] }).mustUsed).toEqual(['agenda', 'to recap', 'action item']);
  });

  it('„B2+“ → B2; deutsche Begründung mit englischem Zitat', () => {
    expect(ok<{ cefr: string }>(s, { ...base, cefr: 'B2+' }).cefr).toBe('B2');
    ok(s, { ...base, errors: [{ ...base.errors[0], why: "Nach 'look forward to' kommt die -ing-Form: 'look forward to hearing from you'." }] });
    expect(lessonProduction.build(v).split('\n')[0]).toBe('[lesson-production@2]');
  });
});

// ---------------------------------------------------------------- Phase 3/4: Analyse, Wendungen, Anwenden

describe('drei Schichten (Hinweise)', () => {
  const v = { sentence: 'We must delay the start, the exposure is for you.', focusWords: ['exposure'], uiLang: 'de' } as const;
  const s = threeLayersSchema(v);
  const ta = (o: object = {}) => ({
    verdict: 'minor',
    english: true,
    errors: [{ wrong: 'must delay the start', right: 'have to push back the start', cat: 'vocab', why: 'Klingt natürlicher.' }],
    upgraded: 'If we push back the go-live, the exposure is yours, not ours.',
    changes: [{ from: 'must delay the start', to: 'push back the go-live', why: 'Klingt nach Planung.' }],
    lands: 'Die Bedingung mit „if“ macht das Risiko greifbar.',
    chunks: [{ en: 'push back the go-live', de: 'den Go-live verschieben', def: 'to move the launch later', kind: 'collocation', register: 'neutral', why: 'Übliche Wendung.' }],
    targets: [],
    ...o,
  });

  it('unbekannte Kategorie → other bzw. nächste bekannte; minor ohne Fehler → clean', () => {
    const e = (cat: string) => ok<{ errors: Array<{ cat: string }> }>(s, ta({ errors: [{ wrong: 'must delay the start', right: 'have to delay the start', cat, why: 'x' }] })).errors[0]?.cat;
    expect(e('grammar')).toBe('other');
    expect(e('preposition')).toBe('prepositions');
    expect(e('Word choice')).toBe('vocab');
    expect(ok<{ verdict: string }>(s, ta({ verdict: 'minor', errors: [] })).verdict).toBe('clean');
  });

  it('Wendung mit Platzhalter, Register „casual“, lange Begründung gekürzt', () => {
    ok(s, ta({ chunks: [{ en: 'push back something', de: 'etwas verschieben', def: 'to delay', kind: 'phrase', register: 'casual', why: 'x' }] }));
    const long =
      'Im Englischen drückt man Zugehörigkeit oder Verantwortung mit dem Possessivpronomen „yours“ aus; „for you“ klingt, als wäre das Risiko ein Geschenk für den Gesprächspartner, was hier nicht gemeint ist.';
    const r = ok<{ errors: Array<{ why: string }> }>(s, ta({ errors: [{ wrong: 'the exposure is for you', right: 'the exposure is yours', cat: 'vocab', why: long }] }));
    expect(Array.from(r.errors[0]!.why).length).toBeLessThanOrEqual(200);
  });
});

describe('Wendungen vergleichen (W7)', () => {
  it.each([
    ['We are not able to offer 30%.', "we're not able to"],
    ["We're not able to", 'we are not able to'],
    ["I'd suggest a pilot", 'I would suggest'],
    ["Let's circle back next week.", 'let us circle back'],
    ['We cannot go beyond 10%.', "can't go beyond"],
    ["We aren't able to go beyond 10%.", 'we are not able to'],
    ['Let us meet you halfway at 10%.', 'meet sb halfway'],
    ['I can go up to 10% if you sign today.', 'I can go up to [X]%'],
  ])('%s ⊇ %s', (text, phrase) => {
    expect(containsPhrase(text, phrase)).toBe(true);
  });

  it('Platzhalter allein oder fremde Wörter passen nicht', () => {
    expect(containsPhrase('Anything at all.', 'something')).toBe(false);
    expect(containsPhrase('We cannot sign off on this.', 'sign off in')).toBe(false);
    expect(containsPhrase('Meet the client halfway.', 'meet sb halfway through')).toBe(false);
  });
});

