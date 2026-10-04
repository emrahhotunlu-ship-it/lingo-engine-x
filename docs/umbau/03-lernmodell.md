# 03 – Lernmodell, Sitzung, Fortschritt (Fokus Wortschatz + Grammatik)
Stand 04.10.2026 (Code-Stand 31a5975 laut `docs/umbau/00-code-statistik.md`) · learning-scientist, nur gelesen. Belege = `Datei:Zeile`, Pfade relativ zu `/home/user/lingo-engine-x`. **Vorschlag** = neu, **Vermutung** = nicht gerechnet oder gemessen.
**Urteil:** Die Wort-Seite trägt (FSRS, Leiter, Rückstand-Steuerung, Aufdecken mit Kontrolle). Die Grammatik-Seite ist ein zweites, schwächeres System (BKT + Leitner, keine Einführung, Löcher in der Fehlerschleife), und gleiche Begriffe haben mehrere Definitionen. Strategisches Risiko: das Ziel „8.000 Wörter“ ohne Lesen/Hören (1.5).
## 1 Einheitliches Lernmodell
### 1.1 Einheiten und Planer
- **Wort/Wendung** (`vocab/*`, `chunk/*`): FSRS, Ziel-R 0,9, Max 365 d, Schritte 1/10 min (`srs/scheduler.ts:9-16`) + Leiter `stage` 1–5 (`srs/ladder.ts:33-44`). Bleibt.
- **Grammatikthema** (16 + 7 C1, `grammar/<id>`): gedämpftes BKT p, ±0,06 je Antwort, ±0,12 je Tag (`grammar/bkt.ts:16-17,64-77`), eigenes `due` 1–21 d (`:80-83`). Bleibt.
- **Fehlersatz** (`grammar/<id>.errors[]` und `app/repair.items[]`): Leitner 1/3/9 d, FSRS nur als Schatten (`grammar/errors.ts:11-19,82`, `repair/repair.ts:12`). **Vorschlag:** FSRS steuert wie bei Wörtern (Kap. 5 verlangt es); `box/due/done` bleiben gespiegelt (Rückweg alte App, Kap. 9).
### 1.2 Zustände – abgeleitet, nie gespeichert (`unitState(einheit, jetzt)`, rein; heute nur für Wörter: `srs/confidence.ts:18-31`)
| Zustand | Wort / Wendung | Grammatikthema (`certainty`, `bkt.ts:92-109`) | Fehlersatz |
|---|---|---|---|
| Neu | `fsrs.state = New` | n = 0 | nie wiederholt |
| Lernend | Lernschritt/Wiederlernen, oder S < 7 d, oder Stufe ≤ 3, oder R < 0,7 (nach ≥ 1 Tag) | p ≤ 0,6 oder n < 4 | S < 7 d |
| Sicher | Stufe ≥ 4 ∧ S ≥ 7 d ∧ R ≥ 0,7 (= `confidenceOf ≥ 3`) | 0,6 < p ≤ 0,8 | S ≥ 7 d |
| Gefestigt = „aktiv“ | Stufe ≥ 4 ∧ S ≥ 21 d ∧ Review (`srs/retention.ts:54`) | p > 0,8 ∧ n ≥ 15 ∧ Belege an ≥ 3 Lerntagen (**Vorschlag**) | S ≥ 21 d (statt „erledigt nach 3 Erfolgen“, `errors.ts:74`) |

**Übergänge:** Aufstieg nur durch Antworten: Stufe höchstens +1 je Karte und Lerntag (`srs/applyReview.ts:130-137`), Aufdecken hebt höchstens bis Stufe 2 (`srs/flip.ts:143-148`). Abstieg: Note 1 → FSRS-Lapse und Stufe −1 (`ladder.ts:42`), dadurch fast immer „Lernend“; Thema: Rückfall erst 0,05 unter der Aufstiegsgrenze (**Vorschlag**, gegen Flackern). Ohne Üben sinken nur R („erwartet gekonnt“) und die Anzeige-p (`displayP`, 45 d, `bkt.ts:36-40`); ein Zustand wird nie gespeichert oder rückwirkend umgeschrieben.
### 1.3 Eine Definition je Begriff
| Begriff | Definition | Code heute → Änderung |
|---|---|---|
| fällig | nicht Neu ∧ nicht ausgeblendet ∧ `due < learningDayEnd(jetzt)` (04:00-Grenze), für alle Einheiten | Wörter passen (`srs/queue.ts:82-89`). Fehlersätze und Reparatur vergleichen auf die Millisekunde (`errors.ts:205`, `repair.ts:150`): abends angelegt, am nächsten Morgen nicht fällig → **ändern** |
| Rückstand | fällig seit ≥ 2 Lerntagen (`due < learningDayStart − 24 h`); Summe aus Wörtern, Wendungen, Fehlersätzen | heute „seit gestern“, nur Karten (`unit/backlog.ts:24-29`): ein erlaubter Ruhetag (A7) kann schon die Bremse auslösen (Vermutung, bei > 15 Fälligen je Tag) → **ändern**; Schwellen 15 (Bremse) und 40 (Aufholmodus) bleiben (`backlog.ts:18,65`) |
| sicher | Zustand ≥ Sicher | `retention.ts:57` passt; sonst gibt es drei Schwellen für „sicher/fest“ → ein Wort, eine Funktion |
| aktiv | Zustand Gefestigt | `retention.ts:54` passt; `byState.mature` (`:49`, nur S ≥ 21, ohne Stufe) streichen |
| Dauerfehler, schwach | Dauerfehler: Lapses ≥ 5, höchstens 3 je Runde (`queue.ts:201-209`); schwach: Lapses ≥ 2 | heute Dauerfehler bei 3 (`progress/measures.ts:42`, `assessment/sources.ts:218`), 5, 6 (`srs/decks.ts:22`); schwach bei 2 (`unit/phrases.ts:25`) → vereinheitlichen |

### 1.4 Planer: Kapazität nach Rückstand (Neues = Wörter + Themen)
| Rückstand | neue Wörter/Wendungen | neues Thema | Block 1 | Modus |
|---|---|---|---|---|
| 0 | min(Kontingent, `capacityNew` = ⌊(720 s − Last)/140 s⌋, also 2–5; Last = max(heute, Ø 7 Tage) × 20 s; `backlog.ts:58-61`, `unit/review.ts:52-63`) | 1 je 3 Lerntage; nie bei ≥ 10 fälligen Fehlersätzen (**Vorschlag**) | 8 Min. | normal |
| 1–14 | wie ruhiger Plan, kein Bonus (`review.ts:42-49`) | wie Zeile 0 | + 8 s je Karte, höchstens + 50 % (`backlog.ts:32-36`) | normal |
| 15–39 | 2 (Untergrenze, Kap. 15) | nein | ≤ 12 Min. | normal |
| ≥ 40 | 2 | nein | ≤ 12 Min. | reife Karten (S ≥ 7) aufdecken, jede 4. tippen (`backlog.ts:65-69`) |

15 Min. (`week/plan.ts:35`) ist die absolute Obergrenze und wird bei + 50 % (= 12 Min.) nie erreicht. Reihenfolge in Block 1: Lernschritte, dann niedrigste R (`queue.ts:82-89`); Wochenthema zuerst, ab 15 Fälligen höchstens ⅓ der Plätze (`week/review.ts:14-26`); Neue an Stelle 2, 5, 8 … (`:97`); Dauerfehler ≤ 3. Fehlersätze: ≤ 3 in Block 2 (`grammar/tasks.ts:174`) und ≤ 3 in Block 5 (`repair/unit.ts:240`). Regelkreis (**Vorschlag**): Behaltensquote K3 über 28 d > 0,93 → `request_retention` 0,88; < 0,85 → 0,92 (`scheduler.ts:10`).
### 1.5 Entscheidung nötig: „8.000 Wörter“
Modellrechnung (Annahme: 40 s neu + 8 s je Aufdecken laut `srs/cost.ts:15-16`, ≈ 7 Wiederholungen im 1. Jahr): 12 Min./Tag tragen ≈ 2.700 Einheiten/Jahr nur im Erkennen-Modus, ≈ 1.400–1.700 mit voller Leiter (`docs/wortschatz-plan.md:6-7`). Die 8.000 waren dort passives Verstehen; der Rest sollte aus Lesen/Hören (Antippen → Karte) kommen – das entfällt nun.
Optionen: (A) Ziel = 1.500–2.000 **aktiv** + passive Spanne aus dem Wortschatztest (`vtest/score.ts:43-78`), „8.000“ nie als Kartenzahl; (B) zusätzlich Passiv-Spur (nur Aufdecken EN→DE, ≤ 6 neue/Tag, ohne Leiter, teilt das Wortschatz-Budget); (C) Antippen-Lesehilfe als Wortquelle behalten. **Empfehlung A + B**; Emrah entscheidet.
## 2 Sitzung (Wunsch 25–30 Min.; Plan `week/plan.ts:31,83-104`)
| Block | Min. | Inhalt und Regel |
|---|---|---|
| 1 Wortschatz | 8 (≤ 12 bei Rückstand) | Fälliges + 2–5 Neue eingestreut; bis Stufe 2 aufdecken, ab 3 tippen (`srs/flip.ts:100-111`) |
| 2 Grammatik | 7 | ≤ 3 fällige Fehlersätze zuerst, dann 3–6 Aufgaben aus ≥ 3 Themen, nie 3 gleiche hintereinander (`grammar/tasks.ts:230-243,295-321`) |
| 3 Satzbau | 5 | nur Vollplan (Ziel > 20 Min.); wendet Wörter und Grammatik an |
| 5 Fehler korrigieren | 3 | fällige Fehlersätze früherer Tage, nie am Anlegetag (`repair/unit.ts:245-247`) |

- **Länge:** 23 Min. + Rückstand bis 4 + Nachschlagen ≈ 25–30; Kurzplan 5+5+2 (Ziel ≤ 20 Min.) bzw. 3+4+2 (≤ 10); Sonntag 5 + Wochen-Check 5. Der Plan (23) liegt unter dem Ziel (25): die Lücke füllen Nachschlagen und Übersetzer, sonst Block 1 auf 10 Min. (**Vorschlag**).
- **Reihenfolge** (Annahme; Evidenz für feste Blockfolge schwach): schneller Abruf zum Aufwärmen, dann die höchste Denklast, Anwenden, zuletzt Abruf nach Abstand. **Verschachtelt** wird innerhalb der Blöcke (Themen; Übungsarten, `srs/modes.ts:105-126`), nicht durch Zerhacken der Blöcke. Brücke (**Vorschlag**): Satzbau nimmt Sätze zu Themen aus Block 2 oder dem Wochenthema (`week/types.ts:133-143`).
- **Ermüdung** (**Vorschlag**): Block endet ruhig („Genug für jetzt, der Rest bleibt fällig“), wenn nach ≥ 12 Antworten die letzten 8 zu ≤ 50 % stimmen und die Median-Zeit ≥ 1,5 × der ersten 8 beträgt; Pausenangebot nach 12 aktiven Minuten (`vocab/session.ts:486-492`); unter 10 Antworten zählt nichts als erledigt (`:517`).
- **Wiedereinstieg** (Lücke g = Lerntage seit der letzten Pflicht). Heute nicht vorhanden: die Suche nach „Wiedereinstieg“ trifft nur das Fortsetzen von Übungen, Pausen regelt nur „+ 50 % Zeit“ (`backlog.ts:32-36`):
  - g ≤ 2: normal; Fälligkeiten laufen weiter, nichts wird verschoben.
  - g 3–6: ruhige Begrüßung („Willkommen zurück, heute zuerst das Fällige“), Neue = 2, Block 1 ≤ 12 Min. nach niedrigster R.
  - g 7–13: zusätzlich Grammatik 3 statt 6 Aufgaben; Satzbau entfällt, bis der Rückstand < 40 ist.
  - g ≥ 14 „Neustart-Woche“: Ziel 15 Min., Block 1 bis 15 Min. (Deckel + 50 % → + 90 %, nur in dieser Woche), Neue = 2, kein neues Thema, reife Karten (S ≥ 21) zuletzt. Nie Vorwurfstexte, nichts wird gelöscht.
- **Ruhetag:** wie A7 (1 je ISO-Woche, nicht angespart, `streak.ts:44-79`); der Wochenstreifen zeigt ihn als „Ruhetag“ (`progress/weekDots.ts`).
## 3 Grammatik-Lernweg
**Urteil zu `docs/lernpfad-plan.md`:** trägt für freies Sprechen/Schreiben, nicht für Grammatik. (1) Stufe 1 „Vorbild“ ist Einführung, keine Übungsstufe; Stufe 3 „Satzanfänge“ stützt mehrsätzige Antworten, nicht Regelaufgaben; Stufe 5 „Uhr“ erzieht bei Grammatik zu Tempo statt Genauigkeit. (2) „≥ 6 Versuche je Stufe“ (`:19-20`) × 4 Wechsel dauert bei ca. 2 Aufgaben je Thema und Besuch alle 4–8 Tage etwa 2–3 Monate je Thema (Vermutung; 6 Aufgaben je Runde, `week/plan.ts:33`, 23 Themen). (3) Die Formsteuerung nach p gibt es schon (`tasks.ts:136-144`: p < 0,4 mc/gap mit Platzhalter, ≤ 0,7 gap/transform, sonst correct/transform); `app/levels` würde sie doppeln. → **p steuert die Form**; `levels` nur für freiwilliges Sprechen.
| Schritt | Inhalt | Wechsel-Kriterium |
|---|---|---|
| 1 Erklären (neues Thema, 1×, ≤ 90 s) | Kernregel, Kontrast Deutsch → Englisch, 3 Beispiele (`grammar/rules.ts:86-101`, `examplesFor`) | gesehen; Regel bleibt für die ersten 3 Aufgaben offen (heute nur zugeklappt „Kurz erklärt“, `GrammarItem.tsx:420-426`) |
| 2 Erkennen, gelenkt | mc + gap mit Platzhalter (p < 0,4) | p ≥ 0,45 ∧ von den letzten 3 ≥ 2 richtig |
| 3 Gelenkt produzieren | gap ohne Hilfe, transform (0,4–0,7) | p ≥ 0,75 ∧ von den letzten 3 ≥ 2 richtig |
| 4 Frei | correct/transform ganzer Satz, dazu Satzbau (> 0,7) | Zustand Gefestigt (1.2) |
| 5 Fehlerschleife | jeder Fehler → Fehlersatz → Wiederholung als Satzkorrektur | S ≥ 21 d |

- **Rückstufung:** p fällt 0,05 unter die Grenze oder 3 Fehler in Folge → nächste Aufgabe eine Form leichter (nur in der Runde, nicht gespeichert).
- **Neue Themen:** Einführung (Schritt 1) höchstens 1 je 3 Lerntage. Welches: das Werkzeug der Woche (`WeekTargets.tool`; **Vorschlag:** als Fokus-Thema an Block 2 übergeben, es belegt jeden 2. Platz wie `focusTopic`, `tasks.ts:249-270`), sonst der größte Bedarf (`:178-192`). Alle 23 Themen starten bei p0 0,3–0,6 (`grammar.json`, `toolkit.json`) = Lernend; „Gefestigt“ braucht ≥ 4 Besuche an verschiedenen Tagen (Tagesband ±0,12). Vorrat: ≈ 5–6 Aufgaben je B2-Thema (48 Start + 32 Fallen + 9 Extras / 16, `tasks.ts:111-134`), danach wiederholt `anySeed` dieselben Sätze (`:223,283-293`) → Ziel ≥ 12 je Thema, nachts vom Tagesauftrag nachgeliefert (`daily/*`) statt nur per Knopf (`grammar/generate.ts:18-21`).
- **Fehlersätze kehren wieder:** jeder falsche erste Versuch **und** „Weiß nicht“ erzeugt genau einen Eintrag (heute nicht: `grammar/write.ts:72`; die Aufgabe wird trotzdem `seen`, `:65`, und kommt nie zurück); Wiederholung per FSRS (≈ +1, +3, +9 d …); ab der 2. Wiederholung eine ungesehene Variante gleichen Typs (`tasks.ts:238-243`, passt); der Deckel von 10 je Thema darf nur Erledigte verdrängen (`errors.ts:20,41-47` verdrängt auch Offene).
## 4 Feedback und Einstufung
- **Einheitliche Rückmeldung** (feste Reihenfolge, auch bei richtig): (1) Aufgabe, eine Zeile oben · (2) Wozu, nur hinter dem Info-Symbol · (3) Du/Richtig Wort für Wort + „Auch richtig“ · (4) Warum: Regel in 1 Satz + 2–3 Beispiele; bei Wörtern Wortart, typische Verbindung/Präposition, bei Auswahl wozu die falsche Option gehört (`Option.fromWord`, `srs/types.ts:94`). **Befund:** Auto-Weiter nach 1,2 s bei „richtig ohne Hilfe“, Standard an (`learn/ui.tsx:171,194-198`, `vocab/ExerciseView.tsx:843`, `GrammarItem.tsx:396`) – (4) blitzt nur auf. → aus, oder erst nach ≥ 4 s und nur ab Stufe 4.
- **Hinweisleiter** (alle Typen): H0 keine · H1 Tipp (Wortart + Bedeutung bzw. Platzhalter) → Note ≤ 3 · H2 zweiter Tipp (1. Buchstabe) oder automatisch nach falschem 1. Versuch, genau ein zweiter Versuch (`GrammarItem.tsx:131-137`) → Note ≤ 2, für BKT und Fehler „falsch“ (`write.ts:34-35`) · H3 Lösung/„Weiß nicht“ → Note 1 + Fehlersatz.
- **Selbstbewertung nur beim Aufdecken:** Wörter/Wendungen Stufe ≤ 2, Stapel-Modus „Aufdecken“, Aufholmodus; 4 Knöpfe, App-Vorschlag hervorgehoben, „Nochmal“ nie vorgeschlagen (`flip.ts:129-137`); jede „Leicht“-Karte wird bei Fälligkeit frei getippt (`flip.ts:100-111`; in Stapeln ≤ 1/Sitzung, 2/Tag, 5/Woche); ≥ 10 Paare mit < 75 % Treffern → strengere Leicht-Grenze. Nie bei Grammatik, Fehlersätzen, Satzbau (App prüft; „Ich lag richtig“ → höchstens Gut).
- **Automatische Einstufung:** Note = min(Zeitnote, Hilfe-Deckel, Form-Deckel): falsch/„Weiß nicht“ 1 · Tippfehler/falsche Form 2 · richtig: Zeit bis zum 1. Zeichen ≤ T_leicht 4, ≤ T_gut 3, sonst 2 (`srs/grade.ts:7-17,43-67`, `learn/grade.ts:20-28`). Deckel: Auswahl ≤ 3, Bausteine ≤ 3, Tipp 1 ≤ 3, Tipp 2/zweiter Versuch ≤ 2. FSRS-Gewicht: Auswahl 0,55 · Stütze 0,8 · frei 1 · eigener Satz 1,1 (`srs/weight.ts:8`). Heute drei Tabellen (`srs/grade.ts`, `learn/grade.ts`, `flip.ts`) → eine.
## 5 Fortschritt, der die Wahrheit sagt (nur Wortschatz + Grammatik)
| Anzeige | Definition | Quelle | Aktualisierung |
|---|---|---|---|
| K1 Aktiv gefestigt | Wörter + Wendungen im Zustand Gefestigt; Zahl + Zuwachs „+ n in 28 Tagen“, Ziel wählbar (Vorschlag 1.500); Prognose als Spanne erst ab 21 Tagen Daten | `vocab/*`, `chunk/*` (`retention.ts:54`); Zuwachs aus Tagesbild `va` (**Vorschlag**, additiv in `profile.history`, `progress/history.ts:37-70`; data-guard prüfen) | live; Tagesbild 1× je Lerntag |
| K2 Erwartet gekonnt | Σ R(jetzt) über alle nicht neuen Karten; sinkt bei Pausen (ehrlich) | `retention.ts:28-29,53` | live |
| K3 Behaltensquote 28 d | Anteil Note ≥ 2 an der ersten Antwort je Karte und Tag, nur wenn die vorige Antwort ≥ 7 d zurücklag; unter 30 Antworten „zu wenig Daten“; Korridor 85–93 % | `hist[].t,g` (`flip.ts:50-61`); heute zählt `retention.ts:58-66` alle Karten, 30 d | live |
| K4 Last und Rückstand | heute fällig n (≈ m Min.), Rückstand k (nur wenn > 0), 7-Tage-Balken | `srs/cost.ts:25-36`, `backlog.ts:24-29`, `srs/forecast.ts:9-20` | live |
| K5 Grammatikthemen | Verteilung Neu/Lernend/Sicher/Gefestigt, je Thema p mit Verfall und Treffer der letzten 10 (BKT-Zählung) | `grammar/*` (`bkt.ts:36-47`, `progress/measures.ts:63-77`); nicht `overview.ts:102` (p ohne Verfall) | live |
| K6 Fehlersätze | offen · gefestigt · wiederkehrend (gleiche Kategorie in 30 d wieder falsch) | `errors[]`, `app/repair` (`repair/daily.ts:28-32`), `app/radar` (`progress/radar.ts:45-76`) | live |
| K7 Wochen-Check ohne Hilfe | Mittel der letzten 4 Checks, Wörter und Grammatik getrennt; ein Check hat n = 12 (± 23 Prozentpunkte, 95 %), erst ab 3 Checks zeigen; nicht mit K3 vergleichen (wählt nur nicht fällige Karten, `check/select.ts:45`: überschätzt, Vermutung) | `profile.checks[]` (`check/record.ts:24-34`) | nach jedem Check |
| K8 Wortschatztest | passiv/aktiv als Spanne (± 1,64 SE); gilt 90 Tage als belastbar (`assessment/strength.ts:13`) | `profile.vtests[]` (`vtest/score.ts:43-78`) | nach jedem Test |

- **Urteil in Worten (Claude):** `assess` (Version 3, **Vorschlag**, `complex`, `prompts/assess.ts`) bekommt K1–K8 plus je Thema/Fehlerkategorie als nummerierte Belegzeilen (`[k:aktiv]`, `[g:passive]`, `[e:prep]`; Muster `assessment/evidence.ts:97-270`) und urteilt nur daraus: zwei Dimensionen `grammar` und `vocabulary` mit Belastbarkeit dünn/brauchbar/gut (`strength.ts:6-28`; lieber „dünn“ als erfundene Stufe), 2 Stärken, 2–3 Blocker mit „warum das auf C1 auffällt / so geht es richtig / Übungsziel“, Fokus für 7 Tage (→ Planergewicht, `assessment/planInput.ts`, `actions.ts:33-46`). Lesen/Hören/Schreiben/Sprechen: „nicht Teil dieser App“ statt ewig „dünn“. Keine Gesamtstufe aus zwei Dimensionen (CEFR ist kommunikativ): Anzeige „Wortschatz B2+ · Grammatik B2“; `cefr` bleibt Pflichtfeld = Minimum beider, mit Zusatz „nur Wortschatz/Grammatik belegt“. Auslöser unverändert (`assessment/due.ts:9-12`), Zahlen nur eingeklappt.
- **Wochenbericht** (Fakten deterministisch, je Fakt eine Kennung, `progress/weekly.ts:45-122`; der Text zitiert nur, `prompts/weeklyReport.ts`): W1 neu Gefestigte Wörter/Wendungen mit Namen, ≤ 8 (**Vorschlag:** additives Kartenfeld `act` = Tag der ersten Überschreitung) · W2 Themen mit p von → nach (≥ + 0,03, `weekly.ts:85`) und erledigte Fehlersätze (`:86`) · W3 Behaltensquote Woche gegen Vorwoche (K3) · W4 Rückstand Montag → Sonntag · W5 aktive Tage x/7, Pflichttage, Minuten (`:106-120`) · W6 Ausblick: fällige Karten der nächsten 7 Tage + 1 Fokus. Streichen: Texte und Gespräche (`:90-104`); „Wort sitzt“ von S ≥ 3 (`:71`) auf Zustand ≥ Sicher.
- **Nicht angezeigt (Vanity):** XP (wird geschrieben, bleibt unsichtbar), „Wörter 1.520“ inklusive Neuer (`overview.ts:86-98`), Kurs x/24 (`ProgressScreen.tsx:116`), Antworten/Minuten als Leistung, `ema`-Prozente (`history.ts:31`), Gesamt-CEFR aus zwei Dimensionen, Serien-Rekord, „Trefferquote heute“, Can-Do-Punkte zu Lesen/Hören/Schreiben/Sprechen (`cando.ts:68-87,125`), Heatmap als Leistung (nur Aktivität, grau).
## 6 Motivation ohne Kindlichkeit
- **Abschluss-Moment** je Block, ruhig, ohne Animation: „Heute neu sicher: 3 Wörter · 1 Fehler weg · Rückstand −12“. Neu sicher = Zustand vor/nach der Antwort (`vocab/session.ts:601-602` hat beides); Fehler weg = heute Gefestigt geworden; Rückstand nur, wenn er gesunken ist. Heute zeigt `vocab/Summary.tsx:84-90` nur Anzahl und Quote.
- **Serie:** wie A7 (1 Ruhetag je Woche), dezent; nach einer Pause beginnt sie ohne Verlusttext bei 1. **Meilensteine** (einmalig, Tag additiv im Profil gemerkt): 100 / 250 / 500 / 1.000 / 1.500 aktiv gefestigt · erstes Thema Gefestigt · 10 Fehlersätze Gefestigt · 4 Wochen Behaltensquote ≥ 0,88 · Rückstand 0 nach Pause.
- **Erwartung** (Modell): 500 aktiv nach ≈ 5–7,5 Monaten (4 bzw. 2,6 neue/Tag × 0,85; Ø 2,6 laut Simulation, `docs/neubau/anki-regeln.md` §9) – das gehört ehrlich in den Meilenstein-Text, sonst wirkt das Tempo wie Versagen.
- **Frust** (Lehre aus „Einwand zu schwer“, Erfolgsquote ≈ 0 %, `docs/lernpfad-plan.md:6`): Zielkorridor je Block 70–90 % (Faustregel „85-%-Regel“, Wilson u. a. 2019; für diesen Fall Vermutung). 2 Fehlschläge in Folge am Thema → nächste Aufgabe eine Form leichter; Block < 60 % bei ≥ 8 Antworten → Schlusszeile „Schwerer Block – bei neuen Strukturen normal, die Fehler kommen morgen kurz wieder“, morgen Form −1 und kein neues Thema; 5-Tage-Mittel > 92 % → Platzhalter weg bzw. Form + 1. Nie Zeit gegen die Uhr am Handy; jede falsche Antwort hat Hinweis → Lösung → Warum → Wiederkehr.
## 7 Invarianten (jede per Test prüfbar)
1. Jede angezeigte Zahl hat genau eine Quelle (eine Funktion in `domain/`); Heute, Wortschatz, Fortschritt und Planbegründung zeigen bei gleichem Stand dieselbe Zahl. Test: Property-Test über Seed-Daten, UI-Zahl == Funktionswert.
2. Zustände sind abgeleitet, nie gespeichert; `unitState` ist rein, und die Summe der vier Zustände == Zahl aller nicht ausgeblendeten Einheiten.
3. „Fällig“ nutzt für alle Einheiten dasselbe Tagesende (04:00): Ein abends angelegter Fehlersatz ist am nächsten Morgen um 04:01 fällig.
4. Neue Einheiten je Lerntag ≤ min(Kontingent, 5); bei Rückstand ≥ 15 genau 2 (nie 0, nie mehr; Kap. 15). Die 120-Tage-Simulation `tests/unit/backlogSim.test.ts` bleibt grün (Berg ≤ 81, Behaltensquote ≥ 0,87).
5. Eine Antwort ändert BKT-p höchstens um ±0,06 (±0,12 je Tag), die Stufe höchstens um +1 je Karte und Lerntag, FSRS-S nur mit Gewicht w ≤ 1,1 (Kap. 5 „gedämpft“).
6. Die Note ist eine reine Funktion aus Richtigkeit, Zeit, Hilfe und Eingabeform; Auswahl und Bausteine nie 4, Tipp 2/zweiter Versuch nie über 2; nur im Aufdecken-Modus wählt der Nutzer.
7. Jede falsche Antwort und jedes „Weiß nicht“ erzeugt genau einen Fehlersatz (idempotent über `t`). Heute verletzt (`write.ts:72`).
8. Nach jeder Aufgabe bleiben (3) Vergleich und (4) Warum mindestens 4 s oder bis zum Tipp auf „Weiter“ sichtbar – auch bei richtig. Heute verletzt (1,2 s).
9. Erledigt ist Zustand: ein abgeschlossener Block hat keinen Start-Knopf; „x von n“ == `duty.length` und sinkt nie durch Neuzeichnen.
10. Der Tagesplan ist je Lerntag eingefroren; Einstellungen, Rückstand oder Uhrzeit ändern erst den nächsten Plan.
11. Kein Element bewegt sich beim Tippen oder Antippen: Lücke und Bausteine ändern ihre Position um ≤ 1 px, bis der Finger loslässt oder „Prüfen“ gedrückt ist. Test: Playwright misst `getBoundingClientRect` je Frame plus `layout-shift`-Observer == 0 (iPhone-Größe, Tastatur auf und zu).
12. Eine Karte erscheint je Runde höchstens 3-mal; Wiedervorlage nach „Nochmal“ frühestens nach 3 (tippen) bzw. 5 (aufdecken) anderen Karten, nach „Gut“ im Lernschritt mit Abstand 8 (`flip.ts:150-154`).
13. Dieselbe Aufgabe (derselbe Satz) erscheint am selben Lerntag nie zweimal (Ausnahme: Wiederholung falscher Aufgaben am Rundenende, ≤ 3).
14. Geplante Zeit je Block ≤ Budget (Block 1 ≤ 12 Min., Tag ≤ 30 Min.), gerechnet nur mit `srs/cost.ts`; die Summe der Blockminuten == angezeigte Minuten.
15. Jede Pflicht ist ohne KI und ohne Sprachausgabe erfüllbar (`plan/pflicht.ts:63-77`); ein KI-Fehler blockiert nie eine Pflicht.
16. Ein abgebrochener Block (`partial`) zählt nie als erledigt; die Serie verträgt genau einen Ruhetag je ISO-Woche (`streak.ts`), danach beginnt sie neu – ohne Vorwurfstext.
17. K1 steigt nur durch Antworten und sinkt nur durch Vergessen (Lapse), nie durch Neuberechnung oder Zeit; K2 sinkt ohne Üben. Test: gleiche Daten, 14 Tage später → K1 gleich, K2 kleiner.
18. Sprachtreue: Erklärungen in der Oberflächensprache, Lerninhalte Englisch (US), keine Mischsprache (Kap. 10).
19. Nichts wird gelöscht oder verschoben: neue Felder nur additiv; `S`, `D`, `due`, `stage`, `box`, `done` bleiben gespiegelt (Kap. 9).
20. Alle Schwellen (fällig, Rückstand, sicher, aktiv, Dauerfehler) stehen nur in `domain/unitState.ts`; Test per Grep auf die Literale 7, 15, 21, 40 außerhalb dieser Datei.
## 8 Schwächen des heutigen Modells (Top 7)
1. **Mehrere Wahrheiten pro Zahl:** „gefestigt“ = nur S ≥ 21 (`retention.ts:49`) oder Stufe ≥ 4 ∧ S ≥ 21 (`:54`) oder Stufe 5 (`confidence.ts:29`); „Wörter“ zählt Neues mit (`overview.ts:86-98`, `ProgressScreen.tsx:117`); Grammatik-p roh (`overview.ts:102,104`) oder mit Verfall (`bkt.ts:36-47`); Trefferquote 4-fach (`retention.ts:58-66`, `measures.ts:44-57`, EMA `profilePatch.ts:49-50`; Log-`ok` zählt „richtig nach Hinweis“ als richtig, `logPatch.ts:133`, BKT als falsch, `write.ts:35`); Dauerfehler 3/5/6/2 (1.3).
2. **Drei Wiederholungssysteme, zwei Fälligkeitsregeln:** FSRS (Wörter) · Leitner 1/3/9 + Schatten-FSRS (`errors.ts:11-19,82`) · Leitner 1/3/9 für `app/repair` (`repair.ts:12`) · BKT-`due` je Thema (`bkt.ts:80-83`). Wörter fällig bis Tagesende (`queue.ts:82-84`), Fehlersätze millisekundengenau (`errors.ts:205`, `repair.ts:150`); ein Fehlersatz endet nach 3 Erfolgen ≈ Tag 13 (`errors.ts:19,74`), ein Wort erst bei S ≥ 21.
3. **Fehlerschleife mit Löchern:** „Weiß nicht“ → kein Fehlersatz, Aufgabe trotzdem `seen` (`write.ts:65,72`); Deckel 10 je Thema verdrängt auch offene Fehler (`errors.ts:20,41-47`); Block 5 liest `app/repair`, dessen Quellen (Sag es, Gespräch, Schreiben, Aufgabe des Tages: `repair/unit.ts:270-279`) mit der neuen Vorgabe weggefallen sind – oft leer (Vermutung).
4. **Grammatik ohne Einführung, Drosselung und Vorrat:** Regel nur zugeklappt (`GrammarItem.tsx:420-426`); kein Limit für neue Themen, n < 3 gibt + 0,2 Bedarf (`tasks.ts:185-186`), die 7 C1-Themen kämen binnen ~3 Tagen (Vermutung); das Wochen-Werkzeug steuert Block 2 nicht (`areas/lernen.tsx:99-103` ohne Thema, `planFocusTopic` ist für Einheit-Pläne immer `null`: `tasks.ts:329-337`, `unit/plan.ts:47`); Block 2 mischt stets das Thema der nächsten, nie abgeschlossenen Lektion ein (`grammar/session.ts:90-91`, `tasks.ts:259-262`); ≈ 5–6 Aufgaben je B2-Thema, danach `anySeed`-Wiederholung (`tasks.ts:223,283-293`).
5. **Feedback widerspricht Pflichtfrage 4:** Auto-Weiter nach 1,2 s bei richtig, Standard an (Invariante 8).
6. **Rückstand ohne Pausenmodell:** absolute Schwellen 15/40 ab „gestern“ (`backlog.ts:24-29`), nichts für 3/7/14 Tage außer + 50 % Zeit (`:32-36`); `planRound`/`ROUND_*` (`queue.ts:13-15,141-167`) sind ein toter zweiter Planer mit anderen Konstanten.
7. **Fortschritt misst Fertigkeiten, die es nicht mehr gibt:** Urteil mit 6 Dimensionen (`assessment/types.ts:20`, `strength.ts:19-27`), Belegpaket Lesen/Hören/Texte/Gespräche/Preply (`evidence.ts:202-240`), Can-Do Schreiben/Hören/Sprechen (`cando.ts:68-87,125`), Wochenbericht Texte/Gespräche (`weekly.ts:90-104`), Kopf „Kurs x/24“ (`ProgressScreen.tsx:116`); „Wort sitzt“ schon bei S ≥ 3 (`weekly.ts:71`).
## 9 Umsetzungsreihenfolge (je Schritt sichtbar testbar)
1. `domain/unitState.ts` (rein) mit allen Definitionen aus 1.2–1.3; alle Zähler lesen nur noch daraus (Invarianten 1, 2, 20) – beseitigt Schwäche 1.
2. Fehlerschleife schließen: „Weiß nicht“ → Fehlersatz, Fälligkeit = Tagesende, Fehlersatz-FSRS (Schwächen 2–3).
3. Feedback: Auto-Weiter ändern (Invariante 8), eine Notentabelle (Abschnitt 4).
4. Fortschritt K1–K8, `assess` und Wochenbericht auf zwei Dimensionen, Fertigkeiten raus (Abschnitt 5, Schwäche 7).
5. Rückstand neu (2 Tage), Wiedereinstieg, Ermüdung (1.3, 2); `planRound` löschen.
6. Grammatik: Einführung (Schritt 1), Wochen-Werkzeug als Fokus, Drosselung neuer Themen, Vorrat ≥ 12, Lektions-Kopplung entfernen (Schwäche 4).
7. Vorab Emrahs Entscheidungen: 8.000 (1.5), keine Gesamtstufe (5), Fehlersätze mit FSRS (1.1).
