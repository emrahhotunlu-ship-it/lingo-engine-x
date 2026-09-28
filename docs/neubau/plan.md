# Bauplan Neubau – der eine verbindliche Plan

**Stand:** 27.09.2026, 23:00 UTC. **Rolle:** Product Owner.
**Auftrag (Emrah, A7 „Neuansatz“):**
- die komplette App in 12 Stunden, Start 22:20 UTC,
- „aufgeräumt, aber featurestark“, Anki-Modus, Optik wie Prototyp v1 (`docs/prototyp/v1.html`),
- „das Beste von Babbel/Duolingo/LingQ, nur intelligenter“,
- **keine Funktion darf verloren gehen.**

**Eingaben:**

| Datei | Inhalt | Wie hier verwendet |
|---|---|---|
| `docs/neubau/inventur.md` | 240 Funktionen | alle übernommen, Abschnitt 2 |
| `docs/neubau/markt.md` | Top-25 | Abschnitt 3 |
| `docs/neubau/lehrer.md` | Übungstypen, Rhythmus, 16 Themen, 10 Lücken | Abschnitte 1.5 und 3 |
| `docs/neubau/architektur.md` | Rahmen, Pakete, Datei-Hoheit | Grundlage, Änderungen in 4.9 |
| `docs/neubau/leistung.md` | Messung und Maßnahmen | Anhang A, Budgets in 4.0 |
| `docs/neubau/anki-regeln.md` | Anki-Regeln | verbindlich für P3 |
| `docs/produktkonzept.md` | Produktkonzept | §5 („was wegfällt“) ist überholt |
| `docs/prototyp/v1.html` | Optik und Aufbau | Vorbild für Aufbau und Optik |

**Geltung:** Dieser Plan ist die einzige Bauanleitung, es gibt keine Abzweigungen.
- Eine Abweichung ändert nur der Integrator (Hauptsitzung), mit einer Zeile in Abschnitt 8.
- Neue Ideen während des Baus kommen nach `docs/backlog.md`.
- Was um 06:20 UTC nicht grün ist, wandert in Paket B. Die Zeit wird nicht verlängert (A7).

---

## 0. Entscheidungen auf einen Blick

| Frage | Entscheidung | Grund |
|---|---|---|
| Reiter | **5 Reiter:** Heute · Wortschatz · Üben · Lesen · Sprechen. Profil (Stand, Tests, Einstellungen) liegt oben links, Übersetzen und Claude oben rechts. | Siehe 1.1 |
| Pflicht | **Die Tageseinheit ist die Pflicht.** Sie hat bis zu 5 Blöcke laut Wochenplan. Die Lektion ist keine Pflicht mehr, sondern ein Angebot unter Üben. | Lehrer-Lücken 1 und 2; Produktkonzept §2 |
| Serie | Die Regel bleibt (`pflichtFor`, `computeStreak` unverändert): Ein Tag zählt, wenn alle Blöcke des Tages erledigt sind. Ein Ruhetag je Woche. Bei Tagesziel ≤ 15 Min. gilt die Kurz-Einheit mit 3 Blöcken. | A7 „Serie“; ohne Datenumbau (1.5) |
| Anki | Es gilt `docs/neubau/anki-regeln.md` vollständig. Die Richtung ist je Stapel wählbar, Standard ist DE→EN. In der Tageseinheit gilt immer DE→EN. | Lernwissenschaft und PO, 27.09. |
| Kontingent neuer Karten | 0/2/5/10, Standard 5. Es gibt ein Kontingent für alle Wege. „Höchstens 8“ aus `lehrer.md` wird nicht übernommen. | `anki-regeln.md` §5 |
| Rückmeldung | Ein Einheitsstil für alle Übungen (`FeedbackPanel`). In Paket A entsteht er durch Abbilden der vorhandenen KI-Ausgaben. Nachfolger der Vorlagen kommen in Paket B. | Lehrer-Lücke 4; die Vorlagen sind während der Parallelphase eingefroren |
| Mikrofon | Sprechen heißt: erst laut sprechen, dann tippen oder mit der **Diktiertaste der iPhone-Tastatur** diktieren. Die Mikrofon-Taste der App erscheint nur, wo die Spracheingabe wirklich startet. | Plattform (`markt.md` 0.1) |
| KI | Die KI blockiert nie den Kernablauf. Bewertet wird lokal sofort, die KI streamt nach. Die Inhalte der Tageseinheit gibt es auch ohne KI (Themen-Texte, Musterlösungen). | Kap. 3.1, `leistung.md` |
| Fortsetzen | Automatisch zurück, wenn der letzte Schritt weniger als 2 Min. her ist. Sonst gibt es eine Zeile „Weitermachen: …“, die am gleichen Lerntag bis zu 6 Std. gilt. Lokal liegen nur Positionen, die Antworten liegen sofort in `db`. | `leistung.md` §5; ersetzt die 30-Minuten-Regel aus `architektur.md` §3.2 |
| „Was ist neu“ (A14) | **Entfällt als Hinweis.** Der Code bleibt, wird aber nicht eingehängt. | Emrah hat Neu-Hinweise kritisiert (Inventur ✗, Produktkonzept §5). Einzige Funktion ohne neuen Ort. |

**In A7 nachtragen** (Integrator, sobald Emrah das Test-Artefakt sieht): 5 Reiter, Tageseinheit als Pflicht, Lektion als Angebot, Anki-Regeln, Fortsetzen-Regel.

---

## 1. Informationsarchitektur

### 1.1 Reiter: fünf statt vier

`src/app/shell/tabs.ts` (WP0):

```ts
TABS = [
  { id: 'today', root: { name: 'today' },   places: ['today'] },            // Heute
  { id: 'vocab', root: { name: 'vocab' },   places: ['vocab'] },            // Wortschatz
  { id: 'learn', root: { name: 'learn' },   places: ['learn'] },            // Üben
  { id: 'read',  root: { name: 'library' }, places: ['read'] },             // Lesen
  { id: 'speak', root: { name: 'speak' },   places: ['speak', 'write'] },   // Sprechen
]
// Plätze außerhalb der Leiste: 'profile' (Profil-Blatt), 'stand' (Seite „Dein Stand“, Reiter Statistik)
```

**Warum fünf:**
1. **Heute bleibt eine rote Linie (Kap. 2.1).** Bei vier Reitern müssten Kurs, Grammatik, Deutsch-Fallen, C1-Werkzeuge, Kurzübungen und die neuen Drills unter die Tageskarte. Dann würde Heute wieder zum Sammelbecken, das Emrah als „überladen“ kritisiert hat.
2. **Mehr Funktionen brauchen einen Ort.** Es gibt rund 240 bestehende und etwa 40 neue Funktionen. Mit fünf Orten bleibt jede Funktion ≤ 2 Tipps ab dem Reiter (1.4).
3. **iOS-Standard:** Fünf Reiter sind das Maximum der Human Interface Guidelines. Bei 390 px hat jeder Reiter 78 px, „Wortschatz“ passt einzeilig. Im Englischen heißen sie Today · Vocab · Practice · Read · Speak.
4. **Vertrautheit und Tests:** Die heutige App hat „Üben“ an zweiter Stelle. Die Test-ID `tab-learn`, `learn-hub` und `hub-*` bleiben bestehen, deshalb muss WP0a weniger Specs umbauen.
5. **Wortschatz direkt an Platz 2** behebt „Vokabeltrainer nicht auffindbar“.

**Warum Üben kein Sammelbecken mehr ist:**
- Üben hat genau vier Abschnitte (1.3).
- Lesen, Hören, Schreiben, Entdecken und Sprechen liegen woanders.
- Der Wortschatz hat einen eigenen Reiter.
- Die Tests liegen im Profil.

### 1.2 Kopf, Player, Blätter

**Kopf auf jeder Reiter-Wurzel** (WP0, wie in v1):
- Links: Profil-Knopf (Initiale + „Serie 12“), öffnet das Profil-Blatt.
- Rechts: **Übersetzen** und **Claude**, beide öffnen das Claude-Blatt. Ohne KI sind sie unsichtbar.
- Darunter: großer Titel.
- Auf Seiten: links „‹ Herkunft“, rechts wieder Übersetzen und Claude.

**Übungsebene (Player, WP0):** eine Leiste mit ✕ · Balken · „12 / 40 (+2)“ · Übersetzen · Claude.
- ✕ fragt nie nach, ein Toast bestätigt „Gespeichert. Du kannst jederzeit weitermachen.“
- Unter dem Balken steht „Tageseinheit · Block 2 von 5“, „Pflicht“ oder „Extra“.
- Es gibt keinen Kopf und keine Reiterleiste.

**Blätter** (von unten, Stapel mit höchstens 2):

| Blatt | Inhalt | Besitzer |
|---|---|---|
| **Profil** | **Kopf:** Serie, Wochenstreifen (7 Punkte Mo–So: Pflicht · nur Extra · Ruhetag · offen), Urteil in einem Satz (Tipp → Stand/Urteil).<br>**Stand:** Urteil › · Fehler › · Ziel C1 › · Statistik › · Verlauf › (jede Zeile öffnet die Seite „Dein Stand“ direkt auf diesem Reiter).<br>**Tests:** Wochen-Check › · Wortschatztest ›.<br>**Wochenbericht ›**<br>**Einstellungen ›**<br>Zeile „Aus diesem Browser nachtragen“, nur wenn nötig. | P6 |
| **Einstellungen** | 6 Gruppen:<br>1. **Lernen:** Tagesziel, Neue Wörter/Tag, Automatisch weiter<br>2. **Wortschatz** (P3 registriert): Standard-Modus, Richtung, 4 oder 2 Knöpfe<br>3. **Stimme & Ton:** Stimme, Tempo, Probehören, Vorlesen im Rollenspiel, Töne, Vibration<br>4. **Mein Kontext**<br>5. **Darstellung:** Sprache, Modus, Farbthema<br>6. **Daten:** Export, Diagnose, Profilgröße (aus), Quellen | P6 |
| **Claude** | Umschalter **Übersetzen · Fragen**. Jedes englische Wort ist antippbar mit „+ Wortschatz“. Zusätzlich gibt es „+ Wortschatz“ am ganzen Ergebnis (Wendung oder Satz), ein Tipp genügt. „Warum?“ aus jeder Rückmeldung öffnet „Fragen“ mit fertiger Frage und den Chips „Noch ein Beispiel · Wann nimmt man das andere? · Auf Deutsch“. | P6 |
| **Wortblatt** | Das bisherige `WordSheet`, von überall erreichbar | P3 |
| **Hinzufügen** | Eigenes Wort · Von Claude · Für meinen Beruf · (Soll) Aus Text | P3 |
| **Extra-Runde** | Heute vergessen · Morgen fällig vorziehen · Nur Stapel … · Hartnäckige · Fehler der Woche · + neue (im Rahmen des Kontingents) · (Soll) Hörschleife | P3 |

Das **Wort-Popover** (Tipp auf ein Wort) bleibt eine leichte eigene Ebene (P3). „Mehr ›“ öffnet das Wortblatt.

### 1.3 Hubs und Abschnitte (Reihenfolge von oben)

Die Einstiege (`entries`) behalten ihre heutigen Test-IDs. Jede Zeile nennt den Besitzer.

**Heute** (Wurzel `today`, P1): die rote Linie.
1. **Unterzeile:** „Montag, 28. September · Wochenthema: CFO: Preis und ROI ›“ (Verweis auf die Seite `week`).
2. **Tageskarte** (die einzige Karte):
   - „Deine Tageseinheit“ + Ring „2 von 5 · noch ca. 18 Min.“
   - Titel = Kernaufgabe der Woche
   - Blockliste: Name, ein kurzer Grund, Minuten, Zustand ✓ · jetzt · offen
   - **ein** Knopf „Starten →“ oder „Weiter: Block 3 →“
3. **„Weitermachen: …“** (WP0): nur für eine unterbrochene Sitzung außerhalb der Einheit. Gehört die Sitzung zur Einheit, zeigt das der Knopf der Tageskarte.
4. **Ruhige Zeilen** (Platz `today`):
   - Preply-Stunde (P5)
   - Nachtragen (P6)
   - Wochenbericht ist da, nur montags (P6)
   - Speicher- oder Planfehler mit „Erneut“ (P1)

**Nach der Pflicht** (Fertig-Zustand):
- Fertig-Karte „✓ Fertig für heute“ mit Bilanz (Minuten · Blöcke · Antworten · % richtig) und „Morgen: …“. Das ist ein Zustand, kein Knopf.
- **Eine** Zeile „Lohnt sich jetzt“ mit Grund.
- Ein leiser Verweis „Mehr üben ›“ auf das Blatt Extra-Runde.

**Wortschatz** (Wurzel `vocab`, P3). Rechts im Kopf zusätzlich „+“ für das Blatt Hinzufügen.
1. **Suche** (führt zur gefilterten Liste).
2. **„Alle fälligen“** (Hauptkarte): Zähler **Neu · Lernen · Fällig**, Umschalter **Aa** (Aufdecken · Tippen · (Soll) Hören), „Wiederholen →“, darunter „ca. 7 Min.“
3. **Prognose:** 7 kleine Balken „Morgen 38 · Mi 22 …“
4. **Stapel:**
   - eingebaut: Eingangskorb, Schwierig, Hartnäckig, Beruf, Wendungen, Wochenthema, Fehler der Woche, Quellen-Stapel (Übersetzer, Nachschlagen, Preply, Lektion, KI)
   - eigene Stapel
   - „Neuer Stapel“
   - je Zeile die drei Zähler
5. **Eingangskorb-Zeile:** „Eingangskorb 42 · reicht für 9 Tage“. Ab 30 Tagen kommt ein ruhiger Hinweis „Korb sichten“.
6. **Zuletzt hinzugefügt** (5 Einträge), dazu „Alle 252 Einträge ›“ (Seite `vocabList`).

**Üben** (Wurzel `learn`, test-id `learn-hub`, P2):
1. **Dein Weg:**
   - „Deine Woche“ (P1, Seite `week`)
   - Kurs-Karte (P2: nächste Lektion, Fortschritt, „Alle Lektionen ›“ zur Seite `course`)
2. **Grammatik & Fallen** (P2):
   - Grammatik (Seite `grammar`, Umschalter B2-Themen · C1-Werkzeugkasten)
   - Deutsch-Fallen (Seite `patterns`)
   - Nachschlagen (Seite `wissen`)
3. **Training:**
   - von P2: Diktat, Lückenjagd, Satzbau, Sprint
   - von P7: Kollokationen, Satz-Umformung, (Soll) Wortbildung, Register, Phrasal Verbs, Überleitungen
4. **Aus deinen Fehlern** (P2): Grammatik-Fehler „n fällig“ · Reparatur-Sätze „x offen · y sicher“.

**Lesen** (Wurzel `library`, P4):
1. Chips: Alle · Lesen · Hören · Beruf · Alltag.
2. **Heute neu:** Entdecken-Beiträge des Tagesauftrags und der Text zum Wochenthema, je Kachel „B2+ · 6 % neu · 4 Min.“
3. **Weiterlesen:** angefangene Einheiten.
4. **Bibliothek:** Artikel, Hörtexte, eigene Texte, „Alle Beiträge ›“ (Seite `discover`).
5. **Aktionen:** „+ Eigener Text“ · „Neuer Text“ (Blatt mit Themenwahl) · „Neuer Hörtext“.
6. **Verlauf ›** (Seite `history`).

**Sprechen** (Wurzel `speak`, P5). Umschalter **Gespräche · Schreiben · Preply** (`speak-seg-talk|write|preply`).
- **Gespräche** (Standard):
  1. Termin-Karte „Mein nächster Termin · Do 14:00“ bzw. „Termin vorbereiten“ (Seite `meeting`)
  2. **Szenen:** Szene zum Wochenthema oben, Business-Bibliothek (P7a), eigene Szenen, „Neue Szene“, unvollständige zugeklappt
  3. **Training:**
     - von P5: Flüssigkeit 90/60/45, Pitch-Coach, Verhandlungs-Baukasten (Seite `playbook`), Wendungen aus deinen Szenen
     - von P7: Einwand-Training, (Soll) Heißer Stuhl, Zeit gewinnen
  4. **Aussprache** (P7): Nachsprechen, (Soll) Wortbetonung, Zahlen
- **Schreiben** (Platz `write`):
  - Sag es (P5)
  - Posteingang (P7)
  - E-Mail verbessern (P5)
  - Drei Tonlagen (P5)
  - Schreibaufgabe (P4)
  - (Soll) weitere Gattungen (P4)
  - Verlauf Schreiben (P4)
- **Preply:** (Soll) Nächste Stunde · Vorbereiten · Übernehmen · Gehalten · Verlauf · Wochenziele.

**Seite „Dein Stand“** (`overview`, P6):
- Kopf: Kurs · Wörter · Niveau-Skala.
- Reiter **Urteil · Fehler · Ziel C1 · Statistik · Verlauf**.
- „Statistik“ zeigt die Heatmap von P6 und darunter den Platz `stand` mit dem Abschnitt „Wortschatz-Statistik“ von P3.

### 1.4 Ortsregeln (alle Pakete, `acceptance.spec` prüft über das Register)

1. **Genau ein Ort** je Funktion. Heute *verweist* nur: Unterzeile, Tageskarte, Vorschlag. Heute beherbergt nichts doppelt.
2. **≤ 2 Tipps ab Reiter-Wurzel** bis zum Einstieg jeder eigenständigen Funktion.
   - Profil und Claude sind von jeder Wurzel aus 1 Tipp entfernt.
   - Objektgebundene Funktionen (am Wort, am Text, in einer Übung, am Stapel) zählen ab dem Objekt: ≤ 2 Tipps ab Wortblatt, Leser oder Themenblatt.
3. **Heute:** eine Karte, ein gefüllter Knopf. Erledigtes ist Zustand. Zähler, Ring, Abzeichen und Blockliste nennen dieselbe Zahl (Kap. 2.2).
4. **Pflicht und Extra sind sichtbar getrennt.** Die Leiste zeigt „Pflicht“ oder „Extra“. Extra zählt nie in den Ring.
5. **Nichts dreimal auf einem Bildschirm** (Kap. 15). Keine Karte in einer Karte.

### 1.5 Tageseinheit und Wochenplan (Kern, P1; Inhalte und Domäne P7a)

**Ablauf:**
- Ein Tipp auf der Tageskarte startet eine Kette im Player.
- Zwischen den Blöcken steht eine kurze Zwischenkarte („✓ Wiederholen · 18 Karten · 6 Min. – Als Nächstes: kurzer Text zum Thema“, Knopf „Weiter“).
- Am Ende kommt `SessionEnd`, ✕ führt immer zurück zu Heute.
- Montags steht vor Block 1 die Zwischenkarte „Wochenthema bestätigen“ mit Vorschlag, „Passt“ und „Anderes wählen“.

**Blöcke** (Minuten gedeckelt, Summe ≈ 27):

| Block | Min. | Inhalt | Anbieter (`unitBlocks`) |
|---|---|---|---|
| 1 Wiederholen | ≤ 8 | Reparatur-Sätze zuerst, dann Karten zum Wochenthema, dann Fällige. Modus `auto`, Richtung DE→EN (`anki-regeln.md` §1). Der Rest ist morgen dran oder Extra. | P3 `review` |
| 2 Input | 4–5 | Text oder Hörstück zum Wochenthema: 1 Kernfrage, 1 Frage „zwischen den Zeilen“, 2–3 Wendungen merken, danach 3 Sätze nachsprechen | P4 `input.read` / `input.listen`, danach P7 `pron.shadow` |
| 3 Aufgabe | 8–10 | Format laut Wochenplan; Ziel: die Wendungen und das Werkzeug der Woche benutzen | P5/P7 `task.*` |
| 4 Fokus | 3–4 | ≤ 3 Korrekturen aus Block 3: Hinweis → Versuch → Lösung. Ist es eine Falle, folgt ein Mini-Drill mit 3 Sätzen. Ohne Korrekturen: Grammatikkanal (inkl. Aufgaben aus `daily/*`) | P2 `focus` |
| 5 Nochmal, aber besser | 2–3 | Aus dem Kopf neu formulieren, beide Fassungen nebeneinander, Reparatur-Karten automatisch | P2 `again` |

**Wochenplan** (reine Funktion `unitPlanFor(date, week, env, prefs)` in `src/domain/week/`, P7a):

| Tag | Block 2 | Block 3 | Blöcke |
|---|---|---|---|
| Mo | Lesen (Themen-Text) | Sag es zum Thema, mit „Laut zuerst“ | 5 |
| Di | Hören (Tempo-Leiter) | 90/60/45, Frage A der Woche | 5 |
| Mi | Posteingang lesen (die Mail ist der Input). In geraden Kalenderwochen stattdessen Lesen. | Antwort auf die Mail; in geraden Wochen Drei Tonlagen | 5 |
| Do | Hören | Einwand-Training. Ist ein Termin in ≤ 3 Tagen: Generalprobe. | 5 |
| Fr | Lesen | 90/60/45, wieder Frage A (Wörter/Min. gegen Dienstag) | 5 |
| Sa | – | Rollenspiel zum Thema, 10–15 Min. | 4 |
| So | – | Wochen-Check (5 Min.), danach Ruhetag möglich | 2 (Block 1 kurz + Check) |

**Rückfälle:**
- **Ohne Sprachausgabe:** Hören wird zu Lesen, Nachsprechen entfällt.
- **Ohne KI:** Block 3 wird ungeprüft gespeichert und zählt, Block 4 zeigt die Musterlösung, Block 5 vergleicht lokal.
- **Kurz-Einheit** (Tagesziel ≤ 15 Min.): Block 1 (≤ 5 Min.), 3 und 5.
- **Preply (Soll N16):**
  - Tag vor der Stunde: Block 3 ist die Vorbereitung.
  - Tag der Stunde: Kurz-Einheit, dazu 3 Min. Wendungen nachsprechen.
  - Tag danach: Block 2 ist der Import, Block 3 ist Sag es mit dem Stoff der Stunde.

**Pflicht und Serie ohne Datenumbau:**
- `plan.duty = ['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']`. Tage mit weniger Blöcken haben entsprechend weniger Einträge. Der Sonntag hat `['review', 'ch:u-check']`.
- Jeder abgeschlossene Block zählt `act[<tag>]['u-…'] += 1` über den vorhandenen Weg `recordProfileFields` (`features/progress/persist.ts`, eingefroren, nur benutzt).
- `pflichtFor` erkennt `ch:*` über `act[ch] ≥ 1`, es bleibt unverändert.
- P1 ergänzt `u-*` additiv in `dutiesFeasible` (`domain/plan/pflicht.ts`) und `isDutyChannel` (`domain/plan/channels.ts`), damit `pflichtSince` weiter richtig arbeitet.
- Der Plan wird einmal je Lerntag eingefroren (Kap. 15).
- Die Blöcke 4 und 5 finden ihr Material geräteübergreifend in den Daten von heute: Reparatur-Einträge in `app/repair` mit Quelle „heute“, der Text in `say/<Monat>` usw. Sie hängen nicht vom lokalen Zustand ab.
- data-guard prüft beim Zusammenführen von P1.

**Wochenthema:**
- Es gibt 16 Themen, die Reihenfolge steht in `lehrer.md` §3: 1, 2, 13, 3, 4, 14, 5, 6, 12, 7, 8, 15, 9, 10, 16, 11.
- Montags schlägt die App das nächste Thema vor. (Soll N17) Ein Termin oder Preply-Thema hat Vorrang.
- Gespeichert wird in `app/week`. Das Thema steuert:
  - den Input-Text,
  - die Karten „Wochenthema“ in Block 1 und Stufe 4 des Eingangskorbs (`isThemeCard`),
  - die Szene und die Aufgaben,
  - die Wochenziele (≤ 5: 3 Fallen, 1 Werkzeug, 1 Preply-Ziel).

### 1.6 Neue Routen (zusätzlich zum Anhang der Architektur)

| Route | Ebene | Paket |
|---|---|---|
| `week` | page | P1 |
| `unitCard` (Zwischen- und Bestätigungskarte der Einheit) | exercise | P1 |
| `deck` (`{id}`) | page | P3 |
| `vocabList` (`{filter?}`) | page | P3 |
| `library` | tab | P4 |
| `nbdrill` (`{set, n?}`) | exercise | P7 |
| `pressure` (`{set}`) | exercise | P7 |
| `inbox` (`{id?}`) | exercise | P7 |
| `pron` (`{kind: 'shadow'|'stress'|'numbers', src?}`) | exercise | P7 |
| `claudeDrill` | exercise | P6 (Soll) |

---

## 2. Abdeckung: alle 240 Funktionen der Inventur

**Kürzel:**
- **Orte:** H = Heute, W = Wortschatz, Ü = Üben, L = Lesen, S = Sprechen (S/G = Gespräche, S/S = Schreiben, S/P = Preply), Pr = Profil-Blatt, St = Seite „Dein Stand“, E = Einstellungen, C = Claude-Blatt.
- **Übungsorte:** Einheit Bn = Tageseinheit, Block n. „Player“ = Übungsebene.
- **Spalte „Änderung“:** „–“ heißt, die Funktion ist unverändert übernommen, nur im neuen Rahmen (Kopf, Leiste, Fehlergrenze).
- **„+R“** heißt: neu fortsetzbar nach dem Neuladen.

### A. Rahmen, Start, System (14)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| A1 | Sofortstart mit Skelett | Start → H | WP0b + P1 | Heute aus lokalem Plan, Budget < 1,5 s (4×) |
| A2 | Ohne Datenbank / Verbindung | System | WP0 | – |
| A3 | Umstellung mit Trockenlauf | System | WP0 | – |
| A4 | Nachtragen aus diesem Browser | Pr (Zeile, nur wenn nötig), Verweis auf H | P6 | – |
| A5 | Reiterleiste mit Zahl + Ladepunkt | Rahmen, 5 Reiter | WP0 | Zahl = offene Blöcke; Ladepunkt an Sprechen (Schreiben) bzw. Lesen |
| A6 | Herkunft + Bildlauf | Rahmen | WP0 | Reiter-Stapel, `<Activity>` |
| A7 | Übersetzer · Claude · Zahnrad überall | Kopf rechts + Player-Leiste | WP0 | Zahnrad wandert ins Profil |
| A8 | Tastaturkürzel | überall | WP0 | + 1–4/Leertaste im Aufdecken (P3) |
| A9 | Wischen „Weiter“ | Player | WP0 | + Wischen im Aufdecken (P3) |
| A10 | Vibration | E › Stimme & Ton | P6 | – |
| A11 | Töne | E › Stimme & Ton | P6 | – |
| A12 | Sprachausgabe robust | überall | Plattform (unverändert) | – |
| A13 | Spracheingabe | Rollenspiel, Flüssigkeit, Pitch, Druck-Serien | P5/P7 | Standard: Diktiertaste der iPhone-Tastatur, Hinweis im Feld |
| A14 | „Was ist neu“ | **entfällt** | P6 | Grund: Emrahs Kritik (✗), Code bleibt, Backlog |

### B. Heute (20)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| B1 | Tagesplan einmal je Lerntag | H (unsichtbar) | P1 | Plan = Tageseinheit; `lx:plan:<tag>` zuerst |
| B2 | Statuszeile | H › Tageskarte | P1 | „Block x von 5 · noch ca. n Min.“ / „Fertig für heute“ |
| B3 | Pflichtliste mit Hero-Knopf | H › Tageskarte | P1 | 5 Blöcke, ein Knopf |
| B4 | Erledigt = Zustand | H › Tageskarte | P1 | – |
| B5 | Begründung je Zeile | H › Tageskarte (Grund je Block) | P1 | – |
| B6 | Kanalgewichtung | unsichtbar | P1 | wählt Fokus (Block 4) und „Lohnt sich jetzt“ |
| B7 | „Sag es“ an 4–5 Tagen | Wochenplan (Mo, Tag nach Preply) | P1/P7a | fester Wochenplan statt Würfeln (Lehrer-Lücke 2) |
| B8 | Serie | Kopf (Profil-Knopf), Pr | WP0/P6 | Regel unverändert |
| B9 | Datum · Minuten · Serie | H Unterzeile, Tageskarte, Kopf | P1 | – |
| B10 | „Als Nächstes lohnt sich“ | H › Fertig › „Lohnt sich jetzt“ | P1 | – |
| B11 | Freie Runde Vokabeln | W › Extra-Runde (H › Fertig verweist) | P3 | – |
| B12 | Wochen-Check-Angebot | Einheit So + Pr › Tests | P1/P6 | – |
| B13 | „Mehr üben“ | Reiter Üben (immer sichtbar) | WP0 | Die Zeile entfällt, das Ziel ist der Reiter |
| B14 | Tagesbilanz | H › Fertig | P1 | – |
| B15 | Preply als Extra-Zeile | H › ruhige Zeile | P5 | – |
| B16 | Speicherfehler | H › ruhige Zeile | P1 | – |
| B17 | Tagesplan-Fehler | H › ruhige Zeile | P1 | – |
| B18 | Selbstheilung Pflicht | unsichtbar | P1 | + `u-*` |
| B19 | Tagesauftrag übernehmen | unsichtbar | P6 (`dayJobs`) + P1 (Zeitpunkt) | läuft nach `lx:status` |
| B20 | Auto-Einschätzung | unsichtbar | P6 | – |

### C. Vokabel- und Wendungstrainer (25)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| C1 | Pflichtrunde Wiederholen | Einheit B1 + W › Alle fälligen | P3 | `auto` nach `anki-regeln.md` §1 |
| C2 | Freie Runde mit Stapel/Größe | W › Stapel + Extra-Runde | P3 | Stapel = Filter, eigene Stapel |
| C3 | Leiter mit 14 Abfragearten | Trainer (Tippen) | P3 | + Art `flip` (nie automatisch gewählt) |
| C4 | Automatische Einstufung | Trainer (Tippen) | P3 | Ausnahme: Aufdecken mit 4 Knöpfen (A7) |
| C5 | Status statt Erklärtexten | Trainer, Aufdeckkarte | P3 | + Status „Kontrolle“ |
| C6 | Kinetische Lücke | Trainer | P3 (Engine WP0) | – |
| C7 | Erst Hinweis, dann Lösung | Trainer + FeedbackPanel | P3/WP0 | – |
| C8 | Toleranz, UK = richtig | unsichtbar | P3 | – |
| C9 | Beispiele statt „Warum“ | Trainer, Rückseite | P3 | – |
| C10 | Formhinweis, Wortart | Trainer | P3 | – |
| C11 | „Ich lag richtig“ | FeedbackPanel | WP0/P3 | – |
| C12 | „Einmal richtig schreiben“ | FeedbackPanel | WP0/P3 | – |
| C13 | Automatisch weiter | Trainer; Schalter E › Lernen | P3/P6 | – |
| C14 | Neues Wort vorstellen | Trainer | P3 | (Soll) „Kenne ich“ |
| C15 | Neue unter Wiederholungen | unsichtbar | P3 | ein Kontingent, Eingangskorb-Reihenfolge |
| C16 | Hartnäckig + Merkhilfe | Trainer, Wortblatt, Stapel „Hartnäckig“ | P3 | + Angebote (N28) |
| C17 | Eigener Satz mit KI | Trainer | P3 | – |
| C18 | Wendung aus der Situation | Trainer | P3 | – |
| C19 | Wendungen ab Stufe 3 | unsichtbar | P3 | Stufen 1–2: Aufdecken |
| C20 | Reparatur-Sätze im Trainer | Einheit B1 (zuerst) + Trainer | P3 (Komponente P2) | – |
| C21 | Zähler mit Nochmal/Reparatur | Player-Leiste „n / m (+2)“ | P3/WP0 | – |
| C22 | Zusammenfassung mit „Weiter“ | SessionEnd | P3/WP0 | – |
| C23 | Jedes Wort antippbar | überall | P3 | – |
| C24 | Speichern je Antwort | unsichtbar | P3 | – |
| C25 | Runde fortsetzen | Rahmen + Trainer | WP0b/P3 | **+R** (Mangel behoben) |

### D. Wortschatz (17)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| D1 | Liste aller Einträge | W › „Alle Einträge“ (`vocabList`) | P3 | 50er-Seiten, ohne `layoutId` |
| D2 | Filter und Sortierung | Liste › Chips | P3 | + Hartnäckig, Mehrfachauswahl |
| D3 | Kopfzeile Wortschatz | W › Alle fälligen (Neu · Lernen · Fällig) + Eingangskorb-Zeile | P3 | – |
| D4 | Wortblatt | Blatt, von überall | P3 | – |
| D5 | Messwerte am Wort | Wortblatt › Details | P3 | + Verlauf ✓✗ |
| D6 | „Jetzt üben“ | Wortblatt | P3 | – |
| D7 | „Kenne ich schon“ | Wortblatt „Kann ich sicher“ | P3 | – |
| D8 | Ausblenden / aufnehmen | Wortblatt + Mehrfachauswahl | P3 | – |
| D9 | Zurücksetzen | Wortblatt „Von vorn“ | P3 | – |
| D10 | Merkhilfe am Wortblatt | Wortblatt | P3 | – |
| D11 | Eigenes Wort | Blatt Hinzufügen (W „+“, C) | P3 | – |
| D12 | 8 Wörter von Claude | Hinzufügen › Von Claude | P3 | – |
| D13 | Fachwörter Beruf | Hinzufügen › Für meinen Beruf | P3 | – |
| D14 | Aus Text/Übersetzer/Gespräch speichern | Wort-Popover „+ Wortschatz“ (überall) | P3 | 1 Tipp |
| D15 | Wortschatzziel 8.000 | St › Ziel C1 | P6 | – |
| D16 | Wortschatztest | Pr › Tests | P6 | **+R** |
| D17 | Stufen-Zahlen, Kennzahlen | St › Statistik (Abschnitt von P3) | P3 | – |

### E. Grammatik und Nachschlagen (14)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| E1 | Themenliste 16 + 7 | Ü › Grammatik & Fallen › Grammatik | P2 | – |
| E2 | Themenblatt | Grammatik › Thema (Blatt) | P2 | – |
| E3 | Thema üben | Themenblatt | P2 | **+R** |
| E4 | Neue Aufgaben von Claude | Themenblatt | P2 | – |
| E5 | Freie Runde | Grammatik-Seite | P2 | **+R** |
| E6 | Fehler-Wiederholung | Ü › Aus deinen Fehlern | P2 | – |
| E7 | Pflichtkanal Grammatik (inkl. `daily/*`) | Einheit B4 (Rückfall) | P2 | kein eigener Pflichtpunkt mehr |
| E8 | Vier Aufgabenarten | Grammatik-Runde | P2 | – |
| E9 | KI-Urteil Umformen/Verbessern | Grammatik-Runde | P2 | – |
| E10 | Wort-für-Wort-Vergleich | FeedbackPanel | P2/WP0 | – |
| E11 | Sofort bewertet | Grammatik-Runde | P2 | – |
| E12 | Hinweis, Weiß ich nicht, Einspruch | FeedbackPanel | P2/WP0 | – |
| E13 | Nachschlagen „Wissen“ | Ü › Grammatik & Fallen › Nachschlagen | P2 | 2 statt 3 Tipps |
| E14 | DE → EN: typische Fallen | Nachschlagen › Abschnitt | P2 | – |

### F. Kurs und Lektionen (10)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| F1 | Kursübersicht | Ü › Dein Weg › Kurs (`course`) | P2 | – |
| F2 | Meilenstein je Einheit | Kurs-Seite | P2 | – |
| F3 | Nächste Lektion | Ü › Kurs-Karte | P2 | nicht mehr auf Heute |
| F4 | Lektion in 4 Schritten | Lektion (Player) | P2 | – |
| F5 | Claude oder Grundfassung | Lektion | P2 | – |
| F6 | Dialog hören/lesen | Lektion | P2 | – |
| F7 | Eigener Text mit Urteil | Lektion | P2 | FeedbackPanel |
| F8 | Lektion fortsetzen | Rahmen + Lektion | P2 | **+R** mit Stand im Schritt |
| F9 | Kurs erweitern | Kurs-Seite | P2 | – |
| F10 | Lektion als Pflichtpunkt | geändert: Angebot unter Üben | P1/P2 | Die Pflicht ist die Tageseinheit (Lehrer-Lücke 2) |

### G. Kurzübungen (6)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| G1 | Diktat | Ü › Training | P2 | **+R** |
| G2 | Lückenjagd | Ü › Training (auch Einheit B4) | P2 | **+R** |
| G3 | Satzbau | Ü › Training | P2 | **+R**; Bausteine ohne `layout` |
| G4 | Sprint 90 s | Ü › Training | P2 | nicht fortsetzbar (Wertung auf Zeit), ✕ verwirft |
| G5 | Nur machbare Übungen | Ü-Hub | P2 | – |
| G6 | Drill fortsetzen | Rahmen | P2 | **+R** (Mangel behoben) |

### H. Lesen, Hören, Schreiben, Entdecken (27)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| H1 | Lese-Bibliothek | L › Bibliothek | P4 | + „x % neu“ |
| H2 | Neuer Text mit Themenwahl | L › Aktionen „Neuer Text“ | P4 | – |
| H3 | Eigener Text | L › „+ Eigener Text“ | P4 | – |
| H4 | Glossar vorab | Leser | P4 | – |
| H5 | Verständnisfragen | Leser | P4 | – |
| H6 | Zusammenfassung mit KI | Leser | P4 | FeedbackPanel |
| H7 | „Alle als Karten“ | Leser-Ende | P4 | + „Wörter aus diesem Text üben“ |
| H8 | Hörtext-Bibliothek | L › Chip „Hören“ | P4 | – |
| H9 | Hörtext erzeugen | L › Aktionen „Neuer Hörtext“ | P4 | – |
| H10 | Abspielleiste | Hören | P4 | + Tempo-Leiter, Satz ↺, Pause je Satz |
| H11 | Wörter vorab, Fragen | Hören | P4 | – |
| H12 | Transkript + Shadowing | Hören | P4 | zusätzlich Übung Nachsprechen (P7) |
| H13 | Schreibaufgabe des Tages | S/S › Schreibaufgabe | P4 | – |
| H14 | Andere Aufgabe, eigenes Thema | Schreibaufgabe | P4 | – |
| H15 | Entwurf, Wortzähler | Schreibwerkstatt | P4 | **+R** |
| H16 | Wendungs-Chips | Schreibwerkstatt | P4 | – |
| H17 | KI-Korrektur im Hintergrund | Schreibwerkstatt + Ladepunkt am Reiter | P4/WP0 | – |
| H18 | Rückmeldung zum Text | Schreibwerkstatt | P4 | Einheitsstil; CEFR nur als ruhiger Satz |
| H19 | Überarbeiten | Schreibwerkstatt | P4 | – |
| H20 | Nochmal nach dem Schreiben | Schreibwerkstatt | P4 (Komponente P2) | – |
| H21 | Verlauf je Kanal | L › Verlauf (Lesen/Hören/Entdecken); S/S › Verlauf (Schreiben) | P4 | eine Seite, mit Filter geöffnet |
| H22 | Entdecken-Liste | L › Heute neu + „Alle Beiträge“ | P4 | – |
| H23 | Beitrag in 4 Schritten | Beitrag (Player) | P4 | **+R** |
| H24 | Anwenden mit KI | Beitrag | P4 | – |
| H25 | Status je Einheit | Player/Einheit | P4 | – |
| H26 | „Heute geübt“ | L-Kacheln „heute gelesen“ | P4 | – |
| H27 | Messwerte je Einheit | Einheit › Details | P4 | – |

### I. Sprechen: Szenen und Rollenspiel (16)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| I1 | Szenenbibliothek | S/G › Szenen | P5 | + Business-Szenen (P7a), Wochenthema oben |
| I2 | Einweisung | Szene › Blatt | P5 | + Ziel-Checkliste |
| I3 | Neue Szene | Szenen › „Neue Szene“ | P5 | – |
| I4 | Rollenspiel gestreamt | Gespräch (Player) | P5 | + Ziele abhaken; (Soll) Zeitlimit |
| I5 | Analyse in 3 Schichten | Gespräch | P5 | – |
| I6 | Wendung mitnehmen | Gespräch | P5 | – |
| I7 | Wendungs-Chips | Gespräch | P5 | – |
| I8 | Vorlesen / Mikrofon | Gespräch | P5 | Diktiertaste als Standard |
| I9 | Gespräch fortsetzen | Rahmen (Hülle um `speak/resume.ts`) | P5 | **+R** automatisch |
| I10 | Abschlussbericht | Bericht + SessionEnd | P5 | + Kriterien-Raster |
| I11 | C1-Werkzeugkasten im Bericht | Bericht | P5 | – |
| I12 | Nochmal nach dem Gespräch | Bericht | P5 (Komponente P2) | – |
| I13 | Nochmal/Andere Szene/Zu Heute | SessionEnd | P5 | – |
| I14 | Wendungen aus Szenen | S/G › Training | P5 | – |
| I15 | Sprech-Status | korrigiert: nur, wenn Block 3 heute ein Gespräch ist | P5 | Widerspruch zu Kap. 2.2 behoben |
| I16 | Sprechen → Urteil/Radar | unsichtbar | P5 | – |

### J. Freies Sprechen und Formulieren (15)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| J1 | Sag es | S/S › Sag es + Einheit B3 (Mo) | P5 | + „Laut zuerst“, **+R** |
| J2 | Sag es: Korrekturen | Sag es | P5 | FeedbackPanel |
| J3 | Sag es: zweiter Durchgang | Sag es / Einheit B5 | P5/P2 | – |
| J4 | Flüssigkeit 90/60/45 | S/G › Training + Einheit B3 (Di/Fr) | P5 | + Wörter/Min., **+R** |
| J5 | Flüssigkeit: Auswertung | Flüssigkeit | P5 | + Nochmal |
| J6 | Termin anlegen | S/G › Termin (`meeting`) | P5 | – |
| J7 | Termin: Vorbereitung | Termin | P5 | – |
| J8 | Alle als Wendungen | Termin | P5 | – |
| J9 | Generalprobe | Termin; Einheit B3 (Do, Alternative) | P5 | – |
| J10 | Nachbesprechung | Termin | P5 | – |
| J11 | Drei Tonlagen | S/S › Tonlagen + Einheit B3 (Mi, gerade Wochen) | P5 | **+R** |
| J12 | Tonlagen: Urteil | Tonlagen | P5 | + Nochmal |
| J13 | Reparatur-Sätze sammeln | unsichtbar | P2 | – |
| J14 | Nochmal-Schritt | FeedbackPanel-Platz + Einheit B5 | P2 | – |
| J15 | Reparatur-Stand | Ü › Aus deinen Fehlern | P2 | – |

### K. Business (9)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| K1 | E-Mail-Refiner | S/S › E-Mail verbessern | P5 | **+R** |
| K2 | Fassung je Satz | Refiner | P5 | `TilePicker` ohne `layout` |
| K3 | Kopieren, Statistik | Refiner | P5 | – |
| K4 | Phrasen-Baukasten | S/G › Training › Verhandlungs-Baukasten | P5 | ohne `mode="wait"` |
| K5 | „Auf meine Lage anpassen“ | Baukasten | P5 | – |
| K6 | Kurzdrill | Baukasten | P5 | (Soll) Anwenden-Schritt |
| K7 | Pitch: Sprechfassung | S/G › Training › Pitch-Coach | P5 | **+R** |
| K8 | Pitch: Rückmeldung | Pitch | P5 | FeedbackPanel |
| K9 | Wendungen mitnehmen | Refiner/Pitch/Baukasten | P5 | – |

### L. Preply-Brücke (9)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| L1 | Stunde vorbereiten | S/P › Vorbereiten | P5 | – |
| L2 | Stundenplan + Kopieren | S/P › Plan | P5 | – |
| L3 | Wochenfokus in der Nachricht | S/P › Plan | P5 | – |
| L4 | Vom Lehrer übernehmen | S/P › Übernehmen | P5 | – |
| L5 | Vorschau + Übernahme | S/P › Übernehmen | P5 | – |
| L6 | Stunde gehalten | S/P › Gehalten | P5 | – |
| L7 | Verlauf der Stunden | S/P › Verlauf | P5 | – |
| L8 | „Als Preply-Stunde“ von überall | an Artikel, Text, Thema, Szene, Bericht, Wochenbericht, Claude | P5 (Komponente) | – |
| L9 | Preply-Zeile auf Heute | H › ruhige Zeile | P5 | – |

### M. Fehler als Lernquelle (5)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| M1 | Deutsch-Fallen erkennen | Ü › Grammatik & Fallen › Deutsch-Fallen | P2 | – |
| M2 | Wochentrend | Deutsch-Fallen | P2 | – |
| M3 | Wochenfokus (App + Preply) | Deutsch-Fallen; Seite „Deine Woche“ zeigt ihn als Wochenziel | P2 (P1 zeigt) | – |
| M4 | Fallen-Kurzdrill | Deutsch-Fallen | P2 | + Startsatz (N43), **+R** |
| M5 | Fehler-Radar 30 Tage | St › Fehler | P6 | – |

### N. Claude, Übersetzer, Wort-Antippen (20)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| N1 | Chat | C › Fragen | P6 | – |
| N2 | „Sieht gerade“ | C | P6 | – |
| N3 | Vorschläge je Kontext | C | P6 | – |
| N4 | Schnell/Gründlich | C | P6 | – |
| N5 | Aktions-Chips | C | P6 | (Soll) echte Werkzeuge |
| N6 | Kein Scroll-Springen | C | P6 | – |
| N7 | Tastatur-Anpassung | C | P6 | – |
| N8 | Falsche Sprache neu | C | P6 | – |
| N9 | Kopieren, Speicherfehler | C | P6 | – |
| N10 | Übersetzer | C › Übersetzen | P6 | – |
| N11 | Register | Übersetzen | P6 | – |
| N12 | Alternativen, Hinweise, Anhören | Übersetzen | P6 | – |
| N13 | In den Vokabeltrainer | Übersetzen: „+ Wortschatz“ je Wort und am Ergebnis | P6 | 1 Tipp (Mangel behoben) |
| N14 | Zuletzt übersetzt | Übersetzen | P6 | – |
| N15 | Wort antippen überall | überall | P3 | – |
| N16 | Wörterbuch, Grundform, US-IPA | Wort-Popover | P3 | Lautschrift nicht im Startpfad |
| N17 | „Hier im Satz“ | Wort-Popover | P3 | – |
| N18 | Anhören | Wort-Popover | P3 | – |
| N19 | Als Karte speichern | Wort-Popover „+ Wortschatz“ | P3 | – |
| N20 | „Claude fragen“ zum Wort | Wort-Popover → C | P3/P6 | – |

### O. Dein Stand (19)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| O1 | Kopfkarte | St › Kopf (Kurs · Wörter · Niveau); Serie in Pr | P6 | – |
| O2 | Wochenstreifen | Pr › Kopf | P6 | – |
| O3 | Niveau-Skala | St › Kopf | P6 | – |
| O4 | KI-Einschätzung | St › Urteil (ein Satz in Pr) | P6 | – |
| O5 | Fertigkeiten mit Datenlage | St › Urteil | P6 | – |
| O6 | Stärken, Blocker, Üben | St › Urteil (Sprung per Deep-Link) | P6 | – |
| O7 | Fokus der nächsten Tage | St › Urteil | P6 | fließt in Block 4 (P1) |
| O8 | Neu einschätzen / auto | St › Urteil | P6 | – |
| O9 | Can-Do B2 → C1 | St › Ziel C1 | P6 | C1 erst mit 2 Belegen (N92) |
| O10 | Was zu C1 fehlt | St › Ziel C1 | P6 | – |
| O11 | Wochen-Check | Pr › Tests + Einheit So | P1 (Übung) / P6 (Zeile) | **+R** |
| O12 | Bisherige Checks | Pr › Tests › Wochen-Check | P6 | – |
| O13 | Wochenbericht | Pr › Wochenbericht | P6 | – |
| O14 | Verlauf 120 Tage | St › Verlauf | P6 | – |
| O15 | Aktivitäts-Heatmap | St › Statistik (oben) | P6 | – |
| O16 | Einschätzungen, Meilensteine | St › Verlauf | P6 | – |
| O17 | Alte Fortschritte | St › Verlauf | P6 | – |
| O18 | Messwerte (FSRS, BKT …) | St › Statistik (FSRS, P3) / Verlauf (BKT) | P6/P3 | – |
| O19 | Fallen-Wochenzeile | St › Verlauf | P6 | – |

### P. Einstellungen (15)
| # | Funktion | Neuer Ort | Paket | Änderung |
|---|---|---|---|---|
| P1 | Sprache | E › Darstellung | P6 | – |
| P2 | Darstellung | E › Darstellung | P6 | – |
| P3 | Farbthema | E › Darstellung | P6 | – |
| P4 | Neue Wörter/Tag | E › Lernen | P6 | ein Kontingent für alle Wege |
| P5 | Tagesziel | E › Lernen | P6 | steuert die Kurz-Einheit |
| P6 | Automatisch weiter | E › Lernen | P6 | – |
| P7 | Töne | E › Stimme & Ton | P6 | – |
| P8 | Vibration | E › Stimme & Ton | P6 | – |
| P9 | Stimme, Tempo | E › Stimme & Ton | P6 | – |
| P10 | Beruflicher Kontext | E › Mein Kontext | P6 | – |
| P11 | Datenexport | E › Daten | P6 | (Soll) + CSV |
| P12 | Diagnose | E › Daten | P6 | + `lx:boot/live/status/card` |
| P13 | Profilgröße auslagern | E › Daten | P6 | bleibt aus (A7) |
| P14 | Quellen, Lizenzen | E › Daten | P6 | – |
| P15 | Kommentare als Testweg | Plattform | – | Prozess, unverändert |

**Ergebnis:** 239 von 240 Funktionen haben genau einen neuen Ort. Die eine Ausnahme ist A14 („Was ist neu“), begründet oben. F10 und B7 ändern ihre Rolle (die Pflicht wird die Tageseinheit), die Funktionen selbst bleiben erreichbar.

---

## 3. Neue Funktionen

### 3.1 Plattform-Regeln für alles Neue
- **Mikrofon unsicher:** Jede Sprechaufgabe hat ein Textfeld mit dem Hinweis „Laut sprechen, dann tippen oder mit 🎤 auf der Tastatur diktieren“. `MicButton` erscheint nur, wenn `stt` wirklich startet. Aussprache wird nie bewertet, sie wird nur vorgesprochen und nachgesprochen.
- **Sprachausgabe:** Stücke ≤ 150 Zeichen, Tempo 0,9 / 1,0 / 1,1. Wort-Markierung über `boundary` nur als Soll, denn am iPhone ist das unsicher.
- **KI nie blockierend:**
  - Lokale Bewertung zuerst, KI-Teile streamen nach, „Weiter“ ist immer aktiv.
  - Vorab-Erzeugung nur nach ausdrücklicher Handlung, etwa „Los“ auf der Tageskarte (Input-Text im Hintergrund, während Block 1 läuft). platform-guard bestätigt das gegen `sample.d.ts`.
  - Fehlercodes nach A6.2 und A6.3.
- **Daten:** Neue wachsende Ströme werden je Monat gebündelt (A6.6). Neue Dokumente siehe 4.10.

### 3.2 Prompt- und Inhalts-Hoheit (passt `architektur.md` §5.2/§5.3 an)
- **Neue Vorlagen:** nur als neue Dateien unter `src/prompts/nb/<paket>/<name>.ts`, eingetragen in die Paketliste `src/prompts/nb/<paket>.ts` (gehört dem Paket).
  - WP0a legt `src/prompts/nb/index.ts` und die 7 leeren Listen an. In `src/prompts/registry.ts` fügt es einmal `...NB_TEMPLATES` hinzu.
  - Der bestehende Registry-Test prüft eindeutige Kennungen und die Kopfzeile `[id@v]` automatisch.
- **Bestehende Vorlagen** (`src/prompts/*.ts`) bleiben während der Parallelphase unverändert.
  - Braucht ein Paket eine geänderte Fassung, legt es einen **Nachfolger mit neuer Kennung** an (`<alte-id>-nb`, Version 1) und stellt nur den eigenen Aufruf um. Die alte Vorlage bleibt registriert, das ist der Rückweg.
  - In Paket A nur, wenn das Abbilden im FeedbackPanel nicht reicht. Die geplanten Nachfolger stehen in Paket B (B2).
- **Integrator-Wünsche:** Änderungen an eingefrorenen Dateien meldet jedes Paket nur im Abschnitt „Wünsche“ seines Abschlussberichts. Der Integrator setzt sie im Integrationsfenster nur um, wenn sie ≤ 10 Zeilen sind, sonst kommen sie in Paket B.
- **Inhalte:** Neue Inhalte kommen nur nach `src/content/nb/**` (P7). Bestehende Inhalte bleiben unverändert. Ausnahme: Die Art des Imports darf zu `?raw` + Parsen bei Bedarf wechseln (Anhang A), das ändert der Besitzer des einlesenden Moduls.
- **Domäne:** Die Pakete legen in ihren Domänen-Ordnern (4.9) neue Dateien an und erweitern Exporte nur. Signaturen, Schemas und Schreibwege bleiben. Ausnahmen stehen ausdrücklich beim Paket.

**Neue Vorlagen in Paket A (Muss):**

| Vorlage | Paket | Modell | Zweck |
|---|---|---|---|
| `goal-check@1` | P5 | quick | Ziel-Checkliste und Kriterien-Raster im Rollenspiel |
| `pressure-check@1` | P7 | quick | Einwand-Muster: anerkennen · nachfragen · antworten · absichern |
| `inbox-check@1` | P7 | default | Anliegen getroffen? Ton? ≤ 3 Korrekturen |

**Soll-Vorlagen:**

| Vorlage | Paket |
|---|---|
| `text-level@1`, `alternatives@1`, `writing-genre@1` | P4 |
| `text-cards@1`, `card-contrast@1` | P3 |
| `quick-drill@1` | P6 |

Für alle gelten: zod-Schema, `QUOTE_RULE`, Sprachtreue und reparierendes Lesen über `sample()` (A7, 27.09. abends).

### 3.3 Liste der neuen Funktionen

- **Stufen:**
  - **Muss** gehört zu Paket A.
  - **Soll** gehört zu Paket A, wenn es bis 06:20 grün ist, sonst kommt es automatisch nach Paket B (B3).
  - **B** heißt Paket B.
- **Aufwand:** S ≤ 45 Min., M ≤ 2 Std., L > 2 Std.

| ID | Funktion | Quelle | Paket | Aufw. | Stufe | Abnahmekriterium |
|---|---|---|---|---|---|---|
| N01 | 5 Reiter, Kopf wie v1 | IA, v1 | WP0 | M | Muss | Leiste einzeilig bei 390 px in DE/EN. Tipp auf den aktiven Reiter führt zur Wurzel und nach oben. `lx:nav` < 100 ms. |
| N02 | Player mit einer Leiste, ✕ ohne Rückfrage | Markt UI 2, 14 | WP0 | M | Muss | Jede Übung hat dieselbe Leiste. ✕ zeigt den Toast, die Herkunft steht unverändert da, samt Bildlauf. |
| N03 | Fehlergrenzen (Wurzel · Seite · Schritt), `runAction`, Diagnose sofort | Leistung §6 | WP0 | M | Muss | Unit-Test je Ebene. Mit `lx:crash-once` erscheint je Übung „Diese Aufgabe überspringen“ und die Runde läuft weiter. Der Diagnose-Eintrag überlebt ein Neuladen. |
| N04 | Fortsetzen nach Neuladen | Leistung §5, Markt 5 | WP0 + alle | M | Muss | E2E `reload()` in Trainer, Grammatik, Lektion, Rollenspiel und Einheit: gleiche Position, kein doppelter Schreibvorgang, Serie unverändert. Automatisch nur < 2 Min., sonst die Zeile. |
| N05 | Einheitliche Rückmeldung (`FeedbackPanel`) | Lehrer Rückmeldestil, Markt 4 | WP0 (+ Pakete) | M | Muss | Wirkung in einem Satz. ≤ 3 Korrekturen, sortiert Verständnis > Falle > Wochenziel. Hinweis → 2. Versuch → Lösung mit Grund, auch bei richtiger Antwort. ≤ 2 Aufwertungen mit „Merken“. „Nochmal, aber besser“, „Warum?“. Farbe nur als Streifen + Symbol. |
| N06 | Session-Ende | Markt 6 | WP0 (+ Pakete) | S | Muss | Kacheln Richtig · Zeit · neue Einträge, „Das nimmst du mit“ (antippbar), **ein** nächster Schritt, kein Konfetti. |
| N07 | „Warum?“ → Claude-Blatt | Duolingo „Explain my answer“, Markt 4 | WP0 (Link) + P6 | S | Muss | 1 Tipp aus jeder Rückmeldung. Die Frage enthält Aufgabe, Antwort und Lösung. Ohne KI unsichtbar. |
| N08 | Deep-Links `#go=` | Architektur | WP0 | S | Muss | Jede Route startet per `#go=`. Der Wert wird nur gelesen, nie geschrieben. |
| N09 | Startpfad: zod in Stücken, eine Schrift, kein `scrollTo` beim Wechsel | Leistung 5–7 | WP0 | M | Muss | Long Task um `lx:live` < 50 ms. Kein Long Task > 100 ms nach `lx:status`. |
| N10 | Tageseinheit in 5 Blöcken im Player | Lehrer 2.1, Markt 21 | P1 (+ Anbieter) | L | Muss | 1 Tipp bis zur 1. Aufgabe, kein Rücksprung nach Heute zwischen den Blöcken, ohne KI erfüllbar. Die Serie zählt nur mit allen Blöcken des Tages. „x von n“ stimmt an Karte, Leiste und Abzeichen überein. |
| N11 | Wochenthema + Seite „Deine Woche“ | Lehrer T1, Duolingo „Leitfaden“ | P1 (+ P7a) | M | Muss | Montags erscheint die Bestätigungskarte. Die Wahl steht in `app/week` und ist auf dem zweiten Gerät gleich. Wendungen mit ▶ und „Alle in den Wortschatz“ (mit Ursprungssatz). Werkzeug und Falle sind je 1 Tipp entfernt. |
| N12 | Wochenplan Mo–So, Kurz-Einheit, Rückfälle | Lehrer 2.2 | P1 (Domäne P7a) | M | Muss | Unit-Tests 7 Tage × KI an/aus × Sprachausgabe an/aus × Kurz. Der Plan ist je Lerntag eingefroren. |
| N13 | Wochenziele sichtbar und lokal mitgezählt | Lehrer W7, W8, G2 | P1 (Daten) + P5/P7 (Anzeige) | S | Muss | Die Aufgabe zeigt z. B. „Ziel: 2 Abschwächungen · 3 Überleitungen“. Der Zähler steigt beim Tippen lokal (`detectTargets`). |
| N14 | Heute sofort aus lokalem Plan | Leistung 3 | P1 | M | Muss | `lx:status` < 1,5 s (4×, Seed), < 2 s (Großdatensatz). Kein `await` auf Schreiben oder `sampleUsableWithin` vor `lx:status` (Unit-Test mit verzögertem Writer). |
| N15 | Tagesring, Fertig-Zustand mit Bilanz und „Morgen“ | Markt 1 | P1 | S | Muss | Voll = Häkchen, der Knopf verschwindet. Danach genau 1 Vorschlag. |
| N16 | Preply-Verschiebung (Tag vor/nach) | Lehrer 2.2 | P1 + P5 | M | Soll | Mit `app/week.preplyNext` stimmen die Blöcke 2 und 3 laut 1.5. |
| N17 | Termin- oder Preply-Thema hat Vorrang beim Vorschlag | Lehrer §3 | P1 | S | Soll | Unit-Test |
| N20 | Aufdecken nach `anki-regeln.md` (pickMode, Vorderseite DE + Lücke, Rückseite voll, 4 Knöpfe mit Intervall, Vorschlag, Wischen, 1–4/Leertaste, Stufenregel, Nochmal an Position +6, Kontrolle, Kalibrierung) | Lehrer W1, Markt 2 | P3 | L | Muss | Alle Pflicht-Tests aus `anki-regeln.md` §7. E2E 40 Karten am Stück. Gleiches `t` für Vorschau und Speichern. `lx:card` < 50 ms. |
| N21 | Richtung je Stapel: DE→EN (Standard), EN→DE, Gemischt | anki-regeln §8, Markt 19 | P3 | S | Muss | Einheit und „Alle fälligen“ immer DE→EN. Die Richtung ist je Stapel gemerkt. |
| N22 | Stapel = Filter mit Zählern Neu·Lernen·Fällig, eigene Stapel | Anki | P3 | M | Muss | Anlegen, umbenennen, Filter, Modus, Richtung, Größe, ausblenden. `matchDeck` ist rein und getestet. ≤ 40 Stapel, ≤ 500 IDs. |
| N23 | Ein Kontingent, Eingangskorb-Reihenfolge, „reicht für n Tage“, Korb sichten | anki-regeln §5, Lehrer W12 | P3 | S | Muss | Tests aus §7. Stapel bekommen neue Karten aus dem Rest-Kontingent. Stufe 4 (Wochenthema) über `isThemeCard`. |
| N24 | Wortliste als Browser | Anki, Markt 12 | P3 | M | Muss | 1.500 Karten: erste Zeilen < 300 ms, ≤ 60 Zeilen im DOM, kein `layoutId`. Mehrfachauswahl: Ausblenden, zu Stapel. Verlauf ✓✗ im Wortblatt. |
| N25 | Wortblatt: „Kann ich sicher · Morgen wieder · Von vorn“ | Anki | P3 | S | Muss | Schreibt nur über `writer.transform`, alte Felder bleiben (A6.14). |
| N26 | Blatt Extra-Runde | Anki, Memrise, Markt 14/15 | P3 | M | Muss | Jede Option startet eine zeitweilige Sitzung ohne neues Dokument. Neue Karten nur im Rahmen des Kontingents. |
| N27 | Prognose 7 Tage + Statistik im Stand | Anki, Markt 11 | P3 | M | Muss | Erinnerungsquote 30 T, Karten je Zustand, Median-Stabilität, sichere Einträge. Rein berechnet, mit Tests. |
| N28 | Hartnäckige Karten mit Angeboten | Anki, Markt 16 | P3 | S | Muss | Ab 6 Fehlschlägen: neues Beispiel, Merkhilfe (vorhanden), (Soll) Kontrastpaar. |
| N29 | Karte zu Karte < 50 ms, Lautschrift nicht im Startpfad | Leistung 4/5 | P3 | M | Muss | Kein `mode="wait"`, n+1 vorberechnet, Einblenden ≤ 150 ms. `pron.ts` lädt erst beim ersten Bedarf. |
| N30 | Einstellungen „Wortschatz“ (Modus, Richtung, 4 oder 2 Knöpfe) | Produktkonzept | P3 | S | Muss | 2 Knöpfe bedeuten „Nicht gewusst“ = 1 und „Gewusst“ = Vorschlag. |
| N31 | Karte bearbeiten | Anki | P3 | S | Soll | Bedeutung und Satz, per `transform`, der Ursprungssatz bleibt Pflicht. |
| N32 | „Kenne ich“ auf der Einführungskarte | Memrise | P3 | S | Soll | Wie D7 |
| N33 | Markierung „Mit Lehrer besprechen“ | Anki, Quizlet | P3 (+ P5) | S | Soll | `app/decks.flagged`, erscheint in der Preply-Vorbereitung. |
| N34 | „Aus Text“: Kartenvorschläge | Lingvist, Markt 25 | P3 | M | Soll | 5–15 Vorschläge mit Satz, Häkchen, „Übernehmen“. |
| N35 | Hör-Modus (Aa „Hören“) + Hörschleife | Clozemaster, Glossika, Lehrer T5 | P3 | M | Soll | Sprachausgabe spricht, Lücke tippen. Die Hörschleife zählt nicht als Wiederholung. |
| N40 | Üben-Hub mit 4 Abschnitten | IA | P2 | M | Muss | `learn-hub`, `hub-*` bleiben. |
| N41 | Fokus-Block (Block 4) | Lehrer 2.1 | P2 | M | Muss | Liest die Korrekturen aus `ctx` oder den Daten von heute. Falle → Mini-Drill mit 3 Sätzen. Rückfall: Grammatikkanal inkl. `daily/*`. |
| N42 | Block 5 „Nochmal, aber besser“ | Lehrer 2.1, I14 | P2 | S | Muss | Vorher/Nachher nebeneinander, Reparatur-Karten entstehen automatisch, ohne KI lokaler Vergleich. |
| N43 | Fallen-Startsatz (25) im Drill | Lehrer W9 | P2 (+ P7a) | S | Muss | Der Drill mischt 3 Startsatz-Fallen mit eigenen. Der Trend gilt nur für eigene. |
| N44 | Einheitsstil in Grammatik, Drills, Fallen, Reparatur, Lektion | Lehrer-Lücke 4 | P2 | M | Muss | FeedbackPanel überall, ≤ 3 Korrekturen. |
| N45 | Ohne Warte-Animation, Wörterbuch aus dem Startpfad | Leistung 4/5 | P2 | S | Muss | `grammar/SessionScreen`, `repair/RepairStep`, `patterns/PatternDrill` ohne `mode="wait"`. `dueErrors` (`domain/grammar/errors.ts:176`) ohne `isDictWord`. |
| N46 | „Kurz erklärt“ vor der Aufgabe | Babbel | P2 | S | Soll | Aus `rules.json`, zuklappbar, ohne KI. |
| N47 | Falsche Aufgaben am Rundenende einmal wieder | Duolingo | P2 | S | Soll | Grammatik-Runde |
| N50 | Lesen als ein Reiter (Chips, Heute neu, Weiterlesen, „x % neu“) | LingQ, Markt 8 | P4 | M | Muss | „% neu“ lokal aus Wortschatz und Wörterbuch, rein und getestet. |
| N51 | Leser: Wortstatus dezent | LingQ | P4 | S | Muss | Gelb gepunktet = am Lernen, grün = gespeichert, kein Blau-Rauschen. |
| N52 | „Wörter aus diesem Text üben (n)“ | LingQ | P4 | S | Muss | Startet `startSession(..., { only })` (API P3). |
| N53 | Input-Block (Block 2) | Lehrer H1, L1 | P4 | M | Muss | Ohne KI: Themen-Text aus P7a. Mit KI: Text im Hintergrund ab „Los“, nie wartend. 2 Fragen, 2–3 Wendungen merken, liefert 3 Sätze zum Nachsprechen. |
| N54 | Tempo-Leiter, Satz ▶/↺, Pause nach jedem Satz | Lehrer H2, Readlang, Markt 20 | P4 | M | Muss | 1. Hören 0,9–1,0, 2. Hören 1,1–1,2. Das Tempo bleibt gemerkt und steigt bei richtigen Antworten. |
| N55 | Schreibwerkstatt im Einheitsstil, Kategorien Fehler · Natürlicher · Ton im Text | Grammarly, DeepL Write, Markt 10 | P4 | M | Muss | Abbildung der vorhandenen Fehlerstellen. Fallen zuerst (Abgleich mit `app/patterns`). CEFR nur als Satz. |
| N56 | Satzmodus | LingQ | P4 | S | Soll | – |
| N57 | Wendung markieren (erstes + letztes Wort antippen) | LingQ, Readlang | P4 | M | Soll | Nur im Leser. Öffnet das Wortblatt mit „+ Wortschatz“. |
| N58 | Wort-Markierung beim Vorlesen | Speak, Markt 20 | P4 | S | Soll | Nur, wo `boundary` feuert. |
| N59 | „Leichter“ / „Näher an C1“ | LingQ | P4 | M | Soll | – |
| N60 | Alternativen je Satzteil | DeepL Write | P4 | M | Soll | Erst auf Tipp, jeweils mit „Übernehmen“ und „+ Wortschatz“. |
| N61 | Gattungen: Executive Summary, LinkedIn, Halb so lang, DE→EN vermitteln | Lehrer S2, S5, S7, S8 | P4 | M | Soll | Eigene Maske und Wortziel je Gattung. |
| N70 | Sprechen-Reiter mit Abschnitten, Business-Szenen | Business-Apps, Markt 24 | P5 (+ P7a) | M | Muss | Die Szene zum Wochenthema steht oben. 12–16 feste Business-Szenen mit Zielen. |
| N71 | „Laut zuerst“ in Sag es | Lehrer I1, Lücke 3 | P5 | M | Muss | Zeitbalken → laut sprechen → tippen oder diktieren → bessere Fassung per Sprachausgabe → nachsprechen. |
| N72 | Ziel-Checkliste + Kriterien-Raster | Speak, Yoodli, Markt 9 | P5 | M | Muss | 3 Ziele oben, nach jeder Antwort nachgeladen abgehakt. Der Bericht zeigt ✓ / teilweise / ✗ mit Zitat. Ohne KI steht die Liste ohne Haken. |
| N73 | Wörter pro Minute im 45-s-Durchgang | Lehrer I2 | P5 | S | Muss | Lokal berechnet, Vergleich Di ↔ Fr. |
| N74 | Nochmal in Tonlagen und 90/60/45; Einheitsstil in Sag es, Tonlagen, Flüssigkeit, Pitch | Lehrer I14 | P5 | S | Muss | – |
| N75 | Anbieter für Block 3: Sag es, 90/60/45, Tonlagen, Generalprobe, Rollenspiel | Lehrer 2.2 | P5 | M | Muss | Jeder liefert `UnitTaskResult` (Text, Korrekturen, bessere Fassung). |
| N76 | Leistung: `SceneCard`/`TilePicker` ohne `layout`, Baukasten ohne `mode="wait"`, Playbooks als `?raw` | Leistung | P5 | S | Muss | – |
| N77 | Zeitlimit je Zug (45 s, abschaltbar) + Top-3-Fallen im Blick | Lehrer I4 | P5 | S | Soll | – |
| N78 | Anwenden-Schritt im Verhandlungs-Baukasten | Lehrer I5 | P5 | S | Soll | – |
| N79 | Pitch in 30/60/120 s | Lehrer I7 | P5 | M | Soll | – |
| N80 | Preply „Nächste Stunde am …“, markierte Karten, Wochenziele | Lehrer T4, Anki | P5 | S | Soll | Schreibt `app/week.preplyNext`. |
| N90 | Profil-Blatt | v1 | P6 | M | Muss | Jeder Stand-Reiter und jeder Test ist 2 Tipps von jeder Wurzel entfernt. |
| N91 | Stand-Reiter „Statistik“ | Anki, Markt 11 | P6 | S | Muss | Heatmap + Platz `stand`. |
| N92 | Can-Do: C1 erst mit 2 Belegen | Lehrer X2 | P6 | S | Muss | Die Selbstmarkierung bleibt sichtbar getrennt („selbst eingeschätzt“) und zählt nicht. |
| N93 | Claude-Blatt: „+ Wortschatz“ je Wort und am Ergebnis | Lehrer T2, Markt 7 | P6 | S | Muss | Übersetzen → Karte in 1 Tipp, mit Satz als Ursprung. |
| N94 | Einstellungen in 6 Gruppen | Markt UI 24 | P6 | S | Muss | Registrierte Abschnitte erscheinen in ihrer Gruppe. |
| N95 | Diagnose mit Messwerten | Leistung 10 | P6 | S | Muss | `lx:boot/live/status/card` sind sichtbar und kopierbar. |
| N96 | „Mach mir eine Übung dazu“ | Speak (KI-Tutor) | P6 | M | Soll | 5 Aufgaben im Player (`claudeDrill`, nutzt `GrammarItem` nur lesend). |
| N97 | Chat-Werkzeuge: Karte speichern, Übung starten | Inventur N5 ★ | P6 | M | Soll | Über Deep-Links und `lookup/store`. |
| N98 | CSV-Export für Anki | Readlang, Markt 25 | P6 | S | Soll | `downloads`, in Anki importierbar. |
| N100 | Inhalte (P7a), Liste in 4.8 | Lehrer §1–3 | P7 | L | Muss (Teile Soll) | Der Englischlehrer prüft einmal (01:20–02:00). US-Englisch, die Bedeutungen auf DE und EN. |
| N101 | Tipp-Drill-Motor + Kollokationen tippen | Lehrer W3 | P7 | M | Muss | Lokal geprüft, erlaubte Varianten, UK = richtig mit Hinweis. Die Lehnübersetzung dient als Kontrast. Nur tippen, keine Auswahl. |
| N102 | Satz-Umformung mit Schlüsselwort | Lehrer G3, Cambridge C1, Markt 23 | P7 | S | Muss | 30 Sätze, lokal gegen mehrere Musterlösungen. |
| N103 | Einwand-Training (Druck-Serie) | Lehrer I3 | P7 | M | Muss | 5 Einwände, je 10 s Bedenkzeit und 30 s Antwort. Das Muster ist sichtbar. Ohne KI: Selbstcheck + Musterantwort. Die beste Antwort kommt mit „Merken“ in den Wortschatz. |
| N104 | Posteingang | Lehrer L2 | P7 | M | Muss | Kundenmail mit verstecktem Einwand. „Was will der Kunde?“ (auf Deutsch erlaubt), dann Antwort und Rückmeldung. Ohne KI gibt es eine Musterantwort. |
| N105 | Nachsprechen Satz für Satz | Lehrer P2 | P7 | M | Muss | 3 Durchgänge mit 0,9 / 1,0 / 1,1. „Jetzt du“ dauert so lange wie der Satz. Quellen: bessere Fassung aus Sag es, Karten-Sätze der Woche, Themen-Text. Keine Wertung. |
| N106 | Block-Anbieter `task.inbox` (Mi), `task.objection` (Do), `pron.shadow` (nach Block 2), `focus.colloc` | Lehrer 2.2 | P7 | S | Muss | – |
| N107 | Wortbildung, Register-Leiter, Phrasal Verbs, Überleitungen (Motor-Sätze) | Lehrer W4, W5, W6, W8 | P7 | S je | Soll | – |
| N108 | Heißer Stuhl, Zeit gewinnen (Druck-Sätze) | Lehrer I9, I13 | P7 | S je | Soll | – |
| N109 | Wortbetonung, Zahlen/Daten/Beträge | Lehrer P1, P4 | P7 | S je | Soll | Lokal aus P7a-Listen, ohne KI. |

**Bewusst nicht übernommen**, Grund in `markt.md` Teil 2: Bild-Verdeckung, Ligen/Energie, Punkte/Ränge, Videos/Avatare, Lautfarben je Phonem, Füllwort- und Tempomessung, Stundenverteilung, „Seitenwechsel = bekannt“.

---

## 4. Pakete

### 4.0 Gemeinsame Abnahme (gilt für jedes Paket, zusätzlich zu den Paketkriterien)
- **G1 Ort:** Jede eigene Funktion hat genau einen Ort, ≤ 2 Tipps ab Reiter-Wurzel (1.4). Einstiege tragen stabile `data-testid`.
- **G2 Rückweg:** ✕ oder ‹ führt zur Herkunft, Bildlauf und Zustand bleiben erhalten.
- **G3 Fortsetzen:**
  - Neuladen mitten in jeder eigenen Übung setzt exakt fort: gleiche Karte, Aufgabe, Schritt und Entwurf.
  - Bereits beantwortete IDs werden übersprungen, kein doppelter Schreibvorgang, Serie unverändert.
  - Unit-Test je `Resumable` (Momentaufnahme → Herstellen → gleiche Position) und ein E2E-`reload()` je Übung.
- **G4 Fehlergrenze:** `lx:crash-once=<route>` zeigt je eigener Übung „Diese Aufgabe überspringen“ und je Seite „Seite neu aufbauen“. Die App läuft weiter. `StepBoundary` liegt um jede Aufgabe.
- **G5 Darstellung:**
  - 390 px ohne waagrechten Bildlauf, „Prüfen“ bleibt über der Tastatur (`visualViewport`).
  - Beide Sprachen ohne gemischte Sprache.
  - Die Hauptbildschirme je einmal in Dunkel, Gedämpft und Hell mit axe: keine ernsten Verstöße.
- **G6 Ohne KI** (`?fake=nosample`) **und ohne Sprachausgabe:** Jede Pflicht-Funktion bleibt erfüllbar oder ist sauber ausgeblendet. „Weiter“ wird nie von KI blockiert. Fehlerzustand mit „Erneut versuchen“ (A6.3).
- **G7 Leistung** (verbindlich, `leistung.md` §4; CPU 4×, 390 px):
  - Heute lesbar (`lx:status`) < 1,5 s (Seed) bzw. < 2 s (Großdatensatz)
  - Reiterwechsel < 100 ms
  - nächste Karte/Aufgabe < 50 ms bis zum Bild
  - Animationen ≤ 200 ms, nur Deckkraft/Verschieben
  - kein `layout`/`layoutId` in Listen, kein `AnimatePresence mode="wait"` um Aufgaben
  - kein Long Task > 100 ms nach `lx:status`
  - Store-Hooks nur mit Selektor
- **G8 Grün:** typecheck, lint, alle Unit-Tests, eigene E2E-Spec + `rahmen.spec.ts`. `git diff --name-only main` enthält **nur** Besitz-Dateien (4.9).
- **G9 Texte, KI, Daten:**
  - Neue Texte nur im eigenen i18n-Teil, Englisch in US-Schreibweise.
  - Neue Vorlagen nur unter `src/prompts/nb/<paket>/`.
  - Jede KI-Antwort wird per zod geprüft.
  - Schreiben nur über `writer.transform` oder die vorhandenen `record*`-Wege, nie über ganze Dokumente.
- **G10 Optik wie v1:** Hauptkarte, Zeilenlisten, Eyebrow, Chips, Umschalter und Knöpfe kommen aus den WP0b-Bausteinen. Keine eigenen Farben außerhalb der Tokens.

**Ablauf je Helfer:**
- Vor dem Start lesen: diesen Plan (Abschnitte 1, 4.0, das eigene Paket, 4.9, 4.10), `architektur.md` §2–§3, `leistung.md`, CLAUDE.md. Für P3 zusätzlich `anki-regeln.md`.
- Gearbeitet wird im eigenen Worktree `nb/<paket>`, mit kleinen Commits.
- Um 06:20 kommt der Abschlussbericht: Muss ✓/✗ je Punkt, erreichte Soll-Punkte, Testergebnis, „Wünsche“ an eingefrorene Dateien.
- Rote Tests: höchstens 2 Behebungsversuche je Ursache (A2), dann melden.

### 4.1 WP0 Rahmen (ein Helfer; WP0a 23:15–01:15 blockierend, WP0b 01:20–03:20, danach Integrationsvorbereitung bis 06:20)

**Besitz:**
- `src/main.tsx`, `src/app/**`, `src/areas/index.ts`
- alle `src/areas/*.tsx` bis 01:15, danach die Pakete
- `src/i18n/{de,en,index}.ts`, i18n-Teil `nbSh`
- `src/ui/**`, `src/engine/**`, `src/styles/**`
- `features/learn/{ui.tsx,inputs.ts,RetryHint.tsx}`, `features/system/Chrome.tsx`, die Einhängestelle in `features/settings/SettingsSheet.tsx`
- `tests/e2e/fixtures.ts`, `rahmen.spec.ts`, `playwright.config.ts`, `eslint.config.js`, `vite*.ts`, `package.json`
- **bis 01:15 zusätzlich:** `src/data/{paths,schemas}.ts` (nur die Deklarationen aus 4.10), `docs/datenmodell.md`, `scripts/generate-seed.mjs`, `seed/sample-data.json`, `src/prompts/registry.ts` (eine Zeile), `src/prompts/nb/index.ts` + `nb/p1…p7.ts`
- **Ausnahmen in WP0b** (platform-guard und data-guard prüfen): `src/data/{live,validate}.ts` (Prüfung in Stücken, Verhalten gleich) und `src/platform/diagnostics.ts` (sofort schreiben, Route und Position mitprotokollieren)

**WP0a (Muss, bis 01:15):** alles aus `architektur.md` §5.1 WP0a, dazu:
1. **5 Reiter** laut 1.1, Platz `stand`, `HubSections` auch für `stand` und `profile`.
2. **Register erweitert** um:
   - `unitBlocks` (`UnitBlockProvider`),
   - `playerNote`,
   - Einstellungs-Abschnitte mit Gruppe.
3. **Verträge und Stubs mit endgültigen Props** (4.10): `app/unit/types.ts`, `ui/feedback/types.ts`, `ui/FeedbackPanel.tsx`, `ui/SessionEnd.tsx`, `app/useWeek.ts`. `useWeek` nutzt die Domäne aus dem P7a-Commit von 00:00 (per Merge übernommen).
4. **Neue Dokumente** laut 4.10 deklariert, mit tolerantem Schema, Seed-Beispiel, Export und `datenmodell.md`. data-guard prüft kurz um 01:15.
5. **Prompt-Verdrahtung** laut 3.2.
6. **Bereichsdateien** inkl. `areas/training.tsx` (P7), i18n-Teile inkl. `nbTraining`, Test-Helfer-Dateien je Paket (leer).
7. **ESLint:**
   - Verbot von `layout`/`layoutId` in JSX, mit befristeten Ausnahmen laut Leistung §3.2.6,
   - Store-Regel: Die Hooks `useLive`, `usePending`, `useNav`, `useSettings`, `useToday`, `useSession` nur mit Selektor.
8. **Specs:** Navigation der Specs auf 5 Reiter angepasst (`architektur.md` §5.5). Dank `tab-learn` gibt es weniger Änderungen. `openSpeak` nutzt die Segmente `talk/write/preply`. Die volle E2E-Suite ist grün, Tag `nb-wp0a`.

**WP0b (Muss, bis 03:20):** alles aus `architektur.md` §5.1 WP0b, dazu:
1. **Bausteine im Stil von v1:** `HeroCard`, `RowList`/`Row`, `Eyebrow`, `Steps`, `Chips`, `GradeButtons`-Hülle.
2. **FeedbackPanel und SessionEnd** fertig (N05, N06), mit `WhyLink` (N07).
3. **Fehlergrenzen** auf drei Ebenen, `CrashProbe`, `runAction(name, fn)` (N03).
4. **Fortsetzen** nach der Regel aus Abschnitt 0 (N04):
   - `lx:resume` zeigt auf die eine offene Tätigkeit, `lx:resume:<id>` hält die Momentaufnahme,
   - `ResumeRow` erscheint auf Heute und am Herkunftsplatz.
5. **Startpfad (N09):**
   - zod-Prüfung in Stücken ≤ 16 ms (Heute-Dokumente zuerst),
   - Inter nur als ein woff2-Schnitt (latin),
   - kein `window.scrollTo` in `onAnimationStart`,
   - Übergänge laut `architektur.md` §3.3.
6. **Messmarken:** `lx:nav`, `lx:card`-API.
7. **`rahmen.spec.ts`**

**WP0 nach 03:20 (Integrationsvorbereitung, Soll):**
- `acceptance.spec` und `screens.spec` auf die Liste aus dem Register (`AREAS`), `a11y.spec` über alle Wurzeln × 3 Modi, `perf.spec` mit den Budgets aus G7.
- Wünsche der Pakete sammeln.
- `check:platform`: Warnung ab 3,2 MB.
- Nichts davon läuft vor 06:20 auf `main`, es liegt fertig auf `nb/integration`.

**Abhängigkeiten:** keine (WP0 zuerst). P7a liefert um 00:00 `src/content/nb/themes.ts` + `src/domain/week/*`.

### 4.2 P1 Heute, Tageseinheit & Wochenthema (01:20–06:20)

**Besitz:**
- `features/today/**`, `features/check/**`, `features/learn/{flow,time}.ts`
- **neu:** `features/week/**`, `features/unit/**`
- `src/domain/plan/**` (additiv, Signaturen nur erweitert)
- **neu:** `src/domain/unit/**`
- `src/domain/week/**` (ab 01:15, von P7 übergeben)
- `areas/heute.tsx`, i18n `nbHeute`, `src/prompts/nb/p1*`
- `tests/e2e/heute.spec.ts`, `heuteHelpers.ts`
- zu pflegende Specs: `today`, `today-duties`, `weighting`

**Muss:**
1. Heute-Wurzel laut 1.3, dazu N15 (Fertig-Zustand), Abzeichen „offene Blöcke“.
2. N14 Heute sofort:
   - `lx:plan:<tag>` wird lokal gelesen, Zeichnen nach dem ersten Abo.
   - `intake`, `transform('app/profile')`, `log/<heute>` und Auto-Einschätzung laufen **danach**.
   - `usePending` nur mit Selektor (`today/state.ts:96`).
   - Kein `sampleUsableWithin` auf dem Startpfad.
3. N10 Tageseinheit:
   - Kette aus `unitBlocks` mit **Ersatzblöcken**, solange ein Anbieter fehlt. Sie nutzen die vorhandenen Routen: `trainer`, `read`/`listen`, `say`, `grammarSession`, Reparatur.
   - Zwischen- und Bestätigungskarte (`unitCard`), `playerNote` „Block n von m“, `SessionEnd`, ✕ → Heute, `Resumable` `unit`.
   - Der Flug „Tageskarte → Übung“ ist die einzige `layoutId`-Ausnahme.
4. N12 Wochenplan und Pflicht laut 1.5:
   - `plan.duty` mit `u-*`, Zählen über `recordProfileFields`, `dutiesFeasible`/`isDutyChannel` additiv.
   - Unit-Tests: `pflichtFor` für alle Tagesformen, `pflichtSince` nie rückwirkend, 0–4-Uhr-Regel.
5. N11 Wochenthema + Seite `week` (Eintrag „Deine Woche“ auf Platz `learn`, Abschnitt Dein Weg) und N13 Wochenziele (Daten für `UnitCtx.targets`).
6. Wochen-Check: `Resumable`, Sonntagsblock, Start-API `startCheck` für das Profil (P6).

**Soll:** N16, N17.

**Paketkriterien:**
- `heute.spec`: Morgen-Journey mit 1 Tipp bis zur ersten Aufgabe.
- Einheit Mo mit Ersatzblöcken bis „Fertig“, danach ist die Serie +1.
- Neuladen in Block 3 setzt dort fort.
- Montag zeigt die Bestätigungskarte, Sonntag hat 2 Blöcke, die Kurz-Einheit hat 3.
- Ohne KI erfüllbar.
- `perf.spec`: `lx:status` < 1,5 s.

**Abhängigkeiten:**
- WP0a
- P7a: Themen, `domain/week`, Themen-Texte
- P3: `review`-Anbieter und `startSession` (API-stabil)
- Die Anbieter von P2, P4, P5 und P7 kommen bei der Integration dazu.

### 4.3 P2 Üben: Kurs, Grammatik, Fallen, Training (01:20–06:20)

**Besitz:**
- `features/{course,grammar,drills,repair,patterns}/**`, `features/learn/LearnHub.tsx`
- `areas/lernen.tsx`, i18n `nbLernen`, `src/prompts/nb/p2*`
- additiv `src/domain/{grammar,drills,patterns,repair,course}/**`
- **Ausnahme:** `domain/grammar/errors.ts` `dueErrors` ohne Wörterbuch; JSON-Importe von `rules`/`grammar`/`c1/toolkit` als `?raw`
- `tests/e2e/lernen.spec.ts`, `lernenHelpers.ts`
- zu pflegende Specs: `course`, `courseExtend`, `grammar`, `drills`, `hint`, `repair`, `patterns`

**Muss:**
1. N40 Üben-Hub: alle Funktionen aus E, F, G, M1–M4, J13–J15 im neuen Rahmen.
2. **Fortsetzen:** Lektion (Schritt **und** Stand im Schritt), Grammatik-Runde, Drills (außer Sprint), Fallen-Drill.
3. `StepBoundary` um jede Aufgabe.
4. N44 Einheitsstil, N45 Leistung.
5. Anbieter N41 `focus` und N42 `again`.
6. N43 Fallen-Startsatz.
7. **Werkzeug der Woche:** Das Themenblatt `c1-*` ist 1 Tipp von „Deine Woche“ entfernt (Deep-Link `grammar?topic=`).

**Soll:** N46, N47.

**Paketkriterien:**
- `lernen.spec`: jede Übung ≤ 2 Tipps ab Üben; `reload()` in Lektion Schritt 3 und in der Grammatik-Runde Aufgabe 4 setzt dort fort.
- Block 4 mit Fallen-Korrektur zeigt den Mini-Drill.
- Block 5 zeigt beide Fassungen.
- Grammatik: Aufgabe zu Aufgabe < 50 ms.

**Abhängigkeiten:** WP0a, P7a (Startsatz), Verträge `UnitTaskResult` (WP0a).

### 4.4 P3 Wortschatz & Anki (01:20–06:20)

**Verbindlich:** `docs/neubau/anki-regeln.md`.

**Besitz:**
- `features/vocab/**`, `features/lookup/**`
- additiv `src/domain/srs/**`: `types`, `modes`, `applyReview` inkl. `cardPatch`/`chunkPatch`, `grade`, `queue` (Ersatz für `SRC_RANK`)
- **neu:** `src/domain/srs/{flip,decks,forecast,retention}.ts`
- `src/domain/lexicon/**` (nur Lazy-Laden)
- ab 01:15: `scripts/generate-seed.mjs` + `seed/sample-data.json`, `docs/datenmodell.md` (Abschnitt `app/decks`)
- `areas/wortschatz.tsx`, i18n `nbWs`, `src/prompts/nb/p3*`
- `tests/e2e/{wortschatz,anki}.spec.ts`, `wortschatzHelpers.ts`
- zu pflegende Specs: `trainer`, `trainerFeedback`, `trainerModes`, `trainerReview`, `gestures`

**Muss:**
1. **Wortschatz-Wurzel** laut 1.3 und alle Funktionen aus C, D (außer D15/D16), N15–N20.
2. N20–N23:
   - vollständig nach `anki-regeln.md` §§1–5 und §8,
   - Konstanten `FLIP`/`CONTROL` in `domain/srs/flip.ts`,
   - Stufe 4 des Eingangskorbs über `isThemeCard` aus `domain/week`.
3. N24–N28.
4. N29 Leistung, Messmarke `lx:card`.
5. **Fortsetzen des Trainers** (Tippen und Aufdecken) laut `leistung.md` §5. Beantwortete IDs werden übersprungen, ein offener Prüf-Zustand wird nicht nachgebaut.
6. `StepBoundary` um `ExerciseView`, `FlipCard`, `IntroCard`, `RepairItem`.
7. Anbieter `review` (Block 1 laut 1.5).
8. Blätter `word`, `add`, `x:extra`, Einstellungs-Abschnitt „Wortschatz“ (N30).
9. Abschnitt „Wortschatz-Statistik“ auf Platz `stand`.

**Soll:** N31–N35, Kontrastpaar zu N28, `context.locate` erst bei Anzeige (Leistung §2.1).

**Paketkriterien:**
- Alle Pflicht-Tests aus `anki-regeln.md` §7.
- `anki.spec`:
  - 40 Karten am Stück im Aufdecken, Median `lx:card` < 50 ms,
  - Wischen links = Nochmal, rechts = Vorschlag,
  - `reload()` bei Karte 23 setzt bei 23 fort, ohne doppelten Schreibvorgang,
  - eine kaputte Karte (Patch) wird übersprungen, die Runde endet regulär.
- `wortschatz.spec`: Stapel anlegen → Filter → Start in 2 Tipps; Liste mit 1.500 Karten ≤ 60 Zeilen im DOM.
- data-guard beim Zusammenführen: Schreibweg Aufdecken, `app/decks`.

**Abhängigkeiten:** WP0a, P7a (`isThemeCard`).

### 4.5 P4 Lesen, Hören & Schreibwerkstatt (01:20–06:20)

**Besitz:**
- `features/{input,read,listen,discover,write}/**`
- `app/modules.ts` (geht in `areas/lesen.tsx` auf)
- additiv `src/domain/{input,discover}/**`
- `areas/lesen.tsx`, i18n `nbLesen`, `src/prompts/nb/p4*`
- `tests/e2e/lesen.spec.ts`, `lesenHelpers.ts`
- zu pflegende Specs: `read`, `listen`, `write`, `discover`, `input-platform`

**Muss:**
1. **Lesen-Wurzel** (`library`) laut 1.3 und alle Funktionen aus H.
2. N50–N55.
3. Die Schreibaufgabe als Einstieg auf Platz `write`, „Verlauf Schreiben“.
4. Anbieter `input.read` und `input.listen` (N53). Sie liefern `UnitCtx.sentences` für `pron.shadow`.
5. **Fortsetzen:** Leser (Leseposition, Schritt), Hören (Schritt, Tempo), Schreiben (Entwurf, Schritt, Fassung), Beitrag (Schritt).
6. `StepBoundary` je Schritt.

**Soll:** N56–N61.

**Paketkriterien:**
- `lesen.spec`:
  - Artikel in 1 Tipp,
  - ein Wort antippen → „+ Wortschatz“ → im Eingangskorb mit Ursprungssatz,
  - „Wörter aus diesem Text üben“ startet genau diese Karten,
  - `reload()` im Leser bleibt am Absatz,
  - Block 2 ohne KI mit Themen-Text.

**Abhängigkeiten:** WP0a, P7a (Themen-Texte), API P3 (`lookup/store`, `startSession`, API-stabil).

### 4.6 P5 Sprechen, Business & Preply (01:20–06:20)

**Besitz:**
- `features/{speak,business,preply,say,fluency,meeting,tones}/**`
- `areas/sprechen.tsx`, i18n `nbSprechen`, `src/prompts/nb/p5*`
- additiv `src/domain/{speak,say,fluency,meeting,tones,business,preply}/**` (inkl. `playbooks` als `?raw`)
- `tests/e2e/sprechen.spec.ts`, `sprechenHelpers.ts`
- zu pflegende Specs: `speak`, `business`, `preply`, `say`, `fluencyMeeting`, `voice`, `c1tones`

**Muss:**
1. **Sprechen-Wurzel** laut 1.3 und alle Funktionen aus I, J1–J12, K, L.
2. N70–N76.
3. **Fortsetzen:** Rollenspiel (Hülle um `speak/resume.ts`, automatisch), Sag es, Tonlagen, Flüssigkeit, Mail, Pitch (Entwurf + Schritt).
4. `StepBoundary` je Zug bzw. Schritt.
5. Die Szene zum Wochenthema steht oben.
6. Anbieter für Block 3 (N75).

**Soll:** N77–N80.

**Paketkriterien:**
- `sprechen.spec`:
  - Gespräch starten in ≤ 2 Tipps,
  - `reload()` nach Zug 3 setzt dort fort,
  - „Laut zuerst“ bis zur besseren Fassung mit ▶,
  - ohne KI bleibt Sag es speicherbar,
  - Ziel-Checkliste sichtbar, ein Haken nach der Antwort (Test-Laufzeit).

**Abhängigkeiten:** WP0a, P7a (Business-Szenen), `goal-check@1` (eigen).

### 4.7 P6 Profil, Stand, Einstellungen & Claude (01:20–06:20)

**Besitz:**
- `features/progress/**` außer `persist.ts`
- `features/vtest/**`, `features/settings/**` (außer der WP0-Einhängestelle), `features/companion/**`
- `features/migration/LateRescueCard.tsx`, `features/system/WhatsNew.tsx` (bleibt aus)
- additiv `src/domain/{assessment,progress,companion}/**`
- `areas/profil.tsx`, i18n `nbProfil`, `src/prompts/nb/p6*`
- `tests/e2e/profil.spec.ts`, `profilHelpers.ts`
- zu pflegende Specs: `progress`, `vtest`, `settings`, `companion`, `translate`, `stand-gaps`, `phase5-a11y`, `migration` (nur Helfer)

**Muss:**
1. Profil-Blatt, Seite „Dein Stand“, Einstellungen, Claude-Blatt laut 1.2/1.3.
2. Alle Funktionen aus A4, A10–A11, B19–B20, D15–D16, M5, N1–N14, O, P.
3. N90–N95.
4. **Wortschatztest:** `Resumable`.
5. **Zeilen auf Heute:** Nachtragen, Wochenbericht.

**Soll:** N96–N98.

**Paketkriterien:**
- `profil.spec`:
  - jeder Stand-Reiter und jeder Test in 2 Tipps,
  - Übersetzen → „+ Wortschatz“ an einer Wendung → Karte mit Satz im Eingangskorb (1 Tipp),
  - „Warum?“ öffnet Fragen mit fertiger Frage,
  - `reload()` im Wortschatztest setzt fort,
  - Diagnose zeigt die 4 Messwerte.

**Abhängigkeiten:** WP0a; API P3 (`lookup/store.saveLookupCard`, `vocab/list/actions.addWord`, API-stabil).

### 4.8 P7 Neue Übungen & Inhalte (23:15–06:20; P7a bis 01:15)

**Besitz:**
- `src/content/nb/**`
- `src/domain/week/**` (bis 01:15, dann P1)
- **neu:** `src/domain/nbdrill/**`
- `features/{nbdrill,pressure,inbox,pron}/**`
- `areas/training.tsx`, i18n `nbTraining`, `src/prompts/nb/p7*`
- `tests/e2e/training.spec.ts`, `trainingHelpers.ts`

**P7a Muss, Commit 1 bis 00:00:**
- `content/nb/themes.ts`: 16 Themen mit Kernaufgabe, Werkzeug (Grammatik-ID), Falle (Startsatz-ID), 5 Wendungen mit Bedeutung DE/EN, Reihenfolge.
- `domain/week/*` mit Tests:
  - `isoWeek`, `themeFor`, `unitPlanFor` (1.5, inkl. Kurz, Sonntag, Rückfälle),
  - `isThemeCard`, `weekTargets`, `detectTargets` (Abschwächungen, Überleitungen), `matchTrap`.

**P7a Muss, Rest bis 01:15:**
- 16 Themen-Texte (150–250 Wörter, US) mit Kernfrage, Frage „zwischen den Zeilen“ und 3 Nachsprech-Sätzen
- Fallen-Startsatz (25) mit falsch/richtig, Grund DE/EN, 3 Übungssätzen
- Kollokationen (40 Nomen × 2–4 Verben + falsche Lehnübersetzung)
- Umformungen (30)
- Einwände (25, mit Musterantwort)
- Posteingang (16 Mails mit verstecktem Anliegen und Musterantwort)
- Business-Szenen (12–16, je 3 Ziele und 3–5 Kriterien; darunter Small Talk, Telefonat, Meeting leiten)

**P7a Soll:** Wortbildung (20), Register (20), Phrasal Verbs (25), Überleitungen (12), Heißer Stuhl (15), Zeit gewinnen (15), Betonung (40), Zahlen (30).

**P7b Muss (01:20–06:20):**
- N101–N106: Tipp-Drill-Motor, Druck-Serie, Posteingang, Nachsprechen, Block-Anbieter.
- Einträge auf den Plätzen `learn` (Training), `speak` (Training, Aussprache) und `write` (Posteingang).
- `Resumable` je Übung, `StepBoundary`.
- **Ergebnisse:**
  - Einträge in `out/<Monat>`,
  - Antworten ins Tagesprotokoll über `recordChannelEntries`, bei freiwilligem Üben mit `ctx` Extra,
  - beste Einwand-Antwort über „Merken“ als Wendung mit Ursprungssatz (`lookup/store`).

**P7b Soll:** N107–N109.

**Paketkriterien:**
- `training.spec`:
  - Kollokationen: 5 Aufgaben, falsche Lehnübersetzung → Hinweis → Lösung.
  - Einwand-Serie mit Zeitbalken; ohne KI Selbstcheck.
  - Posteingang: 3 Schritte, `reload()` im Antwortfeld behält den Entwurf.
  - Nachsprechen mit 3 Durchgängen.
  - Jede Übung ≤ 2 Tipps ab Reiter.
- Der Englischlehrer gibt die P7a-Inhalte nach einer Runde frei.

**Abhängigkeiten:** WP0a (Verträge); ab 01:15 keine weiteren.

### 4.9 Datei-Hoheit: Änderungen gegenüber `architektur.md` §5.2/§5.3

| Änderung | Grund |
|---|---|
| Neues Paket **P7** mit `content/nb`, `domain/week` (bis 01:15), `domain/nbdrill`, `features/{nbdrill,pressure,inbox,pron}`, `areas/training.tsx`, i18n `nbTraining` | Neue Übungsformen und Inhalte hätten P2 und P5 über 5 Std. hinaus belastet. Die Inhalte starten sofort parallel zu WP0a. |
| `src/data/{paths,schemas}.ts`: **alle** neuen Dokumente deklariert WP0a (nicht mehr P3) | Keine Abhängigkeit zwischen Paketen; data-guard prüft einmal um 01:15 |
| Seed und `datenmodell.md`: WP0a bis 01:15, danach P3. Andere Pakete legen Testdaten im Test selbst an (über die Oberfläche oder `boot({ localStorage })`), nicht im Seed. | ein Besitzer je Datei |
| `src/prompts/nb/<paket>/**` + Liste je Paket, eine Zeile in `registry.ts` durch WP0a; bestehende Vorlagen eingefroren, Nachfolger nur mit neuer Kennung | 3.2 |
| Domänen-Ordner je Paket additiv: P1 `plan`, `unit`, `week` · P2 `grammar`, `drills`, `patterns`, `repair`, `course` · P3 `srs`, `lexicon` · P4 `input`, `discover` · P5 `speak`, `say`, `fluency`, `meeting`, `tones`, `business`, `preply` · P6 `assessment`, `progress`, `companion` · P7 `week` (bis 01:15), `nbdrill` | Neue Übungen brauchen reine, getestete Logik; neue Dateien kollidieren nicht |
| Leistungs-Ausnahmen: P2 `dueErrors` ohne Wörterbuch, `?raw`-Importe der eigenen Inhalte; P3 `lexicon` lazy; WP0b `data/{live,validate}.ts` und `platform/diagnostics.ts` | `leistung.md` §4 |
| Weiter **eingefroren:** `src/ai/**`, `src/platform/**` (außer WP0b-Ausnahme), `src/data/**` (außer WP0), bestehende `src/prompts/*.ts`, bestehende `src/content/**`, `features/progress/persist.ts`, übrige Domänen-Ordner | – |
| **API-stabil** (zusätzlich zu `architektur.md`): `domain/week/*` (P1 nach Übergabe), `features/lookup/store.ts` (P3), `features/learn/flow.ts#startDuty` (P1) | Andere Pakete nutzen diese Stellen |

### 4.10 Verträge aus WP0a (die Pakete programmieren dagegen)

```ts
// src/app/unit/types.ts
type UnitBlockKind = 'review' | 'input.read' | 'input.listen' | 'pron.shadow'
  | 'task.say' | 'task.fluency' | 'task.tones' | 'task.inbox' | 'task.objection' | 'task.meeting' | 'task.roleplay'
  | 'task.check' | 'focus' | 'focus.colloc' | 'again';
type UnitCtx = {
  day: string;
  block: 1 | 2 | 3 | 4 | 5;
  theme: WeekTheme | null;
  targets: WeekTargets;
  minutes: number;
  sentences?: string[];          // von input.* für pron.shadow
  task?: UnitTaskResult;         // von task.* für focus/again
};
type UnitTaskResult = {
  kind: UnitBlockKind;
  ref: string;                   // Monatsdokument + Eintrag
  text: string;
  better?: string;
  fixes: Fix[];
};
type UnitBlockProvider = {
  kind: UnitBlockKind;
  feasible(env: { ai: boolean; tts: boolean }): boolean;
  start(ctx: UnitCtx): Route | false;   // SYNCHRON im Klick (iPhone-Tastatur)
};
// Abschluss meldet die Übung mit unitDone(ctx.block, result?), das zählt act['u-…'] (P1)

// src/ui/feedback/types.ts
type Fix = {
  kind: 'meaning' | 'trap' | 'goal' | 'form';
  mine: string;
  right: string;
  why: string;
  trapId?: string;
};
type Feedback = {
  verdict: 'ok' | 'close' | 'wrong' | 'unchecked';
  effect?: string;
  mine?: string;
  solution?: string;
  fixes: Fix[];
  upgrades?: { to: string; from?: string; note?: string }[];
  retryHint?: string;
  again?: () => void;
  why?: { question: string };
};
// <FeedbackPanel fb={…} onNext={…}/> sortiert und kappt selbst (≤ 3 / ≤ 2)

// src/ui/SessionEnd.tsx
// <SessionEnd right={n} total={m} ms={…} newItems={string[]} takeaways={…} next={{ label, run }} />

// src/app/useWeek.ts
// useWeek(): { theme: WeekTheme | null; targets: WeekTargets; plan: UnitPlan | null }
//   (liest app/week + domain/week)
```

**Neue Dokumente** (tolerant/`loose`, A6.6; data-guard 01:15):

| Pfad | Form | Grenze | Schreibt |
|---|---|---|---|
| `app/decks` | `architektur.md` §4.4 plus `prefs: { dir?: 'de-en' \| 'en-de' \| 'mix', grades?: 4 \| 2, mode? }`, `flagged?: string[]` | ≤ 40 Stapel, ≤ 500 IDs, < 64 KiB | P3 |
| `app/week` | `{ v: 1, cur?: { wk: 'JJJJ-Www', theme: 't01'…'t16', by: 'auto' \| 'user', at }, hist?: { wk, theme, by }[], preplyNext?: string, targets?: { wk, traps: string[], tool: string, preply?: string } }` | ≤ 26 Wochen in `hist`, < 8 KiB | P1; `preplyNext` P5 (feldweise per `transform`) |
| `out/<Monat>` | `{ v: 1, items: { id, k: string, d: string, theme?: string, ok?: boolean, text?: string, fb?: unknown, ms?: number }[] }` | ≤ 400 Einträge, `text`/`fb` je ≤ 2 KB | P7 |

**Lokal** (`platform/storage`, try/catch): `lx:plan:<tag>` (P1), `lx:resume`, `lx:resume:<id>` (WP0 + Pakete), vorhandene `lx:draft:*`, `lx:lesson:*`, `lx:roleplay:*`.

**Peak-Last:** Von 01:20 bis 03:20 laufen 8 Helfer gleichzeitig (WP0 + P1–P7).
- Erlaubt die Umgebung nur 6: P6 startet um 03:20 im WP0-Helfer (nach WP0b). Die Integrationsvorbereitung übernimmt der Integrator, und die Soll-Punkte von P6 gehen direkt nach Paket B.

---

## 5. Schnittlinie

**Paket A (in 12 Std., bis 10:20 UTC):**
1. **Alle 239 übernommenen Funktionen** am neuen Ort (Abschnitt 2), fortsetzbar, mit Fehlergrenzen, im Leistungsbudget.
2. **Alle Muss-Punkte** aus WP0, P1–P7. Das deckt die Lehrer-Reihenfolge bei Zeitnot ab:
   1. Einheit mit Wochenthema und Wochenplan: N10–N14
   2. Anki: N20–N30
   3. einheitlicher Rückmeldestil über das FeedbackPanel: N05, N44, N55, N74 (ohne Änderung an den Vorlagen)
   4. Einwand-Training und Posteingang: N103, N104
   5. „Laut zuerst“, Nachsprechen, Tempo-Leiter: N71, N105, N54
   6. Fallen-Startsatz und Kollokationen tippen: N43, N101
3. **Markt-Top-25:** Der Kern aller 25 Punkte ist in Paket A. Ausnahme ist Nr. 18 „Claude merkt sich“ (B5); „Mein Kontext“ ist vorhanden. Einzelne Teilfunktionen sind Soll oder B:

   | Nr. | Teilfunktion | Stufe |
   |---|---|---|
   | 2 | Rückgängig | B4 |
   | 3 | Wendung ziehen | N57 |
   | 7 | Übung dazu | N96 |
   | 8 | Satzmodus, Leichter/C1 | N56, N59 |
   | 10 | Alternativen | N60 |
   | 12 | Bearbeiten | N31 |
   | 15, 19 | Hörschleife, Hör-Lücke | N35 |
   | 22 | Niveau je Text als Satz ist in A, als Vergleich über Zeit B1 | – |
   | 25 | Aus Text, CSV | N34, N98 |
4. **Soll-Punkte**, soweit sie um 06:20 grün sind.

**Paket B (direkt danach, in dieser Reihenfolge):**

| # | Inhalt | Pakete | Aufw. |
|---|---|---|---|
| B1 | **Vergleichsaufgabe monatlich** (Lehrer X1, Zeitnot-Punkt 7): gleiche Aufgabe wie vor 4 Wochen, Fassungen nebeneinander, Claude beschreibt den Fortschritt. Messwerte Wörter/Min., Fallen je 100 Wörter, frei benutzte Wendungen. | P1 (Einplanung), P5, P6, neue Vorlage `compare@1` | L |
| B2 | **Einheitsstil in den Vorlagen:** Nachfolger `writing-review-nb`, `reading-check-nb`, `lesson-production-nb`, `apply-check-nb`, `tone-check-nb`, `fluency-check-nb`, `say-check-nb`. Alle mit Fallen-Merkliste, ≤ 3 Korrekturen, Wirkungssatz, CEFR nur als Satz. | P2, P4, P5 | M |
| B3 | **Nicht erreichte Soll-Punkte** in dieser Reihenfolge: P3 (N31–N35) → P7 (N107–N109) → P5 (N77–N80) → P1 (N16–N17) → P4 (N56–N61) → P2 (N46–N47) → P6 (N96–N98) | alle | – |
| B4 | Anki „Rückgängig“ 5 s (setzt Karte und Protokolleintrag zurück; data-guard) | P3 | M |
| B5 | „Claude merkt sich“: bis zu 5 Fakten je Gespräch in `app/memory`, sichtbar und löschbar, fließt über `work.ts` in die Vorlagen | P5, P6 | M |
| B6 | Hörtext mit 2–3 Stimmen (Lehrer H3); Hören → Notizen → Follow-up-Mail (H4) | P4 | M |
| B7 | Zielerinnerung 85/90/95 % mit Aufwand-Vorschau; Lastausgleich und leichte Tage | P3 | M |
| B8 | Startpfad Stufe 2: Bildschirme als Fabrikfunktionen (erst messen, CSP); kinetische Lücke mit 1 Commit je Anschlag | WP0 | M |
| B9 | Anruf-Modus mit Stimme (Duolingo Video Call), Zahlen und Grafiken präsentieren (I8), Umschreiben statt stocken (W10), Rückübersetzung (S9), Ton-Erkennung (Grammarly) | P4, P5, P7 | je M |

Alles Weitere steht in `docs/backlog.md`.

---

## 6. Zeitplan (UTC, Start 22:20, Ende 10:20)

| Zeit | Wer | Was | Ergebnis |
|---|---|---|---|
| 22:20–23:15 | Integrator + Fachhelfer | Inventur, Markt, Lehrer, Architektur, Leistung, Anki-Regeln, dieser Plan | `docs/neubau/*` committet |
| 23:15 | Integrator | Plan committen; Worktrees `nb/wp0`, `nb/p7` anlegen; Helfer starten | – |
| 23:15–01:15 | WP0 | WP0a (4.1) | Tag `nb-wp0a`, volle E2E-Suite grün |
| 23:15–01:15 | P7 | P7a: Commit 1 (Themen + `domain/week`) um 00:00, WP0a übernimmt ihn per Merge; Rest der Inhalte bis 01:15 | Inhalte + Tests |
| 23:15–23:45 | learning-scientist | **eine** Prüfung von 1.5 (Blöcke, Deckel, Wochenplan, Kurz-Einheit, Rückfälle) gegen Kap. 5 und `anki-regeln.md`; Befunde direkt an P7 | kurzer Befund, keine zweite Runde |
| 01:15–01:20 | Integrator + data-guard | WP0a + P7a → `main`; data-guard prüft die neuen Dokumente (4.10) | `main` = Basis aller Pakete |
| 01:20–06:20 | P1–P6 | Pakete parallel in `nb/p1` … `nb/p6` | Abschlussberichte |
| 01:20–06:20 | P7 | P7b | Abschlussbericht |
| 01:20–03:20 | WP0 | WP0b → `main` um 03:20; alle Pakete rebasen **einmal** bis 03:40 | Bausteine im Stil von v1, FeedbackPanel, Fortsetzen, Grenzen |
| 01:20–02:00 | Englischlehrer | **eine** Prüfung der P7a-Inhalte (Sprache, US, Register, Business-Relevanz) → P7 korrigiert bis 02:45 | Inhalte freigegeben |
| 03:20–06:20 | WP0 | Integrationsvorbereitung (4.1) auf `nb/integration` | Register-Specs, Budgets |
| **06:20** | alle | **Feature-Stopp.** Nicht Grünes → Paket B | – |
| 06:20–08:40 | Integrator | Zusammenführen, je ≈ 20 Min. (typecheck, lint, alle Unit-Tests, Paket-Specs + `rahmen.spec`):<br>06:20 **P3** (+ data-guard: Aufdecken-Schreibweg, `app/decks`)<br>06:40 **P6**<br>07:00 **P1** (+ data-guard: Pflicht/Serie/`act`)<br>07:20 **P2**<br>07:40 **P4**<br>08:00 **P5**<br>08:20 **P7**<br>Wer früher fertig ist, wird früher zusammengeführt. P3 → P6 → P1 bleibt die Reihenfolge, danach nach Fertigstellung. | – |
| 08:40–09:00 | Integrator | `nb/integration` übernehmen, Layout-Ausnahmen streichen, E2E „Woche Mo–So“ (alle echten Anbieter statt Ersatzblöcke) | – |
| 09:00–09:25 | qa-runner | `npm run verify` einmal voll | Ergebnis |
| 09:25–09:50 | Prüfer parallel, je **eine** Runde (A2) | **Kombinierter Prüfer** (Daten + Plattform + UX: Screenshots 390 px und Desktop × 3 Modi × 2 Sprachen, v1-Vergleich, Budgets, `check:platform`); **learning-scientist** (neue Übungen und vier Pflichtfragen; 1.5 nur als Nachprüfung der früher gemeldeten Stellen); **Englischlehrer** (neue Vorlagen; P7a-Inhalte nur als Nachprüfung der 01:20 gemeldeten Stellen) | Befundliste |
| 09:50–10:05 | debugger / Pakethelfer | Behebungen, höchstens 2 Versuche je Ursache; **eine** gezielte Nachprüfung nur der betroffenen Stellen; was bleibt → Emrah (A2) | grün |
| 10:05–10:20 | Integrator | Build, **ein** Commit „Neubau: …“, Merge `main`, Push. **Test-Artefakt `AXHkh6…`** mit `db`, `sample`, `downloads`, Vertrag 0.2.49. Bericht an Emrah in 3 Sätzen + iPhone-Prüfliste (Tastatur, Wischen, Hören, Diktiertaste, Neuladen mitten in der Übung). Frage nach „Ja, veröffentlichen“ für `JLL8…` | Test-Link |
| danach | Integrator | `JLL8…` **nur** nach Emrahs ausdrücklichem OK. Rückweg: die dann aktuelle Live-Version. Laut A7 ist das `1790541376-265e`; `leistung.md` nennt Code `8bdb031` als Live-Version 54. Vor dem Veröffentlichen per `Artifact read` bestätigen. Danach Paket B in Reihenfolge. | – |

**Puffer:** Es gibt keinen Zeitpuffer. Den Puffer bilden die Soll-Punkte, sie fallen zuerst weg. Verzögert sich WP0a über 01:15, bleibt der Feature-Stopp um 06:20 trotzdem, und aus jedem Paket fallen zuerst die Soll-Punkte weg.

---

## 7. Backlog

`docs/backlog.md`: Paket B in Reihenfolge und alles Weitere (C-Punkte des Lehrers, zurückgestellte Marktfunktionen, Aufräumarbeiten).

## 8. Änderungsprotokoll des Plans
| Zeit (UTC) | Änderung | Wer |
|---|---|---|
| 23:00 | Erstfassung (mit `leistung.md` und `anki-regeln.md`) | PO |
| 00:35 | data-guard zu den neuen Dokumenten (Integrator übernimmt, verbindlich): **`out/<Monat>`** zusätzlich Bytegrenze `OUT_DOC_MAX_BYTES = 200 * 1024`, vor jedem Schreiben mit `compactList` verdichten (zuerst `fb` der ältesten, dann `text`), Monat aus dem Lerntag `d.slice(0,7)`, Test mit 400 vollen Einträgen (P7). **`app/decks`**: ≤ 2.000 IDs über alle Stapel, `flagged` ≤ 200, vor dem Schreiben `jsonBytes(next) ≤ 64 KiB` sonst Hinweis statt Schreiben; Löschen eines Stapels = `hidden: true` (zählt in die 40); `prefs.mode?: 'auto' \| 'type' \| 'flip'` (P3). **`app/week`**: Schreiben nur in `writer.transform` nach `validateDoc('app/week', cur).ok`, Patch nur der geänderten Felder aus dem rohen Dokument, unbekannte `hist`-Einträge bleiben, `v` nie verringern; `cur.at` = number (ms); bei `ok === false` nur Vorschlag, kein Schreibweg (P1). `useWeek` nur ein Abo auf `app/week` (Referenzzählung wie `watch.ts`) (WP0b). **`unitDone`** liegt fest in `src/app/unit/done.ts` (`unitDone(block, result?)`; P1 registriert `setUnitDoneHandler`). | Integrator |
| 23:40 | Prüfung §1.5/§1.3 durch learning-scientist angenommen: `docs/neubau/pruefung-tageseinheit.md` ist verbindlich (M1–M10 Muss, S1–S5 + Ü1 Soll). Zuständig: `domain/week`/`unitPlanFor` (P7a→P1) für M1–M3, M5, M7, M10, S1, S2, S5; WP0a für M8 (`UnitCtx.phrases`); P2 für M4b/c, M6, M9 (Block 4), S4; P7a für S3; P4 für M7 (Block-2-Quellen) und M9 (Block 2); P1 für M4a/d. | Integrator |

---

## Anhang A: Maßnahmen aus `leistung.md` → Paket und Abnahme

| # (`leistung.md` §4) | Maßnahme | Paket | Abnahme |
|---|---|---|---|
| 1 | Fehlergrenzen Wurzel/Bildschirm/Schritt | WP0b (Ebenen), alle (Schritt) | G4, N03 |
| 2 | Fortsetzen nach Neuladen | WP0b (Speicher, Zeile, Regel), alle (`Resumable`) | G3, N04 |
| 3 | Heute aus lokalem Plan, Schreiben danach (`today/store.ts:160-252`) | P1 | N14: `lx:status` < 1,5 s (4×, Seed) |
| 4 | Karte zu Karte ohne `mode="wait"` (`TrainerScreen.tsx:84-91` und die 4 anderen Stellen) | P3 (Trainer), P2 (Grammatik, Reparatur, Fallen), P5 (Baukasten) | `lx:card` < 50 ms; Einblenden ≤ 150 ms |
| 5a | Wörterbuch aus dem Startpfad (`grammar/errors.ts:176` → `dict.ts:39`) | P2 | kein `dict.load` vor `lx:status` (Test über Messmarke) |
| 5b | Lautschrift 348 KB erst bei Bedarf (`lexicon/pron.ts:12`) | P3 | kein `pron`-Parsen vor dem ersten Popover bzw. der ersten Einführungskarte |
| 5c | JSON-Inhalte als `?raw` + Parsen bei Bedarf | Besitzer des einlesenden Moduls (P2: rules/grammar/toolkit; P5: playbooks; P6: passages) | Bundle-Auswertung beim Start sinkt; Long Task beim Start < 400 ms (4×) |
| 5d | Schrift: ein woff2-Schnitt | WP0b | CSS < 200 KB |
| 5e | Bildschirme als Fabrikfunktionen | Paket B (B8) | erst messen, CSP prüfen |
| 6 | zod in Stücken, Heute-Dokumente zuerst (`data/validate.ts`, `data/live.ts:85`) | WP0b (Ausnahme, data-guard) | Long Task um `lx:live` < 50 ms; Validierungs-Cache bleibt |
| 7 | Store-Regel mit Selektor (`today/state.ts:96`) | WP0a (ESLint), P1 (`usePending`), alle | lint grün |
| 8 | Keine Layout-Animationen in Listen (`VocabScreen:159,197`, `SceneCard:19`, `Tiles:96`, `TilePicker:49-67`) | P3, P5, WP0 (Tiles) | ESLint-Regel ohne Ausnahmen nach der Integration |
| 9 | Kinetische Lücke: 1 Commit je Anschlag | Paket B (B8) | – |
| 10 | Messpunkte in der Diagnose (`lx:boot/live/status/card`) | WP0b (Marken), P6 (Anzeige) | N95 |
