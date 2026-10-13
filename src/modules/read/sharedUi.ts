// Lesen-Modul (docs/umbau/lesen-plan.md §5): zweite Tür nach außen, nur für die Oberfläche (seit Paket L3).
// Getrennt von shared.ts, damit `registry.ts` (von src/data/paths.ts und src/i18n/de.ts geladen) die Oberfläche und die Übersetzung
// nicht mit hereinzieht (sonst entstünde eine Import-Schleife i18n → registry → i18n). Nur Durchreichen, keine Logik;
// die Erlaubnisliste prüft tests/unit/read/isolation.test.ts.

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
export { Skeleton } from '../../ui/Skeleton';
export { Eyebrow } from '../../ui/Eyebrow';
export { AiRunPanel, isBusy } from '../../ui/AiRunPanel';
export { toast } from '../../ui/Toast';

// KI: Abbruch je Bildschirm, Verfügbarkeit
export { useAiAvailable, useAiScope } from '../../ai/scope';

// Daten: der eine Schreibpfad und träges Lesen einzelner Dokumente (die Sammlung `read` wird nie als Ganzes geladen)
export { getDb } from '../../platform/capabilities';
export { getWriter } from '../../data';
export { readDoc } from '../../data/reads';
export type { ReadDoc } from '../../data/reads';
