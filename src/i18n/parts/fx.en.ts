// Lernplattform 2.0 (docs/umbau/lernplattform-2.md §10.0): Texte mit Präfix `fx`, en. Besitzer siehe §10.3. Drei Teile (fxo: Satzbau/Check, fxl: Hören/Kombi/Trainings, fxr: Fehler korrigieren).
import { fxlEn } from './fxl.en';
import { fxoEn } from './fxo.en';
import { fxrEn } from './fxr.en';

export const fxEn = { ...fxoEn, ...fxlEn, ...fxrEn } as const;
