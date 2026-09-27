# UX-Beratung: Lingo-Engine X aufräumen

Stand 27.09.2026 · Grundlage: Build `b28ee97`, 40 Bildschirmfotos (iPhone 390 × 844, Dunkel, Deutsch; dazu Hell und 1440 px).
Es wurde kein Quellcode geändert. Die Fotos liegen im Scratchpad unter `…/scratchpad/ux/shots/`.

---

## 1. Urteil in drei Sätzen

Die einzelnen Bildschirme sehen hochwertig aus, aber die App als Ganzes wirkt verschachtelt: Dieselben Angebote (Lesen, Hören, Schreiben, Entdecken, Sprechen, Business, Übungen) stehen an zwei bis drei Stellen, und es gibt Hubs in Hubs (Sprechen → Business → Werkzeug, Stand → Reiter → Unterreiter → Preply). Die Benutzerführung wackelt, weil „Zurück“ und „Schließen“ je nach Bildschirm woanders hinführen und oben jedes Mal anders aussehen (Pfeil, Kreuz, „← Heute“, „Beenden“, Pille „Extra“, Pille „Pflicht 1 von 3“). Die Unruhe entsteht vor allem durch Menge und nicht durch den Stil: zu viele Karten, Einleitungssätze, Zähler und Knopfarten pro Bildschirm, besonders auf „Heute“ nach der Pflicht und auf „Dein Stand“.

---

## 2. Heutige Struktur (Ist)

| Bildschirm | Weg dahin | Taps ab Start |
|---|---|---|
| Heute (Pflicht, Heldenkarte) | Start | 0 |
| Pflicht-Übung (Trainer, Lektion, Kanal) | Heute → Starten | 1 |
| Heute nach der Pflicht: Freiwillig (2 Vorschläge), freie Vokabelrunde (4 Stapel × 3 Größen), Wochen-Check, Sprechen, Business, Lesen, Schreiben, Entdecken, Tagesbilanz | Heute (scrollen) | 1 |
| Lernen (Hub) | Reiter | 1 |
| Kurs: nächste Lektion / alle Lektionen / Lektion | Lernen → … | 2 / 2 / 3 |
| Wortschatz → Wortblatt | Lernen → Wortschatz → Wort | 2 / 3 |
| Grammatik → Thema / freie Runde / Fehler | Lernen → Grammatik → … | 2 / 3 |
| Wissen (Nachschlagen) | Lernen → Wissen **oder** Grammatik → Wissen | 2–3 |
| Lesen, Hören, Schreiben (+ je ein Verlauf-Knopf) | Lernen → Karte „Üben“ **oder** Heute nach der Pflicht | 1–2 |
| Lückenjagd, Satzbau, Diktat, Sprint | Lernen → Übung **oder** Heute (Vorschläge) | 1–2 |
| Sprechen (Szenen, Situationen) → Briefing → Rollenspiel | Reiter → Szene → Starten | 1 / 2 / 3 |
| Business → E-Mail-Refiner / Phrasen-Baukasten / Präsentations-Coach | Sprechen → ganz unten Business → … **oder** Heute | 2–3 |
| Entdecken → Beitrag / Verlauf | Reiter | 1 / 2 |
| Dein Stand: Urteil · Fehler · Weg nach C1 · Verlauf | Reiter → Unterreiter | 1–2 |
| Wortschatztest | Stand → Verlauf → scrollen → Test | 3 |
| Wochen-Check | Heute (nach Pflicht) **oder** Stand → Verlauf | 1–3 |
| Preply (Vorbereiten · Übernehmen · Verlauf) | Stand → ganz unten scrollen → Preply-Brücke | 2 (+ langes Scrollen) |
| Claude fragen / Übersetzer | Funkel-Symbol oben → Reiter | 1 / 2 |
| Einstellungen (inkl. Diagnose, Sicherung) | Regler-Symbol oben | 1 |
| Wort antippen (Bedeutung, Lautschrift, Karte, Claude) | in jedem englischen Text | 1 |

**Hauptbefunde**

- **Doppelte Wege:** Lesen/Schreiben/Entdecken stehen auf Heute, in Lernen und (Entdecken) als eigener Reiter. Business steht auf Heute und in Sprechen. Übungen stehen auf Heute und in Lernen. Wissen ist in Lernen und in Grammatik. Wochen-Check steht auf Heute und in Stand.
- **Falsche Rückwege:** Sprechen und Business sind Reiter bzw. liegen unter Sprechen, ihr Pfeil führt aber nach **Heute**. Preply wird aus „Dein Stand“ geöffnet, zeigt aber „← Heute“. Lesen/Hören/Schreiben schließen immer nach Heute, auch wenn man aus Lernen kam. Übungen aus Heute schließen nach Lernen.
- **Sechs verschiedene Kopfzeilen** in Übungen: Trainer (× + „Karte 1 von 2“), Übung (× + „Aufgabe 1 von 8“ + Pille „Extra“), Lektion (× + Titel + Pille „Pflicht 1 von 3“, die umbricht), Lesen (× + farbiger Strich + „Lesen“, darunter nochmal „Lesen · B2 …“), Rollenspiel (← + Titel + „Beenden“), Preply („← Heute“ als Text). Nirgends ein Fortschrittsbalken.
- **App-Kopfzeile frisst Platz:** „● Lingo-Engine X“ + Claude + Einstellungen stehen auf *jedem* Bildschirm, auch mitten in der Übung (ca. 12 % der Höhe am iPhone).
- **Tab-Leiste zu eng:** Fünf reine Textbeschriftungen, „Sprechen“ und „Entdecken“ stoßen fast aneinander, keine Symbole.
- **Heute nach der Pflicht** ist 3,5 Bildschirme lang mit 13 antippbaren Dingen; genau das, was Kap. 15 („dasselbe dreimal“) verbietet.
- **Dein Stand** ist der längste Bereich: „Weg nach C1“ ist ca. 23 Bildschirmhöhen lang, „Verlauf“ hat 8 Abschnitte, die Unterreiter liegen erst unter der Falz und brechen in 2 × 2 um.

---

## 3. Neue Grundstruktur (Vorschlag)

**Tab-Leiste mit 4 Einträgen, je Symbol + kurzes Wort:**
**Heute · Üben · Sprechen · Stand**

Oben gibt es keine globale App-Kopfzeile mehr. Jeder Reiter hat eine eigene Titelzeile: großer Titel links, rechts das Claude-Symbol (überall) und auf „Stand“ zusätzlich das Zahnrad.

```
Heute
├─ Status in einer Zeile („Noch 2 von 3 · ca. 25 Min.“ · Serie)
├─ Pflichtliste; der erste offene Punkt ist aufgeklappt und hat den großen Knopf
│   └─ Übung im Vollbild (Trainer, Lektion, Kanal-Übung)
├─ nach der Pflicht: „Fertig für heute“ + EIN Vorschlag (größte Lücke) + Link „Mehr üben →“ (öffnet Reiter Üben)
├─ Wochen-Check (nur wenn fällig, eine Zeile)
└─ leise Zeilen: Tagesbilanz, Preply-Stunde heute, Nachtragen aus diesem Browser

Üben
├─ Kurs: nächste Lektion (Karte) · „Alle Lektionen“
│   └─ Lektion
├─ Wortschatz  →  Liste, Suche, Filter, Wortblatt, „Freie Runde“ (Stapel + Größe im Blatt)
├─ Grammatik   →  Themen, freie Runde, deine Fehler, Suche „Nachschlagen“ (bisher „Wissen“)
├─ Kurzübungen (2 × 2 Kacheln): Lückenjagd · Satzbau · Diktat · Sprint
└─ Lesen & Hören & Schreiben
    ├─ Lesen · Hören · Schreiben (je mit Verlauf im Bildschirm selbst)
    └─ Entdecken (Feed mit Beiträgen; Verlauf im Bildschirm)

Sprechen
├─ Umschalter oben: Szenen · Business · Preply
├─ Szenen: Szenenliste, „Neue Szene“, Wendungen aus Szenen üben
│   └─ Briefing → Rollenspiel
├─ Business: E-Mail-Refiner · Phrasen-Baukasten · Präsentations-Coach
└─ Preply: Vorbereiten · Übernehmen · Verlauf

Stand
├─ Kopf: Serie · Woche · Niveau in EINER Karte
├─ Umschalter: Urteil · Fehler · Ziel C1 · Verlauf (eine Zeile)
│   ├─ Verlauf enthält: Wochen-Check, Wortschatztest, Wochenbericht, Diagramm, Aktivität, alte Daten (zugeklappt)
└─ Zahnrad → Einstellungen (Diagnose zugeklappt)

Überall: Wort antippen → Wortblatt · Claude-Symbol → Claude fragen / Übersetzen
```

**Nur noch über „Heute“ erreichbar:** die Pflicht-Übungen des Tages (als Pflicht gezählt) und der Wochen-Check, wenn er fällig ist (zusätzlich bleibt er in Stand → Verlauf). Alles Freiwillige lebt in **Üben** oder **Sprechen**; Heute verweist nur noch mit einem Vorschlag und einem Link dorthin.

### Zuordnung alt → neu

| Heute vorhanden | Neuer Platz |
|---|---|
| Heute: Heldenkarte + Pflichtliste | Heute: eine Liste, erster offener Punkt aufgeklappt |
| Heute: Freiwillig-Vorschläge (2) | Heute: ein Vorschlag; der Rest in Üben |
| Heute: freie Vokabelrunde (Stapel, Größe) | Üben → Wortschatz → „Freie Runde“ (Blatt) · Kurzweg auf Heute als Vorschlag |
| Heute: Wochen-Check | Heute (wenn fällig) + Stand → Verlauf |
| Heute: Sprechen, Business | Reiter Sprechen |
| Heute: Lesen, Hören, Schreiben, Entdecken | Reiter Üben |
| Heute: Tagesbilanz, Preply-Zeile, Nachtragen-Hinweis | bleibt als leise Zeilen auf Heute |
| Reiter Lernen | Reiter **Üben** (umbenannt) |
| Kurs, Lektionen, Kurs erweitern | Üben → Kurs |
| Wortschatz, Wortblatt, Hinzufügen | Üben → Wortschatz |
| Grammatik, Themen, Fehler-Runde | Üben → Grammatik |
| Wissen (Nachschlagen) | Üben → Grammatik → Suchfeld „Nachschlagen“ |
| Lückenjagd, Satzbau, Diktat, Sprint | Üben → Kurzübungen |
| Lesen, Hören, Schreiben + Verlauf-Knöpfe | Üben → Lesen & Hören & Schreiben; Verlauf oben rechts im jeweiligen Bildschirm |
| Reiter Entdecken + Verlauf | Üben → Entdecken |
| Reiter Sprechen: Szenen, Neue Szene, Situationen | Sprechen → Szenen |
| Business-Hub + 3 Werkzeuge | Sprechen → Business |
| Preply-Brücke (unten in Stand) | Sprechen → Preply |
| „Als Preply-Stunde“ in Lesen/Schreiben | bleibt dort |
| Dein Stand: Kopfkacheln, Woche, Niveau | Stand: eine Kopfkarte |
| Urteil, Fehler, Weg nach C1, Verlauf | Stand: Umschalter (Weg nach C1 → „Ziel C1“) |
| Wortschatztest | Stand → Verlauf (oben, als Zeile) |
| Einstellungen (Regler-Symbol global) | Stand → Zahnrad oben rechts |
| Diagnose, Sicherung | Einstellungen → „Daten & Technik“ (Diagnose zugeklappt) |
| Claude fragen, Übersetzer | Claude-Symbol in jeder Titelzeile und in jeder Übungsleiste |
| Wort antippen | unverändert überall |
| Was ist neu, Umstellung, Fehlerzustände | unverändert |

Keine Funktion fällt weg.

---

## 4. Die wichtigsten Änderungen, nach Wirkung sortiert

### 1. Heute nach der Pflicht radikal kürzen
- **Was:** Heute, Zustand „Fertig für heute“. Vorher: 3 erledigte Karten, Freiwillig-Block mit 2 Vorschlägen, Kasten „Freie Runde“ mit 4 Stapel-Chips, 3 Größen und Knopf, Kasten Wochen-Check, Block „Sprechen und Business“, Block „Lesen, Hören, Schreiben, Entdecken“, Bilanz. 13 Ziele auf 3,5 Bildschirmen. Nachher: Überschrift „Fertig für heute“ mit kompakter Häkchen-Zeile (3 Punkte in einer Zeile), **ein** Vorschlag als Karte („Als Nächstes lohnt sich: Lückenjagd · wenig geübt“), darunter der Link „Mehr üben →“ (öffnet Üben) und, falls fällig, eine Zeile Wochen-Check. Bilanz als leise Zeile.
- **Warum:** „Eine rote Linie“ (Kap. 2.1) gilt auch nach der Pflicht. Die Blöcke wiederholen nur die Reiter (Kap. 15 „dasselbe dreimal“).
- **Aufwand:** mittel
- **Dateien:** `src/features/today/TodayScreen.tsx`, `src/features/speak/TodayOffers.tsx` (auf Heute entfernen), `src/features/input/InputOffers.tsx` (auf Heute entfernen), `src/i18n/parts/*`

### 2. Vier Reiter statt fünf, mit Symbolen: Heute · Üben · Sprechen · Stand
- **Was:** Tab-Leiste. Vorher: 5 Textreiter (Heute, Lernen, Sprechen, Entdecken, Stand), am iPhone eng. Nachher: 4 Reiter mit Symbol + Wort. Entdecken wandert nach Üben, Business und Preply nach Sprechen.
- **Warum:** Weniger Ziele, größere Tippflächen, klare Bedeutung: Pflicht · freiwillig üben · reden · Rückblick.
- **Aufwand:** mittel
- **Dateien:** `src/app/App.tsx` (TabBar), `src/app/nav.ts` (`TabName`, `tabOf`), `src/features/learn/LearnHub.tsx`, `src/features/discover/DiscoverScreen.tsx`, `src/features/speak/SpeakHub.tsx`, `src/features/preply/PreplyEntry.tsx`

### 3. Ein einheitlicher Rückweg („zurück dorthin, woher ich kam“)
- **Was:** Navigation. Vorher: Jeder Bildschirm hat sein festes Ziel (Sprechen/Business → Heute; Preply → Heute; Lesen/Hören/Schreiben → Heute; Drill → Lernen; Wochen-Check → Stand). Nachher: `nav.ts` merkt sich den Herkunftsbildschirm, und `back()` führt dorthin. Reiter-Startseiten haben **nie** einen Zurück-Pfeil.
- **Warum:** „Wie komme ich zurück?“ muss man nie überlegen. Das ist der größte Einzelgrund für das Gefühl „verschachtelt“.
- **Aufwand:** mittel
- **Dateien:** `src/app/nav.ts`, alle `go({ name: 'today' | 'learn' | 'business' … })` in Schließen-Knöpfen: `src/features/speak/SpeakHub.tsx`, `src/features/business/*.tsx`, `src/features/preply/PreplyScreen.tsx`, `src/features/read/*`, `src/features/listen/*`, `src/features/write/*`, `src/features/drills/DrillScreen.tsx`, `src/features/grammar/SessionScreen.tsx`, `src/features/vocab/TrainerScreen.tsx`, `src/features/check/CheckScreen.tsx`

### 4. Eine Übungsleiste für alle Übungen
- **Was:** Kopf jeder Vollbild-Übung. Vorher: sechs Varianten (siehe oben), dazu die App-Kopfzeile. Nachher: dieselbe Leiste überall: links ×, in der Mitte ein dünner Fortschrittsbalken mit „3 / 8“, rechts das Claude-Symbol. „Pflicht“ oder „Extra“ als kleines Wort unter dem Balken, nicht als Pille. Die App-Kopfzeile ist in Übungen ausgeblendet.
- **Warum:** Man erkennt sofort, dass man „in einer Übung“ ist, wie weit man ist und wie man rauskommt. Das spart etwa 90 px Höhe am iPhone.
- **Aufwand:** mittel
- **Dateien:** neuer Baustein in `src/ui/` (z. B. `ExerciseBar.tsx`), `src/features/vocab/TrainerScreen.tsx`, `src/features/learn/ui.tsx`, `src/features/course/LessonScreen.tsx`, `src/features/input/UnitShell.tsx`, `src/features/speak/RoleplayScreen.tsx`, `src/features/check/CheckScreen.tsx`, `src/app/App.tsx` (Kopf ausblenden, wenn `tabOf(route) === null`)

### 5. Heute im offenen Zustand: eine Liste statt Held + Liste
- **Was:** Vorher: Überschrift „Noch nicht fertig · 0 von 3 · es fehlt: Wiederholen, Lektion, Satzbau“ (4 Zeilen groß), dann Heldenkarte „Wiederholen“, darunter noch einmal „Wiederholen · offen“, „Lektion · offen“, „Satzbau · offen“, darunter „Pflicht heute: etwa 27 Minuten“. Nachher: Überschrift „Heute · 0 von 3“, kleine Zeile „ca. 27 Min. · Serie 12“. Darunter **eine** Liste; der erste offene Punkt ist groß mit Knopf „Starten“, die anderen sind schmale Zeilen mit Kreis/Häkchen.
- **Warum:** Wiederholen steht heute doppelt im ersten Bildschirm; die Überschrift wiederholt die Liste. „Häkchen, Zähler und Klickziel sagen dasselbe“ (Kap. 2.2) bleibt erfüllt, mit einem Drittel der Fläche.
- **Aufwand:** klein–mittel
- **Dateien:** `src/features/today/TodayScreen.tsx`, `src/i18n/parts/*` (`tdStatusMulti`)

### 6. „Dein Stand“ entschlacken
- **Was:** Vorher: Eyebrow „Übersicht“, Titel, Einleitung, 3 Kacheln, Karte Woche + Niveau, dann die Unterreiter (2 × 2, unter der Falz). „Weg nach C1“ ca. 23 Bildschirme lang, „Verlauf“ mit 8 Abschnitten, Preply ganz unten. Nachher: Titel „Stand“ ohne Einleitung. Eine Kopfkarte (Serie · Kurs · Wörter in einer Zeile, darunter Wochenpunkte und Niveau-Leiste). Umschalter in **einer** Zeile. „Ziel C1“ zeigt nur offene Can-dos je Einheit, erreichte sind zugeklappt („12 erreicht“). „Verlauf“: oben Wochen-Check und Wortschatztest als zwei Zeilen, der Rest als zuklappbare Abschnitte. Preply zieht nach Sprechen um.
- **Warum:** Rückblick soll in 10 Sekunden lesbar sein und nicht zum Scrollmarathon werden.
- **Aufwand:** mittel
- **Dateien:** `src/features/progress/ProgressScreen.tsx`, `StandHeader.tsx`, `PathTab.tsx`, `HistoryTab.tsx`, `JudgeTab.tsx`, `src/ui/Tabs.tsx` (eine Zeile, auch bei 390 px)

### 7. Sprechen als ein Ort für alle Gespräche (Szenen · Business · Preply)
- **Was:** Vorher: Sprechen mit Zurück-Pfeil nach Heute, lange Szenenliste inkl. kaputter „Draft scene without a counterpart“, Business ganz unten als Karte zu einem weiteren Hub mit drei großen Karten. Preply liegt in Stand. Nachher: Umschalter oben „Szenen · Business · Preply“. Die Business-Werkzeuge sind direkt als drei kompakte Zeilen sichtbar (kein Zwischenhub). Unvollständige Szenen sind unten zugeklappt („1 unvollständige Szene“). Der Statussatz „Heute offen · ein Gespräch mit mindestens 4 Zügen“ wird zur kleinen Zeile.
- **Warum:** Eine Ebene weniger, und Preply (echte Gespräche mit Lehrerin) steht dort, wo man es sucht.
- **Aufwand:** mittel
- **Dateien:** `src/features/speak/SpeakHub.tsx`, `src/features/speak/SceneCard.tsx` (bzw. Szenenliste), `src/features/business/BusinessHub.tsx` (wird zum Abschnitt), `src/features/preply/PreplyEntry.tsx`, `src/features/preply/PreplyScreen.tsx`

### 8. Üben (bisher Lernen) klar gliedern, keine Karte in Karte
- **Was:** Vorher: Einleitung „Kurs, Wortschatz, … Was heute Pflicht ist, steht auf Heute“, Kurs-Karte mit zwei Chip-Knöpfen untereinander, drei große Zeilen, dann die Karte „Üben“ mit Unterkarten Lesen/Hören/Schreiben und je einem Verlauf-Knopf daneben, dann vier große Übungszeilen. Nachher: keine Einleitung. Kurs-Karte mit einem Knopf („Weiter: Nachverhandeln und bedauern“) und Textlink „Alle Lektionen“. Wortschatz und Grammatik als zwei Zeilen (mit Fälligkeit). Kurzübungen als 2 × 2-Kacheln. „Lesen & Hören & Schreiben & Entdecken“ als eine schlichte Liste ohne Rahmen um die Liste; Verlauf gibt es im jeweiligen Bildschirm.
- **Warum:** Heute sind es vier Karten-Stile auf einer Seite; das wirkt unruhig und „webseitig“.
- **Aufwand:** klein–mittel
- **Dateien:** `src/features/learn/LearnHub.tsx`, `src/features/input/InputModules.tsx`, `src/features/input/HistoryScreen.tsx` (Einstieg aus dem Modul), `src/features/discover/DiscoverScreen.tsx`

### 9. „Wissen“ in Grammatik aufgehen lassen
- **Was:** Vorher: eigener Eintrag „Wissen“ in Lernen + Chip „Wissen“ in Grammatik; Wissen ist eine sehr lange Seite mit allen Fallen. Nachher: In Grammatik oben ein Suchfeld „Regel oder Falle suchen“; das Regelblatt je Thema zeigt die typische Falle dort, wo sie hingehört.
- **Warum:** Zwei Wege zum selben Inhalt, ein Eintrag weniger im Hub.
- **Aufwand:** klein–mittel
- **Dateien:** `src/features/grammar/GrammarScreen.tsx`, `src/features/grammar/WissenScreen.tsx`, `src/features/learn/LearnHub.tsx`

### 10. Wortschatz: Liste beginnt oben im Bild
- **Was:** Vorher: Titel, Statuszeile über zwei Zeilen, Suche, 9 Filter-Chips in 3 Reihen, Umschalter Stufe/A–Z, „152 Einträge“. Das erste Wort steht erst auf Höhe 70 % des Bildschirms. Nachher: Suche + **eine** waagrecht wischbare Chip-Reihe (Fällig, Neu, Unsicher, Sicher, Wendungen, Beruf, …), Sortierung als kleines Symbol neben der Suche, Statuszeile einzeilig („146 Wörter · 46 fällig“). „Freie Runde“ als Knopf oben rechts (statt auf Heute).
- **Warum:** Eine Liste soll Liste sein; Filter sind Werkzeug, nicht Inhalt.
- **Aufwand:** klein
- **Dateien:** `src/features/vocab/list/VocabScreen.tsx`, ggf. `src/features/vocab/list/*`

### 11. Einstellungen in drei Gruppen, Technik zugeklappt; Zugang über Stand
- **Was:** Vorher: ein Blatt von ca. 3 Bildschirmhöhen (Sprache, Darstellung, Farbthema, Lernen, Arbeitskontext, Stimme, Töne, Vibration, Daten, Quellen, Diagnose), Regler-Symbol auf jedem Bildschirm. Nachher: Gruppen „Lernen“ (Neue Wörter, Tagesziel, Arbeitskontext), „Aussehen & Ton“ (Sprache, Modus, Farbthema, Stimme, Töne, Vibration), „Daten & Technik“ (Sicherung; Quellen und Diagnose zugeklappt). Das Zahnrad sitzt oben rechts auf „Stand“.
- **Warum:** Einstellungen braucht man selten; sie sollen nicht auf jedem Bildschirm um Aufmerksamkeit bitten.
- **Aufwand:** klein
- **Dateien:** `src/features/settings/SettingsSheet.tsx`, `src/features/settings/*Section.tsx`, `src/app/App.tsx`

### 12. Kleine Doppelungen und Umbrüche beseitigen
- **Was:**
  - Wortblatt: „neu · Stufe 0 von 5 · Neu“ → „neu · Stufe 0 von 5“.
  - Lesen: Titel „Lesen“ + Zeile „Lesen · B2 · Beruf …“ → nur „B2 · Beruf · 1 Min.“.
  - Lektion: Pille „Pflicht 1 von 3“ bricht um → kleines Wort unter dem Balken (siehe Nr. 4).
  - Hub-Einleitungen („Kurs, Wortschatz …“, „Claudes Urteil über …“, „Werkzeuge für E-Mails …“) entfallen oder werden zum Info-Symbol.
  - Wortblatt „Ausblenden“ als Textknopf statt als dritter voller Knopf.
- **Warum:** Jede dieser Zeilen kostet Aufmerksamkeit und sagt nichts Neues.
- **Aufwand:** klein
- **Dateien:** `src/features/vocab/list/WordSheet.tsx`, `src/features/read/ReadUnit.tsx`, `src/features/input/UnitShell.tsx`, `src/features/course/LessonScreen.tsx`, `src/features/learn/ui.tsx` (`ScreenHeader`), `src/i18n/parts/*`

**Reihenfolge-Empfehlung:** 3 (Rückweg) → 4 (Übungsleiste) → 1 + 5 (Heute) → 2 (Reiter) → 7, 8, 9 → 6 → 10–12. Die ersten vier bringen etwa 70 % der gefühlten Ruhe.

---

## 5. Visuelle Regeln für eine cleane Optik

1. **Ein Hauptknopf je Bildschirm.** Nur die wichtigste Aktion ist blau gefüllt; alles andere ist ein Textknopf oder eine Zeile mit Pfeil. Chip-Knöpfe („Nächste Lektion öffnen“) nur für Auswahl, nie für Aktionen.
2. **Keine Karte in Karte.** Eine Liste in einer Karte bekommt Trennlinien, keine eigenen Rahmen (heute: „Üben“, „Fertigkeiten“, „Freie Runde“).
3. **Farbige Seitenstreifen nur für den Zustand „jetzt dran“.** Heute tragen Kurs, Held, Szenen, Business, Entdecken, Preply und Wochen-Check einen Farbstreifen, daher bedeutet er nichts mehr. Die Themenfarbe steckt nur im kleinen Symbol.
4. **Drei Textgrößen je Bildschirm:** Titel, Zeilentitel, Nebentext. Großbuchstaben-Überschriften (Eyebrows) höchstens eine je Abschnitt, nie über dem Seitentitel.
5. **Keine Einleitungssätze unter Titeln.** Der Zweck steht hinter einem ⓘ (wie schon in den Übungen).
6. **Eine Zeilenform für „öffnen“:** Symbol links, Titel + eine Nebenzeile, Pfeil rechts, gleiche Höhe (min. 56 px). Keine großen Kachel-Karten mit Symbol oben (Business, Playbook), außer für die 2 × 2-Kurzübungen.
7. **Eine Leiste für Übungen, eine Titelzeile für Reiter.** Übung: × · Balken · Claude. Reiter: Titel links, Claude (und auf Stand das Zahnrad) rechts. Kein Zurück-Pfeil auf Reiter-Startseiten.
8. **Zustände als Wort in Grau, nicht als Pille.** „erledigt“, „Extra“, „Pflicht“, „heute geübt“ stehen als Nebentext; Pillen nur für echte Warnungen (z. B. „9 Fehler fällig“).
9. **Abstände nach Raster:** 8 px innerhalb einer Zeile, 16 px zwischen Zeilen, 32 px zwischen Abschnitten; Außenrand am iPhone überall 16 px.
10. **Was nicht nutzbar ist, wird nicht gezeigt.** Unvollständige Szenen, leere Verläufe und ausgegraute Werkzeuge ohne KI landen in einer zugeklappten Zeile, nicht als Karte in der Hauptliste.

---

## 6. Beweisfotos

Pfad-Präfix: `/tmp/claude-0/-home-user-lingo-engine-x/fc49be48-ccd3-5daa-ba60-72e3e74ab73c/scratchpad/ux/shots/`

| Befund | Foto |
|---|---|
| Heute nach der Pflicht: 13 Ziele, Doppelungen | `02-heute-fertig-ganz.png`, `40-desktop-heute.png` |
| Heute offen: Überschrift 4 Zeilen, „Wiederholen“ doppelt, enge Tab-Leiste | `01-heute-offen.png`, `30-hell-heute.png` |
| Lernen: vier Kartenstile, Karte in Karte, Einleitung | `03-lernen.png`, `31-hell-lernen.png`, `41-desktop-lernen.png` |
| Sprechen: Zurück-Pfeil auf Reiter, kaputte Szene, Business ganz unten | `15-sprechen.png`, `32-hell-sprechen.png` |
| Hub in Hub (Business, Playbook) | `17-business.png`, `18-playbook.png` |
| Stand: Kopf zu hoch, Reiter 2 × 2 unter der Falz | `52-stand-oben.png`, `20-dein-stand.png` |
| „Weg nach C1“ ca. 23 Bildschirme, Verlauf mit 8 Abschnitten | `21-stand-path.png`, `21-stand-history.png` |
| Preply „← Heute“, obwohl aus Stand geöffnet | `24-preply.png` |
| Unterschiedliche Übungsköpfe | `10-trainer-frage.png`, `13-luecken-uebung.png`, `05-lektion.png`, `14-lesen.png`, `54-rollenspiel.png` |
| Übung nach dem Prüfen (gut gelöst, Vorbild für Ruhe) | `50b-trainer-nach-pruefen-ganz.png` |
| Wortschatz: Liste erst bei 70 % Höhe | `51-wortschatz-oben.png`, `06-wortschatz.png` |
| Wortblatt: „Neu“ doppelt, drei volle Knöpfe | `07-wortblatt.png` |
| Wort antippen (gut gelöst) | `12-wort-antippen.png` |
| Grammatik / Wissen doppelt | `08-grammatik.png`, `09-wissen.png` |
| Entdecken als eigener Reiter | `19-entdecken.png` |
| Einstellungen: lang, Diagnose offen | `23-einstellungen.png`, `23b-einstellungen-mitte.png` |
| Begleiter (gut gelöst) | `22-begleiter.png` |

Hinweis: In ganzseitigen Fotos erscheint die Tab-Leiste mitten im Bild. Das kommt vom Foto-Verfahren und ist kein Fehler der App.
