import { lemmaCandidates, usSpelling } from '../text/lemma';
import { textForms } from './newShare';

// Wortstatus im Leser (Neubau N51, LingQ LQ2 – aber dezent): Wörter, die im eigenen Wortschatz
// stehen, bekommen eine leise Markierung. Gelb gepunktet = am Lernen, grün = sicher gespeichert.
// Unbekanntes bleibt unmarkiert (kein Blau-Rauschen). Rein; die Oberfläche setzt daraus CSS-Regeln
// auf `button.lx-word[data-lookup]`, ohne den Text neu zu zerlegen.

export type VocabStatus = 'learning' | 'known';

/** Ab dieser Stufe gilt eine Karte als sicher (wie der Filter „Sicher“ der Wortliste). */
export const KNOWN_STAGE = 4;

export type StatusCard = { word: string; stage: number; hidden?: boolean };

const keyOf = (w: string): string => usSpelling(w.toLowerCase().replace(/[’‘]/g, "'").trim());

/** Einzelwort-Karten → Schlüssel (US-Schreibweise, klein) → Status. Wendungen mit Leerzeichen zählen nicht. */
export function statusIndex(cards: Iterable<StatusCard>): Map<string, VocabStatus> {
  const out = new Map<string, VocabStatus>();
  for (const c of cards) {
    if (c.hidden) continue;
    const w = keyOf(c.word.replace(/^to\s+/i, ''));
    if (!w || /\s/.test(w)) continue;
    const st: VocabStatus = c.stage >= KNOWN_STAGE ? 'known' : 'learning';
    // Mehrere Karten derselben Form: „am Lernen“ gewinnt (die Markierung erinnert ans Üben).
    if (out.get(w) !== 'learning') out.set(w, st);
  }
  return out;
}

/** Status einer Wortform im Text (Form selbst oder eine ihrer Grundformen). */
export function statusOf(form: string, index: ReadonlyMap<string, VocabStatus>): VocabStatus | null {
  const k = keyOf(form);
  const direct = index.get(k);
  if (direct) return direct;
  for (const c of lemmaCandidates(k)) {
    const s = index.get(keyOf(c));
    if (s) return s;
  }
  return null;
}

export type TextStatus = { learning: string[]; known: string[] };

/** Wortformen des Texts (klein), die im Wortschatz stehen, getrennt nach Status. */
export function textStatus(text: string, index: ReadonlyMap<string, VocabStatus>): TextStatus {
  const out: TextStatus = { learning: [], known: [] };
  if (!index.size) return out;
  for (const w of textForms(text, true)) {
    const s = statusOf(w, index);
    if (s) out[s].push(w);
  }
  return out;
}

/** Wert für einen CSS-Attributselektor in doppelten Anführungszeichen. */
const cssString = (s: string): string => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/**
 * CSS-Regeln für einen Container `[data-reader="<scope>"]`. Nur Farb-Tokens (G10), nur Unterstreichung –
 * die Zeile springt nie.
 */
export function statusCss(scope: string, st: TextStatus): string {
  const sel = (words: readonly string[]) => words.map((w) => `[data-reader="${cssString(scope)}"] .lx-word[data-lookup="${cssString(w)}"]`).join(',');
  const rules: string[] = [];
  if (st.learning.length)
    rules.push(`${sel(st.learning)}{text-decoration-line:underline;text-decoration-style:dotted;text-decoration-color:var(--lx-gold-text);text-decoration-thickness:2px;text-underline-offset:4px}`);
  if (st.known.length) rules.push(`${sel(st.known)}{text-decoration-line:underline;text-decoration-color:color-mix(in srgb,var(--lx-accent-text) 55%,transparent);text-underline-offset:4px}`);
  return rules.join('\n');
}
