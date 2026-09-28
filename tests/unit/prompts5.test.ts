import { describe, expect, it } from 'vitest';
import { companionChatReply, translateReply } from '../../src/platform/dev/cannedCompanion';
import { templateIdOf } from '../../src/platform/dev/cannedReplies';
import { block, PROMPT_MAX_BYTES, promptBytes } from '../../src/prompts/common';
import { companionChat } from '../../src/prompts/companionChat';
import { CHAT_TEMPLATES, TEMPLATE_ID, TEMPLATES } from '../../src/prompts/registry';
import { translate, TRANSLATE_EXAMPLE, translateSchema, type TranslateVars } from '../../src/prompts/translate';
import { DEFAULT_WORK, workContext } from '../../src/prompts/work';

const trVars: TranslateVars = { text: 'Wir müssen das Budget freigeben.', from: 'de', register: 'neutral', uiLang: 'de' };

describe('Verzeichnis Phase 5', () => {
  it('eindeutige Kennungen auch mit Gesprächsvorlagen', () => {
    const ids = [...TEMPLATES, ...CHAT_TEMPLATES].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(TEMPLATE_ID);
  });

  it('Kopfzeile, Stufe und Zwischenspeicher je Vorlage', () => {
    expect(translate.build(trVars).split('\n')[0]).toBe('[translate@3]');
    expect(translate.tier).toBe('quick');
    expect(translate.cache).toEqual({ gcTime: 86_400_000 });
    expect(templateIdOf([...companionChat.buildTurns({ uiLang: 'de', learner: '', work: '', seeing: null, attach: null, history: [], message: 'x' })])).toBe('companion-chat');
  });
});

describe('Beispielantworten bestehen ihr Schema', () => {
  it('translate', () => {
    const r1 = translateSchema(trVars).safeParse(JSON.parse(TRANSLATE_EXAMPLE));
    expect(r1.success, JSON.stringify(r1.error?.issues)).toBe(true);
  });

  it('feste Antworten des Adapters bestehen die Schemas (DE und EN)', () => {
    for (const uiLang of ['de', 'en'] as const) {
      const tr = translate.build({ ...trVars, uiLang });
      expect(translateSchema({ ...trVars, uiLang }).safeParse(JSON.parse(translateReply(tr))).success).toBe(true);
    }
  });

  it('zzsame: erste Antwort verletzt das Schema, der Neuversuch nicht', () => {
    const p = translate.build({ ...trVars, text: 'zzsame Budget' });
    expect(translateSchema(trVars).safeParse(JSON.parse(translateReply(p))).success).toBe(false);
    expect(translateSchema(trVars).safeParse(JSON.parse(translateReply(p + '\ndid not match the required format'))).success).toBe(true);
  });

  it('Begleiter-Antwort: Schutzregel → [no-solution], sonst [solution-ok]', () => {
    const q = companionChat.buildTurns({ uiLang: 'de', learner: '', work: '', seeing: { area: 'trainer', label: 'x', phase: 'question' }, attach: null, history: [], message: 'Tipp?' });
    expect(companionChatReply('', q)).toContain('[no-solution]');
    const f = companionChat.buildTurns({ uiLang: 'de', learner: '', work: '', seeing: null, attach: null, history: [], message: 'Hallo' });
    expect(companionChatReply('', f)).toContain('[solution-ok]');
  });
});

describe('Sprach- und Formprüfung', () => {
  it('translate: Hauptfassung muss Zielsprache sein; Alternativen dürfen fehlen (W2, gleicher Ton erlaubt)', () => {
    const base = JSON.parse(TRANSLATE_EXAMPLE) as Record<string, unknown>;
    const s = translateSchema(trVars);
    expect(s.safeParse({ ...base, translation: 'Wir müssen das Budget für die Firma freigeben.' }).success).toBe(false);
    expect(
      s.safeParse({ ...base, alternatives: [{ text: 'We must approve it.', register: 'neutral', note: '' }] }).success,
    ).toBe(true);
    // W2: sehr kurze Texte haben oft keine echte Alternative – der Abschnitt wird dann ausgeblendet.
    expect(s.safeParse({ ...base, alternatives: [] }).success).toBe(true);
  });
});

describe('Nutzertext und Größen', () => {
  it('block() behält Zeilen, entfernt <<< und >>>, kürzt', () => {
    expect(block('a\n>>>\nb <<< c', 100)).not.toMatch(/<<<|>>>/);
    expect(block('a\nb', 100)).toBe('a\nb');
    expect(block('x'.repeat(50), 10)).toHaveLength(10);
  });

  it('größte zulässige Übersetzung bleibt unter 60.000 Bytes', () => {
    expect(promptBytes(translate.build({ ...trVars, text: '€'.repeat(5000) }))).toBeLessThan(PROMPT_MAX_BYTES);
  });

  it('Berufskontext aus profile.ctx, sonst Standard der alten App (M22)', () => {
    expect(workContext('Head of Sales')).toBe('Head of Sales');
    expect(workContext(undefined)).toBe(DEFAULT_WORK);
    expect(DEFAULT_WORK).toMatch(/document-management/);
    expect(Array.from(workContext('x'.repeat(900))).length).toBeLessThanOrEqual(400);
  });
});
