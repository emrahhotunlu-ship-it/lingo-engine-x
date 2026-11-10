import { headwordOf } from './dupes';

// Großpaket A Schritt 7 (V5, plan.md §8, Bauplan vokabeln/s7-bau.md, Emrah 01.11.2026): Woher neue Wörter kommen und wie sie gemischt werden.
// Rein (keine Daten, kein Schreiben). Vier Quellen mit Startgewichten 30/30/25/15; ist eine Quelle leer, geht ihr Anteil an die übrigen.
//  - col  Wortpartner eines schon eingeführten Worts (Lehrer-Charge `col`)
//  - job  Beruf und Business-Wendungen (Lehrer-Charge 2)
//  - own  eigene Funde (Wort-Popup, Lehrkraft, Lesen; alles ohne `v5:`-Herkunft)
//  - band Häufigkeitsliste (Wort-Atlas) ab der Einstufungsgrenze

export type Src = 'col' | 'job' | 'own' | 'band';
/** Feste Reihenfolge bei Gleichstand (Tiefe vor Breite, plan.md §8). */
export const SRC_ORDER: readonly Src[] = ['col', 'job', 'own', 'band'];
export type Weights = Record<Src, number>;
// Großpaket WT (Emrah 10.11.2026): die geprüfte Wortliste (Quelle `band`) trägt den Großteil der neuen Wörter.
export const SRC_WEIGHTS: Readonly<Weights> = { col: 0.15, job: 0.15, own: 0.2, band: 0.5 };
/** Herkunft (`doc.src`) der vom Modul angelegten Lexeme. */
export const V5_SRC: Readonly<Record<Exclude<Src, 'own'>, string>> = { col: 'v5:col', job: 'v5:job', band: 'v5:band' };
/** Ohne Einstufung beginnt die Häufigkeitsliste hier (Ende des Atlas-Kernbands, B2-Grenze). */
export const DEFAULT_EDGE = 4500;

/** Quelle eines Lexems aus seinem Dokumentfeld `src`; alles, was nicht vom Modul angelegt wurde, ist ein eigener Fund. */
export function srcOf(src: unknown): Src {
  if (src === V5_SRC.col) return 'col';
  if (src === V5_SRC.job) return 'job';
  if (src === V5_SRC.band) return 'band';
  return 'own';
}

/** Gewichte aus `vcfg.w` (wenn gesetzt und nicht alle 0), sonst die Startgewichte. */
export function weightsOf(w: Partial<Weights> | null | undefined): Weights {
  if (!w) return { ...SRC_WEIGHTS };
  const out = { col: w.col ?? 0, job: w.job ?? 0, own: w.own ?? 0, band: w.band ?? 0 };
  return SRC_ORDER.some((s) => out[s] > 0) ? out : { ...SRC_WEIGHTS };
}

/**
 * `n` Plätze auf die Quellen verteilen (größter Rest), höchstens `cap[s]` je Quelle; was eine Quelle nicht füllen kann, geht anteilig an die
 * übrigen. Deterministisch (Gleichstand nach SRC_ORDER).
 */
export function splitQuota(n: number, cap: Readonly<Record<Src, number>>, w: Readonly<Weights> = SRC_WEIGHTS): Record<Src, number> {
  const out: Record<Src, number> = { col: 0, job: 0, own: 0, band: 0 };
  let left = Math.max(0, Math.floor(n));
  for (let guard = 0; left > 0 && guard < 8; guard++) {
    const open = SRC_ORDER.filter((s) => out[s] < cap[s] && w[s] > 0);
    if (!open.length) break;
    const sum = open.reduce((a, s) => a + w[s], 0);
    const share = open.map((s) => ({ s, x: (left * w[s]) / sum }));
    const give: Record<Src, number> = { col: 0, job: 0, own: 0, band: 0 };
    for (const { s, x } of share) give[s] = Math.floor(x);
    let rest = left - share.reduce((a, { s }) => a + give[s], 0);
    for (const { s } of [...share].sort((a, b) => b.x - Math.floor(b.x) - (a.x - Math.floor(a.x)) || SRC_ORDER.indexOf(a.s) - SRC_ORDER.indexOf(b.s))) {
      if (rest <= 0) break;
      give[s]++;
      rest--;
    }
    for (const s of open) {
      const g = Math.min(give[s], cap[s] - out[s]);
      out[s] += g;
      left -= g;
    }
  }
  return out;
}

/**
 * Nächste Quelle beim Mischen (gleichmäßig gewichtet): die Quelle, die gemessen an ihrem Gewicht am weitesten zurückliegt. `open` = Quellen mit
 * noch freien Kandidaten. `null`, wenn keine offen ist.
 */
export function nextSrc(taken: Readonly<Record<Src, number>>, open: ReadonlySet<Src>, w: Readonly<Weights> = SRC_WEIGHTS): Src | null {
  const cand = SRC_ORDER.filter((s) => open.has(s) && w[s] > 0);
  if (!cand.length) return SRC_ORDER.find((s) => open.has(s)) ?? null;
  const sum = cand.reduce((a, s) => a + w[s], 0);
  const total = cand.reduce((a, s) => a + taken[s], 0) + 1;
  let best: Src = cand[0]!;
  let bestGap = -Infinity;
  for (const s of cand) {
    const gap = (total * w[s]) / sum - taken[s];
    if (gap > bestGap + 1e-9) {
      best = s;
      bestGap = gap;
    }
  }
  return best;
}

/** Wie viele Lexeme je Modul-Quelle fehlen, damit ein Tag mit `quota` neuen gemischt werden kann (`stock` = schon wartende neue je Quelle). */
export function refillNeed(quota: number, stock: Readonly<Record<Src, number>>, pool: Readonly<Record<Exclude<Src, 'own'>, number>>, w: Readonly<Weights> = SRC_WEIGHTS): Record<Exclude<Src, 'own'>, number> {
  const cap: Record<Src, number> = { own: stock.own, col: stock.col + pool.col, job: stock.job + pool.job, band: stock.band + pool.band };
  const want = splitQuota(quota, cap, w);
  return { col: Math.max(0, want.col - stock.col), job: Math.max(0, want.job - stock.job), band: Math.max(0, want.band - stock.band) };
}

// --- Kandidaten je Quelle (rein, aus den Rohdaten) ---

/** Neuer Eintrag, wie er als Lexem angelegt wird. `core` = Pfad des Kernworts (nur Wortpartner). */
export type Fresh = { src: Exclude<Src, 'own'>; word: string; de: string; ex: string; pos: string; kind: 'vocab' | 'chunk'; core: string | null; ref: string; /** Übersetzung des Beispielsatzes (geprüfte Wortliste). */ exDe?: string; /** Englische Kurz-Erklärung. */ def?: string };

/** Zielmarkierung `[…]` aus Lehrer-Sätzen entfernen. */
export const plainEx = (s: string): string => s.replace(/\[([^\]]+)\]/g, '$1').replace(/\s+/g, ' ').trim();

export type JobRaw = { id: string; en: string; k: string; de: string; ex: string; fn?: string };
/**
 * Beruf und Wendungen (Charge 2), ohne vorhandene Stichwörter, reihum je Gruppe (`fn`: Absichern, Verhandeln, E-Mail …), in jeder Gruppe in
 * Dateireihenfolge. So kommen an einem Tag nicht lauter Wendungen derselben Art (english-teacher S7c).
 */
export function jobPool(items: readonly JobRaw[], have: ReadonlySet<string>): Fresh[] {
  const groups = new Map<string, Fresh[]>();
  for (const b of items) {
    const h = headwordOf(b.en);
    if (have.has(h)) continue;
    const g = groups.get(b.fn ?? '') ?? [];
    g.push({ src: 'job', word: b.en, de: b.de, ex: plainEx(b.ex), pos: '', kind: b.k === 'ch' ? 'chunk' : 'vocab', core: null, ref: `charge2/${b.id}` });
    groups.set(b.fn ?? '', g);
  }
  const lists = [...groups.values()];
  const longest = Math.max(0, ...lists.map((l) => l.length));
  const out: Fresh[] = [];
  for (let i = 0; i < longest; i++) {
    for (const l of lists) {
      const f = l[i];
      if (f) out.push(f);
    }
  }
  return out;
}

export type ColRaw = { word: string; pos?: string; col: readonly { p: string; de: string; ex: string }[] };
/**
 * Wortpartner (Charge `col`) von Wörtern, die schon eingeführt sind (`base`: Stichwort → Pfad und Einführungstag), nie am Einführungstag des
 * Kernworts (plan §4.4). Älteste Einführung zuerst, dann Dateireihenfolge.
 */
export function colPool(items: readonly ColRaw[], base: ReadonlyMap<string, { path: string; intro: string }>, have: ReadonlySet<string>, today: string): Fresh[] {
  const rows: { intro: string; i: number; f: Fresh }[] = [];
  items.forEach((it, i) => {
    const b = base.get(headwordOf(it.word));
    if (!b || b.intro >= today) return;
    for (const c of it.col) {
      if (have.has(headwordOf(c.p))) continue;
      rows.push({ intro: b.intro, i, f: { src: 'col', word: c.p, de: c.de, ex: plainEx(c.ex), pos: '', kind: 'vocab', core: b.path, ref: `col/${it.word}` } });
    }
  });
  return rows.sort((a, b) => (a.intro < b.intro ? -1 : a.intro > b.intro ? 1 : a.i - b.i)).map((r) => r.f);
}

/** Großpaket WT: geprüfte Wortkarte (`src/content/wt/*.json`): Wort, Wortart, Bedeutung, Erklärung, Business-Satz + Übersetzung, Niveau, Rang in der Liste. */
export type WtRaw = { w: string; p: string; d: string; g: string; x: string; xd: string; lvl: 'B1' | 'B2' | 'C1' | 'C2'; r: number };
/** Geprüfte Wortliste in Listenreihenfolge, ohne Grundwortschatz (B1, kennt ein B2-Lerner), Vorhandenes und im Test Gekonntes. */
export function wtPool(items: readonly WtRaw[], have: ReadonlySet<string>, ok: ReadonlySet<string>): Fresh[] {
  return items
    .filter((e) => e.lvl !== 'B1' && e.w && e.d && e.x && !have.has(headwordOf(e.w)) && !ok.has(headwordOf(e.w)))
    .sort((a, b) => a.r - b.r)
    .map((e) => ({ src: 'band' as const, word: e.w, de: e.d, ex: e.x, pos: e.p, kind: 'vocab' as const, core: null, ref: `wt/bsl#${e.r}`, exDe: e.xd, def: e.g }));
}

export type BandRaw = { w: string; p: string; d: string; x: string; r: number; hidden?: 1; basic?: 1; exWeak?: 1 };
/** Häufigkeitsliste ab `edge` (Rang), ohne Ausgeblendetes, Grundwortschatz, schwache Sätze, Vorhandenes und im Test Gekonntes. */
export function bandPool(items: readonly BandRaw[], edge: number, have: ReadonlySet<string>, ok: ReadonlySet<string>): Fresh[] {
  return items
    .filter((e) => e.r >= edge && !e.hidden && !e.basic && !e.exWeak && e.x && e.d && !have.has(headwordOf(e.w)) && !ok.has(headwordOf(e.w)))
    .sort((a, b) => a.r - b.r)
    .map((e) => ({ src: 'band' as const, word: e.w, de: e.d, ex: e.x, pos: e.p, kind: 'vocab' as const, core: null, ref: `atlas/${e.w}#${e.r}` }));
}
