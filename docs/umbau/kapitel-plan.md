# Plan Kapitel-Arbeiten (Rückmeldung 5) – Stand 11.10.2026, freigegeben („Beides wie empfohlen“, siehe docs/entscheidungen.md)

## Ursachen (architect)
- „Du bist hier“ aus `chapterState().current` (`src/domain/c1/state.ts`, `slotPlan.ts currentChapter`), „Als Nächstes“ aus `introTopic()/rankTopics()` über alle 47 Themen (`LearnHub.tsx:97-104`) → zwei Quellen.
- `flags.slotPlan = false` → Schritt 2 über LP2 `freezeGrammarDay` → `rankTopics(...).slice(0,3)` kapitelunabhängig („wild und quer“).
- Sperre `canIntroduce` (`INTRO_BLOCK_ERRORS = 10`, ein neues Thema je 3 Tage, `path.ts:108-142`), sichtbar `LearnHub.tsx:139-154`.
- `ChapterSheet.tsx` ohne Startknopf; kein Test je Thema (nur `vt` und Kapitelprüfung `domain/c1/gate`).

## Daten (nur ergänzend, u.v/p.v = 1, u.rv = 2)
- `app/c1.ch {n,d}` gewähltes Kapitel; `app/c1.chh [[n,d]]` ≤ 20; `grammar/<thema>.tt {d,c,n,ok,k}` Themen-Test; `app/profile.plan.u.gt.ch`.
- Schemas `looseObject(...).nullish()`, `c1doc.ts FIELDS`, `readGt` liest `ch` 1–7, Rückweg-Test, Seed/datenmodell/entscheidungen.

## Module
- neu `src/domain/c1/cursor.ts`: `effectiveChapter` (einzige Quelle), `chapterCursor` → {topic, phase intro|practice|test|done}.
- `chapterState({chosen})`, `currentChapter(chosen)`, `introStepFor/freezeGrammarDay(chapter)` (Sperre entfällt im Kapitel, ≤ 1 Einführung je Tag, ≤ 3 Themen), `selectRound` Modus `chapter` (≤ 3 Kapitel-Fehlersätze vorn).
- neu `topicTest.ts` (6 Aufgaben, bestanden ab 5, < 4 → „in Vorbereitung“), `write.ts tt`.
- neu `features/c1/chapterRun.ts startChapter` (optimistisch, Rückrollen, einmaliges Neufrieren nur `u.gt/u.ps` solange Schritt 2 unberührt).
- UI: ChapterSheet Hauptknopf + Phasen je Thema, ProgramMap/LearnHub aus Cursor, Heute-Titel „Kapitel n · Thema“, Schalter `chapterRun`, i18n `lp3/k5`.
- Verbraucher auf `effectiveChapter`: weekly3, c1/way, speak/chapterTalk, tutor/WritingStudio.

## Reihenfolge
K0 Entscheidungen/Felder → K1 Cursor → K2 Speichern → K3 Plan+Runde → K4 Themen-Test → K5 Oberfläche → K6 Einheitlichkeit, Prüfer, Test-Link. Zweig `claude/umbau-kapitel`.

## Tests
chapterCursor (inkl. Emrahs Bild, 33 Fehlersätze), Gleichheits-Test über 200 Datenstände/Stichtage, freezeGrammarDay, unitMeta-Rückweg, c1doc, topicTest, Neufrieren-Zähler; E2E `chapterRun.spec.ts`; bestehende Specs umstellen.

## Risiken
Neufrieren ≙ neu gewürfelter Plan (nur Knopf, einmal, Zähler-Test); erste Wahl legt `app/c1` an → C1-Check-Tag (`store.ts:243`, in K0 entscheiden); Fehlerschlange ohne Sperre; Aufgabenvorrat Themen-Test; Altdaten; Wochenfokus/Check-Tag.
Hinweis: `claude/umbau-r3-b` ist laut Reflog vollständig in fokus (5d5def4 → 4ba152c); A4-Zeile „P34–P37 in Arbeit“ ist veraltet.

## Offene Fragen an Emrah
1. Wiederholungen anderer Kapitel im Tag? Empfehlung: ja, ca. 1 von 3 Grammatik-Aufgaben.
2. Themen-Test nicht bestanden? Empfehlung: Übung zu schwachen Stellen, Test am nächsten Tag erneut, Link „Nächstes Thema trotzdem beginnen“, nie gesperrt.
