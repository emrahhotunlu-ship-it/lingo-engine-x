import { addDays, dayKey, dayStartOf, logError, type Writer } from '../shared';
import { type Catalog, loadByDay } from '../domain/catalog';
import { applyMove, buildDayPlan, type DayPlan } from '../domain/day';
import { LEGACY_EX, mirrorLegacy } from '../domain/mirror';
import { type Answer, type AnswerResult, applyAnswer } from '../domain/planner';
import type { FormStats, VocabCfg } from '../domain/types';
import { tuple, VLOG_MAX_PARTS, VLOG_SOFT_MAX, vlogDocId, vlogKey } from '../domain/vlog';
import { VMOD_DAY_PATH } from '../registry';
import { lexWriteSchema, vmodDayWriteSchema } from './schemas';

// Wörter-Modul V1: Schreib-Operationen, alle über den EINEN Writer (src/data/writer.ts, Kap. 3.4). Kein Löschen, kein Ersetzen eines
// Lernstands; `vmod/day` ist ein Zwischenspeicher (REPLACEABLE). Jede Antwort: `transform` auf dem frischen Kartendokument, danach ein
// Verlaufseintrag in `vlog` (Map mit festem Schlüssel aus Zeit und Gerät: zwei Geräte verlieren nichts, Wiederholung ist idempotent).

type Doc = Record<string, unknown>;
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

export type VocabDeps = { writer: Writer; device: string };

export { lexOf, isFutureLex } from './lex';
import { lexOf, isFutureLex } from './lex';

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
    const futureFsrs = isObj(cur.fsrs) && typeof cur.fsrs.v === 'number' && cur.fsrs.v > 1;
    if (r.booked.length && r.grade !== null && !futureFsrs) Object.assign(patch, mirrorLegacy(r.lex, cur, { t: a.t, grade: r.grade, form: a.form, ms: a.ms, fk: a.fk }, chunk));
    return { update: patch };
  });
  const res = result as AnswerResult | null;
  if (res) {
    o.cat.set(path, res.lex);
    await writeVlog(deps, [tuple({ t: a.t, path, track: res.track, form: a.form, note: res.note, outcome: a.outcome, ms: a.ms, fk: a.fk, hint: a.hint, sentence: a.sentence, lv: res.lex.lv, flags: a.flags ?? 0 })], deps.device);
  }
  return res;
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
        // Erst anlegen (falls es fehlt), dann nur noch `update`: so verschmelzen gleichzeitige Schreiber zweier Geräte (db.d.ts).
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
      if (Object.keys(rest).length) logError('vocab:vlog', new Error('vlog: alle Fortsetzungen voll'), String(Object.keys(rest).length));
    }
  }
  return touched.size;
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
