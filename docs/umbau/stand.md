# Stand des Umbaus „Fokus Wörter und Grammatik“

Dieses Dokument pflegt das Programmier-Fenster nach **jeder** Welle. Ein neues Fenster liest zuerst `uebergabe.md`, dann dieses Dokument, und kann nahtlos weitermachen.

**Stand:** W1 erledigt. W0 erledigt bis auf Emrahs zwei Handgriffe (Sicherung speichern, Dokumentzahl aus Diagnose ablesen) und den Basis-Lauf von `verify` (Ergebnis in `09-messbasis.md` Kap. 5). Gebaut ist noch nichts vom Umbau.
**Basis-Branch:** `claude/affectionate-cerf-pe6ej2` · **Arbeits-Branch:** `claude/umbau-fokus`
**Test-Link:** `AXHkh6…` zuletzt Version `1791120645-8c83` (Stand „Vokabeln+Grammatik-Fokus“) · **Live:** `JLL8…` Version `1790969044-1fb7`

| Welle | Stand | Commit | Test-Link-Version |
|---|---|---|---|
| W0 Vorbereitung | Marke, Messbasis, CLAUDE.md fertig; wartet auf Emrahs Zahl | siehe Git-Verlauf | – |
| W1 Entkoppeln | fertig (Unit 1.755 grün, E2E 564 grün + 4 Lastausreißer einzeln grün, dist +72 Byte) | siehe Git-Verlauf „W1:“ | – |
| W2 Aufräumen (T1) | Teil 1 (Löschen der Bereiche) und Teil 2 (Fortschritt, Handy-Modus, Wochenthema, Textscan, Audit) gebaut; Gesamtlauf E2E und Test-Link stehen aus | siehe Git-Verlauf „W2“ | – |
| W3 Vertrauen und Heute (T2) | offen | – | – |
| W4 Wörter und Atlas (T3) | offen | – | – |
| W5 Grammatik und Fortschritt (T4) | offen | – | – |
| W6 Politur und Abnahme (T5) | offen | – | – |

**Nächste drei Schritte:** 1. Plan W2 (architect): Abklemmen (A) mit Entfernungs-Audit zuerst. 2. Fortschritt auf `grammar`/`vocabulary` filtern, `assess@2`. 3. Löschen in drei Commits (B). In W2 mitnehmen: `LEGACY_PROMPTS`, `sayDoc`, `discCount`, `unitBlocks`, `retire.ts` einhängen.

**Hinweis:** Die Marke `pre-fokus` liegt nur lokal (Hochladen von Marken wird vom Git-Zugang der Sitzung abgelehnt); Rückweg = Commit `6aaf4af`.

**Offene Fragen an Emrah:** keine. Für E1 bis E7 gilt der Standard (Gesamtkonzept, Teil A), bis er „anders“ sagt.

**Offene Messungen:** echte Dokumentzahl der Datenbank; ob das Live-Abo von `vocab`/`chunk` bei mehr als 1.000 Dokumenten vollständig oder gekappt liefert (W0, vor W4).

**Entscheidungen, die während des Baus fallen:** hier mit Datum eintragen, wichtige zusätzlich in `CLAUDE.md` A7.

## Plan W1 „Entkoppeln“ (architect, 04.10.2026)
Nur Importpfade, kein Verhalten, Bundle ±1 %. Nach jedem Schritt `typecheck` + `npm test`; am Ende ein `verify`.
Reihenfolge: 1 `features/input/AiRunPanel` → `ui/` · 2 `aiTasks`/`AiTaskNotice` → `app/shell/` · 3 `domain/speak/talkDoc` teilen: Hilfen → `domain/monthDoc.ts`, `TalkRun/upsertRun/compactRuns` bleiben (Rollenspiel) · 4 `textStats`, `chunkMatch` → `domain/text/`; `ErrorCat/TextError` → `domain/radar/types.ts` · 5 `week/text` → `domain/text/normText`, `week/traps` → `domain/patterns/traps` (`week/index.ts` re-exportiert) · 6 `speak/autoplay` → `app/voice/`, `legacySceneDoc` → `domain/chunks/legacyScene`, `cardSrc` → `domain/lookup/` · 7 toten Export `InputSections` samt `useChannelState` löschen · 8 `LEGACY_PROMPTS` → `domain/progress/legacyPrompts` · 9 `domain/plan/retire.ts` (nicht eingehängt) + `planRetire.test.ts`; `domain/metrics/` Gerüst.
**Nicht in W1** (ändern Verhalten, kommen in W2): `sayDoc`, `discover/steps` (`discCount` in Einstellungen), `nbdrill/unitBlocks`. `features/learn`, `features/week`, `domain/week/*` bleiben (bleibende Nutzer).


## W2 Teil 2 (Bau-Fenster, 04.10.2026)
**Gebaut:**
- **Fortschritt nur Wörter und Grammatik:** neue Vorlage `assess@3` (die Kennung `assess@2` war schon vergeben; `@3` ist die nächste freie). Sie beurteilt nur `grammar` und `vocabulary`; das Belegpaket enthält keine Texte, Lese-, Hör-, Sprech- und Lehrer-Belege mehr (`domain/assessment/evidence.ts`). Alte Einschätzungen (`assess@2`, sechs Fertigkeiten) bleiben lesbar und werden nie gelöscht (`FOCUS_DIMS` filtert nur die Anzeige). Erlaubte „Üben“-Aktionen der KI: nur noch Wiederholen, Wendungen, Lücke, Satzbau, Grammatik-Thema, Fehler-Thema, Lektion. Auslöser „neuer Text“/„neue Rollenspiel-Analysen“ für die automatische Einschätzung entfallen.
- Can-Do-Liste auf Grammatik und Wortschatz gekürzt (10 Punkte, `FOCUS_CANDO_ITEMS`); „Kurs x/24“, Aktivitäts-Heatmap (Minuten), Minuten-Zeile im Wochenbericht, Kurs-Meilensteine und die alte „Letzte Fortschritte“-Tabelle (Entdecken, Preply …) sind aus der Oberfläche raus (Daten bleiben).
- **Handy-Modus entfernt** (`PhoneModeSection`, `settings.phoneMode`, `platform/device.ts`); die Wochenbilanz „Aufgabe am Laptop“ (`lapPatch`/`lapThisWeek`) ist raus, `app/profile.lap` bleibt unberührt in der Datenbank.
- **Wochenthema entkoppelt:** Tagesplan wird ohne `app/week` gebaut (kein Warten, kein Thema in der Wiederholungs-Reihenfolge); keine Themenzeile auf Heute, keine Bestätigungskarte (`unitCard` kennt nur noch `next`), keine Seite „Deine Woche“, kein Hub-Eintrag, kein Stapel „Wochenthema“ als Quelle, keine Wochenziele/Fallen im Rollenspiel (`TargetBar`, `TrapWatch`), kein Input-Ersatzschritt mit Kundenmail. `app/week` wird nirgends mehr gelesen oder geschrieben; Datenschema und Pfad bleiben.
- **Textscan** `tests/unit/textScan.test.ts` (DE und EN, alle Texte): grün, mit drei ausdrücklichen Ausnahmen (siehe offene Befunde). **Entfernungs-Audit** erweitert: Datenregister unverändert, keine Textschlüssel gelöschter Bereiche, kein Wochenthema/Handy-Modus-Code; ESLint-Regel `no-restricted-imports` gegen die gelöschten Ordner.
**Offene Befunde / Entscheidungen:**
1. **Hör-Modus der Karten, Hörschleife und Diktat** sind noch gebaut (Textscan-Ausnahme `ALLOWED`). Das Gesamtkonzept sieht sie als entfallen vor (Standardwert); Entfernen ist eine Funktionsänderung (Wörter-Hub, Üben-Hub) → W4/W5 oder Entscheidung der Koordination.
2. **Tote Reste ohne Oberfläche, bewusst stehen gelassen:** `domain/week/*` (Thema, Ziele, Karten-Erkennung), `UnitPlan.theme/confirmTheme` in neuen Plänen (werden aus dem Vorschlag gefüllt, nie angezeigt), optionaler `isTheme`-Parameter in `domain/srs/queue`/`decks`, Stapel-Kennung `theme`. Aufräumen zusammen mit dem Plan-Umbau in W3.
3. Der Reiter heißt noch „Wortschatz“ (W4), `Kurs`-Bereich (Üben-Hub) und `features/learn` bestehen noch.
4. Die Namen der Datenbereiche auf dem Umstellungs-Bildschirm (`col*`, `mig*`) nennen Preply/Entdecken beim Namen (Textscan-Ausnahme: sie zeigen, was in der Datenbank unangetastet bleibt).
**Nächste Schritte:** E2E-Gesamtlauf durch die Koordination, danach `verify`, `platform-guard`, Test-Link T1.

**E2E-Stand W2 Teil 2:** 14 betroffene Specs (205 Tests) gelaufen: 190 grün, 15 rot. Ursache der 15: Erwartungen an entfernte Oberflächen (Kurs-Zahl, Heatmap, Feed-Tabelle, Lektion als Pflicht, Business-Szenen/Szene erstellen/Situation, „Sag es“-Prompt, Wochenthema). Alle angepasst bzw. entfernte Tests gelöscht; danach grün (today-duties, acceptance, stand-gaps, profil, patterns, speak, sprechen, progress, heute, rahmen). Den E2E-Gesamtlauf macht die Koordination.

## Entscheidung „Go Anwenden“ (04.10.2026, Emrah)
Neben Wörtern und Grammatik gibt es einen vierten Reiter **Anwenden**: Reiter Heute · Wörter · Grammatik · **Anwenden** · Fortschritt. Er ist freiwillig, zählt nie zur Pflicht und hat keine eigene Fortschrittsnote (Fortschritt bleibt Wörter + Grammatik). **Ersetzt** den Standardwert „Diktat/Sprint/Hören entfallen“: Diktat, Hörschleife und Hör-Modus bleiben.
**Gebaut (erste Stufe):** Reiter `apply` (`areas/anwenden.tsx`, `features/apply/ApplyHub.tsx`); Abschnitte „Hören und aufschreiben“ (Diktat, Hörschleife), „Sätze bauen“ (Lücke, Satzbau), „Sprechen“ (Rollenspiel und Einwände über die Seite `speak`). Die Kurzübungen sind aus dem Grammatik-Hub dorthin umgezogen (Test-IDs `hub-drill-*` bleiben); Sprint entfällt weiter und steht nirgends mehr. Rückweg aus den Übungen führt zu „Anwenden“.
**Noch offen (zweite Stufe, braucht Planung mit Lernwissenschaft und Englischlehrer):** echte Hörübung mit Verständnisfrage zu den eigenen Wörtern, Kombi-Aufgaben (Wort + Grammatik im selben Satz), „Fehler korrigieren“ als Einstieg im Reiter, Anwenden-Karte auf Heute (optional).

**Anwenden Stufe 2, Übung 1 „Fehler korrigieren“ gebaut (04.10.2026, „Go“):** Route `repairRound` (`features/apply/RepairRound.tsx`), Kachel `hub-repair-round` im Reiter nur, wenn heute fällige Sätze da sind. Bis zu 5 fällige Reparatur-Sätze, Antworten über `commitRepairAnswer` mit `ctx:'xtra'` (Box 1/3/9 wie bisher, kein Pflichtzähler, keine Karten, kein Rückstand; heute schon Geübtes kommt nicht noch einmal). Geprüft: Typ, Lint, 1479 Unit, repair.spec + lernen.spec grün. Offen: Übung 2 (Wort + Regel) und 3 (Hörübung mit Frage) laut `anwenden-plan.md`; vorher bestätigen, was `ctx:'xtra'` in `weight`/BKT schreibt (für diese Übung irrelevant, da nur `app/repair` und Log).

**Anwenden Stufe 2, Übung 2 „Wort + Regel“ (04.10.2026, „Go Kombi“) – Teil A als Umzug:** Die sechs vorhandenen Wort-und-Regel-Übungen (Kollokationen, Satz-Umformung, Wortbildung, Register, Phrasal Verbs, Überleitungen; Test-IDs `training-*`) stehen jetzt im Reiter „Anwenden“ unter „Wort und Regel kombinieren“ (Platz `apply`), nicht mehr unter „Grammatik › Training“. Kein neuer Übungscode, kein Claude. **Teil B** (eigener Satz mit Wort + Regel, Claude prüft, getrennte Rückmeldung) ist **nicht gebaut**; er braucht Prompt, Schema, Kennzeichnung und die Buchungsregeln aus `anwenden-plan.md`. Geprüft: Typ, Lint, 1479 Unit, lernen/training/rahmen/repair-Specs grün (rahmen `:51` fiel im Parallellauf einmal durch, einzeln grün).

**T1 „Aufgeräumt + Anwenden“ auf dem Test-Link (04.10.2026, abends):** `AXHkh6…` Version `1791140055-7307` (Artefakt-Version 32), Code `d468588`. Vorher dort: Version `1791120645-8c83` (Rückweg). verify: typecheck, lint, 1479 Unit grün; E2E 462 grün, 6 rot: 3 Barrierefreiheits-Tests „Umstellung 1440 px“ und `rahmen:51` (Bildlauf) sind Lastausreißer (einzeln grün), 2 `migration`-Tests erwarteten die entfernte Kurs-Zahl (angepasst, einzeln grün). `check:platform` Freigabe. Nicht live, `JLL8…` unberührt.
