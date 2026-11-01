import { z } from 'zod';
import { dayKey, loadAtlasText, loadColCharge, logError, logWarn, type Writer } from '../shared';
import { isNewLex, type Item } from '../domain/catalog';
import { headwordOf } from '../domain/dupes';
import { emptyLex } from '../domain/planner';
import { bandPool, type BandRaw, type ColRaw, colPool, DEFAULT_EDGE, type Fresh, jobPool, type JobRaw, refillNeed, type Src, V5_SRC, type Weights } from '../domain/sources';

// Großpaket A Schritt 7 (V5, vokabeln/s7-bau.md): Nachfüllen neuer Wörter aus den Quellen Wortpartner, Beruf und Häufigkeitsliste, bevor der
// Tagesplan eingefroren wird. Nur ergänzend (`createIfMissing`, nie überschreiben); jedes neue Dokument hat Ursprungssatz und Herkunft
// `v5:<quelle>`. Ein Fehler beim Laden der Quellen oder Schreiben lässt den Tag mit dem vorhandenen Bestand laufen (nur protokolliert).

type Doc = Record<string, unknown>;

/** `vmod/place` (Einstufung, S7c): Grenze (Rang) und die im Test gekonnten Stichwörter. Tolerant gelesen. */
export const placeReadSchema = z.looseObject({ v: z.literal(1), edge: z.number().int().min(0).max(100_000), ok: z.array(z.string().max(80)).max(200) });
export type Place = { edge: number; ok: string[] };
export function readPlace(doc: Doc | null): Place | null {
  const r = doc ? placeReadSchema.safeParse(doc) : null;
  return r?.success ? { edge: r.data.edge, ok: r.data.ok } : null;
}

/** Rohdaten der Quellen (Tests geben sie hinein; die App lädt sie per dynamischem Import). */
export type SourceData = { job: readonly JobRaw[]; col: readonly ColRaw[]; band: readonly BandRaw[] };

export async function loadSources(): Promise<SourceData> {
  const [{ CHARGE2 }, atlasText, colRaw] = await Promise.all([import('../content'), loadAtlasText(), loadColCharge()]);
  const atlas = JSON.parse(atlasText) as { items?: BandRaw[] };
  const col = (colRaw as { items?: ColRaw[] }).items ?? [];
  return { job: CHARGE2.reviewed ? CHARGE2.items : [], col, band: atlas.items ?? [] };
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

/** Dokument eines neuen Lexems (Form wie `addLexeme` in api.ts). */
export function freshDoc(f: Fresh, nowMs: number, order: number): { path: string; doc: Doc } | null {
  const id = slug(f.word);
  if (!id || !f.ex || !f.de) return null;
  const k = f.kind === 'chunk' ? 'ch' : f.word.trim().includes(' ') ? 'col' : 'w';
  const lex = { ...emptyLex(k, f.src === 'job' ? 'core' : 'edge', nowMs), core: f.core };
  const src = V5_SRC[f.src];
  const doc: Doc =
    f.kind === 'chunk'
      ? { id, en: f.word, de: f.de, src, ref: f.ref, created: nowMs, order, ex: f.ex, lex }
      : { id, word: f.word, de: f.de, ex: f.ex, pos: f.pos, src, ref: f.ref, added: dayKey(nowMs), order, state: 'new', col: [], lex };
  return { path: `${f.kind}/${id}`, doc };
}

/**
 * Fehlende neue Lexeme anlegen, damit der heutige Plan nach den Gewichten mischen kann. `docs` = alle Wörter und Wendungen (auch ausgeblendete,
 * damit nichts doppelt entsteht), `items` = Katalog ohne Ausgeblendete. Liefert die angelegten Dokumente (für Katalog und Bestand im Speicher).
 */
export async function refillFresh(
  writer: Writer,
  o: { docs: ReadonlyMap<string, Doc>; items: readonly Item[]; quota: number; nowMs: number; place: Place | null; w: Weights; load: () => Promise<SourceData> },
): Promise<[string, Doc][]> {
  if (o.quota <= 0) return [];
  const stock: Record<Src, number> = { col: 0, job: 0, own: 0, band: 0 };
  for (const it of o.items) if (isNewLex(it.lex)) stock[it.src ?? 'own']++;
  // Schneller Ausgang ohne Laden: genug Bestand für jede Quelle (Obergrenze = gesamtes Kontingent).
  const roughNeed = refillNeed(o.quota, stock, { col: o.quota, job: o.quota, band: o.quota }, o.w);
  if (roughNeed.col + roughNeed.job + roughNeed.band === 0) return [];
  let data: SourceData;
  try {
    data = await o.load();
  } catch (err) {
    logWarn('vocab:refill-load', err);
    return [];
  }
  const have = new Set<string>();
  for (const [path, d] of o.docs) {
    const head = path.startsWith('chunk/') ? d.en : d.word;
    if (typeof head === 'string') have.add(headwordOf(head));
  }
  const today = dayKey(o.nowMs);
  const base = new Map<string, { path: string; intro: string }>();
  for (const it of o.items) {
    const d = o.docs.get(it.path);
    const head = d ? (it.path.startsWith('chunk/') ? d.en : d.word) : null;
    if (typeof head === 'string' && it.lex.intro) base.set(headwordOf(head), { path: it.path, intro: it.lex.intro });
  }
  const pools = {
    col: colPool(data.col, base, have, today),
    job: jobPool(data.job, have),
    band: bandPool(data.band, o.place?.edge ?? DEFAULT_EDGE, have, new Set((o.place?.ok ?? []).map(headwordOf))),
  };
  const need = refillNeed(o.quota, stock, { col: pools.col.length, job: pools.job.length, band: pools.band.length }, o.w);
  const out: [string, Doc][] = [];
  let order = o.nowMs;
  for (const s of ['col', 'job', 'band'] as const) {
    let left = need[s];
    for (const f of pools[s]) {
      if (left <= 0) break;
      const h = headwordOf(f.word);
      if (have.has(h)) continue;
      const nd = freshDoc(f, o.nowMs, order++);
      if (!nd || o.docs.has(nd.path)) continue;
      let r: 'created' | 'exists';
      try {
        r = await writer.createIfMissing(nd.path, nd.doc);
      } catch (err) {
        logError('vocab:refill-write', err);
        return out;
      }
      have.add(h);
      if (r !== 'created') continue; // 'exists' (anderes Stichwort mit gleicher Kennung) oder Fehler: nächster Kandidat
      out.push([nd.path, nd.doc]);
      left--;
    }
  }
  return out;
}
