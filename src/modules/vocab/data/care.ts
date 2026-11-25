import { logWarn, type Writer } from '../shared';
import { type DocStep, famStep, fixStep, linkStep, mergeStep, type Op, opOrder } from '../domain/care';
import { VMOD_CARE_PATH } from '../registry';
import { CARE_ID, careDocSchema, careOpSchema, type CareStatus } from './schemas';

// Wörter-Pflege (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md): offene Aufträge aus `vmod/care` (und seinen Teilen) einmal je App-Start
// über den EINEN Schreibpfad anwenden. Jede Karte wird mit `transform` auf dem FRISCHEN Stand gerechnet (domain/care.ts); nach jeder Portion
// steht der Status am Auftrag (`done`/`skip`/`err` mit Zeit und Grund). Nie in einer Schleife wiederholt: ein Fehler bleibt `err`, bis die
// Routine den Auftrag wieder auf `open` setzt; ein Budget-Fehler lässt ihn `open` für den nächsten Start. Gelöscht wird nichts.

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/** `halted` = Budget-Code, bei dem die Pflege anhielt; `left` = noch offene Aufträge, wenn sie vor dem Ende aufhörte. */
export type CareResult = { done: number; skip: number; err: number; halted?: string; left?: number };
type Verdict = { st: Exclude<CareStatus, 'open'>; msg: string | null };

/** Pfade der Pflege-Dokumente: `vmod/care` und die dort genannten Teile. */
export function carePaths(main: Doc | undefined): string[] {
  const r = main ? careDocSchema.safeParse(main) : null;
  return [VMOD_CARE_PATH, ...(r?.success ? (r.data.parts ?? []).map((p) => `vmod/${p}`) : [])];
}

/** Offene Aufträge eines Pflege-Dokuments: gültige als Operation, ungültige (falsche Form) als Fehler. */
export function openOps(doc: Doc | undefined): { ops: [string, Op][]; bad: string[] } {
  const r = doc ? careDocSchema.safeParse(doc) : null;
  if (!r?.success || !r.data.ops) return { ops: [], bad: [] };
  const ops: [string, Op][] = [];
  const bad: string[] = [];
  for (const [id, raw] of Object.entries(r.data.ops)) {
    if (!CARE_ID.test(id) || !isObj(raw) || raw.st !== 'open') continue;
    const p = careOpSchema.safeParse(raw);
    if (p.success) ops.push([id, p.data as Op]);
    else bad.push(id);
  }
  return { ops: ops.sort(opOrder), bad };
}

/** Frischer Stand eines Dokuments durch die Warteschlange des Schreibpfads (ohne zu schreiben). */
async function fresh(writer: Writer, path: string): Promise<Doc | undefined> {
  let doc: Doc | undefined;
  await writer.transform(path, (cur) => {
    doc = cur;
    return null;
  });
  return doc;
}

/** Einen Schritt an einer Karte ausführen: `compute` auf dem frischen Stand; `write` wird geschrieben, sonst nichts. */
async function step(writer: Writer, path: string, compute: (cur: Doc | undefined) => DocStep): Promise<DocStep> {
  let out: DocStep = { kind: 'err', msg: 'none' };
  await writer.transform(path, (cur) => {
    out = compute(cur);
    return out.kind === 'write' ? { update: out.update } : null;
  });
  return out;
}

const verdictOf = (s: DocStep): Verdict => (s.kind === 'write' || s.kind === 'same' ? { st: 'done', msg: s.kind === 'same' ? 'same' : null } : { st: s.kind, msg: s.msg });

async function applyOne(writer: Writer, id: string, op: Op, t: number): Promise<Verdict> {
  switch (op.k) {
    case 'fix':
      return verdictOf(await step(writer, op.p, (cur) => fixStep(cur, op, id, t)));
    case 'fam':
      return verdictOf(await step(writer, op.p, (cur) => famStep(cur, op, id, t)));
    case 'merge': {
      const keep = await fresh(writer, op.keep);
      return verdictOf(await step(writer, op.drop, (cur) => mergeStep(cur, keep, op, id, t)));
    }
    case 'link': {
      // Erst alle prüfen (frisch), dann schreiben: eine Gruppe mit einer veralteten Karte wird gar nicht verknüpft.
      const paths = Object.keys(op.hs);
      for (const p of paths) {
        const v = linkStep(await fresh(writer, p), p, op, id, t);
        if (v.kind === 'skip' || v.kind === 'err') return verdictOf(v);
      }
      let wrote = false;
      for (const p of paths) {
        const v = await step(writer, p, (cur) => linkStep(cur, p, op, id, t));
        if (v.kind === 'skip' || v.kind === 'err') return { st: 'err', msg: `partial:${v.msg}` };
        if (v.kind === 'write') wrote = true;
      }
      return { st: 'done', msg: wrote ? null : 'same' };
    }
  }
}

/** Aufträge je Portion: danach steht ihr Status im Auftragsdokument (Test-Link v114: 236 Aufträge, Abbruch vor dem Ende = alles von vorn). */
export const CARE_CHUNK = 16;
/** Budget-Codes (db `resource_exhausted`, KI `rate_limited`): diese Sitzung nicht weiter versuchen, Aufträge bleiben `open`. */
const BUDGET = new Set(['resource_exhausted', 'rate_limited']);

export type CareOpts = {
  /** Aufträge je Portion (Standard `CARE_CHUNK`). */
  chunk?: number;
  /** Pause zwischen zwei Portionen (Leerlauf, Eingabe-Ruhe); Standard: keine. */
  pause?: () => Promise<void>;
  /** Vor jeder weiteren Portion: `false` = aufhören (z. B. Sperre an einen anderen Tab verloren). Rest bleibt `open`. */
  keep?: () => boolean;
};

const codeOf = (err: unknown): string => (isObj(err) && typeof err.code === 'string' ? err.code : 'write');

/** Status einer Portion: EIN `transform` auf das Auftragsdokument, nur für Aufträge, die dort noch offen sind. */
async function writeStatus(writer: Writer, path: string, st: Record<string, Verdict>, nowMs: number): Promise<void> {
  if (!Object.keys(st).length) return;
  await writer.transform(path, (cur) => {
    const curOps = cur && isObj(cur.ops) ? cur.ops : null;
    if (!curOps) return null;
    const upd: Record<string, Doc> = {};
    for (const [id, v] of Object.entries(st)) if (isObj(curOps[id]) && curOps[id].st === 'open') upd[id] = { st: v.st, at: nowMs, msg: v.msg };
    return Object.keys(upd).length ? { update: { ops: upd } } : null;
  });
}

/**
 * Alle offenen Aufträge anwenden, in Portionen (`CARE_CHUNK`). `raw` = ein volles Lesen (Pfad → Dokument), daraus werden nur die
 * Pflege-Dokumente gelesen; geschrieben wird je Karte auf dem frischen Stand. Nach JEDER Portion schreibt EIN `transform` den Status dieser
 * Aufträge, nur für Aufträge, die dort noch offen sind (ein zweites Gerät, das schneller war, gewinnt; sein Ergebnis ist dasselbe). So bleibt
 * der Fortschritt beim Schließen der App erhalten; der nächste Start setzt bei den offenen fort.
 * Budget-Fehler (`resource_exhausted`, `rate_limited`): Portion endet, der betroffene Auftrag und der Rest bleiben `open`, `halted` nennt den
 * Code (der Aufrufer versucht es in dieser Sitzung nicht weiter). Andere Fehler: `err` wie bisher.
 */
export async function applyCare(writer: Writer, raw: ReadonlyMap<string, Doc>, nowMs: number, opts: CareOpts = {}): Promise<CareResult> {
  const res: CareResult = { done: 0, skip: 0, err: 0 };
  const size = Math.max(1, opts.chunk ?? CARE_CHUNK);
  let first = true;
  for (const path of carePaths(raw.get(VMOD_CARE_PATH))) {
    const { ops, bad } = openOps(raw.get(path));
    if (!ops.length && !bad.length) continue;
    const portions: [string, Op][][] = [];
    for (let i = 0; i < ops.length; i += size) portions.push(ops.slice(i, i + size));
    if (!portions.length) portions.push([]);
    for (const [n, portion] of portions.entries()) {
      if (!first) {
        if (opts.keep && !opts.keep()) return { ...res, left: leftFrom(raw, path, portions, n) };
        if (opts.pause) await opts.pause();
        if (opts.keep && !opts.keep()) return { ...res, left: leftFrom(raw, path, portions, n) };
      }
      first = false;
      const st: Record<string, Verdict> = {};
      if (n === 0) for (const id of bad) st[id] = { st: 'err', msg: 'shape' };
      let halted: string | null = null;
      for (const [id, op] of portion) {
        try {
          st[id] = await applyOne(writer, id, op, nowMs);
        } catch (err) {
          const code = codeOf(err);
          if (BUDGET.has(code)) {
            halted = code;
            break;
          }
          st[id] = { st: 'err', msg: code.slice(0, 80) };
        }
      }
      try {
        await writeStatus(writer, path, st, nowMs);
      } catch (err) {
        const code = codeOf(err);
        if (!BUDGET.has(code)) throw err;
        halted = code;
        for (const id of Object.keys(st)) delete st[id];
      }
      for (const [id, v] of Object.entries(st)) {
        res[v.st === 'done' ? 'done' : v.st === 'skip' ? 'skip' : 'err']++;
        if (v.st !== 'done') logWarn('vocab:care', { code: v.st, message: `${id}: ${v.msg ?? ''}` }, path);
      }
      if (halted) {
        logWarn('vocab:care', { code: halted, message: 'Pflege angehalten, Rest beim nächsten Start' }, path);
        return { ...res, halted, left: leftFrom(raw, path, portions, n) - portion.filter(([id]) => id in st).length };
      }
    }
  }
  return res;
}

/** Noch offene Aufträge ab Portion `n` dieses Dokuments plus alle in späteren Pflege-Dokumenten (nur zur Meldung). */
function leftFrom(raw: ReadonlyMap<string, Doc>, path: string, portions: [string, Op][][], n: number): number {
  const paths = carePaths(raw.get(VMOD_CARE_PATH));
  const later = paths.slice(paths.indexOf(path) + 1).reduce((a, p) => a + openOps(raw.get(p)).ops.length, 0);
  return portions.slice(n).reduce((a, p) => a + p.length, 0) + later;
}
