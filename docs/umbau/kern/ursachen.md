# Kern – Ursachen der Kommentare K5, K10, K11 (03.11.2026)

## K5 „Keine Erklärung, kein Beispielsatz“
Die Daten sind da: alte Vokabel-Dokumente `vocab/<id>` tragen `de`, `def` (englische Erklärung), `ex` (Beispiel mit [Ziel]) und `col[]` (Wortpartner); Startvokabeln `src/content/legacy/vocab.json` `{w,p,de,def,ex,l}`. Das neue Band zeigt nur en, de, Wortart, Lautschrift, „Merke“ (eine Verbindung) und „Formeller“; `teachOf` (`src/modules/vocab/content/index.ts`) liefert nur Lehrer-Chargen-Angaben. → Lernkarte und Band müssen `def`, `ex`, `col` zeigen.

## K10 „Neues Wort ohne Einführung“
(a) Hauptursache: Beim Wiedereinstieg kommen mitgenommene Schritt-A-Karten (`gap_hint`) mit afterCard=0 zuerst; die Einführung war in einer früheren Sitzung → fühlt sich neu an. Lösung: auf `STEP_A_GAP` verzögern und/oder Bedeutung auf Schritt-A-Karten zeigen, deren Einführung nicht in dieser Runde war (`!this.seen.has(path)`).
(b) Umgestellte alte Wörter mit reps>0 bekommen `intro` gesetzt und überspringen die Einführung → Emrah 03.11.: einmal kurz Einführungskarte zeigen.
Nachfüllen, Lesequellen, Platzierung, Planer: korrekt.

## K11 „Zähler 1 von 64 stimmt nicht“
„1 von N“ zählt nur diese LearnRun-Instanz (`ui/learnRun.ts` `private n=0`), N = Restschlange. Lösung: `doneToday` aus dem eingefrorenen Tagesplan, Anzeige `n+doneToday` von `n+doneToday+left`. Keine doppelte Arbeit, Antworten sicher gespeichert (`book()`, `leave()`, `replayDraft`).
