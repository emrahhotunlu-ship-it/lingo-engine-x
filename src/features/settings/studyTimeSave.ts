import { getWriter } from '../../data';
import { validateDoc } from '../../data/validate';
import { jsonEqual } from '../../domain/equal';
import type { Ii } from '../../domain/studytime';
import { logWarn } from '../../platform/diagnostics';

// Lernzeit speichern (Lernplattform 3.0 P53): genau das Feld `app/profile.ii`, über `writer.transform` auf dem frischen Stand, nur bei Änderung,
// nie in ein ungültiges Profil und nie ein neues Profil. `null` entfernt die Lernzeit (das Feld wird `null`, alle anderen Felder bleiben).

export type SaveIiResult = 'saved' | 'unchanged' | 'unavailable' | 'blocked' | 'failed';

export async function saveIi(next: Ii | null): Promise<SaveIiResult> {
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
      if (jsonEqual(cur.ii ?? null, next)) return null;
      result = 'saved';
      return { update: { ii: next } };
    });
    return result;
  } catch (err) {
    logWarn('settings:studytime', err, 'app/profile');
    return 'failed';
  }
}
