import { z } from 'zod';
import c1 from './charge1-traps.json';
import c2 from './charge2-business.json';
import c3 from './charge3-gr.json';

// Wörter-Modul V2: Lehrer-Chargen 1–3 (README.md). Daten, kein Code; mit zod geprüft. Benutzt wird nur, was der english-teacher
// vollständig geprüft hat (`review.passes` deckt alle Einträge). Erst wenn Charge 3 ganz geprüft ist, gibt es die Formen M78–M81 (`GR_FORMS_ON`).
// Schwer (JSON): nur per dynamischem Import aus Runde/Auswertung laden, nie aus `api.ts` statisch.

const kind = z.enum(['w', 'pv', 'col', 'ch']);
const reg = z.enum(['f', 'n', 'i']);
const str = (max: number) => z.string().min(1).max(max);
const list = z.array(str(80)).max(12);
export const grSchema = z
  .object({ pat: str(60).optional(), cnt: z.enum(['u', 'c', 'uc']).optional(), sep: z.union([z.literal(0), z.literal(1)]).optional(), var: z.array(str(60)).max(8).optional() })
  .strict();
const reviewSchema = z.looseObject({
  by: z.literal('english-teacher'),
  passes: z.array(z.looseObject({ n: z.number().int().positive(), items: z.string(), ok: z.number().int().min(0) })),
  date: z.string().nullable(),
});

const common = {
  id: z.string().regex(/^[tb]-[a-z0-9-]+$/),
  en: str(80),
  k: kind,
  de: str(120),
  ex: str(200).refine((s) => (s.match(/\[[^\]]+\]/g) ?? []).length === 1, { message: 'genau ein [Ziel] im Satz' }),
  why: str(120),
  reg,
  syn: list.optional(),
  evade: list.optional(),
  uk: list.optional(),
  gr: grSchema.optional(),
};

export const trapSchema = z
  .object({ ...common, type: z.enum(['ff', 'pair', 'spell', 'uncount', 'prep', 'colloc']), trap: str(60).optional(), trapEn: str(80).optional(), pair: str(80).optional(), wrong: list.optional() })
  .strict()
  .superRefine((t, ctx) => {
    const need: Record<string, (keyof typeof t)[]> = { ff: ['trap', 'trapEn'], pair: ['pair'], spell: ['wrong'], uncount: ['wrong'], prep: ['wrong'], colloc: ['wrong'] };
    for (const f of need[t.type] ?? []) if (t[f] === undefined) ctx.addIssue({ code: 'custom', message: `${t.id}: ${String(f)} fehlt für ${t.type}` });
    if (t.type === 'uncount' && t.gr?.cnt !== 'u') ctx.addIssue({ code: 'custom', message: `${t.id}: uncount braucht gr.cnt = u` });
    if (t.type === 'prep' && !t.gr?.pat) ctx.addIssue({ code: 'custom', message: `${t.id}: prep braucht gr.pat` });
  });

export const businessSchema = z.object({ ...common, fn: z.enum(['hedge', 'discourse', 'negotiate', 'objection', 'email', 'meeting', 'dms']) }).strict();

export const grEntrySchema = z
  .object({ head: str(80), src: z.string().regex(/^(seed|pack):.+$/), k: kind, reg, gr: grSchema.optional(), wrong: list.optional(), evade: list.optional() })
  .strict()
  .superRefine((e, ctx) => {
    if (e.gr?.sep !== undefined && e.k !== 'pv') ctx.addIssue({ code: 'custom', message: `${e.src}: sep nur bei pv` });
  });

const fileSchema = <T extends z.ZodTypeAny>(item: T) => z.looseObject({ v: z.literal(1), charge: z.number().int(), review: reviewSchema, items: z.array(item) });

export type Trap = z.infer<typeof trapSchema>;
export type Business = z.infer<typeof businessSchema>;
export type GrEntry = z.infer<typeof grEntrySchema>;

/** Deckt die Prüfung alle Einträge ab? (`items` der Durchgänge als „a-b“; die Zahlen der Durchgänge schließen lückenlos an.) */
export function reviewCovers(review: { passes: { items: string }[] }, n: number): boolean {
  const ranges = review.passes.map((p) => p.items.split('-').map(Number) as [number, number]).sort((a, b) => a[0] - b[0]);
  let next = 1;
  for (const [a, b] of ranges) {
    if (!(a <= next)) return false;
    next = Math.max(next, b + 1);
  }
  return n === 0 || next > n;
}

function load<T extends z.ZodTypeAny>(raw: unknown, item: T): { items: z.infer<T>[]; reviewed: boolean; errors: string[] } {
  const r = fileSchema(item).safeParse(raw);
  if (!r.success) return { items: [], reviewed: false, errors: r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  return { items: r.data.items, reviewed: reviewCovers(r.data.review, r.data.items.length), errors: [] };
}

export const CHARGE1 = load(c1, trapSchema);
export const CHARGE2 = load(c2, businessSchema);
export const CHARGE3 = load(c3, grEntrySchema);

/** Formen M78–M81 frei: erst nach vollständig geprüfter Lehrer-Charge 3 (plan.md §5). */
export const GR_FORMS_ON = CHARGE3.reviewed && CHARGE3.errors.length === 0;

const norm = (s: string) => s.toLowerCase().replace(/^to /, '').trim();
const traps = CHARGE1.reviewed ? CHARGE1.items : [];

/** Rechtschreibliste deutscher Lerner (M40b): falsch → richtig (Wortebene). */
export const MISSPELL: ReadonlyMap<string, string> = new Map(
  traps.filter((t) => t.type === 'spell').flatMap((t) => (t.wrong ?? []).map((w): [string, string] => [norm(w), norm((t.ex.match(/\[([^\]]+)\]/)?.[1] ?? t.en))])),
);

/** Echte englische Verwechslungspaare (M14, M40e), in beide Richtungen. */
export const CONFUSABLE: ReadonlyMap<string, readonly string[]> = (() => {
  const m = new Map<string, string[]>();
  const add = (a: string, b: string) => m.set(a, [...new Set([...(m.get(a) ?? []), b])]);
  for (const t of traps) {
    if (t.type === 'pair' && t.pair) {
      add(norm(t.en), norm(t.pair));
      add(norm(t.pair), norm(t.en));
    }
    // Falscher Freund: das gemeinte, aber falsche englische Wort (*sensitive* statt *sensible*) ist „anderes Wort“, keine Ableitung.
    if (t.type === 'ff' && t.trapEn)
      for (const w of t.trapEn.split(/\s*[/,]\s*/)) {
        add(norm(t.en), norm(w));
        add(norm(w), norm(t.en));
      }
  }
  return m;
})();

/** Fallen-Art je Stichwort: `ff` falscher Freund (Kontrastkarte) oder `pair` (Paar-Regel). */
export const TRAP_KIND: ReadonlyMap<string, 'ff' | 'pair'> = new Map(traps.filter((t) => t.type === 'ff' || t.type === 'pair').map((t) => [norm(t.en), t.type as 'ff' | 'pair']));

/** `k`, `reg`, `gr` und typische Fehlformen je Stichwort (Charge 3, dazu `gr` aus Charge 1 und 2). Nur geprüfte Einträge. */
export const LEX_INFO: ReadonlyMap<string, { k: GrEntry['k']; reg: GrEntry['reg']; gr?: GrEntry['gr']; wrong?: string[]; evade?: string[] }> = (() => {
  const m = new Map<string, { k: GrEntry['k']; reg: GrEntry['reg']; gr?: GrEntry['gr']; wrong?: string[]; evade?: string[] }>();
  if (CHARGE3.reviewed) for (const e of CHARGE3.items) m.set(norm(e.head), { k: e.k, reg: e.reg, ...(e.gr ? { gr: e.gr } : {}), ...(e.wrong ? { wrong: e.wrong } : {}), ...(e.evade ? { evade: e.evade } : {}) });
  const add = (x: { en: string; k: GrEntry['k']; reg: GrEntry['reg']; gr?: GrEntry['gr']; wrong?: string[] }) =>
    m.has(norm(x.en)) || m.set(norm(x.en), { k: x.k, reg: x.reg, ...(x.gr ? { gr: x.gr } : {}), ...(x.wrong ? { wrong: x.wrong } : {}) });
  for (const t of traps) add(t);
  if (CHARGE2.reviewed) for (const b of CHARGE2.items) add(b);
  return m;
})();

/** Wörterbuch für die Auswertung (`check.ts`): Listen aus Charge 1, britisch → US aus der App. `isWord` liefert der Aufrufer. */
export function checkDict(isWord: (w: string) => boolean, toUS: (s: string) => string): { isWord: (w: string) => boolean; misspell: ReadonlyMap<string, string>; confusable: ReadonlyMap<string, readonly string[]>; toUS: (s: string) => string } {
  return { isWord, misspell: MISSPELL, confusable: CONFUSABLE, toUS };
}
