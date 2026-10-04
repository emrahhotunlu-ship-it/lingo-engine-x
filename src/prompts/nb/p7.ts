import type { PromptTemplate } from '../types';
import { pressureCheck } from './p7/pressureCheck';

// Neubau – Vorlagen von Paket P7 (Neue Übungen & Inhalte); Besitz: P7 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p7/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P7_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  pressureCheck,
];
