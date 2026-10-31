import { create } from 'zustand';
import type { Ctx } from '../../domain/learn/types';
import type { DutyId } from '../../domain/plan/types';

// D3 V-UEBUNG (Prüfung learning-scientist): Welche Runde läuft gerade? Der Übungskopf (`ExerciseTop`) meldet
// Pflicht/Extra und den Pflichtblock, die Laptop-Spalte „Heute“ (TodayMini) liest es. Nur Anzeige, nie planwirksam.
export type RunCtx = { ctx: Ctx | 'extra' | null; duty: DutyId | null };

export const useRunCtx = create<RunCtx>(() => ({ ctx: null, duty: null }));
