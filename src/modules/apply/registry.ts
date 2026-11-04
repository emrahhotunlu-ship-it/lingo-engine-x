import { axDe } from './i18n/ax.de';
import { axEn } from './i18n/ax.en';

// Modul Anwenden (F3, docs/umbau/fokus2/anwenden-plan.md), Tür 2: was der Rest der App früh braucht. Leicht und rein (wird von den Texten und von Heute
// geladen): die Oberflächentexte (Präfix `ax`), die Disziplin des Tages (beim Einfrieren des Plans) und der Zähler erledigter Anwenden-Tage.
// Die Vorlagen stehen in src/prompts (Register src/prompts/registry.ts), die Bildschirme hinter modules/apply/index.

export const applyMessages = { de: axDe, en: axEn } as const;

export { APPLY_KINDS, applyCountPatch, applyOfCount, applyOfDay, isApplyKind, isShortDayOf, readApplyCount } from './domain/count';
export type { ApplyKind, WriteKind } from './domain/count';
