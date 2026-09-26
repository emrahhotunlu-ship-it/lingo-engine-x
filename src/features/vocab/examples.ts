import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { acceptExamples, examplesPatch, type StoredExample } from '../../domain/srs/examples';
import type { TrainCard } from '../../domain/srs/types';
import { cardExamples as template } from '../../prompts/cardExamples';
import { logError, logWarn } from '../../platform/diagnostics';

// Fehlende Beispielsätze einer Karte von Claude ergänzen lassen (CLAUDE.md A7):
// höchstens EIN Aufruf je Karte und Seitenaufruf, ausgelöst durch „Prüfen" (eine Handlung),
// nie wiederholt. Das Ergebnis wird als `xEx` an der Karte gespeichert – nur, wenn die Karte
// als Dokument existiert und noch kein `xEx` hat (frischer Stand, nur ergänzen).

type Entry = { status: 'loading' | 'done' | 'error'; items: StoredExample[] };
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
      const items = acceptExamples(card.word, r.data.examples, Date.now());
      set(card.id, { status: 'done', items });
      if (!items.length) return;
      const writer = getWriter();
      if (!writer) return;
      try {
        await writer.transform(card.path, (cur) => {
          const p = examplesPatch(cur, items);
          return p ? { update: p } : null;
        });
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
