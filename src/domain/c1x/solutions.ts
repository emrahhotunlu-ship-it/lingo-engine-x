import { errRange } from './kinds/err';
import type { C1Item, C1Response } from './types';

// Alle gültigen Lösungen einer Aufgabe als Antworten (rein). Grundlage der Eigenschaftstests: `scoreC1(item, Lösung) = max` für jede Variante.

/** Jede gültige Antwort (jede Lösungsvariante) in der freien (getippten) Form. */
export function solutionsOf(item: C1Item): C1Response[] {
  switch (item.kind) {
    case 'mcc':
      return [{ kind: 'mcc', pick: item.answer }];
    case 'ocl':
    case 'wf':
      return item.accept.map((text) => ({ kind: item.kind, text }));
    case 'kwt':
      return item.keys.flatMap((k) => k.a.flatMap((a) => k.b.map((b): C1Response => ({ kind: 'kwt', text: `${a} ${b}`, typed: true }))));
    case 'err': {
      if (!item.bad) return [{ kind: 'err', tap: 'none' }];
      const range = errRange(item);
      const tap = range ? range[0] : 0;
      return item.bad.fix.map((fix): C1Response => ({ kind: 'err', tap, fix, typed: true }));
    }
    case 'pair': {
      const base = { kind: 'pair' as const, links: [0, 1] as [number, number] };
      return item.transfer ? item.transfer.accept.map((t): C1Response => ({ ...base, transfer: t })) : [base];
    }
    case 'cnet':
      return [{ kind: 'cnet', picks: item.right.map((x) => x.w) }];
    case 'reg':
      return [
        { kind: 'reg', picks: item.segs.map((s) => s.accept[0] ?? '') },
        ...item.answers.map((text): C1Response => ({ kind: 'reg', text })),
      ];
    case 'para':
      return [{ kind: 'para', pick: item.answer }, ...item.answers.map((text): C1Response => ({ kind: 'para', text }))];
  }
}

/** Die Antworten, die eine falsche Wahl bzw. eine typische Falle darstellen (Auswahl: jede falsche Option, kwt: jede Falle, err: Fehlalarm/übersehen/falsche Korrektur). */
export function wrongsOf(item: C1Item): C1Response[] {
  switch (item.kind) {
    case 'mcc':
      return [0, 1, 2, 3].filter((i) => i !== item.answer).map((pick): C1Response => ({ kind: 'mcc', pick }));
    case 'ocl':
      return item.chips.map((text): C1Response => ({ kind: 'ocl', text }));
    case 'wf':
      return item.family.filter((f) => !item.accept.includes(f)).map((text): C1Response => ({ kind: 'wf', text }));
    case 'kwt':
      return (item.traps ?? []).map((text): C1Response => ({ kind: 'kwt', text, typed: true }));
    case 'err': {
      if (!item.bad) return [{ kind: 'err', tap: 0 }];
      const range = errRange(item);
      const tap = range ? range[0] : 0;
      const wrongChips = (item.bad.choices ?? []).filter((c) => !item.bad?.fix.includes(c));
      return [{ kind: 'err', tap: 'none' }, ...wrongChips.map((fix): C1Response => ({ kind: 'err', tap, fix }))];
    }
    case 'pair':
      return [{ kind: 'pair', links: [1, 0] }, { kind: 'pair', links: [2, 2] }];
    case 'cnet':
      return [{ kind: 'cnet', picks: [...item.right.map((x) => x.w), ...item.wrong.map((x) => x.w)] }, { kind: 'cnet', picks: item.wrong.map((x) => x.w) }];
    case 'reg':
      return [{ kind: 'reg', picks: item.segs.map((s) => s.choices.find((c) => !s.accept.includes(c)) ?? '') }];
    case 'para':
      return [0, 1, 2, 3].filter((i) => i !== item.answer).map((pick): C1Response => ({ kind: 'para', pick }));
  }
}
