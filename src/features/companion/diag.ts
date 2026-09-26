import { chatBytes, readChat } from '../../domain/companion/chatDoc';

// Diagnose-Zeilen der Phase 5 (§5.8): Größe von `app/chat` und Anzahl der Preply-Dokumente.

type Doc = Record<string, unknown>;

export function phase5Diag(raw: ReadonlyMap<string, Doc>): { chatMsgs: number; chatKb: number; preply: number } {
  const chat = readChat(raw.get('app/chat'));
  let preply = 0;
  for (const p of raw.keys()) if (p.startsWith('preply/')) preply += 1;
  return { chatMsgs: chat.msgs.length, chatKb: Math.round(chatBytes(chat.msgs, chat.since) / 1024), preply };
}
