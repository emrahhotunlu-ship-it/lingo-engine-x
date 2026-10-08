import { create } from 'zustand';

// Welche Kapitelprüfung ist gerade offen? Das Blatt hängt in der Shell (`GateHost`), nicht an der Karte: Nach dem Speichern verschwindet die Karte
// (das Kapitel gilt als bestanden), das Ergebnis muss aber stehen bleiben.

type State = { chapter: number | null; open: (n: number) => void; close: () => void };

export const useGateSheet = create<State>((set) => ({ chapter: null, open: (n) => set({ chapter: n }), close: () => set({ chapter: null }) }));
