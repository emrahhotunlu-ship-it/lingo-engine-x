import { z } from 'zod';
import rawText from '../../content/c1/pack.json?raw';
import { newChunkDoc, takeChunkOp } from '../chunks/newChunk';
import { dayKey } from '../date';
import { newVocabDoc, saveCardOp } from '../srs/newCard';
import { packExtraOf } from './packFields';

// C1-Paket (Emrah 02.10.2026, Englischlehrer: „Es gibt keinen C1-Plan“): 100 von Hand geschriebene, geprüfte Einträge für
// Business-Englisch auf C1-Niveau (`src/content/c1/pack.json`), im Soll-Mix des Englischlehrers: Wortpartner 25 %, Rahmen und
// Überleitungen 20 %, Phrasal Verbs 12 %, präzise Einzelwörter 15 %, Fachbegriffe 13 %, Wortfamilien 8 %, Idiome 7 %.
// Jeden Lerntag kommen bis zu 2 Einträge als ganz normale neue Karten in den Wortschatz – immer aus der Kategorie, die am
// weitesten unter dem Soll-Mix liegt. Kein Claude-Aufruf, nichts wird gelöscht oder ersetzt; im Eingangskorb stehen sie
// hinter Emrahs eigenen Funden und vor allgemeinen Vorschlägen (`INBOX_TIERS`, Stufe „pack“).

export const PACK_CATS = ['colloc', 'frame', 'phrasal', 'word', 'tech', 'family', 'idiom'] as const;
export type PackCat = (typeof PACK_CATS)[number];

/** Soll-Anteile je Kategorie (Summe 1). */
export const PACK_MIX: Readonly<Record<PackCat, number>> = { colloc: 0.25, frame: 0.2, phrasal: 0.12, word: 0.15, tech: 0.13, family: 0.08, idiom: 0.07 };
/** So viele noch nicht benutzte Paket-Karten sollen im Korb bereitliegen. */
export const PACK_STOCK = 6;
/** Höchstens so viele Einträge kommen je Lerntag dazu. */
export const PACK_PER_DAY = 2;
/** Herkunft in `origin.ref` bzw. `src.ref` der Karten. */
export const PACK_REF = 'c1pack/';

const entrySchema = z.object({
  id: z.string().regex(/^[a-z]+-\d{2,3}$/),
  cat: z.enum(PACK_CATS),
  en: z.string().trim().min(2).max(60),
  de: z.string().trim().min(2).max(120),
  def: z.string().trim().min(5).max(200),
  ex: z.string().trim().min(20).max(220),
  register: z.enum(['formal', 'neutral', 'informal']),
  why: z.string().trim().max(220).optional(),
  pos: z.string().trim().max(20).optional(),
});
export type PackEntry = z.infer<typeof entrySchema>;

const fileSchema = z.object({ v: z.literal(1), items: z.array(z.unknown()) });
// Als Text eingebettet und einmal geparst: schneller als ein großes Objektliteral beim Start (leistung.md §4 Nr. 5).
const raw: unknown = JSON.parse(rawText);

/** Alle gültigen Einträge in Dateireihenfolge (Ungültiges fällt weg; der Test prüft, dass nichts wegfällt). */
export const PACK: readonly PackEntry[] = fileSchema.parse(raw).items.flatMap((i) => {
  const r = entrySchema.safeParse(i);
  return r.success ? [r.data] : [];
});
export const PACK_RAW_COUNT: number = fileSchema.parse(raw).items.length;

const ENTRY = new Map(PACK.map((e) => [e.id, e]));
export const packEntry = (id: string): PackEntry | undefined => ENTRY.get(id);

/** Wendungen (ganze Mehrwort-Ausdrücke) werden Wendungskarten, einzelne Wörter und Fachbegriffe Vokabelkarten. */
const CHUNK_CATS: ReadonlySet<PackCat> = new Set(['colloc', 'frame', 'phrasal', 'idiom']);
const CHUNK_KIND = { colloc: 'collocation', frame: 'frame', phrasal: 'phrase', idiom: 'phrase' } as const;

export type PackDoc = { kind: 'vocab' | 'chunk'; path: string; id: string; doc: Record<string, unknown> };

/** Dokument zum Eintrag (noch nicht geschrieben); `null`, wenn es die Regeln der Karte nicht besteht (Satz ohne die Wendung …). */
export function packDoc(e: PackEntry, today: string, nowMs: number): PackDoc | null {
  const ref = `${PACK_REF}${e.id}`;
  if (CHUNK_CATS.has(e.cat)) {
    const made = newChunkDoc({
      en: e.en,
      de: e.de,
      def: e.def,
      kind: CHUNK_KIND[e.cat as keyof typeof CHUNK_KIND],
      register: e.register,
      why: e.why ?? '',
      whyLang: 'de',
      level: 'C1',
      src: { kind: 'pack', ref, title: 'C1-Paket', utterance: '', upgraded: e.ex },
      nowMs,
    });
    if (!made) return null;
    // Neue Paket-Karten behalten auch die gleichwertigen Varianten (Lernplattform 2.0 §4.8); register/why stehen schon im Dokument.
    const alt = packExtraOf(e.id)?.alt;
    return { kind: 'chunk', path: `chunk/${made.id}`, id: made.id, doc: alt?.length ? { ...made.doc, alt: alt.slice(0, 4) } : made.doc };
  }
  const x = packExtraOf(e.id);
  const made = newVocabDoc({
    word: e.en,
    de: e.de,
    pos: e.pos ?? null,
    def: e.def,
    level: 'C1',
    ex: e.ex,
    surface: null,
    src: 'pack',
    origin: { v: 1, kind: 'pack', ref, title: 'C1-Paket', t: nowMs },
    today,
    keep: { register: e.register, ...(e.why ? { why: e.why } : {}), ...(x?.alt ? { alt: x.alt } : {}), ...(x?.fam ? { fam: x.fam } : {}) },
  });
  return made ? { kind: 'vocab', path: `vocab/${made.id}`, id: made.id, doc: made.doc } : null;
}

type Doc = Readonly<Record<string, unknown>>;

/** Schreibvorgang für `writer.transform`: nur anlegen, wenn es das Dokument noch nicht gibt (nie ersetzen). */
export function packOp(cur: Doc | undefined, made: PackDoc): { set: Record<string, unknown> } | { update: Record<string, unknown> } | null {
  // Nur anlegen: eine vorhandene Karte (auch eine eigene mit gleicher Kennung) bleibt unberührt, sie bekommt nie die Herkunft „Paket“.
  if (cur) return null;
  if (made.kind === 'chunk') return takeChunkOp(cur, made);
  return saveCardOp(cur, made);
}

export type PackState = {
  /** Einträge, die es schon gibt: Paket-Karte oder eigene Karte mit derselben Kennung. */
  have: ReadonlySet<string>;
  /** Davon Paket-Karten je Kategorie (für den Soll-Mix). */
  mine: Readonly<Record<PackCat, number>>;
  /** Noch nicht eingeführte, nicht ausgeblendete Paket-Karten im Korb. */
  unused: number;
  /** Heute schon hinzugekommene Paket-Karten (mehrere Geräte, mehrere Starts). */
  addedToday: number;
};

const originRef = (d: Doc): string => {
  const o = d.origin;
  const s = d.src;
  const a = o && typeof o === 'object' ? (o as { ref?: unknown }).ref : undefined;
  const b = s && typeof s === 'object' ? (s as { ref?: unknown }).ref : undefined;
  return typeof a === 'string' && a.startsWith(PACK_REF) ? a : typeof b === 'string' && b.startsWith(PACK_REF) ? b : '';
};

// Lerntag der Karte: Vokabeln tragen den Tagesschlüssel in `added`, Wendungen den Zeitpunkt in `created` (ms). Der Zeitpunkt
// wird mit derselben Tagesfunktion wie überall umgerechnet (Tageswechsel 04:00 Ortszeit), nicht als UTC-Datum – sonst käme
// zwischen 2 und 4 Uhr nachts bei jedem Start der Seite noch einmal derselbe Zulauf.
const dayOf = (d: Doc): string => {
  if (typeof d.added === 'string') return d.added.slice(0, 10);
  const c = d.created;
  return typeof c === 'number' && Number.isFinite(c) ? dayKey(c) : typeof c === 'string' ? c.slice(0, 10) : '';
};

/** Zustand des Pakets aus den Sammlungen `vocab` und `chunk` (kennt nur die Datenbank, nicht den Startwortschatz). */
export function packState(vocab: ReadonlyMap<string, Doc>, chunks: ReadonlyMap<string, Doc>, today: string, nowMs: number): PackState {
  const have = new Set<string>();
  const mine: Record<PackCat, number> = { colloc: 0, frame: 0, phrasal: 0, word: 0, tech: 0, family: 0, idiom: 0 };
  let unused = 0;
  let addedToday = 0;
  for (const e of PACK) {
    const made = packDoc(e, today, nowMs);
    if (!made) continue;
    const cur = (made.kind === 'chunk' ? chunks : vocab).get(made.id);
    if (!cur) continue;
    have.add(e.id);
    if (originRef(cur) !== `${PACK_REF}${e.id}`) continue;
    mine[e.cat]++;
    if (cur.state === 'new' && cur.hidden !== true) unused++;
    if (dayOf(cur) === today) addedToday++;
  }
  return { have, mine, unused, addedToday };
}

/**
 * Welche Einträge kommen heute dazu? Höchstens `PACK_PER_DAY` je Lerntag, nur solange weniger als `PACK_STOCK` ungenutzte
 * Paket-Karten im Korb liegen und `quota` (neue Wörter pro Tag laut Einstellung) größer als 0 ist. Die Kategorie mit dem
 * größten Rückstand zum Soll-Mix kommt zuerst, innerhalb einer Kategorie die Dateireihenfolge.
 */
export function nextPackEntries(st: PackState, quota: number, entries: readonly PackEntry[] = PACK): PackEntry[] {
  if (!(quota > 0)) return [];
  const need = Math.min(PACK_PER_DAY - st.addedToday, PACK_STOCK - st.unused);
  if (need <= 0) return [];
  const pool = new Map<PackCat, PackEntry[]>(PACK_CATS.map((c) => [c, entries.filter((e) => e.cat === c && !st.have.has(e.id))]));
  const count: Record<PackCat, number> = { ...st.mine };
  const out: PackEntry[] = [];
  while (out.length < need) {
    const total = PACK_CATS.reduce((s, c) => s + count[c], 0) + 1;
    // Größter Rückstand: Soll-Menge nach dieser Wahl minus bisherige Menge (Methode der größten Reste).
    const best = [...PACK_CATS]
      .filter((c) => (pool.get(c)?.length ?? 0) > 0)
      .sort((a, b) => PACK_MIX[b] * total - count[b] - (PACK_MIX[a] * total - count[a]) || PACK_CATS.indexOf(a) - PACK_CATS.indexOf(b))[0];
    if (!best) break;
    const next = pool.get(best)?.shift();
    if (!next) break;
    out.push(next);
    count[best]++;
  }
  return out;
}
