# Überchat und Unterchats (ab 30.10.2026, Emrahs Vorgabe)

Emrah: „Du bist ab jetzt der Überchat. Orchestriere die Aufgaben wie angewiesen in Unterchats.“ Das ersetzt die Regel vom 07.10.2026 „keine neuen Cloud-Sitzungen“ (CLAUDE.md A2). Alles andere aus `arbeitsweise.md` gilt weiter.

## Rollen
- **Überchat** (die Hauptsitzung mit Emrah): plant, schreibt die Aufträge, startet die Unterchats, prüft deren Ergebnis, führt in `claude/umbau-fokus` zusammen, veröffentlicht Test-Links, berichtet Emrah. Baut und prüft nicht selbst.
- **Unterchat** (eigene Cloud-Sitzung, für Emrah in der App sichtbar): erledigt genau **ein Paket**. Er setzt innerhalb seiner Sitzung eigene Helfer (Agent-Tool) und die Prüfer aus `.claude/agents/` ein, nach `arbeitsweise.md` (Modelle, G0–G3, begrenzte Prüfrunden).

## Regeln für jeden Unterchat
1. Startet vom aktuellen Stand `claude/umbau-fokus`, arbeitet und pusht **nur** auf seinen Zweig `claude/umbau-<paket>`.
2. **Nie** in `claude/umbau-fokus` zusammenführen, **nie** ein Artefakt veröffentlichen, nie den Test-Link oder die Live-App anfassen. Das macht nur der Überchat.
3. Nicht `docs/umbau/stand.md`, `CLAUDE.md` oder `docs/entscheidungen.md` ändern. Ergebnis kommt in `docs/umbau/berichte/<paket>.md` mit den Feldern: `ok` (ja/nein), `commit`, `befunde[]`, `zahlen`, `nicht_gelaufen[]` (Pflicht), `offene_fragen[]`, und einer Kurzfassung in einfachem Deutsch für Emrah.
4. Fragen an Emrah stellt er nicht selbst im eigenen Chat, sondern schreibt sie in `offene_fragen` und hält an; der Überchat fragt Emrah.
5. Kein Gesamtlauf `npm run verify` je Paket (§10 `arbeitsweise.md`): `verify:fast`, betroffene Specs, G1/G2 je Paket; der Gesamtlauf G4 einmal je Test-Link durch den Überchat.
6. Ist das Paket fertig oder blockiert: Bericht committen und pushen. **Danach den Überchat wecken:** das Werkzeug `fire_trigger` (Claude-Code-Remote) mit `trigger_id` `trig_01VxUJ8U7LxouTgnEJEsN9EZ` aufrufen, `text`: „<Paket> fertig|blockiert, Zweig <zweig>, Commit <kennung>“. Ist das Werkzeug nicht da (auch nicht per ToolSearch „fire_trigger“), steht das im Bericht unter `nicht_gelaufen`. Dann aufhören.
   *Grund (30.10.2026):* Eine fertige Cloud-Sitzung meldet sich nicht von selbst beim Überchat; V0a war fertig, ohne dass der Überchat es erfuhr. Der Überchat plant zusätzlich als Absicherung alle 45 Minuten einen Blick auf laufende Unterchats ein.

## Takt
- **Ein Unterchat gleichzeitig** (Emrahs Vorgabe zum Kontingent), solange Emrah nichts anderes sagt.
- Pause bei etwa 95 % des Limits; „Stopp“ von Emrah → laufenden Unterchat anhalten (interrupt), Stand sichern.
- Der Überchat prüft den Stand über den Sitzungsstatus und den gepushten Zweig, nicht über Abfragen in Schleife.
- Aufträge liegen in `docs/umbau/auftraege/<paket>.md`, damit jeder Auftrag nachlesbar ist.

## Lerntag-Durchlauf vor jedem Test-Link (Überchat, seit 30.10.2026)
Vor jedem Test-Link spielt der Überchat einen ganzen Lerntag so durch, wie Emrah ihn erlebt: Heute öffnen, Pflicht bis zum Abschluss, Wörter-Block, eine Grammatik- und eine C1-Aufgabe, je einmal richtig, falsch, mit Tippfehler und mit Hilfe; Handy 390 px, Dunkel und Hell. Bildschirmfotos und jede Stelle, die stört oder sich widerspricht, kommen in den Bericht an Emrah. *Grund:* Emrah fragte am 30.10.2026, ob ich die Schmerzen der App überhaupt kenne; Tests allein zeigen nicht, wie sich ein Lerntag anfühlt.
