import { installAreas, type AreaDef } from '../app/registry';
import { heute } from './heute';
import { lernen } from './lernen';
import { lesen } from './lesen';
import { profil } from './profil';
import { sprechen } from './sprechen';
import { system } from './system';
import { training } from './training';
import { wortschatz } from './wortschatz';

// Alle Bereiche des App-Rahmens (docs/neubau/architektur.md §2.2). Die Reihenfolge bestimmt die
// Reihenfolge gleichrangiger Abschnitte und Einstiege. Beim Laden dieses Moduls einmal angemeldet.

export const AREAS: readonly AreaDef[] = [system, heute, lernen, wortschatz, lesen, sprechen, profil, training];

installAreas(AREAS);
