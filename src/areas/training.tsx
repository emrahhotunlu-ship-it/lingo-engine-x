import { defineArea } from '../app/registry';

// Bereich „Training“ (neue Übungen: Tipp-Drills, Druck-Serie, Posteingang, Nachsprechen) –
// Besitz: Paket P7 (docs/neubau/plan.md §4.8). Einstiege auf den Plätzen `learn` (Training),
// `speak` (Training, Aussprache) und `write` (Posteingang); Routen `nbdrill`, `pressure`, `inbox`,
// `pron` (plan.md §1.6) trägt P7 hier per Deklarations-Zusammenführung ein.

export const training = defineArea({
  id: 'training',
  screens: {},
});
