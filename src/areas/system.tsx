import { defineArea } from '../app/registry';

// Bereich „System“ – Besitz: WP0 (docs/neubau/architektur.md §2.2). Laden, keine Datenbank,
// offline und Umstellung sind Systemzustände ohne Route (`app/boot.ts` → `useScreen`); sie zeichnet
// der Rahmen selbst. Hier landen später Rahmen-Abschnitte (z. B. Diagnose-Hilfen).

export const system = defineArea({
  id: 'system',
  screens: {},
});
