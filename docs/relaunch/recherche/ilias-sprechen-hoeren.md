# Recherche Hören, Sprechen, KI-Tutor (Ilias, Marktforschung)

Stand: 27.10.2026 · Rolle: Fakten liefern, nicht entscheiden.
**Belegregel:** Jede Aussage hat eine Quelle (Nummer in eckigen Klammern, Liste in Abschnitt 7). Eigene Schlüsse sind als **[Vermutung]** markiert. Angaben aus Werbetexten, App-Store-Beschreibungen und Pressemitteilungen der Hersteller sind als **„laut Anbieter“** markiert. Wo ich etwas nicht belegen konnte, steht „nicht belegt“.

**Grenzen dieser Recherche:** Reddit selbst war über die Suche kaum erreichbar. Nutzerstimmen stammen deshalb vor allem aus Trustpilot, G2, App-Store-Rezensionen, einem Reddit-Spiegel und Testberichten. Einige Testseiten gehören selbst zu Anbietern, darauf weise ich jeweils hin. Zum Beispiel gehört LanguaTalk zu Langua und SpeakShark ist ein Wettbewerber von Talkpal. Mehrere Herstellerseiten (OpenAI-Kundenbericht zu Speak, Cambly-Hilfe, ELSA-Blog auf Medium) waren gesperrt (403).

---

## 1. Kurzfassung in 10 Punkten

1. **Der Markt hat sich auf einen Dreischritt geeinigt: vorbereiten, üben, anwenden.** Speak nennt ihn „Learn, Practice, Apply“ [2]. Babbel Speak beginnt jede Einheit mit klaren Zielen und baut das Gespräch in Stufen auf [12]. Busuu legt das KI-Gespräch ans Ende eines Kapitels, damit vorher Gelerntes darin wiederkommt [15]. Selbstsicherheit entsteht dort durch Vorbereitung und nicht durch das freie Gespräch allein.
2. **Rollenspiele mit Auftrag („Mission“) sind Standard.** Speak gibt drei Aufgaben je Szene vor [1]. ELSA zeigt danach, welche Ziele erreicht wurden [9]. Busuu lenkt zum Ziel zurück, wenn man abschweift [15]. Für Business-Englisch gehen Yoodli (skeptischer Einkaufsleiter, Einwände, nächste Schritte, Bewertungsraster) [28] und Loora (Meetings, Telefonate, Verhandlungen) [10] am weitesten.
3. **Die besten Apps korrigieren im Gespräch kaum und am Ende ausführlich.** Duolingos Lily korrigiert während des Anrufs bewusst nicht [17]. Busuu gibt die Rückmeldung erst am Ende [15]. Langua lässt die Stufe wählen: aus, nur Text, versteckt im Satz („Recast“), ausdrücklich oder vorgesprochen [5]. Ein Anbieter berichtet, dass das Korrigieren jedes Fehlers das Produkt „unbrauchbar“ machte [31].
4. **Die Aussprachebewertung ist die größte Schwachstelle des ganzen Markts.** Speak lässt falsche Aussprache und vertauschte Wortfolge mit voller Punktzahl durch [1]. In einem Test traf Talkpal nur etwa 6 von 24 absichtlich falschen Sätzen [26]. Bei ELSA wurden Muttersprachler abgewertet [27]. Bei Praktika gibt es widersprüchliche Berichte [3].
5. **Aus Fehlern wird Übungsstoff, aber bei den meisten nur halbherzig.** Bei Speak entstehen aus Fehlern Wiederholungslektionen, die aber nur aus Nachsprechen bestehen und Fehler nicht über die Zeit verfolgen [1]. Langua schlägt aus wiederkehrenden Fehlern Grammatikthemen vor und macht aus gespeicherten Wörtern Karteikarten, die in späteren Gesprächen wiederkommen [4][5]. Diese Lücke kann die eigene App mit ihrem FSRS-Kern schließen. **[Vermutung]**
6. **Hören wird fast nirgends ernsthaft trainiert.** Die meisten KI-Apps behandeln Hören nebenbei im Gespräch [9]. Gezielte Muster gibt es nur vereinzelt: Pimsleur fordert die Antwort, bevor man sie hört („Antizipation“) [19][20]. Glossika lässt Satz für Satz hören und nachsprechen, mit Wiederholung nach Plan [22]. Langua spielt Ton auch langsamer (0,75-fach) ab und stellt Verständnisfragen zu eingelesenen Texten [5]. Diktat-Apps lassen zwischen US- und UK-Stimme wechseln [34].
7. **Bei der Bedienung ist „drücken zum Sprechen“ der ehrlichere Weg.** Duolingo hat Lily auf Drücken zum Sprechen umgestellt, nachdem sie Nutzer nach wenigen Wörtern unterbrochen hatte [18][24]. Langua bietet zusätzlich einen freihändigen Anrufmodus [5]. Speak lässt Wörter beim Sprechen aufleuchten [1]. Kritik gibt es an fehlenden Zeichen, ob die App gerade zuhört [21], und an Rückmeldungen, die hinter einem Knopf je Nachricht versteckt sind [6].
8. **Flüssigkeit messen Präsentations-Coaches einfacher als Sprach-Apps.** Orai, Yoodli und Poised zählen Füllwörter, Wörter pro Minute, Prägnanz und „Energie“ [28][29][30]. Wörter pro Minute und Füllwörter lassen sich grundsätzlich aus Transkript und Zeitmessung ableiten, ohne Klanganalyse. **[Vermutung]** Ob die Browser-Erkennung „äh/um“ überhaupt mitschreibt, ist nicht belegt.
9. **Im Browser ist kostenlose Spracherkennung möglich, aber unsicher.** Chrome und Safari (iOS ab 14.5) unterstützen sie nur „teilweise“ [36]. Chrome schickt den Ton an einen Server [35]. iOS braucht eingeschaltetes Siri/Diktat [38] und funktioniert in eingebetteten Ansichten (WKWebView) unter Umständen gar nicht [39]. In fremden iframes muss das Mikrofon ausdrücklich freigegeben sein [40]. Ob das im claude.ai-Rahmen und in der Claude-App klappt, muss Tarek klären.
10. **Aussprache nur aus dem Transkript plus Claude zu bewerten ist seriös möglich, aber nur als grobe Verständlichkeitsprobe.** Ein Forschungsansatz (TextPA) lässt ein Sprachmodell Aussprache aus Textdarstellungen bewerten. Er kommt nur mit zusätzlicher Lautschrift-Erkennung auf eine mittlere Übereinstimmung mit Menschen (Korrelation etwa 0,5) und scheitert an Betonung und Satzmelodie [41]. Gute Erkenner „verzeihen“ Fehler: Fast fehlerfreie Transkripte passten nur schwach zu menschlichen Urteilen [42]. Ehrlich ist darum nur eine Aussage wie „verstanden / nicht verstanden“, keine Lautnote. **[Vermutung]**

---

## 2. App-Steckbriefe

Kürzel je Steckbrief: **Ü** Sprechübungen · **A** Aussprache-Rückmeldung · **H** Hören · **K** Korrektur und Gedächtnis · **S** Selbstsicherheit · **V** Verknüpfung mit Wörtern/Grammatik · **B** Bedienung · **–** Schwächen laut Nutzern und Tests.

### Speak (speak.com)
- **Ü:** Speaking Drill (Sätze nachsprechen, Wörter leuchten beim Sprechen auf), Rollenspiel mit drei Aufgaben (endet, wenn die Aufgaben erledigt sind), Free Talk mit selbst gewählter Rolle und Szene, Tutor-Lektion (teils mit Video), Tutor-Frage-Antwort, Wortschatzspiele [1]. Laut Anbieter folgt jede Lektion dem Schema „Learn, Practice, Apply“, mit einem Hin-und-her-Gespräch mit dem „Speak Tutor“ im Anwenden-Schritt [2]. Laut Anbieter kam später ein „audio-first“-Rollenspiel hinzu, das „kein Skript“ sei [21].
- **A:** Laut Anbieter „Echtzeit-Rückmeldung zu Aussprache und Formulierung“ [2]. Im unabhängigen Test war die Erkennung „übermäßig nachsichtig“: falsche Aussprache und vertauschte Wortfolge bekamen volle Punktzahl, was ein falsches Gefühl von Können erzeugt [1].
- **H:** Keine eigene Hörübung beschrieben. Die Stimmen sind „glatt und gut verständlich“, es gibt aber keine Wahl von Stimmen oder Akzenten [1].
- **K:** Im Gespräch wird „manchmal“ korrigiert, am Ende des Rollenspiels gibt es eine kurze Fehlerliste. Daraus lässt sich eine Wiederholungslektion erzeugen. Sie besteht aber nur aus Nachsprech-Drills mit ähnlichen Satzmustern, ohne Erklärung und ohne Verfolgung wiederkehrender Fehler [1]. „Made for You“ (Premium Plus) baut Lektionen aus den eigenen Fehlern [1]. Laut Anbieter gibt es „unbegrenzte persönliche Wiederholung mit Fokus auf deine Schwachstellen“ [2]. „Smart Review“: Drittseiten beschreiben es als Wiederholung in Abständen, ein Testbericht vermisst genau das. Die Quellen widersprechen sich, belegt ist der Mechanismus nicht [1][43].
- **S:** Laut Anbieter kann man Sätze beliebig oft wiederholen [2].
- **V:** Lektionen lehren „Sätze und Muster, die Muttersprachler in echten Situationen nutzen“ (laut Anbieter) [2]. Der Testbericht findet „wenig Verzahnung“ zwischen Kurs, freien Gesprächen und Wiederholung [1].
- **B:** Wörter leuchten beim Sprechen auf [1]. Eine App-Store-Rezension kritisiert: kein sichtbares Zeichen, während die App auf Spracheingabe wartet, und ein automatisches Weiterschalten auch nach einem Fehler [21].
- **–:** Nachsichtige Erkennung, kurze und flache Rückmeldung, wenig Abwechslung ab B1, keine Wiederholung nach Plan, verwirrende Preisstufen [1][7].

### Praktika (praktika.ai)
- **Ü:** Gespräche mit animierten KI-Avataren, freies Gespräch oder geführte Lektionen mit Ziel (z. B. „Gehaltserhöhung verhandeln“), laut Anbieter über 1.000 Lektionen [6]. Laut Anbieter „erinnern sich“ die Avatare an den Kontext, und der Lernplan passt sich Zielen und Tempo an [8].
- **A:** Unter jeder Nachricht sitzt ein Feedback-Knopf mit Aussprachewert und Grammatikhinweisen für genau diese Zeile [6]. Nutzerberichte widersprechen sich: „hört meine Aussprache und korrigiert mich“ gegen „Tutor korrigiert meine Aussprache nicht“ [3].
- **H:** Hören wird laut Anbieter in Übungen abgedeckt, ohne Einzelheiten [8].
- **K:** Wörter lassen sich in ein persönliches Wörterbuch speichern [6]. Es gibt keine Zusammenfassung am Ende der Lektion: Wer den Knopf bei einer Nachricht nicht drückt, verpasst deren Rückmeldung [6].
- **S:** Nutzer loben die druckfreie Übung und mehr Sicherheit [44].
- **–:** Rückmeldung „minimal und leicht zu übersehen“ [7], Avatare lenken ab und es gibt keinen reinen Tonmodus [7], starre Lernpfade (bei Zielwechsel geht Fortschritt verloren) [6][7], die KI spricht zu schnell und die Erkennung versteht falsch [3], Abrechnungsärger [3][44].

### ELSA Speak
- **Ü:** Aussprache-Drills, dazu „ELSA AI“-Rollenspiele mit Rolle und klaren Aufgaben (z. B. Erstattung anfragen). Eigene Rollenspiele lassen sich aus Thema und Stichworten erzeugen [9].
- **A:** Laut Anbieter umfasst der „ELSA Score“ Einzellaute, Betonung/Satzmelodie/Flüssigkeit und Hören (ähnliche Laute unterscheiden) [45]. Die Rückmeldung ist farbig (grün gut, gelb/rot üben) [45]. Ein Bericht nennt Mund-Diagramme je Laut, das ist aber nicht beim Anbieter bestätigt [45].
- **H:** Laut Anbieter gehört das Unterscheiden ähnlicher Laute zum Score [45].
- **K:** Nach dem Rollenspiel (nicht währenddessen) kommt eine Bewertung zu Aussprache, Wortschatz, Grammatik, Passung, Ton, Flüssigkeit und Aufgabenerfüllung [9].
- **–:** Muttersprachler werden bei Vokalen und Endungen abgewertet, weil Akzentvarianten nicht gelten [27]. Nutzer wünschen „glaubwürdigere Werte“ [27]. Die Werte sind Prozent „wie nah an Muttersprachler“ [27].

### Loora
- **Ü:** Freie Gespräche zu beliebigen Themen, Module für Vorstellungsgespräch, Meetings, Präsentationen (laut Anbieter) [10]. Laut Business-Seite geht es um Rollenspiele für Meetings, Telefonate und Verhandlungen [46].
- **A/K:** Laut Anbieter gibt es Echtzeit-Rückmeldung zu Grammatik, Aussprache und Wortwahl sowie eine „Lesson summary“, deren Inhalt nicht beschrieben ist [10]. Laut Anbieter erkennt die KI Laute, mit denen man kämpft, und coacht gezielt [10].
- **–:** Keine unabhängigen Tests gefunden.

### Langua (LanguaTalk)
*Achtung: Der ausführlichste Test stammt vom Hersteller selbst [4]. Ein zweiter Test ist unabhängig [5].*
- **Ü:** Rollenspiele, Debatten, freie Gespräche, eigene Szenarien als gespeicherte Vorlagen, freihändiger Anrufmodus mit Unterbrechen-Können [5].
- **A:** Keine Lautbewertung beschrieben. Man kann tippen oder sich aufnehmen. Das Gespräch lässt sich anhören und im Tempo verstellen, und je Antwort zeigt „Check & explain“, was richtig war, was fehlte und warum [46b].
- **H:** Text- und Audio-Import (bis 45 Min.) mit antippbarem Transkript, die KI stellt Verständnis- und Meinungsfragen dazu. Karten-Ton gibt es normal und 0,75-fach [5].
- **K:** Fünf Korrekturstufen: aus · Text unter der Antwort · versteckt im Satz (Recast) · ausdrücklich · vorgesprochen [5]. Nach jedem Gespräch gibt es einen Bericht (was gut lief, woran arbeiten, alle Korrekturen), auch vorgelesen. Am Ende kommen neue Wörter, die man mit einem Tipp als Karte übernimmt [5]. Der Reiter „Review“ schlägt Grammatikthemen aus wiederkehrenden Fehlern vor [5]. Gespeicherte Wörter kommen in späteren Gesprächen und Geschichten wieder (laut Anbieter) [4]. Wörter lassen sich auch per Zuruf speichern („save that for me“) [5].
- **V:** Produktionskarten: Man sieht die Muttersprache, **sagt** den Zielsatz laut und deckt dann auf [5].
- **–:** Erkennung versteht manchmal falsch [4]. Gibt bei Widerspruch zu leicht nach, auch wenn die Korrektur richtig war [5]. Karten sagen „Great job!“ auch bei falscher Antwort [5]. Viele Funktionen überfordern anfangs [5]. Nutzerwunsch: Berichte seien „nicht umsetzbar“, weil Korrekturen im Chatverlauf untergehen [47].

### Talkpal
- **Ü:** Laut Anbieter gibt es Rollenspiele, Figuren, Debatten, Anrufmodus, Satz-, Wort-, Dialog- und Fotomodus [25].
- **A:** In einem Test mit absichtlich falscher Aussprache war die Rückmeldung nur bei etwa 6 von 24 Sätzen zutreffend. Laut einer anderen Besprechung prüft die App nur, *ob* die Wörter gesagt wurden [26]. Eine Übersicht lobt die Aussprachewerte dagegen und merkt an, dass die Korrektur rein reaktiv ist: Wer schwierige Strukturen meidet, bekommt nichts korrigiert [26].
- **–:** Kundendienst und Erstattung, eine Anruf-Stimme klingt weniger natürlich, die Lautstärke ist leise [26].

### Univerbal (früher Quazel)
- **Ü:** Laut Anbieter über 100 Szenarien oder eigene, Gespräche passen sich Interessen und Niveau an [11][48].
- **K:** Laut Anbieter gibt es sofortige Korrekturen mit „besserer Version“ dessen, was man sagen wollte, kurze Erklärungen „genau dann, wenn sie zählen“, und gespeicherte Fehler zum späteren Üben [48]. Hilfen und Übersetzung gibt es auf niedrigen Stufen [48].
- **B:** Sprechen oder tippen [48]. Ein Nutzer kritisiert, dass die Tastatur das Eingabefeld verdeckt [11].
- **–:** Nur kleine Stichproben unabhängiger Bewertungen [11].

### Duolingo Max (Video Call, Roleplay, Explain my Answer)
- **Ü:** Video Call mit Lily: Lily fängt an, man spricht frei, ohne Hinweise und ohne Vorgaben [16][17]. Anrufe dauern anfangs etwa eine, später bis drei Minuten [17], bei Fortgeschrittenen auch über fünf [18]. Roleplay: geschriebenes oder gesprochenes Szenario-Gespräch [32].
- **A:** Keine Lautbewertung im Anruf beschrieben.
- **H:** Man kann Lily bitten, langsamer zu sprechen oder zu wiederholen, auch einfach durch „What? I don't understand.“ [17].
- **K:** Lily korrigiert im Anruf **nicht** („you won't hear her correct your grammar“), Fehler werden „nicht bestraft“ [17]. Später kam eine Transkript-Auswertung dazu: was richtig war und wie man natürlicher klingt [18]. Nach dem Roleplay gibt es eine Rückmeldung zu Richtigkeit und Komplexität mit Tipps [32]. „Explain my Answer“: Knopf nach bestimmten Übungen, erklärt richtige **und** falsche Antworten, mit Nachfragen im Chat [32]. Gedächtnis: Lily merkt sich laut Anbieter persönliche Details und bringt sie später wieder auf [16].
- **S:** Laut Anbieter (eigene Studie) gab es bessere Sprechtests und mehr Selbstvertrauen als bei reinem Lektionslernen. Stichprobengrößen und Effektstärken werden nicht genannt [33].
- **B:** Kamera-Symbol im Lernpfad, „Calling Lily…“, rotes Auflegen, Gesicht füllt den Bildschirm [17]. Später auf iOS: Knopf drücken, sprechen, dann senden [24].
- **–:** Lily unterbrach nach etwa drei Wörtern, stellte zusammenhanglose Fragen, beendete den Anruf und gab danach keine Rückmeldung (Reddit-Spiegel) [24]. Wochenlang fragte sie immer nach dem Frühstück [18]. Laut Bericht wurde das durch Drücken zum Sprechen und die Transkript-Auswertung besser [18].

### Babbel (Speech Recognition, Everyday Conversations, Babbel Speak, Live)
- **Ü:** Everyday Conversations (2023): erst den Dialog hören, dann selbst nachsprechen, ausdrücklich „um Sprechangst zu senken“ [13][14]. Babbel Speak (2025, Beta): sprachgeführter KI-Trainer, Szenen von Fachleuten entworfen, die KI übernimmt nur den Gesprächsfluss [12].
- **A:** Laut Anbieter vergleicht die Erkennung Tausende Lautproben, trainiert mit richtigen und falschen Aussprachen [13].
- **S:** Laut Anbieter gibt es klare Ziele vorab, Aufbau in Stufen, einen „sicheren, wertungsfreien Raum“ und sanfte Animationen und **sichtbare Zeichen für den Gesprächstakt**, um Denkaufwand und Sprechangst zu senken [12].
- **B:** Orangefarbener Mikrofon-Knopf antippen, dann sprechen [13]. Babbel Live (Gruppenunterricht mit Menschen) wurde hier nicht weiter untersucht.
- **–:** Keine unabhängigen Nutzerdaten zu Babbel Speak gefunden.

### Busuu
- **Ü:** Speaking Practice (2024): Die Erkennung bewertet Sätze, markiert die Wörter, die Arbeit brauchen, dazu Videos von Muttersprachlern zu Lauten und Mundbewegung (laut Anbieter) [49]. Busuu Conversations (2026): Echtzeit-Gespräche mit Ziel je Lektion, die KI lenkt zurück aufs Thema [15].
- **K:** Persönliche Rückmeldung **am Ende**, damit das Gespräch nicht unterbrochen wird: was gut war, was zu verbessern ist [15].
- **V:** Die KI-Gespräche liegen am Ende eines Kapitels und festigen das zuvor Gelernte [15].
- **–:** Keine unabhängigen Messungen gefunden.

### Cambly und Preply (menschliche Lehrer plus KI)
- **Cambly:** Laut Anbieter füllt die KI bei Pro-Lehrern das Feedback nach der Stunde vor (Stärken, Verbesserung, Übungsideen, nächstes Thema). Der Lehrer bearbeitet es und schickt es per Mail [50]. Laut Anbieter gibt es Aufnahmen und Transkripte der Stunden [50]. Ein Vergleich (Wettbewerber) sagt, Cambly gebe keine automatische Messung [50].
- **Preply (08/2025):** Laut Anbieter gibt es „Lesson Insights“ (automatische Zusammenfassung nach jeder Stunde mit Fortschritt und Arbeitsfeldern), „Daily Exercises“ (kurze Übungen aus Stundeninhalt und Fokusfeldern) und „Scenario Practice“ (vom Lehrer zugewiesene Sprechszenen zwischen den Stunden) [23].
- **Bezug zu Emrah:** Emrah nutzt Preply. Das Muster „Stunde → Zusammenfassung → Übungen dazwischen“ entspricht der vorhandenen Preply-Brücke. **[Vermutung]**

### Pimsleur (Audio-Methode)
- **Ü/H:** Etwa 30 Minuten Audio je Lektion. Ein kurzer Dialog wird zerlegt, man soll die Antwort sagen, **bevor** man sie hört („Antizipation“), und Stoff kommt in wachsenden Abständen wieder („Graduated Interval Recall“, etwa nach Sekunden, Minuten, später) [19][20]. Grammatik wird nicht erklärt, sondern im Gespräch erworben [19]. Lange Wörter und Sätze werden von hinten aufgebaut („Backward Build-up“), damit die Satzmelodie heil bleibt (Sekundärquellen) [51].
- **App-Zusätze:** „Speak Easy Challenge“ (Rollenspiel mit Transkript), Karteikarten, Schnellrunden-Spiele, „AI Conversation Coach“ (Beta, nur Lateinamerika-Spanisch) laut App-Store [52].
- **–:** Wenig Grammatik-Erklärung, teuer (PCMag laut Wikipedia) [19].

### Glossika
- **Ü/H:** Satz in der bekannten Sprache, dann in der Zielsprache, hören und laut nachsprechen. Alte Sätze kommen nach Plan wieder, neue kommen hinzu [22]. Empfohlen werden mindestens 25 Wiederholungen (etwa 4–6 Minuten) am Tag. Die App zeigt die restlichen Wiederholungen und die geschätzte Zeit [22].
- **–:** Keine Erklärung bei überraschender Grammatik, unpersönliche Sätze. Auswendig gelernte Sätze heißen nicht, dass man neue bilden kann [53]. Viele neue Sätze erzeugen Tage später einen Berg an Wiederholungen [53]. Mobil hakelig bei schwachem Netz, keine Aussprache-Rückmeldung auf Aufnahmen [53].

### Yousician (Vergleich: Echtzeit-Rückmeldung beim Musizieren)
- Hört über das Gerätemikrofon zu und bewertet Tonhöhe, Treffer und Timing **in Echtzeit**. Ein „hüpfender Ball“ zeigt, wann gespielt wird [54].
- **–:** Nutzer finden die Timing-Zeichen schwer lesbar, der Hersteller räumt ein, dass das System verwirren kann [54].
- **Übertragbar:** Das Prinzip „sofort sichtbar, was getroffen wurde“ gibt es bei Speak als aufleuchtende Wörter [1].

### Yoodli, Poised, Orai (Sprech- und Präsentations-Coaches)
- **Yoodli:** Laut Anbieter gibt es Rollenspiele mit Persona, Kontext, Bewertungsraster und Einwänden, z. B. „Discovery Call mit skeptischem VP“. Bewertet werden Bedarfsfragen, Einwandbehandlung und klare nächste Schritte [28]. Rückmeldung als „Stärke + daran arbeiten“ [28]. Laut Listen gibt es Füllwörter, Tempo und Prägnanz sowie Bewertungsraster mit Bestanden/Nicht bestanden und Verlauf [28]. Kritik: kurze Verzögerung bei KI-Antworten, besser für einseitiges Sprechen als für unvorhersehbare Kundengespräche [28].
- **Poised:** Echtzeit-Hinweise in Videokonferenzen, nur für den Nutzer sichtbar: Tempo, Klarheit, Selbstsicherheit, Energie, Empathie, Füllwörter. Nur Desktop. **Der Dienst wurde laut eigener Seite am 08.10.2026 eingestellt** [29]. Kritik: Hinweise kamen teils zu spät [29].
- **Orai:** Laut Anbieter gibt es sofortige Rückmeldung zu Füllwörtern („um, uh, you know, so“), Sprechtempo, Energie, Selbstsicherheit und Prägnanz, Mikro-Lektionen und Transkript zur Aufnahme [30]. Die Auswertung lief laut früherem Bericht in der Cloud [30].

### Nebenquellen
- **BoldVoice:** Akzent-Training mit Videos von Akzent-Coaches. Man vergleicht die eigene Aufnahme mit der des Coaches, farbige Bewertung (laut Anbieter und Drittseiten) [55].
- **Promova (Entwickler-Blog des Anbieters):** Antwortgeschwindigkeit sei eine Pflicht. Langsame Antworten ließen den Tutor „wertend“ wirken. Jeden Fehler zu korrigieren habe das Produkt unbrauchbar gemacht. Der größte Abbruch komme aus Angst vor dem ersten Satz, nicht aus Bedienhürden [31].

---

## 3. Querschnitt je Frage

### F1 Welche Sprechübungen gibt es?
| Übungsart | Wer (belegt) |
|---|---|
| Nachsprechen / Shadowing | Speak Drill [1], Glossika [22], Babbel Everyday Conversations (erst hören, dann sprechen) [13], Busuu Speaking Practice [49], BoldVoice [55] |
| Antwort selbst bilden, bevor man sie hört | Pimsleur (Antizipation) [19][20], Langua-Produktionskarten (Muttersprache sehen → laut sagen) [5] |
| Freies Gespräch | Speak Free Talk [1], Lily [17], Langua [5], Praktika [6], Loora [10] |
| Rollenspiel mit Aufgaben | Speak (drei Aufgaben) [1], ELSA [9], Busuu [15], Babbel Speak [12], Univerbal [48], Yoodli (Business, Raster) [28] |
| Debatte | Langua [5], Talkpal [25] |
| Zeitdruck / Flüssigkeit | In Sprach-Apps **nicht belegt**. Präsentations-Coaches messen Tempo und Füllwörter [28][30]. Aus der Lehre: 4/3/2-Technik (dieselbe Rede in 4, 3, 2 Minuten). Berichtet werden etwa +21,5 % Sprechtempo und etwa −22 % Zögern (Arevart & Nation 1991, nur Sekundärangaben) [56]. |

**Befund:** Shadowing im engeren Sinn (gleichzeitig mitsprechen) bietet keine der großen KI-Apps ausdrücklich an. Gefunden habe ich es nur bei kleineren Spezial-Apps, zum Beispiel Parroto [34]. Die Forschung sieht beim Shadowing vor allem Gewinne beim Hören (Lautebene) für niedrige und mittlere Niveaus und bei Betonung und Satzmelodie für Fortgeschrittene. Belegt ist das durch eine Synthese von 15 Studien, keine Meta-Analyse [57].

### F2 Wie wird Aussprache bewertet und zurückgemeldet?
- **Lautebene mit Farben:** ELSA (grün/gelb/rot) [45], BoldVoice [55], Busuu (Wörter markiert) [49].
- **Ganzer Satz / „Wort gesagt oder nicht“:** Speak [1], Talkpal [26]. Das ist in der Praxis oft nur eine Erkennungsprüfung.
- **Betonung und Satzmelodie:** laut Anbieter nur ELSA [45], unabhängig nicht bestätigt.
- **Tempo und Füllwörter:** Orai, Yoodli, Poised [28][29][30]. Bei Sprach-Apps nicht belegt.
- **Gemeinsames Problem:** Die Werte sind unzuverlässig, mal zu nachsichtig (Speak [1], Talkpal [26]), mal zu streng gegen echte Akzentvarianten (ELSA [27]). Die Forschung bestätigt die Ursache: Starke Erkenner liefern fast fehlerfreie Transkripte, die nur schwach zu menschlichen Aussprache-Urteilen passen [42].

### F3 Wie wird Hören trainiert?
- **Diktat:** in den großen KI-Apps nicht belegt, nur in Spezial-Apps (Go Dictation, Dictationly, WELE) [34].
- **Hören mit Lücken:** in den untersuchten KI-Apps nicht belegt.
- **Geschwindigkeit:** Langua 0,75-fach [5], Lily „langsamer bitte“ [17], WELE 0,5–1,25-fach [34]. Speak bietet keine Steuerung [1].
- **Akzente:** Dictationly US/UK-Umschalter [34]. Speak hat keine Akzentwahl [1]. Langua nutzt Stimmen nach Muttersprachlern geklont (laut Anbieter) [4].
- **Verständnisfragen:** Langua zu eingelesenen Texten und Audios [5].
- **Hören als Abruf-Auslöser:** Pimsleur (Frage hören → Antwort sagen → Modell hören) [19][20], Glossika [22].
- **Befund:** Hören ist bei den KI-Tutoren ein Nebenprodukt des Gesprächs. Ein echtes Hörtraining mit Stufen (Tempo, Akzent, Lücke, Diktat, Verständnis) bietet keine der großen Apps aus einer Hand. **[Vermutung, aus der Summe der Steckbriefe]**

### F4 Wie korrigiert der KI-Tutor und wie macht er weiter?
- **Zeitpunkt:** Drei Lager.
  - (a) Gar nicht während, alles danach: Lily [17][18], Busuu [15], ELSA [9].
  - (b) Wählbar: Langua mit fünf Stufen [5].
  - (c) Sofort mit „besserer Version“: Univerbal (laut Anbieter) [48], Loora (laut Anbieter) [10], Praktika (versteckt hinter Knopf) [6].
- **Form:** Recast, also die richtige Form unauffällig in die eigene Antwort einbauen (Langua „implicit“) [5]. „So klingst du natürlicher“ (Duolingo-Transkript) [18]. Erklärung auch bei richtiger Antwort (Explain my Answer) [32]. Eine Studie zu Chatbot-Feedback fand angeleitete Selbstkorrektur lernwirksamer als die direkte Korrektur, besonders für manche Lerner [58]. Eine Mixed-Reality-Studie beschreibt den Zielkonflikt: zu viele Korrekturen stören den Fluss, zu wenige verschenken Lernchancen [58b].
- **Weitermachen:**
  - Speak macht aus Fehlern Drills, ohne Fehlerverlauf [1].
  - Langua schlägt aus wiederkehrenden Fehlern Grammatikthemen vor, die Wörter landen auf Karten und kommen in Gesprächen wieder [4][5].
  - Univerbal speichert Fehler (laut Anbieter) [48].
  - Preply baut Übungen aus Stundeninhalten (laut Anbieter) [23].
  - Lily merkt sich persönliche Themen (laut Anbieter) [16].
- **Befund:** Eine echte Schleife „Fehler → geplante Wiederholung → im nächsten Gespräch gezielt herauslocken → prüfen, ob er weg ist“ hat keine App belegbar geschlossen. **[Vermutung]**

### F5 Wie wird Selbstsicherheit aufgebaut?
- **Vorbereitung vor dem Gespräch:** Speak Learn→Practice→Apply [2], Babbel klare Ziele und Stufen [12], Busuu am Kapitelende [15]. Pimsleur und Babbel: erst hören, dann sprechen [13][19].
- **Angstfreiheit:** „wird nicht bestraft“ (Lily) [17], „sicherer, wertungsfreier Raum“ (Babbel, Busuu) [12][49], Privatsphäre, nur für dich sichtbar (Poised, Yoodli) [28][29]. Babbel nutzt zusätzlich Zeichen für den Gesprächstakt [12].
- **Wiederholbarkeit:** Speak „so oft du willst“ [2], Pimsleur und Glossika strukturell [19][22].
- **Mission-Struktur:** Speak, ELSA, Busuu, Yoodli [1][9][15][28].
- **Erster Satz:** Promova berichtet, die größte Hürde sei Angst. Geholfen hätten ein konkreter, niedrigschwelliger Einstiegssatz, leichtes Wiederholen und klare Privatsphäre [31].
- **Forschung (dünn):** Zwei Minuten Planung vor dem Sprechen senkten in einer kleinen Studie (n = 30) die Sprechangst [59]. 4/3/2-Wiederholung steigert Tempo und senkt Zögern [56].

### F6 Wie hängen Sprechen und Hören mit Wörtern und Grammatik zusammen?
- **Am stärksten bei Langua:** Wörter aus dem Gespräch werden Karten, kommen in späteren Gesprächen und Geschichten wieder, Grammatikthemen kommen aus eigenen Fehlern [4][5].
- **Busuu:** Gespräch am Kapitelende mit Kapitelstoff [15].
- **Speak:** Lektionen mit Mustern, aber laut Test wenig Verzahnung [1].
- **Preply:** Übungen aus Stundeninhalten [23].
- **Befund:** Dass ein **geplantes Wort** gezielt im Gespräch abgefragt wird, also das Gespräch so gesteuert wird, dass der Lerner das Wort benutzen muss, ist bei keiner App belegt. Langua behauptet nur, Wörter „einzuweben“ [4]. **[Vermutung]**

### F7 Bedienung am Handy und am Laptop
- **Mikrofon:**
  - Antippen bei Babbel [13].
  - Drücken, sprechen, senden bei Duolingo iOS [24].
  - Freihändig mit Unterbrechen bei Langua (Anrufmodus) [5].
  - Automatische Sprechpausen-Erkennung bei Lily früher: führte zu Unterbrechungen [24].
- **Transkript:** Duolingo zeigt es nach dem Anruf zur Auswertung [18]. Langua hat antippbare Transkripte und einen Stift je Nachricht für Korrekturen [5]. Pimsleur hat Transkripte zum Rollenspiel [52].
- **Rückmeldung je Nachricht:** Feedback-Knopf je Zeile bei Praktika [6].
- **Wellenform:** In keiner Quelle beschrieben, nicht belegt.
- **Sichtbarkeit des Zuhörens:** Speak wird kritisiert, weil man nicht sieht, ob die App zuhört [21]. Babbel setzt auf Zeichen für den Gesprächstakt [12].
- **Laptop:** Poised war nur Desktop [29]. Yoodli läuft im Browser [28]. Langua hat Geschichten nur auf der Webseite [5]. Belege für einen **eigenen** Laptop-Aufbau bei Sprach-Apps habe ich nicht gefunden. Ein Laptop-Muster wie „Leertaste halten zum Sprechen“ ist **[Vermutung]** ohne Marktbeleg.

### F8 Welche Schwächen beklagen Nutzer?
Siehe Abschnitt 6 (Anti-Muster). Die häufigsten fünf:
1. unzuverlässige Aussprachebewertung [1][3][26][27],
2. flache oder versteckte Rückmeldung [1][6][7],
3. Unterbrechen und Wiederholen derselben Fragen [18][24],
4. Wiederholung ohne Abwechslung ab B1 [1][7],
5. Abo- und Abrechnungsärger [3][26][44].

---

## 4. Browser-Technik (ohne Server, ohne bezahlte API)

### 4.1 Spracherkennung (`SpeechRecognition` / `webkitSpeechRecognition`)
- **Unterstützung:** Chrome Desktop und Chrome Android „teilweise“, Safari macOS ab 14.1 und iOS ab 14.5 „teilweise“, Samsung Internet „teilweise“, Firefox standardmäßig aus, Edge (laut caniuse-Tabelle) nicht [36]. In Safari mit `webkit`-Präfix [37].
- **Wo der Ton hingeht:** In Chrome läuft die Erkennung über einen Server, der Ton wird an einen Webdienst geschickt und es geht nicht offline [35]. Unter macOS 26 brauchte Safari laut einem Test weiter Netz und fragte, ob Daten an Apple gehen dürfen [37]. **Folge:** keine Kosten und kein API-Schlüssel, aber Emrahs Stimme verlässt das Gerät zu Google oder Apple. **[Vermutung zur Einordnung, Tarek prüft gegen die Artefakt-Regeln]**
- **Erkennung auf dem Gerät:** Die Spezifikation hat `processLocally` [35]. Chrome unterstützt das laut Forenbeitrag ab 139 auf dem Desktop. Android und ChromeOS unterstützen es laut Chromium-Entwicklern (Mai 2026) **nicht** [60]. `available()`/`install()` sind an die Richtlinie „on-device-speech-recognition“ gebunden, Standard nur `'self'`. Damit sind sie in einem fremden iframe ohne Freigabe nicht nutzbar [61].
- **iPhone-Bedingungen:**
  - Siri oder Diktat muss in den Einstellungen an sein, sonst schlägt die Erkennung fehl [38].
  - Laut WebKit-Entwickler ist die Erkennung in SafariViewController und in Web-Apps vom Home-Bildschirm nicht verfügbar [38].
  - In eingebetteten WKWebViews kann `webkitSpeechRecognition` vorhanden sein und trotzdem nie den Erlaubnisdialog zeigen [39]. Die Funktionsprüfung lügt dann. **[Vermutung: Das betrifft möglicherweise die Claude-iOS-App, Tarek prüft.]**
- **iframe:** Seit Chrome 64 ist das Mikrofon in fremden iframes standardmäßig gesperrt und braucht `allow="microphone"` am iframe [40]. Ein `Permissions-Policy: microphone=()`-Header führt sofort zu `not-allowed`, auch wenn der Nutzer zugestimmt hat [40]. Safari verhielt sich bei gleichem Aufbau anders und strenger [40].
  **Hinweis für Tarek:** Die Werkzeugbeschreibung dieser Sitzung nennt bei den Artefakt-Fähigkeiten auch „camera, microphone“ als mögliche Laufzeit-Fähigkeiten. `contract/` 0.2.49 kennt laut `src/platform/stt.ts` keine Mikrofon-Fähigkeit. Das ist ungeprüft, bitte gegen die aktuelle Fähigkeitenliste klären.
- **Zwischenergebnisse und Dauerbetrieb:**
  - Chrome liefert vorläufigen Text, der sich noch ändert, und endgültigen Text [62].
  - Auf iOS wird über unzuverlässige `interimResults` berichtet: mal langsamer, mal nur Endergebnisse, offline Fehlschläge [63]. Andere Berichte nennen doppelten Text, und `isFinal` kam nie [37].
  - In Safari lief die Erkennung nach Sprechende weiter und musste von Hand gestoppt werden. Dabei gingen Wörter verloren [37].
  - **Folge:** Ein Knopf zum Stoppen ist robuster als die automatische Endeerkennung. **[Vermutung]**
- **Weitere Stellschrauben:**
  - `maxAlternatives` liefert mehrere Lesarten [35].
  - `confidence` ist laut Spezifikation 0–1, aber nicht herstellerübergreifend vergleichbar [61].
  - `phrases` ist eine Liste mit Gewichtung bis 10, um die Erkennung auf erwartete Ausdrücke zu lenken [61]. Für Aussprachetests wäre das schädlich, weil es den Erkenner zur Zielform hinzieht. **[Vermutung]**
- **Genauigkeit bei Nicht-Muttersprachlern:** Eine Studie von 2026 nennt für Diktat-Erkennung bei L2-Sprache etwa 62 % Transkript-Genauigkeit insgesamt, aber nur etwa 42 % bei freier Rede. Das ist nur aus einem Suchauszug, der Volltext war gesperrt [42b]. **Folge:** Freies Sprechen wird oft falsch verschriftet, deshalb sollte das Transkript immer vor dem Absenden sichtbar und änderbar sein. **[Vermutung]** Die App macht das heute schon so („nie automatisch senden“, `src/platform/stt.ts`).
- **Füllwörter:** Ob Chrome oder Apple „um/uh“ mitschreiben, ist **nicht belegt**. Saubere Transkripte lassen es eher vermuten, dass sie herausgefiltert werden. **[Vermutung, am Gerät testen]**

### 4.2 Sprachausgabe (`speechSynthesis`)
- **Unterstützung:** iOS Safari ab Version 7, Chrome Android, Samsung Internet [64].
- **iPhone-Stimmen:** Laut Entwicklern klingen iOS-Standardstimmen „viel schlechter“ als „Enhanced/Premium“-Stimmen [65]. Diese muss der Nutzer selbst in den Einstellungen laden. Apps können sie nicht herunterladen und nicht sehen, welche verfügbar wären [65]. Die Belege stammen aus der nativen iOS-Schnittstelle, für Safari ist das nicht eigens belegt. Nach iOS-Updates können Stimmen gelistet sein, aber nicht funktionieren [65]. Ältere Berichte: In Safari sei nur eine Stimme je Sprache wählbar, und `getVoices()` sei anfangs leer [65].
- **Android:** Google hat die Stimmen seiner Sprachdienste serverseitig für 421 Stimmen in 67 Sprachen verbessert, ohne Änderung bei Entwicklern [66].
- **Akzente:** Welche Akzente verfügbar sind, hängt von den installierten Stimmen ab (en-US, en-GB, en-AU, en-IN …). **[Vermutung, am Gerät prüfen]**
- **Tempo:** `rate` ist einstellbar. Die App nutzt schon 0,8–1,1 (`src/platform/speech.ts`).

### 4.3 Eigene Stimme aufnehmen und abspielen
- `MediaRecorder` gibt es in iOS Safari ab 14.5 und in Chrome Android [67]. Damit wäre „Ich höre mich selbst und vergleiche mit der Modellstimme“ (wie bei BoldVoice [55]) ohne Server möglich, **sofern** das Mikrofon im iframe freigegeben ist (4.1). **[Vermutung]**
- Eine Tonhöhen-Kurve (Satzmelodie) aus dem Mikrofon zu berechnen, ist mit Web Audio grundsätzlich denkbar. Im Markt habe ich das nicht belegt gefunden. **[Vermutung]**

### 4.4 Aussprachebewertung ohne Server
- **Modelle im Browser:** Es gibt Lautschrift-Erkenner (wav2vec2) als ONNX für Transformers.js. Ein Beispielprojekt bewertet damit Wörter gegen CMU-Wörterbuch-Aussprachen. Die Modelle sind aber groß: etwa 355 MB (INT8) für den Lauterkenner [68], etwa 123 MB für ein englisches Ausrichtungsmodell [68].
  **Einordnung [Vermutung]:** Artefakte erlauben 15 MB je Binärdatei und 256 MB je Version (Werkzeugbeschreibung). Ein solches Modell müsste zerstückelt und bei jedem Start geladen werden. Das ist für Tempo (Facette 14) und Handy kaum vertretbar. Tarek entscheidet.
- **Transkript + Claude (Forschung):**
  - **TextPA (2025)** wandelt Sprache in Text um: Whisper-Transkript, Lautschrift (IPA) aus wav2vec2, CMU-Lautfolge mit Pausenlängen. Ein Sprachmodell vergibt daraus Werte für Genauigkeit und Flüssigkeit und begründet sie. Ohne Training kam es auf Speechocean762 auf eine Korrelation mit menschlichen Urteilen von etwa 0,53 (Genauigkeit) und 0,56 (Flüssigkeit). Speziell trainierte Modelle erreichen 0,70–0,80 [41].
  - **Wichtig:** Mit **nur dem Transkript** als Eingabe war ein *schwächerer* Erkenner (Whisper tiny) besser als ein starker, weil der starke Erkenner Fehler „verzeiht“ [41]. Betonung und Satzmelodie konnte das Modell aus Text nicht bewerten, mit diesem Kriterium wurde es sogar schlechter [41]. Dazu kommen schwankende Werte zwischen Läufen und erfundene Begründungen [41].
  - **Won (2025, J. Second Language Pronunciation):** Starke Systeme (Whisper large-v3, Azure) hatten fast keine Wortfehler, passten aber nur schwach zu menschlichen Bewertungen. Mittelstarke Systeme passten besser [42]. (Nur Abstract und Auszug, Volltext gesperrt.)
  - **Kim (2023):** Die Whisper-Fehlerquote zeigte Trainingsfortschritte, trennte aber nicht zwischen Verständlichkeit, Verstehbarkeit und Niveau wie menschliche Bewerter [69].
- **Folgerung für ein Artefakt [Vermutung]:**
  - Browser-Erkenner (Google/Apple) sind starke, „verzeihende“ Erkenner. Ein Abgleich von Zielsatz und Transkript misst darum **Verständlichkeit für eine Maschine**, nicht Lautgenauigkeit.
  - Seriös ist eine Aussage wie „Wort X wurde als Y verstanden. Wahrscheinlicher Grund: Laut /θ/ → /s/. So übst du ihn.“ Dabei liefert Claude Erklärung und Übung, `maxAlternatives` kann zusätzliche Hinweise geben.
  - Nicht seriös sind Prozentwerte für Laute, Betonung oder Satzmelodie.
  - Flüssigkeit (Wörter pro Minute, Pausen) lässt sich grob aus Start- und Endzeitpunkten des Sprechens berechnen. Die Ereignisse `speechstart`/`speechend` gibt es laut Spezifikation [35]. Zeitstempel je Wort liefert die Web-Speech-Schnittstelle nicht. **[Vermutung, aus der Eigenschaftsliste [35]]**

---

## 5. Top-Muster mit Machbarkeit

Facetten: 4 Hören · 5 Sprechen/Flüssigkeit/Selbstsicherheit · 6 Anpassung · 7 Vielfalt · 10 Handy · 11 Laptop · 12 Motivation.
Machbarkeit „im Artefakt ohne Fremd-API“: **ja** / **wahrscheinlich** / **nein**, jeweils mit Grund. Alles mit Mikrofon steht unter dem Vorbehalt von Tareks Klärung (4.1).

| # | Muster | Quelle | Facetten | Machbar? |
|---|---|---|---|---|
| 1 | **Vorbereiten → Üben → Anwenden je Thema.** Vor dem Gespräch die nötigen Sätze und Wörter hören und sagen, dann erst frei sprechen. Ziele vorab sichtbar. | Speak [2], Babbel Speak [12], Busuu [15] | 5, 7, 12 | **ja.** Text, Sprachausgabe und `sample`, Mikrofon optional (Tippen geht immer). |
| 2 | **Mission-Rollenspiel mit Abhak-Liste** (2–3 Aufgaben, z. B. „Bedarf erfragen, Einwand Preis behandeln, nächsten Termin fixieren“). Die KI lenkt zurück, wenn man abschweift, am Ende steht, was erreicht wurde. Business-Variante mit Persona und Einwänden. | Speak [1], ELSA [9], Busuu [15], Yoodli [28], Loora [46] | 5, 8, 12 | **ja.** Claude prüft die Aufgaben am Transkript. Das Einwand-Training existiert schon und kann das aufnehmen. **[Vermutung]** |
| 3 | **Korrektur-Politik statt Dauer-Korrektur:** Im Gespräch höchstens eine unauffällige Umformulierung (Recast), ausführlich erst am Ende. Stufe wählbar (aus / leise / deutlich). | Lily [17], Busuu [15], Langua [5], Promova [31], Chatbot-Studie [58] | 5, 6, 12 | **ja.** Steuerung über den Prompt. |
| 4 | **Nachbericht „Stärke + 1–3 Arbeitspunkte + besser so“:** eigene Sätze neben der natürlicheren Fassung, mit Begründung, auf Wunsch vorgelesen. Korrekturen gehen nicht im Verlauf unter, sondern landen dauerhaft in einer Liste. | Duolingo-Transkript [18], Langua [5][47], Yoodli [28], ELSA [9], Preply [23] | 5, 8, 12 | **ja.** `sample` + `db` + Sprachausgabe. |
| 5 | **Fehler-Schleife:** Fehler aus dem Gespräch werden Lernkarten oder Grammatik-Aufgaben mit Wiederholung nach Plan (FSRS). Im nächsten Gespräch werden genau diese Formen gezielt herausgelockt und geprüft. | Speak „Made for You“ [1], Langua [4][5], Univerbal [48]. Die geschlossene Schleife hat **keiner** belegt. | 6, 2, 3, 5 | **ja.** Vorhandener FSRS-Kern und `db`. Das wäre ein echter Vorsprung. **[Vermutung]** |
| 6 | **Wörter aus Gespräch und Hörtext mit einem Tipp speichern**, als *Produktionskarte* (Deutsch sehen → Englisch **sagen** → aufdecken und hören). | Langua [5], Praktika [6] | 2, 5, 6 | **ja.** Sprechen per Mikrofon wahrscheinlich, sonst Tippen. |
| 7 | **Antizipation (Pimsleur):** Deutsche Situation oder Frage hören → Pause → selbst sagen → Modellsatz hören → nach wachsenden Abständen wieder. Als freihändige Audio-Runde („Pendelmodus“). | Pimsleur [19][20] | 4, 5, 7, 10 | **ja** für Hören und Sprechen ohne Bewertung. **Wahrscheinlich** mit automatischer Prüfung (Mikrofon). Freihändig mit gesperrtem Bildschirm ist im Browser **[Vermutung]** unzuverlässig. |
| 8 | **Satz-Hör-Sprech-Reps (Glossika) mit Tempo-Stufen:** kurze Sätze aus Emrahs Wortschatz in 0,75 / 1,0 / 1,1-fach, nachsprechen, Zähler „noch 12 Reps · ~3 Min.“. | Glossika [22], Langua 0,75× [5], WELE [34] | 4, 5, 12 | **ja.** `speechSynthesis` mit `rate`. |
| 9 | **Hörtraining in Stufen:** Diktat (Satz hören → tippen → Unterschiede markieren), Lücke hören, Verständnisfragen, Akzentwechsel US/UK, langsamer/normal. | Dictationly/Go Dictation [34], Langua [5] | 4, 7 | **ja.** Akzente nur so weit, wie Stimmen auf dem Gerät installiert sind (4.2). |
| 10 | **Drücken zum Sprechen + sichtbarer Zuhör-Zustand + Transkript vor dem Senden:** kein automatisches Abschneiden bei Pausen. Ein deutlicher „hört zu“-Zustand, vorläufiger Text live, Senden erst nach Bestätigung. | Duolingo-Umstellung [18][24], Speak-Kritik [21], iOS-Berichte [37][63] | 10, 11, 13 | **wahrscheinlich.** Hängt am Mikrofon im iframe. Die App hat das Grundgerüst schon (`stt.ts`). |
| 11 | **Wörter leuchten beim Sprechen auf (Echtzeit-Treffer à la Yousician):** Beim Nachsprechen färbt sich jedes erkannte Wort des Zielsatzes. | Speak [1], Yousician [54] | 5, 10, 12 | **wahrscheinlich.** Chrome liefert Zwischenergebnisse [62], auf iOS unzuverlässig [63]. Fallback: Färbung nach Ende. |
| 12 | **Verständlichkeits-Check statt Lautnote:** Zielsatz vs. Transkript. Claude erklärt, welches Wort als was verstanden wurde und welcher Laut die wahrscheinliche Ursache ist, mit Mini-Übung. Ehrlich beschriftet („So hat dich die Spracherkennung verstanden“). | TextPA [41], Won [42], Gegenbeispiele Speak/Talkpal [1][26] | 5, 13 | **wahrscheinlich.** Grenzen: Erkenner verzeiht viel, keine Betonung und Melodie, Werte schwanken [41][42]. |
| 13 | **Flüssigkeits-Runde 4/3/2 mit Messwerten:** dasselbe Thema (z. B. Produkt-Pitch) dreimal mit kürzer werdender Zeit. Gezeigt werden Wörter pro Minute, längste Pause und Füllwörter je Runde als „du wirst flüssiger“-Kurve. | Nation/Arevart [56], Orai [30], Yoodli [28] | 5, 8, 12 | **wahrscheinlich.** Zeit und Wortzahl aus Transkript und Ereignissen. Füllwörter werden ggf. von der Erkennung verschluckt (4.1). Ohne Mikrofon nur als Selbstversuch mit Stoppuhr. |
| 14 | **Angstfreier Einstieg:** erster Satz konkret und leicht („Erzähl in einem Satz, was du heute verkaufst“), jederzeit wiederholen, „nur du siehst das“, keine Punktabzüge im Gespräch. | Promova [31], Babbel [12], Lily [17], Planung senkt Angst [59] | 5, 12 | **ja.** |
| 15 | **Gedächtnis über Gespräche:** Der Tutor kennt Emrahs Kunden, Produkte und Termine sowie offene Fehler und greift sie auf („Letzte Woche hattest du den Termin mit …“). | Lily [16], Praktika [8], Langua [4] | 6, 12 | **ja.** `db` speichert ein kurzes Profil, das jede `sample`-Anfrage mitschickt (Grenze 64 KiB beachten). |

**Nicht machbar bzw. abzuraten (mit Grund):**
- **Lautgenaue Prozent-Bewertung wie ELSA:** **nein.** Ohne Server bräuchte es ein Modell von 120–355 MB im Browser [68]. `sample` hat keinen Audio-Eingang (Auftrag). Aus dem Transkript ist das nicht verlässlich [41][42].
- **Echtzeit-Hinweise zu Tempo und Energie während echter Kundentermine wie Poised:** **nein.** Das erfordert eine Desktop-App neben Zoom [29].
- **Video-Avatar mit Lippenbewegung wie Lily oder Praktika:** **nein / nicht sinnvoll.** Nutzer finden Avatare teils störend [7]. **[Vermutung zum Aufwand]**

---

## 6. Anti-Muster (was Nutzer und Tests beklagen)

1. **Zu nachsichtige Erkennung, die volle Punkte gibt:** falsches Gefühl von Können (Speak) [1]. Gegenteil: **Muttersprachler werden abgewertet**, Akzentvarianten gelten nicht (ELSA) [27]. Beides zerstört das Vertrauen in jede Zahl.
2. **Unzuverlässige Aussprachewerte als Hauptversprechen** (Talkpal etwa 6/24 zutreffend) [26].
3. **Rückmeldung hinter einem Knopf je Nachricht ohne Zusammenfassung:** Wer nicht tippt, verpasst sie (Praktika) [6][7].
4. **Korrekturen, die im Chatverlauf untergehen:** Berichte sind dann „nicht umsetzbar“ (Langua-Nutzerwunsch) [47].
5. **Jeden Fehler korrigieren:** Das macht das Gespräch unbrauchbar (Promova) [31] und stört den Fluss (Studie) [58b].
6. **KI unterbricht nach wenigen Wörtern** (automatische Pausen-Erkennung) und beendet das Gespräch abrupt (Lily) [24].
7. **Immer dieselben Fragen** (Lily: wochenlang Frühstück) [18].
8. **Langsame Antworten:** wirken „wertend“ und machen ängstlicher (Promova) [31]. Die Verzögerung verrät die Maschine (VR-Studie) [58b].
9. **„Wiederholung“ = nur Nachsprechen derselben Muster, ohne Erklärung und ohne Fehlerverlauf** (Speak) [1].
10. **Lob trotz Fehler** („Great job!“ bei falscher Karte, Langua) [5]. Ebenso automatisches Weiterschalten nach einem Fehler (Speak) [21].
11. **KI knickt bei Widerspruch ein,** obwohl ihre Korrektur richtig war (Langua) [5].
12. **Rein reaktive Korrektur:** Wer schwierige Formen meidet, lernt sie nie, weil nichts sie gezielt herauslockt (Talkpal-Übersicht) [26].
13. **Auswendig gelernte Sätze ohne freien Transfer** (Glossika) [53]. Dazu der Wiederholungs-Berg durch zu viele neue Sätze [53].
14. **Unsichtbarer Zuhör-Zustand:** Man weiß nicht, ob die App gerade hört (Speak) [21].
15. **Ablenkende Avatare ohne reinen Tonmodus** (Praktika) [7].
16. **Starre Pfade:** Zielwechsel löscht Fortschritt (Praktika) [6][7]. Gespräche ziehen zu streng aufs Skript zurück [6].
17. **Funktions-Überfrachtung am Anfang** (Langua) [5].
18. **Hören ohne Tempo- und Akzentwahl** (Speak) [1].
19. **Werte als „% wie ein Muttersprachler“** statt Verständlichkeit [27]. Das passt nicht zu Emrahs Ziel „fluent and confident“. **[Vermutung]**

---

## 7. Quellen

[1] LanguaTalk: Speak App Review 2026 – https://languatalk.com/blog/speak-app-review/ (*Hinweis: LanguaTalk betreibt den Wettbewerber Langua*)
[2] Speak, Startseite (laut Anbieter) – https://www.speak.com/
[3] Trustpilot Praktika – https://www.trustpilot.com/review/praktika.ai?page=5 · https://www.trustpilot.com/review/praktika.ai?page=2
[4] LanguaTalk: Learn English with AI (Test mehrerer Apps, vom Langua-Hersteller) – https://languatalk.com/blog/learn-english-with-ai-english-tutor
[5] Lingtuitive: Langua AI Tutor Review – https://lingtuitive.com/blog/langua-ai-tutor-review
[6] Headway: Praktika Review – https://makeheadway.com/blog/praktika-review/
[7] wie [4], Abschnitte Speak und Praktika – https://languatalk.com/blog/learn-english-with-ai-english-tutor
[8] Praktika, Startseite (laut Anbieter) – https://praktika.ai/
[9] ELSA Blog: Practice Real-Life Conversations – https://blog.elsaspeak.com/en/practice-real-life-conversations
[10] Loora, Startseite (laut Anbieter) – https://www.loora.com/
[11] Product Hunt Univerbal – https://www.producthunt.com/products/univerbal-formerly-quazel/reviews · App-Store-Daten https://apps.appfollow.io/ios/univerbal-ai-language-learning/6443595452?country=us
[12] Babbel Presse: Babbel Speak (laut Anbieter) – https://www.babbel.com/press/en-us/releases/babbel-speak
[13] Babbel Presse: Learn with your own voice (laut Anbieter) – https://www.babbel.com/press/en-us/releases/learn-with-your-own-voice-babbel-launches-two-new-speech-based-features-us
[14] The Next Web: Babbel speech tools – https://www.thenextweb.com/news/babbel-app-new-speech-tools-boost-foreign-language-confidence
[15] Busuu Blog: Busuu Conversations (laut Anbieter) – https://blog.busuu.com/?p=27896
[16] heise: Duolingo zu KI-Videoanrufen mit Lily – https://heise.de/-9951940 · Duoplanet – https://newsletter.duoplanet.com/posts/duolingo-video-call-lily
[17] Duolingo Blog: Video Call (laut Anbieter) – https://blog.duolingo.com/video-call
[18] D. W. Rosales: Duolingo Max Review (Nutzerbericht) – https://davidwilliamrosales.com/2025/09/27/duolingo-max-review/
[19] Wikipedia: Pimsleur Language Programs – https://en.wikipedia.org/wiki/Pimsleur_Language_Programs
[20] Pimsleur: The Pimsleur Method (laut Anbieter) – https://www.pimsleur.com/the_pimsleur_method · Pimsleur-Blog https://www.pimsleur.com/blog/memory-and-language-learning-how-pimsleur-helps-you-retain-what-you-learn/
[21] Apple App Store: Speak (Beschreibung laut Anbieter, Rezensionen) – https://apps.apple.com/us/app/speak-language-learning/id1286609883
[22] Glossika: What is the Mass Sentence Method (laut Anbieter) – https://glossika.notion.site/What-is-the-Mass-Sentence-Method-272b88aeb94380c09290f944f52c4c23 · Erfahrungsbericht 25 Reps: https://howlearnspanish.com/?p=2966
[23] Preply: New AI-powered features, 08/2025 (laut Anbieter) – https://preply.com/en/blog/preply-announces-new-ai-powered-features-to-guide-the-future-of-personalized-learning-in-a-human-ai-world
[24] Reddit-Spiegel: Lily-Video-Call-Thread (01/2026) – https://reddit.sentinel-team.org/posts/1qny1do/snapshots/2026-01-27T01%3A30%3A17.601676Z
[25] Talkpal, Startseite (laut Anbieter) – https://talkpal.ai/
[26] Talkpal-Tests: Medium (Sarah, Expertentest) https://oh-yeah-sarah.medium.com/talkpal-review-in-depth-testing-by-a-language-learning-expert-7eb1f6fbdd4a · Headway https://makeheadway.com/blog/talkpal-review/ · SpeakShark (Wettbewerber) https://speakshark.com/blog/talkpal-review-2026 · Trustpilot https://uk.trustpilot.com/review/talkpal.ai?page=7
[27] G2: ELSA Speak Reviews – https://www.g2.com/products/elsa-speak/reviews · Product Hunt ELSA – https://www.producthunt.com/products/elsa/reviews?page=1 · AllLanguageResources – https://www.alllanguageresources.com/elsa-speak/
[28] Yoodli, Startseite (laut Anbieter) – https://yoodli.ai · Capterra https://www.capterra.com/p/10019324/Yoodli/reviews/ · G2 https://g2.com/products/yoodli-inc-yoodli/reviews · Outdoo (Kritik) https://www.outdoo.ai/blog/yoodli-alternatives
[29] Poised, Startseite mit Einstellungshinweis – https://poised.com/ · Cybernews https://cybernews.com/ai-knowledge-base/tools/poised/
[30] Orai, App Store (laut Anbieter) – https://apps.apple.com/us/app/-/id1203178170 · VentureBeat https://venturebeat.com/ai/orai-app-uses-ai-to-help-you-become-a-better-public-speaker
[31] Promova-Entwickler (dev.to): What we learned designing an AI tutor (Anbieter-Erfahrungsbericht) – https://dev.to/andrew-will/what-we-learned-designing-an-ai-tutor-for-language-learners-1124
[32] Duolingo Blog: Duolingo Max (laut Anbieter) – https://blog.duolingo.com/duolingo-max · TechRadar https://www.techradar.com/news/duolingos-new-gpt-4-ai-will-happily-explain-why-your-spanish-is-wrong
[33] Duolingo: Video Call Research Report (laut Anbieter) – https://blog.duolingo.com/video-call-research-report
[34] Diktat-/Hör-Apps: WELE https://mwm.ai/apps/wele-learn/6449467539 · Dictationly https://apps.apple.com/th/app/dictationly/id6738851542 · Go Dictation https://mwm.ai/apps/go-dictation-listen-write/6499258274 · Parroto https://apps.apple.com/app/id6752111996
[35] MDN: SpeechRecognition – https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
[36] caniuse: Speech Recognition API – https://caniuse.com/speech-recognition
[37] Apple Discussions: SpeechRecognition in Safari 17.1 – https://discussions.apple.com/thread/255492924 · Apple Dev Forum 694847 https://developer.apple.com/forums/thread/694847 · addpipe: SpeechAnalyzer https://blog.addpipe.com/apple-speechanalyzer-api/ · AssemblyAI-Leitfaden https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api
[38] WebKit Bug 225298 (Siri/Diktat nötig; nicht in SFSafariViewController/Home-Bildschirm) – https://bugs.webkit.org/show_bug.cgi?id=225298 · Apple Dev Forum 739006 https://developer.apple.com/forums/thread/739006
[39] WebKit Bug 239816 (WKWebView) – https://bugs.webkit.org/show_bug.cgi?id=239816
[40] Mikrofon in fremden iframes: addpipe https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy.md · Canvas-LMS-Issue https://github.com/instructure/canvas-lms/issues/1219 · Coder-Commit https://git.dragonfruit.dev/mirror/coder/commit/67f5494665ccff03cb20b18ef3d49b84cb9842e2 · WebKit Bug 167430 https://bugs.webkit.org/show_bug.cgi?id=167430
[41] Read to Hear / TextPA (arXiv 2509.14187) – https://arxiv.org/html/2509.14187
[42] Won (2025): Assessing the efficacy of word error rate as a proxy for pronunciation quality, J. Second Language Pronunciation – https://doi.org/10.1075/jslp.25012.won (nur Abstract/Auszug)
[42b] McCrocklin (2026): ASR-Dictation Accuracy for Second Language Speech – https://onlinelibrary.wiley.com/doi/10.1155/hbe2/5762328 (nur Suchauszug)
[43] Drittseiten zu Speak Smart Review – https://www.videosdk.live/ai-apps/speak · https://gptzone.net/aplicaciones-ia/en/speak
[44] Praktika Product Hunt / Trustpilot – https://www.producthunt.com/posts/praktika · https://au.trustpilot.com/review/praktika.ai?page=3
[45] ELSA Score (Medium, ELSA, laut Anbieter) – https://medium.com/@elsaspeak/discover-your-elsa-score-an-ai-powered-visualization-of-your-english-speaking-proficiency-in-369f46dba6bc · Screensdesign https://screensdesign.com/showcase/elsa-speak-english-learning · AllLanguageResources https://www.alllanguageresources.com/elsa-speak/
[46] Loora for Business (laut Anbieter) – https://www.loora.com/for-business
[46b] Unite.AI: LanguaTalk Review – https://www.unite.ai/languatalk-review/
[47] LanguaTalk-Roadmap, Nutzerwunsch „Audio review flashcards mode“ – https://roadmap.languatalk.com/b/n0oo8d06/feature-requests/audio-review-flashcards-mode
[48] Univerbal, Startseite (laut Anbieter) – https://univerbal.app/
[49] Busuu Speaking Practice, Business Wire 06/2024 (laut Anbieter) – https://www.businesswire.com/news/home/20240627194750/en/Busuu-Launches-AI-powered-Speaking-Practice-to-Boost-Real-World-Conversation-Skills
[50] Cambly Support / Presse (laut Anbieter) – https://support.cambly.com/hc/en-us/articles/43605351214221 · https://prnewswire.com/news-releases/with-millions-of-data-points-about-how-people-learn-english-cambly-reimagines-the-learning-experience-using-world-class-tutors-ai-powered-features-302266081.html · Stimuler-Vergleich (Wettbewerber) https://stimuler.tech/blog/cambly-vs-stimuler-which-app-actually-helps-you-speak-better
[51] Backward Build-up: jimmyakin.com https://jimmyakin.com/2006/02/backwards_learn.html · Wikipedia Back-chaining https://en.wikipedia.org/wiki/Back-chaining · Pimsleur-Analyse https://courses.languagereactor.com/david/alc-english/src/commit/adecabbc4d062182efd4cd12bf79b1138be11d98/pimsleur-study/ANALYSIS.md
[52] Pimsleur, App Store (laut Anbieter) – https://apps.apple.com/us/app/id1405735469
[53] Discover Discomfort: Glossika Review 2026 – https://discoverdiscomfort.com/glossika-review-language-learning-app/
[54] Yousician: App Store (laut Anbieter, Rezension mit Entwickler-Antwort) – https://apps.apple.com/gb/app/id959883039 · Happy New Guitar Day https://www.happynewguitarday.com/can-you-learn-guitar-with-yousician/
[55] BoldVoice: App Store (laut Anbieter) https://apps.apple.com/us/app/wellocution/id1567841142 · Medium-Review https://medium.com/@emmamillerw1990/boildvoice-review-despite-its-usefulness-it-has-a-big-flaw-33c944b1150c · SourceForge https://sourceforge.net/app/boldvoice/web-app/
[56] 4/3/2-Technik: LearnLab-Übersicht https://learnlab.org/research/wiki/index.php/Fostering_fluency_in_second_language_learning · Gianfranco Conti https://gianfrancoconti.com/2017/03/04/ · UCL (Boers u. a.) https://discovery.ucl.ac.uk/10128571/1/LTR2021.pdf
[57] Shadowing-Synthese und Studien: https://dspace-test.ucuenca.edu.ec/handle/123456789/34808 · AILA 2021 https://aila2021.dryfta.com/program/abstract-archive/abstract/public/2315/assessing-shadowing-training-for-developing-l2-listening-and-speaking-focusing-on-input-and-output-effects · Hora (Accents Asia) https://accentsasia.org/issues/11-1/hora.pdf
[58] ChatBack (BEA 2023): Grammatical Error Feedback in a Chatbot – https://virtual2023.aclweb.org/paper_BEA_10.html
[58b] Mixed-Reality-Agenten (arXiv 2510.08227) https://arxiv.org/pdf/2510.08227 · ELLMA-T (arXiv 2410.02406) https://arxiv.org/pdf/2410.02406
[59] Planung und Sprechangst (ARELE, Japan 2019) – https://www.jstage.jst.go.jp/article/arele/30/0/30_145/_article
[60] Chromium blink-dev: Intent to Ship On-Device Recognition Quality – https://groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I · Chrome-AI-Forum https://groups.google.com/a/chromium.org/g/chrome-ai-dev-preview-discuss/c/Rlyc2uAsFCY · MDN processLocally https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally
[61] W3C Web Speech API Spezifikation – https://webaudio.github.io/web-speech-api/
[62] Chrome Developers: Voice driven web apps – https://developer.chrome.com/blog/voice-driven-web-apps-introduction-to-the-web-speech-api
[63] Apple Dev Forum 775699 (interimResults iOS) – https://developer.apple.com/forums/thread/775699
[64] caniuse: Speech Synthesis – https://caniuse.com/speech-synthesis
[65] Apple Dev Forums zu Stimmenqualität: https://developer.apple.com/forums/thread/758460 · https://developer.apple.com/forums/thread/787779 · https://developer.apple.com/forums/thread/735893 · Safari-Stimmenwahl (SO-Archiv) https://kaweah.freedombox.rocks/kiwix/stackoverflow.com_en_all_2023-11/questions/50386487/speech-synthesis-can-t-get-mobile-safari-to-change-voice
[66] Voicebot: Google upgrades TTS voices on Android – https://voicebot.ai/2022/10/03/google-upgrades-text-to-speech-voices-on-android/
[67] caniuse: MediaRecorder – https://caniuse.com/mediarecorder
[68] Hugging Face: Speako Phoneme Recognizer (ONNX, ~355 MB) https://huggingface.co/robg/speako-phoneme-recognizer · charsiu-js (~123 MB) https://huggingface.co/mnaoizyyy/charsiu-js-models · wav2vec2-lv-60-espeak ONNX https://hf-cn0.pages.dev/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX
[69] Kim (2023), Phonetics and Speech Sciences: Whisper-WER vs. menschliche Urteile – https://koreascience.kr/article/JAKO202322149979896.pdf · Ballier u. a. (ICNLSP 2023) https://aclanthology.org/2023.icnlsp-1.30.pdf
