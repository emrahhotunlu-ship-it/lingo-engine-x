// Lesen-Modul (docs/umbau/lesen-plan.md §5): zweite Tür nach außen, nur für die Oberfläche (Pakete L3 und L4).
// Getrennt von shared.ts, damit `registry.ts` (von src/data/paths.ts und src/i18n/de.ts geladen) die Oberfläche, die Übersetzung und
// alles, was selbst wieder an src/data/paths hängt (Nachschlage-Store, Datenzugang), nicht mit hereinzieht (sonst entstünde eine
// Import-Schleife i18n → registry → i18n bzw. data/paths → registry → shared → data/paths). Darum importiert NIE eine Datei, die von
// registry.ts erreichbar ist, aus sharedUi.ts (tests/unit/read/isolation.test.ts hält das fest). Nur Durchreichen, keine Logik;
// die Erlaubnisliste prüft ebenfalls tests/unit/read/isolation.test.ts.

// Rahmen: Bereich anmelden, Navigation
export { defineArea } from '../../app/registry';
export type { ScreenProps } from '../../app/registry';
export { useNav } from '../../app/nav';

// Texte
export { useT } from '../../i18n';
export type { MessageKey } from '../../i18n';

// Bausteine
export { Button, IconButton } from '../../ui/Button';
export { HeroCard } from '../../ui/HeroCard';
export { Icon } from '../../ui/Icon';
export { Row, RowList } from '../../ui/RowList';
export { Segmented } from '../../ui/Segmented';
export { Skeleton } from '../../ui/Skeleton';
export { Eyebrow } from '../../ui/Eyebrow';
export { Disclosure } from '../../ui/Disclosure';
export { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
export { toast } from '../../ui/Toast';

// Antippbarer Text, Nachschlage-Fenster und Sprachausgabe
export { EnglishText } from '../../engine/EnglishText';
export { KineticGap } from '../../engine/KineticGap';
export { lookupOpenMs } from '../../engine/wordTap';
export { SpeakButton } from '../../engine/SpeakButton';
export { speak, stopSpeech, unlockSpeech } from '../../platform/speech';

// Karten aus Wörtern (Dublettenregel und Dokument-Wächter stecken in saveLookupCard)
export { saveLookupCard } from '../../features/lookup/store';
// Kartenqualität (26.10.2026): Wortgruppen nur als feste Einheit speichern (Prüfung und, wenn nötig, Claude)
export { checkCardUnit } from '../../features/lookup/store';
export type { SingleOption, UnitDecision } from '../../features/lookup/store';

// KI: Abbruch je Bildschirm, Verfügbarkeit
export { useAiAvailable, useAiScope } from '../../ai/scope';

// Daten: der eine Schreibpfad und träges Lesen einzelner Dokumente (die Sammlung `read` wird nie als Ganzes geladen)
export { getDb, waitForDb } from '../../platform/capabilities';
export { getWriter } from '../../data';
export { createWriter } from '../../data/writer';
export { readDoc } from '../../data/reads';
export type { ReadDoc } from '../../data/reads';
