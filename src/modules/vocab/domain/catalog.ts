import { addDays, dayKey, dayStartOf, daysBetween } from '../shared';
import { retr } from './tracks';
import { DEFAULT_FORM_MS, type Form, type FormStats, type Lex, type TrackKey } from './types';

// Wörter-Modul V1: Bestand im Speicher (Lexeme mit Geschwistern) und erwartete Last je Tag in MINUTEN (M11, M63).

export type Item = {
  path: string;
  lex: Lex;
  /** Reihenfolge neuer Lexeme (altes Feld `order`, sonst Zeitpunkt). */
  order: number;
  hidden?: boolean;
};

export const isNewLex = (l: Lex): boolean => l.intro === null;

export function formMs(f: Form, med: FormStats): number {
  return med[f] ?? DEFAULT_FORM_MS[f];
}

/** Welche Spur ist am Lerntag `day` fällig, und mit welcher Form? (Beide fällig → Benutzen; ohne Benutzen-Spur → Lücke, die sie anlegt.) */
export function dueOn(l: Lex, day: string): { track: TrackKey; form: Form } | null {
  if (isNewLex(l)) return null;
  const end = dayStartOf(addDays(day, 1));
  const bDue = !!l.b && l.b.due < end;
  const uDue = l.u.due < end;
  if (bDue) return { track: 'b', form: formFor(l) };
  if (uDue) return l.b ? { track: 'u', form: 'meaning' } : { track: 'b', form: 'gap' };
  return null;
}

/** Form einer fälligen Benutzen-Abfrage (V1): ab Stufe 4 jeder 3. Abruf ohne Satz (M27), sonst Lücke im Satz. V2 baut die Leiter aus. */
export function formFor(l: Lex): Form {
  if (!l.b) return 'gap';
  return l.lv >= 4 && l.b.reps % 3 === 2 ? 'nosent' : 'gap';
}

/** Gefährdung: Abrufwahrscheinlichkeit der führenden Spur (kleiner = gefährdeter). */
export function danger(l: Lex, nowMs: number): number {
  return retr(l.b ?? l.u, nowMs);
}

/** Geschwister je Lexem: Verwechslungspartner, Kernwort ↔ Kollokation, Sinne, und das Doppel (`of`). */
export class Catalog {
  readonly byPath = new Map<string, Item>();
  private sib = new Map<string, Set<string>>();
  constructor(items: Iterable<Item>) {
    for (const it of items) if (!it.hidden && !it.lex.of) this.byPath.set(it.path, it);
    const link = (a: string, b: string | null) => {
      if (!b || a === b) return;
      (this.sib.get(a) ?? this.sib.set(a, new Set()).get(a)!).add(b);
      (this.sib.get(b) ?? this.sib.set(b, new Set()).get(b)!).add(a);
    };
    for (const it of this.byPath.values()) {
      link(it.path, it.lex.pair);
      link(it.path, it.lex.core);
      link(it.path, it.lex.sense);
    }
  }
  items(): Item[] {
    return [...this.byPath.values()];
  }
  siblingsOf(path: string): string[] {
    return [...(this.sib.get(path) ?? [])];
  }
  get(path: string): Item | undefined {
    return this.byPath.get(path);
  }
  set(path: string, lex: Lex): void {
    const it = this.byPath.get(path);
    if (it) this.byPath.set(path, { ...it, lex });
  }
  /** Tages-Offsets ab `day`, an denen Geschwister fällig sind (beide Spuren). */
  siblingOffsets(path: string, day: string): Set<number> {
    const out = new Set<number>();
    for (const p of this.siblingsOf(path)) {
      const l = this.byPath.get(p)?.lex;
      if (!l || isNewLex(l)) continue;
      out.add(daysBetween(day, dayKey(l.u.due)));
      if (l.b) out.add(daysBetween(day, dayKey(l.b.due)));
    }
    return out;
  }
}

/** Erwartete Minuten je Lerntag aus den Terminen aller Lexeme (ohne `exclude`). */
export function loadByDay(cat: Catalog, med: FormStats, exclude?: string): Map<string, number> {
  const m = new Map<string, number>();
  const add = (d: string, ms: number) => m.set(d, (m.get(d) ?? 0) + ms / 60_000);
  for (const it of cat.byPath.values()) {
    if (it.path === exclude || isNewLex(it.lex)) continue;
    const l = it.lex;
    const bd = l.b ? dayKey(l.b.due) : null;
    const ud = dayKey(l.u.due);
    if (bd) add(bd, formMs(formFor(l), med));
    if (ud !== bd) add(ud, formMs(l.b ? 'meaning' : 'gap', med));
  }
  return m;
}

/** Vorschau: erwartete Minuten an den nächsten `n` Lerntagen (Index 0 = morgen), M63. */
export function forecastMinutes(cat: Catalog, med: FormStats, nowMs: number, n: number): number[] {
  const today = dayKey(nowMs);
  const m = loadByDay(cat, med);
  return Array.from({ length: n }, (_, i) => Math.round((m.get(addDays(today, i + 1)) ?? 0) * 10) / 10);
}
