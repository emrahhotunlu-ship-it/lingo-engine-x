import { getWriter } from '../../data';
import { mayCreateDoc } from '../../domain/capacity/docGuard';
import { chunkPresence, newChunkDoc, takeChunkOp, type NewChunkInput } from '../../domain/chunks/newChunk';
import { radarEvents, type RadarError } from '../../domain/progress/radarPatch';
import { sceneRunOp } from '../../domain/speak/sceneDoc';
import { monthOf, upsertRun } from '../../domain/speak/talkDoc';
import type { StoredReport, TalkRun } from '../../domain/speak/types';
import { SPEAK_DUTY_TURNS } from '../../domain/speak/duty';
import { logError, logWarn } from '../../platform/diagnostics';
import { flush, learnRecorder, nextT, recordActivity } from '../progress/persist';

// Schreibwege für Sprechen (Plan §3.2) – nur über den einen Writer, nur auf Handlungen hin
// (Beenden, Mitnehmen, Szene erstellen), nie aus Render, Snapshot oder Timer.

type Doc = Record<string, unknown>;

export type TakeOutcome = 'taken' | 'exists' | 'hidden' | 'invalid' | 'error';

/** Wendung mitnehmen: nur anlegen, wenn sie fehlt; vorhandene nie verändern (D6). */
export async function takeChunk(input: NewChunkInput): Promise<TakeOutcome> {
  const made = newChunkDoc(input);
  if (!made) return 'invalid';
  const writer = getWriter();
  if (!writer) return 'error';
  const seen: { p: ReturnType<typeof chunkPresence> } = { p: 'absent' };
  try {
    let blocked = false;
    const res = await writer.transform(`chunk/${made.id}`, (cur) => {
      seen.p = chunkPresence(cur);
      // Datenbank fast voll (Gesamtzahl): keine neue Wendung, laut gemeldet (Prüfbefund S8).
      if (!cur && !mayCreateDoc(`chunk/${made.id}`)) {
        blocked = true;
        return null;
      }
      return takeChunkOp(cur, made);
    });
    if (blocked) return 'error';
    if (res === 'created') return 'taken';
    return seen.p === 'hidden' ? 'hidden' : 'exists';
  } catch (err) {
    logError('speak:take', err, `chunk/${made.id}`);
    return 'error';
  }
}

/** Ausgeblendete Wendung wieder aufnehmen (ausdrückliche Handlung, `update` auf Bestehendes). */
export async function restoreChunk(id: string): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.update(`chunk/${id}`, { hidden: false });
    return true;
  } catch (err) {
    logError('speak:restore', err, `chunk/${id}`);
    return false;
  }
}

/** Neue KI-Szene anlegen (nur wenn die Kennung frei ist). */
export async function createSceneDoc(id: string, doc: Doc): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    const r = await writer.createIfMissing(`scene/${id}`, doc);
    if (r === 'exists') logWarn('speak:scene', { code: 'exists', message: `scene/${id} existiert schon` });
    return r === 'created';
  } catch (err) {
    logError('speak:scene', err, `scene/${id}`);
    return false;
  }
}

export type SaveRunInput = {
  run: TalkRun;
  lang: 'de' | 'en';
  /** Szene aus dem Inhalt (für den Lauf-Vermerk, falls `scene/<id>` fehlt). */
  legacyScene: Doc | null;
  errors: RadarError[];
  nowMs: number;
};

/**
 * Gesprächsende: `talk/<Monat>`, Log + Profil (gemeinsamer Puffer), Fehler-Radar, Lauf-Vermerk.
 * Jeder Schritt einzeln – ein Fehler in einem stoppt die anderen nicht. Rückgabe: alles gespeichert?
 */
export async function saveRun(i: SaveRunInput): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let ok = true;
  const { run } = i;
  try {
    const r = await writer.transform(`talk/${monthOf(run.day)}`, (cur) => upsertRun(cur, run));
    if (r === 'unchanged') logWarn('speak:talk', { code: 'unchanged', message: 'Gesprächslauf nicht geschrieben' }, run.id);
  } catch (err) {
    ok = false;
    logError('speak:talk', err, run.id);
  }
  // Log, Profil und Fehler-Radar über die eine Sammel-Warteschlange (phase2-plan D5).
  const events = radarEvents(i.errors, 'k', run.t);
  if (run.turns >= 1) {
    const partial = run.turns < SPEAK_DUTY_TURNS;
    const saved = await recordActivity(
      { t: nextT(), ok: true, lang: i.lang, type: 'speak', id: run.scene, m: 'speak', q: run.title, n: run.turns, ms: run.ms, ctx: 'spk' },
      { day: run.day, act: 'speak', partial, n: run.turns, right: run.clean, activeMs: run.ms, countAs: run.turns },
      events,
    );
    if (!saved) ok = false;
  } else if (events.length) {
    learnRecorder.radar(events);
    if (!(await flush())) ok = false;
  }
  try {
    await writer.transform(`scene/${run.scene}`, (cur) => sceneRunOp(cur, i.legacyScene, i.nowMs));
  } catch (err) {
    ok = false;
    logError('speak:scene-run', err, `scene/${run.scene}`);
  }
  return ok;
}

/** KI-Bericht nachtragen (idempotent über `run.id`). */
export async function saveReport(run: TalkRun, report: StoredReport): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  try {
    await writer.transform(`talk/${monthOf(run.day)}`, (cur) => upsertRun(cur, { ...run, report, goal: report.goal.state }));
    return true;
  } catch (err) {
    logError('speak:report', err, run.id);
    return false;
  }
}
