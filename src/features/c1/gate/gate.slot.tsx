import { flags } from '../../../app/flags';
import { registerSlot } from '../../../app/slots';
import { GateCard } from './GateCard';

// Heute, unter „Extra“: die Karte der Kapitelprüfung (Lernplattform 3.0 P42), nur wenn eine Prüfung bereit ist. Schalter `flags.program`.
registerSlot({ slot: 'today.extra', order: 20, enabled: () => flags.program, render: () => <GateCard /> });
