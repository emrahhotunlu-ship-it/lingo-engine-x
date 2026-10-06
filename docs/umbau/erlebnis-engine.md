# Erlebnis-Engine · Bewegung, Grafik, Ton und Leistung

*Stand 06.10.2026 · Arbeitsstand `claude/umbau-fokus` (zuletzt `d324f43`) · Rolle: Lead Motion- und Creative-Technologist. Grundlage: der Code (`src/styles/index.css`, `src/ui/*`, `src/engine/*`, `src/platform/sound.ts`, `src/platform/haptics.ts`), die Audit-Bildschirmfotos (390×844 und 1440/2000 px, alle Modi, Scratchpad `audit/shots/`), `docs/neubau/leistung.md`, `lernplattform-2.md` (LP2) und `c1-programm.md`. Dieses Dokument **ergänzt** LP2 §7 („Design-Tokens“) und c1-programm §6 („Bewegung statt Video“). Wo es von LP2 abweicht, steht das ausdrücklich da und braucht Emrahs Entscheidung (Teil A, „Was du entscheidest“). Die Datenbank wird nicht angefasst.*

Kennzeichnung der Belege: **[C]** im Code dieses Repos nachgelesen · **[M]** gemessen oder berechnet (Werte in diesem Dokument) · **[Q]** externe Quelle (Liste in §15) · **[E]** eigene Einschätzung, am Gerät zu prüfen.

---

# Teil A · In einfachen Worten (für Emrah)

## Warum das kein Redesign ist

Ein Redesign ändert Farben und Abstände. Die Erlebnis-Engine ist ein **eigener Baustein, der auf Lernereignisse reagiert**: „Antwort richtig“, „Wort ist jetzt sicher“, „Muster sitzt fest“, „Kapitel geschafft“. Jedes dieser Ereignisse bekommt einen eigenen, genau abgestimmten Moment aus Bewegung, Licht und (wenn du willst) Ton. Bewegung zeigt also immer **etwas, das in deinem Kopf passiert ist**. Sie schmückt nicht.

So arbeiten Spiele-Engines: Das Spiel meldet ein Ereignis, die Engine spielt die passende Szene ab, hält 60 Bilder pro Sekunde und hat Grafikstufen (Voll · Ruhig · Aus). Genau das bekommt die App.

## Was du am iPhone merkst (die acht Momente)

1. **Richtig:** Die Lücke füllt sich grün von links nach rechts, ein kurzer Lichtimpuls geht von deiner Antwort aus, das Häkchen zeichnet sich. Dauer etwa eine Viertelsekunde, du kannst sofort weiter.
2. **Fast richtig (Tippfehler):** Gold. Nur die falschen Buchstaben wackeln einmal und werden unterstrichen.
3. **Noch nicht:** Deine Antwort schüttelt sich sanft (nicht die ganze Karte). Dann schrumpft sie durchgestrichen nach oben, und die richtige Lösung gleitet Buchstabe für Buchstabe in die Lücke.
4. **Ein Wort oder Muster steigt auf** (zum Beispiel von „Lernt“ zu „Sicher“): Der nächste Punkt der Statusleiste ●●○○ füllt sich, kleine grüne Funken steigen auf. Das passiert nur, wenn wirklich etwas aufgestiegen ist, nicht bei jeder richtigen Antwort.
5. **Nächste Karte:** Die Karten liegen als Stapel. Die erledigte gleitet zur Seite, die nächste kommt aus dem Stapel nach vorn. Im Anki-Modus folgt die Karte deinem Finger, links färbt sie sich „Nochmal“, rechts „Leicht“.
6. **Runde geschafft:** Zahlen zählen hoch („+3 Wörter sicher“), die Musterpunkte wandern vom alten zum neuen Stand.
7. **Tag geschafft:** Der Tagesring auf Heute hat vier Teile (Wörter, Grammatik, Satzbau, Fehler). Beim letzten Schritt füllt sich das letzte Stück, die vier Teile schließen sich zu **einem** Ring, ein Licht geht durch, das Häkchen zeichnet sich, die große Zahl zählt hoch.
8. **Aufstieg:** Wenn ein Grammatik-Kapitel geschafft ist oder 250/500/750 Wörter fest sitzen, erscheint eine eigene Karte mit Abzeichen, das sich zeichnet, und einem Satz, was du jetzt kannst. Selten, ruhig, mit einem Tipp übersprungen.

Dazu zwei neue Bilder, die echte Daten zeigen:
- **Deine C1-Reise** (Grammatik-Reiter oben): eine Landkarte mit 7 Stationen in leichter 3D-Perspektive, „Du bist hier“ leuchtet, beim Scrollen bewegt sich der Hintergrund langsamer als die Stationen (Tiefe).
- **Dein Wort-Himmel** (Wörter › Atlas): alle 6.789 Atlas-Wörter als Sterne, die häufigsten in der Mitte. Wörter, die bei dir fest sitzen, leuchten. Ein Kreis markiert die C1-Marke bei 4.500.

Im Hintergrund liegt ein ruhiges **Lichtfeld** in den Farben des Bereichs (Wörter violett, Grammatik blau). Es bewegt sich nach dem Öffnen ein paar Sekunden und steht dann still, damit es den Akku nicht leert und beim Lesen nicht stört.

## Was nicht geht (ehrlich)

- **Echte Videos:** Eine Minute Video in brauchbarer Qualität braucht 11–19 MB, die ganze App darf höchstens 16 MB haben (4,8 MB sind belegt). Kurze Mini-Clips wären möglich, müssten aber erst gedreht werden und könnten nicht *deinen* Satz zeigen. Stattdessen gibt es „Struktur-Filme“: Die Wörter deines Beispielsatzes bewegen sich live an ihren neuen Platz (zum Beispiel bei der Umstellung „Never have we seen …“). Das sieht aus wie ein Erklärvideo, ist aber ein paar hundert Byte groß und passt zu Hell und Dunkel.
- **Vibration am iPhone:** Safari kann nicht vibrieren. Ein Umweg über einen versteckten Schalter hat bis iOS 26.4 funktioniert, Apple hat ihn mit iOS 26.5 geschlossen. Deshalb ist die Rückmeldung am iPhone sichtbar und hörbar, nicht fühlbar.
- **120 Bilder pro Sekunde:** Safari zeigt Webseiten mit höchstens 60 Bildern pro Sekunde, auch auf ProMotion-iPhones. Ziel ist deshalb flüssige 60. Im Stromsparmodus macht Safari 30 daraus, die App passt sich an.
- **Figuren wie bei Duolingo (Rive):** Die Rive-Software allein wäre 0,7 MB groß, braucht eine Technik (WebAssembly), die im Claude-Artefakt vielleicht gesperrt ist, und jede Figur müsste ein Designer zeichnen. Für eine erwachsene App lohnt das nicht.

## Was du entscheidest (der Standard gilt, bis du „anders“ sagst)

| Nr. | Frage | Standard |
|---|---|---|
| EE1 | Dürfen die seltenen großen Momente (Runde, Tag, Aufstieg) bis 1,2 Sekunden dauern? Bisher ist jede Bewegung auf 0,3 Sekunden begrenzt (LP2 §1 Nr. 6). | **Ja**, aber nie blockierend: Der Knopf funktioniert nach 0,3 Sekunden, ein Tipp überspringt. Jede Bewegung bei der Bedienung bleibt unter 0,3 Sekunden. |
| EE2 | Ton | **Aus** wie bisher (Kap. 4.7). Einschalten unter Einstellungen; neu mit „Leise · Normal“. Der Stummschalter des iPhones gilt immer. |
| EE3 | Lichtfeld im Hintergrund | **Ruhig:** bewegt sich 12 Sekunden nach jedem Bildschirmwechsel, dann still. Wahl: Voll · Ruhig · Aus. |
| EE4 | Funken | **Nur** wenn ein Wort oder Muster aufsteigt und beim Tagesabschluss, nie bei jeder richtigen Antwort. |
| EE5 | Zweite Schrift (Serifen) für englische Sätze | **Nein.** Inter bleibt die einzige Schrift; sie hat eine eigene Anzeige-Variante für große Größen. |

## Wie du es prüfst

Unter **Einstellungen › Darstellung › „Momente ansehen“** spielt jeder Moment einmal mit Beispieldaten ab (es wird nichts gespeichert). So kannst du am iPhone beurteilen, ob es „outstanding“ oder „zu viel“ ist, ohne erst ein Kapitel zu schaffen. In **Einstellungen › Diagnose** steht nach jedem Moment, wie flüssig er lief (zum Beispiel „Tag geschafft: 58 Bilder/s, längstes Bild 22 ms“). Diese Zeile schickst du mir, wenn etwas ruckelt.

---

# Teil B · Für die Umsetzung

## 0 Ist-Befund (Belege)

**Was gut ist und bleibt** [C]:
- Kinetische Lücke mit fliegenden Buchstaben (Feder 700/34/0,6, höchstens 12 Flieger, 240 ms Flug; `KineticGap.tsx:38-39`, `:216-224`). Gemessen flüssig: Bildabstand p95 16 ms bei CPU 4× (`docs/neubau/leistung.md:79-84`).
- Ein Flug mit gemeinsamem Element Heute-Karte → Übung per FLIP (`engine/shared.tsx:20-23`, `:82-96`), abgesichert durch `tests/e2e/transitions.spec.ts`.
- `MotionConfig reducedMotion="user"` (`app/shell/Shell.tsx:142`) und eine globale Abschaltung bei reduzierter Bewegung (`index.css:717-726`).
- Ton per WebAudio-Oszillator ohne Dateien, iOS-Freischaltung beim ersten Tippen (`platform/sound.ts:10-24`, `:59-72`), Einstellung `app/profile.sound` (`data/schemas.ts:125`).
- Bausteine mit Layout-Animation (`engine/Tiles.tsx:117-119`), Blätter mit Feder 520/42 (`ui/sheetDrag.tsx:48`).

**Warum es „billig“ wirkt** (Bildschirmfotos und Code):

| # | Befund | Beleg |
|---|---|---|
| I1 | **Richtig hat keinen Moment.** Nach der Wahl wird nur die Rahmenfarbe getauscht (150 ms CSS-Übergang). Mit Palette Ozean ist „richtig“ blau wie die Auswahl selbst. | `index.css:620-628`; Foto `03-trainer-0-mc_en-richtig--handy-dark-de.png` |
| I2 | **Der Lichtimpuls ist ein 300-ms-Schatten** (`lx-pulse`), der auf iPhone-Bildschirmen kaum sichtbar ist; „fast richtig“ und „falsch“ haben gar keine Bewegung. | `index.css:385-397`, `:698-708` |
| I3 | **Kein Abschluss-Bild.** Heute fertig zeigt als größte Zahl „2 Antworten“, ohne Ring, ohne Veränderung. `ProgressRing` existiert, wird aber nirgends benutzt (nur `Bar` in der Umstellung). `SessionEnd` zeigt drei feste Kacheln. | `TodayScreen.tsx:318-322`; `ui/ProgressRing.tsx:12-35`, `MigrationScreen.tsx:8`; `ui/SessionEnd.tsx:47-51`; Foto `23-heute-fertig--handy-dark.png` |
| I4 | **Rundenende startet mit Deckkraft 0.** Das Foto des Grammatik-Endes ist ein Leerbild (nur Kopfzeile). Ob Aufnahmezeitpunkt oder echter Fehler: Ein Ende darf nie aus 0 einblenden (LP2 §11 Nr. 7 „ohne Leerbild“). | `SessionScreen.tsx:69`; Foto `09-grammatik-ende--handy-dark-de.png` |
| I5 | **Kartenwechsel ohne Raumgefühl:** neue Karte blendet in 120 ms aus Deckkraft 0 ein (Wörter) bzw. 12 px seitlich (Grammatik); kein Stapel, keine Richtung. Früher gemessen: „Weiter → Karte ruhig“ 515 ms wegen `mode="wait"` (inzwischen entfernt). | `TrainerScreen.tsx:104-109`; `SessionScreen.tsx:69`; `leistung.md:66-71` |
| I6 | **Wischen ohne Folgen des Fingers:** Die Anki-Geste wird erst beim Loslassen erkannt, die Karte bewegt sich während des Wischens nicht. | `engine/swipe.ts:3-6` |
| I7 | **Leere Flächen statt Grafik:** Heute am Handy ist ab etwa 65 % der Höhe leer; am Laptop (2000 px) stehen links und rechts je ≈ 470 px leer; Atlas und Fortschritt sind Text in Karten. | Fotos `01-heute--handy-dark-de.png`, `L01-heute-laptop.png`, `13-atlas--handy-dark-de.png`, `12-fortschritt--handy-dark-de.png` |
| I8 | **Hintergrund:** zwei feste Radialverläufe mit `background-attachment: fixed`, das iOS-Safari nicht als fest darstellt. | `index.css:279-283` |
| I9 | **Bewegung nur auf dem Hauptthread:** framer-motion animiert einzelne Transform-Werte (`x`, `y`, `scale`) nicht auf dem Compositor [Q: Motion-Doku]. Im claude.ai-Rahmen (fremdes iframe) drosselt Safari `requestAnimationFrame` bis zum ersten Tippen auf 30 fps [Q: WebKit r215070]. Der erste Eindruck beim Öffnen läuft also mit halber Bildrate. | `KineticGap.tsx:221-223`, `ProgressRing.tsx:29-31` (rAF-getrieben) |
| I10 | **Ton und Vibration verstreut:** Lücke, Auswahl und Einstellungen rufen `playCue`/`verdictHaptic` je selbst auf; LP2 §4.2 verlangt das „nur in `Verdict`, einmal je Prüfen“. | `KineticGap.tsx:69-73`, `Choices.tsx:27-31`, `:46-48` |
| I11 | **Eine Feder für alles:** `spring` 520/40/0,9 (t95 = 176 ms, 0 % Überschwingen [M]) für Segmente und Schalter; sonst feste Kurven 150–300 ms. Kein Vokabular für „landen“, „aufspringen“, „füllen“. | `ui/motion.ts:4-7` |

**Ergebnis:** Die App reagiert korrekt, aber stumm. Ihr fehlen (1) eine Antwort auf Lernereignisse, (2) Raum und Tiefe, (3) sichtbarer Fortschritt als Bild.

## 1 Leitsätze der Engine (verbindlich)

1. **Bewegung trägt Lerninformation.** Jeder Moment hängt an einem Ereignis aus der Domäne (Urteil, Zustandswechsel, Schritt, Runde, Tag, Meilenstein). Kein Element bewegt sich ohne Ereignis. *Grund:* Schmückende Zusatzreize („seductive details“) senken das Lernergebnis (Metaanalyse 58 Studien, g = −0,33) [Q: Sundararajan & Adesope 2020]. Gestaltung, die Inhalt angenehmer macht, ohne abzulenken („emotional design“), verbessert dagegen Behalten (d = 0,39) und Transfer (d = 0,33) [Q: Brom et al. 2018].
2. **Zwei Klassen Bewegung.** *Bedienbewegung* (Übergänge, Rückmeldung) ist wahrgenommen ≤ 300 ms (t95, siehe §3.1), blockiert nie und folgt Kap. 4.4. *Momente* (Runde, Tag, Aufstieg) dürfen bis 1,2 s laufen (EE1), sind ab 300 ms bedienbar, mit einem Tipp übersprungen und höchstens einer je Bildschirm.
3. **Intensität folgt Bedeutung.** Stufe 1 jede Antwort (Farbe, Linie, Licht) · Stufe 2 Zustandswechsel (Punkte, Funken) · Stufe 3 Runde/Tag (Zahlen, Ring) · Stufe 4 Aufstieg (eigene Karte). Höhere Stufen sind seltener. Kein Konfetti-Regen (Kap. 4.6): höchstens 16 Funken, nur in Stufe 2 und 3.
4. **Compositor zuerst.** Bewegung über `transform`, `opacity`, `clip-path` per CSS/WAAPI, nicht über rAF-getriebene Einzelwerte. Grund: läuft auch mit ausgelastetem Hauptthread und ist von der iframe-Drosselung nicht betroffen (I9) [E: am Gerät prüfen].
5. **Erwachsen.** Kein Maskottchen, keine Cartoons, keine Sterne-Regen. Referenz: Apple Fitness (Ringe, Licht), Things (Häkchen), Linear (Tempo), Speak (ruhige Rückmeldung).
6. **Handy zuerst, Laptop breiter.** Jeder Moment ist für 390 px gebaut; ab 1.024 px nutzen Reise und Wort-Himmel die Breite (I7).
7. **Ein Schalter für alles.** Qualitätsstufe `full · calm · off` je Gerät; `prefers-reduced-motion` erzwingt `off` für Bewegung (nur Überblendung ≤ 150 ms). Nie langsamer bei reduzierter Bewegung (LP2 §7).
8. **Gemessen, nicht geschätzt.** Jeder Moment misst seine Bildrate und schreibt sie in die Diagnose (§9.4). Kein Moment geht ohne Budget (§9.1) und Test (§9.5) live.

## 2 Architektur

### 2.1 Schichten

```
Ebene 0  Lichtfeld        <AmbientLight/>  ein Canvas 2D, 1/6 Auflösung, fest hinter allem      (§5.1)
Ebene 1  Inhalt           Bildschirme, Karten, Übungen (bestehende Layers.tsx)
Ebene 2  Effekte          <FxLayer/>       ein Canvas 2D über allem, pointer-events:none, nur bei Bedarf eingehängt (§5.2)
Ebene 3  Momente/Overlay  <MomentHost/>    Aufstieg, Tagesabschluss-Licht; Blätter (bestehend)
Ton      Synth            platform/sound.ts v2 (§6)
Takt     Dirigent         engine/fx/director.ts – nimmt Lernereignisse an, wählt Moment nach Stufe und Budget
```

### 2.2 Lernereignisse und Dirigent (`src/engine/fx/`, neu)

```ts
// engine/fx/events.ts – die einzige Schnittstelle zwischen Lernlogik und Erlebnis
export type FxArea = 'words' | 'grammar';
export type LearnEvent =
  | { k: 'verdict'; v: 'ok' | 'near' | 'wrong' | 'dontKnow'; el: Element | null; area: FxArea }
  | { k: 'stateUp'; unit: 'word' | 'pattern'; from: UnitState; to: UnitState; el: Element | null; label: string }
  | { k: 'step'; step: 1 | 2 | 3 | 4; done: number; total: 4 }
  | { k: 'round'; facts: RoundFacts }          // aus SessionEnd mode="growth" (LP2 §4.5)
  | { k: 'day'; facts: DayFacts }              // aus DoneCard (LP2 §5.10)
  | { k: 'milestone'; id: MilestoneId; text: string; evidence?: string[] }; // c1-programm §3.3
export function emit(e: LearnEvent): void;

// engine/fx/director.ts
export type FxLevel = 'full' | 'calm' | 'off';
export function useFxLevel(): FxLevel;          // localStorage lx:fx > reduced motion > Low-Power-Heuristik (§9.3)
export function useMoment(kind: LearnEvent['k']): { playing: boolean; skip(): void };
// Regeln: höchstens ein Urteil je 300 ms (ersetzt die Sperre in haptics.ts:24-41, 63-70); Ton, aria-live-Text
// und Effekt kommen aus EINER Stelle; Stufe 'off' spielt nur den Endzustand.
```

- `Verdict` (LP2 §4.3) ruft `emit({k:'verdict'})`. `KineticGap.tsx:69-73` und `Choices.tsx:27-31`, `:46-48` rufen Ton und Vibration nicht mehr selbst (I10).
- `stateUp` entsteht rein in der Domäne: `src/domain/moments/detect.ts` vergleicht den Stand vor und nach einer Buchung (Stufe/`UnitState` aus `domain/metrics`, Musterwert aus `pats`, LP2 §8). Rein, mit Unit-Tests, schreibt nichts.
- Meilensteine leitet `detect.ts` aus den Daten ab (c1-programm §3.3: „Den Tag des Erreichens leitet die App aus den Daten ab“). „Schon gezeigt“ merkt sich das Gerät (§11).

### 2.3 Dateien

| Datei | Inhalt | Größe min. [E] |
|---|---|---|
| `src/ui/motion.ts` (erweitert) | Feder-Tokens §3.1, Varianten `itemEnter`, `resultEnter`, `cardOut/In` | +1 KB |
| `src/styles/index.css` (erweitert) | CSS-Federn als `linear()`, Moment-Klassen, Tokens §8 | +3 KB |
| `src/engine/fx/events.ts`, `director.ts`, `level.ts` | Ereignisse, Dirigent, Qualitätsstufe, Bildraten-Messung | 3 KB |
| `src/engine/fx/FxLayer.tsx` | Funken-Canvas | 2,5 KB |
| `src/engine/fx/AmbientLight.tsx` | Lichtfeld | 1,5 KB |
| `src/ui/Odometer.tsx` | rollende Ziffern | 1,5 KB |
| `src/ui/DayRing.tsx` | Tagesring 4 Teile (ersetzt `ProgressRing` für Heute) | 2 KB |
| `src/ui/CardStack.tsx` | Kartenstapel + Wischen mit Fingerfolge | 2,5 KB |
| `src/ui/moments/LevelUp.tsx`, `Emblem.tsx` | Aufstieg, 7 Kapitel-Embleme als SVG | 3 KB + 3 KB SVG |
| `src/features/grammar/journey/JourneyMap.tsx` | C1-Reise | 6 KB |
| `src/features/vocab/atlas/WordSky.tsx` | Wort-Himmel | 5 KB |
| `src/engine/SentenceMorph.tsx` + Player | Struktur-Film (c1-programm §6) | 5 KB (+45 KB Daten `anim.json`, dort budgetiert) |
| `src/platform/sound.ts` (v2) | Synth mit Hüllkurven, Lautstärke, Kompressor | +2 KB |
| `src/domain/moments/detect.ts` | Ereignisse aus Vorher/Nachher | 1,5 KB |
| **Summe** | | **≈ 42 KB min. (≈ 13 KB gzip)**, `dist` 4,81 MB → ≈ 4,85 MB |

Keine neue Bibliothek. framer-motion 13.4.4 bleibt (bereits 135 KB min. im Bundle, `leistung.md:129`). Optional als Ausgleich: `LazyMotion` + `m` mit Feature-Paket statt `motion` in den 50 Dateien senkt die Grundlast laut Motion-Doku auf < 5 KB plus Feature-Paket [Q]; das ist reines Aufräumen und kein Teil dieses Plans.

## 3 Bewegungssystem

### 3.1 Feder-Tokens (ersetzen `ui/motion.ts:4-7` schrittweise)

Federn werden wie bei Apple über **wahrgenommene Dauer und Federung** angegeben, nicht über Steifigkeit/Dämpfung [Q: WWDC23 „Animate with springs“: Federung 0 als Standard, über 0,4 „zu übertrieben für UI“]. framer-motion kann das direkt (`{ type:'spring', visualDuration, bounce }`) [Q], und `spring(visualDuration, bounce).toString()` aus `motion-dom` liefert dieselbe Kurve als CSS-`linear()` (`node_modules/motion-dom/dist/es/animation/generators/spring.mjs:377-381`). CSS-`linear()` kann Safari ab 17.2 [Q]. Damit laufen dieselben Federn in framer **und** als reines CSS auf dem Compositor.

Werte mit `motion-dom` 13.4.4 berechnet [M] (t95 = Zeit bis 95 % des Wegs; Ende = Zeit bis zur Ruhe):

| Token | `visualDuration` / `bounce` | t95 | Ende | Überschwingen | Wofür |
|---|---|---|---|---|---|
| `snap` | 0,18 / 0 | 164 ms | 400 ms | 0 % | Drücken, Schalter, Reiter-Pille, Segmente (ersetzt 520/40/0,9 mit t95 176 ms) |
| `glide` | 0,28 / 0 | 254 ms | 550 ms | 0 % | Bildschirm- und Kartenwege, gemeinsame Elemente |
| `settle` | 0,32 / 0,2 | 208 ms | 600 ms | 1,5 % | Karte landet, Baustein rastet ein, Lösung in der Lücke |
| `pop` | 0,24 / 0,3 | 134 ms | 400 ms | 4,6 % | nur kleine Dinge ≤ 32 px: Punkte, Häkchen, Ziffern, Buchstaben |
| `sheet` | 0,36 / 0,08 | 286 ms | 550 ms | 0 % | Blätter (ersetzt 520/42 in `sheetDrag.tsx:48`) |
| `ring` | 0,6 / 0,1 | 462 ms | 800 ms | 0,1 % | Ringe füllen, Ziffern rollen (nur Momente) |
| `morph` | 0,45 / 0,15 | 318 ms | 800 ms | 0,6 % | Struktur-Film: Wörter wandern |

- Bedienbewegung nutzt nur `snap`, `glide`, `settle`, `pop`, `sheet` (t95 ≤ 286 ms → Kap. 4.4 „150–300 ms“ erfüllt). `ring` und `morph` nur in Momenten (EE1).
- Feste Dauern bleiben für Überblendungen: `--lx-dur-fast` 120 ms · `--lx-dur-base` 180 ms · `--lx-dur-slow` 260 ms (LP2 §7). Ausblenden immer schneller als Einblenden (aus 120 ms, ein 180 ms).
- Gestaffeltes Erscheinen: 30 ms je Element, höchstens 8 Elemente (danach alle gleichzeitig), nur beim ersten Öffnen eines Bildschirms je Sitzung.
- CSS-Form: `--lx-ease-settle: linear(…)` mit `--lx-t-settle: 600ms` im `@theme`, erzeugt beim Build aus denselben Zahlen (ein Skript `scripts/springs.mjs`, Ergebnis eingecheckt, damit der Build ohne Rechnen auskommt).

### 3.2 Elemente der Bedienbewegung

| # | Element · Wo | Spezifikation | Komponente / API | KB | Reduziert (`off`) | Abnahme |
|---|---|---|---|---|---|---|
| B1 | **Knopf-Druck** · alle `Button`, `IconButton` | Drücken `scale .97` (`snap`), Loslassen zurück; Hauptknopf zusätzlich innere Lichtkante oben (1 px, `--lx-edge`) und Schatten `0 8px 24px -12px var(--lx-accent)` (vorhanden, `Button.tsx:25`) | `Button.tsx:39` `whileTap` mit `snap` statt 150 ms | 0 | ohne Skalierung | Druckzustand ≤ 1 Bild nach `pointerdown` |
| B2 | **Leistenwechsel** „Prüfen → Weiter“ · `ActionBar` | Beschriftung wechselt per Überblendung 120 ms + 4 px y; Breite und Ort bleiben (R9); Freigabe „gedimmt → aktiv“ 160 ms Farbe, kein Federn | `ActionBar` Prop `labelKey` als `key` | 0,3 | nur Überblendung | Position ±0 px vor/nach (uxRules R9) |
| B3 | **Gemeinsames Element** · Heute-Karte → Übungskarte (vorhanden), neu: Pfad-Knoten → Themenblatt, Wort-Chip im Rundenende → Wortblatt, Ring-Teil → Schritt | Lage, Größe und Radius per FLIP mit `glide`; Inhalt der Quelle 80 ms aus, Ziel ab 60 ms ein | `armShared`/`useSharedTarget` (`shared.tsx:58-96`) auf `glide` umstellen, `transform` als ganzer String (Compositor) | 0,5 | kein Flug, Überblendung | `transitions.spec`: Flug in ersten Bildern, Ruhe nach ≤ 600 ms, ohne Tippen kein Flug |
| B4 | **Seiten und Reiter** · `Layers.tsx` | bleibt Deckkraft 150–180 ms ohne Transform (`Layers.tsx:19-23`, wegen `position:fixed` der Prüfen-Leiste) | unverändert | 0 | unverändert | unverändert |
| B5 | **Reiter-Pille** · `TabBar` | aktive Pille gleitet zum neuen Reiter (`layoutId`, `snap`); Symbol des neuen Reiters `scale .9 → 1` (`pop`) | `TabBar.tsx:46-53` | 0,4 | Pille springt | kein Querscrollen, axe 0 |
| B6 | **Lücke wächst** · `KineticGap` | bleibt (`KineticGap.tsx:176`), Feder auf `settle` | – | 0 | sofort | `perf.spec` Tippen p95 ≤ 20 ms |
| B7 | **Lösung gleitet in die Lücke** (LP2 §4.4 `reveal`) | eigene Eingabe `scale 1 → .72`, `y −0,9em`, Durchstreichung zeichnet sich (`clip-path inset(0 100% 0 0) → inset(0)`, 140 ms); danach Lösungsbuchstaben von rechts, 20 ms versetzt, `pop`; Breite folgt mit `settle`; Gesamt ≤ 520 ms | `KineticGap` Prop `reveal` | 1 | Endzustand sofort | Lösungstext in der Lücke, eigene Eingabe darüber lesbar, kein Layoutsprung außerhalb der Lücke |
| B8 | **Auswahl zieht zusammen** (Handy, LP2 §4.4 `collapse`) | übrige Optionen Höhe → 0 und Deckkraft → 0 (`glide`, 4 Elemente), gewählte und richtige bleiben stehen | `Choices` mit `layout` nur auf diesen 4 Knöpfen | 0,5 | ohne Höhenanimation | Urteil liegt danach im Bild (R2) |
| B9 | **Baustein** · `Tiles` | Antippen: Baustein hebt sich (`scale 1.04`, Schatten `--lx-elev-3`, `snap`), fliegt per Layout an den Platz (`glide`), landet (`settle`); andere weichen per Layout aus; Prüfen: Markierungen ✓/↔/✕ von links nach rechts, 40 ms versetzt, `pop`; ↔-Baustein zeigt einmal einen gestrichelten Umriss an seinem richtigen Platz (Deckkraft .6 → 0, 600 ms) | `Tiles.tsx:117-119` + Prop `hintSlot` | 1 | ohne Heben und Versatz | Vorrat und Zeile ändern Höhe nicht (R9), Prüfen-Knopf rutscht nie |
| B10 | **Kartenstapel** · Wörter-Runde, Grammatik-Runde, Fehler korrigieren | hinter der aktuellen Karte bis zu 2 Karten (`y +6/+12 px`, `scale .96/.92`, Deckkraft .55/.25; Anzahl = min(übrig, 2)); „Weiter“: alte Karte `x −28 px`, `rotate −1,5°`, Deckkraft 0 in 140 ms (aus), nächste rückt von hinten vor (`scale .96 → 1`, `y 6 → 0`, `settle`); beide höchstens 80 ms gleichzeitig sichtbar (05-ux §3.9); neue Karte ab Bild 1 bedienbar | `CardStack` (`AnimatePresence mode="popLayout"`, Inhalt der alten Karte ist eingefroren) | 2,5 | Überblendung 150 ms | Kartenwechsel Median ≤ 250 ms (LP2 §11 Nr. 7), nie ein Leerbild |
| B11 | **Wischen mit Fingerfolge** · Anki-Modus | Karte folgt dem Finger in x (Achse rastet nach 10 px), `rotate = x/20°` (max. 8°); ab 48 px blendet links „Nochmal“ (Fläche `--lx-wrong-soft`), rechts „Leicht“/Vorschlag (`--lx-ok-soft`) ein; Loslassen über 96 px oder > 500 px/s → Karte fliegt in Richtung aus (`glide`), sonst federt zurück (`settle`) | `CardStack` mit `touch-action: pan-y` nur auf der Karte; Entscheidung weiter über `classifySwipe` (`swipe.ts:17-29`) | in B10 | keine Fingerfolge, Geste wie heute | senkrechtes Scrollen bleibt; Test: 30 px senkrecht ohne Kartenbewegung |
| B12 | **Statuspunkte** ●●○○ · `ExerciseStatus` (LP2 §4.3) | neuer Punkt füllt sich `scale 0 → 1` (`pop`) mit Lichtring (Kontur `--lx-ok`, `scale 1 → 2.2`, Deckkraft .6 → 0, 360 ms); Zustandswort blendet über („Lernt → Sicher“, 120 ms) | `ExerciseStatus` liest `stateUp` | 0,6 | Punkt sofort voll | Punktzahl = `UnitState` (Invarianten-Test) |
| B13 | **Zählerzeile** „Karte 7/30“ · `ExerciseBar` | Ziffern rollen (`Odometer`, `snap`); Fortschrittsbalken füllt sich mit `snap`; bei erledigtem Schritt einmal Lichtlauf über den Balken (Verlauf `transparent → --lx-ok-soft → transparent`, 500 ms) | `ExerciseBar` + `Odometer` | in §4 | sofort | Zähler fällt nie (R4) |
| B14 | **Skelett → Inhalt** · alle Ladezustände | Überblendung 150 ms, Skelett-Schimmer 1,4 s (vorhanden, `index.css:688-695`); nie ein Leerbild dazwischen | vorhanden | 0 | Schimmer aus | kein Bild mit leerem Hauptbereich (I4) |

## 4 Momente (Choreografien)

Jede Zeitachse beginnt mit dem Ereignis (t = 0). „Bedienbar ab“ heißt: der Hauptknopf nimmt Tipps an. Ein Tipp irgendwo springt in den Endzustand. Farben aus §8.

### M1 · Richtig (`verdict ok`, Stufe 1, jede richtige Antwort)

| t | Was | Technik |
|---|---|---|
| 0 | Ton `ok` (wenn an); `role=status` „Richtig“ | `director` |
| 0–120 ms | Lücke/Option: Hintergrund → `--lx-ok-soft` | CSS-Übergang |
| 0–220 ms | Unterstrich der Lücke wird zur grünen Füllung von links nach rechts (`clip-path: inset(0 100% 0 0) → inset(0)`) | CSS, Compositor |
| 40–460 ms | **Lichtimpuls:** `::after` mit `radial-gradient(closest-side, var(--lx-glow-ok), transparent)`, `scale .6 → 1.5`, Deckkraft .5 → 0 | CSS-Keyframes, nur `transform`/`opacity` |
| 60–240 ms | ✓ im Urteil zeichnet sich (Pfad `stroke-dashoffset`, 180 ms) und springt (`pop`) | SVG |
| 80–260 ms | Buchstaben der Lücke: kleine Welle `y −3 px → 0`, 18 ms versetzt, `pop` (nur ≤ 16 Buchstaben) | CSS-Keyframes |
| ab 0 | **bedienbar** | – |

Ersetzt `lx-pulse` (`index.css:388`, `:698-708`). Größe ≈ 0,8 KB CSS. `calm`: ohne Welle und Licht. `off`: Farbe sofort.
**Abnahme:** Richtig ist in allen 4 Paletten × 3 Modi `--lx-ok` (LP2 §11 Nr. 6); Lichtimpuls liegt innerhalb der Karte (kein Überlauf, `overflow: clip` am Satz); Bildrate p95 ≤ 20 ms.

### M2 · Fast richtig (`verdict near`)

0–120 ms Gold-Fläche · 0–240 ms nur die abweichenden Buchstaben (`.lx-letter-off`, `index.css:424-429`) drehen sich `±6°`, zwei Schwingungen, und ihr Unterstrich zeichnet sich (160 ms) · Ton `near` · bedienbar ab 0. Kein Licht. **Abnahme:** nur markierte Buchstaben bewegen sich (DOM-Test über `data-letter`).

### M3 · Noch nicht (`verdict wrong`)

| t | Was |
|---|---|
| 0–320 ms | **sanftes Schütteln** nur des Antwortelements (Lücke, gewählte Option, Baustein): `translateX` 0 → −6 → 5 → −3 → 2 → 0 px (gedämpft), CSS-Keyframes |
| 0–120 ms | Fläche `--lx-wrong-soft`, Linie `--lx-wrong` |
| 0 | Ton `wrong`: tief und weich (§6), kein Summer |
| 340–860 ms | Lösung gleitet in die Lücke (B7) bzw. richtige Option wird grün (120 ms nach der eigenen, damit die Reihenfolge „deins, dann richtig“ lesbar ist) |
| ab 0 | bedienbar; das Ergebnis darunter wächst wie bisher (`resultEnter`, y −6 → 0, 220 ms) |

Nie die ganze Karte rot, nie Bildschirm-Wackeln. `off`: kein Schütteln, ✕ und Farbe. **Abnahme:** Schütteln verschiebt keine Nachbarelemente (nur `transform`); Gesamtdauer bis Lösung sichtbar ≤ 900 ms.

### M4 · Zustand steigt (`stateUp`, Stufe 2)

Auslöser: Wort Stufe/`UnitState` steigt (Neu → Lernt → Sicher → Fest) oder ein Muster wechselt die Klasse (LP2 `pats`). Höchstens einmal je Karte und Tag (wie der Stufenaufstieg, A7 02.10.).

| t | Was |
|---|---|
| 0–400 ms | Statuspunkt füllt sich (B12) |
| 120–760 ms | **12 Funken** (Fest: 16) aus der Mitte des Punktes: Startgeschwindigkeit 90–180 px/s, Winkel −150° bis −30° (nach oben), Schwerkraft 220 px/s², Lebensdauer 450–650 ms, Größe 2–3 px, Farben `--lx-spark-1/2` (§8), additiv (`globalCompositeOperation='lighter'` nur im Dunkelmodus) |
| 200–320 ms | Zustandswort überblendet, bei „Fest“ zusätzlich Chip „Fest“ mit `pop` |
| 0 | Ton `up` (§6) statt `ok` |

`FxLayer` (§5.2). `calm`: ohne Funken. **Abnahme:** Ereignis kommt genau dann, wenn `detect.ts` einen Wechsel meldet (Unit-Test mit Vorher/Nachher); Canvas wird 1 s nach dem letzten Funken entfernt (DOM-Test).

### M5 · Schritt fertig (`step`, Stufe 3, bis zu 4× täglich)

Beim Verlassen einer Pflicht-Runde: Rundenende (M6) zeigt oben den Mini-Tagesring (40 px), dessen Teil sich füllt (`ring`), danach Knopf „Weiter: Grammatik“. Zurück auf Heute ist der Ring schon im neuen Stand (keine Wiederholung derselben Animation; Kap. 15 „dasselbe dreimal“).

### M6 · Runde geschafft (`round`, `SessionEnd mode="growth"`, LP2 §5.4)

| t | Was |
|---|---|
| 0–180 ms | Karte erscheint (`settle` aus `y 12`, Deckkraft ab **0,6**, nie aus 0; I4) |
| 150–750 ms | **große Zahl** rollt hoch („+3 Wörter sicher“) mit `Odometer` (`ring`), Ziffern einzeln, Ton-Ticks (§6, höchstens 12) |
| 300–900 ms | Musterzeilen: Punkte wandern ●●○○ → ●●●○ (LP2 §5.4: 300 ms je Zeile, 60 ms versetzt, höchstens 6 Zeilen) |
| 500 ms | „Neu sicher …“ und Fehlerliste blenden ein (`itemEnter`, versetzt 40 ms) |
| ab 300 ms | bedienbar |

**Odometer-Spezifikation:** jede Ziffer ist eine Spalte 0–9 (`translateY(-n·1em)`, CSS-Übergang mit `--lx-ease-ring`), Tabellenziffern, Tausenderpunkt fest; Vorlesetext ist der Endwert (`aria-label`), die Spalten sind `aria-hidden`. Rollt nur, wenn sich der Wert seit dem letzten Anzeigen geändert hat (`sessionStorage lx:odo:<id>`). 1,5 KB.
**Abnahme:** Endwert = Selektor aus `domain/metrics` (LP2 Leitsatz 4); kein Wert „0“ als Zwischenbild bei `off`.

### M7 · Tag geschafft (`day`, Stufe 3, einmal täglich) – der Tagesring

**Gestalt (eigene Form, keine Kopie der Apple-Ringe):** ein Ring aus **4 Bogen** für die 4 Schritte (LP2 §2.3), Lücke zwischen den Bogen 8°, Spur `--lx-track`, Füllung `--lx-ok` mit Verlauf entlang des Bogens nach `--lx-ok-text`, runde Kappe mit kleinem Schatten (`0 0 4px rgba(0,0,0,.35)`, gibt Tiefe). Teilfüllung je Schritt = erledigter Anteil (z. B. 18/30 Karten) aus derselben Quelle wie „x von 4“ (R3).
- Heute (Tageskarte, LP2 §2.2): 56 px, Strich 7 px, Mitte „23 Min.“ in Tabellenziffern.
- Abschlusskarte (LP2 §5.10): 168 px, Strich 14 px, Mitte Häkchen bzw. die eine große Zahl.
- Laptop ≥ 1.024 px: 200 px links, Fakten rechts.

| t | Was |
|---|---|
| 0–150 ms | Abschlusskarte blendet über die Tageskarte (gemeinsames Element: der Ring bleibt am Ort und wächst von 56 auf 168 px, `glide`) |
| 120–580 ms | letzter Bogen füllt sich (`ring`) |
| 580–900 ms | **die 4 Lücken schließen sich** (8° → 0°, `glide`): aus vier Teilen wird ein Ring |
| 600–1.200 ms | Licht hinter dem Ring: radialer Verlauf `--lx-glow-ok`, `scale .9 → 1.15`, Deckkraft 0 → .5 → 0 |
| 640–1.240 ms | 16 Funken vom Ring nach außen (360°, Geschwindigkeit 60–140 px/s, ohne Schwerkraft, verglühen) |
| 700–960 ms | Häkchen zeichnet sich in der Mitte (260 ms) |
| 700 ms | Ton `day` (Akkord, §6) |
| 800–1.400 ms | große Zahl „+3 Wörter fest“ rollt; Wahrheitszeile blendet ein (`TodayScreen.tsx:299-304` Fakten) |
| 1.100 ms | Wochenstreifen: heutiger Kreis füllt sich (`pop`, `index.css:921-947`) |
| ab 300 ms | bedienbar; Ende 1,4 s |

**Technik:** SVG, 4 `<circle>` mit `pathLength=100`, `stroke-dasharray`/`-dashoffset` über CSS-Übergänge (Hauptthread-Malen, aber nur 168×168 px); Verlauf per `<linearGradient>` je Bogen (an der Bogensehne ausgerichtet, gut genug bei 90°-Bögen). Licht und Funken: CSS bzw. `FxLayer`. 2 KB.
**Geht der Moment am selben Tag noch einmal?** Nein: abgespielt wird er nur beim Übergang „offen → fertig“ in dieser Sitzung; beim späteren Öffnen steht der fertige Ring still (Kap. 2 Nr. 2: erledigt ist Zustand).
**Abnahme:** Bogen-Anteile = `pflicht`-Zustand (Widerspruchstest Kap. 12); 3 Modi × 390/1440 als Bildvergleich im Endzustand; p95 ≤ 20 ms während des Moments bei CPU 1×; LoAF > 50 ms: 0 bei CPU 4× (§9.5).

### M8 · Aufstieg (`milestone`, Stufe 4, selten)

Auslöser (aus c1-programm §3.3 und LP2 §2.7): Kapitel abgeschlossen (M1–M7), erster C1-Check (M8), 250/500/750 Wörter fest (M9–M11), C1-reif (M12), erstes Muster „Fest“. Höchstens ein Aufstieg pro Sitzung, weitere warten bis zum nächsten Öffnen.

**Aufbau (Handy, von oben):** Emblem (96 px) · Titel („Kapitel 1 geschafft“) · ein Satz „Abgeschlossen heißt …“ aus `program.json` · zwei eigene Belegsätze (aus den Fehlersätzen, die jetzt richtig sitzen) · Zahl (z. B. „18 von 18 Mustern sicher“) · ActionBar „Weiter“.

| t | Was |
|---|---|
| 0–200 ms | Abdunkeln (`--lx-scrim`, 200 ms), Karte `scale .94 → 1` (`settle`) |
| 150–750 ms | **Emblem zeichnet sich:** Kontur per `stroke-dashoffset` (600 ms), dann Füllung blendet ein (200 ms) |
| 650–1.050 ms | **Lichtlauf** über das Emblem: schräger Verlauf (`linear-gradient(105deg, transparent 40%, rgba(255,255,255,.55) 50%, transparent 60%)`) als Maske, `translateX −120 % → 120 %` |
| 700 ms | Ton `level` (§6) |
| 800–1.200 ms | Zahl rollt, Sätze blenden ein |
| ab 300 ms | bedienbar; Tipp neben die Karte schließt |

**Embleme:** 7 Kapitel + C1-reif als SVG-Monogramm (Kapitelnummer in einer Facettenform, eine Linienstärke, `currentColor` + Bereichsfarbe), je ≈ 400 Byte, von Hand gebaut. Kein Pokal, kein Stern.
**Abnahme:** wird je Meilenstein und Gerät genau einmal gezeigt (§11); Fokus springt auf „Weiter“, `Esc` schließt; axe 0.

## 5 Grafik

### 5.1 Lichtfeld (Hintergrund) · Entscheidung: Canvas 2D, nicht WebGL

**Wo:** hinter allen Reitern; in Übungen gedimmt auf 50 % und still (Fokus auf dem Satz).
**Bild:** drei weiche Lichtflecken auf `--lx-bg` – Bereichsfarbe (Heute `--lx-ok`/Akzent, Wörter violett `--lx-ch-cards`, Grammatik blau `--lx-ch-grammar`), Cyan, und ein dunkler „Schatten“-Fleck für Tiefe. Deckkraft dunkel 0,10–0,16, gedämpft 0,07–0,10, hell 0,05–0,08.
**Bewegung:** Flecken wandern auf Lissajous-Bahnen (Periode 40–70 s, Weg ≤ 12 % der Breite). **Nach einem Bildschirmwechsel oder Moment 12 s aktiv, dann Standbild** (EE3). Beim Reiterwechsel gleitet die Bereichsfarbe in 600 ms zur neuen (Überblendung der Farbe, nicht der Lage).

**Technik:** ein `<canvas>` in **1/6 der Bildschirmauflösung** (390×844 CSS-px → 65×141 Pixel), per CSS auf Vollbild gestreckt; das weiche Hochskalieren ergibt den Weichzeichner gratis. Zeichnen je Bild: drei `createRadialGradient` + `fillRect` auf 9.165 Pixeln (< 0,2 ms CPU [E]). Bildrate 24 fps reicht für so langsame Bewegung. Speicher: 65×141×4 Byte = 37 KB statt ≈ 12 MB für eine volle Ebene bei 3-facher Pixeldichte [M].
Ersetzt `body`-Verläufe mit `background-attachment: fixed` (`index.css:279-283`, LP2 §7 „Verlauf auf ein festes `::before`“). 1,5 KB.

**Warum nicht WebGL/Shader (Aurora, Gradient-Mesh)?**
- Der Stripe-Gradient-Mesh braucht ≈ 15 KB Code (Gradient.js 12,5 KB + MiniGL 2,7 KB) [Q]; ein eigener Shader ginge mit ≈ 4 KB. Größe ist also nicht das Problem.
- Das Problem sind Akku und Robustheit: WebGL-Kontexte gehen auf iOS verloren (Hintergrund, Speicherdruck) und müssen neu aufgebaut werden; das Kompilieren eines Shaders kann beim ersten Bild 20–50 ms stocken [E]; Bildvergleiche in Playwright werden unzuverlässig.
- Der sichtbare Unterschied bei 1/6 Auflösung und 10 % Deckkraft ist klein. Für die seltenen Momente (M7, M8) reicht CSS-Licht.
- **Entscheidung:** Canvas 2D. WebGL nur, wenn Emrah nach dem Test „mehr Tiefe“ will; dann als Ersatz in derselben Komponente (`AmbientLight` Prop `renderer: '2d' | 'gl'`), gleiche Budgets.

**Aus:** Stufe `off`/`calm`-Standbild, `document.hidden`, Übungen, Low-Power-Heuristik (§9.3). **Abnahme:** 0 rAF-Aufrufe 12 s nach dem letzten Ereignis (Test zählt rAF per Hook); Kontrast der Texte unverändert (Lichtfeld liegt unter `--lx-surface-solid`-Karten; axe misst Text auf Karten); Standbild in Bildvergleichen deterministisch (Startphase aus Tagesschlüssel).

### 5.2 Effekt-Ebene (`FxLayer`) für Funken

- **Ein** `<canvas>` `position: fixed; inset: 0; pointer-events: none; z-index: 55`, erst beim ersten Funken eingehängt, 1 s nach dem letzten entfernt (kein Dauer-rAF).
- Pixeldichte auf 2 gedeckelt (iPhone 3 → 2: 44 % weniger Pixel), höchstens 24 Teilchen gleichzeitig, jedes Teilchen ein 2–3 px Kreis mit weichem Rand (vorgerendertes 8×8-Sprite).
- API: `burst({ x, y, n, spread, speed, gravity, life, colors })`, Ursprung aus `el.getBoundingClientRect()`.
- 2,5 KB. **Abnahme:** im Leerlauf kein Canvas im DOM; 24 Teilchen in < 1 ms CPU je Bild bei CPU 4× (Messung im `fx.spec`).

### 5.3 Tagesring

Siehe M7. Ersetzt die Kreisliste in der Tageskarte nicht, sondern steht links neben „Als Nächstes: …“ (LP2 §2.2). `ProgressRing` (`ui/ProgressRing.tsx`) bleibt für einfache Ringe (Muster sicher 2/5 im Lernpfad, LP2 §2.4).

### 5.4 Deine C1-Reise (Grammatik-Reiter, Kopf des Lernpfads; c1-programm §6 „S1 Programmkarte“)

**Handy (390 px), von oben:**
1. Titel „Deine Reise zu C1“, darunter „Kapitel 3 von 7 · Muster sicher 41 von 130“.
2. **Karte, 520 px hoch, eigener senkrechter Bildlauf nur innerhalb der Karte? Nein** – die Karte ist Teil der Seite (kein Scroll im Scroll); sie zeigt 7 Stationen + Start (Einstufung) + Ziel (C1-reif) auf einer geschwungenen Route von unten nach oben.
3. **Tiefe:** Der Untergrund (Höhenlinien, 6 weiche SVG-Kurven, und Sternenstaub) liegt in einer Ebene mit `transform: perspective(900px) rotateX(22deg)`; die Stationen stehen aufrecht davor (Schatten auf den Untergrund). **Parallaxe:** Untergrund bewegt sich beim Seiten-Scrollen mit 0,4-facher Geschwindigkeit über `animation-timeline: scroll()` (CSS, Compositor; Safari ab 26, Chrome ab 115) [Q]; ohne Unterstützung steht er still.
4. **Stationen:** Kreis 44 px mit Kapitelnummer bzw. Emblem; Zustand: geschafft (gefüllt `--lx-ok`, ✓), aktuell (Bereichsfarbe, „Du bist hier“, Lichthof: Deckkraft .25 ↔ .6, 2,4 s, **3 Zyklen, dann still**), offen (Kontur). Daneben die Kurzzeile („Zukunft · 2/5 Themen“). Die Route zwischen geschafften Stationen ist durchgezogen grün, sonst gestrichelt `--lx-fg-subtle`. Check-Marken (Meilensteinprüfung) als kleine Fahnen.
5. **Ende der Route:** „C1-reif: etwa Frühjahr 2028“ als Zeitraum (c1-programm §4.5), erst ab 21 Tagen Daten.
6. **Erstes Öffnen am Tag:** die Seite scrollt die aktuelle Station ruhig in die Mitte (`scrollIntoView({behavior:'smooth', block:'center'})`), danach nie wieder an diesem Tag (`lx:journey-seen`).
7. **Antippen einer Station:** gemeinsames Element Station → Kapitelblatt (B3), dort Themen mit Ringen „Muster sicher n/m“.

**Laptop (≥ 1.024 px):** waagerechte Zeitleiste, 7 Spalten, Route von links nach rechts, darunter die Themen des aktuellen Kapitels (c1-programm §6).
**Daten:** nur abgeleitet (`GRAMMAR_PATH` in Kapitelreihenfolge, `program.json`, `pats`), nichts geschrieben. 6 KB.
**Abnahme:** jede Zahl aus `domain/metrics` (gleich wie Lernpfad-Liste); `off`: ohne Perspektive und Parallaxe, gleiche Information; Tastatur: Stationen sind Knöpfe in Reihenfolge; axe 0; kein Querscrollen bei 360 px.

### 5.5 Dein Wort-Himmel (Wörter › Atlas, ergänzt die Bänder aus `13-atlas`)

**Bild:** Alle 6.789 Atlas-Einträge (`src/content/atlas/atlas.json`, Feld `r` = Häufigkeitsrang) als Punkte auf einer **Sonnenblumen-Spirale** (Goldener Winkel 137,5°): Eintrag *n* (nach Rang sortiert) liegt bei Radius `c·√n`. Bei 342 px Breite: `c = 171/√6789 = 2,08 px`, Punktabstand ≈ 3,7 px, Punkte 2 px [M]. Häufige Wörter innen, seltene außen.
- **Kreis bei n = 4.500** (Radius ≈ 139 px, 81 % des Außenradius) = C1-Marke (Gesamtkonzept E1), beschriftet.
- **Zwei ehrliche Ebenen:** (a) ein weicher Schleier bis zum **geschätzten** Wortschatz aus dem letzten Wortschatztest („geschätzt 6.415, Test vom …“, gleiche Quelle wie die Zielkarte), (b) **helle Sterne** nur für Wörter, die als Karte wirklich geübt sind: Fest `--lx-ok` hell mit Glanz, Sicher `--lx-ok` 70 %, Lernt violett 60 %, Neu violett 35 %; alles andere `--lx-track`.
- **Antippen:** nächster Punkt (Raster-Suche in 16-px-Zellen) öffnet das Wortblatt (gemeinsames Element Punkt → Blatt); Doppeltipp zoomt ×3 auf die Stelle (Canvas wird in neuer Auflösung neu gezeichnet).
- **Bewegung:** beim Öffnen zeichnen sich die Ringe von innen nach außen (600 ms, `ring`), danach still; frisch „Fest“ gewordene Wörter seit dem letzten Besuch funkeln einmal (Liste aus `sessionStorage`/`localStorage`).
- **Technik:** Canvas 2D, ein Zeichengang, Punkte nach Farbe gebündelt (5 Füllfarben → 5 `fill()`-Aufrufe). Erwartet < 16 ms auf dem iPhone [E], gemessen im `fx.spec` (Grenze 50 ms bei CPU 4×). Atlas wird wie heute erst beim Öffnen geparst. 5 KB.
- **Laptop:** Himmel links (480 px), Bänder und Suche rechts.
**Abnahme:** Zahl leuchtender Sterne = Zahl der Atlas-Wörter mit Karte (gleiche Zahl wie „60 von 6.789“, `13-atlas`); Vorlesetext fasst zusammen („6.789 Wörter, 412 geübt, davon 96 fest“); Bildvergleich deterministisch.

### 5.6 Struktur-Film (Video-Ersatz; c1-programm §6)

Die Daten (`anim.json`, ≈ 140 Muster × 300 Byte) und die Abnahme stehen in c1-programm §6. Diese Engine liefert den **Spieler**:
- **Bühne:** Satz in `.lx-t-prompt`, jedes Wort ein Element; Schrittwechsel lässt Wörter per FLIP an ihren neuen Platz wandern (`morph`, 40 ms versetzt in Leserichtung), bewegte Wörter ziehen eine dünne Bahn (SVG-Pfad zeichnet sich 300 ms, verblasst 400 ms).
- **Kamera:** bei langen Sätzen (> Breite) skaliert die Bühne auf die betroffene Stelle (`scale ≤ 1.25`, `glide`), danach zurück.
- **Untertitel:** deutsche Bedeutung unter dem Satz, Signalwörter leuchten in `--lx-mark` (Lichtlauf 300 ms).
- **Steuerung:** ▶/❚❚, Schrittpunkte, „langsamer“ (0,75×), „noch einmal“; Sprachausgabe liest jeden Schritt (bestehend), ohne Ton bedienbar.
- **Wo:** Kapitelstart, erste Karte der Einführung (LP2 §5.3), Menü ⋯ „Zeig es mir“ im Ergebnis.
- 5 KB. `off`: Standbild je Schritt mit „Weiter“.

### 5.7 Symbole und Tiefe

Linien-Symbole bleiben (`ui/Icon.tsx`, 24er Raster, 1,75 px). Neu nur die 8 Embleme (M8). Keine Bilder, keine Illustrationen mit Figuren.

## 6 Ton-Design (WebAudio, keine Dateien)

**Grundlage:** `platform/sound.ts` (Oszillator, Freischaltung beim ersten Tippen, Standard aus). Version 2:
- **Klang:** zwei Sinus-Teiltöne (Grundton + Oktave mit −14 dB) und ein 6-ms-Rauschanschlag (Hochpass 2 kHz) für einen „gläsernen“ Anschlag; Hüllkurve Anstieg 6 ms, exponentieller Ausklang. Master: Tiefpass 6 kHz → `DynamicsCompressor` (−18 dB, Ratio 4) → Lautstärke.
- **Lautstärke:** Aus · Leise (−12 dB) · Normal; `app/profile.sound` bleibt der An/Aus-Schalter (`schemas.ts:125`), die Stufe liegt je Gerät in `localStorage lx:sound-vol`.
- **iPhone:** Freischalten nur in einer Nutzergeste (vorhanden, `sound.ts:59-72`); `AudioContext({ latencyHint: 'interactive' })`. Web Audio folgt am iPhone dem Stummschalter [Q: unmute-Projekt]. Das ist gewollt: Die App setzt `navigator.audioSession.type` **nicht** auf `playback`, damit UI-Töne nie Emrahs Musik unterbrechen und der Stummschalter gilt.
- **Kein Ton**, während die Sprachausgabe spricht (`speechSynthesis.speaking`), und nie beim Tippen einzelner Buchstaben.

| Klang | Wann | Töne (Hz) · Dauer · Pegel |
|---|---|---|
| `ok` | M1 | 784 → 1.175 (Quinte aufwärts, 70 ms Abstand) · 90 + 140 ms · −24 dBFS |
| `near` | M2 | 659 einzeln, leicht verstimmt (+8 cent) · 160 ms · −26 dBFS |
| `wrong` | M3 | 196 mit Tiefpass 900 Hz, weich · 200 ms · −24 dBFS (kein Summer, kein Rechteck) |
| `up` | M4 | 880 → 1.109 → 1.319 (Dur-Dreiklang aufwärts, 50 ms Abstand) · −24 dBFS |
| `tick` | Odometer | 2.400 · 4 ms · −34 dBFS, höchstens 12 je Sekunde |
| `card` | Kartenwechsel (nur Stufe `full`) | Rauschen, Bandpass 1,2 → 0,6 kHz · 120 ms · −36 dBFS |
| `day` | M7 | Akkord 523/659/784 + 1.047 nach 120 ms, 900 ms Ausklang · −22 dBFS |
| `level` | M8 | 392 → 523 → 659 → 784 (je 90 ms) + Akkord, 1,1 s · −22 dBFS |

2 KB. **Abnahme:** Unit-Test mit nachgebildetem `AudioContext`: Reihenfolge und Zahl der Oszillatoren je Klang, kein Ton vor der ersten Geste, kein Ton bei `speaking`; Emrah hört am iPhone einmal alle Klänge unter „Momente ansehen“.

## 7 Haptik (ehrlich)

- iPhone-Safari kennt `navigator.vibrate` nicht (`platform/haptics.ts:1-3`).
- Der Umweg über `<input type="checkbox" switch>` (Safari 17.4+, ein Tipp auf den Schalter gibt einen Tick) funktionierte laut Bibliothek `ios-haptics` von iOS 17.4 bis 26.4; **Apple hat ihn mit iOS 26.5 geschlossen** [Q]. 05-ux §3.9 hatte ihn noch als Experiment vorgeschlagen.
- **Entscheidung:** nicht bauen. `haptics.ts` bleibt für Android/Chrome. Am iPhone ersetzen die sichtbaren Momente (M1–M3) und der optionale Ton die Haptik.

## 8 Typografie, Farbe, Tiefe, Modi

### 8.1 Schrift

- **Inter Variable** bleibt die einzige Schrift: ein woff2 mit Achsen Gewicht 100–900 und optischer Größe (Inter 4 hat die Display-Schnitte als `opsz`-Achse) [Q], eingebettet 72,9 KB (97.251 Zeichen als data-URI) [M], `index.css:14-21`; `font-optical-sizing: auto` (`index.css:288`) schaltet ab etwa 32 px automatisch auf die engere Display-Zeichnung.
- **Rollen** wie LP2 §7, ergänzt um:

| Klasse | Größe / Zeile | Gewicht · Laufweite | Verwendung |
|---|---|---|---|
| `.lx-t-hero` | 64 / 0,95 (Handy 56) | 650 · −0,035 em · Tabellenziffern | **eine** Zahl im Tagesabschluss und Aufstieg |
| `.lx-t-display` | 44 / 1,05 (Handy 32) | 650 · −0,025 em · Tabellenziffern | eine große Zahl je Karte (LP2) |
| `.lx-t-prompt` | 24 / 1,55 | 500 · −0,01 em | jeder Übungssatz (LP2) |
| `.lx-t-meta` | 13 / 1,4 | 500 · +0,01 em · Tabellenziffern | Zähler, Status |

- **Nicht machen:** Gewicht animieren (verändert die Breite, Layoutsprung R9), Großbuchstaben über 13 px.
- **Prüfen:** ob der eingebettete Latin-Schnitt die Inter-Variante „l mit Fuß“ (`cv05`) enthält; wenn ja, nur in `.lx-t-prompt` und Lösungen einschalten (Verwechslung I/l in englischen Wörtern) [E].

### 8.2 Farbe (ergänzt LP2 §7, Bedeutungsfarben von keiner Palette überschrieben)

| Token | Dunkel | Gedämpft | Hell | Zweck |
|---|---|---|---|---|
| `--lx-glow-ok` | rgba(16,185,129,.45) | rgba(16,185,129,.35) | rgba(4,120,87,.22) | Lichtimpuls, Ring-Licht |
| `--lx-spark-1` / `-2` | #34d399 / #ecfdf5 | #4ade9f / #ecfdf5 | #047857 / #10b981 | Funken (hell: dunkler, damit sichtbar) |
| `--lx-area-words` | = `--lx-ch-cards` (#a78bfa) | = | = (#7c3aed) | Lichtfeld, Kante der Wörter-Übung |
| `--lx-area-grammar` | = `--lx-ch-grammar` (#60a5fa) | = | = (#2563eb) | Lichtfeld, Reise, Kante Grammatik |
| `--lx-light-a/b/c` | Bereich · #22d3ee · #000 | wie dunkel, Deckkraft −35 % | Bereich · #0891b2 · #fff | Lichtfeld-Flecken |

**Regel:** Grün (`--lx-ok`) gehört nur zu richtig/erledigt/Fest; Funken und Licht sind deshalb grün, nie Akzentfarbe. Gold nur für „fast richtig“. Rot nur für „Noch nicht“.

### 8.3 Tiefe (4 Ebenen)

| Ebene | Was | Token |
|---|---|---|
| 0 Grund | `--lx-bg` + Lichtfeld | – |
| 1 Fläche | Karten, Reihen (`.lx-card`, deckend) | `--lx-elev-1`: Lichtkante 1 px oben (`--lx-edge`) + `0 12px 32px -20px rgba(0,0,0,.55)` |
| 2 Aktiv | die aktuelle Übungskarte, gehobener Baustein | `--lx-elev-2`: Lichtkante + `0 18px 48px -18px rgba(0,0,0,.65)`; Karten dahinter (Stapel) `scale .96`, Deckkraft .55 |
| 3 Über allem | Blätter (Glas, 20 px Weichzeichner, `index.css:319-325`), Aufstieg | `--lx-elev-3`; Glas **nur** hier (05-ux §3.8 Nr. 3) |

Hell: Schatten mit `rgba(15,23,42,…)` und halber Stärke (wie `index.css:129`). Die Reiterleiste verliert ihren Weichzeichner (heute `backdrop-blur-[16px]`, `TabBar.tsx:64`; LP2 §2.1 „deckend“) – spart am iPhone Arbeit bei jedem Scrollbild.

### 8.4 Modi

Jeder Moment hat Werte für Dunkel, Gedämpft und Hell (Tabelle 8.2). Im Hell-Modus entfällt `lighter`-Mischung der Funken (würde auf Weiß verschwinden). Bildvergleich je Moment in allen drei Modi (§9.5).

## 9 Leistung und Qualität

### 9.1 Budgets

| Messgröße | Budget | Heute / Grundlage |
|---|---|---|
| Zusätzlicher Code | ≤ 45 KB min. (≈ 14 KB gzip) | §2.3: ≈ 42 KB |
| `dist/index.html` | ≤ 5,2 MB (LP2 §11 Nr. 9) | 4,81 MB (4.809.431 Byte) [M] |
| Bildrate in Momenten | 60 fps Ziel; p95 Bildabstand ≤ 20 ms bei CPU 1× (Chromium) | Tippen heute p95 16 ms (`leistung.md:79`) |
| Lange Bilder | 0 Long Animation Frames > 50 ms während eines Moments bei CPU 4× | LoAF ab Chrome 123 [Q] |
| Tipp → sichtbare Antwort | ≤ 100 ms (Druckzustand ≤ 1 Bild) | Prüfen → Ergebnis Median 34 ms (`leistung.md:66`) |
| Kartenwechsel bis bedienbar | Median ≤ 250 ms (LP2 §11 Nr. 7) | früher 515 ms (`leistung.md:68`) |
| Dauerläufer | kein rAF-Takt im Ruhezustand; Lichtfeld ≤ 12 s je Aktivierung, 24 fps | heute keiner |
| Canvas-Speicher | Lichtfeld ≤ 64 KB, `FxLayer` nur bei Bedarf, Pixeldichte ≤ 2 | – |
| Start | `lx:status` nicht langsamer als heute (perf.spec) | Lichtfeld startet nach `lx:status` (Leerlauf), Momente-Code lädt mit der App |

### 9.2 Gerätegrenzen (ehrlich)

- **60 statt 120 Hz:** Safari begrenzt Webseiten auf etwa 60 fps, auch auf ProMotion-Geräten; 120 Hz nur mit einem versteckten Safari-Schalter [Q]. Alle Federn sind für 60 fps ausgelegt.
- **iframe-Drosselung:** Im fremden iframe (claude.ai) läuft `requestAnimationFrame` bis zum ersten Tippen mit 30 fps [Q: WebKit r215070, Motion-Magazin]. Folge: Beim Öffnen läuft nur CSS-Bewegung (Ring-Einblenden, Lichtfeld-Start als CSS-Überblendung); rAF-Effekte (Funken, Lichtfeld-Bewegung) erst nach der ersten Geste.
- **Stromsparmodus:** Safari deckelt rAF auf 30 fps [Q: WebKit-Bug 202269]. Es gibt keine Schnittstelle, die den Modus meldet.

### 9.3 Qualitätsstufen und automatische Anpassung

| Stufe | Bedienbewegung | Momente | Funken | Lichtfeld | Ton |
|---|---|---|---|---|---|
| `full` | alle | volle Zeitachse | ja | 12 s bewegt | wenn an |
| `calm` (Standard) | alle | ohne Licht-Nachlauf, ≤ 600 ms | nur M7 | Standbild | wenn an |
| `off` | nur Überblendung ≤ 150 ms | Endzustand | nein | Standbild | wenn an |

*Hinweis:* EE3 setzt das Lichtfeld auf „Ruhig“; die Stufe `full` ist dann Emrahs Wahl.

- **Einstellung:** Einstellungen › Darstellung › „Effekte: Voll · Ruhig · Aus“ (`localStorage lx:fx`, je Gerät).
- `prefers-reduced-motion: reduce` erzwingt `off` für Bewegung (`MotionConfig reducedMotion="user"`, `Shell.tsx:142`, und `index.css:717-726` bleiben).
- **Low-Power-Heuristik:** Nach der ersten Geste misst `director` 30 rAF-Abstände; ist der Median > 25 ms (30-fps-Deckel), gilt bis zum nächsten Start `calm` und die Diagnose vermerkt es. Rein, testbar (`level.test.ts` mit vorgegebenen Abständen).

### 9.4 Messung am Gerät (weil die Tests kein WebKit haben)

Jeder Moment misst in seiner Laufzeit die rAF-Abstände und schreibt eine Zeile in `platform/diagnostics.ts`: „M7 Tag geschafft · 58 fps · längstes Bild 22 ms · Stufe calm“. Emrah sieht sie unter Einstellungen › Diagnose und kann sie kopieren (A2: genaue Klicks). Höchstens 20 Zeilen, nur im Speicher und im bestehenden Diagnose-Protokoll.

### 9.5 Tests

| Test | Inhalt | Wo |
|---|---|---|
| Unit | Feder-Tokens (t95 ≤ 300 ms für Bedien-Tokens), Odometer-Ziffernlogik, Ringgeometrie (Bogen-Anteile = Pflichtstand), Spiral-Lage des Wort-Himmels (deterministisch, Rang → Radius), `detect.ts` (Vorher/Nachher → Ereignisse), Low-Power-Heuristik, Ton-Folgen (nachgebildeter `AudioContext`) | `tests/unit/fx*.test.ts` |
| E2E `fx.spec.ts` | jeder Moment wird ausgelöst und setzt `data-moment` (`ok`, `near`, `wrong`, `up`, `round`, `day`, `level`); Bildsonde wie `transitions.spec.ts:16-40`: p95 ≤ 20 ms bei CPU 1×; `PerformanceObserver('long-animation-frame')`: 0 Einträge > 50 ms bei CPU 4×; `FxLayer` nach 1 s weg; 0 rAF 12 s nach Ruhe | Chromium 390 und 1440 px |
| E2E reduzierte Bewegung | `emulateMedia({reducedMotion:'reduce'})`: keine Transform-Änderung, Dauern ≤ 150 ms, Endzustände gleich | `fx.spec.ts` |
| Bildvergleich | Endzustand jedes Moments mit `lx:fx=off` (springt sofort ans Ende) in Dunkel/Gedämpft/Hell × 390/1440 px, `toHaveScreenshot` mit Schwelle 0,2 %; Reise und Wort-Himmel mit festem Datum | `fx-shots.spec.ts` (Projekt `matrix`, `04-technik.md:95`) |
| Kartenwechsel | Median ≤ 250 ms über 10 Karten, mit und ohne reduzierte Bewegung, kein Leerbild (Pixelprüfung des Kartenbereichs) | `fx.spec.ts` (LP2 §11 Nr. 7) |
| Plattform | `check:platform` unverändert grün: kein `Worker`, kein WASM, keine Ladeziele (`scripts/check-platform.mjs:25-39`); neue Warnschwelle 5,2 MB | Skript |
| Dauern-Wächter | Grep: keine Dauer > 0,3 s und kein `bounce > 0.4` außerhalb `ui/motion.ts` und der Moment-Liste (ersetzt den Grep aus 05-ux R10) | Unit |

Alle anderen E2E-Specs laufen mit `lx:fx=off`, damit Bewegung keine Wackler erzeugt (`fixtures.ts` setzt den Schlüssel per `addInitScript`). Das ist dieselbe Stufe, die Emrah wählen kann, also kein Test-Sondercode im Build.

## 10 Was nicht geht oder sich nicht lohnt (ehrlich, mit Zahlen)

| Technik | Zahlen | Urteil |
|---|---|---|
| **Echtes Video** | 720p mit 1,5–2,5 Mbit/s = 11–19 MB je Minute, als data-URI +33 % (c1-programm §6). Ein 6-s-Clip 540p mit 1 Mbit/s wäre ≈ 0,75 MB + 33 % ≈ 1 MB. | Größe allein ginge für wenige Clips, aber: jemand müsste sie produzieren; sie zeigen nie *Emrahs* Satz; Hell/Dunkel passt nicht; eingebettete Videos in Safari sind unzuverlässig [E]. **Nein.** Ersatz: Struktur-Film (§5.6). |
| **Lottie** | `lottie-web` 299 KB min./75 KB gzip, `lottie-web-light` 196 KB min./51 KB gzip [Q]; die volle Fassung nutzt `eval` (CSP-Risiko) | Braucht Animationsdateien aus After Effects, die niemand baut. Was Lottie hier zeigen würde (Häkchen, Ring, Abzeichen), kann SVG + CSS mit < 3 KB. **Nein.** |
| **Rive** (Duolingo-Figuren) | kleinste Web-Laufzeit `canvas-lite` 707 KB unkomprimiert (222 KB brotli), sonst 1,7–2,2 MB [Q]; WebAssembly muss kompiliert werden, ob die Artefakt-CSP das erlaubt, ist unbekannt | Duolingo nutzt Rive für Figuren mit Lippensynchronität [Q]. Für eine erwachsene App ohne Maskottchen kein Nutzen. **Nein.** |
| **three.js / 3D** | ≈ 600 KB min. [E] | 3D-Anmutung der Reise reicht mit CSS-Perspektive. **Nein.** |
| **WebGL-Dauerschleife im Hintergrund** | Code klein (≈ 4–15 KB) | Akku, Kontextverlust, Testbarkeit (§5.1). **Nicht jetzt.** |
| **120 Hz** | Safari ≈ 60 fps ohne versteckten Schalter [Q] | nicht beeinflussbar |
| **Vibration am iPhone** | Umweg geschlossen mit iOS 26.5 [Q] | **Nein** (§7) |
| **View Transitions API** | Safari ab 18, Chrome ab 111 [Q] | Wäre eine schlanke Alternative zum FLIP in `shared.tsx`. Das FLIP läuft aber und ist getestet; Wechsel erst, wenn es dort Probleme gibt. **Später.** |
| **Gewichtsanimation der Schrift** | – | verändert die Breite (R9). **Nein.** |

## 11 Daten

**Datenbank: keine Änderung.** Kein neues Dokument, keine neue Sammlung, kein neues Feld. Alle Momente lesen abgeleitete Werte aus `domain/metrics`, `pats` (LP2 §8) und `program.json` (c1-programm §7).

| Schlüssel (nur Browser-Speicher, Bequemlichkeit nach Kap. 3.1) | Inhalt | Wenn er fehlt |
|---|---|---|
| `lx:fx` | `'full' \| 'calm' \| 'off'` | Standard `calm` (bzw. `off` bei reduzierter Bewegung) |
| `lx:sound-vol` | `'low' \| 'normal'` | `normal`; An/Aus bleibt `app/profile.sound` |
| `lx:moments-seen` | Liste gezeigter Meilenstein-IDs, höchstens 200 | Meilenstein erscheint auf diesem Gerät noch einmal (harmlos) |
| `lx:journey-seen` | Tagesschlüssel des letzten Reise-Anflugs | Anflug erneut |
| `lx:odo:<id>` (sessionStorage) | zuletzt gezeigter Wert einer rollenden Zahl | rollt einmal mehr |

Jeder Zugriff über `src/platform/storage.ts` (ESLint-Regel, CLAUDE.md A8). Soll die Effekt-Stufe später auf allen Geräten gleich sein, wäre das ein optionales Feld `app/profile.fx`; **nicht empfohlen** (Handy und Laptop brauchen oft verschiedene Stufen).

## 12 Arbeitspakete

Aufwand: S ≤ ½ Tag · M ≈ 1 Tag · L 2–3 Tage · XL > 3 Tage (Bauzeit einer Sitzung inkl. Tests). Einordnung: E1–E4 gehören in Welle 1/2 von LP2 (P1 Fundament baut `ExerciseShell`/`Verdict`, an die E2 andockt); E6/E9 hängen an c1-programm (`program.json`, `anim.json`).

| Paket | Inhalt | Aufwand | Hängt an | Abnahme |
|---|---|---|---|---|
| **E1 Fundament** | Feder-Tokens (§3.1) in `motion.ts` und CSS, `engine/fx` (Ereignisse, Dirigent, Stufen, Messung), Ton v2, Einstellung „Effekte“, Diagnosezeile, `lx:fx=off` in Test-Fixtures | M | – | Unit grün; `check:platform` grün; keine sichtbare Änderung außer Einstellungen |
| **E2 Antwort-Momente** | M1–M3, B7 (Lösung gleitet), B8, B12, Ton/Vibration nur noch über `Verdict` (I10) | L | LP2 P1 `Verdict` | `fx.spec` M1–M3; R9 grün; Farben LP2 §11 Nr. 6 |
| **E3 Karten und Wege** | `CardStack` (B10), Wischen mit Fingerfolge (B11), B3 auf `glide`, B5, Bausteine B9 | L | E1 | Kartenwechsel Median ≤ 250 ms; `transitions.spec` grün; senkrechter Bildlauf unberührt |
| **E4 Zahlen und Ringe** | `Odometer`, `DayRing`, M5, M6, M7, `FxLayer` | L | LP2 P7 (Heute), P4 (`domain/metrics`) | Widerspruchstest Ring = Pflicht; Bildvergleich 3 Modi; Budget p95/LoAF |
| **E5 Lichtfeld** | `AmbientLight` (§5.1), Ablösung `index.css:279-283` | M | E1 | 0 rAF nach 12 s; Kontraste unverändert (axe 0) |
| **E6 C1-Reise** | `JourneyMap` (§5.4), Handy + Laptop | L | c1-programm `program.json`, LP2 P5 (Lernpfad) | Zahlen = Lernpfad; `off` ohne Perspektive; axe 0 |
| **E7 Wort-Himmel** | `WordSky` (§5.5) | M | Atlas (vorhanden) | Sternzahl = Atlas-Karten; Zeichnen ≤ 50 ms bei CPU 4× |
| **E8 Aufstieg** | `LevelUp`, 8 Embleme, `detect.ts`-Meilensteine, „Momente ansehen“ | M | E4, c1-programm §3.3 | je Meilenstein einmal; Fokus/Esc; axe 0 |
| **E9 Struktur-Film-Spieler** | §5.6 | L | c1-programm `anim.json` | Abnahme c1-programm §6 |
| **E10 Absicherung** | `fx.spec`, `fx-shots.spec`, Dauern-Wächter, Aufräumen von `lx-pulse` | M | E2–E8 | volle Suite grün, ux-reviewer eine Runde (A2) |

**Reihenfolge für den ersten sichtbaren Test-Link:** E1 → E2 → E3 → E4 (das sind die Momente, die Emrah jeden Tag sieht). Danach E5, E8, E6, E7, E9.

## 13 Abnahme gesamt

1. Alle acht Momente spielen auf dem Test-Link am iPhone unter „Momente ansehen“; Emrah schickt die Diagnosezeilen. Ziel: ≥ 55 fps im Mittel, kein Bild > 50 ms [Gerät].
2. Jede Bewegung hängt an einem Ereignis aus §2.2 (Code-Review: kein `animate`/`motion.*` mit Endlosschleife außer Lichtfeld ≤ 12 s und Lichthof ≤ 3 Zyklen).
3. Bedienbewegung t95 ≤ 300 ms, Momente ≤ 1,4 s und ab 300 ms bedienbar (EE1).
4. Kartenwechsel Median ≤ 250 ms, nie ein Leerbild (I4, LP2 §11 Nr. 7).
5. Reduzierte Bewegung: nur Überblendung ≤ 150 ms, alle Informationen gleich.
6. Budgets §9.1 eingehalten; `dist` ≤ 5,2 MB; `check:platform` grün; perf.spec Start nicht langsamer.
7. Datenbank unverändert (data-guard: keine neuen Pfade/Felder).
8. axe 0 in allen drei Modi und beiden Sprachen; Vorlesetexte für Ring, Odometer, Reise, Himmel.

## 14 Risiken

| Risiko | Gegenmittel |
|---|---|
| **Zu viel Effekt lenkt vom Lernen ab** (seductive details, g = −0,33 [Q]) | Leitsatz 1 und 3: Effekte nur an Ereignissen, Funken nur bei Zustandswechsel; Standard `calm`; Emrah urteilt nach „Momente ansehen“. |
| **Abweichung von LP2 §1 Nr. 6 / Kap. 4.6** (300-ms-Grenze, „kein Konfetti“) | EE1 und EE4 ausdrücklich zur Entscheidung; Funken ≤ 16, kein Regen; Bedienbewegung bleibt ≤ 300 ms. |
| **Ruckeln am iPhone, das die Tests nicht sehen** (nur Chromium) | Compositor zuerst (Leitsatz 4), Messzeile am Gerät (§9.4), Low-Power-Heuristik. |
| **Akku** | kein Dauer-rAF; Lichtfeld 1/6 Auflösung und ≤ 12 s; Canvas nur bei Bedarf; Reiterleiste ohne Weichzeichner. |
| **Wackelnde Tests durch Animation** | alle bestehenden Specs mit `lx:fx=off`; Bewegungstests nur in `fx.spec` mit Wartebedingungen statt `waitForTimeout` (`04-technik.md:95`). |
| **Wischen mit Fingerfolge stört den Bildlauf** | Achsen-Rasterung nach 10 px, `touch-action: pan-y` nur auf der Karte, Ausnahmen aus `swipe.ts:30` bleiben. |
| **Ton nervt oder kollidiert mit Sprachausgabe** | Standard aus, Stummschalter gilt, kein Ton während `speaking`, höchstens ein Ton je Prüfen. |
| **Wort-Himmel wirkt leer** (wenige Atlas-Wörter als Karte) | zwei Ebenen: Schleier „geschätzt bekannt“ aus dem Wortschatztest + helle Sterne für Geübtes; Beschriftung mit beiden Zahlen. |
| **Umfang** | 10 Pakete, sichtbarer Nutzen nach E1–E4; keine Neuplanung ohne Blocker (A2). |

## 15 Quellen

**Repository:** `src/styles/index.css`, `src/ui/motion.ts`, `src/engine/KineticGap.tsx`, `src/engine/shared.tsx`, `src/engine/Choices.tsx`, `src/engine/Tiles.tsx`, `src/engine/swipe.ts`, `src/ui/ProgressRing.tsx`, `src/ui/SessionEnd.tsx`, `src/ui/Button.tsx`, `src/app/shell/Layers.tsx`, `src/app/shell/Shell.tsx`, `src/app/shell/TabBar.tsx`, `src/features/today/TodayScreen.tsx`, `src/features/vocab/TrainerScreen.tsx`, `src/features/grammar/SessionScreen.tsx`, `src/platform/sound.ts`, `src/platform/haptics.ts`, `scripts/check-platform.mjs`, `tests/e2e/transitions.spec.ts`, `tests/e2e/perf.spec.ts`, `docs/neubau/leistung.md`, `docs/umbau/lernplattform-2.md`, `docs/umbau/c1-programm.md`, `docs/umbau/05-ux-ist-und-ziel.md`, `docs/umbau/04-technik.md`, `node_modules/motion-dom/dist/es/animation/generators/spring.mjs`. Bildschirmfotos: Scratchpad `audit/shots/` (u. a. `01-heute--handy-dark-de.png`, `03-trainer-0-mc_en-richtig--handy-dark-de.png`, `08-gr-gap-1-falsch--handy-dark-de.png`, `09-grammatik-ende--handy-dark-de.png`, `13-atlas--handy-dark-de.png`, `23-heute-fertig--handy-dark.png`) und `audit/L01-heute-laptop.png`, `audit/L03-grammatik-aufgabe-laptop.png`.

**Extern:**
- Apple, WWDC23 „Animate with springs“: https://developer.apple.com/videos/play/wwdc2023/10158/ · Zusammenfassung: https://wwdcnotes.com/documentation/wwdc23-10158-animate-with-springs/
- Motion, Federn mit `visualDuration`/`bounce`: https://motion.dev/docs/react-transitions · Hardware-Beschleunigung: https://motion.dev/docs/performance · Bundle verkleinern: https://www.framer.com/motion/guide-reduce-bundle-size/
- CSS `linear()` (Safari 17.2): https://developer.chrome.com/docs/css-ui/css-linear-easing-function
- rAF-Drosselung in fremden iframes: https://trac.webkit.org/r215070 · https://motion.dev/magazine/when-browsers-throttle-requestanimationframe
- Stromsparmodus 30 fps: https://bugs.webkit.org/show_bug.cgi?id=202269
- Safari 60-fps-Grenze auf ProMotion: https://www.iphone-ticker.de/promotion-im-web-freischalten-so-nutzt-safari-die-volle-bildrate-271471/
- Haptik-Umweg und Ende mit iOS 26.5: https://unpkg.com/ios-haptics@3.1.1/README.md · https://azukiazusa.dev/en/blog/ios-safari-web-haptics
- Web Audio und Stummschalter am iPhone: https://github.com/swevans/unmute
- View Transitions (Safari 18): https://developer.chrome.com/docs/web-platform/view-transitions
- Scroll-gebundene Animationen in Safari 26 [S, Sekundärquelle]: https://www.buildmvpfast.com/blog/css-scroll-driven-animations-replace-js-2026
- Long Animation Frames API: https://developer.chrome.com/docs/web-platform/long-animation-frames
- Rive Laufzeit-Größen: https://rive.app/docs/runtimes/runtime-sizes.md · Duolingo und Rive: https://rive.app/blog/duolingo-s-ai-powered-video-call-brings-lily-to-life
- Lottie-Größen [Sekundärquelle]: https://depscope.dev/pkg/npm/lottie-web
- Stripe-Gradient (MiniGL) Quellgrößen: https://huggingface.co/spaces/moh1456/nim/tree/main/stripe-gradient-animation/src
- Inter 4 mit `opsz`-Achse: https://github.com/rsms/inter/releases
- Seductive details, Metaanalyse (g = −0,33): https://news.wsu.edu/press-release/2020/03/19/seductive-details-inhibit-learning/
- Emotional design, Metaanalyse Brom et al. 2018: https://artemis.ms.mff.cuni.cz/main/papers/emodesign_manuscript_1rev_180928_FINAL_norev.pdf
- Ziel-Gradient (Anstrengung steigt nahe am Ziel; Grund für sichtbare Teilfüllung des Rings): https://business.columbia.edu/faculty/research/goal-gradient-hypothesis-resurrected-purchase-acceleration-illusionary-goal
- Juicy design, Rahmenmodell (Hicks et al. 2018): https://dl.digra.org/index.php/dl/article/view/936
- Zeitpunkt korrigierender Rückmeldung (kein klarer Vorteil für verzögert; sofortige Rückmeldung in der Übung bleibt): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9995700/
