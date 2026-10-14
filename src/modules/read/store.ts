import { addDays, logError, logWarn } from './shared';
import { parseMonthDoc, parsePrefs } from './domain/docs';
import type { Prefs } from './domain/docs';
import { monthsToLoad } from './domain/view';
import { afterSavePlan, prefsPatchPlan } from './domain/prefsPlan';
import type { AfterSave, PrefsPatch } from './domain/prefsPlan';
import { readDaysOf } from './domain/count';
import type { Writer } from './shared';
import type { ArticleItem, IndexItem, ReadState } from './schemas';
import { appendArticlePlan, indexEntryOf, stateUpdatePlan, upsertIndexPlan } from './domain/day';
import type { AppendOutcome } from './domain/day';
import { monthOfDay, READ_PREFS_PATH, readDayPath, readMonthPath, readRoutinePath } from './domain/paths';
import { mergeRoutine, parseRoutineDoc, ROUTINE_DAYS_BACK } from './domain/routine';
import type { LoadedRoutineDay } from './domain/routine';
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

// Wer den Lesestand anzeigt (die Liste), will wissen, wann er sich geändert hat: der Leser schreibt beim Verlassen, oft erst NACHDEM die Liste
// schon geladen hat. Reiner Hinweis ohne Daten; die Liste liest dann ihren Index neu (kein Abo, nur auf eine Handlung hin).
const stateListeners = new Set<() => void>();
export function onReadStateSaved(cb: () => void): () => void {
  stateListeners.add(cb);
  return () => stateListeners.delete(cb);
}

/** Lesezustand eines Artikels fortschreiben (Maximum bei Zeit, `done` nur aufwärts). Nur auf Handlung (Verlassen/Ausblenden). `seed` = Indexeintrag eines Routine-Artikels, der beim ersten Mal angelegt wird. */
export async function saveReadState(writer: Writer, month: string, id: string, patch: ReadState, seed?: IndexItem): Promise<'updated' | 'unchanged'> {
  const box = { missing: false };
  try {
    const res = await writer.transform(readMonthPath(month), (cur) => {
      const plan = stateUpdatePlan(cur, id, patch, seed, month);
      box.missing = plan.outcome !== 'updated' && plan.outcome !== 'created';
      return plan.op;
    });
    if (box.missing) logWarn('read:state', { code: 'index_missing', message: `${id} nicht im Monatsindex ${month}` }, readMonthPath(month));
    const changed = res === 'updated' || res === 'created';
    if (changed) for (const cb of stateListeners) cb();
    return changed ? 'updated' : 'unchanged';
  } catch (err) {
    logError('read:state', err, readMonthPath(month));
    throw err;
  }
}

// ---------------------------------------------------------------- Lesen (träge, je Dokument) und Einstellungen

type Doc = Record<string, unknown>;
/** Liest EIN Dokument frisch (`undefined` = fehlt). Wirft bei Lesefehlern. Die Oberfläche reicht hier `readDoc` des Datenlayers hinein. */
export type Reader = (path: string) => Promise<Doc | undefined>;

export type Home = {
  prefs: Prefs;
  /** Index der geladenen Monate, älteste zuerst (Reihenfolge des Erzeugens bleibt erhalten). */
  items: IndexItem[];
  /** Lerntage mit Tagesdokument (aus `read/p`). */
  days: string[];
  /** Index-Einträge, die wegen unerwarteten Aufbaus ausgeblendet sind. */
  hidden: number;
  /** Artikel der Routine, die die Prüftore nicht bestanden haben (ausgeblendet, nie gelöscht). */
  routineHidden: number;
};

/**
 * Alles, was der Bildschirm „Lesen“ braucht, mit wenigen kleinen Lesezugriffen: `read/p` und die Monatsindizes (aktueller Monat und Vormonat).
 * Die Artikeltexte (`read/d-…`) werden hier NIE gelesen; der Leser holt sich genau ein Tagesdokument, wenn es geöffnet wird.
 */
export async function loadHome(read: Reader, today: string): Promise<Home> {
  const p = await read(READ_PREFS_PATH);
  const months = monthsToLoad(today).reverse();
  const [docs, routine] = await Promise.all([Promise.all(months.map((m) => read(readMonthPath(m)))), loadRoutine(read, today)]);
  const items: IndexItem[] = [];
  let hidden = 0;
  for (const d of docs) {
    const parsed = parseMonthDoc(d);
    if (!parsed.ok) {
      hidden++;
      continue;
    }
    items.push(...parsed.items);
    hidden += parsed.hidden.length;
  }
  return { prefs: parsePrefs(p), items: mergeRoutine(items, routine.days), days: readDaysOf(p), hidden, routineHidden: routine.hidden };
}

/**
 * Routine-Dokumente (`read/r-<Tag>`) von heute und den zwei Tagen davor: je ein `get`, nie die Sammlung. Ein fehlendes Dokument ist normal
 * (die Routine hat noch nicht geschrieben), ein Lesefehler oder unbrauchbarer Aufbau blendet nur diesen Tag aus und bricht die Liste nie ab.
 */
async function loadRoutine(read: Reader, today: string): Promise<{ days: LoadedRoutineDay[]; hidden: number }> {
  const days: LoadedRoutineDay[] = [];
  let hidden = 0;
  for (let back = ROUTINE_DAYS_BACK; back >= 0; back--) {
    const day = addDays(today, -back);
    let doc: Record<string, unknown> | undefined;
    try {
      doc = await read(readRoutinePath(day));
    } catch (err) {
      logWarn('read:routine', err, readRoutinePath(day));
      continue;
    }
    const parsed = parseRoutineDoc(doc, day);
    if (!parsed.ok) {
      logWarn('read:routine', { code: 'invalid_doc', message: 'Routine-Dokument unbrauchbar' }, readRoutinePath(day));
      hidden++;
      continue;
    }
    hidden += parsed.hidden.length;
    if (parsed.items.length > 0 || parsed.hidden.length > 0) days.push({ day, items: parsed.items });
  }
  return { days, hidden };
}

/** Einstellungen ändern (nur auf Handlung). */
export async function savePrefs(writer: Writer, patch: PrefsPatch): Promise<void> {
  try {
    await writer.transform(READ_PREFS_PATH, (cur) => prefsPatchPlan(cur, patch));
  } catch (err) {
    logError('read:prefs', err, READ_PREFS_PATH);
    throw err;
  }
}

/** Nach einem gespeicherten Artikel: Lerntag, Themenverlauf und „heute erzeugt“ in `read/p` fortschreiben. */
export async function recordSaved(writer: Writer, a: AfterSave): Promise<void> {
  try {
    await writer.transform(READ_PREFS_PATH, (cur) => afterSavePlan(cur, a));
  } catch (err) {
    logError('read:prefs', err, READ_PREFS_PATH);
    throw err;
  }
}
