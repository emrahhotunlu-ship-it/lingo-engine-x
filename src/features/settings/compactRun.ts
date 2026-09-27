import { getWriter } from '../../data';
import { readDoc } from '../../data/reads';
import { archivesCover, compactPlan, profileWithout, type CompactPlan } from '../../domain/capacity/compact';
import { jsonBytes, PROFILE_COMPACT_BYTES } from '../../domain/capacity/profileSize';
import { getDb } from '../../platform/capabilities';
import { logError, logInfo } from '../../platform/diagnostics';
import { flush } from '../progress/persist';

// Profil verkleinern (Plan §12.3, W5, E20): nur nach Emrahs Tipp im Trockenlauf, erst archivieren
// und prüfen, dann das Profil ersetzen und erneut prüfen. Jeder Fehler vor dem Ersetzen bricht ohne
// Schreiben am Profil ab. Zugelassen erst nach der Abnahme (P7-5) – bis dahin bleibt der Knopf aus.

export const COMPACT_ENABLED = false;

type Doc = Record<string, unknown>;
export type CompactOutcome = { status: 'done'; kb: number } | { status: 'nothing' } | { status: 'failed'; reason: string };

/** Trockenlauf: was würde ausgelagert (ohne Schreiben)? */
export function compactPreview(profile: Doc | null | undefined, today: string): CompactPlan | null {
  if (!profile) return null;
  const plan = compactPlan(profile, today, 0);
  return plan.years.length ? plan : null;
}

export async function runCompact(today: string, t: number = Date.now(), minBytes: number = PROFILE_COMPACT_BYTES): Promise<CompactOutcome> {
  const db = getDb();
  const writer = getWriter();
  if (!db || !writer) return { status: 'failed', reason: 'no_db' };
  try {
    // 1. Alle Puffer leeren.
    await flush();
    const cur = await readDoc(db, 'app/profile');
    if (cur.status !== 'valid') return { status: 'failed', reason: cur.status === 'invalid' ? 'invalid_profile' : 'missing' };
    // Nur ab der Schwelle (Plan E20): kleine Profile bleiben, wie sie sind.
    if (jsonBytes(cur.doc) < minBytes) return { status: 'nothing' };
    const plan = compactPlan(cur.doc, today, t);
    if (!plan.years.length) return { status: 'nothing' };
    // 2. Archive anlegen; ein vorhandenes muss für jeden auszulagernden Tag inhaltsgleich sein.
    for (const [path, doc] of Object.entries(plan.archives)) {
      const res = await writer.createIfMissing(path, doc);
      if (res === 'exists') {
        const a = await readDoc(db, path);
        if (a.status !== 'valid' || !archivesCover(cur.doc, { ...plan, removeKeys: onlyYear(plan, doc.year) }, { [path]: a.doc })) return { status: 'failed', reason: 'archive_differs' };
      }
    }
    // 3. Archive frisch lesen.
    const archives: Record<string, Doc | null> = {};
    for (const path of Object.keys(plan.archives)) {
      const a = await readDoc(db, path);
      archives[path] = a.status === 'valid' ? a.doc : null;
    }
    // 4.–6. Frisches Profil: erneut prüfen, dann ersetzen und nachlesen (writer.compact).
    let kb = 0;
    await writer.compact('app/profile', (fresh) => {
      if (!archivesCover(fresh, plan, archives)) throw new Error('archive does not cover fresh profile');
      const next = profileWithout(fresh, plan);
      kb = Math.round(jsonBytes(next) / 1024);
      return next;
    });
    logInfo('capacity:compact', `ausgelagert: ${plan.years.join(', ')}`);
    return { status: 'done', kb };
  } catch (err) {
    logError('capacity:compact', err);
    return { status: 'failed', reason: 'error' };
  }
}

function onlyYear(plan: CompactPlan, year: number): CompactPlan['removeKeys'] {
  const out = {} as CompactPlan['removeKeys'];
  for (const [k, days] of Object.entries(plan.removeKeys) as Array<[keyof CompactPlan['removeKeys'], string[]]>) out[k] = days.filter((d) => d.startsWith(`${year}-`));
  return out;
}
