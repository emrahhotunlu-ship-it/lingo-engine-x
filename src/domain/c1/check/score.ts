import { givenOf } from '../../c1x/book';
import { whyRuleFor } from '../../c1x/kinds/common';
import { maxOf, scoreC1 } from '../../c1x/score';
import type { C1Input, C1Item, C1Response, C1Score } from '../../c1x/types';
import type { WhyRule } from '../../explain/types';
import type { NewRepair } from '../../repair/repair';
import type { C1Check } from '../c1doc';
import { CHECK_MAX, CHECK_PARTS, CHECK_SHAPE } from './select';

// C1-Check, Wertung (Lernplattform 3.0 §4.3, P40). Rein. Lokal über `scoreC1`: `accepted` (US und UK gelten beide), `kwt` je Hälfte 1 Punkt.
// Nichts wird gebucht (kein Muster, kein Thema, keine Karte). Ergebnis: Punkte je Teil und gesamt, eine Spanne wegen der Formunterschiede, die zwei
// schwächsten Muster und höchstens 8 Fehlersätze (nach Muster geordnet, `src: 'check'`).

/** Antwort einer Aufgabe; `null` = „Weiß ich nicht“ (0 Punkte). */
export type CheckAnswer = { id: string; r: C1Response | null };

export type CheckLine = { item: C1Item; r: C1Response | null; score: C1Score; given: string; rule: WhyRule | null };

export type CheckTally = {
  /** Punkte je Teil in der Reihenfolge mcc · ocl · wf · kwt. */
  p: [number, number, number, number];
  /** Höchstpunkte je Teil (8 · 8 · 8 · 12). */
  pMax: [number, number, number, number];
  pts: number;
  max: typeof CHECK_MAX;
  /** Spanne „etwa a–b“ (Formunterschiede, §4.3). */
  range: [number, number];
  /** Die zwei schwächsten Muster: [Musterkennung, verlorene Punkte]. */
  weak: Array<[string, number]>;
  lines: CheckLine[];
};

/** Breite der Spanne in Punkten je Seite (≈ 8 % von 36; die Formen sind nicht geeicht). */
export const CHECK_SPREAD = 3;
/** Richtwert C1 (Anteil), nicht geeicht. */
export const C1_GUIDE = 0.6;
/** Höchstzahl der Fehlersätze je Check. */
export const CHECK_REPAIRS = 8;

const NONE: C1Score = { got: 0, max: 0, parts: [], verdict: 'wrong', free: false };

/** Gruppe eines Musters für „schwächste Muster“: Grammatik nach Muster, Wortbildung nach Art (`lx.wf-noun`), Wortverbindungen zusammen. */
export function checkGroup(it: C1Item): string {
  if (it.area === 'lex' && it.kind === 'mcc') return 'lx.colloc';
  return it.pat;
}

/** Eine Aufgabe werten (Antwort fehlt: 0 von `maxOf`). */
export function checkLine(item: C1Item, r: C1Response | null): CheckLine {
  if (!r) return { item, r, score: { ...NONE, max: maxOf(item) }, given: '', rule: null };
  const score = scoreC1(item, r);
  const given = givenOf(item, r);
  const rule = score.verdict === 'correct' ? null : whyRuleFor(item, item.kind === 'mcc' ? { picked: given } : { given });
  return { item, r, score, given, rule };
}

/** Alle Antworten werten. Reihenfolge der Zeilen = Reihenfolge der Aufgaben. */
export function scoreCheck(items: readonly C1Item[], answers: readonly CheckAnswer[]): CheckTally {
  const byId = new Map(answers.map((a) => [a.id, a.r]));
  const lines = items.map((it) => checkLine(it, byId.get(it.id) ?? null));
  const p: [number, number, number, number] = [0, 0, 0, 0];
  const pMax: [number, number, number, number] = [0, 0, 0, 0];
  CHECK_PARTS.forEach((kind, i) => {
    const shape = CHECK_SHAPE[kind];
    pMax[i] = (shape?.n ?? 0) * (shape?.pts ?? 0);
  });
  for (const l of lines) {
    const i = CHECK_PARTS.indexOf(l.item.kind);
    if (i < 0) continue;
    p[i] = (p[i] ?? 0) + Math.min(l.score.got, l.score.max);
  }
  const pts = p.reduce((a, b) => a + b, 0);
  const range: [number, number] = [Math.max(0, pts - CHECK_SPREAD), Math.min(CHECK_MAX, pts + CHECK_SPREAD)];
  return { p, pMax, pts, max: CHECK_MAX, range, weak: weakest(lines), lines };
}

/** Die zwei Gruppen mit den meisten verlorenen Punkten (bei Gleichstand: kleinerer Anteil richtig, dann Kennung). Ohne Verlust: keine. */
export function weakest(lines: readonly CheckLine[], n = 2): Array<[string, number]> {
  const acc = new Map<string, { lost: number; max: number }>();
  for (const l of lines) {
    const g = checkGroup(l.item);
    const cur = acc.get(g) ?? { lost: 0, max: 0 };
    cur.max += l.score.max;
    cur.lost += Math.max(0, l.score.max - l.score.got);
    acc.set(g, cur);
  }
  return [...acc]
    .filter(([, v]) => v.lost > 0)
    .sort((a, b) => b[1].lost - a[1].lost || a[1].lost / a[1].max - b[1].lost / b[1].max || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([g, v]) => [g, v.lost]);
}

/** Der Eintrag für `app/c1.checks[]`. `m` nur, wenn es schwache Muster gibt. */
export function checkEntry(t: CheckTally, o: { day: string; form: string; inp: C1Input }): C1Check {
  return { d: o.day, f: o.form, inp: o.inp, p: [...t.p], pts: t.pts, max: CHECK_MAX, ...(t.weak.length ? { m: t.weak.map(([g, n]) => [g, n] as [string, number]) } : {}) };
}

const tidy = (s: string): string => s.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim();
const gap = /_{2,}/;

/** Der Satz mit einer eingesetzten Antwort (`null`, wenn die Aufgabe keinen Lückensatz hat). */
export function filledSentence(item: C1Item, fill: string): string | null {
  switch (item.kind) {
    case 'mcc':
    case 'ocl':
    case 'wf':
      return gap.test(item.text) ? tidy(item.text.replace(gap, fill)) : null;
    case 'kwt':
      return tidy(`${item.before} ${fill} ${item.after}`);
    default:
      return null;
  }
}

/** Die erste richtige Füllung (mcc: richtige Option, ocl/wf: erste Lösung, kwt: Teil A + Teil B der ersten Variante). */
export function rightFill(item: C1Item): string | null {
  switch (item.kind) {
    case 'mcc':
      return item.options[item.answer] ?? null;
    case 'ocl':
    case 'wf':
      return item.accept[0] ?? null;
    case 'kwt': {
      const k = item.keys[0];
      return k ? tidy(`${k.a[0] ?? ''} ${k.b[0] ?? ''}`) : null;
    }
    default:
      return null;
  }
}

/**
 * Fehlersätze: jede beantwortete, nicht volle Aufgabe (auch `kwt` mit einem von zwei Punkten) als Paar „dein Satz → richtiger Satz“, nach Muster
 * geordnet, höchstens 8. Ohne Antwort („Weiß ich nicht“) gibt es keinen eigenen Satz und darum keinen Fehlersatz.
 */
export function checkRepairs(lines: readonly CheckLine[], lang: 'de' | 'en'): NewRepair[] {
  const out: Array<{ add: NewRepair; g: string; at: number }> = [];
  lines.forEach((l, at) => {
    if (!l.r || l.score.verdict === 'correct' || !l.given.trim()) return;
    const fill = rightFill(l.item);
    if (!fill) return;
    const wrong = filledSentence(l.item, l.given.trim());
    const right = filledSentence(l.item, fill);
    if (!wrong || !right || wrong.toLowerCase() === right.toLowerCase()) return;
    const why = l.item.why.ok[lang];
    out.push({ add: { wrong, right, why, src: 'check', ctx: l.item.pat, fix: [fill] }, g: checkGroup(l.item), at });
  });
  return out
    .sort((a, b) => a.g.localeCompare(b.g) || a.at - b.at)
    .slice(0, CHECK_REPAIRS)
    .map((x) => x.add);
}
