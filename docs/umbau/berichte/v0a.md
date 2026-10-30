# Bericht Unterchat V0a: Vokabeln, Tiefen-Screening und Synthese

Stand 30.10.2026 · Zweig `claude/umbau-v0a` (vom Stand `591a388` auf `claude/umbau-fokus`) · Auftrag `docs/umbau/auftraege/v0a.md`

## ok
**ja.** Alle Ergebnisse liegen vor, beide Prüftore sind durchlaufen (Prüfung und gezielte Nachprüfung), und kein Blocker ist offen.

## commit
`2285f72`: letzter Inhalts-Commit vor diesem Bericht. Der Bericht selbst ist der Commit danach.

Verlauf auf dem Zweig:
- `a788ea6`, `eabfb4a`, `fae0b77`: Steckbriefe;
- `3dbd07f`: Bildquellen;
- `5db85c9`: Synthese, Entwurf;
- `7329956`: Synthese nach dem Prüftor;
- `2285f72`: Hinweise aus der Nachprüfung.

## Ergebnisse
| Datei | Inhalt |
|---|---|
| `docs/umbau/vokabeln/anbieter/*.md` | **19 Steckbriefe** (Mochi und RemNote getrennt, also 18 Anbieter aus dem Auftrag plus Speak, Brainscape und Glossika). Alle mit den 10 geforderten Kapiteln, dazu „Übertragbar“ und eine Quellenliste. Größte Tiefe: Anki (bis in den Quellcode), Clozemaster, Lingvist, Quizlet. |
| `docs/umbau/vokabeln/bildquellen.md` | 108 Bildlinks, 3–8 je Anbieter, nur Links, keine Bilder im Repository |
| `docs/umbau/vokabeln/synthese.md` | Methoden-Tabelle (81 Methoden mit Urteil), beste Kombination (Abfrage, Stufenleiter, Tagessitzung, Regeln für Claude), Abgleich mit Emrahs Auftrag (Bestätigungen, 10 Verbesserungsvorschläge, 9 Widersprüche W1–W9), Abgleich mit der Vorschau (14 Muster drin, 13 Bildschirm-Ergänzungen B1–B13), Umsetzungsliste V1–V5 mit Prüfung je Methode |

## zahlen
Alle Zahlen stammen aus Befehlsausgaben (`wc`, `grep -c`, `curl`).
- **Steckbriefe:** 19 Dateien, 2.454 Zeilen.
  - Kennzeichen im Text: 835 × [G], 407 × [S], 53 × [Vermutung].
  - Je Anbieter [G]/[S]: Anki 134/23, Lingvist 104/28, Clozemaster 97/47, Quizlet 18/63 (Hilfe-Seiten gesperrt, siehe unten), Vocabulary.com 54/9.
- **Bildlinks:** 108. Jeder wurde zweimal geprüft (beim Eintragen und gesammelt am 30.10.2026), alle 108 mit HTTP 200: 75 jpeg, 25 png, 1 gif, 7 Seiten mit Bild.
- **Methoden:** 81 (M1–M77 aus dem Markt, M78–M81 aus der Lehrer-Prüfung). Davon 38 übernehmen, 33 anpassen, 10 verwerfen. Alle 71 übernommenen oder angepassten Methoden haben ein Paket (V1–V5) und eine Prüfung. Das hat ein Skript geprüft, ohne Treffer für fehlende Methoden.
- **Prüftore:**
  - `learning-scientist`: Runde 1 mit 1 Blocker, 10 wichtigen Befunden und 3 Hinweisen; Nachprüfung ohne Blocker mit 1 wichtigen Befund und 4 Hinweisen, alle umgesetzt.
  - `english-teacher`: Runde 1 mit 1 Blocker, 8 wichtigen Befunden und 4 Hinweisen; Nachprüfung `ok: ja` mit 5 Hinweisen, alle umgesetzt.
  - Eine dritte Runde gab es nicht (A2).
- **Änderungen unter `src/`:** 0 Dateien (`git diff --name-only origin/claude/umbau-fokus..HEAD | grep -c ^src/` = 0).

## befunde[]
1. **Blocker aus dem Prüftor, behoben:**
   - Die Mindestmenge neuer Wörter fehlte an Tagen mit Rückstand. Das hätte Kap. 15 verletzt. Jetzt kommen an jedem Lerntag mindestens 2 neue Lexeme.
   - Das Beispiel *make/take a decision* hätte eine britisch richtige Form bestraft. Jetzt steht dort *hold* → *give a presentation*.
2. **ts-fsrs:** Version 6 der Bibliothek stellt standardmäßig auf FSRS-7 um [anki §1.1]. Das Projekt hat `ts-fsrs ^5.4.2`. Ein unbemerktes Update würde den Plan ändern. Vorschlag in M1: die Version festschreiben (V1).
3. **Anki:** Handbuch und Code widersprechen sich bei der Leech-Aktion. Laut Handbuch wird die Karte ausgesetzt, im Code-Standard nur markiert [anki §1.8]. Für uns ohne Folgen, weil wir eine eigene Regel bauen.
4. **Duolingo:** Die oft zitierten „+12 %“ messen die Rückkehr am Folgetag, nicht den Lernerfolg [duolingo §10].
5. **Clozemaster:** Der Fortschritt hängt am Satz, nicht am Wort. Das bestätigt den Verdacht aus Emrahs Auftrag zum Klumpen-Problem [clozemaster §5].
6. **Kein Anbieter** verbindet FSRS je Wort, automatische Note mit Zeit und Hilfe und eine Leiter bis zum geprüften eigenen Satz. Diese Lücke füllt Emrahs Auftrag (synthese.md, Einleitung).

## nicht_gelaufen[]
- **Tests** (`verify:fast`, Unit, E2E): nicht gelaufen. Es gab nur Dokumente, keine Änderung an Code oder Build.
- **Quizlet-Hilfe, Quizlet-Blog, Babbel-Hilfe, Busuu-Hilfe, Brainscape-Hilfe:** gesperrt (HTTP 403). Diese Aussagen stehen nur als [S] da, aus Suchtreffern und Sekundärquellen.
- **Bilder nicht angesehen:** Die App-Store-Bilder von Anki, Quizlet und Teilen von SuperMemo, Mochi, RemNote und Brainscape wurden nicht einzeln angesehen. In `bildquellen.md` ist das vermerkt. Vor dem Einbau in Emrahs Vergleichsseite einmal ansehen.
- **Nicht belegt gefunden** (offen, steht so in den Steckbriefen):
  - Lingvist: ob der Satz bei jeder Wiederholung wechselt; Modell-Parameter;
  - Quizlet: Schwellen für Familiar und Mastered, Stufe „Relaxed“;
  - Drops: Abstände;
  - Babbel und Busuu: Tippfehler-Toleranz;
  - WordUp: Bewertungslogik.
- **Unabhängige Wirkungsstudien:** für fast keinen Anbieter gefunden. Ausnahmen sind die HLR-Daten von Duolingo und der Memrise Prize, beide mit Beteiligung der Anbieter.
- **Emrahs echter Lernverlauf:** nicht gelesen. Das gehört zu Paket V0.
- **Vergleichsseite für Emrah:** nicht gebaut und nichts veröffentlicht. Das macht der Überchat (Auftrag).

## offene_fragen[] (für Emrah, über den Überchat)
1. **W1 – Wann beginnt „Benutzen“?** Empfohlen ist Variante B: Ein Wort in die Lücke tippen zählt schon ab Tag 0 als „Benutzen“, und deine 3-Tage-Schwelle gilt erst für die schweren Formen ab Stufe 4. Variante A wäre genau wie in deinem Auftrag. Der Lehrer und die Lernforschung empfehlen B.
2. **W4 – „Das wusste ich eigentlich“:** Empfohlen ist folgender Ablauf: Der Knopf wertet die Antwort nicht, und das Wort kommt kurz darauf in einem neuen Satz noch einmal. Erst diese Antwort zählt. Einverstanden?
3. **W2 – Stufen:** Deine 7 Stufen gelten intern. Angezeigt werden 3 Gruppen (erkennst du / auf dem Weg / bildest du selbst) und ein Balken mit 7 Teilen. Einverstanden?
4. **Stufe 7 „gefestigt“:** Verlangt werden 2 eigene, geprüfte Sätze. Bei Kernwörtern muss einer davon gesprochen sein (per Diktat). Ist das für dich in Ordnung, oder soll Sprechen ganz freiwillig bleiben?
5. **Kontingent neuer Wörter:** Vorgeschlagen sind mindestens 2 neue Wörter an jedem Lerntag, auch wenn viel fällig ist. Darüber entscheidet das Zeitbudget, höchstens bis zu deiner Einstellung (0/2/5/10, Standard 5). Einverstanden?

## Kurzfassung für Emrah
Ich habe 18 Lern-Apps genau untersucht, vor allem Anki, Clozemaster, Lingvist und Quizlet, und aus ihren besten Methoden einen Plan für deinen Wörter-Bereich gemacht. Die fünf stärksten Methoden sind diese.

Erstens plant Anki jedes Wort mit einem Gedächtnismodell (FSRS), streut die Termine gleichmäßig und lässt dasselbe Wort nie mehrmals am Tag kommen. Für dich heißt das: Schluss mit „dreimal heute, dann drei Wochen nichts“.

Zweitens tippst du das Wort selbst in die Lücke, mit der deutschen Bedeutung als Hilfe, wie bei Lingvist und Clozemaster. Du rätst also nicht mehr aus einer Auswahl, sondern holst das Wort aus dem Kopf. Auswahl gibt es nur noch als Rettung nach einem Fehler, und sie zählt nicht.

Drittens benotet die App deine Antwort selbst, aus richtig oder falsch, benutzter Hilfe und Tempo, mit fairen Tippfehler-Regeln wie bei Lingvist und Quizlet. Ein kleiner Tippfehler ist dann „fast richtig“ und nicht falsch, eine falsche Wortform aber schon.

Viertens wechseln die Sätze bei jeder Wiederholung, und jedes dritte Mal kommt das Wort ganz ohne Satz, so wie Vocabulary.com viele Fragen je Wort stellt. So erkennst du das Wort nicht mehr nur am bekannten Satz, sondern kannst es auch beim Sprechen abrufen.

Fünftens führt jedes Wort Stufe für Stufe bis zu deinem eigenen Satz, den Claude prüft und verbessert, ähnlich wie bei Busuu und Memrise. Am Ende jeder Sitzung kommt dazu eine kurze Mail-Aufgabe mit drei Wörtern.

Dazu siehst du ehrlich, wie es läuft: die Minuten für die nächsten 14 Tage und wie viel Prozent du wirklich behältst, wie in Anki.

Fünf kurze Fragen an dich stehen oben unter „offene Fragen“. Danach folgt Paket V0 mit deinem echten Lernverlauf und dem genauen Bauplan.
