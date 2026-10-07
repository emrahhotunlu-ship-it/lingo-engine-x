import { describe, expect, it } from 'vitest';
import { addLocalDays } from '../../src/domain/date';
import { addError, dueErrors, errorsOf, liveErrorsOf, reviewError, type ErrorEntry } from '../../src/domain/grammar/errors';
import { berlin } from './helpers';

// Fehlerschlange je Muster (Lernplattform 2.0 §5.7, Abnahme P2): ein offener Eintrag je Muster, falsch = eine Box zurück,
// Verlauf `rh`, stillgelegte Einträge nur beim Lesen ausgeblendet.

const t0 = berlin('2026-10-06', 10);
const DAY = 86_400_000;
const err = (q: string, extra: Partial<Parameters<typeof addError>[1]> = {}) => ({ q, given: 'x', ans: 'y', t: t0, src: 'duty', ...extra });

describe('addError mit Muster', () => {
  it('ein zweiter Fehler auf dasselbe Muster legt keinen neuen Eintrag an: Box 0, morgen fällig, Satz in more', () => {
    const first = addError([], err('Sentence one ___.', { pat: 'mc.wish-past' }));
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ pat: 'mc.wish-past' });
    const boxed = [{ ...first[0]!, box: 2, due: t0 + 9 * DAY } as ErrorEntry];
    const second = addError(boxed, err('Sentence two ___.', { pat: 'mc.wish-past', t: t0 + 1000, given: 'g2', ans: 'a2' }));
    expect(second).toHaveLength(1);
    expect(second[0]).toMatchObject({ box: 0, done: false, due: addLocalDays(t0 + 1000, 1), q: 'Sentence one ___.' });
    expect(second[0]!.more).toEqual([{ q: 'Sentence two ___.', given: 'g2', ans: 'a2', t: t0 + 1000 }]);
  });

  it('more behält höchstens 3 (der älteste fällt heraus); derselbe Satz wird nicht doppelt angehängt', () => {
    let list: readonly ErrorEntry[] = addError([], err('q0 ___', { pat: 'p.a' }));
    for (let i = 1; i <= 5; i++) list = addError(list, err(`q${i} ___`, { pat: 'p.a', t: t0 + i }));
    expect(list).toHaveLength(1);
    expect((list[0]!.more as Array<{ q: string }>).map((m) => m.q)).toEqual(['q3 ___', 'q4 ___', 'q5 ___']);
    expect(addError(list, err('q5 ___', { pat: 'p.a', t: t0 + 9 }))).toBe(list);
  });

  it('ein erledigter Eintrag blockiert das Muster nicht; andere Muster und Einträge ohne Muster bleiben einzeln', () => {
    const done = [{ q: 'old ___', t: t0 - DAY, done: true, pat: 'p.a' } as ErrorEntry];
    expect(addError(done, err('new ___', { pat: 'p.a' }))).toHaveLength(2);
    const one = addError([], err('a ___', { pat: 'p.a' }));
    expect(addError(one, err('b ___', { pat: 'p.b' }))).toHaveLength(2);
    const plain = addError(addError([], err('c ___')), err('d ___'));
    expect(plain).toHaveLength(2);
    expect(plain.every((e) => e.pat === undefined)).toBe(true);
  });

  it('dieselbe Frage bleibt unverändert; pat wird auf 40 Zeichen gekürzt', () => {
    const one = addError([], err('same ___', { pat: 'x'.repeat(60) }));
    expect((one[0]!.pat as string).length).toBe(40);
    expect(addError(one, err('same ___'))).toBe(one);
  });
});

describe('reviewError: eine Box zurück, Verlauf', () => {
  const base = (box: number): ErrorEntry[] => [{ q: 'q', given: 'x', ans: 'y', t: t0, box, due: t0, done: false }];

  it('falsch in Box 2 → Box 1; Box 0 bleibt 0; Box 1 → 0', () => {
    expect(reviewError(base(2), t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })![0]!.box).toBe(1);
    expect(reviewError(base(0), t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })![0]!.box).toBe(0);
    expect(reviewError(base(1), t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })![0]!.box).toBe(0);
  });

  it('richtig: Box +1, nach Box 3 erledigt (unverändert); rh hält Zeit, Box vor der Antwort, Ergebnis', () => {
    const a = reviewError(base(1), t0, { ok: true, given: 'y', grade: 3, t: t0 + 5 })!;
    expect(a[0]).toMatchObject({ box: 2, done: false, rh: [[t0 + 5, 1, 1]] });
    const b = reviewError(a, t0, { ok: true, given: 'y', grade: 3, t: t0 + 10 })!;
    expect(b[0]).toMatchObject({ box: 3, done: true });
    expect(b[0]!.rh).toEqual([[t0 + 5, 1, 1], [t0 + 10, 2, 1]]);
  });

  it('rh wächst nur bis 6; „fast richtig“ schreibt nichts in rh', () => {
    let list: ErrorEntry[] = base(0);
    for (let i = 1; i <= 8; i++) list = reviewError(list, t0, { ok: false, given: 'z', grade: 1, t: t0 + i })!;
    expect((list[0]!.rh as unknown[]).length).toBe(6);
    const near = reviewError(base(1), t0, { ok: false, near: true, given: 'z', grade: 2, t: t0 + 5 })!;
    expect(near[0]!.box).toBe(1);
    expect(near[0]!.rh).toBeUndefined();
  });

  it('falsche Variante: given des Originaleintrags bleibt; falsches Original überschreibt given', () => {
    const v = reviewError(base(2), t0, { ok: false, given: 'fremd', grade: 1, t: t0 + 5, variant: true })!;
    expect(v[0]).toMatchObject({ q: 'q', given: 'x', box: 1 });
    const o = reviewError(base(2), t0, { ok: false, given: 'fremd', grade: 1, t: t0 + 5 })!;
    expect(o[0]!.given).toBe('fremd');
  });

  it('dieselbe Antwort nicht zweimal anwenden', () => {
    const a = reviewError(base(2), t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })!;
    expect(reviewError(a, t0, { ok: false, given: 'z', grade: 1, t: t0 + 5 })).toBeNull();
  });
});

describe('stillgelegte Einträge (§3.9)', () => {
  const wish = "I wish you didn't interrupt me all the time.";
  const doc = { errors: [{ q: wish, given: 'x', ans: 'I wish you wouldn\'t interrupt me all the time.', t: t0 - 2 * DAY, src: 'duty' }, { q: 'She ___ (work) here since May.', given: 'works', ans: 'has worked', t: t0 - 2 * DAY, src: 'duty' }] };

  it('liveErrorsOf blendet sie aus, errorsOf behält sie (Daten bleiben unverändert)', () => {
    expect(errorsOf(doc)).toHaveLength(2);
    expect(liveErrorsOf(doc).map((e) => e.q)).toEqual(['She ___ (work) here since May.']);
    expect(liveErrorsOf(doc, 'mixed-cond')).toHaveLength(1);
    expect(liveErrorsOf(doc, 'passive')).toHaveLength(2);
  });

  it('dueErrors zeigt den stillgelegten Eintrag nicht; die Daten bleiben unangetastet', () => {
    const before = JSON.stringify(doc);
    const due = dueErrors(new Map([['mixed-cond', doc]]), t0);
    expect(due.map((d) => d.task.prompt)).not.toContain(wish);
    expect(JSON.stringify(doc)).toBe(before);
  });

  it('der Eintrag zählt auch nicht für die Bremse (Anzahl fälliger Fehler)', () => {
    expect(dueErrors(new Map([['mixed-cond', doc]]), t0).filter((d) => d.task.prompt === wish)).toHaveLength(0);
  });
});
