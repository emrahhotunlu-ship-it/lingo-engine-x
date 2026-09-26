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

# ANHÄNGE (ausgelagert)

Die Anhänge wurden in Phase 0 unverändert in eigene Dateien zerlegt. Der ursprüngliche Gesamttext liegt im ersten Commit (`0f12a50`, Datei `AUFTRAG.md`).

- **Anhang A – Typdefinitionen der Artefakt-Laufzeit (Version 0.2.49, maßgeblich):**
  `contract/claude.d.ts`, `contract/db.d.ts`, `contract/sample.d.ts`, `contract/downloads.d.ts`, `contract/permissions.d.ts`
- **Anhang B – Datenstruktur der bestehenden Datenbank:** `docs/datenstruktur.json`
