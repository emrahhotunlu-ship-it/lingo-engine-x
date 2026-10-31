import { addDays, dayKey, dayStartOf, logError, type Writer } from '../shared';
import { type Catalog, loadByDay } from '../domain/catalog';
import { applyMove, buildDayPlan, type DayPlan } from '../domain/day';
import { LEGACY_EX, mirrorLegacy } from '../domain/mirror';
import { type Answer, type AnswerResult, applyAnswer } from '../domain/planner';
import type { FormStats, Lex, VocabCfg } from '../domain/types';
import { tuple, vlogDocId, vlogKey } from '../domain/vlog';
import { VMOD_DAY_PATH } from '../registry';
import { lexWriteSchema, vmodDayWriteSchema } from './schemas';

// Wörter-Modul V1: Schreib-Operationen, alle über den EINEN Writer (src/data/writer.ts, Kap. 3.4). Kein Löschen, kein Ersetzen eines
// Lernstands; `vmod/day` ist ein Zwischenspeicher (REPLACEABLE). Jede Antwort: `transform` auf dem frischen Kartendokument, danach ein
// Verlaufseintrag in `vlog` (Map mit festem Schlüssel aus Zeit und Gerät: zwei Geräte verlieren nichts, Wiederholung ist idempotent).

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

export type VocabDeps = { writer: Writer; device: string };

/** Lexem aus einem Dokument, nur wenn gültig und nicht aus einer künftigen Version (wird dann nie zurückgeschrieben). */
export function lexOf(doc: Doc | undefined | null): Lex | null {
  if (!doc || !isObj(doc.lex)) return null;
  const r = lexWriteSchema.safeParse(doc.lex);
  return r.success ? (r.data) : null;
}

export const isFutureLex = (doc: Doc | undefined | null): boolean => !!doc && isObj(doc.lex) && typeof doc.lex.v === 'number' && doc.lex.v > 1;

/**
 * Eine Antwort buchen. `cat` liefert Last und Geschwister (Stand im Speicher); gerechnet wird auf dem FRISCHEN Dokument.
 * Gibt das Ergebnis zurück oder `null`, wenn das Dokument fehlt, ungültig ist oder aus einer künftigen Version stammt.
 */
export async function writeAnswer(deps: VocabDeps, path: string, a: Answer, o: { cfg: VocabCfg; cat: Catalog; med: FormStats; planned: boolean }): Promise<AnswerResult | null> {
  const day = dayKey(a.t);
  const load = loadByDay(o.cat, o.med, path);
  const siblings = o.cat.siblingOffsets(path, day);
  let result: AnswerResult | null = null;
  const chunk = path.startsWith('chunk/');
  await deps.writer.transform(path, (cur) => {
    if (!cur || isFutureLex(cur)) return null;
    const lex = lexOf(cur);
    if (!lex) return null;
    const r = applyAnswer(lex, a, { cfg: o.cfg, path, planned: o.planned, load: (i) => load.get(addDays(day, i)) ?? 0, siblings });
    const parsed = lexWriteSchema.safeParse(r.lex);
    if (!parsed.success) {
      logError('vocab:answer', parsed.error, path);
      return null;
    }
    result = r;
    const patch: Doc = { lex: parsed.data };
    if (r.booked.length && r.grade !== null) Object.assign(patch, mirrorLegacy(r.lex, cur, { t: a.t, grade: r.grade, form: a.form, ms: a.ms, fk: a.fk }, chunk));
    return { update: patch };
  });
  const res = result as AnswerResult | null;
  if (res) {
    o.cat.set(path, res.lex);
    await writeVlog(deps, [tuple({ t: a.t, path, track: res.track, form: a.form, note: res.note, outcome: a.outcome, ms: a.ms, fk: a.fk, hint: a.hint, sentence: a.sentence, lv: res.lex.lv, flags: a.flags ?? 0 })], deps.device);
  }
  return res;
}

/** Verlaufseinträge schreiben: je Halbmonatsdokument einmal anlegen (falls es fehlt), dann EIN `update` mit allen Schlüsseln. */
export async function writeVlog(deps: VocabDeps, tuples: readonly ReturnType<typeof tuple>[], device: string | ((t: ReturnType<typeof tuple>) => string), part = 1): Promise<number> {
  const byDoc = new Map<string, Record<string, unknown>>();
  for (const tp of tuples) {
    const id = vlogDocId(tp[0], part);
    const key = vlogKey(tp[0], typeof device === 'string' ? device : device(tp));
    (byDoc.get(id) ?? byDoc.set(id, {}).get(id)!)[key] = tp;
  }
  for (const [id, e] of byDoc) {
    await deps.writer.createIfMissing(id, { v: 1, e: {} });
    await deps.writer.update(id, { e });
  }
  return byDoc.size;
}

/** „Rückgängig“: Verlaufsschlüssel auf `null` (plan.md §3.4, Bestand Nr. 39). */
export async function undoVlog(deps: VocabDeps, t: number): Promise<void> {
  await deps.writer.update(vlogDocId(t), { e: { [vlogKey(t, deps.device)]: null } });
}

/**
 * Tagesplan einfrieren (einmal je Lerntag, Kap. 15): steht in `vmod/day` schon der heutige Plan, bleibt er. Sonst neu rechnen, den Rückstand
 * verteilen (je Lexem ein `transform`, nur `lex.u.due`/`lex.b.due`/`lex.mv`) und den Plan ersetzen.
 */
export async function freezeDay(deps: VocabDeps, cat: Catalog, nowMs: number, cfg: VocabCfg, med: FormStats, current: Doc | null): Promise<DayPlan> {
  const day = dayKey(nowMs);
  if (current && current.d === day && Array.isArray(current.plan)) return current as unknown as DayPlan;
  const { plan, moves } = buildDayPlan(cat, nowMs, cfg, med);
  for (const m of moves) {
    await deps.writer.transform(m.path, (cur) => {
      const lex = lexOf(cur);
      if (!lex || lex.day === day) return null;
      const next = applyMove(lex, m, dayStartOf);
      cat.set(m.path, next);
      return { update: { lex: next } };
    });
  }
  const doc = { v: 1 as const, ...plan };
  const ok = vmodDayWriteSchema.safeParse(doc);
  if (!ok.success) {
    logError('vocab:day', ok.error, VMOD_DAY_PATH);
    return plan;
  }
  await deps.writer.transform(VMOD_DAY_PATH, (cur) => (cur && cur.d === day ? null : cur ? { replace: ok.data } : { set: ok.data }));
  return plan;
}

export { LEGACY_EX };
