import { describe, expect, it } from 'vitest';
import { examplesFor, formHint } from '../../src/domain/grammar/rules';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { chapters, familyOf, hasSignal, isRetired, mapEntryOf, patternById, patternBySignals, patternOf, patternsOf, taskWhy, topicsWithPatterns, v2Tasks, whyFor } from '../../src/domain/grammar/patterns';
import { seedTasks } from '../../src/domain/grammar/tasks';

// Lader und Abfragen der Grammatik-Muster (Lernplattform 2.0 §4.7).

const PILOT = ['past-simple-perfect', 'mixed-cond', 'time-clauses', 'cond-alt'];
const WISH = 'I wish the client ___ us the data last week.';
const task = (prompt: string) => {
  const t = seedTasks().find((x) => x.prompt === prompt);
  if (!t) throw new Error(`Aufgabe fehlt: ${prompt}`);
  return t;
};

describe('Lader', () => {
  it('die Pilotthemen haben Musterdateien; Themen ohne Datei geben null', () => {
    for (const t of PILOT) expect(topicsWithPatterns()).toContain(t);
    expect(patternsOf('no-such-topic')).toBeNull();
    expect(patternsOf('mixed-cond')?.patterns.length).toBeGreaterThanOrEqual(5);
  });

  it('patternById: mit und ohne Thema; falsches Thema und Unbekanntes geben null', () => {
    expect(patternById('mc.wish-past')?.topic).toBe('mixed-cond');
    expect(patternById('mixed-cond:mc.wish-past')?.id).toBe('mc.wish-past');
    expect(patternById('time-clauses:mc.wish-past')).toBeNull();
    expect(patternById('xx.nope')).toBeNull();
  });

  it('Kennungen sind global eindeutig und passen zum Präfix des Themas', () => {
    const ids = new Set<string>();
    for (const t of PILOT) {
      const tp = patternsOf(t)!;
      const prefixes = new Set(tp.patterns.map((p) => p.id.split('.')[0]));
      expect(prefixes.size, t).toBe(1);
      for (const p of tp.patterns) {
        expect(ids.has(p.id), p.id).toBe(false);
        ids.add(p.id);
      }
    }
  });

  it('Kontrastfamilien und Kapitel', () => {
    expect(familyOf('mixed-cond').sort()).toEqual(['cond-alt', 'conditionals']);
    expect(familyOf('past-simple-perfect')).toContain('pres-perf-cont');
    expect(familyOf('comparison')).toEqual([]);
    const ch = chapters();
    expect(ch).toHaveLength(7);
    expect(ch.flatMap((c) => c.topics)).toHaveLength(47);
  });

  it('neue Aufgaben je Thema', () => {
    for (const t of PILOT) expect(v2Tasks(t).length, t).toBeGreaterThan(20);
    expect(v2Tasks().length).toBe(topicsWithPatterns().reduce((n, t) => n + v2Tasks(t).length, 0));
  });
});

describe('patternOf', () => {
  it('ordnet jede Pilotaufgabe über die Tabelle zu', () => {
    for (const t of seedTasks().filter((x) => PILOT.includes(x.topic))) {
      const p = patternOf(t);
      expect(p, t.prompt).not.toBeNull();
      expect(mapEntryOf(t.topic, legacyTaskKey(t.prompt))?.pat).toBe(p!.id);
    }
  });

  it('task.pat hat Vorrang; Themen ohne Musterdatei geben null', () => {
    expect(patternOf({ topic: 'mixed-cond', prompt: WISH, pat: 'mc.wish-now' })?.id).toBe('mc.wish-now');
    expect(patternOf({ topic: 'comparison', prompt: 'The report ___ by Lena.' })).toBeNull();
  });

  it('Aufgaben außerhalb der Tabelle: nur bei eindeutigem Signalwort-Treffer', () => {
    expect(patternOf({ topic: 'past-simple-perfect', prompt: 'We ___ the new tool two weeks ago.', answer: 'rolled out' })?.id).toBe('psp.finished-time');
    expect(patternOf({ topic: 'past-simple-perfect', prompt: 'Something completely unrelated happens.' })).toBeNull();
  });

  it('Signalwörter zählen als ganze Wörter und Wortfolgen', () => {
    expect(hasSignal('We left last week.', 'last week')).toBe(true);
    expect(hasSignal('The forum was long.', 'for')).toBe(false);
    expect(hasSignal('As soon as you arrive.', 'as soon as')).toBe(true);
  });

  it('die Signalwort-Zuordnung (für Pool- und Tagesaufgaben) trifft auf den Pilotaufgaben nur selten falsch', () => {
    let hit = 0;
    let wrong = 0;
    for (const t of seedTasks().filter((x) => PILOT.includes(x.topic))) {
      const tp = patternsOf(t.topic)!;
      const mapped = patternOf(t)!.id;
      const guess = patternBySignals(tp, `${t.prompt} ${t.answer}`);
      if (guess) {
        hit++;
        if (guess.id !== mapped) wrong++;
      }
    }
    // Es gibt Treffer, und sie sind überwiegend richtig; Falsches wird gemeldet (docs/umbau/inhalte-pruefung.md).
    expect(hit).toBeGreaterThan(20);
    expect(wrong / hit).toBeLessThan(0.25);
  });
});

describe('whyFor', () => {
  it('Auswahl: genau die gewählte Option bestimmt die Begründung', () => {
    const t = task("I wish the client ___ us the data last week.".replace('___', '___'));
    expect(t.type).toBe('mc');
    const sent = whyFor(t, { picked: 'sent', given: 'sent' });
    const would = whyFor(t, { picked: 'would send', given: 'would send' });
    expect(sent.rule).not.toBeNull();
    expect(would.rule).not.toBeNull();
    expect(sent.rule!.de).not.toBe(would.rule!.de);
    expect(sent.ok!.de.length).toBeGreaterThan(5);
  });

  it('richtige Option und unbekannte Antwort ergeben keine Regel, aber den „Richtig, weil“-Text', () => {
    const t = task(WISH);
    expect(whyFor(t, { picked: 'had sent' }).rule).toBeNull();
    expect(whyFor(t, { picked: 'had sent' }).ok).not.toBeNull();
    expect(taskWhy({ ...t, why: null })?.ok).toEqual(whyFor(t, {}).ok);
  });

  it('Lücke: Regeln über Wörter der Antwort (Kurzformen werden aufgelöst)', () => {
    const t = task('I wish I ___ that yesterday.');
    const none = whyFor(t, { given: 'did not say' });
    expect(none.rule).toBeTruthy();
  });

  it('ohne Begründung kommt nichts', () => {
    expect(whyFor({ topic: 'passive', prompt: 'x ___ y', why: null }, { given: 'z' })).toEqual({ rule: null, ok: null });
  });
});

describe('rules: Beispiele nur aus dem Muster', () => {
  it('examplesFor liefert nur Beispiele des Musters, nie den Aufgabensatz, und ohne Muster nichts', () => {
    for (const t of PILOT)
      for (const p of patternsOf(t)!.patterns) {
        const ex = examplesFor(t, { pattern: p.id });
        expect(ex.length, p.id).toBeGreaterThanOrEqual(2);
        const own = new Set([...p.ex.map((e) => e.en), p.trap.good]);
        for (const e of ex) expect(own.has(e), `${p.id}: ${e}`).toBe(true);
        expect(examplesFor(t, { pattern: p.id, exclude: ex[0] })).not.toContain(ex[0]);
        expect(examplesFor(t, { pattern: p.id, max: 1 })).toHaveLength(1);
      }
    expect(examplesFor('mixed-cond', {})).toEqual([]);
    expect(examplesFor('mixed-cond', { pattern: 'ca.unless' })).toEqual([]);
  });

  it('formHint fällt bei bekanntem Muster nie auf den ganzen Kernsatz zurück', () => {
    const t = task(WISH);
    const own = formHint({ topic: t.topic, expl: { de: null, en: null }, prompt: t.prompt, pat: t.pat }, 'de');
    expect(own).toBe(patternOf(t)!.use.de);
    expect(own.length).toBeGreaterThan(10);
    // Ohne Muster bleibt es beim Kernsatz wie bisher.
    expect(formHint({ topic: 'passive', expl: { de: null, en: null } }, 'de').length).toBeGreaterThan(10);
  });
});

describe('stillgelegte Aufgaben', () => {
  it('isRetired: mit und ohne Thema', () => {
    const q = "I wish you didn't interrupt me all the time.";
    expect(isRetired(q, 'mixed-cond')).toBe(true);
    expect(isRetired(q)).toBe(true);
    expect(isRetired(q, 'passive')).toBe(false);
    expect(isRetired('Something else.')).toBe(false);
    expect(isRetired(undefined)).toBe(false);
  });
});
