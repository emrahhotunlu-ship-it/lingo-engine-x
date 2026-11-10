# Großpaket WT „Wörter-Trainer C1“ (Refinement, 10.11.2026)

Auftrag Emrah 10.11.2026 (Wortlaut im Chat): Wörteratlas (über 6.000 Wörter) soll im Tagesplan geübt werden; im Wörter-Reiter oben schnell „10, 20 oder 30 Wörter üben“; dedizierter Wörterlerner für die 6.000–8.000 Wörter für C1; erst lernen, dann abrufen, auswählen, ergänzen, eintippen, frei verwenden – mit Intelligenz, die weiß, was sitzt; jeden Tag rund 50 Wörter abgefragt (wenige neue, befestigen, wiederholen); „richtig gutes, strenges Vokabular“, weil er beim Englisch-Hören zu viel nicht versteht und die Motivation verliert.

## 1. Ist-Stand (Bestandsaufnahme mit Datei:Zeile)
- **Atlas:** `src/content/atlas/atlas.json`, 6.337 sichtbare Wörter (Rang 2.503–29.995; Bänder core < 4.500: 849, plus < 7.500: 1.143, c1 < 12.000: 1.437, rare: 2.908), Felder Wort, Wortart, Bedeutung DE, Erklärung EN, Tatoeba-Satz + Übersetzung, Rang.
- **Warum Atlas-Wörter nie drankommen:** `ATLAS_REFILL = false` (`modules/vocab/data/refill.ts:33`) seit dem Inhalts-Audit 04.11. (ungeprüfte Sätze, falsche Bedeutungen). Neue Wörter kommen nur aus job (142), col (102, erst nach Kernwort) und eigenen Funden → Vorrat endlich. Atlas-Knopf von Hand legt Karten ohne `lex` an, als Randwort (`pri: edge`), Deckel 5/Tag aus dem alten System.
- **Tagesmenge:** in Minuten (60 % des Tagesziels), 10 neue/Tag, unter 20 min höchstens 5 (`domain/day.ts`). Kein Ziel „Anzahl Wörter“.
- **Leiter:** Stufen 1–7 (`ladder.ts`), Tag 0 Einführung → Lücke mit Hilfe → Lücke. **Multiple Choice ist in keiner Leiter**; Hören, deutscher Satz, Wortpartner, Wortfamilie, Situation, Sprechen u. a. sind gebaut, aber in der Runde abgeschaltet (`learnRun.ts:427,441` setzt nur `av:{de, ai, anki}`). Real: Lücke, ohne Satz, Bedeutung.
- **Tracking:** neues `lex` und alte Felder laufen gespiegelt nebeneinander; Standardwerte widersprechen sich (5 vs. 10 neue); Stufe 7 für Kernwörter kaum erreichbar (Sprechen nie verfügbar); Einstufung wird gelesen, wirkt aber nicht.
- **Wörter-Reiter:** kein Knopf „N Wörter üben“; es gibt „Freies Üben“ (bis 20), „Noch 5 neue“, Abend, Fehler, Woche.

## 2. Ziel
Ein strenger, intelligenter Wörter-Trainer: aus 6.000–8.000 geprüften C1-relevanten Wörtern lernt Emrah jeden Tag rund 50 Abfragen (davon nur so viele neue, wie er behält), jedes Wort steigt über klar unterscheidbare Stufen auf, und er sieht, wie viel er schon versteht.

## 3. Pakete
| # | Paket | Inhalt |
|---|---|---|
| WT1 | **Atlas geprüft freischalten** | Atlas-Wörter in Paketen vom Englisch-Lehrer prüfen (Bedeutung, Wortart, natürlicher Beispielsatz, sonst neuer Satz) → als geprüfte Quelle „atlas“ in den Tagesplan (Reihenfolge nach Häufigkeit ab Einstufung). Erstes Paket ~1.000 Wörter (reicht > 3 Monate), weitere Pakete laufend. Ungeprüfte Wörter kommen nie in den Plan. Atlas-Knopf von Hand legt richtige Karten an (mit `lex`, nicht als Randwort). |
| WT2 | **Tagesziel in Wörtern** | Tagesziel „50 Wörter“ (Einstellung 30/40/50/60) statt nur Minuten. Mischung von selbst: fällige Wiederholungen zuerst, dann Befestigen (Tag 1–3), dann neue. Neue nach Behalten (5–15, Ziel ≈ 90 % richtig am Folgetag; aus `intelligenz/plan.md` I1.2). Zeitdeckel bleibt als Bremse. |
| WT3 | **Leiter sauber und streng** | Stufen mit eigener Abfrageart: 1 Kennenlernen (Bedeutung, Satz, Hören) → 2 Wiedererkennen (Auswahl: Bedeutung wählen) → 3 Im Satz erkennen (Lücke mit Auswahl) → 4 Ergänzen mit Hilfe (Anfangsbuchstaben) → 5 Selbst eintippen (Lücke, Deutsch→Englisch) → 6 Aus dem Gedächtnis (ohne Satz, Hören, Wortpartner) → 7 Frei verwenden (eigener Satz, Claude prüft). Aufstieg nur ohne Hilfe, Fehler = eine Stufe zurück und Wiederholung am nächsten Tag; Abstände 1/3/7/21/…; abgeschaltete Formen wieder an. Ein einziges Tracking (`lex` führt, alte Felder nur gespiegelt), Standardwerte vereinheitlicht. |
| WT4 | **Schnellstart im Wörter-Reiter** | Oben drei Knöpfe „10 · 20 · 30 Wörter üben“: fällige und wackelige Wörter zuerst, neue nur, wenn nichts ansteht; zählt als Extra, nie gegen die Pflicht. |
| WT5 | **Schon bekannte Wörter aussortieren** | Schnell-Sortieren: Liste mit 20 Atlas-Wörtern, antippen, was man sicher kennt → gilt als bekannt (Stufe 5, kommt in 21 Tagen einmal zur Kontrolle); Stichprobe prüft ehrlich. Spart Monate bei Wörtern, die Emrah längst kann. |
| WT6 | **Sichtbarer Fortschritt** | Zahl „sichere Wörter“ und Abdeckung: „Von 100 Wörtern in normalem Englisch kennst du etwa X“ (aus Häufigkeitsrang der sicheren Wörter), Ziel C1 ≈ 95–98. Motivation für Videos/Hören. |

## 4. Vorgehen, Agenten, Prüfung
- Hauptchat baut; Bestandsaufnahme per Explore (erledigt). Atlas-Prüfung als Inhalts-Chargen mit `english-teacher` (je Charge Prüfung + eine Nachprüfung), Ergebnis als geprüfte Datei neben dem Atlas.
- `learning-scientist` prüft Leiter und Tagesmischung (einmal), `data-guard` die Datenänderungen (neue Felder in `lex`, keine Löschung), `ux-reviewer` die neuen Knöpfe/Schnell-Sortieren, `platform-guard` vor dem Test-Link.
- Schnell-Modus: beim Bauen nur schnelle Prüfungen, `verify` einmal vor dem Test-Link.

## 5. Was sich nicht ändert
Pflicht/Extra-Trennung, Serie, Grammatik und Anwenden, bestehende Karten und ihr Lernstand (nichts wird gelöscht, nur ergänzt), Stimme, Stift.

## 6. Risiken
- 6.000+ Wörter zu prüfen dauert; deshalb in Paketen, erstes Paket groß genug für Monate.
- 50 Abfragen/Tag brauchen je nach Art ~20–30 Minuten; Zeitdeckel schützt.
- Realistisches Tempo: bei ~10 neuen/Tag dauern 6.000 Wörter etwa 1,5–2 Jahre; Aussortieren (WT5) verkürzt das deutlich.
