import type { C1Input, C1Item, C1Kind } from '../../c1x/types';
import { hash32, mulberry32, shuffle } from '../../random';
import type { C1Check } from '../c1doc';

// C1-Check, Zusammenstellung einer Form (Lernplattform 3.0 §4.3, P40). Rein. Der Vorrat (`probe: true`) liegt im eigenen Bündel `c1x-check` und erscheint in
// keiner Übungsrunde (`trainable` schließt `probe` aus, das Bündel wird nie vorgeladen). Eine Form = 26 eigene Aufgaben (`form: 'A'`) plus die 4 Anker
// (`probe` ohne `form`), die in jeder Form gleich sind: zusammen 8 mcc · 8 ocl · 8 wf · 6 kwt = 30 Aufgaben, 36 Punkte.
//
// Formwahl (D3): Am Laptop (`desk`) die erste Form, die noch kein Laptop-Check benutzt hat; jede Form höchstens einmal. Ein Handy-Check verbraucht keine
// Form: Er nimmt die zuletzt am Laptop benutzte Form (bekannte Aufgaben, kein Verlust für spätere Messungen), sonst die nächste freie.

/** Formen des Vorrats (R4: A–C, drei Monate). Spätere Formen D–L hängen hier an. */
export const CHECK_FORMS: readonly string[] = ['A', 'B', 'C'];

/** Teile in fester Reihenfolge; `p` im Eintrag folgt ihr. */
export const CHECK_PARTS: readonly C1Kind[] = ['mcc', 'ocl', 'wf', 'kwt'];
/** Aufgaben je Teil und Punkte je Aufgabe. */
export const CHECK_SHAPE: Readonly<Record<string, { n: number; pts: number }>> = { mcc: { n: 8, pts: 1 }, ocl: { n: 8, pts: 1 }, wf: { n: 8, pts: 1 }, kwt: { n: 6, pts: 2 } };
export const CHECK_ITEMS = 30;
export const CHECK_MAX = 36;
/** Anker je Form (gleiche Aufgaben in jeder Form). */
export const CHECK_ANCHORS = 4;

/** Ist die Aufgabe eine Check-Aufgabe? */
export const isCheckItem = (it: C1Item): boolean => it.probe === true;
/** Ankeraufgabe (in jeder Form gleich): `probe` ohne `form`. */
export const isAnchor = (it: C1Item): boolean => it.probe === true && !it.form;

/** Erste Form, die noch kein Laptop-Check benutzt hat; `null` = alle verbraucht. */
export function nextDeskForm(checks: readonly Pick<C1Check, 'f' | 'inp'>[], forms: readonly string[] = CHECK_FORMS): string | null {
  const used = new Set(checks.filter((c) => c.inp === 'desk').map((c) => c.f));
  return forms.find((f) => !used.has(f)) ?? null;
}

/** Form für einen Check auf diesem Gerät. Handy: die zuletzt am Laptop benutzte Form, sonst die nächste freie (verbraucht sie nicht). */
export function formFor(inp: C1Input, checks: readonly Pick<C1Check, 'f' | 'inp' | 'd'>[], forms: readonly string[] = CHECK_FORMS): string | null {
  if (inp === 'desk') return nextDeskForm(checks, forms);
  const desk = checks.filter((c) => c.inp === 'desk' && forms.includes(c.f));
  const last = desk.reduce<(typeof desk)[number] | null>((a, c) => (a === null || c.d >= a.d ? c : a), null);
  return last?.f ?? nextDeskForm(checks, forms) ?? forms[0] ?? null;
}

/**
 * Die 30 Aufgaben einer Form, Teil für Teil (mcc · ocl · wf · kwt), innerhalb eines Teils fest gemischt (gleiche Form = gleiche Reihenfolge).
 * Fehlt einem Teil eine Aufgabe, ist die Form unvollständig: `[]` (der Check startet dann nicht).
 */
export function checkSet(items: readonly C1Item[], form: string): C1Item[] {
  const mine = items.filter((it) => isCheckItem(it) && (it.form === form || isAnchor(it)));
  const out: C1Item[] = [];
  for (const kind of CHECK_PARTS) {
    const part = mine.filter((it) => it.kind === kind).sort((a, b) => a.id.localeCompare(b.id));
    const want = CHECK_SHAPE[kind]?.n ?? 0;
    if (part.length !== want) return [];
    out.push(...shuffle(part, mulberry32(hash32(`c1check|${form}|${kind}`))));
  }
  return out;
}
