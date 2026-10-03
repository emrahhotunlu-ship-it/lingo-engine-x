import bankRaw from '../content/bank/words.json?raw';
import { logError } from '../platform/diagnostics';

// Eingebaute Lernstoff-Bank (docs/neustart.md §8): Wörter mit Häufigkeitsrang, deutscher Bedeutung,
// englischer Definition, US-Lautschrift und echten Beispielsätzen. Erzeugt von scripts/bank/*.py,
// gelesen erst beim ersten Zugriff (schneller Start). Üben damit kostet keine KI-Anfrage.

export type BankMeaning = { p: string; de: string; en: string };

export type BankWord = {
  /** Kennung wie in der alten App: Kleinbuchstaben, „to " weg, sonst Bindestriche. */
  i: string;
  w: string;
  /** Wortart kurz: n, v, adj, adv, pv (Phrasal Verb) … */
  p: string;
  /** Häufigkeitsrang (1 = häufigstes Wort). */
  r: number;
  /** Listen: core, business, toeic, academic, general. */
  l: string[];
  de: string;
  en: string;
  ipa?: string;
  /** Beispielsätze [Englisch, Deutsch]; Deutsch kann fehlen (""). */
  ex?: [string, string][];
  /** Weitere Bedeutungen. */
  m?: BankMeaning[];
  syn?: string[];
  fam?: string[];
};

type BankFile = { v: number; src: string; words: BankWord[]; phrasal: (BankWord & { z: number })[]; pseudo: string[] };

export type Bank = {
  words: readonly BankWord[];
  phrasal: readonly BankWord[];
  pseudo: readonly string[];
  byId: ReadonlyMap<string, BankWord>;
  source: string;
};

let cached: Bank | null = null;

export function bank(): Bank {
  if (cached) return cached;
  let file: BankFile;
  try {
    file = JSON.parse(bankRaw) as BankFile;
  } catch (err) {
    logError('bank:parse', err);
    file = { v: 0, src: '', words: [], phrasal: [], pseudo: [] };
  }
  const phrasal = file.phrasal.map((p) => ({ ...p, r: rankFromZipf(p.z), l: ['phrasal'] }));
  const byId = new Map<string, BankWord>();
  for (const w of [...file.words, ...phrasal]) if (!byId.has(w.i)) byId.set(w.i, w);
  cached = { words: file.words, phrasal, pseudo: file.pseudo, byId, source: file.src };
  return cached;
}

/** Ungefährer Rang aus der Zipf-Häufigkeit (Phrasal Verbs haben keinen Listenrang). */
function rankFromZipf(z: number): number {
  // Zipf 5 ≈ Rang 300, Zipf 4 ≈ Rang 3.000, Zipf 3 ≈ Rang 15.000 (grobe Faustregel).
  return Math.round(10 ** (7.5 - z) / 10);
}

/** Kennung wie in der alten App und der Bank. */
export function wordId(word: string): string {
  return word
    .toLowerCase()
    .replace(/^to /, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Häufigkeitsband 1–10 (je 1.000 Ränge), darüber 10. */
export const bandOf = (rank: number): number => Math.min(10, Math.max(1, Math.ceil(rank / 1000)));

/** Wort im Wörterbuch suchen: Englisch exakt, dann Deutsch als Teilwort. Ohne KI. */
export function lookupWord(query: string, limit = 6): BankWord[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const b = bank();
  const exact = b.byId.get(wordId(q));
  const out: BankWord[] = exact ? [exact] : [];
  const seen = new Set(out.map((w) => w.i));
  const deHit = (de: string) => de.toLowerCase().split(/[,;]\s*/).some((d) => d === q || d.replace(/^(sich|der|die|das) /, '') === q);
  for (const w of [...b.words, ...b.phrasal]) {
    if (out.length >= limit) break;
    if (seen.has(w.i)) continue;
    if (deHit(w.de) || w.m?.some((m) => deHit(m.de))) {
      out.push(w);
      seen.add(w.i);
    }
  }
  if (out.length < limit && q.length >= 4) {
    for (const w of b.words) {
      if (out.length >= limit) break;
      if (!seen.has(w.i) && (w.w.startsWith(q) || w.de.toLowerCase().includes(q))) {
        out.push(w);
        seen.add(w.i);
      }
    }
  }
  return out;
}
