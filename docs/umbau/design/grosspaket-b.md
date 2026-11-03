# Großpaket B – Design komplett (Refinement, 03.11.2026)

Stand: live `JLL8…` v90 `1793692316-d0c1` (Großpaket G). Grundlage: Ist-Aufnahme des Codes vom 03.11. (Hauptchat mit einem Lese-Helfer), `docs/umbau/funktionsinventar.md` (Top 15), `docs/relaunch/stufe1c-plan.md` §3 (D6a, D6b, E1–E7, F2–F5), `docs/umbau/05-ux-ist-und-ziel.md` §3, offene Prüferpunkte in `stand.md` (UX-Neuanfang M/K, G8 K3–K11, learning-scientist B4/LS7/LS12). Design-Vorlage: Vorschau `WBft3EEx7jYYv4QHdepuNm` v2 und UX-Vorschau `5Zwv5noCiNwzrzzfQsfzXy` v1.

## 1. Was und warum

**Ist (03.11.):** Von den vier Reitern sind **Heute** und **Grammatik** im neuen Design, **Wörter** und **Fortschritt** noch alt. Fast alle Unterseiten sind alt (Einstellungen, Praxis, Sprechen/Rollenspiel, Lesen, Wochenabschluss, Wochen-Check, Wortschatztest, Lehrkraft-Feedback, Satz-Klinik, Wochen-Mail, Übersetzer, Claude-Blatt, Ausfall-Hinweise). Einige Knöpfe führen noch in **alte Abläufe**, obwohl die neuen Module an sind (alter Wörter-Trainer aus „Wörter üben“, „Heute falsch“, Fortschritt-Aktionen; alte Wortliste hinter „Alle Wörter“; alte Grammatik-Seiten Regeln/Fallen/Suchen). Viele fertige Funktionen sind versteckt (Business-Szenen ausgefiltert, Hot Seat/Zeit gewinnen ohne Knopf, Übersetzer nur über Claude, Einstellungen nur auf Fortschritt, Diktat/Eigener Satz am Handy eingeklappt).

**Ziel:** Jeder Bildschirm sieht aus wie die Vorschau (Untergrenze, besser erwünscht), jede Funktion ist höchstens zwei Tipps tief und sichtbar beschriftet, kein Knopf führt mehr in einen alten Ablauf. Emrahs Note „5/10, vieles versteckt“ soll deutlich steigen.

## 2. Schritte

| # | Schritt | Inhalt | Löst |
|---|---|---|---|
| B1 | **Kopf und Wege** | Gleicher Kopf auf allen vier Reitern: rechts **Übersetzer · Claude · Zahnrad** (Einstellungen von überall, 1 Tipp). Übersetzer mit eigenem Knopf. Reiterleiste 4 Spalten (`shell.css:62` noch 5). | Top 15 Nr. 4, 8 |
| B2 | **Alte Wege abklemmen** | „Wörter üben“, „Heute falsch – nochmal“, Fortschritt-Aktionen, Wort-Blatt → Runden der neuen Wörter-App (`free`, `mistakes`; `evening`/`week` bekommen Einstiege im Wörter-Reiter). „Alle Wörter“ → neue Liste. Grammatik „Regeln/Fallen/Suchen“ → eine Seite im neuen Design. Alte Abläufe bleiben nur als Notbremse hinter den Schaltern. | Agent-Befund §5, Top 15 Nr. 6 |
| B3 | **Reiter Wörter** | Startseite, Übersicht, Wort-Seite, Liste/Atlas, Hinzufügen im neuen Design; Einstiege „Freies Üben“, „Deine Fehlwörter“, „Anwenden (Mail/Slack/Call)“ frei startbar. | D4-Rest, E2, Top 15 Nr. 7 |
| B4 | **Fortschritt + Profil + Einstellungen** | Fortschritt nach Vorschau H14/L8 (Satz zum C1-Weg aus vorhandenen Messungen, Kacheln statt Schieber, Zeilen Fehler · Verlauf · So funktioniert’s), Wochen-Check und Wortschatztest sichtbar. Einstellungen als ruhige Seite (alle 13 Abschnitte, Suche nach Einstellung). | D6a, E3, Top 15 Nr. 10, K3/K11 |
| B5 | **Claude und Übersetzer als Blatt** | Am Handy Blatt von unten (Claude · Übersetzen · Prüfen) statt schwebendes Fenster; am Laptop rechte Spalte. Ausfall-Zustände (ohne Claude, ohne Datenbank, ohne Stimme) einheitlich. | D6b, H15/H16, K8 |
| B6 | **Praxis** | Praxis-Seite nach Vorschau H13 (Sprechen · Hören · Lesen · Schreiben · Lehrkraft). Business- und KI-Szenen im Rollenspiel wieder an, Hot Seat und Zeit gewinnen mit Knopf, Diktat/Eigener Satz am Handy sichtbar. Rollenspiel, Bericht, Einwand, Leser, Kurse, Lektionen, Satz-Klinik, Wochen-Mail, Lehrkraft-Feedback im neuen Design. | D6a, E5, E6, Top 15 Nr. 2, 3, 11–13 |
| B7 | **Abschluss und Wochenteile** | Wochenabschluss, Wochen-Check, Wortschatztest, Einstufung, Themen-Test-Ergebnis im neuen Design. | E7, B4 (LS) |
| B8 | **Kleinpunkte + Aufräumen** | Gesammelte Prüferpunkte (M10, K3–K11, B4, LS7, LS12, ux Befund 6/8 aus A), alte CSS-Dateien der umgebauten Bildschirme löschen (nicht überstimmen), Tests auf das neue Design umstellen. | §6 stufe1c |
| B9 | **Schlussprüfung + Test-Link** | ux-reviewer einmal (390/1440/2560, Dunkel/Gedämpft/Hell, DE/EN), english-teacher für neue englische Texte, data-guard nur falls Daten berührt, platform-guard; `verify` einmal; ein Test-Link. | |

## 3. Was sich nicht ändert
Lernlogik (Bewertung, Wiederholungsplan, Tagesweg 3 Schritte, Quoten), Daten (keine neuen Pfade; nur, falls Emrah kleine Neufunktionen wählt, additiv), Inhalte (keine neuen Aufgaben). Live erst nach „Ja live nehmen“. Rückweg v90.

## 4. Große neue Funktionen (nicht in B, eigene Großpakete danach)
Missionen + Termin (F4), Hören-Kurs/Shadowing (F3b), „Sag es“/Flüssigkeit (F3c), Schreibtag (F3d), C1-Schätzung mit echten Hör-/Sprechwerten (F5), Phrasen-Baukasten/Präsentations-Coach, globale Suche, Massen-Import. Kleine Neufunktionen (Urlaub ankündigen, Ruhetag wählen, kurzer Tag, „So funktioniert’s“) nur auf Emrahs Wahl (Frage 1).

## 5. Vorgehen, Helfer, Prüfer
Hauptchat baut selbst (Schnell-Modus: Typprüfung, Lint, betroffene Unit-Tests, `verify:fast` während des Baus). Lese-Helfer (Explore) gezielt je Schritt. Prüfer einmal am Ende (B9), Nachprüfung nur bei Blockern. Skills: keine zusätzlichen. Kleine Commits auf `claude/umbau-fokus`, kein Test-Link vor B9.

## 6. Risiken
- Umfang groß (~40 Bildschirme): Reihenfolge B1→B9 so, dass jeder Schritt allein lauffähig ist.
- Viele E2E-Tests erwarten das alte Aussehen: gebündelt in B8 umstellen (Emrah 02.11.).
- Budget der ersten Datei fast voll: neue Bildschirme als nachgeladene Teile; alte CSS wird gelöscht und gegengerechnet.
- Business-Szenen: Inhalte wurden lange nicht gezeigt → english-teacher liest sie einmal gegen (Teil von B9).

## 7. Entscheidungen Emrah (03.11.2026, Pop-up)
1. Umfang → **„Dazu kleine Neue“** (nicht die Empfehlung): zusätzlich Schritt **B10 Kleine Neufunktionen**: Urlaub ankündigen (Serie pausiert für gewählte Tage), Ruhetag der Woche selbst wählen, „kurzer Tag“ (Tagesweg mit verkürzten Schritten, zählt als Pflicht erledigt), Seite „So funktioniert’s“ (Tagesweg, Wiederholen, Bewertung, Serie in einfachen Worten). Daten nur additiv in vorhandenen Dokumenten (data-guard in B9). Große Neufunktionen (§4) bleiben draußen.
2. Kopfzeile → **„Übersetzer · Claude · Zahnrad“ (Empfehlung)**.
3. Alte Wege → **„Notbremse behalten“ (Empfehlung)**: kein Knopf führt mehr hin, Rückweg nur über die Schalter in den Einstellungen.
4. Reihenfolge → **„Erst B, dann C“ (Empfehlung)**.
