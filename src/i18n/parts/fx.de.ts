// Lernplattform 2.0 (docs/umbau/lernplattform-2.md §10.0): Texte mit Präfix `fx`, de. Besitzer siehe §10.3. Drei Teile (fxo: Satzbau/Check, fxl: Hören/Kombi/Trainings, fxr: Fehler korrigieren).
import { fxlDe } from './fxl.de';
import { fxoDe } from './fxo.de';
import { fxrDe } from './fxr.de';

export const fxDe = { ...fxoDe, ...fxlDe, ...fxrDe } as const;
