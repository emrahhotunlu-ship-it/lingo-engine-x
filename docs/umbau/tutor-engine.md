# Tutor-Engine (ersetzt durch tutor-engine-v3.md)

Anlass: Emrahs Rückmeldung („Aufgabenannäherung und Erläuterung nicht intelligent, zu kurz gedacht, nur starrer Code; ich will eine Engine, die versteht, wo der Schüler steht“). Grundlage: Architekt, Lernwissenschaftler, Englischlehrer (alle 19.10.2026). Die Engine ist **kein Parallelsystem**: sie fasst KI-Tutor T1/T2 (`ki-tutor.md`), Pakete MD, FK, ST, WL, SB (`wort-lernen-plan.md`) und eine fehlende Schicht (Lernermodell, Diagnose, Aufgaben-Policy) zusammen.

## Befund (Ursachen der Beispiele)
- „had“ als falsch: `checkGrammar` vergleicht nur mit `answer`/`accepted`/7 Familien (`check.ts:94-126`); Claude als Schiedsrichter nur bei transform/correct; Lücke ohne Ziel (`grammar-extra.json`). `alsoRight` aus `explain-answer@2` kommt erst nach dem Urteil.
- „Fehler finden“: feste Stelle, kein Ziel, nur Umformungen des Nebensatzes akzeptiert, feste Begründung (`checkFind needsJudge:false`), „Nicht verwechseln“ immer (`explain.ts:107`). `explain`/`gen` sind per Flag abgeschaltet (`flags.ts:38`).
- Wissen über den Lerner liegt in sechs Speichern ohne gemeinsame Sicht; keine Fehlerhypothese; Rundenauswahl nach Thema, nicht nach Diagnose.

## Zielbild
1. **Lernermodell** (abgeleitet, nie gespeichert): `src/domain/tutor/learner.ts` → je Muster Wissensstand, Quote 28 Tage, Hypothesen-Häufigkeit, Verwechslungen, Zeit, Hilfe, 3 saubere Belege; je Wort R, freie Tage, Satzvielfalt.
2. **Diagnose der Antwort:** lokal `diagnoseAnswer` → `alt_ok | form | typo | confuse:<pat> | l1:<code> | auxform | span | unknown`; Claude (`answer-review@1`, `quick`) nur bei `unknown`/plausibler Variante, nach „Prüfen“.
3. **Urteil mit fünf Stufen:** `correct · alt_ok („Auch richtig – geübt wird …“) · near · wrong · unsure`; `alt_ok` bewegt nie BKT/Stufe/Muster-Zähler.
4. **Aufgaben-Hülle + `lintTask`:** `goal` (Ziel), `constraint` (löst Mehrdeutigkeit), `accept` (exact/target/any-correct); Aufgabe ohne Ziel bei mehreren richtigen Formen wird nicht gezeigt.
5. **Policy** `nextTasks` (rein, fester Startwert): Bedarf × fällig × Abwechslung × Schwierigkeit (Ziel 70–85 % Erfolg) × Hilfestufe; Aufgaben, die eine offene Fehlerannahme klären, zuerst.
6. **Feedback-Reihenfolge (höchstens 3 Erklärzeilen):** Ziel → Urteil → seine Form → Grund (Hypothese/Regel/Signal) → höchstens ein Zusatz (Kontrast nur bei belegter Verwechslung, oder Aufwerten B2→C1) → Handlung (selbst richtig schreiben, neuer Satz). Bei Frust/Müdigkeit kürzer, leichter, nie zwei Belehrungen hintereinander.
7. **Erzeugung durch Claude** nur bei Vorratsmangel (T2, `grammar-items@3` + `solve-check@1`), im Hintergrund nach Rundenende.
8. **Rückkopplung:** `h`/`pat` im Log; „Ich lag richtig“ + Bestätigung → gelernte Alternative (`app/pool.alt`, Ring ≤ 300).

## Didaktik-Züge (Englischlehrer)
Z1 Ziel nennen · Z2 Alternative anerkennen · Z3 aufwerten (B2→C1) · Z4 Fehlerhypothese (als Frage, höchstens eine) · Z5 auf seine Form eingehen · Z6 Kontrastpaar (nur bei belegter Verwechslung) · Z7 Regel in einem Satz (1./2. Fehler) · Z8 Eselsbrücke/Entscheidungsfrage (ab 3. Fehler) · Z9 Selbstkorrektur · Z10 Übertragen in neuen Satz · Z11 Selbsterklärung („Warum used to?“, 3 Gründe) · Z12 Fehlalarm-Gegenprobe · Z13 bestätigen und weiter. Tagesform-Signale: Zeit > 1,5× Mittel, 3 Fehler in Folge, 2× „weiß nicht“, leere Eingaben, Abbruch, späte Uhrzeit.

## Tutor-Prinzipien (Prüfliste für jede Aufgabe/Erklärung)
1 Ziel genannt · 2 keine richtige Antwort wird falsch gewertet (Antwortraum geprüft, unbekannt-plausibel vor dem Urteil prüfen) · 3 eindeutige Aufgabe oder beide Formen zählen · 4 Erklärung bezieht sich auf die tatsächliche Antwort · 5 Ursache statt Regeltext (Signalwort, Gegenbeispiel, L1-Übertragung) · 6 Begründung auch bei richtig (Nuance) · 7 erst Hinweis, dann Lösung, dann selbst neu bilden · 8 nur saubere Belege · 9 erklären, wenn Abfragen nicht hilft (nach 2 gleichartigen Fehlern Mini-Lektion) · 10 ein Status, eine Wahrheit.

## Scheiben
- **S1 „Fair bewertet, passend erklärt“ (= Paket MD, läuft):** `alt_ok` + Zielkonflikt-Regeln, `answer-review@1` (ersetzt grammar-judge + explain-answer, Schalter `tutor.explain` an), Kontrast nur bei Hypothese, „Fehler finden“ mit Ziel und jeder gültigen Korrektur (auch Hauptsatz), Inhalts-Audit durch english-teacher.
- **S2 Lernermodell + Feedback-Engine:** `learner.ts`, `diagnoseAnswer`, `h` im Log, Gegenbeispiel, eigener sauberer Fehler, Mini-Übung, gelernte `alt`; ST und FK lesen das Modell.
- **S3 Aufgaben-Policy:** `policy.ts` in `selectRound`/`slotPlan`; Kontrast-Runden; Satzbank SB; Hinweis-Leiter; Erklären-vor-Abfragen (Mini-Lektion).
- **S4 KI-Erzeugung:** T2 + Löser-Probe, Diagnose mit `h`-Codes, Selbsterklärung, Fortschrittsbelege („wish + had: vor 3 Wochen 4 von 9, jetzt 8 von 9“).

## Grenzen/Kosten
`sample`: kein Gedächtnis, ≤ 64 KiB (Prompts < 8 KB), kein Timer, keine automatische Wiederholung außer Schema-Verstoß (A6.2/A6.3). Claude nur nach ausdrücklicher Handlung („Prüfen“), `quick`; Erwartung 2–5 Aufrufe/Tag, Deckel 20/Tag (`tutorBudget`), Ergebnisse gecacht, gelernte Alternativen vermeiden Aufrufe. Ohne KI: lokales Urteil „nicht sicher prüfbar“, Pflicht und Serie laufen weiter. Daten nur ergänzend (`looseObject`, `writer.transform`, nie löschen, +0 Dokumente). **Nicht bauen:** freier Tutor-Agent mit Werkzeugen je Aufgabe, KI-Prüfung jeder Antwort, trainiertes Modell im Gerät, gespeichertes Lernermodell-Dokument, KI-Aufgaben in Einführung/Messung/Einstufung, Hintergrund-Timer.

## Qualität/Messung
Gold-Liste ≥ 200 Paare (Aufgabe, gültige Alternative) vom english-teacher: kein Paar darf `wrong` ergeben; `lintTask` über den ganzen Bestand; 100 % Gegenlesung neuer Inhalte; Messung „zu Unrecht falsch“ < 2 %, Melden-Quote ≤ 5 %, Erfolg der Mini-Übung. Nebenbefund: `src/app/flags.ts:81-83` leerer `catch` ohne `logWarn` in S1 beheben.
