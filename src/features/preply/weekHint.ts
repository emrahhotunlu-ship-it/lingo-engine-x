import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { hintFor, weekHintOp } from '../../domain/week/hint';
import type { WeekHint } from '../../domain/week/types';
import { logError } from '../../platform/diagnostics';

// Vorrang beim Wochenthema (Neubau N17): Nach dem Speichern eines Termins bzw. einer
// Preply-Vorbereitung das erkannte Thema als `app/week.hint` vermerken – feldweise per
// `writer.transform`, nur bei gültigem Dokument (data-guard 00:35). Fehler blockieren nie das
// eigentliche Speichern; sie landen in der Diagnose.

export async function noteWeekHint(src: WeekHint['src'], text: string, day: string): Promise<boolean> {
  const hint = hintFor(src, text, day);
  const writer = getWriter();
  if (!hint || !writer) return false;
  try {
    await writer.transform('app/week', (cur) => weekHintOp(cur, cur ? validateDoc('app/week', cur).ok : true, hint));
    return true;
  } catch (err) {
    logError('week:hint', err, 'app/week');
    return false;
  }
}
