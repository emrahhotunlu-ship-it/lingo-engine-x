import { describe, expect, it, vi } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { isReadOnlyPath } from '../../../src/data/paths';
import { loadLazyBackup } from '../../../src/data/snapshot';
import { applyColCharge } from '../../../src/features/vocab/colCharge';
import { readDocCountOf } from '../../../src/modules/read/domain/count';
import { acceptLesson } from '../../../src/modules/read/domain/lesson';
import { readApply } from '../../../src/modules/read/prompt';
import { rdDe } from '../../../src/modules/read/i18n/rd.de';
import { rdEn } from '../../../src/modules/read/i18n/rd.en';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { seedLesson } from './fixtures';

// Prüfung 14.10.2026 (Datenwächter, Lernwissenschaft H3, Englischlehrer Teil B): Schreibschutz für Routine-Dokumente, Zählung mit Kursdokumenten, Lerntag in der
// Sicherung, Kurslektionen mit englischen Zusatztexten (`*_en`), Warum ohne Claude.

describe('Datenwächter: die App schreibt nie auf read/c-* und read/r-*', () => {
  it('isReadOnlyPath: Kurslektionen und Routine-Tagesdokumente ja; eigene App-Dokumente nein', () => {
    for (const p of ['read/c-k1-01', 'read/c-k5-10', 'read/r-2026-10-14', 'daily/2026-10-14', 'feed/2026-10-14']) expect(isReadOnlyPath(p), p).toBe(true);
    for (const p of ['read/cp', 'read/p', 'read/d-2026-10-14', 'read/m-2026-10', 'vocab/leverage', 'read/c-k1-1', 'read/r-heute']) expect(isReadOnlyPath(p), p).toBe(false);
  });
  it('der Writer verweigert jeden Schreibzugriff darauf (set, update, transform, acquire)', async () => {
    const h = createMemoryDb({ seed: { 'read/c-k1-01': { v: 1 }, 'read/r-2026-10-14': { v: 1 } } });
    const w = createWriter(h.db);
    // Der Wächter wirft sofort (noch vor der Warteschlange): synchron oder als abgelehntes Versprechen – beides zählt als Verweigerung.
    const refused = async (fn: () => unknown): Promise<string | null> => {
      try {
        await fn();
      } catch (e) {
        return (e as { code?: string }).code ?? 'other';
      }
      return null;
    };
    for (const path of ['read/c-k1-01', 'read/c-k1-02', 'read/r-2026-10-14']) {
      expect(await refused(() => w.set(path, { v: 1, x: 1 })), `set ${path}`).toBe('read_only');
      expect(await refused(() => w.patch(path, { x: 1 })), `patch ${path}`).toBe('read_only');
      expect(await refused(() => w.update(path, { x: 1 })), `update ${path}`).toBe('read_only');
      expect(await refused(() => w.createIfMissing(path, { v: 1 })), `createIfMissing ${path}`).toBe('read_only');
      expect(await refused(() => w.transform(path, () => ({ set: { v: 1 } }))), `transform ${path}`).toBe('read_only');
      expect(await refused(() => w.acquire(path, { holder: 'tab-a' })), `acquire ${path}`).toBe('read_only');
    }
    expect(h.dump()['read/c-k1-01']).toEqual({ v: 1 });
    // der eigene Kursfortschritt bleibt beschreibbar
    expect(await refused(() => w.set('read/cp', { v: 1, items: [] }))).toBeNull();
  });
});

describe('Datenwächter: Dokumentzählung der Sammlung read', () => {
  it('readDocCountOf zählt read/cp und je ein Lektionsdokument je Lektion im Fortschritt', () => {
    const prefs = { days: ['2026-09-17', '2026-09-19'] };
    expect(readDocCountOf(prefs)).toBe(1 + 2 + 1);
    expect(readDocCountOf(prefs, { v: 1, items: [{ id: 'k1-01' }, { id: 'k1-02' }, { id: 'k1-02' }, { id: 'k5-01' }] })).toBe(1 + 2 + 1 + 1 + 3);
    expect(readDocCountOf(prefs, { v: 1, items: [] })).toBe(1 + 2 + 1 + 1);
    // ohne read/p zählt der Kursfortschritt allein
    expect(readDocCountOf(undefined, { v: 1, items: [{ id: 'k1-01' }] })).toBe(2);
    expect(readDocCountOf(undefined)).toBe(0);
  });
});

describe('Datenwächter: Sicherung rechnet mit dem Lerntag, nicht mit UTC', () => {
  it('zwischen 0 und 4 Uhr gilt noch der Vortag (Routine-Dokumente der letzten 14 Tage, Monatssuche)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      // 03:30 am 15.10. in Berlin = 01:30 UTC am 15.10.: der Lerntag ist noch der 14.10. (der UTC-Tag wäre schon der 15.10.)
      vi.setSystemTime(new Date('2026-10-15T03:30:00+02:00'));
      const asked: string[] = [];
      const h = createMemoryDb({ seed: { 'read/p': { v: 1, days: ['2026-10-01'] }, 'read/m-2026-10': { v: 1, items: [] } } });
      const db = { ...h.db, doc: (path: string) => { asked.push(path); return h.db.doc(path); } };
      await loadLazyBackup(db);
      const routine = asked.filter((p) => p.startsWith('read/r-'));
      expect(routine).toContain('read/r-2026-10-14');
      expect(routine).not.toContain('read/r-2026-10-15');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Datenwächter: colCharge prüft Schema und Größe vor dem Schreiben', () => {
  it('eine ungültige oder zu große Karte bleibt unberührt', async () => {
    // Ohne Writer (kein getWriter) meldet applyColCharge alles als gescheitert; die Prüfung selbst läuft im transform-Callback (Quelltext-Wächter).
    const res = await applyColCharge([{ id: 'zzz', word: 'leverage', col: [] }]);
    expect(res.written).toEqual([]);
    expect(res.failed.concat(res.skipped)).toContain('zzz');
  });
});

describe('Lernwissenschaft H3: Kurslektionen mit englischen Zusatztexten', () => {
  const doc = (): Record<string, unknown> => structuredClone(seedLesson(1));
  it('der Seed bringt Ziel, Lage, Tipp-Begründung und Fragen-Begründung auch auf Englisch mit; acceptLesson übernimmt sie', () => {
    const r = acceptLesson(doc(), { course: 'k1', n: 1 });
    expect(r.ok, r.ok ? '' : r.reason).toBe(true);
    if (!r.ok) return;
    expect(r.lesson.goalEn).toMatch(/^You can explain/);
    expect(r.lesson.tip.whyEn).toMatch(/present perfect/);
    expect(r.lesson.apply.situationEn).toMatch(/^Your colleague/);
    expect(r.lesson.check.every((q) => !!q.why_en)).toBe(true);
    // Deutsch bleibt daneben unverändert
    expect(r.lesson.goal).toMatch(/^Du kannst/);
  });
  it('ohne `_en`-Felder besteht die Lektion weiter (Rückfall auf Deutsch)', () => {
    const d = doc();
    delete d.lessonGoal_en;
    delete (d.tip as Record<string, unknown>).why_en;
    delete (d.apply as Record<string, unknown>).situation_en;
    for (const q of d.check as Array<Record<string, unknown>>) delete q.why_en;
    const r = acceptLesson(d, { course: 'k1', n: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lesson.goalEn).toBeUndefined();
      expect(r.lesson.tip.whyEn).toBeUndefined();
      expect(r.lesson.apply.situationEn).toBeUndefined();
      expect(r.lesson.check.some((q) => q.why_en)).toBe(false);
    }
  });
  it('ein `_en`-Feld in falscher Sprache (Deutsch) oder zu kurz wird still verworfen, die Lektion bleibt gültig', () => {
    const d = doc();
    d.lessonGoal_en = 'Du kannst erklären, was Claude Code ist und wo seine Grenzen liegen.';
    (d.tip as Record<string, unknown>).why_en = 'kurz';
    (d.check as Array<Record<string, unknown>>)[0]!.why_en = 'Die Lektion beschreibt Claude Code als Assistenten, der am echten Projekt arbeitet.';
    const r = acceptLesson(d, { course: 'k1', n: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.lesson.goalEn).toBeUndefined();
      expect(r.lesson.tip.whyEn).toBeUndefined();
      expect(r.lesson.check[0]!.why_en).toBeUndefined();
      expect(r.lesson.check[1]!.why_en).toBeTruthy();
    }
  });
  it('die Prüffrage 3 beider Seed-Lektionen nennt die Wendung in Anführungszeichen; die richtige Antwort ist nicht regelmäßig die längste (Englischlehrer B4)', () => {
    for (const n of [1, 2] as const) {
      const d = seedLesson(n) as { check: Array<{ q: string; o: string[]; a: number }> };
      expect(d.check[2]!.q).toMatch(/"[^"]+"/);
      const longest = d.check.filter((q) => q.o[q.a]!.length === Math.max(...q.o.map((o) => o.length))).length;
      expect(longest, `Lektion ${n}`).toBeLessThanOrEqual(1);
    }
  });
  it('Warum ohne Claude und die neuen Texte stehen in beiden Sprachen', () => {
    for (const k of ['rdcWarmWhy', 'rdcTipFind', 'rdcTipReveal', 'rdcApplyModelUse', 'rdcClaudeNoFix', 'rdcRestToday', 'rdcDoneForToday', 'rdcNextNow', 'rdcMoreCourses', 'rdcApplyHintLong'] as const) {
      expect((rdDe as Record<string, string>)[k], `de ${k}`).toBeTruthy();
      expect((rdEn as Record<string, string>)[k], `en ${k}`).toBeTruthy();
    }
    // kein „Heute:“ als Pflichtwort im Lektionsknopf, kein Umbruch zwischen Zahl und Einheit
    expect((rdDe as Record<string, string>).rdcToday).not.toMatch(/Heute/);
    expect((rdDe as Record<string, string>).rdcToday).toContain(' Min');
    expect((rdEn as Record<string, string>).rdcToday).toContain(' min');
  });
  it('read-apply: die Erklärung steht in der Oberflächensprache (Prompt und Schema)', () => {
    const v = { situation: 'Your colleague asks what Claude Code is.', targets: ['stay in control', 'handle routine chores'], model: ['I stay in control.', 'It can handle routine chores.'], text: 'I stay in control. It can handle routine chores for me.', uiLang: 'en' as const };
    expect(readApply.build(v)).toContain('Explanation language: English');
  });
});
