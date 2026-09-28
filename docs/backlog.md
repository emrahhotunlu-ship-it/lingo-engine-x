# Backlog – Lingo-Engine X

**Stand:** 27.09.2026, 23:00 UTC. Angelegt mit dem Bauplan `docs/neubau/plan.md`.

**Regeln:**
- Neue Ideen während eines Baus kommen hierher, nie in das laufende Paket (A7, `plan.md` §0).
- **Paket B** hat eine feste Reihenfolge (`plan.md` §5). Es startet direkt nach dem Neubau, sofern Emrah nichts anderes sagt.
- Alles unter „Später“ wird erst nach Paket B mit Emrah priorisiert.
- Jeder Eintrag hat eine Quelle.

**Quellen-Kürzel:**
- `lehrer` = `docs/neubau/lehrer.md`
- `markt` = `docs/neubau/markt.md`
- `leistung` = `docs/neubau/leistung.md`
- `anki` = `docs/neubau/anki-regeln.md`
- `inv` = `docs/neubau/inventur.md`

---

## 1. Paket B (direkt nach dem Neubau, Reihenfolge fest)

| # | Inhalt | Quelle | Aufwand | Hinweis |
|---|---|---|---|---|
| B1 | **Monatliche Vergleichsaufgabe:** gleiche Sprech- und Schreibaufgabe wie vor 4 Wochen, beide Fassungen nebeneinander, Claude beschreibt den Fortschritt in Worten. Messwerte: Wörter/Min. (45-s-Durchgang), Fallen je 100 Wörter, frei benutzte Wendungen. | lehrer X1, Lücke 10 | L | Einplanung in der letzten Monatswoche (P1), neue Vorlage `compare@1`, Anzeige im Stand |
| B2 | **Einheitsstil in den KI-Vorlagen.** Nachfolger mit neuer Kennung: `writing-review-nb`, `reading-check-nb`, `lesson-production-nb`, `apply-check-nb`, `tone-check-nb`, `fluency-check-nb`, `say-check-nb`. Inhalt: Fallen-Merkliste überall, ≤ 3 Korrekturen, Wirkungssatz, CEFR nur als Satz. | lehrer Lücke 4 | M | Alte Vorlagen bleiben registriert (Rückweg), danach Aufräumen (4.1) |
| B3 | **Nicht erreichte Soll-Punkte** aus Paket A, in dieser Reihenfolge: P3 (N31–N35) → P7 (N107–N109) → P5 (N77–N80) → P1 (N16–N17) → P4 (N56–N61) → P2 (N46–N47) → P6 (N96–N98) | plan §3.3 | – | Stand je Paket laut Abschlussbericht um 06:20 |
| B4 | **Anki „Rückgängig“** (5 s, Toast) | markt AN2, Nr. 2 | M | Setzt Karte und Protokolleintrag zurück; Pflicht- und Serienzählung beachten; data-guard |
| B5 | **„Claude merkt sich“:** bis zu 5 Fakten je Gespräch/Termin in `app/memory`, in den Einstellungen sichtbar und löschbar, fließt über `prompts/work.ts` in die Vorlagen | markt DU5, Nr. 18 | M | neues Dokument (data-guard), Änderung an `work.ts` |
| B6 | Hörtext mit 2–3 Stimmen (en-US/-GB/-IN/-AU, soweit am iPhone vorhanden); Hören → Stichworte → Follow-up-Mail | lehrer H3, H4, Lücke 7 | M | neue Vorlage `listening-dialog@1` |
| B7 | Zielerinnerung Entspannt 85 % · Normal 90 % · Intensiv 95 % mit Aufwand-Vorschau; Lastausgleich ±1 Tag; leichte Tage (Ruhetag, Preply-Tage) | markt AN3a, AN3c | M | ändert Intervalle → learning-scientist + data-guard |
| B8 | Startpfad Stufe 2: Bildschirme als Fabrikfunktionen (erst messen, CSP des Viewers prüfen); kinetische Lücke mit 1 Commit je Anschlag (Motion-Value/WAAPI) | leistung §4 Nr. 5, 9 | M | nur wenn die Messung am iPhone es rechtfertigt |
| B9 | **Aus der Aufgabenliste (Lehrer):**<br>– Anruf-Modus mit Stimme und Diktiertaste<br>– Zahlen und Grafiken präsentieren (60 s)<br>– Umschreiben statt stocken<br>– Rückübersetzung<br>– Ton-Erkennung „Wirkt: …“ im Text | markt DU5, lehrer I8, W10, S9, markt GR2 | je M | – |

## 2. Später: Lernen und Inhalte

| Idee | Quelle | Aufwand | Hinweis |
|---|---|---|---|
| Idiome und US-Business-Wendungen (erst verstehen, dann mit „wann besser nicht“) | lehrer W11 (C) | S | als Inhaltssatz für den Tipp-Drill-Motor |
| Minimalpaare hören und wählen (vest/west, bet/bed, -ed) | lehrer P5 (C), markt EL2 | S | lokal, nur Sprachausgabe |
| Sich selbst aufnehmen und vergleichen | lehrer P6 (C) | M | nur, wenn das Mikrofon im eingebetteten Safari wirklich geht |
| Kernwörter und Pausen im Pitch-Text markiert vorlesen | lehrer P3 | S | Pitch-Coach |
| Diktat für C1: kürzere, schnellere Sätze, Lücken bei Funktionswörtern | lehrer H5 (C) | S | Drills |
| „20 Min. Podcast gehört“ als Extra eintragen | lehrer H6 (C) | S | zählt nur als Extra |
| Eigene Masken für Proposal-Abschnitt und Slack/Teams-Antwort | lehrer S3, S4 | S je | Schreibwerkstatt |
| Small Talk, Telefon/Videocall, Meeting leiten als eigene Modi (über die Szenen hinaus) | lehrer I10–I12 | M | zuerst als Szenen in Paket A |
| C1-Probe alle 8 Wochen (Wortbildung, Umformung, Report, 1 Min. sprechen) | lehrer X5 (C) | M | freiwillig |
| Phrasenbank nach Situation (Einstieg, Bedarf, Preiseinwand, Abschluss, Mail-Anfang/-Ende), vor dem Call anhören | lehrer T5 | M | baut auf Stapel „Wendungen“ + Hörschleife auf |
| Lektionen als Input-Material der Wochenthemen | lehrer T6 (C) | M | Kurs bleibt Angebot |
| Zweiter Themen-Durchgang ab Monat 5 mit höheren Anforderungen (schwierigeres Gegenüber, schnelleres Tempo, längere Texte) | lehrer 2.3 | M | Stufe je Thema in `app/week` |
| Mix Beruf/Alltag im Input fein steuern (2 Alltagstage je Woche) | lehrer 2.2 | S | `unitPlanFor` |
| Monatsroutinen:<br>– Karten, die dreimal hintereinander vorzeitig „Leicht“ bekamen, zum Archivieren anbieten<br>– Falle nach 4 Wochen ohne Vorkommen als erledigt markieren<br>– Themen der nächsten 4 Wochen mit dem Preply-Lehrer abstimmen (fertige Nachricht) | lehrer 2.3 | M | nie automatisch löschen (Kap. 9) |
| Kontrollkarten-Konstanten nach 4 Wochen anhand der Kalibrierung überprüfen | anki §4 | S | learning-scientist |
| Beim Merken die ganze Wortverbindung vorschlagen (`address concerns` statt `address`) | lehrer W12 | M | Wort-Popover, KI nachladend |

## 3. Später: Funktionen nach Marktvorbildern

| Idee | Quelle | Aufwand | Hinweis |
|---|---|---|---|
| FSRS-Parameter einmal im Monat aus `hist` optimieren, Ergebnis als ein Satz im Stand | markt AN3b | M | data-guard, learning-scientist |
| Kurve „sichere Einträge“ je Monat | markt LV4 | S | Stand › Statistik |
| Kollokations-Paare auf Zeit (6 Verben zu 6 Nomen, 60 s, ohne Bestenliste) | markt QZ4 | S | nur als Extra |
| Mehrtext-Zuordnung und Absatz-Lückentext beim Lesen | markt CA2 | M | nur als Extra |
| Freihändig-Modus: Hörschleife ohne Blick aufs Display (endet beim Sperren) | markt GL3 | S | Safari-Grenze |
| Anhören-Liste für Hörtexte | markt LQ7 | S | – |
| Strukturierter Kontext: Firma/Produkt, Kunden, typische Einwände, Termine (1–2 KB) | markt BE1 | M | ersetzt Freitext `ctx` nicht, ergänzt ihn |
| Neue Wörter bevorzugt aus eigener Business-Häufigkeit | markt CM1 | M | Eingangskorb |
| Foto eines Textes → Lese-Einheit oder Kartenvorschläge | markt LQ5, LV3 | M | nur wo `limits().images` es meldet |
| Diktat als Verständlichkeits-Check („Das iPhone hat verstanden: …“) | markt BA4, SP2 | S | Diktiertaste |
| Meilensteine statt Abzeichen („100 Wendungen sicher“, „erste Mail ohne Markierung“) | markt UI 21 | S | einmal zeigen, dann im Stand |
| Ehrliche Plan-Vorschau („Bei 27 Min./Tag ≈ 35 Wiederholungen, 5 neue“) | markt UI 19 | S | Einstellungen › Lernen |
| Heatmap: Tipp auf einen Tag zeigt Details | markt UI 5 | S | Stand › Statistik |
| Zieldatum C1 nur als Spanne und nur mit genug Belegen | markt BU1 | S | Stand › Ziel C1 |

## 4. Später: Technik und Aufräumen

| Aufgabe | Quelle | Hinweis |
|---|---|---|
| Alte Vorlagen abmelden, sobald die Nachfolger (B2) eine Woche stabil laufen | plan §3.2 | eine Zeile je Vorlage in `registry.ts` |
| „Was ist neu“ (`WhatsNew.tsx`, `whatsNew.ts`): Code entfernen oder als einmaliger Rundgang nach großen Umbauten, nur auf Emrahs Wunsch | inv A14 | bewusst nicht eingehängt (Emrahs Kritik) |
| `COMPACT_ENABLED` / `writer.compact` bleibt aus. Neu entscheiden, wenn `app/profile` > 128 KiB wird | inv P13, A7 | Diagnose zeigt die Größe |
| Veraltete Texte `grade1–4`, `trSuggest`, `purpose*` in `src/i18n/de.ts` prüfen und entfernen, wo der Anki-Modus sie nicht nutzt | inv §4 | – |
| Laufenden Übungsstand zusätzlich in `db` (`session/<tag>`) | Produktkonzept §4 | **Bewusst nicht gebaut:** Antworten liegen schon je Antwort in `db`, die Position ist Bequemlichkeit (Kap. 3.1, A6.6). Nur neu prüfen, wenn Emrah geräteübergreifendes Fortsetzen wünscht. |
| Wendung ziehen in jedem englischen Text (Engine-Ebene), nicht nur im Leser | markt LQ3, plan N57 | `engine/EnglishText`, `wordTap` |
| „Rückgängig“ auch in Grammatik und Drills | markt UI 13/14 | nach B4 |
| Messung am echten iPhone: `lx:status`/`lx:card` aus der Diagnose über Emrahs Kommentare sammeln, Budgets bestätigen | leistung §1, §4 Nr. 10 | – |
| Kompatibilitäts-Test-IDs (`hub-*`, `training-*`) nach einer stabilen Woche vereinheitlichen | architektur §2.8 | nur zusammen mit den Specs |

## 5. Offene Rückmeldungen von Emrah (am iPhone prüfen)
- **28.09., 17:07 (Anki-Rückgängig-Bereich):** Die Gesamtzahl wächst mit, wenn eine Karte „Nochmal" bekommt und in der Runde wiederkommt (aktuell bewusst so, anki-regeln.md §2 „zählt im Zähler mit"). Emrahs Wunsch: feste Gesamtzahl, „Nochmal"-Karten als eigener kleiner Zähler daneben. Ändert die Zähl-Logik → nicht nebenbei, erst mit Emrahs OK.
- **Aus A7, 27.09.:**
  - Ladezeit (Budget jetzt < 1,5 s bei 4× Drossel),
  - automatische Einschätzung beim Öffnen von „Dein Stand“,
  - lange Can-Do-Liste,
  - „Wiederholen“ dreimal auf Heute: im Neubau durch die Tageskarte gelöst, bitte bestätigen.
- **iPhone-Prüfliste nach dem Neubau:**
  - Tastatur über der Lücke,
  - Wischen im Aufdecken,
  - Hören mit Tempo-Leiter,
  - Diktiertaste in Sprechaufgaben,
  - Neuladen mitten in der Übung,
  - fünf Reiter einzeilig.
