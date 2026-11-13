# Politur 13.11.2026 – Prüfberichte (Kurzfassung)

Auftrag Emrah 13.11.2026: „einmal komplett polieren … Logiken anschauen … UI und UX deutlich verbessern, Design für Laptop, iPhone Duo … wie man Wörter lernt, wie man Grammar lernt (immer noch nicht richtig gut gelöst), Anwenden (Grammar und Vokabeln, die ich gerade lerne oder die schon sitzen, anwenden)“. Vier Prüfer (Fable, nur Lesen). Volltexte im Sitzungsverlauf; hier die belastbaren Kerne mit Datei:Zeile.

## Echte Lerndaten (live, nur gelesen, 13.11.)
- Tagesziel 25 Min. → 18 / 5 / 2 (Wörter/Grammatik/Anwenden). Emrah ist **nicht** auf dem Buch-Weg (kein `app/book`), sondern in der gemischten Runde mit Kapitel-Fokus (heute Kapitel 1 „Past Perfect“).
- Grammatik-Stand: leichte Themen sitzen (pres-perf-cont 0,96, past-simple-perfect 0,96, pres-simple-cont 0,88, reported 0,82); C1-Themen stagnieren seit Wochen: conditionals 0,64 → 0,55 (letzte 10: 3 richtig), c1-participle 0,40–0,52, modals-deduction ≈ 0,55, passive ≈ 0,62, future-perf-cont 0,64.
- Wörter heute: 24 fällig + 5 neu (mehr neue passen nicht in 18 Min.).

## Anwenden (learning-scientist)
Urteil: brauchbare Schreibübung, als Brücke verfehlt.
- Zielwörter aus alter Kartensicht nach Fehlerzahl (`src/features/apply/ComboSentence.tsx:72-76`, `src/domain/apply/combo.ts:51`); „heute geübt“ liest `log/<Tag>`, die Wörter-App schreibt `vlog` → wirkungslos (`src/domain/metrics/today.ts:204-237`).
- Muster aus `u.gt`, nicht aus dem heutigen Grammatik-Schritt (`combo.ts:46-50`).
- Kein Wort-Urteil im eigenen Satz (nur „kommt vor“), `c1-mail@2` beurteilt Wörter nie (Schema `used` nur Muster-IDs, `src/prompts/c1Mail.ts:93-98,148`).
- Kein Rückfluss: eigener Satz bucht nichts; Mail-Wörter `cued:true` ohne Planwirkung; Stufe 7 („2 eigene Sätze“) steigt nie aus dem Pflicht-Schritt (`src/modules/vocab/domain/apply.ts:96-111`).
- Größe: Mails/Zusammenfassung 8–10 Min. angesetzt (`src/modules/apply/domain/kinds.ts:26`), Plan zeigt 2–3 Min.
- Vorschläge (Rang): 1 täglich 2 „Brücken-Sätze“ als Pflicht, Mails/Zusammenfassung freiwillig · 2 Ziele aus Lernstand (Satz 1: Wort Stufe 3–4 + Muster des heutigen Grammatik-Schritts; Satz 2: sitzendes Wort Stufe 5–6 + sicheres Muster) · 3 Vorlage `apply-bridge@1` mit Urteil je Wort/Muster + „Merk dir“ · 4 Rückfluss als Beleg „frei verwendet“ (Wörter: Stufe-7-Zähler; Grammatik: eigener Zähler, kein BKT) · 5 Vorgabe sichtbar · 6 Rückmeldung 3 Zeilen · 7 Fehlersatz mit Muster/Kontext · 8 Mail-Vorlagen @3 · 9 Stützen abbauen · 10 echte Zeit.

## Grammatik (english-teacher)
Urteil: fragt ab, lehrt kaum.
- Diagnosen: (1) kein Lehren vor dem Üben im Buch-Weg (Einführungskarten nur Weg B, `src/features/grammar/SessionScreen.tsx:125-135`); (2) Einstufungs-/Check-Fehler kommen als Tages-Drill zu ungelernten Themen (`src/modules/grammar/domain/repairTasks.ts`, `session.ts:310-312`) – „Sau schwere Aufgabe“; (3) Schwierigkeit springt; (4) zu wenig Übung je Teilregel; (5) zwei Systeme (Buch/gemischt), drei Fortschrittsanzeigen, Anwenden nimmt anderes Thema; (6) Zeit unehrlich (6+3 Aufgaben ≈ 11 Min. bei 5–6 angezeigten); (7) Inhalt `tasks-v2.json` (Fehler finden/Umformen) ≈ 9–16 % hart unfair; (8) Rückmeldung uneinheitlich, oft live Claude.
- Gemischte Runde (Emrahs Weg): 5 Plätze, bis 3 Fehlersätze zuerst, Rest auf 3 Themen nach Bedarf (`src/domain/grammar/tasks.ts:512-592, 687-713`) → pro Thema 1–2 Aufgaben, keine Progression.
- Zielbild: Runde = Aufwärmen (2 verteilte Wiederholungen) · Fokus (3–4 Aufgaben EIN Thema, Stufe des Tages: Verstehen → Bilden → Umformen → Mischen → Test) · eigener Satz. Adaptiv: Vortest sauber → kürzen; 2 Fehler am Muster → Mini-Lektion.
- 12 Änderungen: Regel vor Übung · Check-Fehler ruhen bis Thema eingeführt · Übung C reihum · Zeit ehrlich · Lerntage statt Seiten · Aufwärmen · eigener Satz/Anwenden = Muster der Runde · Vortest · eine Fehler-Karte geprüft zuerst · Qualitätstor `tasks-v2.json` · Umformung erst mit Bausteinen · eine Fortschrittsanzeige.
- Stichprobe: Befunde `tasks-v2.json:8671` (kwt Lösungsraum offen), `:20400` (zweite Korrektur fehlt), `:41866` (richtige Antwort abgelehnt), weich `:3132`, `:14733`, `:14796`.

## Wörter (learning-scientist)
Urteil: Kern solide (getippter Abruf ab Tag 0, FSRS je Spur, Deckel 1/3/7/21, Note aus Richtigkeit/Hilfe/Zeit). Schwer wiegen (Pfade unter `src/modules/vocab/`):
- **S1 Wiederholungen verhungern im Minuten-Modus:** `domain/day.ts:70-84` rechnet Budget − neue × 156 s (Einführung/Schritt A nie gemessen, `ui/learnRun.ts:1300-1312`); bei Tagesziel 30/35 → 10 neue, 1 Wiederholung. Bei Emrahs 25 Min. bremst die Kurztag-Regel auf 5 neue (heute 24 fällig + 5 neu).
- **S2 Wendungen falsch benotet:** `domain/flow.ts:121` zeigt `cloze_part` als ganze Lücke, bucht „höchstens Schwer“ (`domain/grade.ts:36`); Band sagt „knapp“ bei richtig.
- **S3 Fehler ≠ morgen:** Termin vor Abstieg gesetzt (`domain/planner.ts:247-286`), altes Wort kommt nach Fehler erst in 3–4 Tagen.
- **S4 Verstehen nur „Bedeutung lesen“, kein Hören:** `learnRun.ts:438,452`; Hören/Partner/Situation/Sprechen haben keine Karten (`flow.ts:24,52`).
- **S5 „Kenne ich schon“ unerreichbar** (`ui/LearnCard.tsx:681`), Probe-Logik fertig (`planner.ts:136-154`).
- S6 Auswahl-Ablenker nur gleiche Wortart · S7 Ereignisse (Problemwort, Partner-Fehler) ungenutzt · S8 Tempo fest.
- Vorschläge (Rang): 1 Wiederholungen zuerst (≥ 60 %), neue = Rest (min 2), Tempo nach Behalten 14 Tage; Einführung messen · 2 Wendungen korrekt buchen · 3 Fehler → morgen · 4 Hör-Abfragen (Hören → Bedeutung, Satz hören → Wort) · 5 Ohr ab Tag 0 (Einführung liest vor, Auswahl als Hör-Variante) · 6 Vortest „Kennst du es?“ · 7 Hör-Runde (Extra) · 8 Mischung neuer Wörter (Liste 0,6, eigene 0,2, Beruf 0,1, Partner 0,1) · 9 Auswahl schärfen · 10 Problemwörter ab 3. Vergessen · 11 Hör-Probe als Fortschritt.
