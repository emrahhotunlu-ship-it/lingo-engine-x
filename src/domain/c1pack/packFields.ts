import { z } from 'zod';
import rawText from '../../content/c1/pack.json?raw';
import { slug } from '../content';
import type { TrainCard } from '../srs/types';

// Ergänzende Felder des C1-Pakets (Lernplattform 2.0, §3.7): Wortpartner, Partnerwort-Lücke, Falle, Wortfamilie,
// gleichwertige Varianten, Situationssatz und Satzanfänge. Sie stehen in `src/content/c1/pack.json` neben den alten
// Feldern (id, cat, en, de, def, ex, register, why, pos) und werden hier nur GELESEN. `packExtraOf` legt sie beim Lesen
// über eine vorhandene Karte; geschrieben wird damit nichts (§4.8, §8: die Datenbank gewinnt).

const Bi = z.object({ de: z.string().trim().min(3).max(220), en: z.string().trim().min(3).max(220) });

export const PackExtraSchema = z.object({
  /** Wortpartner (2–3), z. B. „address an issue“. */
  col: z
    .array(z.object({ en: z.string().trim().min(2).max(40), ex: z.string().trim().min(8).max(140).optional() }))
    .min(2)
    .max(3)
    .optional(),
  /** Partnerwort-Lücke: `at` ist das Wort der Wendung, das ausgeblendet wird; `wrong` die typische Fehlwahl. */
  gap: z.object({ at: z.string().trim().min(1).max(30), wrong: z.array(z.string().trim().min(1).max(30)).min(1).max(3) }).optional(),
  /** Kennung einer Deutsch-Falle (`content/nb/traps.ts`, f01 …). */
  trap: z.string().regex(/^f\d{2}$/).optional(),
  /** Wortfamilie (nur reale Glieder). */
  fam: z
    .object({ noun: z.string().trim().min(2).max(30), verb: z.string().trim().min(2).max(30), adj: z.string().trim().min(2).max(30), adv: z.string().trim().min(2).max(30) })
    .partial()
    .optional(),
  /** Gleichwertige Varianten (constraint ~ restriction). */
  alt: z.array(z.string().trim().min(2).max(40)).max(4).optional(),
  /** Situationssatz für „Aus der Situation“ (ohne die Wendung selbst). */
  scene: Bi.optional(),
  /** Satzanfänge für „Satz vervollständigen“ (ohne das Zielwort). */
  starts: z.array(z.string().trim().min(8).max(70)).max(2).optional(),
});
export type PackExtra = z.infer<typeof PackExtraSchema>;

/** Alte Felder eines Eintrags, soweit `packExtraOf` sie bei Bedarf mitliefert. */
export type PackBase = { id: string; en: string; register?: 'formal' | 'neutral' | 'informal'; why?: string };
export type PackExtraView = PackExtra & { id: string; register?: PackBase['register']; why?: string };

type Row = Record<string, unknown>;
let byId: ReadonlyMap<string, Row> | null = null;
let bySlug: ReadonlyMap<string, Row> | null = null;

// Erst beim ersten Aufruf geparst (der Text liegt ohnehin eingebettet im Bündel; `pack.ts` liest dieselbe Datei).
function load(): void {
  if (byId && bySlug) return;
  const items = (JSON.parse(rawText) as { items?: Row[] }).items ?? [];
  byId = new Map(items.map((i) => [String(i.id), i]));
  bySlug = new Map(items.map((i) => [slug(String(i.en)), i]));
}

/** Alle Einträge mit gültigen Zusatzfeldern (Reihenfolge der Datei). Ungültige Felder fallen weg, der Test prüft, dass keines wegfällt. */
export function packExtras(): PackExtraView[] {
  load();
  return [...(byId as ReadonlyMap<string, Row>).values()].flatMap((r) => {
    const x = viewOf(r);
    return x ? [x] : [];
  });
}

function viewOf(r: Row): PackExtraView | null {
  const keys = ['col', 'gap', 'trap', 'fam', 'alt', 'scene', 'starts'] as const;
  const part: Record<string, unknown> = {};
  for (const k of keys) if (r[k] !== undefined) part[k] = r[k];
  const parsed = PackExtraSchema.safeParse(part);
  if (!parsed.success) return null;
  const reg = r.register;
  const why = r.why;
  return {
    ...parsed.data,
    id: String(r.id),
    ...(reg === 'formal' || reg === 'neutral' || reg === 'informal' ? { register: reg } : {}),
    ...(typeof why === 'string' && why ? { why } : {}),
  };
}

const refId = (doc: Readonly<Record<string, unknown>> | undefined): string | null => {
  for (const k of ['origin', 'src'] as const) {
    const o = doc?.[k];
    const ref = o && typeof o === 'object' ? (o as { ref?: unknown }).ref : undefined;
    if (typeof ref === 'string' && ref.startsWith('c1pack/')) return ref.slice('c1pack/'.length);
  }
  return null;
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/**
 * Zusatzfelder zu einem Eintrag (Kennung oder englischer Text) oder zu einer Karte (über die Herkunft `c1pack/<id>`, sonst über den
 * englischen Text). Überlagerung beim Lesen: was die Karte selbst trägt (`register`, `why`), bleibt unverändert und gewinnt;
 * nur Fehlendes kommt aus dem Paket. Ohne Paketeintrag: `null`. Schreibt nie.
 */
export function packExtraOf(key: string | Pick<TrainCard, 'word' | 'doc'>): PackExtraView | null {
  load();
  const card = typeof key === 'string' ? null : key;
  const row =
    (card ? (byId as ReadonlyMap<string, Row>).get(refId(card.doc) ?? '') : (byId as ReadonlyMap<string, Row>).get(key as string)) ??
    (bySlug as ReadonlyMap<string, Row>).get(slug(card ? card.word : (key as string)));
  if (!row) return null;
  const v = viewOf(row);
  if (!v || !card) return v;
  const own = { register: str(card.doc.register), why: str(card.doc.why) };
  const reg = own.register === 'formal' || own.register === 'neutral' || own.register === 'informal' ? own.register : undefined;
  const { register: _r, why: _w, ...rest } = v;
  void _r;
  void _w;
  const register = reg ?? v.register;
  const why = own.why ?? v.why;
  return { ...rest, ...(register ? { register } : {}), ...(why ? { why } : {}) };
}
