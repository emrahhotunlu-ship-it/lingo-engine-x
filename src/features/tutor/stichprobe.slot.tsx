import { registerSlot } from '../../app/slots';
import { StichprobeSection } from './StichprobeSection';

// Einstellungen: Abschnitt „KI-Stichprobe“ (Lernplattform 3.0 P25).
registerSlot({ slot: 'settings.sections', order: 50, render: () => <StichprobeSection /> });
