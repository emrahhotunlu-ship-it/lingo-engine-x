import type { FORMATS, INTERESTS } from './types';

// Emrahs Antworten vom 03.10.2026 (CLAUDE.md A7): Startwerte für Themen und Formate des Inputs.
export const DEFAULT_INTERESTS: ReadonlyArray<(typeof INTERESTS)[number]> = ['economy', 'tech', 'business', 'sport', 'science'];
export const DEFAULT_FORMATS: ReadonlyArray<(typeof FORMATS)[number]> = ['video', 'article'];
