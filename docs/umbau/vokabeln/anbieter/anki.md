# Anki mit FSRS – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: groß

Kurzurteil: Anki hat die genaueste und am besten belegte Wiederholungsplanung am Markt. Das sind FSRS-6 mit 21 Parametern, Ziel-Behaltensquote, Zufallsstreuung, Lastausgleich und Geschwister-Sperre, alles offen im Quellcode nachlesbar. Für das Lernen selbst bietet Anki fast nichts: Die Karten baut der Nutzer, Bewertung ist Selbsturteil mit vier Knöpfen, und auch die Tipp-Abfrage zeigt nur einen Buchstaben-Vergleich, benotet aber nicht. Für Emrah übertragbar ist der Planer-Kern: FSRS-Zustand, die Werte für Streuung und Lastausgleich, die Sperre für Geschwister-Karten, die Leech-Regel und die „True retention“-Messung. Nicht übertragbar sind die Selbstbewertung und das Einstellungs-Dickicht.

Vorarbeit: `docs/relaunch/recherche/mara-lernmethodik.md` 2.4 und `docs/umbau/06-marktvergleich.md`. Dort stehen bereits: FSRS-Grundbegriffe, Ziel-Behaltensquote 90 % und die Kritik am Rückstandsberg. Hier folgt die Vertiefung bis auf Parameter- und Code-Ebene.

## 1. Planung

### 1.1 Algorithmus: FSRS-6 (und Rückfall SM-2)
- **Gedächtnismodell DSR.** Jede Karte hat drei Werte. R ist die Abrufwahrscheinlichkeit. S ist die Stabilität, also die Tage, bis R von 100 % auf 90 % fällt. D ist die Schwierigkeit von 1 bis 10. R ändert sich täglich, S und D nur nach einer Wiederholung. „Jede Karte hat ihren eigenen Gedächtniszustand“ [G, [fsrs-abc]].
- **FSRS-6 hat 21 Parameter** (w0–w20). Die Standardwerte sind veröffentlicht: `[0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722, 0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425, 0.0912, 0.0658, 0.1542]` [G, [fsrs-algo]].
- **Neu in FSRS-6, Punkt 1: Die Vergessenskurve ist anpassbar.** Formel: R(t,S) = (1 + factor·t/S)^(−w20), mit factor = 0,9^(−1/w20) − 1. Damit gilt immer R(S,S) = 90 % [G, [fsrs-algo]]. Die Form der Kurve kann also je Nutzer verschieden sein [G, [bench]].
- **Neu in FSRS-6, Punkt 2: Wiederholungen am selben Tag gehen ein.** Formel: S' = S·e^(w17·(G−3+w18))·S^(−w19). S wächst also bei kleinem S schneller und bei großem S langsamer. Bei G ≥ 2 („Hard“ oder besser) soll S nicht sinken [G, [fsrs-algo]]. Ältere Versionen werten nur die erste Wiederholung des Tages, FSRS-6 wertet alle [G, [fsrs-abc]].
- **Stabilität nach Erfolg** (seit FSRS 4 unverändert). S'r = S·(e^w8·(11−D)·S^(−w9)·(e^(w10·(1−R))−1)·w15[bei Hard]·w16[bei Easy] + 1) [G, [fsrs-algo]]. Daraus folgt dreierlei. Schwere Karten wachsen langsamer. Stabile Karten wachsen langsamer. Spät abgerufene Karten (R klein) wachsen stärker, mit Obergrenze [G, [fsrs-algo]].
- **Stabilität nach Vergessen.** S'f = w11·D^(−w12)·((S+1)^w13 − 1)·e^(w14·(1−R)). Beispiel aus dem Wiki: aus S = 100 Tagen werden nach einem Fehler etwa 3 Tage [G, [fsrs-algo]].
- **Schwierigkeit.** Die Startschwierigkeit hängt von der ersten Note ab. Danach gibt es eine lineare Dämpfung (Änderung · (10−D)/9) und eine „Rückkehr zur Mitte“ Richtung D0(4). So verhindert FSRS die „ease hell“ (Karten, die nach einigen Fehlern dauerhaft zu kurze Abstände bekommen) [G, [fsrs-algo]].
- **Optimierer.** Er passt die Parameter an den eigenen Verlauf an. Bei wenigen Hundert Wiederholungen lohnt er sich nicht. Die Standardwerte stammen aus mehreren Hundert Millionen Wiederholungen von ca. 10.000 Nutzern [G, [fsrs-abc]], [G, [anki-opt]].
- **Versionen.** Anki 26.09 (14.09.2026) bringt fsrs-rs 6.6.2, aktuell ist 26.09.3 vom 23.09.2026 [G, [anki-rel]]. FSRS-6 steckt in Anki seit 25.07 [S, 06-Marktvergleich]. Das Benchmark-Projekt testet schon **FSRS-7** mit 34 Parametern und Bruchteil-Intervallen; es soll als einzige Version realistische Prognosen für Wiederholungen am selben Tag geben [G, [bench]]. In Anki ist FSRS-7 laut Release-Seite noch nicht angekündigt [G, [anki-rel]].
- **Wichtig für uns:** Die Bibliothek ts-fsrs nimmt in Version 6 standardmäßig FSRS-7 [G, [tsfsrs]]. Lingo-Engine X hat `ts-fsrs ^5.4.2` im `package.json` [G, eigenes Repo]. Ein Versionssprung ändert also das Modell, nicht nur die API [Vermutung].
- **SM-2 als Rückfall.** Startleichtigkeit („Starting ease“) 2,50. Leicht-Bonus („Easy bonus“) 1,30. Hard-Faktor 1,20. Neues Intervall nach Fehler 0,00, also zurück auf 1 Tag. Abschlussintervall 1 Tag, Leicht-Intervall 4 Tage [G, [src-dc] `DEFAULT_DECK_CONFIG_INNER`], [G, [anki-opt]]. In SM-2 sinkt die Leichtigkeit bei „Again“ um 0,20 und bei „Hard“ um 0,15, bei „Easy“ steigt sie um 0,15; das Minimum ist 1,30 [G, [src-rev] Konstanten `EASE_FACTOR_*`].

### 1.2 Lernschritte (Kurzzeit-Phase)
- **Standard laut Code:** `learn_steps: [1.0, 10.0]` Minuten und `relearn_steps: [10.0]` [G, [src-dc] `impl Default for DeckConfig`].
- **Ablauf:** „Good“ schiebt die Karte zum nächsten Schritt, „Again“ zurück auf Schritt 1. „Hard“ auf Schritt 1 gibt den Mittelwert der ersten zwei Schritte, also etwa 6 Minuten. Gibt es nur einen Schritt, ist es das 1,5-Fache, höchstens 1 Tag mehr. Auf späteren Schritten wiederholt „Hard“ den aktuellen Schritt [G, [anki-opt]]. Im Code: `hard_delay_secs_for_first_step`, Formel `(again·3/2).min(again + DAY)` [G, [src-steps]].
- **Schritte über eine Tagesgrenze** werden auf ganze Tage gerundet [G, [anki-opt]], [G, [src-steps] `maybe_round_in_days`].
- **Mit FSRS** sollen alle Schritte kürzer als 1 Tag sein. Sonst kann FSRS die erste Wiederholung kürzer planen als den letzten Lernschritt [G, [anki-opt]].
- **Vorziehen:** Ist sonst nichts zu tun, zeigt Anki Lernkarten bis zu 20 Minuten zu früh („Learn ahead limit“) [G, [anki-pref]].
- **Tageswechsel:** Standard 4 Uhr („Next day starts at“). So bekommt niemand, der um Mitternacht lernt, zwei Tage auf einmal [G, [anki-pref]]. Das passt zu unserer Regel „Tageswechsel 04:00“ (CLAUDE.md A7).

### 1.3 Geschwister-Karten (gleiches Wort in mehreren Karten)
- **Begriff:** Eine „Note“ ist ein Eintrag mit Feldern, aus dem mehrere Karten entstehen, z. B. vorwärts und rückwärts oder mehrere Lücken. Diese Karten heißen „Siblings“ (Geschwister) [G, [anki-study]].
- **Begraben („bury“):** Beantwortet man eine Karte, kann Anki die Geschwister bis zum nächsten Tag verstecken. Es gibt drei Schalter: neue, Wiederholungs- und tagesübergreifende Lern-Geschwister [G, [anki-opt]]. **Standard im Code: alle drei aus** (`bury_new: false`, `bury_reviews: false`, `bury_interday_learning: false`) [G, [src-dc]].
- **Rangfolge:** Anki sammelt erst Lernkarten im Tagesverlauf, dann tagesübergreifende Lernkarten, dann Wiederholungen, dann neue Karten. Eine spätere Art kann eine frühere nicht begraben. Ist das Begraben neuer Karten aus, kann man am selben Tag eine neue und eine Wiederholungs-Geschwisterkarte sehen [G, [anki-opt]].
- **Sortierung neuer Karten:** Standard ist „Card type, then order gathered“ (`NewCardSortOrder::Template`). Bei ausgeschaltetem Begraben sieht man so erst alle Vorwärts- und dann alle Rückwärtskarten [G, [anki-opt]], [G, [src-dc]].
- **Geschwister im Lastausgleich:** Der Lastausgleich vermeidet Tage, an denen schon eine Geschwisterkarte fällig ist. Gewicht am selben Tag 0,000001, ±1 Tag 0,2, ±2 Tage 0,4 … ±5 Tage 1,0 [G, [src-lb] `SIBLING_MODIFIER_RANGE`]. Laut Code-Kommentar gilt das, „wenn bury siblings an ist“ [G, [src-lb]]. Anki 26.05 verbessert die Streuung von Geschwistern, auch über Voreinstellungen hinweg [S, [anki-rel2605]].

### 1.4 Fuzz (Zufallsstreuung)
- **Zweck:** Karten, die am selben Tag gelernt und gleich bewertet wurden, sollen nicht für immer zusammen fällig werden. Abschalten lässt sich das nicht [G, [anki-study]].
- **Formel** (`fuzz_delta` in [src-fuzz]): Unter 2,5 Tagen gibt es keine Streuung. Darüber gilt Δ = 1 + 0,15·(min(I,7)−2,5) + 0,10·(min(I,20)−7) + 0,05·(I−20), jeweils nur der positive Teil. Der Korridor ist [round(I−Δ), round(I+Δ)] [G, [src-fuzz]].
- **Beispiele aus den Code-Tests:** 7 Tage → 5–9, 17 → 14–20, 37 → 33–41 [G, [src-fuzz] `mod test`]. Eigene Rechnung: 100 Tage → Δ ≈ 7, also 93–107 [Vermutung, gerechnet nach der Formel].
- **Zufallsquelle:** Der Startwert ist Karten-ID + Zahl der Wiederholungen. Das Ergebnis ist deshalb wiederholbar, nicht bei jedem Neuzeichnen anders [G, [src-ans] `get_fuzz_seed_for_id_and_reps`]. Das trifft genau unseren Kap.-15-Fehler „Tagesplan würfelt neu“.
- **Lernkarten:** Sie bekommen bis zu 25 % mehr Zeit, höchstens 5 Minuten (`secs·0.25).min(300)`). Die Knöpfe zeigen das nicht an [G, [src-learn] `learning_ivl_with_fuzz`], [G, [anki-study]].
- **Reihenfolge der Knöpfe:** Mit FSRS gilt Hard < Good < Easy um mindestens 1 Tag (`.max(hard + 1)`) [G, [src-rev] `passing_fsrs_review_intervals`].

### 1.5 Lastausgleich („Load Balancer“) und „Easy Days“
- **Seit Anki 24.11:** Innerhalb des Fuzz-Korridors wählt Anki Tage mit weniger fälligen Karten [S, [ankidroid-220]].
- **Logik** (`find_interval` in [src-lb]): Nur für Intervalle bis 90 Tage (`MAX_LOAD_BALANCE_INTERVAL = 90`), darüber gilt normaler Fuzz. Jeder Tag im Korridor bekommt ein Gewicht: **(1/fällige Karten)² · (1/Zielintervall)**, mal Easy-Day-Faktor, mal Geschwister-Faktor. Dann wird gewichtet gelost, mit demselben Startwert wie beim Fuzz [G, [src-lb]]. Der Faktor 1/Intervall verhindert laut Kommentar eine Schieflage zu späten Tagen [G, [src-lb]]. Gezählt werden nur Karten derselben Voreinstellung („preset“) [G, [src-lb]].
- **Easy Days:** Für jeden Wochentag „Normal“ (1,0), „Reduced“ (0,5) oder „Minimum“ (0,0001) [G, [src-lb] `EasyDay::load_modifier`]. Alle Tage gleich zu setzen ergibt dieselbe Last wie „Normal“. Änderungen wirken nur auf künftige Intervalle [G, [anki-opt]].

### 1.6 Tageslimits
- **Standard:** 20 neue Karten pro Tag, 200 Wiederholungen pro Tag (`new_per_day: 20`, `reviews_per_day: 200`) [G, [src-dc]]. Damit ist die Lücke aus 06-Marktvergleich („20/200 [U]“) geschlossen.
- **Faustregel im Handbuch:** Wer dauerhaft 20 neue Karten am Tag lernt, hat etwa 200 Wiederholungen am Tag [G, [anki-opt]].
- **„New cards ignore review limit“:** Standard aus. Dann zählen neue Karten zum Wiederholungslimit, und ist es erreicht, kommen keine neuen mehr. Das Handbuch rät: bei Rückstand keine neuen Karten [G, [anki-opt]].
- **„Limits start from top“:** Ist es an, gelten die Limits des Elterndecks auch beim Lernen eines Unterdecks [G, [anki-opt]].
- **Limits je Deck:** „Preset“, „This deck“ oder „Today only“ [G, [anki-opt]].
- **Mischung:** Neue Karten und tagesübergreifende Lernkarten laufen standardmäßig gemischt mit den Wiederholungen (`MixWithReviews`) [G, [src-dc]].

### 1.7 Rückstand nach Pause
- **Standard-Sortierung:** „Due date, then random“, die am längsten wartenden zuerst [G, [anki-opt]], [G, [anki-study]]. Unter SM-2 gibt es zusätzlich „Relative overdueness“. Mit FSRS wird diese Option ersetzt; es sortiert nach Abrufwahrscheinlichkeit (Text im Handbuch abgeschnitten) [G, [anki-opt]].
- **Verspätung zählt mit:** Anki rechnet die Wartezeit ein. Nach langer Pause muss man nicht von vorn beginnen [G, [anki-study]]. FSRS plant verspätete Karten besser als SM-2 [G, [fsrs-abc]].
- **Wiederholungslimit als Puffer:** Es glättet Spitzen und erspart „einen Herzinfarkt nach einer Woche Pause“. Versteckte Karten meldet der Abschluss-Bildschirm [G, [anki-opt]].
- **„Reschedule cards on change“:** Standard aus. Eingeschaltet kann beim Wechsel zu FSRS ein Berg fälliger Karten entstehen [G, [anki-opt]]. In Foren wird ein Rückstand von über 1.000 Karten berichtet [S, [reddit-fsrs]].

### 1.8 Leeches (Problemkarten)
- **Regel:** Jeder Fehler bei einer Wiederholungskarte ist ein „Lapse“. Bei **8 Lapses** markiert Anki die Note als „leech“. Danach warnt es alle halbe Schwelle, also bei 12, 16, 20 … [G, [anki-leech]]. Im Code: `leech_threshold_met`, Hälfte aufgerundet [G, [src-rev]].
- **Abweichung Handbuch und Code:** Laut Handbuch wird die Karte zusätzlich ausgesetzt („suspends the card“) [G, [anki-leech]]. Der Code-Standard ist aber `leech_action: TagOnly`, also nur markieren [G, [src-dc]]. Ob die Oberfläche beim Anlegen eines Profils einen anderen Wert setzt, ist nicht belegt [Vermutung].
- **Empfohlener Umgang** [G, [anki-leech]]:
  - Darstellung ändern, Merkhilfe oder Zusatzkarten;
  - unwichtige Karten löschen;
  - **bei Verwechslung warten.** Beispiel aus dem Handbuch: ein Englischlerner verwechselt „disappoint“ und „disappear“. Eins der beiden Wörter aussetzen, bis das andere sitzt.
- **Add-on „Leech Toolkit“:** zusätzliche Werkzeuge für Leeches; das Original war defekt, ein Fork ist auf AnkiWeb [S, [leech-tk]].

### 1.9 Reihenfolge innerhalb eines Tages
- **Neue Karten sammeln („Gather order“):** Standard „Deck“, also Unterdecks alphabetisch von oben, darin nach Position. Weitere Optionen: „Deck, then random notes“, auf- oder absteigende Position, zufällige Notes, zufällige Karten [G, [anki-opt]], [G, [src-dc] `NewCardGatherPriority::Deck`].
- **Neue Karten sortieren („Sort order“):** fünf Optionen, u. a. „Random note, then card type“ (alle Geschwister einer Note nacheinander) und „Random“ [G, [anki-opt]].
- **Wiederholungen sortieren:** neben dem Standard auch nach Intervall (kurz/lang zuerst), nach Leichtigkeit und „Deck, then due date“. Letzteres rät das Handbuch ab, weil man dann am Kontext rät [G, [anki-opt]].
- **Tagesübergreifende Lernkarten:** gemischt, vorher oder nachher. Manche wollen die schweren Karten am Anfang (mehr Zeit) oder am Ende (Leichtes zuerst) [G, [anki-opt]].
- **„Timebox“:** Auf Wunsch zeigt Anki alle n Minuten an, wie viele Karten man geschafft hat [G, [anki-pref]].

### 1.10 Eingriffe von Hand
- **„Custom Study“:** mehr neue Karten heute, Wiederholungslimit heute erhöhen, heute vergessene Karten wiederholen, Vorauslernen. Es entsteht ein „gefiltertes Deck“ [G, [anki-filt]].
- **Vorauslernen:** Für Karten, die noch nicht fällig sind, nutzt Anki einen eigenen Algorithmus. Fast fällige Karten bekommen fast den normalen nächsten Abstand, sehr früh gelernte deutlich weniger [G, [anki-filt]].
- **„Reschedule cards based on my answers“:** Standard an. Aus heißt reiner Vorschau-Modus, die Planung bleibt unberührt [G, [anki-filt]].
- **Weitere Knöpfe** während des Lernens: Karte oder Note begraben, aussetzen, markieren, „Set Due Date“, „Reset card“ (zurück in die Neu-Warteschlange) [G, [anki-study]].
- **„Historical retention“** (Standard 90 %) füllt fehlende Verläufe beim Optimieren auf. „Ignore cards reviewed before“ schließt alte Daten aus, z. B. nach Import fremder Planung [G, [anki-opt]], [G, [src-dc] `historical_retention: 0.9`].
- **Intervall-Faktor unter SM-2:** Formel log(Ziel)/log(aktuell). Beispiel im Handbuch: von 85 % auf 90 % Behalten heißt Faktor 0,65, also rund 35 % häufiger lernen für 5 Prozentpunkte [G, [anki-opt]].
- **Maximales Intervall:** Standard 36.500 Tage (100 Jahre). Ist es erreicht, geben Hard, Good und Easy denselben Abstand [G, [anki-opt]], [G, [src-dc]].

## 2. Abfrage-Leiter
- **Keine eingebaute Leiter.** Anki zeigt Karten so, wie der Nutzer die Vorlagen baut. Eine automatische Steigerung (erst Auswahl, dann Tippen) gibt es nicht [G, [anki-type]], [G, [anki-study]].
- **Bausteine, aus denen Nutzer eine Leiter bauen:**
  - **Erkennen:** Englisch → Deutsch (Standard „Basic“).
  - **Abruf:** Deutsch → Englisch, als „Basic (and reversed card)“ oder „optional reversed“. Im Forum empfohlen: ein Feld „Reverse?“, dann bekommen nur ausgewählte Wörter eine Abrufkarte [G, [forum-design]].
  - **Schreiben:** „Basic (type in the answer)“ mit `{{type:Feld}}` [G, [anki-type]].
  - **Lücke im Satz:** `{{type:cloze:Text}}`. Mehrere Lücken werden durch Komma getrennt eingegeben [G, [anki-type]].
- **Gängiger Rat aus der Szene:** Die meisten Wörter nur als Erkennungskarte, Abrufkarten nur für häufige Wörter, die man sprechen will [S, [studycards-reddit]]. In Chinesisch-Foren gilt: aktiver Wortschatz wächst langsamer, die Abrufkarten sollten weniger sein [S, [studycards-reddit]].
- **Add-on AnkiMorphs:** Es zerlegt Sätze in „Morphe“ (etwa Wörter) und gilt eine Karte ab einem Mindestintervall als bekannt. Dann sortiert es neue Satzkarten so, dass die mit den wenigsten unbekannten Wörtern zuerst kommen („i+1“). Brauchbare i+1-Sätze kommen erst ab 50–100 bekannten Morphen [S, [ankimorphs]].
- **Folge für die Abfrage-Leiter:** Jede Stufe ist eine eigene Karte mit eigenem Gedächtniszustand. Stufen „verdienen“ sich nicht, sie laufen parallel [Vermutung, aus [fsrs-abc] „each card has its own memory state“].

## 3. Bewertung
- **Selbstbewertung mit vier Knöpfen:** Again (1), Hard (2), Good (3, auch Leertaste/Enter), Easy (4). Laut Handbuch nutzt man „Again“ in 5–20 % der Fälle und „Good“ in 80–95 %. Wer mit vier Knöpfen hadert, nimmt nur Again/Good [G, [anki-study]]. Jeder Knopf zeigt den nächsten Termin [G, [anki-study]].
- **Was die Knöpfe bedeuten:** „Hard“ ist eine bestandene Note: richtig, aber mit Zögern. Wer „Hard“ drückt, obwohl er es vergessen hat, bekommt mit FSRS „unvernünftig lange“ Intervalle [G, [anki-opt]]. Halb richtig zählt im Zweifel als Fehler: „wenn es im echten Leben ein Fehler wäre“ [G, [anki-study]].
- **Mit FSRS** verschiebt „Hard“ die Stabilität über w15 (kleiner), „Easy“ über w16 (größer) [G, [fsrs-algo]]. In SM-2 sind es die Faktoren 1,2 bzw. 1,3 [G, [anki-opt]].
- **Tippen benotet nicht.** Die Tipp-Abfrage „ändert nicht, wie Karten beantwortet werden“; der Nutzer entscheidet selbst. Nur ein Tipp-Vergleich pro Karte ist möglich [G, [anki-type]].
- **So vergleicht Anki** (`compare_answer` in [src-type]):
  - Beide Texte werden nach Unicode NFC normalisiert.
  - Ist der Text gleich, erscheint er ganz grün (`typeGood`).
  - Sonst rechnet ein `SequenceMatcher` (Längste-Übereinstimmung, wie Pythons difflib) den Unterschied. Oben steht die eigene Eingabe mit richtigen Teilen grün, falschen rot (`typeBad`) und fehlenden als Bindestriche. Darunter folgt ein Pfeil ↓ und die richtige Lösung mit den fehlenden Teilen markiert (`typeMissed`) [G, [src-type] `to_tokens`].
  - Beispiel aus den Tests: „STRASSE“ gegen „Straße“ zeigt „SS“ rot und „ß“ als fehlend [G, [src-type] Tests].
- **Toleranz-Schalter:** `type:nc` ignoriert Akzente, `type:ci` Groß/Klein, beides kombinierbar [G, [anki-type]]. Eine Tippfehler-Toleranz (z. B. ein Buchstabe Abstand) gibt es nicht [G, [src-type]].
- **Zeit:** Anki misst die Antwortzeit, gekappt bei 60 Sekunden (`cap_answer_time_to_secs: 60`). „The time taken does not influence scheduling.“ [G, [anki-opt]], [G, [src-dc]]. Rat im Handbuch: nach etwa 10 Sekunden lieber aufdecken [G, [anki-study]].
- **Hinweise:** Es gibt keinen eingebauten Hinweis-Knopf mit Wirkung auf die Note. Ein Feld `{{hint:…}}` blendet sich nur auf [Vermutung, nicht in den gelesenen Seiten geprüft].

## 4. Rückmeldung
- **Nach dem Aufdecken:** die Rückseite, wie der Nutzer sie gestaltet hat (Übersetzung, Beispielsatz, Audio, Bild). Anki selbst fügt nichts hinzu [G, [anki-study]].
- **Nach Tippen:** der Buchstaben-Diff (s. o.). Grün heißt gleich, rot falsch, Strich fehlt [G, [src-type]].
- **Audio:** spielt automatisch ab, abschaltbar. Taste R wiederholt [G, [anki-opt]].
- **Eigene Stimme:** „Record Own Voice“ und „Replay Own Voice“ zum Vergleich der Aussprache. Die Aufnahme ist nur vorübergehend [G, [anki-study]].
- **Nachtippen nach Fehler:** nicht eingebaut. Nach „Again“ kommt die Karte über den Lernschritt (10 Min.) zurück [G, [anki-opt]].
- **Erklärung, Kollokationen:** nur, wenn sie auf der Karte stehen [G, [anki-study]].
- **Abschluss:** Bei leerem Stapel gibt es eine Glückwunsch-Seite. Hat das Limit Karten versteckt, steht dort ein Hinweis [G, [anki-opt]].

## 5. Kontext
- **Fester Satz pro Karte.** Der Satz steht im Feld der Note. Wechselnde Sätze gibt es nur, wenn der Nutzer mehrere Notes oder Karten anlegt [G, [anki-type]].
- **Gedächtniszustand gehört zur Karte, nicht zum Wort.** Vorwärts-, Rückwärts- und Lückenkarte desselben Worts haben je eigene D, S, R [G, [fsrs-abc]]. Ein Wort in fünf Sätzen sind fünf getrennte Zustände; nur Begraben und Lastausgleich wissen von der gemeinsamen Note [G, [src-lb]].
- **Reihenfolge-Warnung im Handbuch:** Immer dieselbe Reihenfolge macht es leicht, die Antwort „aus dem Kontext“ zu erraten, und das Gedächtnis bleibt schwächer [G, [anki-opt] zu „Deck, then due date“]. Das deckt sich mit Emrahs Klage „ich erkenne Wörter nur am Satz“ (mara, Punkt 1).
- **Kontext-Wechsel per Add-on:** AnkiMorphs sortiert Satzkarten nach unbekannten Wörtern [S, [ankimorphs]]. Wechselnde Sätze für dieselbe Karte sind nicht belegt gefunden.

## 6. Aktive Nutzung
- **Nicht eingebaut.** Eigene Sätze, Schreiben oder Sprechen mit Zielwörtern prüft Anki nicht. Es gibt nur die eigene Sprachaufnahme ohne Bewertung [G, [anki-study]].
- **Produktion nur als Abrufkarte** (Deutsch → Englisch, getippt). Anki benotet auch hier nicht [G, [anki-type]].
- Ein Add-on für KI-Satzprüfung war in den gelesenen Quellen nicht dabei [nicht belegt gefunden].

## 7. Fortschritt und Transparenz
- **Deckliste und Übersicht:** Neu / Lernen / Fällig je Deck, begrabene Karten grau [G, [anki-study]].
- **„Future Due“:** Prognose der fälligen Karten je Tag, „wenn man keine neuen lernt und nichts vergisst“. Graue Fläche: fällig, wenn man bis dahin gar nicht lernt. Überfällige Karten zählen nicht mit [G, [anki-stats]].
- **„True Retention“-Tabelle:** Behaltensquote nach Zeitraum, getrennt für junge und reife Karten. Reif heißt Intervall ≥ 21 Tage. Gezählt wird nur die erste Wiederholung des Tages. Again ist Fehler, Hard/Good/Easy Bestehen. Mit FSRS soll sie nahe an der Ziel-Behaltensquote liegen. Liegt sie daneben, gibt das Handbuch vier Hebel: optimieren, Voreinstellungen trennen, Leeches umformulieren, Knöpfe richtig benutzen [G, [anki-stats]].
- **FSRS-Grafiken:** Stabilität, Schwierigkeit, Abrufwahrscheinlichkeit je Karte. Dazu „Estimated total knowledge“ = mittlere Abrufwahrscheinlichkeit × Zahl der gelernten Karten [G, [anki-stats]].
- **Workload-Grafik und Simulator:** Die Last steigt steil, wenn die Ziel-Behaltensquote gegen 100 % geht; empfohlen unter 97 % [G, [anki-opt]]. Der **Simulator** rechnet Wiederholungen oder Minuten pro Tag mit den echten Kartenzuständen, eigenen Parametern und Limits. „Help Me Decide“ (experimentell) zeigt die eigene Behaltens-Last-Kurve [G, [anki-opt]]. „Compute minimum recommended retention“ gibt es seit 25.07 nicht mehr [G, [anki-opt]].
- **Karteninfo:** Verlauf je Karte mit Datum, Note, Intervall [G, [anki-stats] Bild „Card Info“].
- **Weitere Grafiken** [G, [anki-stats]]:
  - „Today“: Wiederholungen heute, getrennt nach Lernen, Wiederholen, Neulernen, gefiltert. Das Handbuch warnt, ein schlechter Tag sei kein Signal.
  - „Calendar“: Aktivität als Tagesraster.
  - „Card Counts“: Anteil reif, unbekannt, jung/lernend, ausgesetzt.
  - „Answer Buttons“: Verteilung der vier Knöpfe und Prozent richtig je Kartenart.
  - „Hourly Breakdown“, „Review Intervals“, „Review Time“.
- **Zeitraum:** Standard letzte 12 Monate, umschaltbar auf alles oder Deck-Lebenszeit [G, [anki-stats]].
- **Aktiv vs. passiv:** gibt es nicht als Kennzahl. Nur getrennte Decks oder Kartentypen lassen es auswerten [Vermutung].

## 8. Bildschirmablauf
Nach Handbuch und Bildern (AnkiMobile/Desktop, Ablauf gleich):
1. **Deckliste:** je Deck drei Zahlen: Neu, Lernen, Fällig. Bild: <https://mintcdn.com/anki/4yLyWj6_UVW-sSDI/media/decks_screen.png> [G, [anki-study]].
2. **Übersicht:** Antippen des Decks zeigt die heutigen Zahlen und den Knopf „Study Now“. Bild: <https://mintcdn.com/anki/4yLyWj6_UVW-sSDI/media/study_overview.png> [G, [anki-study]].
3. **Frage:** nur die Vorderseite. Bei Tipp-Karten zusätzlich ein Textfeld. Aufdecken mit Leertaste oder Knopf „Show Answer“ [G, [anki-study]], [G, [anki-type]].
4. **Antwort:** Rückseite; bei Tipp-Karten oben die eigene Eingabe mit Farben, Pfeil, darunter die Lösung [G, [src-type]].
5. **Bewerten:** vier Knöpfe, jeder mit dem nächsten Termin [G, [anki-study]]. Bildschirmfoto eines Nutzers aus dem Forum (Antwortseite mit Knöpfen): <https://us1.discourse-cdn.com/flex002/uploads/anki2/original/3X/7/3/73bbc4a5365c1a57eccc4ac44601a4ad8d869cbc.png> [S, [forum-fsrs]].
6. **Nächste Karte** sofort. Lernkarten kommen nach Ablauf ihres Schritts dazwischen [G, [anki-opt]].
7. **Ende:** Glückwunsch-Seite, ggf. mit Hinweis auf zurückgehaltene Karten [G, [anki-opt]].
- **Statistik-Bildschirm:** <https://mintcdn.com/anki/4yLyWj6_UVW-sSDI/media/Statistics.png>. Workload-Kurve: <https://mintcdn.com/anki/4yLyWj6_UVW-sSDI/media/FSRS_retention.png> [G].
- **AnkiMobile-Store-Bilder:** siehe `scratchpad/bild/teil-a.md`.

## 9. Nutzerstimmen
**Lob**
- Ein App-Store-Rezensent (UK) schreibt, AnkiMobile sei trotz altmodischer Optik „still a powerhouse for spaced repetition“ [S, [apptail-am]].
- Ein US-Rezensent findet den Preis von 25 $ fair, weil damit Desktop-Anki finanziert wird [S, [apptail-am]]. Im US-Store schreibt jemand, der Preis entspreche zwei Monaten Quizlet Plus bei vierfachem Funktionsumfang [S, [as-am]].
- Ein Reddit-Nutzer in r/Anki sagt, das Gefühl der Verzweiflung beim Verpassen einer Karte sei mit FSRS deutlich kleiner als mit SM-2 [S, über 06-Marktvergleich [domenic]]. Weitere Nutzer berichten, sie hätten mit FSRS weniger Wiederholungen pro gelerntem Wort [S, [reddit-fsrs]].
- Ein Lerner in r/languagelearning sagt, getippte Antwortkarten hätten ihm geholfen, sehr schnell Koreanisch zu tippen [S, [reddit-type]].

**Klage**
- Ein Nutzer im Anki-Forum ist verwirrt, weil eine Karte nach 9 Monaten Pause und „Good“ nur 1,6 Monate bekam; er habe weniger Last erwartet [S, [forum-fsrs]].
- Reddit-Nutzer berichten, nach dem Wechsel zu FSRS sei die Last bei reifen Decks „explodiert“ oder habe sich verdoppelt [S, [reddit-fsrs]].
- Store-Rezensenten: man brauche „mehrere Tage“, um die App wirklich zu bedienen; Datei-Import auf iOS fehle [S, [apptail-am]]. Ein US-Rezensent wollte „nur Karteikarten machen“ und war überfordert [S, [as-am]].
- Testberichte nennen die Oberfläche veraltet und die Einrichtung schwer [S, [g2-anki] über 06-Marktvergleich].

## 10. Belege für die Wirkung
- **FSRS-Benchmark** [G, [bench]]: 9.999–10.000 Anki-Sammlungen, ~727 Mio. Wiederholungen. FSRS-6 mit Log Loss 0,3460, RMSE(bins) 0,0653, AUC 0,7034; FSRS-5: 0,3561; FSRS-4.5: 0,3625; HLR (Duolingo-Modell): 0,4694. Besser als FSRS-6 sind FSRS-7 (0,3370) und neuronale Netze (RWKV-Instant 0,2773).
  - *Einordnung:* Gemessen wird, **wie gut die Abrufwahrscheinlichkeit vorhergesagt wird**, nicht, wie viel jemand lernt. Kein Peer-Review. Betrieben von den FSRS-Entwicklern selbst, also möglicher Interessenkonflikt. Der Code ist aber offen und nachrechenbar.
- **„20–30 % weniger Wiederholungen als SM-2“:** laut FSRS-Seite ein Simulationswert, so seit 12.02.2026 vermerkt [G, [fsrs-abc]]. Keine Messung an echten Lernern.
- **KDD 2022** (Ye, Su, Cao; HIT Shenzhen und MaiMemo): ein Planungsalgorithmus über „stochastic shortest path“ mit 12,6 % Verbesserung gegenüber früheren Methoden, eingesetzt in MaiMemo [S, [kdd22]]. Peer-Review (ACM SIGKDD), aber Firmenbeteiligung und nicht Anki selbst.
- **Anki und Medizin-Prüfungen:** nur Beobachtungsstudien, gemischt [S, [ijms]].
  - Cooper et al. 2023 (eine Schule): kein signifikanter Unterschied bei USMLE Step 1 (223,7 gegen 222,6).
  - Deng et al. (72 Studierende): ca. 1 Punkt je 1.700 Karten.
  - Wothe et al. (Umfrage, 165): tägliche Nutzung hängt mit höheren Step-1-Werten zusammen, nicht mit Step 2.
  - *Einordnung:* keine Sprachlerner, keine Zufallszuteilung, Selbstauswahl.
- **Für Vokabeln speziell** fand ich keine kontrollierte Studie mit Anki [nicht belegt gefunden]. Die Wirkung von verteiltem Abrufen an sich ist allgemein gut belegt (siehe Karpicke & Roediger in 06-Marktvergleich).

## 11. Übertragbar auf Lingo-Engine X
- **Fuzz mit festem Startwert übernehmen** (Kartenkennung + Wiederholungszahl, Korridor-Formel aus `fuzz.rs`). Grund: Das streut die Last und bleibt bei jedem Neuzeichnen gleich (Kap. 15: kein Neuwürfeln).
- **Lastausgleich nach Ankis Gewicht anpassen:** (1/fällig)²·(1/Intervall) nur bis 90 Tage, dazu Ruhetag als „Reduced/Minimum“. Grund: Das passt zu Emrahs 10–30 Minuten und zum Ruhetag je Woche (A7).
- **Geschwister-Sperre pro Wort übernehmen:** Satz-, Lücken- und Abrufkarte eines Worts nie am selben Tag, Nachbartage abgestuft (0,2/0,4 …). Grund: Sonst beantwortet die eine Karte die andere, und Erkennen wird zu Raten.
- **Leech-Regel anpassen:** 8 Fehler, dann alle 4. Die Reaktion soll aber automatisch sein: andere Darstellung (neuer Satz, Merkhilfe), bei Verwechslungspaaren eins pausieren. Grund: Handbuch-Rat, ohne Emrah Arbeit zu machen.
- **„True retention“ als ehrliche Kennzahl übernehmen:** nur die erste Abfrage des Tages, getrennt für jung/reif (≥ 21 Tage). Grund: zeigt, ob unser Planer stimmt, und passt zu „ehrliche Zahlen“ (U1).
- **Selbstbewertung verwerfen, Tipp-Diff übernehmen:** Den Buchstaben-Diff (grün/rot/fehlt, NFC, optional Groß/Klein) zeigen, die Note aber automatisch aus Richtigkeit, Zeit und Hilfe bilden. Grund: Entscheidung A7, und Anki zeigt, dass der Diff allein nicht benotet.
- **FSRS-Version bewusst festlegen:** ts-fsrs 5 (FSRS-6) behalten oder geplant auf FSRS-7 wechseln. Same-Day-Formel beachten. Grund: Version 6 der Bibliothek stellt standardmäßig FSRS-7 ein; ein stilles Update änderte unsere Intervalle.
- **Ziel-Behaltensquote mit Lastvorschau** (Simulator-Prinzip) statt Parameter-Menü. Grund: Anki zeigt den steilen Anstieg über 90 %; ein Regler mit Minutenangabe reicht für Emrah.

## Quellen
- [anki-opt] → https://docs.ankiweb.net/deck-options.html · abgerufen 30.10.2026
- [anki-study] → https://docs.ankiweb.net/studying.html · abgerufen 30.10.2026
- [anki-leech] → https://docs.ankiweb.net/leeches.html · abgerufen 30.10.2026
- [anki-filt] → https://docs.ankiweb.net/filtered-decks.html · abgerufen 30.10.2026
- [anki-stats] → https://docs.ankiweb.net/stats.html · abgerufen 30.10.2026
- [anki-type] → https://docs.ankiweb.net/templates/fields.html (Abschnitt „Checking Your Answer“) · abgerufen 30.10.2026
- [anki-pref] → https://docs.ankiweb.net/preferences.html · abgerufen 30.10.2026
- [src-fuzz] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/fuzz.rs · abgerufen 30.10.2026 (raw)
- [src-lb] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/load_balancer.rs · abgerufen 30.10.2026 (raw)
- [src-dc] → https://github.com/ankitects/anki/blob/main/rslib/src/deckconfig/mod.rs · abgerufen 30.10.2026 (raw)
- [src-ans] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/mod.rs · abgerufen 30.10.2026 (raw)
- [src-learn] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/answering/learning.rs · abgerufen 30.10.2026 (raw)
- [src-steps] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/steps.rs · abgerufen 30.10.2026 (raw)
- [src-rev] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/states/review.rs · abgerufen 30.10.2026 (raw)
- [src-queue] → https://github.com/ankitects/anki/blob/main/rslib/src/scheduler/queue/builder/mod.rs · abgerufen 30.10.2026 (raw, nur Funktionsliste gelesen)
- [src-type] → https://github.com/ankitects/anki/blob/main/rslib/src/typeanswer.rs · abgerufen 30.10.2026 (raw)
- [fsrs-algo] → https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm · abgerufen 30.10.2026 (alte fsrs4anki-Wiki leitet hierher um)
- [fsrs-abc] → https://github.com/open-spaced-repetition/awesome-fsrs/wiki/ABC-of-FSRS · abgerufen 30.10.2026
- [bench] → https://github.com/open-spaced-repetition/srs-benchmark · abgerufen 30.10.2026 (README)
- [tsfsrs] → https://github.com/open-spaced-repetition/ts-fsrs · abgerufen 30.10.2026 (README)
- [anki-rel] → https://github.com/ankitects/anki/releases · abgerufen 30.10.2026
- [anki-rel2605] → https://github.com/ankitects/anki/releases/tag/26.05 · nur Suche
- [ankidroid-220] → https://forums.ankiweb.net/t/ankidroid-2-20-changelog/52782 · nur Suche
- [forum-fsrs] → https://forums.ankiweb.net/t/since-switching-to-fsrs-workload-has-gone-up-dramatically/56350 · abgerufen 30.10.2026
- [forum-design] → https://forums.ankiweb.net/t/question-about-vocabulary-card-design/39744 · abgerufen 30.10.2026
- [reddit-fsrs] → https://www.reddit.com/r/Anki/comments/1fhe1nd/7_misconceptions_about_fsrs/ · nur Suche (über Spiegel-Seiten)
- [reddit-type] → https://www.reddit.com/r/languagelearning/comments/1b4pn6a/how_i_make_my_flashcards/ · nur Suche
- [studycards-reddit] → https://studycardsai.com/blog/best-way-to-use-anki-for-language-learning-reddit · nur Suche (Anbieter-Blog, Zusammenfassung von Reddit)
- [ankimorphs] → https://mortii.github.io/anki-morphs/ · nur Suche
- [leech-tk] → https://forums.ankiweb.net/t/i-am-looking-for-broken-add-ons-in-the-latest-anki-by-shige/45386?page=2 · nur Suche
- [as-am] → https://apps.apple.com/us/app/id373493387 · abgerufen 30.10.2026 (Store-Seite mit Rezensionen)
- [apptail-am] → https://apptail.io/app/ankimobile-flashcards-tD/united-kingdom · nur Suche
- [g2-anki] → https://www.g2.com/products/anki/reviews?qs=pros-and-cons · nur Suche (über 06-Marktvergleich)
- [domenic] → siehe Quellenliste in `docs/umbau/06-marktvergleich.md` · dort abgerufen
- [kdd22] → https://scholar.hit.edu.cn/en/publications/a-stochastic-shortest-path-algorithm-for-optimizing-spaced-repeti/ · nur Suche
- [ijms] → https://ijms.pitt.edu/IJMS/article/view/1549 · nur Suche
