# Wort-Lernen 2: „Weg bis bombenfest“ (Synthese zweier unabhängiger Opus-Gutachten, 21.10.2026)

Anlass: Emrah (21.10.): „Ich tue mich extrem schwer, neue Wörter zu merken; der Ansatz der App reicht nicht.“
Beide Gutachten (Lernforscher, Spracherwerbsforscher) kommen unabhängig zum selben Kern. Stand Code: live v82.

## Gemeinsame Diagnose (Muss)
1. **Kein freier Abruf am Tag 0.** Pflichtrunde im Modus „auto“ fragt Stufe 0–2 per Aufdeckkarte mit Selbsturteil (`src/domain/srs/flip.ts:107-110`, `session.ts:371`); Selbsturteil überschätzt, FSRS übernimmt die Note voll (`weight.ts:15`).
2. **Ein „Leicht“-Wisch direkt nach der Einführung** kann 8 Tage Pause setzen (`FlipCard.tsx`, `flip.ts:129-137`): Kurzzeitgedächtnis wird als Langzeitwissen gebucht.
3. **Zeitplan wird am Erkennen geeicht**, nicht am freien Abruf (Auswahl 95 % richtig, frei 68 %, erste getippte Antwort einer Wendung 25 %); erste freie Tipp-Antwort rechnerisch erst nach Wochen/Monaten (`scheduler.ts:79`).
4. **Kein Abruf am Folgetag** (nach dem Schlaf).
Soll: Wendungen (43 % der Karten) ohne Merkhilfe/Fahrplan; Handy ohne Klang/Sprechen (`modes.ts:64-66`); Problemwörter nur gebremst (`queue.ts:306`, Merkhilfe erst ab 4. Vergessen); „Fest“ nur aus Schätzung S≥21 (`cardStatus.ts:162`); Aktivierung (eigener Satz) zu spät; keine Sperre gegen ähnliche Wörter am selben Einführungstag; „Kenne ich“ erst nach dem Zeigen (`IntroCard.tsx:125`).
Widerspruch beider: Es sind **nicht zu viele neue Wörter** (2–5/Tag sind maßvoll).

## Gemeinsames Gegenmodell
- **Tag 0:** Einführung (+ automatisches Vorlesen, „Sag es einmal laut“ freiwillig) → Abruf 1 nach ~3–4 Karten (getippt, Anfangsbuchstabe/Wendung: ein Wort bzw. Bausteine) → Abruf 2 nach ≥8 Karten (freie Lücke, Deutsch→Englisch). Am Tag 0 kein „Leicht“; Aufdecken/Auswahl beenden die Lernphase nicht.
- **Tag 1:** erster Termin immer der nächste Lerntag, freier Abruf („Gestern-Check“), optional „Abend-Check“ 2 Min.
- **Deckel auf den Abstand, bis Belege da sind:** ≤1 Tag bis ein freier Abruf an späterem Tag gelang; ≤3 Tage bis 2 freie Tage; ≤7 bis 3 freie Tage; ≤21 bis „Fest“. FSRS rechnet sonst unverändert.
- **Tag 2–21:** jeder Termin eine freie Produktion in neuem Satz (Lücke, Wortpartner, Wortfamilie, Situation); Auswahl nur als Hilfe nach Fehler. Aktivierung (eigener Satz) ab 2 freien Tagen. „Sag es“/Diktat als Abfrageart.
- **Fest:** bisherige Regel + mind. ein freier richtiger Abruf nach ≥21 Tagen Pause (+ bei Kernwörtern eine geprüfte eigene Verwendung).
- **Wort-Werkstatt:** ab 2. Vergessen (statt 5.): neu verankern (Infokarte mit Gegenüberstellung zum Verwechselten, automatische Merkhilfe/Deutsch-Falle von Claude, Wendungen in Teile), 2–3 Tage Pause; ab 6. Vergessen Angebot „pausieren“.
- **Menge:** Kontingent 0/2/5/10 und Untergrenze 2 bleiben; sanfte Bremse (viele unsichere Karten + Folgetag-Abruf <70 % → Untergrenze); keine zwei ähnlichen Wörter am selben Einführungstag.
- **Abschluss „Sag es selbst“** (freiwillig, 2–3 Min.): 2 Wörter von gestern in eigenen Sätzen/Mini-Gespräch, Berufsprofil für Claude-Sätze.
- **Messbar** (Diagnose-Protokoll täglich): freier Abruf am Folgetag ≥70 %; erste freie Antwort Wendung ≥55 % (heute 25 %); freier Abruf nach ≥21 Tagen ≥85 %; Median Tage bis „Sicher“ ≤14; Problemwörter <5 %; Verhältnis freie Abrufe : Erkennen ≥2:1; monatlich 10 „feste“ Wörter frei geprüft.

## Nicht ändern
FSRS-Kern (Ziel 0,9) und Dämpfung (`weight.ts`); Tagesbremse; Tor der freien Antworten an verschiedenen Tagen; Barcroft-Grenze (kein eigener Satz vor freiem Abruf der Form); Vortest, Infokarte, Deutsch-Falle; Satzwechsel (`rotate.ts`); Wendungen zerlegt; Mischung 1:1; Pflicht, Serie, Tagesziel; keine Selbstbewertung außer im Anki-Modus.

## Offene Entscheidungen (Emrah)
Umfang/Tempo des Umbaus; Sicherungstag mit weniger als 2 neuen Wörtern (bricht Kap.-15-Untergrenze); Mikrofon/Sag-es-laut; A/B-Vergleich über 4 Wochen.
