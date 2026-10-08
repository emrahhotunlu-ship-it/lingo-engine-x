import { claimMilestones, isMilestoneCard, pickMilestone, type Milestone } from '../../domain/plan/dayStats';
import { recordProfileFields } from '../progress/persist';

// Meilenstein beanspruchen (Lernplattform 3.0 P42, Motivation §4.2): Lesen, Prüfen und Schreiben von `app/profile.ms` in EINEM Schritt auf dem frischen
// Stand (`recordProfileFields`). Nur das Gerät, das den Eintrag wirklich anlegt, zeigt die Karte; ein zweites Gerät oder ein zweiter Tab findet ihn schon
// vor und zeigt nichts („einmal über alle Geräte“). Höchstens eine Karte je Sitzung (Modul-Merker = diese Browsersitzung).

let cardShown = false;

/** Nur für Tests. */
export function resetMilestoneSessionForTests(): void {
  cardShown = false;
}

/** Hat diese Sitzung schon eine Meilenstein-Karte gezeigt? */
export const milestoneCardShown = (): boolean => cardShown;

/**
 * Meilenstein anfordern. Liefert den Meilenstein, den dieses Gerät jetzt zeigen darf, sonst `null` (Budget erschöpft, nichts Neues, anderes Gerät war
 * schneller oder Schreiben nicht möglich). Gleichzeitig erreichte weitere Meilensteine werden still gemerkt.
 * `migrate: false` für Teilaufrufe (nur einzelne Kandidaten): die Umstellung auf `festUnits` bleibt dem vollen Aufruf von Heute vorbehalten.
 * `onFail` meldet ein gescheitertes Schreiben (der Aufrufer darf es später erneut versuchen).
 */
export async function claimMilestone(
  candidates: readonly Milestone[],
  seen: Readonly<Record<string, unknown>> | null | undefined,
  today: string,
  opts: { migrate?: boolean; onFail?: () => void } = {},
): Promise<Milestone | null> {
  const pick = pickMilestone({ candidates, seen, today, cardShown, migrate: opts.migrate });
  if (!pick.show && pick.quiet.length === 0 && !pick.migrate) return null;
  const got: { show: Milestone | null } = { show: null };
  const ok = await recordProfileFields('today:milestone', (cur) => {
    const r = claimMilestones(cur, pick, today);
    got.show = r.show;
    return r.patch;
  });
  if (!ok) opts.onFail?.();
  if (!ok || !got.show) return null;
  if (isMilestoneCard(got.show.id)) cardShown = true;
  return got.show;
}
