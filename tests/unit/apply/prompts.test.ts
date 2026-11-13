import { describe, expect, it } from 'vitest';
import { coveredOf, greetOf, keepGood, keepPoints, keepStyle, styleOf } from '../../../src/prompts/applyCommon';
import { c1Mail, mailExample } from '../../../src/prompts/c1Mail';
import type { Edit } from '../../../src/domain/tutor/edits';
import { applyKeypoints } from '../../../src/prompts/applyKeypoints';
import { applyReply, type ReplyVars } from '../../../src/prompts/applyReply';
import { applySummary, faithfulOf, type SummaryVars } from '../../../src/prompts/applySummary';
import { promptBytes, PROMPT_MAX_BYTES } from '../../../src/prompts/common';
import { TEMPLATES } from '../../../src/prompts/registry';
import { applyKeypointsReply, applyReplyReply, applySummaryReply } from '../../../src/platform/dev/canned/apply';
import { c1MailReply } from '../../../src/platform/dev/canned/lp3/p47';
import { patListText } from '../../../src/domain/tutor/patList';

const TEXT = 'Hi Laura, I fully understand that your team is busy with the year-end closing. The setup takes about two hours for your team. We discussed about a short summary for your managing director.';

const replyVars = (over: Partial<ReplyVars> = {}): ReplyVars => ({
  incoming: 'From: Laura Fischer (Head of Accounting)\nSubject: Your call yesterday\n\nCould you just send me a price list?',
  must: ['Show understanding for the busy period', 'Show how little effort it means for her team', 'Offer a short summary for the managing director'],
  words: ['setup', 'closing'],
  rule: 'Present Simple vs. Continuous: habits vs. now',
  text: TEXT,
  uiLang: 'de',
  ctx: '',
  pats: patListText(),
  ...over,
});

const ARTICLE = 'The city council approved a new budget for public transport on Monday. The plan adds forty electric buses and extends night service on six lines.';
const sumVars = (over: Partial<SummaryVars> = {}): SummaryVars => ({
  title: 'More buses for the city',
  article: ARTICLE,
  keyPoints: ['The council approved a new transport budget.', 'Forty electric buses are added.', 'Night service is extended on six lines.'],
  goal: { sentences: [3, 5], maxWords: 120 },
  words: ['council'],
  rule: '',
  text: 'The council approved more money for buses. I think this is a great idea. Night buses will run on more lines.',
  uiLang: 'en',
  ctx: '',
  pats: patListText(),
  ...over,
});

describe('Pflicht- und Kernpunkte einzeln (Nachtrag learning-scientist Muss 1/2)', () => {
  it('ein Zitat, das nicht wörtlich im Text steht, macht den Punkt zu „no“; fehlende Punkte gelten als „no“', () => {
    const pts = keepPoints(
      [
        { i: 1, covered: 'yes', quote: 'your team is busy' },
        { i: 2, covered: 'partly', quote: 'it is very quick' },
        { i: 2, covered: 'yes', quote: 'two hours' },
        { i: 9, covered: 'yes', quote: 'Hi' },
      ],
      TEXT,
      3,
    );
    expect(pts).toEqual([
      { i: 1, covered: 'yes', quote: 'your team is busy', why: '' },
      { i: 2, covered: 'no', quote: '', why: '' },
      { i: 3, covered: 'no', quote: '', why: '' },
    ]);
    // T2: `why` nur bei „partly“/„no“.
    expect(keepPoints([{ i: 1, covered: 'partly', quote: 'two hours', why: 'Zu allgemein.' }, { i: 2, covered: 'yes', quote: 'two hours', why: 'x' }], TEXT, 2).map((p) => p.why)).toEqual(['Zu allgemein.', '']);
    expect(['Yes', 'partial', 'missing', true, 7].map(coveredOf)).toEqual(['yes', 'partly', 'no', 'yes', 'no']);
  });

  it('„Das sitzt“ nur mit wörtlichem Zitat und Grund; `faithful` tolerant, Zitat nur wörtlich', () => {
    expect(keepGood({ quote: 'two hours', why: 'Konkret.' }, TEXT)).toEqual({ quote: 'two hours', why: 'Konkret.' });
    expect(keepGood({ quote: 'three hours', why: 'Konkret.' }, TEXT)).toBeNull();
    expect(faithfulOf(undefined, TEXT)).toEqual({ ok: true, quote: '', why: '' });
    expect(faithfulOf({ ok: false, quote: 'two hours', why: 'x' }, TEXT)).toEqual({ ok: false, quote: 'two hours', why: 'x' });
    expect(faithfulOf({ ok: false, quote: 'made up', why: 'x' }, TEXT).quote).toBe('');
  });
});

describe('Vorlagen', () => {
  it('sind registriert, mit Kopfzeile, Stufe und Zwischenspeicher', () => {
    for (const tpl of [applyReply, applySummary, applyKeypoints]) expect(TEMPLATES).toContain(tpl);
    expect(applyReply.build(replyVars()).split('\n')[0]).toBe('[apply-reply@3]');
    expect(applySummary.build(sumVars()).split('\n')[0]).toBe('[apply-summary@3]');
    expect(applyKeypoints.build({ title: 'x', article: ARTICLE }).split('\n')[0]).toBe('[apply-keypoints@1]');
    expect([applyReply.tier, applySummary.tier, applyKeypoints.tier]).toEqual(['default', 'default', 'default']);
    // T2–T4: Bewertungsstufen, Ton über die ganze Antwort, bessere Fassung deckt alle Punkte, Ziel als Wert.
    const rp = applyReply.build(replyVars());
    expect(rp).toContain('Judge whether the point is there, not the grammar. For a point about tone, judge the whole reply');
    expect(rp).toContain('yes = clearly there; partly = mentioned but vague, incomplete or slightly wrong; no = missing.');
    expect(rp).toContain("it must cover every point above (add one short sentence for a missing point), must not add new facts, must keep or add a fitting salutation and sign-off, and must differ from the learner's reply.");
    const sp = applySummary.build(sumVars({ goal: { sentences: [3, 3], maxWords: 70 } }));
    expect(sp).toContain("with 3 sentences and at most 70 words, in the learner's own words");
    expect(sp).toContain('partly = mentioned but vague');
    expect(applySummary.build(sumVars())).toContain('with 3 to 5 sentences and at most 120 words');
    for (const p of [rp, sp]) expect(p).not.toMatch(/learner own|learner words|learner ideas/);
  });

  it('die eingegangene Mail steht als eigenes Feld (bis 1.600 Zeichen), der Artikel bis 6.000 Zeichen; Prompts bleiben unter dem Deckel', () => {
    const long = 'x'.repeat(5_000);
    const p = applyReply.build(replyVars({ incoming: `${'a '.repeat(900)}END-OF-MAIL ${long}` }));
    expect(p).toContain('<<<MAIL');
    expect(p).not.toContain('END-OF-MAIL');
    const s = applySummary.build(sumVars({ article: `${ARTICLE} ${'word '.repeat(2_000)}` }));
    expect(promptBytes(s)).toBeLessThan(PROMPT_MAX_BYTES);
    expect(s).toContain('Key points of the article');
  });

  it('Testantworten bestehen das Schema (Antwort, Zusammenfassung, Kernpunkte)', () => {
    const r = applyReply.schema(replyVars()).parse(JSON.parse(applyReplyReply(applyReply.build(replyVars()))));
    expect(r.points.map((p) => p.covered)).toEqual(['yes', 'yes', 'yes']);
    expect(r.edits.map((e) => e.from)).toEqual(['discussed about']);
    expect(r.used.map((u) => u.pat).sort()).toEqual(['closing', 'rule', 'setup']);
    const sv = sumVars();
    const s = applySummary.schema(sv).parse(JSON.parse(applySummaryReply(applySummary.build(sv))));
    expect(s.faithful.ok).toBe(false);
    expect(s.faithful.quote).toBe('I think this is a great idea');
    expect(s.points).toHaveLength(3);
    const k = applyKeypoints.schema({ title: 'x', article: ARTICLE }).parse(JSON.parse(applyKeypointsReply(applyKeypoints.build({ title: 'More buses', article: ARTICLE }))));
    expect(k.points).toHaveLength(3);
  });

  it('Sprachtreue: Erklärung in der Oberflächensprache, bessere Fassung auf Englisch, nie gleich dem eigenen Text', () => {
    const v = replyVars({ uiLang: 'en' });
    const base = JSON.parse(applyReplyReply(applyReply.build(v))) as Record<string, unknown>;
    expect(applyReply.schema(v).safeParse({ ...base, upgraded: TEXT }).success).toBe(false);
    expect(applyReply.schema(v).safeParse({ ...base, summary: 'Das ist eine deutsche Zusammenfassung mit vielen Wörtern und nicht englisch.' }).success).toBe(false);
    expect(applyReply.schema(v).safeParse({ ...base, points: [] }).success).toBe(false);
    // T2: das Warum je Punkt in der Erklärsprache.
    const badWhy = [{ i: 1, covered: 'no', quote: '', why: 'Dieser Punkt fehlt in deiner Antwort noch ganz und gar.' }];
    expect(applyReply.schema(v).safeParse({ ...base, points: badWhy }).success).toBe(false);
    expect(applyReply.schema(v).safeParse({ ...base, points: [{ ...badWhy[0], why: 'This point is still missing from your reply.' }] }).success).toBe(true);
    expect(applyKeypoints.schema({ title: 'x', article: '' }).safeParse({ points: ['Der Rat hat ein neues Budget für den Verkehr beschlossen.', 'Forty electric buses are added.', 'Night service grows on six lines.'] }).success).toBe(false);
  });
});

describe('W5 K1 „So klingt es gehobener“ und K7 Anrede/Gruß', () => {
  const err = (from: string): Edit => ({ from, to: 'x', kind: 'grammar', sev: 'error', pat: null, why: 'Weil.' });
  it('Stil nur mit wörtlichem Zitat, nicht auf einer Fehlerstelle, anders als vorher, höchstens 2, ohne Doppelte; falsche Sprache fällt weg', () => {
    const tips = keepStyle(
      [
        { from: 'your team is busy', to: 'your team is stretched thin', why: 'Klingt natürlicher.' },
        { from: 'not in the text', to: 'better', why: 'Erfunden.' },
        { from: 'We discussed about', to: 'We talked about', why: 'Überschneidet den Fehler.' },
        { from: 'about two hours', to: 'about two hours', why: 'Gleich.' },
        { from: 'your team is busy', to: 'swamped', why: 'Doppelt.' },
        { from: 'The setup takes', to: 'Die Einrichtung dauert nur kurz für dein ganzes Team', why: 'Falsche Sprache der Fassung.' },
        { from: 'The setup takes', to: 'Setting things up takes', why: 'Klingt flüssiger.' },
        { from: 'year-end closing', to: 'year-end close', why: 'Dritte Stelle.' },
      ],
      TEXT,
      [err('discussed about')],
      'de',
    );
    expect(tips.map((x) => x.from)).toEqual(['your team is busy', 'The setup takes']);
    expect(tips[1]?.to).toBe('Setting things up takes');
  });

  it('fehlt `style` (ältere Antwort), gelten die belegten Verbesserungen der Liste; eine leere Liste bleibt leer', () => {
    const edits: Edit[] = [err('discussed about'), { from: 'is busy', to: 'is swamped', kind: 'word', sev: 'upgrade', pat: null, why: 'Lebendiger.' }, { from: 'Hi', to: 'Dear', kind: 'spelling', sev: 'upgrade', pat: null, why: 'x' }];
    expect(styleOf(undefined, TEXT, edits, 'de').map((x) => x.to)).toEqual(['is swamped']);
    expect(styleOf([], TEXT, edits, 'de')).toEqual([]);
    expect(styleOf('nonsense', TEXT, edits, 'de')).toEqual([]);
  });

  it('Anrede und Gruß tolerant: Kurzformen, unbekannt → kein Urteil, Grund in falscher Sprache fällt weg', () => {
    expect(greetOf({ fit: 'OK', why: 'Passt.' }, 'de')).toEqual({ fit: 'fits', why: 'Passt.' });
    expect(greetOf({ fit: 'too casual', why: '' }, 'de')?.fit).toBe('off');
    expect(greetOf({ fit: 'missing', why: 'The greeting is missing at the very start of your reply.' }, 'de')).toEqual({ fit: 'missing', why: '' });
    expect(greetOf({ fit: 'maybe' }, 'de')).toBeNull();
    expect(greetOf(undefined, 'de')).toBeNull();
  });

  it('Vorlagen: Leser, Anrede und Gruß nur mit Vorgabe; Stil-Regel in Antwort/Zusammenfassung, bei der Mail nur auf Wunsch (Schreibwerkstatt unverändert kurz)', () => {
    const g = { reader: 'Laura Fischer (Head of Accounting)', hello: 'Hi Laura,', close: 'Best regards,' };
    const withG = applyReply.build(replyVars({ greet: g }));
    expect(withG).toContain('Reader: Laura Fischer (Head of Accounting). A fitting salutation is Hi Laura, and a fitting sign-off is Best regards,');
    expect(withG).toContain('- greet:');
    expect(withG).toContain('"greet":{"fit":"fits","why":"…"}');
    expect(applyReply.build(replyVars())).not.toContain('- greet:');
    for (const p of [withG, applySummary.build(sumVars())]) expect(p).toContain('- style: 0 to 2 spans of CORRECT wording');
    expect(mailExample({})).not.toMatch(/style|greet/);
    expect(mailExample({ polish: true, greet: g })).toMatch(/"tone":\{[^}]*\},"greet":\{[^}]*\},.*"style":\[/);
    const parses = (s: string): boolean => {
      JSON.parse(s);
      return true;
    };
    expect(parses(mailExample({ polish: true, greet: g }))).toBe(true);
    expect(parses(applyReply.build(replyVars()).split('\n').find((l) => l.startsWith('{"points"')) ?? '')).toBe(true);
  });

  it('Testantworten: Stil und Anrede kommen durch das Schema; erfundene Stellen fallen weg; die Zusammenfassung urteilt nie über eine Anrede', () => {
    const g = { reader: 'Laura Fischer (Head of Accounting)', hello: 'Hi Laura,', close: 'Best regards,' };
    const text = 'Hi Laura, I fully understand that your team is very busy. The setup really needs only a short workshop. We discussed about a summary zzfakestyle.';
    const v = replyVars({ text, greet: g });
    const r = applyReply.schema(v).parse(JSON.parse(applyReplyReply(applyReply.build(v))));
    expect(r.style.map((x) => x.to)).toEqual(['stretched thin', 'requires']);
    expect(r.greet).toEqual({ fit: 'fits', why: 'Anrede und Gruß passen zum Empfänger.' });
    const noGreet = replyVars({ text: text.replace('Hi Laura, ', ''), greet: g });
    expect(applyReply.schema(noGreet).parse(JSON.parse(applyReplyReply(applyReply.build(noGreet)))).greet?.fit).toBe('missing');
    // Ohne Vorgabe kein Urteil, auch wenn Claude eines liefert.
    const plain = replyVars({ text });
    expect(applyReply.schema(plain).parse({ ...JSON.parse(applyReplyReply(applyReply.build(plain))), greet: { fit: 'fits', why: 'x' } }).greet).toBeNull();
    const sv = sumVars({ text: 'The council approved more money for buses, so night service is hard to stop now. Night buses will run on more lines.' });
    const s = applySummary.schema(sv).parse(JSON.parse(applySummaryReply(applySummary.build(sv))));
    expect(s.style.map((x) => x.from)).toEqual(['hard to stop']);
    expect('greet' in s).toBe(false);
  });

  it('c1-mail@2: alte Antwort ohne `style`/`greet` bleibt gültig (Verbesserungen der Liste gelten als Stil)', () => {
    const v = { situation: 'Reader: CFO. Write about the timeline.', patterns: [], phrases: [], text: 'Dear Daniel, I will tell you the timeline next week. Best regards', uiLang: 'de' as const, ctx: '', pats: patListText(), polish: true };
    const old = { edits: [{ from: 'tell you', to: 'let you know', kind: 'word', sev: 'upgrade', pat: null, why: 'Höflicher.' }], used: [], tone: { fit: 'fits', why: '' }, upgraded: 'Dear Daniel, I will let you know the timeline next week. Best regards', summary: 'Gut gegliedert.', errorCount: 0 };
    const out = c1Mail.schema(v).parse(old);
    expect(out.style).toEqual([{ from: 'tell you', to: 'let you know', why: 'Höflicher.' }]);
    expect(out.greet).toBeNull();
  });

  it('W5b: die bessere Fassung behält oder ergänzt Anrede und Gruß (Antwort immer, Mail nur mit Vorgabe – die Schreibwerkstatt bleibt unverändert)', () => {
    const rule = 'keep or add a fitting salutation and sign-off';
    expect(applyReply.build(replyVars())).toContain(rule);
    const v = { situation: 'Reader: CFO. Write about the timeline.', patterns: [], phrases: [], text: 'Dear Daniel, I will tell you the timeline next week. Best regards', uiLang: 'de' as const, ctx: '', pats: patListText() };
    expect(c1Mail.build({ ...v, greet: { reader: 'CFO, Daniel', hello: 'Hi Daniel,', close: 'Best regards,' } })).toContain(rule);
    expect(c1Mail.build(v)).not.toContain(rule);
  });
});

// Großpaket P „Politur“, P4 (13.11.2026): Mail-Vorlagen @3 – Zielwörter mit Kennung und Bedeutung, `used` mit Kennung und `why`, Kurzurteil.
describe('Mail-Vorlagen @3: Wörter mit Kennung und Bedeutung, `used` mit Grund', () => {
  const words = [
    { id: 'w1', word: 'setup', de: 'Einrichtung' },
    { id: 'w2', word: 'closing', de: 'Jahresabschluss' },
  ];
  it('der Prompt nennt Kennung, Wort und gelernte Bedeutung; ein bloßer Wortlaut bekommt w1/w2', () => {
    expect(applyReply.build(replyVars({ words }))).toContain('Target words (id: word = meaning the learner learned): w1: setup = Einrichtung | w2: closing = Jahresabschluss');
    expect(applySummary.build(sumVars())).toContain('Target words (id: word = meaning the learner learned): w1: council');
    for (const p of [applyReply.build(replyVars({ words })), applySummary.build(sumVars())]) {
      expect(p).toContain('by its id, e.g. "w1"');
      expect(p).toContain('the gist in ONE short sentence');
    }
  });
  it('`used` über die Kennung wird als Wortlaut gespeichert, `why` kommt mit; ein `why` in falscher Sprache fällt weg, die Verwendung bleibt', () => {
    const raw = JSON.parse(applyReplyReply(applyReply.build(replyVars({ words })))) as Record<string, unknown>;
    raw.used = [
      { pat: 'w1', ok: true, quote: 'The setup takes', why: 'Passt hier in der gelernten Bedeutung.' },
      { pat: 'w2', ok: false, quote: 'year-end closing', why: 'This explanation is in the wrong language for a German learner.' },
      { pat: 'w9', ok: true, quote: 'Hi Laura', why: 'Unbekannt.' },
    ];
    const r = applyReply.schema(replyVars({ words })).safeParse(raw);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.used).toEqual([
      { pat: 'setup', ok: true, quote: 'The setup takes', why: 'Passt hier in der gelernten Bedeutung.' },
      { pat: 'closing', ok: false, quote: 'year-end closing' },
    ]);
  });
  it('c1-mail@3 beurteilt mit `words` auch die Zielwörter (früher nur Muster); ohne `words` bleibt die Schreibwerkstatt wie bisher', () => {
    const base = { situation: 'Write to Laura about the setup.', patterns: [{ id: 'psc.now', name: 'present continuous', form: 'am/is/are + -ing' }], phrases: [] as string[], text: TEXT, uiLang: 'de' as const, ctx: '', pats: patListText() };
    const p = c1Mail.build({ ...base, words });
    expect(p.split('\n')[0]).toBe('[c1-mail@3]');
    expect(p).toContain('w1: setup = Einrichtung');
    expect(p).not.toContain('Target phrases:');
    const r = c1Mail.schema({ ...base, words }).safeParse(JSON.parse(c1MailReply(p)));
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.used.map((u) => [u.pat, u.ok, !!u.why])).toEqual([['setup', true, true], ['closing', true, true]]);
    const studio = c1Mail.build({ ...base, phrases: ['as discussed'] });
    expect(studio).toContain('Target phrases: as discussed');
    expect(studio).not.toContain('Target words');
  });
});
