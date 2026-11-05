# KI-Paket: Aufgaben vorbereiten, Antworten prüfen (05.11.2026)

Emrahs Wunsch: Beispielsätze sind immer gleich, nur eine Lösung zählt, und statt einer Begründung steht nur „erwartet war“. Claude soll den Tag wie ein Englischlehrer und Lernwissenschaftler vorbereiten. Ein gewählter Wortstapel (z. B. 20 Wörter) soll kurz aufbereitet werden, und Claude soll jede Antwort kurz prüfen.

Grundlage: Urteil des `english-teacher` (P1–P4, unten zusammengefasst), Bestandsaufnahme aller Aufgaben.

## 1. Leitlinien
- **Niemand wartet auf Claude.**
  - Vorbereitet wird im Hintergrund.
  - Die feste Prüfung urteilt sofort.
  - Claude ergänzt: Es begründet und darf eine Antwort nachträglich gelten lassen.
- **Ohne Claude läuft alles wie bisher.** Ursprungssatz, feste Prüfung, Grundfassung.
- **Fest bleiben:**
  - Plan, Pflicht, Mengen, fällige Karten (FSRS) und die Serie,
  - die 16 Grammatik-IDs.
  - Claude erzeugt keine neuen Vokabellisten.
- **Kosten:**
  - Stufe `quick` für alles, was mitten in der Übung passiert.
  - `default` nur für die Hintergrund-Vorbereitung von Lektion und Grammatik.
  - Gebündelt: ein Aufruf für mehrere Karten.
  - 24 h zwischengespeichert, nie automatisch wiederholt (A6.3).

## 2. Kartenpaket je Wort (`word-prep@1`, `domain/srs/pack.ts`, `features/vocab/packs.ts`)
- **Wann:** beim Start jeder Wortrunde (Pflicht „Wiederholen“ und freie Runde mit 10/20/30 Wörtern), für die Karten der Runde.
  - Gebündelt: erst 3 Karten (schnell da), dann je bis zu 8, höchstens 30.
  - Höchstens ein Versuch je Karte und Seitenaufruf.
- **Inhalt je Karte:**
  - 4 Lückensätze: 2 aus dem Beruf, 1 aus dem Alltag, 1 mit der stärksten Kollokation.
  - Je Satz:
    - `gap`: die genaue Form im Satz,
    - `ok`: weitere Formen des Zielworts,
    - `syn`: passende andere Wörter mit Unterschied,
    - `why`: warum das Zielwort passt.
  - Dazu 3 Ablenker mit „warum nicht“, mindestens einer eine typische Deutsch-Falle.
- **Prüfung beim Annehmen:**
  - Der Satz muss das Zielwort enthalten und darf weder der Ursprungssatz noch ein früherer Paket-Satz sein.
  - Erklärungen nur in der Oberflächensprache, sonst fallen sie weg.
  - Ablenker sind nie Lösung oder Synonym.
- **Satzwechsel:**
  - Der Ursprungssatz bleibt der Anker: bei neuen Karten, Stufe ≤ 2, nach einem Fehler und bei der Wiederholung in derselben Runde.
  - Sonst jedes Mal ein anderer Paket-Satz (Index aus `reps` und den Anzeigen in der Runde).
  - Sind alle Sätze gelaufen, schreibt Claude ein neues Paket ohne die alten Sätze (`prev`).
- **Nach dem Prüfen:** Der Ursprungssatz erscheint weiter unter „Beispiele“.
- **Speicher:** `xPack` an `vocab/<id>` bzw. `chunk/<id>`.
  - Nur wenn das Dokument existiert, nur additiv.
  - Ein unerwartetes oder neueres Paket wird nie überschrieben.
  - Etwa 2–3 KB je Karte, keine neuen Dokumente.

## 3. Antworten prüfen
**Wörter** (`word-judge@1`, `features/vocab/judge.ts`):
- **Reihenfolge der Prüfung:**
  - feste Prüfung: gleich, britisch, Form, Tippfehler,
  - dann das Paket: `ok` zählt als richtig, `syn` als „Auch möglich – gesucht war X“ mit Unterschied (fast richtig),
  - erst dann Claude.
- **Claude** prüft nur getippte Antworten (Lücke, Übersetzen, Tempo, Situation), die so „falsch“ bleiben:
  - `correct`: zählt (Note 3, mit Hilfe 2),
  - `synonym` und `form`: fast richtig (Note 2),
  - `wrong`: bleibt falsch, mit genauem Warum, neuem Beispiel und Kennzeichen „Deutsch-Falle“.
- **Erst Hinweis, dann Lösung** bleibt: Während des zweiten Versuchs prüft Claude den ersten im Hintergrund. Lässt Claude ihn gelten, endet der Versuch sofort damit.
- **Begründung auch bei richtiger Antwort:** das `why` des Paket-Satzes.
- **Falsche Wahl beim Zuordnen:** das „warum nicht“ des Ablenkers.

**Grammatik** (`grammar-judge@1`, `GrammarItem.tsx`):
- Das Urteil bleibt sofort da (Emrahs Wunsch vom 27.09.).
- Bei falsch oder „nicht sicher“ prüft Claude danach. Es ergänzt das Warum und darf nur zu „richtig“ heben, nie zu „fast richtig“ (der Befund vom 27.09.: „immer fast richtig“). „Nicht sicher“ und Claude sagt nein ergibt klar falsch.

**„Ich lag richtig“** bleibt in beiden Fällen.

## 4. Tagesvorbereitung (`features/today/dayPrep.ts`)
- **Wann:** beim ersten Start einer Pflichtaufgabe des Tages (Handlung), einmal je Lerntag und Seitenaufruf, mit Priorität „Hintergrund“.
- **Was Claude vorbereitet:**
  1. Den Inhalt der heutigen Lektion (`lesson-content`), wenn er fehlt. Ist die Lektion gerade offen, steht er sofort bereit.
  2. Frische Grammatik-Aufgaben (`grammar-items`) zum Hauptthema der Grammatik-Pflicht, wenn weniger als 4 ungesehene bereitliegen. Sie kommen nach `app/pool`, und die Runde nimmt sie vor den Startaufgaben.
- **Die Wörter** bereitet die Runde selbst vor (§2).
- **Bewusst nicht zum Laden der App:** Die erste KI-Nutzung fragt nach Zustimmung. Beim Öffnen wäre das ein Dialog ohne Anlass, und der Plan selbst bleibt fest.

## 5. Nächster Schritt (nicht in diesem Paket)
Tagesthema nach Lehrer-Urteil P4: Ein Thema aus „Mein nächster Termin“ oder dem Preply-Fokus verbindet „Sag es“, Lückenjagd, Grammatik und Hören mit den Wörtern des Tages. Das ist ein eigenes Paket mit eigener Lehrer- und UX-Beratung.

## 6. Tests
- **Unit:** `tests/unit/wordPack.test.ts`. Abgedeckt sind Annahme, Sprachtreue, Satzwechsel, Synonym, Übung mit Paket, Ablenker, Patch-Regeln und die Schemas beider Vorlagen samt festen Antworten.
- **E2E:** `tests/e2e/kiPaket.spec.ts`. Abgedeckt sind die Paket-Vorbereitung beim Rundenstart (gespeichert an der Karte), die KI-Prüfung einer falschen Antwort mit Warum und der Fall ohne KI.
