import { registerSlot } from '../../app/slots';
import { DocForecast } from './DocForecast';

// Einstellungen › Diagnose: Kapazitätsanzeige (Lernplattform 3.0 P29). Nur Lesen.
registerSlot({ slot: 'settings.sections', order: 60, render: () => <DocForecast /> });
