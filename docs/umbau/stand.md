# Stand des Umbaus „Fokus Wörter und Grammatik“

Dieses Dokument pflegt das Programmier-Fenster nach **jeder** Welle. Ein neues Fenster liest zuerst `uebergabe.md`, dann dieses Dokument, und kann nahtlos weitermachen.

**Stand:** W0 erledigt bis auf Emrahs zwei Handgriffe (Sicherung speichern, Dokumentzahl aus Diagnose ablesen) und den Basis-Lauf von `verify` (Ergebnis in `09-messbasis.md` Kap. 5). Gebaut ist noch nichts vom Umbau.
**Basis-Branch:** `claude/affectionate-cerf-pe6ej2` · **Arbeits-Branch:** `claude/umbau-fokus`
**Test-Link:** `AXHkh6…` zuletzt Version `1791120645-8c83` (Stand „Vokabeln+Grammatik-Fokus“) · **Live:** `JLL8…` Version `1790969044-1fb7`

| Welle | Stand | Commit | Test-Link-Version |
|---|---|---|---|
| W0 Vorbereitung | Marke, Messbasis, CLAUDE.md fertig; wartet auf Emrahs Zahl | siehe Git-Verlauf | – |
| W1 Entkoppeln | offen | – | – |
| W2 Aufräumen (T1) | offen | – | – |
| W3 Vertrauen und Heute (T2) | offen | – | – |
| W4 Wörter und Atlas (T3) | offen | – | – |
| W5 Grammatik und Fortschritt (T4) | offen | – | – |
| W6 Politur und Abnahme (T5) | offen | – | – |

**Nächste drei Schritte:** 1. Basis-Lauf `verify` auswerten, in `09-messbasis.md` eintragen, W0 committen und pushen. 2. Plan für W1 (eine Seite) hier eintragen (`architect`). 3. W1 bauen: gemeinsam genutzte Teile aus den abzuschaltenden Ordnern herausziehen, `retire.ts`, Metrik-Gerüst.

**Hinweis:** Die Marke `pre-fokus` liegt nur lokal (Hochladen von Marken wird vom Git-Zugang der Sitzung abgelehnt); Rückweg = Commit `6aaf4af`.

**Offene Fragen an Emrah:** keine. Für E1 bis E7 gilt der Standard (Gesamtkonzept, Teil A), bis er „anders“ sagt.

**Offene Messungen:** echte Dokumentzahl der Datenbank; ob das Live-Abo von `vocab`/`chunk` bei mehr als 1.000 Dokumenten vollständig oder gekappt liefert (W0, vor W4).

**Entscheidungen, die während des Baus fallen:** hier mit Datum eintragen, wichtige zusätzlich in `CLAUDE.md` A7.

## Plan W1 „Entkoppeln“ (architect, 04.10.2026)
Nur Importpfade, kein Verhalten, Bundle ±1 %. Nach jedem Schritt `typecheck` + `npm test`; am Ende ein `verify`.
Reihenfolge: 1 `features/input/AiRunPanel` → `ui/` · 2 `aiTasks`/`AiTaskNotice` → `app/shell/` · 3 `domain/speak/talkDoc` teilen: Hilfen → `domain/monthDoc.ts`, `TalkRun/upsertRun/compactRuns` bleiben (Rollenspiel) · 4 `textStats`, `chunkMatch` → `domain/text/`; `ErrorCat/TextError` → `domain/radar/types.ts` · 5 `week/text` → `domain/text/normText`, `week/traps` → `domain/patterns/traps` (`week/index.ts` re-exportiert) · 6 `speak/autoplay` → `app/voice/`, `legacySceneDoc` → `domain/chunks/legacyScene`, `cardSrc` → `domain/lookup/` · 7 toten Export `InputSections` samt `useChannelState` löschen · 8 `LEGACY_PROMPTS` → `domain/progress/legacyPrompts` · 9 `domain/plan/retire.ts` (nicht eingehängt) + `planRetire.test.ts`; `domain/metrics/` Gerüst.
**Nicht in W1** (ändern Verhalten, kommen in W2): `sayDoc`, `discover/steps` (`discCount` in Einstellungen), `nbdrill/unitBlocks`. `features/learn`, `features/week`, `domain/week/*` bleiben (bleibende Nutzer).
