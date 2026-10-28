# Nora – Prüfung P7 S1-DIKTAT (Gate G2, eine Runde)

Stand: `origin/claude/umbau-s1-diktat` @ 6fdd70d, Basis e0ba6c0. Geprüft wurden der Diff, der Plan (§3.3 P7, §6.4, §6.6, §7), Kap. 2 und Kap. 15 sowie die Screenshots p7-01 bis p7-04 (1440, dunkel).

**Veto: ja.** Der Anlass ist eng begrenzt (Muss 1 und 2), der Rest sind Soll-Punkte. Die Probe selbst ist in Ordnung.

## Muss

1. **Widerspruch und dreifaches Diktat-Thema in „Sag es“ am Laptop (Kap. 2 Nr. 2, Kap. 15 „dasselbe dreimal“).**
   Stellen: `src/i18n/parts/trainer.de.ts:16` (`task_say_it`: „Tipp auf das Mikrofon deiner Tastatur und sprich …“), `src/features/vocab/ExerciseView.tsx:1017–1021` (`say-it-tip`: „Tipp: Stell die Tastatur zum Diktieren auf Englisch.“) und `:1047` mit `src/ui/exercise/DictationHint.tsx:21–22`.
   - Ohne Probe (Emrahs Normalfall am Laptop) steht oben „Tipp auf das Mikrofon und sprich“ und direkt darunter „Am Laptop tippst du deine Antworten. Gesprochen wird am Handy.“ Die beiden Zeilen widersprechen sich.
   - Nach erfolgreicher Probe (p7-04) erklären drei Zeilen dasselbe: Aufgabenzeile, Tipp-Zeile und Hinweiszeile.
   - **Vorschlag:** Am Laptop (`useSplitLayout`) gibt es genau eine Diktat-Aussage.
     - Die Aufgabenzeile bekommt eine Laptop-Fassung ohne Mikrofon: neuer Schlüssel `task_say_it_desk`, „Sag den Satz auf Englisch.“ / „Say the sentence in English.“
     - Die Zeile `say-it-tip` entfällt am Laptop und bleibt nur am Handy.
     - Die eine verbleibende Diktat-Aussage steht in der Tastenzeile, siehe Muss 2.

2. **Die Hinweiszeile wirkt wie ein Link, und „Am Handy sprechen“ ist vor dem Prüfen der stärkste Knopf (Kap. 2 Nr. 1, §6.4).**
   Stellen: `DictationHint.tsx:21` (`text-hint-text`, türkis) und `:25` (`variant="quiet"`, Pille).
   - Türkis ist in der Übung die Farbe der Tipp-Zeile (`HintLine`, Taste T). Als Dauerzeile neben einem Knopf liest sie sich wie ein Link. Drückt Emrah T, stehen außerdem zwei türkise Zeilen untereinander.
   - Die Pille „Am Handy sprechen“ steht zwischen Aufgabe und Feld. Weil „Prüfen“ bei leerem Feld gedimmt ist, ist sie das hellste Bedienelement auf dem Bildschirm, und der Blick geht zum Ausstieg statt ins Feld.
   - **Vorschlag Platzierung:** Die eigene Zeile über dem Feld entfällt.
     - Der Text wandert in die vorhandene Tastenzeile unter den Knöpfen. Dafür gibt es die Eigenschaft `keysHint` in `src/ui/exercise/ExerciseShell.tsx:759`, Stil `lx-t-meta text-subtle`.
     - Mit Diktat: „Enter prüft · Diktat: 2× Globus-Taste“ (Mac) bzw. „Enter prüft · Diktat: Win + H“ (Windows).
     - Ohne Diktat: „Enter prüft · Laut sprechen: am Handy“.
     - Damit gibt es keine Türkisfarbe, keine Linkoptik und keine eigene Zeile mehr.
   - **Vorschlag Knopf:** „Am Handy sprechen“ wird ein `ghost`-Nebenknopf, nur Text, links in der Knopfzeile vor „Weiß ich nicht“. Dafür bekommt `ShellSecondary` (`ExerciseShell.tsx:65`) die neue id `phone`. Bleibt die Hülle eingefroren, kommt der Knopf als `ghost` rechtsbündig unter das Feld, aber nie als Pille über dem Feld.

## Soll

3. **Nur das eigene Betriebssystem nennen.**
   Stellen: `src/i18n/parts/diktat.de.ts:32` (`dkHintDictate`), `DictationProbe.tsx:87–88`.
   - `currentDevice()` kennt das Betriebssystem, trotzdem stehen Mac und Windows beide da.
   - Der Wortlaut ist missverständlich: „Diktier- oder Globus-Taste zweimal“ heißt, man müsste auch die Mikrofon-Taste zweimal drücken.
   - **Text:** Mac: „Mikrofon-Taste (F5) oder zweimal die Globus-Taste“; Windows: „Windows-Taste + H“. Beide Fassungen nur ohne erkanntes Betriebssystem.

4. **„Probe schließen“ als Pille über dem Inhalt (p7-01, p7-02).**
   Stelle: `DictationEntry.tsx:40–41`.
   - Der Umschalter steht über der Probe, und nach dem Aufklappen sitzt eine lose Pille direkt unter dem Blattkopf.
   - **Vorschlag:**
     - Zu: eine Zeile im Stil der Diagnose-Zeilen, links „Diktat am Laptop“, rechts der Stand und ein `ghost`-Knopf „Prüfen ›“.
     - Auf: Schließen kommt ans **Ende** des Probe-Kastens, als `ghost` „Schließen“, nach Erfolg „Fertig“.
     - Bei den Statuszeilen (`:32`) nur das eigene Betriebssystem zeigen, das andere nur, wenn es dafür schon ein Ergebnis gibt.

5. **Zu viel Text vor dem Feld, und die Anleitung bleibt nach dem Ergebnis stehen.**
   Stellen: `DictationProbe.tsx:85–96`, `:112–114`.
   - Vor dem Feld stehen vier Blöcke (Wozu, So geht's, Tasten, Satz).
   - **Vorschlag:** „So geht's“ und die Tasten zu einer Zeile zusammenfassen: „Klick ins Feld, starte das Diktat (2× Globus-Taste) und sprich den Satz. Nichts tippen.“
   - Nach dem Ergebnis die Anleitung ausblenden. Stehen bleiben nur der Satz und das Ergebnis.

6. **„100 % gleich“ neben „nicht geklappt“ (p7-03) liest sich wie ein Widerspruch.**
   Stelle: `diktat.de.ts:26` (`dkTech`), `DictationProbe.tsx:128–129`.
   - **Vorschlag:** Den Prozentwert nur zeigen, wenn der Grund `mismatch` ist. Sonst lautet die Zeile „Technik: 42 getippt · 0 diktiert · 0 eingefügt“. Für Tarek steht ohnehin alles im Protokoll (`logWarn`).

7. **Ton von `dkNoMore`.**
   Stelle: `diktat.de.ts:28`.
   - „Zwei Versuche sind genug. Am Handy sprichst du ohnehin.“ klingt abweisend.
   - **Text:** „Mehr Versuche gibt es hier nicht. Schick Claude ein Foto dieser Seite.“ Das passt zu §7.3, wo Emrah ein Foto schickt.

8. **Knopftext „Am Handy sprechen“ sagt nicht, dass die Runde endet.**
   Stelle: `diktat.de.ts:33`.
   - **Vorschlag:** „Später am Handy sprechen“. Die Bestätigung `nbShSaved` bleibt wie sie ist.

## Gut

Die Probe ist ehrlich und ruhig gebaut: Erfolg und Misserfolg stehen mit Wort statt nur Farbe da, ohne Rot, mit Grund und höchstens einem zweiten Versuch, und beide Hinweiszeilen erscheinen nie gleichzeitig.

## Hinweis zur Prüfung

- Mein einziger gezielter Playwright-Lauf zeigte keine P7-Elemente, weil `dist/` im Worktree `agent-ae2c9de0dd60f732f` inzwischen überschrieben ist. Dort liegt jetzt Build `78e00e9` von 18:40 statt `6fdd70d`.
- Hell und 1024 px mit Hinweiszeile konnte ich deshalb nicht selbst sehen. Meine Bilder unter `scratchpad/p7-shots/nora/basis-ohne-p7-*.png` zeigen nur die Basis ohne P7.
- Die Befunde stützen sich auf p7-01 bis p7-04 und den Code. Vor der Nachprüfung bitte neu bauen und p7-04 zusätzlich im Zustand „ohne Probe“, hell und bei 1024 px aufnehmen.
