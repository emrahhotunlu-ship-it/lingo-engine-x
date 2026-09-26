import { getDb } from '../platform/capabilities';
import { createWriter, type Writer } from './writer';

// Zugang zum einen Schreibpfad der App (Kap. 3.4).

let writer: Writer | null = null;

export function getWriter(): Writer | null {
  if (writer) return writer;
  const db = getDb();
  if (!db) return null;
  writer = createWriter(db);
  return writer;
}
