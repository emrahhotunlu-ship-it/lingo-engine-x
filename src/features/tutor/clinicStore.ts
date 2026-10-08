import { create } from 'zustand';
import { isoWeek } from '../../domain/date';
import { local } from '../../platform/storage';

// Zustand der Satz-Klinik und des Berufsprofils (Lernplattform 3.0 P46): welches Blatt ist offen? Die Blätter hängen in der Shell (`ClinicHost`),
// nicht an der Kachel oder der Karte: Beides (Anwenden-Kachel, Wochenkarte auf Heute, Einstellungen) öffnet dasselbe Blatt.
// Außerdem zwei Merker nur für dieses Gerät (Bequemlichkeit, kein Lernstand): die Woche, in der der Vorschlag bedient oder zurückgestellt wurde, und
// ob die Karte „Mein Arbeitsalltag“ schon einmal gezeigt wurde.

export type ClinicSeed = {
  sentence?: string;
  purpose?: string;
  /** Der Satz stammt aus einer Übersetzung: zählt nicht für den Genauigkeitswert (K7). */
  translated?: boolean;
};

type State = {
  open: boolean;
  seed: ClinicSeed;
  profileOpen: boolean;
  show: (seed?: ClinicSeed) => void;
  close: () => void;
  showProfile: () => void;
  closeProfile: () => void;
};

export const useClinicSheet = create<State>((set) => ({
  open: false,
  seed: {},
  profileOpen: false,
  show: (seed = {}) => set({ open: true, seed }),
  close: () => set({ open: false }),
  showProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
}));

const WEEK_KEY = 'lx:clinic-week';
const CARD_KEY = 'lx:ctx2-card';

type Marker = { week: string | null; ctx2Card: boolean };
const read = (): Marker => ({ week: local.get(WEEK_KEY), ctx2Card: local.get(CARD_KEY) === '1' });

export const useClinicMarkers = create<Marker>(() => read());

/** Den Wochenvorschlag für diese Woche abhaken (bedient oder zurückgestellt). */
export function markClinicWeek(day: string): void {
  const week = isoWeek(day);
  local.set(WEEK_KEY, week);
  useClinicMarkers.setState({ week });
}

/** Die Karte „Mein Arbeitsalltag“ nicht mehr zeigen. */
export function markCtx2Card(): void {
  local.set(CARD_KEY, '1');
  useClinicMarkers.setState({ ctx2Card: true });
}
