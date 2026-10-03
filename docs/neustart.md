# Neustart: Dein persönlicher Englisch-Trainer

Konzept vom 03.10.2026, Anlass: Emrahs Rückmeldung („zu viele Token, Bugs, nicht intelligent, langweilig, Input fürn Arsch, komplett neu aufsetzen“).
Status: **Entwurf, wartet auf Emrahs Go.** Nach dem Go ersetzt dieses Dokument den alten Auftrag (`docs/auftrag.md`) überall dort, wo es abweicht.

---

## 1. Ehrliche Diagnose: Warum die jetzige App nicht trägt

1. **Zu viel auf einmal.** Die App hat 27 Bereiche, 46 verschiedene KI-Aufträge und rund 65.000 Zeilen Code. Jede Änderung kann an einer anderen Stelle etwas kaputt machen. Daher kommen die Bugs und das „Verschlimmbessern“.
2. **Kein eigener Lernstoff.** Eingebaut sind nur 40 Startwörter. Neue Wörter kommen fast nur, wenn du sie selbst hinzufügst. Deshalb siehst du oft dieselben Wörter, und die App „lebt nur von deiner Interaktion“.
3. **KI auch dort, wo sie nicht nötig ist.** Beispielsätze je Karte, Wochenbericht, Einschätzung: vieles fragt Claude, oft automatisch. Der tägliche Tagesauftrag liest jeden Abend die **komplette Wortliste** und schreibt drei bis vier ausgearbeitete Lektionen. Das kostet viele Token. Der letzte Lauf am 03.10. ist außerdem fehlgeschlagen.
4. **Nicht intelligent.** Es gibt keine Einstufung und kein Bild davon, was du kannst. Statt eines klugen Trainers gibt es feste Regeln (z. B. „Sag es“ an 4–5 von 7 Tagen), die sich unlogisch anfühlen.
5. **Input passt nicht zu dir.** Die Beiträge sind allgemein (Politik, Konjunktur). Du kannst nicht sagen, ob dir etwas gefallen hat, also wird es nie besser.

## 2. Die neue Idee in einem Satz

Ein Trainer, der **dich zuerst vermisst**, einen **Plan bis C1** hat, **jeden Tag selbst die richtige Mischung** auswählt und **KI nur dort einsetzt, wo sie etwas kann, was eine Regel nicht kann**.

## 3. Wissenschaftliche Grundlage (kurz)

| Prinzip | Was es heißt | Wie die App es umsetzt |
|---|---|---|
| **Vier Säulen** (Paul Nation, „Four Strands“) | Gutes Sprachenlernen besteht zu je etwa einem Viertel aus: Input verstehen, selbst formulieren, gezielt Wörter/Grammatik lernen, Flüssigkeit | Jede Woche ist auf diese vier Säulen verteilt, der Fahrplan zeigt alle vier |
| **Abrufen statt Wiedererkennen** (Roediger & Karpicke 2006) | Was man aktiv aus dem Gedächtnis holt, bleibt viel besser hängen | Fast jede Übung verlangt Tippen oder Bilden, nicht nur Antippen |
| **Verteilte Wiederholung** (FSRS) | Wiederholen genau dann, wenn man kurz davor ist zu vergessen | Jedes Wort und jeder Fehler hat einen eigenen Wiederholungstermin |
| **Mischen** (Interleaving) | Gemischte Aufgaben trainieren besser als Blöcke vom Gleichen | Formate und Themen wechseln innerhalb einer Sitzung |
| **Die richtige Schwierigkeit** (Wilson u. a. 2019, Bjork) | Am meisten lernt man bei etwa 80–85 % richtig | Der Trainer passt die Schwierigkeit laufend an, damit du ungefähr dort landest |
| **Input knapp über dem Niveau** (Krashen; Hu & Nation 2000) | Texte werden verständlich, wenn man etwa 95–98 % der Wörter kennt | Input nach deinem Niveau und deinen Interessen, Schlüsselwörter vorab |
| **Selbst verbessern** (Swain, Output-Hypothese) | Wer seinen Fehler selbst korrigiert, lernt mehr als vom Lesen der Lösung | Fehler kommen als Reparatur-Aufgabe zurück |

**Zahlen für C1:**
- **Wortschatz:** Lernende auf C1 kennen rund 4.000–4.500 der 5.000 häufigsten englischen Wörter (Milton 2010), dazu Fachwortschatz und feste Wendungen.
- **Zeit:** Cambridge rechnet mit etwa 200 Stunden angeleitetem Lernen von B2 bis C1. Mit 30–60 Minuten am Tag sind das 180–365 Stunden im Jahr, dazu Preply und freier Input. **Ein Jahr ist realistisch.**

## 4. So sieht die neue App aus: vier Bereiche statt 27

1. **Heute (dein Trainer):**
   - Ein Satz vom Trainer, z. B. „Gestern 82 % richtig. Heute festigen wir *since/for* (3× daneben) und lernen 10 neue Wörter aus *Verhandlung*.“ Der Satz wird in der App berechnet, ohne KI.
   - **Ein großer Knopf: „Training starten“.** Darunter eine Linie: dein Weg zu C1.
2. **Training:** eine Sitzung, die der Trainer zusammenstellt.
   - Wiederholen (~8 Min.) → neue Wörter (~8 Min.) → Grammatik-Fokus (~7 Min.) → Input des Tages (~10 Min.).
   - Fertig nach etwa 30 Minuten. Danach gibt es freiwillige Extras bis 60 Minuten: mehr Input, ein Schreibauftrag, eine Blitzrunde.
3. **Input:**
   - Jeden Tag **ein Artikel und ein Video oder Podcast** zu **deinen** Themen und in **deinen** Lieblingsformaten.
   - Vorher fünf Schlüsselwörter, danach mit einem Tipp: „spannend / langweilig / zu leicht / zu schwer“. **Daraus lernt der Trainer**, was er dir künftig empfiehlt.
   - Eigene Zeit (Serie, Podcast, YouTube auf Englisch) trägst du mit einem Tipp ein. Sie zählt für den Fahrplan.
4. **Fahrplan:** der Weg zu C1 mit vier Etappen, Messwerten und einer Prognose („Bei deinem Tempo: C1 etwa im August 2027“).

**Auf jeder Seite und in jeder Übung:**
- Übersetzer: einzelne Wörter aus dem eingebauten Wörterbuch ohne KI, ganze Sätze mit KI,
- „Frag Claude“: kennt die aktuelle Aufgabe,
- Deutsch/Englisch als App-Sprache, Hell/Dunkel.

## 5. Abwechslung: 13 Übungsformen statt einer

Ein Wort durchläuft mit wachsender Sicherheit **verschiedene Formen**, damit es nicht immer dieselbe Abfrage ist:

**Wörter**
1. Erkennen im echten Satz
2. Lücke im Satz mit Buchstaben-Hilfe
3. Frei tippen Deutsch → Englisch
4. Hören und schreiben: Diktat mit Sprachausgabe
5. Passende Kollokation finden (*make* oder *do* a decision?)
6. Wortfamilie bauen (decide → decision → decisive)
7. Steigern und Synonyme (good → excellent → outstanding)
8. Falsche Freunde (bekommen ≠ become, aktuell ≠ actual)
9. Blitzrunde 60 Sekunden, für die Flüssigkeit

**Grammatik**

10. Regel in drei Sätzen mit Beispielen, dann gemischte Aufgaben
11. Fehler finden und reparieren
12. Umformen, z. B. ins Passiv, in die indirekte Rede, mit Inversion

**Ausdruck**

13. Schreibauftrag zum Input-Thema, zwei- bis dreimal pro Woche. Eine KI-Korrektur, deine Fehler werden Reparatur-Aufgaben.

## 6. Der Trainer: wie er merkt, wo du stehst

- **Einstufung am Anfang (ca. 15 Min.):**
  - Wortschatz-Test: Ja/Nein mit erfundenen Kontrollwörtern, die Raten entlarven (Meara-Methode). Daraus wird deine Wortschatzgröße geschätzt.
  - Grammatik-Check: etwa 30 Aufgaben über alle Themen.
  - Dazu kommen deine **bisherigen Daten**: deine Wörter mit Lernstand, Grammatikwerte, Fehler aus Texten.
- **Danach lernt er bei jeder Antwort mit:**
  - je Wort: wann du es vergisst,
  - je Grammatikthema: wie sicher du bist,
  - je Fehlerart: z. B. *since/for*, Artikel, Wortstellung, Present Perfect.
- **Jeden Tag wählt er selbst:** was fällig ist, wo du schwach bist und was im Plan als Nächstes dran ist. Die Schwierigkeit liegt bei etwa 80 % richtig.
- **Einmal pro Woche** schreibt Claude dir einen kurzen **Trainer-Brief** aus deinen Zahlen: was gut lief, was hakt, Fokus der nächsten Woche. Das ist eine einzige KI-Anfrage pro Woche.
- **Einmal pro Monat** gibt es einen **Kontrolltest** (10 Min., immer gleich aufgebaut). So siehst du eine echte Kurve.

## 7. Fahrplan B2 → C1 in 12 Monaten

**Tagesrahmen:**
- 30 Minuten Kern jeden Tag, das ist die Pflicht für die Serie.
- Bis zu 30 Minuten Extra.
- Neue Wörter: 10 pro Tag (einstellbar 5–20). Stauen sich die Wiederholungen, drosselt der Trainer automatisch.

| Etappe | Monate | Wörter | Grammatik | Input | Messpunkt |
|---|---|---|---|---|---|
| **1 · B2 festmachen** | 1–3 | +900 aus den 3.000 häufigsten + Business | Zeiten (v. a. Present Perfect), Bedingungssätze, Passiv, Relativsätze, Artikel, Präpositionen | 15 Min./Tag, B2-Material | Kernthemen ≥ 80 % sicher |
| **2 · B2+** | 4–6 | +900 aus dem Bereich 3.000–5.000, Kollokationen | Modalverben, Gerund/Infinitiv, indirekte Rede, gemischte Bedingungssätze | 20 Min./Tag, Originale | Schreibprobe B2+ |
| **3 · C1-Werkzeuge** | 7–9 | +900 C1-Wörter, gehobene Wendungen | Hedging, Inversion, Cleft Sentences, Nominalstil, Partizipialsätze, Diskursmarker | 25 Min./Tag, anspruchsvolle Podcasts und Artikel | C1-Werkzeuge im eigenen Text |
| **4 · C1 sichern** | 10–12 | +900, Lücken schließen | alles gemischt, Aufgaben im Stil der Cambridge-Prüfung C1 Advanced | 25–30 Min./Tag | **C1-Probetest** |

**Was der Fahrplan anzeigt (vier Säulen):**
- Wortschatz: geschätzte Größe gegen das Ziel,
- Grammatik: sichere Strukturen von rund 36,
- Input: Stunden gegen das Ziel von etwa 150 im Jahr,
- Ausdruck: Schreibproben, monatlich nach C1-Kriterien bewertet.

**Sprechen** übst du vor allem bei Preply. Die App bereitet die Stunden mit deinen Wörtern und Fehlern vor.

## 8. Token sparen: feste Regeln

1. **Der Lernstoff liegt in der App.** Eingebaut werden freie Wortlisten (NGSL, NAWL, Business Service List), echte Beispielsätze mit deutscher Übersetzung (Tatoeba) und Lautschrift (Wiktionary, CMU), dazu Grammatik-Aufgaben. **Üben kostet 0 Token.**
2. **Ein Wort antippen oder ein einzelnes Wort übersetzen** läuft über das eingebaute Wörterbuch, ohne KI.
3. **KI nur auf Knopfdruck:**
   - „Frag Claude“,
   - Satz-Übersetzung,
   - Schreibkorrektur, wenn du schreibst,
   - dazu der Trainer-Brief einmal pro Woche.
   **Nichts startet automatisch.** Die Einstellungen zeigen, wie viele KI-Anfragen du heute und diese Woche hattest.
4. **Der Tagesauftrag wird schlank:**
   - Er liest nicht mehr die ganze Wortliste, sondern ein kleines Zusammenfassungs-Dokument, das die App schreibt (Niveau, Schwächen, Interessen, Bewertungen).
   - Er sucht zwei passende Beiträge statt drei bis vier Lektionen auszuarbeiten.
   - Grammatik-Aufgaben schreibt er nicht mehr, die liegen in der App.
5. **Beim Bauen:** ein Arbeitsstrang statt vier bis sechs parallelen Helfern, gezielte Prüfungen statt großer Runden.

## 9. Was bleibt, was neu ist, was wegfällt

- **Bleibt:**
  - **deine Daten**: Wörter mit Lernstand, Grammatikwerte und Fehler, Texte, Serie,
  - die technische Basis, die funktioniert: Anschluss an Datenbank und KI in claude.ai, Build, Tests, Hell/Dunkel, Deutsch/Englisch, Lautschrift.
- **Neu:** alles, was du siehst und tust.
- **Fällt zunächst weg:**
  - Rollenspiel, Business-Suite, Pitch, Termin-Vorbereitung, Tonlagen,
  - „Sag es“ als Pflicht, Lektionskurs, Satzbau, Sprint, Preply-Import.
  - Was du davon wirklich vermisst, kommt später gezielt zurück.
- **Sicherheit:**
  - Die alte Datenbank wird **nicht verändert und nichts gelöscht**. Die neue App liest sie einmal ein und schreibt in eigene, neue Bereiche.
  - Der Rückweg zur alten Version bleibt jederzeit möglich.

## 10. Bauplan (jeder Schritt zuerst auf dem Test-Link)

1. **Fundament:** Lernstoff-Bank (Wörter, Beispielsätze, Lautschrift, Grammatikthemen), Übernahme deiner Daten, Einstufungstest, neuer Heute-Bildschirm. → Du machst die Einstufung.
2. **Training:** tägliche Sitzung mit allen Übungsformen und Trainer-Auswahl, Übersetzer, „Frag Claude“. → Du trainierst täglich.
3. **Input:** Input des Tages, neuer schlanker Tagesauftrag, Bewertung, eigene Zeit eintragen. → Du bekommst passende Beiträge.
4. **Fahrplan:** Fortschritt, Trainer-Brief, Monats-Check, Schreibauftrag. → Du siehst deinen Weg zu C1.
5. **Umzug** auf die bisherige Adresse, nur nach deinem ausdrücklichen OK.

---

## Anhang: Technische Leitplanken (für die Arbeitssitzungen)

- **Weiter genutzt:**
  - Stack: Vite, React, TS strict, Tailwind, eine Datei,
  - `src/platform` mit dem Entwicklungs-Adapter, `src/i18n`, die Design-Tokens, FSRS, `src/content/pron`.
- **Neu gebaut:**
  - Die Funktionen entstehen in neuen Ordnern.
  - Alte Bildschirme fliegen aus dem Build, sobald ihr Ersatz steht. In der Git-Historie bleiben sie erhalten.
- **Daten:**
  - Neue, zusammengefasste Dokumente, z. B. Karten in Teilstücken ≤ 200 KiB, Monatsprotokolle, `coach/summary` für den Tagesauftrag. Grenzen aus `db.d.ts` (5.000 Dokumente, 256 KiB) einhalten.
  - Alte Pfade werden nur gelesen.
- **KI:** höchstens die in Abschnitt 8 genannten Anfragen. Jede läuft über das bestehende KI-Tor, mit zod-Prüfung und ohne automatische Wiederholung.
- **Lernstoff:**
  - Die Lizenzen beim Einbau prüfen: NGSL/NAWL/BSL CC BY-SA 4.0, Tatoeba CC BY 2.0 FR, Wiktionary CC BY-SA. Quellenangabe kommt in die Einstellungen.
  - Die Größe im Blick behalten: Ziel unter 6 MB, Daten erst bei Bedarf einlesen.
- **Arbeitsweise:** A2 gilt weiter (keine Schleifen). Je Schritt ein Commit, die Tests laufen gezielt, die volle Prüfung kommt vor dem Test-Link.
