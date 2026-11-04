import { mergeLp3 } from './lp3';

// Englische Texte der Lernplattform 3.0 (getrennt von `lp3.ts`, damit sie mit `en.ts` erst bei Bedarf geladen werden – Großpaket C).
export const lp3En = mergeLp3(import.meta.glob('./parts/lp3/*.en.ts', { eager: true }));
