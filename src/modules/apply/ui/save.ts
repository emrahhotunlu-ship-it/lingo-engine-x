import { addProd, getDb, getWriter, outPath, readDoc, saveOutItem, saveRepairs, upsertOut } from '../sharedUi';
import { logError, logWarn } from '../shared';
import type { OutItem } from '../shared';
import { findKeypoints, KEYPOINTS_PREFIX } from '../domain/material';
import { evidenceWords, outItemOf, prodOf, repairsOf, type ApplyRun, type WordUse } from '../domain/result';

// Schreibwege des Moduls Anwenden (F3). Jeder Teil über den einen Schreibpfad (`writer.transform` auf dem frischen Stand, nur bei Änderung, nie in ein ungültiges
// Dokument; die vorhandenen Schreiber `saveOutItem`, `saveRepairs`, `addProd` halten das ein). Reihenfolge: Ergebnis zuerst, dann Fehlersätze, dann K7.
// Aufgerufen nur auf eine Handlung hin (Prüfen), nie aus Render oder Timer.

export type SaveResult = { out: boolean; repairs: number; repairsOk: boolean };

export async function saveRun(run: ApplyRun): Promise<SaveResult> {
  const out = await saveOutItem(outItemOf(run));
  const repairs = repairsOf(run);
  const repairsOk = repairs.length ? await saveRepairs(repairs) : true;
  const prod = prodOf(run);
  if (prod) {
    try {
      await addProd(prod, run.now);
    } catch (err) {
      logError('apply:prod', err, run.id);
    }
  }
  return { out, repairs: repairsOk ? repairs.length : 0, repairsOk };
}

/**
 * Wort-Belege `used` (Nachtrag learning-scientist Muss 3: nur richtig benutzt, nicht aus dem Material, gedämpft).
 * TODO(F2-Wörter-Belege): sobald die Wörter-App eine Tür anbietet, die die Gerätekennung selbst kennt (heute braucht `modules/vocab/api.reportEvidence` sie als
 * Argument und gibt sie nicht heraus), hier je Wort `reportEvidence({kind: 'used', typed: true, cued: false, ok: true, …})` melden. Bis dahin steht der Beleg nur
 * im `out`-Eintrag (`fb.w`), wie der Plan es vorsieht („bis dahin nur Speicherung“).
 */
export function pendingUsedEvidence(uses: readonly WordUse[], material: string): string[] {
  return evidenceWords(uses, material);
}

/**
 * Festgelegte Kernpunkte eines Artikels aus `out/<Monat>` der genannten Lerntage (heute und Tag des Artikels; je ein `get`, die Sammlung ist nicht abonniert).
 * `null` = noch keine (oder nicht lesbar: dann legt die erste Prüfung sie fest; doppelt angelegt wird nie, siehe `saveKeypoints`).
 */
export async function knownKeypoints(articleId: string, days: readonly string[]): Promise<string[] | null> {
  const db = getDb();
  if (!db) return null;
  const paths = [...new Set(days.map((d) => outPath(d)))];
  try {
    const docs = await Promise.all(paths.map(async (p) => {
      const r = await readDoc(db, p);
      return r.status === 'valid' ? r.doc : null;
    }));
    return findKeypoints(docs, articleId);
  } catch (err) {
    logWarn('apply:keypoints', err, articleId);
    return null;
  }
}

/**
 * Kernpunkte einmal festlegen: nur anlegen, wenn es für den Artikel noch keine gibt (nie überschreiben). Liefert die gültigen Punkte: hat ein anderes Gerät sie
 * inzwischen angelegt, gelten dessen Punkte (gleicher Maßstab bei jeder Prüfung); bei einem Schreibfehler die neuen (nur für diese Prüfung).
 */
export async function saveKeypoints(item: OutItem, points: readonly string[]): Promise<string[]> {
  const writer = getWriter();
  const box: { found: string[] | null } = { found: null };
  if (!writer) return [...points];
  try {
    await writer.transform(outPath(item.d), (cur) => {
      box.found = findKeypoints([cur ?? null], item.id.slice(KEYPOINTS_PREFIX.length));
      if (box.found) return null;
      return upsertOut(cur, item);
    });
  } catch (err) {
    logError('apply:keypoints', err, item.id);
  }
  return box.found ?? [...points];
}
