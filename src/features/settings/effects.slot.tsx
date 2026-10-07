import { registerSlot } from '../../app/slots';
import { EffectsSection } from './EffectsSection';

// Einstellungen: Abschnitt „Effekte“ (Lernplattform 3.0 P30).
registerSlot({ slot: 'settings.sections', order: 40, render: () => <EffectsSection /> });
