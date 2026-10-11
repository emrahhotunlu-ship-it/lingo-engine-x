import { useMemo } from 'react';
import { flags } from '../../../app/flags';
import { useClock } from '../../../app/clock';
import { useLive } from '../../../data/live';
import { programStartedOf, readC1 } from '../../../domain/c1/c1doc';
import { checkOffered } from '../../../domain/c1/check/day';
import { formFor } from '../../../domain/c1/check/select';
import { useInputProfile } from '../../../platform/input';

// Stand des C1-Checks für die Extra-Karte auf Heute (Lernplattform 3.0 P40): reine Ableitung aus `app/c1`, Tag und Gerät. Nichts wird gespeichert.
// Der Check-Tag selbst (Plan `u.c1`) läuft über den Tagesablauf (`features/unit/run.ts` → Schritt `c1check`), nicht über diese Karte.

export type CheckCard = { touch: boolean } | null;

export function useCheckCard(): CheckCard {
  const today = useClock((s) => s.today);
  const c1Raw = useLive((s) => s.docs['app/c1']);
  const profile = useInputProfile();
  return useMemo(() => {
    // Nur die Kapitelwahl (`ch`) startet das Programm nicht (Kapitel-Arbeiten K0): kein Check-Angebot allein deswegen.
    if (!flags.c1check || !c1Raw || !programStartedOf(c1Raw)) return null;
    const checks = readC1(c1Raw).checks;
    const touch = profile === 'touch';
    const offered = checkOffered({ day: today, programStarted: true, checks, formAvailable: formFor(touch ? 'touch' : 'desk', checks) !== null });
    return offered ? { touch } : null;
  }, [c1Raw, today, profile]);
}
