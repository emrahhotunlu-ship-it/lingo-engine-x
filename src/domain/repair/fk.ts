import { z } from 'zod';
import b1Raw from '../../content/fk/b1.json?raw';
import b2Raw from '../../content/fk/b2.json?raw';
import { logError } from '../../platform/diagnostics';
import { patternById } from '../grammar/patterns';
import { hash32 } from '../random';
import { checkRepairLocal, type LocalVerdict } from './check';

// Paket FK (docs/umbau/wort-lernen-plan.md): die neuen Aufgabenformen für „Fehler korrigieren“.
//  B1 „Sag es richtig“: Lage + deutsche Absicht -> ein englischer Satz (Prüfung lokal gegen Musterlösung und Varianten, sonst Claude `quick`).
//  B2 „Welche Fassung schickst du?“: zwei Fassungen wählen, Begründung, danach ein neuer Satz mit zwei Stellen.
//  B3 „Fehler mit Etikett“ ist die bestehende Korrektur eines sauberen Originalsatzes, nur mit Fehlerart und Kontext (kein eigener Inhalt).
// Inhalte stehen als Daten in `src/content/fk/*.json` (DE + EN), geparst beim ersten Gebrauch, ungültige Dateien werden protokolliert.

const Bi = z.object({ de: z.string().min(1), en: z.string().min(1) });
const B1Schema = z.object({
  id: z.string().min(1),
  pat: z.string().min(3),
  sit: Bi,
  intent: Bi,
  hint: Bi,
  model: z.string().min(8),
  ok: z.array(z.string().min(8)).max(8),
  bad: z.string().min(8),
  why: Bi,
});
const Gap = z.object({ o: z.array(z.string().min(1)).length(2), ok: z.number().int().min(0).max(1) });
const B2Schema = z.object({
  id: z.string().min(1),
  pat: z.string().min(3),
  sit: Bi,
  good: z.string().min(8),
  bad: z.string().min(8),
  why: Bi,
  next: z.object({ s: z.string().regex(/\{1\}.*\{2\}/), gaps: z.tuple([Gap, Gap]) }),
});
export type FkB1 = z.infer<typeof B1Schema> & { topic: string };
export type FkB2 = z.infer<typeof B2Schema> & { topic: string };

function load<S extends z.ZodType<{ pat: string }>>(raw: string, schema: S, name: string): Array<z.infer<S> & { topic: string }> {
  try {
    const parsed = z.object({ tasks: z.array(schema) }).safeParse(JSON.parse(raw));
    if (!parsed.success) {
      logError('fk:content', parsed.error, name);
      return [];
    }
    const out: Array<z.infer<S> & { topic: string }> = [];
    for (const t of parsed.data.tasks) {
      const topic = patternById(t.pat)?.topic;
      if (!topic) {
        logError('fk:content', new Error(`Muster unbekannt: ${t.pat}`), name);
        continue;
      }
      out.push({ ...t, topic });
    }
    return out;
  } catch (err) {
    logError('fk:content', err, name);
    return [];
  }
}

let b1Cache: FkB1[] | null = null;
let b2Cache: FkB2[] | null = null;
export const b1Tasks = (): readonly FkB1[] => (b1Cache ??= load(b1Raw, B1Schema, 'b1.json'));
export const b2Tasks = (): readonly FkB2[] => (b2Cache ??= load(b2Raw, B2Schema, 'b2.json'));

const bare = (pat: string): string => (pat.includes(':') ? pat.slice(pat.indexOf(':') + 1) : pat);

export type FkKind = 'b1' | 'b2';
type Ref = { pat?: string | null; topic?: string | null };

/** Aufgaben passend zu Muster, sonst (ohne Muster oder ohne Treffer) zum Thema. */
export function fkPool<K extends FkKind>(kind: K, ref: Ref): ReadonlyArray<K extends 'b1' ? FkB1 : FkB2> {
  const all = (kind === 'b1' ? b1Tasks() : b2Tasks()) as ReadonlyArray<FkB1 | FkB2>;
  const pat = ref.pat ? bare(ref.pat) : '';
  const byPat = pat ? all.filter((t) => t.pat === pat) : [];
  const topic = ref.topic ?? (pat ? patternById(pat)?.topic : null) ?? null;
  const list = byPat.length ? byPat : topic ? all.filter((t) => t.topic === topic) : [];
  return list as unknown as ReadonlyArray<K extends 'b1' ? FkB1 : FkB2>;
}

/** Gibt es zu diesem Muster oder Thema eine „Sag es richtig“-Aufgabe? (Voraussetzung dafür, dass ein ausgeblendeter Fehlersatz als B1 wiederkommt.) */
export const hasFk = (ref: Ref): boolean => fkPool('b1', ref).length > 0;

/** Eine Aufgabe auswählen: bevorzugt eine noch nicht gezeigte, sonst nach Zufall (deterministisch aus `seed`). */
export function pickFk<K extends FkKind>(kind: K, ref: Ref, seed: string, seen: ReadonlySet<string>): (K extends 'b1' ? FkB1 : FkB2) | null {
  const pool = fkPool(kind, ref);
  if (!pool.length) return null;
  const fresh = pool.filter((t) => !seen.has(t.id));
  const from = fresh.length ? fresh : pool;
  return from[hash32(seed) % from.length] ?? null;
}

const rank: Record<LocalVerdict, number> = { exact: 2, close: 1, no: 0 };

/** Lokale Prüfung von B1: Musterlösung und akzeptierte Varianten; die beste Übereinstimmung zählt. */
export function checkB1(given: string, task: Pick<FkB1, 'model' | 'ok' | 'bad'>): LocalVerdict {
  let best: LocalVerdict = 'no';
  for (const right of [task.model, ...task.ok]) {
    const v = checkRepairLocal(given, { wrong: task.bad, right });
    if (rank[v] > rank[best]) best = v;
    if (best === 'exact') break;
  }
  return best;
}
