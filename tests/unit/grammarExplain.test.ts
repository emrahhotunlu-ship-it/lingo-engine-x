import { describe, expect, it } from 'vitest';
import { grammarExplanation } from '../../src/domain/grammar/explain';
import { grammarRetryHint } from '../../src/domain/grammar/retryHint';
import { patternOf, patternsOf, whyFor } from '../../src/domain/grammar/patterns';
import { seedTasks } from '../../src/domain/grammar/tasks';
import type { ExplainLine } from '../../src/domain/explain/types';
import type { GrammarTask } from '../../src/domain/learn/types';

// Erklär-Karte (Lernplattform 2.0 §3.1, §4.7, Abnahme P2).

const PILOT = ['past-simple-perfect', 'mixed-cond', 'time-clauses', 'cond-alt'];
const pilotTasks = () => seedTasks().filter((t) => PILOT.includes(t.topic));
const WISH = 'I wish the client ___ us the data last week.';
const wish = () => seedTasks().find((t) => t.prompt === WISH)!;

const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
/** Sichtbare Wörter der Tiefe `full` (Muster, deine Antwort, Warum, ein Beispiel; ohne den typischen Fehler, der nur in der Lernphase offen ist). */
function fullWords(lines: ExplainLine[], examples: Array<{ en: string }>): number {
  let n = 0;
  for (const l of lines) {
    if (l.k === 'pattern') n += words(l.name) + words(l.formula ?? '');
    if (l.k === 'yours') n += words(l.text);
    if (l.k === 'why') n += words(l.text);
  }
  return n + (examples[0] ? words(examples[0].en) : 0);
}

describe('grammarExplanation', () => {
  it('falsche Auswahl: Muster → deine Antwort aus der passenden Regel → Warum → Beispiel (Beispielfall der Planung)', () => {
    const m = grammarExplanation({ task: wish(), verdict: 'wrong', given: 'sent', picked: 'sent', lang: 'de', learning: false });
    expect(m.source).toBe('pattern');
    expect(m.lines.map((l) => l.k).slice(0, 3)).toEqual(['pattern', 'yours', 'why']);
    const yours = m.lines.find((l) => l.k === 'yours') as Extract<ExplainLine, { k: 'yours' }>;
    expect(yours.given).toBe('sent');
    expect(yours.text.length).toBeGreaterThan(10);
    expect(m.lines.some((l) => l.k === 'mistake')).toBe(false);
    expect(m.examples.length).toBeGreaterThan(0);
    expect(m.mark).toContain('last week');
    expect(m.ai).toBe(false);
  });

  it('Lernphase fügt den typischen Fehler hinzu; richtige Antwort hat mindestens die Warum-Zeile und keine „yours“-Zeile', () => {
    const learn = grammarExplanation({ task: wish(), verdict: 'wrong', given: 'sent', picked: 'sent', lang: 'en', learning: true });
    expect(learn.lines.some((l) => l.k === 'mistake')).toBe(true);
    const ok = grammarExplanation({ task: wish(), verdict: 'ok', given: 'had sent', lang: 'de', learning: false });
    expect(ok.lines.some((l) => l.k === 'why')).toBe(true);
    expect(ok.lines.some((l) => l.k === 'yours')).toBe(false);
  });

  it('feste Reihenfolge der Zeilen', () => {
    const order = ['pattern', 'yours', 'why', 'mistake', 'contrast', 'note'];
    for (const t of pilotTasks()) {
      const m = grammarExplanation({ task: t, verdict: 'wrong', given: 'zzz', lang: 'de', learning: true });
      const idx = m.lines.map((l) => order.indexOf(l.k));
      expect(idx, t.prompt).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it('Warum-Text ≠ Musterkarte ≠ Verwendung des Musters', () => {
    for (const t of pilotTasks()) {
      const p = patternOf(t)!;
      const m = grammarExplanation({ task: t, verdict: 'ok', given: t.answer, lang: 'de', learning: false });
      const why = m.lines.find((l): l is Extract<ExplainLine, { k: 'why' }> => l.k === 'why');
      expect(why, t.prompt).toBeTruthy();
      expect(why!.text, t.prompt).not.toBe(p.use.de);
      expect(why!.text, t.prompt).not.toBe(p.name.de);
      expect(why!.text, t.prompt).not.toBe(p.form.de);
    }
  });

  it('bei Tiefe „full“ höchstens 45 sichtbare Wörter für alle Pilotaufgaben und beide Sprachen (falsche Antwort)', () => {
    const over: string[] = [];
    for (const t of pilotTasks()) {
      for (const lang of ['de', 'en'] as const) {
        const given = t.options?.find((o) => o !== t.answer) ?? 'zzz';
        const m = grammarExplanation({ task: t, verdict: 'wrong', given, picked: t.options ? given : undefined, lang, learning: false });
        const n = fullWords(m.lines, m.examples);
        if (n > 45) over.push(`${lang} ${n}: ${t.prompt}`);
      }
    }
    expect(over).toEqual([]);
  });

  it('Beispiele nie der Aufgabensatz, nur aus dem Muster', () => {
    for (const t of pilotTasks()) {
      const m = grammarExplanation({ task: t, verdict: 'wrong', given: 'zzz', lang: 'en', learning: true });
      const p = patternOf(t)!;
      const own = new Set([...p.ex.map((e) => e.en), p.trap.good]);
      for (const e of m.examples) {
        expect(own.has(e.en), t.prompt).toBe(true);
        expect(e.en.toLowerCase(), t.prompt).not.toBe(t.prompt.replace(/_{3,}/, t.answer).toLowerCase());
      }
    }
  });

  it('Claude-Antwort ersetzt die „yours“-Zeile und kennzeichnet das Modell', () => {
    const m = grammarExplanation({ task: wish(), verdict: 'wrong', given: 'sent', picked: 'sent', lang: 'de', learning: false, ai: { text: 'Kurze Erklärung.' } });
    expect(m.ai).toBe(true);
    expect((m.lines.find((l) => l.k === 'yours') as Extract<ExplainLine, { k: 'yours' }>).text).toBe('Kurze Erklärung.');
  });

  it('Aufgabe ohne Muster: nur die aufgabeneigene Erklärung, keine Beispiele, kein Themen-Zufallsbeispiel', () => {
    const base = seedTasks().find((x) => x.topic === 'comparison')!;
    const t = { ...base, pat: null, why: undefined, prompt: 'zz zz ___', key: 'zzzz' } as unknown as GrammarTask;
    const m = grammarExplanation({ task: t, verdict: 'wrong', given: 'zzz', lang: 'de', learning: true });
    expect(m.examples).toEqual([]);
    expect(m.mark).toEqual([]);
    expect(m.lines.every((l) => l.k === 'why')).toBe(true);
    expect(m.source).toBe('task');
  });

  it('verwechseltes Nachbarmuster erzeugt eine Kontrast-Zeile', () => {
    let found = 0;
    for (const t of pilotTasks()) {
      for (const r of (t.why ?? whyFor(t, {}).ok ? [] : [])) void r;
    }
    for (const t of pilotTasks()) {
      const tw = (patternsOf(t.topic) && whyFor(t, {})) || null;
      void tw;
    }
    // Es gibt mindestens eine Pilotaufgabe, deren falsche Option ein Nachbarmuster meint.
    for (const t of pilotTasks().filter((x) => x.options)) {
      for (const o of t.options!) {
        const r = whyFor(t, { picked: o, given: o }).rule;
        if (!r?.pat) continue;
        const m = grammarExplanation({ task: t, verdict: 'wrong', given: o, picked: o, lang: 'de', learning: false });
        expect(m.lines.some((l) => l.k === 'contrast'), `${t.prompt} / ${o}`).toBe(true);
        found++;
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('Zweitversuch-Hinweis (nudge)', () => {
  it('mit Muster kommt die Leitfrage, ohne Muster wie bisher der Hinweis bzw. das Thema', () => {
    const t = wish();
    const h = grammarRetryHint(t, 'Mixed Conditionals', false, { task: t, given: 'sent', picked: 'sent', lang: 'de' });
    expect(h.kind).toBe('nudge');
    const plain: GrammarTask = { ...t, topic: 'comparison', pat: null, prompt: 'zz zz' };
    expect(grammarRetryHint({ hint: 'since/for' }, 'X', false, { task: plain, lang: 'de' })).toEqual({ kind: 'hint', text: 'since/for' });
    expect(grammarRetryHint({ hint: null }, 'X', false)).toEqual({ kind: 'topic', name: 'X' });
  });

  it('die Leitfrage verrät die Lösung nicht', () => {
    for (const t of pilotTasks()) {
      const h = grammarRetryHint(t, null, false, { task: t, given: 'zzz', lang: 'en' });
      if (h.kind !== 'nudge') continue;
      const ans = t.answer.toLowerCase();
      if (ans.split(/\s+/).length >= 2) expect(h.text.toLowerCase(), t.prompt).not.toContain(ans);
    }
  });
});
