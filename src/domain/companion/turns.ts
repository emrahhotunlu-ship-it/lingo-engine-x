import type { Turn, TurnInput } from '../../prompts/types';
import type { ChatMsg } from './chatDoc';

// Eingabe eines Gesprächs für `sample` (Phase 5 §6.1): Einleitung (führender `user`-Schritt),
// dann Verlauf, dann die neue Nachricht. Rein und getestet.
// - Jede Verlaufsnachricht höchstens 3.000 Zeichen,
// - die ÄLTESTEN Verlaufsnachrichten fallen weg, bis Summe ≤ 56.000 Bytes und ≤ 20 Nachrichten,
// - Einleitung und neue Nachricht bleiben immer,
// - Beginn und Ende sind garantiert `user`, leere Inhalte fallen weg.

export const TURNS_MAX_BYTES = 56_000;
export const HISTORY_MAX = 20;
export const HISTORY_MSG_MAX = 3_000;

const encoder = new TextEncoder();
const bytes = (s: string) => encoder.encode(s).length;

function clipChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max - 1).join('').trimEnd() + '…';
}

export function buildChatInput(lead: string, history: readonly Pick<ChatMsg, 'role' | 'content'>[], message: string): TurnInput {
  const leadTurn: Turn = { role: 'user', content: lead.trim() || '(no instructions)' };
  const last: Turn = { role: 'user', content: message.trim() || '…' };
  let hist: Turn[] = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content.trim())
    .map((m) => ({ role: m.role, content: clipChars(m.content.trim(), HISTORY_MSG_MAX) }));
  hist = hist.slice(-HISTORY_MAX);
  const fixed = bytes(leadTurn.content) + bytes(last.content);
  let total = fixed + hist.reduce((n, t) => n + bytes(t.content), 0);
  while (hist.length && total > TURNS_MAX_BYTES) {
    const dropped = hist.shift();
    if (dropped) total -= bytes(dropped.content);
  }
  // Gleiche Rollen hintereinander sind erlaubt (sample.d.ts); maßgeblich sind Anfang und Ende.
  return [leadTurn, ...hist, last];
}
