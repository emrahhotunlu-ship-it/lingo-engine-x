// Lesen-Modul, zweite Tür nach außen (Paket L4): die SCHWEREN Importe der Oberfläche (antippbarer Text, Nachschlagen, Sprachausgabe, Karten,
// Bausteine). Getrennt von shared.ts, weil registry.ts → prompt.ts → shared.ts schon beim Laden von src/data/paths ausgewertet wird:
// Alles, was selbst wieder an src/data/paths hängt (Nachschlage-Store, Datenzugang), würde dort einen Importkreis schließen.
// Darum importiert NIE eine Datei, die von registry.ts erreichbar ist, aus sharedUi.ts (tests/unit/read/isolation.test.ts hält das fest).
// Nur Durchreichen, keine Logik; Erlaubnisliste wie shared.ts (docs/umbau/lesen-plan.md §5.2).

// Antippbarer Text, Nachschlage-Fenster und Sprachausgabe
export { EnglishText } from '../../engine/EnglishText';
export { lookupOpenMs } from '../../engine/wordTap';
export { SpeakButton } from '../../engine/SpeakButton';
export { speak, stopSpeech, unlockSpeech } from '../../platform/speech';

// Oberfläche und Sprache
export { useT } from '../../i18n';
export { Button, IconButton } from '../../ui/Button';
export { Segmented } from '../../ui/Segmented';
export { Skeleton } from '../../ui/Skeleton';
export { Icon } from '../../ui/Icon';

// Karten aus Wörtern (Dublettenregel und Dokument-Wächter stecken in saveLookupCard)
export { saveLookupCard } from '../../features/lookup/store';

// Datenbank-Fähigkeit und der eine Schreibpfad (zum Lesen einzelner Dokumente und zum Schreiben auf Handlung)
export { getDb, waitForDb } from '../../platform/capabilities';
export { createWriter } from '../../data/writer';
