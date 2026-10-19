import { z } from 'zod';
import l1Raw from '../../content/tutor/l1.json?raw';
import { logError, logWarn } from '../../platform/diagnostics';
import { isPatternId, isUseId } from './tutorTypes';

// Übertragungstabelle Deutsch → Englisch (Tutor-Engine v3 §1.1): typische Fehler deutschsprachiger Lernender mit deutscher Ursache.
// Daten, kein Code (`src/content/tutor/l1.json`, Gegenlesung 100 % durch den Englischlehrer). Ein Eintrag zeigt auf ein Grammatik-Muster (`pat`)
// oder ein Gebrauchsmuster (`use`), nennt das Gegenmuster (`vs`) und erkennt den Fehlgebrauch optional per Muster:
//   - `bad`  trifft den Satz MIT der Antwort des Lernenden (ganzer Satz, klein, typografische Apostrophe vereinheitlicht),
//   - `when` muss (falls gesetzt) den erwarteten Satz treffen; `bad` darf den erwarteten Satz nie treffen.
// `kind:'note'` ist ein reiner Hinweis („auch richtig, aber …“) und erzeugt NIE ein Fehlerurteil. Kein Eintrag kodiert richtiges Englisch als Fehler
// (deshalb gibt es „had für frühere Zustände“ nicht als Fehler, nur als Hinweis `l1:used-to-oder-past`).

const Bi = z.object({ de: z.string().min(1).max(300), en: z.string().min(1).max(300) });
const L1Id = z.string().regex(/^l1:[a-z0-9-]{2,40}$/);
const Ref = z.string().refine((s) => isPatternId(s) || isUseId(s), 'pattern or use id');

const EntrySchema = z
  .object({
    id: L1Id,
    pat: z.string().refine(isPatternId, 'pattern id').optional(),
    use: z.string().refine(isUseId, 'use id').optional(),
    vs: Ref,
    kind: z.enum(['error', 'note']),
    trigger_de: z.string().min(1).max(160),
    example: Bi,
    why: Bi,
    bad: z.string().optional(),
    when: z.string().optional(),
  })
  .refine((e) => !!e.pat !== !!e.use, 'exactly one of pat/use');

export const L1FileSchema = z.object({ v: z.literal(1), entries: z.array(EntrySchema).min(1).max(120) });

export type L1Entry = z.infer<typeof EntrySchema> & { badRe: RegExp | null; whenRe: RegExp | null };

function compile(src: string | undefined, id: string): RegExp | null {
  if (!src) return null;
  try {
    return new RegExp(src, 'i');
  } catch (err) {
    logWarn('tutor:l1', err, id);
    return null;
  }
}

let cache: readonly L1Entry[] | null = null;

/** Alle Einträge (beim ersten Gebrauch geparst). Eine ungültige Datei wird protokolliert; dann gibt es keine Einträge (Diagnose fällt auf die übrigen Regeln zurück). */
export function l1Entries(): readonly L1Entry[] {
  if (cache) return cache;
  let raw: unknown = null;
  try {
    raw = JSON.parse(l1Raw);
  } catch (err) {
    logError('tutor:l1', err, 'l1.json');
  }
  const r = L1FileSchema.safeParse(raw);
  if (!r.success) logError('tutor:l1', r.error, 'l1.json');
  cache = r.success ? r.data.entries.map((e) => ({ ...e, badRe: compile(e.bad, e.id), whenRe: compile(e.when, e.id) })) : [];
  return cache;
}

export function l1ById(id: string): L1Entry | null {
  return l1Entries().find((e) => e.id === id) ?? null;
}

/** Text für die Erkennung: klein, typografische Apostrophe und Anführungszeichen vereinheitlicht, Leerraum zusammengefasst. */
export const l1Text = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Einträge, deren Fehlgebrauch im Satz des Lernenden steht, im erwarteten Satz aber nicht (und deren `when` den erwarteten Satz trifft).
 * Fehler zuerst, dann Hinweise; innerhalb in der Reihenfolge der Tabelle.
 * `range` (Zeichenbereich der Antwort in `l1Text(givenSentence)`): der Treffer muss die Antwort berühren. Sonst würde ein Satz, der schon
 * außerhalb der Lücke „seit“-ähnlich gebaut ist, jede beliebige Antwort zu einem Übertragungsfehler machen.
 */
export function l1Matches(givenSentence: string, expectedSentence: string, range?: readonly [number, number] | null): L1Entry[] {
  const g = l1Text(givenSentence);
  const e = l1Text(expectedSentence);
  const touches = (re: RegExp): boolean => {
    const m = re.exec(g);
    if (!m) return false;
    return !range || (m.index < range[1] && m.index + m[0].length > range[0]);
  };
  const hits = l1Entries().filter((x) => x.badRe !== null && touches(x.badRe) && !x.badRe.test(e) && (x.whenRe === null || x.whenRe.test(e)));
  return [...hits.filter((x) => x.kind === 'error'), ...hits.filter((x) => x.kind === 'note')];
}

/** Hinweise (`note`) zu einem Muster, z. B. „used to oder Past Simple“ für `ut.used-to`. Nie ein Fehlerurteil. */
export const l1NotesFor = (pat: string | null | undefined): L1Entry[] => (pat ? l1Entries().filter((x) => x.kind === 'note' && x.pat === pat) : []);
