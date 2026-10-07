// Erweiterungspunkte (Lernplattform 3.0 P11): Reihenfolge, `enabled`, leere Slots, unbekannte Namen, Hub-Dateien.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { clearSlots, registerSlot, Slot, SLOT_NAMES, slotEntries, type SlotName } from '../../src/app/slots';

afterEach(() => clearSlots());
const html = (name: SlotName, props?: Record<string, unknown>): string => renderToStaticMarkup(createElement(Slot, { name, ...(props ? { props } : {}) }));

describe('Slot', () => {
  it('ein leerer Slot rendert nichts (kein Wrapper, keine Höhe)', () => {
    expect(html('today.done')).toBe('');
  });

  it('rendert in der Reihenfolge von `order`, bei gleicher Zahl nach Anmeldung', () => {
    registerSlot({ slot: 'apply.tiles', order: 20, render: () => createElement('i', null, 'c') });
    registerSlot({ slot: 'apply.tiles', order: 10, render: () => createElement('i', null, 'a') });
    registerSlot({ slot: 'apply.tiles', order: 20, render: () => createElement('i', null, 'd') });
    registerSlot({ slot: 'apply.tiles', order: 15, render: () => createElement('i', null, 'b') });
    expect(html('apply.tiles')).toBe('<i>a</i><i>b</i><i>c</i><i>d</i>');
  });

  it('`enabled() = false` rendert nichts, wird bei jedem Zeichnen ausgewertet', () => {
    let on = false;
    registerSlot({ slot: 'vocab.hub', order: 1, enabled: () => on, render: () => createElement('b', null, 'x') });
    expect(html('vocab.hub')).toBe('');
    on = true;
    expect(html('vocab.hub')).toBe('<b>x</b>');
    expect(slotEntries('vocab.hub')).toHaveLength(1);
  });

  it('reicht Props durch, andere Slots bleiben unberührt', () => {
    registerSlot({ slot: 'session.end', order: 1, render: (p) => createElement('u', null, String(p.n)) });
    expect(html('session.end', { n: 7 })).toBe('<u>7</u>');
    expect(html('explain.after')).toBe('');
  });

  it('ein unbekannter Name wird ignoriert (Warnung im Protokoll, kein Absturz)', () => {
    registerSlot({ slot: 'gibt.es.nicht' as SlotName, order: 1, render: () => 'x' });
    expect(html('gibt.es.nicht' as SlotName)).toBe('');
  });
});

describe('Hub-Dateien', () => {
  const ROOT = join(__dirname, '..', '..', 'src');
  const walk = (d: string, out: string[] = []): string[] => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx$/.test(n)) out.push(p);
    }
    return out;
  };
  const used = new Map<string, string[]>();
  for (const f of walk(ROOT)) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(/<Slot\s+name="([^"]+)"/g)) used.set(m[1] as string, [...(used.get(m[1] as string) ?? []), relative(ROOT, f)]);
  }

  it('jeder `<Slot name="…">` im Code ist ein bekannter Name, jeder Name steht genau an einer Stelle (SessionEnd: zwei Fassungen)', () => {
    for (const name of used.keys()) expect(SLOT_NAMES as readonly string[], name).toContain(name);
    for (const name of SLOT_NAMES) {
      const places = used.get(name) ?? [];
      expect(places.length, name).toBeGreaterThan(0);
      expect(new Set(places).size, `${name} steht in mehreren Dateien: ${places.join(', ')}`).toBe(1);
    }
  });

  it('die Hub-Dateien tragen die vorgesehenen Slots', () => {
    const where: Record<string, string> = {
      'today.done': 'features/today/TodayScreen.tsx',
      'today.extra': 'features/today/TodayScreen.tsx',
      'progress.head': 'features/progress/ProgressScreen.tsx',
      'progress.words': 'features/progress/ProgressScreen.tsx',
      'progress.grammar': 'features/progress/ProgressScreen.tsx',
      'progress.review': 'features/progress/ProgressScreen.tsx',
      'grammar.head': 'features/learn/LearnHub.tsx',
      'apply.tiles': 'features/apply/ApplyHub.tsx',
      'vocab.hub': 'features/vocab/hub/VocabHub.tsx',
      'settings.sections': 'features/settings/SettingsSheet.tsx',
      'exercise.menu': 'ui/exercise/ExerciseMenu.tsx',
      'explain.after': 'ui/exercise/Explanation.tsx',
      'session.end': 'ui/SessionEnd.tsx',
    };
    for (const [name, file] of Object.entries(where)) expect(used.get(name)?.[0], name).toBe(file);
  });
});
