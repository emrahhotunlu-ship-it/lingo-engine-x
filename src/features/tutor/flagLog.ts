import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { logWarn } from '../../platform/diagnostics';

// Großpaket G6 (LS7, M14): „Aufgabe war unfair“ hinterlässt eine Spur. Die Antwort zählt nicht (kein Eintrag in `entries`, kein Lernstand),
// aber Satz, Antwort, Lösung und Grund stehen im Tagesprotokoll unter `flags` – die Lehrkraft-Prüfung wertet sie wöchentlich aus.
// Regeln wie überall: Lesen und Schreiben in EINEM Schritt, nie in ein ungültiges Dokument, doppelte Meldung ändert nichts, höchstens
// `FLAGS_MAX` je Tag (danach wird nicht still verworfen, sondern protokolliert; die Meldung in `app/c1.bad` bleibt ohnehin).

export const FLAGS_MAX = 40;
const TEXT_MAX = 300;
const clip = (s: string): string => (s.length > TEXT_MAX ? s.slice(0, TEXT_MAX) : s);

export type TaskFlag = { t: number; id: string; topic: string; q: string; given: string; ans: string; r: string; c?: true };

/** Rein: Meldung anhängen. `null` = nichts zu tun (schon gemeldet oder Tagesgrenze erreicht). */
export function addFlag(cur: readonly unknown[] | null | undefined, f: TaskFlag): TaskFlag[] | null {
  const list = (Array.isArray(cur) ? cur : []) as TaskFlag[];
  if (list.some((x) => x && typeof x === 'object' && x.id === f.id)) return null;
  if (list.length >= FLAGS_MAX) return null;
  return [...list, { ...f, id: clip(f.id), topic: clip(f.topic), r: clip(f.r), q: clip(f.q), given: clip(f.given), ans: clip(f.ans) }];
}

/** Meldung im Tagesprotokoll vermerken. Fehler werden protokolliert, nie geworfen (die Meldung selbst ist schon in `app/c1.bad`). */
export async function recordFlag(day: string, f: TaskFlag): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  const path = `log/${day}`;
  let full = false;
  try {
    await writer.transform(path, (cur) => {
      if (!cur) return { set: { date: day, entries: [], flags: [{ ...f, q: clip(f.q), given: clip(f.given), ans: clip(f.ans) }] } };
      if (!validateDoc(path, cur).ok) return null;
      const cf = (cur as { flags?: unknown[] }).flags;
      if (Array.isArray(cf) && cf.length >= FLAGS_MAX) full = true;
      const next = addFlag(Array.isArray(cf) ? cf : [], f);
      return next ? { update: { flags: next } } : null;
    });
    if (full) logWarn('learn:flag', { code: 'flags_full', message: `${FLAGS_MAX} Meldungen an diesem Tag – nicht im Protokoll vermerkt` }, f.id);
    return !full;
  } catch (err) {
    logWarn('learn:flag', err, path);
    return false;
  }
}
