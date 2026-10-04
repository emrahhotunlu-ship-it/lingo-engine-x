# 05 · UX-Ist-Aufnahme und Zielentwurf der Bedienung

Stand 04.10.2026 · Rolle ux-reviewer (nur Bilder, Messung und Lesen; kein Quellcode geändert) · Code `31a5975`, `dist/index.html` 13:28.
Bilder: `/tmp/claude-0/-home-user-lingo-engine-x/fc49be48-ccd3-5daa-ba60-72e3e74ab73c/scratchpad/ux-ist/` (103 PNG, **nicht** im Repository; Messdaten `_meta.jsonl` dort). Bildnamen unten ohne Pfad.
Abhängigkeiten: `03-lernmodell.md` (Zustände, Invarianten, Fortschritt K1–K8, Wiedereinstieg), `02-lehrplan.md` (Atlas, Einstufung), `04-technik.md` (Zuschnitt, Glossar, `domain/metrics`).

## 0 Kurzfassung

**Urteil:** Die Oberfläche *sieht* hochwertig aus (Dunkel und Hell auf den Bildern vollwertig, Gedämpft per axe; axe: 0 Verstöße in 12 Kombinationen; ruhiger Abschluss ohne Konfetti; Tipp-Leiter und Rückmeldung grün/gold/rot stimmen mit Kap. 4). Sie *verhält* sich aber noch nicht wie ein Produkt aus einem Guss: Zahlen widersprechen sich, derselbe Inhalt steht zwei- bis dreimal auf einem Bildschirm, der Hauptknopf rutscht nach einem Fehler unter die Falte, Begriffe wechseln je Bildschirm, und „Fortschritt“ misst noch Lesen, Hören, Schreiben, Sprechen. Das deckt sich mit Emrahs „nicht logisch · überladen · keine klare User Journey“.

**Zielbild in sechs Sätzen**
1. Vier Reiter, vier Wörter: **Heute · Wörter · Grammatik · Fortschritt**. Titel = Reiter (nie „Üben“ unter „Grammatik“).
2. Heute = **eine** Karte mit vier Schritten und **einem** Knopf, der den nächsten Schritt benennt. Alles andere (Sprechen, Wochen-Check, Wochenbericht, Serie) wandert in Extra, Fortschritt oder in den Kartenfuß.
3. Jede Übung hat denselben Rahmen: Status · Aufgabe (ein Satz, nennt Thema/Wort) · Inhalt · **feste Aktionsleiste unten** mit genau einem Knopf. Nie unter der Falte, nie wandernd.
4. Jede Zahl hat einen Namen, eine Definition, eine Quelle (`03` Invariante 1). Zähler laufen nur vorwärts (fester Nenner; Wiederholungen separat).
5. Fortschritt zeigt **eine** große Zahl je Säule (Wörter auf dem Weg zu 8.000 · Grammatikthemen sicher) und alles andere eingeklappt.
6. Ruhiges Premium: Hauptknopf und Bildschirmwechsel fühlen sich gleich an, Leerzustände sagen den nächsten Schritt, Abschluss ist ein Zustand (Häkchen + eine Zahl), nie ein Feuerwerk.

## 1 Methode, Belege, Grenzen

- **Aufnahme:** `dist/index.html` im Produktions-Build, Entwicklungs-Adapter von außen (`tests/e2e/fixtures.ts` `boot`), Chromium 390×844 @2×, Touch, **Handy-Modus an**, Deutsch, **Standard-Farbthema Salbei** (die Fixture erzwingt sonst „Ozean“: blaue Knöpfe wären nicht Emrahs Bild). Dunkel durchgehend, **Hell** für Heute, Wortschatz, Trainer (Frage, Ergebnis), Anki-Rückseite, Fortschritt, Einstellungen, Grammatik; **Gedämpft** nur über axe (ohne Bilder). Montag über `now`, Erststart über `seed:'empty'`, Wiedereinstieg über `now` = 04.10. (14 Tage nach dem letzten Seed-Tag). Temporäre Specs sind gelöscht.
- **Messung je Bild:** Zahl sichtbarer Hauptknöpfe (`button.bg-accent`), Zielgrößen < 44 pt, Dokumenthöhe; dazu axe (WCAG 2.0/2.1 A/AA) für Heute, Wortschatz, Trainer-Frage, Fortschritt × Dunkel/Gedämpft/Hell.
- **Grenzen (ehrlich):** (1) Kein WebKit: Blur, Bildschirmtastatur, Haptik und Schriftdarstellung auf dem iPhone sind **nicht** geprüft. (2) Bildschirmtastatur nur über verkleinerte Höhe (844 → 510 pt) nachgebildet. (3) Der Entwicklungs-Adapter liefert **Platzhalter-Inhalte** (Beispielsätze mit eingesetztem Zielwort, „to keep up“ als Übersetzung): Inhalte und KI-Qualität sind **nicht** beurteilt. (4) In der Emulation meldet Chromium einen feinen Zeiger; das Tastaturfeld unter den Bausteinen (`T4-tiles-frage`) erscheint auf dem iPhone vermutlich nicht. (5) Englisch und 1440/2560 px sind nicht aufgenommen (Auftrag: Deutsch, Handy). (6) Ladezeit/Ruckeln nicht gemessen (siehe `04-technik.md` §7).
- Nicht jedes der 103 Bilder ist ein eigener Zustand: `b`-Bilder sind Vollseiten-Fassungen (die feste Tab-Leiste steht darin mitten im Bild – Aufnahme-Effekt, kein Fehler).

## 2 Ist-Aufnahme

### 2.1 Befunde nach Schwere

Schwere: **H** bricht Kap. 2/4 oder Emrahs Kritik · **M** stört den Fluss · **N** Politur. Regel = Auftrag (Kap.) bzw. Fokus-Vorgabe 04.10.

| ID | Sev | Befund | Beleg (Bild · Datei:Zeile) | Regel |
|---|---|---|---|---|
| U-01 | H | **Drei Zahlen für einen Knopf.** Wortschatz-Hub: „51 Karten“ (Karte), „17 schon länger fällig“, Knopf „Pflicht: noch 29 von 29“; Heute (Sonntag) nennt 29, Montag 52 („Rückstand, der Rest morgen“). 4 Zahlen in einer Karte (51 · Neu 5 · Lernen 37 · Fällig 9) plus 3 Sätze Erklärung. | `B01`, `B01b`, `C11` (die Zahl 12 steht 5× in 8 Zeilen), `A01`, `A02` · `VocabHub.tsx:158-205` | Kap. 2.2 (Zähler, Untertitel, Klickziel gleich); Kap. 8 „eine große Zahl je Karte“ |
| U-02 | H | **Rundenzähler wächst mit jedem Fehler:** 1/4 → 2/5 (`C01`→`C03`), 1/5 → 2/6 → 3/7 → 4/8 → 5/9 (`T2b`, `T4`, `T5`). Der Balken wirkt wie rückwärts; mit vielen Fehlern endet die Runde „nie“. | `C01`, `C03`, `T2b`, `T4-tiles-frage`, `T5-mc_de-frage` · `vocab/session.ts:441-449` (`total = max(base+target, done+left)`) | Kap. 2.2; `03` Inv. 9 („sinkt nie“), Inv. 12 |
| U-03 | H | **Hauptknopf unter der Falte nach einem Fehler.** Ergebnis falsch ist 922–966 pt hoch (Schirm 844): „Weiter“ liegt 80–120 pt unter dem Rand; davor stehen 4–6 Nebenaktionen („Deutsch“ ×3, „Mehr Infos“, „Ich lag richtig“, „Einmal richtig schreiben“). Das Richtig-Ergebnis passt („Weiter“ bei ≈ 600 pt). Grammatik falsch: 959 pt, „Weiter“ nicht sichtbar. | `C02`/`C02b` (922), `D07`/`D07b` (959), `T2b` (966) vs. `T6-cloze-ergebnis` · `ExerciseView.tsx:836-845`, `learn/ui.tsx:178`, `GrammarItem.tsx:393-396` | Kap. 2.1 (ein großer Knopf); Kap. 4.5 |
| U-04 | H | **Fortschritt zeigt noch Lesen, Hören, Schreiben, Sprechen:** Liste „Fertigkeiten“ (Lesen B2 · Hören B2 · Schreiben B2 · Sprechen –), Can-Do-Liste mit Lese-/Hör-/Sprechpunkten, Stärke „Klare E-Mails“, Kopf „Kurs 6 von 24 Lektionen“, Fehler-Tab nennt „Preply“, Verlauf „aus der alten App“. | `E01b`, `E02b-fortschritt-path`, `E02-fortschritt-errors`, `E02-fortschritt-history` · `JudgeTab.tsx:177`, `assessment/types.ts:20`, `patterns.de.ts:7`, `stand.de.ts:36` | Fokus-Vorgabe 04.10.; `03` §5/§8 Nr. 7 |
| U-05 | H | **Fortschritt: dieselbe Größe mehrfach, widersprüchliche Wortschatz-Zahlen.** „B2“ 3× im Kopf (Karte „Niveau B2“, Skala, „Gesamtstufe B2“) plus 5× in der Fertigkeitsliste. „Gekonnt“ in sechs Fassungen: 146 Karten · „jetzt etwa 6.415“ · „erwartet gekonnt 120“ · „aktiv fest 12“ · „sichere Einträge 39“ · „gefestigt 12“. Prognose rechnet mit „19 neuen Wörtern pro Tag“, Einstellung sagt 5, Wortschatz-Hub sagt „nur 2“. | `E01`, `E01b`, `E02b-fortschritt-path`, `E02b-fortschritt-stats`, `F01`, `B01` | Kap. 2.2; Kap. 8; `03` Inv. 1, `04` §4 |
| U-06 | H | **Begriffs-Wildwuchs.** Reiter „Grammatik“ ↔ Titel „Üben“. Fortschritt = „Dein Stand“ = „Urteil“ = „Zahlen“. Wiederholen · Karten · Einträge · Wortschatz · Wörter. „Freie Runde“ · „Extra-Runde“ · „Runde“. Tageseinheit · Block · Schritt · Station. „Reparatur-Sätze“ ↔ „Fehler korrigieren“. „Hilfe:“ (Bedeutung) ↔ „Tipp“. | `D01` (Tab/Titel), `E01`, `B01`, `B03`, `D02`, `A01`, `D01` (Reparatur-Sätze) · `nbSh.de.ts:9` vs `learn.de.ts:28`, `LearnHub.tsx:176` | Prinzip „ein Wort pro Ding“; Kap. 2.2 |
| U-07 | H | **Grammatik-Reiter ist ein Sammelmenü ohne Pfad:** 18 Einstiege (Woche, Kurs-Karte mit **eigenem** Hauptknopf, Fehler, Reparatur, Grammatik, Fallen, Nachschlagen, 4 Kacheln, 6 Übungs-Zeilen, Lehrer-Feedback); Diktat und Sprint (Hören/Tempo) darunter. Das Thema („Wo stehe ich, was kommt als Nächstes?“) liegt zwei Ebenen tiefer (Tab → Üben → Grammatik → Thema → Blatt). | `D01`, `D01b`, `D02`, `D03` · `LearnHub.tsx:175-270`, `GrammarScreen.tsx:94-140` | Kap. 2.1 (rote Linie); Emrah „keine klare User Journey“ |
| U-08 | H | **Doppelt auf einem Bildschirm.** Serie 3× (Profil-Knopf, Unterzeile, Profil-Blatt); Wochenthema 2× direkt übereinander (Unterzeile + Kartentitel, `A01`/`A02`); richtiger Satz 3× im Ergebnis („finished“ in der Lücke, „Richtig: finished“, ganzer Satz, `D05`); Anki-Rückseite wiederholt die Vorderseite („Zugriffsrechte“ 2×, `G01`/`C13`); Übersetzung 3× (`X3`); „Daten/DATEN“, „Darstellung/DARSTELLUNG“ als Titel + Überschrift (`F01-5`). | genannte Bilder · `TopBar.tsx:20-36`, `TodayScreen.tsx:204,211,264`, `SheetHost.tsx:32` | Kap. 15 „dasselbe dreimal“; Kap. 8 |
| U-09 | H | **Bausteine: gelegte Bausteine werden so hoch wie der ganze Vorrat** (≈ 95 pt statt 44 pt, `D10`), der Vorrat lässt unsichtbare Lücken (m und y versetzt, `T4-tiles-ergebnis`), „Prüfen“ ist im Satzbau schon mit 2 von 5 Bausteinen aktiv (`D10`), bei Vokabel-Bausteinen ab dem ersten (Fehltipp prüft), „Tipp“ rutscht in eine neue Zeile, sobald „Neu legen“ erscheint. In Vokabel-Bausteinen gibt es **zwei** Orte (leere Lücke im Satz **und** gestrichelte Zeile darunter): gelegt wird in der Zeile, die Lücke spiegelt nur – die Eingabe liegt nicht in der Lücke. | `D09`→`D10`, `T4-tiles-frage`, `T4-tiles-ergebnis-richtig` · `Tiles.tsx:161,167`, `index.css:812-820` (`align-items/-content: stretch` + `minHeight`), `ExerciseView.tsx:870` (disabled nur ohne Baustein), `:540-548` | Kap. 4.1/4.2; Emrah „Bausteine sprangen“; `03` Inv. 11 |
| U-10 | H | **Heute: vier Dinge konkurrieren mit der Karte** – „Sprechen üben (freiwillig)“, „Extra · Wochen-Check nachholen“, „Dein Wochenbericht ist da“, dazu bis Montag die Bestätigung „Wochenthema“. Die Bestätigung (`A09`) nennt veraltet „Text, Wendungen, Aufgabe und Szene“ und trägt „Pflicht · 1 von 4“, obwohl sie keiner der vier Schritte der Karte ist (`A02` zeigt „0 von 4“). | `A02b`, `A09` · `TodayScreen.tsx:404-495`, `nbHeute.de.ts:67` | Kap. 2.1, 2.6 |
| U-11 | H | **Erster Start und Wiedereinstieg fehlen.** Leeres Konto zeigt „Serie 0“ **und** „Serie: 0 Tage“, kein Willkommen, „Wochen-Check · 12 Aufgaben“ bei leerem Konto (`A05`). Nach 14 Tagen Pause: dasselbe „Serie 0“, 31 Karten Rückstand, kein Wort der Entlastung (`A06`). | `A05`, `A06` · `TodayScreen.tsx:204`, `03` §2 „Wiedereinstieg“ (heute nicht vorhanden) | Kap. 7 (Serie dezent), Kap. 2.6 (nie als Vorwurf) |
| U-12 | H | **Anki-Aufdecken: das wandernde Ziel.** „Antwort zeigen“ ist der einzige Knopf, aber **sekundär** gezeichnet und mitten im Schirm (y ≈ 410 pt); nach dem Aufdecken stehen die vier Noten ganz woanders (y ≈ 660–720 pt). | `C12` → `C13`, `G01` · `anki/FlipCard.tsx:331` | Kap. 2.1; Kap. 4 (Fitts, Daumenzone) |
| U-13 | M | **Wörter-Hub überladen.** „Hinzufügen“ steht in einer **eigenen Zeile über** dem Titel (≈ 60 pt verschenkt); Karte mit 4 Zahlen; 13 Stapel mit je drei bunten Zahlen ohne Legende (die steht nur oben); Smaragd bedeutet hier „Fällig“, anderswo „erledigt/richtig“; Segment „Automatisch“ drückt gegen den Rand. | `B01`, `B01b`, `B04` · `VocabHub.tsx:129-135,171-182` | Kap. 8 (Akzent = erledigt/richtig); Kap. 15 |
| U-14 | M | **Aufgabenstellung zu allgemein.** „Ergänze die Lücke.“ nennt weder Thema (Past Simple/Present Perfect) noch Zweck; Status „sicher · Lücke · dein Fehler“ (gold) widerspricht sich in einer Zeile; „Kurz erklärt“ ist zugeklappt. | `D04`, `D06` · `GrammarItem.tsx:420-426` | Kap. 2.4 (Frage 1+2); Emrah „unklare Aufgabenstellungen“ |
| U-15 | M | **Leerer Pflichtschritt.** Heute verspricht „Fehler korrigieren · 3 Min.“, der Schritt öffnet „Heute sind keine falschen Sätze fällig“ + „Fertig“ (ein Klick für nichts). | `A02`, `D11` · `AgainScreen.tsx:76-79` | Kap. 2.2 |
| U-16 | M | **Altlast-Texte in der Oberfläche:** „Lese- und Hörtexte, Schreibaufgaben und Rollenspiele“ (Mein Kontext), „aus Gesprächen, Texten, Preply“ (Fehler), „Letzte Fortschritte aus der alten App“, „Am Handy kurze Aufgabe statt Sprechen und Schreiben“. | `F01-3`, `E02-fortschritt-errors`, `E02-fortschritt-history`, `F01` · `stand.de.ts:79,36`, `patterns.de.ts:7`, `nbHeute.de.ts:62` | Fokus-Vorgabe; Kap. 12 (Sprachtest) |
| U-17 | M | **Profil-Blatt doppelt Fortschritt:** „Einschätzung von Claude“ + fünf Zeilen „Dein Stand“ (Urteil · Fehler · Ziel C1 · Zahlen · Verlauf) sind dieselben fünf Reiter. | `F02` · `SheetHost.tsx:24-72` | Kap. 15 |
| U-18 | M | **Text scheint unter der Tab-Leiste durch** (Leiste 88 % deckend, Blur im Chromium-Bild nicht wirksam; auf Safari ungeprüft). | `A02`, `A07`, `D01`, `B01` · `TabBar.tsx:75` | Kap. 8 (Glas) |
| U-19 | M | **Sprechen-Extra ist der volle alte Hub** (Gespräche/Schreiben, Business-Szenen mit C1-Plakette, „Neue Szene“, „Mein nächster Termin“). | `F03`, `F03b` · `SpeakHub.tsx:65` | Fokus-Vorgabe (nur freiwilliges Extra) |
| U-20 | M | **Zielgrößen:** Wochenthema-Zeile 32 pt, Übersetzer-Richtung „DE → EN/EN → DE“ 36 pt, „Schnell/Gründlich“ 32 pt; Inline-Wörter zum Antippen 21–46 pt hoch (alle anderen Knöpfe und Links, auch „Deutsch“, „Mehr Infos“, „Ich lag richtig“, ≥ 44 pt). | `A03`, `F04`, `F05`, `C02` (Messdaten) · `TodayScreen.tsx:208-216` (`min-h-8`) | Kap. 4.5, 8 |
| U-21 | M | **Hauptknopf der Übung klein und links** („Prüfen“ 81×44 pt; auf Heute und Wörter 56 pt, volle Breite), daneben gleichgewichtig „Tipp“ und „Weiß ich nicht“ → Zielverwechslung. | `C01`, `D04`, `T3-type-frage` | Kap. 2.1 |
| U-22 | M | **Thema-Blatt:** langer Regeltext, der Hauptknopf „Thema üben“ steht erst am Ende des Blatts. | `D03` · `GrammarScreen.tsx:330` | Kap. 2.1 |
| U-23 | N | **Verlauf-Tab** = fünf eingeklappte Zeilen + „Noch kein Vergleich“; fünf innere Reiter unter vier äußeren. | `E02-fortschritt-history` | Kap. 2.1 |
| U-24 | N | **Einstellungen:** Überschrift „ÜBEN“ steht über einem namenlosen An/Aus („Automatisch weiter“), „Am Handy …“ und „Mein Kontext“ gehören nicht mehr zum Fokus; 6 Gruppen auf einem Blatt. | `F01`, `F01-3` | Kap. 2.2 (Beschriftung = Wirkung) |
| U-25 | N | **Heute-Zeilen im Amtsdeutsch:** „Deine Fehlerthemen, fällige und neue Grammatik, gemischt“, „Rückstand, der Rest morgen“, Eyebrow „DEINE TAGESEINHEIT“. | `A02` | Premium-Anmutung (Kap. 2.7) |

### 2.2 Bildschirm für Bildschirm

| Bildschirm | Urteil | Kern |
|---|---|---|
| Heute (Karte, Zustände) | **gut mit Makeln** | Ein Knopf, Erledigtes als Zustand („erledigt“ statt Knopf, `A04`), Badge = Zähler = Liste. Makel: U-08, U-10, U-11, U-25. |
| Heute · Montags-Bestätigung | nachbessern | U-10. |
| Wörter-Hub | nachbessern | U-01, U-13. |
| Wörter-Blätter (Hinzufügen, Extra) | gut | Klar gegliedert; „Als Karte speichern“ halb breit (`B02`). |
| Wörter-Runde (Frage-Zustände) | **gut** | Status, Aufgabe, Lücke in der Lücke, Tipp-Leiter, zweiter Versuch mit goldenem Hinweis (`T-cloze_hint-zweiter-versuch`); Satz bleibt bei 510 pt Resthöhe sichtbar (`X1`, `T1-…-tastatur`). |
| Wörter-Runde (Ergebnis) | nachbessern | U-03, U-02, U-08. |
| Anki-Aufdecken | nachbessern | U-12; Noten-Leiste mit Intervallen und Vorschlag ist gut (`C13`). |
| Bausteine (Vokabel, Satzbau) | **nachbessern** | U-09. Aufgabenstellung des Satzbaus ist vorbildlich klar („Du willst sagen“, `D09`). |
| Grammatik-Reiter/Seite/Thema | nachbessern | U-06, U-07, U-14, U-22. |
| Grammatik-Runde | nachbessern | U-03, U-14. Rückmeldung mit Regel, Beispielen, „Auch richtig“ ist inhaltlich stark (`D05`, `D07`). |
| Fehler korrigieren | nachbessern | U-15 (Leerzustand ist ruhig formuliert). |
| Fortschritt (alle 5 inneren Reiter) | **blockiert** (für den neuen Fokus) | U-04, U-05, U-23. Heatmap und Messwerte-Kacheln sind sauber gezeichnet. |
| Einstellungen / Profil | nachbessern | U-16, U-17, U-24. |
| Sprechen-Extra | nachbessern | U-19. |
| Übersetzer / Claude | **gut** | Ein Tipp bis „+ Wortschatz“ (`X3`), „sieht gerade: Heute“, Chips. Nur U-20, Dreifach-Anzeige (U-08). |
| Abschluss der Runde | gut | ruhig, ohne Konfetti, volle Breite (`G02`). Zu mager als Moment (siehe 3.9). |

### 2.3 Was gut ist und bleibt

- Dunkel und Hell vollwertig auf den Bildern, Gedämpft nur über axe (keine Bilder); axe: 0 Verstöße (Heute, Wortschatz, Trainer-Frage, Fortschritt × 3 Modi). `A07`, `B04`, `C09`, `C10`, `D08`, `E03`, `E04`, `F06`.
- Eingabe **in** der Lücke (Tipp trifft die versteckte Eingabe, Fokus sofort); Rückmeldung grün/gold/rot mit Wort-für-Wort-Vergleich; zwei Versuche mit Hinweis.
- Satzbau-Aufgabe: deutsche Bedeutung zuerst, „Alle gehören dazu“, „Der Satz endet mit einem Punkt“ (`D09`).
- Erledigtes ist Zustand (`A04`); Pflicht/Extra in der Leiste beschriftet; Zahl am Tab = Zähler = Liste.
- Bewegung 150–300 ms (`ui/motion.ts`), `prefers-reduced-motion` (`Shell.tsx:142`, `Layers.tsx:25`, `index.css:682`), kein Konfetti.
- Übersetzer: ein Tipp bis „+ Wortschatz“.

## 3 Zielentwurf der Bedienung

### 3.1 Leitgedanke und Umfang

Zwei Säulen (**Wörter**, **Grammatik**), ein Tagesweg (4 Schritte), ein Beweis (**Fortschritt**), zwei Helfer (Übersetzer, Claude), ein freiwilliges **Extra** (mit Sprechen als einer Zeile). Nicht mehr in der Oberfläche: Lesen, Hören/Videos, Entdecken, Schreiben, Preply, Business-Suite, Einwand-Training, Handy-Modus-Schalter, Montags-Bestätigung des Wochenthemas, Kurs-Lektionen (Frage G2 in `04` §8; Daten bleiben). Das Thema der Woche lebt nur noch als Wörter-Stapel (3.2).

### 3.2 Navigation: Reiter und Inhalt

**Reiterleiste (4, unverändert in Zahl und Reihenfolge):** Heute · **Wörter** · Grammatik · Fortschritt. Beschriftung = Titel der Seite, im Englischen Today · Words · Grammar · Progress. Badge nur am Reiter Heute (offene Schritte).
**Kopf der Reiter-Wurzeln:** links Profil-Knopf (Initiale, **ohne** Serienzahl), rechts Übersetzer · Claude · Zahnrad (Emrahs Vorgabe A7 28.09. bleibt). Seiten: „‹ Herkunft“ plus dieselben drei Symbole. Übungen: ✕ · fester Balken · Zähler · dieselben drei Symbole, kein Reiterleiste.

| Reiter | Inhalt von oben nach unten | Ein Tipp führt zu |
|---|---|---|
| **Heute** | Datum (eine graue Zeile) · **Tageskarte** (4 Schritte, 1 Knopf, Serie im Kartenfuß) · bei Bedarf **ein** ruhiges Band (Wiedereinstieg · Wochenrückblick) · nach der Pflicht: Fertig-Karte + **eine** Extra-Zeile | Übungskette · Fortschritt › Rückblick · Extra-Blatt |
| **Wörter** | Titel + „＋“ als Symbolknopf in der Titelzeile · **Zielkarte** (eine Zahl „X von 8.000“, Balken, Tempo) · **Wiederholen-Karte** (Knopf, Modus als Textknopf „Modus: Automatisch ›“) · „Neue Wörter heute“ (Kontingent, Atlas-Vorschläge) · **Stapel** (3 Standard: Alle · Schwierig · Thema der Woche; „Alle Stapel ›“) · „Atlas ›“ (stöbern, `04` §5) · Suche | Wörter-Runde · Atlas · Liste · Wort-Blatt · Hinzufügen-Blatt |
| **Grammatik** | Titel · **Weiter-Karte** („Als Nächstes: <Thema> · 12 Min.“, Knopf) · **Pfad** (Themen B2 → C1 in Lehrreihenfolge, je Thema 5 Punkte + Zustand; gesperrt gibt es nicht, nur „später“) · Zeile „Fehler korrigieren · n fällig“ · Zeile „Extra ›“ | Thema-Blatt → Runde · Fehler-Runde · Extra-Blatt |
| **Fortschritt** | Titel · Segmente **Wörter · Grammatik · Rückblick** · je Segment eine Hero-Zahl und darunter höchstens drei Karten · „Messwerte dahinter“ eingeklappt | Thema-Blatt · Wort-Liste (gefiltert) · Rückblick-Details |

**Blätter (von unten):** Extra · Hinzufügen · Wort · Thema · Übersetzer/Claude · Einstellungen · Profil.
**Extra-Blatt:** Zeilen mit Zahl und Grund – Wörter (neue +5 · schwierige · hartnäckige · Fehler der Woche · morgen Fälliges vorziehen) · Grammatik (freie Runde · Fehlerthemen) · Satzbau · Wortbildung/Kollokationen/Phrasal Verbs (aus `nbdrill`, Entscheidung G4) · **Sprechen (freiwillig)** als letzte Zeile → bestehende Seite. Erreichbar von Heute (nach der Pflicht), Wörter, Grammatik. Zählt nie in den Ring.
**Profil-Blatt:** Kopf „Serie 13 · Ruhetag diese Woche frei“, Wochenstreifen (7 Punkte), Zeilen **Einstellungen ›** und **Sicherung ›**, „Aus diesem Browser nachtragen“ nur wenn nötig. Kein „Dein Stand“, keine Claude-Einschätzung (die steht im Fortschritt).

### 3.3 Bildschirmliste

| Bildschirm | Zweck (ein Satz) | Hauptknopf | Leer | Lädt | Fertig | Fehler |
|---|---|---|---|---|---|---|
| **Heute** | Was ist heute dran? In 2 s klar. | „Weiter: <Schritt>“ (am Anfang „Los: …“) | Erststart → Willkommen (3.5a) | Karten-Skelett, keine Spinner | „Fertig für heute ✓“ + Bilanz + Morgen; **kein** Knopf | „Heute lädt gerade nicht · Erneut versuchen“ (Plan bleibt gespeichert) |
| Willkommen / Einstufung | Ziel nennen, Stand messen (3 Min.) | „Einstufung starten“ | – | Skelett | Ergebnis: eine Zahl + „Los geht’s“ | ohne Claude: Einstufung läuft lokal (Ja/Nein ist offline) |
| **Wörter** | Wie weit bin ich, was ist fällig? | „Wiederholen · 29 Wörter“ | „Heute nichts mehr fällig. Morgen: 31.“ + Extra-Zeile | Skelett der Zielkarte | wie leer | ruhige Zeile + „Erneut“ |
| Wörter-Liste / Atlas | Suchen, filtern, Stapel, stöbern | – (keiner) | „Noch nichts gefunden.“ | Skelett-Zeilen | – | „Erneut“ |
| Wort-Blatt | Bedeutung, Sätze, Aussprache, Zustand | – | – | Skelett | – | „Claude nicht erreichbar – gespeicherte Inhalte bleiben“ |
| Hinzufügen-Blatt | Wort speichern (eigenes · von Claude · aus Text) | „Als Karte speichern“ (unten fest, volle Breite) | Felder leer, Knopf gedimmt | „Claude ergänzt …“ im Feld | Toast „Gespeichert · Rückgängig · Ändern“ | Speichern geht ohne Claude |
| **Wörter-Runde** | Fällige Wörter abfragen (Anki-artig) | **Aktionsleiste** (3.4) | „Heute nichts fällig“ statt leerer Runde | Karten-Skelett | Abschluss-Karte | „Speichern fehlgeschlagen · Erneut“ (Antworten bleiben lokal) |
| **Grammatik** | Wo stehe ich im Pfad? Was kommt als Nächstes? | „Thema starten“ | „Pfad geschafft – Wiederholung läuft von selbst.“ | Skelett | wie leer | „Erneut“ |
| Thema-Blatt | Regel in 3 Sätzen, Beispiele, typische Fallen | „Thema üben · 8 Aufgaben“ (**oben fest**, nicht am Ende) | – | Skelett | – | – |
| **Grammatik-Runde** | Aufgaben, verschachtelt, mit Regel-Rückmeldung | Aktionsleiste | – | Skelett | Abschluss-Karte („Thema · 2 von 5 Punkten“) | wie Wörter-Runde |
| **Satzbau** | Satz aus Bausteinen legen | Aktionsleiste („Prüfen“ erst wenn alle liegen) | – | Skelett | Abschluss-Karte | – |
| **Fehler korrigieren** | Eigene falsche Sätze richtig schreiben | Aktionsleiste | **Schritt entfällt**, auf Heute „keine fällig ✓“ | Skelett | Abschluss-Karte | – |
| **Fortschritt** | Beweis: Wörter + Grammatik + Fehler | – (nur Zustand; je Segment höchstens eine Verweiszeile) | „Noch keine Daten – nach der ersten Runde.“ | Skelett | – | „Erneut“ |
| Übersetzer / Claude | Übersetzen, fragen, Wort speichern | „Übersetzen“ / Senden | Eingabefeld + Beispiel-Chips | „Denkt nach …“ + Stopp | Ergebnis + „＋ Wörter“ | „dauert länger · Stopp“, „Erneut versuchen“ |
| Einstellungen | Lernen, Wörter, Stimme, Darstellung, Daten | – | – | – | – | – |
| Profil | Serie, Woche, Einstellungen, Sicherung | – | – | – | – | – |

### 3.4 Der Übungsrahmen (gilt für Wörter-Runde, Grammatik-Runde, Satzbau, Fehler korrigieren)

Ziel: derselbe Aufbau in jeder Übung; der Hauptknopf liegt **immer** am selben Ort (unten), ist **immer** sichtbar und **ist immer der einzige**.

```
┌ ✕   ━━━━━━○────   12 / 40     ✦ ⚙ ┐  Kopf: fester Nenner; Wiederholungen als „+2“ daneben
│ ●●●○○ wird fester · Lücke mit Hilfe │  Status (Sicherheit · Art · Thema)
│ Setze das passende Wort ein.    ⓘ  │  Aufgabe: 1 Satz, nennt Wort/Thema; Wozu nur hinter ⓘ
│ I will [p_____] the cloud offer …   │  Inhalt: Eingabe IN der Lücke / Optionen / Bausteine
│ Bedeutung: präsentieren, anpreisen  │
│ Tipp                                │  Nebenaktionen: Textknöpfe in der Karte, nie neben dem Hauptknopf
├─────────────────────────────────────┤
│ [            Prüfen               ] │  AKTIONSLEISTE: 56 pt, volle Breite, über Tastatur und Safe-Area
└─────────────────────────────────────┘
```
- **Leiste:** `position: fixed` am unteren Rand der Übungsebene, folgt `visualViewport` (Tastatur), Hintergrund `--lx-bg` 96 % + Haarlinie, Inhalt scrollt dahinter mit Polster in Leistenhöhe. Zustände: *Frage* „Prüfen“ (gedimmt, nicht ausgeblendet, solange nichts eingegeben – so springt nichts) · *Ergebnis* „Weiter“ (Beschriftung blendet in 150 ms um, Knopf bleibt am Ort) · *Anki-Vorderseite* „Antwort zeigen“ (primär) · *Anki-Rückseite* vier gleich breite Noten (Nochmal · Schwer · Gut · Leicht, je ≥ 44 pt, Intervall klein darunter, Vorschlag mit Ring) · *Satzbau* „Prüfen“ erst aktiv, wenn alle Bausteine liegen.
- **Ergebnis (feste Reihenfolge, auch bei richtig; ≤ 4 Zeilen ohne Scrollen):** ① Verdikt (Richtig · Fast richtig · Noch nicht) ② Du/Richtig **einmal** als Wort-für-Wort-Vergleich (keine Wiederholung von Lücke + „Richtig:“ + Volltext) ③ **Warum** (1–2 Zeilen; Wörter: Wortart, typische Verbindung, warum diese Form; Grammatik: Regel in einem Satz) ④ „Beispiele ▸“ (eins sichtbar, Rest eingeklappt) ⑤ Menü „⋯“ mit „Ich lag richtig“, „Einmal richtig schreiben“, „Deutsch“, „Mehr Infos“. „Kommt in 10 Min. wieder“ als kleine Zeile über der Leiste. Kein Auto-Weiter unter 4 s (`03` Inv. 8).
- **Bausteine (Satzbau, Vokabel-Bausteine):** Antwortzeile hat **N gleich hohe Plätze** (Höhe = ein Baustein, `align-items/-content: flex-start`), Bausteine behalten ihre Höhe, der Vorrat zeigt **gestrichelte Umrisse** statt unsichtbarer Lücken; Tippen und Ziehen verschieben nichts anderes (`03` Inv. 11). Bei Vokabel-Bausteinen **keine** zweite leere Lücke im Satz: die Lücke selbst ist die Antwortzeile.
- **Zähler:** `n / total` mit festem `total` (Plan der Runde). Falsche Wörter kehren als „+1 Wiederholung“ am Rundenende zurück und werden separat gezählt; der Balken geht nie rückwärts.

### 3.5 Kernabläufe

**a) Erster Start** (nur ohne Daten; Bestandsdaten springen darüber): Skelett → **Willkommen** („Dein Weg zu C1: 8.000 Wörter, Grammatik B2 → C1, 25 Minuten am Tag.“, Knopf „Einstufung starten · 3 Min.“, Textknopf „Später“) → **Einstufung** (`02` §2: 25 Wörter „Kenne ich?“ Ja/Nein per Tippen oder Wischen + 5 Bedeutungsfragen + 4 Grammatikaufgaben; fester Balken über 34) → **Ergebnis** (eine Zahl „etwa 3.900 von 8.000 bekannt“, ein Satz „Wir starten bei …“, Knopf „Los geht’s“) → Heute mit **Kurzplan** (5 neue Wörter + Einführung eines Grammatikthemas, 10 Min.). Serie zeigt nichts, bis die erste Pflicht erledigt ist. 3 Tipps bis zur ersten Übung.

**b) Ein Tag:** Heute → „Los: Wörter wiederholen“ → Wörter-Runde → Abschluss-Karte mit „Weiter: Grammatik“ → Grammatik-Runde → „Weiter: Satzbau“ → Satzbau → „Weiter: Fehler korrigieren“ (nur wenn fällig, sonst entfällt der Schritt und steht als erledigt auf der Karte) → **Tagesabschluss** auf Heute (Zustand). Die Abschluss-Karte *ist* die Zwischenkarte: kein zusätzlicher Bildschirm. ✕ speichert („Gespeichert. Weiter, wann du willst.“) und führt zu Heute; der Schritt bleibt offen, der Knopf heißt wieder „Weiter: …“. **4 Tipps** außerhalb der Antworten (Ist: Zwischenkarten + Montags-Bestätigung).

**c) Wort hinzufügen aus dem Übersetzer:** Symbol (oder `/`) → Text eintippen/einfügen → „Übersetzen“ → Wort im Ergebnis antippen (oder „＋ Wörter“ für die ganze Wendung) → sofort gespeichert; Toast „*pitch* gespeichert · Rückgängig · Ändern“ (optimistisch mit Rückrollen, Kap. 3.4; „Ändern“ öffnet das Hinzufügen-Blatt vorbefüllt). Ohne Claude: nur das Hinzufügen-Blatt. 4 Tipps, 0 Sackgassen.

**d) Grammatikthema lernen:** Reiter Grammatik → Weiter-Karte „Als Nächstes: Mixed Conditionals“ → **Mini-Lektion** (ein Bildschirm, ≤ 90 s: Regel in einem Satz, Kontrast Deutsch → Englisch, 2–3 Beispiele, „typischer Fehler“; Knopf „Los“) → Runde mit 6–8 Aufgaben (Form steigt mit p: Auswahl → Lücke → Umformen, `03` §3) → Abschluss „Mixed Conditionals · 2 von 5 Punkten · 2 Fehlersätze kommen übermorgen wieder“ → Pfad. **3 Tipps** (Ist: Reiter → Üben-Seite → Thema → Blatt → „Thema üben“ = 5).

**e) Fehlerkorrektur:** Falsche Antwort (oder „Weiß ich nicht“) in Wörtern/Grammatik → Ergebnis zeigt den Vergleich → die App legt **automatisch einen Fehlersatz** an (`03` Inv. 7; „Einmal richtig schreiben“ ist optionales Üben sofort) → ab morgen Schritt 4 „Fehler korrigieren · n Sätze“ → je Satz: dein alter Satz, falsche Stelle markiert, Feld vorbefüllt (ab 9 Wörtern), Korrektur tippen → Vergleich → „Sitzt“ (kommt in 3/9 Tagen wieder) oder „Morgen nochmal“ → Abschluss. Nichts fällig → Schritt entfällt (U-15).

**f) Wochenrückblick:** Sonntag/Montag: oben auf Heute ein Band „Dein Wochenrückblick ist da · Ansehen“ (nicht in der Karte, kein Knopf-Wettbewerb) → Fortschritt › Rückblick: **eine** große Zahl („+38 Wörter fest“), darunter W1–W6 aus `03` §5 als Zeilen (neu feste Wörter mit Namen · Themen von → nach · Behaltensquote Woche/Vorwoche · überfällig Montag → Sonntag · aktive Tage) und ein Ausblick („Nächste Woche: 31 Wörter fällig, 1 neues Thema“). Kein Knopf; das Band verschwindet nach dem Ansehen. Der „Wochen-Check“ bleibt der zweite Sonntagsschritt (Name: „Wochen-Check“); „nachholen“ steht nur im Extra-Blatt.

**g) Wiedereinstieg nach Pause** (Lücke g in Lerntagen; Regeln `03` §2, Darstellung hier): g ≤ 2 normal, nichts Besonderes. g 3–6: Band „Willkommen zurück. Heute zuerst das Fällige.“ g 7–13: Band + Kurzplan (Wörter + 3 Grammatikaufgaben, Satzbau pausiert bis überfällig < 40). g ≥ 14: **Willkommens-Karte statt Tageskarte** („Willkommen zurück. 14 Tage Pause sind kein Problem. 31 Wörter warten – wir verteilen sie auf eine Neustart-Woche.“, Knopf „Neustart-Woche beginnen · 15 Min.“). Nie „Serie 0“: die Serie erscheint wieder mit „Serie 1“ nach der ersten Pflicht; der Ruhetag wird neutral erklärt.

### 3.6 Begriffe und Microcopy (ein Wort pro Ding)

| Ding | Wort (nur dieses) | Nicht mehr |
|---|---|---|
| Reiter 2 | **Wörter** | Wortschatz, Karten, Einträge (für die Zählung) |
| Reiter 3 und sein Titel | **Grammatik** | „Üben“ als Titel |
| Reiter 4 und sein Titel | **Fortschritt** (Segmente: Wörter · Grammatik · Rückblick) | Dein Stand, Urteil, Zahlen, Verlauf, Ziel C1 |
| Tagesplan und seine Teile | **Heute · 4 Schritte** | Tageseinheit, Block, Station |
| Schritte | **Wörter wiederholen · Grammatik · Satzbau · Fehler korrigieren** | Wiederholen, Reparatur-Sätze |
| Pflicht / freiwillig | **Pflicht · Extra** | Angebot, freiwillig, Zusatz |
| ein Durchgang | **Runde** (Pflicht-Runde · Extra-Runde) | Freie Runde, Lauf |
| Lernstoff | **Wort** (Wendungen zählen mit); „Karte“ nur für die Kartenseite selbst | Eintrag, Karte als Zähler |
| Zustände | **Neu · Lernt · Sicher · Fest** (Fest = `03` „Gefestigt“ = `04` „Fest“; die drei Dokumente auf „Fest“ vereinheitlichen) | Fällig/Lernen als Zustand, aktiv fest, reif, gekonnt |
| nicht rechtzeitig Geübtes | **überfällig** | Rückstand, „der Rest morgen“ |
| falsche Sätze | **Fehlersätze** (Tätigkeit: Fehler korrigieren) | Reparatur-Sätze |
| Bedeutung in der Frage | **Bedeutung:** | „Hilfe:“ |
| Hinweis | **Tipp** | Hilfe |
| Prüfen/Weiter | **Prüfen · Weiter · Antwort zeigen** | – |
| Noten | **Nochmal · Schwer · Gut · Leicht** | – |
| Urteil | **Richtig · Fast richtig · Noch nicht** | falsch |
| Serie | **„Serie 13“** an genau einer Stelle (Kartenfuß) + Profil | Serie: 0 Tage, Serie im Kopf |
| Wochenthema | **Thema der Woche** (nur als Stapel in Wörter) | auf Heute, Montags-Bestätigung |

**Muster:** Heute-Zeile = *Name · Konkretes · Minuten* („Grammatik · Past Simple oder Present Perfect · 7 Min.“, „Wörter wiederholen · 29 · 8 Min.“). Hauptknopf = *Verb: nächster Schritt* („Weiter: Grammatik“). Aufgabe = Imperativ + Gegenstand („Past Simple oder Present Perfect? Setze die richtige Form ein.“, „Lege den englischen Satz aus den Bausteinen.“). Leer = Grund + nächster Schritt („Heute ist nichts mehr fällig. Morgen: 31 Wörter.“). Fehler = Entwarnung + Handlung („Das hat nicht geklappt. Deine Antworten sind sicher. Erneut versuchen“). Fertig = Zustand + Zahl („Fertig für heute ✓ · 38 Wörter · 88 % richtig“).

### 3.7 UX-Regeln (12, prüfbar)

Alle als Playwright-Rundgang `tests/e2e/uxRules.spec.ts` über `screenNames()` (390×844, Dunkel + Hell); Messfunktion siehe Anhang B.

| Nr | Regel | Prüfung |
|---|---|---|
| R1 | **Ein Hauptknopf je Bildschirm** (gefüllt, Akzent, ≥ 56 pt in Karten/Leiste). | ≤ 1 sichtbarer `button.bg-accent` im Viewport |
| R2 | **Hauptknopf immer im Bild**, auch bei Tastatur (510 pt) und im Ergebnis. | `boundingBox().bottom ≤ visualViewport.height` in jedem Zustand der Übungen |
| R3 | **Eine Zahl – ein Name – eine Quelle.** Heute-Ring = Badge = Liste = Hub-Knopf = Rundenlänge. | Property-Test (`03` Inv. 1) + E2E „Zahl Heute == Zahl Hub == Länge der Runde“ |
| R4 | **Zähler laufen nur vorwärts**, Nenner fest, Wiederholungen separat. | in einer Runde mit 3 Fehlern: `total` konstant, `n` fällt nie |
| R5 | **Erledigt ist Zustand**, nie Knopf. | kein `[data-state=done]` mit Rolle button/link |
| R6 | **Vier Fragen an fester Stelle**; Aufgabe nennt Wort/Thema; Ergebnis Verdikt → Vergleich → Warum, auch bei richtig; Auto-Weiter nie < 4 s. | Reihenfolge der `data-testid` + Timer-Test |
| R7 | **Nichts doppelt:** gleicher Text (≥ 12 Zeichen) höchstens einmal je Viewport. | Skript über `innerText`-Zeilen, Ausnahmen: Reiter |
| R8 | **Zielgrößen ≥ 44 × 44 pt**; Inline-Wörter ≥ 32 pt Zeilenhöhe, 8 pt Abstand. | Messung (Anhang B) |
| R9 | **Nichts springt:** bedientes Element ändert Position/Größe ≤ 2 pt (Bausteine, Prüfen, Tipp, Tastatur). | `boundingBox` vor/nach + `layout-shift`-Observer = 0 (`03` Inv. 11) |
| R10 | **Bewegung nur bestätigend:** 150–300 ms, ein Muster je Ebene; Reduced Motion = Überblendung. | `transitions.spec` + Grep auf Dauern > 0,3 s |
| R11 | **Leer ist ein Zustand mit Weg:** Grund in einem Satz, höchstens ein Knopf; kein Pflichtschritt ohne Inhalt. | Leerzustands-Rundgang + Plan-Test „Block ohne Inhalt entfällt“ |
| R12 | **Nur Wörter aus 3.6, nur Oberflächensprache, nichts aus entfallenen Modulen.** | Textscan DE/EN über `i18n` und Bilder (verbotene Begriffe: alte App, Preply, Szene, Lesen, Hören, Schreiben …) |

### 3.8 Design-System (Kap. 8): was bleibt, was ändert

**Bleibt:** Tokens je Modus (axe: 0 Verstöße), Obsidian `#0B0F19` + Glas auf Blättern, Palette Salbei als Standard, Inter + Tabellenziffern, 8-pt-Raster, Skala 12–64 pt, kinetische Lücke (`lx-gap`), Karten `lx-card`, Segmente, Sheets, Skelette, Hell/Gedämpft vollwertig, Bewegungsregeln (`ui/motion.ts`).
**Ändert:**
1. **Akzent-Semantik trennen.** Smaragd steht heute für Hauptknopf, Links, aktiven Reiter, „Fällig“ **und** „Richtig/Erledigt“ (Kap. 8: Smaragd = erledigt/richtig). Vorschlag: Token `--lx-ok` (fest Smaragd; Häkchen, „Richtig“, erfüllter Balken) neben `--lx-accent` (Palette; Knopf, Link, aktiver Reiter). Zahlen und Zustände („Neu/Lernt/Sicher“) in neutraler Schrift mit kleinem Farbpunkt statt bunter Ziffern. In Salbei sehen beide gleich aus; die Trennung wirkt in Ozean/Pflaume/Graphit. *(Entscheidung Emrah, siehe 4.)*
2. **Neue Bausteine:** `ActionBar` (3.4), `HeroNumber` (eine große Zahl 44–64 pt + 1 Satz), `Band` (ruhiges Hinweisband über der Karte), `Toast` mit „Rückgängig/Ändern“.
3. **Tab-Leiste und Aktionsleiste ohne Glas:** Deckkraft 96–100 % + Haarlinie; Blur nur auf Blättern (Leistung am iPhone, kein durchscheinender Text, U-18).
4. **Kanalfarben (Kap. 8) schrumpfen** auf Wörter (violett), Grammatik (blau) und Sprechen (rot, nur im Extra); die übrigen fünf werden nirgends mehr gezeichnet (Tokens bleiben).
5. **Karte = ein Radius, eine Dichte:** `lx-glass` auf Hubs (Kurs-Karte `D01`) → `lx-card`; Fließtext in Karten ≥ 15 pt, Meta 13 pt, Aufgabenzeile 20 pt/600, Satz 24–28 pt.
6. **Sheets als Zeilenlisten** (Einstellungen, Extra, Profil) statt Text-Absätze; Gruppentitel **oder** Eyebrow, nie beides (`F01-5`).

### 3.9 Wie sich die App „kommerziell“ anfühlt: konkrete Details

- **Ein Übergangsmuster je Ebene** (150–300 ms, `EASE_OUT`): Reiter = Überblendung 150 ms · Seite = 24 pt seitlich + Überblendung 220 ms · Blatt = von unten, Feder (520/40), Scrim 150 ms · Karte → Ergebnis = Lücke bleibt stehen, Ergebnis wächst darunter 220 ms (shared layout), Leistenbeschriftung blendet um, Knopf bleibt am Ort · nächste Karte = alte 16 pt nach links und aus, neue 16 pt von rechts und ein (nie beide > 80 ms sichtbar) · Schritt erledigt = Kreis füllt sich in 220 ms, Punkte der Karte zählen mit. Reduced Motion: nur Überblendung.
- **Skelette statt Spinner, nie ein leerer Bildschirm**; Antworten werden lokal in < 50 ms bewertet (`lx:card`), die KI streamt nach (`04` §7).
- **Haptik-Ersatz (iPhone-Safari kennt `navigator.vibrate` nicht):** (1) sichtbar: Lücke färbt sich in 120 ms, Lichtimpuls, Knopf `scale .98` (vorhanden); (2) optionaler Ton (Kap. 4.7, aus): zwei WebAudio-Klicks < 80 ms nach Nutzergeste; (3) **Experiment, am Gerät prüfen** (Vermutung): Safari ab 17.4 gibt beim Umschalten eines `<input type="checkbox" switch>` einen leichten Tick – als versteckter Auslöser für „richtig“, nur mit Merkmalserkennung und nie als kaputter Aufruf; Emrah entscheidet nach dem Test.
- **Leerzustände** ohne Bild, mit Grund und Weg („Heute ist nichts mehr fällig. Morgen: 31 Wörter.“, „Pfad geschafft – Wiederholung läuft von selbst.“).
- **Abschluss-Moment der Runde:** Häkchen zeichnet sich in 300 ms, **eine** große Zahl zählt in 350 ms hoch („38 Wörter“), darunter eine Zeile aus `03` §6 („Heute neu sicher: 3 · Fehler weg: 1 · überfällig −12“, nur was stimmt), Knopf „Weiter: Grammatik“. Kein Konfetti, kein Glückwunsch-Text.
- **Tagesabschluss auf Heute:** „Fertig für heute ✓“, Wochenstreifen (heutiger Punkt füllt sich), Bilanz in einer Zeile, „Morgen: 31 Wörter · 1 neues Thema“; **kein** Knopf (Zustand), darunter eine ruhige Extra-Zeile („Noch 5 Minuten? +5 neue Wörter“). Meilensteine (100/250/500/1.000 Fest) einmalig als ein Satz im Abschluss.
- **Fortschritt als Landkarte:** ein ruhiger Balken zu 8.000 mit Marken bei 1.000/2.000 …, Prognose als **Zeitraum** („etwa Frühjahr 2028“, erst ab 21 Tagen Daten, `03` K1) statt „84 Wochen“; Messwerte eingeklappt.
- **Tastatur/Gesten (Mac):** Enter prüft/weiter, 1–4 wählt Optionen und Noten, Leertaste deckt auf, `/` Übersetzer, Esc schließt; (Handy) Wischen links Nochmal, rechts Vorschlag (vorhanden), Wort lang antippen = Wortblatt.
- **Details:** Tabellenziffern überall, `text-wrap: balance` in Titeln, Safe-Area oben und unten, Hauptknopf 56 pt, Radius und Abstände nur aus dem 8-pt-Raster.

### 3.10 Umsetzungsreihenfolge und Abnahme

| Paket | Inhalt | Löst |
|---|---|---|
| **P1 Vertrauen** (≈ 1 Tag) | `ActionBar`; fester Nenner (`vocab/session.ts:441-449`); Anki-Leiste; Begriffe, Duplikate, Altlast-Texte (nur i18n); Tab-Leiste deckend | U-02, U-03, U-06, U-08, U-12, U-16, U-18, U-21, U-25 |
| **P2 Heute** (≈ 1 Tag) | Tageskarte (eine Serie, ein Thema, keine Zusatzzeilen), Band, Erststart, Wiedereinstieg, leerer Schritt entfällt, Montags-Bestätigung entfällt | U-10, U-11, U-15, U-08 |
| **P3 Wörter** (≈ 1,5 Tage) | Hub entschlacken (Zielkarte, 3 Stapel, „＋“ in der Titelzeile), Bausteine (Plätze, Umrisse, „Prüfen“ erst wenn alle liegen), Hinzufügen-Toast | U-01, U-09, U-13 |
| **P4 Grammatik und Fortschritt** (≈ 2 Tage) | Grammatik-Reiter mit Pfad und Mini-Lektion, Aufgaben nennen das Thema, Thema-Blatt mit festem Knopf; Fortschritt in 3 Segmenten (hängt an `03` K1–K8); Profil/Einstellungen/Sprechen-Extra schlank | U-04, U-05, U-07, U-14, U-17, U-19, U-22, U-23, U-24 |
| **P5 Politur** (≈ 1 Tag) | Übergänge, Abschluss-Moment, Haptik-Experiment, Zielgrößen | U-20 |

**Abnahme:** R1–R12 grün als `uxRules.spec.ts`; Bildersatz 390×844 Dunkel + Hell neu aufgenommen und mit den Bildnamen dieses Dokuments verglichen; axe weiter 0; danach ux-reviewer-Nachprüfung (eine Runde, A2). Handy-Gefühl (Tastatur, Haptik, Blur) prüft Emrah am iPhone.

## 4 Offene Fragen an Emrah (drei, mit Empfehlung)

1. **Kurs (24 Lektionen)** aus der Oberfläche nehmen? *Empfehlung ja* (er enthält Hören/Schreiben/Sprechen; Daten bleiben; `04` G2).
2. **Smaragd** für Hauptknopf **und** „richtig“? *Empfehlung:* Palette Salbei behalten, aber Zahlen neutral und `--lx-ok` getrennt; wer Trennung sichtbar will, wählt „Ozean“ als Standard.
3. **Reiter „Wortschatz“ → „Wörter“**? *Empfehlung ja* (ein Wort für das Ding; im Englischen „Words“).

Abgleich mit den Schwesterdokumenten: `03` nennt den obersten Zustand „Gefestigt“, `04` „Fest“ → hier „Fest“ (3.6). `04` §8 G3 (Thema der Woche) ist hier entschieden vorgeschlagen: nur noch Stapel in Wörter, keine Bestätigung, nichts auf Heute.

## Anhang A · Bildverzeichnis (nach Gruppe)

| Gruppe | Bilder |
|---|---|
| Heute | `A01` Sonntag · `A02`/`A02b` Montag (gescrollt) · `A03` 1 von 4 · `A04` 3 von 4 („Weiter: Wiederholen“) · `A05` Erststart (leeres Konto) · `A06` Wiedereinstieg (14 Tage) · `A07` Montag **hell** · `A08`/`A08b` Wochenseite · `A09` erste Station am Montag |
| Wörter | `B01`/`B01b` Hub · `B02` Hinzufügen · `B03` Extra-Runde · `B04` Hub **hell** · `B05` Liste · `C11` Hub mit 12 fälligen |
| Wörter-Runde | `C01`/`C03` Frage (Lücke, Auswahl) · `C02`/`C02b` Auswahl falsch · `C08`/`C08b` · `C09`/`C10` **hell** · `T1`–`T6` je Abfrageart (Frage, Ergebnis, Tastatur simuliert) · `T-cloze_hint-zweiter-versuch` · `X1` Tippen mit simulierter Tastatur · `X4` Tipp · `X5` „Wozu“ |
| Anki | `C12` Vorderseite · `C13`/`C13b`/`G01` Rückseite · `C14` **hell** · `G02`/`G02b` Abschluss |
| Grammatik | `D01`/`D01b` Reiter · `D02`/`D02b` Seite · `D03` Thema-Blatt · `D04`–`D07b` Runde (Frage, richtig, falsch) · `D08` Reiter **hell** |
| Satzbau / Fehler | `D09`/`D09b` Frage · `D10` zwei Bausteine gelegt · `D11`/`D11b` Fehler korrigieren (leer) |
| Fortschritt | `E01`/`E01b` Urteil · `E02(b)-errors/path/stats/history` · `E03` **hell** · `E04` Zahlen **hell** |
| Rest | `F01`, `F01-1…5` Einstellungen · `F06` **hell** · `F02` Profil · `F03`/`F03b` Sprechen · `F04`/`X2`/`X3`/`X3b` Übersetzer · `F05` Claude |

## Anhang B · Messfunktion (Kern, aus der temporären Spec)

```ts
// je Bild: sichtbare Hauptknöpfe und Zielgrößen < 44 pt (Viewport-Koordinaten)
const vis = (el: Element) => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"]'); };
const sel = 'button, a[href], input, select, textarea, [role=button], [role=tab], [role=switch], [role=checkbox], [role=radio]';
const small = [...document.querySelectorAll(sel)].filter(vis).map((el) => ({ el, r: el.getBoundingClientRect() })).filter(({ r }) => Math.min(r.width, r.height) < 43.5);
const primary = [...document.querySelectorAll('button')].filter((b) => vis(b) && /(^|\s)bg-accent(\s|$)/.test(b.className));
// R2: primary.every((b) => b.getBoundingClientRect().bottom <= (window.visualViewport?.height ?? innerHeight))
```
Ergebnis dieser Aufnahme: kleine Zielgrößen nur an der Wochenthema-Zeile (32 pt), Richtungs-Segmenten des Übersetzers (36 pt), „Schnell/Gründlich“ (32 pt) und den Inline-Wörtern; Hauptknöpfe: genau 1 auf Heute, Wörter, Trainer; axe 0 Verstöße.
