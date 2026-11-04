# Plan Fokus 2.0 (04.11.2026 spät) – nur Wörter, Grammatik, Anwenden, Fehler korrigieren

Auftrag: Emrah 04.11.2026 (Wortlaut in `docs/entscheidungen.md` „Fokus 2.0“). Ersetzt `docs/umbau/module/plan.md` (Praxis/Lesen als Module); dessen Teile M0 (Belege) und K (Kommentare) gehen hier auf, Lesen-Kurse und Praxis-Hub entfallen. Leitsatz: **weniger, dafür deutlich besser.**

## Was Emrah danach sieht
- Vier Reiter wie heute: **Heute · Wörter · Grammatik · Fortschritt** (+ Einstellungen). Kein Praxis-/Lesen-/Sprechen-Bereich mehr.
- **Heute = Tagesplan in drei Schritten:** 1 Wörter · 2 Grammatik (mit „Fehler korrigieren“: deine eigenen Fehler aus Anwenden kommen als Fehlersätze zurück) · 3 **Anwenden** (eine Disziplin am Tag, ca. 10 Min.). Freiwillig darunter nur: mehr Wörter, mehr Grammatik, weitere Anwenden-Disziplin.
- **Anwenden** (eigene Seite, aus Heute und als Unterseite von Grammatik/Wörter erreichbar): 
  1. **Eigener Satz** mit einem heutigen Wort und einer Regel (gibt es, wird verbessert).
  2. **Auf eine E-Mail antworten** (echte Geschäftsmail aus deinem Beruf: Kunde, Partner, Kollegin).
  3. **Eine E-Mail schreiben** (Situation aus deinem Beruf/Alltag, Stichpunkte auf Deutsch).
  4. **Einen Artikel zusammenfassen** (kurzer Text, z. B. der Tagesartikel; 3–5 Sätze auf Englisch).
  Jede Rückmeldung: was gut war, **jede Stelle mit Fehler** (deins → richtig → warum in einem Satz), eine bessere Fassung, welche deiner Lernwörter du benutzt hast. Fehler werden zu Fehlersätzen im Tagesplan (ab morgen), benutzte Wörter zählen als „benutzt“ für die Wörter-App.

## Pakete
**F0 Ausblenden** – Praxis-Hub, Lesen (Reiter, Kurse), Sprechen/Rollenspiel, Einwand-Training, Hören/Diktat/Hörschleife, Sprint, Satzbau/Lückenjagd, nbdrill-Sets, Tempo, C1-Filme, Satz-Klinik-Kachel aus Oberfläche und Heute-Extras entfernen. Daten bleiben unangetastet (kein Löschen, alte Dokumente weiter tolerant lesbar). Code der entfernten Bereiche bleibt zunächst unverlinkt liegen; E2E-Tests der entfernten Oberflächen werden mit der Funktion entfernt (Produktentscheidung, kein Überspringen). Tagesweg-Schritt 3 bleibt Pflicht, zeigt nur noch Anwenden.

**F1 Qualität Wörter/Grammatik (K-Rest)** – Zwischenstand `claude/umbau-k-rest` (288bb92) prüfen und fertigstellen: K4 Statuszeile in Worten, K5 Wortpartner/Beispiele, K7 „Später prüfen lassen“ ehrlich, K11–K13 eine Zählquelle Heute/Runde, K14 Heute ohne leere Fläche, Hinweise unter der Kopfzeile.

**F2 Belege (M0)** – Zwischenstand `claude/umbau-m0` (af90153) prüfen und fertigstellen, beschränkt auf das, was bleibt: Wörter-Belege über `reportEvidence` (benutzt in Anwenden = `used`, getippt), Grammatik-Fehler aus Anwenden nur als Fehlersatz (kein BKT-Sprung), ein Fehler bucht nie beide Konten, freiwillig zählt nie zur Pflicht (Widerspruchstests). Tempo/c1x-Teile nur, soweit sie in der Grammatik verbleiben.

**F3 Anwenden-Modul** (`src/modules/apply`, Muster wie vocab/read: `index.ts`/`registry.ts`/`shared.ts`/`sharedUi.ts`, Isolationstest) – vier Disziplinen oben; ein Prompt je Disziplin (versioniert, zod-Schema, `default`, Sprachtreue, nur wörtlich belegte Fehlerstellen wie `keepEdits`), Material: E-Mails aus `content/nb` (inbox, vom english-teacher geprüft und ergänzt), Situationen aus dem Berufsprofil, Artikel aus `read/r-<Tag>` bzw. einem kleinen geprüften Vorrat. Speichern in `out/<Monat>` (vorhanden), Fehlersätze in `app/repair` (vorhanden, ab morgen fällig, höchstens 3 je Text). Tagesrotation der Disziplin im Tagesplan (eingefroren mit dem Plan, kein Neuwürfeln). Handy und Laptop gleichwertig (Handy: kürzere Vorgabe).

**F4 Fehler korrigieren im Tagesplan** – Fehlersätze aus Anwenden im Grammatik-Schritt: klare Aufgabe („Dieser Satz stammt aus deiner Mail vom …“), eine Fehlerstelle je Satz, Erklärung in einem Satz, nie abgeschnitten (feedback-sammlung Muster 4).

## Prüfung und Auslieferung
Je Paket schnelle Prüfungen, am Ende einmal voller Lauf; english-teacher (Mails, Situationen, Artikel, Prompts), learning-scientist (Anwenden, Belege), data-guard (F2/F3), ux-reviewer (Heute, Anwenden, K-Rest), platform-guard. Ein Test-Link `AXHkh6…` am Ende; live nur nach „Ja live nehmen“; beim Live-Gang Kurs-Routine anhalten.

## Arbeitsweise (Speicher)
Höchstens **ein** Helfer gleichzeitig mit Testläufen; E2E nur gezielt je Paket.
