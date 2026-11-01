import { z } from 'zod';
import { FORMS } from '../domain/types';

// Wörter-Modul V1: Schemas (plan.md §3; data-guard V0 Befund 2). Gelesen wird tolerant (`looseObject`, eine höhere Version wird nie
// zurückgeschrieben, wie `isFutureFsrs`), geschrieben wird streng (`lexWriteSchema`).

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const int = z.number().int();

export const trackSchema = z
  .object({
    due: int.nonnegative(),
    s: z.number().min(0).max(36_500),
    d: z.number().min(0).max(10),
    st: int.min(0).max(3),
    reps: int.min(0),
    lapses: int.min(0),
    last: int.positive().nullable(),
    sd: int.min(0),
    ls: int.min(0),
  })
  .strict();

export const LEX_VERSION = 1;

const formEnum = z.enum(FORMS as unknown as [string, ...string[]]);
/** V2: Formen-Statistik je Lexem (`lex.fq`, optional: Lexeme aus V1 haben sie nicht). Klein gehalten: ≤ 27 Formen × 2 Zahlen, ≤ 8 Ausweichwörter. */
export const fqSchema = z
  .object({
    l: formEnum.nullable(),
    c: int.min(0).max(100_000),
    h: z.partialRecord(formEnum, z.tuple([int.min(0), int.min(0)])),
    nb: int.min(0).max(9),
    ak: z.union([z.literal(0), z.literal(1)]).nullable(),
    ew: z.array(z.string().min(1).max(60)).max(8),
    xf: int.min(0).max(9).optional(),
    e: z.array(z.enum(['prep', 'plural', 'order'])).max(3).optional(),
  })
  .strict()
  .refine((f) => Object.values(f.h).every((x) => !x || x[1] <= x[0]), { message: 'fq.h: richtig ≤ Versuche' });

/** Streng, für jedes Schreiben von `lex`. */
export const lexWriteSchema = z
  .object({
    v: z.literal(LEX_VERSION),
    k: z.enum(['w', 'pv', 'col', 'ch']),
    of: z.string().regex(/^(vocab|chunk)\/[^/]+$/).nullable(),
    core: z.string().regex(/^(vocab|chunk)\/[^/]+$/).nullable(),
    sense: z.string().regex(/^(vocab|chunk)\/[^/]+$/).nullable(),
    lv: int.min(1).max(7),
    u: trackSchema,
    b: trackSchema.nullable(),
    day: day.nullable(),
    dayU: day.nullable(),
    step: z.object({ n: int.min(1).max(99), at: int.positive(), gap: int.min(0).max(99) }).strict().nullable(),
    ev: z.object({ f: z.array(day).max(8), o: int.min(0), s: int.min(0) }).strict(),
    sn: z.array(z.tuple([z.string().min(1).max(80), day])).max(12),
    gr: z
      .object({ pat: z.string().max(60).optional(), cnt: z.enum(['u', 'c', 'uc']).optional(), sep: z.union([z.literal(0), z.literal(1)]).optional(), var: z.array(z.string().max(60)).max(8).optional() })
      .strict()
      .nullable(),
    reg: z.enum(['f', 'n', 'i']).nullable(),
    pri: z.enum(['core', 'edge']),
    lc: int.min(0),
    pair: z.string().regex(/^(vocab|chunk)\/[^/]+$/).nullable(),
    mv: int.min(0).max(3),
    sync: int.min(0),
    mig: z.object({ t: int.positive(), from: z.literal('srs1'), h: int.min(0), full: z.union([z.literal(0), z.literal(1)]) }).strict().nullable(),
    intro: day.nullable(),
    fq: fqSchema.optional(),
    ct: z.object({ at: int.positive(), w: z.string().min(1).max(60).nullable() }).strict().optional(),
  })
  .strict()
  .refine((l) => l.of === null || l.of !== l.core, { message: 'of und core verschieden' });

/** Tolerant: nur die Version wird geprüft; der Rest beim Schreiben. */
export const lexReadSchema = z.looseObject({ v: z.number() });

/** `vlog/<JJJJ-MM>-a|b[n]`: `{v: 1, e: {Schlüssel: Tupel | null}}` (null = rückgängig). */
export const vlogSchema = z.looseObject({ v: z.number().optional(), e: z.record(z.string(), z.unknown()).optional() });

/** `vmod/day` (eingefroren je Lerntag) und `vmod/stats` (Median-Zeiten, Behaltensrate, offenes vlog-Dokument). Tolerant gelesen. */
export const vmodSchema = z.looseObject({});

/** `vmod/ix`: Verzeichnis der Verlaufsdokumente (V3 Schritt 1). Kennung ohne `vlog/` → 1. */
export const vmodIxWriteSchema = z
  .object({ v: z.literal(1), docs: z.record(z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])-[ab][2-9]?$/), z.literal(1)) })
  .strict();

export const vmodDayWriteSchema = z
  .object({
    v: z.literal(1),
    d: day,
    plan: z.array(z.tuple([z.string(), z.enum(['u', 'b', 'n']), z.string().max(12)])).max(400),
    min: z.number().min(0).max(600),
    due: int.min(0),
    fresh: int.min(0),
    ahead: int.min(0),
    moved: int.min(0),
    why: z.string().max(200),
    /** V3 Schritt 4: Rückstand je Lerntag (höchstens SPREAD_DAYS Tage). Optional: ältere Pläne haben es nicht. */
    sp: z.array(z.tuple([day, int.min(1)])).max(8).optional(),
  })
  .strict();

export const vmodStatsWriteSchema = z
  .object({
    v: z.literal(1),
    med: z.record(z.string(), int.min(0).max(600_000)),
    n: z.record(z.string(), int.min(0)),
    cur: z.string().regex(/^vlog\/\d{4}-\d{2}-[ab]\d*$/).nullable(),
    ret: z.object({ ok: int.min(0), all: int.min(0) }).strict(),
    /** V2 (M39): Median der Zeit bis zum ersten Zeichen je Form (ms, gekappt bei 45 s) und Zahl der Antworten je Form. */
    fk: z.partialRecord(formEnum, int.min(0).max(45_000)).optional(),
    fkn: z.partialRecord(formEnum, int.min(0)).optional(),
    t: int.positive(),
  })
  .strict();

/** Großpaket A S5c: höchstens so viele Texte warten auf „Später prüfen lassen“ (die ältesten fallen weg). */
export const USE_LATER_MAX = 6;
const useFrame = z.enum(['mail', 'slack', 'call', 'pitch', 'life']);

/** Ein Text, der ohne Claude geschrieben wurde und später geprüft wird (nur Belege, keine Planwirkung). `w` = [Pfad, Stufe beim Schreiben]. */
export const useLaterSchema = z
  .object({
    t: int.positive(),
    form: z.enum(['transfer', 'own']),
    frame: useFrame,
    sit: int.min(0).max(9),
    text: z.string().min(1).max(1200),
    spoken: z.boolean(),
    w: z.array(z.tuple([z.string().regex(/^(vocab|chunk)\//), int.min(0).max(7)])).min(1).max(5),
  })
  .strict();
export type UseLater = z.infer<typeof useLaterSchema>;

/** `vmod/use` (Großpaket A S5c): letzter Tag mit Alltags-Lage (einmal pro Woche) und die Liste „Später prüfen lassen“. */
export const vmodUseWriteSchema = z
  .object({ v: z.literal(1), life: day.nullable(), later: z.array(useLaterSchema).max(USE_LATER_MAX) })
  .strict();

/** `app/profile.vcfg` (plan.md §3.5). `mod` = Rückweg-Schalter für alle Geräte (§9.4). */
export const vcfgSchema = z
  .object({
    min: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
    ret: z.union([z.literal(0.85), z.literal(0.9), z.literal(0.95)]),
    mod: z.union([z.literal(0), z.literal(1)]),
    w: z.object({ col: z.number().min(0).max(1), job: z.number().min(0).max(1), own: z.number().min(0).max(1), band: z.number().min(0).max(1) }).strict().optional(),
    rd: int.min(0).max(6).nullable().optional(),
  })
  .strict();

/** `app/schema.vocabModule`: Versionsmarke der Umrechnung (§9.1). */
export const vocabModuleMarkSchema = z.object({ v: z.literal(1), t: int.positive(), state: z.enum(['dry', 'running', 'done']) }).strict();
