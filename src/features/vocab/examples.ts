import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { acceptCollocations, collocPatch, type StoredColloc } from '../../domain/srs/collocs';
import { acceptExamples, examplesPatch, storedExamples, type StoredExample } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { cardExamples as template } from '../../prompts/cardExamples';
import { logError, logWarn } from '../../platform/diagnostics';

// Fehlende Beispielsätze und typische Wortpartner einer Karte von Claude ergänzen lassen (CLAUDE.md A7, Englischlehrer
// 02.10.2026): höchstens EIN Aufruf je Karte und Seitenaufruf, ausgelöst durch „Prüfen" (eine Handlung), nie in einer
// Schleife. Die Sätze werden als `xEx`, die Wortpartner als `col` (mit `ai: 1`) an der Karte gespeichert – nur, wenn die Karte
// als Dokument existiert und das jeweilige Feld noch fehlt (frischer Stand, nur ergänzen, nie ersetzen). Gab es keinen
// brauchbaren Wortpartner, merkt `colAt`, dass es versucht wurde (30 Tage Ruhe).

/** `col`: von Claude ergänzte Wortpartner, die tatsächlich gespeichert wurden (die Karte der laufenden Runde kennt sie noch nicht). */
type Entry = { status: 'loading' | 'done' | 'error'; items: StoredExample[]; col?: readonly StoredColloc[] };
export const useExamples = create<{ byCard: Record<string, Entry> }>(() => ({ byCard: {} }));

let ctl: AbortController | null = null;

/** Beim Verlassen des Trainers: laufende Anfragen abbrechen (Bildschirmwechsel, A6.2). */
export function abortExamples(): void {
  ctl?.abort();
  ctl = null;
}

function set(id: string, e: Entry): void {
  useExamples.setState((s) => ({ byCard: { ...s.byCard, [id]: e } }));
}

export function requestExamples(card: TrainCard): void {
  if (useExamples.getState().byCard[card.id]) return;
  ctl ??= new AbortController();
  const signal = ctl.signal;
  set(card.id, { status: 'loading', items: [] });
  const vars = { word: card.word, pos: card.pos ?? '', meaning: card.def ?? card.de ?? '', sentence: card.context?.sentence ?? '' };
  askJson({ template, vars, signal })
    .then(async (r) => {
      const now = Date.now();
      // Hat die Karte schon gespeicherte Sätze, werden neue nicht gezeigt und nicht gespeichert (nie ersetzen).
      const items = storedExamples(card.doc).length ? [] : acceptExamples(card.word, r.data.examples, now);
      // Wortpartner nur für Vokabeln mit eigenem Dokument (Wendungen haben ihr eigenes Format).
      const cols = card.kind === 'vocab' && card.inDb ? acceptCollocations(card.word, r.data.collocations) : [];
      set(card.id, { status: 'done', items });
      const writer = getWriter();
      if (!writer) return;
      try {
        let saved: readonly StoredColloc[] = [];
        await writer.transform(card.path, (cur) => {
          const colPatch = card.kind === 'vocab' && card.inDb ? collocPatch(cur, cols, now) : null;
          saved = colPatch?.col ?? [];
          const patch = { ...(examplesPatch(cur, items) ?? {}), ...(colPatch ?? {}) };
          return Object.keys(patch).length ? { update: patch } : null;
        });
        // Die Rückseite zeigt die Wortpartner sofort, aber nur, was wirklich gespeichert wurde.
        if (saved.length) set(card.id, { status: 'done', items, col: saved });
      } catch (err) {
        logError('trainer:examples', err, card.path);
      }
    })
    .catch((err: unknown) => {
      if (isAiFailure(err) && err.kind === 'cancelled') {
        useExamples.setState((s) => {
          const next = { ...s.byCard };
          delete next[card.id];
          return { byCard: next };
        });
        return;
      }
      if (!isAiFailure(err) || (err.kind !== 'unavailable' && err.kind !== 'busy')) logWarn('trainer:examples', err, card.id);
      set(card.id, { status: 'error', items: [] });
    });
}
