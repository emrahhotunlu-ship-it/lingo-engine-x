import { z } from 'zod';
import poolRaw from '../../content/c1/order.json?raw';
import { logError, logWarn } from '../../platform/diagnostics';
import { isWrongLang } from '../lang/detect';

// Fester Pool der Übung „Satzbau“ (Emrah 02.10.2026, nach Beratung Englischlehrer + Lernwissenschaft): C1-Sätze
// mit deutscher Bedeutung, von Hand gesetzten Bausteinen, allen gültigen Reihenfolgen (`alt`) oder dem Grund,
// warum es keine zweite gibt (`single`), und einer Warum-Zeile zum Satz. Kein Claude-Aufruf, keine Ablenker.
// Eingebettet als Text und erst beim ersten Gebrauch geparst (leistung.md §4 Nr. 5).

export type PoolEntry = {
  topic: string;
  en: string;
  de: string;
  chunks: readonly string[];
  /** Weitere gültige Sätze aus denselben Bausteinen (ganze Sätze). */
  alt: readonly string[];
  /** Grund, warum es keine zweite natürliche Reihenfolge gibt (genau eines von `alt`/`single`). */
  single: string | null;
  why: { de: string; en: string };
  /** Typische falsche Fassung eines Deutschsprachigen (optional). */
  bad: string | null;
  /** Von Claude erzeugt (und automatisch geprüft), nicht aus dem festen Pool. */
  ai?: boolean;
};

const RawEntry = z.object({
  topic: z.string().min(1),
  en: z.string().min(1),
  de: z.string().min(1),
  chunks: z.array(z.string().min(1)).min(5).max(9),
  alt: z.array(z.string()).optional(),
  single: z.string().optional(),
  why: z.tuple([z.string().min(1), z.string().min(1)]),
  bad: z.string().optional(),
});

/** Vergleichsform: klein, ohne Satzzeichen, einfache Leerzeichen. */
export const poolNorm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Zerlegt einen Satz in genau die gegebenen Bausteine (jeder einmal, beliebige Reihenfolge, ohne Satzzeichen und
 * Groß-/Kleinschreibung). `null`, wenn das nicht aufgeht. Rückgabe: die Baustein-Texte in Satzreihenfolge.
 */
export function segment(sentence: string, chunks: readonly string[]): string[] | null {
  const words = poolNorm(sentence).split(' ').filter(Boolean);
  const parts = chunks.map((c) => poolNorm(c).split(' ').filter(Boolean));
  const used = new Array<boolean>(chunks.length).fill(false);
  const out: string[] = [];
  const go = (i: number): boolean => {
    if (i === words.length) return used.every(Boolean);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k] as string[];
      if (used[k] || i + p.length > words.length || !p.every((w, j) => words[i + j] === w)) continue;
      used[k] = true;
      out.push(chunks[k] as string);
      if (go(i + p.length)) return true;
      out.pop();
      used[k] = false;
    }
    return false;
  };
  return go(0) ? [...out] : null;
}

function accept(raw: z.infer<typeof RawEntry>): PoolEntry | null {
  const e: PoolEntry = {
    topic: raw.topic,
    en: raw.en.trim(),
    de: raw.de.trim(),
    chunks: raw.chunks.map((c) => c.trim()),
    alt: (raw.alt ?? []).map((a) => a.trim()).filter(Boolean),
    single: raw.single?.trim() || null,
    why: { de: raw.why[0].trim(), en: raw.why[1].trim() },
    bad: raw.bad?.trim() || null,
  };
  const main = segment(e.en, e.chunks);
  if (!main) return null;
  if (!e.alt.length === !e.single) return null; // genau eines von beiden
  for (const a of e.alt) {
    const s = segment(a, e.chunks);
    if (!s || poolNorm(a) === poolNorm(e.en)) return null;
  }
  return e;
}

let cache: readonly PoolEntry[] | null = null;

/** Alle gültigen Pool-Einträge (ungültige fallen mit Warnung weg; der Pool-Test verlangt, dass keiner wegfällt). */
export function orderPool(): readonly PoolEntry[] {
  if (cache) return cache;
  let items: unknown[] = [];
  try {
    const v: unknown = JSON.parse(poolRaw);
    items = v && typeof v === 'object' && Array.isArray((v as { items?: unknown }).items) ? ((v as { items: unknown[] }).items) : [];
  } catch (err) {
    logError('drills:order-pool', err, 'content/c1/order.json');
  }
  const out: PoolEntry[] = [];
  for (const it of items) {
    const p = RawEntry.safeParse(it);
    const e = p.success ? accept(p.data) : null;
    if (e) out.push(e);
    else logWarn('drills:order-pool', { code: 'invalid_entry', message: 'Pool-Eintrag ungültig' }, typeof (it as { en?: unknown })?.en === 'string' ? (it as { en: string }).en : '?');
  }
  cache = out;
  return out;
}

/** Zahl der Pool-Sätze (konstant; Grundlage der Machbarkeit des Kanals „Satzbau“). */
export const orderPoolSize = (): number => orderPool().length;

// ------------------------------------------------------------------ von Claude erzeugte Sätze
// Dieselben Regeln wie beim festen Pool (tests/unit/orderPool.test.ts), damit ein erzeugter Satz nie schlechter ist
// als ein handgeschriebener: Bausteine gehen genau auf, jede zweite Reihenfolge ist belegt, Sprache und Schreibweise
// stimmen. Was nicht besteht, fällt still weg (fester Pool springt ein).

export const ORDER_TOPICS = ['c1-emphasis', 'c1-discourse', 'c1-hedging', 'c1-diplomacy', 'c1-precision', 'c1-nominal', 'c1-participle'] as const;

const BRITISH = /\b(colour|organis|realis|programme|centre|licence|cheque|whilst|learnt|behaviour|favour|catalogue|labour|analyse)\w*/i;
const wordsOf = (s: string): string[] => s.split(/\s+/).filter(Boolean);
/** Deutsche Zitate in „…“ / “…” aus einem englischen Text nehmen, bevor die Sprache geprüft wird. */
const withoutQuotes = (s: string): string => s.replace(/[“„][^”“]*[”“]/g, ' ');

/** Normalform aller Sätze des festen Pools (Dubletten-Prüfung). */
export const poolSentenceKeys = (): Set<string> => new Set(orderPool().flatMap((e) => [e.en, ...e.alt]).map(poolNorm));

/**
 * Prüft einen von Claude erzeugten Eintrag. `known` enthält die Normalform schon bekannter Sätze (fester Pool,
 * zuletzt gesehene, schon im Vorrat). Gibt den geprüften Eintrag zurück oder `null`.
 */
export function acceptGenerated(raw: unknown, known: ReadonlySet<string>): PoolEntry | null {
  const p = RawEntry.safeParse(raw);
  if (!p.success) return null;
  const r = p.data;
  if (!(ORDER_TOPICS as readonly string[]).includes(r.topic)) return null;
  const e = accept(r);
  if (!e) return null;
  const texts = [e.en, e.de, e.why.de, e.why.en, e.bad ?? '', ...e.alt, ...e.chunks];
  if (texts.some((t) => t.includes('"'))) return null;
  if (e.chunks.some((c) => wordsOf(c).length > 5 || /[.,;:!?]/.test(c))) return null;
  if (!/[.?!]$/.test(e.en) || wordsOf(e.en).length < 6 || wordsOf(e.en).length > 22) return null;
  if (wordsOf(e.de).length < 4 || wordsOf(e.de).length > 20 || !/[.?!)]$/.test(e.de)) return null;
  if ((e.topic === 'c1-hedging' || e.topic === 'c1-diplomacy') && !/\([^)]+\)/.test(e.de)) return null;
  if (e.single !== null && e.single.length < 15) return null;
  if (e.why.de.length < 20 || e.why.en.length < 20) return null;
  if (isWrongLang(e.de, 'de', 3) || isWrongLang(e.why.de, 'de', 3) || isWrongLang(withoutQuotes(e.why.en), 'en', 3)) return null;
  if (BRITISH.test([e.en, ...e.alt].join(' '))) return null;
  if ([e.en, ...e.alt].some((x) => known.has(poolNorm(x)))) return null;
  // Die Fehlfassung darf sich auch nur in der Zeichensetzung unterscheiden (z. B. Komma), aber nicht Buchstabe für Buchstabe gleich sein.
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (e.bad && [e.en, ...e.alt].some((x) => same(x, e.bad as string))) return null;
  return { ...e, ai: true };
}
