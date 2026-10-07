# Entscheidungsprotokoll (ausgelagert aus CLAUDE.md A7 am 07.10.2026)

Vollständig und unverändert übernommen. Neue Entscheidungen unter „Einträge“ oben anhängen.

## Einträge
Hier werden Emrahs Antworten auf die Phase-0-Fragen und alle weiteren Produktentscheidungen mit Datum eingetragen.

**07.10.2026 – Mehr-Datei-Artefakt erlaubt (Emrahs Entscheidung; lockert „eine einzige HTML-Datei“ aus A1/Kap. 3.1)**
- Am iPhone belegt (privater Test-Artefakt): ES-Module-Skript, WebGL, Web Worker (Blob) und das Laden einer eigenen Zusatzdatei (3 MB) funktionieren; **externe Anfragen bleiben blockiert** (Kap. 3.1 sonst unverändert: kein Server, keine Schlüssel, `claude.use` nur in `src/platform`).
- Zwei Bauweisen: `npm run build`/`build:single` = genau eine `dist/index.html` (Standard und Rückweg); `npm run build:multi` = `dist/index.html` + **flache** Zusatzdateien (kein Unterordner), je Datei < 16 MB, gesamt ≤ 64 MB (Hinweis ab 12 MiB). Veröffentlichen mit `files` laut `docs/umbau/mehr-datei.md` (`npm run publish:manifest`). `check:platform` prüft beide Modi. Umgestellt wird der Standard erst nach Emrahs Entscheidung.

**06.10.2026 – Lernplattform 2.0: Vertrags-Commit (Plan `docs/umbau/lernplattform-2.md`)**
- **Eingabeprofil statt Handy-Modus (nie planwirksam):** Die neue Datei `src/platform/input.ts` (kommt mit P1) wählt nur die **Form** einer Aufgabe (Touch oder Tastatur), nie die Pflicht. Der alte Handy-Modus änderte die Pflicht; sein Verbot (`src/platform/device.ts`, `phoneMode`, `PhoneModeSection`, `setPhoneModeLocal`) bleibt. Abgesichert durch einen Fall in `tests/unit/removalAudit.test.ts`: `src/domain/**` und `src/features/today/store.ts` importieren nichts aus `src/platform/input`.
- **Regelversion `u.rv`, Planversion bleibt 1:** Tagesplan v2 läuft über das rein ergänzende Feld `u.rv` (`rv !== 2` = alte Regel). `u.v` und `p.v` bleiben 1, damit jeder Leser (auch die Live-Version) jeden neuen Plan liest und der Rückweg sicher ist. Schalter `PLAN_RV` stellt nur die Koordination am Ende von Welle 2 um.

**04.10.2026 – „Go Anwenden“: vierter Reiter neben Wörtern und Grammatik (Emrahs Wunsch)**
- Emrah: „lieber neben Wortschatz und Grammatik einen Kombinationsübungsbereich … Diktat und Hörübung und sowas“. Reiter: Heute · Wörter · Grammatik · **Anwenden** · Fortschritt. Freiwillig, nie Pflicht, keine eigene Fortschrittsnote.
- Diktat, Hörschleife, Hör-Modus, Lücke, Satzbau und Rollenspiel/Einwand-Training liegen dort. Der Standardwert „Diktat/Sprint/Hören entfallen“ gilt nicht mehr (Sprint entfällt weiter). Zweite Stufe (Hörübung mit Frage, Kombi-Aufgaben) wird mit Lernwissenschaft und Englischlehrer geplant; Stand in `docs/umbau/stand.md`.

**04.10.2026, nachmittags – Gesamtkonzept für den Umbau, Umsetzung in einem eigenen Fenster (Emrahs Auftrag)**
- Emrah: „du hast wieder nur halbe Sachen gemacht … der Fortschritt für Lesen, Sprechen etc. ist weiterhin drin … mache ein Gesamtkonzept, wie die komplette App überdacht werden kann in allen Facetten … Umsetzungen finden in anderen Chatfenstern statt.“ Ehrlich festgehalten: Bisher waren nur die **Einstiege** ausgeblendet, der Fortschritt zeigte weiter alle 6 Fertigkeiten (mein Satz „taucht nirgends mehr auf“ war falsch).
- **Ergebnis:** `docs/umbau/gesamtkonzept.md` (Teil A in einfachen Worten, Teil B für die Umsetzung) mit acht Berichten (`00` bis `08`, Verzeichnis dort Kap. 12), Auftrag an das Programmier-Fenster `docs/umbau/uebergabe.md`, Merkzettel `docs/umbau/stand.md`. Visuelle Fassung: Design-Fläche „Lingo-Engine X Gesamtkonzept“ (`https://claude.ai/artifact/HDdxuD2T2LRJSbHmnDsd1c`, 20 klickbare Handy-Bildschirme, nur Entwurf, Beispielwerte).
- **Kern der Entscheidungen:** Leitsatz „eine Schlange, ein Knopf, ein sichtbares Ende“; Reiter Heute · **Wörter** · Grammatik · Fortschritt; Tag in 4 Schritten (Wörter wiederholen 8 · Grammatik 7 · Satzbau 5 · Fehler korrigieren 3 Min.); Zustände Neu · Lernt · Sicher · **Fest**; Atlas mit 8.000 Einträgen und C1-Marke bei ≈ 4.500 (8.000 ist **keine** offizielle C1-Grenze); Grammatik-Pfad mit 39 Themen B2 → C1 mit Mini-Lektion; Fortschritt nur Wörter · Grammatik · Rückblick; einheitlicher Übungsrahmen (Regeln R1–R12); **eine** Quelle je Zahl (`domain/metrics`); abgeklemmte Bereiche werden gelöscht, **Daten bleiben vollständig**.
- **Standardwerte E1–E7** (gelten, bis Emrah „anders“ sagt): C1-Marke 4.500 + Atlas 8.000 · 2–5 neue Wörter am Tag (meist 3) · Kurs entfällt als eigener Bereich · Sprechen bleibt als freiwilliges Extra mit **Rollenspiel und Einwand-Training** (alles andere zum Sprechen und Schreiben entfällt) · Inhalte der Fertigbau-Linie nur als Inhalt ernten (kein Code) · Preply-Lehrer sieht einmalig 200 Karten durch (optional) · Reiter „Wortschatz“ heißt „Wörter“.
- **Geltungsbereich:** Kap. 2 Nr. 5 (kombinierte Aufgaben), Kap. 6 (Funktionsumfang) und Kap. 14 („alle Module“) des Auftrags gelten ab jetzt nur für Wörter und Grammatik (W0 passt A1/A4 an).
- **Vorgehen:** Wellen W0–W6 in einem eigenen Programmier-Fenster auf dem Branch `claude/umbau-fokus` (Basis `claude/affectionate-cerf-pe6ej2`); erster sichtbarer Test-Link nach W2 („Aufgeräumt“). **Live (`JLL8…`) nur nach Emrahs ausdrücklichem „Ja live nehmen“.** Dieses Planungs-Fenster bleibt reiner Chat.
- Hinweise: `main` steht 289 Commits hinter diesem Branch und wird für den Umbau nicht benutzt; die einzige Routine („Input des Tages (schlank)“, von der Fertigbau-Linie umgebaut und pausiert) wird nicht angefasst.

**04.10.2026 – Fokus nur noch Vokabeln und Grammatik (Emrahs Vorgabe)**
- Emrah: „insgesamt nicht zufrieden … an vielen Stellen nicht logisch. Fokus komplett auf Vokabeln und Grammatik, weg von Artikeln und Videos … Und mach die Bugs weg!!“
- Entscheidung nach Rückfrage: Tageseinheit nur noch Wortschatz · Grammatik · Anwenden (Satzbau, Korrektur eigener falscher Sätze). Reiter: Heute · Wortschatz · Grammatik · Fortschritt. Lesen, Hören/Videos, Entdecken und Schreiben werden ausgeblendet. **Sprechen bleibt als freiwilliges Extra** (kleiner Einstieg auf Heute, nicht in der Pflicht). Übersetzer und „Claude fragen“ bleiben. Alle Daten bleiben unangetastet in der Datenbank (nur ausgeblendet).
- Umsetzung: Block 2 = Grammatikrunde (`grammar`, `selectRound` duty, n 6/4/3), Block 3 = Satzbau (`task.order`), Block 5 = fällige alte Reparatur-Sätze (Sätze von heute erst morgen, Lernwissenschaft B2). `speak`/`library` sind Seiten. Geprüft: 1751 Unit, 563 von 569 E2E (5 Last-Ausreißer einzeln grün, 1 altes fixme), Plattform-Prüfung Freigabe, Lernwissenschaft (Befunde B1/B2/S1–S4 eingearbeitet).
- **Test-Link** `AXHkh6…` Version `1791120645-8c83` (Artefakt-Version 31). Dort lag vorher die Version `1791080640-caba` einer **anderen Sitzung** („Fertigbau“, Branch `claude/zen-albattani-51wnxf`, Reiter Heute · Input · Wortschatz · Fahrplan). Emrah hat entschieden: „Meine Version drauf“; der Fertigbau bleibt im Verlauf wiederherstellbar.
- Fehler aus Emrahs Protokoll: Bei den Buchstaben-/Wort-Bausteinen rutschte „Prüfen“ beim Antippen unter den Finger (Prüfung nach 1–2 Bausteinen: „whether“ → „we“, „somewhat“ → „h“, „are handled“ → „handled“) – behoben (Platzhalter im Vorrat, feste Höhe, feste Lückenbreite).

**03.10.2026, früh – Wortschatz-Paket 2+3 auf dem Test-Link (Emrahs Auftrag: „perfekter Vokabellern-Bereich für die 8000 C1-Wörter“, Vorrang vor allem anderen)**
- **Test-Link** `AXHkh6…` Version `1790983920-8a14` (Artefakt-Version 24), Code `b9b9865`. Geprüft: Typprüfung, Lint, 1734 Unit, 560 von 561 E2E (1 Last-Ausreißer in `grammar.spec` lief einzeln grün), Plattform-Prüfung Freigabe, data-guard (OK, zwei Warnungen behoben), learning-scientist (Befunde eingearbeitet). ux-reviewer für Hub/Paket-Stapel/Wortpartner läuft nach dem Test-Link.
- **Grundlage** `docs/wortschatz-plan.md` (Englischlehrer + Lernwissenschaft): 8000 Wortfamilien sind passives Verstehen, aktiv üben ~1500–2000 Einheiten; 4–5 neue Einheiten/Tag sind dauerhaft tragbar (12–15 Min. Wortschatz), 8–10 nicht.
- **Neu:** C1-Paket 250 Einträge (150 neue, vom Lehrer gegengelesen, Korrekturen eingebaut), täglich ≤ 2 als neue Karten, nur anlegen; Wortpartner von Claude beim ersten Aufdecken (`col` mit `ai:1`, „kann Fehler enthalten“, Einspruch); schwache Wörter in Block 3; Kapazitätsregel `capacityNew` (nur ohne Rückstand, 2–5 neue Wörter je nach Wiederhollast der nächsten 7 Tage, 140 s je neues Wort); Fortschritt „Aktiv fest“ (Stufe ≥ 4 und S ≥ 21 d), „Übt“, „Erwartet gekonnt“ (Summe der Abrufwahrscheinlichkeiten); „Leicht“ springt höchstens eine Stufe, ab Stufe 4 Abstieg höchstens eine Stufe; Gewichtung der Note (`weight.ts`: Auswahl 0,55, Stütze 0,8, frei 1, eigener Satz 1,1, Aufholmodus-Aufdecken 0,6; Intervall und Vorschau konsistent); Aufholmodus ab 40 überfälligen Karten (reife fällige Karten aufdecken, jede vierte tippen, nie zweimal hintereinander aufdecken, Erklärzeile im Wortschatz); billigere Wartung (Stufe 5 mit S ≥ 21 d nur jede 3. Wiederholung voll, eigener Satz ≤ 2 je Runde); zweiter getippter Termin im Modus Automatisch frei statt mit Stütze; Dauerfehler höchstens 3 je Runde; Wiedervorlage nach „Gut“ im Lernschritt erst nach 8 Karten; Wochenthema bei ≥ 15 fälligen höchstens ⅓ der Plätze.
- **Bewusst noch nicht gebaut (ehrlich gemeldet):** Kostenmodell aus gemessenen Zeiten und Aufräumen des toten `planRound`-Pfads; Wortfamilien-Zeile/Index (`pack-index`) und Ausbau auf ~600 Einträge; täglicher Claude-Job mit Lemmaliste (Routine liegt außerhalb des Repos, Änderung nur mit Emrahs „Ja, Auftrag ändern“); Stichprobe alle 4 Wochen; „ganze Wendung beim Antippen“; Zählung nur reifer getippter Treffer (Lernwissenschaft Befund 4); `NEW_SEC` 75; Dauerfehler aus Rückstandszählung herausrechnen.
- **Folge im Test:** Durch den Zulauf liegen nach dem ersten Öffnen 2 Paket-Karten mehr in der Datenbank (E2E-Zahlen 212 → 214).

**02.10.2026, nachts – Wortschatz-Logik überarbeitet (Test-Link; Emrahs Frage „Wie intelligent ist der Anki-Modus wirklich?“)**
- **Anlass:** Emrahs Screenshot des Wortschatz-Reiters (60 fällige Karten, Korb 53 „reicht für 6 Tage“) und die Fragen: Wie gut ist der Anki-Modus, woher kommen die Wörter (auch neue?), baut das einen C1-Wortschatz auf, sind genug Modi da, wie wird die Wiederholung mit verschiedenen Methoden gefördert? „Überarbeite wenn Bedarf da ist die Logik noch mal.“
- **Prüfung:** Englischlehrer (Wortschatz-Aufbau, C1-Plan, Abfragearten) und Lernwissenschaft (Wiederholungs-Logik) lasen den Code; dazu eine Langzeit-Simulation (`tests/unit/backlogSim.test.ts`, 120 Tage mit dem echten Tagesplan, FSRS, Startstand wie Emrahs Handy).
- **Befund (Zahlen aus der Simulation, kein Messwert vom Handy):** Das feste 8-Minuten-Budget trug nur etwa 13 fällige Karten und höchstens 3 neue am Tag. Der Berg fälliger Karten wuchs von 60 auf 256 bis 368 (nach einem Jahr 900 bis über 1.000), die Trefferquote reifer Karten fiel von 0,89 auf 0,79 bis 0,83. Die Einstellung „10 neue Wörter“ wirkte genauso wie „5“. Die Wortschatz-Seite zeigte zwei sich widersprechende Zeitangaben und „Korb reicht für 6 Tage“ (real etwa 18).
- **Geändert (alles auf dem Test-Link `AXHkh6…`):**
  - **Rückstand-Steuerung:** je überfälliger Karte +8 s Wiederholzeit (höchstens +50 %, am vollen Tag bis 12 statt 8 Minuten); ab 15 überfälligen Karten nur noch 2 neue Wörter (Untergrenze, Kap. 15); Anteil neuer Wörter nie steigend mit dem Rückstand. Block 1 nennt den Grund („Rückstand, der Rest morgen“), die Minuten folgen dem Plan.
  - **Ehrliche Anzeige:** eine Kostenquelle für Plan und Anzeige (`domain/srs/cost.ts`); Wortschatz zeigt „n Karten sind schon länger fällig“, bei Bremse den Grund, was der Knopf „Wiederholen“ gerade startet; „Eingangskorb … reicht für n Tage“ mit der Zahl neuer Wörter, die wirklich kommt; nach der Runde „Noch n Karten sind fällig · Noch eine Runde“; Hinweis unter „Neue Wörter pro Tag“ (höchstens, bei Rückstand weniger, mindestens 2).
  - **Kontext-Wechsel:** ab Stufe 3 wechseln sich bei den Lückenübungen der Ursprungssatz und die gespeicherten Claude-Sätze je Wiederholung ab (reine Ansicht, nichts wird geschrieben; Aufdecken, Prüfabfrage und Kontrolle bleiben im Ursprungssatz).
  - **Stufe und Note:** Bausteine höchstens „Gut“; höchstens ein Stufenaufstieg je Karte und Lerntag (Wiederholungen am selben Tag heben nicht).
  - **Zufuhr:** Wörter des Tagesauftrags stehen im Eingangskorb nach Emrahs eigenen Funden (vorher davor); die „nicht vorschlagen“-Liste für Claude nimmt die zuletzt hinzugefügten 600 Wörter und Wendungen samt Startwortschatz (vorher: die alphabetisch letzten 200 Dokument-Wörter); Vorschläge, die schon da sind, werden nicht gezeigt.
- **Geprüft:** Typprüfung, Lint, 1656 Unit-Tests, 553 von 557 E2E (2 Last-Ausreißer in `grammar.spec` liefen einzeln grün, 1 Erwartung der Minutenanzeige am Sonntag in `speak.spec` an die neue Regel angepasst und grün), Plattform-Prüfung Freigabe. Neue Tests: Langzeit-Simulation als Unit-Test, Rückstand, Kontext-Wechsel, Tagesbremse, bekannte Wörter, E2E „Rückstand“. Test-Link `AXHkh6…` Version `1790976063-5d30` (Artefakt-Version 23).
- **Emrahs Go (02.10. nachts, nach Fragen an die Fachleute: „Setzt du das bitte um?“):** alles aus den beiden Gutachten wird umgesetzt, in Paket 2 (Englischlehrer: schwache Wörter in Block 3, Wortpartner und Zusatzsätze für jede Karte, C1-Paket, Wendung beim Antippen) und Paket 3 (Lernwissenschaft: Zeiten messen, „Leicht“ nur bei freiem Tippen, Aufholmodus, Gewichtung, billigere Wartung, Dauerfehler-Automatik). Jedes Paket zuerst auf den Test-Link, live nur mit „Ja live nehmen“.
- **Vorher offen (jetzt in Paket 2/3):** kein geplanter C1-Wortvorrat (`level` wird nirgends benutzt); beim Wort-Antippen wird nur das Einzelwort gespeichert; neue Karten haben keine Kollokationen; schwache Wörter kommen in Lesen/Hören/Rollenspiel nicht vor; Kostenmodell aus gemessenen Zeiten, Aufholmodus, Gewichtung der Note nach Übungsart (Lernwissenschaft „später“).

**02.10.2026, nachts – Satzbau mit neuen Sätzen von Claude, live (Emrahs „Ja“ auf „nicht immer dieselben Sätze“, dann „Ja live nehmen“)**
- **Live:** `dist/index.html` (Commit „dist: Satzbau mit neuen, geprüften Sätzen von Claude“) auf `JLL8…`, Version `1790969044-1fb7` (Artefakt-Version 65). **Rückweg:** Version `1790965299-5b89`. platform-guard Freigabe, Live-Version vorher erneut gelesen (unverändert).
- Anlass: Emrah („Ist das so intelligent, immer mit den gleichen Sätzen zu arbeiten?“). Neben den 57 festen Sätzen kommen **neue, von Claude erzeugte Sätze** (Vorlage `order-gen@1`, `src/prompts/orderGen.ts`).
- **Prüfung vor der Anzeige** (`acceptGenerated`, `src/domain/drills/orderPool.ts`): Bausteine gehen genau auf, jede zweite Reihenfolge belegt, Sprache/US-Schreibweise/Tonklammer, keine Dubletten, **keine frei beweglichen Zusätze als eigener Baustein**, Fehlfassung nie eine mögliche Umstellung. Nur formal; inhaltlich kann ein Satz Fehler haben, deshalb Kennzeichnung „Neuer Satz von Claude. Nur formal geprüft, kann Fehler enthalten.“ (auch in der Rückmeldung). Fehler bei Claude-Sätzen machen ein Thema nicht zum Fehlerthema.
- **Vorrat im Hintergrund** (`src/features/drills/orderGen.ts`, nur `localStorage`, keine Datenbank): eine Anfrage je Handlung (Runde starten/beenden), danach 20 Minuten Ruhe auch nach Fehler, kein Timer, kein Neuversuch (A6.2/A6.3), Hintergrund-Priorität. Runde: höchstens die Hälfte aus dem Vorrat, gesehene Sätze (Ringpuffer 40) gemieden, Themen mit zuletzt falschen Sätzen bevorzugt (mit anderen Sätzen). Ohne Vorrat oder bei Fehler gilt der feste Pool wie bisher.
- Prüfer: Englischlehrer (Prompt und Prüfregeln), Lernwissenschaftler (Kennzeichnung, Note, Kontingent); Korrekturen eingebaut. Test-Link `AXHkh6…` Version `1790968541-f995` (Artefakt-Version 22). Geprüft: 1621 Unit, 551 von 553 E2E, die 2 Ausreißer (Last) liefen einzeln grün.
- **Verschoben:** Stichprobe des Englischlehrers über 20 echte Claude-Sätze (Ausschussquote), Meldefunktion „Satz fehlerhaft“, Vorrat mit Verfallsdatum, Wiederholung des genau falschen Satzes (Reparatur-Sätze), Abbruch bei Bildschirmwechsel.

**02.10.2026, spätabends – Satzbau neu gebaut, live (Emrahs „Ja in Abstimmung mit Englischlehrer und Lernwissenschaftler“, dann „Ja live nehmen“)**
- **Live:** `dist/index.html` (Commit „dist: Satzbau mit Zeichen-Markierung …“) auf `JLL8…`, Version `1790965299-5b89` (Artefakt-Version 64). **Rückweg:** Version `1790952158-defe`. Live-Version vorher erneut gelesen (unverändert).
- Anlass: Emrahs Screenshot „erneut eine naja Aufgabenstellung“ (keine klare Aufgabe, keine Hilfe, irrelevante Regel). **Ersetzt** die Satzbau-Zeilen im Hilfen-Paket (Tipp mit Wortzahl/Regel, Knopf „Deutsch“, Ablenker, Claude-Satz je Runde).
- Neu: fester Pool `src/content/c1/order.json` (57 C1-Sätze, 7 Themen, von Hand geschrieben und vom Englischlehrer gegengelesen, **kein Claude-Aufruf**). Die **deutsche Bedeutung steht vorab** („Du willst sagen:“, bleibt auch in der englischen Oberfläche deutsch, `lang="de"`), alle Bausteine gehören dazu (keine Ablenker), feste Wendungen sind ein Baustein, zweite gültige Reihenfolgen (`alt`) zählen als richtig und erscheinen unter „Auch richtig“. Danach „Warum so?“ je Satz plus „Typischer Fehler“; **kein automatisches Weiter**.
- Tipp-Leiter: 1 = guter Anfang (Hilfe 1), 2 = die ersten zwei Bausteine nach vorn (Hilfe 2). Markierung mit Zeichen ✓ / ↔ / ✕ plus Screenreader-Text, gesperrte Bausteine lassen Wischen zu, Bausteine ≥ 44 px, Satzende in Klartext. Jede Runde mischt anders (Startzeit im Seed).
- Prüfer: Englischlehrer (Pool, 2 Runden inkl. Korrekturen), Lernwissenschaftler (4 Pflichtfragen), ux-reviewer (Handy + Desktop, drei Modi), platform-guard (Freigabe). Test-Link `AXHkh6…` Version `1790964697-5c36` (Artefakt-Version 21). Geprüft: 1598 Unit, 549 von 551 E2E, die 2 Ausreißer (Last) liefen einzeln grün.
- **Bewusst verschoben:** falsch gelöste Sätze später wiederholen (Reparatur-Sätze), Warum-Zeilen bei ~20 Sätzen noch näher an die Aufgabe, 10–15 Alltagssätze, „Prüfen/Weiter“ als feste Leiste unten am Handy, „fast richtig“ nicht als richtig zählen, Tipp-Nutzung im Protokoll, Fehler-Radar für Satzbau.

**02.10.2026, abends – Hilfen-Paket live (Emrahs Freigabe „Live nehmen“)**
- `dist/index.html` (Commit „dist: Endstand nach voller Prüfung (Hilfen-Paket)“) liegt auf `JLL8…`, Version `1790952158-defe` (Artefakt-Version 63). Rückweg: Version `1790937770-1325`. Test-Link `AXHkh6…` Version `1790951496-dc3a`.
- Anlass: Emrahs App-Kommentare („keine Erläuterung, keine Übersetzung, kein Mehr-Infos-Knopf, Tipp nicht konsistent“, „Bausteine nur mit Maus“, „Satzbau ohne Aufgabenstellung“, „Nochmal, aber besser unklar“, „erste Option immer richtig“).
- **Tipp** in jeder Übungsart außer Tempo: Stufe 1 Wortart + Bedeutung bzw. englische Erklärung (nie die Lösung), Stufe 2 erster Buchstabe bzw. eine falsche Option weniger; zählt als Hilfe (`hintLevel`), im Wochen-Check aus (`noHelp`). **Nach der Antwort** immer die deutsche Bedeutung (außer wo die Frage sie noch zeigt, H3), dazu „Mehr Infos“ (`MoreInfo`) und je Beispielsatz „Deutsch“ (`ExampleTranslation`, einmal Claude, gespeichert als **neues, nur ergänzendes Kartenfeld `exDe`**, höchstens 8 je Karte).
- **Satzbau:** klare Aufgabe, Tipp (Wortzahl/Anfang/Regel, dann erster Baustein), „Deutsch“; **Tastatur-Bausteine** am Rechner (`TilesKeyboard`, nur feiner Zeiger) in Satzbau und Vokabel-Bausteinen.
- **Fehler behoben:** Input-Block (Block 2) mischte die Antwortoptionen nicht (richtige Antwort immer vorn) → `sourceFromRef` mischt fest. „Nochmal, aber besser“: Text von vorhin im Feld, klare Aufgabe. Reparatur-Sätze ab 9 Wörtern vorbefüllt.
- Geprüft: 1585 Unit, 545 E2E (3 Last-Ausreißer liefen einzeln grün), Plattform-Prüfung Freigabe. Live-Version vor dem Veröffentlichen erneut gelesen (unverändert).

**02.10.2026 – „Stunde auswerten“ (Preply-Audio/Transkript) verworfen (Emrahs Entscheidung)**
- Idee: Preply-Stunden als Transkript einlesen und Schwächen auswerten. Preply liefert nur Audio; in der App geht keine Audio-Umwandlung (kein Audio in `sample`, kein eigenes Modell unter 16 MB, keine externen Dienste, Kap. 3.1). Der Weg über ein Transkript von außen (z. B. am MacBook) war Emrah zu umständlich.
- Entscheidung: nicht bauen. Bestehen bleibt „Lehrer-Feedback einfügen“ (kurze Korrekturen und Wörter als Text). Nur auf Emrahs Wunsch neu aufgreifen.

**02.10.2026 – Handy-Tagesplan und Reparatur-Sätze live (Emrahs Freigabe „Ja live nehmen“)**
- `dist/index.html` (Commit „dist: Reparatur-Sätze nur an der falschen Stelle korrigieren“) liegt auf `JLL8…`, Version `1790937770-1325` (Artefakt-Version 62). Rückweg: Version `1790880701-ce75`. Test-Link `AXHkh6…` Version `1790935452-334d`.
- Anlass: Emrah merkte, dass Fokus und „Nochmal, aber besser“ am Handy ohne Aufgabe des Tages sinnlos sind, und wollte ein überdachtes C1-Tageskonzept je Gerät (Englischlehrer-Beratung, Emrahs „Ja, so bauen“).
- **Handy-Plan** (löst das reine Ausblenden vom 01.10. ab): Block 3 wird am Handy durch eine kurze Übung ersetzt (Mo–Mi `focus.colloc`, Do–Sa `task.objection` mit 3 Antworten, max. 6 Min.), derselbe Pflichtpunkt `ch:u-task`, gespeicherter Plan unberührt (`domain/plan/phone`, `unitPlanOf`). Am Laptop volle Aufgabe.
- **Block 5** ohne Aufgabe von heute: die ältesten fälligen Reparatur-Sätze (≤ 3), Box wird per `recordRepair` weitergezählt. Fokus-/Nochmal-Texte sprechen nicht mehr von „der Aufgabe“.
- **Wochenbilanz** „Aufgabe des Tages am Laptop diese Woche: x von 2“: neues, rein ergänzendes Profilfeld `app/profile.lap[tag] = 1` (nur Laptop-Erledigungen; nichts gelöscht oder umgeschrieben), dazu am Laptop das freiwillige Extra „Sag es“.
- **Reparatur-Sätze** (Emrahs App-Kommentar „halber Roman“): ab 9 Wörtern steht der alte Satz im Feld, nur die falsche Stelle wird geändert.
- Geprüft: 1574 Unit, 542 E2E (volle Suite vor der Reparatur-Änderung), danach 82 betroffene E2E grün. Live-Version vor dem Veröffentlichen erneut gelesen (unverändert).

**01.10.2026 – Handy-Modus, Reiter „Fortschritt“, Stimmenliste live (Emrahs Freigabe „Ja live nehmen“)**
- `dist/index.html` (Code `22584e6`, dist `b7af3ec`) liegt auf `JLL8…`, Version `1790880701-ce75` (Artefakt-Version 61). Rückweg: Version `1790671851-fc37`.
- **Handy-Modus** (automatisch: Touch + kurze Bildschirmseite < 500 px; Schalter „Am Handy“ in den Einstellungen, je Gerät): Die Aufgabe des Tages (Block 3, außer Wochen-Check) und das Nachsprechen sind am Handy nicht Pflicht. Nur eine Ansicht (`domain/plan/phone`): der gespeicherte Plan bleibt, Zähler, Zeilen und `pflichtFor` lesen dieselbe Liste, die Serie reißt nicht. Am Laptop volle Liste.
- **Fortschritt** als eigener sechster Reiter unten. **Stimmenliste:** Spaß-Stimmen (auch deutsch benannte) ausgeblendet, einfache lokale en-US-Stimmen zuerst, Wecker nicht auf iOS.
- Datenbank: keine Schemaänderung, nichts migriert; `phoneMode` liegt nur in `localStorage`. Live-Version vor dem Veröffentlichen erneut gelesen (unverändert).
- Offen: iPhone-Audio weiter robotisch (Plattformgrenze, A7 29.09.), „Gut · 1 Tag“-Wiederkehr, „Anzeige Fehler“.

**29.09.2026, mittags – bei der iPhone-Sprachausgabe bleiben, kein eigener Server (Emrahs Entscheidung)**
- Emrah hat vorgeschlagen, für bessere Sprachqualität einen externen Sprachdienst/eine Schnittstelle anzubinden. Das geht innerhalb eines Claude-Artefakts technisch nicht: die Sicherheitsregel (CSP, Kap. 3.1) blockiert jede externe Anfrage außer zu den paar erlaubten CDN-Adressen, egal mit welcher Freigabe; ein API-Schlüssel im Code wäre für jeden Besucher offen einsehbar. Ein echter externer Dienst bräuchte einen eigenen Server dazwischen – neue Architektur, eigenes Hosting, laufende Kosten, mehr Wartung.
- Emrahs Entscheidung nach Rückfrage: **bei der eingebauten iPhone-Sprachausgabe bleiben**, kein eigener Server, keine Zusatzkosten außerhalb des Claude-Abos (Kap. 14). Kap. 3.1 („nicht verhandelbar") bleibt damit unangetastet.
- Die verbleibende „abgehackt/maschinell"-Rückmeldung wird innerhalb dieser Grenze weiter untersucht: zwei Behebungsversuche sind bereits gemacht (Wecker-Fix, Stimmen-Vorrang weg von Premium/Enhanced); Emrahs Antworten auf die drei Diagnose-Fragen (mitten im Wort/Satz vs. nur zwischen Sätzen; andere Stimme probiert; Hörbeispiel) stehen noch aus.

**29.09.2026, vormittags – Sprachausgabe am iPhone nicht mehr abgehackt live (Emrahs Freigabe „Bitte veröffentlichen")**
- `dist/index.html` (Code `9ea0996`) liegt auf `JLL8…`, Version `1790671851-fc37` (Artefakt-Version 60).
- Ursache: Der 5-Sekunden-Wecker gegen Chromes stilles Pausieren rief `resume()` auch dann auf, wenn auf dem iPhone in Wirklichkeit gar nicht pausiert war – genau das ist auf iOS/Safari selbst die Ursache für ein Stottern mitten im Satz (Kap. 15 „Sprachausgabe am Handy abgehackt"), besonders bei längeren Sätzen (z. B. langsameres Tempo bei der Tempo-Leiter). Am Laptop (Chrome) tritt das Problem nicht auf, deshalb war es Emrah dort nie aufgefallen.
- Jetzt: Der Wecker läuft nur noch auf Geräten, die ihn wirklich brauchen (nicht iPhone/iPad, auch nicht iPadOS im „MacIntel"-Gewand).
- Rückweg: Version `1790667533-ce08`.
- Vorher auf dem Test-Link `AXHkh6…` geprüft (Version `1790668580-16be`).
- Offen: eine zweite Rückmeldung („Gut · 1 Tag", Wort kam trotzdem noch in derselben Pflicht-Runde wieder) ist noch nicht geklärt – die „Nochmal"-Logik innerhalb der Runde greift laut Code nur bei Karten, die noch in der kurzen Lernphase sind, nicht bei einem „1 Tag"-Intervall. Ohne das genaue Wort und ohne zu wissen, ob die zweite Abfrage dieselbe Übungsart war, würde eine Behebung nur geraten sein; Emrah wurde im Kommentar-Thread danach gefragt.

**26.09.2026 – Antworten auf die Phase-0-Fragen**
1. **Datenquelle:** Nur die per Link geteilte „Sprachwerkstatt" (Vertrag 0.2.49) enthält echte Lernstände. Der private Neubau-Versuch vom 26.09. mit eigener Datenbank bleibt unberührt, es wird nichts daraus übernommen.
2. **Serie für neue Tage:** Ein Tag zählt, wenn die **Pflicht erledigt** ist. **Ein Ruhetag pro Kalenderwoche** (Mo–So) bricht die Serie nicht. Er wird nicht angespart. Die Regel gilt ab dem ersten Tag, an dem die App die Pflicht erfasst (`pflichtSince`, Phase 1). Davor gilt die alte Regel (A6.13).
3. **Englisch-Variante:** **Amerikanisch** ist Standard für Schreibweise, Lautschrift, Beispielsätze, KI-Texte und die Standardstimme (en-US). Britische Schreibweisen und Wörter gelten bei Antworten **immer auch als richtig**. Die Rückmeldung nennt dann die US-Form als Hinweis, nie als Fehler.
4. **Hauptgerät:** **iPhone mit Safari** (claude.ai im Browser). Daraus folgt:
   - Safari-Eigenheiten zuerst: `-webkit-backdrop-filter`, `visualViewport` für die Bildschirmtastatur, `env(safe-area-inset-*)`.
   - Sprachausgabe: Stimmen kommen verzögert (`voiceschanged`), Stücke ≤ 150 Zeichen, 60 ms Pause nach `cancel()`, Wecker gegen Pausieren.
   - `navigator.vibrate` gibt es auf dem iPhone nicht. Die Rückmeldung ist dort rein visuell, per Merkmalserkennung und nie als kaputter Aufruf.
   - Spracheingabe nur, wenn sie im eingebetteten Artefakt wirklich startet, sonst wird der Knopf ausgeblendet.
   - **Grenze der Cloud-Umgebung:** Hier gibt es nur Chromium, keine Safari-Engine (WebKit). Automatische Tests laufen mit Chromium in iPhone-Größe mit Touch. Safari-spezifisches Verhalten prüft Emrah am Gerät.

**26.09.2026 – Arbeitsweise (Emrahs Wahl)**
- **So gründlich wie bisher:** Jede Phase wird von mehreren unabhängigen Fachentwürfen geplant (Architektur, Lernwissenschaft, Interaktion, Daten, Tests) und vor der Auslieferung unabhängig geprüft. Das gilt ausdrücklich auch dann, wenn eine Phase dadurch länger dauert. Angeboten waren auch „schneller, Daten streng" und „maximal schnell".
- **Bestätigt nach der Zeitschätzung** (Phase 1 heute Nacht/morgen früh, ganze App in 2–3 Tagen): Phase für Phase in voller Qualität. Abgelehnt wurden „Tageskern in 3–4 Std." und „alle Module einfach in 6–8 Std.". Parallel wird so weit gebaut, wie es die Umgebung erlaubt: 4–6 Helfer gleichzeitig, auch außerhalb der Workflow-Grenze.

**26.09.2026, 17 Uhr – MVP zuerst (Emrahs Vorgabe)**
- **Innerhalb von 2–3 Stunden kommt ein testbares MVP** auf den bestehenden Test-Link: Heute-Bildschirm mit einem Knopf, Vokabel- und Wendungstrainer mit FSRS und kinetischer Lücke. Es arbeitet auf der Datenkopie im Test-Artefakt.
- **MVP-Grenzen:**
  - `pflichtSince` wird noch nicht gesetzt, die Serie läuft nach der alten Regel weiter.
  - Die Schreibwege folgen der Daten-Spezifikation (fsrs zusätzlich, alte Felder gespiegelt, nichts gelöscht).
  - data-guard prüft das vor der Veröffentlichung einmal.
- **Danach im Hintergrund:** Der Rest von Phase 1 (Wort-Antippen mit Lautschrift und KI, alle Abfragearten, Bausteine, Pflicht/`pflichtSince`) und die Phasen 2–7 folgen in voller Qualität. Jeder fertige Stand geht auf denselben Link.

**26.09.2026, ca. 17:15 Uhr – vorgezogener Umzug (Emrahs ausdrückliches OK)**
- **Entscheidung:** Emrah will ab heute produktiv mit dem MVP üben. Er hat ausdrücklich „B: Alte App jetzt ersetzen" gewählt. Das MVP wird auf die Adresse der alten App veröffentlicht (`JLL8…`, dieselbe Datenbank).
  - Er weiß: Grammatik, Lesen, Hören, Schreiben, Chat und Preply fehlen, bis die jeweiligen Phasen fertig sind. Die Daten dazu bleiben erhalten.
  - Die Alternative „neuer Link nur für Vokabeln" hat er abgelehnt.
- **Rückweg:** Die alte App liegt als Artefakt-Version `1790259934-2c07` vor (46 Dateien, Hauptseite zusätzlich im Scratchpad gesichert). Die übrigen Dateien der alten Version bleiben beim Veröffentlichen stehen.
- **Bedingungen vor dem Umzug:**
  - MVP-Tests grün.
  - data-guard und platform-guard je eine Runde ohne Befund.
  - Rauchtest des Builds mit einer lokalen Kopie der echten Datenformen.
  - Fähigkeiten `db`, `sample`, `downloads`, Vertragsversion bleibt.
- **Beim ersten Öffnen** zeigt die App den Trockenlauf der Umstellung. Emrah speichert zuerst die Sicherung und bestätigt dann.
- **Ab jetzt gilt für jede weitere Phase:** Erst Test-Artefakt (Kopie), dann nach grünen Tests und Prüfungen auf die Produktivadresse. Das wird Emrah jeweils gemeldet.

**26.09.2026, ca. 18:10 Uhr – MVP produktiv**
- **Veröffentlicht:** `dist/index.html` aus `aa8003f` auf `JLL8…`, Version `1790438409-b53c` (Artefakt-Version 46).
  - Fähigkeiten: `db`, `sample`, `downloads`; Vertrag bleibt 0.2.49.
  - Zum Zeitpunkt der Veröffentlichung existierte `app/schema` noch nicht. Die Umstellung bestätigt Emrah selbst.
- **Rückweg:** Die alte Version `1790259934-2c07` wiederherstellen.
  - Achtung (data-guard R1): Die alte App schreibt beim Laden vorgemerkte `sw2:`-Kopien per `set` zurück.
  - Vorher also die Datenbank sichern.
- **Bedingung B1:** Offene Tabs der alten App auf allen Geräten schließen bzw. neu laden, bevor geübt wird. Die alte Seite schreibt ganze Dokumente aus ihrer lokalen Kopie.
- **Offene Hinweise für den Ausbau:**
  - platform-guard: H3 (Fehlerzustand `log/<heute>`), H5 (`visualViewport`), H6 (Validierungs-Cache), Testuhr in `fixtures.ts` nur für `Date`, Datum zwischen 0 und 4 Uhr.
  - data-guard W1 (Folgenummer beim Wiederholen), W2 (zwei Tabs), W3 (Puffer beim Schließen), W5 (Nachtragen-Hinweis auch auf Heute), W6 (Emrah erklären: nachts zählt der Vortag), W7, W8 (alle angesammelten `daily/*` verarbeiten), W9 (`pflichtSince` nie rückwirkend).

**26.09.2026, ca. 18:15 Uhr – Emrahs Rückmeldung zum Trainer (geht Kap. 4.1 und Kap. 5 vor)**
- **Keine Selbstbewertung:** Die Note (Nochmal/Schwer/Gut/Leicht) bestimmt die App allein aus Richtigkeit, Antwortzeit und genutzter Hilfe. Es gibt keine Bewertungsknöpfe mehr, nur „Weiter".
- **Status statt Erklärtexten:** Oben stehen je Karte die Sicherheit (aus FSRS/Stufe, z. B. 5 Punkte + Wort) und die Abfrageart. Kein „Wozu"-Absatz, keine Quelle, kein Tastatur-Hinweis, keine Sekunden.
  - Die vier Pflichtfragen bleiben erfüllt: Aufgabe in einer kurzen Zeile, Zweck nur hinter einem Info-Symbol.
- **Nach dem Prüfen echte Hilfe statt „Warum":**
  - Bedeutung und Wortart kompakt, Hinweis auf die Form.
  - 2–3 Beispielsätze (Ursprungssatz, Kollokationen, sonst KI-erzeugt und gespeichert).
  - Jedes englische Wort antippbar (Bedeutung im Kontext, US-Lautschrift, Aussprache, als Karte speichern, „Claude fragen").
- **Lücke zeigt Buchstaben-Platzhalter** (einer je Buchstabe) in den Stufen mit Hilfe. In freien Stufen deckt der Knopf „Tipp" sie auf und zählt als Hilfe. Damit ist Kap. 4.1 „Anfangsbreite verrät die Länge nicht" für diese Fälle aufgehoben.

**26.09.2026, abends – Vollausbau statt MVP (Emrahs Vorgabe)**
- Emrah will die komplette App laut Auftrag, keine abgespeckten Zwischenstände.
- Emrahs Trainer-Rückmeldung gilt für **alle** Übungen und Module: automatische Einstufung, Status statt Erklärtexten, Beispiele statt „Warum", Wort-Antippen mit „Claude fragen", Buchstaben-Platzhalter.
- Die Planung aller verbleibenden Phasen läuft parallel. Gebaut wird Phase für Phase ohne Pause.
- Live geht nur, was vollständig fertig und geprüft ist. Ausnahme: der Trainer-Umbau, weil er Emrahs Kritik am laufenden Trainer behebt.

**26.09.2026, abends – Funktionsgleichheit und Tempo (Emrahs Vorgabe)**
- **Nicht schlechter als die alte App:** Alle guten und wichtigen Funktionen der alten App kommen mit hinein. Grundlage ist der Abgleich in `docs/altapp-funktionsabgleich.md`.
- **Mehr Tempo bei gleicher Qualität:**
  - Die Phasen 2–5 werden gleichzeitig in getrennten Worktrees gebaut.
  - Gemeinsame Dateien werden nur additiv geändert, Texte stehen in `src/i18n/parts/*`.
  - Die Helfer lassen nur Unit-Tests und die eigenen E2E-Specs laufen. Die volle Suite und die Prüfer laufen gebündelt beim Zusammenführen.

**26.09.2026, nachts – Phase 1 produktiv (Emrahs Freigabe „Ja, veröffentlichen")**
- `dist/index.html` aus `c29b3dd` liegt auf `JLL8…` (Version `1790444355-d812`) und auf dem Test-Link (`1790443340-1144`).
- Enthalten sind: automatische Einstufung, Status, Platzhalter, Beispiele, Wort-Antippen mit Lautschrift und Aussprache, „Claude fragen".
- Geprüft von data-guard, platform-guard und ux-reviewer (je eine Runde plus Nachprüfung).
- Der Sicherheitsfilter der Sitzung verlangt vor jeder Veröffentlichung auf `JLL8…` Emrahs ausdrückliche Freigabe.

**27.09.2026 – Preply und Serie:** Eine gehaltene Preply-Stunde zählt nur als Extra, nicht als Pflicht für die Serie (Emrahs Wahl).

**27.09.2026 – Kontingent sparen (Emrahs Vorgabe)**
- Keine zusätzlichen Planungs- oder Parallelrunden.
- Zusammenführen und Prüfen in einem Durchgang, mit einem kombinierten Prüfer (Daten + Plattform + UX).
- Die Phasen 6+7 baut ein Helfer.
- Berichte an Emrah nur an Meilensteinen, kurz.

**26.09.2026, ca. 23 Uhr – neue Zusammenarbeit (Emrahs Vorgabe, gilt ab sofort)**
- **Immer nur ein kleines Problem zur Zeit.** Funktionierender Code wird nicht nebenbei mit angefasst.
- **Vor jeder neuen Funktion oder größeren Änderung** wird der Ansatz in ein bis zwei Sätzen skizziert. Umgesetzt wird erst nach Emrahs „Go".
- **Stand der Arbeitszweige** (lokal, noch nicht zusammengeführt):
  - Phase 2 Domäne `worktree-agent-a1fcb727b01f42d07` (fertig)
  - Phase 2 Bildschirme `worktree-agent-aaed2392f8db972dd` (Zwischenstand `07be1e7`, ungetestet)
  - Phase 3 `worktree-agent-aca0f22367f924b04` (fertig)
  - Phase 4 `worktree-agent-ac729d3fd574a67cf` (Zwischenstand `74a13e6`, ungetestet)
  - Phase 5 `worktree-agent-ae7b0211db2f2df80` (fertig)
- Zusammengeführt wird einzeln nacheinander, jeweils mit vollem Testlauf.

**26.09.2026, ca. 22:30 Uhr – ohne „Go" durchbauen (Emrahs Vorgabe, ersetzt das Vorab-Abstimmen)**
- Kein „Go" mehr vor jedem Schritt. Die restlichen Schritte laufen ohne Rückfrage nacheinander:
  1. Phase 2 grün,
  2. Phase 3 + 5 zusammenführen (Streaming vereinheitlichen),
  3. Phase 4 fertig,
  4. ein kombinierter Prüfer,
  5. Test-Link,
  6. Phasen 6+7.
- Effizient, keine Schleifen, kein endloses Nachbessern (A2 gilt streng).
- Ziel: Ergebnis in etwa 12 Stunden.
- Bis zum Go-Live keine Rückfragen. Nach einer Limit-Pause automatisch weitermachen (stündlicher Check-in per `send_later`).
- Veröffentlichen auf `JLL8…` (Go-Live) weiterhin nur mit Emrahs ausdrücklicher Freigabe.

**27.09.2026 – Go-Live der kompletten App (Emrahs Freigabe „Ja, veröffentlichen“)**
- `dist/index.html` aus `86893f7` liegt auf `JLL8…`, Version `1790493495-85c8` (Artefakt-Version 48).
  - Fähigkeiten `db`, `sample`, `downloads`; Vertrag bleibt 0.2.49.
- Rückweg: Phase-1-Version `1790444355-d812` wiederherstellen.
- Offen für Emrahs Rückmeldung am iPhone:
  - Ladezeit (~3 s unter Drossel),
  - automatische Einschätzung beim Öffnen von „Dein Stand“,
  - lange Can-Do-Liste,
  - „Wiederholen“ dreimal auf Heute.
- `writer.compact` bleibt aus.
- Tagesauftrag (Routine „Englisch – Tagesaufgaben & Entdecken-Beiträge“) zeigte auf ein anderes Artefakt (`CzgW…`). Mit Emrahs „Ja“ zurück auf `JLL8…` gestellt:
  - Datenmodell der alten App,
  - schreibt nur `daily/<morgen>` und `feed/<morgen>` und nur, wenn noch nicht vorhanden,
  - nur die 16 Grammatik-IDs,
  - US-Englisch.

**27.09.2026 – Fehlerbehebungs-Paket produktiv (Emrahs Freigabe „Ja, veröffentlichen“)**
- `dist/index.html` aus `bc6750d` liegt auf `JLL8…`, Version `1790506302-f210` (Artefakt-Version 49).
- Grundlage war eine Prüfrunde mit realistischen Claude-Antworten, echten Datenformen und Logik-Grenzfällen:
  - KI-Vorlagen lesen tolerant.
  - Nach Fehlantworten wird der Zwischenspeicher umgangen.
  - Pflicht über 04:00, zwei Tabs, Vorrang der Wiederholungen.
  - Übersetzer automatisch oder mit fester Richtung.
- Rückweg: Version `1790493495-85c8`.
- Offene Lücken laut Abgleich (Scratchpad `abgleich.md`) werden als Nächstes gebaut:
  - Wendungs-Wiederholung,
  - Abfragearten,
  - alte Daten,
  - Kontext-Feld,
  - Wochen-Check, Wochenstreifen,
  - „Als Preply-Stunde“,
  - Kleinigkeiten.

**27.09.2026, nachmittags – Komplettpaket produktiv (Emrahs Freigabe „Ja veröffentlichen“)**
- `dist/index.html` (Code `835f7f0`, Commit `581740e`) liegt auf `JLL8…`, Version `1790518396-3735` (Artefakt-Version 50).
- Enthalten: alle Lücken aus dem Abgleich:
  - Wendungs-Wiederholung und 8 neue Abfragearten,
  - Wochen-Check, Wochenstreifen, alte Daten, Farbthemen, Kontext, Als Preply-Stunde,
  - feste Szenen, Kurs ab l25, Wischgesten, Vibration, Übergänge, Validierungs-Cache, App-Version in der Diagnose.
- Rückweg: Version `1790506302-f210`.
- Offen:
  - Start ~2,7 s unter Drossel.
  - iPhone-Prüfpunkte (Tastatur, Hören, Wischen, Übersetzer).
- Emrah testet jetzt komplett und schickt gesammeltes Feedback.

**27.09.2026, abends – KI-Antworten lesbar (Emrahs Freigabe „Ja“)**
- `dist/index.html` (Code `e65f839`) auf `JLL8…`, Version `1790521986-3347` (Artefakt-Version 51).
- Ursache „unvollständig“ laut Emrahs Diagnose: Claude schrieb in deutschen Texten „…" mit geradem Schlusszeichen, `sample.json` verwarf die Antwort.
- Jetzt:
  - alle Vorlagen über `sample()` mit reparierendem Lesen (`repairJson` in `src/ai/gate.ts`),
  - Anführungszeichen-Regel `QUOTE_RULE` an jedem Prompt,
  - die Lücke bricht lange Antworten zwischen Wörtern um.
- Rückweg: Version `1790518396-3735`.

**27.09.2026, abends – Lernberatung, neue Struktur, Paket 1 produktiv (Emrahs Freigabe „Ja veröffentlichen“)**
- Emrahs Kritik: „schöner, aber keine neuen Ansätze“, „zu verschachtelt“. Neuer Agent `english-teacher` angelegt; Englischlehrer + Lernwissenschaft (`docs/lernberatung.md`) und UX-Beratung (`docs/ux-beratung.md`) als Berater **vor** dem Bauen.
- Emrah: „Ich will alles fertig haben“, dann feste Grenze in zwei Paketen (Emrahs „Ja“): was nicht grün ist, wandert ins nächste Paket statt die Zeit zu verlängern.
- **Paket 1** (`dist/index.html` aus `aac7728`) auf `JLL8…`, Version `1790536760-1f37` (Artefakt-Version 52):
  - „Sag es“ (Pflicht an 4–5 Tagen, `say/<Monat>`), Reparatur-Sätze (`app/repair`, Boxen 1/3/9, „Nochmal, aber besser“), erst Hinweis dann Lösung, Satzbau/Sprint nur Angebot, Lektion an Sag-es-Tagen Angebot, Wendungen ab Stufe 3.
  - Neue Struktur: 4 Reiter (Heute · Üben · Sprechen · Stand), Rückweg zur Herkunft, gemeinsame Übungsleiste, Stand/Wortschatz/Einstellungen entschlackt.
  - Fixes: Begleiter antwortet auf die aktuelle Frage, Übersetzer → Vokabeltrainer, Merkhilfe robuster.
- Rückweg: Version `1790521986-3347`.
- **Paket 2 produktiv** (Emrahs Freigabe „Ja veröffentlichen“): `dist/index.html` aus `57b3c90` auf `JLL8…`, Version `1790541376-265e` (Artefakt-Version 53).
  - Deutsch-Fallen (`app/patterns`) + Preply-Wochenziele, C1-Werkzeugkasten (7 Themen `c1-*`, die 16 alten IDs unberührt) + drei Tonlagen (`tones/<Monat>`), Flüssigkeit 90/60/45 (`fluency/<Monat>`) + „Mein nächster Termin“ (`meeting/<Monat>`); Einstiege unter Sprechen → Training.
  - Emrahs App-Kommentare: neue Wörter klar gegliedert, Trainer-Zähler zählt Nochmal/Reparatur mit, Übersetzer/Claude/Einstellungen auf jeder Seite und in jeder Übung.
  - Rückweg: Version `1790536760-1f37`.
- **Kommentare in der App** sind Emrahs bevorzugter Testweg: an Claude gesendet, mit Ort; nach dem Beheben im Thread antworten und auflösen.

**27.09.2026, spätabends – Neuansatz, dann direkter Neubau (Emrahs Vorgabe)**
- Kritik: buggy, laggy, „stürzt ab“ (Neustart mitten in der Übung), überladen, keine klare User Journey, kein Anki-Modus, Übersetzer → Wortschatz umständlich, Vokabeltrainer nicht auffindbar.
- Konzept `docs/produktkonzept.md` + Prototyp v1 (separates Artefakt `GgEpb8…`, Kopie `docs/prototyp/v1.html`). Emrahs Urteil: „Anki-Modus gar nicht schlecht, Optik auch gut, aber viel zu dünn von den Features insgesamt.“ → **Keine Funktion fällt weg**, dazu das Beste der Marktführer; aufgeräumt, aber featurestark.
- Emrah: „Kannst du nicht gleich die App programmieren? Ich will die App in 12 Stunden fertig haben!“ → Prototyp v2 gestoppt, direkter Neubau der Oberfläche (Daten-/Domänenschicht bleibt). Plan in `docs/neubau/`. Feste Grenze: Was nach 12 Stunden nicht grün ist, kommt ins nächste Paket. Erst Test-Link `AXHkh6…`, `JLL8…` nur mit „Ja, veröffentlichen“.
- **Anki-Modus (Emrahs Wunsch, im Prototyp v1 gutgeheißen):** Im Wortschatz gibt es Aufdecken + 4 Knöpfe (Nochmal/Schwer/Gut/Leicht) mit angezeigten Intervallen und hervorgehobenem App-Vorschlag. Das ist die einzige Ausnahme von „keine Selbstbewertung“ (18:15). Im Tippen-Modus und in allen Übungen bewertet weiter die App.

**29.09.2026, morgens – zwei weitere Fehlerbehebungen live (Emrahs Freigabe „Ja veröffentlichen")**
- `dist/index.html` (Code `550fd09`) liegt auf `JLL8…`, Version `1790667533-ce08` (Artefakt-Version 59).
- Behoben:
  - Der Zähler „n / total" verschwand während „Rückgängig" mit (UndoBar zeigt ihn jetzt selbst an derselben Stelle).
  - Karten ohne Beispielsatz (z. B. aus der Umstellung der alten App) bekamen beim Aufdecken keinen ergänzt – Claude tut das jetzt auch dort einmalig, wie schon beim Tippen.
  - Dabei einen eigenen Fehler beim Bauen gefunden und behoben: ein instabiler `useExamples`-Selektor (neues leeres Array je Aufruf) ließ die Karte endlos neu zeichnen (React-Fehler #185).
- Rückweg: Version `1790618058-dad7`.
- Beide Fixes waren auf dem Test-Link `AXHkh6…` geprüft (Version `1790666982-b9d9`), bevor sie live gingen.
- Zusätzlich per Kommentar geklärt (keine Code-Änderung nötig): die 4 Anki-Bewertungsknöpfe und die feste Deutsch→Englisch-Richtung in der Pflicht sind bewusst so gebaut (Lernwissenschaft + Englischlehrer bestätigt, siehe Sitzungsverlauf); die wachsende Aufgabenzahl bei „Nochmal" ist ebenfalls bekanntes Verhalten, im Backlog als offener Wunsch vermerkt.

**28.09.2026, abends – drei Fehlerbehebungen live (Emrahs Freigabe „Gut klappt kann live gehen")**
- `dist/index.html` (Code `ee760c4`) liegt auf `JLL8…`, Version `1790618058-dad7` (Artefakt-Version 58).
- Behoben seit dem Go-Live:
  - Der Rückgängig-Streifen (Anki „Nochmal") verdeckte kurz Übersetzer, Claude und Einstellungen (`ExerciseBar.middleOverlay` statt eigener absoluter Ebene).
  - „Lehrer-Feedback einfügen“: Kartenvorschlag ohne Beispielsatz scheiterte ohne erkennbaren Grund (Schema verlangt jetzt einen Beispielsatz), dazu „Alle übernehmen“ und die Anzeige „Schon im Wortschatz“.
  - Unregelmäßige Verben im Beispielsatz (z. B. „catch“ → „caught“) wurden nicht erkannt, Kartenanlegen scheiterte deshalb auch außerhalb von Lehrer-Feedback (Chat, „Aus Text“, Wort-Antippen).
- Rückweg: Version `1790611182-9431`.
- Test-Link `AXHkh6…` zeigt denselben Stand (Version `1790617899-8ef7`).

**28.09.2026 – Neubau live: Go-Live der kompletten neuen App (Emrahs Freigabe „Ja veröffentlichen")**
- `dist/index.html` (Code `b130915`) liegt auf `JLL8…`, Version `1790611182-9431` (Artefakt-Version 57).
  - Fähigkeiten `db`, `sample`, `downloads`; Vertrag bleibt 0.2.49.
- Enthalten: der komplette Neubau (5 Reiter, Tageseinheit als Pflicht, Anki-Modus, Lesen/Hören/Schreiben, Sprechen, Claude/Übersetzer/Einstellungen überall, Paket B, Preply-Bereich entfernt, „Lehrer-Feedback einfügen" ersetzt die Preply-Brücke).
- Geprüft: komplette Testsuite (1537/1537 Unit, 528/534 E2E; die 5 restlichen Ausreißer liefen einzeln alle grün, kein echter Fehler).
- Rückweg: die vorherige Live-Version `1790544781-73d9` wiederherstellen.
- Test-Link `AXHkh6…` zeigt denselben Stand (Version `1790608126-4108`).

**28.09.2026 – Preply-Bereich entfällt (Emrahs Vorgabe)**
- Der Preply-Bereich wird komplett aus der Oberfläche entfernt (Seiten, Einstiege, „Nächste Stunde“, Wochenziele, „Als Preply-Stunde“, „Mit Lehrer besprechen“, Preply-Rollen im Wochenplan). Die Daten (`preply/*`, `app/week.preplyNext`, `app/decks.flagged`) bleiben unangetastet in der Datenbank.
- Übrig bleibt nur **„Lehrer-Feedback einfügen“**: Emrah fügt Wörter, Wendungen, Korrekturen oder Übungen aus der Stunde ein. Die App macht daraus Karteikarten (mit Ursprungssatz), Reparatur-Sätze und eine Übungsrunde in der App.
- Emrah hat den Test-Link des Neubaus als „ganz in Ordnung“ bewertet und will die App wie geplant fertig (Paket B). Das Wochenlimit ist knapp, deshalb: keine zusätzlichen Prüfrunden, eine volle Testsuite vor dem Test-Link.

**26.09.2026 – eigene Festlegungen**
- **Tageswechsel um 04:00 Uhr Ortszeit** des Geräts. Eine Einheit nach Mitternacht zählt noch zum Vortag. Der Datumsschlüssel `JJJJ-MM-TT` wird überall mit derselben Funktion berechnet.
- **E2E-Tests laufen gegen den echten Produktions-Build** `dist/index.html`. Der Entwicklungs-Adapter wird dabei **von außen** als nachgebildete `window.claude`-Laufzeit eingespielt (Playwright `addInitScript`). So wird der Produktionspfad mitgetestet, und der Adapter ist nie Teil des Builds.

