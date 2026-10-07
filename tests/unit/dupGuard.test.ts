import { beforeAll, describe, expect, it } from 'vitest';
import { preloadC1x, resetC1Store } from '../../src/domain/c1x/preload';
import { entries, resetCrossLink, type Entry } from '../../src/domain/srs/crossLink';

// Dublettenwächter über Aufgabenarten (V1, „Mehrfachkombination“): Derselbe Satz oder fast derselbe Satz (starke Wortüberlappung) darf nicht in zwei
// verschiedenen Aufgabenarten oder Satz-Pools stehen, sonst wiederholt sich der Inhalt unter anderem Namen („immer dasselbe“). Gleiche WÖRTER in
// verschiedenen Sätzen sind dagegen gewollt. Die Grenze ist absichtlich streng; Ausnahmen müssen hier mit Grund stehen.

const STOP = new Set('a an the and or but of to in on at for with by from as is are was were be been it its this that these those we you they he she i our your their my me us not no do does did have has had will would can could should may might must than then so if when while which who whom whose what how why there here also just very more most some any all each every'.split(' '));
const words = (s: string): Set<string> => new Set(s.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a: Set<string>, b: Set<string>): number => {
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / (a.size + b.size - inter || 1);
};
/**
 * Bekannte Paare, mit Grund. Gefunden beim ersten Lauf (07.10.2026): drei Sätze des Umformen-/Fehler-Bestands der alten Grammatikdatei (LP2-Adapter)
 * stehen fast gleich im Satzbau-Pool (Inversion, Höflichkeitsformeln). Die Inhalte gehören dem Englischlehrer und werden hier nicht geändert;
 * Aufgabe und Form sind verschieden (Umformen/Fehler suchen gegen Bausteine legen). Neue Paare dürfen nicht dazukommen: Änderung nur mit Begründung.
 */
const ALLOWED: ReadonlySet<string> = new Set<string>(['err-0111~kwt-v2-292', 'err-v2-39~order-We were hoping to hear f', 'kwt-v2-291~order-Should you need further ']);

let list: readonly Entry[] = [];
beforeAll(async () => {
  resetC1Store();
  resetCrossLink();
  await preloadC1x(['mcc', 'ocl', 'err', 'kwt']);
  resetCrossLink();
  list = entries();
});

describe('Dublettenwächter über Aufgabenarten und Satz-Pools', () => {
  it('die Quellen sind geladen (c1x, Satzbau-Pool, C1-Paket)', () => {
    const kinds = new Set(list.map((e) => e.kind));
    for (const k of ['mcc', 'ocl', 'order', 'pack']) expect(kinds.has(k), k).toBe(true);
    expect(list.length).toBeGreaterThan(400);
  });

  it('kein Satz steht wörtlich in zwei Aufgaben', () => {
    const seen = new Map<string, Entry>();
    const dup: string[] = [];
    for (const e of list) {
      const prev = seen.get(e.lower);
      if (prev) dup.push(`${prev.id} = ${e.id}`);
      else seen.set(e.lower, e);
    }
    expect(dup).toEqual([]);
  });

  it('keine zwei Sätze verschiedener Arten überlappen in den Inhaltswörtern zu mindestens 80 %', () => {
    const w = list.map((e) => words(e.sentence));
    const bad: string[] = [];
    for (let i = 0; i < list.length; i++) {
      if (w[i]!.size < 5) continue;
      for (let j = i + 1; j < list.length; j++) {
        if (list[i]!.kind === list[j]!.kind || w[j]!.size < 5) continue;
        if (jaccard(w[i]!, w[j]!) >= 0.8) {
          const key = `${list[i]!.id}~${list[j]!.id}`;
          if (!ALLOWED.has(key)) bad.push(key);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
