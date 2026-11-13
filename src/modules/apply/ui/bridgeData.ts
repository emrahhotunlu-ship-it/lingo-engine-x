import { useEffect, useRef, useState } from 'react';
import { getDb, loadBridgeWords, outPath, readDoc, useComboPairs, useLive, useTodayPattern, type BridgeLex } from '../sharedUi';
import { bridgeFrames, bridgeHistory, bridgeHistoryDays, knownPatterns, logWarn, patternById, pickBridge, safePatterns } from '../shared';
import type { BridgeHistory, BridgeTarget, BridgeWord } from '../shared';

// Ziele der Brücken-Sätze aus dem Lernstand (P4). Einmal je Öffnen gerechnet (der Bildschirm friert sie für den Lerntag ein, Kap. 15):
//  - Wörter aus der Wörter-App (`api.loadBridgeWords`: Stufe, letzter Übungstag laut Verlauf, eigene Sätze), als Rückfall die Wörter des alten Wegs;
//  - Muster: heute = Adapter `useTodayPattern` (Grammatik-Schritt von heute), sicher/begonnen = aus den Thema-Dokumenten;
//  - Sperre: `out/<Monat>` der letzten 14 Tage (je Monat ein `get`, nichts abonniert, nichts geschrieben).
// Nur lesen. Ein Lesefehler lässt nur seinen Teil weg (ohne Verlauf keine Sperre, ohne Wörter-App der alte Weg) und steht in der Diagnose.

type Doc = Record<string, unknown>;

export type BridgeLoad = { state: 'loading' } | { state: 'ready'; targets: BridgeTarget[]; history: BridgeHistory };

const EMPTY_HISTORY = (): BridgeHistory => ({ last: new Map(), today: new Set(), todayPats: new Set() });

/** Verlauf der Brücken-Sätze (Sperre, heute schon benutzt) aus den Monatsdokumenten; ein Lesefehler lässt nur diesen Monat weg. */
export async function readBridgeHistory(day: string): Promise<BridgeHistory> {
  const db = getDb();
  if (!db) return EMPTY_HISTORY();
  const paths = [...new Set(bridgeHistoryDays(day).map((d) => outPath(d)))];
  const docs = await Promise.all(
    paths.map(async (p) => {
      try {
        const r = await readDoc(db, p);
        return r.status === 'valid' ? r.doc : null;
      } catch (err) {
        logWarn('apply:bridge-history', err, p);
        return null;
      }
    }),
  );
  return bridgeHistory(docs, day);
}

const lexWord = (w: BridgeLex): BridgeWord => ({ key: w.path, path: w.path, head: w.head, word: w.word, de: w.de, kind: w.kind, lv: w.lv, example: w.example, own: w.own, intro: w.intro, practiced: w.practiced });

/** Wörter des alten Wegs (Karten nach Fehlerzahl, `useComboPairs`) als Rückfall; die Bedeutung kommt aus der Wortkarte. */
function legacyWords(pairs: ReadonlyArray<{ word: string; key?: string }>, vocab: ReadonlyMap<string, Doc> | undefined): BridgeWord[] {
  const out: BridgeWord[] = [];
  for (const p of pairs) {
    // Die alten Karten führen Verben als „to handle“: benutzt wird die Grundform.
    const word = p.word.trim().replace(/^to\s+/i, '');
    if (!word) continue;
    const id = p.key?.startsWith('vocab/') ? p.key.slice('vocab/'.length) : null;
    const de = id ? vocab?.get(id)?.de : undefined;
    out.push({ key: p.key ?? `w:${word.toLowerCase()}`, path: null, head: word, word, de: typeof de === 'string' ? de.trim() : '', kind: word.includes(' ') ? 'col' : 'w', lv: 0, example: null, own: 0, intro: null, practiced: null });
  }
  return out;
}

/**
 * Die Brücken-Sätze dieses Öffnens. `frozen` = der Bildschirm hat schon eingefrorene Ziele (dann wird nichts gelesen). `free` = freiwillige
 * Zusatzrunde: heute schon benutzte Wörter und Muster bleiben draußen.
 */
export function useBridgeTargets(i: { day: string; n: number; free: boolean; frozen: boolean }): BridgeLoad {
  const pairs = useComboPairs();
  const todayPat = useTodayPattern();
  const ready = useLive((s) => s.status !== 'waiting');
  const live = useRef({ pairs, todayPat });
  useEffect(() => {
    live.current = { pairs, todayPat };
  }, [pairs, todayPat]);
  const [state, setState] = useState<BridgeLoad>({ state: 'loading' });
  const { day, n, free, frozen } = i;
  useEffect(() => {
    if (frozen || !ready) return;
    let alive = true;
    const run = async (): Promise<void> => {
      const [lex, history] = await Promise.all([
        loadBridgeWords(Date.now()).catch((err: unknown) => {
          logWarn('apply:bridge-words', err);
          return null;
        }),
        readBridgeHistory(day),
      ]);
      if (!alive) return;
      const s = useLive.getState();
      const grammar = [...(s.collections.grammar ?? new Map<string, Doc>()).entries()];
      const known = (id: string): string | null => patternById(id)?.topic ?? null;
      const tp = live.current.todayPat;
      const targets = pickBridge({
        words: (lex ?? []).map(lexWord),
        legacy: legacyWords(live.current.pairs, s.collections.vocab),
        todayPat: tp ? { id: tp.id, topic: tp.topic } : null,
        safe: safePatterns(grammar, day, known),
        known: knownPatterns(grammar, day, known),
        frames: bridgeFrames(),
        last: history.last,
        today: day,
        n,
        ...(free ? { skip: history.today, skipPats: history.todayPats } : {}),
      });
      setState({ state: 'ready', targets, history });
    };
    run().catch((err: unknown) => {
      logWarn('apply:bridge-targets', err);
      if (alive) setState({ state: 'ready', targets: [], history: EMPTY_HISTORY() });
    });
    return () => {
      alive = false;
    };
  }, [day, n, free, frozen, ready]);
  return state;
}
