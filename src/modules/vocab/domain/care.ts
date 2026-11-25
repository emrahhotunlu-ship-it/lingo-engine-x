// Wörter-Pflege (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md), rein gerechnet: was eine Pflege-Operation an EINEM Kartendokument ändert.
// Jede Operation trägt den erwarteten alten Stand; passt er auf dem FRISCHEN Dokument nicht mehr, wird sie übersprungen (nie Neueres
// überschreiben). Ist der neue Stand schon da, ist sie erledigt (idempotent, auch nach einem Abbruch zwischen Schreiben und Status).
// Nichts wird gelöscht: alte Werte gehen in den Pflege-Verlauf der Karte (`care`), ein Doppel wird stillgelegt (`hidden`, `merged`, `lex.of`).
// Lesen der neuen Felder (`famx`, `rel`, `merged`) ohne zod: tolerant, Ungültiges fällt weg.

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export const CARD_PATH = /^(vocab|chunk)\/[^/]{1,80}$/;
/** Höchstens so viele Formen je Wortfamilie, verknüpfte Karten und Verlaufseinträge (gleich wie data/schemas.ts). */
export const FAM_LIMIT = 6;
export const REL_LIMIT = 12;
export const HIST_LIMIT = 50;

/** Wortarten, nach denen die Abfrage „Wortfamilie“ fragt (Prüfung `check.ts`, Warum-Sätze „braucht ein Nomen …“). */
export type FamPos = 'noun' | 'verb' | 'adj' | 'adv';
/** Wortart einer Form vereinheitlicht: die vier abfragbaren und die nur gezeigten (Wortseite). */
export type FamKind = FamPos | 'phrasal' | 'phrase' | 'prep' | 'conj';
export type Fam = { form: string; pos: FamKind; de?: string; ex: string };
/** Lehrer-Schreibweisen (kurz oder lang) → einheitlich. */
const FAM_POS: Readonly<Record<string, FamKind>> = {
  noun: 'noun',
  verb: 'verb',
  adj: 'adj',
  adjective: 'adj',
  adv: 'adv',
  adverb: 'adv',
  'phrasal verb': 'phrasal',
  phrase: 'phrase',
  preposition: 'prep',
  conjunction: 'conj',
};
/** Wird diese Form abgefragt? Nur Nomen, Verb, Adjektiv, Adverb (die anderen stehen nur auf der Wortseite). */
export const famAsked = (f: Fam): f is Fam & { pos: FamPos } => f.pos === 'noun' || f.pos === 'verb' || f.pos === 'adj' || f.pos === 'adv';

/** Stichwort eines Kartendokuments (`vocab/*` → `word`, `chunk/*` → `en`). */
export const cardHead = (path: string, doc: Doc | undefined): string => (doc ? str(path.startsWith('chunk/') ? doc.en : doc.word) : '');
/** Vergleich der Stichwörter: klein, Leerraum vereinheitlicht, typografische Apostrophe gleich. */
export const sameHead = (a: string, b: string): boolean => norm(a) === norm(b);
const norm = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Genau eine `[Form]` im Satz, keine weitere Klammer. */
const oneMark = (s: string): boolean => (s.match(/\[[^\]]+\]/g) ?? []).length === 1 && !/[[\]]/.test(s.replace(/\[[^\]]+\]/, ''));

/** Geprüfte Wortfamilie einer Karte (`famx`), tolerant: ungültige Einträge fallen weg. Formen gleich dem Stichwort zählen nicht (keine Aufgabe). */
export function famOf(doc: Doc | undefined, head?: string): Fam[] {
  const raw = doc?.famx;
  if (!Array.isArray(raw)) return [];
  const out: Fam[] = [];
  for (const x of raw) {
    if (!isObj(x)) continue;
    const form = str(x.form);
    const ex = str(x.ex);
    const pos = FAM_POS[str(x.pos).toLowerCase()];
    if (form.length < 2 || form.length > 40 || !pos || ex.length < 8 || ex.length > 200 || !oneMark(ex)) continue;
    if (head && sameHead(form, head.replace(/^to /i, ''))) continue;
    const de = str(x.de);
    out.push({ form, pos, ...(de ? { de: de.slice(0, 80) } : {}), ex });
    if (out.length >= FAM_LIMIT) break;
  }
  return out;
}

/** Verknüpfte Karten („Gehört zusammen mit …“), tolerant. */
export function relOf(doc: Doc | undefined, self?: string): string[] {
  const raw = doc?.rel;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((p): p is string => typeof p === 'string' && CARD_PATH.test(p) && p !== self))].slice(0, REL_LIMIT);
}

/** Stillgelegt als Doppel? Liefert den Gewinner (`merged.into`) oder `null`. */
export function mergedInto(doc: Doc | undefined): string | null {
  const m = doc?.merged;
  return isObj(m) && typeof m.into === 'string' && CARD_PATH.test(m.into) ? m.into : null;
}

// ---------------------------------------------------------------- Operationen

type Base = { t: number; st: string };
export type FixOp = Base & { k: 'fix'; p: string; set: Partial<Record<'de' | 'word' | 'en' | 'pos' | 'ex', { from: string | null; to: string }>> };
export type MergeOp = Base & { k: 'merge'; keep: string; drop: string; kw: string; dw: string; ok: string };
export type LinkOp = Base & { k: 'link'; hs: Record<string, string> };
export type FamOp = Base & { k: 'fam'; p: string; w: string; from: Fam[] | null; fam: Fam[] };
export type Op = FixOp | MergeOp | LinkOp | FamOp;

/** Ergebnis für EIN Dokument: schreiben (`update`), schon so (`same`), übersprungen bzw. Fehler mit Grund. */
export type DocStep = { kind: 'write'; update: Doc } | { kind: 'same' } | { kind: 'skip'; msg: string } | { kind: 'err'; msg: string };

/** Pflege-Verlauf der Karte um einen Eintrag ergänzen (neueste zuletzt, höchstens HIST_LIMIT; der volle Auftrag bleibt in `vmod/care`). */
function histWith(cur: Doc, e: { id: string; t: number; k: Op['k']; old: Doc }): unknown[] {
  const prev: unknown[] = Array.isArray(cur.care) ? (cur.care as unknown[]).filter((x) => !(isObj(x) && x.id === e.id)) : [];
  return [...prev, e].slice(-HIST_LIMIT);
}

/** Wertgleichheit wie JSON (Reihenfolge der Schlüssel egal). */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a).filter((k) => a[k] !== undefined);
    const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
  }
  return false;
}

const futureLex = (doc: Doc): boolean => isObj(doc.lex) && typeof doc.lex.v === 'number' && doc.lex.v > 1;

/** Korrektur (`fix`): jedes Feld nur, wenn es noch den erwarteten alten Wert hat; alle oder keins. */
export function fixStep(cur: Doc | undefined, op: FixOp, id: string, t: number): DocStep {
  if (!cur) return { kind: 'skip', msg: 'missing' };
  const chunk = op.p.startsWith('chunk/');
  const entries = Object.entries(op.set).filter((e): e is [keyof FixOp['set'], { from: string | null; to: string }] => !!e[1]);
  if (!entries.length) return { kind: 'err', msg: 'empty' };
  const update: Doc = {};
  const old: Doc = {};
  for (const [f, v] of entries) {
    if ((f === 'word' && chunk) || (f === 'en' && !chunk)) return { kind: 'err', msg: `field:${f}` };
    const now = str(cur[f]);
    const to = v.to.trim();
    if (now === to) continue;
    if (now !== (v.from ?? '').trim()) return { kind: 'skip', msg: `stale:${f}` };
    update[f] = to;
    old[f] = typeof cur[f] === 'string' ? cur[f] : null;
  }
  if (!Object.keys(update).length) return { kind: 'same' };
  return { kind: 'write', update: { ...update, care: histWith(cur, { id, t, k: 'fix', old }) } };
}

/**
 * Zusammenführen (`merge`), Schritt am Verlierer `drop`: stilllegen statt löschen. `hidden: true` (für alle Bereiche der App ausgeblendet),
 * `merged` (Gewinner, Zeit, Auftrag, ob schon vorher pausiert) und – mit Lernstand – `lex.of` (das Doppel-Zeichen der Wörter-App: nie in Plan,
 * Abfragen, Zählern). Lernstand und Antworten beider Karten bleiben unverändert stehen. `keep` = frischer Stand des Gewinners.
 */
export function mergeStep(drop: Doc | undefined, keep: Doc | undefined, op: MergeOp, id: string, t: number): DocStep {
  if (!drop || !keep) return { kind: 'skip', msg: 'missing' };
  if (!sameHead(cardHead(op.keep, keep), op.kw) || !sameHead(cardHead(op.drop, drop), op.dw)) return { kind: 'skip', msg: 'stale:head' };
  if (mergedInto(keep) || (isObj(keep.lex) && typeof keep.lex.of === 'string' && keep.lex.of)) return { kind: 'skip', msg: 'chain' };
  if (futureLex(drop)) return { kind: 'skip', msg: 'future' };
  const lex = isObj(drop.lex) ? drop.lex : null;
  const into = mergedInto(drop);
  if (into && into !== op.keep) return { kind: 'skip', msg: 'stale:merged' };
  if (lex && typeof lex.of === 'string' && lex.of && lex.of !== op.keep) return { kind: 'skip', msg: 'stale:of' };
  if (lex && lex.core === op.keep) return { kind: 'err', msg: 'core' };
  if (into === op.keep && drop.hidden === true && (!lex || lex.of === op.keep)) return { kind: 'same' };
  const wasHidden = drop.hidden === true;
  return {
    kind: 'write',
    update: {
      hidden: true,
      merged: into === op.keep && isObj(drop.merged) ? drop.merged : { into: op.keep, t, id, h: wasHidden ? 1 : 0 },
      ...(lex ? { lex: { of: op.keep } } : {}),
      care: histWith(drop, { id, t, k: 'merge', old: { hidden: typeof drop.hidden === 'boolean' ? drop.hidden : null } }),
    },
  };
}

/** Verknüpfen (`link`), Schritt an EINER Karte der Gruppe: `rel` um die anderen ergänzen (nie etwas entfernen). */
export function linkStep(cur: Doc | undefined, path: string, op: LinkOp, id: string, t: number): DocStep {
  if (!cur) return { kind: 'skip', msg: 'missing' };
  const want = op.hs[path];
  if (want === undefined || !sameHead(cardHead(path, cur), want)) return { kind: 'skip', msg: 'stale:head' };
  if (mergedInto(cur)) return { kind: 'skip', msg: 'merged' };
  const have = relOf(cur, path);
  const add = Object.keys(op.hs).filter((p) => p !== path && !have.includes(p));
  if (!add.length) return { kind: 'same' };
  const rel = [...have, ...add];
  if (rel.length > REL_LIMIT) return { kind: 'err', msg: 'rel_full' };
  return { kind: 'write', update: { rel, care: histWith(cur, { id, t, k: 'link', old: { rel: Array.isArray(cur.rel) ? cur.rel : null } }) } };
}

/** Wortfamilie (`fam`): `famx` setzen, wenn der bisherige Stand dem erwarteten entspricht; der alte Stand geht in den Verlauf. */
export function famStep(cur: Doc | undefined, op: FamOp, id: string, t: number): DocStep {
  if (!cur) return { kind: 'skip', msg: 'missing' };
  if (!sameHead(cardHead(op.p, cur), op.w)) return { kind: 'skip', msg: 'stale:head' };
  const now = cur.famx === undefined ? null : cur.famx;
  if (same(now, op.fam)) return { kind: 'same' };
  if (!same(now, op.from)) return { kind: 'skip', msg: 'stale:fam' };
  return { kind: 'write', update: { famx: op.fam, care: histWith(cur, { id, t, k: 'fam', old: { famx: now } }) } };
}

/** Anwendungsreihenfolge: nach Auftragszeit, dann Kennung. */
export const opOrder = (a: [string, Op], b: [string, Op]): number => a[1].t - b[1].t || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

// ---------------------------------------------------------------- Anzeige auf der Wortseite (rein; hier statt in WordPage, Ladebudget)

export type FamRow = { form: string; pos: FamKind; de?: string };
const OLD_FAM: readonly FamPos[] = ['noun', 'verb', 'adj', 'adv'];

/** Wortfamilie zum Zeigen: geprüfte Liste `famx`, sonst das alte Format `fam` (`{noun, verb, adj, adv}`, C1-Paket, ohne Bedeutung). */
export function famRows(doc: Doc, head: string): FamRow[] {
  const list = famOf(doc, head);
  if (list.length) return list;
  const f = doc.fam;
  if (!isObj(f)) return [];
  const own = norm(head).replace(/^to /, '');
  return OLD_FAM.flatMap((pos) => {
    const form = str(f[pos]);
    return form && norm(form) !== own ? [{ form, pos }] : [];
  });
}

export type CardRef = { p: string; head: string; de: string };
type Cols = { vocab?: ReadonlyMap<string, Doc>; chunk?: ReadonlyMap<string, Doc> };
const docAt = (cols: Cols, p: string): Doc | undefined => {
  const [col, id] = p.split('/', 2);
  return (col === 'chunk' ? cols.chunk : col === 'vocab' ? cols.vocab : undefined)?.get(id ?? '');
};
const refOf = (cols: Cols, p: string): CardRef | null => {
  const d = docAt(cols, p);
  const head = cardHead(p, d);
  return d && head ? { p, head, de: str(d.de) } : null;
};

/** Verknüpfte Karten mit Stichwort und Bedeutung (fehlende und stillgelegte fallen weg). */
export function relRows(doc: Doc, path: string, cols: Cols): CardRef[] {
  return relOf(doc, path).flatMap((p) => {
    const r = refOf(cols, p);
    return r && !mergedInto(docAt(cols, p)) ? [r] : [];
  });
}

/** Stillgelegte Doppel, die in `path` zusammengeführt wurden (Verweis vom Gewinner auf den Verlierer). */
export function mergedFrom(path: string, cols: Cols): CardRef[] {
  const out: CardRef[] = [];
  for (const kind of ['vocab', 'chunk'] as const) for (const [id, d] of cols[kind] ?? []) if (mergedInto(d) === path) out.push({ p: `${kind}/${id}`, head: cardHead(`${kind}/${id}`, d), de: str(d.de) });
  return out;
}

/** Stichwort einer Karte im Bestand (für den Verweis auf den Gewinner), sonst der Pfad. */
export const headAt = (cols: Cols, p: string): string => refOf(cols, p)?.head ?? p;
