# Readlang – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: normal

Kurzurteil: Readlang (vom früheren Duolingo-Entwickler, der „Duolingo Stories“ gebaut hat) ist ein Leseprogramm: Man tippt Wörter in echten Texten an, jede Übersetzung wird mit dem Ursprungssatz gespeichert und später im selben Satz geübt. Die neue Übungssitzung bewertet automatisch und kennt zwei Formen: **passiv** (Auswahl, beide Richtungen) und **aktiv** (das fehlende Wort im Satz tippen); das SRS entscheidet die Form, schwache Wörter starten passiv und werden in derselben Sitzung aktiv. Besonders: einstellbare Tippfehler-Toleranz und ein „Explain/Edit“-Knopf nach jeder Antwort. Für Emrah sehr gut übertragbar: Satz aus dem Lesen wird Karte, passiv→aktiv in einer Sitzung, Tippfehler-Stufen.

## 1. Planung
- **Algorithmus:** SRS „inspiriert von SuperMemo 2“; schwere Wörter öfter, leichte seltener; häufige Wörter einer Sprache haben Vorrang [G, [rl-fc]]. SM-2 = klassischer Anki-Vorläufer mit Leichtigkeitsfaktor je Karte.
- **Auswahl:** Lernkarten sind die häufigsten Wörter aus „Not Started“ und „Scheduled for today“; mit Stern markierte Wörter überspringen die Häufigkeitsregel [G, [rl-srs2]]. Wortauswahl nach Frequenzlisten [G, [rl-about]].
- **Kein Tageszwang:** Statt eines festen Tagesziels (früher Standard 30) wählt man Sätze von 10, 20 oder 30 Karten und kann sie beliebig oft wiederholen; wie viele heute fällig sind, wird nicht gezeigt [G, [rl-srs2]]. Rückstand entsteht so nicht sichtbar [Vermutung].
- **Passiv/aktiv je Wort:** Neue oder schwache Wörter beginnen passiv und erscheinen später in derselben Sitzung aktiv; mit wachsendem Können nur noch aktiv [G, [rl-new]]. Beim neuen Wort fragt Mastery, ob man es aktiv, passiv lernen oder löschen will [G, [rl-new]].
- **Falsch:** Ein verfehltes Wort kommt in derselben Sitzung wieder, bis es sitzt; es kann auf passiv zurückfallen, manchmal muss man zweimal richtig antworten [G, [rl-new]].
- **Geschwister:** Auswahlfragen laufen in beide Richtungen, das SRS zählt beide als passiv und wählt zufällig [G, [rl-new]]. Mehrere Kontexte je Wort: in „Classic“ durchgehbar [S, [rl-req]].
- **Fuzz, Lastausgleich, Problemwörter-Liste:** nicht belegt gefunden.

## 2. Abfrage-Leiter
- **Modi** [G, [rl-new]]: *Blitz* = nur Auswahl (passiv); *Mastery* = Tippen (aktiv) plus Auswahl nach SRS-Entscheidung; *Classic Flashcards* = Selbstbewertung.
- **Passiv:** „What does ‚prihod‘ mean here?“ – Satz mit markiertem Wort, Bedeutung wählen [G, Bild [rl-img-5]]; oder Lückensatz, passendes Wort aus Optionen wählen [G, Bild [rl-img-7]].
- **Aktiv:** „Type the missing word“ – Lückensatz, Bedeutung als Hilfe darunter („Meaning: towards“), Wort tippen [G, Bild [rl-img-6]; G, Bild [rl-img-4]].
- **Übergang:** vom SRS gesteuert, nicht vom Lerner [G, [rl-new]]. Der Entwickler hat KI-Verständnisfragen wieder entfernt, weil sie oft schlecht waren [G, [rl-new-43]].

## 3. Bewertung
- Neue Sitzung: automatisch, „you don't need to self-grade“ [G, [rl-new]]. Classic: vier Knöpfe „Not at all / Almost / Yes, just / Perfectly“ (Tasten 1–4) [G, [rl-fc]].
- **Tippfehler-Toleranz einstellbar** in „Typing Settings“: „Allow typos and missing accents“ (vorgewählt), „Allow missing accents“, „Strict mode. No mistakes allowed!“; dazu „Skip typing for …“ je Wort [G, Bild [rl-img-4]].
- Alter Tippmodus: Bei „falsch“ gibt es einen Knopf, die eigene Antwort trotzdem als richtig zu werten (Alternativantworten) [G, [rl-typing]]. Bildschirmtext „Not quite, better luck next time“ [G, Bild [rl-img-2]].
- Zeit, Hinweise: nicht belegt gefunden.

## 4. Rückmeldung
- **Nach falsch:** rote Leiste „Incorrect – The correct answer is ‚income‘“, Knöpfe „Explain / Edit“ und „Continue“ [G, Bild [rl-img-5]].
- **Nach richtig:** grüne Leiste „Correct!“, Knöpfe „Explain“ und „Continue“ [G, Bild [rl-img-7]].
- **Explain:** KI-Erklärung im Kontext, z. B. was „l'emmena“ in genau diesem Satz heißt [G, Bild [rl-img-8]]; in die Übung integriert, damit man „das Richtige lernt“ [G, [rl-new-43]].
- **Edit:** falsche Übersetzung direkt korrigieren [G, [rl-fc]].
- Audio auf der Karte (Lautsprecher) [G, Bild [rl-img-2]]. Sonderzeichen-Tastatur je Sprache [G, [rl-typing]].

## 5. Kontext
- **Fester Ursprungssatz:** Karte zeigt den Satz, in dem man das Wort beim Lesen angetippt hat; volle Satzlänge, auf dem Handy dreifach so lang wie früher [G, [rl-new]].
- Kritik: Der bekannte Satz macht das Erinnern leichter, aber auch das „Schummeln“ aus dem Kontext [S, [rl-ll]]. Ein Forumstipp nutzt „Ask AI“, um zusätzliche Sätze zu erzeugen [S, [rl-ai]].
- **Gedächtniszustand gehört zum Wort/Ausdruck** (passiv/aktiv-Stand je Wort) [G, [rl-new]].

## 6. Aktive Nutzung
- Höchste Stufe ist das getippte Wort im Satz; eigene Sätze, Schreiben oder Sprechen mit Zielwörtern gibt es nicht [G, [rl-new]; Vermutung für „nicht vorhanden“, da nirgends beschrieben].

## 7. Fortschritt und Transparenz
- Fortschrittsbalken je Sitzung [G, Bild [rl-img-4]]; Karte zeigt „Last seen yesterday/today“ [G, Bild [rl-img-3]].
- „Words“-Reiter mit Liste, Bearbeiten, Export [G, [rl-fc]]. Serien-Übersicht [S, Blog-Bild].
- Fällige Menge, Behaltensrate: nicht angezeigt [G, [rl-srs2]]. Eine „Known Words“-Zahl wie bei LingQ wird im Forum gewünscht, gibt es also nicht [S, [rl-known]].

## 8. Bildschirmablauf
1. Text lesen, Wort antippen → Übersetzung; „Explain“ zeigt Erklärung im Kontext [G, Bild [rl-img-8]]. Wort samt Satz ist gespeichert [G, [rl-home]].
2. „Practice“ öffnen, Modus wählen (Blitz / Mastery / Classic) [G, [rl-new]].
3. Passive Frage: Satz, markiertes Wort, 3–4 Optionen [G, Bild [rl-img-5]].
4. Rückmeldung als Leiste unten (rot/grün) mit „Explain/Edit“ und „Continue“ [G, Bild [rl-img-5]; G, Bild [rl-img-7]].
5. Später in derselben Sitzung aktive Frage: „Type the missing word“, Bedeutung als Stütze, Handy-Tastatur [G, Bild [rl-img-6]].
6. Verfehlte Wörter kommen in der Sitzung wieder, bis richtig [G, [rl-new]].

## 9. Nutzerstimmen
Lob:
- Chrome-Store-Nutzer: Kontext sei entscheidend für Wortschatz, das Werkzeug liefere ihn gut [S, [rl-cws]].
- Chrome-Store-Nutzer (erfahrener Lerner): sehr wirksam, Bedeutungen in Liste und Karten bearbeitbar [S, [rl-cws]].
- Forennutzer wünschen sogar mehr Wörter pro Sitzung und Zuordnungsübungen – Zeichen hoher Nutzung [G, [rl-new-43]].

Klage:
- Forennutzer: Löschen-Kürzel und „ohne Tippen“-Einstellung funktionierten in der neuen Sitzung zunächst nicht, Verwirrung [G, [rl-new-43]].
- Testbericht: Ursprungssatz verrät die Antwort zu leicht [S, [rl-ll]].
- Chrome-Store-Nutzer: Übersetzungen nicht wie erwartet; Nachschlage-Fenster zeitweise kaputt [S, [rl-cws]].
- Preis-Kritik (Gratis begrenzt auf 10 Phrasen/Erklärungen pro Tag) [G, [rl-home]; S, Suchausschnitt].

## 10. Belege für die Wirkung
- Keine Wirksamkeitsstudie gefunden. Der Anbieter beruft sich nur allgemein auf Spaced Repetition und Lernen im Kontext [G, [rl-about]].

## 11. Übertragbar auf Lingo-Engine X
- **Antippen beim Lesen → Karte mit Ursprungssatz:** direkt passend zum Lesen-Reiter und zu Kap. 15 („Karten ohne Ursprungssatz“).
- **Passiv→aktiv innerhalb einer Sitzung:** schwaches Wort erst auswählen lassen, wenige Karten später im selben Satz tippen lassen – schneller Weg vom Erkennen zum Abruf.
- **Tippfehler-Stufen übernehmen** (Tippfehler und Akzente erlaubt / nur Akzente / streng): bei uns als Bewertung „fast richtig“ statt Lerner-Einstellung.
- **„Erklären“-Knopf nach jeder Antwort, auch nach richtig:** erfüllt Kap. 2 Nr. 4 (Begründung auch bei richtiger Antwort), mit Claude im Kontext des Satzes.
- **„Bearbeiten“ bei falscher Übersetzung:** Fehler im Inhalt sofort meldbar.
- **Anpassen: fester Satz verrät zu viel** – im aktiven Schritt einen neuen Satz nutzen.
- **Verwerfen: keine Anzeige der fälligen Menge** – Emrah braucht „heute n Karten, ca. m Minuten“.

## Quellen
- rl-home → https://www.readlang.com/ (abgerufen 30.10.2026)
- rl-about → https://readlang.com/about (abgerufen 30.10.2026)
- rl-fc → https://forum.readlang.com/t/learn-words-with-flashcards/54 (abgerufen 30.10.2026)
- rl-srs2 → https://blog.readlang.com/2013/08/09/spaced-repetition-version-2.html (abgerufen 30.10.2026)
- rl-typing → https://blog.readlang.com/2013/11/11/typing-mode.html (abgerufen 30.10.2026)
- rl-new → https://forum.readlang.com/t/feedback-wanted-on-new-practice-session/59 (abgerufen 30.10.2026)
- rl-new-43 → https://forum.readlang.com/t/feedback-wanted-on-new-practice-session/59/43 (abgerufen 30.10.2026)
- rl-req → https://forum.readlang.com/t/feature-request-classic-flashcards-mode-with-optional-typing/264 (nur Suche)
- rl-ai → https://forum.readlang.com/t/tip-use-ask-ai-to-generate-additional-context-sentences/2307 (nur Suche)
- rl-known → https://forum.readlang.com/t/add-known-words-count-like-lingq/3025 (nur Suche)
- rl-ll → https://www.lingualift.com/?p=1255 (Abruf leer; Inhalt nur aus Suchausschnitt)
- rl-cws → https://chromewebstore.google.com/detail/readlang/apcnmoajpaldpbepelpjgbplhoeidhia/reviews (abgerufen 30.10.2026; 4,2 Sterne bei 66 Bewertungen)
- rl-img-2 … rl-img-8 → Blog- und Forumsbilder, Links in der Bild-Teildatei (abgerufen 30.10.2026)
