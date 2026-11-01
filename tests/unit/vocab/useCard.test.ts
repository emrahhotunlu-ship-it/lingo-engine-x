import { describe, expect, it } from 'vitest';
import { vmDe } from '../../../src/i18n/parts/vm.de';
import { vmEn } from '../../../src/i18n/parts/vm.en';
import type { VocabAi } from '../../../src/modules/vocab/aiPort';
import { SIT_COUNT, type UseModel, type UseTarget } from '../../../src/modules/vocab/domain/use';
import { TRANSFER_FRAMES } from '../../../src/modules/vocab/prompts/transfer';
import { makeUseAi } from '../../../src/modules/vocab/ui/aiCheck';
import { UseFail } from '../../../src/modules/vocab/ui/learnRun';
import { sitKey } from '../../../src/modules/vocab/ui/UseCard';

// Großpaket A S5c-3: Anwenden-Karte – Lagen-Texte vollständig in beiden Sprachen, Brücke zu Claude (Vorlage, Abbildung, Fehler).

const target = (key: string, word: string, lv = 5): UseTarget => ({
  path: `vocab/${word}`,
  key,
  head: word,
  word,
  de: 'x',
  kind: 'w',
  lv,
  example: `We ${word} it.`,
  shows: [],
  partners: [],
});
const model = (over: Partial<UseModel> = {}): UseModel => ({ form: 'transfer', targets: [target('w1', 'scope'), target('w2', 'rely on')], frame: 'mail', sit: 2, evidence: false, ...over });

type Call = { tier: string | undefined; vars: Record<string, unknown> };
function fakeAi(out: unknown, err?: string): { ai: VocabAi; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    ai: {
      ready: () => true,
      ask: (tpl, vars) => {
        calls.push({ tier: (tpl as { tier?: string }).tier, vars: vars as Record<string, unknown> });
        return err ? Promise.reject(new Error(err)) : Promise.resolve(out as never);
      },
      fail: (e) => (e instanceof Error && e.message === 'stop' ? { kind: 'cancelled', key: null } : { kind: 'retry', key: 'aiFailed' }),
    },
  };
}
const sig = new AbortController().signal;

describe('Lagen-Texte', () => {
  it('jede Lage, jeder Rahmen und Ton in DE und EN vorhanden und nicht leer', () => {
    const de = vmDe as Record<string, string>;
    const en = vmEn as Record<string, string>;
    for (const f of TRANSFER_FRAMES) {
      for (const k of [`vmFrame_${f}`, `vmTone_${f}`, ...Array.from({ length: SIT_COUNT }, (_, i) => `vmSit_${f}_${i}`)]) {
        expect(de[k]?.trim(), k).toBeTruthy();
        expect(en[k]?.trim(), k).toBeTruthy();
      }
    }
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
  });

  it('eigener Satz ab Stufe 6 frei (ohne Lage), sonst Lage je Rahmen', () => {
    expect(sitKey(model())).toBe('vmSit_mail_2');
    expect(sitKey(model({ form: 'own', targets: [target('w1', 'scope', 5)] }))).toBe('vmSit_mail_2');
    expect(sitKey(model({ form: 'own', targets: [target('w1', 'scope', 6)] }))).toBeNull();
  });
});

describe('makeUseAi', () => {
  const tOut = { words: [{ key: 'w1', v: 'ok', err: null, at: 'scope', why: '' }], extra: null, fixed: 'f', better: 'b' };

  it('Anwenden: Lage-Text und Sprache gehen mit; Einspruch nimmt die Prüfstufe complex', async () => {
    const f = fakeAi(tOut);
    const u = makeUseAi(f.ai, () => 'Sag den Termin ab.', () => 'de');
    const r = await u.check({ m: model(), text: 'hi', spoken: true, first: null }, sig);
    expect(r).toEqual({ ...tOut, fixedUnsure: false });
    expect(f.calls[0]!.vars).toMatchObject({ frame: 'mail', task: 'Sag den Termin ab.', text: 'hi', spoken: true, uiLang: 'de' });
    expect(f.calls[0]!.tier).not.toBe('complex');
    await u.check({ m: model(), text: 'hi', spoken: false, first: [{ key: 'w1', v: 'odd', err: 'form', why: 'x' }] }, sig);
    expect(f.calls[1]!.tier).toBe('complex');
    expect(f.calls[1]!.vars.first).toEqual([{ key: 'w1', v: 'odd', err: 'form', why: 'x' }]);
  });

  it('eigener Satz: ein Urteil unter der Kennung des Ziels; freier Satz ohne Lage', async () => {
    const f = fakeAi({ v: 'wrong', err: 'prep', at: 'rely of', why: 'w', extra: null, fixed: 'f', better: 'b' });
    const u = makeUseAi(f.ai, () => null, () => 'en');
    const m = model({ form: 'own', targets: [target('w1', 'rely on', 7)] });
    const r = await u.check({ m, text: 'I rely of you.', spoken: false, first: null }, sig);
    expect(r.words).toEqual([{ key: 'w1', v: 'wrong', err: 'prep', at: 'rely of', why: 'w' }]);
    expect(f.calls[0]!.vars).toMatchObject({ sentence: 'I rely of you.', task: null, uiLang: 'en' });
    await u.check({ m, text: 'x', spoken: false, first: [{ key: 'w1', v: 'wrong', err: 'prep', why: 'w' }] }, sig);
    expect(f.calls[1]!.vars.first).toEqual({ v: 'wrong', err: 'prep', why: 'w' });
  });

  it('Fehler werden zu UseFail mit Art und Hinweis', async () => {
    await expect(makeUseAi(fakeAi(null, 'boom').ai, () => '', () => 'de').check({ m: model(), text: 'x', spoken: false, first: null }, sig)).rejects.toMatchObject({ kind: 'retry', key: 'aiFailed' });
    await expect(makeUseAi(fakeAi(null, 'stop').ai, () => '', () => 'de').check({ m: model(), text: 'x', spoken: false, first: null }, sig)).rejects.toBeInstanceOf(UseFail);
  });
});
