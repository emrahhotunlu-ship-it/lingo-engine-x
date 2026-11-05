import { create } from 'zustand';
import { askJson } from '../../ai/gate';
import { isAiFailure } from '../../ai/types';
import { getWriter } from '../../data';
import { acceptPack, packPatch, packUsedUp, packWorthIt, readPack, repsOf, type Pack } from '../../domain/srs/pack';
import { typedForm } from '../../domain/chunks/situation';
import type { Lang, TrainCard } from '../../domain/srs/types';
import { PREP_BATCH_MAX, wordPrep, type WordPrepCard } from '../../prompts/wordPrep';
import { logError, logWarn } from '../../platform/diagnostics';

// Kartenpakete vorbereiten (docs/ki-paket-plan.md §2): beim Start einer Runde (Handlung) für die
// Karten der Runde, im Hintergrund, gebündelt (erst 3 Karten, damit die ersten schnell da sind,
// dann je bis zu 8). Niemand wartet darauf: Eine Abfrage ohne Paket nimmt den Ursprungssatz.
// Je Karte und Seitenaufruf höchstens EIN Versuch, nie automatisch wiederholt (A6.3).
// Gespeichert als `xPack` an der Karte (nur, wenn ihr Dokument existiert; sonst nur im Speicher).

const FIRST_BATCH = 3;
/** Höchstens so viele Karten je Runde (20er-Stapel plus Wiederholungen). */
export const PREP_MAX_CARDS = 30;

type State = { byKey: Record<string, Pack>; pending: number };
export const usePacks = create<State>(() => ({ byKey: {}, pending: 0 }));

const tried = new Set<string>();
let ctl: AbortController | null = null;

/** Beim Verlassen des Trainers: laufende Vorbereitung abbrechen (Bildschirmwechsel, A6.2). */
export function abortPacks(): void {
  ctl?.abort();
  ctl = null;
}

/** Paket der Karte: frisch in diesem Seitenaufruf vorbereitet oder gespeichert. */
export function packOf(card: TrainCard): Pack | null {
  return usePacks.getState().byKey[card.key] ?? readPack(card.doc, card);
}

/** Braucht die Karte ein (neues) Paket? Kein Paket, oder alle Sätze sind gelaufen. */
export function needsPack(card: TrainCard): boolean {
  if (!packWorthIt(card) || tried.has(card.key)) return false;
  return packUsedUp(packOf(card), repsOf(card));
}

function prepCard(card: TrainCard, lang: Lang, old: Pack | null): WordPrepCard {
  return {
    word: card.kind === 'chunk' ? typedForm(card.word) : card.word,
    pos: card.pos ?? '',
    meaning: (lang === 'de' ? card.de : card.def) ?? card.def ?? card.de ?? '',
    sentence: card.context?.sentence ?? '',
    collocs: card.col.map((c) => c.p).filter(Boolean).slice(0, 4),
    avoid: old?.prev ?? [],
    kind: card.kind === 'chunk' || /\s/.test(card.lemma) ? 'phrase' : 'word',
  };
}

async function store(card: TrainCard, pack: Pack, replacesT: number | null): Promise<void> {
  if (!card.inDb) return;
  const writer = getWriter();
  if (!writer) return;
  try {
    await writer.transform(card.path, (cur) => {
      const p = packPatch(cur, pack, replacesT);
      return p ? { update: p } : null;
    });
  } catch (err) {
    logError('trainer:packs', err, card.path);
  }
}

async function runBatch(batch: readonly TrainCard[], lang: Lang, signal: AbortSignal): Promise<void> {
  const olds = batch.map((c) => packOf(c));
  usePacks.setState((s) => ({ pending: s.pending + 1 }));
  try {
    const r = await askJson({ template: wordPrep, vars: { cards: batch.map((c, i) => prepCard(c, lang, olds[i] ?? null)), uiLang: lang }, signal });
    const now = Date.now();
    const got: Record<string, Pack> = {};
    for (const out of r.data.cards) {
      const card = batch[out.i];
      if (!card || got[card.key]) continue;
      const old = olds[out.i] ?? null;
      const pack = acceptPack(out, card, lang, { t: now, r0: repsOf(card), prev: old?.prev ?? [] });
      if (!pack) continue;
      got[card.key] = pack;
      void store(card, pack, old ? old.t : null);
    }
    const missing = batch.filter((c) => !got[c.key]).length;
    if (missing) logWarn('trainer:packs', { code: 'partial', message: `${missing} of ${batch.length} cards without usable pack` });
    usePacks.setState((s) => ({ byKey: { ...s.byKey, ...got } }));
  } catch (err) {
    if (isAiFailure(err) && (err.kind === 'cancelled' || err.kind === 'unavailable' || err.kind === 'busy')) {
      // Abgebrochen: beim nächsten Rundenstart darf die Karte erneut vorbereitet werden.
      if (err.kind === 'cancelled') for (const c of batch) tried.delete(c.key);
      return;
    }
    logWarn('trainer:packs', err, batch.map((c) => c.key).join(','));
  } finally {
    usePacks.setState((s) => ({ pending: Math.max(0, s.pending - 1) }));
  }
}

/**
 * Karten der Runde vorbereiten (in Reihenfolge der Runde). Ohne KI tut das nichts. Die Stapel laufen
 * nacheinander: der erste ist klein, damit die ersten Karten schnell ein Paket haben.
 */
export function preparePacks(cards: readonly TrainCard[], lang: Lang, ai: boolean): void {
  if (!ai) return;
  const want: TrainCard[] = [];
  const seen = new Set<string>();
  for (const c of cards) {
    if (seen.has(c.key) || !needsPack(c)) continue;
    seen.add(c.key);
    want.push(c);
    if (want.length >= PREP_MAX_CARDS) break;
  }
  if (!want.length) return;
  for (const c of want) tried.add(c.key);
  ctl ??= new AbortController();
  const signal = ctl.signal;
  const batches: TrainCard[][] = [want.slice(0, FIRST_BATCH)];
  for (let i = FIRST_BATCH; i < want.length; i += PREP_BATCH_MAX) batches.push(want.slice(i, i + PREP_BATCH_MAX));
  void (async () => {
    for (const b of batches) {
      if (signal.aborted) {
        for (const c of b) tried.delete(c.key);
        continue;
      }
      await runBatch(b, lang, signal);
    }
  })();
}

/** Nur für Tests. */
export function resetPacks(): void {
  tried.clear();
  abortPacks();
  usePacks.setState({ byKey: {}, pending: 0 });
}
