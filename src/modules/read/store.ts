import { logError, logWarn } from './shared';
import type { Writer } from './shared';
import type { ArticleItem, ReadState } from './schemas';
import { appendArticlePlan, indexEntryOf, stateUpdatePlan, upsertIndexPlan } from './domain/day';
import type { AppendOutcome } from './domain/day';
import { monthOfDay, readDayPath, readMonthPath } from './domain/paths';
import { MAX_ARTICLES_PER_DAY } from './domain/size';

// Schreibzugriffe des Lesen-Moduls (docs/umbau/lesen-plan.md §4.4). Alles über den einen Schreibpfad (`Writer`, von außen gereicht):
// lesen, rechnen und schreiben in EINEM Schritt (`transform`), `acquire` als kurze kooperative Sperre gegen zwei Geräte.
// Es gibt hier kein Löschen. Aufgerufen wird nur auf eine Handlung hin (Tippen, Verlassen), nie aus Render oder Timer.

/** Sperre auf dem Tagesdokument (Plan §4.4: ttl 120 s). */
export const CLAIM_TTL_MS = 120_000;

export type Claim = { acquired: boolean };

/**
 * Vor dem Erzeugen: das Tagesdokument kurz für dieses Gerät reservieren. `acquired:false` ist ein normales Ergebnis
 * („läuft auf einem anderen Gerät“), kein Fehler. Nicht in einer Schleife wiederholen.
 */
export async function claimDay(writer: Writer, day: string, holder: string): Promise<Claim> {
  const res = await writer.acquire(readDayPath(day), { holder, ttlMs: CLAIM_TTL_MS });
  return { acquired: res.acquired };
}

export type SaveOutcome = AppendOutcome;

/**
 * Artikel speichern: erst Tagesdokument (der Text), dann Eintrag im Monatsindex. Gleiche Kennung wird nie doppelt angelegt.
 * Bei `exists` wird der Index trotzdem ergänzt, falls er fehlt (Absturz zwischen den beiden Schritten).
 * Gibt zurück, was mit dem Tagesdokument geschah; Fehler der Datenbank werden protokolliert und weitergereicht.
 */
export async function saveArticle(writer: Writer, day: string, item: ArticleItem, opts: { perDayMax?: number } = {}): Promise<SaveOutcome> {
  const box: { outcome: AppendOutcome } = { outcome: 'exists' };
  try {
    await writer.transform(readDayPath(day), (cur) => {
      const plan = appendArticlePlan(cur, day, item, opts.perDayMax ?? MAX_ARTICLES_PER_DAY);
      box.outcome = plan.outcome;
      return plan.op;
    });
  } catch (err) {
    logError('read:save', err, readDayPath(day));
    throw err;
  }
  const outcome = box.outcome;
  if (outcome === 'invalid_doc' || outcome === 'article_too_big' || outcome === 'doc_too_big' || outcome === 'day_full') {
    logWarn('read:save', { code: outcome, message: `${item.id} nicht gespeichert` }, readDayPath(day));
    return outcome;
  }
  const month = readMonthPath(monthOfDay(day));
  try {
    await writer.transform(month, (cur) => upsertIndexPlan(cur, monthOfDay(day), indexEntryOf(item, day)).op);
  } catch (err) {
    // Der Artikel ist gespeichert; ein fehlender Index wird beim nächsten Öffnen aus dem Tagesdokument ergänzt (Plan §4.4).
    logError('read:index', err, month);
    throw err;
  }
  return outcome;
}

/** Lesezustand eines Artikels fortschreiben (Maximum bei Zeit, `done` nur aufwärts). Nur auf Handlung (Verlassen/Ausblenden). */
export async function saveReadState(writer: Writer, month: string, id: string, patch: ReadState): Promise<'updated' | 'unchanged'> {
  const box = { missing: false };
  try {
    const res = await writer.transform(readMonthPath(month), (cur) => {
      const plan = stateUpdatePlan(cur, id, patch);
      box.missing = plan.outcome !== 'updated';
      return plan.op;
    });
    if (box.missing) logWarn('read:state', { code: 'index_missing', message: `${id} nicht im Monatsindex ${month}` }, readMonthPath(month));
    return res === 'updated' ? 'updated' : 'unchanged';
  } catch (err) {
    logError('read:state', err, readMonthPath(month));
    throw err;
  }
}
