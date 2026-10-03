import type { PromptTemplate } from '../types';

// Neubau – Vorlagen von Paket P1 (Heute, Tageseinheit & Wochenthema); Besitz: P1 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p1/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P1_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [];
