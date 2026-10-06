# Motivationssystem · Dranbleiben bis C1, erwachsen und ehrlich

*Stand 06.10.2026 · Arbeitsstand `claude/umbau-fokus` (zuletzt `8f16bf2`) · Rolle: Lernwissenschaftler mit Schwerpunkt Motivation und Gamification für Erwachsene. Grundlage: der Code (`src/domain/metrics/*`, `src/domain/streak.ts`, `src/domain/plan/comeback.ts`, `src/domain/plan/dayStats.ts`, `src/features/today/*`, `src/features/progress/*`), Auftrag Kap. 2, 5 und 7 und die Pläne `lernplattform-2.md` (**LP2**), `c1-programm.md` (**C1P**), `erlebnis-engine.md` (**EE**) und `ki-tutor.md` (**KT**).*

*Abgrenzung: C1P legt fest, **was** C1 heißt und welche Meilensteine es gibt. EE legt fest, **wie** ein Moment aussieht und sich bewegt. Dieses Dokument legt fest, **wann** die App etwas über den Fortschritt sagt, **was** sie sagt und **was sie nie tut**. Wo es von LP2, C1P oder EE abweicht, steht das in §8. Die Serienregel (CLAUDE.md A7, `src/domain/streak.ts`) bleibt unverändert. In der Datenbank kommen nur ergänzende Felder dazu, kein neues Dokument und keine neue Sammlung.*

Kennzeichnung der Belege: **[C]** im Code nachgelesen · **[M]** gerechnet · **[Q]** Quelle selbst abgerufen · **[S]** Zusammenfassung oder Firmenangabe, Originaltext nicht selbst geprüft · **[E]** eigene Einschätzung, zu prüfen. Quellen mit Adresse in §13.

---

# Teil A · In einfachen Worten (für Emrah)

## Warum das kein Redesign ist

In einer Lern-App ist Motivation kein Aussehen. Sie ist ein Satz von Regeln: Wann sagt die App etwas über deinen Fortschritt? Was genau sagt sie? Und was sagt sie nie?

Spiele-Apps beantworten das mit Punkten, Ligen und Feuerwerk. Das bringt kurzfristig Klicks. Die Forschung zeigt aber zweierlei: Belohnungen fürs bloße Mitmachen senken die Lust am Lernen selbst, und Ranglisten haben in einer Studie sogar die Abschlussnoten gesenkt. Was nachweislich trägt, ist etwas anderes: echten Fortschritt sichtbar machen, nahe Zwischenziele, eine Serie mit eingebautem Ruhetag, eine feste Lernzeit und nach einer Pause ein Neustart ohne Vorwurf.

Die App weiß über dich Dinge, die kein Punktesystem weiß: wie lange ein Wort in deinem Gedächtnis hält, welche Grammatik-Regel sitzt und welche Fehler wiederkommen. Genau das zeigen wir dir, nicht „120 XP“.

## Was du erlebst

1. **Nach jeder Runde siehst du, was sich in deinem Kopf bewegt hat.** Zum Beispiel „Neu sicher: wish + Past Perfect“ oder „Diese 28 Wörter hältst du jetzt länger: Die nächste Wiederholung kommt im Schnitt in 9 statt in 4 Tagen.“ Die Zeile „2 Antworten“ verschwindet.
2. **An den großen Stellen kommen „Du kannst jetzt …“-Karten.** Es gibt sie für die 7 Kapitel. Jede Karte nennt einen Satz, den du nächste Woche im Job sagen kannst. Nach Kapitel 3 heißt er zum Beispiel: „Provided that you commit to a three-year term, we can include the migration at no extra cost.“ Als Beleg stehen darunter drei eigene Sätze, die du richtig hattest.
3. **Dein nächstes Ziel steht immer da, mit Abstand.** Zum Beispiel: „Nächstes Ziel: 250 Wörter und Wendungen fest · noch 38 · etwa 3–5 Wochen.“ Es ist immer nur ein Ziel, nie eine Liste.
4. **Die Serie mit Ruhetag bleibt, dazu kommt ein Wochenziel.** Es lautet „Serie 12 · Woche 4 von 6“. 6 von 7 Tagen reichen, ein Tag ist frei. Das ist dieselbe Regel wie bei der Serie, nur als Blick auf die Woche.
5. **Jede Grammatik-Regel und jede Wortgruppe zeigt ihren Stand in vier Stufen:** Neu · Lernt · Sicher · Fest. Überall steht dieselbe Leiste.
6. **Montags kommt der Wochenrückblick.** Er zeigt, welche Wörter neu fest sitzen (mit Namen), welche Fehler weg sind und welche wiederkommen. Aus zwei Vorschlägen wählst du den Fokus der neuen Woche. Dazu gibt es einen kurzen englischen Text für deinen Preply-Lehrer zum Kopieren.
7. **Nach einer Pause gibt es kein „Serie 0“ und kein „verloren“.** Stattdessen steht da: „Von deinen 412 Wörtern sind voraussichtlich noch 371 da. Wir fangen mit dem Fälligen an.“
8. **Erinnerung:** Die App selbst darf keine Push-Nachrichten schicken. Dafür gibt es Wege außerhalb der App (Entscheidung MO4). Einer davon ist eine kleine Claude-Routine, die dich abends nur dann erinnert, wenn deine Pflicht noch offen ist.

## Was es bewusst nicht gibt

Keine Punkte, keine Ligen, keine Herzen, keinen Serien-Rekord, kein „Du verlierst deine Serie!“, keine Abzeichen fürs bloße Dabeisein, kein Lob wie „Du bist ein Profi“ und kein Konfetti bei jeder Antwort. Die Begründung mit Zahlen steht in Teil B §1.2.

## Was du entscheidest (der Standard gilt, bis du „anders“ sagst)

| Nr. | Frage | Standard |
|---|---|---|
| MO1 | Wochenziel | 6 von 7 Tagen, passend zur Serie mit 1 Ruhetag |
| MO2 | Wochenfokus selbst wählen | Ja: montags ein Tipp auf einen von zwei Vorschlägen. Ohne Wahl entscheidet die App wie bisher |
| MO3 | Frage „Diese Woche im Job benutzt?“ im Wochenrückblick | Nein, erst später, wenn du willst |
| MO4 | Erinnerung | (a) Lernzeit in der App festlegen und eine iPhone-Erinnerung selbst stellen (die App zeigt die genauen Tipps). (b) Freiwillig dazu die Claude-Routine „Lern-Erinnerung“ um 19:25 Uhr, nur bei offener Pflicht. Sie wird erst eingerichtet, wenn du „Ja, Erinnerung einrichten“ schreibst |
| MO5 | Marken für Wörter | 100 · 250 · 500 · 750 · 1.000 · 1.500 fest, Wörter und Wendungen zusammen |
| MO6 | Text für den Preply-Lehrer im Wochenrückblick | Ja |

## Wie du es prüfst

Unter **Einstellungen › Darstellung › „Momente ansehen“** (EE) spielt jede Karte einmal mit Beispieldaten ab. Achte auf zwei Fragen: Wirkt das erwachsen? Stimmt jeder Satz? Nach 4 Wochen schauen wir gemeinsam auf vier Zahlen (Teil B §5) und entscheiden nach festen Regeln, was bleibt.

---

# Teil B · Für die Umsetzung

## 0 Ist-Befund

| # | Befund | Beleg | Folge |
|---|---|---|---|
| I1 | Die Serie ist richtig gebaut: ein Ruhetag je ISO-Woche, nicht angespart, eine Quelle für alle Aufrufer | `src/domain/streak.ts:44-79`, `src/domain/metrics/streak.ts:39-45` [C] | bleibt unverändert |
| I2 | Heute zeigt die Serie nur ab 1; „Serie 0“ erscheint nie | `src/features/today/TodayScreen.tsx:185-194` [C] | bleibt |
| I3 | Wiedereinstieg in drei Stufen und Neustart-Woche, die Texte sind ohne Vorwurf | `src/domain/plan/comeback.ts:33-47`, `TodayScreen.tsx:344-364`, `:641-651`, `src/i18n/parts/nbHeute.de.ts:15-16`, `:47-52` [C] | bleibt, wird ergänzt (§4.10) |
| I4 | Die größte Zahl beim Tagesabschluss ist die Antwortzahl („2 Antworten“) | `TodayScreen.tsx:318-322` [C] | ersetzt LP2 §5.10 |
| I5 | Das Rundenende zählt nur Menge: Richtig x/y, Minuten, Anzahl neu | `src/ui/SessionEnd.tsx:47-51` [C] | §4.7 |
| I6 | Es gibt 5 Wort-Marken und 3 weitere Meilensteine, gemerkt in `app/profile.ms`. Das ist gut, aber die Marken weichen von C1P und EE ab | `src/domain/plan/dayStats.ts:67-93`, `src/data/schemas.ts:176` [C] | §4.2, §8 |
| I7 | „Fest“ zählt nur `vocab/*` ohne Wendungen. Das C1-Kriterium K4 zählt Wendungen mit | `src/domain/vocab/goal.ts:54`, `:62`; `src/features/progress/WordsSegment.tsx:23-24` [C]; C1P §1.6 | Widerspruch, §4.6 und §8 |
| I8 | Der Wochenstreifen mit sieben Ringen ist gebaut, steht aber auf keinem Bildschirm. Nur das Profil-Blatt hat Punkte | `src/features/progress/StandHeader.tsx:17-54` (kein Aufrufer), `src/domain/progress/weekDots.ts:28-39` [C] | §4.5 |
| I9 | Ein vergangener Tag ohne Pflicht heißt „nicht erledigt“, ein Vorwurfston | `StandHeader.tsx:37`, `src/i18n/parts/stand.de.ts:44` [C] | wird „kein Lerntag“ (§4.10) |
| I10 | Im Wochenbericht „sitzt“ ein Wort schon ab einer Stabilität von 3 Tagen. Das widerspricht Neu · Lernt · Sicher · Fest | `src/domain/progress/weekly.ts:61-73` [C] | §4.9 |
| I11 | Es fehlen ein Wochenziel, ein „nächstes Ziel“, eine Lernzeit und jede Erinnerung | – | §4.1, §4.5, §4.11 |
| I12 | Fortschritt öffnet auf „Rückblick“, LP2 §2.7 will „Wörter“ | `src/features/progress/ProgressScreen.tsx:78` [C] | LP2 gilt |
| I13 | Das Tagesbild `va` (Fest-Zahl je Tag) wird geschrieben, 120 Tage Verlauf | `src/features/today/store.ts:338`, `src/domain/progress/history.ts:30`, `:63` [C] | Grundlage für „+n in 7/28 Tagen“ |
| I14 | Freiwillige Runden stehen im Tagesprotokoll mit `ctx: 'xtra'` | `src/domain/progress/logPatch.ts:27`, `src/domain/plan/buildPlan.ts:223` [C] | Grundlage der Messung (§5) |

**Urteil:** Das Fundament stimmt. Es ist ehrlich, ruhig und hat den Ruhetag. Es fehlen vier Dinge:
1. ein sichtbarer Grund weiterzumachen, der über den Tag hinausreicht (nahes Ziel, Kapitel, Bezug zum Job);
2. Fortschritt, den man auch an Tagen ohne Zustandswechsel sieht (bis „Fest“ vergehen mindestens 21 Tage);
3. echte Wahlmöglichkeiten;
4. eine Erinnerung ohne Push.

## 1 Forschung → Regeln

### 1.1 Was trägt

| Befund | Zahl | Quelle | Regel in der App |
|---|---|---|---|
| Drei Grundbedürfnisse tragen dauerhafte Motivation: Autonomie, Kompetenz, Eingebundenheit | Theorie, viel belegt | Ryan & Deci 2000 [S] | Jedes Element ist einem Bedürfnis zugeordnet (§2.2) |
| Positive Rückmeldung, die **informiert**, erhöht das freiwillige Weitermachen | d = +0,33 (freie Wahl), +0,31 (Interesse) | Deci, Koestner & Ryan 1999 [S] | Rückmeldung sagt, **was** jetzt gekonnt wird, nicht „gut gemacht“ |
| Nahe Teilziele steigern Können, Selbstwirksamkeit und Interesse; ein fernes Ziel allein zeigte keine Wirkung | Kinder, Mathematik | Bandura & Schunk 1981 [S] | Immer genau **ein** nächstes Ziel in Reichweite (§4.1); C1 bleibt das ferne Ziel |
| Die Anstrengung steigt, je näher das Ziel ist (Zielgradient) | Kaffee-Stempelkarte, Bewertungsportal | Kivetz, Urminsky & Zheng 2006 [S] | Den Restabstand zeigen („noch 38“) |
| Geschenkter Vorsprung erhöht den Abschluss | 34 % gegen 19 % eingelöste Karten | Nunes & Drèze 2006 [S] | Angerechnet wird nur **echter** Vorsprung (Einstufung, Bestand), nie ein erfundener |
| Ein hartes Ziel mit einer Wochenreserve ohne Übertrag lässt Menschen nach einem Fehltag öfter weitermachen | 55 % Wiederaufnahme (Reserve je Woche) gegen 37 % (hart) und 44 % (leicht); Ziel 7 Tage, 2 Reservetage | Sharif & Shu [Q] | Der Ruhetag (A7) wird sichtbar als „1 Ruhetag frei“ (§4.4) |
| Eine Gewohnheit braucht im Median 66 Tage (18–254). Ein einzelner verpasster Tag änderte den Verlauf nicht | 96 Personen, 12 Wochen | Lally u. a. 2010 [S] | Ein Fehltag wird nie dramatisiert; die App sagt ehrlich „etwa 2 Monate, bis es von selbst läuft“ |
| Ein Umsetzungsvorsatz („Wenn X, dann übe ich“) steigert die Zielerreichung | d = 0,65 über 94 Tests | Gollwitzer & Sheeran 2006 [S] | „Meine Lernzeit: 7:30 · nach dem ersten Kaffee“ (§4.11) |
| Nach Zeitmarken (Montag, Monatsanfang) starten Menschen eher neu (Neuanfang-Effekt) | Feldstudien (Suchanfragen, Fitnessstudio) | Dai, Milkman & Riis 2014 [S] | Montags Wochenrückblick mit Fokuswahl; nach einer Pause die „Neustart-Woche“ |
| Fortschritt in sinnvoller Arbeit ist der stärkste Tagesantrieb | ≈ 12.000 Tagebucheinträge von 238 Beschäftigten | Amabile & Kramer 2011 [S] | Jede Runde zeigt einen kleinen, **echten** Fortschritt (§4.7) |
| Mit 7-Tage-Serie beenden Lernende 3,6-mal häufiger ihren Kurs (korreliert, nicht kausal). Zwei Serienschutz-Tage statt einem brachten +0,38 % täglich Aktive | Firmenangaben | Duolingo [Q] | Die Serie bleibt, die Reserve ist eingebaut |
| Ein lebendiges Bild des künftigen Ich (Ideal-L2-Selbst) hängt stark mit beabsichtigter, aber nur schwach mit gemessener Leistung zusammen | r = 0,61 bzw. r = 0,20 (32 Berichte, 32.078 Lernende) | Al-Hoorie 2018 [S] | „Du kannst jetzt“ mit Job-Bildern stärkt die Absicht. Die Leistung kommt aus dem Üben, deshalb bleiben die Bilder kurz |
| Gamification wirkt im Mittel klein bis mittel | g = 0,49 kognitiv, 0,36 motivational, 0,25 Verhalten; die motivationalen Effekte sind weniger stabil | Sailer & Homner 2020 [S] | Spielelemente nur dort, wo sie Lerninformation tragen |

### 1.2 Wo Gamification schadet (Gegenbeispiele)

| Mechanik | Befund | Quelle | Regel |
|---|---|---|---|
| Rangliste und Pflicht-Abzeichen | weniger intrinsische Motivation, weniger Zufriedenheit, schlechtere Abschlussprüfung als in der gleichen Veranstaltung ohne Spielelemente | Hanus & Fox 2015 [S] | Keine Rangliste, auch nicht „gegen dich von letzter Woche“; keine Pflicht-Abzeichen |
| Erwartete Belohnung fürs Mitmachen, Erledigen oder Leisten | senkt das freiwillige Weitermachen: d = −0,40 / −0,36 / −0,28 | Deci, Koestner & Ryan 1999 [S] | Keine XP, keine Abzeichen für Tage, Antworten oder Minuten |
| Rückmeldung, die auf die Person zielt | Über ein Drittel aller Rückmeldungen senkte die Leistung, umso mehr, je näher sie an der Person statt an der Aufgabe war (607 Effekte). Lob auf der Selbst-Ebene ist meist wirkungslos | Kluger & DeNisi 1996 [S]; Hattie & Timperley 2007 [S] | Nie Personenlob; immer Aufgabe, Vorgehen oder Regel |
| Eine gerissene Serie wird sichtbar gezeigt | Danach machen Menschen seltener weiter, besonders wenn sie sich selbst die Schuld geben; schwächer, wenn die Serie „reparierbar“ ist | Silverman & Barasch 2023 [S] | Nie die gerissene Länge zeigen; der Ruhetag ist die eingebaute Reparatur; Texte nie in der Du-hast-Form |
| Alles-oder-nichts-Ziele | Nach einem Verstoß kippt das Verhalten („jetzt ist es auch egal“) | Cochran & Tesser 1996 [S] | Kein „Woche verfehlt“; nach einem Fehltag ist das Wochenziel noch erreichbar |
| Starre Uhrzeit als Bedingung | Anreize für eine feste Trainingszeit brachten weniger Besuche als flexible, auch danach | Beshears u. a. 2021 [S] | Die Lernzeit ist ein Vorschlag; gezählt wird der ganze Lerntag bis 04:00 Uhr |
| Schmückende Zusatzreize | senken das Lernergebnis, g = −0,33 | Sundararajan & Adesope 2020, nach EE §1 | Momente nur bei echten Ereignissen (EE Leitsatz 1) |
| Abzeichen allgemein | Ihr Nutzen hängt von Abzeichen-Art und Vorwissen ab; Teilnahme-Abzeichen halfen nur leistungsschwächeren Lernenden | Abramovich, Schunn & Higashi 2013 [S] | Nur Können-Abzeichen (Kapitel), §4.12 |
| Ligen und soziale Funktionen | stressen manche; Wunsch nach abschaltbaren Spielelementen | Oulu 2025, nach `06-marktvergleich.md` M10 | Keine Ligen; die Effekt-Stufe ist wählbar (EE) |

## 2 Leitsätze (verbindlich)

1. **MO-L1 · Nur Wahres.** Jede Zahl kommt aus `domain/metrics`, jede Zustandsänderung ist belegt. Lieber nichts zeigen als etwas Erfundenes.
2. **MO-L2 · Gefeiert wird Können, nie Anwesenheit.** Auslöser sind Zustandswechsel, bestandene Prüfungen und Marken, nie Tage, Antworten oder Minuten.
3. **MO-L3 · Prozessziel für die Woche, Ergebnis im Rückblick.** Das Wochenziel zählt Pflichttage, denn die kann Emrah steuern. Fest-Zahlen erscheinen nur als Rückblick und Prognose: „Fest“ braucht mindestens 21 Tage Stabilität und ist in einer Woche nicht planbar.
4. **MO-L4 · Kein Verlust, kein Druck.** Keine Verlust-Formulierungen, kein Countdown, kein Ausrufezeichen in Fortschrittstexten.
5. **MO-L5 · Seltenheit ist Bedeutung.** Es gilt das Frequenz-Budget in §3.
6. **MO-L6 · Pause ist normal.** Der Wiedereinstieg ist ein eigener, freundlicher Zustand (§4.10).
7. **MO-L7 · Wahl, wo sie nichts kostet.** Autonomie, ohne den eingefrorenen Tagesplan oder die Serienregel zu brechen.
8. **MO-L8 · Bezug zum Job.** Jeder große Moment nennt eine Situation aus DMS/ECM, Vertrieb, Verhandlung oder C-Level-Kommunikation.
9. **MO-L9 · Pflicht und Extra sind getrennt** (Kap. 2 Nr. 6). Extra zählt nie für Ring, Serie oder Wochenziel. Es erscheint im Rückblick als „freiwillig“ (Kap. 15: „Zähler, der freiwillige Schritte als Pflicht mitzählt“).

### 2.1 Textregeln (prüfbar)

| Statt | schreibt die App | Grund |
|---|---|---|
| „Super! 🔥 12 Tage in Folge!“ | „Serie 12 · Woche 4 von 6“ | Kap. 7: dezent mit Zahl |
| „Du verlierst heute deine Serie!“ | gar nichts | Verlust-Framing (MO-L4) |
| „Deine Serie von 45 Tagen ist gerissen.“ | nach der ersten Pflicht „Serie 1“ | Silverman & Barasch 2023 |
| „Toll gemacht, du bist ein Profi!“ | „Neu sicher: wish + Past Perfect · 3 von 3 ohne Hilfe“ | Aufgabe statt Person (Hattie & Timperley 2007) |
| „Nur 52 %“ | „Dein erster C1-Check: 52 %. Ab jetzt siehst du jeden Monat, wie du dich bewegst.“ | C1P §3.3 M8 |
| „Du hast 5 Tage nicht geübt.“ | „Willkommen zurück. Heute zuerst das Fällige.“ (vorhanden, `nbHeute.de.ts:15`) | Pause ist normal |
| „nicht erledigt“ (Wochenstreifen) | „kein Lerntag“ | I9 |
| „Perfekt, 100 %!“ | „Alles richtig.“ Steigt laut 03-lernmodell §6 die Form, folgt: „Ab morgen etwas anspruchsvoller.“ | Zielkorridor 70–90 %; 100 % heißt oft „zu leicht“ |

**Prüfung:** `tests/unit/motivationText.test.ts` durchsucht alle i18n-Schlüssel mit den Präfixen `nbHeute`, `nbShEnd`, `wk`, `weekly`, `mo` in DE und EN.
- Verboten in DE: `/verlier|verloren|gerissen|schade|nicht vergessen|beeil|nur noch|super|genial|klasse|perfekt|wow|profi|!/i`
- Verboten in EN: `/\blos(e|t)\b|broken|hurry|don't forget|awesome|amazing|perfect|genius|wow|!/i`
- Grammatik-Namen wie „Present Perfect“ kommen nur über Platzhalter (`{topic}`) in die Texte und sind deshalb nicht betroffen.

### 2.2 Selbstbestimmungstheorie: Zuordnung

| Bedürfnis | Stärken durch | Vermeiden | Elemente |
|---|---|---|---|
| **Autonomie** | Wochenfokus wählen; Lernzeit selbst festlegen; Extra sichtbar freiwillig; Effekt-Stufe wählen (EE); „Trotzdem: Thema“ statt Fehlersätze (LP2 §2.4); Anki-Modus | Pflicht-Abzeichen, „du musst“, Erinnerungsdruck, Countdown | §4.9, §4.11 |
| **Kompetenz** | Zustandswechsel mit Namen; „Gedächtnis-Zeit“; „Du kannst jetzt“ mit eigenen Belegen; nächstes Ziel mit Abstand; Kapitelprüfung (C1P §4.3); ehrliche Prognose als Zeitraum; Zielkorridor 70–90 % je Block (03-lernmodell §6) | Lob für 100 %, Personenlob, Zahlen ohne Bedeutung (XP, Antworten) | §4.1, §4.2, §4.6, §4.7 |
| **Eingebundenheit** | Job-Sätze (Kunde, CFO, IT-Leitung); Text für den Preply-Lehrer; Claude als Tutor (KT); „Einsatz-Satz der Woche“ | Ranglisten, Vergleich mit anderen („besser als 80 % der Lernenden“) | §4.3, §4.9 |

## 3 Frequenz-Budget

Die Stufen folgen EE §1 Leitsatz 3. Die erwarteten Häufigkeiten stammen aus dem Modell in C1P §3.5 (Standard: ≈ 66 neue „Fest“ je Monat, 1 neues Thema je 3 Lerntage) [E].

| Stufe (EE) | Ereignis | erwartet | Obergrenze |
|---|---|---|---|
| 1 | Urteil je Antwort | 80–120 je Tag | – |
| 2 | Zustand steigt (Wort → Sicher/Fest, Muster → Sicher) | ≈ 3–6 je Lerntag (≈ 2,2 Fest + ≈ 0,5 Muster + Sicher-Wechsel) [M aus C1P §3.5] | Funken für höchstens 3 Wechsel je Runde, weitere nur als Zahl am Rundenende |
| 2 (Text) | „Du kannst jetzt“ für ein Thema (alle Muster ≥ Sicher) | ≈ 1 je Woche (47 Themen in 12–15 Monaten) | 1 je Runde |
| 3 | Runde geschafft / Tag geschafft | ≤ 4 / 1 je Tag | Der Tagesmoment spielt nur beim Übergang „offen → fertig“ (EE M7) |
| 3 | Wochenrückblick geöffnet | 1 je Woche | einmal je Woche und Gerät |
| 4 | Meilenstein-Karte (§4.2) | ≈ 19 in 12–15 Monaten, also etwa alle 3 Wochen | ≤ 1 je Sitzung, ≤ 2 je ISO-Woche; was länger als 7 Tage wartet, wird ein Satz im Wochenrückblick statt einer Karte (keine veralteten Feiern) |

## 4 Die Elemente

Aufbau je Element: Bildschirm (Handy / Laptop) · Regel · Datenquelle · Daten · Beleg · Aufwand · Abnahme. Aufwand wie in EE §12: **S** ≤ ½ Tag · **M** ≈ 1 Tag · **L** 2–3 Tage · **XL** > 3 Tage, Bauzeit einer Sitzung mit Tests.

### 4.1 Nächstes Ziel (der Weg zu C1 im Kleinen)

**Bildschirm:**
- Handy: auf der Abschlusskarte von Heute (LP2 §5.10) eine Zeile unter der Wahrheitszeile, zum Beispiel „Nächstes Ziel: Kapitel 3 · 4 von 9 Mustern sicher“ oder „Nächstes Ziel: 250 Wörter und Wendungen fest · noch 38 · etwa 3–5 Wochen“. Im Fortschritt steht dieselbe Zeile unter der Kopfzeile „Wörter B2+ · Grammatik B2“ (LP2 §2.7).
- Laptop: in der Karte „Stand“ rechts neben der Tageskarte (LP2 §2.2).
- Wurde heute ein Meilenstein erreicht, ersetzt sein Satz die Zielzeile (nie beides; Kap. 15 „dasselbe dreimal“).

**Regel:**
- Kandidaten: (a) die nächste Fest-Marke (MO5), (b) das aktuelle Kapitel abgeschlossen (Fortschritt = Muster sicher / Muster des Kapitels; der Abschluss selbst ist die Prüfung aus C1P §4.3), (c) der nächste C1-Check (Datum, C1P §4.2).
- Gezeigt wird der Kandidat mit dem kleinsten relativen Restweg: Rest geteilt durch den Abstand zwischen letzter und nächster Marke. Bei Gleichstand gewinnt (a).
- Ein Zeitraum erscheint nur mit mindestens 21 Tagen Daten und nur bei einem Zuwachs von mindestens 1 je 28 Tage, gerechnet wie `festForecast` (`src/domain/metrics/vocab.ts:114-121`). Sonst steht die Zeile ohne Zeit da.
- Die **Kennung** des Ziels wird beim Anlegen des Tagesplans eingefroren (`u.nx`), damit die Zeile im Lauf des Tages nicht zwischen Zielen springt (LP2 Leitsatz 7). Die Zahlen darin sind live.

**Datenquelle:** neu `src/domain/metrics/goals.ts` → `nextGoal(i): { id: 'fest250' | 'ch3' | 'c1check' | …; have: number; need: number; weeks: [lo, hi] | null }`. Sie liest `festUnits` (§4.6), `patternState` (LP2 §4.9) und das Check-Datum (C1P).
**Daten:** `u.nx` (Kennung, ≤ 24 Zeichen) im gespeicherten Tagesplan, rein ergänzend wie `u.gt`/`u.ps` (LP2 §8).
**Beleg:** Bandura & Schunk 1981 (nahe Teilziele); Kivetz u. a. 2006 (Zielgradient).
**Aufwand:** M.
**Abnahme:**
- Unit: Kandidatenwahl an 6 Fixtures; Zeitraum nur bei ≥ 21 Tagen Daten.
- E2E: Die Zahl auf der Abschlusskarte gleicht der Zahl im Fortschritt und dem Selektor.
- Die Kennung bleibt über den Lerntag gleich (Testuhr 08:00 → 23:00 mit einer Runde dazwischen).

### 4.2 Meilensteine und „Du kannst jetzt“

**Ein Katalog** (ersetzt die verstreuten Listen aus `dayStats.ts:67`, C1P §3.3, EE M8 und LP2 §2.7):

| ID | Bedingung (Quelle) | Form | Was gezeigt wird | erwartet [E] |
|---|---|---|---|---|
| `place` | Einstufung beendet (C1P §4.1) | Karte | Startpunkt in Worten (C1P M0) | Woche 1 |
| `fest100` … `fest1500` (6 Marken) | `festUnits` ≥ Marke | 100 als Satz, ab 250 Karte | „250 Wörter und Wendungen sitzen fest.“ Darunter drei eigene, zuletzt fest gewordene Einträge mit ihrem Ursprungssatz. **Kein** „Du kannst“ (eine Wortzahl belegt keine Fähigkeit) | 250 ≈ Monat 4, 500 ≈ Monat 8, 750 ≈ Monat 12 (Standard, Bestand 0) |
| `topic1` | erstes Thema fest (vorhanden, `dayStats.ts:81`) | Satz | vorhanden | – |
| `fix10` | 10 Fehlersätze fest (vorhanden) | Satz | vorhanden | – |
| `overdue0` | nichts mehr überfällig nach einer Pause (vorhanden) | Satz | vorhanden | – |
| `ch1` … `ch7` | Kapitelprüfung bestanden (C1P §4.3) | Karte mit Emblem (EE M8) | „Du kannst jetzt …“ (Tabelle unten), drei eigene richtige Sätze aus der Prüfung, Einsatz-Satz (§4.3) | Kapitel alle 2–5 Wochen |
| `c1check1` | erster C1-Check gespeichert (C1P M8) | Karte | Ergebnis ohne Wertung | Monat 1–2 |
| `c1ready` | K1–K6 erfüllt (C1P §1.6) | Karte | C1P M12 mit dem Satz „Sprechen und Schreiben misst die App nicht.“ | Monat 12–15 |

Zusammen sind das 19 Ereignisse in 12–15 Monaten, im Schnitt etwa eines alle 3 Wochen [M].

**„Du kannst jetzt …“ je Kapitel** (Kapitelnamen C1P §3.2; Sätze in US-Englisch; vor dem Bau prüft `english-teacher` die Sätze, A2-Regel: eine Prüfung, eine Nachprüfung):

| Kapitel | Situation | Satz für den Job |
|---|---|---|
| 1 Zeiten | Projektstatus im Lenkungskreis | „Since we went live in March, we've processed more than 1.2 million invoices, and we had already migrated the legacy archive before the audit started.“ |
| 2 Zukunft | Roadmap-Termin beim Kunden | „The e-invoicing module is due to launch in Q3, and by the end of the year we will have moved all customers to the new platform.“ |
| 3 Bedingung und Wunsch | Preisverhandlung, Rückblick auf eine Eskalation | „Provided that you commit to a three-year term, we can include the migration at no extra cost.“ · „Had we involved IT earlier, we wouldn't be facing this delay now.“ |
| 4 Passiv und Berichten | Fragebogen der IT-Sicherheit | „All documents are encrypted at rest, and every access is logged in a tamper-proof audit trail.“ · „We recommend that the archive be migrated before go-live.“ |
| 5 Modalität | Risiko vorsichtig ansprechen | „The rollout may well take longer than planned, so it might be worth building in a two-week buffer.“ |
| 6 Verbmuster | Mail an einen Interessenten | „Our solution prevents duplicate invoices from entering the approval workflow. We look forward to hearing from you.“ |
| 7 Satzbau und Betonung | Pitch vor der Geschäftsführung | „Not only does the platform cut invoice processing time in half, it also keeps you audit-ready at all times. What our customers value most is the complete audit trail.“ |

**Für einzelne Themen** (Stufe 2, eine Zeile am Rundenende): Sind zum ersten Mal alle Muster eines Themas mindestens „Sicher“, kommt eine Zeile aus dem Themen-`canDo` und einem `ex` mit `ctx: 'mail' | 'meeting'` aus `patterns/<topic>.json` (LP2 §3.2). Beispiel: „Neu: Bedingungen ohne *if* sitzen. Für dein nächstes Angebot: ‚Should you need further details, please let me know.‘“ Der Tag ist aus `pats[*].s` ableitbar (LP2 §8), es entsteht kein neues Feld.

**Regeln:**
- Angekündigt wird ein Meilenstein genau einmal **über alle Geräte**: `app/profile.ms[id] = Lerntag` (vorhanden, `dayStats.ts:88-93`, nur ergänzend). Ob die Animation auf diesem Gerät schon lief, merkt sich `localStorage` (`lx:moments-seen`, EE §11). Der Datenbankeintrag entscheidet, ob es eine Karte gibt; der Gerätespeicher entscheidet nur, ob animiert wird.
- Mehrere auf einmal (zum Beispiel beim ersten Lauf mit altem Bestand oder bei der Umstellung auf `festUnits`): alle werden still gemerkt, gezeigt wird nur der höchste (wie heute `dayStats.ts:72-76`).
- Budget §3: ≤ 1 Karte je Sitzung, ≤ 2 je ISO-Woche, was älter als 7 Tage ist, wird ein Satz im Wochenrückblick.

**Datenquelle:** `newMilestones` wird erweitert (`src/domain/plan/dayStats.ts:77-85`). Die Kapitel- und Check-Bedingungen liest es aus den C1P-Einträgen in `out/<JJJJ-MM>` (`k: 'c1gate' | 'c1check' | 'c1place'`, C1P §7).
**Daten:** neue IDs in `app/profile.ms` (`fest750`, `ch1`–`ch7`, `place`, `c1check1`, `c1ready`), höchstens 30 Schlüssel. Inhalte im Bundle: `src/content/c1/program.json` (C1P §7) bekommt je Kapitel das ergänzende Feld `use: { de, en, ex: string[] }`, also Situation und Satz.
**Beleg:** Deci u. a. 1999 (informierende Rückmeldung +0,33); Al-Hoorie 2018 (Ideal-L2-Selbst); Abramovich u. a. 2013 (Können statt Teilnahme).
**Aufwand:** M, dazu S für die Inhalte und die Prüfung durch `english-teacher`.
**Abnahme:**
- Unit: Katalog über Seed-Verläufe, jede ID höchstens einmal.
- Zwei Tabs (Handy und Laptop simuliert) zeigen dieselbe Karte nicht zweimal.
- Budget: Bei 3 gleichzeitigen Meilensteinen erscheint eine Karte, die anderen werden still gemerkt.
- Textregel-Test grün; axe 0.

### 4.3 Einsatz-Satz der Woche (Transfer in den Job)

**Bildschirm:**
- Handy: im Wochenrückblick (§4.9) eine Karte „Für diese Woche“ mit Situation, Satz und Knopf „Kopieren“; außerdem auf jeder Kapitelkarte.
- Laptop: gleich, rechte Spalte.

**Regel:**
- Der Satz kommt aus dem aktuellen Kapitel (`program.json.use`) oder aus einem Thema, das in der Vorwoche neu sicher wurde.
- Nur mit **MO3 = ja**: Im nächsten Wochenrückblick steht die Frage „Benutzt?“ mit Ja/Nein (eine Zeile, freiwillig). „Ja“ legt am Thema die Marke „im Job benutzt“ an. Das ist **keine** Note und ändert weder FSRS noch BKT (A7, keine Selbstbewertung).

**Datenquelle:** Inhalt aus dem Bundle; Auswahl rein in `src/domain/metrics/goals.ts`.
**Daten:** nur mit MO3: `app/profile.used[id] = Lerntag`, höchstens 200 Einträge.
**Beleg:** Al-Hoorie 2018; Umsetzungsvorsatz für Transfer (Gollwitzer & Sheeran 2006). Der Transfer-Nutzen selbst ist **nicht** gemessen [E].
**Aufwand:** S (ohne MO3), S zusätzlich (mit MO3).
**Abnahme:** Der Satz ist US-Englisch (bestehender Sprachtest); der Kopier-Knopf funktioniert ohne `sample`; mit MO3 = nein gibt es kein Ja/Nein und keinen Schreibvorgang.

### 4.4 Serie (die Regel bleibt unverändert)

**Bildschirm:**
- Heute: genau eine Stelle im Kartenfuß (`TodayScreen.tsx:185-194`), neu im Format „Serie 12 · Woche 4 von 6“ (§4.5).
- Profil-Blatt: Kopf „Serie 12 · Ruhetag diese Woche frei“ bzw. „Ruhetag genutzt (Di)“ (05-ux §3.3).

**Regel:**
- `computeStreak` bleibt unverändert (A7, A6.13).
- Nie gezeigt werden: „Serie 0“, die gerissene Länge, ein Rekord, eine Flamme oder ein Countdown („noch 3 Std.“).
- „Ruhetag frei“ heißt: In der laufenden ISO-Woche gibt es noch keinen vergangenen Tag ohne Pflicht. „Ruhetag genutzt“ heißt: Ein Tag dieser Woche hat in `weekStrip` den Zustand `rest`.

**Datenquelle:** `streakWeek` (`src/domain/metrics/streak.ts:42-45`), neu `restInfo(week)` in derselben Datei.
**Daten:** keine.
**Beleg:** Sharif & Shu (Reserve ohne Übertrag); Silverman & Barasch 2023; Duolingo-Firmenangaben zur Serienreserve.
**Aufwand:** S.
**Abnahme:**
- Die bestehenden Serien-Tests bleiben unverändert grün.
- E2E über die Seeds Erststart, Pause 14 Tage und normaler Tag: Der Text „Serie 0“ kommt nie vor; nach einer Pause steht keine Serie, bis die erste Pflicht erledigt ist.

### 4.5 Wochenziel „6 von 7“

**Bildschirm:**
- Handy: Kartenfuß auf Heute „Woche 4 von 6“ (zusammen mit der Serie, eine Zeile). Auf der Abschlusskarte der Wochenstreifen mit sieben Ringen: Der vorhandene `WeekStrip` (`StandHeader.tsx:17-54`) bekommt hier seinen ersten Platz (LP2 §5.10 Nr. 4).
- Laptop: gleich, Streifen unter dem großen Ring.

**Regel:**
- Ziel = 6 Pflichttage je ISO-Woche (MO1). Gezählt werden nur Tage im Zustand `done` aus `weekStrip` (`src/domain/streak.ts:113-127`). Extra-Tage stehen als halber Punkt da („nur Extra“, `weekDots.ts:28-30`) und zählen nicht (MO-L9).
- Anzeige:
  - während der Woche: „Woche n von 6“;
  - bei ≥ 6: „Woche geschafft“, bei 7 zusätzlich „· 7 Tage“;
  - ist 6 nicht mehr erreichbar: „Diese Woche: n Lerntage · Montag beginnt neu“. Das Wort „verfehlt“ gibt es nie (Cochran & Tesser 1996).
- **Gleichwertigkeit mit der Serie:** Eine abgeschlossene ISO-Woche mit ≥ 6 Pflichttagen lässt die Serie nicht reißen, mit ≤ 5 reißt sie. Wochenziel und Serie können sich also nie widersprechen (Kap. 2 Nr. 2).

**Datenquelle:** neu `weekGoal(input): { done: number; goal: 6; reached: boolean; possible: boolean; rest: string | null }` in `src/domain/metrics/streak.ts`. Sie nutzt nur `weekStrip`.
**Daten:** keine.
**Beleg:** Sharif & Shu (hartes Ziel mit Wochenreserve); Lally u. a. 2010; Cochran & Tesser 1996.
**Aufwand:** S.
**Abnahme:**
- Unit: alle 128 Muster einer Woche (2⁷) → `reached` genau dann, wenn die Serie die Woche überbrückt.
- E2E: Kartenfuß = Selektor; ein Sonntag mit 6 erledigten Tagen zeigt „Woche geschafft“; ein Extra-Tag erhöht die Zahl nicht.

### 4.6 Meisterschaft je Muster und Wortgruppe (Neu · Lernt · Sicher · Fest)

**Bildschirm:**
- **Ein** Bild für alles: das Meisterschaftsband mit 4 Segmenten und Zahlen, in denselben Farben wie der Grammatik-Pfad (`src/features/progress/GrammarSegment.tsx:19`). Es steht bei den Mustern je Thema (LP2 §5.5), bei den Themen je Kapitel (EE §5.4) und bei den Wortgruppen.
- Handy, Wörter-Reiter: die Karte „Deine Wortgruppen“ mit 7 Zeilen, zum Beispiel „Wortpartner · Fest 12 · Sicher 20 · Lernt 31 · Neu 38 (von 101)“. Antippen startet eine Extra-Runde nur dieser Gruppe.
- Laptop: zwei Spalten, Band und Zahlen nebeneinander.

**Regel:**
- **Wortgruppen sofort baubar:** die 7 Kategorien des C1-Pakets. Heute gibt es dort Wortpartner 101, Satzrahmen 90, Wörter 80, Fachbegriffe 64, Phrasal Verbs 45, Wortfamilien 33 und Redewendungen 30, zusammen 443 [M, `src/content/c1/pack.json`].
- Eine Karte gehört zur Gruppe über `origin.ref = 'c1pack/<id>'` (`src/domain/c1pack/pack.ts:23`, `:86`). „Neu“ heißt dabei: Die Karte ist noch nicht angelegt oder hat den Zustand `new`.
- Sobald C1P das Feld `ch` liefert (C1P §3.2), kommt die Ansicht „nach Kapitel“ dazu.
- „Fest“ darf sinken (Lapse). Das wird ehrlich gezeigt, am Rundenende als Satz: „2 Wörter wieder auf Lernt, sie kommen morgen.“ Es gibt dafür nie Rot.
- Bei Mustern gilt die Rückfallregel aus LP2 §4.9: zwei falsche Antworten in Folge.

**Datenquelle:**
- `unitState` (`src/domain/metrics/definitions.ts:33-38`) und `patternState` (LP2 §4.9).
- Neu `src/domain/metrics/groups.ts` → `groupMastery(groupId)`.
- **Neu `festUnits(cards)`** = Fest über `vocab/*` **und** `chunk/*`. Das löst I7. Kopf des Fortschritts, Marken, C1-Kriterium K4 und Wochenrückblick lesen nur diese Funktion; die Anzeige heißt „Wörter und Wendungen fest“.

**Daten:** keine neuen Felder für die Gruppen. Für den Verlauf kommt im Tagesbild das ergänzende Feld `history[].vu` (Fest nach `festUnits`) dazu. `va` behält seine alte Bedeutung (nur `vocab`, Kap. 9 Regel 2: alte Felder bleiben die Wahrheit). „+n in 28 Tagen“ wechselt erst auf `vu`, wenn 28 Tage davon vorliegen.
**Beleg:** Kap. 7 („ruhige Beherrschungsanzeige je Thema“); Bandura & Schunk 1981; Reifeanzeige je Wort nach Vocabulary.com/Clozemaster (06-marktvergleich M6).
**Aufwand:** M.
**Abnahme:**
- Die Summe der vier Zustände ist gleich der Gruppengröße.
- Die Fest-Zahl ist an Kopf, Marke, Zielzeile und Wochenrückblick gleich (Invarianten-Test).
- Die Umstellung `va` → `vu` erzeugt keinen Sprung in „+n in 28 Tagen“ (Unit mit Verlauf über den Umstellungstag).

### 4.7 Rundenabschluss: Wachstum statt Antwortzahl

Baut auf LP2 §5.4/§5.6 (`SessionEnd mode="growth"`) und EE M6 auf. Dieses Element legt den **Inhalt** und seine Reihenfolge fest.

**Bildschirm (Handy, von oben):**
1. Titel („Wörter geschafft“).
2. **Was aufgestiegen ist**, mit Namen (höchstens 6 Chips): „Neu sicher: comply with, phase out“ bzw. bei Grammatik die wandernden Musterpunkte (LP2 §5.4).
3. Ist nichts aufgestiegen, steht hier die **Gedächtnis-Zeit**: „Diese 28 Wörter hältst du jetzt länger: nächste Wiederholung im Schnitt in 9 statt 4 Tagen (geschätzt).“
4. Fehler: „3 Wörter kommen morgen wieder“ (antippbare Chips, LP2 §5.6).
5. Nur bei einem schweren Block (< 60 % bei ≥ 8 Antworten): „Schwerer Block, bei neuen Strukturen normal. Die Fehler kommen morgen kurz wieder.“ (03-lernmodell §6).
6. ActionBar „Weiter: Grammatik“.

„18 von 22 richtig“ steht nur noch als kleine graue Zeile, nie als Kachel oder als große Zahl (ersetzt `SessionEnd.tsx:47-51`).
Laptop: Punkte 2–4 in zwei Spalten.

**Regel Gedächtnis-Zeit:**
- Nur Karten im FSRS-Zustand „Review“ mit ihrer ersten Antwort des Tages in dieser Runde.
- vorher = `due_vorher − last_vorher`, nachher = `due_nachher − Antwortzeit`, je in Tagen. Gezeigt werden die Mediane.
- Die Zeile erscheint nur, wenn n ≥ 5 und der Median nachher > Median vorher. Sonst entfällt sie.
- Die Zeile ist als „geschätzt“ markiert, denn die Werte kommen aus dem FSRS-Modell.

**Datenquelle:** neu `src/domain/metrics/round.ts` → `roundGrowth(before: TrainCard[], after: TrainCard[]): { up: { id; to: UnitState }[]; memory: { n; before; after } | null; down: number }`. Die Runde hält den Stand vom Start; der Stand danach ist live.
**Daten:** keine.
**Beleg:** Amabile & Kramer 2011 (kleine echte Fortschritte); Hattie & Timperley 2007 (Rückmeldung auf Aufgaben- und Vorgehensebene).
**Aufwand:** M (in LP2 P6/P5 eingehängt).
**Abnahme:**
- Unit: `roundGrowth` mit Fixtures (Lernschritt-Karten zählen nicht; n < 5 → `null`).
- E2E: Das Rundenende hat keine Kachel „x/y“; jede gezeigte Zahl gleicht dem Selektor.
- Textregel-Test grün.

### 4.8 Tagesabschluss: Was zur Abschlusskarte dazukommt

LP2 §5.10 und EE M7 bauen die Karte. Hier steht nur, was dazukommt, und die Obergrenze:
- Unter Ring und großer Zahl stehen höchstens **vier** Zeilen in fester Reihenfolge:
  1. Wahrheitszeile (vorhanden, `TodayScreen.tsx:299-303`);
  2. **entweder** der Meilenstein-Satz **oder** das nächste Ziel (§4.1);
  3. „Morgen um 7:30 · nach dem Kaffee · 28 Karten · 3 Fehlersätze“. Die Uhrzeit steht nur da, wenn eine Lernzeit gesetzt ist (§4.11);
  4. Wochenstreifen mit „Serie 12 · Woche geschafft“.
- Am ersten Tag nach einer Pause von ≥ 3 Lerntagen heißt die Überschrift „Erster Tag zurück“ statt „Fertig für heute“ (§4.10).

**Datenquelle:** wie die einzelnen Elemente. **Daten:** keine. **Aufwand:** S.
**Abnahme:** Bei 390 × 844 steht die Karte ohne Scrollen bis zum Wochenstreifen im Bild (Bildvergleich, drei Modi); kein Text kommt zweimal vor.

### 4.9 Wochenrückblick (montags)

**Bildschirm (Handy, von oben):** Erreichbar über das Montags-Band auf Heute (vorhanden, `TodayScreen.tsx:517-537`) und über Fortschritt › Rückblick.
1. KW und Zeitraum; Wochenstreifen; „6 von 6 · Woche geschafft“ bzw. „4 Lerntage“.
2. **Eine** große Zahl: „+31 fest“ (Wörter und Wendungen, Tagesbild Montag gegen Montag). Ist der Wert negativ: „−4 fest · nach einer Pause normal“.
3. **Neu fest** mit Namen (höchstens 12 antippbare Chips).
4. Grammatik: Muster neu sicher (Namen); Fehlersätze erledigt · wiederkehrend.
5. Behaltensquote der Woche gegen die Vorwoche, nur bei je ≥ 30 Antworten (`RETENTION_MIN_ANSWERS`, `vocab.ts:13`), sonst entfällt die Zeile.
6. Freiwillig: „2 Extra-Runden“ als neutraler Fakt, nicht als Ziel.
7. Claudes Text (vorhanden, `weekly-report@1`, einmal je Woche und Sprache, `WeeklyCard.tsx:71-95`). Die Diagnose „Was du verwechselst“ (KT T5) steht nicht hier, sondern ist nur verlinkt.
8. **Fokus für diese Woche** (MO2): zwei Karten zum Antippen und eine Textzeile „Die App entscheidet“ (Standard).
   - Vorschlag A: das häufigste Verwechslungspaar (KT T5 `confusion.ts`), sonst das schwächste Thema des aktuellen Kapitels.
   - Vorschlag B: die Wortgruppe mit den meisten „Lernt“ (§4.6).
9. **Für deinen Lehrer** (MO6): ein englischer Text aus einer festen Vorlage, ohne Claude, mit Kopier-Knopf, zum Beispiel: „This week I worked on mixed conditionals and inversion. Still tricky: *wish + past perfect* (e.g. ‚I wish the client sent …' → ‚had sent'). Could we practice this in our next lesson?“
10. Einsatz-Satz der Woche (§4.3).

Laptop: links 1–6, rechts 7–10.

**Regel:**
- Die Woche folgt dem Lerntag (Wechsel um 04:00 Uhr) und der ISO-Woche, so wie `weekly.ts:15-28`.
- Die Fokuswahl wirkt **erst ab dem nächsten Tagesplan**. Der Plan von heute bleibt eingefroren (Kap. 15, A7).
- Wirkung des Fokus:
  - Er belegt den Fokusplatz in Schritt 2. Den gibt es schon als `focusTopic`; er besetzt jeden 2. Platz (`src/domain/grammar/tasks.ts:165-168`, `:264-281`).
  - Er bestimmt die Reihenfolge im Blatt „Extra ›“.
  - Für diese Woche hat er Vorrang vor `assess.focus` (Claudes Fokus).
  - Ohne Wahl bleibt alles wie bisher.
- Ein Meilenstein, der länger als 7 Tage gewartet hat, wird hier ein Satz statt einer Karte (§3).

**Datenquelle:**
- `weekFacts` (`src/domain/progress/weekly.ts`) wird umgebaut: Das „Wort sitzt“ ab S ≥ 3 (`:61-73`, I10) fällt weg und wird ersetzt durch „neu Fest in dieser Woche“ über das Kartenfeld `ff` sowie „Muster neu sicher“ über `pats[id].s` (LP2 §8).
- Die große Zahl kommt aus `history[].vu` (§4.6). Fehlersätze kommen aus `errorSentenceStats` (`src/domain/metrics/grammar.ts:74-88`) mit Wochenfilter.
- Neu `weekFocusOptions()` in `src/domain/metrics/goals.ts`.

**Daten (nur ergänzend):**
- `ff` = erster Lerntag mit Zustand Fest, an `vocab/*` und `chunk/*`. Geschrieben wird es **im selben Schreibvorgang** wie die Wiederholung, die die Karte zum ersten Mal auf Fest hebt (`cardPatch`/`chunkPatch`, `src/domain/srs/applyReview.ts:153`, `:186`). Es wird nie gelöscht, auch wenn die Karte später zurückfällt. Karten, die schon vorher Fest waren, bekommen kein `ff` und erscheinen deshalb nicht als „neu“ (richtig so). 03-lernmodell §5 schlug dafür den Namen `act` vor; `act` ist im Profil schon belegt (`schemas.ts:137`), deshalb heißt das Feld `ff`.
- `app/profile.wf = [{ w: 'JJJJ-Www', a: string, t: number }]`, höchstens 12 Einträge.

**Beleg:** Dai u. a. 2014 (Montag als Neuanfang); Ryan & Deci 2000 (Wahl stärkt Autonomie); Hattie & Timperley 2007 (Aufgabenebene).
**Aufwand:** L.
**Abnahme:**
- Unit: Wochenfakten mit Fixture-Woche über die Zeitumstellung am 25.10.2026.
- Die Fokuswahl ändert den gespeicherten Plan von heute nicht (Unit mit eingefrorenem Plan).
- Ohne `sample` ist die Seite vollständig, nur ohne Claudes Text.
- Der Lehrer-Text ist rein englisch (Sprachtest); das Wort „verfehlt“ kommt nie vor.
- data-guard prüft `ff` und `wf` vor dem Zusammenführen.

### 4.10 Rückkehr nach einer Pause

Vorhanden und bleibt: die Bänder für 3–6 und 7–13 Lerntage, die Neustart-Woche ab 14 (`comeback.ts:33-47`), „Serie“ erst wieder ab der ersten Pflicht und der Meilenstein `overdue0`.

**Neu:**
1. Ab 7 Lerntagen Pause steht im Band bzw. auf der Willkommens-Karte eine Zeile **„Das ist noch da“**: „Von deinen 412 gelernten Wörtern sind voraussichtlich noch 371 da.“ Quelle sind `expectedKnown` und die Zahl gelernter Karten (`vocab.ts:33-37`), also dieselbe Quelle wie die Karte „Wie gut sitzt es?“ (`WordsSegment.tsx:62-94`).
2. Im Wochenstreifen der Rückkehrwoche heißen die Pausentage „kein Lerntag“ (grau), nie „nicht erledigt“ (I9).
3. Der erste Tag zurück bekommt auf der Abschlusskarte die Überschrift „Erster Tag zurück“. Die Wahrheitszeile zeigt, was das Überfällige getan hat („überfällig −12“, vorhanden).
4. Der nächste Montag ist ein Neuanfang: Das Wochenziel beginnt bei 0, der Wochenrückblick sagt „Neue Woche“.
5. Die Erinnerung von außen (§4.11) schweigt nach 2 Tagen ohne Pflicht. Am 3. Tag kommt **eine** Nachricht („Willkommen zurück, wann immer du magst: heute 15 Min. Neustart“), danach Ruhe bis zur nächsten Pflicht.

**Datenquelle:** `comebackGap`/`lastReturn` (`comeback.ts:26-77`), `expectedKnown`. **Daten:** keine.
**Beleg:** Silverman & Barasch 2023 (gerissene Serie nicht hervorheben); Dai u. a. 2014; Lally u. a. 2010; Sharif & Shu.
**Aufwand:** S.
**Abnahme:**
- E2E mit Seed „Pause 14 Tage“: kein „Serie“, kein „0“, kein „verloren“; die Zeile „noch … da“ gleicht `expectedKnown`; der Wochenstreifen enthält „kein Lerntag“ und nicht „nicht erledigt“.

### 4.11 Erinnerung ohne Push

**Ehrlich vorweg, was nicht geht:**
- Push aus der App ist ausgeschlossen (Kap. 3.1, `docs/auftrag.md:63`). Eine Benachrichtigungs-Schnittstelle gibt es im Vertrag nicht (`contract/`: `claude`, `db`, `sample`, `downloads`, `permissions`). Web-Push am iPhone setzt außerdem eine installierte Web-App voraus, die Kap. 3.1 ausschließt.
- Eine Kalenderdatei (`.ics`) zum Herunterladen geht ebenfalls nicht: Die Endung steht nicht auf der erlaubten Liste (`contract/downloads.d.ts:21-22`).

Was geht, in vier Wegen:

| Weg | Was Emrah tut / sieht | Bau | Aufwand | Priorität |
|---|---|---|---|---|
| **W1 Meine Lernzeit** (Umsetzungsvorsatz) | Einstellungen › Lernen: Uhrzeit und Anker („nach dem ersten Kaffee“ · „in der Bahn“ · „nach dem Mittag“ · „vor Feierabend“ · eigener Text ≤ 40 Zeichen). Abschlusskarte: „Morgen um 7:30 · nach dem Kaffee“ | `app/profile.ii = { t: 'HH:MM', cue: string }`, ergänzend; Text in i18n | S | muss |
| **W2 iPhone-Erinnerung selbst stellen** | Unter der Lernzeit die Zeile „Erinnerung im iPhone einrichten ›“. Ein Blatt mit genauen Tipps: Erinnerungen-App → ＋ Neue Erinnerung → Titel „Englisch 25 Min.“ → ⓘ → Datum und Uhrzeit → Wiederholen: Täglich → URL: Link aus der Safari-Adresszeile. Dazu der Hinweis, den Link per „Teilen › Zum Home-Bildschirm“ abzulegen. Das ist ein Lesezeichen, keine Installation. Ob claude.ai dabei nach der Anmeldung fragt, muss Emrah am Gerät prüfen [E] | nur Text, kein Code außer dem Blatt | S | soll |
| **W3 Claude-Routine „Lern-Erinnerung“** (MO4b) | Täglich 19:25 Uhr (Europe/Berlin) eine Nachricht aufs Handy, **nur** wenn die Pflicht des Lerntags offen ist. Nach 2 Fehltagen Ruhe, am 3. Tag eine Willkommens-Nachricht (§4.10). Texte aus einer festen Liste ohne Verlust-Framing | eine **neue, getrennte** Routine (die pausierte „Input des Tages (schlank)“ bleibt unberührt, A7 04.10.); jeder Lauf eine frische Sitzung, Benachrichtigung „push“; der Lauf liest `app/profile` der Live-App nur lesend und vergleicht `pflicht[Lerntag]` (Wechsel um 04:00 Uhr). **Ungeprüft [E]:** ob eine Routine-Sitzung auf die Artefakt-Datenbank zugreifen darf und ob ein Lauf ohne Nachricht enden kann („noteworthy“ entscheidet die Plattform). Deshalb 3 Tage Probelauf, bevor Emrah sich darauf verlässt | S + 3 Tage Probe | soll, nur nach „Ja, Erinnerung einrichten“ |
| **W4 Kalender über Claude** | Im normalen Claude-Chat: „Trag mir täglich 7:30 ‚Englisch 25 Min.‘ ein.“ Die Kalender-Verbindung legt einen Serientermin mit Hinweis an. Er erinnert auch an Tagen, an denen schon geübt wurde (weniger klug als W3) | kein App-Code | – | kann |

**Bewusst nicht:** ein Kalender-Link aus der App heraus (zum Beispiel ein Google-Kalender-Vorlagenlink mit `recur=RRULE:FREQ=DAILY`). Ob das eingebettete Artefakt neue Fenster öffnen darf, ist ungeprüft [E]. Es wäre außerdem der erste Link nach außen in der neuen App. Er kommt erst, wenn W2 und W4 nicht reichen.

**Beleg:** Gollwitzer & Sheeran 2006 (d = 0,65); Beshears u. a. 2021 (keine starre Uhrzeit als Bedingung); Auftrag Kap. 6.9 sah die Erinnerung ausdrücklich im Claude-Tagesauftrag vor (`docs/auftrag.md:182`).
**Abnahme:**
- W1: Die Lernzeit erscheint auf der Abschlusskarte, aber nie während der Pflicht; ohne gesetzte Lernzeit fehlt die Zeile.
- W3: 3 Probetage mit Protokoll (Tag mit Pflicht ohne Nachricht, Tag ohne Pflicht mit genau einer Nachricht). Erst dann meldet Emrah „läuft“. Abschalten: Routine löschen, ein Satz im Chat.

### 4.12 Rekorde und Abzeichen: Entscheidung je Kandidat

| Kandidat | Entscheidung | Grund |
|---|---|---|
| Serien-Rekord („längste Serie“) | **nein** | nicht gezeigt laut Gesamtkonzept 3.5 (`gesamtkonzept.md:123`); macht einen Bruch sichtbar (Silverman & Barasch 2023); kein Lernbezug |
| XP oder Punkte als Anzeige | **nein** | Belohnung fürs Mitmachen (d = −0,40, Deci u. a. 1999); `xp` wird weiter geschrieben, bleibt aber unsichtbar (03-lernmodell §5) |
| Liga oder Rangliste, auch gegen das eigene frühere Ich | **nein** | Hanus & Fox 2015; einziger Nutzer |
| Kapitel-Embleme (7 + C1-reif, EE M8) | **ja** | Beleg für Können, an eine Prüfung gebunden, selten (≈ 8 in 12–15 Monaten) |
| Wort-Marken 100 … 1.500 | **ja, als Satz bzw. Karte ohne Emblem** | nahe Teilziele; das Emblem bleibt Kapiteln vorbehalten, damit es Gewicht behält |
| „100 Tage dabei“, „1.000 Antworten“ | **nein** | belohnt Anwesenheit; Teilnahme-Abzeichen halfen nur schwächeren Lernenden (Abramovich u. a. 2013); Emrah ist auf B2 |
| C1-Check „über deinem Schnitt“ | **ja, eingeschränkt** | echter Test ohne Hilfe. Gezeigt nur, wenn der Wert mindestens 10 Prozentpunkte über dem Mittel der letzten drei Checks liegt; ein einzelner Check streut stark (C1P §4.2) [E] |
| Rekord der Behaltensquote | **nein** | Ziel ist der Korridor 85–93 % (`vocab.ts:12`); höher heißt nur mehr Wiederholarbeit |
| „Perfekte Runde“ (100 %) | **nein** | Zielkorridor 70–90 %; es würde das Meiden schwerer Aufgaben belohnen |
| Erstes Muster „Fest“ | **ja, als Zeile am Rundenende** (Stufe 2) | Zustandswechsel mit Lernbedeutung |

## 5 Messen, ob es wirkt

Es gibt nur einen Nutzer, also keinen A/B-Test. Möglich ist ein Vorher-Nachher-Vergleich: 4 Wochen Basis aus vorhandenen Daten, dann 4 Wochen mit dem System. Das ist ein schwacher Beleg, und die App sagt das auch so (MO-L1).

| Signal | Definition | Quelle | Regel nach 4 Wochen (feste Regel, keine neue Planungsrunde) |
|---|---|---|---|
| S1 Wochenziel-Quote | Anteil voller ISO-Wochen mit ≥ 6 Pflichttagen, letzte 8 Wochen | `app/profile.pflicht` über `weekGoal` | sinkt sie um ≥ 2 von 8 Wochen gegenüber der Basis: Emrah einen kürzeren Tag (`goalMin`) anbieten; die Serienregel bleibt |
| S2 Freiwillig-Quote | Anteil der Lerntage mit mindestens einem `ctx: 'xtra'` im Tagesprotokoll **nach** erledigter Pflicht. Das ist das klassische Maß „freie Wahl“ aus der Selbstbestimmungsforschung (Deci u. a. 1999) | `log/<tag>` (`logPatch.ts:27`) | sinkt sie um mehr als die Hälfte: Meilenstein-Karten auf Sätze zurückstufen und mit Emrah prüfen, ob die Pflicht zu lang geworden ist |
| S3 Rückkehr-Abstand | Median der Lerntage zwischen einer Lücke ≥ 3 und der nächsten Pflicht | `lastReturn` (`comeback.ts:64-77`) | über 4 Tage: Erinnerung W3 anbieten (falls nicht aktiv) |
| S4 Abbruchquote | Anteil abgebrochener Pflichtrunden (`partial`) | Tagesprotokoll | über 20 %: Rundenlänge mit LP2 prüfen |

**Datenquelle:** `motivationSignals()` in `src/domain/metrics/effect.ts`. Die Datei plant LP2 §4.9 für `learningEffect`; die Funktion kommt dort ergänzend dazu.
**Ansicht:** Fortschritt › Rückblick › „Messwerte dahinter“ (eingeklappt, LP2).
**Aufwand:** S.
**Abnahme:** Unit mit Seed-Verläufen; fehlen Daten, steht „noch keine Daten“ statt 0.

## 6 Daten

**Datenbank: kein neues Dokument, keine neue Sammlung** (A6.6, LP2 §8 Regel 1). Gelesen wird mit `looseObject` und `.optional()` (A6.16), geschrieben nur über `writer.transform` und nur bei Änderung.

| Feld (neu, ergänzend) | Ort | Schreibt | Grenze | Zweck |
|---|---|---|---|---|
| neue IDs in `ms` (`fest750`, `ch1`–`ch7`, `place`, `c1check1`, `c1ready`) | `app/profile.ms` (vorhanden) | `milestonePatch` (`dayStats.ts:88-93`) | ≤ 30 Schlüssel | Meilenstein einmal angekündigt, über alle Geräte |
| `ff` | `vocab/*`, `chunk/*` | `cardPatch`/`chunkPatch` im selben Schreibvorgang | 10 Zeichen | erster Fest-Tag (Wochenrückblick „neu fest“) |
| `history[].vu` | `app/profile.history` | `historySnapshot` (`history.ts:40-63`) | 1 Zahl je Tag, 120 Tage (`history.ts:30`) | Fest nach `festUnits`; `va` bleibt unverändert |
| `wf` | `app/profile` | Wochenrückblick | ≤ 12 Einträge | Wochenfokus |
| `ii` | `app/profile` | Einstellungen | < 100 Byte | Lernzeit und Anker |
| `used` (nur bei MO3) | `app/profile` | Wochenrückblick | ≤ 200 Einträge | „im Job benutzt“ |
| `u.nx` | gespeicherter Tagesplan | Planbau | ≤ 24 Zeichen | eingefrorene Kennung des nächsten Ziels |

**Nur im Browser** (Bequemlichkeit, Kap. 3.1): `lx:weeklyband:<w>` (vorhanden), `lx:moments-seen` (EE §11; heißt nur „Animation auf diesem Gerät abgespielt“).
**Im Bundle (Inhalt, keine Nutzerdaten):** `program.json.use` je Kapitel (§4.2); alle Texte in `src/i18n`.
**Regeln:**
1. `schemas.ts`: `profileSchema` bekommt `ii`, `wf`, `used` als optional; die Karten-Schemas bekommen `ff` als optional; `history` bekommt `vu`.
2. Seed (`npm run seed`) und Register werden ergänzt; Test „nichts gelöscht“ (Kap. 9).
3. data-guard prüft vor dem Zusammenführen von MO-P1, MO-P5 und MO-P7.
4. Größe von `app/profile`: + < 2 KB [E], weit unter 256 KiB.

## 7 Geräte

| Element | Handy (`touch`) | Laptop (`keys`) |
|---|---|---|
| Kartenfuß Serie · Woche | eine Zeile in der Tageskarte | gleich |
| Abschlusskarte | Ring, große Zahl, ≤ 4 Zeilen, Streifen (ohne Scrollen bei 390 × 844) | Ring links (200 px), Zeilen rechts (EE M7) |
| Nächstes Ziel | Abschlusskarte und Fortschritt-Kopf | zusätzlich die Karte „Stand“ neben Heute |
| Meilenstein-Karte | Vollbild-Blatt, ein Tipp schließt | mittige Karte, `Esc` schließt |
| Wochenrückblick | eine Spalte, Fokus als 2 große Karten (≥ 56 px) | zwei Spalten |
| Wortgruppen | Liste mit 7 Zeilen | Raster mit 2 Spalten |
| Lehrer-Text, Einsatz-Satz | Kopieren mit einem Tipp | gleich, dazu `C` als Taste |
| Lernzeit, Erinnerung | Einstellungen › Lernen; Blatt mit iPhone-Anleitung | gleich, Anleitung allgemein |

Gerät und Eingabeprofil wirken nie auf Serie, Wochenziel, Pflicht oder Ring (LP2 §8 Regel 6).

## 8 Abgleich mit anderen Plänen und dem Code

| Punkt | Stand | Entscheidung hier |
|---|---|---|
| Wort-Marken | Code 100/250/500/1.000/1.500 (`dayStats.ts:67`); C1P M9–M11 und EE M8: 250/500/750 | gemeinsame Liste 100 · 250 · 500 · 750 · 1.000 · 1.500 (MO5); 750 ist die Schwelle von C1-Kriterium K4 |
| Was „Fest“ zählt | Code nur `vocab/*` (`goal.ts:54`, `WordsSegment.tsx:23-24`); C1P K4: Wörter **und** Wendungen | `festUnits` (vocab + chunk) überall. Die Zahl springt einmalig nach oben. Dadurch sofort erreichte Marken werden still gemerkt, nicht gefeiert (§4.2) |
| „Einmal gezeigt“ | EE: `lx:moments-seen` je Gerät; Code: `app/profile.ms` | Die Datenbank entscheidet über die Ankündigung, das Gerät nur über die Animation |
| Kapitel geschafft | LP2 §2.7 „Erstes Kapitel komplett sicher“; C1P M1–M7 = Prüfung bestanden | C1P (Beleg statt Zustand); der Zustand „alle Muster sicher“ ist der Weg zur Prüfung (nächstes Ziel, §4.1) |
| Wochenbericht „Wort sitzt“ | S ≥ 3 Tage (`weekly.ts:61-73`) | `ff` (Fest) und Zustände Neu · Lernt · Sicher · Fest |
| Wochenstreifen | gebaut, nirgends benutzt; „nicht erledigt“ | auf der Abschlusskarte und im Wochenrückblick; „kein Lerntag“ |
| Serie auf Heute | „Serie: 12 Tage“ (`de.ts:242-243`) | „Serie 12 · Woche 4 von 6“, weiterhin genau eine Stelle |
| Standardsegment Fortschritt | `'review'` (`ProgressScreen.tsx:78`) | LP2: `'words'` |
| Momente-Dauer | EE: bis 1,2 s, Entscheidung EE1 | unverändert; dazu das Budget aus §3 |
| Lernereignisse der Engine | EE §2.2 ohne Wochen-Ereignis | ergänzend `{ k: 'week'; facts: WeekFacts }`, Stufe 3, einmal je Woche und Gerät (Zahl rollt wie EE M6) |

## 9 Arbeitspakete

| Paket | Inhalt | Aufwand | hängt an | Abnahme |
|---|---|---|---|---|
| **MO-P1 Selektoren und Texte** | `festUnits`, `weekGoal`, `restInfo`, `nextGoal`, `groupMastery`, `roundGrowth`, `motivationSignals`; Texte DE/EN; `motivationText.test.ts`; Schemafelder `ii`, `wf`, `used`, `ff`, `vu` | M | LP2 P4 (`domain/metrics`) | Unit grün; Invarianten „eine Quelle“ grün; data-guard |
| **MO-P2 Heute** | Kartenfuß „Serie · Woche“, Zeilen der Abschlusskarte (§4.8), `WeekStrip` einhängen, Pausen-Texte (§4.10), „kein Lerntag“ | S | LP2 P7, EE E4 | E2E Heute in allen Tageszuständen; Textregel |
| **MO-P3 Rundenende Wachstum** | Inhalt §4.7 in `SessionEnd mode="growth"` | M | LP2 P5/P6 | E2E keine Kachel „x/y“; Zahlen = Selektor |
| **MO-P4 Meilensteine** | Katalog §4.2, Budget, `program.json.use`, 7 Job-Sätze + Prüfung durch `english-teacher`, Themen-Zeilen | M + S | C1P (`out`-Einträge), EE E8 | einmal je Meilenstein über zwei Tabs; Budget-Test |
| **MO-P5 Wochenrückblick** | §4.9 mit `ff`, Fokuswahl, Lehrer-Text, Einsatz-Satz | L | MO-P1, KT T5 (Vorschlag A, sonst Fallback) | §4.9 Abnahme; data-guard |
| **MO-P6 Wortgruppen** | Band und Liste §4.6 (Kategorien jetzt, Kapitel später) | M | MO-P1 | Summe = Gruppengröße; Fest-Zahl gleich überall |
| **MO-P7 Lernzeit und Anleitung** | W1, W2 (§4.11) | S | – | §4.11 Abnahme W1 |
| **MO-P8 Routine „Lern-Erinnerung“** | W3, **nur nach Emrahs „Ja, Erinnerung einrichten“** | S + 3 Tage Probe | MO-P7 (`ii.t` als Uhrzeit) | 3-Tage-Protokoll |
| **MO-P9 Messung** | §5 und die Ansicht unter „Messwerte dahinter“ | S | MO-P1 | Unit; „noch keine Daten“ statt 0 |

**Reihenfolge für den ersten Test-Link:** MO-P1 → MO-P2 → MO-P3 (das sieht Emrah täglich), dann MO-P7, MO-P5, MO-P6, MO-P4 (hängt an C1P), MO-P9; MO-P8 nur auf Zuruf.
Zusammen ≈ 8–10 Bautage [E], parallel zu LP2-Welle 2. Die Besitzregeln für Dateien gelten wie in LP2 §10.3.

## 10 Abnahme gesamt

1. **Eine Quelle:** Serie, Wochenziel, Fest-Zahl, nächstes Ziel und Gruppenstände sind auf Heute, Wörter, Grammatik, Fortschritt und im Wochenrückblick für denselben Stand gleich (Invarianten-Test über Seed-Daten).
2. **Serienregel unverändert:** `computeStreak` liefert für alle bestehenden Fixtures dieselben Werte. Wochenziel und Serie widersprechen sich in keinem der 128 Wochenmuster.
3. **Kein Verlust-Framing:** Der Textregel-Test ist grün; „Serie 0“, „verloren“, „verfehlt“ und „nicht erledigt“ kommen in keinem Zustand vor (E2E-Textsuche über Heute, Fortschritt und Wochenrückblick, DE und EN).
4. **Können statt Anwesenheit:** Kein Moment der Stufe 2–4 hat Tage, Antworten oder Minuten als Auslöser (Unit über den Meilenstein-Katalog).
5. **Budget:** ≤ 1 Meilenstein-Karte je Sitzung, ≤ 2 je ISO-Woche (Testuhr über 14 Tage mit erzwungenen Meilensteinen).
6. **Pflicht und Extra getrennt:** Extra-Runden ändern weder Ring noch Serie noch Wochenziel (E2E).
7. **Daten:** data-guard ohne Befund; nur die Felder aus §6 sind neu; Seed-Umstellungstest „nichts gelöscht“ grün.
8. **Barrierefreiheit und Modi:** axe 0 in Dunkel, Gedämpft und Hell; jedes Band und jeder Ring hat einen Vorlesetext mit denselben Zahlen.
9. **Emrahs Rundgang:** am iPhone auf dem Test-Link mit „Momente ansehen“; erst nach seinem „Ja live nehmen“ geht es live.

## 11 Was nicht geht (ehrlich)

- **Push aus der App:** nein (Kap. 3.1; keine Schnittstelle im Vertrag; Web-Push am iPhone nur für installierte Web-Apps). Ersatz: §4.11.
- **Kalenderdatei:** `.ics` ist für `downloads` nicht erlaubt (`contract/downloads.d.ts:21-22`).
- **Vibration am iPhone:** nein (EE §7). Echte Videos und Figuren: nein (EE §10, C1P §6).
- **Sozialer Antrieb durch andere Lernende:** Es gibt nur einen Nutzer. Eingebundenheit entsteht über Lehrer, Job und Claude, nicht über Vergleich.
- **Ursache-Wirkung beweisen:** Mit einem einzigen Nutzer geht das nicht. §5 liefert Hinweise, keinen Beweis.
- **Routine mit Datenbankzugriff:** ungeprüft. Ohne Zugriff erinnert die Routine nur ohne Prüfung der Pflicht, also ähnlich wie W4.

## 12 Risiken

| Risiko | Gegenmittel |
|---|---|
| Belohnungen wuchern mit der Zeit („noch ein Abzeichen“) und kippen in Kontrolle | Leitsätze MO-L2/L4, Entscheidungstabelle §4.12, Textregel-Test |
| Zu viele Momente lenken vom Lernen ab | Budget §3; EE-Standard „Ruhig“; Signal S2 |
| Die Fest-Zahl springt bei `festUnits` | stille Marken; `vu` neben `va`; Hinweis einmal im Fortschritt („zählt jetzt Wendungen mit“) |
| Die Fokuswahl greift in den Plan ein | nur ab dem nächsten Plan; Unit mit eingefrorenem Plan; ohne Wahl bleibt alles wie heute |
| Die Prognose frustriert (C1 in 12–15 Monaten) | nur Zeiträume, erst ab 21 Tagen Daten, nie als Countdown; Begründung „am längsten dauern die aktiven Wörter“ (C1P §4.5) |
| Die Routine nervt oder schweigt unbemerkt | 3 Probetage, höchstens 1 Nachricht am Tag, Ruhe nach 2 Fehltagen; Abschalten mit einem Satz |
| Das Schreiben von `ff` erzeugt Fehler | nur im ohnehin laufenden Schreibvorgang; data-guard; ohne `ff` fehlt nur die Namensliste, keine Zahl |
| Job-Sätze sind sprachlich falsch | Prüfung durch `english-teacher` vor dem Bau; US-Schreibweise im Sprachtest |
| Emrah fühlt sich nach einer Pause schuldig | §4.10; Texte nie in der Du-hast-Form (Silverman & Barasch 2023: eigene Schuld verstärkt den Abbruch) |

## 13 Quellen

| Kürzel | Quelle | Status |
|---|---|---|
| ryan-deci | Ryan & Deci (2000): Self-determination theory and the facilitation of intrinsic motivation, social development, and well-being. American Psychologist 55(1), 68–78 | S |
| deci99 | Deci, Koestner & Ryan (1999): A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. Psychological Bulletin 125(6), 627–668 | S |
| sailer | Sailer & Homner (2020): The gamification of learning: a meta-analysis. Educational Psychology Review 32, 77–112 | S |
| hanus | Hanus & Fox (2015): Assessing the effects of gamification in the classroom. Computers & Education 80, 152–161 | S |
| silverman | Silverman & Barasch (2023): On or Off Track: How (Broken) Streaks Affect Consumer Decisions. Journal of Consumer Research 49(6), 1095–1117 | S |
| sharif | Sharif & Shu: Emergency reserves (UCLA Anderson Review, mit Studiendaten) | Q |
| lally | Lally u. a. (2010): How are habits formed. European Journal of Social Psychology (UCL-Meldung) | S |
| gollwitzer | Gollwitzer & Sheeran (2006): Implementation intentions and goal achievement: A meta-analysis. Advances in Experimental Social Psychology 38, 69–119 | S |
| dai | Dai, Milkman & Riis (2014): The Fresh Start Effect. Management Science 60(10) | S |
| kivetz | Kivetz, Urminsky & Zheng (2006): The Goal-Gradient Hypothesis Resurrected. Journal of Marketing Research 43(1) | S |
| nunes | Nunes & Drèze (2006): The Endowed Progress Effect. Journal of Consumer Research 32(4), 504–512 | S |
| bandura | Bandura & Schunk (1981): Cultivating competence, self-efficacy, and intrinsic interest through proximal self-motivation. JPSP 41(3) | S |
| kluger | Kluger & DeNisi (1996): The effects of feedback interventions on performance. Psychological Bulletin 119(2) | S |
| hattie | Hattie & Timperley (2007): The power of feedback. Review of Educational Research 77(1), 81–112 | S |
| amabile | Amabile & Kramer (2011): The Progress Principle. Harvard Business Review Press | S |
| alhoorie | Al-Hoorie (2018): The L2 motivational self system: A meta-analysis. Studies in Second Language Learning and Teaching 8(4), 721–754 | S |
| duolingo | Duolingo Blog: How the streak builds habit (3,6×, +0,38 %, Serienschutz) | Q (Firmenangabe) |
| beshears | Beshears, Lee, Milkman, Mislavsky & Wisdom (2021): Creating Exercise Habits Using Incentives. Management Science 67(7), 4139–4171 | S |
| cochran | Cochran & Tesser (1996): The „What the Hell“ Effect. In: Martin & Tesser (Hg.), Striving and Feeling | S |
| abramovich | Abramovich, Schunn & Higashi (2013): Are badges useful in education? ETR&D 61(2), 217–232 | S |
| sundararajan, oulu | über `erlebnis-engine.md` §15 bzw. `06-marktvergleich.md` §8 | dort |
| gcal | Google-Kalender-Vorlagenlink, Parameter `recur` (nur zur Begründung von „bewusst nicht“) | S |

[ryan-deci]: https://doi.org/10.1037/0003-066X.55.1.68
[deci99]: https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf
[sailer]: https://link.springer.com/article/10.1007/S10648-019-09498-W
[hanus]: https://doi.org/10.1016/j.compedu.2014.08.019
[silverman]: https://udspace.udel.edu/handle/19716/34160
[sharif]: https://anderson-review.ucla.edu/emergency-reserves/
[lally]: https://www.ucl.ac.uk/news/2009/aug/how-long-does-it-take-form-habit
[gollwitzer]: https://kops.uni-konstanz.de/entities/publication/2e749bfb-8533-437c-8203-7e788c910c5f
[dai]: https://faculty.wharton.upenn.edu/wp-content/uploads/2014/06/Dai_Fresh_Start_2014_Mgmt_Sci.pdf
[kivetz]: https://business.columbia.edu/sites/default/files-efs/pubfiles/1200/goalgradient.pdf
[nunes]: https://ideas.repec.org/a/oup/jconrs/v32y2006i4p504-512.html
[bandura]: https://uploads-ssl.webflow.com/59faaf5b01b9500001e95457/5bc552d85141987915dab842_Bandura%20&%20Schunk,%201981.pdf
[kluger]: https://scholars.huji.ac.il/node/1802
[hattie]: https://www.uky.edu/~gmswan3/575/Hattie_Timperly_2007.pdf
[amabile]: https://www.goodreads.com/book/show/14596646
[alhoorie]: https://pressto.amu.edu.pl/index.php/ssllt/article/view/12295
[duolingo]: https://blog.duolingo.com/how-duolingo-streak-builds-habit
[beshears]: https://ideas.repec.org/a/inm/ormnsc/v67y2021i7p4139-4171.html
[cochran]: https://www.routledge.com/Striving-and-Feeling-Interactions-Among-Goals-Affect-and-Self-regulation/Martin-Tesser/p/book/9780805820393
[abramovich]: https://www.lrdc.pitt.edu/Schunn/papers/Abramovich-Schunn-Higashi.pdf
[gcal]: https://github.com/InteractionDesignFoundation/add-event-to-calendar-docs/blob/master/services/google.md
