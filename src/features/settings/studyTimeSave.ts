import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { cleanIi, iiOp, type Ii } from '../../domain/studytime';
import { logWarn } from '../../platform/diagnostics';

// Lernzeit speichern (Lernplattform 3.0 P53): genau das Feld `app/profile.ii` (nur als `cleanIi`-Ergebnis, `iiOp`), über `writer.transform` auf dem frischen Stand, nur bei Änderung,
// nie in ein ungültiges Profil und nie ein neues Profil. `null` entfernt die Lernzeit (das Feld wird `null`, alle anderen Felder bleiben).

export type SaveIiResult = 'saved' | 'unchanged' | 'unavailable' | 'blocked' | 'failed';

export async function saveIi(next: Ii | null): Promise<SaveIiResult> {
  if (next && !cleanIi(next.t, next.cue)) return 'blocked';
  const writer = getWriter();
  if (!writer) return 'unavailable';
  let result: SaveIiResult = 'unchanged';
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur) {
        result = 'blocked';
        return null;
      }
      if (!validateDoc('app/profile', cur).ok) {
        logWarn('settings:studytime', { code: 'invalid_document', message: 'Profil ungültig – Lernzeit nicht gespeichert' }, 'app/profile');
        result = 'blocked';
        return null;
      }
      const op = iiOp(cur, next);
      if (!op) return null;
      result = 'saved';
      return op;
    });
    return result;
  } catch (err) {
    logWarn('settings:studytime', err, 'app/profile');
    return 'failed';
  }
}
