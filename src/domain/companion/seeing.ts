// Was der Begleiter „gerade sieht" (Phase 5 §3.4, E5-05). Rein: kein React, keine KI.
// Bildschirme melden ihren Kontext über `useCompanionSee` (features/companion/seeing.ts).
// Vor dem Prüfen einer Übung (`phase: 'question'`) darf die Lösung Claude nie erreichen:
// `redact` entfernt `reveal`, und `detail` darf sie ohnehin nicht enthalten.

export type SeeingArea =
  | 'today'
  | 'overview'
  | 'trainer'
  | 'course'
  | 'grammar'
  | 'drills'
  | 'speak'
  | 'business'
  | 'read'
  | 'listen'
  | 'write'
  | 'discover'
  | 'teacher'
  | 'settings';

export type Seeing = {
  area: SeeingArea;
  /** Oberflächensprache, ≤ 60 Zeichen, z. B. „Grammatik · Passiv". */
  label: string;
  /** Für Claude, ≤ 1.500 Zeichen: Aufgabe, Satz mit ___, Textausschnitt – nie die Lösung vor dem Prüfen. */
  detail?: string;
  phase?: 'question' | 'feedback' | 'idle';
  /** ≤ 600 Zeichen: Lösung und eigene Antwort; wird NUR bei `phase: 'feedback'` gesendet. */
  reveal?: string;
  /**
   * Nur für `question`: Wörter, die vor dem Prüfen nirgends an Claude gehen dürfen (Lösung und
   * ihre Formen). Wird selbst nie gesendet; `maskText` schwärzt sie in mitgeschickten Texten,
   * z. B. im Satz eines angetippten Worts („Claude fragen").
   */
  mask?: string[];
};

export const LABEL_MAX = 60;
export const DETAIL_MAX = 1_500;
export const REVEAL_MAX = 600;

function cut(s: string, max: number): string {
  const chars = Array.from(s.trim());
  return chars.length <= max ? chars.join('') : chars.slice(0, max - 1).join('').trimEnd() + '…';
}

/**
 * Kontext für Claude: kürzt alle Felder und schwärzt die Lösung, solange die Übung nicht
 * geprüft ist. Nur bei `feedback` bleibt `reveal`.
 */
export function redact(s: Seeing | null): Seeing | null {
  if (!s) return null;
  const out: Seeing = { area: s.area, label: cut(s.label, LABEL_MAX) };
  if (s.phase) out.phase = s.phase;
  if (s.detail?.trim()) out.detail = cut(s.detail, DETAIL_MAX);
  if (s.phase === 'feedback' && s.reveal?.trim()) out.reveal = cut(s.reveal, REVEAL_MAX);
  return out;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Schwärzt vor dem Prüfen die Lösungswörter (`mask`) in einem mitgeschickten Text. */
export function maskText(text: string, s: Seeing | null): string {
  if (s?.phase !== 'question' || !s.mask?.length) return text;
  let out = text;
  const words = [...new Set(s.mask.map((m) => m.trim().replace(/^to\s+/i, '')).filter((m) => m.length >= 2))].sort((a, b) => b.length - a.length);
  for (const w of words) out = out.replace(new RegExp(`(^|[^A-Za-z])${escapeRe(w)}(?![A-Za-z])`, 'gi'), '$1___');
  return out;
}

/** Liegt eine offene Übung vor, deren Lösung Claude nicht nennen darf? */
export const isQuestion = (s: Seeing | null): boolean => s?.phase === 'question';
