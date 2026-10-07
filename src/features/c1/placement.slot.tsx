import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { PlacementCard } from './PlacementCard';

// Grammatik-Reiter: Einstiegskarte „Wo stehst du?“ über der Programmkarte (Lernplattform 3.0 P34). Schalter `flags.program`.
registerSlot({ slot: 'grammar.head', order: 5, enabled: () => flags.program, render: () => <PlacementCard /> });
