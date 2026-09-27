import { create } from 'zustand';

// Einstellungen öffnen (UX-Beratung Nr. 2/11): das Zahnrad sitzt auf „Stand", das Blatt selbst
// hängt am App-Rahmen. Ein kleiner Zustand statt einer Eigenschaft durch alle Bildschirme.

export const useSettingsSheet = create<{ open: boolean }>(() => ({ open: false }));

export const openSettings = (): void => useSettingsSheet.setState({ open: true });
export const closeSettings = (): void => useSettingsSheet.setState({ open: false });
