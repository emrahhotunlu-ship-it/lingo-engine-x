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
  /** Schreibwerkstatt (P47) offen? Das Blatt gehört zu `ClinicHost`, der Zustand liegt hier, damit es nur einen Ort für Blätter dieser Familie gibt. */
  writeOpen: boolean;
  show: (seed?: ClinicSeed) => void;
  close: () => void;
  showProfile: () => void;
  closeProfile: () => void;
  showWrite: () => void;
  closeWrite: () => void;
};

export const useClinicSheet = create<State>((set) => ({
  open: false,
  seed: {},
  profileOpen: false,
  writeOpen: false,
  show: (seed = {}) => set({ open: true, seed }),
  close: () => set({ open: false }),
  showProfile: () => set({ profileOpen: true }),
  closeProfile: () => set({ profileOpen: false }),
  showWrite: () => set({ writeOpen: true }),
  closeWrite: () => set({ writeOpen: false }),
}));

const WEEK_KEY = 'lx:clinic-week';
const MAIL_KEY = 'lx:mail-week';
const CARD_KEY = 'lx:ctx2-card';

type Marker = { week: string | null; mailWeek: string | null; ctx2Card: boolean };
const read = (): Marker => ({ week: local.get(WEEK_KEY), mailWeek: local.get(MAIL_KEY), ctx2Card: local.get(CARD_KEY) === '1' });

export const useClinicMarkers = create<Marker>(() => read());

/** Den Wochenvorschlag für diese Woche abhaken (bedient oder zurückgestellt). */
export function markClinicWeek(day: string): void {
  const week = isoWeek(day);
  local.set(WEEK_KEY, week);
  useClinicMarkers.setState({ week });
}

/** Den Wochenvorschlag der Schreibwerkstatt (Laptop) für diese Woche abhaken. */
export function markMailWeek(day: string): void {
  const mailWeek = isoWeek(day);
  local.set(MAIL_KEY, mailWeek);
  useClinicMarkers.setState({ mailWeek });
}

/** Die Karte „Mein Arbeitsalltag“ nicht mehr zeigen. */
export function markCtx2Card(): void {
  local.set(CARD_KEY, '1');
  useClinicMarkers.setState({ ctx2Card: true });
}
