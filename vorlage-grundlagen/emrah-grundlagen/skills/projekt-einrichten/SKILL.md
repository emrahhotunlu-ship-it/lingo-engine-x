---
name: projekt-einrichten
description: Richtet ein neues oder bestehendes Projekt schlank für Claude Code ein – kurze CLAUDE.md, docs/verlauf.md, Platz für docs/produkt.md und docs/design.md, Testbefehle, nur nötige Fach-Helfer. Einsetzen bei "neues Projekt", "Projekt einrichten", "CLAUDE.md aufräumen" oder wenn eine CLAUDE.md länger als 200 Zeilen ist.
---

# Projekt einrichten

Die `CLAUDE.md` wird in jeder Sitzung komplett geladen und kostet bei jeder Nachricht mit. Sie enthält deshalb nur, was in **jeder** Sitzung gebraucht wird.

## Ablauf

1. **Bestand lesen:** README, `package.json` (oder gleichwertig), Ordnerstruktur, vorhandene `CLAUDE.md`, `.claude/agents/`, Testbefehle. Gezielt lesen, nicht alles.
2. **Verlauf auslagern:** Entscheidungsprotokolle, Versionsnummern, erledigte Phasen und alte Berichte **wörtlich** nach `docs/verlauf.md` verschieben. Nichts löschen.
3. **CLAUDE.md schreiben** nach `references/claude-md-vorlage.md`. Ziel: unter 150 Zeilen. Was im Grundpaket `arbeitsweise.md` steht (Emrahs Arbeitsweise, Sparsamkeit, Berichte), wird nicht wiederholt.
4. **Helfer ausmisten:** Allgemeine Helfer kommen aus dem Grundpaket (`produkt-stratege`, `design-kritiker`, `code-pruefer`, `test-laeufer`). Im Projekt bleiben nur Fach-Helfer mit echtem Spezialwissen (z. B. ein Englischlehrer oder ein Daten-Wächter). Doppelte Helfer zur Löschung vorschlagen, nicht selbst löschen.
5. **Lücken nennen:** Fehlen `docs/produkt.md` oder `docs/design.md`, einmal die Skills `produkt-kern` und `design-richtung` vorschlagen.
6. **Abschluss:** Ein Commit („Projekt schlank eingerichtet“), dann Emrah in drei Sätzen: was sich ändert, was er merkt, was als Nächstes sinnvoll ist.
