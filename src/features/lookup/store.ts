import { create } from 'zustand';
import { getWriter } from '../../data';
import { readOnce } from '../../data/snapshot';
import { cacheEntry, cachePatch, lookupKey } from '../../domain/lookup/cache';
import { newVocabDoc, saveCardOp, type NewVocabInput } from '../../domain/srs/newCard';
import type { WordLookupOut } from '../../prompts/wordLookup';
import { getDb } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';

// Daten des Nachschlagens: `app/lookup` wird einmal je Seitenaufruf gelesen (kein Abo) und
// nach eigenen Schreibvorgängen lokal nachgeführt. Geschrieben wird nur über den Writer.

type Doc = Record<string, unknown>;
type State = { status: 'idle' | 'loading' | 'ready' | 'error'; doc: Doc | undefined; saved: Record<string, true> };

export const useLookupData = create<State>(() => ({ status: 'idle', doc: undefined, saved: {} }));

/** `app/lookup` einmal laden (weitere Aufrufe tun nichts). */
export function ensureLookupLoaded(): void {
  const s = useLookupData.getState();
  if (s.status !== 'idle') return;
  const db = getDb();
  if (!db) return;
  useLookupData.setState({ status: 'loading' });
  readOnce('app/lookup', () => db.doc('app/lookup').get())
    .then((snap) => useLookupData.setState({ status: 'ready', doc: snap.exists ? snap.data() : undefined }))
    .catch((err: unknown) => {
      logWarn('lookup:load', err);
      useLookupData.setState({ status: 'error' });
    });
}

/** KI-Ergebnis im Zwischenspeicher ablegen (frischer Stand, nur ergänzen, ≤ 400). */
export async function storeLookup(word: string, out: WordLookupOut, uiLang: 'de' | 'en'): Promise<void> {
  const writer = getWriter();
  const key = lookupKey(out.lemma) ?? lookupKey(word);
  if (!writer || !key) return;
  const entry = cacheEntry(out, uiLang, Date.now());
  try {
    let next: Doc | undefined;
    await writer.transform('app/lookup', (cur) => {
      const op = cachePatch(cur, key, entry);
      if (!op) return null;
      if ('set' in op) next = op.set;
      else if ('replace' in op) next = op.replace;
      else {
        const items = { ...((cur?.items as Doc | undefined) ?? {}) };
        for (const [k, v] of Object.entries(op.update.items as Doc)) items[k] = v && typeof v === 'object' && items[k] && typeof items[k] === 'object' ? { ...(items[k] as Doc), ...(v as Doc) } : v;
        next = { ...(cur ?? {}), items };
      }
      return op;
    });
    if (next) useLookupData.setState({ doc: next });
  } catch (err) {
    logError('lookup:store', err, key);
  }
}

/** saved = neu angelegt · added = Satz an bestehender Karte ergänzt · exists = nichts geändert. */
export type SaveResult = 'saved' | 'added' | 'exists' | 'invalid' | 'failed';

/** „Als Karte speichern": anlegen, falls es die Karte nicht gibt; sonst höchstens Satz ergänzen. */
export async function saveLookupCard(input: NewVocabInput): Promise<SaveResult> {
  const writer = getWriter();
  const made = newVocabDoc(input);
  if (!made) return 'invalid';
  if (!writer) return 'failed';
  try {
    const r = await writer.transform(`vocab/${made.id}`, (cur) => saveCardOp(cur, made));
    useLookupData.setState((s) => ({ saved: { ...s.saved, [made.id]: true } }));
    return r === 'created' ? 'saved' : r === 'updated' ? 'added' : 'exists';
  } catch (err) {
    logError('lookup:save', err, made.id);
    return 'failed';
  }
}
