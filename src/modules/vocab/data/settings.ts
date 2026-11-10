import { logError, type Writer } from '../shared';
import { vcfgSchema } from './schemas';

// Großpaket A S6 (Bild s2-13, B9): Einstellungen Wörter schreiben. Ein `transform` auf `app/profile` aus dem frischen Stand: `vcfg` wird ganz
// geprüft (vcfgSchema, strikt) und nur geschrieben, wenn sich etwas ändert; unbekannte oder ungültige alte Werte werden nie still übernommen.
// `newPerDay` ist ein Feld des Profils selbst (wie bisher, auch die alte Einstellung schreibt es).

export const PROFILE_PATH = 'app/profile';
export const MIN_OPTIONS = [10, 15, 20, 30] as const;
export const NEW_OPTIONS = [0, 2, 5, 10, 15] as const;
/** Großpaket WT: Tagesziel in Wörtern (0 = nach Minuten). */
export const CNT_OPTIONS = [30, 40, 50, 60] as const;
export const RET_OPTIONS = [0.85, 0.9, 0.95] as const;

export type SettingsPatch = { cnt?: (typeof CNT_OPTIONS)[number] | 0; min?: (typeof MIN_OPTIONS)[number]; ret?: (typeof RET_OPTIONS)[number]; newPerDay?: (typeof NEW_OPTIONS)[number]; anki?: 0 | 1; pre?: 0 | 1 };

/** Liefert, ob der Wert jetzt gespeichert ist (auch: war schon so). `false` bei Fehler oder fehlendem/ungültigem Profil. */
export async function writeVocabSettings(writer: Writer, patch: SettingsPatch): Promise<boolean> {
  let ok = false;
  try {
    await writer.transform(PROFILE_PATH, (cur) => {
      if (!cur) return null;
      const update: Record<string, unknown> = {};
      const keys = (['min', 'ret', 'anki', 'pre', 'cnt'] as const).filter((k) => patch[k] !== undefined);
      if (keys.length) {
        const base = vcfgSchema.safeParse(cur.vcfg);
        // Ohne gültiges vcfg ist das Modul nie eingeschaltet worden: dann gibt es hier nichts einzustellen.
        if (!base.success) return null;
        const next = vcfgSchema.safeParse({ ...base.data, ...Object.fromEntries(keys.map((k) => [k, patch[k]])) });
        if (!next.success) return null;
        if (keys.some((k) => next.data[k] !== base.data[k])) update.vcfg = next.data;
      }
      if (patch.newPerDay !== undefined) {
        if (!(NEW_OPTIONS as readonly number[]).includes(patch.newPerDay)) return null;
        if (cur.newPerDay !== patch.newPerDay) update.newPerDay = patch.newPerDay;
      }
      ok = true;
      return Object.keys(update).length ? { update } : null;
    });
  } catch (e) {
    logError('vocab:settings', e, PROFILE_PATH);
    return false;
  }
  return ok;
}
