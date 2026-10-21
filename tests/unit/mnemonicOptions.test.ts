import { describe, expect, it } from 'vitest';
import { MNEMONIC_OPTIONS_EXAMPLE, mnemonicOptions, type MnemonicOptionsVars } from '../../src/prompts/mnemonicOptions';
import { TEMPLATES } from '../../src/prompts/registry';
import { mnemonicOptionsReply } from '../../src/platform/dev/canned/werkstatt';

const vars = (uiLang: 'de' | 'en' = 'de'): MnemonicOptionsVars => ({
  uiLang,
  ctx: 'Role: sales manager (logistics). Situations: weekly team meeting; client call; budget review.',
  words: [
    { id: 'v_leverage', en: 'to leverage', meaning: 'nutzen, einsetzen', sentence: 'We can leverage our data to win the deal.', issue: 'meaning', other: '' },
    { id: 'v_postpone', en: 'postpone', meaning: 'verschieben', sentence: 'We had to postpone the launch.', issue: 'confusion', other: 'delay' },
  ],
});

describe('mnemonic-options@1', () => {
  it('ist registriert, Kopfzeile und Eingabe < 64 KiB', () => {
    expect(TEMPLATES.some((t) => t.id === 'mnemonic-options')).toBe(true);
    const p = mnemonicOptions.build(vars());
    expect(p.startsWith('[mnemonic-options@1]')).toBe(true);
    expect(p).toContain('Learner work context: Role: sales manager');
    expect(p).toContain('typed or confused with=delay');
    expect(new TextEncoder().encode(p).length).toBeLessThan(64 * 1024);
  });

  it('die Beispielantwort besteht das Schema (ein Wort)', () => {
    const v: MnemonicOptionsVars = { ...vars(), words: [vars().words[0]!] };
    expect(mnemonicOptions.schema(v).safeParse(JSON.parse(MNEMONIC_OPTIONS_EXAMPLE)).success).toBe(true);
  });

  it('die feste Testantwort besteht das Schema in beiden Sprachen', () => {
    for (const lang of ['de', 'en'] as const) {
      const v = vars(lang);
      const out = mnemonicOptions.schema(v).safeParse(JSON.parse(mnemonicOptionsReply(mnemonicOptions.build(v))));
      expect(out.success).toBe(true);
    }
  });

  it('lehnt ab: unbekannte Kennung, Wort fehlt, zwei gleiche Vorschläge', () => {
    const s = mnemonicOptions.schema(vars());
    expect(s.safeParse({ items: [{ id: 'x', options: ['Denk an leverage als Hebel im Gespräch.', 'Leverage ist wie ein Hebel im Verkauf.'] }] }).success).toBe(false);
    expect(s.safeParse({ items: [{ id: 'v_leverage', options: ['Denk an einen Hebel im Gespräch.', 'Ein Hebel im Verkauf hilft dir.'] }] }).success).toBe(false);
    expect(s.safeParse({ items: [{ id: 'v_leverage', options: ['Denk an leverage als Hebel.', 'Denk an leverage als Hebel.'] }] }).success).toBe(false);
  });

  it('Lehrer-Prüfung 21.10.2026: keine erfundenen Gleichklänge, echte Wortteile, Partnerwort mitgegeben', () => {
    const p = mnemonicOptions.build(vars());
    expect(MNEMONIC_OPTIONS_EXAMPLE).not.toContain('Hebel-Ritsch');
    expect(MNEMONIC_OPTIONS_EXAMPLE).toContain('In leverage steckt lever');
    expect(p).toContain('- Option 1 (hook): use a REAL sound or spelling link only if the English word truly sounds or looks like the German word you name');
    expect(p).toContain('Never invent a sound-alike.');
    expect(p).toContain('Never invent etymology. Only state a word origin if it is true.');
    expect(p).toContain('(e.g. not "nutzen = leverage")');
    expect(p).toContain('say in which situation each one is used');
    expect(p).toContain('the hook must target the tricky letters');
    expect(p).toContain('British forms are not errors');
    const partner = mnemonicOptions.build({ ...vars(), words: [{ ...vars().words[0]!, issue: 'partner', other: 'leverage our network' }] });
    expect(partner).toContain('missed partner phrase=leverage our network');
    expect(partner).not.toContain('typed or confused with=');
  });

  it('eine deutsche Merkhilfe mit kurzer englischer Wendung besteht die Sprachprüfung', () => {
    const s = mnemonicOptions.schema(vars());
    const options = [
      'In leverage steckt lever – der Hebel. Du setzt etwas, das du schon hast, als Hebel ein.',
      'Im Kundengespräch sagst du: „We can leverage our data to win the deal.“ Du setzt eure Daten als Hebel ein.',
    ];
    expect(s.safeParse({ items: [{ id: 'v_leverage', options }] }).success).toBe(true);
  });

  it('liest tolerant: nacktes Array, höchstens zwei Einträge', () => {
    const s = mnemonicOptions.schema(vars());
    const item = { id: 'v_postpone', options: ['Bei postpone denkst du an die Post, die später kommt.', 'Im Meeting sagst du: Wir müssen den Termin postponen, nicht absagen.'] };
    expect(s.safeParse([item]).success).toBe(true);
  });
});
