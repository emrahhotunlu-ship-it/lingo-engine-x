import { errorEdits, normWs, outId, repairNorm, repairsFromEdits, usesChunk } from '../shared';
import type { ApplyReply, ApplySummary, C1Mail, Edit, EditKind, Good, NewRepair, OutItem, OutKind, PointCheck, ProdInput, Used } from '../shared';
import type { WriteKind } from './count';
import type { CopyCheck } from './copy';
import { countWords, type LengthState } from './kinds';

// Ergebnis einer Prüfung in EINER Form für die Oberfläche (F3) und die Speicherformen. Rein.
// - Fehlerzahl wie bei der Wochen-Mail: die belegte Liste ist die Untergrenze, Claudes Nachzählung zieht höchstens um 2 nach oben.
// - Fehlersätze: nur bei der ERSTEN Prüfung eines Textes, höchstens 3, Grammatik/Wortpartner vor Tippfehlern (`repairsFromEdits` ordnet nach Art), Doppelte über
//   `repairNorm` raus, die Situation als `ctx` (Nachtrag learning-scientist „Sollte“).
// - Wort-Beleg `used`: nur ein richtig benutztes Zielwort, das NICHT im Material steht (Muss 3).

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
};

export const fromReply = (o: ApplyReply): Feedback => ({ kind: 'reply', edits: o.edits, used: o.used, points: o.points, faithful: null, tone: o.tone, good: o.good, upgraded: o.upgraded, gist: o.summary, second: o.errorCount });
export const fromSummary = (o: ApplySummary): Feedback => ({ kind: 'summary', edits: o.edits, used: o.used, points: o.points, faithful: o.faithful, tone: null, good: o.good, upgraded: o.upgraded, gist: o.summary, second: o.errorCount });
export const fromMail = (o: C1Mail): Feedback => ({ kind: 'write', edits: o.edits, used: o.used, points: null, faithful: null, tone: o.tone, good: null, upgraded: o.upgraded, gist: o.summary, second: o.errorCount });

/** Fehler des Textes (wie `mailErrors`): Liste als Untergrenze, Nachzählung nur nach oben, höchstens Liste + 2. */
export function errorsOf(f: Pick<Feedback, 'edits' | 'second'>): number {
  const listed = errorEdits(f.edits).length;
  const second = f.second;
  if (second === null || second <= listed) return listed;
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

// ---------------------------------------------------------------- „Das sitzt“ (ohne Fehler nie nur ein Urteil, Muss 5)

/** Zitat und Grund: die gelungene Stelle, sonst ein richtig benutztes Zielwort, sonst der erste Satz mit Claudes Gesamturteil. */
export function praiseOf(f: Feedback, text: string): Good | null {
  if (f.good) return f.good;
  const used = f.used.find((u) => u.ok);
  const first = normWs(text).match(/[^.!?]+[.!?]?/)?.[0]?.trim() ?? '';
  const quote = used?.quote ?? first;
  return quote && f.gist ? { quote, why: f.gist } : null;
}

// ---------------------------------------------------------------- Zielwörter: benutzt und richtig?

export type WordUse = { word: string; state: 'ok' | 'bad' | 'none' };

/**
 * Zielwörter: Claudes Urteil (`used`), sonst lokal (das Wort steht im Text und in keiner Fehlerstelle). `bad` = versucht, aber nicht richtig.
 */
export function wordUses(words: readonly string[], f: Pick<Feedback, 'used' | 'edits'>, text: string): WordUse[] {
  const errs = errorEdits(f.edits);
  return words.map((word) => {
    const hit = f.used.find((u) => u.pat.toLowerCase() === word.toLowerCase());
    if (hit) return { word, state: hit.ok ? 'ok' : 'bad' };
    if (!usesChunk(text, word)) return { word, state: 'none' };
    const inError = errs.some((e) => usesChunk(e.from, word));
    return { word, state: inError ? 'bad' : 'ok' };
  });
}

/** Wort-Belege `used` (getippt, gedämpft): nur richtig benutzte Wörter, die NICHT im Material stehen (Nachtrag Muss 3). */
export function evidenceWords(uses: readonly WordUse[], material: string): string[] {
  return uses.filter((u) => u.state === 'ok' && !usesChunk(material, u.word)).map((u) => u.word);
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
  words: string[];
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
  return { id: r.id, k: OUT_KIND[r.kind], d: r.day, t: r.now, theme: r.material, ok: err === 0, text: r.text.trim(), fb };
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
