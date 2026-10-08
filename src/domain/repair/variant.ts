import { alignWords, splitWords } from '../answer/align';
import { errorSentences, errorsOf, type ErrorEntry } from '../grammar/errors';
import { legacyNorm, legacyTaskKey } from '../grammar/key';
import { isRetired, mapEntryOf } from '../grammar/patterns';
import { errorSpans, SPAN_MAX_WORDS, SPANS_MAX, type Span } from '../grammar/span';
import { allSeedTasks } from '../grammar/tasks';
import type { GrammarTask } from '../learn/types';
import { patsOf } from '../metrics/pattern';
import { hash32 } from '../random';
import type { Fehlersatz } from './fehlersaetze';
import { readRepairs, type RepairSrc } from './repair';

// Schritt 4 „Fehler korrigieren“ (Lernplattform 2.0 §5.7): Welcher Satz erscheint und wie wird er korrigiert? Rein, schreibt nichts.
//  - Box 0: der falsche Satz selbst, der neueste aus `more`, sonst `q`.
//  - Ab Box 1 mit bekanntem Muster (`pat`): eine ungesehene `find`- oder `gap`-Aufgabe desselben, eingeführten Musters
//    (`dup` der Zuordnung bevorzugt). Gebucht wird weiter am Originaleintrag (`topic`, `errorT`). Ohne Variante der Originalsatz.
//  - Reparatur-Sätze ohne Muster zeigen immer den eigenen Satz.
//  - Am Handy (`touch`) wird die Fehlerstelle angetippt (`spans`, bis zu 3 Stellen mit je ≤ 4 Wörtern) und nur der Ersatz getippt;
//    sonst legt `tiles` die Wörter der richtigen Fassung. Nie ein Textfeld mit dem ganzen Satz.

type Doc = Readonly<Record<string, unknown>>;

/** Eine Fehlerstelle: Wortbereich des falschen Satzes und der Text, der dort stehen soll (nie leer). */
export type SpanFix = { span: Span; fix: string };

export type RepairCard = {
  /** Kennung des Originaleintrags (`Fehlersatz.id`). */
  id: string;
  store: Fehlersatz['store'];
  topic?: string;
  errorT?: number;
  /** Box des Originaleintrags vor dieser Antwort. */
  box: number;
  /** Muster (Kennung wie im Fehlereintrag), sonst `null`. */
  pat: string | null;
  src: RepairSrc;
  /** Gezeigter Satz und seine bessere Fassung (bei einer Variante die des Originals, nur für die Buchung). */
  wrong: string;
  right: string;
  why?: string;
  fix?: string[];
  /** Fehlerstellen des gezeigten Satzes für das Antippen am Handy; `null` = keine eindeutigen Stellen. */
  spans: SpanFix[] | null;
  /** Gesetzt: eine ungesehene Aufgabe desselben Musters statt des Originalsatzes. */
  variant: GrammarTask | null;
};

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const norm = (s: string): string => splitWords(s).join(' ').toLowerCase();

/**
 * Fehlerstellen mit dem Text, der dort stehen soll. Wie `errorSpans`, aber mit den Wörtern der richtigen Fassung. `null`, wenn es mehr als
 * 3 Stellen oder eine Stelle über 4 Wörter gibt oder an einer Stelle nur gestrichen wird (nichts zu tippen).
 */
export function spanFixes(wrong: string, right: string): SpanFix[] | null {
  // „Weiß ich nicht“ hinterlässt „…“ statt einer eigenen Antwort: Da gibt es keine Fehlerstelle zu finden, also Bausteine statt Antippen.
  if (splitWords(wrong).some((w) => w.replace(/[.,!?;:"“”]+$/, '') === '…')) return null;
  const spans = errorSpans(wrong, right);
  if (!spans || spans.length > SPANS_MAX) return null;
  const nWrong = splitWords(wrong).length;
  const out: Array<{ from: number; to: number; right: string[] }> = [];
  let pos = 0;
  let cur: { from: number; to: number; right: string[] } | null = null;
  const close = (): void => {
    if (!cur) return;
    let { from, to } = cur;
    if (to < from) {
      if (from < nWrong) to = from;
      else {
        from = nWrong - 1;
        to = nWrong - 1;
      }
    }
    out.push({ from, to, right: cur.right });
    cur = null;
  };
  for (const op of alignWords(wrong, right)) {
    if (op.op === 'eq') {
      close();
      pos++;
      continue;
    }
    cur ??= { from: pos, to: pos - 1, right: [] };
    if (op.op !== 'del') {
      cur.to = pos;
      pos++;
    }
    if (op.op !== 'ins' && op.expected) cur.right.push(op.expected);
  }
  close();
  if (out.length !== spans.length) return null;
  const fixes: SpanFix[] = [];
  for (const [k, s] of out.entries()) {
    const sp = spans[k]!;
    if (s.from !== sp[0] || s.to !== sp[1] || !s.right.length || s.right.length > SPAN_MAX_WORDS + 1) return null;
    fixes.push({ span: [s.from, s.to], fix: s.right.join(' ') });
  }
  return fixes;
}

/** Satz mit den ersetzten Stellen (`texts[k]` ersetzt `fixes[k].span`). Fehlende Ersatztexte lassen die alten Wörter stehen. */
export function applyFixes(wrong: string, fixes: readonly SpanFix[], texts: readonly string[]): string {
  const words = splitWords(wrong);
  const out: string[] = [];
  let i = 0;
  for (const [k, f] of fixes.entries()) {
    out.push(...words.slice(i, f.span[0]));
    const t = (texts[k] ?? '').trim();
    if (t) out.push(t);
    else out.push(...words.slice(f.span[0], f.span[1] + 1));
    i = f.span[1] + 1;
  }
  out.push(...words.slice(i));
  return out.join(' ');
}

/** Wörter der richtigen Fassung als Bausteine; die ersten `pre` Wörter, die schon stimmen, liegen vor (bis zur ersten Abweichung). */
export function repairTiles(wrong: string, right: string, seed: string): { texts: string[]; order: number[]; pre: number } {
  const r = splitWords(right);
  const w = splitWords(wrong);
  const key = (s: string): string => s.toLowerCase().replace(/[.,!?;:"“”]+$/g, '');
  let pre = 0;
  while (pre < w.length && pre < r.length - 2 && key(w[pre]!) === key(r[pre]!)) pre++;
  const rest = r.map((_, i) => i).filter((i) => i >= pre);
  const order = [...rest].sort((a, b) => hash32(`${seed}|${a}`) - hash32(`${seed}|${b}`));
  // Bleibt die Reihenfolge zufällig gleich der Lösung, wird getauscht (nie schon fertig gelegt).
  if (order.length > 1 && order.every((v, k) => v === rest[k])) order.push(order.shift()!);
  return { texts: r, order, pre };
}

type Entry = { box: number; pat: string | null; more: ErrorEntry | null; rh: number };

function entryOf(f: Fehlersatz, grammarDocs: ReadonlyMap<string, Doc>, repairDoc: Doc | null | undefined): Entry & { more: unknown } {
  if (f.store === 'grammar' && f.topic && f.errorT !== undefined) {
    const e = errorsOf(grammarDocs.get(f.topic)).find((x) => num(x.t) === f.errorT);
    if (e) return { box: num(e.box) ?? 0, pat: str(e.pat).trim() || null, more: e.more ?? null, rh: Array.isArray(e.rh) ? e.rh.length : 0 } as Entry & { more: unknown };
  }
  const r = readRepairs(repairDoc ?? undefined).find((x) => x.id === f.id);
  return { box: r?.box ?? 0, pat: null, more: null, rh: 0 };
}

/** Neuester zusätzlicher falscher Satz (`more`), sonst `null`. */
function newestMore(more: unknown): { wrong: string; right: string } | null {
  if (!Array.isArray(more)) return null;
  const list: unknown[] = more;
  for (let k = list.length - 1; k >= 0; k--) {
    const m = list[k];
    if (!m || typeof m !== 'object') continue;
    const o = m as Record<string, unknown>;
    const { wrong, right } = errorSentences(str(o.q).trim(), str(o.given), str(o.ans));
    if (wrong && right && norm(wrong) !== norm(right)) return { wrong, right };
  }
  return null;
}

const patKey = (topic: string, pat: string): string => (pat.includes(':') ? pat : `${topic}:${pat}`);
const sameTask = (t: GrammarTask, topic: string, pat: string): boolean => t.topic === topic && !!t.pat && patKey(t.topic, t.pat) === patKey(topic, pat);

/**
 * Eine ungesehene Variante desselben Musters: nur `find` (auch ohne Fehler) und `gap`, nur eingeführte Muster, nie ein stillgelegter
 * Satz. `dup` der Zuordnung des Originals zuerst, sonst nach Zufall je Eintrag und Wiederholung (deterministisch).
 */
export function variantFor(i: { topic: string; pat: string; q: string; doc: Doc | undefined; seed: string }): GrammarTask | null {
  const pats = patsOf(i.doc);
  const entry = pats[i.pat];
  // Eingeführt: das Muster hat einen Einführungstag oder Antworten; ein Thema ohne `pats` (Bestand) gilt als ganz eingeführt.
  if (Object.keys(pats).length && !(entry && (entry.i !== undefined || (entry.n ?? 0) > 0))) return null;
  const seen = new Set(Array.isArray(i.doc?.seen) ? (i.doc.seen as unknown[]).map(str) : []);
  const own = legacyTaskKey(i.q);
  const cands = allSeedTasks().filter((t) => sameTask(t, i.topic, i.pat) && (t.type === 'find' || t.type === 'gap') && t.key !== own && !seen.has(t.key) && !isRetired(t.prompt, t.topic) && legacyNorm(t.prompt) !== legacyNorm(i.q));
  if (!cands.length) return null;
  const dup = mapEntryOf(i.topic, own)?.dup;
  const dupKey = dup ? dup.slice(dup.indexOf('|') + 1) : null;
  const dupHit = dupKey ? cands.find((t) => t.key === dupKey) : undefined;
  if (dupHit) return dupHit;
  const finds = cands.filter((t) => t.type === 'find');
  const pool = finds.length ? finds : cands;
  return pool[hash32(i.seed) % pool.length] ?? null;
}

/** Die Karten von Schritt 4 (eingefroren beim Start), in der Reihenfolge der Fehlersätze. */
export function repairCards(i: { items: readonly Fehlersatz[]; grammarDocs: ReadonlyMap<string, Doc>; repairDoc?: Doc | null }): RepairCard[] {
  return i.items.map((f) => {
    const e = entryOf(f, i.grammarDocs, i.repairDoc);
    const shown = e.box === 0 ? (newestMore(e.more) ?? { wrong: f.wrong, right: f.right }) : { wrong: f.wrong, right: f.right };
    const variant = f.store === 'grammar' && f.topic && e.pat && e.box >= 1 ? variantFor({ topic: f.topic, pat: e.pat, q: shown.wrong, doc: i.grammarDocs.get(f.topic), seed: `${f.id}|${e.rh}|${e.box}` }) : null;
    return {
      id: f.id,
      store: f.store,
      ...(f.topic ? { topic: f.topic } : {}),
      ...(f.errorT !== undefined ? { errorT: f.errorT } : {}),
      box: e.box,
      pat: e.pat,
      src: f.src,
      wrong: shown.wrong,
      right: shown.right,
      ...(f.why ? { why: f.why } : {}),
      ...(f.fix ? { fix: f.fix } : {}),
      spans: spanFixes(shown.wrong, shown.right),
      variant,
    };
  });
}

/** Diagnosezeile (§5.7 Nr. 8): „Fehlersätze n, davon ohne Bereich m, mit 2–3 Stellen k“. */
export function repairDiag(cards: readonly Pick<RepairCard, 'spans' | 'variant'>[]): { n: number; noSpan: number; multi: number } {
  const own = cards.filter((c) => !c.variant);
  return { n: cards.length, noSpan: own.filter((c) => !c.spans).length, multi: own.filter((c) => (c.spans?.length ?? 0) >= 2).length };
}
