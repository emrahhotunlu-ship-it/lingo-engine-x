# Plan „Module P/L“: Praxis und Lesen als eigene Module + Kommentare K1–K14 (04.11.2026)

Auftrag: Emrah 04.11.2026 „Ja live nehmen und Plan fertigstellen“ = restliche Roadmap ohne weiteres gemeinsames Planen fertig bauen (`docs/entscheidungen.md` 04.11. abends). Prinzip „Bereiche als eigene Module“ (30.10.2026): eigenes Modul mit eigenen Daten, Tests und klarer Tür; andere Bereiche **planen nie** Wörter oder Grammatik selbst, sie melden Belege. **Keine Funktion fällt weg** (30.10.2026). Grundlage: `bestand-praxis.md`, `bestand-lesen.md`, K-Abgleich `docs/review/k-abgleich-2026-11-04/`.

## Ziele (was Emrah merkt)
1. Praxis und Lesen wirken wie eigene kleine Apps im selben Glas-Design: ein klarer Einstieg, alle Übungen auffindbar (auch die heute versteckten), nichts doppelt.
2. Was du in Praxis und Lesen tust, hilft deinen Wörtern und deiner Grammatik **ehrlich und gedämpft**: Ein Wort, das du beim Lesen antippst oder im Rollenspiel benutzt, wird als „gesehen/benutzt“ vermerkt; der Wiederholungsplan ändert sich nur bei einem echten, getippten Abruf (Regel der Wörter-App). Keine doppelte Buchung, keine heimlichen Planänderungen.
3. Deine Kommentare K1–K14 sind am Bildschirm nachweislich erledigt.
4. Bildschirme öffnen schnell (#23: Reiter-Teile werden vorgeladen, kein „weißer Moment“).

## Pakete (Reihenfolge = Bau-Reihenfolge)

### K – Kommentare K1–K14 (zuerst, weil sichtbar)
Je Kommentar laut K-Abgleich: offen/teilweise → beheben, mit Bildschirmfoto vorher/nachher; erledigt → Antwort im Kommentar-Faden und schließen.

### M0 – Beleg-Türen (unsichtbar, Grundlage)
- **Wörter:** `modules/vocab/api.reportEvidence` ist die einzige Tür für Belege anderer Bereiche (Regeln dort unverändert).
- **Grammatik:** neue Tür `modules/grammar/api.reportGrammarEvidence({topic, ok, free, src, t})`: bucht BKT nur bei freier Produktion und eindeutigem Thema, gedämpft und gedeckelt (eine Planwirkung je Thema und Lerntag aus freiwilligen Bereichen), sonst nur Protokoll. Ein Fehler bucht nie Wort und Grammatik zugleich (anwenden-plan Regel 3).
- Unit-Tests: Dämpfung, Deckel, keine Doppelbuchung, gleiche Ergebnisse wie bisher für Pflicht-Runden (Golden-Zahlen unverändert).

### P1 – Praxis-Modul `src/modules/practice`
- Gerüst nach Vorlage vocab/read: `registry.ts` (Schemas/Pfade `out/<Monat>`, `talk/<Monat>`, `app/levels` – nur lesend übernommen, keine neuen Pfade), `api.ts` (Einstieg, `practiceToday()` für Heute: was angeboten wird, nichts Pflicht außer dem bestehenden Tagesweg-Schritt 3), `shared.ts`, `sharedUi.ts`, `aiPort.ts`, Isolationstest.
- Hub `ApplyHub` + Bereichsdateien (`areas/anwenden.tsx`, `praxis.tsx`, `training.tsx`) ziehen ins Modul; die Übungs-Bildschirme bleiben vorerst an ihrem Ort und werden über `sharedUi` eingebunden (kein großes Verschieben ohne Nutzen, geringes Risiko).
- **Belege umstellen:** c1x-Wortbuchung (`c1x/lexWrite.ts` → `saveCard`) im freiwilligen Kontext über `reportEvidence`; Tempo/kwt/err/wf im Kontext `xtra` über `reportGrammarEvidence`. Pflicht-Wege (Grammatik-Schritt, Wochen-Check als Tagesweg-Block) bleiben unverändert.
- **Nichts versteckt:** „Weitere Fehlersätze“ sichtbar, auch mit neuer Grammatik (führt in die Fehlersatz-Runde des Grammatik-Moduls, freiwillig); Sprint-Knopf; Einwand-Sets „Heißer Stuhl“/„Zeit gewinnen“ mit Knopf; Business-Szenen im Sprechen wieder wählbar (KI-Szenen nur mit Claude).
- **Stufe 2 fertig:** Wort + Regel Teil A (Lücke in der Regelform aus dem Ursprungssatz der Karte, ohne Claude); Hörübung mit Frage als Kurzantwort (Auswahl bleibt Rückfall ohne Tastatur); ruhiger Hinweis „Erst Wiederholen“ ab 40 fälligen Wörtern (keine Sperre).
- Hub im Glas-Design: Gruppen „Heute empfohlen“ (eine Karte), „Schreiben“, „Sprechen und Hören“, „Wörter und Wendungen“, „C1-Training“, „Lesen“; jede Zeile mit einem Satz „Wozu“ und Dauer; freiwillig sichtbar getrennt (Kap. 2 Nr. 6).

### L1 – Lesen an die Wörter-App anschließen
- Schlüsselwörter → Karte und „Wort aufnehmen“ aus dem Leser über `vocab/api.addLexeme` (statt `features/lookup/store`), Herkunft `read` mit Artikel-Bezug; Antippen im Text meldet `reportEvidence(kind:'seen')` (nur Beleg, keine Planwirkung); Anwenden-Schritt der Lektion mit Zielwort meldet `used` (getippt).
- `modules/read/api.ts`: `readToday()` (neuer Tagesartikel? Lektion offen?) für die Heute-Kachel; Kachel-Logik aus `ExtraRow.tsx` ins Modul.

### L2 – Lesen fertigstellen
- Fehlender Monatsindex wird beim Öffnen repariert (nur ergänzen, nie löschen).
- Hinweis ab 250 Lese-Dokumenten mit „Aufräumen mit Zustimmung“ (`domain/retention.ts`; nur eigene Artikel älter als 60 Tage, Lesestand bleibt; Trockenlauf zeigt, was passiert; nichts ohne Bestätigung).
- „Übersetzung falsch melden“ (`st.rep`) im Leser.
- **Kurse K2–K4, K6–K8 aktivieren:** Lehrpläne nach `docs/umbau/lesen-kurse.md`, Lektionen entstehen wie bei K1/K5 über die Kurs-Routine (Auftrag der Routine um die neuen Kurse ergänzen, Rückweg-Kopie des alten Auftrags in `docs/umbau/routinen-rueckweg/`), Gegenlesung `english-teacher` der Lehrpläne vor dem Test-Link.

### T – Ladezeiten (#23)
- Nach dem ersten Bild werden die Teile der vier Reiter und von Praxis/Lesen im Leerlauf vorgeladen (`src/app/prefetch.ts` erweitern), Messung mit `perf.spec`.

## Was sich nicht ändert
Datenpfade (keine neuen Sammlungen; neue Felder nur ergänzend, tolerant gelesen), Serie, Tagesweg (3 Schritte), Pflicht-Regeln, Wörter- und Grammatik-Planer, Live nur nach „Ja live nehmen“.

## Prüfung
- Schnell beim Bauen (`verify:fast`, betroffene Specs), einmal am Ende voller Lauf.
- data-guard (M0, P1-Belege, L1, L2-Aufräumen), learning-scientist (M0-Dämpfung, Stufe 2, Hörübung), english-teacher (Kurs-Lehrpläne, neue Texte), ux-reviewer (Praxis-Hub, Lesen, K-Fixes), platform-guard vor dem Test-Link. Je Prüfer eine Prüfung + eine gezielte Nachprüfung.
- Ein Test-Link `AXHkh6…` am Ende, Bericht in drei Teilen.

## Risiken
- Umstellen auf gedämpfte Belege ändert, wie stark freiwillige Übungen auf Wörter/Grammatik wirken (bewusst schwächer, ehrlicher) → in `stand.md` und im Test-Link-Bericht erklären.
- Kurs-Routine: Änderung am Auftrag einer laufenden Routine; Rückweg-Kopie vorher, nur ergänzen.
