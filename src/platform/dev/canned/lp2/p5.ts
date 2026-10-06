// Testantworten Lernplattform 2.0, Paket P5 (docs/umbau/lernplattform-2.md §10.0/§10.3). Besitzer: nur dieses Paket.
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

import { registerCannedReply } from '../../fakeSample';
import { grammarItemsReply } from '../../cannedLearn';

/** Meldet die Testantworten von P5 an. */
export function registerLp2P5Replies(): void {
  registerCannedReply('grammar-items', grammarItemsReply);
}
