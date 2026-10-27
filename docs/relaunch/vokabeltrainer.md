# Vokabeltrainer: jederzeit frei üben (Nachtrag zum Konzept)

Stand 27.10.2026 · Prof. Lena Berg (Lernmethode, Veto) und Mara (Markt, Belegpflicht) · Nachtrag zu `docs/relaunch/konzept.md`, Kap. 2.1, 3, 7, 11, 12, 13
Status: **Entwurf zur Prüfung** durch Nora (Optik, Bedienung), James (Inhalte), Tarek (Machbarkeit, Daten) und Kai (Emrahs Sicht). Offene Entscheidungen für Emrah stehen in Abschnitt 9.

**Markierungen:**
- **[Beleg: …]** nennt eine Quelle. Forschung steht in `recherche/lena-lernwissenschaft.md` §5, Marktquellen in `recherche/mara-lernmethodik.md` §6.
- Marktquellen sind gekennzeichnet: **[G]** heißt geprüft (Anbieter, Handbuch, Studie), **[S]** heißt Sekundärquelle (Testbericht, Forum).
- **[Vermutung]** heißt ohne Beleg.
- **[Konzept x.y]** verweist auf eine Regel im Konzept.
- **[Bestand]** verweist auf heutigen Code.

---

## 0. Kurz gesagt

1. **Der Trainer ist ein zweiter Eingang zum selben Plan, kein zweiter Plan.**
   - Jede Antwort, die die App bewertet, läuft durch dieselbe Notentabelle [Konzept 3.3] in denselben FSRS-Zustand (P oder R).
   - Dazu kommen nur **drei Zusatzregeln:**
     - **Sperren:** Manche Wörter sind gerade für einen Test reserviert.
     - **Aufstieg nur termingerecht.**
     - **Messung nur aus Terminen.**
2. **Fälliges zählt voll.**
   - Eine Antwort auf ein Wort, das **noch nicht fällig** ist, ist echte Übung. FSRS rechnet den frühen Zeitpunkt ein, bringt also wenig Zuwachs, und der Termin startet ab jetzt neu.
   - Sie ist aber nie ein Aufstiegs-Tag.
   - Ein Fehler zählt immer.
3. **Der Gestern-Check und die 21-Tage-Probe werden geschützt.**
   - Heute eingeführte Wörter ruhen bis zum Gestern-Check.
   - S4-Wörter im Wartefenster ruhen ganz, auch in der Liste.
4. **Der Anki-Modus bleibt, sagt aber die Wahrheit.**
   - Richtung **Erkennen** (Englisch → Deutsch): 4 Knöpfe mit echten Abständen. Sie planen nur die Spur „Erkennst du“.
   - Richtung **Bilden** (Deutsch → Englisch): Aufdecken ohne Planwirkung, wie in Anki die Vorschau ohne Neuplanung.
   - Stufen hebt der Anki-Modus nie.
5. **Auf Heute** steht der Trainer erst unter „Wenn du mehr willst“, wenn die Pflicht erledigt ist. Im Reiter Wörter ist er immer erreichbar.

---

## 1. Wo der Trainer startet

| Eingang | Was dort steht | Regel |
|---|---|---|
| **Reiter Wörter (Handy H12, Laptop L5)** | Oben über der Suche eine Karte **„Üben“**. Unterzeile nach Lage: „14 fällig · zählt als Extra“, „Nichts fällig · schwierige Wörter üben“, vor der Pflicht „Deine Pflicht ist noch offen. Hier übst du zusätzlich.“ | Immer da. Auf diesem Reiter ist „Üben“ die eine Handlung; mehr gibt es dort nicht. |
| **Wort geöffnet (H12 detail, L5 Kontextspalte)** | Knopf **„Dieses Wort üben“**. | Das Wort kommt in eine kurze Runde (5 Karten) an Platz 4 oder 5, nie sofort (siehe 3.6, „Gesehen-Regel“). Ruht das Wort, steht dort statt des Knopfes, bis wann es ruht und warum. |
| **Heute, „Wenn du mehr willst“ (H1, L1 Kontextspalte)** | Zeile **„Wörter üben · 14 fällig, zählt als Extra“** (ersetzt „Freiwillige Zusatzrunde“). | **Nur wenn die Pflicht erledigt ist.** Vorher steht dort kein Wörter-Eintrag. |
| **Laptop-Seitenleiste** | „Wörter“ klappt auf in **Liste · Üben** (wie Praxis → Sprechen/Hören/Lesen). | Immer da. |
| **Rundenende** | Ergebniskarte: „Noch 10“ als Nebenknopf, solange Fälliges da ist. | Nie als Hauptknopf, nie mit Vorwurf. |

**Warum auf Heute erst nach der Pflicht?** [Konzept 2.1; Auftrag Kap. 2 Nr. 1 und Nr. 6]
- **Nr. 1 „Eine rote Linie“:** Vor der Pflicht ist der eine Knopf der einzige Weg. Eine Zeile „Wörter üben“ zieht genau zu dem Stoff, den Block 1 und 2 gleich bringen. Sie würde konkurrieren, auch wenn sie klein ist.
- **Nr. 6 „Pflicht und Freiwillig getrennt“:** Vor der Pflicht sind die Wörter des Tagesplans für die Pflicht reserviert (3.3). Ein Trainer-Eintrag auf Heute würde also etwas versprechen, das er dort gerade nicht bieten darf. Das wäre ein Widerspruch im Sinn von Nr. 2.
- **Nach der Pflicht** ist „Wenn du mehr willst“ der einzige Inhalt unter dem geschlossenen Ring. Dort gehört der Trainer an die erste Stelle, wenn Fälliges übrig ist.
- Lesen, Kurse und Wort-Werkstatt dürfen weiter auch vor der Pflicht stehen. Diese Regel betrifft nur den Trainer.
- **Höchstens 3 Einträge:** Ist die Pflicht erledigt, verdrängt der Trainer die Zeile mit dem geringsten Nutzen. Das ist meist Kurse.

---

## 2. Was Emrah am Start wählt (H17, L11)

**Grundsatz: ein Vorschlag, alles andere hinter „Anpassen“.** Der Start zeigt **einen** großen Knopf mit dem besten Vorschlag, z. B. „Los: 10 fällige Wörter“. Darunter steht eine Zeile „Anpassen“, die die Wahl aufklappt. Die Wahl wird gemerkt, und zwar im bestehenden `app/decks` [Bestand: `domain/srs/decks.ts`]. Der Vorschlag folgt einer festen Reihenfolge:
1. Fälliges
2. Wort-Werkstatt (wenn ein Wort wartet)
3. schwierige Wörter
4. Wörter der Woche

### 2.1 Was üben

| Auswahl | Inhalt | Wirkung (Regeln in 3) |
|---|---|---|
| **Fällig** (Standard) | Fällig bis zum nächsten Tageswechsel (04:00), sortiert nach niedrigster Abrufwahrscheinlichkeit, dazu die Aufholer. Vor der Pflicht ohne die für heute reservierten Wörter. | zählt voll |
| **Schwierig** | Wörter mit Marke „wackelig“ oder „satzgebunden“, mit einem Fehler in den letzten 30 Tagen oder kurz vor der Werkstatt-Schwelle. Auch Wendungen. | fällige voll, nicht fällige als Übung |
| **Wort-Werkstatt** | Werkstatt-Wörter mit ihrem eigenen Ablauf (Diagnose, neue Darstellung, Merkhilfe) [Bestand: `WerkstattCard`]. | nach Konzept 3.2 (2 Tage Pause, Neustart S2) |
| **Thema / Woche** | Wörter des Wochen-Szenarios und des Tagesthemas. | wie oben |
| **Neue Wörter** | Nur nach der Pflicht und nur, solange das Tageskontingent frei ist (3.7). | Tag-0-Ablauf |
| **Wendungen und Wortpartner** | Wendungen und Kollokationen, Form „Wortpartner bilden“. | wie oben |
| **Eigene Liste / Gesucht** | Eigene Listen, Eingang (aus Übersetzer, Wort-Popup, von Hand), Treffer der Suche („Diese 12 üben“). | wie oben |
| **Nach Stand** | „Im Aufbau“ (S1–S2), „Anwenden“ (S3), „Fest“ (S5). | wie oben; **S4 ist nicht wählbar**, die Wörter ruhen (3.5) |

### 2.2 Wie viele

- **10** (Standard), **20**, **30**, oder **„bis Fälliges leer“** (höchstens 60).
- Kleine Runden sind Absicht. Innerhalb einer Sitzung bringt jeder weitere Abruf desselben Wortes weniger als ein Abruf an einem späteren Tag [Beleg: Nakata 2017; Kim & Webb 2022].
- Lingvist empfiehlt mindestens 50 Karten am Tag [G, lv-help]. Das übernehmen wir **nicht** als Ziel; mehr ist erlaubt, wird aber nicht gefordert.
- **Ruhiger Hinweis**, einmal am Tag, wenn Emrah an einem Tag mehr als 30 **nicht fällige** Antworten gegeben hat: „Heute bringt mehr Vorziehen wenig. Morgen zählt jeder Abruf mehr.“ Er blockiert nichts.
  - [Beleg: Anki-Handbuch, „review ahead … is not appropriate for repeated use“, G, anki-filtered]

### 2.3 Wie üben (Art)

| Art | Was passiert | Zählt für |
|---|---|---|
| **Normal** (Standard) | Freie Eingabe in der Lücke oder ohne Satz. Die Formen folgen der Stufe (4.2). Die App bewertet. | P (und R), Notentabelle 3.3 |
| **Anki** | Aufdecken plus Selbsturteil. Die einzige Ausnahme von „keine Selbstbewertung“ [Entscheidungen 18:15, A7]. | siehe 3.6 |
| **Nur Hören** | Ton → Bedeutung frei nennen; Mini-Diktat aus den Sätzen des Wortes. Daneben **„Anhören“**: die bestehende Hörschleife ohne Bewertung [Bestand: `ListenLoop`]. | nur R; „Anhören“ zählt nichts |
| **Nur Sprechen** | Deutsch oder Lage → englisch per Diktiertaste [Konzept 6.1]. Zeitbasis gesprochen (`ms`), kein „Leicht“. | P; „gesagt“ nur bei erkanntem, unverändertem, richtigem Diktat [Konzept 3.1] |
| **Tempo** | Schnellabruf auf Zeit (wie Sprint heute, 90 s) [Bestand: `SprintView`]. **Nur Wörter auf S5.** | fällige S5 nach Tabelle, „Leicht“ möglich; abgelaufene Zeit = langsam, keine Strafe |

### 2.4 Richtung

- **Bilden: Deutsch → Englisch.** Das ist der Standard und die einzige Richtung, die P bewegt [Konzept 3.1; Beleg: Webb 2005/2009, Nakata 2016: produktiv erzeugt auch rezeptiv, umgekehrt kaum].
- **Erkennen: Englisch → Deutsch** (Bedeutung frei nennen, Ton → Bedeutung, Anki-Erkennen). Am Knopf steht „zählt nur für Erkennst du“.
- **Gemischt** gibt es nicht mehr als Wahl. Die Stufen-Regel mischt ohnehin: In S2 ist jeder 2. Termin ein R-Abruf [Konzept 3.2].
- **Rezeptive Wörter** (die 40 der Woche) gibt es nur in der Richtung Erkennen. Ein Tipp auf „Das will ich aktiv können“ macht sie zu aktiven Wörtern [Konzept 3.1].

---

## 3. Lernregeln (der Kern, Lenas Veto-Bereich)

### 3.1 Grundsatz: ein Plan, eine Tabelle

1. **Jede Antwort, die die App bewertet, geht in den einen Plan:**
   - FSRS der P-Spur (`fsrs`) oder der R-Spur (`lm.r`), nach Tabelle 3.3 des Konzepts.
   - Es gibt keinen Trainer-Plan daneben, keine Trainer-Punkte und keine Trainer-Stufen.
2. **Der frühe Zeitpunkt wird eingerechnet, nicht ignoriert.**
   - FSRS bemisst den Zuwachs an Stabilität nach der Abrufwahrscheinlichkeit: je höher sie beim Abruf ist, desto kleiner der Zuwachs; ein Erfolg senkt die Stabilität nie [G, fsrs-alg: „The smaller the value of R, the larger the SInc value“].
   - Anki macht es bei vorgezogenen Wiederholungen genauso: gleitend, je nachdem wie früh [G, anki-filtered].
   - **Der nächste Termin wird ab dieser Antwort neu gerechnet**, mit Abstands-Deckel [Bestand: `capDue`].
   - Dadurch wird der Abstand bis zum nächsten echten Test nie kürzer als geplant: Wer abends übt, bekommt morgen früh keinen geschenkten Test.
3. **Aufstieg nur termingerecht.**
   - Ein Aufstiegs-Tag [Konzept 3.2, Spalte „Aufstieg, wenn …“] zählt nur, wenn das Wort **fällig** war, also bis zum nächsten 04:00-Wechsel.
   - Bei Abständen ab 14 Tagen darf es auch **höchstens 10 % des Abstands** zu früh sein.
   - Alles Frühere ist Übung: Es bewegt FSRS ein wenig, öffnet aber nie eine Stufe.
   - Grund: Die Stufen behaupten „hat nach Abstand gehalten“. Ein vorgezogener Abruf hat diesen Abstand nicht.
   - [Beleg: Cepeda u. a. 2008; Kim & Webb 2022: kurze Abstände wirken sofort gleich gut, später schlechter]
4. **Messung nur aus Terminen.** Diese Werte nehmen nur termingerechte Antworten auf:
   - Zeitbasis (`fk`/`ms`-Median),
   - Signal „wackelig“,
   - Können je Form (`app/levels`),
   - Kennzahlen A1, A5 und W9.

   Vorgezogene Antworten sind leichter, weil die Abrufwahrscheinlichkeit noch hoch ist. Sie würden die Zeitbasis schneller und den Korridor freundlicher machen, als Emrah wirklich ist. Jeder Versuch bekommt dafür eine Marke (16.1, `hist[]`: `v:'x'` freiwillig, `e:1` vorgezogen; nur ergänzend, Tarek prüft).
5. **Ein Fehler zählt immer.**
   - Falsch oder „Weiß nicht“ gibt, auch vorgezogen: „Nochmal“, Stufe −1 (nie unter S2) und den Termin am nächsten Lerntag.
   - Ein überraschendes Ergebnis soll das Modell stark bewegen, ein erwartetes kaum [Beleg: Lena 2.3, Elo/IRT; Mara M4, Birdbrain G]. Ein Fehler bei hoher erwarteter Abrufwahrscheinlichkeit ist die stärkste Nachricht, die es gibt.
   - **Für die Werkstatt-Schwelle** (2 Fehler in 30 Tagen) zählt **höchstens ein Fehler je Wort und Lerntag**. So treibt eine eifrige Abendrunde kein Wort in die Werkstatt.

### 3.2 Wirkung je Lage des Wortes (die eine Übersicht)

| Lage | frei richtig | Hilfe, 2. Versuch | falsch / „Weiß nicht“ | im Trainer |
|---|---|---|---|---|
| **fällig** (bis 04:00, inkl. Aufholer) | Tabelle 3.3, Aufstiegs-Tag möglich | Tabelle 3.3 | Tabelle 3.3 | ja |
| **nicht fällig**, S2, S3, S5 | Übung: FSRS mit kleinem Zuwachs, Termin ab jetzt neu, **kein** Aufstiegs-Tag | Schwer bzw. Nochmal wie Tabelle, kein Aufstiegs-Tag | Nochmal, Stufe −1 (nie unter S2), Termin nächster Lerntag | ja, mit Hinweis im „Wozu?“ |
| **heute eingeführt** (S1) oder Gestern-Check noch offen | – | – | – | **gesperrt** bis nach dem Gestern-Check (3.4) |
| **S4 im Wartefenster** | – | – | – | **gesperrt**, auch „Anhören“ und Anki (3.5) |
| **Werkstatt-Pause** (2 Tage) | – | – | – | gesperrt; danach im Werkstatt-Ablauf |
| **für die Pflicht reserviert** (Block 1/2 von heute, solange die Pflicht offen ist) | – | – | – | gesperrt, Hinweis „kommt in deiner Pflicht“ |
| **gesehen** (Wort-Fenster, „Mehr“, Lösung im Band in den letzten 30 Min.) | Übung **ohne** FSRS-Wirkung | ohne Wirkung | zählt (falls heute noch kein Fehler zählte) | ja (3.6 „Gesehen-Regel“) |
| **pausiert / ausgeblendet** | – | – | – | nur „Eigene Liste“ zeigt es, als „pausiert“ ohne Abfrage |

### 3.3 Reservierung für die Pflicht

- `app/today` friert am Tagesanfang ein [Konzept 16.1]:
  - welche Wörter der Gestern-Check (Block 1) abfragt,
  - wie viele fällige Wörter und neue Wörter Block 2 bekommt.
- Solange die Pflicht offen ist, nimmt der Trainer **diese Wörter nicht**. Sonst wäre Block 2 leer oder anders als angekündigt (Auftrag Kap. 15: „Tagesplan, der sich neu würfelt“), und die Pflicht würde Freiwilliges mitzählen.
- Was über den Tagesplan hinaus fällig ist („Rest“, Aufholer), darf der Trainer auch vor der Pflicht nehmen. Es zählt voll, aber als Extra.
- Nach der Pflicht fällt die Reservierung weg.

### 3.4 Gestern-Check schützen

- **Heute eingeführte Wörter** (aus Block 2 oder aus dem Trainer) ruhen nach Abruf B bis zum Gestern-Check des nächsten Lerntags. Sie stehen in der Liste als „ruht bis morgen früh“.
- **Der heutige „Abend-Check“ entfällt** [Bestand: `domain/srs/offers.ts`, `eveningCheckKeys`: die heute eingeführten Wörter abends noch einmal, höchstens 8].

  Gründe:
  1. Der erste verzögerte Abruf nach einer Nacht trägt den Lerneffekt [Beleg: Karpicke & Roediger 2007; Rawson & Dunlosky 2011, Successive Relearning: die späteren Tage tragen den Langzeiteffekt].
  2. Tag 0 hat schon zwei Abrufe (A und B). Ein dritter am selben Tag bringt pro Minute wenig [Beleg: Nakata 2017].
  3. Ein Abend-Abruf macht den Gestern-Check am Morgen zu einem Test nach wenigen Stunden. Damit wird A1 (Folgetag ≥ 70 %) geschönt, die Bremse für neue Wörter greift nicht mehr, und das Veto Nr. 4 (Abruf am Folgetag als echter Beleg) wird unterlaufen.
- **Abwägung, ehrlich:** Ein zusätzlicher Abruf am Abend schadet dem Wort selbst kaum. Er schadet der **Messung**, und die Messung steuert den ganzen Plan. Deshalb gilt die Sperre.
- **Was abends stattdessen geht:** Fälliges, Schwieriges, Wendungen, „Anhören“ für Wörter ab S2 und „Sag es selbst“ für S3-Wörter (6).

### 3.5 Die 21-Tage-Probe schützen

- Ein S4-Wort braucht für S5 einen freien Abruf nach **≥ 21 Tagen ohne Kontakt** [Konzept 3.2]. Jede Aufgabe mit dem Wort und jedes Öffnen im Wort-Fenster ist Kontakt.
- Deshalb ist es im Trainer **ganz gesperrt**: Es gibt keine Auswahl nach Stand S4, und es kommt nicht in Anki, Tempo, Hören, Anhören oder einer eigenen Liste vor.
- **Die Liste darf die Probe nicht verraten.** Eine Zeile eines ruhenden S4-Wortes zeigt nur das englische Wort und „ruht bis 12.11.“, **ohne Bedeutung**. Das Antippen öffnet erst ein kleines Blatt:
  > „*lead time* ruht bis 12.11. Dann prüfen wir, ob es nach 3 Wochen ohne Kontakt noch sitzt. Öffnen setzt die 3 Wochen zurück.“
  >
  > Knöpfe: „Zurück“ (Hauptknopf) · „Trotzdem öffnen“.
- Wählt Emrah „Trotzdem öffnen“, beginnt das Fenster neu. Das ist ehrlich und kein Vorwurf.
- Ist die Probe fällig, kommt sie in der Pflicht (Block 2). Nach der Pflicht darf auch der Trainer sie stellen, wenn sie dort nicht drankam. Es gilt dann der reservierte, ungesehene Satz oder kein Satz [Konzept 3.5 Nr. 1].

### 3.6 Anki-Modus: was er darf

Der heutige Stand [Bestand: `docs/neubau/anki-regeln.md` §3]: Aufdecken bewertet FSRS voll und hebt bis Stufe 2. Das Konzept hat das schon geändert: „Aufdecken (nur Anki-Modus) | 0 | – | P unverändert“ [Konzept 3.3]. Für den Trainer heißt das:

**Anki · Erkennen (Englisch → Deutsch), Vorschlag:**
- **Vorderseite:** englisches Wort mit Ton und einem Satz. **Rückseite:** Bedeutung, Wortart und Wortpartner.
- **4 Knöpfe** (Nochmal / Schwer / Gut / Leicht) **mit angezeigten Abständen**. Sie planen die **R-Spur** (`lm.r`). Die Abstände stimmen, also ist nichts gelogen. P bewegt sich nie, denn R zählt nie für P [Konzept 3.1].
- **Die Stufen der R-Spur** (neu → erkannt → sicher erkannt) steigen **nur durch eine App-bewertete Antwort**: Bedeutung frei getippt oder gesprochen, oder Ton → Bedeutung [Veto Nr. 25: keine Zahl steigt ohne Leistung].
- **Kontrolle wie heute** [Bestand: anki-regeln §4]: Nach „Leicht“ wird der **nächste fällige** R-Termin dieses Wortes von der App abgefragt (Bedeutung frei nennen). Die Kontrolle wird nie vorgezogen.
- Der Kalibrier-Hinweis „Leicht lag zuletzt oft daneben“ bleibt [Bestand: `Summary.tsx`].
- Vor allem für die **rezeptiven Wörter** (40 je Woche, bis C1 etwa 3.000) ist das der schnellste ehrliche Weg [Konzept 8.3].

**Anki · Bilden (Deutsch → Englisch):**
- **Vorderseite:** Deutsch mit Unterscheider oder Satz mit Lücke. **Rückseite:** englisch, mit Ton.
- **Zwei Knöpfe ohne Abstände:** „Wusste ich nicht“ / „Wusste ich“. Vier Knöpfe mit Abständen wären hier eine Lüge, weil P unverändert bleibt.
- **„Wusste ich“:** keine Planwirkung, nur „gesehen“ (3.2).
- **„Wusste ich nicht“:** Der nächste P-Termin wird **höchstens auf den nächsten Lerntag vorgezogen**. Ein Termin wird nur verkürzt, nie verlängert. Stufe und Stabilität bleiben, und die Werkstatt-Zählung gilt nicht.
  - Das ist kein Verstoß gegen Veto Nr. 2 (Aufdecken darf P nicht heben). Ein früherer Termin bedeutet mehr Prüfung, nicht weniger.
- **Fällige P-Wörter** kommen in Anki-Bilden **nicht** vor. Der Start sagt dazu: „Fällige Wörter übst du im Modus Normal, dort zählen sie.“
- Vorbild ist Anki selbst: Gefilterte Stapel ohne Neuplanung („preview mode … returned exactly as they started“) [G, anki-filtered].
- **Schnellklick:** Aufdecken unter 0,8 s zählt nicht [Konzept 3.4 Nr. 5].
- **Rückgängig** (5 s) bleibt [Bestand: `UndoBar`].

**Antwort auf die Frage „Darf der Anki-Modus Stufen heben?“ Nein, nie.**
- Weder P-Stufen noch R-Stufen.
- Er plant nur R (Erkennen) bzw. verkürzt einen P-Termin (Bilden).
- [Beleg: Kornell & Bjork 2008; Koriat & Bjork 2005: Lerner überschätzen ihr Wissen nach flüssigem Üben]

**Gesehen-Regel (gilt in allen Arten):**
- Hat Emrah in den letzten 30 Minuten die Lösung eines Wortes gesehen, ist die nächste richtige Antwort am selben Lerntag Übung **ohne** FSRS-Wirkung. Gesehen heißt: Wort-Fenster geöffnet, „Mehr“-Blatt, Lösung im Band oder Rückseite im Anki-Modus.
- Sonst würde „Wort ansehen → sofort üben“ einen Abruf aus dem Kurzzeitgedächtnis als Gedächtnisbeweis zählen.
- Daher kommt bei „Dieses Wort üben“ das Wort erst an Platz 4 oder 5 der Runde. Seine Antwort ist Übung, und ein echter Test bleibt der nächste Termin.

### 3.7 Neue Wörter vorziehen

**Ja, aber im selben Kontingent:**
- **Gemeinsamer Deckel:** höchstens **5 neue aktive Wörter je Lerntag** (Pflicht und Trainer zusammen), Wochendeckel 20 (mit Nachholern 25) [Konzept 3.2].
- Hat die Pflicht 4 eingeführt, bietet der Trainer höchstens 1 an.
- **Nur nach der Pflicht.** Sonst nimmt der Trainer Block 2 die Einführungen weg.
- **Nie bei greifender Bremse** (Folgetag-Abruf unter 70 %, Korridor unter 70 %, Zeitbremse). Der Start sagt dann ruhig: „Heute keine neuen. Erst sitzen lassen, was neu ist.“
- **Nie verwechselbare Wörter** am selben Tag, auch nicht über Pflicht und Trainer hinweg [Konzept 3.2; Veto Nr. 8].
- **Voller Tag-0-Ablauf:** Einführung, Abruf A nach 3–4 Karten, Abruf B nach ≥ 8 Karten [Konzept 3.2].
  - Eine Runde mit neuen Wörtern hat deshalb mindestens 10 Karten und höchstens 2 neue.
  - Die anderen Karten sind Fälliges oder Übung.
- **Morgen wächst der Gestern-Check** um diese Wörter. Der Start sagt das: „Morgen kommen sie im Gestern-Check (+1 Min.).“
- **Reihenfolge:** zuerst Wörter des Themas, dann eigene Funde aus dem Eingang. Die Auswahl erklärt „Warum diese?“ [Mara: Duolingo erklärt die Wortwahl im Practice Hub nicht, G duo-ph].

### 3.8 Raten erkennen (im Trainer)

- Es gelten die fünf Signale aus Konzept 3.4.
- **Wackelig** wird nur aus Terminen gebildet (3.1 Nr. 4).
- Die anderen vier Signale wirken auch im Trainer:
  - **Formsprung:** Auswahl richtig, frei falsch → nächster Termin ohne Satz.
  - **Satzbindung**
  - **Widerspruch:** Wort auf S4/S5 falsch → Kontrastkarte.
  - **Schnellklick**
- **Neu: Serien-„Weiß nicht“.** Drei „Weiß nicht“ in Folge, je unter 2 s, lösen einmal je Runde einen Satz aus: „Kurz nachdenken lohnt sich. Ein Versuch hilft beim Merken, auch wenn er falsch ist.“ Es gibt keine Sperre und keinen Tadel [Beleg: Kornell, Hays & Bjork 2009, erfolglose Abrufversuche fördern das spätere Lernen].
- **Auswahl** gibt es ab S2 nur als Rettung nach einem Fehler, höchstens 20 % je Tag über Pflicht **und** Trainer zusammen [Konzept 3.5].
- **Kein Abschreiben nach einem Fehler.** Wer die Lösung sofort abtippt, kopiert nur (Lingvist macht das [S, fluentu-lv]). Stattdessen kommt die Karte nach 3–4 anderen Karten wieder (heute schon so: „Karte kommt wieder“). Diese zweite Antwort ist Übung (Tabelle: 2. Versuch 0,1, Nochmal schon gesetzt).

### 3.9 Fehler: Fehlerschleife und Wort-Werkstatt

- **Wortfehler bekommen keinen eigenen Eintrag** in `err/<JJJJ-MM>`. Die P- oder R-Spur des Wortes ist der Eintrag [Konzept 7.2 Nr. 1].
- Ein falsches Wort kommt am nächsten Lerntag wieder (Stufe −1, nie unter S2).
- **Widerspruch** (S4/S5 falsch) → sofort die **Kontrastkarte** als eigene Aufgabe im Trainer [Konzept 3.4 Nr. 4; Beleg: Butterfield & Metcalfe 2001, Hyperkorrektur].
- **Werkstatt-Schwelle:** 2 Fehler in 30 Tagen oder 4 insgesamt, je Wort und Lerntag höchstens einer (3.1 Nr. 5). Danach Werkstatt mit neuer Darstellung, 2 Tagen Pause und Neustart in S2. Ab 6 Fehlern kommt das Angebot „vorerst pausieren“ [Konzept 3.2; Mara: Anki-Leech-Regel, Darstellung ändern statt wiederholen, G anki-leech].
- **Grammatikfehler** gibt es im Trainer nicht, denn Wörter-Runden enthalten nur Wort- und Wendungskarten [Entscheidungen 11.10.2026, Emrahs Vorgabe].

### 3.10 Abgleich mit Lenas Veto-Kriterien

| Nr. | Kriterium | Wie der Trainer es einhält |
|---|---|---|
| 1 | „fest“ nur nach freiem Abruf nach ≥ 21 Tagen | S4-Sperre, Aufstieg nur termingerecht |
| 2 | Auswahl, Aufdecken und Bausteine heben P nicht | Anki-Bilden ohne Planwirkung, Bausteine nur S1 Abruf A |
| 4 | Abruf am Folgetag | Tag-0-Wörter ruhen bis zum Gestern-Check, kein Abend-Check |
| 7 | eigener Satz erst nach freiem Abruf | „Sag es selbst“ erst ab S3 (6) |
| 8 | keine verwechselbaren Wörter am selben Tag | gemeinsamer Tagesdeckel |
| 9 | eine Notentabelle | dieselbe Tabelle 3.3 |
| 10 | kein Selbsturteil außerhalb Anki | nur im Anki-Modus, plant nur R oder verkürzt |
| 11 | „Weiß nicht“ ohne Strafe | ohne Fehlerton, zählt wie falsch |
| 15 | Warum auch bei richtiger Antwort | derselbe Rahmen und dasselbe Band wie H2 |
| 25 | keine Zahl ohne Leistung | Ergebnis nennt nur echte Aufstiege, keine Punkte |
| 29 | Messplan | 3.11 |

### 3.11 Messplan für den Trainer [Veto Nr. 29]

| Kennzahl | Ziel | Wann | Wenn verfehlt (Rückweg) |
|---|---|---|---|
| **T1** A1 Folgetag-Abruf bleibt ≥ 70 % in Wochen mit viel Trainer-Nutzung (> 60 Trainer-Antworten je Woche) | wie A1 | Woche 4 und 8 nach Stufe 2 | Gesehen-Regel auf 2 h verlängern; Sperren prüfen |
| **T2** Anteil termingerechter Antworten im Trainer | ≥ 50 % | Woche 4 | Startvorschlag stärker auf Fälliges und Schwieriges |
| **T3** Werkstatt-Einweisungen aus Trainer-Fehlern | < 5 % der Trainer-Wörter (wie A7) | Woche 8 | Werkstatt-Zählung nur aus Terminen |
| **T4** Anki-Erkennen: Kontrolle nach „Leicht“ richtig | ≥ 80 % | laufend, 10 Paare | Kalibrier-Hinweis; ab < 75 % in 2 Wochen „Leicht“ ohne Abstand anzeigen |

---

## 4. Ablauf einer Runde

### 4.1 Rahmen

**Derselbe Übungsrahmen wie H2/L2** [Konzept 12.1]. Die Unterschiede:
- **Oben:**
  - Schließen und ein **eigener, einteiliger Balken**. Er zeigt „4 von 10“ mit fester Basis; Wiederkehrer nach einem Fehler zeigt er als „+1“ [Bestand: `roundProgress`].
  - Daneben die Marke **„Extra“** [Bestand: `ctx='extra'`]. So ist auf jedem Bildschirm sichtbar, dass dies keine Pflicht ist (Kap. 2 Nr. 6).
- **Die vier Pflichtfragen** an fester Stelle:
  - Anweisung oben.
  - **„Wozu?“** sagt im Trainer zusätzlich die Lage. Beispiele:
    - „Fällig: zählt für deinen Plan.“
    - „Noch nicht fällig: Übung, dein nächster Termin wird ab jetzt gerechnet.“
    - „Schwieriges Wort: zweimal danebengelegen in 30 Tagen.“
  - Das Band hat drei Zeilen (Urteil, Vergleich, Warum ≤ 120 Zeichen), dazu „Mehr“ und „War das auch richtig?“.
- **Handy:**
  - Eingabe in der Lücke, Autokorrektur aus, Eingabetaste „Prüfen“.
  - „Tipp“ und „Weiß ich nicht“ als echte Knöpfe.
  - Die Reiterleiste ist ausgeblendet.
- **Laptop:**
  - Knopfzeile T / W / ⏎ in der Bühne.
  - Warum, Merke und Mehr offen in der Kontextspalte, darunter „Diese Runde“ (Liste der Karten mit ✓ / ~ / ✕) und „Lage“ (fällig, Übung).

### 4.2 Abfrageformen je Stufe (nie nur eine Form, Auftrag Kap. 15)

| Stufe | Formen im Trainer (Normal) |
|---|---|
| S1 (nur bei „Neue Wörter“) | Einführung → Abruf A (Anfangsbuchstabe, bei Wendungen Bausteine) → Abruf B (frei) |
| S2 | frei ohne Satz mit Unterscheider · Lücke im neuen Satz mit „Gesucht: …“ · jeder 2. Termin R (Bedeutung nennen, Ton → Bedeutung) |
| S3 | Wortpartner bilden · Wortfamilie umbauen · Situation → Ausdruck · Satz übersetzen · gesprochen per Diktat · eigener Satz („Sag es selbst“) |
| S4 (nur die fällige Probe) | reservierter ungesehener Satz oder ohne Satz, ≤ 1,5 × Zeitbasis |
| S5 | gemischte freie Formen · jeder 3. Termin als Schnellabruf · gesprochen, wenn „gesagt“ älter als 60 Tage |

- **Mischregel je Runde:**
  - Ab 10 Karten mindestens 3 verschiedene Formen.
  - Keine Form auf mehr als 40 % der Karten.
  - Ab 20 Karten gilt die Regel aus Konzept 10 (keine Form öfter als 4-mal, mindestens 5 Formen).
- Die Arten „Nur Hören“ und „Nur Sprechen“ legen nur den **Eingabeweg** fest. Die Form wechselt trotzdem nach Stufe.
- **Satzbank:** Für den freien Abruf kommt derselbe Satz 30 Tage nicht wieder, und jeder 3. Abruf ist ohne Satz [Konzept 3.5 Nr. 6]. Das gilt über Pflicht und Trainer zusammen, und gezählt wird über `lm.sx`.
- **Wörter ohne genug geprüfte Sätze** laufen ohne Satz und mit Wortpartner-Formen, nie mit schwachen Sätzen [Konzept 3.5, Bestand].

### 4.3 Pause, Fortsetzen, Ende

- **Jede bewertete Antwort wird sofort gespeichert** [Bestand: `persist.ts`, `transform`].
- **X schließt ohne Rückfrage.**
- Die Runde ist beim Start **eingefroren**. Nichts würfelt sich neu [Bestand: Runde eingefroren; Auftrag Kap. 15].
- **Fortsetzen:** Am selben Lerntag zeigen der Reiter Wörter und Heute (nach der Pflicht) „Runde fortsetzen · 6 von 10“. Am Laptop gibt es dafür Esc und einen Klick [Bestand: `TRAINER_RESUME_ID`].
- **Nach 04:00** verfällt die angefangene Runde ohne Verlust. Gespeichert ist alles, was beantwortet wurde, und der Start macht einen neuen Vorschlag.
- **Jederzeit beenden:** „Fertig“ steht hinter „…“ (Handy) bzw. als Esc (Laptop). Wer nach mindestens einer Antwort aufhört, bekommt die Ergebniskarte der gespielten Karten.

### 4.4 Ergebniskarte (H20, L14)

Eigene Ergebniskarten gibt es nur für freiwillige Einzelrunden [Konzept 4.3]; das ist so eine. Sie zeigt höchstens 4 Zeilen, nur Gemessenes, **keine Punkte, keine XP und keine Prozent-Meisterschaft**:
1. **Was zählte:** „10 Wörter geübt · 7 waren fällig und zählen.“
2. **Echte Schritte** (nur wenn es welche gibt): „*lead time*: frei an 2 Tagen, jetzt auf dem Weg.“ Fehlt so ein Schritt, steht dort nichts. Erfunden wird nichts.
3. **Wieder dran:** „*discount* kommt morgen wieder. *budget approval* war nah dran (1 Buchstabe).“
4. **Ehrlich zum Rest:** „3 waren noch nicht fällig: gute Übung, ihr nächster Termin startet ab heute.“ Oder: „Morgen fällig: 14.“

Dazu kommen die Knöpfe **„Fertig“** (Hauptknopf) und **„Noch 10“** (Nebenknopf, nur wenn Fälliges übrig ist).
- **Heute:** Die Minuten erscheinen als Überlappung am Ring [Konzept 11]. Sie zählen nie zur Pflicht und nie zur Serie (Kap. 2 Nr. 6, Kap. 15).
- **Meilenstein-Moment:** höchstens einer je Tag [Konzept 11]. Kommt er aus dem Trainer (z. B. „erstes Wort fest seit 4 Wochen“), ersetzt er Zeile 2 als kleine Bestätigung, nicht als Vollbild.

---

## 5. Was der heutige Trainer kann: behalten, ändern, weglassen

Grundlage ist `src/features/vocab/*`, `drills/*` und `lookup/*` (gelesen am 27.10.2026).

### 5.1 Behalten (unverändert oder nur neu gekleidet)

| Heute | Datei | Im Trainer |
|---|---|---|
| eine Karte zur Zeit, Wechsel ohne Warte-Animation | `TrainerScreen`, `CardStack` | Rahmen 4.1 |
| Runde beim Start eingefroren, fester Nenner mit „+n“ | `session.ts`, `roundProgress` | 4.1, 4.3 |
| Speichern nach jeder Antwort, Fortsetzen | `persist.ts`, `TRAINER_RESUME_ID` | 4.3 |
| aktive Minuten (Leerlauf bis 60 s gedeckelt) | `TrainerScreen` | Extra-Minuten am Ring |
| Einführungskarte mit Vortest „Was heißt das hier?“ (ohne Planwirkung) | `IntroCard` | S0/S1, Vortest bleibt [Beleg: Pan & Carpenter 2023] |
| Tag 0 mit Abruf A und B, Gestern-Check, Abstands-Deckel 1/3/7/21 | `domain/srs/spacing.ts` | Konzept 3.2, 3.4 |
| Wort-Werkstatt mit Merkhilfen | `WerkstattCard`, `werkstattMemo`, `mnemonic` | Auswahl „Wort-Werkstatt“ |
| Kontrast „Welches Wort passt?“ (höchstens 1 je Runde) | `session.ts` | Kontrastkarte (Widerspruch) |
| „War das auch richtig?“ (Claude nur auf Antippen) | `SynonymCheck` | Band |
| „Mehr“ / „Zum Wort“, deutsche Übersetzung des Beispielsatzes auf Tipp | `MoreInfo`, `WordExtras`, `ExampleTranslation` | „Mehr“-Blatt bzw. Kontextspalte |
| Anki-Aufdecken mit Rückgängig (5 s), Kontrolle nach „Leicht“, Kalibrier-Hinweis | `anki/FlipCard`, `UndoBar`, `Summary` | 3.6 (mit geänderter Wirkung) |
| Hörschleife (spricht Sätze, Pause zum Nachsprechen, ohne Bewertung) | `listen/ListenLoop` | „Anhören“, ohne S4 im Wartefenster |
| eigene Stapel in einem Dokument, Modus und Größe gemerkt | `decks.ts`, `decksStore`, `DeckScreen` | „Eigene Liste“, gemerkte Startwahl |
| Aufholen bei Rückstand | `session.ts` (`catchUpOn`) | „Fällig“ mit Aufholern |
| Ersatzkarte nach „pausieren“ | `replacementFor` | bleibt |
| „Sag es selbst“ (2 Wörter in eigenen Sätzen, Claude prüft) | `hub/SayOwnSheet`, `offers.ts` | bleibt, **aber erst ab S3** (heute reicht 1 freier Folgetag) [Konzept 3.2; Veto Nr. 7] |
| Sprint 90 s nur mit Bekanntem | `drills/SprintView` | Art „Tempo“, nur S5 |
| Wort hinzufügen (ohne Satz keine Karte), „Aus Text“, Nachschlage-Fenster, Mehrwort-Markierung, Sperre „nur feste Einheiten“ | `AddWordSheet`, `FromText`, `LookupPopover`, `PhraseLookup`, `unitCheck` | 6 |
| Wortliste: Suche, Filter, Mehrfachauswahl (ausblenden, zu Liste), 50 Zeilen je Seite | `list/VocabScreen` | H12/L5 |
| ein Status-Text überall | `StatusBlock`, `statusText` | neue Stufen-Wörter (S0–S5) |
| Hintergrund-Sätze nach der Runde (höchstens ein Aufruf) | `wordCtx`, `sentenceBank` | bleibt; KI-Sätze nie für den freien Abruf aktiver Wörter ohne Prüfweg [Konzept 3.5 Nr. 2, 7] |
| keine Grammatik oder Fehlersätze in Wörter-Runden | Entscheidung 11.10.2026 | bleibt |

### 5.2 Ändern oder weglassen, mit Grund

| Heute | Was passiert | Grund |
|---|---|---|
| **Abend-Check** (heute eingeführte Wörter abends, frei) | **entfällt** | schützt den Gestern-Check und A1 (3.4) |
| Anki: Aufdecken bewertet FSRS der P-Spur voll und hebt bis Stufe 2 | Bilden: ohne Planwirkung; Erkennen: plant R | Konzept 3.3, Veto Nr. 2 und Nr. 25; 3.6 |
| 4 Knöpfe mit Abständen auch für Deutsch → Englisch | nur noch im Erkennen | die Abstände würden nicht gelten (Kap. 2 Nr. 2) |
| Prüfabfrage nach Aufdecken mit `cloze_hint`/`tiles` (Bausteine) | entfällt | ab S2 keine Bausteine [Konzept 3.3] |
| Richtung „gemischt“, Englisch → Deutsch als gleichwertige Wahl | entfällt bzw. nur als Erkennen | P nur über Bilden [Konzept 3.1] |
| „Kenne ich“ → Stufe 3 mit 10 Tagen | „Kenne ich schon“ → sofort frei ohne Satz; richtig → S2 | Konzept 3.2 S0 |
| Gewichte in `srs/weight.ts` (Auswahl 0,55) | eine Tabelle | Konzept 3.3 |
| Stapel „hart / Beruf / Wendungen / Eingang“ als eingebaute Stapel | werden Auswahl-Filter (2.1) | eine Startseite statt Stapelseiten |
| Atlas und Wort-Himmel im Trainer-Bereich | bleiben unter Wörter, nicht im Trainer-Start | Wahl klein halten |

---

## 6. Rund um die Wortliste (H12, L5)

- **Suche:** Englisch, Deutsch und Wortpartner, auch in den sichtbaren Sätzen. Verdeckte Sätze werden nie durchsucht oder gezeigt. Unter den Treffern steht „Diese 12 üben“.
- **Filter** (eine Zeile Chips wie in der Vorschau, mehr unter „Filter“):
  - Stand: Alle, Bildest du selbst (S5), Auf dem Weg (S3–S4), Im Aufbau (S0–S2), Erkennst du (rezeptiv), Ruht, Pausiert;
  - Art: Wort, Wendung, Wortpartner;
  - Herkunft: Thema, eigene Funde, Lehrer, Mission;
  - Schwierig.
- **Wörter hinzufügen:**
  - aus dem **Übersetzer** („+ Wort lernen“), aus dem **Wort-Popup** („Merken“), **von Hand** (Englisch, Deutsch, Satz; ohne Satz keine Karte, Kap. 15) und **aus Text** (5–15 Vorschläge). Das gibt es alles schon.
  - **Neu ist die Wahl beim Hinzufügen:** „Erkennen reicht“ (rezeptiv, R-Spur) oder „Aktiv lernen“ (Einführung im Tagesdeckel).
  - **Vorschlag:** In der Pflicht höchstens 1 eigener Fund je Tag (Platz im Deckel 3–4). Weitere eigene Funde kommen über „Neue Wörter“ im Trainer nach der Pflicht. Das entscheidet James, weil es die Themenwörter betrifft.
  - **Satz eines eigenen Fundes:** Der Fundsatz ist der Ursprungssatz und sichtbar; für den freien Abruf ist er nicht reserviert. Bis die Satzbank geprüfte Sätze hat, läuft das Wort ohne Satz und mit Wortpartnern [Konzept 3.5].
- **Pausieren und Ausblenden:**
  - „Pausieren“ setzt keine Termine, die Daten bleiben. Ab 6 Fehlern bietet die App das von sich aus an.
  - „Ausblenden“ (`hidden: true`) löscht nie.
  - Ein pausiertes Wort kommt beim Fortsetzen als normaler Termin wieder. Seine Stufe steigt erst nach einem termingerechten Abruf.
- **Wort-Fenster** (H12 detail): Lautschrift und Ton, Bedeutung, Stand mit einem Satz („Auf dem Weg: frei an 1 von 2 Tagen. Nächster Abruf morgen, ohne Satz.“), Ursprungssatz mit Herkunft und Datum, „Mehr Beispiele“ (2 sichtbare, Deutsch auf Tipp), Wortpartner, typische Falle, letzte Versuche. Dazu die Knöpfe „Dieses Wort üben“, „Sag es“ (ab S3), „Pausieren“ und „Claude fragen“.
- **Ton:** US-Stimme am Wort und an jedem sichtbaren Satz. „Anhören“ für eine Auswahl (Hörschleife).
- **„Sag es“** im Wort-Fenster (ab S3): Lage → per Diktat einen eigenen Satz. Claude prüft, und ein richtiger Satz ist die „eigene Verwendung“ für S3 und S4 [Konzept 3.1, 3.2]. Unter S3 steht dort: „Eigener Satz ab ‚Anwenden‘. Erst soll die Form frei sitzen.“ [Beleg: Barcroft 2004]
- **Wendungssammlung:** Filter „Wendung“. Die Sammelkarten aus Block 6 und aus Missionsberichten bekommen „In meine Wendungen“ (rezeptiv; „Aktiv lernen“ wie oben).

---

## 7. Markt: freies Üben bei den anderen (Mara)

| App | Gut | Schwach | Wir übernehmen |
|---|---|---|---|
| **Anki** | Gefilterte Stapel und „Custom Study“: Vorgezogene Wiederholungen werden gleitend nach Frühzeit neu geplant, und es gibt einen Vorschaumodus ohne Neuplanung [G, anki-filtered]. Leech-Regel: Darstellung ändern [G, anki-leech]. | Das Handbuch warnt, Vorziehen sei „not appropriate for repeated use“ [G, anki-filtered]. Nur Selbsturteil; Produktionskarten muss man selbst bauen [S, anki-prod]. | Frühzeit einrechnen (3.1), Vorschau = Anki-Bilden (3.6), Hinweis gegen Dauer-Vorziehen (2.2), Werkstatt |
| **Clozemaster** | Tippen zählt doppelt so viel wie Auswahl; Hinweis **und zu frühes Wiederholen** halbieren die Punkte [S, cloze-pts]. Gekonnt nach 4 Treffern über 0/1/10/30/180 Tage [G, cloze-m]. | Automatische Beherrschung wirkt auf Nutzer wie „cheating“, Problemsätze werden von Hand zurückgesetzt [G, cloze-90]. Eintönig [S, cloze-boring]. | Vorgezogen zählt weniger (ohne Punkte), Formwechsel je Runde |
| **Lingvist** | Getippte Lücke mit Übersetzung als Hinweis [S, fluentu-lv]. Bekanntes fällt aus der Übung [G, lv-help]. | Nach einem Fehler sofort abtippen [S, fluentu-lv], also eher Kopieren. „Vacuum“, wenig Zusammenhang [S]. 50 Karten am Tag als Rat [G, lv-help]. | „Gesucht: …“ in der Lücke (H2), **nicht** das sofortige Abtippen, **nicht** das Mengenziel |
| **Vocabulary.com** | 10 Fragetypen; Modi „Review nach Fehler“ und „Brush-up nach Beherrschung“ [G, vc-types]. Trouble Words und alle früheren Antworten je Wort [G, vc-sci; S, vc-prog]. | Beherrschung „kann nie sinken“ [G, vc-sci]. | Auswahl „Schwierig“, letzte Versuche im Wort-Fenster; Stufen dürfen sinken |
| **Memrise** (2025) | Drei Spuren: gelernt, gehört, gesagt; Punkte abgeschafft [G, mem-new, mem-walk]. Früher eigene Modi „Difficult words“ und „Speed review“ [Vermutung, ältere Fassung, nicht neu geprüft]. | KI-Gespräch wiederholt sich [S]. | keine Punkte; „gesagt“ als Beleg; Tempo nur mit Sicherem |
| **Duolingo** | Practice Hub neben dem Pfad: Fehler, Wörter, Hören, Sprechen [G, duo-ph]. | Die Wortauswahl im Hub ist nicht erklärt [G, duo-ph]. Wortbank „way too easy“ [S, 9to5]. 2022 nahm der Pfad die freie Wahl weg, mit Protesten [S, nbc]. | gezieltes Üben neben dem Hauptknopf (gegen Anti-Muster A10), aber mit „Warum diese?“ |
| **Busuu** | Wortstärke Schwach/Mittel/Stark, Schwaches zuerst, Filter nach Stärke [S, busuu-vr]. | Stärke sinkt nur mit der Zeit, freie Produktion ist nicht nötig [S]. | Filter nach Stand, Schwieriges zuerst |
| **Quizlet** | wählt die Frageform je Begriff passend [S, qz-format]. | – | Form nach Stufe (4.2) |

**Lücke im Markt** [Vermutung, nach dem Belegten]: Keine der Apps trennt im freien Üben sauber, was zählt (Termin) und was Übung ist (vorgezogen), **und** sagt es dem Lerner in einem Satz. Das ist unser Unterschied (3.2, 4.4).

---

## 8. Bildschirme für Nora (Handy und Laptop)

Die Codes schließen an die Vorschau an (`docs/relaunch/vorschau/src/screens.js` bis H16, `desk.js` bis L10). Die Inhalte stammen aus Kapitel 1 (`vorschau/inhalte-kapitel1.md`, vom Lehrer freigegeben). **Neue englische Sätze sind mit [neu] markiert und brauchen vor dem Test-Link die Gegenlesung durch `english-teacher`.**

### Handy

| Code | Name | Inhalt (2–3 Sätze) | Varianten |
|---|---|---|---|
| **H12** (geändert) | Reiter Wörter | Neu oben die Karte „Üben · 14 fällig · zählt als Extra“ über der Suche. Ruhende S4-Zeilen zeigen nur das englische Wort und „ruht bis 12.11.“. Die Filter-Chips bekommen „Ruht“ und „Schwierig“ hinter „Filter“. | `list` · `list-before` (Pflicht offen) · `list-nothing-due` · `resting-sheet` (Blatt „ruht bis …“) · `detail` (mit „Dieses Wort üben“, „Sag es“, „Pausieren“) |
| **H1** (geändert) | Heute | Unter „Wenn du mehr willst“ steht nach der Pflicht als erste Zeile „Wörter üben · 14 fällig, zählt als Extra“. Vor der Pflicht steht dort keine Wörter-Zeile. | `done` (mit Zeile) · `start` (ohne) · `resume` („Runde fortsetzen · 6 von 10“) |
| **H17** | Trainer-Start | Ein Hauptknopf „Los: 10 fällige Wörter“ mit einer Zeile „Warum diese?“ („die 10 mit der niedrigsten Chance, dass du sie noch weißt“). Darunter klappt „Anpassen“ auf: Was · Wie viele · Art · Richtung, je als Chips. Die Hinweise zu Sperren stehen als eine ruhige Zeile. | `default` · `adjust` (aufgeklappt) · `before-duty` („Deine Pflicht ist noch offen …“) · `new-words` (Kontingent: „noch 1 neues heute · morgen +1 Min. Gestern-Check“) · `brake` („Heute keine neuen …“) · `nothing-due` (Vorschlag „Schwierig“) |
| **H18** | Trainer-Aufgabe | Der Rahmen wie H2 mit Marke „Extra“ und Balken „4 von 10“. Das „Wozu?“ nennt die Lage („Noch nicht fällig: Übung, dein nächster Termin wird ab jetzt gerechnet.“). Band wie H2. | `free` (die Budgetfreigabe → budget approval) · `gap` (*Can you reduce the ___ to four weeks?* → lead time) · `partner` (*___ a quote*, überarbeiten → revise) · `situation` · `recognize` (*sign off on* → freigeben, absegnen) · `listen` · `speak` · `contrast` · `band-early` · `return` (+1) |
| **H19** | Anki-Karte | Oben ein Umschalter „Erkennen · Bilden“. Erkennen: *discount* mit Ton → Rückseite „Rabatt“, 4 Knöpfe mit Abständen („1 T · 3 T · 9 T · 21 T“). Bilden: „die Frist“ → *deadline*, Knöpfe „Wusste ich nicht / Wusste ich“ ohne Abstände, dazu die Zeile „Plant nichts. Zählen tut das freie Tippen.“ | `recognize-front` · `recognize-back` · `produce-front` · `produce-back` · `undo` (Streifen 5 s) · `control` (Kontrolle nach Leicht) |
| **H20** | Trainer-Ergebnis | Vier Zeilen nach 4.4. Darunter „Fertig“ als Hauptknopf und „Noch 10“ als Nebenknopf. | `normal` · `with-step` · `all-early` · `stopped` (nach 4 Karten beendet) |
| **H21** | Wort hinzufügen | Blatt aus Übersetzer oder Popup: das Wort, die Bedeutung und der Fundsatz. Zwei Knöpfe: „Erkennen reicht“ / „Aktiv lernen“; darunter „Kommt nach deiner Pflicht dran, heute noch 1 Platz frei.“ | `from-translator` · `from-popup` · `manual` · `quota-full` |
| **H22** | Tempo | Die reduzierte Bühne mit Zeitlinie (wie Flüssigkeit H9), nur S5-Wörter. Am Ende alle Aufgaben, Fehler aufgeklappt. | `run` · `end` |

### Laptop

| Code | Name | Inhalt | Varianten |
|---|---|---|---|
| **L5** (geändert) | Reiter Wörter | In der Kopfzeile der Liste der Knopf „Üben ⏎“. In der Kontextspalte das Wort-Fenster mit „Dieses Wort üben“. Ruhende Zeilen wie H12. | `main` · `resting` |
| **L11** | Trainer-Start | In der Bühne Vorschlag und Hauptknopf, „Anpassen“ immer offen (genug Platz). In der Kontextspalte „Was zählt?“ in 3 Zeilen (fällig zählt, vorgezogen ist Übung, Ruhendes ist gesperrt) und die Vorschau der ersten 10 Wörter. | `default` · `before-duty` · `new-words` |
| **L12** | Trainer-Aufgabe | Wie L2; die Kontextspalte zeigt Warum/Merke/Mehr, „Diese Runde“ (✓ ~ ✕) und die Lage. Kürzel T, W, ⏎, Esc = Fertig. | `task` · `checked` · `checked-early` · `contrast` |
| **L13** | Anki am Laptop | Leertaste deckt auf. Erkennen: 1–4; Bilden: 1 „Wusste ich nicht“, 2 „Wusste ich“. Z macht rückgängig. Abstände stehen an den Knöpfen (nur Erkennen). | `recognize` · `produce` |
| **L14** | Trainer-Ergebnis | Die Bühne wie H20; die Kontextspalte zeigt die Liste der Runde mit dem nächsten Termin je Wort. | `normal` |

**Beispielinhalte (alle aus Kapitel 1, sonst [neu]):**

| Wort | Deutsch | Form im Trainer | Text |
|---|---|---|---|
| lead time | Lieferzeit | Lücke (H18 `gap`) | *Can you reduce the ___ to four weeks?* · „Gesucht: Lieferzeit“ · Auch richtig: *delivery time*, *turnaround time* |
| budget approval | Budgetfreigabe | frei ohne Satz (H18 `free`) | „die Budgetfreigabe (im Einkauf)“ |
| quote | Preisangebot | Wortpartner (H18 `partner`) | „Ein Angebot überarbeiten: ___ a quote“ → *revise* (Partner laut Kap. 1: send · revise · accept a quote) |
| follow up | nachfassen | Situation → Ausdruck (H18 `situation`) | „Du willst beim Kunden zum Angebot nachfassen. Was sagst du?“ → *I’m following up on the quote we sent on Monday.* [neu] |
| sign off on | freigeben, absegnen | Erkennen (H18 `recognize`) | *sign off on* → Bedeutung frei nennen |
| procurement | Einkauf, Beschaffung | Ton → Bedeutung (H18 `listen`) | Ton *procurement* → „Einkauf, Beschaffung“ |
| discount | Rabatt | Anki-Erkennen (H19) | Vorderseite *discount*, Rückseite „Rabatt“ |
| deadline | Frist | Anki-Bilden (H19), Tempo (H22) | „die Frist“ → *deadline* |
| delivery / lead time | Lieferung / Lieferzeit | Kontrastkarte (H18 `contrast`) | „*delivery* ist die Lieferung selbst. Die Dauer bis dahin heißt *lead time*.“ (Kap. 1, Warum-Zeile) |
| reduce | senken, verringern | Wort-Popup in der Lücke | „Hier: die Lieferzeit verkürzen.“ |

**Ergebnis-Beispiel (H20):**
- „10 Wörter geübt · 7 waren fällig und zählen.“
- „*lead time*: frei an 2 Tagen, jetzt auf dem Weg.“
- „*discount* kommt morgen wieder. *budget approval* war nah dran: 1 Buchstabe.“
- „3 waren noch nicht fällig: gute Übung, ihr nächster Termin startet ab heute.“

**Ruhe-Blatt (H12 `resting-sheet`):** „*procurement* ruht bis 12.11. Dann prüfen wir, ob es nach 3 Wochen ohne Kontakt noch sitzt. Öffnen setzt die 3 Wochen zurück.“ · „Zurück“ · „Trotzdem öffnen“.

---

## 9. Was Emrah entscheiden muss, und Prüfwege

**Für Emrah (in einfachen Worten):**
1. **Anki-Modus neu:**
   - Englisch → Deutsch behält die 4 Knöpfe mit echten Abständen.
   - Deutsch → Englisch hat nur noch „Wusste ich / Wusste ich nicht“ ohne Abstände, weil Aufdecken dort nicht mehr plant (das hat das Konzept schon festgelegt).
   - **Vorschlag: so.** Wer Deutsch → Englisch zählen lassen will, tippt im Modus Normal.
2. **Abend-Check fällt weg**, damit der Test am nächsten Morgen ehrlich bleibt. **Vorschlag: so.**
3. **Auf Heute** steht „Wörter üben“ erst nach der Pflicht. Im Reiter Wörter ist es immer da. **Vorschlag: so.**
4. **Eigene Funde:** höchstens 1 je Tag in der Pflicht, weitere über den Trainer. **Vorschlag: so; James prüft.**

**Prüfwege** (je einmal, dann eine Nachprüfung, CLAUDE.md A2):
- **Nora:** Start mit einem Hauptknopf und „Anpassen“, Ruhe-Blatt, Marke „Extra“, H17–H22 und L11–L14.
- **James:** Beispielsätze [neu], die Regel für eigene Funde, Formen je Stufe.
- **Tarek:**
  - Marken `v`/`e` in `hist[]` (nur ergänzend),
  - die Reservierung aus `app/today`,
  - die Gesehen-Regel (Zeitstempel je Wort, lokal oder in `lm`),
  - R-Planung im Anki-Erkennen über `lm.r`,
  - Rückweg auf v86 (v86 sieht neue Marken nicht, verliert aber nichts).
- **Kai:** Bewertung der Facetten 2, 6, 10, 11, 12 und 13 aus Emrahs Sicht.
- **Tests** (Pflicht vor dem Bau):
  - Ein vorgezogener richtiger Abruf ist kein Aufstiegs-Tag, und der nächste Termin liegt nie früher als geplant.
  - Ein heute eingeführtes Wort ist im Trainer gesperrt.
  - Ein S4-Wort im Wartefenster erscheint nirgends.
  - Eine Anki-Bilden-Antwort lässt `fsrs` unverändert.
  - Die Zeitbasis ignoriert Antworten mit Marke `e`.
  - Der Tagesdeckel neuer Wörter gilt über Pflicht und Trainer zusammen.
  - Die Ergebniskarte nennt nur echte Aufstiege.
  - Simulation über 30 Tage mit täglicher Abendrunde: A1 bleibt gleich wie ohne Abendrunde.

---

## 10. Quellen (zusätzlich zu Lena §5 und Mara §6)

- **[anki-filtered]** Anki-Handbuch, Filtered Decks (Reschedule cards based on my answers; Reviewing ahead; „not appropriate for repeated use“): https://docs.ankiweb.net/filtered-decks.html, abgerufen 27.10.2026 [G]
- **[fsrs-alg]** awesome-fsrs Wiki, The Algorithm („The smaller the value of R, the larger the SInc value“; Erfolg senkt S nie): https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm, abgerufen 27.10.2026 [G]
- Alle weiteren Kürzel (cloze-pts, cloze-m, cloze-90, cloze-boring, lv-help, fluentu-lv, vc-types, vc-sci, vc-prog, mem-new, mem-walk, duo-ph, 9to5, nbc, busuu-vr, qz-format, anki-leech, anki-prod) mit Adresse in `recherche/mara-lernmethodik.md` §6.
- Forschung (Nakata 2017, Kim & Webb 2022, Cepeda u. a. 2008, Karpicke & Roediger 2007, Rawson & Dunlosky 2011, Kornell & Bjork 2008, Kornell, Hays & Bjork 2009, Butterfield & Metcalfe 2001, Barcroft 2004, Webb 2005/2009, Nakata 2016, Pan & Carpenter 2023) mit Adresse in `recherche/lena-lernwissenschaft.md` §5.
