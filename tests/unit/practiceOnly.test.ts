import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { legacyV2Items } from '../../src/domain/c1x/legacyV2';
import { c1Item } from '../../src/domain/c1x/schema';
import { V2FileSchema, V2TaskSchema } from '../../src/domain/grammar/patternTypes';

// Relaunch Stufe 1, Korrekturliste Punkt 3 und 4: Umformungen mit weniger als 3 Wörtern in der Lücke (und ein paar B1-Aufgaben ohne Lernwert)
// tragen `practiceOnly: true`. Tests, Checks und Prüfungen schließen sie aus; beim Üben ändert sich nichts.

const v2 = V2FileSchema.parse(JSON.parse(readFileSync('src/content/grammar/tasks-v2.json', 'utf8'))).tasks;
const words = (s: string): number => s.trim().split(/\s+/).length;
/** Kurzformen: nach Cambridge 3 Wörter, nach Leerzeichen gezählt 2. Grenzfälle der Liste, bewusst auch markiert. */
const SHORT_FORMS = ['mc.kwt7', 'md-cn-k2', 'pv-sim-k1', 'prp-nop-k1', 'prp-nop-k2', 'psc-sta-k2', 'psc-dua-k1'];
/** Keine echten Umformungen oder ohne Lernwert (Punkt 4.16, 4.19, 4.20). */
const B1_EXTRA = ['wo-pt-k1', 'wo-pt-k2', 'wo-pt-f3', 'wo-pt-m1'];

describe('practiceOnly (nur Übung)', () => {
  it('jede Umformung mit weniger als 3 Wörtern in der Lösung trägt practiceOnly', () => {
    const short = v2.filter((t) => t.type === 'kwt' && words(t.answer) < 3);
    expect(short.length).toBe(181);
    for (const t of short) expect(t.practiceOnly, t.id).toBe(true);
  });

  it('die 7 Kurzform-Grenzfälle und wo-pt-k1/k2 sind ausdrücklich markiert', () => {
    const byId = new Map(v2.map((t) => [t.id, t]));
    for (const id of [...SHORT_FORMS, ...B1_EXTRA]) expect(byId.get(id)?.practiceOnly, id).toBe(true);
    for (const id of SHORT_FORMS) expect(words((byId.get(id) as { answer: string }).answer), id).toBe(2);
    for (const id of ['wo-pt-k1', 'wo-pt-k2']) expect(words((byId.get(id) as { answer: string }).answer), id).toBeGreaterThanOrEqual(3);
  });

  it('sonst trägt keine Aufgabe die Markierung', () => {
    const expected = new Set([...v2.filter((t) => t.type === 'kwt' && words(t.answer) < 3).map((t) => t.id), ...B1_EXTRA]);
    expect(new Set(v2.filter((t) => t.practiceOnly).map((t) => t.id))).toEqual(expected);
    expect(expected.size).toBe(185);
  });

  it('das Schema behält das Feld bei kwt, find und meaning und lässt nur true zu', () => {
    for (const type of ['kwt', 'find', 'meaning'] as const) {
      const t = v2.find((x) => x.type === type && x.practiceOnly);
      expect(t, type).toBeTruthy();
      expect(V2TaskSchema.parse(JSON.parse(JSON.stringify(t))).practiceOnly).toBe(true);
    }
    const any = v2[0]!;
    expect(V2TaskSchema.safeParse({ ...any, practiceOnly: false }).success).toBe(false);
  });

  it('der c1x-Adapter reicht die Markierung durch (kwt und find), das c1x-Schema lässt sie zu', () => {
    const items = legacyV2Items();
    const flagged = items.filter((i) => i.practiceOnly);
    // kwt und find: alle markierten v2-Aufgaben außer der einen `meaning`-Aufgabe (wird nicht nach c1x übernommen)
    expect(flagged.length).toBe(185 - 1);
    expect(flagged.filter((i) => i.kind === 'kwt').length).toBe(183);
    expect(flagged.filter((i) => i.kind === 'err').length).toBe(1);
    for (const i of flagged) expect(c1Item.safeParse(i).success, i.id).toBe(true);
    // Beim Üben bleibt alles wie vorher: jede nicht markierte Aufgabe hat das Feld gar nicht.
    for (const i of items.filter((x) => !x.practiceOnly)) expect('practiceOnly' in i, i.id).toBe(false);
  });
});
