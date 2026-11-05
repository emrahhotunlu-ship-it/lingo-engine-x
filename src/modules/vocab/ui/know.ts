import type { VocabAi } from '../aiPort';
import { teachOf } from '../content';
import { lexOf } from '../data/lex';
import { acceptKnow, knowPatch, knowRecent, needsKnow, type KnowCard } from '../domain/know';
import { KNOW_MAX_CARDS, wordKnow, type KnowReqCard } from '../prompts/know';
import { logError, logWarn, type Writer } from '../shared';

// Großpaket W2 „Wörter-Wissen“ (docs/umbau/wissen/plan.md, Emrah 05.11.2026): Wortpartner und Beispielsätze im Hintergrund ergänzen.
// Ablauf: Kandidaten in fester Reihenfolge (zuerst die Wörter des heutigen Plans, dann die nächsten neuen, dann der übrige Bestand), je Anfrage bis zu
// 5 Wörter, höchstens `calls` Anfragen nacheinander (nie parallel, nie in einer Schleife über Fehler: der erste Fehler beendet den Lauf).
// Nur mit Claude im Hintergrund-Budget (`word-know@1`: 10 je Tag, KI-Tor). Jede Ergänzung geht durch `acceptKnow`; gespeichert wird nur ergänzend
// (`knowPatch` auf dem frischen Stand: `col` nur wenn leer, Satzbank hinten an, ≤ 8), dazu die Marke `kn` (zuletzt gefragt) – auch wenn nichts
// bestand, damit dasselbe Wort frühestens nach 14 Tagen wieder gefragt wird.

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const plainEx = (s: string): string => s.replace(/\[([^\]]*)\]/g, '$1');

export const KNOW_PV = `${wordKnow.id}@${wordKnow.version}`;
/** Anfragen je Lauf (je Runde): 3 × 5 = bis zu 15 Wörter. */
export const KNOW_CALLS_PER_RUN = 3;

let inflight = false;

const isChunk = (path: string): boolean => path.startsWith('chunk/');
const headOf = (path: string, doc: Doc): string => str(isChunk(path) ? doc.en : doc.word);

/** Wörter (`vocab/*`) und Wendungen (`chunk/*`, W4: nur Sätze) mit Stichwort, nicht ausgeblendet, mit Bedarf und nicht kürzlich gefragt. */
function candidate(path: string, doc: Doc | undefined, nowMs: number): boolean {
  if (!doc || !(path.startsWith('vocab/') || isChunk(path)) || !headOf(path, doc)) return false;
  return doc.hidden !== true && needsKnow(doc, isChunk(path)) && !knowRecent(doc, nowMs);
}

/** Reihenfolge: Plan von heute (wie eingefroren), dann neue Wörter nach `order`, dann der Rest. Jeder Pfad einmal. */
export function knowOrder(docs: ReadonlyMap<string, Doc>, planPaths: readonly string[], nowMs: number): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const take = (p: string): void => {
    if (seen.has(p)) return;
    seen.add(p);
    if (candidate(p, docs.get(p), nowMs)) out.push(p);
  };
  for (const p of planPaths) take(p);
  const rest = [...docs.entries()].filter(([p]) => !seen.has(p) && (p.startsWith('vocab/') || isChunk(p)));
  const fresh = rest.filter(([p, d]) => !isChunk(p) && lexOf(d)?.intro == null).sort((a, b) => (Number(a[1].order) || 0) - (Number(b[1].order) || 0));
  for (const [p] of fresh) take(p);
  for (const [p] of rest) if (!isChunk(p)) take(p);
  for (const [p] of rest) take(p);
  return out;
}

function cardsOf(paths: readonly string[], docs: ReadonlyMap<string, Doc>): { req: KnowReqCard; card: KnowCard; path: string }[] {
  return paths.map((path, i) => {
    const doc = docs.get(path)!;
    const head = headOf(path, doc);
    const lex = lexOf(doc);
    const wrong = isChunk(path) ? [] : (teachOf(head).colloc ?? []);
    const ex = plainEx(str(doc.ex));
    const have = [
      ex,
      ...(Array.isArray(doc.sb) ? doc.sb.map((x) => (isObj(x) ? str(x.en) : '')) : []),
      ...(Array.isArray(doc.wx) ? doc.wx.map((x) => (isObj(x) ? str(x.en) : '')) : []),
    ].filter(Boolean);
    const id = `w${i + 1}`;
    return {
      path,
      req: { id, head, pos: str(doc.pos), de: str(doc.de), ex, avoid: wrong, have: have.filter((s) => s !== ex).slice(0, 3) },
      card: { id, head, pv: lex?.k === 'pv', wrong, known: have, de: str(doc.de), pos: str(doc.pos) },
    };
  });
}

/** Ein Wort ergänzend speichern (frischer Stand, nur bei Änderung, nie ein neues Dokument, nie in ein unerwartetes). */
async function save(writer: Writer, path: string, patchOf: (cur: Doc) => Doc | null): Promise<boolean> {
  let wrote = false;
  await writer.transform(path, (cur) => {
    if (!cur || (typeof cur.word !== 'string' && typeof cur.en !== 'string')) return null;
    const patch = patchOf(cur);
    if (!patch) return null;
    wrote = true;
    return { update: patch };
  });
  return wrote;
}

export type KnowRun = { ai: VocabAi; writer: Writer; docs: ReadonlyMap<string, Doc>; planPaths: readonly string[]; ctx: string; nowMs: number; calls?: number; signal?: AbortSignal };

/**
 * Hintergrundlauf. Liefert die Zahl der Wörter, bei denen etwas gespeichert wurde. Läuft schon einer, passiert nichts (`0`).
 * Ohne Claude (`ready()`), ohne Hintergrund-Tor (`ai.bg`) oder ohne Kandidaten: nichts.
 */
export async function fillKnow(r: KnowRun): Promise<number> {
  if (inflight || !r.ai.bg || !r.ai.ready()) return 0;
  inflight = true;
  let saved = 0;
  try {
    const order = knowOrder(r.docs, r.planPaths, r.nowMs);
    const calls = r.calls ?? KNOW_CALLS_PER_RUN;
    for (let c = 0; c < calls && order.length; c++) {
      const batch = order.splice(0, KNOW_MAX_CARDS);
      const cards = cardsOf(batch, r.docs);
      let out: { items: unknown[] };
      try {
        out = await r.ai.bg(wordKnow, { cards: cards.map((x) => x.req), ctx: r.ctx }, r.signal ?? new AbortController().signal);
      } catch (err) {
        // Budget erschöpft, keine Zustimmung, Drosselung: still beenden, nie wiederholen.
        logWarn('vocab:know', { message: r.ai.fail(err).kind }, `call ${c + 1}`);
        break;
      }
      const byId = new Map<string, unknown>();
      for (const it of out.items) if (isObj(it) && typeof it.id === 'string') byId.set(it.id, it);
      for (const x of cards) {
        const a0 = acceptKnow(byId.get(x.card.id) ?? null, x.card, r.nowMs, KNOW_PV);
        const a = isChunk(x.path) ? { ...a0, col: [] } : a0;
        try {
          if (await save(r.writer, x.path, (cur) => knowPatch(cur, a, r.nowMs, KNOW_PV)) && (a.col.length || a.sb.length)) saved++;
        } catch (err) {
          logError('vocab:know', err, x.path);
        }
      }
    }
  } finally {
    inflight = false;
  }
  return saved;
}

/** Ein einzelnes Wort sofort ergänzen (Wortseite „Fehlt etwas? Jetzt ergänzen“), über das Nutzer-Tor `ask`. `true` = etwas gespeichert. */
export async function fillKnowOne(r: Omit<KnowRun, 'planPaths' | 'calls'> & { path: string }): Promise<boolean> {
  const doc = r.docs.get(r.path);
  if (!doc || !headOf(r.path, doc)) return false;
  const [x] = cardsOf([r.path], r.docs);
  const out = await r.ai.ask(wordKnow, { cards: [x!.req], ctx: r.ctx }, r.signal ?? new AbortController().signal);
  const it = out.items.find((i) => isObj(i) && i.id === x!.card.id) ?? out.items[0] ?? null;
  const a0 = acceptKnow(isObj(it) ? { ...it, id: x!.card.id } : null, x!.card, r.nowMs, KNOW_PV);
  const a = isChunk(r.path) ? { ...a0, col: [] } : a0;
  const wrote = await save(r.writer, r.path, (cur) => knowPatch(cur, a, r.nowMs, KNOW_PV));
  return wrote && (a.col.length > 0 || a.sb.length > 0);
}
