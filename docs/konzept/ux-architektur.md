# UX-Architektur und User Journey – Lingo-Engine X (Neuansatz)

Stand 27.09.2026 · Grundlage: `docs/konzept/briefing.md`, `docs/ux-beratung.md`, die jetzige App (`src/app/nav.ts`, `App.tsx`, `features/today|learn|vocab|speak`) und die Bildschirmfotos `scratchpad/ux/after/`.
Maßstab: Linear (Ruhe, Tempo), Things (Klarheit, Zustand statt Knopf), Babbel (Kurs als Rückgrat), Duolingo (ein Hauptweg pro Tag), LingQ (Lesen mit Wort-Antippen), Speak (Sprechen als eigener Raum), Anki (Stapel, 40 Karten am Stück).

---

## 0. Befund in fünf Sätzen

Die Aufräumrunde vom 27.09. hat die Oberfläche ruhiger gemacht (vier Reiter, eine Übungsleiste, „Fertig für heute“ mit einem Vorschlag). Die **Architektur** dahinter ist aber noch die alte: Der Reiter „Üben“ ist ein Sammelbecken für elf Dinge, der Wortschatz ist eine Zeile unter „Kurs“, und „Anki“ gibt es als Begriff und als Ort gar nicht. Lesen, Hören, Schreiben und Entdecken sind vier Module statt einer Bibliothek, und ein Wort aus dem Übersetzer hat keinen Weg in den Stapel. Die Pflicht besteht aus drei getrennten Übungen, zwischen denen man jedes Mal zurück nach „Heute“ muss. Und eine Übung, die beim Neuladen abbricht, fängt von vorn an; genau das nennt Emrah „stürzt ab“.

Dieses Konzept ordnet die App deshalb nach **drei Lerntätigkeiten** (Wiederholen, Lesen/Hören, Sprechen/Schreiben) um einen **Tagesweg** herum, statt nach technischen Modulen.

---

## 1. Grundprinzipien (8)

1. **Ein Hauptweg pro Tag.** „Heute“ zeigt genau eine Tageseinheit mit einem großen Knopf. Sie ist *eine* durchgehende Sitzung von 20–30 Min., keine drei Übungen mit Rückkehr zwischendurch. Alles andere ist sichtbar freiwillig.
2. **Höchstens 3 Tipps bis zu jeder Übung.** Tageseinheit: 1 Tipp. Anki-Stapel: 2 Tipps. Artikel lesen: 2 Tipps. Gespräch starten: 3 Tipps. Keine Übung liegt tiefer.
3. **Jede Tätigkeit hat genau einen Ort.** Wörter wohnen in „Wortschatz“, Texte in „Lesen“, Gespräche und Texte, die Emrah selbst produziert, in „Sprechen“. Kein Angebot steht an zwei Stellen. „Heute“ verweist nur, es beherbergt nichts doppelt.
4. **Jede Übung ist vollbildig und unterbrechungsfest.** Schließen, Neuladen, Tab-Wechsel oder App-Absturz: Beim nächsten Öffnen steht „Weiter, wo du warst“ oben auf dem Ort, von dem man kam. Ein Tipp führt genau zur Karte, zum Satz oder zur Gesprächsrunde zurück, inklusive halb getipptem Text. Nichts beginnt von vorn.
5. **Sofort, dann klüger.** Jeder Tipp reagiert in unter 100 ms sichtbar. KI (1–10 s) arbeitet immer *neben* dem Ablauf: Sie füllt Beispiele, Rückmeldungen und neue Texte nach, blockiert aber nie den nächsten Schritt. Es gibt keine leeren Warteflächen, sondern Skelette oder vorbereitete Inhalte.
6. **Zustand statt Knopf.** Erledigtes wird zum ruhigen Häkchen, nie zum zweiten Knopf. Zähler, Häkchen und Klickziel sagen immer dasselbe (Kap. 2.2).
7. **Die App bewertet, der Mensch lernt.** Im Tippen-Modus benotet die App aus Richtigkeit, Zeit und Hilfe. Im Anki-Modus gibt es nur zwei ehrliche Knöpfe („Nicht gewusst“ / „Gewusst“). Die Feinstufe (Schwer/Gut/Leicht) leitet die App aus der Zeit ab (Abschnitt 4b).
8. **Ruhig wie Things, schnell wie Linear.** Ein gefüllter Knopf je Bildschirm, keine Karte in Karte, keine Einleitungssätze, Zustände als graues Wort. Bewegung bestätigt, sie schmückt nicht (150–250 ms).

---

## 2. Navigation

### 2.1 Tab-Leiste: 4 Reiter, Symbol + Wort

| Reiter | Symbol | Inhalt | Warum eigener Reiter |
|---|---|---|---|
| **Heute** | Sonne | Tageseinheit, Kursfortschritt, ein Vorschlag nach der Pflicht, Einstieg in Kurs und Grammatik | Der tägliche Hauptweg (Duolingo/Babbel-Home). Beim Öffnen immer hier. |
| **Wortschatz** | Karten-Stapel | Stapel (Anki), alle Wörter und Wendungen, Hinzufügen, Übersetzer-Übernahmen | Emrahs wichtigste Klage: „Vokabeltrainer nicht auffindbar“, „kein Anki-Modus“. Der Stapel ist das Werkzeug, das er täglich zusätzlich nutzt. Er gehört in die Leiste und nicht unter „Üben → Kurs → Zeile 1“. |
| **Lesen** | Aufgeschlagenes Buch | Bibliothek: Artikel, Hörtexte, Entdecken-Feed, eigene Texte einfügen | Input ist der größte Hebel von B2 zu C1 (LingQ). Lesen, Hören und Entdecken sind *eine* Tätigkeit mit derselben Wortmechanik, also ein Ort. |
| **Sprechen** | Sprechblase | Gespräche (Szenen), Schreiben (E-Mail, Sag es, Tonlagen), Preply | Output. Alles, wo Emrah selbst formuliert, lebt hier, auch Preply mit der echten Lehrerin. |

**Nicht in der Leiste, sondern oben rechts in jeder Titelzeile:**
- **Profil-Knopf** (runder Kreis mit Serienzahl, z. B. „12“): öffnet **Stand** (Fortschritt, Urteil, Wochenbericht) und von dort die **Einstellungen**. Das ist das Muster von Duolingo, Babbel und Speak: Rückblick ist wichtig, aber nicht täglich, und deshalb kein Reiter.
- **Claude-Knopf** (Funkeln): öffnet das Blatt **Claude** mit Umschalter **Übersetzen · Fragen**. Es steht auf jedem Bildschirm, auch in jeder Übungsleiste, und kennt den Kontext (aktueller Satz, aktuelles Wort).

**Warum nicht „Üben“ als Reiter?** „Üben“ ist heute ein Sammelbecken (Kurs, Wortschatz, freie Runde, Grammatik, vier Kurzübungen, Lesen, Hören, Schreiben, Entdecken). Ein Reiter, der alles enthält, sagt nichts. Die Inhalte verteilen sich nun nach Tätigkeit:
- **Kurs und Grammatik** sind der Lehrplan. Sie speisen die Tageseinheit und liegen auf **Heute** unterhalb der Tageskarte („Dein Kurs“).
- **Kurzübungen** (Lückenjagd, Satzbau, Diktat, Sprint) sind Übungs*formen*, keine Orte. Sie laufen innerhalb der Tageseinheit, einer Grammatik-Runde oder eines Stapels. Frei startbar sind sie über Grammatik → „Freies Training“.

### 2.2 Wo liegt was?

| Funktion | Ort | Tipps ab Start |
|---|---|---|
| Tageseinheit | Heute → „Weiter“ | 1 |
| **Wortschatz / Anki-Stapel** | Reiter Wortschatz → Stapel „Fällig · 46“ → Start | 2 |
| Wort nachschlagen, Wortblatt | Wortschatz → Suche → Wort | 2–3 |
| Kurs, Lektion | Heute → „Dein Kurs“ → Lektion | 2–3 |
| Grammatik (Thema, Fehler-Runde, Nachschlagen) | Heute → „Grammatik“ → Thema | 2–3 |
| **Lesen (LingQ-artig)** | Reiter Lesen → Artikel | 2 |
| Hören | Reiter Lesen → Filter „Hören“ → Text (Leser mit Audio-Leiste) | 2–3 |
| Entdecken (Tagesauftrag) | Reiter Lesen → oberste Reihe „Heute neu“ | 2 |
| **Sprechen** (Rollenspiel) | Reiter Sprechen → Szene → „Gespräch starten“ | 3 |
| Business-Training (Pitch, Flüssigkeit 90/60/45, Termin) | Sprechen → Abschnitt „Training“ | 2 |
| Schreiben (E-Mail-Refiner, Sag es, Tonlagen, freies Schreiben) | Sprechen → Umschalter „Schreiben“ | 2–3 |
| **Preply** | Sprechen → Umschalter „Preply“ | 2 |
| **Fortschritt** | Profil-Knopf (oben rechts) | 1 |
| Wortschatztest, Wochen-Check | Profil → Stand → „Tests“ (Wochen-Check zusätzlich als Zeile auf Heute, wenn fällig) | 2–3 |
| **Einstellungen** | Profil → Zahnrad | 2 |
| **Übersetzer** | Claude-Knopf (überall) → „Übersetzen“ | 1 |
| **Claude fragen** | Claude-Knopf (überall) → „Fragen“ | 1 |
| Wort antippen | jedes englische Wort, überall | 0 |

### 2.3 Navigationsregeln

- **Reiter-Startseiten** haben großen Titel links, rechts Profil + Claude, nie einen Zurück-Pfeil.
- **Unterseiten** (Kurs, Grammatik, Stapel-Übersicht, Preply) schieben sich von rechts ein und haben „‹ Heute“ bzw. „‹ Wortschatz“ oben links, also den Namen der Herkunft. Am iPhone geht es auch mit Wischen vom linken Rand zurück.
- **Übungen** (Tageseinheit, Stapel-Sitzung, Lektion, Leser, Gespräch, Schreiben) sind Vollbild ohne Tab-Leiste mit **einer** Übungsleiste: `×` · Fortschrittsbalken „12 / 40“ · Claude. „×“ fragt nie „Wirklich beenden?“, denn es wird ja nichts verloren (Prinzip 4). Es zeigt nur kurz „Gespeichert. Du kannst jederzeit weitermachen.“
- **Blätter** (Wortblatt, Claude, Stapel-Einstellungen, Hinzufügen) kommen von unten, halbe oder volle Höhe, und schließen per Wischen nach unten.
- **Ein Reiterwechsel** merkt sich Bildlauf und Unterseite je Reiter, wie in iOS üblich. Ein zweiter Tipp auf den aktiven Reiter führt zu dessen Startseite.

---

## 3. Bildschirm-Liste (14 Hauptbildschirme + 3 Blätter)

Texte in „…“ sind echte Oberflächentexte (Deutsch). `[Knopf]` = gefüllter Hauptknopf, `(Zeile ›)` = Listenzeile mit Pfeil.

### 3.1 Heute (Reiter)
**Zweck:** In 2 Sekunden klar, was heute dran ist. **Hauptaktion:** Tageseinheit starten oder fortsetzen.

```
Heute                                   (12)  ✦
So, 27. September · Serie 12 Tage
┌──────────────────────────────────────────────┐
│ DEINE TAGESEINHEIT          ◔ 0 von 4 · 25 Min│
│ Einwände vom CFO entkräften                   │  ← Thema des Tages (Kurs-Lektion)
│ ● Wiederholen · 18 Karten                     │
│ ○ Neu: 6 Wendungen zum Thema                  │
│ ○ Lektion 7 · Grammatik: Konditional II       │
│ ○ Sag es: Antworte dem CFO in 3 Sätzen        │
│ [ Starten → ]                                 │
└──────────────────────────────────────────────┘
↻ Weiter, wo du warst: Stapel „Beruf“, Karte 23 von 40   ›   (nur wenn offen)

DEIN KURS
(Einheit 2 · Verhandeln ···········○  7 von 24 ›)
(Grammatik · 9 Fehler fällig                    ›)

Wochen-Check fällig · 12 Aufgaben ohne Tipps    ›   (nur Sonntag/fällig)
```
- Die vier Punkte sind **Abschnitte einer Einheit**, nicht vier Knöpfe. Der Knopf heißt „Starten“, „Weiter“ (mitten drin) oder verschwindet (fertig).
- **Nach der Pflicht:** Die Karte schrumpft zu „✓ Fertig für heute · 26 Min. · 94 % richtig“. Darunter steht **ein** Vorschlag („Lohnt sich jetzt: Artikel ‚Why CFOs hate SaaS pricing‘ · 4 Min. ›“) und die leise Zeile „Preply heute 18:00 · Vorbereiten ›“, wenn eine Stunde ansteht.

### 3.2 Übungs-Player (Vollbild, für Tageseinheit, Lektion, Grammatik-Runde)
**Zweck:** Eine Aufgabe nach der anderen, ohne Nachdenken über Navigation. **Hauptaktion:** „Prüfen“, danach „Weiter“.

```
×   ▬▬▬▬▬▬▬▬▬░░░░░░░  9 / 32              ✦
    Wiederholen · Pflicht
────────────────────────────────────────────
●●○○○ unsicher · Lücke tippen        ⓘ
We need to ___ the on-premise version by 2028.
            [p _ _ _ _   o _ _]              ← Eingabe in der Lücke
Auslaufen lassen

                         [ Prüfen ]           ← über der Tastatur, per visualViewport
```
- Nach dem Prüfen klappt unten ein Blatt auf: „Richtig: phase out“ · Wortart · 2 Beispielsätze · ▶ Aussprache · „Claude fragen“. Jedes Wort ist antippbar. Einziger Knopf: `[Weiter]`.
- **Übergang zwischen Abschnitten** (z. B. Wiederholen → Neu): Eine ruhige Zwischenkarte für 1 Tipp: „✓ Wiederholen geschafft · 18 Karten · 2 Min. — Als Nächstes: 6 neue Wendungen zu ‚Einwände‘“ `[Weiter]`. Kein Rücksprung nach Heute.
- **Ende:** Zusammenfassung (siehe Journey a).

### 3.3 Kurs (Unterseite von Heute)
**Zweck:** Lehrplan überblicken und eine Lektion vorziehen. **Hauptaktion:** nächste Lektion öffnen.

```
‹ Heute              Kurs
Einheit 2 · Verhandeln              7 von 24
[ Weiter: Nachverhandeln und bedauern → ]

EINHEIT 1 · ERSTKONTAKT            ✓ 4 von 4  (zugeklappt)
EINHEIT 2 · VERHANDELN
  ✓ Preis begründen
  ✓ Einwände vom CFO
  ● Nachverhandeln und bedauern     heute
  ○ Kompromiss formulieren
EINHEIT 3 · PRÄSENTIEREN …          (zugeklappt)
```

### 3.4 Grammatik (Unterseite von Heute)
**Zweck:** Themen nach Beherrschung, Fehler wiederholen, nachschlagen. **Hauptaktion:** „Fehler-Runde · 9“.

```
‹ Heute            Grammatik
🔍 Regel oder Falle suchen
[ Fehler-Runde starten · 9 fällig ]
UNSICHER
(Konditional II        ●●○○○  ›)
(Present Perfect vs. Past  ●●●○○ ›)
SICHER (12)  ›                      (zugeklappt)
C1-WERKZEUGKASTEN (7)  ›
FREIES TRAINING
  Lückenjagd · Satzbau · Diktat · Sprint     (2 × 2 kleine Kacheln)
```
Regelblatt eines Themas: Regel in 3 Sätzen, 3 Beispiele, „Typische Falle für Deutsche“, `[Üben · 8 Aufgaben]`.

### 3.5 Wortschatz (Reiter)
**Zweck:** Der Anki-Ort. Stapel wiederholen, Wörter finden und pflegen. **Hauptaktion:** fälligen Stapel starten.

```
Wortschatz                              (12)  ✦
🔍 Wort oder Wendung suchen                +
┌──────────────────────────────────────────────┐
│ Alle fälligen                         46      │
│ ca. 7 Min. · 12 neu dabei                    │
│ [ Wiederholen → ]                            │
└──────────────────────────────────────────────┘
STAPEL
(▣ Beruf · Verhandeln       18 fällig   ›)
(▣ Aus Artikeln             11 fällig   ›)
(▣ Preply                    7 fällig   ›)
(▣ Alltag                    4 fällig   ›)
(▣ Wendungen                 6 fällig   ›)
+ Stapel anlegen

ZULETZT HINZUGEFÜGT
(phase out  · auslaufen lassen   neu    ›)
(leverage   · nutzen, ausspielen neu    ›)
Alle 252 Einträge ›
```
- **Stapel** sind gespeicherte Filter (Quelle, Thema, Art, eigene Auswahl), keine Kopien. Eine Karte kann in mehreren Stapeln vorkommen, ihr FSRS-Stand ist einer. Automatische Stapel: „Aus Artikeln“, „Aus Gesprächen“, „Preply“, „Übersetzer“.
- `+` öffnet das Blatt „Hinzufügen“ (Englisch, Deutsch, Satz; KI ergänzt Lautschrift, Beispiele, Wortart im Hintergrund).
- „Alle 252 Einträge“ zeigt die Liste: Suche, **eine** wischbare Filterreihe (Fällig · Neu · Unsicher · Sicher · Wendungen · Beruf), Sortierung als Symbol.

### 3.6 Stapel-Sitzung (Vollbild)
**Zweck:** 20–60 Karten am Stück, schnell, ohne Ablenkung. **Hauptaktion:** Antwort geben, nächste Karte.

```
×   ▬▬▬▬▬▬░░░░░░░░░░  12 / 40     Aa  ✦    ← Aa = Modus: Tippen / Aufdecken
────────────────────────────────────────────
Beruf · Verhandeln
         to leverage something
 „We can leverage our existing partner network.“  ▶

         [ Antwort zeigen ]           (Aufdecken-Modus)
nach dem Aufdecken:
         etwas nutzen, ausspielen
         [ Nicht gewusst ]   [ Gewusst ]
         ← wischen            wischen →
```
- **Zwei Modi, ein Stapel** (Empfehlung, siehe 4b): **Tippen** (Standard in der Tageseinheit, App bewertet) und **Aufdecken** (Anki-Modus, Standard in der Stapel-Sitzung, einstellbar über „Aa“ und gemerkt je Stapel).
- Wischen links/rechts = Nicht gewusst/Gewusst. Rückgängig per Schütteln-Ersatz: kleiner Knopf „↶“ oben für 5 s.
- Alle 20 Karten eine Mini-Pause: „20 geschafft · 2:41 Min. · weiter?“ `[Weiter]` · „Für heute reicht’s“.

### 3.7 Wortblatt (Blatt, von überall)
**Zweck:** Alles zu einem Wort an einem Ort. **Hauptaktion:** hören / in den Stapel.

```
leverage  /ˈlev.ɚ.ɪdʒ/  ▶          Verb · C1
nutzen, ausspielen (Vorteil)
„We can leverage our existing partner network.“  · aus: Artikel „SaaS pricing“
Weitere Beispiele (2) ▾
●●○○○ unsicher · fällig morgen · in Stapel: Beruf, Aus Artikeln
[ Im Wortschatz ✓ ]   Claude fragen ›   Ausblenden
```

### 3.8 Lesen (Reiter, Bibliothek)
**Zweck:** Passenden Input finden. **Hauptaktion:** Artikel öffnen.

```
Lesen                                   (12)  ✦
Alle · Lesen · Hören · Beruf · Alltag      (wischbare Filterreihe)
HEUTE NEU
[Karte] Why CFOs hate SaaS pricing          ← Entdecken-Feed, 1 große Karte
        B2+ · Beruf · 4 Min. · 7 neue Wörter
WEITERLESEN
(Negotiating with procurement  · 60 %  ›)
FÜR DICH
(🎧 Podcast-Ausschnitt: Pricing in Europe · 3 Min. ›)
(📄 The quiet death of on-premise · 5 Min.         ›)
+ Eigenen Text einfügen
Verlauf ›
```
- „7 neue Wörter“ berechnet die App aus dem Wortschatz (LingQ-Prinzip „Anteil bekannter Wörter“). Ziel: 90–98 % bekannt.

### 3.9 Leser (Vollbild, auch für Hören)
**Zweck:** Lesen oder hören, unbekannte Wörter mit einem Tipp sammeln. **Hauptaktion:** Wort antippen.

```
×   ▬▬▬▬░░░░░░░░  Absatz 2 / 6           Aa  ✦
Why CFOs hate SaaS pricing
B2+ · Beruf · 4 Min.
Most finance leaders don’t object to the price.
They object to the ┈unpredictability┈ of it. …   ← unbekannte Wörter leicht unterstrichen,
                                                   gesammelte in Akzentfarbe
────────────────────────────────────────────
▶ ━━━━━●──────  0:48 / 3:10   1×   (nur bei Hörtexten, fest unten)
Gesammelt: 3 Wörter ›
[ Fertig gelesen ]          (am Textende)
```
- **Wort antippen** → kleines Popover direkt am Wort: Bedeutung *im Kontext*, Lautschrift, ▶, `[+ Wortschatz]`. Ein Tipp auf `+` speichert die Karte mit genau diesem Satz als Ursprungssatz in den Stapel „Aus Artikeln“, markiert das Wort und zeigt „✓ im Stapel“. Kein Blatt, kein Formular.
- **Lange drücken und ziehen** markiert eine Wendung („object to the price“) und bietet dasselbe.
- „Fertig gelesen“ → 3 Verständnisfragen (freiwillig, 1 Min.) → „3 Wörter gesammelt · erste Wiederholung morgen“.

### 3.10 Sprechen (Reiter)
**Zweck:** Output trainieren. **Hauptaktion:** Gespräch starten.

```
Sprechen                                (12)  ✦
[ Gespräche · Schreiben · Preply ]      (Umschalter, eine Zeile)
── Gespräche ──
FÜR HEUTE EMPFOHLEN
[Karte] Den Supportvertrag neu verhandeln
        Sandra Whitfield · Head of Operations · C1
        [ Gespräch starten ]
TRAINING
(⏱ Flüssigkeit 90 · 60 · 45           ›)
(🎯 Mein nächster Termin               ›)
(🗣 Pitch-Coach                         ›)
ALLE SZENEN (14) ›       + Neue Szene
```
- **Schreiben:** (E-Mail verbessern ›) (Sag es · heute Pflicht ✓ ›) (Eine Botschaft, drei Tonlagen ›) (Freies Schreiben ›) (Phrasen-Baukasten ›).
- **Preply:** nächste Stunde oben („Do 18:00 mit Lisa · Vorbereiten ›“), darunter „Stunde nachbereiten“ (Notizen einfügen → Wörter und Fehler in den Stapel) und Verlauf.

### 3.11 Gespräch (Vollbild, Rollenspiel)
**Zweck:** Realistisches Gespräch mit KI-Gegenüber. **Hauptaktion:** Antwort senden.

```
×   Supportvertrag · Zug 3 von ≥ 4          ✦
Briefing ▾ (zugeklappt: Ziel, Gegenüber, 3 Wendungen)
[Sandra] We’d need a 15 % discount to renew.   ▶
[Du]     I understand. However, …
         ▸ Analyse: 1 Tipp · „renew“ statt „prolong“
────────────────────────────────────────────
[ Deine Antwort …                        ➤ ]
Hilfe: Wendung vorschlagen · Deutsch → Englisch
```
Ende: Bericht (Stärken, 3 Verbesserungen, Wendungen „Mitnehmen → Stapel ‚Aus Gesprächen‘“).

### 3.12 Schreibwerkstatt (Vollbild, gemeinsam für E-Mail, Sag es, Tonlagen, freies Schreiben)
**Zweck:** Text formulieren, verbessern lassen, zweiter Durchgang. **Hauptaktion:** „Prüfen lassen“.
Aufbau: Aufgabe (eine Zeile) · Textfeld (Entwurf wird laufend gesichert) · `[Prüfen lassen]` · danach Vergleich „Deine Fassung / Bessere Fassung“ mit markierten Stellen · `[Nochmal, aber besser]`.

### 3.13 Preply (Unterseite von Sprechen)
**Zweck:** Stunde vor- und nachbereiten. **Hauptaktion:** „Vorbereitung erstellen“ bzw. „Notizen übernehmen“.

### 3.14 Stand (über Profil-Knopf, Vollbild-Unterseite)
**Zweck:** In 10 Sekunden sehen, wo ich stehe. **Hauptaktion:** keine (Rückblick). Zahnrad oben rechts → Einstellungen.

```
‹ Zurück              Stand                    ⚙
B2 → B2+   „Du verhandelst sicher, unter Zeitdruck
            fehlen dir noch Nebensätze.“  – Claude, Mo
Serie 12 · Woche ● ● ● ● ● ● ○ · 146 Wörter sicher
[ Urteil · Fehler · Ziel C1 · Verlauf ]   (eine Zeile)
…Inhalt des gewählten Teils, Abschnitte zugeklappt…
TESTS
(Wortschatztest · zuletzt vor 3 Wochen ›)
(Wochen-Check · So fällig             ›)
```

### Blätter (keine Hauptbildschirme)
- **Claude** (von überall): Umschalter **Übersetzen · Fragen**. Details siehe Journey d.
- **Wortblatt** (3.7).
- **Einstellungen** (aus Stand): drei Gruppen „Lernen“ (Tagesziel, neue Wörter pro Tag, Stapel-Modus Standard, Arbeitskontext), „Aussehen & Ton“ (Sprache, Modus, Farbe, Stimme, Töne), „Daten“ (Sicherung; Diagnose zugeklappt).

---

## 4. Die wichtigsten Journeys

### (a) Morgens App öffnen → Tageseinheit → fertig  (1 Tipp bis zur ersten Aufgabe)

1. **Öffnen.** Heute erscheint in unter 1 s aus dem zuletzt bekannten Stand (lokaler Schnappschuss), die Live-Daten gleichen dahinter ab. Oben „So, 27. September · Serie 12 Tage“, darunter die Tageskarte „Einwände vom CFO entkräften · 0 von 4 · 25 Min.“ mit `[Starten →]`.
2. **Tipp auf Starten.** Der Player gleitet von unten ein (200 ms). Abschnitt 1 **Wiederholen**: 18 fällige Karten im Tippen-Modus mit gemischten Abfragearten.
3. **Zwischenkarte:** „✓ Wiederholen · 18 Karten · 3 Min. — Als Nächstes: 6 neue Wendungen zu ‚Einwände‘.“ `[Weiter]`.
4. Abschnitt 2 **Neu:** Jede neue Wendung erst als Vorstellkarte (Satz, ▶, Bedeutung), dann sofort eine leichte Abfrage. Die Wendungen kommen aus dem Thema der Lektion, sie sind also kombiniert (Kap. 2.5).
5. Abschnitt 3 **Lektion + Grammatik:** 8–10 Aufgaben, die dieselben Wendungen im Konditional II verwenden.
6. Abschnitt 4 **Sag es:** „Der CFO sagt: ‚Your price is 20 % above the competition.‘ Antworte in 2–3 Sätzen.“ Emrah tippt. Die Rückmeldung kommt nach 2–6 s; bis dahin steht „Claude liest …“ als Skelett, und `[Nochmal, aber besser]` ist schon sichtbar.
7. **Unterbrechung** (Anruf, Safari lädt neu): Beim Öffnen steht auf Heute die Karte mit „Weiter · Abschnitt 4 von 4“ und dem Entwurf im Textfeld. Ein Tipp führt zurück.
8. **Fertig-Bildschirm** (im Player): großes ruhiges Häkchen, „Fertig für heute“, drei Zahlen (26 Min. · 94 % richtig · 6 neue Wendungen), eine Zeile „Serie 13 Tage“ mit kurzer Animation (Zahl zählt hoch, 400 ms), `[Fertig]`.
9. **Zurück auf Heute:** Karte als erledigter Zustand, darunter **ein** Vorschlag (z. B. passender Artikel). Kein weiterer Druck.

### (b) Anki-Stapel wiederholen, 40 Karten am Stück  (2 Tipps)

1. **Reiter Wortschatz** (Tipp 1). Oben „Alle fälligen · 46 · ca. 7 Min.“ oder darunter ein Stapel, z. B. „Beruf · Verhandeln · 18 fällig“.
2. Tipp auf `[Wiederholen →]` (Tipp 2). Beim ersten Mal fragt ein kleines Blatt einmalig: „Wie viele Karten?“ `20 · 40 · Alle 46`, dazu „Modus: Aufdecken (wie Anki) · Tippen“. Die Wahl wird gemerkt, danach startet die Sitzung sofort.
3. **Karte:** Vorderseite Englisch mit Ursprungssatz und ▶. Tipp irgendwo oder Leertaste → Rückseite (Bedeutung, Beispiele) mit Umdrehen-Animation (180 ms).
4. **Bewerten:** `[Nicht gewusst]` / `[Gewusst]` oder wischen. Die nächste Karte ist bereits vorgerendert, der Wechsel dauert unter 50 ms. Die Speicherung läuft im Hintergrund.
5. „Nicht gewusst“-Karten kommen innerhalb der Sitzung nach 5–8 Karten erneut (Lernschritt), der Balken zählt sie ehrlich mit („40 + 3 Wiederholungen“).
6. **Nach 20:** Mini-Pause „20 geschafft · 2:41 Min.“ `[Weiter]`.
7. **Ende:** „40 Karten · 34 gewusst · 6 wieder morgen · 6:12 Min.“ und „Schwierigste: leverage, albeit, to be on the fence“ → `[Diese 3 nochmal tippen]` (freiwillig, Tippen-Modus) · `[Fertig]`.
8. Zählt als **Extra**, nicht als Pflicht. Hat Emrah die Pflicht-Wiederholung noch offen, rechnet die Tageseinheit die hier wiederholten Karten ab („Wiederholen · bereits erledigt ✓“). Doppelte Arbeit gibt es nicht.

#### 4b. Anki-Modus und „keine Selbstbewertung“: Empfehlung
- **Tippen (Standard in der Tageseinheit):** Emrah produziert die Antwort, die App benotet aus Richtigkeit, Zeit und Hilfe (bisherige Entscheidung bleibt).
- **Aufdecken (Standard in der Stapel-Sitzung):** nur zwei Knöpfe, **Nicht gewusst / Gewusst**, keine vier Anki-Knöpfe. Die Feinstufe setzt die App: „Gewusst“ nach < 4 s = Leicht, 4–10 s = Gut, > 10 s = Schwer. Das entspricht der FSRS-Empfehlung (Again/Good tragen fast die ganze Information) und vermeidet das Grübeln, das Emrah an der Selbstbewertung gestört hat.
- **Warum beides:** Aufdecken ist 3–4 × schneller (40 Karten in 6 Min.) und passt zu „schnell den Stapel durch“. Tippen erzeugt stärkere Erinnerung (Produktion). Karten mit Stufe ≤ 2 oder mehrfach „Nicht gewusst“ erscheinen deshalb in der Tageseinheit bevorzugt im Tippen-Modus.

### (c) Artikel lesen → Wörter antippen → im Stapel → später wiederholen  (2 Tipps bis zum Lesen)

1. **Reiter Lesen** (Tipp 1) → „Heute neu: Why CFOs hate SaaS pricing · 7 neue Wörter“ (Tipp 2). Der Leser öffnet sofort, weil der Text vorab geladen wurde (Tagesauftrag/Feed).
2. Emrah liest. Unbekannte Wörter sind dezent punktiert unterstrichen (nicht im Wortschatz). Bekannte bleiben unmarkiert.
3. **Tipp auf „unpredictability“** → Popover in 100 ms am Wort mit Wörterbuch-Bedeutung aus dem lokalen Wörterbuch. Die Bedeutung *im Kontext* folgt von Claude nach 1–3 s („Unberechenbarkeit (der Kosten)“) und ersetzt die allgemeine sanft.
4. **Tipp auf `+ Wortschatz`** → Haptik/kurzer Puls, Wort färbt sich in Akzentfarbe, Popover zeigt „✓ im Stapel ‚Aus Artikeln‘“ und schließt nach 800 ms selbst. Gespeichert werden Wort, Bedeutung im Kontext, **der Satz aus dem Artikel als Ursprungssatz** und die Quelle.
5. Unten zählt „Gesammelt: 3 Wörter“ mit. Ein Tipp darauf zeigt die Liste mit Rückgängig je Wort.
6. Unterbrechung → „Weiterlesen · 60 %“ auf dem Reiter Lesen und als Zeile auf Heute, an derselben Stelle im Text.
7. `[Fertig gelesen]` → optional 3 Verständnisfragen → „3 Wörter gesammelt · erste Wiederholung morgen“.
8. **Morgen:** Die drei Wörter erscheinen (a) als **Neu**-Abschnitt in der Tageseinheit mit ihrem Artikelsatz als Lücke und (b) im Stapel „Aus Artikeln“ als fällig. Die Wortblatt-Zeile „aus: Artikel ‚SaaS pricing‘“ führt zurück zum Text.

### (d) Übersetzer → „+ Wortschatz“ für jedes Wort  (1 Tipp bis zum Übersetzer)

1. **Claude-Knopf** (oben rechts, überall) → Blatt mit `[Übersetzen · Fragen]`, Übersetzen ist vorgewählt, und das Textfeld hat den Fokus.
2. Emrah tippt Deutsch: „Wir müssen die Einführung verschieben.“ Richtung automatisch (DE→EN), umschaltbar.
3. Ergebnis nach 1–3 s: **„We need to postpone the rollout.“** ▶, darunter 1–2 Alternativen („push back the launch“ · locker).
4. **Jedes englische Wort und jede erkannte Wendung ist antippbar** und trägt ein kleines `+`: Tipp auf `postpone` → Mini-Popover (Bedeutung, Lautschrift) mit `[+ Wortschatz]`. Tipp auf die Zeile `push back` → speichert die Wendung.
5. Zusätzlich unter dem Ergebnis: `+ Ganzen Satz als Karte` (Satz als Wendung mit deutscher Vorlage).
6. Gespeichert wird in den Stapel **„Übersetzer“** mit dem übersetzten Satz als Ursprungssatz. Bestätigung „✓ postpone im Wortschatz“ als Toast mit `Rückgängig`.
7. Der Verlauf der letzten 20 Übersetzungen bleibt im Blatt (lokal), damit Emrah später noch Wörter übernehmen kann.

---

## 5. Design-Sprache

### 5.1 Farben (aus `src/styles/index.css`)
- **Fläche:** `--lx-bg` (dunkel `#0b0f19`) mit den beiden leichten Farbhöfen oben (`--lx-bg-glow-1/2`), Karten `--lx-surface` mit `--lx-border` (1 px) und `--lx-shadow`. **Blätter und Popover** `--lx-surface-solid` (nicht durchscheinend, damit Text darunter nicht stört).
- **Text:** `--lx-fg` (Inhalt), `--lx-fg-muted` (Nebenzeile), `--lx-fg-subtle` (Zustände wie „offen“, „Extra“).
- **Akzent:** `--lx-accent` nur für **den einen** gefüllten Knopf, den Fortschrittsbalken und gesammelte Wörter; `--lx-accent-text` für Textlinks; `--lx-accent-soft` für Häkchen-Kreise. Das Farbthema (Smaragd, Ozean, Pflaume, Graphit über `data-palette`) bleibt wählbar.
- **Kanalfarben** `--lx-ch-*` (Karten Violett, Grammatik Blau, Lesen Himmelblau, Hören Magenta, Schreiben Orange, Sprechen Rosé, Business Gold, Entdecken Limette): **nur** im 28-px-Symbol links in Zeilen und im Abschnittspunkt der Tageskarte. Keine Seitenstreifen, keine farbigen Flächen.
- **Signal:** `--lx-danger-text/-soft` nur für „falsch“ und echte Fehlerzustände, `--lx-gold-text/-soft` nur für „fällig/Warnung“ (z. B. „9 Fehler fällig“).
- **Modi:** Dunkel (Standard), Gedämpft (`dim`), Hell. Alle drei vollwertig über dieselben Tokens; Hell nutzt echte Weißflächen (`--lx-surface-solid: #fff`) statt Glas.

### 5.2 Typografie
Inter Variable (eingebettet), Skala aus den Tokens:
- **Seitentitel** `--text-2xl` (32 px) fett, eng laufend (-0,02 em); schrumpft beim Scrollen in die Titelzeile (iOS Large Title).
- **Abschnitt** `--text-2xs` (12 px) Großbuchstaben, Sperrung +0,06 em, `--lx-fg-subtle`: höchstens einer pro Abschnitt.
- **Zeilentitel** `--text-base` (17 px, wie iOS Body), mittel; **Nebenzeile** `--text-sm` (15 px) `muted`.
- **Lernsatz im Player** `--text-xl` (24 px) regular; **Karte im Stapel** `--text-2xl`. Englische Lerntexte im Leser `--text-lg` (20 px) mit Zeilenhöhe 1,6 und max. 34 em Breite.
- **Zahlen** mit `font-variant-numeric: tabular-nums` (Zähler springen nicht).
- Drei Größen je Bildschirm, nie mehr.

### 5.3 Abstände, Raster, Karten
- 8-px-Raster: 8 innerhalb einer Zeile, 16 zwischen Zeilen/Karten, 32 zwischen Abschnitten. Außenrand am iPhone 16 px plus `env(safe-area-inset-*)`.
- **Zeile** min. 56 px (Tippfläche ≥ 44 px): Symbol 28 px · Titel + Nebenzeile · Wert/Zustand rechts · Pfeil. Listen in einer Karte mit Trennlinien, nie Karte in Karte.
- **Karte** Radius `--radius-card` (20 px), Innenabstand 16–20 px. **Knöpfe/Felder** `--radius-control` (14 px), Hauptknopf 52 px hoch, volle Breite in Übungen, über der Tastatur verankert.
- **Tab-Leiste** 49 px + Safe Area, Symbol 24 px + Wort 11 px, Glas mit `-webkit-backdrop-filter: blur(20px)`.

### 5.4 Bewegung (dezent, schnell)
Aus `src/ui/motion.ts`: `fast` 150 ms, `base` 220 ms, `slow` 300 ms, `EASE_OUT`, Feder `stiffness 520 / damping 40`.
- **Push** (Unterseite): von rechts, 220 ms. **Übung/Blatt:** von unten, Feder. **Reiterwechsel:** nur Überblendung 150 ms, kein Schieben.
- **Richtig:** Lücke färbt sich Akzent, kleiner Puls (Skalierung 1 → 1,04 → 1, 180 ms). **Falsch:** zweimaliges seitliches Zittern (6 px, 200 ms), danach Lösung ruhig einblenden.
- **Karte umdrehen:** 3D-Drehung 180 ms. **Wischen:** Karte folgt dem Finger, lässt man ab 30 % Weg los, fliegt sie weg.
- **Fortschrittsbalken** wächst mit Feder; Zähler zählen hoch (nur bei Abschluss).
- `prefers-reduced-motion`: alles nur Überblendung.
- Nie Bewegung beim Laden von Daten (Skelette pulsieren nicht, sie sind statisch leicht heller).

---

## 6. Leistung und Stabilität aus Nutzersicht

### 6.1 Was sich sofort anfühlen muss (Budget)

| Moment | Ziel | Wie |
|---|---|---|
| App öffnen → „Heute“ lesbar | < 1 s (Kap. 14: < 2 s) | Heute rendert aus einem lokalen **Anzeige-Schnappschuss** (letzter Tagesplan, Serie, Zähler) vor der Datenbank, danach sanfter Abgleich ohne Springen. Code für andere Reiter lädt erst nach dem ersten Bild. |
| Tipp auf jeden Knopf | < 100 ms sichtbare Reaktion | Zustand wechselt optimistisch; Schreiben läuft dahinter. |
| Nächste Karte / nächste Aufgabe | < 50 ms | Die nächsten 3 Aufgaben sind vorberechnet und vorgerendert. |
| Buchstabe in der Lücke | ein Bild (16 ms) | Verborgenes Eingabefeld, keine Neuberechnung der ganzen Seite je Taste. |
| Wort antippen | < 100 ms Popover | Lokales Wörterbuch zuerst, KI-Kontextbedeutung ersetzt später. |
| Reiterwechsel | < 100 ms | Reiter bleiben im Speicher (nicht neu aufbauen), Bildlauf bleibt. |
| KI-Rückmeldung | 1–10 s, **nie blockierend** | „Claude liest …“-Skelett; der Weiter-Knopf ist sofort da; die Rückmeldung erscheint nachträglich und bleibt auch nach „Weiter“ in der Zusammenfassung abrufbar. |
| Neue Inhalte (Beispiele, Artikel, Szenen) | 0 s Wartezeit | Werden am Vortag/beim Öffnen im Hintergrund erzeugt und gespeichert; eine Übung startet nie mit einem KI-Aufruf. |

Und was sich **nie** zeigen darf: ein Drehkreisel über dem ganzen Bildschirm, ein Knopf, der nach dem Tippen eine Sekunde lang nichts tut, eine Liste, die nach dem Laden nach unten springt.

### 6.2 Kein Datenverlust bei Neuladen oder Absturz

Emrahs Erfahrung „stürzt ab, dann von vorn“ muss in beiden Hälften verschwinden: Es darf nicht abstürzen, und wenn doch, geht nichts verloren.

1. **Jede bewertete Antwort wird sofort gespeichert**, einzeln und in einem Schritt (Karte per `writer.transform`, wie heute). Es gibt kein „Speichern am Ende der Runde“.
2. **Sitzungszustand je Übung** (Warteschlange, Position, Abschnitt, halb getippte Eingabe, Entwurf im Textfeld, Gesprächsverlauf) liegt nach jeder Aktion **lokal** (Bequemlichkeitsspeicher) und bei Abschnittswechsel zusätzlich in der Datenbank (ein zusammengefasstes Dokument je Tag, z. B. `session/<tag>`, damit die 5.000-Dokumente-Grenze hält). Beim Öffnen gewinnt der neuere Stand.
3. **Fortsetzen ist der Normalfall:** Existiert eine offene Sitzung, zeigt der Herkunftsort (Heute, Wortschatz, Lesen, Sprechen) oben „↻ Weiter, wo du warst: …“. Ein Tipp stellt exakt her: dieselbe Karte, dieselbe Scrollposition im Artikel, dieselbe Gesprächsrunde. Beantwortete Karten werden nicht doppelt gezählt.
4. **Schreibpuffer:** Was noch nicht in der Datenbank ist, wird beim Verlassen der Seite (`visibilitychange`/`pagehide`, wichtig für iPhone-Safari) sofort weggeschrieben; bis zur Bestätigung zeigt eine unauffällige Zeile „Wird gespeichert …“ und bei Verbindungsverlust „Offline – wird nachgeholt“.
5. **Fehler bleiben lokal:** Jede Übung läuft in einer eigenen Fehlergrenze. Stürzt ein Baustein ab, sieht Emrah „Hier ist etwas schiefgelaufen. Dein Stand ist gespeichert.“ mit `[Weiter mit nächster Aufgabe]`, nicht einen weißen Bildschirm; der Fehler landet in der Diagnose.
6. **Zwei Tabs / zwei Geräte:** Karten werden immer auf dem frischen Stand fortgeschrieben (`transform`); eine offene Sitzung im zweiten Tab zeigt „In einem anderen Fenster geöffnet – hier weitermachen?“.
7. **Stabile Tagesplanung:** Der Tagesplan wird einmal pro Tag festgelegt und gespeichert, nie beim Neuzeichnen neu gewürfelt (Kap. 15).

---

## 7. Abbildung auf den heutigen Stand (für die Umbauplanung)

| Heute (Code) | Neu |
|---|---|
| Reiter `today` · `learn` · `speak` · `overview` (`nav.ts`, `TAB_ROOTS`) | Reiter `today` · `vocab` · `read` · `speak`; `overview` wird Unterseite hinter dem Profil-Knopf |
| Pflicht = 3 getrennte Übungen (`trainer`, `lesson`, `drill`/`say`) mit Rückkehr nach Heute | eine Tageseinheit (Player) mit Abschnitten; Übungstypen bleiben als Bausteine |
| `LearnHub` (Kurs, Wortschatz, freie Runde, Grammatik, 4 Kurzübungen, Lesen/Hören/Schreiben, Entdecken) | aufgeteilt: Kurs + Grammatik → Heute; Wortschatz + freie Runde → Reiter Wortschatz; Lesen/Hören/Entdecken → Reiter Lesen; Schreiben → Sprechen |
| `trainer` mit `round: 'extra'` + `FreeRoundSheet` | Stapel-Sitzung mit Modus Tippen/Aufdecken, gespeicherte Stapel |
| `read`, `listen`, `discover`, `discoverItem`, `history` | Bibliothek + ein Leser (Audio-Leiste bei Hörtexten) |
| `mail`, `playbook`, `pitch`, `say`, `tones`, `fluency`, `meeting` | Sprechen → Gespräche/Training bzw. Schreiben (gemeinsame Schreibwerkstatt) |
| Preply unter Sprechen-Umschalter | bleibt, Umschalter heißt „Gespräche · Schreiben · Preply“ |
| Übersetzer im Begleiter (`companion`) | Blatt „Claude“ mit Übersetzen · Fragen, je Wort `+ Wortschatz` |

Keine bestehende Funktion und keine Daten fallen weg; es ändern sich Ort, Zusammenhang und Tiefe.
