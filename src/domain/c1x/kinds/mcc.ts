import { hash32, mulberry32, shuffle } from '../../random';
import type { C1Response, C1Score, Mcc } from '../types';
import { BRITISH, wordCount, type Problems } from './common';

/** `mcc`: Auswahl A–D, 1 Punkt, nie frei. */
export function scoreMcc(item: Mcc, r: Extract<C1Response, { kind: 'mcc' }>): C1Score {
  const ok = r.pick === item.answer;
  return { got: ok ? 1 : 0, max: 1, parts: [{ id: 'a', ok }], verdict: ok ? 'correct' : 'wrong', free: false };
}

export function checkMcc(item: Mcc): Problems {
  const out: Problems = [];
  const n = wordCount(item.text);
  if (n < 8 || n > 30) out.push(`Satz hat ${n} Wörter (8–30)`);
  const opts = item.options.map((o) => o.trim().toLowerCase());
  if (new Set(opts).size !== 4) out.push('Optionen nicht alle verschieden');
  const right = item.options[item.answer];
  if (!right) out.push('answer zeigt auf keine Option');
  else if (new RegExp(`\\b${right.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(item.text.replace(/_{3,}/, ' '))) out.push('Lösungswort steht schon im Satz');
  item.options.forEach((o, i) => {
    if (i === item.answer) return;
    if (!item.why.wrong.some((r) => r.opt !== undefined && r.opt.trim().toLowerCase() === o.trim().toLowerCase())) out.push(`falsche Option „${o}“ ohne Begründung (WhyRule mit opt)`);
  });
  if (BRITISH.test(item.text) || item.options.some((o) => BRITISH.test(o))) out.push('britische Schreibweise');
  return out;
}

/** Hinweis 2: die falsche Option, die ausgegraut wird (stabil je Aufgabe, nie die Lösung und nie die gerade gewählte Option). */
export function mccMuted(item: Mcc, avoid: number | null = null): number {
  const wrong = [0, 1, 2, 3].filter((i) => i !== item.answer && i !== avoid);
  return wrong[hash32(`mcc-muted|${item.id}`) % wrong.length] ?? 0;
}

/**
 * Anzeigereihenfolge der Optionen: fest gemischt je Aufgabe und Tag (stabiler Startwert), damit die richtige Antwort nicht im festen Kreis
 * A, B, C, D steht. `order[anzeige] = Index in item.options`. Auswertung, Begründungen und Radar arbeiten weiter mit dem Index im Inhalt.
 */
export function mccOrder(item: Mcc, day: string): number[] {
  return shuffle(
    item.options.map((_, i) => i),
    mulberry32(hash32(`mcc-order|${item.id}|${day}`)),
  );
}
