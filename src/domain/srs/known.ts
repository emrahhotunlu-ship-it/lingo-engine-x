import { slug } from '../content';
import { mergedVocab } from '../overview';
import { lemmaOf } from './context';

// Bekannte Wörter und Wendungen (für „nicht vorschlagen“ und „schon im Wortschatz?“). Rein.
// Vorher kam für Claude eine nach Kennung sortierte, umgekehrte Liste heraus (die alphabetisch letzten 200), ohne
// Startwortschatz und ohne Wendungen (Prüfung Englischlehrer 02.10.2026) – Claude schlug oft Vorhandenes vor.

type Doc = Readonly<Record<string, unknown>>;
export type KnownRow = { w: string; at: number };

/** Schlüssel eines Worts für den Vergleich (wie die Kennung der Karte). */
export const wordKey = (w: string): string => slug(lemmaOf(w));

/** Alle Wörter und Wendungen mit Zeitpunkt des Hinzufügens (0 = unbekannt). Vokabeln samt Startwortschatz überlagert. */
export function knownRows(vocab: ReadonlyMap<string, Doc>, chunks: ReadonlyMap<string, Doc>, invalidVocab?: ReadonlySet<string>): KnownRow[] {
  const rows: KnownRow[] = [];
  for (const d of mergedVocab(vocab, invalidVocab).values()) {
    const w = typeof d.word === 'string' ? d.word.trim() : '';
    if (w) rows.push({ w, at: typeof d.added === 'string' ? Date.parse(d.added) || 0 : 0 });
  }
  for (const d of chunks.values()) {
    const w = typeof d.en === 'string' ? d.en.trim() : '';
    if (w) rows.push({ w, at: typeof d.created === 'number' ? d.created : 0 });
  }
  return rows;
}

/** Die zuletzt hinzugefügten zuerst, ohne Doppelte, höchstens `max`. */
export function newestWords(rows: readonly KnownRow[], max: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of [...rows].sort((a, b) => b.at - a.at)) {
    const k = r.w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r.w);
    if (out.length >= max) break;
  }
  return out;
}

/** Schlüssel aller bekannten Wörter (ohne Obergrenze). */
export const keysOf = (rows: readonly KnownRow[]): Set<string> => new Set(rows.map((r) => wordKey(r.w)).filter(Boolean));
