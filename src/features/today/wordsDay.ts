import { create } from 'zustand';
import { readDoc } from '../../data/reads';
import { loadWordsDayPlan, vocabModuleOn, wordsDayCount } from '../../modules/vocab/api';
import { getDb } from '../../platform/capabilities';
import { logError } from '../../platform/diagnostics';
import { useLive } from '../../data/live';

// K11/K12/K13 (Emrah 04.11.2026: „0 von 64“ auf Heute, „30 → 31 → 32“ in der Runde): Heute zählt die Wörter aus DERSELBEN Quelle wie der
// Zähler der Wörter-Runde – dem eingefrorenen Wörter-Plan (einzelne Wörter, `domain/dayCount.ts`). Der Plan wird je Lerntag einmal
// eingefroren und ändert sich danach nicht (außer „Heute nur kurz“); Heute liest ihn beim Öffnen frisch (ein Dokument), erledigt wird über
// die Live-Wortdokumente gezählt. Solange der Plan nicht gelesen ist, nennt Heute keine Wortzahl (nie eine andere Zahl als die Runde).

type PlanEntry = readonly [string, string, string];
type WordsDayState = { d: string | null; plan: readonly PlanEntry[] | null };

export const useWordsDay = create<WordsDayState>(() => ({ d: null, plan: null }));

let reading: Promise<void> | null = null;
let again = false;

async function readOnce(today: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const plan = await loadWordsDayPlan(async (path) => {
      const r = await readDoc(db, path);
      return r.status === 'valid' ? r.doc : undefined;
    }, today);
    // Kein Plan für heute (noch nicht eingefroren): nichts merken, beim nächsten Öffnen von Heute erneut.
    if (plan) useWordsDay.setState({ d: today, plan });
  } catch (err) {
    logError('today:words-day', err);
  }
}

/**
 * eingefrorenen Wörter-Plan lesen (nur mit eingeschalteter Wörter-App). Läuft schon ein Lesen, folgt genau EIN weiteres danach (der Plan kann inzwischen
 * eingefroren oder verkleinert sein) – nie eine Schleife.
 */
export function loadWordsDay(today: string): Promise<void> {
  if (!vocabModuleOn(useLive.getState().docs['app/profile']) || !getDb()) return Promise.resolve();
  if (reading) {
    again = true;
    return reading;
  }
  const run = async (): Promise<void> => {
    try {
      await readOnce(today);
      if (again) {
        again = false;
        await readOnce(today);
      }
    } finally {
      reading = null;
    }
  };
  const p = run();
  reading = p;
  return p;
}

/** Wörter von heute als „erledigt von gesamt“ (`null` = Plan unbekannt). Liest die Live-Dokumente `vocab/*` und `chunk/*`. */
export function wordsDayProgress(today: string, s: WordsDayState, vocab: ReadonlyMap<string, Record<string, unknown>> | undefined, chunk: ReadonlyMap<string, Record<string, unknown>> | undefined): { done: number; total: number } | null {
  if (s.d !== today || !s.plan) return null;
  const c = wordsDayCount(s.plan, today, (path) => {
    const slash = path.indexOf('/');
    const coll = path.slice(0, slash);
    const id = path.slice(slash + 1);
    return coll === 'vocab' ? vocab?.get(id) : coll === 'chunk' ? chunk?.get(id) : null;
  });
  return c.total > 0 ? c : null;
}
