import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { PlacementCard } from './PlacementCard';

// Grammatik-Reiter: Einstiegskarte „Wo stehst du?“ (Lernplattform 3.0 P34) unter der Reise und der Fehlersätze-Zeile (UX-Prüfung B2: die Reise ist
// der Kopf, die Einladung ist ein Angebot ohne Hauptknopf). Schalter `flags.program`.
registerSlot({ slot: 'grammar.foot', order: 5, enabled: () => flags.program, render: () => <PlacementCard /> });
