# Bestandsliste Lesen (`src/modules/read`), Stand 04.11.2026

Das Lesen ist schon weitgehend ein eigenes Modul: Türen `index.ts`/`registry.ts` nach außen, `shared.ts`/`sharedUi.ts` nach innen, abgesichert durch ESLint und `tests/unit/read/isolation.test.ts`. **Größte Lücke:** Wörter laufen über den alten Kartenweg (`features/lookup/store.ts` `checkCardUnit`/`saveLookupCard`, `vocab/<id>` mit `src:'read'`), nicht über `modules/vocab/api.ts` (kein `addLexeme`, keine Belege „gesehen/benutzt“).

## Funktionen und Einstiege
- Routen `read`, `readArticle`, `readCourse`, `readLesson` (`modules/read/index.ts:30-36`); Seite unter Praxis (`areas/index.ts:20`, `areas/praxis.tsx:21` `hub-read`); Extra-Kachel Heute (`features/today/ExtraRow.tsx:130-139`).
- Startseite (`ui/ReadHome.tsx`, `ui/useReadHome.ts`): Heute-Liste, „Weiterlesen / Artikel holen“, Lauf-Fortschritt/Fehler, Themen-Chips, eigene Themen, „Claude schlägt vor“ (`suggest.ts`), Artikel je Tag, frühere Artikel, Kurskarte.
- Tagesartikel der Routine: `store.ts:123 loadHome`, `:142 loadRoutine` (`read/r-<heute>` + 2 Tage), `domain/routine.ts` (`parseRoutineDoc`, `mergeRoutine`).
- Selbst erzeugen: `run.ts` (`claimDay` → `domain/generate.ts` → `saveArticle`), Prompts `prompt.ts`, Prüfung `domain/accept.ts`.
- Leser: `ui/reader/*` (Ansichten a/b/c, Satzzeilen, Sprachausgabe, Lesezeit, Lesestand `saveReadState`, Verständnisfragen `CheckCard.tsx`, Schlüsselwörter → Karte `KeyWordsCard.tsx:43-100`, Wort-Antippen über das globale Popover `features/lookup/LookupPopover.tsx:244`).
- Kurse: Katalog `domain/courses.ts` (8 Kurse, aktiv nur K1, K5), Kursseite `ui/CoursePage.tsx`, Lektion `ui/LessonScreen.tsx`/`LessonParts.tsx` (Ziel, Aufwärmen, Text, Tipp, 3 Fragen, Anwenden mit Claude-Prüfung `applyCheck.ts`, Wendungen), Fortschritt `domain/lessonProgress.ts`, `courseStore.ts`.

## Daten (`domain/paths.ts`)
`read/p` Einstellungen · `read/d-<Tag>` eigene Artikel · `read/m-<Monat>` Index + Lesestand · `read/r-<Tag>` Routine (App liest nur) · `read/c-k<n>-<nn>` Lektionen (Routine) · `read/cp` Kursfortschritt. Alte `articles/`, `reading/`, `feed/` nur lesend (`READ_ONLY_COLLECTIONS`). Sammlung wird nie ganz geladen.

## Offen laut Doku, nicht im Code
- Kurse K2–K4, K6–K8 (nur Katalog, `active:false`).
- Fehlender Monatsindex wird nicht repariert (`store.ts:91` loggt nur).
- 250-Dokumente-Warnung und „Aufräumen mit Zustimmung“ (`domain/retention.ts` ungenutzt).
- Feld `talk`/Grammatikthemen im Artikel-Prompt.
- „Übersetzung falsch melden“ (`st.rep` nur im Schema).

## Tests
Unit `tests/unit/read/*` (22 Dateien), E2E `lesen`, `lesenKurse`, `lesenReader`, `miniLesson`, `readHarness/`.
