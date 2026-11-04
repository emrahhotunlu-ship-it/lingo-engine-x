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

## Nachtrag nach architect-Prüfung (04.11.2026) – gilt vor dem Text oben
**Muss umgesetzt:**
1. **Grammatik (M0):** keine eigene Grammatik-Tür. Stattdessen Herkunftsmarke `ext: 'tempo'|'c1x'` an den Aufrufstellen von `learnRecorder.grammar` (nur Tempo und c1x-Arten im freien Praxis-Kontext; Wochen-Check, Themen-Test, Vortest, Kapitel-Arbeiten, freie Grammatikrunden unverändert). Wirkung: höchstens **eine** BKT-Wirkung je Thema und Lerntag aus `ext`; darüber wird die Antwort wie `alt` behandelt (kein BKT-Schritt), Fehlersätze, `pats`, `seen`, Zähler, Protokoll, Radar bleiben. Die vorhandene Dämpfung (`bkt.ts` ±0,06/±0,12) bleibt. Gleichheitstest: gleiche Antwortfolge alt/neu → gleiche Dokumente für alle Wege außer Tempo/c1x. Grammatik-Modulgrenze ist nicht Teil dieses Pakets.
2. Entfällt mit 1 (keine Tür im Grammatik-Modul).
3. **Wörter-Belege:** `reportEvidence` holt Gerät/Schreiber/Dokumente/Profil intern per dynamischem Import; prüft `vocabModuleOn` (aus → wie bisher `saveCard`); bei an kein zusätzliches `saveCard` (sonst doppelte Buchung durch das Nachholen); Protokollzeile als `ext` markiert. **Freiwillige Belege zählen nie zur Pflicht** (`planDoneCount`): Widerspruchstest (Kap. 15).
4. **L1:** zuerst `addLexeme` erweitern (Platzwächter `mayCreateDoc`, Kartenqualitäts-Sperre `lu.ok` für Wortgruppen aus dem Lesen, „Satz ergänzen“ bei vorhandener Karte, Fehler statt `exists` wenn unter dem Pfad ein anderes Wort liegt, Feld Herkunft/Artikel-Bezug), dann umstellen. „Gesehen“ einmal gebündelt beim Schließen des Lesers, nie je Antippen oder per Timer.
5. **L2 ohne Entfernen:** ab 250 Lese-Dokumenten nur ein Hinweis, ab 400 die vorhandene Sperre für neue Tagesdokumente. **Kein Aufräumen, das Text entfernt.** Verdichten (verlustfrei in Monats-Teildokumente) ist ein eigenes späteres Paket mit data-guard (heute ca. 20 Tagesdokumente, eilt nicht).
6. **Kurs-Routine erst nach dem Live-Gang ändern** (sie schreibt in die echte Datenbank). Vorher im Code nur: unbekannte/neue Kurse werden ohne Fehler übergangen bzw. angezeigt, sobald Lektionen da sind (Test). Lehrpläne K2–K4, K6–K8 mit english-teacher-Gegenlesung liegen bereit.

**Sollte umgesetzt:** P1 zieht `areas/anwenden.tsx` (Tagesweg Schritt 3, Routen-Typen) unverändert um, mit E2E Schritt 3 mit/ohne Claude; Isolationstest für `src/modules/practice` zuerst (Tür heißt `index.ts` wie read; Erlaubnislisten: Übungs-Bildschirme einzeln über `sharedUi`, `features/drills/session`, `ai/scope`, `platform/capabilities` über `shared`); Berührungslisten von read/vocab nachziehen (`modules/vocab/api` in read, `read/shared.ts` und `c1x/lexWrite.ts` in vocab, `app/prefetch.ts` in read). Beleg `used` aus dem Rollenspiel (`speak/persist.ts`). `st.rep`: Feld im vorhandenen Lesestand `read/m-<Monat>` (ergänzend). Monatsindex-Reparatur einmalig und idempotent im Effekt. Hinweis „Erst Wiederholen“ nur über die vocab-`api`.

**Reihenfolge neu:** K (ohne Hub) → M0 nach learning-scientist-Urteil → P1 → K-Hub-Teile → L1 → L2 → T → Prüfer → Test-Link → nach „Ja live nehmen“: Kurs-Routine ergänzen. platform-guard misst Mehr-Datei-Grenzen und `build:single`.

## Nachtrag nach learning-scientist-Prüfung (04.11.2026) – gilt zusätzlich
**Muss:**
1. **Ein Fehler bucht nie beide Konten:** kwt und err nur Grammatik, wf nur Wort (Unit-Test).
2. **Nur freie Produktion bucht BKT aus `ext`:** getipptes kwt/wf und err mit getippter Korrektur; reines Antippen wie `alt`.
3. **Tempo ehrlich:** darf buchen; falsch nach Ablauf der Zielzeit wie `alt`; schnelle Fehler legen keine Fehlersätze an; der Tagesdeckel gilt gemeinsam für Tempo und c1x (je Thema und Lerntag eine Wirkung).
4. **Wörter `cued` je Art festgelegt:** kwt (Schlüsselwort sichtbar) und wf (Stamm sichtbar) = `cued` → nur Beleg; Rollenspiel gesprochen = `typed:false`; Rollenspiel-Beleg `ok` nur, wenn die Analyse die korrekte Verwendung bestätigt.
5. **Widerspruchstest erweitert:** eine `ext`-Buchung auf eine Karte im heute eingefrorenen Pflichtplan macht die Pflicht weder unerfüllbar noch zählt sie als erledigt.

**Sollte (übernommen):** Antippen im Leser = Beleg `seen` mit `ok:false` („beim Lesen nachgeschlagen“, höchstens Schwach-Markierung), gebündelt beim Schließen und bei `pagehide`. Teil A nur mit eindeutig erkanntem Muster, Grundform in Klammern, Lücke = Regelform, Fehler nur Grammatik. Hörübung: Antwort ein Wort/eine Zahl, tolerant (Tippfehler, Synonyme), bei Abweichung „So stand es im Text“ statt Rot, danach Knopf „Nachsprechen“. „Erst Wiederholen“ höchstens 1×/Tag, nur vor Wörter-/Grammatik-Übungen, mit Wozu-Satz und Knopf; neue Wörter fallen nicht weg. „Weitere Fehlersätze“ zieht nur fällige; nicht fällige als Übung ohne Box-Aufstieg. Sprint mit `ext`-Marke. Hub: Titel als Handlung, „Wozu“ + gemessene Dauer (Median); „Heute empfohlen“ mit Grund aus echten Daten, rotierend über Gruppen und Beruf/Alltag; Lesen nicht doppelt (eigener Einstieg „Lesen“ bleibt, im Hub eine Zeile, kein zweites Kartenset). Fragen 3/4 bleiben in den Übungen (Prüfung im Hub-Paket).

## K-Paket (aus `docs/review/k-abgleich-2026-11-04/befund.md`)
Erledigt und im Kommentar geschlossen: K1, K6, K8, K9, K10. Zu bauen:
- **K2** Schreibmarke in leerer Lücke (Höhe/Oberkante aus Schrift und Innenabstand, `KineticGap.tsx` `placeCaret`), auch Form „Schreib das auf Englisch“.
- **K3** Lösung bricht nicht um (`nowrap`, solange sie in die Zeile passt); „Warum“ bei falsch: Unterschied deiner Antwort zur Lösung statt nur Bedeutung.
- **K4** Statuszeile: Punkt weg, Klartext („Wiederholung · 3 von 10“), „Wiederholung“ nicht für heute eingeführte Wörter („Erster Abruf“), Grammatik „●●●● Lernt“ in Worten.
- **K5** Wort-Erklärung mit Wortpartnern (`col`) und 1–2 weiteren Beispielsätzen, wo vorhanden.
- **K7** „Später prüfen lassen“ mit einer Zeile, was passiert; auf der Wortkarte wirklich später prüfen (vorgemerkt), nicht „zählt nicht“.
- **K11/K12/K13** eine Zählquelle für Heute und Runde (`vmod/day`, einzelne Wörter, Fehler erhöhen die Gesamtzahl nicht); kein „ca. 25 Min.“ neben „Heute nur kurz“ ohne Bezug.
- **K14** Heute bei 1440/2560 ohne halbleere Karte (keine Streckung auf volle Höhe, „Heute nur kurz“ unter den Schritten), rechte Spalte gefüllt oder schmal.
- Nebenbefund: Hinweise verdecken am Handy die Kopfzeile → Hinweise unter der Kopfzeile.
