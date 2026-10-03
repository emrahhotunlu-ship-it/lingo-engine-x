import type { PromptTemplate } from '../types';
import { P1_TEMPLATES } from './p1';
import { P2_TEMPLATES } from './p2';
import { P3_TEMPLATES } from './p3';
import { P4_TEMPLATES } from './p4';
import { P5_TEMPLATES } from './p5';
import { P6_TEMPLATES } from './p6';
import { P7_TEMPLATES } from './p7';

// Neubau – alle neuen Vorlagen der Pakete P1–P7 (docs/neubau/plan.md §3.2), einmal in
// `src/prompts/registry.ts` eingebunden. Der Registry-Test prüft eindeutige Kennungen und `[id@v]`.

export const NB_TEMPLATES: ReadonlyArray<PromptTemplate<never, unknown>> = [
  ...P1_TEMPLATES,
  ...P2_TEMPLATES,
  ...P3_TEMPLATES,
  ...P4_TEMPLATES,
  ...P5_TEMPLATES,
  ...P6_TEMPLATES,
  ...P7_TEMPLATES,
];
