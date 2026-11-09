# Großpaket I „Intelligente App“ – Plan (09.11.2026)

Auftrag (Emrah, 09.11.2026): Die App soll beim Wörter-Tempo, beim Grammatik-Lernen und beim Anwenden „super intelligent“ werden. Entscheidungen mit Wortlaut stehen in `docs/entscheidungen.md` (09.11.2026). Grundsatz: Die App **beobachtet und steuert nach**, statt festen Regeln zu folgen, und jede Anpassung wird in einem Satz begründet (Kap. 2 Nr. 3/4).

## I0 Reste aus Buch + Tempo (vor I1)
- Fehlerkarte: das Feld „Gleich nochmal“ sieht aus wie die Lücke, das Urteil kommt mit Rot/Grün und Vergleich; der Vergleich steht nicht doppelt (K4/K5).
- Buch-Abschlusskarte: „Weiter“ nennt das Ziel (K7).
- Klausur-Fehlerliste: das Bedeutungs-Warum spricht nicht von „a/b“ (N3).
- Heute springt kurz nach dem Öffnen auf „Wörter erledigt“: Ursache klären (nur Testdaten oder echt).

**Stand I0 (09.11.2026):** Fehlerkarte „Gleich nochmal“ als Linie wie die Lücke, Urteil grün/rot (K4); Klausur-Fehlerliste bei Bedeutungspaaren mit „a)“/„b)“ vor dem Satz, passend zum Warum (N3). „Weiter“ am Rundenende bleibt wie in allen Grammatik-Runden (K7, einheitlich mit GrammarEnd). Doppelter Vergleich in der Fehlerkarte bleibt (E1-Vorgabe „Du: X → richtig: Y“). Heute-Sprung: nur Testdaten – die Wörter-App schaltet sich dort beim ersten Öffnen selbst ein (`vocabAuto`, legt `vlog/*` an) und zählt erst danach das schon erledigte `act.review` des Tages; live ist sie seit v88 an, kein Fehler.

## Teil I1 → Test-Link
1. **Messen (R4):** wöchentlich zwei Werte mit Vorwoche, nämlich „Wörter sicher behalten“ (frei richtig nach ≥ 7 Tagen Pause) und „Fehler je Grammatik-Thema“. Gespeichert als Monats-Dokument (A6 Nr. 6). Grundlage für I1.2 und das Wochenbild.
2. **Wörter-Tempo nach Behalten:** neue Wörter pro Tag 5–15, gesteuert aus der Behaltensquote der letzten 7–14 Tage und der echten Zeit je Karte. Zielwert ≈ 90 % Behalten. Die Bremse unter 20 Wörter-Minuten bleibt. Der Satz im Wörter-Reiter erklärt die Zahl. Vorher Simulation (wie GB2) und learning-scientist.
3. **Fehler-Gedächtnis:** Fehler je Muster mit Rückruf +1/+3/+7 Tage, immer mit einem neuen Satz zum Muster (Buch, Bank, tasks-v2, sonst geprüfte Claude-Variante). Behoben nach 3× ohne Hilfe. Buch-Lektionstests kehren nach 2/6 Wochen als Auffrischung zurück. Bestehende Fehlersätze (`grammar/<topic>.errors`) werden weitergeführt, nichts wird gelöscht (data-guard).

## Teil I2 → Test-Link
4. **Verknüpfung:** Die Wörter von heute stehen bevorzugt in den Grammatik-Sätzen von heute (`wordsToday` ausbauen).
5. **Anwenden täglich:** 2 kurze eigene Sätze mit einem neuen Wort und dem Muster des Tages, mit Situation aus dem Berufsprofil. Claude prüft nur Zielwort und Muster, „unsicher“ statt „falsch“, „Ich lag richtig“ bleibt. Etwa 3 Minuten; Inhalte gegengelesen von english-teacher.
6. **Wochenbild in Worten:** „sicher / wackelt / nächste Woche“ mit Belegen aus echten Antworten (Kap. 2 Nr. 3), auf Fortschritt und einmal je Woche auf Heute.

## Prüftore
Je Teil: learning-scientist (Tempo-Regel, Rückruf, Anwenden), data-guard (neue Dokumente, Fehler-Übernahme), english-teacher (neue Sätze), ux-reviewer, platform-guard. Je Prüfer eine Prüfung und eine gezielte Nachprüfung. `verify` einmal vor jedem Test-Link. Live nur nach „Ja live nehmen“.
