import { describe, expect, it } from 'vitest';
import { atlasEntries } from '../../src/domain/atlas/atlas';
import { PACK } from '../../src/domain/c1pack/pack';
import { atlasCounts } from '../../src/domain/metrics';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

// UX-Prüfung W3: Wortzahlen aus EINER Quelle, jede Zahl mit ihrer Bedeutung beschriftet.

describe('Atlas-Zahlen', () => {
  it('eine Quelle: Wörter + C1-Paket = Einträge, gleich wie im Atlas-Bildschirm gezählt', () => {
    const c = atlasCounts();
    expect(c.words).toBe(atlasEntries().length);
    expect(c.pack).toBe(PACK.length);
    expect(c.total).toBe(c.words + c.pack);
  });
  it('Texte nennen die Bedeutung jeder Zahl (Einträge, Wörter, C1-Paket, Ziel)', () => {
    for (const k of ['hxWsAtlasSub', 'atLead'] as const) {
      expect(de[k]).toContain('{words}');
      expect(de[k]).toContain('{pack}');
      expect(en[k]).toContain('{words}');
      expect(en[k]).toContain('{pack}');
    }
    expect(de.nbWsHGoalEyebrow).not.toMatch(/Atlas/);
    expect(en.nbWsHGoalEyebrow).not.toMatch(/Atlas/);
  });
});
