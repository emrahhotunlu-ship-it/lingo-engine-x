import { errorEdits, locateRaw, normWs, outId, repairNorm, repairsFromEdits, usesChunk } from '../shared';
import type { ApplyReply, ApplySummary, C1Mail, Edit, EditKind, Good, NewRepair, OutItem, OutKind, PointCheck, ProdInput, Used } from '../shared';
import type { WriteKind } from './count';
import type { CopyCheck } from './copy';
import { countWords, type LengthState } from './kinds';

// Ergebnis einer Prüfung in EINER Form für die Oberfläche (F3) und die Speicherformen. Rein.
// - Fehlerzahl wie bei der Wochen-Mail: die belegte Liste ist die Untergrenze, Claudes Nachzählung zieht höchstens um 2 nach oben.
// - Fehlersätze: nur bei der ERSTEN Prüfung eines Textes, höchstens 3, Grammatik/Wortpartner vor Tippfehlern (`repairsFromEdits` ordnet nach Art), Doppelte über
//   `repairNorm` raus, die Situation als `ctx` (Nachtrag learning-scientist „Sollte“).
// - Wort-Beleg `used`: nur ein Zielwort, das Claude als richtig benutzt bestätigt hat und das NICHT im Material steht (Muss 3, Prüfbefund L1).
// - „Fehlerfrei“ hängt überall an der BELEGTEN Fehlerliste (Prüfbefund L7): keine Fehlerstelle ⇔ „Keine Fehler gefunden“ ⇔ `ok: true` ⇔ Fehlerzahl 0.

export type Feedback = {
  kind: WriteKind;
  edits: Edit[];
  used: Used[];
  /** Antwort: Pflichtpunkte; Zusammenfassung: Kernpunkte. Schreiben: keine (die Wochen-Mail prüft Muster und Wendungen). */
  points: PointCheck[] | null;
  faithful: ApplySummary['faithful'] | null;
  tone: { fit: string; why: string } | null;
  good: Good | null;
  upgraded: string;
  gist: string;
  /** Claudes Nachzählung (oder `null`). */
  second: number | null;
  /** Zusammenfassung: Kernpunkte (`i`), deren Zitat genau die Stelle enthält, die „Richtig wiedergegeben“ als „steht so nicht im Artikel“ markiert (herabgestuft). */
  doubted?: number[];
};

export const fromReply = (o: ApplyReply): Feedback => ({ kind: 'reply', edits: o.edits, used: o.used, points: o.points, faithful: null, tone: o.tone, good: o.good, upgraded: o.upgraded, gist: o.summary, second: o.errorCount });
export const fromSummary = (o: ApplySummary): Feedback => {
  const { points, doubted } = doubtPoints(o.points, o.faithful);
  return { kind: 'summary', edits: o.edits, used: o.used, points, faithful: o.faithful, tone: null, good: o.good, upgraded: o.upgraded, gist: o.summary, second: o.errorCount, doubted };
};

const quoteKey = (s: string): string =>
  normWs(s)
    .toLowerCase()
    .replace(/[“”„"'‘’]/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();

/**
 * Kein Widerspruch im Ergebnis (UX-Befund 5): Belegt ein Kernpunkt sein „getroffen“ mit genau dem Satz, den „Richtig wiedergegeben“ als „steht so nicht im
 * Artikel“ zitiert (gleich, oder das eine enthält das andere), ist er kein Beleg: `yes` wird `partly`, das Zitat entfällt, der Punkt steht in `doubted`.
 */
export function doubtPoints(points: readonly PointCheck[], faithful: ApplySummary['faithful'] | null): { points: PointCheck[]; doubted: number[] } {
  const bad = faithful && !faithful.ok ? quoteKey(faithful.quote) : '';
  if (bad.length < 8) return { points: [...points], doubted: [] };
  const doubted: number[] = [];
  const out = points.map((p) => {
    const q = quoteKey(p.quote);
    if (p.covered === 'no' || !q || !(q.includes(bad) || bad.includes(q))) return p;
    doubted.push(p.i);
    return { ...p, covered: 'partly' as const, quote: '', why: '' };
  });
  return { points: out, doubted };
}
export const fromMail = (o: C1Mail): Feedback => ({ kind: 'write', edits: o.edits, used: o.used, points: null, faithful: null, tone: o.tone, good: null, upgraded: o.upgraded, gist: o.summary, second: o.errorCount });

/**
 * Fehler des Textes (wie `mailErrors`): Liste als Untergrenze, Nachzählung nur nach oben, höchstens Liste + 2. Ohne belegte Fehlerstelle immer 0 (L7): eine
 * Nachzählung ohne Beleg macht einen Text nie „fehlerhaft“, den die Oberfläche als fehlerfrei zeigt.
 */
export function errorsOf(f: Pick<Feedback, 'edits' | 'second'>): number {
  const listed = errorEdits(f.edits).length;
  const second = f.second;
  if (listed === 0 || second === null || second <= listed) return listed;
  return Math.min(listed + 2, Math.round(((listed + second) / 2) * 2) / 2);
}

// ---------------------------------------------------------------- Selbst korrigieren (bis zu 3 Stellen, erst markiert, dann aufgedeckt)

export const SELF_MAX = 3;
const KIND_RANK: Record<EditKind, number> = { grammar: 0, collocation: 1, word: 2, spelling: 3, punctuation: 4, register: 5 };

/** Die Stellen zum Selbst-Korrigieren: Fehler mit Ersetzung, Grammatik/Wortpartner vor Tippfehlern, höchstens 3, in Textreihenfolge der Liste. */
export function selfSpots(edits: readonly Edit[]): Edit[] {
  const errs = errorEdits(edits).filter((e) => e.to);
  const ranked = errs.map((e, i) => ({ e, i })).sort((a, b) => KIND_RANK[a.e.kind] - KIND_RANK[b.e.kind] || a.i - b.i);
  const keep = new Set(ranked.slice(0, SELF_MAX).map((x) => x.i));
  return errs.filter((_, i) => keep.has(i));
}

const simple = (s: string): string =>
  normWs(s)
    .toLowerCase()
    .replace(/[.,;:!?]+$/g, '')
    .trim();

/** Hat Emrah die Stelle selbst richtig verbessert? Vergleich ohne Groß-/Kleinschreibung und ohne Satzzeichen am Ende. */
export const selfFixOk = (given: string, e: Edit): boolean => !!given.trim() && simple(given) === simple(e.to);

export type SpotContext = { before: string; hit: string; after: string };

/**
 * Der ganze Satz aus dem eigenen Text um eine Fehlerstelle (Prüfbefund T8): Satzgrenzen sind . ! ? vor Leerraum und Zeilenumbrüche. Die Stelle selbst
 * steht getrennt (`hit`), damit die Oberfläche sie markiert. `null`, wenn sie im Text nicht (mehr) zu finden ist.
 */
export function spotContext(text: string, e: Edit): SpotContext | null {
  const at = locateRaw(text, [e])[0];
  if (!at) return null;
  let start = 0;
  for (let i = at.start - 1; i >= 0; i--) {
    const c = text[i] ?? '';
    if (c === '\n' || (/\s/.test(c) && /[.!?]/.test(text[i - 1] ?? ''))) {
      start = i + 1;
      break;
    }
  }
  let end = text.length;
  for (let i = at.end; i < text.length; i++) {
    const c = text[i] ?? '';
    if (c === '\n') {
      end = i;
      break;
    }
    if (/[.!?]/.test(c) && (i + 1 >= text.length || /\s/.test(text[i + 1] ?? ''))) {
      end = i + 1;
      break;
    }
  }
  return { before: text.slice(start, at.start).replace(/^\s+/, ''), hit: text.slice(at.start, at.end), after: text.slice(at.end, end).replace(/\s+$/, '') };
}

// ---------------------------------------------------------------- „Das sitzt“ (ohne Fehler nie nur ein Urteil, Muss 5)

/**
 * „Das sitzt“ (Muss 5, Prüfbefund L3/M6), nie mit Claudes Gesamturteil (`gist`) als Grund und nie mit einem beliebigen ersten Satz:
 * - `good`: Claudes gelungene Stelle mit wörtlichem Zitat und Grund,
 * - `used`: ein von Claude als richtig bestätigtes Zielwort bzw. die Regel (Zitat; der Grund ist ein fester App-Text, `item` = Wort oder `rule`),
 * - `tone`: kein Zitat, nur der Grund aus dem Ton-Urteil (nur wenn der Ton passt),
 * - sonst `null` (dann steht nur „Keine Fehler gefunden.“).
 */
export type Praise = { by: 'good'; quote: string; why: string } | { by: 'used'; quote: string; item: string } | { by: 'tone'; why: string };

export function praiseOf(f: Feedback): Praise | null {
  if (f.good) return { by: 'good', quote: f.good.quote, why: f.good.why };
  const used = f.used.find((u) => u.ok && u.quote.trim());
  if (used) return { by: 'used', quote: used.quote, item: used.pat };
  if (f.tone && f.tone.fit === 'fits' && f.tone.why.trim()) return { by: 'tone', why: f.tone.why };
  return null;
}

// ---------------------------------------------------------------- Zielwörter: benutzt und richtig?

/** `open` = steht im Text, Claude hat es aber nicht eigens beurteilt (zählt nie als richtig, Prüfbefund L1). */
export type WordUse = { word: string; state: 'ok' | 'bad' | 'none' | 'open' };

/**
 * Zielwörter: `ok`/`bad` nur aus Claudes Urteil (`used`). Ohne Urteil lokal: in einer Fehlerstelle → `bad`, sonst im Text → `open`, sonst `none`.
 * „Das Wort steht im Text“ ist nie ein Beleg für richtige Verwendung.
 */
export function wordUses(words: readonly string[], f: Pick<Feedback, 'used' | 'edits'>, text: string): WordUse[] {
  const errs = errorEdits(f.edits);
  return words.map((word) => {
    const hit = f.used.find((u) => u.pat.toLowerCase() === word.toLowerCase());
    if (hit) return { word, state: hit.ok ? 'ok' : 'bad' };
    if (!usesChunk(text, word)) return { word, state: 'none' };
    const inError = errs.some((e) => usesChunk(e.from, word));
    return { word, state: inError ? 'bad' : 'open' };
  });
}

/** Wort-Belege `used` (getippt, gedämpft): nur von Claude als richtig bestätigte Wörter, die NICHT im Material stehen (Nachtrag Muss 3, L1). */
export function evidenceWords(uses: readonly WordUse[], material: string): string[] {
  return uses.filter((u) => u.state === 'ok' && !usesChunk(material, u.word)).map((u) => u.word);
}

/** Die Belege eines Ergebnisses: angebotene Zielwörter, die Claude bestätigt hat (`used`, `ok`) und die nicht im Material stehen. */
export function confirmedWords(words: readonly string[], f: Pick<Feedback, 'used' | 'edits'>, text: string, material: string): string[] {
  const confirmed = wordUses(words, f, text).filter((u) => f.used.some((x) => x.pat.toLowerCase() === u.word.toLowerCase() && x.ok));
  return evidenceWords(confirmed, material);
}

// ---------------------------------------------------------------- Speicherformen

export type ApplyRun = {
  kind: WriteKind;
  /** Kennung des Textes (die erste Prüfung legt sie fest; Überarbeitungen behalten sie). */
  id: string;
  /** Wievielte Prüfung dieses Textes (1 bis 3). Nur die erste legt Fehlersätze an und zählt für K7. */
  check: number;
  day: string;
  now: number;
  text: string;
  pasted: boolean;
  /** Kennung des Materials (Mail `m01`, Situation `ms03`, Artikel `r-…`). */
  material: string;
  /** Situation als Satz-Kontext der Fehlersätze (Betreff, Situationsart, Titel). */
  ctx: string;
  feedback: Feedback;
  length: LengthState;
  copy: CopyCheck | null;
  /** Zusammenfassung: Artikel beim Schreiben aufgeklappt (vermerkt, Muss 2). */
  peeked: boolean;
  /** Belege: von Claude als richtig bestätigte Zielwörter, die nicht im Material stehen (L1). */
  words: string[];
  /** Angebotene Zielwörter (unabhängig davon, ob benutzt). */
  offered: string[];
  /** Pfade der Wortkarten zu `words` (für den Beleg an die Wörter-App; nur die bekannten). */
  lex?: string[];
};

const OUT_KIND: Record<WriteKind, OutKind> = { reply: 'reply', write: 'c1mail', summary: 'summary' };
export const newRunId = (kind: WriteKind, now: number): string => outId(OUT_KIND[kind], now);

const LETTER: Record<PointCheck['covered'], string> = { yes: 'y', partly: 'p', no: 'n' };

/** Eintrag für `out/<Monat>`: Text (≤ 2 KB) und Ergebnis kompakt. Eine Überarbeitung ersetzt denselben Eintrag. */
export function outItemOf(r: ApplyRun): OutItem {
  const f = r.feedback;
  const err = errorsOf(f);
  const fb: Record<string, unknown> = { gist: f.gist, err, e: f.edits.map((e) => [e.from, e.to, e.kind, e.sev]), len: r.length, n: r.check };
  if (f.points) fb.pts = f.points.map((p) => LETTER[p.covered]).join('');
  if (f.tone) fb.tone = f.tone.fit;
  if (f.faithful) fb.faith = f.faithful.ok;
  if (r.copy) fb.copy = Math.round(r.copy.ratio * 100);
  if (r.peeked) fb.peek = true;
  if (r.words.length) fb.w = r.words;
  if (r.offered.length) fb.tw = r.offered;
  // L7: fehlerfrei genau dann, wenn keine Fehlerstelle belegt ist (dann ist auch `err` 0).
  return { id: r.id, k: OUT_KIND[r.kind], d: r.day, t: r.now, theme: r.material, ok: errorEdits(f.edits).length === 0, text: r.text.trim(), fb };
}

export const REPAIR_CAP = 3;

/** Fehlersätze (`src: 'write'`): nur bei der ersten Prüfung, höchstens 3, ohne Doppelte, Situation als `ctx`. */
export function repairsOf(r: ApplyRun): NewRepair[] {
  if (r.check !== 1) return [];
  const made = repairsFromEdits(r.text, r.feedback.edits, 'write', REPAIR_CAP * 2, r.ctx || null);
  const seen = new Set<string>();
  const out: NewRepair[] = [];
  for (const x of made) {
    const k = repairNorm(x.wrong);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
    if (out.length >= REPAIR_CAP) break;
  }
  return out;
}

/** K7-Eintrag (`app/c1.prod`, Quelle `mail`) für Antwort und Schreiben, nur bei der ersten Prüfung; Zusammenfassungen zählen nicht (sie leihen Wörter vom Artikel). */
export function prodOf(r: ApplyRun): ProdInput | null {
  if (r.check !== 1 || r.kind === 'summary') return null;
  return { d: r.day, s: 'mail', w: countWords(r.text), e: errorsOf(r.feedback), pasted: r.pasted, id: r.id };
}
