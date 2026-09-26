import { cardExamples } from './cardExamples';
import { companionChat } from './companionChat';
import { preplyImport } from './preplyImport';
import { preplyPrep } from './preplyPrep';
import { produceCheck } from './produceCheck';
import { translate } from './translate';
import type { ChatTemplate, PromptTemplate } from './types';
import { wordLookup } from './wordLookup';

// Alle Vorlagen an einem Ort. Ein Test prüft eindeutige Kennungen und die Kopfzeile.

export const TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [wordLookup, produceCheck, cardExamples, translate, preplyPrep, preplyImport];

/** Gesprächsvorlagen (Freitext, gestreamt; Phase 5). */
export const CHAT_TEMPLATES: ReadonlyArray<ChatTemplate<never>> = [companionChat];

export const TEMPLATE_ID = /^[a-z0-9-]+$/;
