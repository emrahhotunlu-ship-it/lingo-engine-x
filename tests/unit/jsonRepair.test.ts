import { describe, expect, it } from 'vitest';
import { parseJsonText, repairJson } from '../../src/ai/gate';

// Echte Antworten aus Emrahs Diagnose (27.09.): deutsche Anführungszeichen „…" mit geradem
// Schlusszeichen machten jede Antwort unlesbar („Die Antwort von Claude war unvollständig“).
describe('JSON-Reparatur echter Antworten', () => {
  it('Übersetzer: „Play" kann „Abspielen" … in einem Hinweis', () => {
    const reply = '```json\n{\n  "source": "en",\n  "translation": "Spielen",\n  "register": "neutral",\n  "alternatives": [],\n  "notes": [\n    "Im geschäftlichen Kontext: „Play" kann „Abspielen" (Video/Audio), „Spielen" (Spiel) oder „eine Rolle spielen" bedeuten. Kontext erforderlich."\n  ],\n  "terms": [{ "en": "to play", "de": "spielen" }]\n}\n```';
    const v = parseJsonText(reply) as { notes: string[]; translation: string; terms: unknown[] };
    expect(v.translation).toBe('Spielen');
    expect(v.notes[0]).toContain('„Play“ kann „Abspielen“');
    expect(v.terms).toHaveLength(1);
  });

  it('Merkhilfe: mehrere „…" in einem Satz', () => {
    const reply = '```json\n{"text":"eventually klingt wie „eventuell" – aber eventually bedeutet nicht „möglicherweise", sondern „am Ende" oder „schließlich". Denk an: „Eventually we arrived" = „Endlich/Schließlich sind wir angekommen"."}\n```';
    const v = parseJsonText(reply) as { text: string };
    expect(v.text).toContain('„möglicherweise“, sondern „am Ende“');
  });

  it('gerades Anführungszeichen mitten im englischen Text wird maskiert', () => {
    const v = parseJsonText('{"why":"Say "on the weekend" in US English.","ok":true}') as { why: string; ok: boolean };
    expect(v).toEqual({ why: 'Say "on the weekend" in US English.', ok: true });
  });

  it('gültiges JSON bleibt unverändert, Struktur-Anführungszeichen bleiben erhalten', () => {
    const good = '{"a":"x, y","b":["„ok“","z"],"c":{"d":"e"}}';
    expect(repairJson(good)).toBe(good);
    expect(parseJsonText(good)).toEqual({ a: 'x, y', b: ['„ok“', 'z'], c: { d: 'e' } });
  });

  it('abgeschnittene Antwort bleibt unlesbar (kein Raten)', () => {
    expect(parseJsonText('```json\n{"translation":"Play","notes":["„Play" kann')).toBeUndefined();
  });
});
