import { kindEnabled } from '../../app/flags';
import { GRADE_TABLE, TOUCH_FACTOR } from '../grade';
import { hash32 } from '../random';
import { patsOf, patternState } from '../metrics/pattern';
import { hasKey, kwtWords } from './kwtNorm';
import { c1Items } from './preload';
import { c1Key } from './runtime';
import { trainable } from './select';
import type { C1Input, C1Item, C1Kind, Kwt } from './types';

// Tempo-Runde (Lernplattform 3.0 §2.3, P24): 12 Aufgaben nur aus Mustern ab „Sicher“, die langsamsten zuerst, mit der Zielzeit der Note.
// Rein: Muster-Stand, Tag und Startwert kommen als Parameter, nichts wird gespeichert.

export const TEMPO_SIZE = 12;
/** Weniger passende Aufgaben: die Runde entfällt (Schritt 3 bleibt „Sätze bauen gemischt“). */
export const TEMPO_MIN = 4;
/** Die drei Arten der Tempo-Runde und ihre Sollmenge (6 + 4 + 2). */
export type TempoKind = 'ocl' | 'kwt' | 'err';
export const TEMPO_KINDS: readonly TempoKind[] = ['ocl', 'kwt', 'err'];
export const TEMPO_QUOTA: Readonly<Record<TempoKind, number>> = { ocl: 6, kwt: 4, err: 2 };
/** Höchstens so viele Aufgaben je Muster und je Thema (Mischung aus mindestens 3 Themen). */
const PER_PATTERN = 2;
const PER_TOPIC = 4;
/** Nie so viele gleiche Arten hintereinander. */
const MAX_RUN = 2;

export const isTempoKind = (k: C1Kind): k is TempoKind => k === 'ocl' || k === 'kwt' || k === 'err';

/**
 * Zielzeit in Millisekunden = „Gut bis“ der Note (§2.3): ocl 6 s, kwt Teil B 14 s, Fehler finden mit 1-Wort-Korrektur 12 s (Handy) bzw. 8 s (Laptop);
 * am Handy mit dem Touch-Faktor 1,4. Kein eigener Wert: die Schlüssel stehen in `GRADE_TABLE`.
 */
export function targetMs(kind: TempoKind, inp: C1Input): number {
  const key = kind === 'ocl' ? 'c1_ocl' : kind === 'kwt' ? 'c1_kwt_part' : inp === 'touch' ? 'c1_err_tapfix' : 'c1_err_fix';
  return Math.round(GRADE_TABLE[key].good * (inp === 'touch' ? TOUCH_FACTOR : 1));
}

const oneWord = (s: string): boolean => /^\S+$/.test(s.trim());

/** Der feste Anfang (Teil A) und das Ende (Teil B) einer Umformung für die Tempo-Runde; `null`, wenn die Aufgabe dafür nicht taugt. */
export function kwtSplit(item: Kwt): { a: string; b: string } | null {
  const k = item.keys[0];
  const a = k?.a[0]?.trim();
  const b = k?.b[0]?.trim();
  if (!a || !b) return null;
  const atom = [item.key];
  const bn = kwtWords(b, atom).length;
  if (bn < 1 || bn > 3) return null;
  const all = kwtWords(`${a} ${b}`, atom);
  const [lo, hi] = item.words ?? [3, 6];
  if (all.length < lo || all.length > hi || !hasKey(all, item.key.toLowerCase())) return null;
  return { a, b };
}

/** Taugt die Aufgabe für die Tempo-Runde? ocl: ein Wort · kwt: Teil B höchstens 3 Wörter · err: fehlerfrei oder 1-Wort-Korrektur (nie Streichen, nie Fundort ohne Korrektur). */
export function tempoEligible(item: C1Item): boolean {
  switch (item.kind) {
    case 'ocl':
      return (item).accept.some((a) => a.trim().length > 0) && oneWord((item).accept[0] ?? '');
    case 'kwt':
      return kwtSplit(item) !== null;
    case 'err': {
      const e = item;
      if (!e.bad) return true;
      const fix = e.bad.fix[0]?.trim() ?? '';
      return fix.length > 0 && oneWord(fix);
    }
    default:
      return false;
  }
}

/** Muster ab „Sicher“ (Sicher oder Fest) mit ihrem Thema. */
export function safePatterns(grammarDocs: ReadonlyMap<string, Readonly<Record<string, unknown>>>, today: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [topic, doc] of grammarDocs) {
    for (const [pat, entry] of Object.entries(patsOf(doc))) {
      const st = patternState(entry, today);
      if (st === 'safe' || st === 'firm') out.set(pat, topic);
    }
  }
  return out;
}

export type TempoSelectOpts = {
  grammarDocs: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  today: string;
  seed: string;
  /** Verhältnis Median-Zeit zu Zielzeit je Muster (aus dem Protokoll); höher = langsamer = früher. Fehlt ein Muster, gilt 1. */
  slow?: ReadonlyMap<string, number>;
  /** Gemeldete Aufgaben (`app/c1.bad`). */
  bad?: ReadonlySet<string>;
  /** Eingeschaltete Arten (Standard: die Schalter aus `app/flags`). */
  avail?: ReadonlySet<C1Kind>;
};

type Cand = { item: C1Item; topic: string; slow: number; seen: boolean; h: number; clean: boolean };

const seenKeys = (doc: Readonly<Record<string, unknown>> | undefined): Set<string> => new Set(Array.isArray(doc?.seen) ? (doc.seen as unknown[]).filter((x): x is string => typeof x === 'string') : []);

/** Die Kandidaten einer Art: Muster ab „Sicher“, ungesehene zuerst, dann die langsamsten Muster, sonst nach Startwert. */
function candidates(kind: TempoKind, safe: ReadonlyMap<string, string>, o: TempoSelectOpts): Cand[] {
  const seenByTopic = new Map<string, Set<string>>();
  const out: Cand[] = [];
  for (const item of c1Items(kind)) {
    const topic = safe.get(item.pat);
    if (topic === undefined || !trainable(item, o.bad) || !tempoEligible(item)) continue;
    let seen = seenByTopic.get(topic);
    if (!seen) {
      seen = seenKeys(o.grammarDocs.get(topic));
      seenByTopic.set(topic, seen);
    }
    out.push({ item, topic, slow: o.slow?.get(item.pat) ?? 1, seen: seen.has(c1Key(item.id)), h: hash32(`${o.seed}|${item.id}`), clean: item.kind === 'err' && item.bad === null });
  }
  return out.sort((a, b) => Number(a.seen) - Number(b.seen) || b.slow - a.slow || a.h - b.h);
}

/** Pro Art die Sollmenge; fehlen Aufgaben, springen die anderen Arten ein (Reihenfolge ocl, kwt, err). */
function quotas(avail: Readonly<Record<TempoKind, number>>, size: number): Record<TempoKind, number> {
  const q: Record<TempoKind, number> = { ocl: Math.min(TEMPO_QUOTA.ocl, avail.ocl), kwt: Math.min(TEMPO_QUOTA.kwt, avail.kwt), err: Math.min(TEMPO_QUOTA.err, avail.err) };
  let left = size - (q.ocl + q.kwt + q.err);
  while (left > 0) {
    let moved = false;
    for (const k of TEMPO_KINDS) {
      if (left > 0 && q[k] < avail[k]) {
        q[k]++;
        left--;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return q;
}

/**
 * Mischt die Arten so, dass nie mehr als `MAX_RUN` gleiche hintereinander stehen (soweit es die Mengen erlauben); sonst bleibt die Reihenfolge der Langsamkeit.
 * Droht eine Art am Ende zu übrig zu bleiben, kommt sie früher dran.
 */
export function spreadKinds<T extends { kind: C1Kind }>(list: readonly T[]): T[] {
  const rest = [...list];
  const out: T[] = [];
  while (rest.length) {
    const tail = out.slice(-MAX_RUN);
    const blocked = tail.length === MAX_RUN && tail.every((x) => x.kind === tail[0]?.kind) ? (tail[0]?.kind ?? null) : null;
    const counts = new Map<C1Kind, number>();
    for (const x of rest) counts.set(x.kind, (counts.get(x.kind) ?? 0) + 1);
    let at = -1;
    for (const [kind, m] of counts) {
      if (kind !== blocked && m >= MAX_RUN * (rest.length - m) + 1) at = rest.findIndex((x) => x.kind === kind);
    }
    if (at < 0) at = rest.findIndex((x) => x.kind !== blocked);
    if (at < 0) at = 0;
    out.push(rest.splice(at, 1)[0] as T);
  }
  return out;
}

/**
 * Die Aufgaben einer Tempo-Runde (höchstens 12). Leer, wenn weniger als 4 passen (die Runde entfällt).
 * Auswahl nur aus Mustern ab „Sicher“; mindestens ein fehlerfreier Satz bei „Fehler finden“, soweit es einen gibt; höchstens 2 je Muster und 4 je Thema,
 * solange es genug Themen gibt; nie 3 gleiche Arten hintereinander.
 */
export function selectTempo(o: TempoSelectOpts): C1Item[] {
  const safe = safePatterns(o.grammarDocs, o.today);
  if (!safe.size) return [];
  const kinds = TEMPO_KINDS.filter((k) => (o.avail ? o.avail.has(k) : kindEnabled(k)));
  const pool = { ocl: [] as Cand[], kwt: [] as Cand[], err: [] as Cand[] };
  for (const k of kinds) pool[k] = candidates(k, safe, o);
  const total = pool.ocl.length + pool.kwt.length + pool.err.length;
  if (total < TEMPO_MIN) return [];
  const q = quotas({ ocl: pool.ocl.length, kwt: pool.kwt.length, err: pool.err.length }, TEMPO_SIZE);

  const picked: Cand[] = [];
  const perPat = new Map<string, number>();
  const perTopic = new Map<string, number>();
  const take = (c: Cand): void => {
    picked.push(c);
    perPat.set(c.item.pat, (perPat.get(c.item.pat) ?? 0) + 1);
    perTopic.set(c.topic, (perTopic.get(c.topic) ?? 0) + 1);
  };
  const within = (c: Cand): boolean => (perPat.get(c.item.pat) ?? 0) < PER_PATTERN && (perTopic.get(c.topic) ?? 0) < PER_TOPIC;
  const taken = new Set<string>();
  for (const k of TEMPO_KINDS) {
    let list = pool[k];
    // Ein fehlerfreier Satz zuerst (er prüft, ob Emrah auch „Kein Fehler“ erkennt).
    if (k === 'err') {
      const clean = list.find((c) => c.clean);
      if (clean && q.err > 0) {
        take(clean);
        taken.add(clean.item.id);
        q.err--;
        list = list.filter((c) => c !== clean);
      }
    }
    let need = q[k];
    for (const c of list) {
      if (need <= 0) break;
      if (within(c)) {
        take(c);
        taken.add(c.item.id);
        need--;
      }
    }
    // Zu wenige Themen oder Muster: Grenzen lockern.
    for (const c of list) {
      if (need <= 0) break;
      if (!taken.has(c.item.id)) {
        take(c);
        taken.add(c.item.id);
        need--;
      }
    }
  }
  // Reihenfolge: die langsamsten Muster zuerst, danach die Arten entzerren.
  const ordered = [...picked].sort((a, b) => b.slow - a.slow || a.h - b.h).map((c) => c.item);
  return spreadKinds(ordered);
}
