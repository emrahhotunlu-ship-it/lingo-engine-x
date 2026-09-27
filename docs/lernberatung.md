# Lernberatung 27.09.2026 – Englischlehrer + Lernwissenschaftlerin

Anlass: Emrah – „hübscher, aber keine neuen Lernansätze". Beide Berater haben unabhängig die App gelesen.
Volltext Lehrer: `docs/lernberatung-lehrer.md`. Die Lernwissenschaftlerin kommt zum selben Kern.

## Gemeinsamer Befund
Die Pflicht besteht heute fast nur aus Wiedererkennen und gelenkten Lücken:
- Wiederholen ≈ 10 Min.
- Lektion ≈ 12 Min.
- Grammatik, Lückenjagd oder Satzbau ≈ 5 Min.

Freies Sprechen und Schreiben ist nur Extra. Korrekturen aus Rollenspiel und Schreiben werden gelesen, aber nie selbst verbessert wiederholt und landen nicht in der Wiederholung (`addError` nur in `domain/grammar/write.ts`).

## Vorschläge (zusammengeführt, nach Wirkung)
1. **Freies Formulieren als tägliche Pflicht** (beide): 8–10 Min. Sprechen/Schreiben an 4–5 Tagen; Lektion kürzer bzw. 2–3×/Woche.
2. **„Nochmal, aber besser" + Reparatur-Karten** (beide): Korrektur ausblenden, eigenen Satz neu formulieren, automatisch Karte „Damals: … Sag es besser".
3. **Persönliche Fehlermuster („Deutsch-Fallen")** (beide): ≤ 8–12 Muster aus allen Quellen, Drill aus eigenen Sätzen, Verlauf auf „Dein Stand".
4. **Erst Hinweis, dann Lösung** (Lernwissenschaft, klein): zweiter Versuch nach gezieltem Hinweis.
5. **Flüssigkeit 90–60–45 s** (beide): dieselbe Antwort dreimal, jedes Mal kürzer.
6. **„Mein nächster Termin"** (Lehrer): echter Termin → Wendungen, Einwände, Generalprobe, Nachbesprechung → Karten.
7. **C1-Werkzeugkasten** (Lehrer): Hedging, Diplomatie, Betonung, Diskursmarker, Nominalstil, Partizipialsätze als neue Themen.
8. **Eine Botschaft, drei Tonlagen** (Lehrer, klein).
9. **Preply-Kreislauf mit gemeinsamen Wochenzielen** (beide).
10. **Messbarer Fortschritt beim Sprechen** (Lernwissenschaft): monatliche Vergleichsaufgabe, alt vs. neu.
11. **Wochenthema über alle Bausteine** (Lernwissenschaft).

## Weglassen oder vereinfachen (beide)
- Satzbau und Sprint nur noch als Extra.
- Lektion nicht täglich als Pflicht.
- Neue Wendungen starten bei „Mit Stütze abrufen" statt bei der Auswahl.
- Wortzahl-Ziel weniger betonen.

## Entscheidung
Offen, Emrah wählt.

## Umsetzung Vorschlag 1: „Sag es“ (Stand 27.09.2026, Arbeitszweig, noch nicht zusammengeführt)
- **Pflichtkanal `say`, 8 Minuten**, an 4–5 von 7 Tagen je Kalenderwoche (`isSayDay`, fest aus dem Montag der Woche, gleiche Wahl bei jedem Neuzeichnen) und nur, wenn Claude beim Planen nutzbar ist (`sampleUsableWithin`, höchstens 1,5 s Warten). Sonst bleibt die bisherige Wahl.
- **Satzbau ist kein Pflichtkanal mehr** (`DUTY_CHANNELS = gram, cloze`), bleibt aber Angebot; der Sprint war es schon nicht. Ein schon gespeicherter Plan (auch mit `ch:order`) wird nie umgewürfelt.
- **Ablauf:** Situation (40 Stück, zwei Drittel Beruf) → 3–6 Sätze (ab 20 Wörtern, Zeitanzeige 3 Min., nur Anzeige) → `say-check@1` → Korrekturen, C1-Aufwertung (mit „Merken“ als Wendung), bessere Fassung → „Nochmal, aber besser“ (Rückmeldung ausgeblendet, 2 Min.) → zweite Prüfung → beide Fassungen nebeneinander.
- **Reparatur-Sätze:** alle Korrekturen des ersten Durchgangs automatisch nach `app/repair` (ganzer eigener Satz, Quelle `say`).
- **Speichern:** `say/<JJJJ-MM>` (Monatsdokument, gekappt ≤ 200 KiB), Log-Eintrag `type:'say'`, `act[tag].say`. Erledigt nach dem zweiten Durchgang.
- **Ohne Claude** blockiert „Sag es“ die Pflicht nie: Die Antwort wird dann ohne Prüfung gespeichert und zählt.
- **Offen:** Die Wiederholung der Reparatur-Sätze (Boxen 1/3/9) braucht noch eine Abfrage im Trainer; „Sag es“ als freiwilliges Angebot an Nicht-Sag-es-Tagen gibt es noch nicht.
