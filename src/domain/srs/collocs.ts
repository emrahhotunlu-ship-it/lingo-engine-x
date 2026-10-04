import { containsPhrase } from '../chunks/newChunk';
import { isWrongLang } from '../lang/detect';
import { lemmaOf, locate } from './context';

// Typische Wortpartner (Kollokationen) für jede Karte (Englischlehrer 02.10.2026: „`col` ist bei jeder neu angelegten Karte
// leer“, dadurch gibt es die Übung „Wortpartner wählen“ nur für die 40 Startwörter). Claude liefert beim ersten Aufdecken
// bis zu zwei Wortpartner im Format der alten App `{p, de, gap, opts[], ex}`; hier werden sie streng geprüft und danach
// nur ERGÄNZEND gespeichert (nie ersetzt, nie gelöscht). `ai: 1` kennzeichnet sie: die App sagt ehrlich „von Claude, kann
// Fehler enthalten“ und lässt bei einer „falschen“ Wahl den Einspruch „Ich lag richtig“ zu (ein Ablenker kann zufällig stimmen).

export type StoredColloc = { p: string; de: string; gap: string; opts: string[]; ex: string; ai: 1 };

/** Höchstens so viele Wortpartner je Karte werden von Claude ergänzt. */
export const COL_MAX = 2;
/** Nach einem Versuch ohne brauchbares Ergebnis wird so lange (Tage) nicht erneut gefragt. */
export const COL_RETRY_DAYS = 30;

const OPT = /^[A-Za-z][A-Za-z'-]{1,19}$/;
const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const low = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'");
const words = (s: string): string[] => low(s).split(/[^a-z']+/).filter(Boolean);

/** Hat die Phrase (oder das Wort) das Kartenwort in irgendeiner Form? */
const hasWord = (text: string, word: string, lemma: string): boolean => !!locate(text, lemma) || containsPhrase(text, word);

/**
 * Prüft Wortpartner von Claude. Was die Regeln verletzt, fällt weg (kein Fehler für die anderen):
 * - Wendung `p` 2–5 Wörter, enthält das Kartenwort; `de` kurz und nicht Englisch,
 * - `ex`: genau EIN Paar eckiger Klammern, darin das Kartenwort und das Partnerwort `gap`; Satz Englisch, keine Anführungszeichen,
 * - `gap`: ein einzelnes Wort, nicht das Kartenwort selbst,
 * - `opts`: mindestens zwei verschiedene einzelne Wörter, weder Lösung noch Kartenwort noch ein Wort aus der Wendung.
 */
export function acceptCollocations(word: string, raw: unknown, max: number = COL_MAX): StoredColloc[] {
  if (!Array.isArray(raw)) return [];
  const lemma = lemmaOf(word);
  if (!lemma) return [];
  const out: StoredColloc[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    if (out.length >= max) break;
    if (!r || typeof r !== 'object' || Array.isArray(r)) continue;
    const x = r as Record<string, unknown>;
    const p = clean(x.p);
    const de = clean(x.de);
    const gap = clean(x.gap);
    const ex = clean(x.ex);
    const pw = p.split(' ').filter(Boolean).length;
    if (p.length < 3 || p.length > 40 || pw < 2 || pw > 5 || /[[\]"„“”]/.test(p)) continue;
    if (de.length < 2 || de.length > 80 || /[[\]"]/.test(de) || isWrongLang(de, 'de')) continue;
    if (!OPT.test(gap)) continue;
    const brackets = [...ex.matchAll(/\[([^[\]]+)\]/g)];
    const exWords = ex.split(' ').length;
    if (brackets.length !== 1 || ex.length < 15 || ex.length > 170 || exWords < 5 || exWords > 30 || /["„“”]/.test(ex) || isWrongLang(ex, 'en')) continue;
    const inner = (brackets[0]?.[1] ?? '').trim();
    if (!hasWord(p, word, lemma) || !hasWord(inner, word, lemma)) continue;
    // Die Lücke ist ein Partner, nicht das Kartenwort, und steht in der markierten Stelle.
    if (locate(gap, lemma) || !locate(inner, gap)) continue;
    const inPhrase = new Set([...words(p), ...words(inner)]);
    const opts: string[] = [];
    const optSeen = new Set<string>([low(gap)]);
    for (const o of Array.isArray(x.opts) ? x.opts : []) {
      const w = clean(o);
      if (!OPT.test(w) || optSeen.has(low(w)) || inPhrase.has(low(w)) || locate(w, lemma)) continue;
      optSeen.add(low(w));
      opts.push(w);
      if (opts.length >= 3) break;
    }
    if (opts.length < 2) continue;
    const key = low(p);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ p, de, gap, opts, ex, ai: 1 });
  }
  return out;
}

type Doc = Readonly<Record<string, unknown>>;

/** Hat die Karte schon Wortpartner (eigene oder ergänzte)? Auch Unerwartetes zählt als „hat“ – es wird nie überschrieben. */
export function hasCol(doc: Doc): boolean {
  return Array.isArray(doc.col) ? doc.col.length > 0 : doc.col !== undefined && doc.col !== null;
}

/** Gab es schon einen Versuch ohne brauchbares Ergebnis (`colAt`, ms), der noch nicht zu lange her ist? */
export function colTriedRecently(doc: Doc, nowMs: number): boolean {
  const t = doc.colAt;
  return typeof t === 'number' && Number.isFinite(t) && nowMs - t < COL_RETRY_DAYS * 86_400_000;
}

/**
 * Soll für diese Karte nach Wortpartnern gefragt werden? Nur Vokabeln mit eigenem Satz, die noch keine haben; nach einem
 * erfolglosen Versuch erst nach `COL_RETRY_DAYS` wieder (sonst bekäme eine Karte bei jedem Aufdecken eine neue Anfrage).
 */
export function needsCollocs(card: { kind: string; inDb: boolean; doc: Doc }, nowMs: number): boolean {
  return card.kind === 'vocab' && card.inDb && !hasCol(card.doc) && !colTriedRecently(card.doc, nowMs);
}

/**
 * Patch für `vocab/<id>`: nur ergänzen, wenn `col` fehlt oder leer ist. Ohne brauchbares Ergebnis nur die Marke `colAt`,
 * damit nicht bei jedem Aufdecken erneut gefragt wird. Vorhandenes wird nie ersetzt.
 */
export function collocPatch(cur: Doc | undefined, add: readonly StoredColloc[], nowMs: number): { col?: StoredColloc[]; colAt?: number } | null {
  if (!cur || hasCol(cur)) return null;
  if (add.length) return { col: add.slice(0, COL_MAX).map((c) => ({ p: c.p, de: c.de, gap: c.gap, opts: [...c.opts], ex: c.ex, ai: 1 as const })) };
  return colTriedRecently(cur, nowMs) ? null : { colAt: Math.floor(nowMs) };
}
