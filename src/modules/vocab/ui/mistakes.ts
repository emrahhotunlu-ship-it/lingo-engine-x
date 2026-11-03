import { getDb, readDoc } from '../sharedUi';
import { readVlogRecent } from '../data/history';
import { MISTAKE_DAYS, mistakePaths } from '../domain/stats';

// Großpaket B3: „Deine Fehlwörter“ (Wörter-Reiter und Runde `mistakes`): Lexeme mit einer falschen Antwort in den letzten 14 Lerntagen,
// aus dem Verlauf `vlog` (nur lesen). Reiter und Runde rechnen mit derselben Funktion, damit Zahl und Runde dasselbe sagen (Kap. 2 Nr. 2).

async function readOr(path: string): Promise<Record<string, unknown> | null> {
  const db = getDb();
  if (!db) return null;
  const d = await readDoc(db, path);
  return d.status === 'valid' ? d.doc : null;
}

export async function readMistakes(nowMs: number): Promise<string[]> {
  return mistakePaths(await readVlogRecent(readOr, nowMs, MISTAKE_DAYS), nowMs);
}
