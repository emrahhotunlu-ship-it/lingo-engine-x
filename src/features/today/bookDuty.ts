import { create } from 'zustand';

// Grammatik-Buch auf „Heute“ (UX-Prüfung 09.11.2026 B1): die Heute-Zeile nennt die Buch-Seite, die der Grammatik-Schritt startet.
// Heute lädt dafür NICHT die Buch-Inhalte (das verzögerte das Tagesbild, gate.spec): der Grammatik-Bereich (src/features/grammar/bookStep.ts,
// beim Start vorgeladen) trägt den nächsten Schritt als einfache Werte hier ein. Bis dahin nennt die Zeile das Thema des Tages wie bisher.

export type BookDuty = { kind: 'page'; ch: number; topic: string; part: 'A' | 'B' | 'C' | 'T' } | { kind: 'exam'; ch: number } | null;

export const useBookDuty = create<{ step: BookDuty }>(() => ({ step: null }));
