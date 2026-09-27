import { useEffect } from 'react';
import { create } from 'zustand';
import type { Seeing } from '../../domain/companion/seeing';

// „Sieht gerade" (Phase 5 §3.4): Jeder Bildschirm meldet mit EINER Zeile, was er zeigt:
//   useCompanionSee({ area: 'grammar', label: 'Grammatik · Passiv', phase: 'question', detail: '…' });
// Der Begleiter liest immer die zuletzt angemeldete Registrierung. Beim Aushängen meldet sich
// der Bildschirm ab. In Fragezuständen `phase: 'question'` und KEIN `reveal`/keine Lösung in `detail`.

export type { Seeing, SeeingArea } from '../../domain/companion/seeing';

type Entry = { key: number; seeing: Seeing };
type SeeingState = { stack: Entry[] };

export const useSeeing = create<SeeingState>(() => ({ stack: [] }));
let nextKey = 1;

/** Oberste Registrierung oder `null` (dann „sieht gerade: Heute"). */
export function currentSeeing(): Seeing | null {
  const s = useSeeing.getState().stack;
  return s.length ? (s[s.length - 1]?.seeing ?? null) : null;
}

export function useCurrentSeeing(): Seeing | null {
  return useSeeing((s) => (s.stack.length ? (s.stack[s.stack.length - 1]?.seeing ?? null) : null));
}

/** Meldet an, aktualisiert bei Änderung (Vergleich per JSON), meldet beim Aushängen ab. */
export function useCompanionSee(info: Seeing | null): void {
  const json = info ? JSON.stringify(info) : '';
  useEffect(() => {
    if (!json) return;
    const seeing = JSON.parse(json) as Seeing;
    const key = nextKey++;
    useSeeing.setState((s) => ({ stack: [...s.stack, { key, seeing }] }));
    return () => useSeeing.setState((s) => ({ stack: s.stack.filter((e) => e.key !== key) }));
  }, [json]);
}
