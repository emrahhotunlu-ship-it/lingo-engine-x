import { describe, expect, it } from 'vitest';
import { activateCheckReply } from '../../src/platform/dev/canned/act';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { ACTIVATE_CHECK_EXAMPLE, ACTIVATE_CHECK_EXAMPLE_MINOR, activateCheck, activateCheckDeep, activateTaskVarsOf, activateTemplateFor, mailTextOf, type ActivateCheckVars } from '../../src/prompts/activateCheck';
import { errTypeOf, PRODUCE_ERR_TYPES } from '../../src/prompts/produceCheckV2';
import { TEMPLATES } from '../../src/prompts/registry';

// activate-check@1 (Wörter aktivieren, Stufe 2): mehrere Zielwörter, Vorgaben, frühere eigene Sätze, drei Schichten, reusable.

const one: ActivateCheckVars = {
  targets: [{ word: 'leverage', meaning: 'Hebelwirkung', kind: 'word', shown: true }],
  sentence: 'We use leverage in every price talk.',
  uiLang: 'de',
  task: activateTaskVarsOf({ fmt: 'sc', event: 'e01', role: 'cfo', type: '-', tone: 'f', tense: 'pf', shape: 'q' }),
};
const two: ActivateCheckVars = {
  ...one,
  targets: [
    { word: 'leverage', meaning: 'Hebelwirkung', kind: 'word', shown: true },
    { word: 'pipeline', meaning: 'Pipeline', kind: 'word', shown: true },
  ],
  sentence: 'Our leverage grows with a full pipeline.',
  task: activateTaskVarsOf({ fmt: 'kb', event: 'e05', role: 'boss', type: '-', tone: 'n', tense: 'pr', shape: '-' }),
};
const reply = (extra: Record<string, unknown>, n = 1) => ({
  verdict: 'correct',
  targets: Array.from({ length: n }, () => ({ used: true, correct: true })),
  fixed: '',
  why: 'Das Wort „leverage“ steht in der richtigen Verbindung.',
  better: '',
  whyBetter: '',
  errType: null,
  reusable: true,
  ...extra,
});

describe('activate-check@1', () => {
  it('Kopfzeile, quick, Zwischenspeicher, im Register; ersetzt produce-check@2 nicht', () => {
    const p = activateCheck.build(one);
    expect(p.split('\n')[0]).toBe('[activate-check@1]');
    expect(activateCheck.tier).toBe('quick');
    expect(activateCheck.cache).toBe(true);
    expect(TEMPLATES).toContain(activateCheck);
    expect(TEMPLATES.map((t) => `${t.id}@${t.version}`)).toContain('produce-check@2');
    expect(new Set(TEMPLATES.map((t) => `${t.id}@${t.version}`)).size).toBe(TEMPLATES.length);
  });
  it('feste Datenzeilen: Zielwörter (Hauptwort zuerst), Vorgaben, Lernenden-Text, Sprache', () => {
    const p = activateCheck.build({ ...two, source: 'We rely on leverage.', prior: ['An older sentence with leverage.'], hints: ['"explain me"'] });
    expect(p).toMatch(/^Target 1 \(main\): leverage \(word; meaning: Hebelwirkung; shown to the learner: yes\)$/m);
    expect(p).toMatch(/^Target 2: pipeline \(word; /m);
    expect(p).toMatch(/^Learner text: Our leverage grows with a full pipeline\.$/m);
    expect(p).toMatch(/^Requirements: tone: neutral \| tense: present simple \| shape: free$/m);
    expect(p).toMatch(/^Situation: .*$/m);
    expect(p).toMatch(/^Counterpart: Your boss$/m);
    expect(p).toMatch(/^Original sentence: We rely on leverage\.$/m);
    expect(p).toMatch(/^Earlier sentences by the learner/m);
    expect(p).toMatch(/^Explanation language: German$/m);
    expect(p).toContain('exactly 2 entries');
    expect(p).toContain('American English is the standard');
  });
  it('A4: das Zielwort wird als „nicht gezeigt“ ausgewiesen und der Prompt sagt, wie zu urteilen ist', () => {
    const p = activateCheck.build({ ...one, targets: [{ ...one.targets[0]!, shown: false }], task: activateTaskVarsOf({ fmt: 'lg', event: 'e03', role: 'it', type: '-', tone: 'n', tense: 'pr', shape: 's' }) });
    expect(p).toContain('shown to the learner: no');
    expect(p).toContain('NOT shown the target');
  });
  it('Kundenmail kommt in den Prompt', () => {
    const t = { fmt: 'ml' as const, event: 'm01' };
    expect(mailTextOf(t)).toContain('go-live');
    const p = activateCheck.build({ ...two, mail: mailTextOf(t), task: activateTaskVarsOf({ fmt: 'ml', event: 'm01', role: '-', type: '-', tone: 'f', tense: 'fu', shape: 'f' }) });
    expect(p).toMatch(/^Customer email: Hi, the go-live date/m);
    expect(p).toMatch(/shape: fix the problem and name a deadline/);
  });
  it('das Beispiel-JSON im Prompt besteht das Schema (für zwei Zielwörter)', () => {
    expect(activateCheck.build(two)).toContain(ACTIVATE_CHECK_EXAMPLE);
    for (const uiLang of ['de', 'en'] as const) {
      const r = activateCheck.schema({ ...two, uiLang }).safeParse(JSON.parse(ACTIVATE_CHECK_EXAMPLE));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });
  it('Größe bei Höchstwerten unter der Grenze', () => {
    const p = activateCheck.build({
      ...two,
      sentence: '😀'.repeat(5000),
      source: 'ü'.repeat(5000),
      mail: 'm'.repeat(5000),
      prior: Array(10).fill('p'.repeat(1000)),
      hints: Array(10).fill('h'.repeat(1000)),
      targets: [{ word: 'w'.repeat(1000), meaning: 'ü'.repeat(1000), kind: 'word', shown: true }, two.targets[1]!],
    });
    expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES);
    expect(p.match(/^Explanation language: /gm)).toHaveLength(1);
  });

  describe('Schema', () => {
    const s = (vars = one) => activateCheck.schema(vars);
    it('richtig: usesTarget folgt dem Hauptzielwort, reusable bleibt bei „correct“', () => {
      const r = s().safeParse(reply({}));
      expect(r.success).toBe(true);
      expect(r.data).toMatchObject({ verdict: 'correct', usesTarget: true, errType: null, reusable: true });
    });
    it('„wrong“ genau dann, wenn ein Zielwort fehlt oder falsch benutzt ist (H2)', () => {
      const missing = s(two).safeParse(reply({ verdict: 'correct', targets: [{ used: true, correct: true }, { used: false, correct: false }], fixed: 'Fixed sentence with leverage and pipeline.', errType: 'word_choice' }, 2));
      expect(missing.data?.verdict).toBe('wrong');
      expect(missing.data?.reusable).toBe(false);
      expect(missing.data?.usesTarget).toBe(true);
      const misused = s().safeParse(reply({ verdict: 'correct', targets: [{ used: true, correct: false }], fixed: 'Fixed sentence with leverage in it.' }));
      expect(misused.data?.verdict).toBe('wrong');
      // „wrong“ ohne Zielwortproblem ist ein kleiner Fehler, kein Neuversuch
      const soft = s().safeParse(reply({ verdict: 'wrong', fixed: 'We use leverage in every price talk today.', errType: 'tense' }));
      expect(soft.data?.verdict).toBe('minor');
    });
    it('Zielwort-Liste muss zur Aufgabe passen (Länge); ein einzelner Wahrheitswert wird als Wert für alle gelesen', () => {
      expect(s(two).safeParse(reply({}, 1)).success).toBe(false);
      expect(s().safeParse(reply({ targets: [{ used: 'true', correct: 'yes' }] })).success).toBe(true);
      expect(s().safeParse(reply({ targets: [true] })).success).toBe(true);
    });
    it('Fehler brauchen die Korrektur, Fehlerklasse fehlt → other, bei „correct“ nie eine Klasse', () => {
      // Leere Korrektur: erlaubt, aber als „nicht sicher geprüft“ markiert; eine Fassung mit eindeutigem Fehler besteht nicht (Auswertung 15.10.2026).
      expect(s().parse(reply({ verdict: 'minor', fixed: '' }))).toMatchObject({ fixed: '', fixedUnsure: true });
      expect(s().safeParse(reply({ verdict: 'minor', fixed: 'We discussed about the price.' })).success).toBe(false);
      const r = s().safeParse(reply({ verdict: 'minor', fixed: 'We use leverage in every price talk.', errType: undefined, reusable: true }));
      expect(r.data?.errType).toBe('other');
      expect(r.data?.reusable).toBe(false);
      expect(s().safeParse(reply({ errType: 'tense' })).data?.errType).toBeNull();
    });
    it('drei Schichten: C1-Fassung braucht Begründung, behält alle Zielwörter und ist kurz', () => {
      expect(s().safeParse(reply({ better: 'We use leverage in every price talk.', whyBetter: '' })).success).toBe(false);
      expect(s().safeParse(reply({ better: '', whyBetter: 'Weil es genauer ist.' })).success).toBe(false);
      expect(s().safeParse(reply({ better: 'We apply pressure in every talk.', whyBetter: 'Genauer und natürlicher.' })).success).toBe(false);
      expect(s().safeParse(reply({ better: 'We use leverage in every price talk.', whyBetter: 'Genauer und natürlicher.' })).success).toBe(true);
      expect(s(two).safeParse(reply({ better: 'We use leverage in every price talk.', whyBetter: 'Genauer und natürlicher.' }, 2)).success).toBe(false);
      const long = `We use leverage ${'really '.repeat(60)}in every price talk.`;
      expect(s().safeParse(reply({ better: long, whyBetter: 'Genauer.' })).success).toBe(false);
    });
    it('Sprachtreue: die Begründung steht in der Oberflächensprache', () => {
      const en = reply({ why: 'You used the target word in the right collocation and the register fits the situation.' });
      expect(s({ ...one, uiLang: 'de' }).safeParse(en).success).toBe(false);
      expect(s({ ...one, uiLang: 'en' }).safeParse(en).success).toBe(true);
    });
    it('Fehlerklassen: alle bekannten Werte inkl. word_choice, tolerante Schreibweisen', () => {
      expect(PRODUCE_ERR_TYPES).toContain('word_choice');
      for (const t of PRODUCE_ERR_TYPES) expect(s().safeParse(reply({ verdict: 'minor', fixed: 'We use leverage in every price talk.', errType: t })).data?.errType).toBe(t);
      expect(errTypeOf('Word choice')).toBe('word_choice');
      expect(errTypeOf('lexical')).toBe('word_choice');
    });
  });

  describe('Testantworten des Entwicklungs-Adapters', () => {
    it('bestehen das Schema (DE und EN, richtig/kleiner Fehler/fehlt, ein und zwei Zielwörter)', () => {
      for (const uiLang of ['de', 'en'] as const) {
        for (const vars of [one, two]) {
          for (const sentence of ['Our leverage grows with a full pipeline.', 'our leverage grows with a full pipeline', 'We always check the numbers.']) {
            const v = { ...vars, uiLang, sentence };
            const r = activateCheck.schema(v).safeParse(JSON.parse(activateCheckReply(activateCheck.build(v))));
            expect(r.success, `${uiLang} ${sentence}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
          }
        }
      }
    });
    it('zzqx: erste Antwort schemawidrig, der Neuversuch gültig; zzjson: kein JSON', () => {
      const v = { ...one, sentence: 'A zzqx sentence about leverage.' };
      const prompt = activateCheck.build(v);
      expect(activateCheck.schema(v).safeParse(JSON.parse(activateCheckReply(prompt))).success).toBe(false);
      const retry = `${prompt}\n\nYour previous reply did not match the required format:\n- verdict: bad`;
      expect(activateCheck.schema(v).safeParse(JSON.parse(activateCheckReply(retry))).success).toBe(true);
      expect(() => JSON.parse(activateCheckReply(activateCheck.build({ ...one, sentence: 'zzjson leverage' }))) as unknown).toThrow();
    });
  });
});

describe('activate-check: Prüfung 14.10.2026', () => {
  const hidden: ActivateCheckVars = { ...one, targets: [{ ...one.targets[0]!, shown: false }], task: activateTaskVarsOf({ fmt: 'lg', event: 'e03', role: 'it', type: '-', tone: 'n', tense: 'pr', shape: 's' }) };
  it('beide Beispiele (richtig und kleiner Fehler) stehen im Prompt und bestehen das Schema; kein Beispiel hält sich an „minor/tense“ fest', () => {
    const p = activateCheck.build(two);
    expect(p).toContain(ACTIVATE_CHECK_EXAMPLE);
    expect(p).toContain(ACTIVATE_CHECK_EXAMPLE_MINOR);
    for (const ex of [ACTIVATE_CHECK_EXAMPLE, ACTIVATE_CHECK_EXAMPLE_MINOR]) expect(activateCheck.schema(two).safeParse(JSON.parse(ex)).success, ex).toBe(true);
    expect((JSON.parse(ACTIVATE_CHECK_EXAMPLE) as { verdict: string }).verdict).toBe('correct');
  });
  it('Regeln: falscher Partner der Kollokation, Deutsch-Fehler-Liste, Tippfehler, schlechte Lage, Antwortziel der Mail', () => {
    const p = activateCheck.build(two);
    expect(p).toContain('wrong collocation partner');
    expect(p).toContain('until vs. by');
    expect(p).toContain('adress, developement');
    expect(p).toContain('poor fit for the target');
    const mail = activateCheck.build({ ...two, mail: 'Hi, can we talk?', task: activateTaskVarsOf({ fmt: 'ml', event: 'm01', role: '-', type: '-', tone: 'f', tense: '-', shape: 'q' }) });
    expect(mail).toContain('does not fit the customer email');
    expect(mail).toContain('ask a clarifying question');
  });
  it('mainVerdict: Fehler nur am Partnerwort senkt das Urteil über das Hauptwort nicht; fehlt es, gilt das Gesamturteil', () => {
    const partner = activateCheck.schema(two).safeParse(reply({ verdict: 'wrong', mainVerdict: 'correct', targets: [{ used: true, correct: true }, { used: true, correct: false }], fixed: 'Our leverage grows with a full pipeline.', errType: 'word_choice' }, 2));
    expect(partner.data).toMatchObject({ verdict: 'wrong', mainVerdict: 'correct' });
    const noField = activateCheck.schema(two).safeParse(reply({ verdict: 'wrong', targets: [{ used: true, correct: true }, { used: true, correct: false }], fixed: 'Our leverage grows with a full pipeline.', errType: 'word_choice' }, 2));
    expect(noField.data?.mainVerdict).toBe('minor');
    const mainBad = activateCheck.schema(two).safeParse(reply({ verdict: 'correct', mainVerdict: 'correct', targets: [{ used: true, correct: false }, { used: true, correct: true }], fixed: 'Our leverage grows with a full pipeline.' }, 2));
    expect(mainBad.data?.mainVerdict).toBe('wrong');
  });
  it('A4: alt (richtiges Ersatzwort) macht aus „wrong“ einen Teilerfolg; ohne verdecktes Wort wird alt verworfen', () => {
    const miss = reply({ verdict: 'wrong', targets: [{ used: false, correct: false }], alt: 'push back', fixed: 'We will postpone the launch by two weeks.', errType: 'word_choice' });
    const r = activateCheck.schema(hidden).safeParse(miss);
    expect(r.data).toMatchObject({ verdict: 'minor', mainVerdict: 'minor', alt: 'push back', errType: 'word_choice', usesTarget: false });
    // Wort war gezeigt: alt zählt nicht
    expect(activateCheck.schema(one).safeParse(miss).data).toMatchObject({ verdict: 'wrong', alt: '' });
    // Hauptwort benutzt: alt ist bedeutungslos
    expect(activateCheck.schema(hidden).safeParse(reply({ alt: 'push back' })).data?.alt).toBe('');
  });
  it('Stufe je Aufgabe: Kundenmail und Kombi-Satz laufen auf default, die kurzen Aufgaben auf quick (gleiche Kennung)', () => {
    expect(activateCheck.tier).toBe('quick');
    expect(activateCheckDeep.tier).toBe('default');
    expect(activateTemplateFor('ml')).toBe(activateCheckDeep);
    expect(activateTemplateFor('kb')).toBe(activateCheckDeep);
    expect(activateTemplateFor('sc')).toBe(activateCheck);
    expect(activateTemplateFor('im')).toBe(activateCheck);
    expect(activateCheckDeep.id).toBe(activateCheck.id);
    expect(activateCheckDeep.version).toBe(activateCheck.version);
    expect(TEMPLATES.filter((t) => t.id === 'activate-check')).toHaveLength(1);
  });
  it('Antwortziel q heißt „ask a clarifying question“ (nur bei der Kundenmail)', () => {
    expect(activateTaskVarsOf({ fmt: 'ml', event: 'm02', role: '-', type: '-', tone: 'f', tense: '-', shape: 'q' }).shape).toBe('ask a clarifying question');
    expect(activateTaskVarsOf({ fmt: 'sc', event: 'e01', role: 'cfo', type: '-', tone: 'f', tense: 'pf', shape: 'q' }).shape).toBe('question');
  });
  it('Dev-Adapter liefert bei „correct“ und „minor“ die zweite und dritte Schicht', () => {
    for (const sentence of ['Our leverage grows with a full pipeline.', 'our leverage grows with a full pipeline']) {
      const v = { ...two, sentence };
      const out = activateCheck.schema(v).safeParse(JSON.parse(activateCheckReply(activateCheck.build(v))));
      expect(out.success, JSON.stringify(out.error?.issues)).toBe(true);
      expect(out.data?.better).toContain('leverage');
      expect(out.data?.whyBetter.length).toBeGreaterThan(5);
    }
  });
});
