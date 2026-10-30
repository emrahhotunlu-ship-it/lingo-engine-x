# Auftrag Unterchat V0a: Vokabeln – Tiefen-Screening der Anbieter und Synthese der besten Methoden

Du bist ein Unterchat von Lingo-Engine X. Lies zuerst `CLAUDE.md`, `docs/umbau/unterchats.md` (deine Regeln), Emrahs Auftrag `docs/umbau/auftraege/vokabel-umbau-emrah.md` und in `docs/entscheidungen.md` den Eintrag „30.10.2026 – Vokabeln zuerst“. Zweig: `claude/umbau-v0a` (vom aktuellen `claude/umbau-fokus`). Bericht: `docs/umbau/berichte/v0a.md`.

**Emrah, 30.10.2026:** „Du sollst bitte andere Anbieter richtig tiefgründig screenen und eine Synthese der besten Methoden verwirklichen und umsetzen.“

## Ausgangslage
- `docs/relaunch/recherche/mara-lernmethodik.md` (27.10.2026) hat 18 Apps **in der Breite** angesehen, über alle Bereiche, etwa sechs Zeilen je App.
- `docs/relaunch/recherche/lena-lernwissenschaft.md` enthält die Forschung.
- Beides ist Ausgangspunkt, reicht aber nicht. Emrah will die **Tiefe für den Vokabelbereich**. Gefragt ist nicht, was eine App anbietet, sondern **wie sie es genau macht und warum es wirkt**.

## Wen du screenst (mindestens 14, Vokabeln im Fokus)
- **Pflicht, mit größter Tiefe:** Anki (mit FSRS), Clozemaster, Lingvist, Quizlet Learn.
- **Pflicht, normale Tiefe:** Memrise (Neuauflage), Duolingo (Practice Hub, Wörter), Babbel Review, Busuu Vocabulary Review, Vocabulary.com, WordUp, SuperMemo, Mochi/RemNote, LingQ, Readlang, Drops.
- **Zusätzlich:** Speak, Brainscape, Glossika, wenn sie für Wörter etwas Eigenes haben.

## Was du je Anbieter herausfindest (Steckbrief in `docs/umbau/vokabeln/anbieter/<name>.md`)
1. **Planung:** Algorithmus, Lernschritte, wie Geschwister-Karten behandelt werden, Fuzz, Lastausgleich, Tageslimit, Umgang mit Rückstand und Leeches. Belegt aus Handbuch, Hilfe-Seiten, Quellcode (Anki und FSRS sind offen) oder Fachartikeln.
2. **Abfrage-Leiter:** welche Übungsarten in welcher Reihenfolge; ab wann Tippen statt Auswählen; wie aus Erkennen aktives Benutzen wird.
3. **Bewertung:** selbst oder automatisch, Tippfehler-Toleranz, Rolle von Zeit und Hinweisen, was bei „fast richtig“ passiert.
4. **Rückmeldung:** was nach richtig und nach falsch erscheint; Unterschied als Diff, Audio, Übersetzung, Erklärung, Kollokationen.
5. **Kontext:** feste Sätze oder wechselnde, und gehört der Gedächtniszustand zum Wort oder zum Satz.
6. **Aktive Nutzung:** gibt es eigene Sätze, Schreiben oder Sprechen mit den Zielwörtern, und wie wird es geprüft.
7. **Fortschritt und Transparenz:** was der Lerner über sein Wissen sieht, z. B. Lastvorschau, Fälligkeit, Behaltensrate, aktiver gegenüber passivem Wortschatz.
8. **Bildschirmablauf:** jeder Schritt einer Abfrage, nach Bildschirmfotos, Videos und Handbuch beschrieben, mit Bildlink.
9. **Was Nutzer loben und was sie beklagen:** App-Store-Bewertungen, Reddit, Foren. Mindestens drei Stimmen je Seite, als [S] gekennzeichnet.
10. **Belege für die Wirkung:** Studien oder Daten des Anbieters, als [G] oder [S] gekennzeichnet.

Jede Aussage trägt eine Quelle. Was du nicht belegen kannst, ist mit [Vermutung] markiert.

## Bilder
Das Repository ist öffentlich. **Keine fremden Bilder ins Repository.**
- `docs/umbau/vokabeln/bildquellen.md` listet je Anbieter 3–8 aussagekräftige Bilder mit direktem Link (App Store, Play Store, Hilfe-Seite, Presse), jeweils mit einer Zeile, was darauf zu sehen ist.
- Prüfe jeden Link mit einem Abruf.
- Der Überchat baut daraus Emrahs private Vergleichsseite.

## Synthese `docs/umbau/vokabeln/synthese.md`
1. **Methoden-Tabelle:** jede Methode, die mindestens ein Anbieter nutzt, mit diesen Spalten:
   - wer sie nutzt,
   - Forschungsbeleg (Lena-Datei oder neue Quelle),
   - was dafür und was dagegen spricht,
   - Urteil **übernehmen / anpassen / verwerfen** mit Grund.
2. **Die beste Kombination für Emrah:** B2 → C1, Business, nur am Handy, 10–30 Minuten am Tag, will aktiv benutzen. Beschreibe den Ablauf einer Abfrage und einer Tagessitzung Schritt für Schritt.
3. **Abgleich mit Emrahs Auftrag** (Abschnitte 3–6):
   - wo der Markt ihn bestätigt,
   - wo ein Anbieter es nachweislich besser macht (Vorschlag mit Beleg),
   - wo es Widersprüche gibt (mit Empfehlung).
   Emrahs Auftrag bleibt Maßstab; Abweichungen sind nur Vorschläge an ihn.
4. **Abgleich mit der abgenommenen Vorschau** `WBft3EEx7jYYv4QHdepuNm` v2 (Wörter H12/L5, Übung H2/H4/H5):
   - welche Muster schon drin sind,
   - welche Bildschirme ergänzt werden müssen, im Stil der Vorschau.
5. **Umsetzungsliste:** je übernommener Methode, wo sie in der App landet (Paket V1–V5) und **wie geprüft wird, dass sie wirkt**, z. B. als Simulation, Unit-Test, Bildschirm oder Messwert. Mit „verwirklichen und umsetzen“ meint Emrah: Keine Methode bleibt Papier.

## Prüftore
- `learning-scientist` und `english-teacher` prüfen die Synthese einmal, danach folgt eine gezielte Nachprüfung.
- Keine Code-Änderung unter `src/`.

## Bericht
Bericht nach `docs/umbau/unterchats.md`, dazu für Emrah in einfachen Worten (höchstens 12 Sätze):
- die fünf stärksten Methoden,
- von wem sie stammen,
- was das für ihn beim Lernen ändert.

Nie `playwright install`, nichts in die App laden, keine echten Personendaten.
