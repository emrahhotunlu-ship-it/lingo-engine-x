# Vokabel-Plattform (Plan, 11.10.2026)

Auftrag (Emrah): Der Vokabelbereich ist das Wichtigste. 8.000+ Wörter lernen, mit den besten Methoden, täglich und bei Bedarf neue Wörter nachladen, Methodik und Bedienung „outstanding“. Speicherentscheidung an Claude delegiert (`docs/entscheidungen.md`, 11.10.2026). Grundlage: Prüfbericht der Lernwissenschaft (nur lesend, 11.10.2026) und `docs/umbau/07-datenleitplanken.md` §4.4.

## Befunde (Kurzfassung)
- Stark: aktiver Abruf (D→E mit Satzlücke, ab Stufe 3 Tippen, Kalibrierung), Kontextwechsel, Begründungen, Rückstandssteuerung, Vorabfrage (Pretesting).
- Speicher: jedes Wort = ein Dokument `vocab/<id>`; `CARD_CAP = 4500` wird nie erreicht, vorher greifen `docGuard` (4.300 Dokumente gesamt) und die Annahme eines 1.000er-Fensters je Sammlung (`vocab` wird ohne Grenze abonniert). Emrahs Bestand heute: 192 Vokabel-Dokumente.
- Tempo: 2–5 neue Karten/Tag (Ø 2,6) → ~950/Jahr; 3.050 → 8.000 dauert so ~5 Jahre. Mit zusätzlicher billiger passiver Spur (E→D aufdecken, 6–8 neue/Tag, +5–6 Min.) ~20–24 Monate.
- Wissenschaftlich nötig: ~2.500–3.500 aktive + ~3.000–4.000 passive Karten mit Wiederholung (8–12 Begegnungen je Wort), nicht 8.000 aktive.
- Messung: „3.050“ ist ein Band (~2.400–3.700), Test mit 100 festen Wörtern, Doppelzählung bei eingeführten Karten, Nenner unklar (Grundformen vs. Wortfamilien), Atlas hat eher ~6.000 als 8.000 Einträge (nachzählen).
- Weitere Lücken: Zeitquelle doppelt (480 s Plan vs. 720 s Kapazität), 365-Tage-Höchstintervall, Hören am Handy fehlt in der Leiter, Ablenker nur nach Wortart/Länge, Blutegel-Grenze doppelt (4/5), Atlas-Karten ohne Wortpartner/Familie.

## Entscheidungen
1. Zwei Spuren: **aktive Spur** (3 neue/Tag, Behaltensquote 0,9, getippt/Satz) und **passive Spur** (E→D aufdecken, 6–8 neue/Tag, Quote 0,85, Höchstintervall 1825), eigenes Zeitbudget. Emrah kann die Dosis ändern.
2. Speicher **Variante B**: neue Atlas-/passive Karten in Sammeldokumenten `vs/<seg>` (≈60–80 Karten, Wächter bei 200 KiB, `w` als Objekt, Schreiben gebündelt 1–2 s, Prüfung lazy, Fälligkeitsliste zuerst). Alte `vocab/<id>` bleiben unberührt und werden weiter gelesen/geschrieben (keine Umstellung, nichts gelöscht, Kap. 9). Eigene Funde bleiben Einzeldokumente.
3. Neue Wörter laufend: Atlas-Vorsortierung („kenne ich / neu“, jedes 5. „kenne ich“ wird geprüft), Zufuhr nach Häufigkeit × Berufsnutzen.
4. Zahlen ehrlich: drei getrennte Werte (aktiv fest · passiv gesichert · geschätzt gesamt als Band mit Testdatum).

## Reihenfolge (jede Stufe endet mit Test-Link, Gegenlesung durch Englischlehrer bei Inhalt, data-guard bei Daten, ux-reviewer bei Bildschirmen)
- **V0 (S)**: Grenzen ehrlich (Kartengrenze = min(Gesamtsperre − übrige Dokumente, Fenster)), Verhalten einer unbegrenzten Abfrage >1.000 Dokumente aus `contract/db.d.ts` klären, Atlas nachzählen, eine Zeitquelle (Wortschatz-Minuten, Standard 12), Langzeit-Simulation 3 Jahre/4.000+ Karten.
- **V1 (L)**: Speicher `vs/<seg>` (virtuelle Sammlung in `src/data`, Sicherung, Anki-CSV, Stapel, Diagnose, Schemas, Großdatensatz-Tests, Startzeit < 2 s).
- **V2 (M)**: Zwei Spuren (Scheduler, Queue, Kontingent, Budget).
- **V3 (M)**: Atlas-Vorsortierung und geplante Zufuhr.
- **V4 (S–M)**: Ehrliche Messung (Testpool je Band, Band statt Punktwert, keine Doppelzählung, drei Zahlen).
- **V5 (S–M)**: FSRS-Feinschliff (Höchstintervall 1095/1825 mit begrenzter Spiegelung, Aufholen nach Abrufwahrscheinlichkeit), Blutegel einheitlich mit Behandlung.
- **V6 (M)**: Hören am Handy (Ton-Schalter, listen_mc/dictation), Nachsprechen; Verwechslungspaare dauerhaft.
- **V7 (M–L)**: Inhalte Atlas: Wortpartner, Familie, Berufssatz (Pipeline, Gegenlesung `english-teacher`).

Abhängigkeiten: V1 vor V2/V3; V0 vor V1. Bis V1 fertig ist, bleibt der Bestand unverändert nutzbar.
Vorher läuft die Sammelrunde (Zweige `claude/umbau-vokabeln`, `claude/umbau-fehlerfinden`).
