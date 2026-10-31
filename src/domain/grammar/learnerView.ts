import { toUS } from '../answer/spelling';
import { kwtText, kwtWords } from '../c1x/kwtNorm';
import type { C1Item, C1Response, Kwt } from '../c1x/types';
import { legacyNorm } from './key';

// Paket Q0 (Aufgaben-Qualität): Was der Lernende nach dem Prüfen sieht, als reine Bausteine. Sie werden von den Bildschirmen
// (`GrammarItem`, `useC1Item`, `kinds/Kwt`) UND vom Aufgaben-Spieler (`tests/unit/taskPlayer.test.ts`, `scripts/grammar/player.ts`) benutzt,
// damit der Spieler genau die Logik prüft, die die App zeigt.
//
// 1. Variante: Die Antwort trifft eine weitere gültige Lösung (`accepted`, weitere `keys`/`fix`/`accept`), nicht die Musterlösung.
//    Dann heißt der Kopf „Auch richtig“, die Zeile „Deine Form passt. Musterlösung: …“, und der Vorspann „Richtig: <Musterlösung>.“ der
//    Begründung fällt weg (sonst stünde unter „Richtig“ eine andere Form als die eingegebene: pc-rc-k1). Gezählt wird wie richtig.
// 2. Abkürzung als Schlüsselwort (MBA, CEO): Kleinschreibung wird angenommen, die Lücke zeigt aber die richtige Schreibung mit Hinweis.
// 3. Umformung (kwt): genau ein Wortzähler, der zur Aufgabenzeile passt; bei Lösungen bis 3 Wörter keine Teile A/B (art-snd-k2).

/** Vergleichsform: Kurzformen aufgelöst, ohne Satzzeichen, klein, US-Schreibweise. */
const cmp = (s: string): string => toUS(legacyNorm(s));

/**
 * Ist `given` eine andere gültige Fassung als die Musterlösung `model`? (Nur sinnvoll, wenn die Antwort als richtig gewertet wurde.)
 * Kurzformen, Groß-/Kleinschreibung, Satzzeichen und britische Schreibung machen keine Variante.
 */
export function isVariant(given: string, model: string, opts: { kwtKey?: string } = {}): boolean {
  if (!given.trim() || !model.trim()) return false;
  if (cmp(given) === cmp(model)) return false;
  const atom = opts.kwtKey !== undefined ? [opts.kwtKey] : [];
  const g = toUS(kwtText(given, atom)).split(' ');
  const m = toUS(kwtText(model, atom)).split(' ');
  if (g.length !== m.length) return true;
  // Ein abgetrenntes 's/'d am Anfang (’s signed off) ist dieselbe Form wie has/is bzw. had/would der Musterlösung.
  const SHORT: Record<string, readonly string[]> = { "'s": ['has', 'is'], "'d": ['had', 'would'], "'ve": ['have'], "'ll": ['will'], "'re": ['are'], "'m": ['am'] };
  return !g.every((w, i) => w === m[i] || (SHORT[w]?.includes(m[i] ?? '') ?? false));
}

/**
 * Begründung ohne den Vorspann „Richtig: <Musterlösung>.“ / „Right: …“ (erster Satz), wenn die Eingabe eine Variante ist.
 * Bleibt nichts übrig, kommt `''` zurück (der Aufrufer nimmt dann den Kernsatz des Musters).
 */
export function stripModelLead(text: string, model?: string): string {
  const t = text.trim();
  const m = /^(?:richtig|right|correct)\s*:\s*/i.exec(t);
  if (!m) return t;
  const rest = t.slice(m[0].length);
  // Ende des ersten Satzes: Punkt + Leerzeichen (auch vor kleinem Wort: „… lately. lately zeigt …“), oder Textende. „e.g.“ zählt nicht.
  const end = /(?<!\b(?:e\.g|i\.e|z\.B|bzw|etc|vs))[.!?](?=\s+\S|\s*$)/.exec(rest);
  if (!end) return model !== undefined && cmp(rest) !== cmp(model) ? rest : '';
  // Nur wenn der erste Satz die Musterlösung selbst ist („Richtig: as a lawyer.“). „Richtig: Nach once steht has approved: …“ ist schon die Begründung.
  const first = rest.slice(0, end.index);
  if (model !== undefined && cmp(first) !== cmp(model) && !cmp(first).endsWith(cmp(model)) && !cmp(first).startsWith(cmp(model))) return rest.charAt(0).toUpperCase() + rest.slice(1);
  if (model !== undefined && cmp(first).split(' ').length > cmp(model).split(' ').length + 4) return rest.charAt(0).toUpperCase() + rest.slice(1);
  const after = rest.slice(end.index + 1).trim();
  return after ? after.charAt(0).toUpperCase() + after.slice(1) : '';
}

/** Ist das Schlüsselwort eine Abkürzung (MBA, CEO, KPI)? Nur Großbuchstaben, 2–6 Zeichen, und in der Musterlösung groß geschrieben. */
export function isAbbrevKey(key: string, model: string): boolean {
  if (!/^[A-Z][A-Z0-9]{1,5}$/.test(key)) return false;
  return new RegExp(`(^|[^A-Za-z])${key}([^A-Za-z]|$)`).test(model);
}

/**
 * Abkürzung in falscher Schreibung (mba, Mba): die Antwort mit richtiger Schreibung, sonst `null`.
 * Nur das Schlüsselwort selbst wird angepasst, alles andere bleibt, wie getippt.
 */
export function caseFix(given: string, key: string, model: string): string | null {
  if (!isAbbrevKey(key, model)) return null;
  const re = new RegExp(`(^|[^A-Za-z])(${key})(?=[^A-Za-z]|$)`, 'gi');
  let changed = false;
  const out = given.replace(re, (all: string, pre: string, w: string) => {
    if (w === key) return all;
    changed = true;
    return `${pre}${key}`;
  });
  return changed ? out : null;
}

// ------------------------------------------------------------------ c1x

/** Die Musterlösung einer c1x-Aufgabe als Text (für „Musterlösung: …“ und den Variantenvergleich), sonst `null`. */
export function c1Model(item: C1Item): string | null {
  switch (item.kind) {
    case 'kwt':
      return `${item.keys[0]?.a[0] ?? ''} ${item.keys[0]?.b[0] ?? ''}`.replace(/\s+/g, ' ').trim() || null;
    case 'err':
      return item.bad ? (item.bad.fix[0] ?? null) : null;
    case 'ocl':
    case 'wf':
      return item.accept[0] ?? null;
    case 'para':
    case 'reg':
      return item.answers[0] ?? null;
    default:
      return null;
  }
}

/** Getippter bzw. gelegter Text der Antwort, der mit der Musterlösung verglichen wird (`null` = Auswahlart, keine Variante möglich). */
function c1Text(item: C1Item, r: C1Response): string | null {
  if (r.kind === 'kwt' || r.kind === 'ocl' || r.kind === 'wf') return r.text;
  if (r.kind === 'err') return item.kind === 'err' && item.bad && typeof r.tap === 'number' ? (r.fix ?? null) : null;
  if (r.kind === 'para' || r.kind === 'reg') return r.text ?? null;
  return null;
}

/** Richtige c1x-Antwort, die nicht die Musterlösung ist → die Musterlösung (für „Auch richtig“), sonst `null`. */
export function c1VariantModel(item: C1Item, r: C1Response): string | null {
  const model = c1Model(item);
  const text = c1Text(item, r);
  if (model === null || text === null || !text.trim()) return null;
  if (item.kind === 'err' && !model.trim()) return null;
  return isVariant(text, model, item.kind === 'kwt' ? { kwtKey: item.key } : {}) ? model : null;
}

/** Abkürzung im Schlüsselwort klein getippt (kwt): Antwort in richtiger Schreibung, sonst `null`. */
export function c1CaseFix(item: C1Item, r: C1Response): string | null {
  if (item.kind !== 'kwt' || r.kind !== 'kwt') return null;
  return caseFix(r.text, item.key, c1Model(item) ?? '');
}

// ------------------------------------------------------------------ kwt: Eingabeform, Wortzähler, Teile

export type KwtMode = 'desk' | 'tiles' | 'part';
/** Teil B (getippt) hat höchstens so viele Wörter (mindestens). */
export const PART_B_MAX = 3;

/** Wörter der Musterlösung (Cambridge-Zählung). */
export const kwtModelWords = (item: Kwt): number => kwtWords(c1Model(item) ?? '', [item.key]).length;

/** Kurze Lösung (bis 3 Wörter): keine Aufteilung in Teil A/B, keine Teilpunkte. */
export const kwtShort = (item: Kwt): boolean => kwtModelWords(item) <= PART_B_MAX;

/**
 * Eingabeform nach Gerät, Stufe und Aufgabe: Laptop tippt; Handy bis p 0,7 Bausteine; darüber Teil A Bausteine + Teil B getippt –
 * außer bei kurzen Lösungen (bis 3 Wörter): dann wird die ganze Antwort getippt (eine Lücke, ein Zähler).
 */
export function kwtModeFor(item: Kwt, inp: 'touch' | 'desk', p: number): KwtMode {
  if (inp === 'desk') return 'desk';
  if (p <= 0.7) return 'tiles';
  return kwtShort(item) ? 'desk' : 'part';
}

/** Wortbereich der Aufgabe (Aufgabenzeile und der eine Zähler). */
export const kwtRange = (item: Kwt): [number, number] => item.words ?? [3, 6];

/** Was der Bildschirm an Zahlen zeigt: Aufgabenzeile, Wortzähler (genau einer, wenn überhaupt), Teile im Ergebnis. */
export function kwtLayout(item: Kwt, inp: 'touch' | 'desk', p: number): { mode: KwtMode; task: [number, number]; counters: Array<[number, number]>; parts: boolean } {
  const mode = kwtModeFor(item, inp, p);
  const range = kwtRange(item);
  return { mode, task: range, counters: [range], parts: !kwtShort(item) && mode !== 'desk' };
}
