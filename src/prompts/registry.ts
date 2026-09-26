import { cardExamples } from './cardExamples';
import { INPUT_TEMPLATES } from './inputRegistry';
import { produceCheck } from './produceCheck';
import type { PromptTemplate } from './types';
import { wordLookup } from './wordLookup';

// Alle Vorlagen an einem Ort. Ein Test prüft eindeutige Kennungen und die Kopfzeile.

export const TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [wordLookup, produceCheck, cardExamples, ...INPUT_TEMPLATES];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
