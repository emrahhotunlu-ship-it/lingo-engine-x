import { getWriter } from '../../data';
import { appendChat, readChat, type ChatMsg } from '../../domain/companion/chatDoc';
import { logError, logWarn } from '../../platform/diagnostics';

// Schreibwege des Begleiters (Phase 5 §5.1), nur über den einen Writer:
// - Nachrichten anhängen, wenn eine Antwort fertig ist oder mit Teiltext gestoppt wurde,
// - „Neues Gespräch" setzt `since`.
// Ein vorhandenes Dokument mit unerwartetem Aufbau wird nie angefasst (`invalid`).

export type SaveOutcome = 'saved' | 'unchanged' | 'local' | 'invalid' | 'failed';

export async function saveChatMsgs(add: readonly ChatMsg[]): Promise<SaveOutcome> {
  const writer = getWriter();
  if (!writer) return 'local';
  let invalid = false;
  try {
    const r = await writer.transform('app/chat', (cur) => {
      if (!cur) return { set: { msgs: appendChat([], add) } };
      const chat = readChat(cur);
      if (!chat.ok) {
        invalid = true;
        return null;
      }
      const msgs = appendChat(chat.msgs, add);
      return msgs.length === chat.msgs.length && msgs.every((m, i) => m === chat.msgs[i]) ? null : { update: { msgs } };
    });
    if (invalid) {
      logWarn('companion:save', { code: 'invalid_document', message: 'app/chat hat einen unerwarteten Aufbau – nicht geschrieben' }, 'app/chat');
      return 'invalid';
    }
    return r === 'unchanged' ? 'unchanged' : 'saved';
  } catch (err) {
    logError('companion:save', err, 'app/chat');
    return 'failed';
  }
}

export async function saveChatSince(since: number): Promise<SaveOutcome> {
  const writer = getWriter();
  if (!writer) return 'local';
  let invalid = false;
  try {
    await writer.transform('app/chat', (cur) => {
      if (!cur) return { set: { msgs: [], since } };
      if (!readChat(cur).ok) {
        invalid = true;
        return null;
      }
      return { update: { since } };
    });
    return invalid ? 'invalid' : 'saved';
  } catch (err) {
    logError('companion:since', err, 'app/chat');
    return 'failed';
  }
}
