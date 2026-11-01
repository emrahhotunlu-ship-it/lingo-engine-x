import type { Lex } from '../domain/types';
import { lexWriteSchema } from './schemas';

// Leichtes Lesen von `lex` (nur zod): für die Tür `api.ts`, damit `todayBlock`/`lexemeState` keinen Planer-Code laden (plan.md §2.1 Ladezeit).

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** Lexem aus einem Dokument, nur wenn gültig und nicht aus einer künftigen Version (wird dann nie zurückgeschrieben). */
export function lexOf(doc: Doc | undefined | null): Lex | null {
  if (!doc || !isObj(doc.lex)) return null;
  const r = lexWriteSchema.safeParse(doc.lex);
  return r.success ? (r.data as Lex) : null;
}

export const isFutureLex = (doc: Doc | undefined | null): boolean => !!doc && isObj(doc.lex) && typeof doc.lex.v === 'number' && doc.lex.v > 1;

