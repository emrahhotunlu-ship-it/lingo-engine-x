import { describe, expect, it } from 'vitest';
import { isWrongLang } from '../../src/domain/lang/detect';
import { validateDoc } from '../../src/data/validate';
import { loadSeed, type Doc } from './helpers';

// Sprachtest über alle Datensätze (Plan §9.1, Kap. 15 „gemischte Sprache in gespeicherten
// KI-Texten“): gespeicherte Berichte in ihrer Sprache, Wendungen passend zu `whyLang`,
// Szenen (*_de deutsch, sonst englisch), Business-Texte englisch.

const seed = loadSeed();
const entries = (prefix: string) => Object.entries(seed).filter(([p]) => p.startsWith(prefix));
const lang = (v: unknown): 'de' | 'en' => (v === 'en' ? 'en' : 'de');
const S = (v: unknown): string => (typeof v === 'string' ? v : '');

describe('Sprachtreue der Testdaten', () => {
  it('talk: Berichte vollständig in ihrer Sprache, eigene Sätze und Fassungen englisch', () => {
    const talks = entries('talk/');
    expect(talks.length).toBeGreaterThan(0);
    for (const [path, doc] of talks) {
      expect(validateDoc(path, doc).ok, path).toBe(true);
      for (const run of (doc.runs as Doc[]) ?? []) {
        for (const l of (run.lines as Doc[]) ?? []) {
          expect(isWrongLang(S(l.u), 'en'), S(l.u)).toBe(false);
          if (l.up) expect(isWrongLang(S(l.up), 'en'), S(l.up)).toBe(false);
        }
        const rep = run.report as Doc | null;
        if (!rep) continue;
        const L = lang(rep.lang);
        const texts = [S((rep.goal as Doc).why), S(rep.summary), ...((rep.strengths as Doc[]) ?? []).map((s) => S(s.why)), ...((rep.focus as Doc[]) ?? []).flatMap((f) => [S(f.title), S(f.why)])];
        for (const t of texts) expect(isWrongLang(t, L), `${path} ${L}: ${t}`).toBe(false);
        for (const f of (rep.focus as Doc[]) ?? []) expect(isWrongLang(S(f.better), 'en'), S(f.better)).toBe(false);
      }
    }
  });

  it('chunk: Begründung passt zu whyLang (ohne Angabe: Deutsch), Wendung und Ursprungssätze englisch', () => {
    for (const [path, doc] of entries('chunk/')) {
      if (doc.why) expect(isWrongLang(S(doc.why), lang(doc.whyLang)), path).toBe(false);
      expect(isWrongLang(S(doc.en), 'en'), path).toBe(false);
      const src = doc.src && typeof doc.src === 'object' ? (doc.src as Doc) : {};
      for (const k of ['utterance', 'upgraded']) if (src[k]) expect(isWrongLang(S(src[k]), 'en'), `${path}.${k}`).toBe(false);
    }
  });

  it('chunk: Ursprungssatz enthält die Wendung (Kap. 15: keine Karten ohne Ursprungssatz)', async () => {
    const { containsPhrase } = await import('../../src/domain/chunks/newChunk');
    for (const [path, doc] of entries('chunk/')) {
      const src = doc.src && typeof doc.src === 'object' ? (doc.src as Doc) : null;
      if (src?.upgraded) expect(containsPhrase(S(src.upgraded), S(doc.en)), path).toBe(true);
    }
  });

  it('scene: *_de deutsch, übrige Texte englisch', () => {
    for (const [path, doc] of entries('scene/')) {
      for (const [k, v] of Object.entries(doc)) {
        // Titel sind kurze Bezeichnungen (Fachwörter wie „On-Premise“) – geprüft werden ganze Sätze.
        if (typeof v !== 'string' || ['id', 'src', 'pv', 'level', 'gram', 'title', 'title_de'].includes(k)) continue;
        expect(isWrongLang(v, k.endsWith('_de') ? 'de' : 'en'), `${path}.${k}`).toBe(false);
      }
    }
  });

  it('biz: Mails und Präsentationsversuche englisch, Zusammenfassung in der Sprache des Eintrags', () => {
    for (const [path, doc] of entries('biz/')) {
      expect(validateDoc(path, doc).ok, path).toBe(true);
      for (const it of (doc.items as Doc[]) ?? []) {
        for (const k of ['orig', 'final', 'attempt']) if (it[k]) expect(isWrongLang(S(it[k]), 'en'), `${path} ${k}`).toBe(false);
        if (it.summary) expect(isWrongLang(S(it.summary), lang(it.lang)), `${path} summary`).toBe(false);
      }
    }
  });
});
