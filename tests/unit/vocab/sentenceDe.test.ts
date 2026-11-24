import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { oneSentence, sentencesOf } from '../../../src/modules/vocab/domain/card';
import { exDeKey } from '../../../src/domain/srs/exDeKey';
import { translate } from '../../../src/prompts/translate';
import { translateReply } from '../../../src/platform/dev/cannedCompanion';
import type * as Scope from '../../../src/ai/scope';

// Live-Kommentar 24.11.2026 (Wörter-Karte, Rückmeldung zu „During the meeting, Sarah brought up …“): „Warum wird an dieser Stelle nicht die
// deutsche Übersetzung angezeigt oder mindestens angeboten?“ Ursache: Die Rückmeldung zeigte den Satz nie auf Deutsch, und die meisten Sätze haben
// keine gespeicherte Übersetzung (`xEx` hat kein `de`, gekürzte Sätze verlieren sie). Jetzt: gespeichert → sichtbar, sonst „Auf Deutsch“ auf Tipp.

const ai = vi.hoisted(() => ({ on: true }));
vi.mock('../../../src/ai/scope', async (orig) => ({ ...(await orig<typeof Scope>()), useAiAvailable: () => ai.on }));
const { SentenceDe } = await import('../../../src/ui/exercise/SentenceDe');

const EN = 'During the meeting, Sarah brought up the delay in the delivery schedule.';
const html = (de: string | null, en = EN): string => renderToStaticMarkup(createElement(SentenceDe, { en, de }));

afterEach(() => {
  ai.on = true;
});

describe('Ursache: viele Lücken-Sätze haben keine gespeicherte Übersetzung', () => {
  it('xEx-Sätze tragen kein de; mit exDe des Satzes ist sie da', () => {
    const doc = { word: 'to bring up', xEx: [{ en: EN, t: 1 }] };
    expect(sentencesOf(doc, 2, null).find((s) => s.src === 'xex')?.de).toBeNull();
    const withDe = { ...doc, exDe: { [exDeKey(EN)]: 'In der Besprechung sprach Sarah die Verzögerung an.' } };
    expect(sentencesOf(withDe, 2, null).find((s) => s.src === 'xex')?.de).toBe('In der Besprechung sprach Sarah die Verzögerung an.');
  });
  it('ein auf einen Satz gekürzter Text verliert die Übersetzung des ganzen Texts', () => {
    const s = oneSentence({ key: 'a', en: `We met at nine. ${EN}`, de: 'Ganzer Text.', src: 'ex' }, 'bring up', true);
    expect(s.en).toBe(EN);
    expect(s.de).toBeNull();
  });
});

describe('Rückmeldung: Satz auf Deutsch', () => {
  it('gespeicherte Übersetzung: immer sichtbar, kein Knopf', () => {
    const h = html('In der Besprechung sprach Sarah die Verzögerung an.');
    expect(h).toContain('data-testid="vm-sent-de-text"');
    expect(h).toContain('In der Besprechung sprach Sarah die Verzögerung an.');
    expect(h).toContain('Der Satz auf Deutsch');
    expect(h).not.toContain('vm-sent-de-btn');
  });
  it('gespeicherte Übersetzung auch ohne Claude', () => {
    ai.on = false;
    expect(html('Übersetzung.')).toContain('Übersetzung.');
  });
  it('keine Übersetzung, Claude da: Knopf „Auf Deutsch“ (nichts von selbst gefragt)', () => {
    const h = html(null);
    expect(h).toContain('data-testid="vm-sent-de-btn"');
    expect(h).toContain('Auf Deutsch');
    expect(h).not.toContain('vm-sent-de-text');
    // Knopfform .lx-kspeak: mindestens 44 px hoch (Touch).
    expect(h).toContain('lx-kspeak');
  });
  it('keine Übersetzung, kein Claude: nichts', () => {
    ai.on = false;
    expect(html(null)).toBe('');
  });
  it('der Knopf fragt genau diesen Satz über translate@3 (quick, zwischengespeichert); die feste Testantwort ist Deutsch und gültig', () => {
    expect(translate.tier).toBe('quick');
    expect(translate.cache).toBeTruthy();
    const vars = { text: EN, from: 'en' as const, register: 'neutral' as const, uiLang: 'de' as const };
    const prompt = translate.build(vars);
    expect(prompt).toContain(EN);
    expect(prompt).toContain('To: German');
    const out = translate.schema(vars).parse(JSON.parse(translateReply(prompt)));
    expect(out.translation).toMatch(/Übersetzung/);
  });
});
