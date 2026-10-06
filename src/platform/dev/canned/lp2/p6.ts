// Testantworten Lernplattform 2.0, Paket P6 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { cardExamplesReply } from '../../cannedReplies';

/** Meldet die Testantworten von P6 an. */
export function registerLp2P6Replies(): void {
  registerCannedReply('card-examples', cardExamplesReply);
}
