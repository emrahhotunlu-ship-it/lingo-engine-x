import { defineArea } from '../app/registry';
import { resumeRowFor } from '../app/shell/ResumeRow';

// Bereich „System“ – Besitz: WP0 (docs/neubau/architektur.md §2.2). Laden, keine Datenbank,
// offline und Umstellung sind Systemzustände ohne Route (`app/boot.ts` → `useScreen`); sie zeichnet
// der Rahmen selbst. Hier hängen Rahmen-Abschnitte: die Zeile „Weitermachen: …“ (WP0b, plan.md §0)
// auf Heute und an jedem Herkunftsplatz (sie zeigt sich nur, wenn eine Übung von dort offen ist).

export const system = defineArea({
  id: 'system',
  screens: {},
  sections: [
    { id: 'resume-today', place: 'today', order: 5, component: resumeRowFor('today') },
    { id: 'resume-vocab', place: 'vocab', order: 1, component: resumeRowFor('vocab') },
    { id: 'resume-learn', place: 'learn', order: 1, component: resumeRowFor('learn') },
    { id: 'resume-read', place: 'read', order: 1, component: resumeRowFor('read') },
    { id: 'resume-speak', place: 'speak', order: 1, component: resumeRowFor('speak') },
    { id: 'resume-write', place: 'write', order: 1, component: resumeRowFor('write') },
  ],
});
