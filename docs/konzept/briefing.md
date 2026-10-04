# Briefing Neuansatz (27.09.2026) – für alle Fachbeiträge

## Auftrag von Emrah (wörtlich zusammengefasst)
- „Ich will einfach mit den besten Methoden Englisch lernen, um auf C1 zu kommen.“
- „Eine richtige App, die man sonst kommerziell erwerben muss – wie Babbel, Duolingo, LingQ … nur deutlich intelligenter und das Beste von allem, nur für mich.“
- Kritik an der jetzigen App:
  - buggy und laggy,
  - stürzt mitten in der Übung ab (dann von vorn),
  - überladen und unstrukturiert, keine klare User Journey,
  - kein Anki-Modus (nur einzelne Wörter üben),
  - Wort aus dem Übersetzer nicht einfach in den Wortschatz,
  - Vokabeltrainer nicht auffindbar,
  - weder Best Practices noch wissenschaftliche Methoden erkennbar.
- Vorgehen: erst Produktkonzept und klickbarer Prototyp, Emrah gibt frei, dann Neubau nach Plan, dann ein kompletter Test.

## Nutzer
- Emrah, Deutsch, Englisch B2 (Anfang) → Ziel C1.
- Beruf: Head of Business Development bei einem DMS/ECM-Cloud-Anbieter. Typische Situationen: Verkaufsgespräche, Einwände (CFO/IT), E-Mails, Präsentationen, Verhandlungen, Partner in UK/US. Etwa zwei Drittel Beruf, ein Drittel Alltag.
- Täglich 25–30 Minuten, dazu 2–4 Preply-Stunden pro Woche mit einem Lehrer.
- Nutzt **ausschließlich das iPhone (Safari)**, keine Entwicklererfahrung.
- US-Englisch; britische Formen gelten als richtig.

## Plattform (fest, nicht verhandelbar)
- Die App ist eine einzelne HTML-Datei als Claude-Artefakt in claude.ai, im iPhone-Safari.
- Datenbank (`claude.use("db")`, JSON-Dokumente) und KI (`claude.use("sample")`) sind im Claude-Abo enthalten.
- Kein Server, keine Push-Nachrichten, keine App-Store-App. Eine tägliche Erinnerung gibt es über einen Claude-Tagesauftrag.
- KI-Antworten dauern 1–10 s; sie dürfen den Kernablauf nicht blockieren.
- Spracheingabe ist im eingebetteten iPhone-Safari unsicher, Sprachausgabe (TTS) geht.

## Was es technisch schon gibt und wiederverwendet werden kann (Daten bleiben erhalten)
- Etwa 250 Karten (Wörter und Wendungen) mit FSRS-Wiederholungsplanung und Ursprungssatz.
- Grammatik: 16 + 7 C1-Themen mit Aufgaben, Beherrschungsmodell und Fehlerwiederholung.
- Kurs mit Lektionen.
- Sprechen: Rollenspiel mit KI-Analyse, Business-Werkzeuge, Preply-Vorbereitung und -Import.
- Lesen, Hören, Schreiben, Entdecken-Feed (Tagesauftrag).
- KI-Einschätzung, Wochenbericht, Serie/Pflicht, Wort-Antippen mit Wörterbuch und Lautschrift, Übersetzer, Claude-Chat.
- Neu seit heute:
  - „Sag es“ (freies Formulieren mit zweitem Durchgang),
  - Reparatur-Sätze,
  - Deutsch-Fallen,
  - Flüssigkeit 90/60/45,
  - „Mein nächster Termin“,
  - drei Tonlagen.

## Frühere Entscheidungen von Emrah (gelten, außer das Konzept schlägt begründet etwas anderes vor)
- Keine Selbstbewertung im Trainer (die App benotet aus Richtigkeit, Zeit und Hilfe). **Aber:** Er wünscht jetzt ausdrücklich einen **Anki-Modus**. Das Konzept muss eine klare Empfehlung geben, wie beides zusammenpasst.
- Serie: Pflicht erledigt; ein Ruhetag pro Woche.
- Preply-Stunde zählt als Extra.
