import type { PromptTemplate } from '../types';
import { alternatives } from './p4/alternatives';
import { textLevel } from './p4/textLevel';
import { unitListen } from './p4/unitListen';

// Neubau – Vorlagen von Paket P4 (Lesen, Hören & Schreibwerkstatt); Besitz: P4 (docs/neubau/plan.md §3.2).
// Neue Vorlagen liegen als eigene Dateien unter `src/prompts/nb/p4/<name>.ts` und werden nur hier
// eingetragen. Bestehende Vorlagen bleiben unverändert; ein Nachfolger bekommt eine neue Kennung.

export const P4_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [unitListen, textLevel, alternatives];
