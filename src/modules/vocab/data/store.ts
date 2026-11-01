import { leechTreatment } from '../domain/leech';
import { addDays, dayKey, dayStartOf, logError, type Writer } from '../shared';
import { type Catalog, loadByDay } from '../domain/catalog';
import { applyMove, buildDayPlan, type DayPlan } from '../domain/day';
import { LEGACY_EX, mirrorLegacy } from '../domain/mirror';
import { type Draft, draftOpen } from '../domain/flow';
import { type Answer, type AnswerResult, applyAnswer, introduce, type PlanCtx, probeKnown } from '../domain/planner';
import type { FormStats, Lex, VocabCfg } from '../domain/types';
import { tuple, VLOG_MAX_PARTS, VLOG_SOFT_MAX, vlogDocId, vlogKey } from '../domain/vlog';
import { VMOD_DAY_PATH, VMOD_USE_PATH } from '../registry';
import { VLOG_INDEX_PATH } from '../domain/vlogIndex';
import { lexWriteSchema, USE_LATER_MAX, type UseLater, useLaterSchema, vmodDayWriteSchema, vmodIxWriteSchema, vmodUseWriteSchema } from './schemas';
import { applyUse, type UseInput, type UseResult } from '../domain/apply';

// Wörter-Modul V1: Schreib-Operationen, alle über den EINEN Writer (src/data/writer.ts, Kap. 3.4). Kein Löschen, kein Ersetzen eines
// Lernstands; `vmod/day` ist ein Zwischenspeicher (REPLACEABLE). Jede Antwort: `transform` auf dem frischen Kartendokument, danach ein
// Verlaufseintrag in `vlog` (Map mit festem Schlüssel aus Zeit und Gerät: zwei Geräte verlieren nichts, Wiederholung ist idempotent).

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

export type VocabDeps = { writer: Writer; device: string };

export { lexOf, isFutureLex } from './lex';
import { lexOf, isFutureLex, lexPatch } from './lex';

type Compute = (lex: Lex) => AnswerResult | null;

/**
 * Gemeinsamer Buchungsweg: `compute` auf dem FRISCHEN Kartendokument, Lernstand prüfen und schreiben, alte Felder spiegeln (nur bei Note),
 * danach ein Verlaufseintrag. `null`, wenn das Dokument fehlt, ungültig ist, aus einer künftigen Version stammt oder `compute` ablehnt.
 */
async function commit(deps: VocabDeps, path: string, a: Answer, cat: Catalog, compute: Compute): Promise<AnswerResult | null> {
  let result: AnswerResult | null = null;
  const chunk = path.startsWith('chunk/');
  await deps.writer.transform(path, (cur) => {
    if (!cur || isFutureLex(cur)) return null;
    const lex = lexOf(cur);
    if (!lex) return null;
    const r = compute(lex);
    if (!r) return null;
    const parsed = lexWriteSchema.safeParse(r.lex);
    if (!parsed.success) {
      logError('vocab:answer', parsed.error, path);
      return null;
    }
    result = r;
    const patch: Doc = { lex: lexPatch(cur.lex, parsed.data) };
    const futureFsrs = isObj(cur.fsrs) && typeof cur.fsrs.v === 'number' && cur.fsrs.v > 1;
    if (r.booked.length && r.grade !== null && !futureFsrs) Object.assign(patch, mirrorLegacy(r.lex, cur, { t: a.t, grade: r.grade, form: a.form, ms: a.ms, fk: a.fk }, chunk));
    return { update: patch };
  });
  const res = result as AnswerResult | null;
  if (res) {
    cat.set(path, res.lex);
    await logAnswer(deps, path, a, res);
  }
  return res;
}

const logAnswer = (deps: VocabDeps, path: string, a: Answer, r: Pick<AnswerResult, 'track' | 'note' | 'lex'>) =>
  writeVlog(deps, [tuple({ t: a.t, path, track: r.track, form: a.form, note: r.note, outcome: a.outcome, ms: a.ms, fk: a.fk, hint: a.hint, sentence: a.sentence, lv: r.lex.lv, flags: a.flags ?? 0 })], deps.device);

type BookOpts = { cfg: VocabCfg; cat: Catalog; med: FormStats; planned: boolean };

function ctxOf(path: string, t: number, o: BookOpts): PlanCtx {
  const day = dayKey(t);
  const load = loadByDay(o.cat, o.med, path);
  // `ff`: Lehrer-Falle (falscher Freund oder Paar) → beim Leech eine offene Kontrastkarte (gleich wie flow.ts planCtxOf, sonst wiche das Band ab).
  return { cfg: o.cfg, path, planned: o.planned, load: (i) => load.get(addDays(day, i)) ?? 0, siblings: o.cat.siblingOffsets(path, day), ff: leechTreatment(o.cat.get(path)?.trap) === 'contrast' };
}

/**
 * Eine Antwort buchen. `cat` liefert Last und Geschwister (Stand im Speicher); gerechnet wird auf dem FRISCHEN Dokument.
 * Gibt das Ergebnis zurück oder `null`, wenn das Dokument fehlt, ungültig ist oder aus einer künftigen Version stammt.
 * Ist genau diese Antwort schon gebucht (`sync === t`: Weiter und Verlassen zugleich), wird nichts mehr geschrieben.
 */
export async function writeAnswer(deps: VocabDeps, path: string, a: Answer, o: BookOpts): Promise<AnswerResult | null> {
  const ctx = ctxOf(path, a.t, o);
  return commit(deps, path, a, o.cat, (lex) => (lex.sync === a.t ? null : applyAnswer(lex, a, ctx)));
}

/** Neues Wort eingeführt (V3 §3): Lernschritt A beginnt, keine Note; Verlaufseintrag mit dem Versuch (Form `intro`). Schon eingeführt → nichts. */
export async function writeIntro(deps: VocabDeps, path: string, a: Answer, cat: Catalog): Promise<AnswerResult | null> {
  return commit(deps, path, a, cat, (lex) => (lex.intro !== null ? null : { lex: introduce(lex, a.t), grade: null, booked: [], note: 0, track: 0, events: [], speed: null }));
}

/**
 * „Kenne ich schon“ (V3 §3): richtig ohne Hilfe → Stufe 3, Kontrolle in 7 Tagen (`probeKnown`); sonst nur der Verlaufseintrag, das Wort wird
 * danach normal eingeführt (eigene Buchung `writeIntro`).
 */
export async function writeProbe(deps: VocabDeps, path: string, a: Answer, o: BookOpts): Promise<AnswerResult | null> {
  if (a.outcome !== 'ok') {
    const lex = o.cat.get(path)?.lex;
    if (lex) await logAnswer(deps, path, a, { track: 0, note: 0, lex });
    return null;
  }
  const ctx = ctxOf(path, a.t, o);
  return commit(deps, path, a, o.cat, (lex) => (lex.intro !== null ? null : probeKnown(lex, a.t, ctx)));
}

/**
 * Eine Verwendung buchen (Anwenden / eigener Satz, Großpaket A S5c): Claudes Urteil je Zielwort → Belege und (mit Planwirkung) Note über
 * `applyUse`, gerechnet auf dem FRISCHEN Dokument. Schon gebucht (`sync ≥ t`) → nichts. Beim Anwenden hat jedes Wort eine eigene Zeit (`t + i`),
 * damit die Verlaufsschlüssel (Zeit und Gerät) nicht zusammenfallen.
 */
export async function writeUse(deps: VocabDeps, path: string, a: Answer, u: UseInput, o: BookOpts): Promise<UseResult | null> {
  const ctx = ctxOf(path, u.t, o);
  let out: UseResult | null = null;
  await commit(deps, path, a, o.cat, (lex) => {
    if (lex.sync >= u.t) return null;
    const r = applyUse(lex, u, ctx);
    // Auch ohne Note und Beleg gilt die Verwendung als gebucht (der Entwurf ist damit erledigt, kein zweiter Verlaufseintrag).
    out = r.lex.sync >= u.t ? r : { ...r, lex: { ...r.lex, sync: u.t } };
    return out;
  });
  return out;
}

/** Offenen Entwurf aus dem Browser nachbuchen (nur wenn das Lexem ihn noch nicht kennt, `draftOpen`). */
export async function replayDraft(deps: VocabDeps, d: Draft, o: Omit<BookOpts, 'planned'>): Promise<AnswerResult | null> {
  const lex = o.cat.get(d.path)?.lex ?? null;
  if (!draftOpen(d, lex)) return null;
  const opts = { ...o, planned: d.planned };
  if (d.kind === 'intro') return writeIntro(deps, d.path, d.a, o.cat);
  if (d.kind === 'probe') return writeProbe(deps, d.path, d.a, opts);
  if (d.kind === 'use') return d.u ? writeUse(deps, d.path, d.a, d.u, opts) : null;
  return writeAnswer(deps, d.path, d.a, opts);
}

// ---------------------------------------------------------------- `vmod/use`: Alltags-Lage und „Später prüfen lassen“ (S5c)

/** Tage, die ein Text auf „Später prüfen lassen“ wartet; danach fällt er weg (die Belege wären zu alt). */
export const USE_LATER_DAYS = 14;

export type UseDoc = { life: string | null; later: UseLater[] };

/** `vmod/use` tolerant lesen: ungültige Einträge fallen weg (gemeldet), ein ungültiges Dokument zählt als leer. */
export function readUseDoc(raw: unknown): UseDoc {
  if (!isObj(raw)) return { life: null, later: [] };
  const life = typeof raw.life === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.life) ? raw.life : null;
  const list = Array.isArray(raw.later) ? raw.later : [];
  const later: UseLater[] = [];
  for (const it of list) {
    const r = useLaterSchema.safeParse(it);
    if (r.success) later.push(r.data);
  }
  if (later.length !== list.length) logError('vocab:use-doc', new Error('ungültige Einträge in later'), String(list.length - later.length));
  return { life, later };
}

const EMPTY_USE = { v: 1 as const, life: null, later: [] };

/** `vmod/use` frisch ändern: `fn` bekommt den gelesenen Stand und liefert den neuen (oder `null` = nichts zu tun). Geprüft vor dem Schreiben. */
async function changeUse(deps: VocabDeps, fn: (cur: UseDoc) => UseDoc | null): Promise<UseDoc | null> {
  await deps.writer.createIfMissing(VMOD_USE_PATH, EMPTY_USE);
  let out: UseDoc | null = null;
  await deps.writer.transform(VMOD_USE_PATH, (cur) => {
    if (!cur) return null;
    const next = fn(readUseDoc(cur));
    if (!next) return null;
    const ok = vmodUseWriteSchema.safeParse({ v: 1, ...next });
    if (!ok.success) {
      logError('vocab:use-doc', ok.error, VMOD_USE_PATH);
      return null;
    }
    out = next;
    return { update: { v: 1, life: ok.data.life, later: ok.data.later } };
  });
  return out;
}

/** Alltags-Lage gezeigt: Tag merken (einmal pro Woche, `frameFor`). */
export function markLife(deps: VocabDeps, day: string): Promise<UseDoc | null> {
  return changeUse(deps, (cur) => (cur.life !== null && cur.life >= day ? null : { ...cur, life: day }));
}

/** Text für „Später prüfen lassen“ merken (doppelte Zeit → nichts; zu alte und überzählige fallen weg, die ältesten zuerst). */
export function addLater(deps: VocabDeps, item: UseLater, nowMs: number): Promise<UseDoc | null> {
  return changeUse(deps, (cur) => {
    if (cur.later.some((x) => x.t === item.t)) return null;
    const keep = cur.later.filter((x) => nowMs - x.t < USE_LATER_DAYS * 86_400_000);
    return { ...cur, later: [...keep, item].sort((a, b) => a.t - b.t).slice(-USE_LATER_MAX) };
  });
}

/** Geprüften oder verworfenen Text aus der Liste nehmen. */
export function dropLater(deps: VocabDeps, t: number): Promise<UseDoc | null> {
  return changeUse(deps, (cur) => (cur.later.some((x) => x.t === t) ? { ...cur, later: cur.later.filter((x) => x.t !== t) } : null));
}

/** Bereits im Verzeichnis `vmod/ix` eingetragene Verlaufsdokumente, je Schreiber (spart einen Lesezugriff je Antwort). */
const listedIx = new WeakMap<Writer, Set<string>>();

/**
 * Verlaufsdokument im Verzeichnis `vmod/ix` eintragen, BEVOR es angelegt wird (V3 Schritt 1: `vlog` ist träge, Zählung und Sicherung lesen
 * das Verzeichnis). Map-`update`: zwei Geräte verschmelzen. Ein Eintrag ohne Dokument (Absturz dazwischen) schadet nicht.
 */
export async function listVlogDoc(writer: Writer, path: string): Promise<void> {
  const id = path.slice('vlog/'.length);
  const known = listedIx.get(writer) ?? listedIx.set(writer, new Set()).get(writer)!;
  if (known.has(id)) return;
  const empty = vmodIxWriteSchema.parse({ v: 1, docs: {} });
  await writer.createIfMissing(VLOG_INDEX_PATH, empty);
  await writer.transform(VLOG_INDEX_PATH, (cur) => {
    if (!cur) return null;
    if (isObj(cur.docs) && cur.docs[id] === 1) return null;
    return { update: { docs: { [id]: 1 } } };
  });
  known.add(id);
}

/** Höchstens so viele Einträge je Schreibvorgang (≈ 130 B je Eintrag → ≈ 100 KB). */
export const VLOG_BATCH = 800;

/**
 * Verlaufseinträge schreiben, je Halbmonat: in `transform` auf dem frischen Stand (anlegen, falls es fehlt; sonst `update` mit nur den neuen
 * Schlüsseln – verschachtelte Objekte verschmelzen, zwei Geräte verlieren nichts). Würde das Dokument über 200 KiB wachsen, geht es in der
 * Fortsetzung `-a2`, `-a3` … weiter (A6 Nr. 6, plan.md §3.4). Schlüssel, die in einem früheren Teil schon stehen, werden nicht noch einmal
 * geschrieben (idempotent über die Teile hinweg). Liefert die Zahl der beschriebenen Dokumente.
 */
export async function writeVlog(deps: VocabDeps, tuples: readonly ReturnType<typeof tuple>[], device: string | ((t: ReturnType<typeof tuple>) => string), part = 1): Promise<number> {
  const byHalf = new Map<string, [string, unknown][]>();
  for (const tp of tuples) {
    const base = vlogDocId(tp[0]);
    const key = vlogKey(tp[0], typeof device === 'string' ? device : device(tp));
    (byHalf.get(base) ?? byHalf.set(base, []).get(base)!).push([key, tp]);
  }
  const touched = new Set<string>();
  for (const [half, list] of byHalf) {
    for (let i = 0; i < list.length; i += VLOG_BATCH) {
      let rest = Object.fromEntries(list.slice(i, i + VLOG_BATCH));
      for (let p = part; p <= VLOG_MAX_PARTS && Object.keys(rest).length; p++) {
        const id = p > 1 ? `${half}${p}` : half;
        let overflow = false;
        // Erst ins Verzeichnis, dann anlegen (falls es fehlt), dann nur noch `update`: so verschmelzen gleichzeitige Schreiber zweier Geräte (db.d.ts).
        await listVlogDoc(deps.writer, id);
        await deps.writer.createIfMissing(id, { v: 1, e: {} });
        await deps.writer.transform(id, (cur) => {
          const have = cur && isObj(cur.e) ? cur.e : {};
          const fresh = Object.fromEntries(Object.entries(rest).filter(([k]) => !(k in have)));
          if (!Object.keys(fresh).length) {
            rest = {};
            return null;
          }
          if (!cur) return null;
          if (JSON.stringify(cur).length + JSON.stringify(fresh).length > VLOG_SOFT_MAX) {
            overflow = true;
            rest = fresh;
            return null;
          }
          return { update: { e: fresh } };
        });
        if (overflow) continue;
        touched.add(id);
        rest = {};
      }
      // Alle Fortsetzungen voll: werfen, damit der Aufrufer es sieht (Umrechnung → 'partial', wiederholbar).
      if (Object.keys(rest).length) throw new Error(`vlog: alle Fortsetzungen voll (${Object.keys(rest).length} Einträge nicht geschrieben)`);
    }
  }
  return touched.size;
}

/** „Rückgängig“: Verlaufsschlüssel auf `null` (plan.md §3.4, Bestand Nr. 39) – in dem Teil, in dem er steht (`-a`, `-a2` … `-a9`). */
export async function undoVlog(deps: VocabDeps, t: number): Promise<boolean> {
  const key = vlogKey(t, deps.device);
  const half = vlogDocId(t);
  for (let p = 1; p <= VLOG_MAX_PARTS; p++) {
    let hit = false;
    await deps.writer.transform(p > 1 ? `${half}${p}` : half, (cur) => {
      if (!cur || !isObj(cur.e) || !(key in cur.e) || cur.e[key] === null) return null;
      hit = true;
      return { update: { e: { [key]: null } } };
    });
    if (hit) return true;
  }
  return false;
}

/** So viele Verschiebungen laufen gleichzeitig (verschiedene Dokumente; der Writer reiht je Pfad). */
export const MOVE_GROUP = 6;

/**
 * Tagesplan einfrieren (einmal je Lerntag, Kap. 15): steht in `vmod/day` schon der heutige Plan, bleibt er. Sonst neu rechnen, ZUERST den
 * Plan speichern (der Start wartet nicht auf die Verschiebungen; ein zweites Gerät sieht sofort denselben Plan), dann den Rückstand
 * verteilen: je Lexem ein `transform` (nur `lex.u.due`/`lex.b.due`/`lex.mv`), in Gruppen zu `MOVE_GROUP`. Steht schon ein heutiger Plan eines
 * anderen Geräts da, gilt dieser und es wird nicht verschoben. Bricht das ab, bleiben
 * die übrigen Lexeme fällig und werden am nächsten Lerntag verteilt (nichts geht verloren).
 */
export async function freezeDay(deps: VocabDeps, cat: Catalog, nowMs: number, cfg: VocabCfg, med: FormStats, current: Doc | null): Promise<DayPlan> {
  const day = dayKey(nowMs);
  if (current && current.d === day && Array.isArray(current.plan)) return current as unknown as DayPlan;
  const { plan, moves } = buildDayPlan(cat, nowMs, cfg, med);
  const doc = { v: 1 as const, ...plan };
  const ok = vmodDayWriteSchema.safeParse(doc);
  if (!ok.success) {
    // Plan nicht speicherbar: nicht verschieben (sonst liefen Verschiebungen ohne gespeicherten Plan, Kap. 15 „würfelt neu“).
    logError('vocab:day', ok.error, VMOD_DAY_PATH);
    return plan;
  }
  // Hat ein anderes Gerät den heutigen Plan schon gespeichert, gilt seiner, und dieses Gerät verschiebt nichts (sonst doppelt).
  let stored: Doc | null = null;
  await deps.writer.transform(VMOD_DAY_PATH, (cur) => {
    // Gilt nur ein heutiger Plan mit Liste; ein beschädigter heutiger Plan wird ersetzt (sonst würde er bei jedem Start neu gerechnet).
    if (cur && cur.d === day && Array.isArray(cur.plan)) {
      stored = cur;
      return null;
    }
    return cur ? { replace: ok.data } : { set: ok.data };
  });
  const other = stored as Doc | null;
  if (other) return other as unknown as DayPlan;
  for (let i = 0; i < moves.length; i += MOVE_GROUP) {
    const group = moves.slice(i, i + MOVE_GROUP);
    const res = await Promise.allSettled(
      group.map((m) =>
        deps.writer.transform(m.path, (cur) => {
          if (!cur || isFutureLex(cur)) return null;
          const lex = lexOf(cur);
          if (!lex || lex.day === day) return null;
          // Echte Idempotenz (zwei Geräte gleichzeitig): ist die Spur schon auf den Zieltag oder später gelegt, nicht noch einmal verschieben.
          const at = dayStartOf(m.to);
          const lane = m.track === 'b' && lex.b ? lex.b.due : lex.u.due;
          if (lane >= at) return null;
          const next = lexWriteSchema.safeParse(applyMove(lex, m, dayStartOf));
          if (!next.success) {
            logError('vocab:move', next.error, m.path);
            return null;
          }
          cat.set(m.path, next.data as typeof lex);
          return { update: { lex: lexPatch(cur.lex, next.data) } };
        }),
      ),
    );
    res.forEach((r, k) => {
      if (r.status === 'rejected') logError('vocab:move', r.reason, group[k]!.path);
    });
  }
  return plan;
}

export { LEGACY_EX };
