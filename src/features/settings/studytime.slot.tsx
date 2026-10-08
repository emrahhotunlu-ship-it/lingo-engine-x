import { registerSlot } from '../../app/slots';
import { StudyTime } from './StudyTime';

// Einstellungen › Lernen: Abschnitt „Deine Lernzeit“ mit der Anleitung „Erinnerung im iPhone einrichten“ (Lernplattform 3.0 P53).
registerSlot({ slot: 'settings.learn', order: 10, render: () => <StudyTime /> });
