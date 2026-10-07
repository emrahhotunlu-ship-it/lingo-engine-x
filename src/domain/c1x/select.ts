import { kindEnabled } from '../../app/flags';
import { patternById } from '../grammar/patterns';
import { hash32 } from '../random';
import { c1Items } from './preload';
import { c1Key } from './runtime';
import type { C1Input, C1Item, C1Kind } from './types';

// Auswahl der Art und der Aufgabe (Lernplattform 3.0 §3.3, §2.10, P13). Rein: Zeit und Startwert kommen als Parameter.

/** Standardliste der Arten je Beherrschungsstufe und Gerät (§3.3): welche Art zu welchem p. Die Reihenfolge ist die Vorliebe. */
export function defaultKinds(p: number, inp: C1Input): C1Kind[] {
  if (p < 0.4) return ['mcc', 'pair', 'err', 'cnet'];
  if (p <= 0.7) return ['ocl', 'wf', 'kwt', 'reg'];
  return inp === 'touch' ? ['err', 'para', 'kwt', 'ocl'] : ['kwt', 'reg', 'para', 'err'];
}

/** Die Arten, die ein Muster erlaubt (Feld `kinds` der Musterdatei; fehlt es, alle neun). */
export function patternKinds(pat: string | null | undefined): readonly C1Kind[] | null {
  if (!pat) return null;
  return patternById(pat)?.kinds ?? null;
}

/**
 * Gewünschte Arten für ein Muster, in Reihenfolge der Vorliebe (§2.10): nach `p` (Stufe) und Gerät (`touch` = Handy, `desk` = Laptop),
 * gefiltert auf die Arten, die das Muster erlaubt. `avail` (Standard: alle eingeschalteten Arten) begrenzt weiter.
 * Leer = keine Art passt; der Aufrufer fällt auf die LP2-Rückfallkette zurück.
 */
export function wantKinds(p: number, inp: C1Input, pat?: string | null, avail?: ReadonlySet<C1Kind>): C1Kind[] {
  const allowed = patternKinds(pat);
  return defaultKinds(p, inp).filter((k) => (allowed ? allowed.includes(k) : true) && (avail ? avail.has(k) : kindEnabled(k)));
}

/**
 * Alle Arten, die zum Muster passen und eingeschaltet sind: zuerst die der Stufe (`wantKinds`), danach die übrigen (für „andere Art desselben Musters“,
 * wenn es in der gewünschten Art nichts Ungesehenes mehr gibt).
 */
export function kindsFor(p: number, inp: C1Input, pat?: string | null, avail?: ReadonlySet<C1Kind>, recent: readonly string[] = []): C1Kind[] {
  const first = varyKinds(wantKinds(p, inp, pat, avail), recent);
  const allowed = patternKinds(pat);
  const rest = (['mcc', 'ocl', 'wf', 'kwt', 'err', 'pair', 'cnet', 'reg', 'para'] as const).filter((k) => !first.includes(k) && (allowed ? allowed.includes(k) : true) && (avail ? avail.has(k) : kindEnabled(k)));
  return [...first, ...rest];
}

/**
 * Varianz (V1): Die Art, die bei diesem Muster zuletzt dran war (`recent`, neueste zuletzt, aus `pats[muster].f`), rückt innerhalb der Arten der
 * Stufe ans Ende; die Arten der letzten Antworten stehen hinter den lange nicht gesehenen. Die Stufenwahl bleibt: es werden keine Arten hinzugenommen.
 * Gibt es nur eine Art, bleibt sie (kein Verbot ohne Alternative).
 */
export function varyKinds(kinds: readonly C1Kind[], recent: readonly string[]): C1Kind[] {
  if (kinds.length < 2 || !recent.length) return [...kinds];
  const age = (k: C1Kind): number => recent.lastIndexOf(k);
  return kinds.map((k, i) => ({ k, i, a: age(k) })).sort((x, y) => x.a - y.a || x.i - y.i).map((x) => x.k);
}

/** Darf die Aufgabe im Training vorkommen? Nie Check (`probe`), Kapitelprüfung/Einstufung (`pool`), gemeldete (`bad`). */
export const trainable = (item: C1Item, bad?: ReadonlySet<string>): boolean => !item.probe && !item.pool && !bad?.has(item.id);

export type PickOpts = {
  pat: string;
  kind: C1Kind;
  /** `grammar/<topic>.seen`-Schlüssel (`c1:<id>`). */
  seen: ReadonlySet<string>;
  /** Gemeldete Aufgaben (`app/c1.bad`). */
  bad?: ReadonlySet<string>;
  /** Schlüssel, die in dieser Runde schon vergeben sind. */
  used?: ReadonlySet<string>;
  seed: string;
  /** Lemmata der heutigen Wörter: Gleichstand-Brecher (Kap. 2 Nr. 5). */
  wordsToday?: readonly string[];
  /** Darf die Aufgabe auch gesehen sein (zweite Sicht)? Standard: nein. */
  allowSeen?: boolean;
};

const textOf = (i: C1Item): string => JSON.stringify([i.pat, i.lex ?? []]).toLowerCase();

/**
 * Eine ungesehene Aufgabe zu Muster und Art. Zwischen gleich geeigneten gewinnt die mit einem Lemma aus `wordsToday`, sonst entscheidet der
 * Startwert (stabil über Neuzeichnen). `null`, wenn es keine gibt.
 */
export function pickUnseen(o: PickOpts): C1Item | null {
  const cands = c1Items(o.kind).filter((i) => i.pat === o.pat && trainable(i, o.bad) && !o.used?.has(c1Key(i.id)) && (o.allowSeen || !o.seen.has(c1Key(i.id))));
  if (!cands.length) return null;
  const words = (o.wordsToday ?? []).map((w) => w.toLowerCase());
  const hit = (i: C1Item): number => (words.length && words.some((w) => (i.lex ?? []).some((l) => l.toLowerCase().includes(w)) || textOf(i).includes(w)) ? 0 : 1);
  return [...cands].sort((a, b) => hit(a) - hit(b) || hash32(`${o.seed}|${a.id}`) - hash32(`${o.seed}|${b.id}`))[0] ?? null;
}

/** Zahl der ungesehenen Aufgaben zu Muster und Art (für „gibt es noch feste Aufgaben?“, Claude füllt nur, wenn 0). */
export function unseenCount(pat: string, kind: C1Kind, seen: ReadonlySet<string>, bad?: ReadonlySet<string>): number {
  return c1Items(kind).filter((i) => i.pat === pat && trainable(i, bad) && !seen.has(c1Key(i.id))).length;
}

/** Zahl der Aufgaben zu einem Muster über alle Arten (Ziel langfristig ≥ 6 in ≥ 3 Arten). */
export function itemsFor(pat: string): C1Item[] {
  return (['mcc', 'ocl', 'wf', 'kwt', 'err', 'pair', 'cnet', 'reg', 'para'] as const).flatMap((k) => c1Items(k).filter((i) => i.pat === pat && trainable(i)));
}
