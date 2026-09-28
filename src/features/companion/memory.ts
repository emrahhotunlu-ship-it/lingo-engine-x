import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure, type AiMessageKey } from '../../ai/types';
import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { activeMsgs } from '../../domain/companion/chatDoc';
import { addFacts, factsForPrompt, MEMORY_PATH, memoryWritable, readMemory, removeFact, transcriptOf, type MemoryFact } from '../../domain/memory/memory';
import { logError } from '../../platform/diagnostics';
import { memoryExtract, MEMORY_TRANSCRIPT_MAX } from '../../prompts/memoryExtract';
import { MEMORY_PROMPT_FACTS } from '../../prompts/work';
import { allMsgs, useCompanion } from './store';

// „Claude merkt sich“ (Backlog B5): Auf Knopfdruck („Merken“) zieht Claude aus dem laufenden
// Gespräch bis zu 5 Fakten und legt sie in `app/memory` ab (ein transform auf dem frischen Stand,
// Grenzen in domain/memory). In den Einstellungen sichtbar und einzeln löschbar. Die Vorlagen lesen
// sie über `memoryForPrompt()` → prompts/work.ts `memoryLine`. Nie automatisch, nie wiederholt.

type Doc = Record<string, unknown>;

/** `at`: Zähler „Antwort fertig“ (useCompanion.finished) beim Merken – eine neue Antwort macht den Knopf wieder frei. */
export type RememberState = { status: 'idle' | 'running' | 'done' | 'error'; added: number; errorKey: AiMessageKey | null; src: string | null; at: number };

const IDLE: RememberState = { status: 'idle', added: 0, errorKey: null, src: null, at: -1 };

export const useRemember = create<RememberState>(() => IDLE);

let ctl: AbortController | null = null;

/** Gemerkte Fakten (live, älteste zuerst). */
export function useMemoryFacts(): MemoryFact[] {
  const doc = useLive((s) => s.docs['app/memory']);
  return readMemory(doc ?? null);
}

/** Für die Vorlagen: die neuesten Fakten zuerst (synchron aus dem Live-Stand). */
export function memoryForPrompt(): string[] {
  return factsForPrompt(readMemory(useLive.getState().docs['app/memory'] ?? null), MEMORY_PROMPT_FACTS);
}

const opFor = (cur: Readonly<Doc> | undefined, items: MemoryFact[]) => (cur ? { update: { v: 1, items } } : { set: { v: 1, items } });

/** Fakten einer Quelle speichern. true = gespeichert oder nichts zu tun. */
export async function saveFacts(facts: readonly string[], src: string, lang: 'de' | 'en', now = Date.now()): Promise<{ ok: boolean; added: number }> {
  const writer = getWriter();
  if (!writer) return { ok: false, added: 0 };
  let added = 0;
  try {
    await writer.transform(MEMORY_PATH, (cur) => {
      if (!memoryWritable(cur)) {
        logError('memory:save', new Error('app/memory unerwarteter Aufbau – nicht geschrieben'));
        return null;
      }
      const before = readMemory(cur);
      const next = addFacts(before, facts, src, now, lang);
      if (!next) return null;
      added = next.filter((f) => f.src === src).length;
      return opFor(cur, next);
    });
    return { ok: true, added };
  } catch (err) {
    logError('memory:save', err, src);
    return { ok: false, added: 0 };
  }
}

/** Einen Fakt löschen (Einstellungen). */
export async function forgetFact(id: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(MEMORY_PATH, (cur) => {
      if (!cur || !memoryWritable(cur)) return null;
      const next = removeFact(readMemory(cur), id);
      return next ? { update: { items: next } } : null;
    });
    return true;
  } catch (err) {
    logError('memory:forget', err, id);
    return false;
  }
}

/** Quelle des laufenden Gesprächs: `chat:<t der ersten Nachricht>`. */
function currentChat(): { src: string; transcript: string } | null {
  const s = useCompanion.getState();
  const msgs = activeMsgs(allMsgs(s), s.since, Date.now());
  const first = msgs.find((m) => m.t !== undefined)?.t;
  const transcript = transcriptOf(msgs, MEMORY_TRANSCRIPT_MAX);
  if (!transcript || first === undefined) return null;
  return { src: `chat:${first}`, transcript };
}

/** Kann das laufende Gespräch gemerkt werden (mindestens eine eigene Nachricht)? */
export function canRemember(): boolean {
  return currentChat() !== null;
}

/** „Merken“: ein Aufruf memory-extract@1, dann speichern. */
export async function rememberConversation(uiLang: 'de' | 'en', at = useCompanion.getState().finished): Promise<void> {
  const chat = currentChat();
  if (!chat || useRemember.getState().status === 'running') return;
  ctl?.abort();
  const c = new AbortController();
  ctl = c;
  useRemember.setState({ status: 'running', added: 0, errorKey: null, src: chat.src, at });
  try {
    const known = memoryForPrompt().slice(0, 20);
    const r = await askJson({ template: memoryExtract, vars: { uiLang, transcript: chat.transcript, known }, signal: c.signal });
    const saved = r.data.facts.length ? await saveFacts(r.data.facts, chat.src, uiLang) : { ok: true, added: 0 };
    if (ctl !== c) return;
    useRemember.setState(saved.ok ? { status: 'done', added: saved.added, errorKey: null } : { status: 'error', added: 0, errorKey: 'aiFailed' });
  } catch (err) {
    if (ctl !== c) return;
    const f = isAiFailure(err) ? err : null;
    if (f?.kind === 'cancelled') {
      useRemember.setState(IDLE);
      return;
    }
    if (!f) logError('memory:extract', err);
    useRemember.setState({ status: 'error', added: 0, errorKey: f?.messageKey ?? 'aiFailed' });
  } finally {
    if (ctl === c) ctl = null;
  }
}

/** Nur für Tests. */
export function resetRemember(): void {
  ctl?.abort();
  ctl = null;
  useRemember.setState(IDLE);
}
