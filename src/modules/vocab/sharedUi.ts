// Wörter-Modul V3 (v3-bau.md §5): zweite Tür nach außen, nur für die Oberfläche (Lernkarte, Band, Runde).
// Getrennt von shared.ts, damit `registry.ts` (von src/data/paths.ts und src/i18n geladen) Oberfläche, Texte und Datenzugang nicht mit
// hereinzieht (sonst entstünde eine Import-Schleife i18n → registry → i18n bzw. data/paths → registry → … → data/paths). Darum importiert
// NIE eine Datei, die von registry.ts oder api.ts statisch erreichbar ist, aus sharedUi.ts (tests/unit/vocab/isolation.test.ts hält das fest).
// Nur Durchreichen, keine Logik; die Erlaubnisliste prüft ebenfalls tests/unit/vocab/isolation.test.ts.

// Rahmen: Bereich, Navigation
export type { ScreenProps } from '../../app/registry';
export { useNav } from '../../app/nav';

// Texte
export { useT } from '../../i18n';
export type { MessageKey } from '../../i18n';

// Bausteine der Übungsseite
export { ExerciseShell, SentenceInput } from '../../ui/exercise';
export { PrimaryAction } from '../../ui/ActionBar';
export type { ShellAction, ShellFeedback, ShellSecondary, ShellStatus } from '../../ui/exercise';
export { Button } from '../../ui/Button';
export { Skeleton } from '../../ui/Skeleton';
export { Icon } from '../../ui/Icon';
export { toast } from '../../ui/Toast';
// Übersicht und Einstellungen Wörter (Großpaket A S6): Auswahl als Radiogruppe.
export { Segmented } from '../../ui/Segmented';
export { Switch } from '../../ui/Switch';
// Anki-Modus (S6b-3): Nochmal · Schwer · Gut · Leicht in der Aktionsleiste.
export { GradeButtons } from '../../ui/GradeButtons';

// Lücke, antippbarer Text, Eingabe
export { EnglishText } from '../../engine/EnglishText';
// Einstufungstest (S7c): vier Bedeutungen zur Wahl, ohne Rückmeldung je Wort.
export { Choices } from '../../engine/Choices';
export { KineticGap } from '../../engine/KineticGap';
export type { GapState } from '../../engine/KineticGap';
export { useHiddenInput } from '../../engine/HiddenInput';
export { useHotkeys } from '../../engine/useHotkeys';
export { MicButton } from '../../engine/MicButton';
export { lookupOpenMs } from '../../engine/wordTap';
export { maskOf } from '../../domain/answer/mask';

// Wörterbuch (Auswertung „ist das ein Wort?“, Bedeutung des getippten Worts)
export { dictLookup, isDictWord } from '../../domain/lexicon/dict';
// Wort-Seite (Großpaket A S6): Lautschrift und Vorlesen (Wort und Satz, normal und langsam).
export { ipaOf } from '../../domain/lexicon/pron';
export { speak, stopSpeech, useSpeech } from '../../platform/speech';
// „Satz vor dem Prüfen anhören“ (S6b-3): die Lücke als kurzer Ton.
export { playGapTone, primeGapTone } from '../../platform/sound';
// Uhr der App (alle 30 s, Tageswechsel 04:00): Zeit im Zeichnen nur über sie, nie `Date.now()`.
export { useClock } from '../../app/clock';

// Daten: Live-Ansicht, der eine Schreibpfad, Einzel-Lesen, Browser-Speicher (nur Entwurf und Gerätekennung)
export { useLive } from '../../data/live';
export { getWriter } from '../../data';
export { readDoc } from '../../data/reads';
export { getDb } from '../../platform/capabilities';
export { local } from '../../platform/storage';
