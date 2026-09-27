import { describe, expect, it } from 'vitest';
import { roleplayReportReply, roleplayTurnReply, sceneGenReply, turnAnalysisReply } from '../../src/platform/dev/cannedSpeak';
import { templateIdOf } from '../../src/platform/dev/cannedReplies';
import { PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { CHAT_TEMPLATES, TEMPLATES, TEMPLATE_ID } from '../../src/prompts/registry';
import { reportExample, reportSchema, roleplayReport, type RoleplayReportVars } from '../../src/prompts/roleplayReport';
import { cleanFigureText, FIGURE_TIER, roleplayTurn, RP_HISTORY_MAX, type RoleplayTurnVars } from '../../src/prompts/roleplayTurn';
import { SCENE_GEN_EXAMPLE, sceneGen, sceneGenSchema } from '../../src/prompts/sceneGen';
import { ERROR_CATS, EXAMPLE_SENTENCE, threeLayersExample, threeLayersSchema } from '../../src/prompts/threeLayers';
import { turnAnalysis, type TurnAnalysisVars } from '../../src/prompts/turnAnalysis';
import type { Turn } from '../../src/domain/speak/types';
import { turnsBytes } from '../../src/ai/stream';

// Sprech-Vorlagen (Plan §6.2, §9.1): Kopfzeile, Beispiel besteht das Schema, Verfeinerungen 1–8
// je positiv und negativ, Sprachtreue, Zugliste, Kürzung, Größe, „never correct“.

const persona = { name: 'Reinhard Vogt', role: 'CFO', org: 'a mid-sized industrial manufacturer', traits: 'Blunt.' };
const turns = (n: number): Turn[] => [
  { role: 'persona', text: 'Convince me otherwise.', t: 0 },
  ...Array.from({ length: n }, (_, i): Turn[] => [
    { role: 'me', text: `My answer number ${i + 1}.`, t: i * 2 + 1 },
    { role: 'persona', text: `Your reply ${i + 1}?`, t: i * 2 + 2 },
  ]).flat(),
  { role: 'me', text: 'The exposure here is the penalty.', t: 999 },
];
const rpVars = (n = 2): RoleplayTurnVars => ({ title: 'Holding the Q2 date', situation: 'Your client wants to delay.', goal: 'Keep Q2.', persona, stake: 'Budget.', objection: 'Risk is theoretical.', ctx: 'DMS sales', focusWords: ['exposure'], turns: turns(n) });

const base = {
  verdict: 'clean',
  english: true,
  errors: [] as unknown[],
  upgraded: 'If we push back the go-live, the exposure is yours, not ours.',
  changes: [] as unknown[],
  lands: 'Die Bedingung macht das Risiko für ihn greifbar.',
  chunks: [{ en: 'push back the go-live', de: 'den Go-live verschieben', def: 'to move the launch to a later date', kind: 'collocation', register: 'neutral', why: 'Übliche Wendung für Verschiebungen im Projekt.' }] as unknown[],
  targets: [] as string[],
};
const layers = (sentence = 'We must delay the start.', focus: string[] = ['exposure'], uiLang: 'de' | 'en' = 'de') => threeLayersSchema({ sentence, focusWords: focus, uiLang });
const err = (wrong: string, right: string, cat = 'vocab') => ({ wrong, right, cat, why: 'Kurzer Grund auf Deutsch.' });

describe('Verzeichnis', () => {
  it('alle Vorlagen mit eindeutiger Kennung; Gesprächsvorlage getrennt', () => {
    const ids = [...TEMPLATES.map((t) => t.id), ...CHAT_TEMPLATES.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['turn-analysis', 'roleplay-report', 'scene-gen', 'mail-refine', 'phrase-adapt', 'pitch-script', 'pitch-feedback', 'roleplay-turn']) expect(ids).toContain(id);
    for (const id of ids) expect(id).toMatch(TEMPLATE_ID);
  });
});

describe('roleplay-turn@1', () => {
  it('Zugliste beginnt und endet mit user, erster Zug mit Kopfzeile, Stufe quick (D1), nie zwischengespeichert', () => {
    const t = roleplayTurn.buildTurns(rpVars());
    expect(t[0]!.role).toBe('user');
    expect(t[t.length - 1]!.role).toBe('user');
    expect(t[0]!.content.split('\n')[0]).toBe('[roleplay-turn@1]');
    expect(templateIdOf([...t])).toBe('roleplay-turn');
    expect(roleplayTurn.tier).toBe('quick');
    expect(FIGURE_TIER).toBe('quick');
    expect(roleplayTurn.cache).toBe(false);
    expect(t[1]).toEqual({ role: 'assistant', content: 'Convince me otherwise.' });
  });

  it('„never correct“ und Englisch-Bitte stehen in den Regeln', () => {
    const rules = roleplayTurn.buildTurns(rpVars())[0]!.content;
    expect(rules).toMatch(/Never correct/);
    expect(rules).toMatch(/continue in English/);
    expect(rules).toMatch(/American English/);
  });

  it('40 Züge werden auf ≤ 16 gekürzt (plus Anweisung), Größe unter der Grenze', () => {
    const t = roleplayTurn.buildTurns(rpVars(40));
    expect(t.length).toBeLessThanOrEqual(RP_HISTORY_MAX + 1);
    expect(t[t.length - 1]!.content).toBe('The exposure here is the penalty.');
    const huge = rpVars(40);
    huge.turns = huge.turns.map((x) => ({ ...x, text: 'long '.repeat(400) }));
    expect(turnsBytes(roleplayTurn.buildTurns(huge))).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('clean: Namenspräfix, Regieanweisungen, Markdown, Anführungszeichen – idempotent', () => {
    expect(cleanFigureText('Reinhard Vogt: *leans back* **Fine.** Convince me.')).toBe('Fine. Convince me.');
    expect(cleanFigureText('"Let me be direct."')).toBe('Let me be direct.');
    expect(cleanFigureText('Dr. Martin Kessler (Enterprise Architect): Walk me through that.')).toBe('Walk me through that.');
    expect(cleanFigureText('(sighs) Numbers, please.')).toBe('Numbers, please.');
    expect(cleanFigureText('Look: this is not theoretical.')).toBe('Look: this is not theoretical.');
    const once = cleanFigureText('Reinhard Vogt: [pauses] "Well."');
    expect(cleanFigureText(once)).toBe(once);
  });

  it('feste Antwort des Adapters ist Text und bittet bei Deutsch um Englisch', () => {
    const t = roleplayTurn.buildTurns(rpVars(1));
    const joined = t.map((x) => x.content).join('\n\n');
    expect(roleplayTurnReply(joined)).toMatch(/\?$/);
    const de = [...t.slice(0, -1), { role: 'user' as const, content: 'Ich denke das ist nicht so wichtig und wir sind flexibel.' }];
    expect(roleplayTurnReply(de.map((x) => x.content).join('\n\n'))).toMatch(/English/);
  });
});

describe('drei Schichten (Verfeinerungen 1–8)', () => {
  it('Beispiel besteht das Schema (DE und EN)', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const r = threeLayersSchema({ sentence: EXAMPLE_SENTENCE, focusWords: [], uiLang }).safeParse(JSON.parse(threeLayersExample(uiLang)));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });

  it('1: clean ⇔ keine Fehler; nicht Englisch → errors leer und verdict errors', () => {
    expect(layers().safeParse(base).success).toBe(true);
    expect(layers().safeParse({ ...base, verdict: 'minor' }).success).toBe(false);
    expect(layers().safeParse({ ...base, verdict: 'clean', errors: [err('must delay', 'need to push back')] }).success).toBe(false);
    expect(layers().safeParse({ ...base, english: false, verdict: 'errors' }).success).toBe(true);
    expect(layers().safeParse({ ...base, english: false, verdict: 'clean' }).success).toBe(false);
    expect(layers().safeParse({ ...base, english: false, verdict: 'errors', errors: [err('must delay', 'need to push back')] }).success).toBe(false);
  });

  it('2: der Fehler steht wörtlich im eigenen Satz', () => {
    expect(layers().safeParse({ ...base, verdict: 'errors', errors: [err('must delay', 'need to push back')] }).success).toBe(true);
    expect(layers().safeParse({ ...base, verdict: 'errors', errors: [err('should postpone', 'need to push back')] }).success).toBe(false);
  });

  it('3: Kategorie aus den 16 Themen oder der Zusatzliste', () => {
    expect(ERROR_CATS).toHaveLength(22);
    expect(layers().safeParse({ ...base, verdict: 'errors', errors: [err('must delay', 'need to push back', 'modals-deduction')] }).success).toBe(true);
    expect(layers().safeParse({ ...base, verdict: 'errors', errors: [err('must delay', 'need to push back', 'tenses')] }).success).toBe(false);
  });

  it('4: britische Schreibweise ist kein Fehler', () => {
    const s = layers('We need to prioritise the colour scheme.');
    expect(s.safeParse({ ...base, verdict: 'minor', errors: [err('prioritise', 'prioritize', 'spelling')] }).success).toBe(false);
    expect(s.safeParse({ ...base, verdict: 'minor', errors: [err('colour', 'color', 'spelling')] }).success).toBe(false);
  });

  it('5: Wendungen stehen im aufgewerteten Satz, 1–8 Wörter, höchstens 3', () => {
    const chunk = (en: string) => ({ en, de: 'x', def: 'a short definition', kind: 'phrase', register: 'neutral', why: 'Kurzer Grund auf Deutsch.' });
    expect(layers().safeParse({ ...base, chunks: [chunk('sign off on')] }).success).toBe(false);
    expect(layers().safeParse({ ...base, chunks: [chunk('the exposure is yours')] }).success).toBe(true);
    expect(layers().safeParse({ ...base, chunks: [chunk('If we push back the go-live, the exposure is yours')] }).success).toBe(false);
    expect(layers().safeParse({ ...base, chunks: [chunk('we'), chunk('push back'), chunk('the go-live'), chunk('exposure')] }).success).toBe(false);
  });

  it('6: Englisch-Felder nicht deutsch, Erklärfelder in der Oberflächensprache', () => {
    expect(layers().safeParse({ ...base, upgraded: 'Wir müssen den Start leider verschieben, das ist nicht gut.' }).success).toBe(false);
    expect(layers().safeParse({ ...base, lands: 'The condition makes the risk concrete for him and his team.' }).success).toBe(false);
    expect(layers('We must delay the start.', [], 'en').safeParse({ ...base, lands: 'The condition makes the risk concrete for him.', chunks: [] }).success).toBe(true);
  });

  it('7: Längen – lands 1–160, upgraded ≤ 400', () => {
    expect(layers().safeParse({ ...base, lands: '' }).success).toBe(false);
    expect(layers().safeParse({ ...base, lands: 'x'.repeat(161) }).success).toBe(false);
    expect(layers().safeParse({ ...base, upgraded: 'word '.repeat(90), chunks: [] }).success).toBe(false);
  });

  it('8: targets nur aus den übergebenen Fokuswörtern', () => {
    expect(layers().safeParse({ ...base, targets: ['exposure'] }).success).toBe(true);
    expect(layers().safeParse({ ...base, targets: ['leverage'] }).success).toBe(false);
  });
});

describe('turn-analysis@1', () => {
  const vars = (sentence: string, uiLang: 'de' | 'en' = 'de'): TurnAnalysisVars => ({ goal: 'Keep Q2.', role: 'Reinhard Vogt, CFO', personaLine: 'Convince me otherwise.', history: [], sentence, focusWords: ['exposure'], uiLang });

  it('Kopfzeile, complex, zwischengespeichert, Größe unter der Grenze', () => {
    const p = turnAnalysis.build(vars('We must delay the start.'));
    expect(p.split('\n')[0]).toBe('[turn-analysis@1]');
    expect(turnAnalysis.tier).toBe('complex');
    expect(turnAnalysis.cache).toBe(true);
    const big = turnAnalysis.build({ ...vars('x '.repeat(5000)), history: [{ persona: 'p '.repeat(3000), me: 'm '.repeat(3000) }], personaLine: 'l '.repeat(3000) });
    expect(promptBytes(big)).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('feste Antworten bestehen das Schema: sauber, Kleinigkeit, Fehler, nicht Englisch (DE und EN)', () => {
    for (const uiLang of ['de', 'en'] as const) {
      for (const [sentence, verdict] of [
        ['That depends on your test team and the exposure.', 'clean'],
        ['I think the budget is not the problem.', 'minor'],
        ['We must delay the start.', 'errors'],
        ['zzde Wir müssen verschieben.', 'errors'],
      ] as const) {
        const v = vars(sentence, uiLang);
        const reply = JSON.parse(turnAnalysisReply(turnAnalysis.build(v))) as { verdict: string };
        const r = turnAnalysis.schema(v).safeParse(reply);
        expect(r.success, `${uiLang} ${sentence}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
        expect(reply.verdict).toBe(verdict);
      }
    }
  });

  it('Sonderwörter: zzqx zuerst schemawidrig, zzjson kein JSON', () => {
    const v = vars('zzqx we test');
    expect(turnAnalysis.schema(v).safeParse(JSON.parse(turnAnalysisReply(turnAnalysis.build(v)))).success).toBe(false);
    expect(() => void JSON.parse(turnAnalysisReply(turnAnalysis.build(vars('zzjson'))))).toThrow();
  });
});

describe('roleplay-report@1', () => {
  const vars = (uiLang: 'de' | 'en'): RoleplayReportVars => ({
    title: 'Holding the Q2 date',
    goal: 'Keep Q2.',
    role: 'Reinhard Vogt, CFO',
    turns: [
      { me: 'The exposure here is the penalty, not the budget.', persona: 'Convince me.', v: 'clean', c: [] },
      { me: 'We must delay the start.', persona: 'Why?', v: 'errors', c: ['modals-deduction'] },
      { me: 'I think the budget is fine.', persona: 'Numbers?', v: 'minor', c: ['register'] },
      { me: 'That hinges on your test plan.', persona: 'And?', v: 'clean', c: [] },
    ],
    taken: ['push back the go-live'],
    uiLang,
  });

  it('Kopfzeile, default, Beispiel und feste Antwort bestehen das Schema (DE und EN)', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const p = roleplayReport.build(vars(uiLang));
      expect(p.split('\n')[0]).toBe('[roleplay-report@1]');
      const r = reportSchema(vars(uiLang)).safeParse(JSON.parse(roleplayReportReply(p)));
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
      const withQuotes = { ...vars(uiLang), turns: [...vars(uiLang).turns, { me: 'the exposure here is the penalty', persona: '', v: 'clean', c: [] }, { me: 'we must delay the start', persona: '', v: 'errors', c: [] }] };
      expect(reportSchema(withQuotes).safeParse(JSON.parse(reportExample(uiLang))).success).toBe(true);
    }
    expect(roleplayReport.tier).toBe('complex');
  });

  it('Zitate müssen aus eigenen Zügen stammen; Beispielsatz enthält die Wendung; Sprachtreue', () => {
    const s = reportSchema(vars('de'));
    const ok = JSON.parse(roleplayReportReply(roleplayReport.build(vars('de')))) as Record<string, unknown>;
    expect(s.safeParse({ ...ok, strengths: [{ quote: 'something I never said', why: 'Gut gemacht, klarer Einstieg.' }] }).success).toBe(false);
    expect(s.safeParse({ ...ok, phrases: [{ en: 'that hinges on', de: 'x', def: 'depends on', ex: 'It depends on the plan.' }] }).success).toBe(false);
    expect(s.safeParse({ ...ok, summary: 'You stayed calm and gave good reasons for the date.' }).success).toBe(false);
  });
});

describe('scene-gen@1', () => {
  it('Kopfzeile, default, nie zwischengespeichert; Beispiel und feste Antwort bestehen das Schema', () => {
    const p = sceneGen.build({ ctx: 'DMS sales', level: 'C1', wish: 'budget talk', grammar: 'Conditionals', words: ['leverage'], existingTitles: ['A'] });
    expect(p.split('\n')[0]).toBe('[scene-gen@1]');
    expect(sceneGen.cache).toBe(false);
    expect(sceneGenSchema.safeParse(JSON.parse(SCENE_GEN_EXAMPLE)).success).toBe(true);
    expect(sceneGenSchema.safeParse(JSON.parse(sceneGenReply(p))).success).toBe(true);
  });

  it('*_de deutsch, sonst englisch; Eröffnung 1–3 Sätze; Name nicht leer', () => {
    const ok = JSON.parse(SCENE_GEN_EXAMPLE) as Record<string, unknown>;
    expect(sceneGenSchema.safeParse({ ...ok, title_de: 'Renegotiating the support contract with the reseller' }).success).toBe(false);
    expect(sceneGenSchema.safeParse({ ...ok, goal: 'Die Gebühr halten und nicht nachgeben, das ist wichtig.' }).success).toBe(false);
    expect(sceneGenSchema.safeParse({ ...ok, opening: 'One. Two. Three. Four sentences here.' }).success).toBe(false);
    expect(sceneGenSchema.safeParse({ ...ok, persona: { ...(ok.persona as object), name: '' } }).success).toBe(false);
  });
});
