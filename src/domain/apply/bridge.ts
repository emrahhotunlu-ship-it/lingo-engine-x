import { addDays, daysBetween } from '../date';
import { hash32 } from '../random';
import { freeUsesOf, patsOf, patternState, type PatternState } from '../metrics/pattern';
import { comboBlocked } from './combo';

// Brücken-Sätze (Großpaket P „Politur“, P4 „Anwenden als Brücke“; Entscheidung E2 vom 13.11.2026). Rein und getestet.
//
// Anwenden verbindet, was Emrah gerade lernt: je Satz EIN Wort aus der Wörter-App und EIN Grammatik-Muster.
//  - Satz 1: ein Wort, das gerade gelernt wird (Stufe 3–4, heute oder gestern geübt, nicht heute eingeführt) + das Muster des heutigen Grammatik-Schritts.
//  - Satz 2: ein Wort, das sitzt (Stufe 5–6, noch keine 2 eigenen geprüften Sätze) + ein sicheres früheres Muster.
//  - 14 Tage Sperre für dasselbe Wort (über die gespeicherten Ergebnisse `out/<Monat>`, Art `bridge`; Einträge von HEUTE zählen nicht, damit die
//    Wahl über den Lerntag dieselbe bleibt, Kap. 15).
//  - Passt nichts, rückt das Nächstbeste nach (anderer Vorrat, dann die Wörter des alten Wegs); ohne Wort oder Muster entfällt der Satz.
// Die Reihenfolge ist je Lerntag fest (Streuwert aus Tag und Kennung), nichts würfelt sich neu.

type Doc = Readonly<Record<string, unknown>>;

export const BRIDGE_LOCK_DAYS = 14;
export const LEARNING_LV: readonly [number, number] = [3, 4];
export const SETTLED_LV: readonly [number, number] = [5, 6];
/** So viele eigene geprüfte Sätze braucht Stufe 7 (Wörter-App, `ladder.ts`). */
export const OWN_NEED = 2;
/** Längere Einträge passen nicht in EINEN Satz mit einem Muster. */
export const BRIDGE_WORD_MAX_PARTS = 4;

export type BridgeWord = {
  /** Kennung für Sperre und Ergebnis: der Pfad der Wortkarte, sonst `w:<wort>`. */
  key: string;
  /** Pfad des Lexems in der Wörter-App; `null` = Wort des alten Wegs (kein Rückfluss). */
  path: string | null;
  /** Stichwort, wie es auf der Karte steht. */
  head: string;
  /** Grundform zum Benutzen (*to rely on sth* → *rely on*). */
  word: string;
  /** Gelernte Bedeutung (Deutsch); leer, wenn unbekannt. */
  de: string;
  /** `w` Einzelwort · `pv` Phrasal Verb · `col` Kollokation · `ch` Wendung. */
  kind: 'w' | 'pv' | 'col' | 'ch';
  /** Stufe 1–7 der Wörter-App; 0 beim alten Weg. */
  lv: number;
  /** Kartensatz (ein eigener Satz, der fast gleich ist, zählt nicht). */
  example: string | null;
  /** Eigene geprüfte Sätze bisher (`lex.ev.o`). */
  own: number;
  /** Einführungstag (Lerntag) oder `null`. */
  intro: string | null;
  /** Letzter Lerntag, an dem das Wort geübt wurde (Verlauf `vlog`, sonst die Tagesmarke), oder `null`. */
  practiced: string | null;
};

export type BridgePat = {
  id: string;
  topic: string;
  state: PatternState;
  /** „Frei verwendet“ bisher (Lerntage) und zuletzt. */
  uses: number;
  lastUse: string | null;
};

export type BridgeFrame = { de: string; en: string; starter: string };

/** Warum dieses Wort heute dran ist (Halbsatz unter dem Ziel; Texte in i18n). */
export type WordWhy = 'today' | 'yesterday' | 'learning' | 'sits' | 'known' | 'legacy';
/** Warum dieses Muster heute dran ist. */
export type PatWhy = 'today' | 'safe' | 'firm' | 'known';

export type BridgeTarget = {
  slot: 1 | 2;
  word: BridgeWord;
  pat: string;
  topic: string;
  frame: BridgeFrame | null;
  whyWord: WordWhy;
  whyPat: PatWhy;
};

const inRange = (lv: number, r: readonly [number, number]): boolean => lv >= r[0] && lv <= r[1];
const parts = (w: string): number => w.trim().split(/\s+/).filter(Boolean).length;
const usable = (w: BridgeWord): boolean => !!w.word.trim() && parts(w.word) <= BRIDGE_WORD_MAX_PARTS;

/** Wird das Wort gerade gelernt? Stufe 3–4, heute oder gestern geübt, nicht heute eingeführt. */
export function isLearning(w: BridgeWord, today: string): boolean {
  if (!w.path || !inRange(w.lv, LEARNING_LV) || w.intro === today) return false;
  return w.practiced === today || w.practiced === addDays(today, -1);
}

/** Sitzt das Wort, braucht aber noch eigene Sätze? Stufe 5–6 und weniger als 2 eigene geprüfte Sätze. */
export const isSettled = (w: BridgeWord): boolean => !!w.path && inRange(w.lv, SETTLED_LV) && w.own < OWN_NEED;

// ---------------------------------------------------------------- Muster

/** Kennt die App das Muster (Musterdatei)? Liefert das Thema oder `null`. */
export type PatLookup = (id: string) => string | null;

const STATE_RANK: Record<PatternState, number> = { firm: 0, safe: 1, learning: 2, new: 3 };

/**
 * Sichere frühere Muster aus den Thema-Dokumenten (`grammar/<thema>.pats`): Zustand „Sicher“ oder „Fest“, dazu der Zähler „frei verwendet“.
 * Reihenfolge: zuerst seltener frei verwendete, dann die länger nicht frei verwendeten, dann fest je Lerntag gestreut.
 */
export function safePatterns(grammarDocs: Iterable<readonly [string, Doc]>, today: string, known: PatLookup): BridgePat[] {
  const out: BridgePat[] = [];
  for (const [topic, doc] of grammarDocs) {
    const uses = freeUsesOf(doc);
    for (const [id, e] of Object.entries(patsOf(doc))) {
      const state = patternState(e, today);
      if (state !== 'safe' && state !== 'firm') continue;
      if (known(id) !== topic) continue;
      out.push({ id, topic, state, uses: uses[id]?.n ?? 0, lastUse: uses[id]?.d ?? null });
    }
  }
  return out.sort((a, b) => a.uses - b.uses || (a.lastUse ?? '').localeCompare(b.lastUse ?? '') || STATE_RANK[a.state] - STATE_RANK[b.state] || hash32(`${today}|${a.id}`) - hash32(`${today}|${b.id}`));
}

/** Rückfall ohne sicheres Muster: begonnene Muster („Lernt“) mit mindestens 3 Antworten, die am besten gekonnten zuerst. */
export function knownPatterns(grammarDocs: Iterable<readonly [string, Doc]>, today: string, known: PatLookup): { id: string; topic: string }[] {
  const out: { id: string; topic: string; ratio: number }[] = [];
  for (const [topic, doc] of grammarDocs) {
    for (const [id, e] of Object.entries(patsOf(doc))) {
      const n = e.n ?? 0;
      if (n < 3 || patternState(e, today) !== 'learning' || known(id) !== topic) continue;
      out.push({ id, topic, ratio: (e.c ?? 0) / n });
    }
  }
  return out.sort((a, b) => b.ratio - a.ratio || hash32(`${today}|${a.id}`) - hash32(`${today}|${b.id}`)).map(({ id, topic }) => ({ id, topic }));
}

// ---------------------------------------------------------------- Verlauf (14-Tage-Sperre)

export type BridgeHistory = {
  /** Wort-Kennung → letzter Lerntag VOR heute, an dem ein Brücken-Satz damit geprüft wurde. */
  last: Map<string, string>;
  /** Wort-Kennungen und Muster der heute schon geprüften Sätze (für freie Zusatzrunden). */
  today: Set<string>;
  todayPats: Set<string>;
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Monatsdokumente, die die Sperrfrist abdecken (heute und der Monat vor 14 Tagen), als Lerntage für `outPath`. */
export const bridgeHistoryDays = (day: string): string[] => [day, addDays(day, -BRIDGE_LOCK_DAYS)];

/** Verlauf der Brücken-Sätze aus den Monatsdokumenten `out/<Monat>` (Art `bridge`, `theme` = Wort-Kennung). Unlesbares wird übersprungen. */
export function bridgeHistory(outDocs: ReadonlyArray<Doc | null | undefined>, day: string): BridgeHistory {
  const h: BridgeHistory = { last: new Map(), today: new Set(), todayPats: new Set() };
  for (const doc of outDocs) {
    const items = doc && Array.isArray(doc.items) ? (doc.items as unknown[]) : [];
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Doc;
      if (o.k !== 'bridge' || typeof o.theme !== 'string' || !o.theme || typeof o.d !== 'string' || !DAY_RE.test(o.d)) continue;
      if (o.d === day) {
        h.today.add(o.theme);
        const fb = o.fb && typeof o.fb === 'object' ? (o.fb as Doc) : null;
        if (fb && typeof fb.pat === 'string') h.todayPats.add(fb.pat);
      } else if (o.d < day) {
        const cur = h.last.get(o.theme);
        if (!cur || o.d > cur) h.last.set(o.theme, o.d);
      }
    }
  }
  return h;
}

// ---------------------------------------------------------------- Auswahl

export type PickInput = {
  /** Wörter der Wörter-App (alle eingeführten, nicht pausierten). */
  words: readonly BridgeWord[];
  /** Wörter des alten Wegs (Rückfall, wenn die Wörter-App nichts Passendes hat), in ihrer Reihenfolge. */
  legacy?: readonly BridgeWord[];
  /** Muster des heutigen Grammatik-Schritts (`null` = unbekannt). */
  todayPat: { id: string; topic: string } | null;
  /** Sichere frühere Muster, beste zuerst (`safePatterns`). */
  safe: readonly BridgePat[];
  /** Rückfall ohne sicheres Muster: begonnene Muster, beste zuerst. */
  known?: readonly { id: string; topic: string }[];
  /** Rahmen je Muster (Situation und Satzanfang). */
  frames: ReadonlyMap<string, readonly BridgeFrame[]>;
  last: ReadonlyMap<string, string>;
  today: string;
  /** Sätze (1 am kurzen Tag, sonst 2). */
  n: number;
  /** Freie Zusatzrunde: heute schon benutzte Wörter und Muster auslassen. */
  skip?: ReadonlySet<string>;
  skipPats?: ReadonlySet<string>;
};

type Cand = { w: BridgeWord; why: WordWhy };

/** Das erste Wort der Reihenfolge, das nicht gesperrt ist; sind alle gesperrt, das am längsten nicht benutzte. */
function freshest(cands: readonly Cand[], last: ReadonlyMap<string, string>, today: string, ok: (w: BridgeWord) => boolean): Cand | null {
  let oldest: { c: Cand; d: string } | null = null;
  for (const c of cands) {
    if (!ok(c.w)) continue;
    const d = last.get(c.w.key);
    if (!d || daysBetween(d, today) >= BRIDGE_LOCK_DAYS) return c;
    if (!oldest || d < oldest.d) oldest = { c, d };
  }
  return oldest?.c ?? null;
}

const seedOrder = (today: string) => (a: BridgeWord, b: BridgeWord): number => hash32(`${today}|${a.key}`) - hash32(`${today}|${b.key}`);

/** Vorrat für Satz 1: gerade gelernt (heute geübt vor gestern, schwächere Stufe zuerst), danach andere Wörter auf Stufe 3–4. */
function learningPool(words: readonly BridgeWord[], today: string): Cand[] {
  const by = seedOrder(today);
  const strict = words.filter((w) => usable(w) && isLearning(w, today)).sort((a, b) => Number(b.practiced === today) - Number(a.practiced === today) || a.lv - b.lv || by(a, b));
  const loose = words.filter((w) => usable(w) && !!w.path && inRange(w.lv, LEARNING_LV) && w.intro !== today && !isLearning(w, today)).sort(by);
  return [...strict.map((w): Cand => ({ w, why: w.practiced === today ? 'today' : 'yesterday' })), ...loose.map((w): Cand => ({ w, why: 'learning' }))];
}

/** Vorrat für Satz 2: sitzt und braucht eigene Sätze (näher an Stufe 7 zuerst), danach andere Wörter ab Stufe 5. */
function settledPool(words: readonly BridgeWord[], today: string): Cand[] {
  const by = seedOrder(today);
  const strict = words.filter((w) => usable(w) && isSettled(w)).sort((a, b) => b.lv - a.lv || b.own - a.own || by(a, b));
  const loose = words.filter((w) => usable(w) && !!w.path && w.lv >= SETTLED_LV[0] && !isSettled(w)).sort(by);
  return [...strict.map((w): Cand => ({ w, why: 'sits' })), ...loose.map((w): Cand => ({ w, why: 'known' }))];
}

const frameFor = (frames: PickInput['frames'], pat: string, wordKey: string, today: string): BridgeFrame | null => {
  const list = frames.get(pat) ?? [];
  const f = list.length ? list[hash32(`${today}|${wordKey}|${pat}`) % list.length] : undefined;
  return f ? { de: f.de, en: f.en, starter: f.starter } : null;
};

/** Die Brücken-Sätze eines Lerntags (höchstens `n`, höchstens 2). */
export function pickBridge(i: PickInput): BridgeTarget[] {
  const skip = i.skip ?? new Set<string>();
  const skipPats = i.skipPats ?? new Set<string>();
  const legacy = (i.legacy ?? []).filter(usable).map((w): Cand => ({ w, why: 'legacy' }));
  const learning = learningPool(i.words, i.today);
  const settled = settledPool(i.words, i.today);
  const taken = new Set<string>();
  const out: BridgeTarget[] = [];
  const free = (topic: string) => (w: BridgeWord): boolean => !taken.has(w.key) && !skip.has(w.key) && !comboBlocked(w.word, topic);
  const wordFor = (pools: readonly Cand[][], topic: string): Cand | null => {
    for (const pool of pools) {
      const c = freshest(pool, i.last, i.today, free(topic));
      if (c) return c;
    }
    return null;
  };
  const push = (slot: 1 | 2, c: Cand, pat: { id: string; topic: string }, whyPat: PatWhy): void => {
    taken.add(c.w.key);
    out.push({ slot, word: c.w, pat: pat.id, topic: pat.topic, frame: frameFor(i.frames, pat.id, c.w.key, i.today), whyWord: c.why, whyPat });
  };

  // Satz 1: Muster des heutigen Grammatik-Schritts (sonst das beste sichere, sonst ein begonnenes) + ein Wort, das gerade gelernt wird.
  // Freie Zusatzrunde: heute schon benutzte Muster nur, wenn es sonst keines gibt (lieber dasselbe Muster mit anderen Wörtern als gar kein Satz).
  const allSafe = i.safe;
  const allKnown = i.known ?? [];
  const freshSafe = allSafe.filter((p) => !skipPats.has(p.id));
  const freshKnown = allKnown.filter((p) => !skipPats.has(p.id));
  const todayFresh = !!i.todayPat && !skipPats.has(i.todayPat.id);
  const anyFresh = todayFresh || freshSafe.length > 0 || freshKnown.length > 0;
  const safe = anyFresh ? freshSafe : allSafe;
  const known = anyFresh ? freshKnown : allKnown;
  const first: { p: { id: string; topic: string }; why: PatWhy } | null =
    i.todayPat && (todayFresh || !anyFresh) ? { p: i.todayPat, why: 'today' } : safe[0] ? { p: safe[0], why: safe[0].state === 'firm' ? 'firm' : 'safe' } : known[0] ? { p: known[0], why: 'known' } : null;
  if (first && i.n >= 1) {
    const c = wordFor([learning, settled, legacy], first.p.topic);
    if (c) push(1, c, first.p, first.why);
  }

  // Satz 2: ein sicheres früheres Muster (nicht das von Satz 1, lieber ein anderes Thema und eines mit Rahmen) + ein Wort, das sitzt.
  if (i.n >= 2) {
    const used = out[0]?.pat ?? null;
    const usedTopic = out[0]?.topic ?? null;
    const rank = (p: { id: string; topic: string }): number => (p.topic === usedTopic ? 2 : 0) + (i.frames.has(p.id) ? 0 : 1);
    const pool: { p: { id: string; topic: string }; why: PatWhy }[] = [
      ...safe.filter((p) => p.id !== used).map((p): { p: { id: string; topic: string }; why: PatWhy } => ({ p, why: p.state === 'firm' ? 'firm' : 'safe' })),
      ...known.filter((p) => p.id !== used).map((p): { p: { id: string; topic: string }; why: PatWhy } => ({ p, why: 'known' })),
    ];
    // Stabile Sortierung: innerhalb gleicher Güte bleibt die Reihenfolge von `safePatterns` (selten frei verwendet zuerst).
    // Ohne sicheres oder begonnenes anderes Muster bleibt es bei zwei Sätzen: das Muster von Satz 1 noch einmal, mit einem anderen Wort.
    const second = pool.map((x, k) => ({ x, k })).sort((a, b) => Number(a.x.why === 'known') - Number(b.x.why === 'known') || rank(a.x.p) - rank(b.x.p) || a.k - b.k)[0]?.x ?? (out[0] && first ? first : null);
    if (second) {
      const c = wordFor([settled, learning, legacy], second.p.topic);
      if (c) push(out.length ? 2 : 1, c, second.p, second.why);
    }
  }
  return out;
}
