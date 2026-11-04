import { installAreas, type AreaDef } from '../app/registry';
import { readArea } from '../modules/read/index';
import { applyArea } from '../modules/apply/index';
import { anwenden } from './anwenden';
import { heute } from './heute';
import { lernen } from './lernen';
import { praxis } from './praxis';
import { profil } from './profil';
import { sprechen } from './sprechen';
import { system } from './system';
import { training } from './training';
import { wortschatz } from './wortschatz';

// Alle Bereiche des App-Rahmens (docs/neubau/architektur.md §2.2). Die Reihenfolge bestimmt die
// Reihenfolge gleichrangiger Abschnitte und Einstiege. Beim Laden dieses Moduls einmal angemeldet.

/**
 * Relaunch Stufe 1, P2 S1-SHELL (stufe1-plan.md §6.3): Lesen ist kein eigener Reiter mehr, sondern eine Seite unter „Praxis“.
 * Nur die Zuordnung ändert sich (Ebene `page` mit Rahmen-Kopf „‹ Praxis“); das Modul `src/modules/read` bleibt unverändert.
 */
const lesen: AreaDef = { ...readArea, screens: { ...readArea.screens, read: { ...readArea.screens.read, kind: 'page', chrome: 'shell' } } };

// Anwenden (F3): das Modul src/modules/apply bringt seine Schreibübung `applyTask` mit; die Seite `apply` und Schritt 3 meldet weiter `anwenden` an.
export const AREAS: readonly AreaDef[] = [system, heute, lernen, anwenden, applyArea, praxis, wortschatz, lesen, sprechen, profil, training];

installAreas(AREAS);
