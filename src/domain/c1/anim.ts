import { z } from 'zod';
import { logWarn } from '../../platform/diagnostics';

// Struktur-Filme (Lernplattform 3.0 §6.4, P61; c1-programm §6): je Muster ein kurzer „Film“ aus 2–4 Sätzen, in denen die Wörter an ihren
// neuen Platz wandern. Die Quellen liegen in `src/content/c1/anim/*.json` (Charge 1 = a1.json, Charge 2 = a2.json; P62/P63 füllen sie)
// und werden hier zu EINEM Bestand gebündelt (`animFilms()`, das ist der Inhalt von „anim.json“). Reiner Inhalt, nichts wird gespeichert.
//
// Format je Film:
//   { id, topic, pat, title {de,en}, de,                 – Thema, Muster, Titel, deutsche Bedeutung (gilt für alle Schritte: gleicher Sinn, andere Form)
//     predict: { kind:'tap', q, ans:[i…] }               – Schritt 0: „Welches Wort wandert?“ → Wort(e) in Schritt 0 antippen
//            | { kind:'pick', q, opts:[a,b], ans:0|1 }   – Schritt 0: „Wie beginnt der Satz danach?“ → eine von zwei Optionen
//     steps: [{ en, hi?:[i…], move?:[[von,nach]…], note {de,en} }] }
// Wörter = Leerzeichen-getrennte Teile von `en`. `hi` = Signalwörter (leuchten). `move` legt fest, welches Wort aus dem vorigen Schritt zu
// welchem Wort in diesem wird (auch mit neuer Form, z. B. hire → hired); alles andere ordnet `planMorph` selbst zu (gleiche Wörter in Reihenfolge).

const Bi = z.object({ de: z.string().min(1), en: z.string().min(1) });
const Idx = z.number().int().min(0);

export const FilmPredictSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('tap'), q: Bi, ans: z.array(Idx).min(1) }),
  z.object({ kind: z.literal('pick'), q: Bi, opts: z.tuple([z.string().min(1), z.string().min(1)]), ans: z.union([z.literal(0), z.literal(1)]) }),
]);

export const FilmStepSchema = z.object({
  en: z.string().min(1),
  hi: z.array(Idx).optional(),
  move: z.array(z.tuple([Idx, Idx])).optional(),
  note: Bi,
});

export const FilmSchema = z
  .object({
    id: z.string().regex(/^f\.[a-z0-9.-]+$/),
    topic: z.string().min(1),
    pat: z.string().min(1),
    title: Bi,
    de: z.string().min(1),
    /** Pflicht: jeder Film beginnt mit einer Vorhersage (Generierungseffekt, §6.4). */
    predict: FilmPredictSchema,
    steps: z.array(FilmStepSchema).min(2).max(5),
  })
  .superRefine((f, ctx) => {
    const lens = f.steps.map((s) => words(s.en).length);
    f.steps.forEach((s, i) => {
      const n = lens[i] ?? 0;
      for (const h of s.hi ?? []) if (h >= n) ctx.addIssue({ code: 'custom', message: `${f.id}: hi ${h} außerhalb von Schritt ${i}` });
      if (i === 0 && s.move?.length) ctx.addIssue({ code: 'custom', message: `${f.id}: Schritt 0 hat kein move` });
      for (const [a, b] of s.move ?? []) {
        if (a >= (lens[i - 1] ?? 0) || b >= n) ctx.addIssue({ code: 'custom', message: `${f.id}: move [${a},${b}] außerhalb in Schritt ${i}` });
      }
    });
    if (f.predict.kind === 'tap') for (const a of f.predict.ans) if (a >= (lens[0] ?? 0)) ctx.addIssue({ code: 'custom', message: `${f.id}: Vorhersage ${a} außerhalb` });
  });

export const FilmFileSchema = z.object({ v: z.literal(1), items: z.array(FilmSchema) });

export type Film = z.infer<typeof FilmSchema>;
export type FilmStep = z.infer<typeof FilmStepSchema>;
export type FilmPredict = z.infer<typeof FilmPredictSchema>;

/** Die Wörter eines Satzes (wie der Spieler sie zeigt). */
export function words(en: string): string[] {
  return en.trim().split(/\s+/).filter(Boolean);
}

const files = import.meta.glob('../../content/c1/anim/*.json', { query: '?raw', import: 'default', eager: true });

/** Alle Filme aus den Quelldateien (geprüft, nach Dateipfad gebündelt, doppelte `id` fallen mit Warnung weg). Einmal geparst. */
export function parseFilmFiles(src: Readonly<Record<string, string>>): Film[] {
  const out: Film[] = [];
  const seen = new Set<string>();
  for (const name of Object.keys(src).sort()) {
    let json: unknown;
    try {
      json = JSON.parse(String(src[name]));
    } catch (err) {
      logWarn('anim:parse', err, name);
      continue;
    }
    const r = FilmFileSchema.safeParse(json);
    if (!r.success) {
      logWarn('anim:schema', r.error, name);
      continue;
    }
    for (const f of r.data.items) {
      if (seen.has(f.id)) {
        logWarn('anim:dupe', new Error(`Doppelte Film-Kennung ${f.id}`), name);
        continue;
      }
      seen.add(f.id);
      out.push(f);
    }
  }
  return out;
}

let cache: Film[] | null = null;
export function animFilms(): readonly Film[] {
  cache ??= parseFilmFiles(files);
  return cache;
}

/** Film zu Thema und Muster (oder `null`). */
export function filmFor(topic: string | null | undefined, pat: string | null | undefined): Film | null {
  if (!topic || !pat) return null;
  return animFilms().find((f) => f.topic === topic && f.pat === pat) ?? null;
}

/** Erster Film eines Kapitels (in der Lehrreihenfolge seiner Themen). */
export function filmForTopics(topics: readonly string[]): Film | null {
  const all = animFilms();
  for (const t of topics) {
    const f = all.find((x) => x.topic === t);
    if (f) return f;
  }
  return null;
}
