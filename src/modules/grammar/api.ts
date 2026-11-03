import { z } from 'zod';
import { getWriter } from '../../data';
import { logError, logWarn } from '../../platform/diagnostics';

// Großpaket G (Entscheidung 3, 02.11.2026): neue Grammatik hinter dem Schalter `app/profile.gcfg.mod`, wie die Wörter-App.
// Fehlt `gcfg`, ist die neue Grammatik AN (Test-Link gleich an); `mod = 0` ist der Rückweg auf den alten Weg (gilt auf allen Geräten).

type Doc = Readonly<Record<string, unknown>>;

/** `app/profile.gcfg`: `mod` = Schalter neue Grammatik (1 an, 0 alter Weg). Tolerant (data-guard G8): spätere Zusatzfelder machen den Schalter nicht ungültig. */
export const gcfgSchema = z.looseObject({ mod: z.union([z.literal(0), z.literal(1)]) });

/** Ist die neue Grammatik eingeschaltet? Nur ein gültiges `gcfg.mod = 0` schaltet sie aus. */
export function grammarModuleOn(profile: Doc | null | undefined): boolean {
  const raw = profile?.gcfg;
  if (raw === undefined || raw === null) return true;
  const g = gcfgSchema.safeParse(raw);
  return !g.success || g.data.mod === 1;
}

/** Schalter setzen (Einstellungen): ein `transform` auf dem frischen Profil, nur `gcfg`; ein ungültiges `gcfg` wird nie still überschrieben. */
export async function setGrammarModule(mod: 0 | 1): Promise<boolean> {
  const writer = getWriter();
  if (!writer) return false;
  let ok = false;
  try {
    await writer.transform('app/profile', (cur) => {
      if (!cur) return null;
      const had = cur.gcfg !== undefined && cur.gcfg !== null;
      const base = had ? gcfgSchema.safeParse(cur.gcfg) : null;
      if (base && !base.success) return null;
      ok = true;
      if (base?.success && base.data.mod === mod) return null;
      return { update: { gcfg: gcfgSchema.parse({ ...(base?.success ? base.data : {}), mod }) } };
    });
  } catch (err) {
    logError('grammar:switch', err, `mod ${mod}`);
    return false;
  }
  if (!ok) logWarn('grammar:switch', { message: 'Schalter nicht gesetzt' }, `app/profile fehlt oder gcfg ungültig (mod ${mod})`);
  return ok;
}
