import type { PromptTemplate } from '../types';
import { claudeDrill } from './p6/claudeDrill';

// Neubau – Vorlagen von Paket P6 (Profil, Stand, Einstellungen & Claude); Besitz: P6 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p6/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P6_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [claudeDrill];
