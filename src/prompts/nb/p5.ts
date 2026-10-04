import type { PromptTemplate } from '../types';
import { goalCheck } from './p5/goalCheck';

// Neubau – Vorlagen von Paket P5 (Sprechen, Business & Preply); Besitz: P5 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p5/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P5_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [goalCheck];
