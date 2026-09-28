import type { PhrasalItem, RegisterItem, Transform, TransitionItem, WordFormation } from '../../content/nb/schemas';
import { checkAnswer } from './check';
import { checkTransform, transformStart, type TransformHint } from './transform';

// Motor-Sätze (Plan N102, N107): eine gemeinsame Form für alle Tipp-Aufgaben mit Musterlösungen –
// Satz-Umformung, Wortbildung, Register-Leiter, Phrasal Verbs, Überleitungen. Entweder eine Lücke
// im Satz (`gap` mit „___“) oder ein ganzer Satz (`full`). Lokal geprüft (A7.3: UK = richtig).

export type Bi = { de: string; en: string };
export type MotorSet = 'transform' | 'wordform' | 'register' | 'phrasal' | 'transition';

export type MotorItem = {
  id: string;
  set: MotorSet;
  /** Satz A bzw. Ausgangssatz (Englisch), oder `null`. */
  source: string | null;
  /** Hervorgehobenes Stichwort (Schlüsselwort, Grundwort, Stufe, Funktion). */
  chip: string;
  /** Zusatz unter dem Stichwort (deutsche Bedeutung, Wortfamilie), zweisprachig. */
  note?: Bi;
  /** Satz mit „___“ (Lücke) oder `null` (ganzer Satz). */
  gap: string | null;
  answers: string[];
  why: Bi;
};

const bi = (de: string, en: string): Bi => ({ de, en });
const LEVEL: Record<RegisterItem['from'], Bi> = { casual: bi('locker', 'casual'), neutral: bi('neutral', 'neutral'), formal: bi('formell', 'formal') };

export function fromTransform(t: Transform): MotorItem {
  return { id: t.id, set: 'transform', source: t.a, chip: t.key, gap: t.gap, answers: [...t.answers], why: t.why };
}

export function fromWordFormation(w: WordFormation): MotorItem {
  return { id: w.id, set: 'wordform', source: null, chip: w.base.toUpperCase(), note: bi(w.family.join(' · '), w.family.join(' · ')), gap: w.gap, answers: [...w.answers], why: w.why };
}

export function fromRegister(r: RegisterItem): MotorItem {
  const from = LEVEL[r.from];
  const to = LEVEL[r.to];
  return {
    id: r.id,
    set: 'register',
    source: r.sentence,
    chip: `${from.en} → ${to.en}`,
    note: bi(`${r.de}: ${r.levels.casual} · ${r.levels.neutral} · ${r.levels.formal}`, `${r.levels.casual} · ${r.levels.neutral} · ${r.levels.formal}`),
    gap: null,
    answers: [...r.answers],
    why: bi(`${from.de} „${r.levels[r.from]}“ → ${to.de} „${r.levels[r.to]}“ (${r.de}).`, `${from.en} "${r.levels[r.from]}" → ${to.en} "${r.levels[r.to]}".`),
  };
}

/** Phrasal Verbs: gerade Nummern Mail → Call, ungerade Call → Mail (beide Richtungen üben). */
export function fromPhrasal(p: PhrasalItem): MotorItem {
  const n = Number(p.id.slice(1)) || 0;
  const toCall = n % 2 === 1;
  const source = (toCall ? p.mail[0] : p.call[0]) ?? '';
  return {
    id: p.id,
    set: 'phrasal',
    source,
    chip: toCall ? 'Mail → Call' : 'Call → Mail',
    note: bi(p.de, p.de),
    gap: null,
    answers: toCall ? [...p.call] : [...p.mail],
    why: bi(`${p.formal} (Mail, formell) ↔ ${p.phrasal} (Call, gesprochen) = ${p.de}.`, `${p.formal} (email, formal) ↔ ${p.phrasal} (call, spoken).`),
  };
}

/** Überleitungen: je Lücke eine Aufgabe; die übrigen Lücken stehen mit der Musterlösung da. */
export function fromTransition(d: TransitionItem): MotorItem[] {
  const parts = d.text.split('___');
  return d.gaps.map((g, i) => {
    let text = parts[0] ?? '';
    for (let k = 1; k < parts.length; k++) text += (k - 1 === i ? '___' : (d.gaps[k - 1]?.answers[0] ?? '…')) + (parts[k] ?? '');
    return { id: `${d.id}-${i + 1}`, set: 'transition' as const, source: null, chip: g.fn.en, note: g.fn, gap: text, answers: [...g.answers], why: bi(`Überleitung für „${g.fn.de}“: ${g.answers.join(', ')}.`, `Transition for ${g.fn.en}: ${g.answers.join(', ')}.`) };
  });
}

export type MotorCheck = ReturnType<typeof checkAnswer> & { hint: TransformHint };

/** Prüfen: Umformungen mit Schlüsselwort-Hinweis, sonst „beginnt mit …“. */
export function checkMotor(item: MotorItem, given: string, transform?: Transform | null): MotorCheck {
  if (item.set === 'transform' && transform) return checkTransform(transform, given);
  const res = checkAnswer(given, item.answers);
  return { ...res, hint: res.verdict === 'ok' ? null : 'start' };
}

/** Anfang der Musterlösung für den Hinweis. */
export function motorStart(item: MotorItem, transform?: Transform | null): string {
  if (item.set === 'transform' && transform) return transformStart(transform);
  const words = (item.answers[0] ?? '').split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(item.gap ? 1 : 3, Math.max(1, words.length - 1))).join(' ');
}

/** Satz mit Füllung (Lücke) bzw. der ganze Satz. */
export const motorFilled = (item: MotorItem, fill: string): string => (item.gap ? item.gap.replace('___', fill.trim()) : fill.trim());
