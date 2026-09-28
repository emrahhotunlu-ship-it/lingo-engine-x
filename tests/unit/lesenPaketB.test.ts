import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tokenize } from '../../src/domain/text/tokenize';
import { coverageList, dialogFeedback } from '../../src/features/listen/dialogFeedback';
import { assignVoices } from '../../src/features/listen/dialogVoices';
import { boundarySpan, chunkOffsets, flatten } from '../../src/features/read/karaoke';
import { phraseSpan, PHRASE_MAX_WORDS } from '../../src/features/read/phrase';
import { followupCheckReply, listeningDialogReply, toneReadReply } from '../../src/platform/dev/canned/p4b';
import { installFakeSpeech } from '../../src/platform/dev/fakeSpeech';
import { chunkText, initSpeech, resetSpeech, speak, type VoiceInfo } from '../../src/platform/speech';
import { coverageOf, followupCheck } from '../../src/prompts/nb/p4/followupCheck';
import { accentOf, listeningDialog } from '../../src/prompts/nb/p4/listeningDialog';
import { tonesOf, toneRead } from '../../src/prompts/nb/p4/toneRead';
import { TEMPLATES } from '../../src/prompts/registry';

// Paket B, Lesen/Hören/Schreiben: Meeting mit mehreren Stimmen (B6), Ton-Erkennung (B9),
// Wendung markieren (N57), Wort-Markierung beim Vorlesen (N58).

const POINTS = ['Priya sends a cost estimate for both interfaces by Friday.', 'Oliver approves the budget next week if it is under 40,000.', 'The rollout starts with three sites in November.'];

describe('listening-dialog@1 (B6)', () => {
  it('steht im Register; Kopfzeile, Szenario und Sprache der Einordnung im Prompt', () => {
    expect(TEMPLATES).toContain(listeningDialog);
    const p = listeningDialog.build({ scenario: 'budget meeting', level: 'C1', uiLang: 'de' });
    expect(p.split('\n')[0]).toBe('[listening-dialog@1]');
    expect(p).toContain('business budget meeting between 2 or 3 people');
    expect(p).toContain('one short German sentence');
  });

  it('feste Antwort passt zum Schema (de und en), drei Sprecher mit eigenem Akzent', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const vars = { scenario: 'rollout planning call', level: 'C1' as const, uiLang };
      const r = listeningDialog.schema(vars).safeParse(JSON.parse(listeningDialogReply(listeningDialog.build(vars))));
      expect(r.success).toBe(true);
      expect(r.data?.speakers.map((s) => s.accent)).toEqual(['us', 'gb', 'in']);
      expect(r.data?.points).toHaveLength(3);
    }
  });

  it('Akzente tolerant; Zeile mit unbekanntem Sprecher und stumme Sprecher werden abgelehnt', () => {
    expect(['British', 'en-GB', 'UK', 'en-IN', 'Indian', 'Australian', 'en-AU', 'American', 'en-US', 'x'].map(accentOf)).toEqual(['gb', 'gb', 'gb', 'in', 'in', 'au', 'au', 'us', 'us', 'us']);
    const vars = { scenario: 'call', level: 'B2' as const, uiLang: 'en' as const };
    const base = JSON.parse(listeningDialogReply(listeningDialog.build(vars))) as { lines: Array<{ s: number; text: string }>; speakers: unknown[] };
    const noPriya = { ...base, lines: base.lines.filter((l) => l.s !== 2) };
    expect(listeningDialog.schema(vars).safeParse(noPriya).success).toBe(false);
    const two = { ...base, speakers: base.speakers.slice(0, 2) };
    expect(listeningDialog.schema(vars).safeParse(two).success).toBe(false);
  });
});

describe('followup-check@1 (B6) und Rückmeldung', () => {
  const vars = (mail: string, uiLang: 'de' | 'en' = 'de') => ({ points: POINTS, notes: 'Priya estimate Fri; Oliver <40k', mail, uiLang });

  it('Abdeckung tolerant lesen', () => {
    expect([true, false, 'Yes', 'covered', 'partially', 'somewhat', 'missing', 'no'].map(coverageOf)).toEqual(['yes', 'no', 'yes', 'yes', 'partly', 'partly', 'no', 'no']);
  });

  it('feste Antwort passt zum Schema; fehlende Punkte kommen als Ziel-Korrektur vor der Sprache', () => {
    const mail = 'Hi all, Priya will send the cost estimate for both interfaces by Friday. We have waited since two weeks. Thanks, Emrah';
    const v = vars(mail);
    const r = followupCheck.schema(v).safeParse(JSON.parse(followupCheckReply(followupCheck.build(v))));
    expect(r.success).toBe(true);
    const out = r.data!;
    expect(coverageList(POINTS, out)[0]).toBe('yes');
    expect(coverageList(POINTS, out)[2]).toBe('no');
    const fb = dialogFeedback(POINTS, out, { missing: '(fehlt)', why: 'Warum?' });
    expect(fb.verdict).toBe('close');
    expect(fb.fixes[0]?.kind).toBe('goal');
    expect(fb.fixes.some((f) => f.kind === 'form' && f.right === 'for two weeks')).toBe(true);
    expect(fb.upgrades?.[0]?.to).toMatch(/three sites in November/);
    expect(fb.why?.question).toBe('Warum?');
  });

  it('alles drin und keine Fehler: ok, ohne „Warum?“; nichts drin: wrong; Punkt ohne Angabe gilt als fehlend', () => {
    const all = { points: POINTS.map((_, i) => ({ i, covered: 'yes' as const, note: 'ok' })), effect: 'Clear.', fixes: [], better: 'Hi all, thanks for the call today.' };
    expect(dialogFeedback(POINTS, all, { missing: '-', why: '?' })).toMatchObject({ verdict: 'ok' });
    expect(dialogFeedback(POINTS, all, { missing: '-', why: '?' }).why).toBeUndefined();
    const none = { ...all, points: [{ i: 0, covered: 'no' as const, note: 'fehlt' }] };
    expect(coverageList(POINTS, none)).toEqual(['no', 'no', 'no']);
    expect(dialogFeedback(POINTS, none, { missing: '-', why: '?' }).verdict).toBe('wrong');
  });

  it('Punkt-Index außerhalb der Vereinbarungen wird abgelehnt', () => {
    const v = vars('Hi all, quick recap of our call today.', 'en');
    const bad = { points: [{ i: 7, covered: 'yes', note: 'Fine.' }], effect: 'Clear and short.', fixes: [], better: 'Hi all, quick recap of our call today.' };
    expect(followupCheck.schema(v).safeParse(bad).success).toBe(false);
  });
});

describe('tone-read@1 (B9)', () => {
  it('Etiketten tolerant: Synonyme, Doppeltes, Unbekanntes, Text statt Liste', () => {
    expect(tonesOf(['Polite', 'courteous', 'blunt', 'weird'])).toEqual(['polite', 'abrupt']);
    expect(tonesOf('friendly, casual')).toEqual(['friendly', 'casual']);
  });

  it('feste Antwort passt zum Schema; drängender Text wirkt drängend, mit Tipp', () => {
    const v = { text: 'Send me the numbers ASAP! We must close this today.', uiLang: 'de' as const };
    expect(toneRead.build(v).split('\n')[0]).toBe('[tone-read@1]');
    const r = toneRead.schema(v).safeParse(JSON.parse(toneReadReply(toneRead.build(v))));
    expect(r.success).toBe(true);
    expect(r.data?.tones).toContain('urgent');
    expect(r.data?.tip).not.toBe('');
    const polite = { text: 'Thank you for your time today. Could you please send the numbers when you have a moment?', uiLang: 'en' as const };
    const p = toneRead.schema(polite).safeParse(JSON.parse(toneReadReply(toneRead.build(polite))));
    expect(p.data?.tones).toEqual(['polite', 'friendly']);
    expect(p.data?.tip).toBe('');
  });
});

describe('Stimmen je Sprecher (B6)', () => {
  const v = (name: string, lang: string, local = true): VoiceInfo => ({ name, lang, local, us: lang === 'en-US' });

  it('passender Akzent zuerst, fehlende Akzente mit anderer freier Stimme', () => {
    const plan = assignVoices(['us', 'gb', 'in'], [v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Rishi', 'en-IN'), v('Karen', 'en-AU')]);
    expect(plan).toMatchObject({ names: ['Samantha', 'Daniel', 'Rishi'], distinct: 3, accents: [true, true, true] });
    const two = assignVoices(['us', 'gb', 'in'], [v('Samantha', 'en-US'), v('Daniel', 'en-GB')]);
    expect(two.names.slice(0, 2)).toEqual(['Samantha', 'Daniel']);
    expect(two.distinct).toBe(2);
    expect(two.accents).toEqual([true, true, false]);
    const other = assignVoices(['au', 'in'], [v('Samantha', 'en-US'), v('Daniel', 'en-GB')]);
    expect(new Set(other.names).size).toBe(2);
  });

  it('nur eine (oder keine) englische Stimme: sauberer Rückfall auf die Standardstimme', () => {
    expect(assignVoices(['us', 'gb'], [v('Samantha', 'en-US'), v('Anna', 'de-DE')])).toEqual({ names: [null, null], distinct: 1, accents: [false, false] });
    expect(assignVoices(['us', 'gb', 'in'], []).distinct).toBe(1);
  });
});

describe('Wendung markieren (N57)', () => {
  const text = 'We need to take the new rules into account before we sign.';
  const toks = tokenize(text);
  const at = (w: string) => {
    const s = text.indexOf(w);
    return { start: s, end: s + w.length };
  };

  it('erstes und letztes Wort (in beliebiger Reihenfolge) ergeben die Wendung', () => {
    const a = phraseSpan(text, toks, at('take'), at('account'));
    expect(a?.surface).toBe('take the new rules into account');
    expect(phraseSpan(text, toks, at('account'), at('take'))?.surface).toBe(a?.surface);
    expect(toks[a!.index]?.text).toBe('take');
  });

  it('ein Wort allein oder mehr als die Höchstzahl Wörter: keine Wendung', () => {
    expect(phraseSpan(text, toks, at('take'), at('take'))).toBeNull();
    expect(PHRASE_MAX_WORDS).toBe(8);
    expect(phraseSpan(text, toks, at('We'), at('sign'))).toBeNull();
  });
});

describe('Wort-Markierung beim Vorlesen (N58)', () => {
  it('flach machen wie die Sprachausgabe, mit Rückweg in den Originaltext', () => {
    const { flat, map } = flatten('  Hello \n  world.  ');
    expect(flat).toBe('Hello world.');
    expect(map[5]).toBe(7);
    expect(map[6]).toBe(11);
    expect(chunkOffsets('Aa. Bb. Cc.', ['Aa. Bb.', 'Cc.'])).toEqual([0, 8]);
    expect(chunkOffsets('Aa.', ['Zz.'])).toEqual([-1]);
  });

  it('Wortgrenze im zweiten Stück → Stelle im Absatz, Satzzeichen fallen weg', () => {
    const para = `${'The supplier confirmed the delivery date for the new parts. '.repeat(3)}Please update the plan.`;
    const chunks = chunkText(para);
    expect(chunks.length).toBeGreaterThan(1);
    const last = chunks.length - 1;
    const c = chunks[last]!;
    const i = c.indexOf('plan.');
    const span = boundarySpan(para, chunks, last, i, null);
    expect(span && para.slice(span[0], span[1])).toBe('plan');
    const j = c.indexOf('update');
    const s2 = boundarySpan(para, chunks, last, j, 6);
    expect(s2 && para.slice(s2[0], s2[1])).toBe('update');
    expect(boundarySpan(para, chunks, 99, 0, null)).toBeNull();
  });

  describe('speak meldet Wortgrenzen je Stück', () => {
    const win = globalThis as { window?: unknown };
    beforeEach(() => {
      vi.useFakeTimers();
      resetSpeech();
      win.window = {};
    });
    afterEach(() => {
      resetSpeech();
      delete win.window;
      vi.useRealTimers();
    });

    it('onBoundary liefert Stück, Index und Länge; ohne boundary bleibt es still', async () => {
      installFakeSpeech(win.window as object);
      initSpeech();
      const seen: Array<[number, number, number | null]> = [];
      const done = speak('Hello there. How are you?', { onBoundary: (c, i, l) => seen.push([c, i, l]) });
      await vi.runAllTimersAsync();
      await expect(done).resolves.toBe('done');
      expect(seen[0]).toEqual([0, 0, 5]);
      expect(seen.map((s) => s[1])).toEqual([0, 6, 13, 17, 21]);

      resetSpeech();
      win.window = {};
      installFakeSpeech(win.window as object, { boundary: false });
      initSpeech();
      const quiet: number[] = [];
      const d2 = speak('Hello there.', { onBoundary: (_c, i) => quiet.push(i) });
      await vi.runAllTimersAsync();
      await expect(d2).resolves.toBe('done');
      expect(quiet).toEqual([]);
    });
  });
});
