import { describe, expect, it } from 'vitest';
import { applyBridgeReply } from '../../../src/platform/dev/canned/applyBridge';
import { applyBridge, BRIDGE_EXAMPLE, bridgeContextProblem, bridgeNeedsFix, bridgeWordInText, patVerdictOf, type BridgeVars } from '../../../src/prompts/applyBridge';
import { promptBytes, PROMPT_MAX_BYTES } from '../../../src/prompts/common';
import { TEMPLATES } from '../../../src/prompts/registry';

// apply-bridge@1 (P4): Vorlage, Schema mit lokaler Gegenprüfung, Neuversuch-Fassung, Test-Antwort des Entwicklungs-Adapters.

const vars = (sentence: string, o: Partial<BridgeVars> = {}): BridgeVars => ({
  word: { word: 'postpone', meaning: 'verschieben', kind: 'w', example: 'We had to postpone the meeting.' },
  pat: { id: 'cn.third', name: 'third conditional · missed chance', form: 'if + Past Perfect, would have + participle', use: 'For a past situation that did not happen.', example: 'If we had known, we would have called.', trap: { bad: 'If we would have known', good: 'If we had known' } },
  situation: 'After losing an order, you talk to your manager about what would have gone differently.',
  starter: 'If we had called them earlier, …',
  sentence,
  uiLang: 'de',
  ctx: 'Sales and project manager in the kitchen and furniture industry',
  ...o,
});
const GOOD = 'If we had called them earlier, we would have postponed the delivery.';
const reply = (v: BridgeVars): unknown => JSON.parse(applyBridgeReply(applyBridge.build(v)));

describe('apply-bridge@1', () => {
  it('Vorlage: Kopfzeile, Stufe, kein Zwischenspeicher, registriert; Prompt nennt Wort mit Bedeutung und Kartensatz, Muster mit Formel, Situation und Satzanfang', () => {
    const p = applyBridge.build(vars(GOOD));
    expect(p.split('\n')[0]).toBe('[apply-bridge@1]');
    expect(applyBridge.tier).toBe('default');
    expect(applyBridge.cache).toBe(false);
    expect(TEMPLATES.some((t) => t.id === 'apply-bridge' && t.version === 1)).toBe(true);
    expect(TEMPLATES.some((t) => t.id === 'combo-check')).toBe(true);
    expect(p).toContain('Target word: w1: postpone (word; meaning: verschieben) | card example (a sentence too close to it does not count): We had to postpone the meeting.');
    expect(p).toContain('Target pattern: cn.third: third conditional · missed chance | form: if + Past Perfect, would have + participle');
    expect(p).toContain('Typical error of German speakers with this pattern: If we would have known → If we had known');
    expect(p).toContain('Situation (shown to the learner');
    expect(p).toContain('Suggested sentence start (a help, not required): If we had called them earlier, …');
    expect(p).toContain(`Learner sentence: ${GOOD}`);
    expect(p).toContain('Explanation language: German');
    expect(p).toContain(BRIDGE_EXAMPLE);
    // Die Wort-Regeln sind die der Wörter-App (ein Wortlaut), die Muster-Regeln trennen „falsch“ von „vermieden“ und „unsicher“.
    expect(p).toContain('"thin" also if the sentence gives no context');
    expect(p).toContain('"avoided" = the sentence does not use the target pattern at all');
    expect(p).toContain('never guess');
    expect(p).toContain('at most 12 words');
    expect(promptBytes(p)).toBeLessThan(PROMPT_MAX_BYTES / 4);
    // Ohne Rahmen keine Zeilen für Situation und Satzanfang.
    const bare = applyBridge.build(vars(GOOD, { situation: undefined, starter: undefined }));
    expect(bare).not.toContain('Suggested sentence start');
    expect(bare).not.toContain('Situation (shown');
  });

  it('Test-Antworten bestehen das Schema: alles richtig, Wort falsch, Muster falsch, Muster vermieden, unsicher', () => {
    const ok = applyBridge.schema(vars(GOOD)).parse(reply(vars(GOOD)));
    expect(ok).toMatchObject({ word: { v: 'ok', err: null, at: 'postponed' }, pat: { v: 'ok' }, extra: null, fixed: '' });
    expect(ok.keep).toBeTruthy();
    expect(ok.better).toContain('postponed');
    expect(bridgeNeedsFix(ok)).toBe(false);

    const w = vars(`${GOOD} zzword`);
    const wrongWord = applyBridge.schema(w).parse(reply(w));
    expect(wrongWord).toMatchObject({ word: { v: 'wrong', err: 'sense' }, pat: { v: 'ok' } });
    expect(wrongWord.fixed).toBe(GOOD);

    const p = vars(`${GOOD} zzpat`);
    const wrongPat = applyBridge.schema(p).parse(reply(p));
    expect(wrongPat).toMatchObject({ word: { v: 'ok' }, pat: { v: 'wrong', at: 'If we had' } });
    expect(wrongPat.fixed).toBe(GOOD);
    expect(bridgeNeedsFix(wrongPat)).toBe(true);

    const a = vars(`${GOOD} zzavoid`);
    const avoided = applyBridge.schema(a).parse(reply(a));
    expect(avoided).toMatchObject({ pat: { v: 'avoided', at: '' }, fixed: '' });

    const u = vars(`${GOOD} zzunsure`);
    expect(applyBridge.schema(u).parse(reply(u)).pat.v).toBe('unsure');

    const en = vars(GOOD, { uiLang: 'en' });
    expect(applyBridge.schema(en).safeParse(reply(en)).success).toBe(true);
  });

  it('lokale Gegenprüfung: Urteil ohne Beleg, falsche Sprache, zu langes „Merk dir“ → Neuversuch; im Neuversuch fällt Unsicheres weg', () => {
    const v = vars(GOOD);
    const base = { word: { v: 'ok', err: null, at: 'postponed', why: 'Das Wort passt hier genau in der gelernten Bedeutung.' }, pat: { v: 'ok', at: 'If we had called', why: 'Die Form ist richtig gebildet und passt zum Satz.' }, extra: null, fixed: '', better: '', keep: 'Erst den Bezugspunkt nennen, dann die Form bilden.' };
    expect(applyBridge.schema(v).safeParse(base).success).toBe(true);
    // Muster „richtig“ ohne wörtliche Fundstelle: streng ein Schemafehler, im Neuversuch „nicht sicher“ (kein Beleg ohne Fundstelle).
    const noQuote = { ...base, pat: { ...base.pat, at: 'steht nicht im Satz' } };
    expect(applyBridge.schema(v).safeParse(noQuote).success).toBe(false);
    expect(applyBridge.lenient!(v).parse(noQuote).pat).toMatchObject({ v: 'unsure', at: '' });
    // Wort „richtig“, steht aber gar nicht im Satz: streng ein Schemafehler, im Neuversuch „nicht benutzt“ (keine Note).
    const absent = vars('If we had called them earlier, we would have won the order.');
    expect(applyBridge.schema(absent).safeParse(base).success).toBe(false);
    expect(applyBridge.lenient!(absent).parse({ ...base, word: { ...base.word, at: '' } }).word.v).toBe('unused');
    // Erklärung in der falschen Sprache.
    const english = { ...base, pat: { ...base.pat, why: 'The form is built correctly and it fits what the sentence says here.' } };
    expect(applyBridge.schema(v).safeParse(english).success).toBe(false);
    expect(applyBridge.lenient!(v).parse(english).pat.why).toBe('');
    // „Merk dir“ viel zu lang oder leer.
    const long = { ...base, keep: 'Das ist ein sehr langer Satz, der weit mehr als zwölf Wörter hat und deshalb nicht als kurze Merkhilfe für das nächste Mal taugt.' };
    expect(applyBridge.schema(v).safeParse(long).success).toBe(false);
    expect(applyBridge.lenient!(v).parse(long).keep).toBe('');
    expect(applyBridge.schema(v).safeParse({ ...base, keep: '' }).success).toBe(false);
    // Tolerant gelesene Urteile.
    expect(['correct', 'Not used', 'unclear', 'incorrect'].map(patVerdictOf)).toEqual(['ok', 'avoided', 'unsure', 'wrong']);
    expect(applyBridge.schema(v).safeParse({ ...base, pat: { ...base.pat, v: 'Correct' } }).success).toBe(true);
    expect(applyBridge.schema(v).safeParse({ ...base, pat: { ...base.pat, v: 'vielleicht' } }).success).toBe(false);
  });

  it('korrigierte Fassung: Pflicht bei Fehler, behält das richtig benutzte Wort, braucht den Zusammenhang des Musters; nie mehr als zwei Korrekturen', () => {
    const given = 'If we had called them earlier, we would postponed the delivery.';
    const v = vars(given);
    const wrong = { word: { v: 'ok', err: null, at: 'postponed', why: 'Das Wort passt hier in der gelernten Bedeutung.' }, pat: { v: 'wrong', at: 'would postponed', why: 'Nach „would“ fehlt hier „have“ vor der dritten Form.' }, extra: { from: 'earlier', to: 'sooner', why: 'Das klingt hier etwas natürlicher.' }, fixed: GOOD, better: GOOD, keep: 'Nach „would“ kommt „have“ und die dritte Form.' };
    const out = applyBridge.schema(v).parse(wrong);
    // Das Muster ist falsch: ein weiterer Fehler fällt weg.
    expect(out.extra).toBeNull();
    expect(out.fixed).toBe(GOOD);
    expect(out.better).toBe(GOOD);
    // Fehlende Fassung bei Fehler: nie als richtig gezeigt („noch nicht sicher geprüft“).
    expect(applyBridge.schema(v).parse({ ...wrong, fixed: '' })).toMatchObject({ fixed: '', fixedUnsure: true });
    // Die Fassung verliert das richtig benutzte Zielwort: streng ein Schemafehler.
    expect(applyBridge.schema(v).safeParse({ ...wrong, fixed: 'If we had called them earlier, we would have delayed the delivery.' }).success).toBe(false);
    // Ohne Fehler bleibt `fixed` leer, auch wenn Claude etwas liefert.
    const fine = { ...wrong, pat: { v: 'ok', at: 'If we had called', why: 'Die Form ist richtig gebildet und passt zum Satz.' }, extra: null };
    expect(applyBridge.schema(vars(GOOD)).parse(fine).fixed).toBe('');
    // Zusammenhang: Past Perfect ohne Bezugspunkt und Present Perfect Continuous ohne for/since sind ein Schemafehler (nur bei diesen Mustern).
    expect(bridgeContextProblem('pp.earlier', 'They had lacked quality.')).toMatch(/later past event/);
    expect(bridgeContextProblem('pp.earlier', 'By the time we delivered the kitchen, they had lacked quality for years.')).toBeNull();
    expect(bridgeContextProblem('pc.duration', 'We have been working on the plan.')).toMatch(/for, since/);
    expect(bridgeContextProblem('pp.reported', 'The supplier told us that they had shipped the parts.')).toBeNull();
    expect(bridgeContextProblem('cn.third', 'They had lacked quality.')).toBeNull();
    const pp = vars('They had postponed the delivery zz.', { pat: { id: 'pp.earlier', name: 'had + participle · happened earlier', form: 'had + past participle', use: 'Earlier of two past events.', example: 'When we arrived, they had left.' } });
    const ppOut = { ...wrong, pat: { v: 'wrong', at: 'had postponed', why: 'Es fehlt der spätere Zeitpunkt in der Vergangenheit.' }, extra: null, fixed: 'They had postponed the delivery.', better: '' };
    expect(applyBridge.schema(pp).safeParse(ppOut).success).toBe(false);
    expect(applyBridge.lenient!(pp).parse(ppOut)).toMatchObject({ fixed: '', fixedUnsure: true });
  });

  it('Punkt „steht im Satz“: gebeugte Formen und Kollokationen zählen', () => {
    expect(bridgeWordInText('We postponed it.', { word: 'postpone', kind: 'w' })).toBe(true);
    expect(bridgeWordInText('We delayed it.', { word: 'postpone', kind: 'w' })).toBe(false);
    expect(bridgeWordInText('We met all our deadlines.', { word: 'meet a deadline', kind: 'col' })).toBe(true);
  });

  it('Test-Antwort: kein JSON und ungültige Form beim ersten Aufruf', () => {
    expect(() => JSON.parse(applyBridgeReply(applyBridge.build(vars(`${GOOD} zzjson`)))) as unknown).toThrow();
    const s = vars(`${GOOD} zzschema`);
    expect(applyBridge.schema(s).safeParse(reply(s)).success).toBe(false);
    const retry = JSON.parse(applyBridgeReply(`${applyBridge.build(s)}\nYour previous reply did not match the required format.`)) as unknown;
    expect(applyBridge.schema(s).safeParse(retry).success).toBe(true);
  });
});
