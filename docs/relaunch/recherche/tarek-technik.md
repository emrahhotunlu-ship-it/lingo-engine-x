# Relaunch – Technik-Grundlage (Tarek, Technik-Architekt)

Stand 27.10.2026, Code-Stand `8772982` (`claude/umbau-fokus`), Live-Version `JLL8…` v86. Runde 2: Hier wird **nichts entschieden**, nur die Grundlage gelegt. Alle Zahlen sind am Code gemessen. Wo etwas eine Vermutung ist, steht das dabei.

---

## 1. Kurzfassung in 10 Punkten

1. **Das Fundament trägt.** Datenebene (ein Schreibpfad, zod-Schemas, nie löschen), Plattform-Adapter, KI-Tor, FSRS-Kern, Qualitätstor und Inhalte (8,1 MB geprüfte Aufgaben) bleiben. **Neu** werden Oberfläche und CSS (18 Dateien, 15 Flickschichten). **Umgebaut** werden Planer, Lernmodell, Start-Pfad und Live-Abos.
2. **Gewicht der Datei (5,96 von 6 MiB):** 45 % sind Inhalte, die schon beim Start mitgeladen werden (Grammatik 832 KiB, Atlas 719, C1 436 …). Oberfläche 17 %, Logik 12,5 %, Bibliotheken 9 %. Wer schnell starten will, muss vor allem die **Inhalte vom Start trennen**, nicht den Code kürzen.
3. **Start ≤ 2 s ist machbar**, aber nur mit **Mehr-Datei-Build als Standard**. Dazu kommen ein kleines Einstiegsstück (Ziel ≤ 300 KB gepackt), Inhalte und Reiter zum Nachladen und ein Startbild, das nicht auf die Datenbank wartet. Gemessen: Mehr-Datei 1,0–1,3 s normal, 3,2–3,8 s bei gedrosseltem Handy. Mit den Maßnahmen ist das Ziel „≤ 2 s auch gedrosselt“ realistisch.
4. **Getrennte Layouts für Handy und Laptop sind technisch einfach.** Zwei Rahmen-Komponenten über denselben Bildschirm-Inhalten, jede nur geladen, wenn sie gebraucht wird. Die Arbeit steckt im Design und in den Tests, nicht in der Technik.
5. **Lernmodell je Wort:** Hilfen stehen schon je Karte im Verlauf (`hist[].h`, max. 12 Einträge). Die **Antwortzeit `ms` steht nur im Tagesprotokoll** `log/<Tag>`, nicht auf der Karte. Neu wäre also ein Feld `ms` im Kartenverlauf plus ein kleiner Kennwert-Block je Wort. Das sind ca. 0,1–0,3 KB je Wort, unkritisch.
6. **Die harte Grenze ist die Zahl der Dokumente:** 5.000 je Artefakt im Vertrag 0.2.49. Heute ist es ein Dokument je Wort; das Ziel sind über 8.000 Wörter. Ohne **Sammeldokumente** (`vs/<seg>`, 60–80 Karten je Dokument, geplant seit 11.10., nicht gebaut) geht das nicht. Dasselbe gilt für das Abo der ganzen Vokabel-Sammlung beim Start. Vertrag 0.2.91 hebt die Grenze auf 25.000, ist aber ein **eigener, bewusster Upgrade-Schritt**.
7. **Datensicherheit:** Ein Umbau ohne Datenverlust geht nur **additiv**. Neue Felder sind optional, nichts wird umbenannt oder gelöscht. Jeder Umbau kommt mit Trockenlauf, Sicherung und Test-Link mit Datenkopie, und die alte Version (Rückweg) muss die neuen Daten lesen können. Die Liste der Felder, die nie brechen dürfen, steht in 3.6.
8. **Vorlesen (speechSynthesis) geht.** Die App nutzt es seit Phase 1, mit allen iPhone-Eigenheiten schon abgefangen.
9. **Spracherkennung und eigene Aufnahme gehen in claude.ai nach jetziger Lage nicht.** Die Artefakt-Laufzeit hat für diesen Nutzer **keine Mikrofon-Fähigkeit**, weder in 0.2.49 noch in 0.2.91. Die Plattformregeln sagen wörtlich, dass Mikrofon und Kamera „ohne Nachfrage verweigert“ werden. Wir können `allow="microphone"` nicht selbst setzen, das iframe gehört claude.ai. Die Diktiertaste der Handy-Tastatur geht immer, weil sie vom Betriebssystem kommt. Die Entscheidung vom 21.10. passt dazu.
10. **Die Mikrofon-Probe liegt bereit** (Pfad unten). Sie prüft Vorlesen, Erkennung, Aufnahme, Diktiertaste und Erlaubnisse und gibt eine Ergebniszeile zum Kopieren aus. Bis Emrah sie am iPhone in Safari **und** in der Claude-App gemacht hat, darf kein Relaunch-Baustein vom Mikrofon abhängen.

Dateien:
- Bericht: `/home/user/lingo-engine-x/docs/relaunch/recherche/tarek-technik.md`
- Probe: `/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/mic-probe/index.html`

---

## 2. Bestandsaufnahme

### 2.1 Zahlen

**Quellcode `src/`:** 1.182 TS/TSX-Dateien mit 133.432 Zeilen.

| Bereich | Dateien | Zeilen | Anteil im Haupt-JS* |
|---|---:|---:|---:|
| `features` (Bildschirme) | 312 | 46.700 | 934 KiB (17 %) |
| `domain` (Logik) | 357 | 40.697 | 685 KiB (12,5 %) |
| `i18n` (Texte, 81 Teile) | 168 | 8.981 | 350 KiB (6,4 %) |
| `modules/read` (Lesen) | 55 | 6.718 | 149 KiB |
| `ui` (Bausteine) | 68 | 6.123 | 98 KiB |
| `prompts` (KI-Vorlagen) | 58 | 5.937 | 158 KiB |
| `platform` (Adapter) | 48 | 5.095 | 19 KiB |
| `engine` (Lücke, Animation) | 35 | 3.865 | 48 KiB |
| `app` (Rahmen) | 33 | 3.055 | 36 KiB |
| `data` (Datenbank) | 9 | 2.305 | 24 KiB |
| `ai` (KI-Tor) | 11 | 1.220 | 13 KiB |
| `content` (Inhalte) | 17 TS + 126 JSON | 2.094 + 8,1 MB roh | 2.457 KiB (44,7 %) |
| Bibliotheken (npm) | – | – | 511 KiB (9,3 %) |

\* Zuordnung über die Quellkarte eines Analyse-Builds (Mehr-Datei-Modus, Haupt-JS 5,63 MB roh, 2,74 MB gepackt).

- **Größte Logik-Teile in `domain`:** srs 8.102 · tutor 4.725 · grammar 3.641 · c1 2.458 · c1x 2.240 · metrics 2.003 · progress 1.800 · repair 1.653 · plan 1.347 Zeilen.
- **Größte Bildschirme in `features`:** vocab 8.814 · grammar 4.247 · c1 4.043 · progress 3.724 · speak 3.116 · tutor 3.083 · companion 2.468 · c1x 2.101 · today 2.077 Zeilen.
- **Inhalte roh (JSON):** grammar 2,65 MB (51 Dateien) · atlas 1,42 · c1x 1,40 · c1 1,16 · legacy 0,60 · pron 0,33 · nb 0,21 · fk 0,10 MB.
- **Inhalte im Haupt-JS:** grammar 832 · atlas 719 · c1 436 · legacy 161 · nb 117 · pron 110 · fk 34 KiB. Sie liegen als gepacktes base64 im Skript (ca. +33 % Aufschlag) und lassen sich kaum weiter packen. c1x liegt schon als eigene `.bin`-Dateien (ca. 250 KB) außerhalb.
- **Bibliotheken:** react-dom 203 · motion-dom 99 · zod 92 · xstate 39 · framer-motion 36 · ts-fsrs 21 KiB.
- **Gesamtdatei:** `dist/index.html` 6.246.857 B (5,96 MiB), gepackt 3,11 MB. Warnschwelle 6 MiB, Sperre 9 MiB (`docs/umbau/budget.md`).
- **CSS:** 18 Dateien mit 3.847 Zeilen (108 KB): `index.css` 44 KB, `r6b` 19, `dz` 17, `r6a` 10, `dz2` 8, `cx` 4 KB, dazu mehrere Splitterdateien mit einer Zeile.
- **Tests:** 519 Dateien mit 72.190 Zeilen. Davon 361 Unit-Dateien (ca. 3.755 Fälle) und 113 E2E-Dateien (ca. 735 Fälle). Die E2E-Tests stellen die Bildschirmgröße selbst ein, meist 390 px (150×) und 1440/1280 px (82×).

### 2.2 Urteil je Bereich

| Bereich | Wo | Urteil | Begründung |
|---|---|---|---|
| Datenebene: Schemas, Pfade, Voll-Lesen | `src/data/schemas.ts`, `paths.ts`, `snapshot.ts` | **behalten** | liest jede Altform tolerant (`passthrough`/`loose`), ist geprüft und schützt Emrahs Daten. Neue Felder nur ergänzen. |
| Schreibpfad | `src/data/writer.ts` | **behalten, unverändert** | ein Pfad, schreibt nur bei Änderung, eine Warteschlange je Dokument, löscht nie, verweigert `daily`/`feed`, `transform` = lesen–rechnen–schreiben. Das ist die Datensicherheit. |
| Live-Abos | `src/data/live.ts` | **umbauen** | abonniert beim Start ganze Sammlungen (`vocab`, `grammar`, `archive`, `chunk`). Das ist bei über 8.000 Wörtern weder schnell noch vertragsgerecht (Abfragen sollen „hundreds to low thousands“ umfassen). Gehört hinter das erste Bild und auf Sammeldokumente. |
| Plattform-Adapter | `src/platform` (inkl. `speech.ts`, `stt.ts`, `storage.ts`, `diagnostics.ts`) | **behalten** | einziger Zugang zu `claude.use`, Vorlese-Wissen fürs iPhone ist ausgereift, `stt.ts` ist schon hinter der Mikrofon-Richtlinie abgesichert. |
| KI-Tor | `src/ai` | **behalten** | Abbruch, Fehlerklassen, keine Schleifen, ein Nachfrage-Versuch nur bei Schemafehler (A6 Nr. 2–3). |
| Prompt-Vorlagen | `src/prompts` | **umbauen** | Gerüst (je Vorlage ein zod-Schema, Registry) bleibt; Inhalte folgen dem neuen Lernkern. |
| FSRS-Kern | `src/domain/srs` (applyReview, Umrechnung, Verlauf) | **behalten** | korrekt, getestet, trägt Emrahs Wiederholungsstände (`S`, `D`, `due`, `stage`, `fsrs`, `hist`). |
| Planer | `src/domain/plan` (1.347) + Tagesplan-Teile in `today`/`tutor` | **umbauen** | Regeln stimmen (Plan würfelt nicht neu, `u.v`/`p.v` = 1, `u.rv`), aber die Begriffe sind mehrfach gerechnet: „fällig“, „gekonnt“ und Serie an mehreren Stellen, `buildTrainCards(` an 12 Stellen (`04-technik.md`). Der Relaunch braucht **eine** Quelle je Begriff. |
| Kennzahlen | `src/domain/metrics` (2.003) | **behalten, ausbauen** | genau diese eine Quelle für Zahlen. Alles andere liest nur von hier, damit Häkchen, Zähler und Untertitel übereinstimmen (Prinzip 2). |
| Lernmodell / Tutor | `src/domain/tutor` (4.725), `features/tutor` (3.083) | **umbauen** | `decideMove`, Zielform und `judge` sind brauchbar; das Lernmodell je Wort (3.5) kommt neu dazu. |
| Inhalte Wörter | `content/atlas`, `legacy`, `lexicon`, `pron`, `col` | **behalten (Daten), Lieferung neu** | geprüfte Inhalte; nur das Laden ändert sich (nachladen statt im Startpaket). |
| Inhalte Grammatik | `content/grammar` (2,65 MB) | **behalten (Daten), Lieferung neu** | größter Brocken im Startpaket; wird nachgeladen, sobald Grammatik dran ist. |
| C1-Aufgaben | `content/c1`, `content/c1x`, `domain/c1x` | **behalten** | c1x zeigt schon, wie Nachladen geht (`.bin`). c1 zieht nach. |
| Satzbank | `domain/tutor/sentenceBank.ts` (453), Feld `sb` auf der Karte, Freigabe-Weg | **behalten** | klein und in sich geschlossen. Freigabe nach 4 Wochen ist geplant. |
| Qualitätstor | `src/domain/quality` (6 Dateien, 374 Zeilen) | **behalten** | gate, Fehlersatz, Eindeutigkeit, Register, Wortlaut: genau das, was Lehrer-Prüfung und Routinen absichert. |
| i18n | `src/i18n` (168 Dateien, 81 Teile) | **Mechanik behalten, Texte neu** | Gerüst DE/EN ist gut; viele Texte hängen an alten Bildschirmen und fallen mit ihnen weg. Je Sprache getrennt laden (spart ca. die Hälfte von 350 KiB beim Start). |
| Engine | `src/engine` (35 Dateien, 3.865 Zeilen) | **behalten, umbauen** | kinetische Lücke, Tippen in der Lücke und Übergänge sind Kern-Erlebnis (Kap. 14). Federwerte und Optik an das neue Design anpassen. |
| Bildschirme | `src/features` (312 Dateien) | **neu (Oberfläche), Logik herauslösen** | Rechenlogik, die in Bildschirmen steckt, wandert vorher nach `domain`, damit beim Neubau nichts verloren geht. |
| Lesen | `src/modules/read` | **behalten, Oberfläche anpassen** | seit 14.10. live, Routinen schreiben hinein. |
| Design-Tokens/CSS | `src/styles` (18 Dateien) | **neu** | 15 Flickschichten, Splitterdateien, Spezifitätsrisiko (Kap. 15: Dunkelmodus). Ein neues Token-System, z. B. Nora Nr. 6: drei OKLCH-Eingaben, daraus alle Modi. Alte Dateien fallen weg, sobald ihr Bildschirm ersetzt ist. |
| Unit-Tests | `tests/unit` | **behalten** (domain, data, platform, quality) | sie sichern genau die Teile, die bleiben. |
| E2E-Tests | `tests/e2e` (ca. 735 Fälle) | **schrittweise neu** | sind an die alte Oberfläche gebunden. Je neuem Bildschirm neue Tests; der alte Test fällt mit dem alten Bildschirm. Daten-, Serien- und Umstellungs-Tests bleiben. |

---

## 3. Machbarkeit

### 3.1 Startzeit ≤ 2 s

**Gemessen:**
- `docs/umbau/mehr-datei.md`: Einzeldatei 1,8 / 1,8 / 2,7 s ohne Drossel, Mehr-Datei 1,1 / 1,0 / 1,3 s.
- Bei 4-facher CPU-Drossel (entspricht etwa einem Mittelklasse-Handy): 3,8–4,5 s gegen 3,2–3,8 s. Erster Start gedrosselt 5,0–5,7 s gegen 3,9–4,5 s.
- Nora: 2,4 s, gedrosselt 5,8 s.

**Ursachen:**
1. Das ganze Skript (5,6 MB roh) muss vor dem ersten Bild geladen und ausgewertet werden, die Hälfte davon Inhalte.
2. Die Live-Abos ganzer Sammlungen laufen im Startpfad.
3. Der Heute-Bildschirm rechnet über alle Karten.
4. `useToday((s)=>s)` zeichnet bei jeder Änderung neu (`04-technik.md`).

**Weg zu ≤ 2 s** (Messpunkt: „Heute-Knopf sichtbar und bedienbar“, `lx:status`):
1. **Mehr-Datei als Standard für den Relaunch.** Das ist seit 07.10. erlaubt; Prüfregeln und `publish-manifest.mjs` gibt es schon. Die Einzeldatei bleibt als Notweg.
2. **Inhalte aus dem Startpaket nehmen.** Grammatik, Atlas, c1, legacy, nb, pron und fk werden wie c1x zu `.bin`-Dateien, nachgeladen per `fetch` (relative Pfade gehen laut Artefakt-Regeln) und `DecompressionStream`. Ohne base64-Aufschlag sind das ca. 1,8 MB, die erst beim Bedarf kommen.
3. **Reiter nachladen.** Jeder Bereich (Wörter, Grammatik, Lesen, Sprechen, Fortschritt, Claude) wird sein eigenes Stück über `import()`, ebenso Laptop- und Handy-Rahmen. Texte je Sprache laden.
4. **Startbild ohne Datenbank.** `bootFirst` zeigt das Gerüst schon jetzt vor dem Skript. Neu: Der Heute-Bildschirm rendert aus **einem** kleinen Dokument (Tagesplan bzw. eine Zusammenfassung) und nicht aus allen Karten. Zahlen, die noch fehlen, zeigen ein Skelett statt einer falschen Zahl (Prinzip 2). Die großen Abos starten nach dem ersten Bild.
5. **Neuzeichnen begrenzen.** Store-Auswahl mit schmalen Selektoren statt `(s)=>s`.

**Nicht in unserer Hand:** wie schnell claude.ai das Rahmenfenster lädt, und die Antwortzeit von `claude.use("db")` (bis zu 10 s bis `null`, wenn der Host schweigt). Deshalb darf das Startbild nie auf die Datenbank warten.

**Einschätzung:** ≤ 1 s ohne Drossel und ≤ 2 s mit 4-facher Drossel bis zum bedienbaren Knopf sind mit 1–5 erreichbar. Das ist eine Vermutung aus den Messwerten oben (Einstiegsstück ca. 1/10 des heutigen Skripts); belegt wird sie erst mit einem Probe-Build.

### 3.2 Mehr-Datei und Ladestücke

- **Vorhanden:** `LX_BUILD=multi` (flache Dateien, `base: './'`) und das Plugin `rawJsonZip`. c1x-`.bin` werden schon so nachgeladen. Kleine Lazy-Stücke gibt es schon: FilmPlayer 10,6 KB, WordSky 8,2 KB, particles 2,7 KB.
- **Grenzen der Plattform:**
  - je Veröffentlichung höchstens 255 Dateien und 64 MB; je Version höchstens 511 Dateien und 256 MB
  - 16 MB je Textdatei
  - Dateien gehen beim Aktualisieren nicht verloren (ausgelassene Pfade bleiben stehen), deshalb **alte Stücke gezielt mit `null` entfernen**
- **Eigene Prüfregeln:** Der Plattform-Prüfer sperrt heute Worker und WebAssembly. Laut Artefakt-Regeln laufen Worker aus eigenen Dateien. Ob wir die Sperre lockern, ist eine spätere Entscheidung und für den Start nicht nötig.
- **Regel für Stücke:** Inhalte nach Bereich und Stufe schneiden, z. B. Grammatik je Thema-Familie, Atlas je Segment. Nie ein Stück, das bei jedem Start gebraucht wird, hinter ein Nachladen legen.

### 3.3 Bundle-Budget (Vorschlag zur Entscheidung)

| Teil | Budget (gepackt) | heute |
|---|---|---|
| Einstieg bis „Heute bedienbar“ (HTML + JS + CSS + Schrift) | **≤ 300 KB** | ca. 2,8 MB (alles in einem) |
| je Reiter/Bereich (Stück) | ≤ 150 KB | – |
| je Inhalts-Datei `.bin` | ≤ 500 KB | c1x ca. 250 KB gesamt |
| CSS gesamt | ≤ 30 KB | 25 KB (aber 15 Schichten) |
| gesamte Veröffentlichung | ≤ 16 MB (Plattform), Warnung 9 MB | 6,25 MB |

- Neue Bibliotheken nur mit Begründung. framer-motion und motion-dom zusammen 135 KiB: prüfen, ob CSS-Übergänge plus eine kleine eigene Feder-Funktion reichen (Noras Federn mit Bounce 0–0,15 sind damit machbar). Das ist **eine Option, keine Entscheidung**.
- `verify` prüft das Budget je Stück (heute nur die Gesamtgröße).

### 3.4 Getrennte Layouts Handy / Laptop

- **Technik:** Ein Rahmen je Gerät (`ShellPhone`, `ShellDesk`, bei Bedarf `ShellRail` für 600–1023 px nach Nora) wird über `matchMedia` gewählt und getrennt nachgeladen. Die Bildschirm-Inhalte (Übungsrahmen, Rückmeldeband, Lücke) sind dieselben Bausteine und nehmen ihre Größe vom Behälter (Container Queries), nicht vom Fenster.
- **Was neu ist:** Tastaturbedienung auf dem Laptop (Enter, Esc, Ziffern für Auswahl) und Seitenleiste ab 1024 px. Beides ist im Rahmen machbar und braucht keine Datenänderung.
- **Kosten:** Design, axe-Prüfung und E2E je Rahmen. Die E2E-Tests laufen schon heute auf 390 px und 1280/1440 px, das Muster ist da.
- **Leitplanke:** Kein zweiter Rechenweg. Beide Rahmen lesen dieselben Kennzahlen (`domain/metrics`), sonst zeigen Handy und Laptop unterschiedliche Zahlen.

### 3.5 Lernmodell je Wort (Antwortzeit, Hilfen)

**Was schon in der Datenbank liegt:**

| Ort | Felder | Inhalt |
|---|---|---|
| `vocab/<id>` (ein Dokument je Wort) | `S`, `D`, `due`, `last`, `reps`, `lapses`, `state`, `stage`, `fsrs`, `modes`, `intro`, `ff`, `lg`, `hidden`, `xs`, `wk` | Wiederholungsstand (alt und FSRS) |
| `vocab/<id>.hist[]` | `{t, m, g, x, s, a, u, ci, h, v}`, höchstens 12 Einträge (`HIST_MAX`) | Zeit, Modus, Note, Übung, Hilfe (`h`), ungeprüft (`u`) |
| `vocab/<id>` Inhalt | `word`, `de`, `def`, `ex`, `pos`, `level`, `lu`, `sb`, `col`, `origin` … | Wort, Satz, Satzbank, feste Einheit |
| `log/<Tag>.entries[]` | `{t, ok, k, id, m, given, ans, g, ms, …}` | **Antwortzeit `ms`** und Antwort, je Tag ein Dokument |

**Was neu dazukommt** (additiv, alle Felder optional):
- `hist[].ms`: Antwortzeit in ms, auf 100 ms gerundet. Pro Eintrag ca. 8 Byte, bei 12 Einträgen ca. 0,1 KB je Wort.
- Ein kleiner Kennwert-Block je Wort, z. B. `lm: {rt, rtN, hr, lastOk, spur}`: gleitender Median der Antwortzeit, Anzahl, Hilfequote, letzte richtige Antwort, aktive/passive Spur. Ca. 60–100 Byte. Der Name ist ein Platzhalter, entschieden wird mit Lena.
- Rechnen in `domain` als reine Funktion, geschrieben im **selben** `writer.transform` wie die Bewertung, also kein zusätzlicher Schreibvorgang.
- Beim ersten Lauf lassen sich Altwerte aus `log/<Tag>.ms` über `id` nachtragen, als Trockenlauf und nur ergänzend.

**Kapazität** (Vertrag 0.2.49 im Repo):
- **5.000 Dokumente je Artefakt.** Heute ist es ein Dokument je Wort (Emrah am 11.10.: 192 Wörter), dazu `log/<Tag>` (eins je Tag), `daily`, `feed`, `read`, `grammar` … `CARD_CAP` liegt bei 4.500, Warnung bei 3.500 (`src/domain/atlas/capacity.ts`), `docGuard` bei 4.300.
- **Ziel über 8.000 Wörter → Sammeldokumente `vs/<seg>` sind Pflicht vor dem Wortschatz-Ausbau.** Bei 60–80 Karten je Dokument und einem Wächter bei 200 KiB sind das ca. 2,5 KiB je Karte, also genug Platz für Verlauf und Lernmodell. 8.000 Wörter ergeben ca. 110 Dokumente statt 8.000.
- **256 KiB je Dokument:** `log/<Tag>` wächst mit jeder Antwort. Bei ca. 150 B je Eintrag sind das mehr als 1.500 Antworten je Tag, unkritisch. Der Wächter bleibt.
- **Abos:** höchstens 64 je Ansicht. Mit Sammeldokumenten sinkt die Zahl der Abos und der gelesenen Dokumente beim Start deutlich.
- **Vertrag 0.2.91** (aktuelle Plattform): 25.000 Dokumente, KI-Eingabe 256 KiB statt 64 KiB, `permissions.manage()`. Das Upgrade passiert nur beim Veröffentlichen mit `contract: 'latest'`, als bewusster Schritt mit eigenem Prüftor (platform-guard gegen die neuen `.d.ts`). **Kein Ersatz für die Sammeldokumente**, aber mehr Luft.

### 3.6 Datensicherheit

**Felder und Pfade, die nie brechen dürfen** (lesen, weiterführen, nie umbenennen, nie löschen):

| Was | Wo | Warum |
|---|---|---|
| Serie und Tage | `app/profile`: `days`, `xpDays`, `minutes`, `act`, `pflicht[datum]`, Zähler | Serie läuft weiter (Kap. 14). Tageswechsel 04:00, ein Ruhetag je Woche. |
| Serienregel-Umschaltung | `app/schema.pflichtSince`, Schema-Version | alte Regel bis `pflichtSince`, danach die neue (A6 Nr. 13) |
| Wiederholungsstand | `vocab/*`: `S`, `D`, `due`, `stage`, `last`, `reps`, `lapses`, `state`, `fsrs`, `hist`, `modes`, `intro`, `hidden` | Lernstand jedes Wortes. Alte Werte bleiben neben FSRS stehen (A6 Nr. 14). |
| Wort-Inhalt | `vocab/*`: `id`, `word`, `de`, `ex`, `lu`, `sb`, `origin` | Karten mit Ursprungssatz (Kap. 15), Satzbank |
| Kurs und Grammatik | `app/course`, `lesson/*`, `grammar/*` | Kursstand, Themenstand. Voreinstellungen werden von der Datenbank überlagert (A6 Nr. 11). |
| Tagesplan | `u.v`/`p.v` = 1, `u.rv` | Plan darf nicht neu würfeln (Kap. 15) |
| Protokoll | `log/<Tag>` | Belege für Urteil und Lernmodell; nur anhängen |
| Fremd geschriebene Pfade | `daily/*`, `feed/*` (Tagesauftrag), `read/*` und Kurse (Routinen `trig_01LxTDBs97GGemopdDnxgyXP`, `trig_01TMp36iPogaxiZpk5mHctpL`) | Format einfrieren. Die App liest nur; ändern nur zusammen mit dem Routinen-Auftrag. |
| Einschätzung | `app/assess` (Hüllen-Form) | A6 Nr. 10 |

**Umbau ohne Datenverlust (Regeln):**
1. **Nur additiv.** Neue Felder sind optional (`z.….optional()`, A6 Nr. 16). Kein Feld wechselt Bedeutung oder Typ. Das Lesen bleibt mit `passthrough` tolerant.
2. **Rückwärts lesbar.** Der Rückweg auf v86 muss die vom Relaunch geschriebenen Dokumente lesen und darf sie beim Weiterschreiben nicht zerstören. Das gilt, weil v86 unbekannte Felder durchreicht. Für **neue Dokumentformen** (z. B. `vs/<seg>`) gilt: Die alte Version kennt sie nicht. Deshalb bleiben `vocab/<id>` während einer Übergangszeit die führende Quelle, oder es gibt einen Spiegelweg mit klar dokumentiertem Rückweg. **Das ist der heikelste Punkt des Relaunchs.**
3. **Jede Umstellung** läuft über `writer.transform`, wiederholbar ohne Doppeleffekt, mit Trockenlauf-Bericht. Sperren statt raten (A6 Nr. 15).
4. **Vor dem Live-Gang:** Sicherung (Export über `downloads`), Test-Link `AXHkh6…` mit Datenkopie, Version lesen und Rückweg notieren, erst dann „Ja live nehmen“.
5. **Tests:** Roundtrip-Tests mit `seed/sample-data.json` **und** mit Großdatensatz und Altformen (Kap. 15: nicht nur der heutige Datensatz), Serientest über den Umstellungstag (`retire.ts`).

---

## 4. Sprache

### 4.1 Was Vertrag und Plattform sagen

- **Vertrag 0.2.49 (im Repo) und 0.2.91 (aktuell):** Fähigkeiten sind `artifact`, `assets`, `comments`, `db`, `downloads`, `files`, `mcp`, `room`, `sample`, `self`, `user`, dazu eingebaut `permissions`. **Es gibt keine Fähigkeit für Mikrofon oder Kamera.** `permissions.state(name)` liefert für unbekannte Namen `"unavailable"`. Für `"microphone"` ist also `unavailable` zu erwarten; die Probe liest das aus.
- **Plattformregeln für Artefakt-Seiten (wörtlich):** „Camera, microphone, screen capture, location, motion, Web Share and similar device APIs are refused without a prompt — build on one only when this user has a runtime capability for that device.“ Als Ausweg nennen sie Dateien: „take photos, audio and data as uploaded files instead (file inputs …)“.
- **`allow="microphone"`:** Ein fremdes iframe bekommt das Mikrofon in Chrome nur, wenn die einbettende Seite es mit `allow="microphone"` freigibt [1][2]. WebKit unterstützt dasselbe Attribut seit Ende 2017 [3][4]. **Das iframe gehört claude.ai; wir können das Attribut nicht setzen.** Ohne Fähigkeit dafür bleibt es zu.
- **`sample` nimmt nur Text und Bilder an, kein Audio.** Auch eine gelungene Aufnahme könnte Claude also nicht anhören und benoten. Aussprache-Urteil per KI über Ton ist auf dieser Plattform nicht möglich, nur über erkannten Text.

### 4.2 Die vier Wege einzeln

| Weg | Chrome Android | Safari iOS | im claude.ai-Rahmen (Erwartung) |
|---|---|---|---|
| **Vorlesen** `speechSynthesis` | geht, Stimmen von Google | geht. Stimmen kommen verzögert, „Enhanced/Premium“ müssen in iOS-Einstellungen geladen werden und stottern über die Web-Schnittstelle eher [5][6] | **geht** (die App nutzt es seit Phase 1). Ton erst nach der ersten Berührung. |
| **Spracherkennung** `webkitSpeechRecognition` | vorhanden; läuft über einen Google-Server und braucht die Mikrofon-Erlaubnis [7][8]. Auf dem Gerät (`processLocally`) nur Desktop ab Chrome 139, nicht Android [9] | vorhanden ab iOS 14.5; braucht Siri/Diktat eingeschaltet [10][11]. Seit einer WebKit-Änderung von Nov. 2023 gilt die Mikrofon-Richtlinie auch hier, angeglichen an Chrome [12] | **gesperrt** (`not-allowed`/`service-not-allowed`), in der App-Webansicht womöglich **stilles Hängen** ohne Fehler (Wächter in der Probe) |
| **Aufnahme** `getUserMedia` + `MediaRecorder` | geht mit Erlaubnis; WebM/Opus (lokal getestet: Chromium 141 nimmt auch `audio/mp4;codecs=opus` auf) | MediaRecorder ab 14.5 mit `audio/mp4` (AAC) [13]; WebM/Opus ab Safari 18.4 [14][15]. Format immer mit `isTypeSupported` wählen | **gesperrt** (`NotAllowedError`), siehe 4.1 |
| **Diktiertaste der Tastatur** | geht immer, ins Textfeld | geht immer, ins Textfeld (englische Tastatur wählen) | **geht.** Kommt vom Betriebssystem, nicht von der Seite. So entschieden am 21.10. für „Sag es“. |

**Weitere Hinweise:**
- **Datenschutz:** Bei der Erkennung verlässt die Stimme das Gerät (Google bzw. Apple). Keine Kosten, kein Schlüssel, aber Emrah sollte das wissen.
- **Datei-Ausweg:** `<input type=file accept="audio/*">` funktioniert laut Plattformregeln. Damit kann Emrah eine Sprachmemo hochladen und abspielen, z. B. zum Vergleichen beim Nachsprechen. Ob iOS dabei direkt „Aufnehmen“ anbietet, zeigt die Probe.

### 4.3 Die Mikrofon-Probe

`/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/mic-probe/index.html` (39 KB, eine Datei, lädt nichts von außen, deutsch, große Knöpfe, hell und dunkel).

- **Übersicht** mit Ampel je Test und Auswahl „Wo geöffnet?“ (iPhone Safari, iPhone Claude-App, Laptop, anderes).
- **1 Vorlesen:** englische Stimmen mit Sprache und Herkunft (Gerät/Netz), Spaß-Stimmen ausgegraut (Liste aus `src/platform/speech.ts`). Je Stimme ein Knopf „Vorlesen“ und ein Stern als Favorit, Tempo wählbar. Protokolliert Start-Verzögerung und Fehler.
- **2 Spracherkennung:** `en-US` mit Zwischenergebnissen (grau) und Endergebnis, Trefferquote in Prozent. Deutsche Erklärung jedes Fehlercodes, Wächter nach 8 s für stilles Hängen.
- **3 Aufnehmen und anhören:** `getUserMedia` + `MediaRecorder`, Pegelanzeige, Ende spätestens nach 10 s, Abspielen, Format/Dauer/Größe. Deutsche Fehlererklärung, Wächter nach 10 s.
- **4 Diktiertaste:** Feld mit Zielsatz und Trefferquote.
- **5 Erlaubnisse und Umgebung:**
  - iframe ja/nein, sichere Verbindung, `permissionsPolicy.allowsFeature('microphone')`, vorhandene Schnittstellen und Aufnahmeformate
  - Browser-Erlaubnis über `navigator.permissions.query`
  - `claude.use("permissions")` mit `state()` und `state('microphone')`. Fragt nie nach und ist laut Vertrag ohne Deklaration erlaubt.
  - Ausweg: Tondatei wählen
- **Ergebnis zum Kopieren:** eine Zeile `LX-Probe v1 … | Ort | Gerät | Rahmen | Vorlesen | Erkennung | Aufnahme | Diktat | Richtlinie-Mikro | Browser-Erlaubnis | claude.permissions | Datei`, Kopierknopf mit Markier-Ausweg.
- **Selbst geprüft:** einmal ohne Bildschirm in Chromium 141 (Linux) mit Schein-Mikrofon. Keine Skriptfehler, kein seitliches Scrollen bei 400 px, Aufnahme, Diktat-Vergleich und Ergebniszeile funktionieren. Im echten claude.ai-Rahmen ist sie **nicht** getestet.
- **Veröffentlichen:** durch die Leitung als separates Test-Artefakt, **ohne** Fähigkeiten (`permissions` ist eingebaut). Emrah sollte sie zweimal öffnen, in Safari und in der Claude-App, und beide Ergebniszeilen schicken.

### 4.4 Was daraus für den Relaunch folgt (Vorschlag)

- Sprechen im Relaunch baut auf **Vorlesen + Diktiertaste + Text-Auswertung** (schon entschieden, 21.10.).
- Eigene Erkennung und Selbstaufnahme nur, wenn die Probe in **beiden** Umgebungen „geht“ zeigt. Sonst Backlog, bis claude.ai eine Mikrofon-Fähigkeit anbietet. `stt.ts` ist schon so gebaut, dass es sich dann ohne Umbau zuschaltet.

---

## 5. Risiken und Leitplanken

**Risiken:**

| Nr. | Risiko | Wirkung | Gegenmittel |
|---|---|---|---|
| R1 | Datenform wird beim Umbau verändert | Serie oder Lernstand verloren | nur additiv, Trockenlauf, Sicherung, Datenkopie im Test-Link (3.6) |
| R2 | Rückweg kann neue Datenform nicht lesen | Rückweg verliert Daten | neue Dokumentformen erst spiegeln, alte Form bleibt führend bis zur Freigabe |
| R3 | 5.000-Dokumente-Grenze | neue Wörter lassen sich nicht mehr anlegen (`resource_exhausted`) | `vs/<seg>` vor dem Wortschatz-Ausbau; `docGuard` bleibt; Upgrade auf 0.2.91 als eigener Schritt |
| R4 | Start wartet auf Datenbank oder Abos | > 2 s, leerer Bildschirm | Startbild aus einem Dokument, Abos nach dem ersten Bild, Skelett statt falscher Zahl |
| R5 | Begriffe mehrfach gerechnet | Häkchen, Zähler und Untertitel widersprechen sich (Prinzip 2, Kap. 15) | eine Kennzahlen-Schicht; neue Bildschirme dürfen nicht selbst rechnen |
| R6 | Routinen und Tagesauftrag schreiben in alte Pfade | Lesen, Kurse oder Tagesauftrag brechen | Pfade und Formate von `daily`, `feed`, `read` einfrieren |
| R7 | Datei wächst wieder | Start wird langsam | Budget je Stück im `verify` |
| R8 | Testumbau unterschätzt (ca. 735 E2E-Fälle an alter Oberfläche) | rote Tests blockieren Auslieferung | Tests mit dem Bildschirm ersetzen, nicht hinterher; Unit-Tests der bleibenden Teile unverändert grün halten |
| R9 | Funktion auf Mikrofon versprochen | geht am iPhone nicht | erst Probe, dann entscheiden (4.4) |
| R10 | CSS-Altlasten leben im Neubau weiter | Dunkelmodus-Fehler (Kap. 15) | neues Token-System; alte Datei fällt mit ihrem Bildschirm, keine Mischschichten |

**Leitplanken (hier setze ich mein Veto an):**
1. Kein Schreibzugriff an `writer.ts` vorbei; kein Löschen, kein Umbenennen von Feldern.
2. Kein Live-Gang ohne Sicherung, Test-Link mit Datenkopie, notierten Rückweg und Emrahs „Ja live nehmen“.
3. Keine neue Dokumentform ohne Rückweg-Plan und Kapazitätsrechnung (Dokumente, KiB, Abos).
4. Das Startbild wartet nie auf `db` oder `sample`.
5. Keine Funktion, die Mikrofon oder Kamera **voraussetzt**, solange die Plattform keine Fähigkeit dafür hat.
6. Kein Vertrags-Upgrade nebenbei. `contract: 'latest'` nur als eigener, geprüfter Schritt.
7. Jede Zahl auf dem Bildschirm kommt aus `domain/metrics`.
8. Nichts von außen laden (A6 Nr. 8), auch im Mehr-Datei-Modus.

---

## 6. Quellen

**Im Repository:**
- `contract/claude.d.ts`, `db.d.ts`, `sample.d.ts`, `permissions.d.ts` (0.2.49)
- Plattform-Typen 0.2.91 (artifact-capabilities, `…/0.2.91/*.d.ts`) und die Seitenregeln des Artifact-Werkzeugs
- `docs/umbau/04-technik.md`, `docs/umbau/mehr-datei.md`, `docs/umbau/budget.md`, `docs/umbau/vokabel-plattform.md`, `docs/entscheidungen.md` (07.10., 11.10., 21.10.)
- `docs/relaunch/team.md`, `docs/relaunch/recherche/nora-design.md`, `docs/relaunch/recherche/ilias-sprechen-hoeren.md`
- Code: `src/data/{paths,schemas,writer,live}.ts`, `src/domain/srs/applyReview.ts`, `src/domain/atlas/capacity.ts`, `src/domain/quality/*`, `src/platform/{speech,stt}.ts`, `vite.config.ts`
- Messungen: eigener Analyse-Build mit Quellkarte (im Scratchpad, danach gelöscht); `wc`/`find` über `src/`, `tests/`, `src/styles`

**Extern:**
1. Chromium: Deprecating Permissions in Cross-Origin Iframes – https://chromium.org/Home/chromium-security/deprecating-permissions-in-cross-origin-iframes
2. addpipe: Camera and microphone access in cross-origin iframes – https://blog.addpipe.com/camera-and-microphone-access-in-cross-oirigin-iframes-with-feature-policy.md · docs.w3cub: iframe `allow` – https://docs.w3cub.com/dom/htmliframeelement/allow
3. WebKit Bug 167430 (iframe `allow` für getUserMedia) – https://bugs.webkit.org/show_bug.cgi?id=167430
4. WebKit Bug 182638 und Mailingliste – https://lists.webkit.org/pipermail/webkit-unassigned/2018-April/1638513.html
5. MDN: SpeechSynthesis.getVoices – https://developer.mozilla.org/en-US/docs/web/api/speechsynthesis/getvoices · caniuse – https://caniuse.com/mdn-api_speechsynthesis_getvoices
6. Apple Developer Forum 758460 (ladbare Stimmen) – https://developer.apple.com/forums/thread/758460
7. MDN: SpeechRecognition – https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
8. AssemblyAI: Web Speech API – https://www.assemblyai.com/blog/speech-recognition-javascript-web-speech-api
9. Chromium blink-dev: On-Device Speech Recognition – https://groups.google.com/a/chromium.org/g/blink-dev/c/P8P-x7AnC6I · MDN processLocally – https://developer.mozilla.org/docs/Web/API/SpeechRecognition/processLocally
10. Apple Discussions 255492924 – https://discussions.apple.com/thread/255492924
11. Apple Developer Forum 694847 – https://developer.apple.com/forums/thread/694847
12. WebKit-Änderung Nov. 2023 (Mikrofon-Richtlinie für SpeechRecognition) – https://lists.webkit.org/pipermail/webkit-changes/2023-November/293314.html · WebKit Bug 218476 – https://bugs.webkit.org/show_bug.cgi?id=218476
13. WebKit Blog: MediaRecorder API – https://webkit.org/blog/11353/mediarecorder-api/
14. WebKit Bug 290002 / 293309 (WebM-Aufnahme, Safari 18.4) – https://bugs.webkit.org/show_bug.cgi?id=290002 · https://bugs.webkit.org/show_bug.cgi?id=293309
15. addpipe: Audio in Safari mit MediaRecorder – https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/
16. Rolldown: codeSplitting – https://rolldown.rs/reference/OutputOptions.codeSplitting
17. Erfahrungsbericht: Mikrofon in Claude-Seitenleiste blockiert – https://claudeissues.com/issue/87905-bug-claude-in-chrome-side-panel-dictation-always-microphone-access-is-blocked-cl (Hinweis, keine offizielle Quelle)
