import { flags } from '../../app/flags';
import { registerSlot } from '../../app/slots';
import { WayHead } from './WayToC1';

// Fortschritt: Kopfzeile „Weg zu C1“ unter der Kopfkarte (Lernplattform 3.0 P45). Öffnet das Blatt mit K1–K7, Urteil und Prognose. Schalter `flags.way`.
registerSlot({ slot: 'progress.head', order: 10, enabled: () => flags.way, render: () => <WayHead /> });
