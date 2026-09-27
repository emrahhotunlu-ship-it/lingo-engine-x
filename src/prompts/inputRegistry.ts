import { applyCheck } from './applyCheck';
import { listeningText } from './listeningText';
import { readingCheck } from './readingCheck';
import { readingText } from './readingText';
import type { PromptTemplate } from './types';
import { writingPrompt } from './writingPrompt';
import { writingReview } from './writingReview';

// Vorlagen von Phase 4 (Lesen, Hören, Schreiben, Entdecken), in registry.ts eingebunden.

export const INPUT_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [readingText, listeningText, writingPrompt, writingReview, readingCheck, applyCheck];
