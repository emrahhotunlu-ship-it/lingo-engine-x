import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { addRepairs, capRepairs, dueRepairs, readRepairs, repairId, reviewRepair, REPAIR_MAX, type RepairItem } from '../../src/domain/repair/repair';

const DAY = 86_400_000;
const T = 1_790_000_000_000;

describe('Reparatur-Sätze (V2)', () => {
  it('anlegen, doppelt nicht, gleich = richtig nicht', () => {
    const a = addRepairs([], [{ wrong: 'I look forward to hear from you.', right: 'I look forward to hearing from you.', why: 'to + -ing', src: 'say' }], T)!;
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ box: 0, due: T + DAY, src: 'say', why: 'to + -ing' });
    expect(addRepairs(a, [{ wrong: 'i look forward to hear from you', right: 'x y', src: 'talk' }], T + 1)).toBeNull();
    expect(addRepairs([], [{ wrong: 'Fine.', right: 'fine', src: 'say' }], T)).toBeNull();
  });

  it('Boxen 1/3/9: richtig steigt, ab Box 3 erledigt; falsch zurück auf 0', () => {
    let l: RepairItem[] = addRepairs([], [{ wrong: 'Since two years I work here.', right: "I've been working here for two years.", src: 'talk' }], T)!;
    const id = l[0]!.id;
    expect(dueRepairs(l, T)).toHaveLength(0);
    expect(dueRepairs(l, T + DAY)).toHaveLength(1);
    l = reviewRepair(l, id, true, T + DAY)!;
    expect(l[0]).toMatchObject({ box: 1, due: T + DAY + 3 * DAY });
    expect(reviewRepair(l, id, true, T + DAY)).toBeNull();
    l = reviewRepair(l, id, false, T + 4 * DAY)!;
    expect(l[0]).toMatchObject({ box: 0, due: T + 5 * DAY });
    l = reviewRepair(reviewRepair(reviewRepair(l, id, true, T + 5 * DAY)!, id, true, T + 8 * DAY)!, id, true, T + 17 * DAY)!;
    expect(l[0]!.done).toBe(true);
    // Tritt der Fehler wieder auf, ist er wieder offen.
    const again = addRepairs(l, [{ wrong: 'Since two years I work here', right: "I've been working here for two years.", src: 'say' }], T + 30 * DAY)!;
    expect(again[0]).toMatchObject({ done: false, box: 0, id });
  });

  it('Kappung zuerst erledigte; tolerantes Lesen; Schema', () => {
    const many = Array.from({ length: REPAIR_MAX + 2 }, (_, i) => ({ id: repairId(`w${i}`), wrong: `w${i}`, right: `r${i}`, src: 'say' as const, t: T, box: 0, due: T, ...(i === 5 ? { done: true } : {}) }));
    const c = capRepairs(many);
    expect(c).toHaveLength(REPAIR_MAX);
    expect(c.some((e) => e.done)).toBe(false);
    expect(readRepairs({ items: [null, { wrong: 'a' }, { wrong: 'a b', right: 'c d', t: T }] })).toHaveLength(1);
    expect(validateDoc('app/repair', { items: c }).ok).toBe(true);
    // Größe: auch bei langen Einträgen bleibt das Dokument unter 200 KiB (A6.6).
    const long = Array.from({ length: REPAIR_MAX }, (_, i) => ({ id: `x${i}`, wrong: 'ä'.repeat(300), right: 'ö'.repeat(300), why: 'ü'.repeat(200), ctx: 'c'.repeat(120), fix: Array.from({ length: 6 }, () => 'f'.repeat(80)), src: 'say' as const, t: T, box: 0, due: T }));
    const cut = capRepairs(long);
    expect(new TextEncoder().encode(JSON.stringify({ items: cut })).length).toBeLessThanOrEqual(200 * 1024);
    expect(cut.length).toBeLessThan(REPAIR_MAX);
  });
});
