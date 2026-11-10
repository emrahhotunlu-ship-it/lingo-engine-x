import { z } from 'zod';
import { dayKey, loadAtlasText, loadColCharge, loadWtBank, logError, logWarn, type Writer } from '../shared';
import { exDeKey } from '../domain/card';
import { isNewLex, type Item } from '../domain/catalog';
import { headwordOf } from '../domain/dupes';
import { emptyLex } from '../domain/planner';
import { WARN_2 } from '../domain/capacity';
import { alternate, bandPool, type BandRaw, type ColRaw, colPool, DEFAULT_EDGE, type Fresh, jobPool, type JobRaw, refillNeed, type Src, V5_SRC, type Weights, type WtRaw, wtPool } from '../domain/sources';

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

/**
 * Deckel (data-guard S7b/S7c): ab so vielen Wort- und Wendungsdokumenten legt das Nachfüllen nichts mehr an. Die 5.000 (Kap. 9) gelten für alle
 * Dokumente; 1.000 bleiben für Verlauf, Tage, Lektionen, Lesen und den Rest (500 unter der zweiten Speicherwarnung).
 */
export const REFILL_DOC_CAP = WARN_2 - 500;

/** Rohdaten der Quellen (Tests geben sie hinein; die App lädt sie per dynamischem Import). */
export type SourceData = { job: readonly JobRaw[]; col: readonly ColRaw[]; band: readonly BandRaw[]; /** Großpaket WT: geprüfte Wortliste (vor der Häufigkeitsliste). */ wt?: readonly WtRaw[]; /** Täglich aufbereitete Atlas-Wörter (`wtq/m-JJJJ-MM`, Lehrer-geprüft; eigene, nie beim Start geladene Sammlung). */ wtDb?: readonly WtRaw[] };

/** Häufigkeitsliste als Quelle neuer Wörter (aus bis zur geprüften Lehrer-Charge, Inhalts-Audit 04.11.2026). */
export const ATLAS_REFILL = false;

/** Monatsdokumente der täglich aufbereiteten Wörter seit Beginn (November 2026) bis zum Monat von `nowMs`. */
export function wtqPaths(nowMs: number): string[] {
  const out: string[] = [];
  const end = dayKey(nowMs).slice(0, 7);
  for (let y = 2026, m = 11; out.length < 60; m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    out.push(`wtq/m-${k}`);
    if (k >= end) break;
  }
  return out;
}

const wtItemSchema = z.object({ w: z.string().min(1).max(60), p: z.string().max(20), d: z.string().min(1).max(120), g: z.string().max(160), x: z.string().min(10).max(220), xd: z.string().min(5).max(260), lvl: z.enum(['B1', 'B2', 'C1', 'C2']), r: z.number().int().min(0) });

/** Einträge eines Monatsdokuments (tolerant: ungültige Einträge fallen still weg, ein ungültiges Dokument liefert nichts). */
export function readWtq(doc: Doc | null): WtRaw[] {
  const items = doc && Array.isArray(doc.items) ? (doc.items as unknown[]) : [];
  const out: WtRaw[] = [];
  for (const it of items.slice(0, 1000)) {
    const r = wtItemSchema.safeParse(it);
    if (r.success) out.push(r.data);
  }
  return out;
}

export async function loadSources(): Promise<SourceData> {
  const [{ CHARGE2 }, atlasText, colRaw, wtRaw] = await Promise.all([import('../content'), loadAtlasText(), loadColCharge(), loadWtBank()]);
  const atlas = JSON.parse(atlasText) as { items?: BandRaw[] };
  const col = (colRaw as { items?: ColRaw[] }).items ?? [];
  // Inhalts-Audit 04.11.2026 (english-teacher, Note 3/10): die Häufigkeitsliste trägt ungeprüfte Fremd-Sätze („He's a fan of Klingon opera.“)
  // und falsche Bedeutungen. Sie füllt keine neuen Wörter mehr nach, bis eine geprüfte Lehrer-Charge mit Business-Sätzen sie ersetzt
  // (`ATLAS_REFILL`); schon angelegte Wörter bleiben unverändert.
  const wt = (wtRaw as { items?: WtRaw[] }).items ?? [];
  return { job: CHARGE2.reviewed ? CHARGE2.items : [], col, band: ATLAS_REFILL ? (atlas.items ?? []) : [], wt };
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
      : { id, word: f.word, de: f.de, ex: f.ex, pos: f.pos, src, ref: f.ref, added: dayKey(nowMs), order, state: 'new', col: [], lex, ...(f.exDe ? { exDe: { [exDeKey(f.ex)]: f.exDe } } : {}), ...(f.def ? { def: f.def } : {}) };
  return { path: `${f.kind}/${id}`, doc };
}

/**
 * Fehlende neue Lexeme anlegen, damit der heutige Plan nach den Gewichten mischen kann. `docs` = alle Wörter und Wendungen (auch ausgeblendete,
 * damit nichts doppelt entsteht), `items` = Katalog ohne Ausgeblendete. Liefert die angelegten Dokumente (für Katalog und Bestand im Speicher).
 * `place`: Einstufung; `null` = keine (Grenze 4.500), `'skip'` = Dokument da, aber nicht lesbar → Häufigkeitsliste heute auslassen (data-guard S7b).
 * Ab `REFILL_DOC_CAP` Dokumenten wird nichts angelegt. Ein Pfad, den ein zweiter Lauf am selben Tag schon angelegt hat (`'exists'`), zählt als
 * erledigt, damit zwei Läufe (zwei Geräte, Vorabplan) nicht doppelt nachfüllen.
 */
export async function refillFresh(
  writer: Writer,
  o: { docs: ReadonlyMap<string, Doc>; items: readonly Item[]; quota: number; nowMs: number; place: Place | null | 'skip'; w: Weights; load: () => Promise<SourceData> },
): Promise<[string, Doc][]> {
  if (o.quota <= 0) return [];
  let room = REFILL_DOC_CAP - o.docs.size;
  if (room <= 0) return [];
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
  const okSet = new Set((o.place && o.place !== 'skip' ? o.place.ok : []).map(headwordOf));
  const pools = {
    col: colPool(data.col, base, have, today),
    job: jobPool(data.job, have),
    // Großpaket WT: zuerst die geprüfte Wortliste (unabhängig von der Einstufungsgrenze), danach – falls eingeschaltet – die Häufigkeitsliste.
    band: [...alternate(wtPool(data.wt ?? [], have, okSet), wtPool(data.wtDb ?? [], have, okSet, 'atlas')), ...(o.place === 'skip' ? [] : bandPool(data.band, o.place?.edge ?? DEFAULT_EDGE, have, new Set((o.place?.ok ?? []).map(headwordOf))))],
  };
  const need = refillNeed(o.quota, stock, { col: pools.col.length, job: pools.job.length, band: pools.band.length }, o.w);
  const out: [string, Doc][] = [];
  let order = o.nowMs;
  for (const s of ['col', 'job', 'band'] as const) {
    let left = need[s];
    for (const f of pools[s]) {
      if (left <= 0 || room <= 0) break;
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
      left--;
      // 'exists': ein zweiter Lauf hat diesen Kandidaten schon angelegt (zählt als erledigt) oder ein anderes Stichwort trägt die Kennung.
      if (r !== 'created') continue;
      out.push([nd.path, nd.doc]);
      room--;
    }
  }
  return out;
}
