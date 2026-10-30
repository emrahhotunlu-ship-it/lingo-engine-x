# Clozemaster – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: groß

Kurzurteil: Clozemaster übt Wörter ausschließlich als Lücke in einem echten Satz, wahlweise per Auswahl (4 Optionen) oder getippt, und plant mit einem sehr einfachen, offen gelegten Raster (gleicher Tag, 1, 10, 30, 180 Tage). Stark ist die Ehrlichkeit des Modells: Der Lerner sieht genau, was „gemeistert“ heißt (4 Treffer in Folge), und Tippen wird doppelt belohnt. Schwach ist, dass der Fortschritt am **Satz** hängt, nicht am Wort: Dasselbe Wort in zehn Sätzen sind zehn getrennte Karten, und ein Fehler wirft den Satz hart auf 0 % zurück. Hinzu kommen Inhaltsfehler aus Freiwilligen-Sätzen (Tatoeba) und eintönige Runden. Für Emrah übertragbar sind die harte Lücke im Satz, der Tipp-Bonus, die offenen Abstände und die Statistik „wie viele Sätze stehen auf welcher Stufe“; die Satz-statt-Wort-Logik und der harte Rücksprung auf null sollten wir nicht übernehmen.

## 1. Planung

**Algorithmus.** Feste Leiter, kein lernendes Modell. „Every sentence starts at 0% Mastered“ [G, cm-master]. Jeder Treffer hebt den Satz eine Stufe und plant die nächste Wiederholung [G, cm-master]:

| Stufe | nächste Wiederholung (Standard) |
|---|---|
| 0 % | am selben Tag |
| 25 % | nach 1 Tag |
| 50 % | nach 10 Tagen |
| 75 % | nach 30 Tagen |
| 100 % | nach 180 Tagen |

- 100 % erreicht man mit vier Treffern in Folge [G, cm-master; G, cm-faq]. Ohne Pause also frühestens etwa am Tag 41 [G, cm-sl].
- Ein Fehler setzt den Satz auf 0 % zurück: „If a sentence is answered incorrectly at any point, it goes back to 0% mastered.“ [G, cm-faq; G, cm-pts]. Es gibt keine Teilstrafe (etwa nur eine Stufe zurück). Ein Testbericht nennt das „the bluntest part of the design“ [G, cm-sl].
- Pro-Nutzer können die Abstände selbst einstellen [G, cm-master; G, cm-int]. Änderungen gelten **nicht rückwirkend**, nur für Sätze, die danach gespielt werden [G, cm-int; G, cm-int-app].
- Nutzer wünschten sich, einen Satz z. B. nur von 100 % auf 75 % statt auf 0 % fallen zu lassen [S, cm-f-90 (Nutzerwunsch)]. Ein Forumsthread „Wrong answers at 50%“ zeigt denselben Wunsch [S, Suchtreffer cm-f-50]. Ob das umgesetzt wurde: nicht belegt gefunden.
- Im Forum heißt es, „Anki reached a 19-year interval by the sixth review“, Clozemaster dagegen erzeuge viel mehr Wiederholungen; „The super-simple spaced repetition is a major source of concern for intense, long term users.“ [S, cm-f-10k (Nutzerstimme)].

**Rechenbeispiel Last (eigene Rechnung nach Standardwerten, [Vermutung]).** Ein neuer Satz, immer richtig beantwortet: Tag 0 (→ 25 %), Tag 1 (→ 50 %), Tag 11 (→ 75 %), Tag 41 (→ 100 %), Tag 221, Tag 401. Das sind 5 Abfragen im ersten Jahr. Bei 15 neuen Sätzen am Tag (Wert eines Forumsnutzers [S, cm-f-10k]) kommen im eingeschwungenen Zustand rund 15 × 4 ≈ 60 Wiederholungen pro Tag hinzu, ohne Fehler. Jeder Fehler startet die Kette neu; deshalb liegen echte Zahlen höher. Zum Vergleich: Die Hilfe empfiehlt 50 Wiederholungen am Tag [G, cm-int].

**Lernschritte innerhalb der Sitzung.** Ein falsch beantworteter Satz kommt am Ende der Runde noch einmal [S, cm-f-teach (Nutzerbeschreibung, keine Herstellerangabe)]. Einen festen Lernschritt in Minuten (wie Anki) gibt es nicht; Stufe 0 heißt nur „same day“ [G, cm-master].

**Geschwister-Karten (gleiches Wort in mehreren Sätzen).** Das ist der Kern des Satz-Modells:
- Die Lücke ist immer das **seltenste** Wort des Satzes laut Häufigkeitsliste (Top ca. 10.000 Wörter). Namen und Pronomen sind aus der Liste entfernt [G, cm-faq; G, cm-blog-cloze].
- Die Sammlungen „Most Common Words“ erlauben „up to 10 sentences with the same missing word“; Sätze werden zufällig gezogen, insgesamt bis 10.000 je Sammlung [G, cm-f-mcw (Antwort des Teams)].
- Die Häufigkeitsliste zählt Beugungsformen einzeln. Seltenere Formen häufiger Verben landen deshalb in späteren Sammlungen [G, cm-f-mcw].
- Im „Fluency Fast Track“ hat jedes Wort laut Nutzererklärung genau **einen** Zielsatz, in vielen anderen Sätzen steht es nur als Kontext [S, cm-reddit-fft; S, Suchtreffer cm-f-fft]. Nutzer kritisieren, das seien zu wenige Wiederholungen je Wort [S, Suchtreffer].
- Fortschritt wird **je Sammlung** getrennt geführt, auch wenn derselbe Satz in mehreren Sammlungen vorkommt: „The sentences may be re-used across collections but their progress is tracked individually per collection.“ Begründung: „different collections test different words“ [G, cm-f-overlap (Antwort eines Teammitglieds, Rolle auf der Seite nicht ausgewiesen)].
- Folge: Die App hat **kein Gedächtnismodell je Wort**. Ob „gegessen“ in zehn Sätzen schon sitzt, weiß sie nicht [Vermutung, aus den drei Belegen oben].
- Nutzer klagen über fast gleiche oder gleiche Sätze in mehreren Bereichen [S, cm-f-1y (Nutzerstimme)].

**Fuzz (Zufallsstreuung) und Lastausgleich.** In der App gibt es die Einstellung „Automatically prevent clustering / Next review fuzz“. Sie streut die Fälligkeiten, damit sich nach einem Lernschub oder einer langen Pause nicht alles an einem Tag ballt [G, cm-int-app]. Die Stärke der Streuung ist nicht angegeben.

**Tageslimits.**
- „Max reviews per round“: wie viele fällige Sätze in einer Runde (nach „Play“) kommen. Wählbar bis 50 oder unbegrenzt [G, cm-int; G, cm-int-app].
- „Max reviews per collection, per day“: Grenze je Sammlung und Tag, standardmäßig aus. Beispiel der Hilfe: 40 über vier Sammlungen = bis zu 10 je Sammlung [G, cm-int; G, cm-int-app].
- Standardwert der Wiederholungen: 20. Die Hilfe empfiehlt mindestens 50, „50 a day should be enough“, weil neue Sätze noch dazukommen [G, cm-int].
- Modus „Play“ mischt neue Sätze mit bis zu **5 fälligen** Wiederholungen je Runde (Standard; Pro kann das ändern, auch auf 0). Modus „Review“ bringt nur fällige Sätze [G, cm-faq; G, cm-sl].
- Kostenlose Konten: laut Testbericht 10 Sätze je Runde und 30 Sätze am Tag [G, cm-fu]; ein Nutzer bestätigt die 30 am Tag [S, cm-as (Nutzerstimme)]. Clozemasters eigene Seiten nennen die Grenze uneinheitlich [G, cm-sl].
- Eine Runde hat im Bild 9 bzw. 10 Sätze (Zähler oben rechts) [G, Bild cm-as-1, cm-as-3].

**Rückstand nach Pause.** Außer Fuzz und den Tageslimits gibt es keine eigene Regel. Nutzer berichten vom Rückstandsberg als „stressful and demotivating“ [S, cm-f-boring (Nutzerstimmen)]. Die „Review Forecast“ sei für die Planung „all but useless“, weil sie fällig werdende Sätze zählt, nicht an dem Tag spielbare [S, cm-f-90 (Nutzerstimme)]. Ein Update der Vorschau war laut Team geplant [S, cm-f-90].

**Problemwörter (Leeches).** Keine automatische Erkennung belegt. Werkzeuge sind von Hand:
- „Ignore“: Satz fliegt aus der Sammlung, zählt nicht mehr. Möglich auch für „every sentence that uses the same cloze-word“ [G, cm-ignore].
- „Do not review“: Satz bleibt, kommt aber nicht mehr in Wiederholungen [G, cm-dnr].
- Ignorierte Sätze kann man auf 100 % setzen („Master“) [G, cm-ign100].
- Knopf „KNOWN“ im Spiel (Tastenkürzel Alt+K laut Nutzer) setzt einen Satz direkt auf gemeistert [G, Bild cm-as-1; S, cm-f-10k]. Eine Bestätigungsabfrage für „manual master/reset“ lässt sich ein- und ausschalten [G, cm-popup].
- Nutzer markieren Problemsätze als Favorit und setzen sie von Hand auf 0 % [S, cm-f-90].
- „Favorites“ ist ein eigener Spielmodus mit fester Punktzahl 2 je Treffer [G, cm-pts].

## 2. Abfrage-Leiter

Clozemaster hat **keine** feste Leiter je Wort. Der Lerner wählt die Abfrageart je Runde selbst [G, cm-text; G, cm-sl].

| Modus | Was passiert | Beleg |
|---|---|---|
| Multiple Choice | Lücke im Satz, 4 Wörter zur Wahl | [G, cm-sl; G, Bild cm-as-1] |
| Text Input | Lückenwort tippen | [G, cm-text] |
| Listening (Cloze-Listening) | Satz erst hören, dann sehen, Lücke füllen; für 21 Sprachen | [G, cm-faq] |
| Transcribe / Full sentence input | ganzen gehörten Satz tippen; nur im Listening-Skill | [G, cm-text; G, cm-sl] |
| Speaking | Antwort laut sagen; iOS seit Juli 2026, Rückmeldung nicht dokumentiert | [G, cm-sl] |
| Cloze-Reading | Lücken über mehrere aufeinanderfolgende Sätze, Wikipedia-Texte, eigene Texte einfügbar (Pro) | [S, Suchtreffer cm-f-reading; S, cm-as (Nutzerstimme)] |
| Grammar Challenges | Sammlungen je Grammatikpunkt (z. B. ser/estar, por/para), Lücke = Funktionswort | [G, cm-sl; S, Suchtreffer] |
| Radio | freihändig hören | [G, cm-news-elev; S, cm-as (Nutzerstimme)] |

- **Ab wann Tippen statt Auswählen?** Keine automatische Umschaltung belegt. Der Anreiz ist die Punktzahl: Tippen bringt 8, Auswahl 4 Grundpunkte [G, cm-pts]. Ein Testbericht nennt Auswahl „Easy level“, Tippen „harder level“ [G, cm-fu].
- **Wie wird aus Erkennen aktives Benutzen?** Nur über die freie Wahl des Lerners: Nutzer tippen bewusst, „because I want to learn endings“, um vom passiven in den aktiven Wortschatz zu kommen [S, cm-f-90]. Eigene Sätze oder freie Produktion gibt es nicht [Vermutung; nicht belegt gefunden].
- **Ablenker bei Auswahl:** Wie sie gewählt werden, ist nicht offen gelegt. Nutzer finden manche Optionen „obviously wrong; mistyped or poorly-chosen“ [S, cm-as]. Ein Rezensent meint, bessere Ablenker würden das Training wirksamer machen [S, Suchtreffer]. Übersetzungen aller Auswahlwörter kann man sich anzeigen lassen [G, cm-cat (Artikeltitel)].
- **„Teach Me“ (V5-Oberfläche):** Beim Tippen erscheint vor der Antwort ein Knopf „Teach Me“. Er zeigt das Lösungswort grau im Feld zum Abtippen; das zählt dann als falsch, der Satz kommt am Rundenende wieder [S, cm-f-teach (Nutzerbeschreibung); G, Bild cm-as-3].
- **Hinweis:** erscheint „above the missing word before you answer“, abschaltbar [G, cm-hint]. Was genau er zeigt, sagt die Hilfe nicht. Ein Testbericht beschreibt nach Fehltipp einen zweiten Versuch mit Hinweis, „how many letters off“ [G, cm-fu]. Ein Erster-Buchstabe-Hinweis war laut Team geplant [S, cm-f-90].
- Die Feldbreite kann sich der Wortlänge anpassen oder für alle Wörter gleich breit sein (Einstellung „Text Box Size“) [G, cm-box]. Die Wortlängen-Variante ist selbst ein Längenhinweis [Vermutung].

**Einstellungen, die die Schwierigkeit einer Abfrage verändern** (alle vom Lerner, nicht vom System):

| Einstellung | Wirkung | Beleg |
|---|---|---|
| Übersetzung ausblenden | Satzübersetzung nicht sichtbar; gilt je Sprachpaar | [G, cm-hide] |
| Hinweise an/aus | Hinweis über der Lücke | [G, cm-hint] |
| Text Box Size | Feld in Wortlänge oder gleich breit | [G, cm-box] |
| Enter Submits Empty | Enter bei leerem Feld schickt eine leere (falsche) Antwort | [G, cm-enter] |
| Satz-Aussprache, Stimme, Sprechtempo | Audio vor/nach der Antwort | [G, cm-settings (Artikeltitel)] |
| „Automatically Show Sentence After First Listen“ | im Listening-Skill: Satz nach erstem Hören einblenden | [G, cm-cat (Artikeltitel)] |
| Max reviews per round / per collection | Menge der Wiederholungen | [G, cm-int] |
| Next review fuzz | Streuung der Fälligkeiten | [G, cm-int-app] |

**Sammlungen (Inhalt, aus dem die Abfragen kommen).**
- „Most Common Words“ in Häufigkeitsbändern (100, 500, 1.000 … bis 50.000); die Bänder überschneiden sich nicht, jeder Satz kommt nur einmal in diesen Sammlungen vor [G, cm-f-mcw; G, cm-sl].
- „Fluency Fast Track“: zehn Level nach Häufigkeit, je Wort ein Zielsatz [G, cm-sl; S, cm-reddit-fft].
- CEFR-Leitern nur für einige Sprachen (z. B. Spanisch und Deutsch A1–B2) [G, cm-sl].
- Themenlisten („sentence lists“, z. B. Tiere, Orte, Hobbys) mit Audio auf der Website; Sätze lassen sich in eine eigene Sammlung übernehmen [G, cm-lists].
- Eigene Sammlungen per CSV/TSV [G, cm-cat].
- Englisch als Zielsprache ist im Angebot (u. a. Sprachwahl im Bild), Details zu englischen Business-Sammlungen: nicht belegt gefunden.

## 3. Bewertung

- **Automatisch**, keine Selbstbewertung. Ausnahme: manuelles „Known/Master“ und „Reset“ [G, cm-popup; G, Bild cm-as-1].
- **Punkte:** (4 bei Auswahl, 8 beim Tippen) × (Stufe in % ÷ 25). Beispiel: Auswahl bei 50 % = 8 Punkte. Hinweis beim Tippen halbiert, zu frühes Wiederholen halbiert, falsch = 0 [G, cm-pts]. Bei Stufe 0 % ergibt die Formel 0 Punkte [Vermutung, rechnerisch; ob es dafür eine Untergrenze gibt, ist nicht belegt].
- **Tippfehler- und Akzent-Toleranz:** Offiziell nicht dokumentiert. Im Forum häufen sich Klagen: korrekte Akzentbuchstaben im Vietnamesischen und Griechischen als falsch gewertet, gerader statt typografischer Apostroph abgelehnt [S, Suchtreffer cm-f-accent, cm-f-apos]. Es gibt Tastenkürzel für Akzente im Tippmodus [S, Suchtreffer]. Daraus folgt: Der Abgleich ist eher **zeichengenau** [Vermutung].
- **„Fast richtig“:** Beim Tippen färbt sich die Eingabe grün, solange sie stimmt, und rot, sobald sie abweicht [G, cm-fu]. Ein Fehlversuch mit Hinweis ist möglich [G, cm-fu]. Wird am Ende falsch gewertet, fällt der Satz auf 0 % [G, cm-faq].
- **Rolle der Zeit:** Keine Belege, dass Antwortzeit die Note beeinflusst. Nur „zu früh wiederholt“ halbiert die Punkte [G, cm-pts].
- **Übersicht der Ausgänge (eigene Zusammenstellung aus den Belegen):**

| Eingabe | Wertung | Folge für den Satz | Punkte |
|---|---|---|---|
| Auswahl richtig | richtig | eine Stufe hoch | 4 × Stufe/25 |
| getippt richtig | richtig | eine Stufe hoch | 8 × Stufe/25 |
| getippt richtig mit Hinweis | richtig | eine Stufe hoch | halbiert |
| richtig, aber vor Fälligkeit | richtig | Stufe hoch (Details nicht belegt) | halbiert |
| „Teach Me“ benutzt | falsch | 0 %, kommt am Rundenende wieder | 0 |
| falsch / leer | falsch | zurück auf 0 % | 0 |
| „KNOWN“ gedrückt | manuell gemeistert | 100 % | nicht belegt |

  Belege: [G, cm-pts; G, cm-faq; G, cm-enter; S, cm-f-teach; G, Bild cm-as-1].
- **Synonyme / mehrere richtige Antworten:** Ein Forumsthread „More than one answer“ zeigt, dass dies ein Thema ist [S, Suchtreffer]; eine offizielle Regel wurde nicht gefunden.

## 4. Rückmeldung

- **Nach richtig:** Lösungswort grün im Satz bzw. unterstrichen, Übersetzung des Satzes, Satz-Audio spielt automatisch, Zeile „Next review: 1 day“ (aufklappbar), Knöpfe EXPLAIN und NEXT [G, Bild cm-as-1, cm-as-2; S, cm-as (Nutzerstimme: „audio automatically plays after selecting your answer“)].
- **Nach falsch:** richtige Antwort wird sofort gezeigt [G, cm-fu]. Satz zurück auf 0 % [G, cm-faq].
- **Erklärung („Explain“):** von ChatGPT erzeugt, teils vorab gespeichert, sonst auf Knopfdruck [G, cm-faq; G, cm-news-explain (04.06.2024)]. Seit August 2026 laut Testbericht Wort-für-Wort-Zerlegung, wörtliche Übersetzung und Grammatiknotizen [G, cm-sl]. Fehlerhafte Erklärungen kann man melden [G, cm-faq]. Nutzer loben „Explain“ als Kaufgrund [S, cm-as].
- **Werkzeugleiste je Satz:** Teilen, Bearbeiten (Stift), Melden (Fahne), Stern (Favorit), 0.5x-Audio, KNOWN [G, Bild cm-as-1].
- **Audio:** Sprachsynthese (TTS) je nach Gerät [G, cm-faq], Geschwindigkeit einstellbar [G, cm-settings], „Loop“ zum endlosen Wiederholen (Blog 16.07.2024) [S, Suchtreffer cm-loop]. Cloze-Listening nutzt echte Muttersprachler-Aufnahmen (Web-Beta) [S, Suchtreffer cm-f-cl].
- **Diff (Unterschied markieren):** nicht belegt gefunden.
- **Kollokationen:** nicht belegt gefunden.
- **Nachtippen:** nicht verpflichtend; nur über „Teach Me“ freiwillig [S, cm-f-teach].
- **Rundenende:** Zusammenfassung der gerade wiederholten Sätze [G, cm-fu].

## 5. Kontext

- **Fester Satz je Karte.** Der Gedächtniszustand gehört eindeutig zum **Satz (in einer Sammlung)**, nicht zum Wort [G, cm-master („Every sentence starts at 0%“); G, cm-f-overlap; G, Bild cm-as-4 („Mastery measures your progress in learning sentences for each collection“)].
- Ein Satz wird bei Wiederholung immer gleich gezeigt; ein Wechsel der Sätze für dasselbe Wort passiert nur, weil es zufällig mehrere Zielsätze gibt [Vermutung, aus cm-f-mcw].
- **Satzquelle:** Tatoeba, also Freiwillige: „All sentences and translations are from Tatoeba’s massive and awesome dataset.“ [G, cm-faq]. Der neue Fluency Fast Track wurde laut Nutzern mit bezahlten Muttersprachler-Sätzen neu gebaut, nicht für jede Sprache [S, Suchtreffer cm-f-fft].
- **Zielwort-Wahl:** seltenstes Wort im Satz [G, cm-faq]. Nachteil: ein seltener Name oder ein Nebenwort kann die eigentlich wichtige Lücke verdrängen [G, cm-f-mcw (Nutzereinwand)]. Zielwörter in Redewendungen „lehren das Wort nicht“ [S, cm-f-90].
- Sätze einer Runde hängen inhaltlich nicht zusammen [G, cm-sl]. Ein Nutzer findet gerade das gut, weil man das Nächste nicht vorhersagen kann [S, cm-as].
- Cloze-Reading bietet zusammenhängende Texte (ca. 500 Wikipedia-Einleitungen je Sprache) [S, Suchtreffer cm-f-reading; S, cm-as]. Ein freier Bereich „Comprehensible Input“ hat 17–24 verbundene Texte je Sprache [G, cm-sl].

## 6. Aktive Nutzung

- Eigene Sätze, Schreiben oder freies Sprechen mit Zielwörtern: **nicht belegt gefunden**.
- Am nächsten dran: Tippen des Lückenworts (gesteuerte Produktion) und „Transcribe“ (ganzen Satz nach Gehör tippen) [G, cm-text].
- Speaking (iOS ab Juli 2026): man sagt die Antwort laut; wie geprüft wird, dokumentiert Clozemaster nicht [G, cm-sl]. Ein Speaking-Skill war früher schon einmal verschwunden [S, Suchtreffer cm-speak-gone].
- Eigene Sammlungen per CSV/TSV hochladen [G, cm-cat (Artikeltitel)]. So kann ein Lerner eigene Zielsätze einspielen [Vermutung].

## 7. Fortschritt und Transparenz

- **Stufenbalken je Sammlung:** „Collection Mastery“ zeigt z. B. 27,50 %, wie viele Häkchen es insgesamt gibt („6.000 ✓ to earn“ = 1.500 Sätze × 4), und Balken mit der Zahl der Sätze je Stufe 0/25/50/75/100 % [G, Bild cm-as-4].
- **Fälligkeit:** „Ready for review 42“ als Widget, „Next review: 1 day“ nach jeder Antwort [G, Bild cm-as-5, cm-as-2]. Review Forecast (Vorschau) [S, cm-f-90].
- **Behaltensrate:** nicht als Prozentwert belegt. Pro hat „more stats“ [G, cm-faq]; ein Wochen-Liniendiagramm und ein 7-Tage-Schnitt sind beschrieben [G, cm-fu].
- **Aktiv vs. passiv:** nicht getrennt ausgewiesen [nicht belegt gefunden].
- **Fast-Track-Tracker:** im Forum als neue Funktion besprochen [S, Suchtreffer cm-f-tracker].
- **Motivation:** Punkte, Level mit GIF, Ranglisten, Serie, Tagesziel in Punkten [G, cm-fu; S, cm-as]. „Days played“ als eigener Zähler [G, Bild cm-as-5].

## 8. Bildschirmablauf

Nach den App-Store-Bildern (siehe Bildliste Teil B, Clozemaster) und der Hilfe:

1. **Start:** Sammlung wählen, „Play“ (neu + bis 5 fällige) oder „Review“ (nur fällige). Spieloptionen: Multiple Choice, Text Input, Listening [G, cm-faq; G, cm-text].
2. **Abfrage (Auswahl):** Oben Fortschritt der Runde (✓ 0 ✗ 0, Balken, Restzahl). Satz in der Zielsprache, Lücke im Satz, darunter die Übersetzung (abschaltbar), darunter 4 Wortknöpfe. Werkzeuge: Audio, 0.5x, Stern, KNOWN. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/33/73/dd/3373dde0-57a7-fdf3-da39-d4600344e894/APP_IPHONE_65_03.png/600x1300bb-60.jpg [G].
3. **Abfrage (Hören + Tippen):** Lautsprecher groß, leeres Feld in der Satzposition, Übersetzung eingeklappt, Knopf „TEACH ME“, Bildschirmtastatur. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ef/b5/21/efb52153-3ba1-11b6-97f7-ea17dd968f50/APP_IPHONE_65_05.png/600x1300bb-60.jpg [G].
4. **Rückmeldung:** gewähltes Wort grün (falsch: Lösung sichtbar), Satz-Audio, Leiste „Next review: 1 day“ mit Teilen/Bearbeiten/Melden, großer Knopf EXPLAIN, darunter NEXT. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/ac/6b/da/ac6bda2c-7970-9527-7376-b52121a93ad4/APP_IPHONE_65_02.png/600x1300bb-60.jpg [G].
5. **Explain (optional):** KI-Erklärung des Satzes [G, cm-faq].
6. **Rundenende:** Zusammenfassung der Sätze, Punkte, ggf. Level-Aufstieg mit GIF [G, cm-fu; S, cm-as].
7. **Statistik:** „Collection Mastery“ mit Stufenbalken. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/8e/f5/3a/8ef53a82-c7e9-6a24-d11d-34fab418e1ac/APP_IPHONE_65_04.png/600x1300bb-60.jpg [G].

## 9. Nutzerstimmen

**Lob**
- [S, cm-as] App-Store-Nutzer (Polnisch): Keine App habe ihn besser vorbereitet, Wörter in echten Alltagssituationen zu benutzen; „Explain“ habe die App stark verbessert. Grammatik brauche aber ein Lehrbuch.
- [S, cm-as] App-Store-Nutzer (Französisch, Pro): Die freien Sätze hätten sein Verständnis von Ausdrücken und Satzbau „faster then anything I’ve used before“ verbessert; Cloze-Reading mit eigenen Texten sei der beste Teil.
- [S, cm-as] App-Store-Nutzer (Koreanisch, Anki-Nutzer): viel spannender als Anki, Audio nach der Antwort und „Explain“ als Kaufgrund.
- [S, cm-f-1y] Forumsnutzer nach einem Jahr Deutsch: „a solid replacement for Duolingo for daily vocabulary practice“; viel und gut geordneter Inhalt.
- [S, cm-f-10k] Forumsnutzer (Russisch, 10.000 Sätze gemeistert in ca. zwei Jahren bei ca. 15 neuen am Tag): Lob dafür, dass Wortformen einzeln geübt werden.

**Klage**
- [S, cm-as] App-Store-Nutzer auf C1: „unacceptable number of basic errors“ (Rechtschreibung, fehlende Präpositionen, doppelte Wörter); Meldungen würden kaum korrigiert, deshalb gekündigt.
- [S, cm-f-90] Forumsnutzer: automatische Beherrschung fühle sich wie Schummeln an: „I think it's cheating … to declare that I've mastered a sentence.“
- [S, cm-f-10k] Forumsnutzer: Bei Russisch kehren dieselben Grundwörter in vielen Formen zurück, nur ca. zwei lohnende neue Wörter je zehn Lektionen: „I don’t get enough out of it anymore.“
- [S, cm-f-boring] Forumsnutzer: Übungen „monotonous/flat and make me sleepy“; der Rückstand stresse.
- [S, cm-as] App-Store-Nutzer: KI-Bilder „creepy“, manche Auswahl-Optionen offensichtlich falsch. Dazu gab es Protest im Forum gegen KI-Inhalte [S, cm-f-ai].
- [S, cm-as] App-Store-Nutzer: Seit der Begrenzung auf 30 Sätze am Tag (kostenlos) „useless unless you overpay for Pro“.

## 10. Belege für die Wirkung

- **Keine Studie zu Clozemaster selbst** gefunden [S, Suchergebnis; nicht belegt gefunden].
- Clozemaster beruft sich auf eine Untersuchung von Nation und Webb zu zwölf Vokabelübungen: Lückenaufgaben seien die zweitwirksamste, mit mehreren Fragen zum selben Zielwort die wirksamste [G, cm-blog-cloze (laut Anbieter, ohne Jahr und Fundstelle)]. Einordnung: Das prüft die Übungsart, nicht die App. Die Quelle ist nicht genau angegeben; die Aussage „mehrere Fragen zum selben Zielwort“ spricht eher **gegen** das eigene Satz-Modell, das jedes Wort meist nur in einem Satz abfragt [Vermutung].
- Weitere Begründung des Anbieters: Zipf-Verteilung (wenige Wörter decken viel Text ab) [G, cm-blog-cloze]. Das ist Korpuswissen, kein Lernerfolg.
- Eigene Lerndaten (Behaltensrate, Abschlussquoten) veröffentlicht Clozemaster nicht [G, cm-blog-cloze („reports no internal learner metrics“)].
- Ein vom Anbieter veröffentlichter Vergleichsartikel räumt ein, dass keiner der Ansätze „definitive proof“ habe [S, Suchtreffer cm-blog-vs].
- Gesamturteil: Wirkung nur indirekt (Abruf im Kontext, Spacing allgemein gut belegt). App-spezifische Daten fehlen [Vermutung].

## 11. Übertragbar auf Lingo-Engine X

- **Übernehmen: Lücke im echten Satz, Lösung im Satz eintragen.** Das ist genau unser Kap.-15-Punkt „Eingabefeld in der Lücke“; Clozemaster zeigt, dass es am Handy trägt.
- **Übernehmen: Tippen höher bewerten als Auswählen** (bei uns nicht als Punkte, sondern als stärkerer Lernnachweis für „aktiv“). Clozemaster gibt 8 statt 4 Punkte; das sendet das richtige Signal, ohne Auswahl zu verbieten.
- **Übernehmen: offene, verständliche Stufen mit Satz „wann kommt es wieder“** („Next review: 1 day“ direkt nach der Antwort) und eine Statistik „wie viele Wörter auf welcher Stufe“ als Balken. Das stärkt die ehrliche Fortschrittsanzeige (Kap. 2 Nr. 2).
- **Verwerfen: Gedächtniszustand am Satz.** Für Emrah muss der Zustand am Wort (bzw. an der festen Einheit) hängen, Sätze wechseln. Sonst zählt „gemeistert“ Sätze statt Wörter, und dasselbe Wort wird mehrfach unabhängig geplant.
- **Verwerfen: Fehler = zurück auf 0.** Bei FSRS sinkt die Stabilität abgestuft; ein Totalreset nach 180 Tagen wegen eines Tippfehlers frustriert (siehe Forum).
- **Anpassen: Fuzz und Limits je Tag** (Clustering verhindern) sind sinnvoll; unser Plan sollte Rückstand nach Pause glätten statt „Review Forecast“, die nichts über heute Spielbares sagt.
- **Anpassen: „Teach Me“** als ehrlicher Ausweg: Lösung grau vorgeben, abtippen lassen, als „mit Hilfe“ werten und am Ende der Sitzung wieder vorlegen. Passt zu unserer Regel „App benotet aus Richtigkeit, Zeit und Hilfe“.
- **Warnung: Inhaltsqualität.** Freiwilligen-Sätze mit Fehlern zerstören Vertrauen auf C1. Unsere Sätze brauchen weiter die Lehrer-Prüfung.

## Quellen

| Kürzel | URL | Status |
|---|---|---|
| cm-master | https://docs.clozemaster.com/article/37-how-do-i-master-something | abgerufen 30.10.2026 |
| cm-pts | https://docs.clozemaster.com/article/103-how-do-points-work | abgerufen 30.10.2026 |
| cm-int | https://docs.clozemaster.com/article/40-how-do-i-change-review-interval-settings | abgerufen 30.10.2026 |
| cm-int-app | https://docs.clozemaster.com/article/81-how-do-i-change-the-review-interval-settings-in-the-app | abgerufen 30.10.2026 |
| cm-text | https://docs.clozemaster.com/article/74-how-do-i-select-text-inp | abgerufen 30.10.2026 |
| cm-hint | https://docs.clozemaster.com/article/68-how-do-i-enable-disable-hints | abgerufen 30.10.2026 |
| cm-ignore | https://docs.clozemaster.com/article/16-how-do-i-ignore-sentences | abgerufen 30.10.2026 |
| cm-ign100 | https://docs.clozemaster.com/article/93-how-do-i-change-ignored-sentences-to-100-mastered | abgerufen 30.10.2026 |
| cm-dnr | https://docs.clozemaster.com/article/80-how-do-i-add-sentences-to-the-do-not-review-category | abgerufen 30.10.2026 |
| cm-popup | https://docs.clozemaster.com/article/42-how-do-i-enable-disable-the-manual-master-reset-confirmation-popup | abgerufen 30.10.2026 |
| cm-listen | https://docs.clozemaster.com/article/65-how-do-i-play-the-listening-mode | abgerufen 30.10.2026 (ohne Details) |
| cm-cat | https://docs.clozemaster.com/category/38-playing-clozemaster | abgerufen 30.10.2026 (Artikelliste) |
| cm-settings | https://docs.clozemaster.com/category/5-game-settings | abgerufen 30.10.2026 (Artikelliste) |
| cm-box | https://docs.clozemaster.com/article/21-how-do-i-change-the-text-box-size-to-fit-the-length-of-the-word | abgerufen 30.10.2026 |
| cm-hide | https://docs.clozemaster.com/article/55-how-do-i-hide-translations | abgerufen 30.10.2026 |
| cm-enter | https://docs.clozemaster.com/article/4-isable-the-enter-submits-empty-option | abgerufen 30.10.2026 |
| cm-lists | https://docs.clozemaster.com/article/106-how-to-use-sentence-lists | abgerufen 30.10.2026 |
| cm-faq | https://www.clozemaster.com/faq | abgerufen 30.10.2026 |
| cm-blog-cloze | https://www.clozemaster.com/blog/cloze-tests-spaced-repetition-faster-language-learning/ | abgerufen 30.10.2026 |
| cm-blog-vs | https://www.clozemaster.com/blog/?p=7648 | nur Suche |
| cm-news-explain | https://news.clozemaster.com/2024/06/04/clozemaster-integrates-advanced-ai-driven-explanation-feature-for-enhanced-language-learning/ | abgerufen 30.10.2026 |
| cm-news-elev | https://news.clozemaster.com/2024/06/24/elevate-your-language-skills-with-clozemaster/ | abgerufen 30.10.2026 |
| cm-loop | https://news.clozemaster.com/2024/07/16/perfect-your-pronunciation-with-clozemasters-new-loop-feature/ | nur Suche |
| cm-f-mcw | https://forum.clozemaster.com/t/questions-about-most-common-words/9834 | abgerufen 30.10.2026 |
| cm-f-fft | https://forum.clozemaster.com/t/fluency-fast-track-most-common-words/38624 | abgerufen 30.10.2026 (Details nur aus Suche) |
| cm-f-overlap | https://forum.clozemaster.com/t/is-there-overlap-or-100-unique-content-in-each-collection/59086 | abgerufen 30.10.2026 |
| cm-f-90 | https://forum.clozemaster.com/t/another-90-day-review/7515 | abgerufen 30.10.2026 |
| cm-f-1y | https://forum.clozemaster.com/t/my-thoughts-after-one-year-with-clozemaster-german/40602 | abgerufen 30.10.2026 |
| cm-f-10k | https://forum.clozemaster.com/t/10k-mastered-in-the-russian-fast-track-some-feedback/39223 | abgerufen 30.10.2026 |
| cm-f-boring | https://forum.clozemaster.com/t/is-clozemaster-boring/44804 | abgerufen 30.10.2026 |
| cm-f-teach | https://forum.clozemaster.com/t/user-interface-v5-teach-me/69173 | abgerufen 30.10.2026 |
| cm-f-ai | https://forum.clozemaster.com/t/time-to-say-goodbye-to-ai-slop-on-clozemaster/70893 | nur Vorrecherche (mara), nicht erneut abgerufen |
| cm-f-50 | https://forum.clozemaster.com/t/feature-request-wrong-answers-at-50/21764 | nur Suche |
| cm-f-accent | https://forum.clozemaster.com/t/vietnamese-text-input-accent-recognition-failure/12872 ; https://forum.clozemaster.com/t/when-typing-an-accented-letter-in-greek-it-is-marked-red-even-if-its-correct/34354 | nur Suche |
| cm-f-apos | https://forum.clozemaster.com/t/single-quotation-mark-vs-apostrophy-making-text-input-not-possible/64220 | nur Suche |
| cm-f-reading | https://forum.clozemaster.com/t/custom-cloze-texts-now-in-beta-tada/678 | nur Suche |
| cm-f-cl | https://forum.clozemaster.com/t/new-feature-cloze-listening/12633 | nur Suche |
| cm-f-tracker | https://forum.clozemaster.com/t/new-fast-track-tracker/47763 | nur Suche |
| cm-speak-gone | https://forum.clozemaster.com/t/speaking-feature-in-skills-not-available-anymore/8442 | nur Suche |
| cm-reddit-fft | https://red.bismuth.it/r/clozemaster/comments/1aw5yrb/can_someone_explain_how_the_fluency_fast_track | nur Suche (Reddit-Spiegel) |
| cm-as | https://apps.apple.com/us/app/clozemaster/id1149199075 | abgerufen 30.10.2026 (Beschreibung, Bewertungen, Bilder) |
| cm-sl | https://storylearning.com/clozemaster-review | abgerufen 30.10.2026 |
| cm-fu | https://www.fluentu.com/blog/clozemaster-review/ | abgerufen 30.10.2026 |
| Bild cm-as-1 … cm-as-5 | siehe Bildliste Teil B (Clozemaster Nr. 1–5) | geprüft 200 image/jpeg |
