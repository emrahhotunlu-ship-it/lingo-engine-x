import type { Lex } from '../domain/types';
import { lexWriteSchema } from './schemas';

// Leichtes Lesen von `lex` (nur zod): für die Tür `api.ts`, damit `todayBlock`/`lexemeState` keinen Planer-Code laden (plan.md §2.1 Ladezeit).
//
// Löschmarken (data-guard V3 Schritt 3, B1): `update` mischt verschachtelte Objekte rekursiv (contract/db.d.ts), ein weggelassenes Feld
// bleibt also in der Datenbank stehen. Fällt ein optionales Feld weg (`ct` nach der Kontrastkarte, `fq.xf`/`fq.e`, Einträge in `fq.h`,
// Teile von `gr`), schreibt der Patch dort `null`. Beim Lesen gilt `null` an genau diesen Stellen wie „nicht vorhanden“.

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** Optionale Felder, an denen `null` eine Löschmarke ist (alle anderen `null` sind echte Werte des Schemas). */
const TOMB_TOP = ['ct', 'fq'] as const;
const TOMB_FQ = ['xf', 'e'] as const;
const TOMB_GR = ['pat', 'cnt', 'sep', 'var'] as const;

const strip = (o: Doc, keys: readonly string[]): Doc => {
  const out = { ...o };
  for (const k of keys) if (out[k] === null) delete out[k];
  return out;
};

/** Löschmarken entfernen, damit das strenge Schema das Lexem liest. */
export function dropTombs(raw: Doc): Doc {
  const lex = strip(raw, TOMB_TOP);
  if (isObj(lex.fq)) {
    const fq = strip(lex.fq, TOMB_FQ);
    if (isObj(fq.h)) fq.h = Object.fromEntries(Object.entries(fq.h).filter(([, v]) => v !== null));
    lex.fq = fq;
  }
  if (isObj(lex.gr)) lex.gr = strip(lex.gr, TOMB_GR);
  return lex;
}

/**
 * Patch für `lex`: der neue Stand plus `null` für jedes Feld, das im gespeicherten Stand steht und im neuen fehlt (rekursiv nur in
 * Objekten, die `update` auch rekursiv mischt). Felder mit `null` schon im alten Stand bleiben `null` (kein Unterschied, kein Schreiben).
 */
export function lexPatch(prev: unknown, next: Doc): Doc {
  if (!isObj(prev)) return next;
  const out: Doc = { ...next };
  for (const [k, v] of Object.entries(prev)) {
    if (!(k in next)) out[k] = null;
    else if (isObj(v) && isObj(next[k])) out[k] = lexPatch(v, next[k]);
  }
  return out;
}

/** Lexem aus einem Dokument, nur wenn gültig und nicht aus einer künftigen Version (wird dann nie zurückgeschrieben). */
export function lexOf(doc: Doc | undefined | null): Lex | null {
  if (!doc || !isObj(doc.lex)) return null;
  const r = lexWriteSchema.safeParse(dropTombs(doc.lex));
  return r.success ? (r.data as Lex) : null;
}

export const isFutureLex = (doc: Doc | undefined | null): boolean => !!doc && isObj(doc.lex) && typeof doc.lex.v === 'number' && doc.lex.v > 1;
