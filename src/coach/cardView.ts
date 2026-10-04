import { bank, type BankMeaning } from '../bank/words';
import { normalize } from '../domain/answer/normalize';
import { lemmaCandidates } from '../domain/text/lemma';
import type { CardRec } from './types';

// Was eine Karte anzeigt: aus der Bank (Bedeutung, Lautschrift, echte Beispielsätze) oder aus der
// übernommenen alten Karte (Wort, Bedeutung, Ursprungssatz).

export type CardView = {
  id: string;
  word: string;
  de: string;
  en: string;
  pos: string;
  ipa?: string;
  /** Beispielsätze [Englisch, Deutsch]; Deutsch kann leer sein. */
  ex: [string, string][];
  more: BankMeaning[];
  syn: string[];
  fam: string[];
  business: boolean;
};

export function viewOf(id: string, rec?: CardRec): CardView | null {
  const b = bank().byId.get(id);
  if (b) {
    const v: CardView = {
      id,
      word: b.w,
      de: b.de,
      en: b.en,
      pos: b.p,
      ex: b.ex ?? [],
      more: b.m ?? [],
      syn: b.syn ?? [],
      fam: b.fam ?? [],
      business: b.l.includes('business') || b.l.includes('toeic'),
    };
    if (b.ipa) v.ipa = b.ipa;
    // Ein eigener Ursprungssatz (alte Karte) steht vor den Bank-Sätzen.
    if (rec?.ex) v.ex = [[rec.ex, ''] as [string, string], ...v.ex].slice(0, 3);
    return v;
  }
  if (!rec?.w) return null;
  return { id, word: rec.w, de: rec.de ?? '', en: '', pos: '', ex: rec.ex ? [[rec.ex, '']] : [], more: [], syn: [], fam: [], business: false };
}

export type GapSentence = { before: string; answer: string; after: string; de: string };

/** Beispielsatz mit Lücke an der Stelle des Worts (auch gebeugt: negotiated, companies). */
export function gapIn(view: CardView, pick = 0): GapSentence | null {
  if (view.word.includes(' ')) return null;
  const lemma = normalize(view.word);
  const n = view.ex.length;
  for (let k = 0; k < n; k++) {
    const [en, de] = view.ex[(pick + k) % n]!;
    const re = /[A-Za-z][A-Za-z'-]*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(en))) {
      const tok = m[0];
      const low = tok.toLowerCase();
      if (low === lemma || lemmaCandidates(low).includes(lemma)) {
        return { before: en.slice(0, m.index), answer: tok, after: en.slice(m.index + tok.length), de };
      }
    }
  }
  return null;
}

/** Drei falsche, aber plausible Bedeutungen (gleiche Wortart, ähnliche Häufigkeit), fest je Karte. */
export function distractors(view: CardView, n = 3): string[] {
  const all = bank().words;
  const own = new Set(view.de.split(', '));
  const target = bank().byId.get(view.id)?.r ?? 3000;
  const pool = all.filter((w) => w.i !== view.id && (!view.pos || w.p === view.pos) && Math.abs(w.r - target) < 2500 && !own.has(w.de.split(', ')[0] ?? ''));
  let h = 0;
  for (const ch of view.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const out: string[] = [];
  const seen = new Set<string>();
  for (let k = 0; out.length < n && k < pool.length * 2; k++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const w = pool[h % pool.length];
    const first = w?.de.split(', ')[0];
    if (first && !seen.has(first)) {
      seen.add(first);
      out.push(first);
    }
  }
  return out;
}

export type FamilyTask = { word: string; pos: string; de: string };

/** Wortfamilie: ein verwandtes Wort mit anderer Wortart aus der Bank (decide → decision). */
export function familyTask(view: CardView): FamilyTask | null {
  const b = bank().byId;
  for (const f of view.fam) {
    const w = b.get(f);
    if (w && w.p !== view.pos && ['n', 'v', 'adj', 'adv'].includes(w.p) && w.de) return { word: w.w, pos: w.p, de: w.de.split(', ')[0] ?? w.de };
  }
  return null;
}

/** Ähnliche Bedeutung: ein Synonym aus der Bank plus drei englische Ablenker gleicher Wortart. */
export function synonymTask(view: CardView): { answer: string; options: string[] } | null {
  const b = bank();
  const syn = view.syn.find((s) => b.byId.has(s));
  if (!syn) return null;
  const target = b.byId.get(view.id)?.r ?? 3000;
  const blocked = new Set([view.word, syn, ...view.syn, ...view.fam]);
  const pool = b.words.filter((w) => w.p === view.pos && !blocked.has(w.w) && Math.abs(w.r - target) < 2000);
  let h = 7;
  for (const ch of view.id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const others: string[] = [];
  for (let k = 0; others.length < 3 && k < pool.length * 2; k++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const w = pool[h % pool.length]?.w;
    if (w && !others.includes(w)) others.push(w);
  }
  const options = [syn, ...others].sort();
  return { answer: syn, options };
}
