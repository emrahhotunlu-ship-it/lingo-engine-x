import { create } from 'zustand';
import { getDb } from '../../platform/capabilities';
import { logWarn } from '../../platform/diagnostics';
import { readDoc } from '../../data/reads';
import { poolTasks } from '../../domain/grammar/pool';
import type { GrammarTask } from '../../domain/learn/types';

// Eingaben der Lern-Runden, die nicht live abonniert sind (phase2-plan D16): `app/pool` per `get()`, dazu die offenen Aufgaben des Tagesauftrags aus `ensureDay`
// (`useDayInputs`, §4.10). Alles nur im Speicher. Die Runden werden synchron im Klick gebaut
// (Tastatur am iPhone), darum liegen die Daten vorher bereit; fehlen sie noch, läuft die Runde
// mit Startaufgaben und Seed – nie ohne Inhalt.

type InputsState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  /** Aufgaben aus `app/pool`. */
  pool: GrammarTask[];
  /** Offene Aufgaben des Tagesauftrags (neueste Tage zuerst), aus `ensureDay`. */
  dailyOpen: GrammarTask[];
  dailyDay: string | null;
};

export const useLearnInputs = create<InputsState>(() => ({ status: 'idle', pool: [], dailyOpen: [], dailyDay: null }));

let running: Promise<void> | null = null;

/** Pool (neu) lesen. Nie in einer Schleife; ausgelöst durch Start, Tageswechsel oder eigenes Schreiben. */
export function loadLearnInputs(): Promise<void> {
  if (running) return running;
  const db = getDb();
  if (!db) return Promise.resolve();
  if (useLearnInputs.getState().status === 'idle') useLearnInputs.setState({ status: 'loading' });
  running = (async () => {
    try {
      const pool = await readDoc(db, 'app/pool');
      useLearnInputs.setState({
        status: 'ready',
        pool: pool.status === 'valid' ? poolTasks(pool.doc) : [],
      });
    } catch (err) {
      logWarn('learn:inputs', err, 'app/pool');
      useLearnInputs.setState((s) => ({ status: s.status === 'ready' ? 'ready' : 'error' }));
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Offene Aufgaben des Tagesauftrags übernehmen (aus `ensureDay`, Schritt 1). */
export function setDailyOpen(day: string, tasks: readonly GrammarTask[]): void {
  useLearnInputs.setState({ dailyOpen: [...tasks], dailyDay: day });
}
