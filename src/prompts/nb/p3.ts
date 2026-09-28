import type { PromptTemplate } from '../types';

// Neubau – Vorlagen von Paket P3 (Wortschatz & Anki); Besitz: P3 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p3/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P3_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [];
