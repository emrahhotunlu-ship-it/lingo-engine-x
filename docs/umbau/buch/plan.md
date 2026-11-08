# Großpaket „Buch + Tempo“ (Emrah 08.11.2026)

Emrah: „Bitte alles verbessern? Auch Pace Vokabel learning. Gezielte Grammatik-Übungen wie im Buch, wo man dann auch eine Klausur schreibt.“
Seine Entscheidungen stehen in `docs/entscheidungen.md` (08.11.2026 abends).

## GB2 Wörter-Tempo (gebaut)
- **Kontingent kommt immer:** Die eingestellten neuen Wörter (`app/profile.newPerDay`, bei Emrah 10) kommen an jedem Lerntag (`minNewFor` = Kontingent, `domain/day.ts`).
  - Vorher galt: mindestens 2 bei Rückstand, sonst mindestens 5.
  - Emrah bekam deshalb trotz Einstellung 10 meist nur 2 (Plan vom 08.11.: 7 fällig, 2 neu, 28 verschoben, 10 Minuten).
- **Mehr Zeit für Wörter:** 60 % der Tageszeit statt 40 % (`WORDS_SHARE`).
  - Tagesziel neu mit 35 und 45 Minuten.
  - Emrah wählte „A: Tagesziel 35 Minuten“: 21 Min. Wörter, 9 Grammatik, 5 Anwenden. Er stellt es selbst ein unter Einstellungen › Lernen › Tagesziel.
- **„Noch 5 neue Wörter“:** Extra-Runde `new5`, nur neue Wörter, über das Kontingent hinaus. Erreichbar auf der Wörter-Startseite und im Abschluss der Runde. Fehlen Kandidaten, füllt die Runde bis 5 nach.
- **Standard** für neue Profile: `newPerDay` 10.
- **Simulation** (60 Tage, 400 Kunstwörter, `scripts/vocab/sim-core.ts`):

  | Einstellung | neue Wörter | behalten | überfällig am Ende | Pflicht im Mittel |
  |---|---|---|---|---|
  | 5 neue, 15 Min. (Wächter im Test) | 300 | 81,7 % | 3 | 12,2 Min. |
  | 10 neue, 15 Min. | 400 | 66,5 % | 12 | 14,7 Min. → **zu wenig Zeit** |
  | **10 neue, 21 Min. (Emrah, Tagesziel 35)** | 400 (Liste nach 40 Tagen leer) | 79,1 % | 0 | 19,2 Min. |
  | 10 neue, 25 Min. | 400 | 82,2 % | 0 | 19,4 Min. |

  Das etwas geringere Behalten bei 10 neuen ist erwartbar (mehr junge Wörter in den Abfragen). Ohne die längere Zeit wäre es nicht tragbar; deshalb die Rückfrage an Emrah.

## GB1 Inhalte Buch
Vorgabe: `inhalte-spec.md`. Je Thema 6 × A (Lücke) und 6 × B (Auswahl), mit `why.ok`/`why.wrong` (die Fehler-Karte nutzt `why.wrong` ohne Claude). Schreiber je Kapitel, danach Lehrer-Gegenlesung.

## GB3 Grammatik-Buch
- **Buch-Seite** (Reiter Grammatik): 7 Kapitel → Lektionen (= Themen).
  - Je Lektion die Seiten Regel, Übung A, B, C und Lektionstest, mit Haken und Ergebnis.
  - Kapitel-Klausur am Ende, mit Note.
- **Übung A/B:** neue Inhalte. **Übung C:** vorhandene Umformungen (kwt) und „Fehler finden“ (find). Je Übung 6–8 Aufgaben, mit Hilfe und Fehler-Karte.
- **Lektionstest:** 8 Aufgaben aus A, B, C (andere als in den Übungen, wo möglich), ohne Hilfe. Bestanden ab 6 von 8.
- **Klausur:**
  - 20 Aufgaben aus allen Lektionen des Kapitels, ohne Hilfe und ohne Claude.
  - Note 1–6 nach Prozent: 1 ≥ 92 %, 2 ≥ 81 %, 3 ≥ 70 %, 4 ≥ 55 %, 5 ≥ 30 %, sonst 6. Bestanden ab Note 3.
  - Danach jeder Fehler mit Erklärung; schwache Lektionen werden zum Nachüben markiert.
- **Tagesvorschlag:** Der Grammatik-Schritt des Tages nennt die nächste offene Buch-Seite. Fehler-Wiederholung läuft weiter.
- **Daten:** am Themen-Dokument `grammar/<thema>` das Feld `bk` (Ergebnis je Seite); Klausuren in `grammar/_book` (ein Dokument, Ergebnisse je Kapitel). data-guard prüft vor dem Bau.

## GB4
- Fehler-Karte bei Wörtern.
- Schlüsselwort-Umformungen erst nach Einführung und seltener.
