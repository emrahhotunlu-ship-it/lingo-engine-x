import { logWarn, type Writer } from '../shared';
import { type DocStep, famStep, fixStep, linkStep, mergeStep, type Op, opOrder } from '../domain/care';
import { VMOD_CARE_PATH } from '../registry';
import { CARE_ID, careDocSchema, careOpSchema, type CareStatus } from './schemas';

// Wörter-Pflege (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md): offene Aufträge aus `vmod/care` (und seinen Teilen) einmal je App-Start
// über den EINEN Schreibpfad anwenden. Jede Karte wird mit `transform` auf dem FRISCHEN Stand gerechnet (domain/care.ts); danach steht der
// Status am Auftrag (`done`/`skip`/`err` mit Zeit und Grund). Nie in einer Schleife wiederholt: ein Fehler bleibt `err`, bis die Routine
// den Auftrag wieder auf `open` setzt. Gelöscht wird nichts.

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

export type CareResult = { done: number; skip: number; err: number };
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

/**
 * Alle offenen Aufträge anwenden. `raw` = ein volles Lesen (Pfad → Dokument), daraus werden nur die Pflege-Dokumente gelesen; geschrieben
 * wird je Karte auf dem frischen Stand. Den Status schreibt EIN `transform` je Pflege-Dokument, nur für Aufträge, die dort noch offen sind
 * (ein zweites Gerät, das schneller war, gewinnt; sein Ergebnis ist dasselbe).
 */
export async function applyCare(writer: Writer, raw: ReadonlyMap<string, Doc>, nowMs: number): Promise<CareResult> {
  const res: CareResult = { done: 0, skip: 0, err: 0 };
  for (const path of carePaths(raw.get(VMOD_CARE_PATH))) {
    const { ops, bad } = openOps(raw.get(path));
    if (!ops.length && !bad.length) continue;
    const st: Record<string, Verdict> = {};
    for (const id of bad) st[id] = { st: 'err', msg: 'shape' };
    for (const [id, op] of ops) {
      try {
        st[id] = await applyOne(writer, id, op, nowMs);
      } catch (err) {
        const code = isObj(err) && typeof err.code === 'string' ? err.code : 'write';
        st[id] = { st: 'err', msg: code.slice(0, 80) };
      }
    }
    for (const [id, v] of Object.entries(st)) {
      res[v.st === 'done' ? 'done' : v.st === 'skip' ? 'skip' : 'err']++;
      if (v.st !== 'done') logWarn('vocab:care', { code: v.st, message: `${id}: ${v.msg ?? ''}` }, path);
    }
    await writer.transform(path, (cur) => {
      const curOps = cur && isObj(cur.ops) ? cur.ops : null;
      if (!curOps) return null;
      const upd: Record<string, Doc> = {};
      for (const [id, v] of Object.entries(st)) if (isObj(curOps[id]) && curOps[id].st === 'open') upd[id] = { st: v.st, at: nowMs, msg: v.msg };
      return Object.keys(upd).length ? { update: { ops: upd } } : null;
    });
  }
  return res;
}
