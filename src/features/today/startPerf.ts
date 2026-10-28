import { logWarn } from '../../platform/diagnostics';
import { KEY_PREFIX, local } from '../../platform/storage';

// Start-Messpunkte (Relaunch Stufe 1 P6, stufe1-plan §8 Tempo): `lx:skeleton` (Startbild/Skelett von Heute steht), `lx:button` (der Start-Knopf ist
// bedienbar), `lx:first-task` (die erste Aufgabe steht nach dem Start). Je Seitenladen höchstens einmal; Zeit seit dem Laden der Seite.
// Die letzten 5 Starts liegen NUR im Browser (`lx:perf`, `platform/storage.local`), nie in der Datenbank: Bequemlichkeit für die Diagnose.

export type StartMark = 'lx:skeleton' | 'lx:button' | 'lx:first-task';
/** Ein gemessener Start: Knopf (`b`) und erste Aufgabe (`f`) in ms seit dem Laden, `t` = Zeitpunkt. */
export type StartPerf = { b: number | null; f: number; t: number };

export const START_PERF_KEY = `${KEY_PREFIX}perf`;
const KEEP = 5;
const done = new Set<StartMark>();

const msOf = (name: StartMark): number | null => {
  try {
    const e = performance.getEntriesByName(name, 'mark')[0];
    return e ? Math.round(e.startTime) : null;
  } catch (err) {
    logWarn('perf:mark', err, name);
    return null;
  }
};

/** Gespeicherte Starts (älteste zuerst); Unlesbares zählt als leer. */
export function storedStarts(): StartPerf[] {
  const raw = local.get(START_PERF_KEY);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is StartPerf => !!x && typeof x === 'object' && typeof (x as StartPerf).f === 'number' && typeof (x as StartPerf).t === 'number');
  } catch (err) {
    logWarn('perf:store', err, START_PERF_KEY);
    return [];
  }
}

/** Messpunkt setzen (einmal je Seitenladen). Mit `lx:first-task` wird der Start gemerkt (höchstens die letzten 5). */
export function markStart(name: StartMark): void {
  if (done.has(name)) return;
  done.add(name);
  try {
    performance.mark(name);
  } catch (err) {
    logWarn('perf:mark', err, name);
    return;
  }
  if (name !== 'lx:first-task') return;
  const f = msOf('lx:first-task');
  if (f === null) return;
  const list = [...storedStarts(), { b: msOf('lx:button'), f, t: Date.now() }].slice(-KEEP);
  local.set(START_PERF_KEY, JSON.stringify(list));
}

/** Für die Diagnosezeile: Werte dieses Seitenladens, sonst der letzte gemerkte Start. */
export function startLine(): { b: number | null; f: number | null } {
  const b = msOf('lx:button');
  const f = msOf('lx:first-task');
  if (b !== null || f !== null) return { b, f };
  const last = storedStarts().at(-1);
  return last ? { b: last.b, f: last.f } : { b: null, f: null };
}

/** Nur für Tests. */
export function resetStartPerfForTests(): void {
  done.clear();
}
