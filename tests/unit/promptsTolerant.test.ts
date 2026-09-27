/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call -- Testdaten: freie, realistische KI-Antworten werden gezielt verändert (JSON ohne festen Typ). */
import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/domain/content';
import { listeningText, hasSpeakerLabels, type ListeningTextVars } from '../../src/prompts/listeningText';
import { mailRefine, MAIL_OPTION_MAX } from '../../src/prompts/mailRefine';
import { pitchFeedback, pitchFeedbackExample } from '../../src/prompts/pitchFeedback';
import { pitchScript, PITCH_SCRIPT_EXAMPLE } from '../../src/prompts/pitchScript';
import { importSchema, IMPORT_EXAMPLE } from '../../src/prompts/preplyImport';
import { prepSchema, PREP_EXAMPLE } from '../../src/prompts/preplyPrep';
import { readingCheck, READING_CHECK_EXAMPLE } from '../../src/prompts/readingCheck';
import { readingText, type ReadingTextVars } from '../../src/prompts/readingText';
import { reportExample, reportSchema } from '../../src/prompts/roleplayReport';
import { cleanFigureText } from '../../src/prompts/roleplayTurn';
import { SCENE_GEN_EXAMPLE, sceneGenSchema } from '../../src/prompts/sceneGen';
import { countSentences, cut, firstCefr, inputCat } from '../../src/prompts/tolerant';
import { weeklyExample, weeklySchema } from '../../src/prompts/weeklyReport';
import { writingPrompt, WRITING_PROMPT_EXAMPLE, type WritingPromptVars } from '../../src/prompts/writingPrompt';
import { writingReview, WRITING_REVIEW_EXAMPLE, type WritingReviewVars } from '../../src/prompts/writingReview';

// Realistische Modellantworten, an denen die Vorlagen bisher scheiterten (Prüfbefunde W3–W8 und
// Hinweise): Sie werden jetzt normalisiert statt abgelehnt – und das Ergebnis ist geprüft.

type J = Record<string, any>;
const clone = (o: unknown): J => JSON.parse(typeof o === 'string' ? o : JSON.stringify(o)) as J;
const issues = (r: { success: boolean; error?: { issues: unknown[] } }) => (r.success ? [] : (r.error?.issues ?? []));

describe('tolerante Bausteine', () => {
  it('cut, firstCefr, inputCat, countSentences', () => {
    expect(cut('abcdef', 4)).toBe('abc…');
    expect(firstCefr('B2 (B2+ in places)', ['B2', 'B2+'])).toBe('B2');
    expect(firstCefr('B2-C1', ['B2', 'C1'])).toBe('B2');
    expect(firstCefr('b2/c1', ['B2', 'C1'])).toBe('B2');
    expect(firstCefr('C1+', ['B2', 'C1'])).toBe('C1');
    expect(firstCefr('Z9', ['B2'])).toBe('Z9');
    expect(inputCat('prepositions')).toBe('grammar');
    expect(inputCat('Tense')).toBe('grammar');
    expect(inputCat('agreement')).toBe('grammar');
    expect(inputCat('word choice')).toBe('vocabulary');
    expect(inputCat('style')).toBe('register');
    expect(inputCat('something new')).toBe('other');
    expect(countSentences('Thanks for coming in, Mr. Keller. I will be direct. Our budget is 2.5 million, and your offer is above it.')).toBe(3);
    expect(countSentences('One. Two. Three. Four sentences here.')).toBe(4);
    expect(countSentences('No full stop at the end')).toBe(1);
  });
});

const TOPIC_IDS = TOPICS.map((t) => t.id);

describe('W3 writing-review@2 und reading-check@2', () => {
  const text = 'Dear Ms. Walker, we are working on the migration since March and the results are not so good like we expected, because the vendor delivered the scanners too late and our team was not enough trained.';
  for (const uiLang of ['de', 'en'] as const) {
    const v: WritingReviewVars = { title_en: 't', task_en: 'x', genre: 'email', level: 'B2+', words: [80, 130], focus_en: 'f', useful: ['a'], text, uiLang, topics: TOPIC_IDS };
    const w = uiLang === 'de' ? 'Seit März läuft die Handlung noch an.' : 'The action started in March and continues.';
    const base = () => {
      const ex = clone(WRITING_REVIEW_EXAMPLE);
      Object.assign(ex, { summary: w, strengths: [w], upgrades: ['to fall short of expectations'], phrases: ['the vendor delivered'], next: w });
      ex.errors[0].why = w;
      return ex;
    };

    it(`writing-review ${uiLang}: lange Stelle, fehlendes Thema, freie Kategorie, „moderate", keine Stärken, Stufe mit Zusatz, Zahl als Text`, () => {
      const r = base();
      r.errors[0].orig = 'we are working on the migration since March and the results are not so good like we expected, because the vendor delivered';
      delete r.errors[0].topic;
      r.errors[0].cat = 'prepositions';
      r.errors[0].sev = 'moderate';
      r.errors.push({ ...r.errors[0], cat: 'tense', sev: 'serious', topic: 'pres-perf-cont' });
      r.strengths = [];
      r.cefr = 'B2 (B2+ in places)';
      r.scores.task = '4';
      r.scores.grammar = 3.5;
      const res = writingReview.schema(v).safeParse(r);
      expect(issues(res)).toEqual([]);
      const o = res.data!;
      expect(o.errors[0]).toMatchObject({ orig: r.errors[0].orig, cat: 'grammar', topic: null, sev: 'minor' });
      expect(o.errors[1]).toMatchObject({ cat: 'grammar', topic: 'pres-perf-cont', sev: 'major' });
      expect(o.strengths).toEqual([]);
      expect(o.cefr).toBe('B2');
      expect(o.scores).toMatchObject({ task: 4, grammar: 4 });
    });

    it(`writing-review ${uiLang}: unbekanntes Thema → null, überlange Stelle gekürzt; Unbrauchbares bleibt abgelehnt`, () => {
      const r = base();
      r.errors[0].topic = 'present perfect';
      r.errors[0].orig = 'x '.repeat(200);
      const o = writingReview.schema(v).parse(r);
      expect(o.errors[0]!.topic).toBeNull();
      expect(Array.from(o.errors[0]!.orig).length).toBeLessThanOrEqual(300);
      expect(writingReview.schema(v).safeParse({ ...base(), cefr: 'excellent' }).success).toBe(false);
      expect(writingReview.schema(v).safeParse({ ...base(), scores: { ...base().scores, task: 'n/a' } }).success).toBe(false);
    });

    it(`reading-check ${uiLang}: agreement/tense, lange Stelle, Zahl als Text, „B2-C1", langer Punkt`, () => {
      const cv = { title: 't', text: 'x', keypoints: ['a'], summary: 's', uiLang };
      const ex = clone(READING_CHECK_EXAMPLE);
      ex.language.errors[0].why = uiLang === 'de' ? 'Nach „customers“ (Plural) steht „stay“ ohne s.' : 'After plural "customers" use "stay".';
      ex.language.tips = [uiLang === 'de' ? 'Achte auf die Kongruenz.' : 'Watch agreement.'];
      ex.feedback = uiLang === 'de' ? 'Gute Zusammenfassung mit den wichtigsten Punkten.' : 'A good summary.';
      ex.language.errors[0].cat = 'agreement';
      ex.language.errors.push({ ...ex.language.errors[0], cat: 'tense', orig: 'In the text the author says that customers who stays longer are cheaper than new customers because onboarding costs a lot of money.' });
      ex.score = '4';
      ex.language.cefr = 'B2-C1';
      ex.covered = ['Retention is cheaper than acquisition, because onboarding new customers costs sales and marketing time and the churn rate matters for subscription businesses a lot more than people think'];
      const res = readingCheck.schema(cv).safeParse(ex);
      expect(issues(res)).toEqual([]);
      expect(res.data!.score).toBe(4);
      expect(res.data!.language.cefr).toBe('B2');
      expect(res.data!.language.errors.map((e) => e.cat)).toEqual(['grammar', 'grammar']);
      expect(readingCheck.schema(cv).parse({ ...ex, score: 3.5 }).score).toBe(4);
    });
  }
});

describe('W4 listening-text@2', () => {
  const v: ListeningTextVars = { level: 'B2+', domain: 'work', genre: 'announcement', avoid: [], context: 'x' };
  const body =
    'Good morning everyone, this is a quick update from the operations team about the office move next week. We know many of you have questions, so here is what you need to know before Friday. The new office on Main Street will open on Monday at eight thirty. Please pack your desks by Thursday evening and label every box with your name and team. The movers will arrive early on Friday, so nobody needs to come in that day. Your laptops stay with you over the weekend. If you use a second monitor, leave it on your desk and the IT team will set it up for you. Parking will be tight during the first week, so we recommend taking the train or sharing a ride. Coffee and breakfast are on us on Monday morning. If anything is unclear, send a message to the facilities team and we will get back to you the same day. Thanks for your patience, and see you in the new space.';
  const q = (type: string) => ({ q: 'What is the main purpose of the message?', options: ['To announce the move details', 'To cancel the move', 'To hire movers', 'To sell desks'], answer: 'To announce the move details', type, explain_de: 'Die Sprecherin erklärt die Details des Umzugs.', explain_en: 'The speaker explains the details of the move.' });
  const vocab = ['movers', 'label', 'tight', 'facilities', 'patience'].map((w) => ({ w, de: 'x', def: 'short definition' }));
  const base = () => clone({ title: 'Office Move Update', genre: 'announcement', topic_de: 'Büroumzug', topic_en: 'Office move', text: body, questions: [q('gist'), q('detail'), q('detail'), q('inference')], vocab });
  const s = listeningText.schema(v);

  it('Ansagen mit Doppelpunkt und Uhrzeiten sind keine Sprecherzeilen', () => {
    for (const text of ['Attention all staff: ' + body, body.replace('Please pack', 'Here is the plan:\n\nPlease pack'), body.replace('at eight thirty', 'at 8:30'), body.replace('Please pack', '\n\nAt 8:30 on Monday'), 'Quick update: ' + body]) {
      expect(issues(s.safeParse({ ...base(), text })), text.slice(0, 30)).toEqual([]);
    }
  });

  it('echte Sprecherzeilen bleiben abgelehnt', () => {
    expect(hasSpeakerLabels(`Maria: ${body}`)).toBe(true);
    expect(hasSpeakerLabels(`Tom Baker: Hi there, quick question.\nAnna: Sure, go ahead.`)).toBe(true);
    expect(s.safeParse({ ...base(), text: `Maria: ${body}` }).success).toBe(false);
  });

  it('Gattung groß geschrieben oder unbekannt → bestellte Gattung; sechs Wörter → fünf', () => {
    const o = s.parse({ ...base(), genre: 'Announcement', vocab: [...vocab, { w: 'ride', de: 'x', def: 'short def' }] });
    expect(o.genre).toBe('announcement');
    expect(o.vocab).toHaveLength(5);
    expect(s.parse({ ...base(), genre: 'memo' }).genre).toBe('announcement');
  });
});

describe('W5 preply-import@2', () => {
  const vars = { uiLang: 'de' as const, topics: TOPICS.map((t) => ({ id: t.id, name: t.name_en ?? t.name })) };
  const s = importSchema(vars);

  it('Optionen bei Nicht-mc still geleert, mc-Antwort ohne Groß/klein, Typ-Synonym', () => {
    const r = clone(IMPORT_EXAMPLE);
    r.tasks[0].options = ['on', 'of', 'in'];
    r.tasks.push({ type: 'mc', prompt: 'It depends ___ the budget.', answer: 'on', accepted: [], options: ['On', 'Of', 'In'], topic: 'prepositions', explanation_de: 'Nach depend steht on.', explanation_en: 'Use on after depend.' });
    r.tasks.push({ ...r.tasks[0], type: 'fill-in' });
    const res = s.safeParse(r);
    expect(issues(res)).toEqual([]);
    expect(res.data!.tasks[0]!.options).toEqual([]);
    expect(res.data!.tasks[1]).toMatchObject({ type: 'mc', answer: 'On' });
    expect(res.data!.tasks[2]!.type).toBe('gap');
  });

  it('Wörter und Hausaufgaben gekürzt statt abgelehnt; Wortart gekürzt; fromLesson fehlt → true', () => {
    const r = clone(IMPORT_EXAMPLE);
    r.words = Array.from({ length: 22 }, (_, i) => ({ en: 'w' + i, de: 'x', pos: 'noun', ex: 'w' + i, fromLesson: true }));
    r.words[0].pos = 'phrasal verb (separable)';
    delete r.words[1].fromLesson;
    r.homework = Array.from({ length: 9 }, (_, i) => `Aufgabe ${i + 1}`);
    const res = s.safeParse(r);
    expect(issues(res)).toEqual([]);
    expect(res.data!.words).toHaveLength(20);
    expect(Array.from(res.data!.words[0]!.pos).length).toBeLessThanOrEqual(20);
    expect(res.data!.words[1]!.fromLesson).toBe(true);
    expect(res.data!.homework).toHaveLength(8);
  });
});

describe('W8 weekly-report@2: Verweis tolerant', () => {
  const facts = [...Array.from({ length: 5 }, (_, i) => ({ id: `vw:v${i}`, text: `new word "negotiate${i}" still recalled` })), { id: 'tm:week', text: '210 minutes on 6 days' }];
  for (const lang of ['de', 'en'] as const) {
    it(lang, () => {
      const v = { lang, week: '2026-W39', facts };
      const s = weeklySchema(v);
      const ex = clone(weeklyExample(v));
      for (const [ref, want] of [
        ['vw:v1, vw:v2, vw:v3', 'vw:v1'],
        ['[vw:v2]', 'vw:v2'],
        ['(tm:week)', 'tm:week'],
      ] as const) {
        const r = clone(ex);
        r.learned[0].ref = ref;
        expect(s.parse(r).learned[0]!.ref).toBe(want);
      }
      const arr = clone(ex);
      delete arr.learned[0].ref;
      arr.learned[0].refs = ['vw:x', 'vw:v3'];
      expect(s.parse(arr).learned[0]!.ref).toBe('vw:v3');
      const bad = clone(ex);
      bad.learned[0].ref = 'vw:erfunden';
      expect(s.safeParse(bad).success).toBe(false);
    });
  }
});

describe('Hinweise: scene-gen@2, roleplay-report@2, roleplay-turn', () => {
  it('scene-gen: „Mr." und „2.5" beenden keinen Satz, „C1+" → C1, sieben Wendungen → sechs', () => {
    const r = clone(SCENE_GEN_EXAMPLE);
    r.opening = 'Thanks for coming in, Mr. Keller. I will be direct. Our budget for next year is 2.5 million, and your offer is above it.';
    r.level = 'C1+';
    r.useful.push({ en: 'x y', de: 'a b' }, { en: 'x z', de: 'a c' }, { en: 'x w', de: 'a d' });
    const res = sceneGenSchema.safeParse(r);
    expect(issues(res)).toEqual([]);
    expect(res.data!.level).toBe('C1');
    expect(res.data!.useful).toHaveLength(6);
  });

  for (const uiLang of ['de', 'en'] as const) {
    it(`roleplay-report ${uiLang}: ohne Fokuspunkt, Kategorie „grammar", gebeugte Wendung im Beispiel`, () => {
      const turns = [{ me: 'What I can offer is a dedicated engineer for your tickets.', persona: 'Hm.', v: 'clean', c: [] }, { me: 'We must delay the start, the exposure is for you.', persona: 'That is your problem.', v: 'errors', c: ['prepositions'] }];
      const s = reportSchema({ turns, uiLang });
      const ex = clone(reportExample(uiLang));
      ex.strengths[0].quote = 'What I can offer is a dedicated engineer';
      const empty = clone(ex);
      empty.focus = [];
      expect(issues(s.safeParse(empty))).toEqual([]);
      const cat = clone(ex);
      cat.focus[0].cat = 'grammar';
      expect(s.parse(cat).focus[0]!.cat).toBe('other');
      const infl = clone(ex);
      infl.phrases[0].en = 'hinge on';
      infl.phrases[0].ex = 'It all hinges on the budget.';
      expect(issues(s.safeParse(infl))).toEqual([]);
      const lead = clone(ex);
      lead.phrases[0].ex = 'That really hinges on your budget.';
      expect(issues(s.safeParse(lead))).toEqual([]);
      const wrong = clone(ex);
      wrong.phrases[0].ex = 'It depends on the budget.';
      expect(s.safeParse(wrong).success).toBe(false);
    });
  }

  it('roleplay-turn: einteiliges Namenspräfix weg, Klammer mitten im Satz bleibt, Regieanweisung geht', () => {
    expect(cleanFigureText('Sandra: Look, I hear you, but my CFO wants numbers, not promises.')).toBe('Look, I hear you, but my CFO wants numbers, not promises.');
    expect(cleanFigureText('We pay roughly 40k a year (about a third of our IT budget) for this.')).toBe('We pay roughly 40k a year (about a third of our IT budget) for this.');
    expect(cleanFigureText('That sounds good (in theory). What exactly would you change?')).toBe('That sounds good (in theory). What exactly would you change?');
    expect(cleanFigureText('Fine. (smiles) What would it cost us?')).toBe('Fine. What would it cost us?');
    expect(cleanFigureText('Fair enough. (leans back)')).toBe('Fair enough.');
    expect(cleanFigureText('Look: This is not theoretical.')).toBe('Look: This is not theoretical.');
    expect(cleanFigureText('Sure, Mr. Keller. What would it cost us?')).toBe('Sure, Mr. Keller. What would it cost us?');
  });
});

describe('Hinweise: Business (pitch-script@2, pitch-feedback@2, mail-refine@2)', () => {
  it('pitch-script: Sekunden gerundet, Wendung gebeugt im Beispiel', () => {
    const s = pitchScript.schema({ slide: 's', audience: 'management', minutes: 2, uiLang: 'de' });
    const r = clone(PITCH_SCRIPT_EXAMPLE);
    r.seconds = 120.5;
    r.keyPhrases.push({ en: 'cut storage costs', de: 'Speicherkosten senken', def: 'spend less on storage', ex: 'The archive cuts storage costs by 30%.' });
    const res = s.safeParse(r);
    expect(issues(res)).toEqual([]);
    expect(res.data!.seconds).toBe(121);
  });

  for (const uiLang of ['de', 'en'] as const) {
    it(`pitch-feedback ${uiLang}: Punkt mit Satzzeichen, umformuliert, Kategorie „grammar"`, () => {
      const points = ['Cloud archive for small businesses', 'Setup in one day', 'GDPR-compliant retention'];
      const v = { points, model: 'x', attempt: 'So, our product is a cloud archive for small businesses. It can be in one day installed. And the data are stored like the GDPR says.', uiLang };
      const s = pitchFeedback.schema(v);
      const r = clone(pitchFeedbackExample(uiLang));
      r.errors[0].wrong = 'in one day installed';
      r.coverage[0].point = 'Setup in one day.';
      r.coverage[1].point = 'GDPR-compliant data retention';
      r.errors.push({ wrong: 'the data are stored', right: 'the data is stored', cat: 'grammar', why: uiLang === 'de' ? 'Im Amerikanischen ist „data“ meist Singular.' : 'In American English "data" is usually singular.' });
      const res = s.safeParse(r);
      expect(issues(res)).toEqual([]);
      expect(res.data!.coverage.map((c) => c.point)).toEqual(['Setup in one day', 'GDPR-compliant retention']);
      expect(res.data!.errors[1]!.cat).toBe('other');
    });
  }

  it('mail-refine: Nummer als Text, fehlende Wendung, langer Schluss-Baustein', () => {
    const tail = Array.from({ length: 8 }, (_, i) => `This is the extra sentence number ${i + 1} that belongs to the merged final segment of the mail.`).join(' ');
    const segs = [{ i: 0, text: 'Hi Tom,' }, { i: 1, text: tail }];
    const v = { segments: segs, recipient: 'client', intent: 'inform', uiLang: 'de' as const };
    const s = mailRefine.schema(v);
    const long = tail.replace(/This is/g, 'Here is');
    expect(Array.from(long).length).toBeGreaterThan(MAIL_OPTION_MAX);
    const opt = (text: string) => ({ text, register: 'neutral', why: 'Klingt natürlicher.' });
    const r = { segments: [{ i: '0', status: 'ok', options: [] }, { i: 1, status: 'stiff', options: [opt(long), { ...opt('Here is a shorter version of the end.'), phrase: '', de: '', def: '' }] }], tone: 'Freundlich, aber etwas knapp.' };
    const res = s.safeParse(r);
    expect(issues(res)).toEqual([]);
    expect(res.data!.segments[0]!.i).toBe(0);
    expect(res.data!.segments[1]!.options[0]).toMatchObject({ phrase: '', de: '', def: '' });
  });
});

describe('Hinweise: reading-text@2, writing-prompt@2, preply-prep@2', () => {
  const para = (n: number) => Array.from({ length: n }, (_, i) => `Small companies in Germany still keep their invoices in folders, and many managers feel the cost of this habit only when an audit arrives number ${i}.`).join(' ');
  const vars: ReadingTextVars = { level: 'B2+', domain: 'work', topicHint: '', avoid: [], context: 'c' };
  const text = [para(4), para(4), para(4), para(4), para(3)].join('\n\n');
  const gloss = [['invoices', 'Rechnungen'], ['audit', 'Prüfung'], ['habit', 'Gewohnheit'], ['folders', 'Ordner'], ['managers', 'Manager'], ['companies', 'Firmen']].map(([w, de]) => ({ w, de, def: 'a short definition here' }));
  const q = (type: string) => ({ q: 'What is the main idea of the text?', options: ['Paper is cheap', 'Audits reveal the cost of paper', 'Managers love folders', 'Cloud is risky'], answer: 'Audits reveal the cost of paper', type, explain_de: 'Der Text sagt, dass die Kosten erst bei einer Prüfung sichtbar werden.', explain_en: 'The text says the cost becomes visible during an audit.' });
  const base = () => clone({ title: 'Why Small Firms Move Archives', topic: 'business', topic_de: 'Digitale Archive', topic_en: 'Digital archives', teaser: 'Paper archives are costly and risky for small firms.', text, keypoints: ['Many firms still use paper.', 'Audits reveal hidden costs.', 'Cloud archives cut costs.', 'Retention rules matter.'], glossary: gloss, questions: [q('gist'), q('detail'), q('detail'), q('inference')] });

  it('reading-text: Thema als Kennung, Antwort als Buchstabe, einfache Zeilenumbrüche als Absätze', () => {
    const s = readingText.schema(vars);
    const r = base();
    r.topic = 'Remote Work';
    r.questions[1].answer = 'B';
    r.questions[2].answer = 'B) Audits reveal the cost of paper';
    r.questions[3].answer = 'audits reveal the cost of paper';
    r.text = text.replace(/\n\n/g, '\n');
    const res = s.safeParse(r);
    expect(issues(res)).toEqual([]);
    const o = res.data!;
    expect(o.topic).toBe('remote-work');
    expect(o.questions.slice(1).map((x) => x.answer)).toEqual(Array(3).fill('Audits reveal the cost of paper'));
    expect(o.text?.split('\n\n')).toHaveLength(5);
    const bad = base();
    bad.questions[1].answer = 'E';
    expect(s.safeParse(bad).success).toBe(false);
  });

  it('writing-prompt: Umfang als Text oder Objekt, Stufe mit Leerzeichen, sieben Wendungen, „letter"', () => {
    const v: WritingPromptVars = { level: 'B2+', domain: 'work', genre: 'email', avoid: [], context: 'x', ownTopic: '' };
    const s = writingPrompt.schema(v);
    const ex = clone(WRITING_PROMPT_EXAMPLE);
    expect(s.parse({ ...ex, words: ['80', '130'] }).words).toEqual([80, 130]);
    expect(s.parse({ ...ex, words: { min: 80, max: 130 } }).words).toEqual([80, 130]);
    expect(s.parse({ ...ex, level: 'B2+ ' }).level).toBe('B2+');
    expect(s.parse({ ...ex, useful: [...ex.useful, 'a b', 'c d', 'e f'] }).useful).toHaveLength(6);
    expect(s.parse({ ...ex, genre: 'letter' }).genre).toBe('email');
    expect(s.parse({ ...ex, genre: 'Complaint' }).genre).toBe('complaint');
  });

  for (const uiLang of ['de', 'en'] as const) {
    it(`preply-prep ${uiLang}: Fehler als Teilstück oder Korrektur zugeordnet, sieben Sätze → sechs`, () => {
      const errors = [{ wrong: 'We look forward to hear from you.', right: 'We look forward to hearing from you.', topic: 'gerund-inf' }, { wrong: 'It depends of the budget.', right: 'It depends on the budget.', topic: 'prepositions' }];
      const s = prepSchema({ uiLang, errors });
      const ex = clone(PREP_EXAMPLE);
      ex.watch.push({ mistake: 'It depends of the budget.', fix: 'It depends on the budget.', note: uiLang === 'de' ? 'Nach „depend“ folgt „on“.' : 'Use "on" after "depend".' });
      if (uiLang === 'en') {
        ex.title = 'Handling objections';
        ex.goal_x = 'Handle three typical objections without hesitating.';
        for (const w of ex.watch) w.note = 'Use the -ing form after "look forward to".';
      }
      ex.watch[0].mistake = 'look forward to hear';
      ex.watch[1].mistake = 'It depends on the budget';
      ex.say.push('I see your point, but let me explain.', 'Could we look at this from another angle?', 'That is a fair question.');
      const res = s.safeParse(ex);
      expect(issues(res)).toEqual([]);
      expect(res.data!.watch.map((w) => w.mistake)).toEqual(['We look forward to hear from you.', 'It depends of the budget.']);
      expect(res.data!.say).toHaveLength(6);
      const bad = clone(ex);
      bad.watch[0].mistake = 'I am working here since 2019.';
      expect(s.safeParse(bad).success).toBe(false);
    });
  }
});
