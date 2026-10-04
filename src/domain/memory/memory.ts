// „Claude merkt sich“ (Backlog B5, markt DU5): kurze Fakten über Emrah aus Gesprächen und Terminen
// („Messe in London am 14.10.“, „CFO bei Kunde X skeptisch“). Ein Dokument `app/memory`
// `{v, items: [{id, text, src, t, lang}]}` mit festen Grenzen (A6.6: ein Dokument statt eines je
// Eintrag). Reine Logik – geschrieben wird nur über writer.transform (features/companion/memory.ts).

export const MEMORY_PATH = 'app/memory';
/** Höchstens so viele Fakten je Gespräch bzw. Termin (Quelle). */
export const MEMORY_PER_SOURCE = 5;
/** Höchstens so viele Fakten insgesamt; die ältesten fallen zuerst heraus. */
export const MEMORY_MAX = 40;
/** Zeichen je Fakt (gekürzt, nie verworfen). */
export const MEMORY_FACT_MAX = 160;
const FACT_MIN = 3;
const SRC_MAX = 80;

export type MemoryFact = { id: string; text: string; src: string; t: number; lang?: 'de' | 'en' };

type Doc = Readonly<Record<string, unknown>>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function readOne(v: unknown): MemoryFact | null {
  if (!isObj(v)) return null;
  const { id, text, src, t, lang } = v;
  if (typeof id !== 'string' || !id || typeof text !== 'string' || !text.trim() || typeof t !== 'number' || !Number.isFinite(t)) return null;
  return { id, text, src: typeof src === 'string' ? src : '', t, ...(lang === 'de' || lang === 'en' ? { lang } : {}) };
}

/** Lesbare Fakten (älteste zuerst); unlesbare Einträge werden ausgelassen. */
export function readMemory(doc: Doc | null | undefined): MemoryFact[] {
  const items = doc?.items;
  if (!Array.isArray(items)) return [];
  return items.map(readOne).filter((x): x is MemoryFact => x !== null);
}

/**
 * Kap. 9, Regel 6: Ein unerwarteter Stand wird nie überschrieben. `items` fehlt oder ist eine Liste,
 * deren Einträge alle lesbar sind.
 */
export function memoryWritable(doc: Doc | null | undefined): boolean {
  if (!doc || doc.items == null) return true;
  if (!Array.isArray(doc.items)) return false;
  return readMemory(doc).length === doc.items.length;
}

/** Ein Fakt: Leerraum zusammenziehen, Anführungszeichen außen weg, auf MEMORY_FACT_MAX kürzen. */
export function cleanFact(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(/^[-•*\d.)\s]+/, '').replace(/^["„“']+|["“”']+$/g, '').trim();
  if (s.length > MEMORY_FACT_MAX) s = `${s.slice(0, MEMORY_FACT_MAX - 1).trimEnd()}…`;
  return s;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Fakten einer Quelle (z. B. `chat:1790…`, `meeting:<id>`) aufnehmen: höchstens MEMORY_PER_SOURCE,
 * ohne Dubletten (auch gegen ältere Quellen). Eine erneute Aufnahme derselben Quelle ersetzt deren
 * Fakten. Insgesamt höchstens MEMORY_MAX (die ältesten fallen heraus). `null` = nichts zu tun.
 */
export function addFacts(items: readonly MemoryFact[], facts: readonly string[], src: string, now: number, lang?: 'de' | 'en'): MemoryFact[] | null {
  const source = src.slice(0, SRC_MAX);
  const others = items.filter((f) => f.src !== source);
  const seen = new Set(others.map((f) => norm(f.text)));
  const fresh: MemoryFact[] = [];
  for (const raw of facts) {
    if (fresh.length >= MEMORY_PER_SOURCE) break;
    const text = cleanFact(raw);
    const key = norm(text);
    if (text.length < FACT_MIN || !key || seen.has(key)) continue;
    seen.add(key);
    fresh.push({ id: `m${now.toString(36)}${fresh.length}`, text, src: source, t: now, ...(lang ? { lang } : {}) });
  }
  const before = items.filter((f) => f.src === source);
  if (!fresh.length && !before.length) return null;
  if (before.length === fresh.length && before.every((f, i) => f.text === fresh[i]?.text)) return null;
  const next = [...others, ...fresh];
  return next.length > MEMORY_MAX ? next.slice(next.length - MEMORY_MAX) : next;
}

/** Einen Fakt löschen (Einstellungen). `null` = nicht vorhanden. */
export function removeFact(items: readonly MemoryFact[], id: string): MemoryFact[] | null {
  const next = items.filter((f) => f.id !== id);
  return next.length === items.length ? null : next;
}

/**
 * Gesprächsverlauf für memory-extract: „Learner: …“/„Coach: …“ je Nachricht (≤ 1.200 Zeichen), bei
 * Überlänge fallen die ältesten Nachrichten heraus. Ohne eigene Nachricht des Lerners: ''.
 */
export function transcriptOf(msgs: ReadonlyArray<{ role: 'user' | 'assistant'; content: string }>, max = 8_000): string {
  if (!msgs.some((m) => m.role === 'user' && m.content.trim())) return '';
  const lines = msgs.map((m) => {
    const flat = m.content.replace(/\s+/g, ' ').trim();
    return `${m.role === 'user' ? 'Learner' : 'Coach'}: ${flat.length > 1_200 ? `${flat.slice(0, 1_199)}…` : flat}`;
  });
  const out: string[] = [];
  let len = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i] as string;
    if (len + l.length + 1 > max) break;
    out.unshift(l);
    len += l.length + 1;
  }
  return out.join('\n');
}

/** Für die Vorlagen: die neuesten Fakten zuerst, höchstens `max`. */
export function factsForPrompt(items: readonly MemoryFact[], max = 12): string[] {
  return [...items]
    .sort((a, b) => b.t - a.t)
    .slice(0, max)
    .map((f) => f.text);
}
