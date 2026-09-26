# MASTER-AUFTRAG: LINGO-ENGINE X
**Neubau von null (Greenfield) einer persönlichen High-End-Englisch-App, B2 → C1**
**Auftraggeber:** Emrah · **Ausführung:** Claude Code, autonom, in Phasen
**Kostenrahmen:** 0 € zusätzlich. Keine API-Schlüssel, keine bezahlten Dienste.
**Arbeitsumgebung:** Claude Code in der Cloud auf diesem GitHub-Repository. Emrah arbeitet ausschließlich am Handy, ohne PC.

---

## KAPITEL 0: DEINE ROLLE UND ARBEITSWEISE

Du bist Lead Engineer, Product Designer und Lernwissenschaftler in einer Person. Du baust eine komplett neue App auf einer modernen Codebasis. Es gibt eine Vorgänger-App, von der **nur die Daten und die Funktionsideen** übernommen werden, **kein Code**.

Emrah hat **keine Entwicklererfahrung**. Daraus folgt:
1. Du richtest alles selbst ein (Projekt, Subagents, Tests, Build). Emrah muss nichts installieren und nichts auf einem PC tun. Falls doch etwas von ihm nötig ist, erklärst du es in einfachen Worten mit genauen Klicks am Handy.
2. Zu Beginn stellst du **höchstens fünf** Entscheidungsfragen gebündelt in einer Nachricht. Danach arbeitest du selbstständig.
3. Als Erstes zerlegst du diese Datei: Anhang A kommt als einzelne Dateien nach `/contract/`, Anhang B nach `/docs/datenstruktur.json`. Dann legst du eine `CLAUDE.md` im Projekt an, die diesen Auftrag, die Produktprinzipien (Kapitel 2), die Plattformregeln (Kapitel 3) und die Abnahmekriterien (Kapitel 14) dauerhaft festhält.
4. Nach jeder Phase liegt **eine einzige Datei `dist/index.html` im Repository auf dem Branch `main`** (`dist/` darf nicht in `.gitignore` stehen; arbeitest du auf einem eigenen Branch, führst du ihn nach grünen Tests in `main` zusammen). Dazu ein Bericht in drei Sätzen: was neu ist, was Emrah testen soll, was als Nächstes kommt. Emrah gibt in claude.ai Bescheid, dort wird die Datei aus dem Repository geholt und als Artefakt veröffentlicht (Kapitel 3.1).
5. Falls sich in der Cloud-Umgebung etwas nicht installieren oder ausführen lässt (z. B. Browser für Playwright), sagst du das offen und schlägst den nächstbesten Weg vor. Nie still überspringen.

---

## KAPITEL 1: NUTZER UND ZIEL

- **Nutzer:** Emrah, 30, Head of Business Development bei einem DMS/ECM-Softwarehersteller (Cloud-Produkt für den Mittelstand). Englisch für internationale Kunden, Partner und Präsentationen.
- **Niveau:** B2 Anfang (vor 9 Monaten A2–B1). **Ziel:** C1.
- **Rahmen:** 2–4 Preply-Stunden pro Woche mit einem Lehrer, dazu täglich **25–30 Minuten** in der App.
- **Inhalte:** zwei Drittel Beruf (DMS/ECM, digitale Transformation, Produktmanagement, Vertrieb, Verhandlung, E-Rechnung/ViDA, Cloud-Architektur, C-Level-Kommunikation), ein Drittel Alltag.
- **Nutzung:** Handy zuerst, genauso gut am Rechner (bis 40-Zoll-Monitor). Oberfläche auf Deutsch, umschaltbar auf Englisch.
- **Einziger Nutzer.**

---

## KAPITEL 2: PRODUKTPRINZIPIEN (nicht verhandelbar)

1. **Eine rote Linie.** Beim Öffnen ist sofort klar, was heute dran ist. Ein großer Knopf, keine konkurrierenden Karten.
2. **Keine Widersprüche.** Häkchen, Zähler, Untertitel und Klickziel sagen immer dasselbe. **Erledigt heißt erledigt:** eine erledigte Aufgabe ist Zustand, kein Knopf mehr.
3. **Urteil statt Punktestand.** Das Niveau beurteilt die KI anhand echter Belege in Worten, nicht eine starre Formel (Kapitel 5).
4. **Erklären, warum.** Jede Übung beantwortet vier Fragen an fester Stelle: *Was soll ich tun? Wozu dient das? Was hatte ich, was ist richtig? Warum ist das so?* Die Begründung kommt auch bei richtiger Antwort.
5. **Kombinierte Aufgaben.** Wörter, Grammatik, Hören, Schreiben und Sprechen hängen am selben Thema.
6. **Pflicht und Freiwillig sind sichtbar getrennt.** Pflicht zählt zum Tagesziel, Angebot zählt als Extra, nie als Vorwurf.
7. **Premium-Anmutung.** Wirkt wie ein hochwertiges kommerzielles Produkt (Referenz: Linear, Arc, Things, Speak), nicht wie eine Webseite und nicht wie ein Kinderspiel.
8. **Getestet.** Automatische Tests finden Fehler, bevor Emrah sie findet.

---

## KAPITEL 3: PLATTFORM, TECHNIK-STACK UND ARCHITEKTUR

**„Gaming-Engine" bedeutet die technische Qualität:** die App reagiert wie eine native App, flüssig mit 60 fps, zustandsgetrieben, animiert, ohne Neuladen. Keine starren HTML-Seiten.

### 3.1 Zielplattform: Claude-Artefakt (verbindlich)
Die App läuft als **veröffentlichtes Artefakt in claude.ai**. Dadurch sind Datenbank und KI im Claude-Abo enthalten. Daraus folgen harte Regeln:

- **Eine einzige, selbstständige HTML-Datei**, maximal 16 MB, alles eingebettet (JS, CSS, Schriften, Bilder als data-URI).
- Die Content-Security-Policy erlaubt externe Skripte nur von `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com`, `code.jquery.com` und Stylesheets nur von `fonts.googleapis.com`. **Alles andere wird still blockiert** (keine fremden APIs, keine Bilder von außen, kein fetch zu anderen Seiten). Am sichersten: alles per Build einbetten, gar nichts extern laden.
- **Kein Server, keine API-Schlüssel, kein Backend.** Datenbank und KI kommen ausschließlich über die Laufzeit-Fähigkeiten:
  - `const db = await claude.use("db")` — Echtzeit-JSON-Dokumentenspeicher (`db.doc(pfad)`, `db.collection(pfad)`, `get`/`set`/`update`/`delete`, `where`/`orderBy`/`limit`, `onSnapshot`)
  - `const sample = await claude.use("sample")` — Claude fragen: `await sample(input, {onText, signal, modelTier, tools, cache})` → `{text, truncated}`, oder `sample.json(...)` → geparstes JSON. `modelTier`: `quick` | `default` | `complex`.
  - optional `downloads` (Datenexport als Datei).
- **Die Typdefinitionen im Ordner `contract/` (Version 0.2.49) sind maßgeblich.** Lies `claude.d.ts`, `db.d.ts` und `sample.d.ts` vollständig, bevor du Daten- oder KI-Code schreibst. Nichts davon aus dem Gedächtnis raten.
- `claude.use(...)` kann `null` liefern. Die App rendert sofort und schaltet Funktionen zu, sobald die Fähigkeit bereitsteht. Die erste KI-Nutzung fragt einmal nach Zustimmung.
- `sample` hat kein Gedächtnis: jede Anfrage bringt Anweisung, Daten und Ausgabeformat selbst mit. Fehlercodes behandeln (`rate_limited` → zurückhalten, nie in Schleife wiederholen; `not_granted` → Funktion ausblenden).
- `localStorage`/`IndexedDB` funktionieren, aber nur für Bequemlichkeit (Entwurf im Eingabefeld, zuletzt offener Reiter). **Lernfortschritt immer in `db`.**
- Keine echten Push-Nachrichten und keine Installation als PWA (die tägliche Erinnerung kommt vom bestehenden Claude-Tagesauftrag, Kapitel 6.9).

### 3.2 Stack (lokal auf Emrahs Rechner, alles kostenlos)
- **Vite + React + TypeScript strict**
- **Tailwind CSS** (per Build, nicht per CDN) mit eigenem Design-Token-System (Kapitel 8)
- **Framer Motion** für Layout-Animationen, Gesten, Übergänge; **Zustand** für App-Zustand; **XState** für Übungsabläufe und das Rollenspiel
- **ts-fsrs** für die Wiederholungsplanung (Kapitel 5)
- **zod** für die Prüfung aller KI-Antworten und aller gelesenen Datenbank-Dokumente
- **vite-plugin-singlefile**: der Build erzeugt genau eine `dist/index.html` mit allem eingebettet
- Schriften (z. B. Inter oder Geist) als woff2 eingebettet, mit sauberem Fallback-Stapel

### 3.3 Plattform-Adapter (wichtig für Entwicklung und Tests)
Außerhalb von claude.ai gibt es `claude.use` nicht. Deshalb:
- Eine Schicht `/src/platform` kapselt **jeden** Zugriff auf `db` und `sample`. Kein anderes Modul ruft `claude.use` direkt.
- Für Entwicklung und Tests gibt es einen **Entwicklungs-Adapter**: `db` im Speicher, befüllt aus `seed/sample-data.json`, und `sample` mit festen, realistischen Antworten je Prompt-Vorlage. `seed/sample-data.json` erzeugst du selbst: **erfundene, aber realistische Daten** exakt in der Struktur aus Anhang B (mehrere Wochen Aktivität, ~150 Vokabeln in allen Lernstufen, Grammatikthemen mit Fehlersätzen, abgeschlossene Lektionen l01–l06, eine Einschätzung, Feed- und Daily-Einträge). Echte persönliche Daten kommen nicht ins Repository.
- Der Entwicklungs-Adapter darf **nie** im Produktions-Build landen (per Build-Flag ausgeschlossen, durch einen Test abgesichert).

### 3.4 Ordnerstruktur
```
/src
  /platform          Adapter: claude.use (Produktion) und Entwicklungs-Adapter
  /engine            Animations- und Interaktionskern (Lücke, fliegende Buchstaben, Bausteine, Übergänge)
  /ui                Design-System-Bausteine (Button, Sheet, Popover, Skeleton …)
  /features          today course vocab grammar speak business drills read listen write discover preply progress companion settings
  /domain            reine, testbare Logik: srs, mastery, plan, assessment, chunks
  /ai                KI-Tor über sample: Timeout, Abbruch, Fehlerklassen, Drosselung
  /prompts           versionierte Prompt-Vorlagen, je Vorlage ein zod-Schema
  /data              Datenbank-Zugriff, ein einziger kontrollierter Schreibpfad, Schema-Versionen
/seed                sample-data.json (erfunden, Struktur aus Anhang B, nur für Entwicklung/Tests)
/docs                datenstruktur.json (Anhang B)
/contract            Typdefinitionen der Artefakt-Laufzeit (maßgeblich)
/tests               Unit (Vitest), E2E (Playwright), Barrierefreiheit (axe)
```

**Architekturregeln:** keine leeren `catch`-Blöcke; jeder Fehler wird protokolliert und in einer Diagnose-Ansicht in den Einstellungen lesbar. Kein Prompt-Text in Oberflächen-Dateien. Optimistische Updates mit Rückrollen. Lade-Skelette statt Spinner. `onSnapshot` einmal je Abfrage abonnieren, nie im Render. Ein Dokument nur schreiben, wenn es sich geändert hat.

---

## KAPITEL 4: DIE INTERAKTIONS-ENGINE (das Gefühl der App)

1. **Kinetische Lücke (Kernerlebnis).** Bei Lückentexten und aktiver Wortproduktion tippt der Nutzer direkt in die Lücke im Satz. Jeder getippte Buchstabe **fliegt vom Eingabepunkt auf einer weichen Bahn in die Lücke** und rastet ein (Framer Motion, Feder-Physik). Die Lücke wächst mit, erbt Schriftgröße und Grundlinie. Die Anfangsbreite verrät die Länge der Lösung **nicht**. Am Handy öffnet sich die Tastatur zuverlässig, der Satz bleibt sichtbar.
2. **Bausteine.** Beim Satzbau und im E-Mail-Refiner gleiten Wortbausteine per Tippen oder Ziehen an ihren Platz, andere weichen animiert aus.
3. **Rückmeldung beim Prüfen.** Richtig: Lücke färbt sich grün, kurzer Lichtimpuls, leichte Vibration am Handy. Fast richtig (Tippfehler): gold mit Markierung. Falsch: rot, die richtige Lösung schiebt sich darunter, Wort-für-Wort-Vergleich.
4. **Übergänge.** Karten, Blätter und Bildschirme wechseln mit gemeinsamen Elementen (shared layout), nichts erscheint schlagartig. 150–300 ms.
5. **Tastatur und Touch.** Am Rechner komplett per Tastatur bedienbar (Enter prüft/weiter, Ziffern wählen Optionen, `/` öffnet den Übersetzer, Esc schließt). Am Handy Touch-Ziele ≥ 44 px, Wischgesten wo sinnvoll.
6. **Ruhe trotz Bewegung.** Bewegung bestätigt Handlungen, sie dekoriert nicht. Kein Konfetti-Regen. `prefers-reduced-motion` schaltet auf schlichte Überblendungen.
7. **Ton** optional, standardmäßig aus.

---

## KAPITEL 5: LERNWISSENSCHAFT

**Wiederholungsplanung:** **FSRS** für Vokabeln, Wendungen (Chunks) und Fehler. Bewertung Nochmal / Schwer / Gut / Leicht; bei getippten Antworten schlägt die App die Bewertung aus Richtigkeit und Antwortzeit vor.

**Beherrschung je Grammatikthema:** gedämpftes Bayesian Knowledge Tracing. Eine einzelne Antwort verschiebt ein Thema höchstens um einen kleinen, gedeckelten Betrag.

**Einstufung durch die KI (angezeigtes Niveau):** Claude liest die Rohbelege (echte Fehlersätze je Thema, korrigierte Stellen aus eigenen Texten, oft vergessene Wörter, Rollenspiel-Analysen, Aktivität der letzten 14 Tage) und urteilt wie eine Prüferin:
- Gesamtstufe (A2 … C1+) mit Begründung und Trend
- Stufe **je Fertigkeit** (Grammatik, Wortschatz, Lesen, Hören, Schreiben, Sprechen) mit **Belastbarkeit** (dünne / brauchbare / gute Datenlage). Lieber „dünne Datenlage" als eine erfundene Stufe.
- zwei Stärken, zwei bis drei Blocker, je mit „warum das auf C1 auffällt", „so geht es richtig" und Knopf in die passende Übung
- Fokus für die nächsten Tage (fließt in den Tagesplan)
- erneuert sich automatisch (nach ausreichend neuen Antworten, neuem Text, spätestens alle 3 Tage), `modelTier: "complex"`
Die Zahlenwerte aus FSRS/BKT sind nur eingeklappt als „Messwerte dahinter" sichtbar.

**Eingebaute Lernprinzipien:** aktiver Abruf, verteilte Wiederholung, Verschachtelung, Generierungseffekt, verständlicher Input knapp über dem Niveau (i+1), Output unter Druck, Shadowing, Chunks und Kollokationen statt Einzelwörter.

**Best Practices kommerzieller Apps, bewusst übernommen:** Duolingo (klarer Tagespfad, Tagesziel, Serie, kurze Einheiten) · Babbel (Lektionen mit Can-Do-Ziel) · Anki (FSRS, Karten mit Kontext) · LingQ (jedes Wort antippbar und speicherbar) · Speak (Sprechen mit KI-Gegenüber) · Busuu/Preply (Brücke zum Lehrer).
**Nicht übernommen:** Kindlichkeit, aggressive Erinnerungen, Herzen/Leben, Belohnungsfeuerwerk.

---

## KAPITEL 6: FUNKTIONSUMFANG

### 6.1 Heute
- Tagesplan wird **einmal pro Tag festgelegt und gespeichert** (nur Kanal-Kennungen und Begründungs-Schlüssel, keine fertigen Sätze), nie bei jedem Neuzeichnen neu berechnet.
- Pflicht: Lektion des Tages + Wiederholen + ein Pflichtkanal aus dem Tagesmix. Weitere Kanäle als Angebot.
- Kanalgewichtung: wie lange liegengeblieben, Claudes Fokus, dünne Datenlage, schwächster Bereich, viel Fälliges, diese Woche schon oft dran. **Jede Zeile nennt ihren Grund.**
- Statuszeile ganz oben: „Noch nicht fertig · 1 von 3 · es fehlt: …" bzw. „Fertig für heute". Freiwillig Erledigtes wird als Extra genannt.
- Tagesbilanz: was heute gemacht wurde, Minuten, Trefferquote.

### 6.2 Kurs
- Die bestehenden 24 Lektionen in 6 Einheiten, erweiterbar (von der KI nachgeneriert, dann gespeichert). Jede Lektion: Can-Do-Ziel, Szenario aus Emrahs Berufswelt, Wortschatz, Grammatik, Hören, Schreiben/Sprechen. Der bisherige Kursstand bleibt erhalten.
- Lektionsauswahl berücksichtigt die KI-Einschätzung.

### 6.3 Vokabel- und Chunk-Trainer
- **Fünfstufige Leiter:** Erkennen → Zuordnen → Mit Stütze abrufen → Frei abrufen → Sicher anwenden. Jede Stufe hat **mindestens zwei Abfragearten**, bevorzugt die, die diese Karte am schlechtesten kann. Die Leiter ist im Lauf sichtbar.
- Neue Wörter werden **früh unter die Wiederholungen gemischt**, Kontingent einstellbar (0/2/5/10, Standard 5).
- Jede Karte trägt ihren **Ursprungssatz und die Quelle** (Artikel, Rollenspiel, Lehrerstunde). Abfrage im Kontext.
- Wortschatzziel 8.000 für C1 mit Tempo-Prognose.
- Begründung auch bei Vokabeln: Wortart, typische Präposition/Verbindung, wozu die falsch gewählte Übersetzung tatsächlich gehört.

### 6.4 Grammatik
- Regelwerk mit Begründung und Beispielen, Fehlerdiagnose mit Wort-für-Wort-Vergleich, „Auch richtig"-Alternativen, Fehler-Wiederholung.
- Täglich neue Aufgaben zu den schwächsten Themen und zur nächsten Lektion. Die vom Tagesauftrag geschriebenen Aufgaben (`daily/<Datum>`) werden genutzt.

### 6.5 Sprechen / Rollenspiel (Kernmodul)
- Szenen aus Emrahs Welt: E-Rechnungs-Termin gegen den CFO halten, Cloud-DMS gegen einen Enterprise-Architekten verteidigen, Scope-Erweiterung ablehnen, Eskalation nach misslungener Migration, Preisverhandlung, Partner-Pitch. Neue Szenen auf Wunsch per KI.
- **Zwei getrennte `sample`-Aufrufe pro Zug:** die Figur antwortet nur in der Rolle, korrigiert nie, streamt über `onText`; ein Analysator liefert parallel per `sample.json` drei Schichten (Korrektheit · C1-Aufwertung · warum das besser landet) in ein Seitenpanel, das den Gesprächsfluss nie unterbricht. Fällt die Analyse aus, läuft das Gespräch weiter.
- **Eingabe:** Tippen ist der Hauptweg. Spracheingabe per Web Speech API, **wenn der Browser sie im Artefakt erlaubt**; sonst wird der Knopf ausgeblendet, nie ein kaputter Knopf gezeigt.
- **Ausgabe:** Sprachausgabe per `speechSynthesis`, in Stücke ≤ 150 Zeichen an Satzgrenzen zerlegt, mit Wecker gegen Pausieren am Handy, nach `cancel()` 60 ms warten (sonst verschluckt iOS den Anfang). Beste verfügbare englische Stimme automatisch wählen, in den Einstellungen änderbar.
- Wendungen per Tipp „mitnehmen": sie landen mit eigenem Satz und aufgewerteter Fassung im Chunk-Trainer.
- Abschlussbericht nach jedem Gespräch.

### 6.6 Business-Suite
- **Executive E-Mail Refiner:** hölzerne Geschäftsmail wird durch Bausteinauswahl zu einer prägnanten Fassung, mit Begründung je Änderung.
- **Verhandlungs- und Phrasen-Baukasten:** Entscheidungsbäume für Meetings, diplomatische Ablehnung, Zustimmung mit Bedingung, Einwandbehandlung.
- **Präsentations-Coach:** Folieninhalt eingeben, gesprochene Fassung üben, Feedback.

### 6.7 Weitere Lernwege
- **Diktat** (hören → schreiben, Auswertung Wort für Wort mit Levenshtein auf Wortebene)
- **Lückenjagd** (Kollokation im Satz abrufen)
- **Satzbau** (Sätze aus Bausteinen)
- **Sprint** (schnelle Runden gegen die Zeit)

### 6.8 Lesen, Hören, Schreiben
- Texte und Hörtexte von der KI auf Niveau erzeugt und gespeichert, Mischung Beruf/Alltag automatisch ausgeglichen.
- Schreiben: Aufgabe, eigener Text, KI-Korrektur mit Begründung je Stelle, Fehler fließen ins Fehler-Radar.

### 6.9 Entdecken (echter Input)
- Die App selbst kann nicht ins Internet. Deshalb schreibt der **bestehende tägliche Claude-Tagesauftrag** (20:00 Uhr) jeden Abend aufbereitete Beiträge nach `feed/<Datum>` und Grammatikaufgaben nach `daily/<Datum>` in die Datenbank und schickt eine Push-Nachricht. **Das Format dieser Dokumente bleibt unverändert** (siehe Anhang B), damit der Auftrag ohne Anpassung weiterläuft.
- Jeder Beitrag wird eine Lektion in vier Schritten: **Vorbereiten** (Kernwendungen vorab) → **Aufnehmen** (Zusammenfassung, ein kurzes Zitat mit Quelle und Link) → **Prüfen** (Verständnisfragen mit Begründung) → **Anwenden** (eigener Text, die Kernwendungen werden beim Tippen abgehakt).
- Bei Podcasts/Videos (`kind: "listen"`/`"watch"`) keine Zitate und keine Verständnisfragen, sondern die Hörhilfe.
- Links öffnen in neuem Tab (`target="_blank" rel="noopener noreferrer"`).

### 6.10 Preply-Brücke
- **Stunde vorbereiten:** Ziel, Aufwärmfragen, Sprechanlässe aus dem Arbeitsalltag, Modellsätze, eigene echte Fehler als Fokus, fertige englische Nachricht an den Lehrer mit Kopier-Knopf.
- **Vom Lehrer übernehmen:** Emrah fügt Chatverlauf, Korrekturen, Hausaufgaben ein (gern unsauber, gemischtsprachig). Die KI zerlegt in Korrekturen (→ Fehler-Wiederholung und Fehler-Radar), neue Übungen, Vokabeln (→ Karten mit Ursprungssatz) und Hausaufgaben. Übernahme erst nach Bestätigung.
- „Stunde gehalten" zählt als Aktivität. Bisherige Preply-Stunden und Importe bleiben sichtbar.

### 6.11 Wort-Antippen überall
- Jedes englische Wort in jedem Text ist antippbar. Glas-Popover mit Bedeutung im Kontext, Lautschrift, Aussprache, Beispiel, **als Karte speichern (mit Ursprungssatz)**, „Claude fragen". Häufige Wörter aus einem eingebauten Wörterbuch sofort, seltene per `sample` mit `modelTier: "quick"` und Zwischenspeicher in `db`.

### 6.12 Claude-Begleiter
- Chat als großes Overlay (Handy: Vollbild-Blatt), Streaming über `onText`, Markdown, Vorschläge, `cache: false`. Kennt immer den aktuellen Bildschirm und die laufende Übung und zeigt das an („sieht gerade: Grammatik · Passiv"). Kein Scroll-Springen, wenn der Nutzer hochgescrollt hat.
- Übersetzer DE↔EN mit Alternativen und Register (formell/neutral/locker).

### 6.13 Fortschritt
- KI-Einschätzung (Kapitel 5), Fehler-Radar, Weg nach C1 (Can-Do-Liste), Verlauf, Wochenbericht „was du diese Woche wirklich dazugelernt hast", eingeklappte Messwerte.

### 6.14 Einstellungen
- Oberflächensprache, Hell/Gedämpft/Dunkel, neue Wörter pro Tag, Tagesziel in Minuten, Stimme, Ton, Diagnose-Ansicht, **Datenexport als JSON** (über `downloads`).

---

## KAPITEL 7: MOTIVATION OHNE KITSCH
- Serie dezent mit Zahl, kein Flammen-Feuerwerk. Die bisherige Serie läuft ununterbrochen weiter.
- Tagesziel-Ring, Wochenrückblick, Meilensteine je Einheit, ruhige Beherrschungsanzeige je Thema.

---

## KAPITEL 8: DESIGN-SYSTEM
- **Basis:** Dunkelmodus Obsidian `#0B0F19` mit Glas-Flächen (Backdrop-Blur, feine Lichtkante), Akzent Smaragd `#10B981` (= erledigt/richtig), Cyan als zweiter Akzent. Dazu ein heller und ein gedämpfter Modus, alle drei vollwertig gestaltet und getestet.
- **Kanalfarben:** acht abgestimmte Farben (Karten, Grammatik, Lesen, Hören, Schreiben, Sprechen, Business, Entdecken) auf Symbolen und Kanten, nicht als Flächen.
- **Typografie:** eine moderne Groteske, eingebettet, Tabellenziffern für Zahlen, klare Größenskala.
- **Raster:** 8-px-System, großzügige Abstände, eine große Zahl pro Karte, klare Hierarchie.
- **Barrierefreiheit:** WCAG AA in allen drei Modi, Touch-Ziele ≥ 44 px, Fokus sichtbar.
- **Responsiv:** 360 px bis 2560 px, kein Querscrollen, kein abgeschnittener Text. Viewport mit `viewport-fit=cover` und Sicherheitsabständen (`env(safe-area-inset-*)`) für das Handy.

---

## KAPITEL 9: DATEN — DIESELBE DATENBANK, KEIN VERLUST

Die Datenbank hängt am Artefakt. Die neue App wird am Ende **auf dieselbe Artefakt-Adresse** veröffentlicht wie die alte und findet dort alle Daten vor. Deshalb gibt es keinen großen Umzug, sondern **Kompatibilität**:

- **Anhang B** beschreibt die Struktur der heutigen Datenbank (Feldnamen und Datentypen, keine Inhalte). Er ist die Referenz für alle bestehenden Dokumentpfade und Felder, u. a.: `app/profile`, `app/course`, `app/assess`, `app/radar`, `app/pool`, `app/chat`, `app/lookup`, `vocab/<id>`, `grammar/<topicId>`, `lesson/<id>`, `log/<Datum>`, `daily/<Datum>`, `feed/<Datum>`, `writing/<id>`, `preply/<id>`, `chunks/…`, `articles/…`, `reading/…`.
- **Regeln:**
  1. Bestehende Dokumente werden **gelesen und weitergeführt**, nie gelöscht.
  2. Neue Felder dürfen ergänzt werden. Wo ein neues Format nötig ist (z. B. FSRS-Werte je Karte), wird es **zusätzlich** gespeichert; das alte Feld bleibt stehen.
  3. Eine einmalige, versionierte Umstellung beim ersten Start (`app/schema` merkt sich die Version) mit **Trockenlauf-Bericht**, den Emrah bestätigt, bevor geschrieben wird.
  4. `daily/*` und `feed/*` behalten exakt ihr Format (der Tagesauftrag schreibt sie).
  5. Alte Vokabel-Lernstände werden dokumentiert in FSRS-Startwerte umgerechnet.
  6. Jeder gelesene Datensatz wird mit zod geprüft; unbekannte Felder bleiben erhalten.
- Ein Test spielt die Umstellung auf `seed/sample-data.json` durch und prüft: gleiche Anzahl Vokabeln, Grammatikthemen, Lektionen, Logs; gleiche Serie; nichts gelöscht.

---

## KAPITEL 10: KI-SCHICHT (über `sample`)
- Ein zentrales Tor in `/src/ai`: Timeout, Abbruch per `AbortController` beim Bildschirmwechsel, Fehlerklassen mit verständlicher Meldung, höchstens zwei Anfragen parallel, bei `rate_limited` Pause statt Wiederholung.
- Prompts als versionierte Vorlagen in `/src/prompts`, jede mit zod-Schema. Ungültige Antworten werden einmal neu angefragt, danach sauberer Fehlerzustand.
- `modelTier` je Aufgabe: `complex` für Einstufung, Rollenspiel-Analyse, Lehrer-Import · `default` für Rollenspiel-Figur, Texte, Korrekturen · `quick` für Wortbedeutungen und kleine Hilfen.
- Erzeugte Inhalte (Lektionen, Texte, Aufgaben, Wortbedeutungen) werden in `db` gespeichert und wiederverwendet, damit das Abo-Kontingent geschont wird.
- **Sprachtreue:** jede KI-Ausgabe in der eingestellten Oberflächensprache; gespeicherte Texte in falscher Sprache werden neu erzeugt statt gemischt angezeigt.

---

## KAPITEL 11: SUBAGENTS UND WERKZEUGE
**Richte diese als erste Amtshandlung ein und melde, was davon verfügbar ist.**

Subagents in `.claude/agents/`:
- **`architect`** — plant jede Phase, prüft Kapitel 3 (besonders die Artefakt-Regeln), nur Lesen
- **`platform-guard`** — prüft vor jeder Auslieferung: eine Datei, < 16 MB, keine externen Anfragen außer den erlaubten Hosts, kein Entwicklungs-Adapter im Build, jeder `claude.use`-Aufruf entspricht `contract/`
- **`ux-reviewer`** — prüft jeden Bildschirm gegen Kapitel 2, 4 und 8 anhand von Playwright-Screenshots (Handy + Desktop, alle drei Modi)
- **`learning-scientist`** — prüft Übungen und Prompts gegen Kapitel 5 und die vier Pflichtfragen
- **`qa-runner`** — führt alle Tests aus, meldet nur Ergebnis und Fehler
- **`data-guard`** — überwacht Kapitel 9, schlägt bei jeder Abweichung Alarm
- **`debugger`** — wird bei roten Tests herangezogen, findet die Ursache

Werkzeuge (alle kostenlos):
- **GitHub**: dieses Repository; ein Commit je Phase mit klarer Nachricht („Phase 1: Kern-Erlebnis“), damit jeder Stand zurückholbar ist. Keine Geheimnisse und keine persönlichen Daten im Repository.
- **Playwright** für Browser-Tests und Screenshots
- Keine bezahlten Dienste, keine API-Schlüssel.

---

## KAPITEL 12: QUALITÄT UND TESTS
- **Unit-Tests (Vitest)** für `/domain`: FSRS, Beherrschung, Tagesplan (bleibt über den Tag stabil, Zähler steigt bei jeder Pflichtaufgabe), Einschätzungs-Validierung, Datenumstellung.
- **E2E-Tests (Playwright)** gegen den gebauten `dist/index.html` mit Entwicklungs-Adapter, auf 390 px, 1440 px und 2560 px, alle drei Modi, beide Sprachen: jeder Bildschirm rendert, keine JS-Fehler, kein `undefined`/`NaN`/`{0}`, kein Querscrollen, kein abgeschnittener Text, jeder Übungstyp einmal komplett durchgespielt, die fliegenden Buchstaben landen in der Lücke.
- **Plattform-Test:** der Build lädt nichts von fremden Hosts; ohne `db`/`sample` (Adapter liefert `null`) stürzt nichts ab, sondern zeigt einen klaren Hinweis.
- **Widerspruchstests:** Statuszeile, Zähler, Häkchen und Klickziel stimmen in jedem Tageszustand überein; erledigte Aufgaben sind keine Knöpfe.
- **Barrierefreiheit (axe):** Kontrast, Beschriftung jedes Knopfes, Tastaturbedienung.
- **Sprachtest:** keine Mischsprache, auch nicht in gespeicherten KI-Texten, über **alle** Datensätze.
- **Keine `TODO`s, keine Platzhalter** im ausgelieferten Code. TypeScript strict ohne `any`.
- Keine Auslieferung, solange ein Test rot ist.

---

## KAPITEL 13: PHASENPLAN
Jede Phase endet mit grünen Tests, `dist/index.html` auf `main` und Drei-Satz-Bericht. Emrah gibt in claude.ai Bescheid, die Datei wird aus dem Repository geholt; sie wird dort **zunächst als separates Test-Artefakt** mit einer Kopie seiner Daten veröffentlicht. Die alte App bleibt bis zur Abnahme unberührt.

1. **Phase 0 – Fundament:** Fragen stellen, CLAUDE.md, Subagents, Projekt, Plattform-Adapter, Design-System, Datenmodell auf Basis von `seed/export.json`, Umstellung mit Trockenlauf.
2. **Phase 1 – Kern-Erlebnis:** Heute-Bildschirm, Interaktions-Engine (kinetische Lücke, Bausteine, Übergänge), Vokabel-/Chunk-Trainer mit FSRS, Wort-Antippen.
3. **Phase 2 – Lernen:** Kurs mit Lektionen, Grammatik, Diktat, Lückenjagd, Satzbau, Sprint.
4. **Phase 3 – Sprechen:** Rollenspiel mit Analysepanel, Sprachausgabe, Chunks mitnehmen, Business-Suite.
5. **Phase 4 – Input und Output:** Lesen, Hören, Schreiben, Entdecken.
6. **Phase 5 – Begleiter und Brücke:** Claude-Chat, Übersetzer, Preply-Brücke.
7. **Phase 6 – Urteil:** KI-Einschätzung, Fortschritt, Wochenbericht, Tagesplan-Gewichtung.
8. **Phase 7 – Politur und Umzug:** Performance, letzter Design-Durchgang, Abschlussprüfung. Erst auf Emrahs ausdrückliches OK wird die neue App auf die bisherige Artefakt-Adresse veröffentlicht.

---

## KAPITEL 14: ABNAHMEKRITERIEN (Definition of Done)
- Alle Module aus Kapitel 6 sind vorhanden und bedienbar.
- Alle bisherigen Daten sind sichtbar und werden weitergeführt, die Serie läuft weiter, der Tagesauftrag funktioniert unverändert.
- Beim Öffnen ist in unter 2 Sekunden klar, was heute zu tun ist.
- Tippen in die Lücke fühlt sich an wie in einer nativen App.
- Alle Tests grün auf Handy und Desktop, in allen Modi und beiden Sprachen.
- Keine laufenden Kosten über das Claude-Abo hinaus.

---

## KAPITEL 15: FEHLER DES VORGÄNGERS, DIE NICHT WIEDERKOMMEN DÜRFEN
- Tagesplan, der sich bei jedem Neuzeichnen neu würfelt (Zähler bleibt ewig bei „2 von 3")
- erledigte Aufgaben, die noch anklickbar sind
- Zähler, der freiwillige Schritte als Pflicht mitzählt
- dasselbe dreimal auf einem Bildschirm
- neue Wörter, die an Tagen mit Wiederholungen nie auftauchen
- jede Lernstufe mit nur einer Abfrageart
- Eingabefeld unter dem Satz statt in der Lücke
- gemischte Sprache in gespeicherten KI-Texten
- Dunkelmodus, der nie richtig gestaltet wurde (CSS-Spezifität prüfen!)
- Chat als schmale Seitenleiste ohne Kontext, Chat springt beim Lesen nach unten
- Wörter in neuen Übungen nicht antippbar
- Karten ohne Ursprungssatz
- Tests, die nur den heutigen Datensatz prüfen
- stille Fehler durch leere `catch`-Blöcke
- Sprachausgabe am Handy abgehackt
- über die laufende App veröffentlichen, um etwas zu zeigen

**Los geht's: Zerlege zuerst die Anhänge in eigene Dateien, lies `contract/claude.d.ts`, `contract/db.d.ts`, `contract/sample.d.ts` und `docs/datenstruktur.json`, dann beginne mit Phase 0 und stelle Emrah deine höchstens fünf Fragen.**


---

# ANHANG A: TYPDEFINITIONEN DER ARTEFAKT-LAUFZEIT (Version 0.2.49, maßgeblich)

Jede Datei unverändert nach `/contract/<dateiname>` übernehmen.

## Datei: claude.d.ts

```ts
/**
 * `claude.use(name)` — the one way to reach a capability.
 *
 *   const db = await claude.use("db");
 *   if (!db) return renderWithoutDb(); // design for absence
 *   db.collection("tasks").onSnapshot(render);
 *
 * Resolves the capability's namespace once this view can run the
 * capability's code, or `null` when it cannot: the capability is not
 * served on this view, was not granted at initialization, or its module
 * failed to load. The null cases are indistinguishable by design —
 * design for absence, exactly as `permissions.state()` documents. (Chat
 * artifacts use a different, flat `window.claude`; neither `use()` nor
 * these namespaces exist there.)
 *
 * Timing. Inside a viewer the page is framed and `window.claude` exists
 * before any of your script runs. Served top-level by the platform, as
 * its own page on the artifact's own host, it has the same `use`-only
 * `window.claude` before your script too, and every `use()` resolves
 * `null` there for now; any other top-level copy of the page (a saved
 * file, another host) has no `window.claude` at all. This contract
 * promises nothing on it but `use`: treat `window.claude.db`,
 * `window.claude.room` and every other capability member as `undefined`
 * at every moment. The namespace arrives later, through the promise, once
 * the viewer has answered and the module has loaded — never during your
 * script's first synchronous run, and not ordered against
 * `DOMContentLoaded` either way, so don't assume the DOM is complete
 * when it resolves. Render the page without it and light features up
 * when it resolves. Framed by a host that never answers, it resolves
 * `null` after 10 s.
 *
 * The resolved namespace is platform-owned and read-only: a frozen
 * object whose members are the capability's functions. Call them and
 * keep the reference; assigning to it, `Object.defineProperty` on it,
 * or replacing a member throws (or silently does nothing). For helpers
 * of your own, wrap it in your own object.
 *
 * `use()` answers one question: can this view run the capability's
 * code? Permission stays on the calls themselves — a consent prompt,
 * rate limit, or policy refusal arrives on the first call, never here.
 * For a capability this view serves the promise is memoized — every
 * `use("db")` yields the same promise object; a name not served
 * resolves `null` (with no stable promise identity).
 */
interface ClaudeCapabilityMap {}

interface Claude {
  /**
   * See {@link ClaudeCapabilityMap} for the names `use()` accepts on
   * this contract version; an unknown name is a compile error in typed
   * authoring and resolves `null` at runtime.
   */
  use<K extends keyof ClaudeCapabilityMap & string>(
    name: K,
  ): Promise<ClaudeCapabilityMap[K] | null>;
}

// Capability authors: register your namespace type on
// `interface ClaudeCapabilityMap` in your own contract.d.ts — one line,
// same declaration-merging pattern as `interface Claude`.
interface Window {
  claude: Claude;
}
```

## Datei: db.d.ts

```ts
/**
 * The `db` capability — a persistent, realtime document store for this
 * artifact, shared by its viewers.
 *
 * One store per artifact: JSON documents at slash-separated paths
 * (`collection/doc`, nesting deeper as `collection/doc/subcollection/doc`),
 * surviving reloads, republishes, and sessions. The store is created on
 * the first write and erased when the artifact is deleted. Reads and
 * subscriptions see other viewers' writes live. Declare
 * `capabilities: {db: {}}` — a declaring artifact is organization-internal
 * and cannot be shared publicly, so every reader and writer is a
 * signed-in member of the owner's organization.
 *
 * ACCESS RULES. By default every viewer reads and writes shared
 * documents and each viewer's own `data/users/<id>/` subtree is private.
 * To change who may read or write where, declare rules keyed on the
 * viewer's sharing level — `interact` (can view), `admin` (can edit),
 * `owner`, plus `view`, the lowest level, for paths that should stay
 * readable by everyone the server admits (every signed-in viewer of a
 * db artifact is at least `interact`, so `view` only ever widens reads,
 * never writes) — as the minimum level for each action at a path and below:
 *   capabilities: { db: { rules: [
 *     { path: "", read: "interact", write: "admin" },
 *     { path: "data/users/{self}", write: "interact" },
 *   ] } }
 * reads "anyone who can open the page reads shared data, only editors
 * write it, and every viewer writes their own subtree". A rule applies
 * to its path and everything below; a deeper rule overrides it there and
 * may be stricter or looser. A level left unset inherits from the nearest
 * rule above (the root defaults to read: "view", write: "interact").
 * Writing implies reading: a rule's write level is never below its read
 * level. A path ending in `/{self}` names each viewer's own subtree under
 * that prefix: nobody else — the artifact's owner included — sees a
 * sibling's subtree unless a rule at the prefix opens it, and `{self}`
 * must be the last segment. `{self}` works under ANY prefix, not only
 * `data/users`: "everyone reads the votes, each viewer writes only
 * their own" is
 *   { path: "votes", read: "view", write: "admin" },
 *   { path: "votes/{self}", write: "interact" }
 * with each viewer writing `votes/<their id>` (or documents below it) —
 * a rule declared AT the prefix of a `{self}` rule (here `votes`) must
 * set BOTH `read` and `write`, or the declaration is rejected at
 * publish; with no prefix rule, siblings' subtrees stay private as under
 * `data/users`. At most 64 rules; paths follow the
 * document-path grammar below. The owner meets every level, so level
 * rules never limit the owner; only `{self}` privacy does. A call below
 * the minimum fails the same way as a sibling's `{self}` subtree: a read
 * sees a non-existent document and a write rejects `invalid_argument` —
 * so gate controls on the viewer's level up front (the `user`
 * capability's `canEdit()` = admin, `isOwner()` = owner) rather than
 * branching on the code. Rules take effect for
 * the live version on the next call after it goes live; `{db: {}}`
 * restores the defaults.
 * AVAILABILITY is a
 * per-view fact: obtain the namespace with `await claude.use("db")` —
 * it resolves `null` when this view cannot run db (not served, not
 * granted at initialization, or failed to load) — and handle the
 * lifecycle rejection codes on calls and the `onSnapshot` error
 * callback.
 */

/** Rejection shape for every method and the `onSnapshot` error
 * callback. `message` is human-readable but not localized. */
type DbError = {
  code: DbErrorCode;
  message: string;
};

/**
 * Stable error codes. Branch on `code`, never on message text; treat
 * unknown codes as `"unavailable"`.
 *
 * Store codes — the complete set for store operations:
 * - `invalid_argument` — the path, body, or query breaks a rule in
 *   the docs below (bad path grammar, non-object body, a document
 *   over 256 KiB or 32 levels deep, too many filters, an
 *   over-limit page size, ...). Surfaces at call time for verbs
 *   and on the error callback at subscribe time. Fix the call;
 *   retrying cannot succeed.
 * - `resource_exhausted` — a budget: the per-viewer call rate, the
 *   subscription cap (64 per view), too many concurrent writes or
 *   active leases, or a query that scans too many documents. Slow
 *   down, subscribe to less, or narrow the query; tightening a loop
 *   on it cannot succeed.
 * - `quota_exceeded` — a count cap is full: documents in the
 *   collection, documents in this artifact's database, or the
 *   organization's databases (the message names which, and the cap
 *   when known). Not transient: creating documents fails until some
 *   are deleted, while writes to existing documents still succeed.
 *   Surface it to the viewer; retrying cannot succeed.
 * - `unavailable` — a transient platform condition. Verbs: retry
 *   once after a short randomized delay. Subscriptions handle this
 *   INTERNALLY — delivery falls back to periodic refresh and
 *   recovers on its own; an `onSnapshot` error callback never
 *   receives it, EXCEPT when the platform bridge itself stops
 *   responding (a subscribe that never reaches the store): that
 *   listener is terminated with `unavailable` and a fresh
 *   `onSnapshot` is the only recovery.
 * - `revoked` — this view's grant was withdrawn while the page was
 *   running (access, sharing, or availability changed). Terminal for
 *   the page load: at most one delivery per listener; calls reject
 *   thereafter. Render the degraded experience; don't editorialize
 *   about why — the surrounding app owns access messaging.
 *
 * There is deliberately NO `permission-denied` and NO not-found code
 * on reads: a document this viewer cannot see behaves exactly like
 * one that does not exist (`exists: false`, omitted from queries).
 *
 * Lifecycle codes (from the runtime itself, not the store):
 * - `not_granted` — this view did not grant db to the frame.
 * - `capability_disabled` — granted but not usable in this view
 *   (the serving runtime predates it or its module failed to load).
 * - `capability_removed` — the called method is not part of the
 *   runtime serving this view; treat like `capability_disabled`.
 * - `transform_error` — the call's arguments could not be prepared;
 *   treat like `invalid_argument`.
 * (`queue_overflow`, from runtimes that queue calls made before they
 * are ready, can also reach an error callback; it is terminal for that
 * listener and falls under the unknown-code rule above.)
 */
type DbErrorCode =
  | "invalid_argument"
  | "resource_exhausted"
  | "quota_exceeded"
  | "unavailable"
  | "revoked"
  | "not_granted"
  | "capability_disabled"
  | "capability_removed"
  | "transform_error";

/**
 * PATH GRAMMAR (shared by every ref). A document path has an EVEN
 * number of slash-separated segments — the last is the document id,
 * the joined rest is its collection (`tasks/t1`, or nested:
 * `boards/b1/columns/c2`). A collection path is the odd-length
 * prefix form (`tasks`, `boards/b1/columns`). Count segments before
 * choosing the builder. `data/users/<id>` (3) is a COLLECTION — the
 * viewer's own — so one document per viewer is
 * `db.doc("data/users/" + uid + "/profile")` (4), and one document per
 * deck is `db.collection("data/users/" + uid).doc(deckId)` (4).
 * `data/users/<id>/decks` (4) is therefore a DOCUMENT path, not a
 * collection: a named per-viewer list is a subcollection under a
 * per-viewer document,
 * `db.doc("data/users/" + uid + "/profile").collection("decks")` (5),
 * each deck `.doc(deckId)` below it (6) — building from a ref like
 * this keeps the parity right for you. Segments use letters, digits,
 * and `_ - . ~ : @ +` only (never `.` or `..` alone); at most
 * 200 bytes per segment, 1000 bytes and 16 segments per path.
 * `doc()`, `collection()` and the builders on refs THROW a
 * `TypeError` synchronously for a path that breaks
 * this grammar (its message names the broken rule; for parity, the
 * segment count) — a programming error to fix where the path is
 * written, not a store condition to handle; building a ref never
 * touches the network. Paths are data you choose — there is no need to
 * pre-create a collection, and deleting a document does NOT delete
 * documents nested under its path.
 *
 * The `data/users/` path prefix is special, platform-side: each
 * viewer's own subtree under it is private per viewer — including
 * from the artifact's owner (the default `data/users/{self}` rule;
 * a declared rule at the `data/users` prefix opens siblings' subtrees
 * at its levels, see ACCESS RULES above). Address the viewer's subtree as
 * `data/users/<id>/...` using the AWAITED value of
 * {@link Claude.user.id} (declare `user` alongside `db` — without
 * the declaration `id()` resolves null; it is async, and an
 * un-awaited promise is not a valid path segment, so the builder
 * throws) — the
 * store recognizes exactly that id as this viewer, no other value
 * works. A null id means no private subtree: disable the per-viewer
 * feature for that visit rather than relocating its data to a
 * shared path. Another viewer's documents under `data/users/`
 * read as non-existent (`exists: false`, omitted from queries and
 * `onSnapshot`) — the "shared by its viewers" default does NOT
 * apply inside this prefix — and a write (`set`/`update`/`delete`)
 * into another viewer's subtree rejects `invalid_argument`.
 * Hidden-until-reveal (sealed votes, planning poker): each viewer
 * writes their pick under their own `data/users/<id>/` path, where by
 * default nobody else can read it, and copies it to a shared path when
 * THEY reveal — rules are fixed at publish, so nothing a page does at
 * run time opens another viewer's subtree.
 */

/** Snapshot provenance. `fromCache: true` marks a view that is not
 * yet (or not currently) server-definitive — the first pages of a
 * subscription, or delivery during a connectivity gap. A definitive
 * snapshot follows automatically; no action is needed.
 * `hasPendingWrites` is true while the view includes this page's own
 * unconfirmed write (latency compensation). */
type SnapshotMetadata = {
  fromCache: boolean;
  hasPendingWrites: boolean;
};

/** One document, as reads and snapshots deliver it. Delivered
 *  snapshots and their `data()` are frozen; a document that didn't
 *  change is the same object across deliveries — compare with
 *  `===`, don't mutate or accumulate them (clone a body before
 *  editing it for a write). */
type DocumentSnapshot = {
  /** The last segment of the document's path. */
  id: string;
  /** False covers both a missing document and one this viewer cannot
   * see — deliberately indistinguishable. */
  exists: boolean;
  /** The document body; `undefined` when `exists` is false. */
  data(): Record<string, unknown> | undefined;
  metadata: SnapshotMetadata;
};

/** One ordered-view transition inside a query snapshot. Indexes are
 * positions in the snapshot's `docs` order: `oldIndex` is -1 for
 * `added`, `newIndex` is -1 for `removed`. `removed` covers
 * deletion, leaving the query, and losing visibility, identically; its
 * `doc` is the last snapshot the listener saw (`exists: true`,
 * carrying the final body), so a removal handler still has the data. */
type DocumentChange = {
  type: "added" | "modified" | "removed";
  doc: DocumentSnapshot;
  oldIndex: number;
  newIndex: number;
};

/** A query's matched set, in query order. */
type QuerySnapshot = {
  docs: DocumentSnapshot[];
  size: number;
  empty: boolean;
  /** The changes since the previous snapshot of this listener (the
   * first snapshot is all-`added`). */
  docChanges(): DocumentChange[];
  metadata: SnapshotMetadata;
};

/** Stop receiving snapshots. Idempotent; after it returns, the
 * callbacks never fire again. */
type Unsubscribe = () => void;

type AcquireOptions = {
  /** Who holds the lease — any stable string (a viewer id, a tab
   * id). Renewal requires the same holder. */
  holder: string;
  /** Requested lease length in milliseconds. Absent/0 means 30000;
   * values are clamped to [1000, 600000], never rejected. */
  ttlMs?: number;
  /** Merged into the document body when the lease is granted. */
  data?: Record<string, unknown>;
};

type AcquireResult = {
  acquired: boolean;
  /** The document's version after a granted acquire. */
  version?: number;
  /** RFC 3339 expiry of the lease now in force (granted or not). */
  expiresAt?: string;
  /** Your own holder string, echoed on a granted acquire; absent when
   * busy — the platform reveals `expiresAt`, never who holds it. */
  holder?: string;
};

/**
 * A reference to one document. Pure and synchronous to create — a
 * malformed path throws here; nothing reaches the store until a
 * terminal call.
 */
type DocumentReference = {
  /** The last path segment. */
  id: string;
  path: string;

  /** Read once. Absence is NOT an error — branch on `exists`. */
  get(): Promise<DocumentSnapshot>;

  /** Write the WHOLE document, creating it (and the store) if
   * absent — a full replace, Firestore-style. Use `update` to merge
   * into existing fields. Writes are last-writer-wins; there are no
   * transactions.
   *
   * ONE WRITE AT A TIME per document, only when its data changed:
   * await each `set`/`update` before the next to the same document;
   * write on a user action or a real state change, never from render
   * code, a snapshot callback, or a timer that rewrites unchanged or
   * clock-derived values; coalesce a burst of input events into one
   * write per pause. The page open in other tabs or devices writes the
   * same documents; overlapping writes to one document make each write
   * slower. */
  set(data: Record<string, unknown>): Promise<void>;

  /** Merge-write that REQUIRES the document to exist — rejects
   * `invalid_argument` otherwise (creating-on-miss would be a bug
   * for its use cases). Nested objects merge recursively; anything
   * else (arrays included) replaces that field wholesale. Same
   * one-write-at-a-time rule as `set`. Do NOT build monotonic
   * counters from read-modify-update — writes are last-writer-wins
   * and a retried write can apply twice. */
  update(data: Record<string, unknown>): Promise<void>;

  /** Delete this document. Idempotent; nested documents survive. */
  delete(): Promise<void>;

  /**
   * Cooperative short lease on this document — set-if-not-busy, the
   * single-writer primitive (one editor at a time, a migration that
   * should run once, a turn lock). NOT a security boundary: other
   * viewers can still write directly; leases only coordinate
   * callers that all use `acquire`. Busy resolves
   * `{acquired: false}` — a normal outcome, never an error. Leases
   * expire on their own (no release verb): prefer short `ttlMs`
   * and renew while working. There is no create-if-absent write, so
   * "claim a slot" (a seat, a username, first-come ownership) is:
   * `acquire` the slot document (short `ttlMs`, no `data`), `get()`
   * it, and while you hold the lease `set` your claim only if it does
   * not exist yet or its body names no owner, then let the lease
   * lapse; `{acquired: false}` means someone else is mid-claim — treat
   * the slot as taken or re-read after `expiresAt`. Do not carry the
   * claim in `acquire`'s `data` (it merges on every later grant too).
   * A bare get-then-set races and both callers believe they won.
   */
  acquire(options: AcquireOptions): Promise<AcquireResult>;

  /**
   * Subscribe to this document. `next` fires with the current state
   * soon after registration, then on every change — including other
   * viewers' writes, live. Your own writes appear immediately
   * (`hasPendingWrites: true` until confirmed). Delivery rides a
   * realtime stream when available and falls back to periodic
   * refresh (about 30 s foreground) — same callbacks either way.
   * `error` receives at most one terminal {@link DbError}
   * (`invalid_argument`, `resource_exhausted`, `revoked`, or the
   * dead-bridge `unavailable` above), after which the subscription
   * is dead. Pass it: without one a terminal error is reported via
   * `reportError` (your `error` event and console see it) and the
   * listener still dies.
   *
   * SUBSCRIBE ONCE per document or query (when the view starts, or
   * when the path or filter really changes), keep the returned
   * `Unsubscribe`, and call it when done. Never subscribe from code
   * that runs on every render (a React component body, a `render()`
   * function, anything the snapshot callback triggers): each call
   * opens another subscription, each snapshot re-renders, and the
   * page loops. In React, subscribe in a `useEffect`, build the ref or
   * query inside it, depend only on stable primitives, and return the
   * unsubscribe. Don't omit the dependency list or put a query built
   * during render in it: either one re-subscribes on every render. To
   * sort or filter by fast-changing UI state, subscribe once to the
   * wider set and derive the view in render.
   */
  onSnapshot(
    next: (snap: DocumentSnapshot) => void,
    error?: (e: DbError) => void,
  ): Unsubscribe;

  /** A subcollection under this document. */
  collection(path: string): CollectionReference;
};

/**
 * A filtered, ordered, limited view of one collection. Builders are
 * pure — each returns a NEW query; terminal calls do the work.
 * Filters and `orderBy` evaluate against top-level fields without
 * indexes (the store scans the collection), so keep queried
 * collections modest — hundreds to low thousands of documents.
 */
type Query = {
  /** Add a filter (up to 10). Operators: `==`, `!=`, `<`, `<=`,
   * `>`, `>=`, `in`, `not-in` (value arrays of at most 30), and
   * `array-contains`. */
  where(field: string, op: string, value: unknown): Query;

  /** Order by one top-level field (at most one `orderBy`);
   * `dir` defaults to `"asc"`. Documents missing the field sort
   * last. Without `orderBy`, results are ordered by document id
   * (ascending) — the same on every delivery path. */
  orderBy(field: string, dir?: "asc" | "desc"): Query;

  /** At most `n` documents (1-1000). An ordered, limited query is a
   * window: documents beyond the window are not delivered until
   * they enter it. */
  limit(n: number): Query;

  /** Read the matched set once, in query order. */
  get(): Promise<QuerySnapshot>;

  /** Subscribe to the matched set — same delivery contract and same
   * subscribe-once rule as {@link DocumentReference.onSnapshot} (in
   * React, subscribe inside the effect, never during render, and don't
   * list a query built during render as a dependency), with
   * `docChanges()` describing each transition. At most 64 active
   * subscriptions per view (the 65th rejects `resource_exhausted` on
   * the error callback). */
  onSnapshot(
    next: (snap: QuerySnapshot) => void,
    error?: (e: DbError) => void,
  ): Unsubscribe;
};

/** A collection: a {@link Query} over everything in it, plus
 * document access and creation. */
type CollectionReference = Query & {
  path: string;

  /** A document in this collection. Omit `id` to mint a fresh
   * client-generated id — the retriable-create idiom (the store has
   * no idempotency key; a retried create with a fresh ref leaves at
   * most one document per id). */
  doc(id?: string): DocumentReference;

  /** Create a document under a client-generated id and resolve its
   * ref. Sugar for `.doc().set(data)`. */
  add(data: Record<string, unknown>): Promise<DocumentReference>;
};

/**
 * The store surface. Refs are pure path holders — building them never
 * touches the network; only the calls on them do.
 *
 * DOCUMENT BODIES are plain-JSON OBJECTS (not arrays or scalars at
 * the top level): at most 256 KiB serialized and 32 levels deep.
 * CAPACITY: an artifact's database holds at most 5,000 documents in
 * total. Don't map an unbounded, growing stream (events, log lines,
 * messages) to one document per item — aggregate many items into one
 * document or prune old ones — and when a create rejects with
 * `quota_exceeded`, tell the viewer what happened and what to do.
 * Numbers are JSON numbers (double precision). Writes are
 * last-writer-wins — compare document STATE to reason about
 * concurrency, never row counts or call counts.
 */
type DB = {
  /** A document reference. The path must have an even number of
   * segments (`tasks/t1`); throws `TypeError` for a path that breaks
   * the grammar above. */
  doc(path: string): DocumentReference;

  /** A collection reference. The path must have an odd number of
   * segments (`tasks`, `boards/b1/columns`); throws `TypeError` for a
   * path that breaks the grammar above. */
  collection(path: string): CollectionReference;
};

interface ClaudeCapabilityMap {
  db: DB;
}
```

## Datei: sample.d.ts

```ts
/**
 * The `sample` capability — ask Claude from the published artifact, on
 * the viewer's own Claude account, and get the answer (live, as it is
 * written, if you want to show it that way).
 *
 * The short version:
 *
 *     const sample = await claude.use("sample")                          // null: hide the feature
 *     const { text, truncated } = await sample(input, options?)         // the whole answer
 *     const data = await sample.json(input, options?)                    // the answer parsed as JSON
 *     // input   = "prompt" | [{role: "user"|"assistant", content}, ...] ending on a user turn
 *     // options = { onText?({text, delta}), signal?, tools?, images?, modelTier?, cache? }
 *     // failure = one rejected {code, message, text?}; text = the part you may keep
 *
 * One function, one promise. Pass `onText` to render the answer while it
 * streams (each call brings `text`, the WHOLE answer so far, to assign,
 * and `delta`, the new part, to append); pass `signal` to be able to stop. The same promise
 * resolves at the end with the full text, or rejects with the one error
 * shape. There is no stream object, no handle and no second promise.
 *
 * Each call is independent and memory-less: Claude sees ONLY the `input`
 * you pass (a prompt string, or the short list of turns the PAGE keeps
 * for a chat) plus any `images`, under fixed platform framing. It cannot
 * browse, remembers nothing between calls, has no tools except the page
 * functions you pass in `options.tools`, and there is no system prompt
 * the page controls: put the instruction, the page's data and the output
 * format you want in `input`.
 *
 * Availability. Inside a viewer the page is framed and `window.claude`
 * exists before any page script runs; served top-level by the platform on
 * the artifact's own host it exists too, with every `use()` resolving
 * `null` there for now, while any other top-level copy of the page has
 * no `window.claude` at all. `const sample =
 * await claude.use("sample")` resolves this function as soon as the
 * runtime starts, asking the viewer nothing, or `null` where it never
 * can (for example the page is framed by a host that is not a Claude
 * viewer; decided about ten seconds after load) — design for absence
 * and hide the feature. Consent is per call, not per `use()`: a viewer
 * who declines still gets the function and every call rejects
 * `not_granted`, so your `catch` hides the feature too. Inside a React
 * effect, `await claude.use("sample")` in the effect itself and treat
 * `null` like `not_granted`: absence.
 *
 * Cost and consent — read before designing UI around it. A call that
 * reaches Claude spends the VIEWER's own Claude usage, so the first call
 * in a view asks the viewer to allow it; the call waits while they decide
 * and a decline rejects `not_granted` for the rest of the view. Answers
 * are cached for the viewer by default: repeating a call with the same
 * `input`, `modelTier` and `images` within five minutes replays the
 * stored answer without contacting Claude (see
 * {@link sample.SampleOptions.cache}). A couple of calls run at once for
 * a viewer, a few more wait their turn, and a flood rejects
 * `rate_limited`. So: sample on an explicit viewer action ("Ask",
 * "Summarize", "Send") or once at load with a prompt that is stable
 * across loads — never from a loop or a timer — and render a sensible
 * page when sampling is unavailable.
 *
 * Timing to design for: on `"quick"` a short prompt answers in a second
 * or two; on `"default"`/`"complex"` Claude thinks silently before it
 * writes, so the first text usually takes 5-60 s (up to two minutes for
 * a long structured prompt), then streams in over seconds; each round is
 * capped at about five minutes; a call that uses `tools` is several
 * rounds back to back — each thinks, then calls your tools or writes: a
 * three-round call on the default tier commonly takes 30-90 s (about a
 * second per round on `"quick"`), longer with images (re-sent every
 * round). Show progress from inside your `execute` functions. Show
 * "Thinking..." from the moment
 * you call until `onText` first fires (that also covers the consent
 * dialog and a call waiting its turn), and offer a Stop button on
 * anything long. A call can still fail AFTER `onText` has fired: the
 * promise rejects and `e.text` tells you what may stay on screen.
 *
 * Failure design: every failure is one rejected promise carrying a
 * {@link sample.SampleError} `{code, message, text?}` — never a
 * synchronous throw. Branch on `code`, never on `message`; NEVER retry
 * from a loop. {@link sample.SampleErrorCode} groups the codes by what
 * the page should do about each.
 */
declare namespace Claude {
  /**
   * Ask Claude. Resolves with the complete answer; rejects with a
   * {@link sample.SampleError}. Never throws synchronously.
   *
   * The request leaves the page right after your call returns (on the
   * next microtask), not when you `await` — so a call whose `signal` is
   * aborted in the same synchronous block (a React effect cleanup, a
   * superseded keystroke) sends nothing, asks the viewer nothing and
   * costs nothing. The arguments are read once, at call time: later
   * changes to a turn array or a `FileList` do not affect the call.
   *
   *     // One-shot: a button that summarizes what the page shows
   *     const sample = await claude.use("sample");          // null: hide the button
   *     btn.onclick = async () => {
   *       btn.disabled = true;
   *       out.textContent = "Thinking...";
   *       try {
   *         const { text } = await sample("Summarize in 3 bullets:\n\n" + notes.textContent);
   *         out.textContent = text;
   *       } catch (e) {
   *         out.textContent = copyFor(e.code);                // your map from code to viewer copy
   *       } finally {
   *         btn.disabled = false;
   *       }
   *     };
   *
   *     // Streaming with a Stop button: render the answer as it is written
   *     let ctl;
   *     stopBtn.onclick = () => ctl?.abort();
   *     askBtn.onclick = async () => {
   *       ctl = new AbortController();                     // a NEW controller per call
   *       out.textContent = "Thinking...";
   *       try {
   *         const { truncated } = await sample("Explain this config:\n\n" + src, {
   *           signal: ctl.signal,
   *           onText: ({ text }) => { out.textContent = text; },   // whole answer so far
   *         });
   *         if (truncated) note.textContent = "Cut short — ask for less at a time.";
   *       } catch (e) {
   *         out.textContent = e.text ?? "";                 // keep what may be kept; else clears
   *         if (e.code !== "cancelled") note.textContent = copyFor(e.code);
   *       }
   *     };
   *
   *     // Chat: standing instructions are a leading user turn; the list ends on the new message
   *     turns.push({ role: "user", content: box.value });
   *     const { text } = await sample([{ role: "user", content: RULES }, ...turns], {
   *       cache: false, signal: ctl.signal, onText: ({ text }) => { bubble.textContent = text; },
   *     });
   *     turns.push({ role: "assistant", content: text });
   *
   * @param input   What Claude reads: a prompt string, or user/assistant
   *                turns starting and ending on a user turn — see
   *                {@link sample.SampleInput}. At most 64 KiB of text in total.
   * @param options {@link sample.SampleOptions}: `onText` to stream, `signal`
   *                to cancel, `tools`, `images`, `modelTier`, `cache`.
   *                Optional; must be a plain object.
   */
  function sample(
    input: sample.SampleInput,
    options?: sample.SampleOptions,
  ): Promise<sample.SampleResult>;

  namespace sample {
    /**
     * Ask Claude for DATA. The same call as {@link Claude.sample} — same
     * input, options, streaming, consent, caching and errors — but resolves
     * with the reply parsed as one JSON value instead of `{text}`.
     *
     * Say in the prompt exactly what JSON you want ("Reply with only a JSON
     * array of {name, score} objects" plus a one-line example); the
     * platform also tells Claude the reply will be machine-parsed. The
     * reply is read tolerantly: the whole reply as JSON; else the body of
     * one Markdown code fence; else the text from the first `{` or `[` to
     * the last `}` or `]` (so one sentence before or after the value is
     * ignored, but two values, or JSON buried inside a sentence, are not
     * accepted). Any JSON value may come back; the type parameter is a
     * TypeScript convenience and nothing is validated at run time — check
     * the fields you rely on. If no value parses, or the answer was cut
     * short by the length limit, the call rejects `invalid_json` with the
     * raw reply on `e.text`. Such a reply is never cached, so a viewer's
     * "Try again" really asks again — but do not retry from code; if it
     * keeps failing, tighten the instruction or ask for less. `onText`, if
     * passed, receives the raw reply text as it streams. With `tools`,
     * describe the SHAPE you want as usual; the platform tells Claude its
     * final message (after any tool use) is the one parsed, so narration in
     * earlier rounds is ignored. If that final message holds no JSON the call
     * rejects `invalid_json` with everything written on `e.text`.
     *
     *     const tags = await sample.json(
     *       "Reply with only a JSON array of up to 5 short topic tags (strings) for:\n\n" + note,
     *       { modelTier: "quick" },
     *     );
     *     for (const t of tags) chips.append(chip(String(t)));
     */
    function json<T = unknown>(
      input: SampleInput,
      options?: SampleOptions,
    ): Promise<T>;

    /**
     * Resolve this view's limits: the input byte cap, and an `images`
     * member ONLY when this view can send images (how many per call, the
     * largest file accepted, the file types). Use it to decide whether to
     * show an image affordance at all; treat a rejection like an absent
     * `images`. Cheap and local — no usage is spent, the viewer is not
     * prompted.
     *
     *     const caps = await sample.limits().catch(() => null);
     *     photoInput.hidden = !caps?.images;
     *     photoInput.accept = caps?.images?.mediaTypes.join(",") ?? "";
     */
    function limits(): Promise<SampleLimits>;

    // Input

    /**
     * What Claude reads. Either:
     * - a string — the whole prompt: instruction, the page's data, and the
     *   output format, in one piece of text (the common case); or
     * - an array of turns `{role: "user" | "assistant", content}` — a short
     *   conversation the PAGE keeps (Claude keeps nothing between calls),
     *   oldest first, that must START and END with a `user` turn. Use it
     *   for a chat box: push the viewer's message, call, push Claude's
     *   reply. Consecutive turns with the same role are fine (a leading
     *   instructions turn before the viewer's first message; a chat whose
     *   last reply failed and left two user turns in a row) and are read
     *   as one. There is no `system` role: standing instructions go in a
     *   leading `user` turn that you always keep. Assistant turns are
     *   whatever the page says they are and the platform tells Claude so
     *   — use them for real back-and-forth, not to script words into
     *   Claude's mouth (that makes answers worse).
     * Either way the text totals at most 64 KiB (`prompt_too_large` beyond
     * that) — about 60,000 characters of English, fewer for other
     * scripts: slice page text to a few thousand characters rather than
     * measuring, and drop the oldest chat turns (never your instructions
     * turn) as a conversation grows. The array is copied when you call.
     */
    type SampleInput = string | SampleMessage[];

    /** One turn of a {@link SampleInput} conversation. */
    interface SampleMessage {
      /** `"user"` for the viewer/page side, `"assistant"` for an earlier
       * Claude reply you are showing again as context. No other roles. */
      role: "user" | "assistant";
      /** The turn's text. Non-empty. (A plain string — images go in
       * `options.images`, not here.) */
      content: string;
    }

    /**
     * The optional second argument: a plain object, every member optional.
     * Anything that is not a plain object — a Blob, a FileList, a function,
     * an AbortController, a string — rejects `invalid_request` with a
     * message naming the option you probably meant. Members this runtime
     * does not know are ignored (the console names them once).
     */
    interface SampleOptions {
      /**
       * Stream the answer. Called each time more of it has been written —
       * a few times a second at most — with one object: `text` is the
       * WHOLE answer so far, `delta` is just the part added since the last
       * call. Use whichever fits: `el.textContent = text` (or React's
       * `setText(text)`) to show the answer, `el.append(delta)` or a
       * typewriter effect to animate it. Never `+= text`.
       *
       * Guarantees: `text` always equals the previous call's `text` +
       * `delta`, and `delta` is never empty; never called synchronously
       * inside `sample()`; never called after the promise settles or after
       * your `signal` aborts; the first call already has visible
       * (non-blank) text; and before a successful resolve it is called at
       * least once, its last call carrying exactly the result's `text` —
       * so a cached answer, or a viewer app that cannot stream yet, is
       * simply one call whose `text` and `delta` are both the whole
       * answer, followed by the resolve. Nothing fires while Claude is
       * thinking, while the consent dialog is up, or while the call waits
       * its turn: keep your placeholder until the first call. The return
       * value is ignored (an `async` function is not awaited); an exception
       * or rejected promise from `onText` is reported to the console and
       * does not affect the call. Calling `abort()` from inside `onText`
       * is fine.
       *
       *     // Render list items as they complete: ask for one JSON object per LINE
       *     let pending = "";
       *     const eatLines = ({ delta }) => {
       *       const lines = (pending + delta).split("\n");
       *       pending = lines.pop();                       // the unfinished line
       *       for (const line of lines) if (line.trim()) addRow(safeParse(line));
       *     };
       *     await sample(
       *       'Suggest 8 project names, one {"name": string, "why": string} object per line, '
       *         + "no other text.\n\n" + brief,
       *       { onText: eatLines },
       *     );
       *     if (pending.trim()) addRow(safeParse(pending));
       */
      onText?: (update: SampleTextUpdate) => void;

      /**
       * Cancels the call. Create `new AbortController()` FOR THIS CALL,
       * pass `ctl.signal`, and call `ctl.abort()` from a Stop button, an
       * input change, or a React effect cleanup. One controller per call:
       * an aborted signal stays aborted, so a reused one makes every later
       * call reject `cancelled` immediately (the console warns when it sees
       * that). On abort the promise rejects `{code: "cancelled"}` promptly
       * (`e.text` holds any partial answer), `onText` stops, and Claude is
       * told to stop writing so the viewer stops paying for the rest.
       * Aborting before the request has left the page — in the same
       * synchronous block as the call, or while images are being prepared
       * — sends nothing at all: no consent prompt, no usage. Aborting
       * while the call waits its turn or waits on the consent dialog
       * spends no usage; the dialog itself stays up (its answer governs
       * later calls) and this call is simply dropped. A call still queued
       * for a runtime that has not started rejects when the runtime starts
       * (normally well under a second). The code is always `cancelled`
       * whatever the signal's reason; the reason stays on your own signal
       * if you need to tell your Stop button from your cleanup. There is
       * no timeout option and you should not build one: the platform
       * already ends an over-long call, and a page-side timer would also
       * count the time the viewer spends reading the consent dialog. Must
       * be an `AbortSignal` — passing the controller itself rejects
       * `invalid_request`.
       */
      signal?: AbortSignal;

      /**
       * Images for Claude to look at, shown to it with the final (or only)
       * user turn: one JPEG, PNG, WebP or GIF `Blob`/`File`, or a list of
       * them (an array, a `FileList`) — a file the viewer picked,
       * `canvas.toBlob()` output — at most `limits().images.maxCount` per
       * call. The platform downsizes each to about 1.2 megapixels, applies
       * orientation, keeps an animation's first frame and strips metadata
       * before anything is sent; say in the prompt what the images are and
       * what to do with them. Only where {@link limits} reports `images` —
       * elsewhere the call rejects `images_unavailable`; a file of another
       * type, undecodable, or over 20 MB / 10,000 px a side / 64 megapixels
       * rejects `image_rejected`. The page cannot fetch images from URLs
       * (its network is blocked): ask the viewer to pick or drop the file.
       * In a chat, images from earlier turns are not re-sent — describe
       * them in text if they still matter.
       */
      images?: Blob | Blob[] | FileList;

      /**
       * Which model family answers. `"default"` (omitted): the balanced
       * everyday model. `"complex"`: the most capable, for hard reasoning
       * (thinks longest). `"quick"`: the fastest, for short routine work —
       * classification, tags, one-line rewrites, small JSON, and
       * conversational replies where snappiness matters more than depth —
       * it does not think first, so text starts almost at once. For a list
       * of items prefer ONE call that returns a JSON array over one call
       * per item. The platform may serve a nearby cheaper tier when the
       * viewer's plan lacks the one asked for —
       * {@link SampleResult.modelTierApplied} reports which tier actually
       * answered.
       */
      modelTier?: ModelTier;

      /**
       * Answer caching — ON by default. An answer this viewer already
       * received in this artifact for the same `input` (every turn),
       * `modelTier`, `images` (byte-identical) and verb (`sample` vs
       * `json`) is replayed to a repeat call: no usage is spent, Claude is
       * not contacted, `onText` fires once with the whole text and the
       * promise resolves. An identical call made while the first is still
       * running shares its answer as it streams instead of asking twice.
       * Only successful answers are stored (including `truncated` ones,
       * which replay with `truncated: true`); rejections — `cancelled`,
       * `invalid_json`, everything else — never are, so retrying after a
       * failure needs no option. Consent is unchanged: the first call in a
       * view still asks. Entries are per viewer, per artifact, per browser;
       * best-effort; cleared on sign-out. Input that embeds changing data
       * simply never hits.
       *
       * The window: an answer is replayed while it is younger than the
       * `gcTime` of the call that stored it AND of the call asking now
       * (five minutes when neither says otherwise) — so pass the same
       * `cache` value on every call for a given prompt.
       *
       * Omitted or `true` — the default five-minute window.
       * `false` — always ask Claude, store nothing, share nothing. Use it
       *   whenever a repeat MUST produce a new answer: every turn of a
       *   chat, "Regenerate", "Try another".
       * `{gcTime}` — keep and reuse for up to `gcTime` ms, max 24 h (a
       *   summary of content that rarely changes; keep such prompts
       *   short-answered so the stored answer is complete).
       * `{gcTime, refresh: true}` — ask Claude now (spending usage) and
       *   overwrite the stored answer: a "Refresh" button. Pass the same
       *   `gcTime` as the load-time call.
       * Any other value rejects `invalid_request`. A call with `tools` is
       * never stored or shared; passing `cache` (other than `false`) with
       * `tools` rejects `invalid_request`.
       */
      cache?: boolean | SampleCacheOptions;

      /**
       * Functions of THIS PAGE that Claude may call while it works out the
       * answer — read the app's state (`getTrack`) or change it
       * (`setTrackVolume`). Claude reads each tool's `name`, `description`
       * and `inputSchema` (never your code), decides whether and when to
       * call, and your `execute` runs HERE in the page with the arguments
       * Claude chose. Whatever `execute` returns — or throws — goes back to
       * Claude, which then calls more tools or writes the answer. The promise
       * still resolves once, with the final answer; nothing about the rounds
       * is returned — your own `execute` running IS the event.
       *
       * Cost and time: every round is a separate paid request on the viewer's
       * account that re-reads everything so far; a call that uses two tools
       * is three requests. Prefer `"quick"` for direct manipulation (about a
       * second per round); a three-round `"default"` call is commonly 30-90 s.
       * The platform allows a handful of rounds and makes the last one an
       * answer. So: few tools, SMALL plain-data results, page state that fits
       * in the prompt goes in the prompt. Calls with tools are never cached:
       * omit `cache` (any value but `false` rejects `invalid_request`) and
       * call on a click. Only where {@link limits} reports `tools` — elsewhere
       * the call rejects `tools_unavailable`.
       *
       * `onText` works as always: text before and after a tool round arrives
       * as ONE growing `text` with a blank line between rounds. `signal` stops
       * everything: the promise rejects `cancelled`, each running `execute`
       * sees `context.signal` abort, no further round is made. Whatever your
       * tools already did stays done. Text inside page data and tool results
       * can influence which tools Claude calls next, so put anything
       * destructive behind your own confirm step or make it undoable.
       * In TypeScript, annotate a pre-built list as `SampleTool[]` (as the
       * chat example annotates `SampleMessage[]`); inline tools need nothing.
       */
      tools?: SampleTool[];
    }

    /** The object form of {@link SampleOptions.cache}. `{}` takes the defaults. */
    interface SampleCacheOptions {
      /** How long a stored answer may be replayed, in ms: a finite number
       * greater than zero, default 300000 (5 min); values above 86400000
       * (24 h) are treated as 24 h. To disable caching pass `cache: false`
       * — `gcTime: 0` rejects `invalid_request`. */
      gcTime?: number;
      /** Skip the stored answer once: ask Claude now and overwrite it. */
      refresh?: boolean;
    }

    /** One page function offered to Claude. A plain object, read once when you call. */
    interface SampleTool {
      /** 1-128 of `A-Z a-z 0-9 _ -`, unique in the list. `getTrack`, `set_volume`. */
      name: string;
      /** What it does, what it RETURNS, when to use it — 1-3 sentences, at most 1 KB.
       * This is all Claude knows about the tool. Required. */
      description: string;
      /** JSON Schema for ONE object argument — `{type:"object", properties, required}`,
       * the shape `claude.mcp` connectors use; at most 4 KB; sent to Claude as written.
       * Omit for a no-argument tool. Not enforced: coerce and check inside `execute`. */
      inputSchema?: SampleToolInputSchema;
      /** Runs in the page when Claude calls the tool. `input` is the object
       * Claude sent, shaped by `inputSchema` but not validated: coerce what you
       * use (`String(id)`, `Number(db)`) - the `unknown` values make TypeScript
       * insist on exactly that. Return a string or plain
       * data (JSON-encoded, at most 32 KB). To report a problem, THROW: Claude receives
       * "Error: <message>" as the result and carries on — the call does not fail.
       * May be async; `context.signal` aborts on Stop, on settle, or after 150 s.
       * Several calls in one round run concurrently. */
      execute(
        input: { [name: string]: unknown },
        context: SampleToolContext,
      ): unknown;
    }

    /** The second argument to {@link SampleTool.execute}. */
    interface SampleToolContext {
      /** Aborts when the call's `signal` aborts, when the call ends while this
       * tool still runs, or after 150 s. Hand it on (`mcp.callTool(..., {signal})`),
       * and check `signal.aborted` after an `await` before applying an effect. */
      signal: AbortSignal;
    }

    /** JSON Schema for a tool's one object argument (MCP's `inputSchema` type). */
    interface SampleToolInputSchema {
      type: "object";
      properties?: { [name: string]: unknown };
      required?: string[];
      [keyword: string]: unknown;
    }

    /** The argument to {@link SampleOptions.onText}. */
    interface SampleTextUpdate {
      /** The WHOLE answer so far. Assign it: `el.textContent = text`. */
      text: string;
      /** Only what was added since the previous call. Append it if you
       * animate: `el.append(delta)`. Always `text === previousText + delta`. */
      delta: string;
    }

    type ModelTier = "default" | "complex" | "quick";

    // Output

    /** What {@link Claude.sample} resolves with — a plain object. */
    interface SampleResult {
      /** The complete answer text — the same string the last `onText` call
       * received. Never empty or blank (that rejects `empty_completion`).
       * With `tools`, the text of every round, a blank line between rounds. */
      text: string;
      /** `true` when the answer hit the length or time limit and stops
       * mid-thought. The text is still everything Claude wrote: show it
       * with a note, and ask for less or split the task next time.
       * Usually `false`. */
      truncated: boolean;
      /** The tier that actually answered — the one you asked for, or the
       * substitute the viewer's plan allowed. If you offer a tier choice,
       * this is how you tell the viewer it could not be honoured. */
      modelTierApplied: ModelTier;
    }

    /** Resolution shape for {@link limits}. */
    interface SampleLimits {
      /** Largest `input`, in UTF-8 bytes of text — the prompt string, or all
       * turns' `content` together (65536). */
      maxPromptBytes: number;
      /** Present only when this view can send `images`. */
      images?: ImageLimits;
      /** Present only when this view can run {@link SampleOptions.tools}. */
      tools?: ToolLimits;
    }

    /** The image side of {@link SampleLimits}. */
    interface ImageLimits {
      /** Most images one call may carry. */
      maxCount: number;
      /** Largest input file accepted, in bytes (before downsizing). */
      maxInputBytes: number;
      /** Accepted file types, e.g. `"image/jpeg"` — usable as a file
       * input's `accept` list. */
      mediaTypes: string[];
    }
    interface ToolLimits {
      /** Most tools one call may offer. */
      maxCount: number;
    }

    // Errors

    /**
     * The one failure shape: what `sample()` and `json()` reject with. A
     * plain object, not an `Error` (`String(e)` is useless — read the
     * fields). Branch on `.code`; `.message` is developer-facing English,
     * not viewer copy. `.text` is the part of the answer you may keep on
     * screen: present whenever text had streamed before the failure — any
     * code, since with `tools` even `not_granted` or `rate_limited` can
     * arrive between rounds — and equal to what `onText` last received; the
     * whole raw reply on `invalid_json`; absent when nothing had streamed
     * and on `refused` (withdrawn — clear what you rendered). Tools that
     * already ran have run — `e.text` does not undo them.
     */
    interface SampleError {
      code: SampleErrorCode;
      message: string;
      text?: string;
    }

    /**
     * Stable error codes, grouped by what the page should do. Treat an
     * unknown code as `"upstream_error"`. Only `upstream_error` is
     * transient; NEVER retry any code from a loop.
     *
     * You did it — restore the idle UI, keep `e.text` if you want it:
     * - `cancelled` — your `signal` aborted (Stop, superseded input,
     *   unmount) or was already aborted when you called. Not something to
     *   tell the viewer. If it fired after Claude began, some usage was
     *   spent.
     *
     * A page bug — nothing was sent; the message says what to change:
     * - `invalid_request` — the call is malformed: `input` empty, not a
     *   string or turn list (the 0.2 `sample({prompt})` object form lands
     *   here — the prompt goes first now), turns not starting and ending
     *   on `user`, a turn with another role or empty content, `options`
     *   not a plain object, `signal` not an `AbortSignal` (pass
     *   `ctl.signal`, not the controller), `onText` not a function, an
     *   unknown `modelTier`, `images` not Blobs, `cache` not
     *   `true`/`false`/`{gcTime?, refresh?}`, `tools` not an array of
     *   well-formed {@link SampleTool}s (the message names the entry and the
     *   rule), `cache` passed with `tools`, or a tool `inputSchema` Claude's
     *   API refused. (Rarely, the service itself refuses a request as
     *   malformed after text began; `e.text` then carries the partial.)
     * - `prompt_too_large` — over 64 KiB of text, or one call's tool rounds
     *   outgrew what Claude can read at once (return less per tool). Send an
     *   excerpt, a summary, or fewer turns.
     * - `transform_error` — arguments could not be prepared; treat like
     *   `invalid_request`.
     * - `queue_overflow` — hundreds of calls were made before the runtime
     *   started (a loop at load).
     *
     * Hide the feature for this view — permanent, never re-ask, no `text`:
     * - `not_granted` — the viewer (or their organization) has not allowed
     *   this artifact to use Claude.
     * - `sampling_disabled` — Claude is not available for this account or
     *   organization.
     * - `not_declared` — the artifact no longer declares `sample`.
     * - `capability_disabled` — granted but unusable in this view.
     * - `capability_removed` — the method is not in the runtime serving
     *   this view (e.g. `json` on an older viewer app).
     * - `images_unavailable` — this view cannot send images (check
     *   {@link limits} first). Hide the IMAGE affordance only; text calls
     *   work.
     * - `tools_unavailable` — this view cannot run page tools (check
     *   {@link limits} first). Hide what depends on them; plain calls work.
     *
     * Tell the viewer, keep the control — they may try again later or with
     * different input; the page never retries by itself:
     * - `rate_limited` — too many calls (a flood from this page beyond the
     *   few that wait their turn; another open copy of this artifact using
     *   the viewer's slots), too often, or the viewer's own usage limit
     *   (which can also end an answer part-way, with `e.text`). Back off;
     *   let the VIEWER retry later.
     * - `session_expired` — the viewer must sign in again.
     * - `image_rejected` — too many images, wrong type, undecodable, or
     *   too large. Ask the viewer for a different file.
     * - `refused` — Claude declined this input, possibly AFTER some text
     *   had streamed. Any partial is withdrawn (`e.text` absent): clear
     *   what you showed. Resending unchanged gives the same outcome;
     *   change what it asks. Anything your tools already did stays done.
     * - `empty_completion` — Claude produced no text (no `onText` preceded
     *   it) (with `tools`: no round produced text). Do not resend unchanged;
     *   simplify or ask for less.
     * - `invalid_json` — {@link json} only: the reply held no parseable
     *   JSON value, or was cut short before it was complete (the message
     *   says which); `e.text` is the raw reply. Not cached: offer "Try
     *   again"; if it keeps failing, tighten the format instruction.
     * - `upstream_error` — anything else: a transient service or
     *   connection failure, before or during the answer. Keep any partial
     *   (`e.text`), mark it interrupted, offer a manual retry.
     */
    type SampleErrorCode =
      | "invalid_request"
      | "prompt_too_large"
      | "images_unavailable"
      | "tools_unavailable"
      | "image_rejected"
      | "cancelled"
      | "not_granted"
      | "session_expired"
      | "sampling_disabled"
      | "not_declared"
      | "rate_limited"
      | "refused"
      | "empty_completion"
      | "invalid_json"
      | "upstream_error"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error"
      | "queue_overflow";
  }
}

interface ClaudeCapabilityMap {
  sample: typeof Claude.sample;
}
```

## Datei: downloads.d.ts

```ts
/**
 * The `downloads` capability — offer a file your frame generated to the
 * viewer. `save({filename, data})` shows the viewer a confirmation
 * (final filename + size); the file is saved only if they accept. Frame
 * code never downloads directly. Obtain the namespace with
 * `await claude.use("downloads")` — `null` means this view cannot run
 * the capability; design for absence.
 */

declare namespace Claude {
  namespace downloads {
    /** Rejection shape for {@link save}. Branch on `.code`. */
    interface DownloadsError {
      code: DownloadsErrorCode;
      message: string;
    }

    /**
     * Stable error codes; treat unknown codes as `"unavailable"`.
     * - `rejected_extension` — extension missing or outside the allowlist
     *   (`gif png jpg jpeg webp mp4 webm txt json md` and
     *   `docx pptx epub csv ttf html svg pdf xlsx zip`). Offer the format the
     *   content wants (a plain table is a `csv`, a workbook an `xlsx`);
     *   do not pre-build fallbacks to other formats.
     * - `extension_not_enabled` — the platform has switched the second
     *   list off for this view. Not the normal state: if it arrives, tell
     *   the viewer that format is unavailable here and stop — no retry,
     *   no pre-built fallback chain.
     * - `too_large` — this file is over a ceiling: an export answer
     *   (`request` set) larger than the destination the viewer chose
     *   accepts (16 MiB today), or an ordinary save over 200 MiB in a
     *   host that writes files itself (the Claude Android app). Other
     *   ordinary saves have no size limit: never cap, trim, or re-encode
     *   a download up front; on `too_large`, offer a smaller rendition.
     * - `declined` — the viewer said no (or let the prompt expire);
     *   never auto-retry.
     * - `rate_limited` — a prompt is already open or too many recent
     *   prompts; wait, then retry.
     * - `bad_request` — caller bug: bad filename (non-string or >512
     *   chars), bad/empty/detached data, a malformed `request`, or an
     *   answered export whose extension is not the requested format.
     * - `request_unknown` — `request` named no open export request
     *   (expired, already answered, or never issued to this page);
     *   nothing was saved. Drop the work; never retry with that token.
     * - `unavailable` — saves unusable in this view; hide your save UI.
     * - `not_granted`, `capability_disabled`, `capability_removed`,
     *   `transform_error` — runtime lifecycle; treat like `unavailable`
     *   (`transform_error` like `bad_request`).
     */
    type DownloadsErrorCode =
      | "rejected_extension"
      | "extension_not_enabled"
      | "too_large"
      | "declined"
      | "rate_limited"
      | "bad_request"
      | "request_unknown"
      | "unavailable"
      | "not_granted"
      | "capability_disabled"
      | "capability_removed"
      | "transform_error";

    interface SaveRequest {
      /**
       * Suggested filename with extension. It is sanitized (invisible
       * characters dropped, repeated whitespace made one space, at most 240
       * bytes of UTF-8) and allowlist-checked; the viewer confirms the
       * FINAL name, which may differ.
       */
      filename: string;
      /**
       * Non-empty contents; no size limit short of `too_large` above.
       * Strings encode UTF-8. An
       * ArrayBuffer is TRANSFERRED (detached after the call) — pass
       * `buf.slice(0)` if you still need it; views are copied; a Blob is
       * handed over as-is, neither read nor transferred (except when
       * `request` is set: then it is read into one buffer), so prefer
       * a Blob for large files. MIME comes from the extension; a Blob's
       * own type (and a File's name) is ignored.
       */
      data: string | Blob | ArrayBuffer | ArrayBufferView;
      /**
       * Only when answering an export the platform asked this page for:
       * the opaque token that arrived with the request, verbatim. The
       * viewer is then asked to let the file go where they chose instead
       * of saving it, and the call resolves `"delivered"`. Omit for an
       * ordinary save.
       */
      request?: string;
    }

    interface SaveResult {
      /**
       * `"saved"` = viewer accepted and the file was handed to the host's
       * save surface — the browser download, the native share sheet in
       * the Claude iOS app, or the Claude Android app's own file write,
       * which it confirmed (a browser host may still drop a download
       * downstream, unobservably). `"delivered"` = the save carried `request` and the
       * viewer accepted: the file was handed to the platform for the
       * destination they chose, not saved; show no "saved" notice.
       */
      status: "saved" | "delivered";
    }

    /**
     * Offer the file. Resolves when the viewer accepts; rejects with
     * {@link DownloadsError} for every other outcome. One undecided
     * prompt at a time (first-wins).
     */
    function save(request: SaveRequest): Promise<SaveResult>;
  }
}

interface ClaudeCapabilityMap {
  downloads: typeof Claude.downloads;
}
```

## Datei: permissions.d.ts

```ts
/**
 * The `permissions` capability — read and request this page's capability
 * permissions at runtime. Two verbs: `state` reads (never prompts),
 * `request` asks (at most one batched dialog per call). Obtain the
 * namespace with `await claude.use("permissions")` — `null` means this
 * view cannot run the capability; design for absence.
 *
 * By default every capability asks the viewer lazily, at its first use; a
 * page that prefers the single up-front dialog calls `request` with no
 * arguments (or with a subset of names) during startup.
 *
 * States are UX consent, not capability: a "granted" answer does not
 * bypass any server-side check, and a capability call can still fail for
 * server-side reasons (entitlement, policy, auth) after a grant.
 */

declare namespace Claude {
  namespace permissions {
    /**
     * - "granted": usable now — consented, or a capability class that
     *   needs no standing grant (its own surface confirms each use).
     * - "prompt": available; first use (or `request`) will ask the
     *   viewer.
     * - "denied": the viewer declined during THIS page load. Resets on
     *   the next load; `request` will not re-ask this load.
     * - "unavailable": not usable and not askable here. Deliberately one
     *   bucket — an undeclared capability and a declared-but-unavailable
     *   one answer identically, so design for absence rather than
     *   probing why.
     */
    type PermissionState = "granted" | "prompt" | "denied" | "unavailable";

    /**
     * Read without prompting. With a capability name, resolves that one
     * state — unknown names answer "unavailable". With no arguments,
     * resolves the full map of this page's available capabilities;
     * unavailable capabilities are omitted entirely, so treat an absent
     * key as "unavailable" rather than expecting a key per declared
     * capability.
     *
     * Some capabilities additionally support SCOPED names —
     * `"<capability>:<resource>"`, parsed at the first colon — for
     * per-resource states; a capability's own documentation says whether
     * it does and what the resource part is. Scoped names work in every
     * `state`/`request` spelling, appear as their own keys in the
     * no-argument maps, and answer "unavailable" like any unknown name
     * where unsupported.
     */
    function state(): Promise<Record<string, PermissionState>>;
    function state(name: string): Promise<PermissionState>;

    /**
     * Ask the viewer with at most ONE batched dialog. With a list of
     * names, asks for those; with no arguments, asks for everything
     * askable. Already-granted and unavailable names are never re-asked;
     * names the viewer declined this load stay "denied" without a
     * dialog. Resolves with the post-ask state of every requested name
     * (the no-argument form resolves the full map, omitting unavailable
     * keys like `state()`) — it never rejects on a viewer's "no", so
     * always branch on the returned states.
     *
     * The promise can stay pending for as long as the viewer takes to
     * decide. Don't gate first paint on it — render, then adapt.
     */
    function request(
      names?: readonly string[],
    ): Promise<Record<string, PermissionState>>;
  }
}

interface ClaudeCapabilityMap {
  permissions: typeof Claude.permissions;
}
```

---

# ANHANG B: DATENSTRUKTUR DER BESTEHENDEN DATENBANK

Nur Feldnamen und Datentypen, keine Inhalte. `<datum>` = Schlüssel im Format JJJJ-MM-TT, `<schlüssel>` = beliebige Kennung, `<id>` = Dokumentkennung. Nach `/docs/datenstruktur.json` übernehmen.

```json
{
 "app/assess": {
  "blockers": [
   {
    "action": "string",
    "fix": "string",
    "title": "string",
    "why": "string"
   }
  ],
  "c1gap": [
   "string"
  ],
  "cefr": "string",
  "dims": [
   {
    "confidence": "string",
    "id": "string",
    "level": "string",
    "why": "string"
   }
  ],
  "focus": {
   "action": "string",
   "days": "number",
   "title": "string",
   "why": "string"
  },
  "level": "string",
  "levelWhy": "string",
  "strengths": [
   {
    "title": "string",
    "why": "string"
   }
  ],
  "today": "string",
  "trend": "string",
  "trendWhy": "string"
 },
 "app/chat": {
  "msgs": [
   {
    "content": "string",
    "role": "string"
   }
  ]
 },
 "app/course": {
  "done": {
   "l01": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   },
   "l02": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   },
   "l03": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   },
   "l04": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   },
   "l05": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   },
   "l06": {
    "d": "string",
    "n": "number",
    "ok": "number",
    "t": "number"
   }
  },
  "res": {}
 },
 "app/lookup": {
  "items": {
   "<schlüssel>": {
    "de": "string",
    "def": "string",
    "lemma": "string",
    "level": "string",
    "note_de": "string",
    "pos": "string"
   }
  }
 },
 "app/pool": {
  "items": [
   {
    "accepted": [],
    "answer": "string",
    "explanation_de": "string",
    "explanation_en": "string",
    "hint_de": "string",
    "options": "null",
    "prompt": "string",
    "src": "string",
    "topic": "string",
    "type": "string"
   }
  ],
  "t": "number"
 },
 "app/profile": {
  "act": {
   "<datum>": {
    "listen": "number",
    "session": "number",
    "sprint": "number",
    "vtest": "number",
    "write": "number"
   }
  },
  "answers": "number",
  "autoNext": "boolean",
  "canDo": {},
  "created": "string",
  "ctx": "string",
  "ctxChecked": "boolean",
  "days": {
   "<datum>": "number"
  },
  "disc": {
   "fed-hike-2609": {
    "check": "string",
    "prep": "string",
    "take": "string",
    "use": "string"
   },
   "oecd-growth": {
    "check": "string",
    "prep": "string",
    "take": "string",
    "use": "string"
   },
   "un-world-turmoil": {
    "prep": "string",
    "take": "string"
   }
  },
  "ema": {
   "all": "number",
   "colloc": "number",
   "listen": "number",
   "recog": "number",
   "write": "number"
  },
  "feed": [
   {
    "act": "string",
    "d": {
     "gr": "number",
     "lv": "number",
     "vp": "number",
     "xp": "number"
    },
    "t": "number"
   }
  ],
  "gAnswers": "number",
  "gen": {
   "lp": "string",
   "wp": "string"
  },
  "goal": "number",
  "history": [
   {
    "co": "number",
    "d": "string",
    "fl": "number",
    "gr": "number",
    "li": "number",
    "o": "number",
    "vo": "number",
    "vs": "number",
    "wr": "number"
   }
  ],
  "lang": "string",
  "listen": [
   {
    "id": "string",
    "level": "string",
    "n": "number",
    "ok": "number",
    "plays": "number",
    "rate": "number",
    "t": "number"
   }
  ],
  "minutes": {
   "<datum>": "number"
  },
  "mix": {
   "life": "number",
   "work": "number"
  },
  "n": {
   "colloc": "number",
   "listen": "number",
   "recog": "number",
   "write": "number"
  },
  "name": "string",
  "newPerDay": "number",
  "plan": {
   "d": "string",
   "ids": [
    "string"
   ],
   "why": [
    [
     [
      "string"
     ]
    ]
   ]
  },
  "rate": "number",
  "seen15": "boolean",
  "sprints": [
   {
    "avgMs": "number",
    "combo": "number",
    "n": "number",
    "ok": "number",
    "score": "number",
    "t": "number"
   }
  ],
  "theme": {
   "m": "string",
   "p": "string"
  },
  "tour11": "boolean",
  "vAnswers": "number",
  "voice": "string",
  "vtests": [
   {
    "aAcc": "number",
    "aHi": "number",
    "aLo": "number",
    "active": "number",
    "bands": [
     "number"
    ],
    "d": "string",
    "dur": "number",
    "fa": "number",
    "faN": "number",
    "mAcc": "number",
    "pHi": "number",
    "pLo": "number",
    "passive": "number",
    "pseudoN": "number",
    "t": "number"
   }
  ],
  "xp": "number",
  "xpDays": {
   "<datum>": "number"
  }
 },
 "app/radar": {
  "events": [
   {
    "a": "string",
    "c": "string",
    "g": "string",
    "q": "string",
    "s": "string",
    "t": "number"
   }
  ]
 },
 "daily/<id>": {
  "grammarItems": [
   {
    "accepted": [
     "string"
    ],
    "answer": "string",
    "explanation_de": "string",
    "explanation_en": "string",
    "hint_de": "string",
    "prompt": "string",
    "topic": "string",
    "type": "string"
   }
  ],
  "newWords": [
   {
    "de": "string",
    "def": "string",
    "ex": "string",
    "level": "string",
    "pos": "string",
    "word": "string"
   }
  ]
 },
 "feed/<id>": {
  "d": "string",
  "id": "string",
  "items": [
   {
    "chunks": [
     {
      "de": "string",
      "en": "string",
      "note_de": "string",
      "note_en": "string"
     }
    ],
    "excerpt": "string",
    "excerptBy": "string",
    "gist": "string",
    "id": "string",
    "kind": "string",
    "level": "string",
    "mins": "number",
    "questions": [
     {
      "a": "number",
      "opts_de": [
       "…"
      ],
      "opts_en": [
       "…"
      ],
      "q_de": "string",
      "q_en": "string",
      "why_de": "string",
      "why_en": "string"
     }
    ],
    "source": "string",
    "taskChunks": [
     "string"
    ],
    "task_de": "string",
    "task_en": "string",
    "title": "string",
    "topic_de": "string",
    "topic_en": "string",
    "url": "string",
    "why_de": "string",
    "why_en": "string"
   }
  ]
 },
 "grammar/<id>": {
  "anchor": "number",
  "anchorD": "string",
  "c": "number",
  "due": "number",
  "errors": [
   {
    "ans": "string",
    "box": "number",
    "done": "boolean",
    "due": "number",
    "given": "string",
    "last": "number",
    "q": "string",
    "t": "number"
   }
  ],
  "hist": [
   {
    "d": "string",
    "p": "number"
   }
  ],
  "id": "string",
  "last": "number",
  "n": "number",
  "p": "number",
  "recent": [
   "number"
  ],
  "seen": [
   "string"
  ],
  "seenText": [
   "string"
  ]
 },
 "lesson/<id>": {
  "dialogue": {
   "lines": [
    {
     "de": "string",
     "en": "string",
     "sp": "string"
    }
   ],
   "title": "string"
  },
  "output": {
   "de": "string",
   "en": "string",
   "mustUse": [
    "string"
   ]
  },
  "questions": [
   {
    "answer": "string",
    "options": [
     "string"
    ],
    "q": "string"
   }
  ],
  "t": "number",
  "tasks": [
   {
    "accepted": [],
    "answer": "string",
    "expl": "string",
    "expl_en": "string",
    "hint": "string",
    "options": [
     "string"
    ],
    "prompt": "string",
    "src": "string",
    "topic": "string",
    "type": "string"
   }
  ],
  "v": "number",
  "words": [
   {
    "de": "string",
    "def": "string",
    "en": "string",
    "ex": "string",
    "pos": "string"
   }
  ]
 },
 "log/<id>": {
  "date": "string",
  "entries": [
   {
    "ans": "string",
    "given": "string",
    "id": "string",
    "k": "string",
    "m": "string",
    "ok": "boolean",
    "t": "number"
   }
  ]
 },
 "vocab/<id>": {
  "D": "number",
  "S": "number",
  "added": "string",
  "col": [],
  "de": "string",
  "def": "string",
  "due": "number",
  "ex": "string",
  "hist": [
   {
    "g": "number",
    "m": "string",
    "t": "number"
   }
  ],
  "id": "string",
  "intro": "string",
  "lapses": "number",
  "last": "number",
  "lesson": "string",
  "level": "string",
  "modes": {
   "recog": {
    "c": "number",
    "w": "number"
   }
  },
  "order": "number",
  "pa": "number",
  "pos": "string",
  "reps": "number",
  "src": "string",
  "stage": "number",
  "state": "string",
  "word": "string"
 },
 "writing/<id>": {
  "id": "string",
  "lesson": "string",
  "res": {
   "cefr": "string",
   "errors": [
    {
     "cat": "string",
     "right": "string",
     "sev": "string",
     "why": "string",
     "wrong": "string"
    }
   ],
   "scores": {
    "coherence": "number",
    "grammar": "number",
    "register": "number",
    "task": "number",
    "vocabulary": "number"
   }
  },
  "t": "number",
  "text": "string",
  "words": "number"
 }
}
```
