# Produktkonzept Lingo-Engine X – Neuansatz (27.09.2026)

**Rolle:** Product Owner, Synthese.
**Grundlage:**
- `docs/konzept/benchmark.md` (Anki, Babbel, Duolingo, LingQ, Speak, Busuu, Memrise)
- `docs/konzept/lernarchitektur.md` (Lernwissenschaft und Englischlehrer)
- `docs/konzept/ux-architektur.md` (UX)
- `docs/konzept/briefing.md` (Emrahs Auftrag und Kritik)

**Status:** Entwurf. Gebaut wird erst nach Emrahs Freigabe des klickbaren Prototyps.

## 1. Produktversprechen
Jeden Tag **eine** geführte Einheit von etwa 27 Minuten zu einem Wochenthema aus Emrahs Berufsalltag. Dazu kommen drei starke Werkzeuge:
- ein echter Anki-Stapel,
- ein Leser im Stil von LingQ, in dem jedes Wort mit einem Tipp in den Stapel geht,
- Sprechen und Schreiben mit sofortiger, gezielter Rückmeldung.

Die App ist ruhig, schnell und unterbrechungsfest. Das Beste aus Anki, Babbel, LingQ und Speak, zugeschnitten auf B2 → C1 im Business-Englisch.

## 2. Entscheidungen (wo die Fachbeiträge sich unterscheiden)

| Frage | Entscheidung | Begründung |
|---|---|---|
| Reiter | **Heute · Wortschatz · Lesen · Sprechen**. Stand und Einstellungen liegen hinter dem Profil-Knopf oben links (mit Serie). Claude (Übersetzen · Fragen) ist oben rechts auf jedem Bildschirm. | Jede Tätigkeit hat genau einen Ort. Wortschatz und Lesen sind die zwei Werkzeuge, die Emrah vermisst hat. „Stand“ braucht man selten. |
| Anki-Modus | **Aufdecken + 4 Knöpfe (Nochmal · Schwer · Gut · Leicht)** mit sichtbarem Intervall. Die App hebt ihren Vorschlag aus der Antwortzeit hervor, ein Tipp bestätigt. Wischen geht auch: links = Nochmal, rechts = Gut. In den Einstellungen gibt es 2 Knöpfe (Gewusst / Nicht gewusst) als Alternative. | Emrah wünscht ausdrücklich Anki. Der Vorschlag spart Denkarbeit und ist ehrlich (Lernarchitektur: Selbstbewertung im schnellen Wiederholen). |
| Tippen vs. Aufdecken | Im Stapel wählbar (Aa), gemerkt je Stapel. In der Tageseinheit: fällige Karten ab Stufe 3 **tippen** (App bewertet), sonst aufdecken. Je Karte und Tag zählt nur die erste Bewertung. Einmal pro Woche kommen 5 Karten, die als „Leicht“ bewertet wurden, als Lücke zur Kontrolle. | Ein Gedächtnismodell (FSRS) für alles. Abrufübung, wo sie wirkt. |
| Tageseinheit | Ablauf nach TBLT (Lernarchitektur): **1 Wiederholen** (höchstens 8 Min.) → **2 Input** (kurzer Text oder Hörtext zum Wochenthema, Wörter antippen) → **3 Aufgabe** (Sag es · Gespräch · Mail, im Wechsel) → **4 Fokus** (Deutsch-Fallen / C1-Werkzeug, erst Hinweis) → **5 Nochmal, aber besser**. Kurze Übergangskarten, nie zurück nach Heute. | Input → Output → Form → Wiederholung am selben Thema (Kap. 2.5 „kombinierte Aufgaben“). |
| Kurs | Wird in **Wochenthemen** aufgelöst. Jede Woche gibt es ein Berufsthema, und die Lektionsinhalte speisen Input und Aufgabe. Der Lehrplan bleibt unter Heute → „Dein Weg“ sichtbar. | Kein zweiter Pfad neben der Tageseinheit. |
| Grammatik | Nur Deutsch-Fallen und C1-Werkzeugkasten in der Einheit. Die 16 B2-Themen bleiben als Nachschlagewerk. | Übung dort, wo Fehler auftreten. |
| Preply | Unter Sprechen → Preply. Am Tag vor der Stunde ist die Aufgabe der Einheit die Vorbereitung, am Tag danach die Nachbereitung. | Lehrer und App verfolgen dieselben Ziele. |
| Fortschritt | Profil → Stand. Can-Do-Sätze auf C1-Niveau gelten erst mit 2 Belegen. Monatliche Vergleichsaufgabe, wenige ehrliche Zahlen, keine Punkte und Abzeichen. | Urteil statt Punktestand (Kap. 2.3). |

## 3. Bildschirme (14 + 3 Blätter)
Heute · Übungs-Player (Tageseinheit) · Dein Weg (Wochenthemen / Kurs) · Wortschatz · Stapel-Sitzung (Anki) · Wortliste · Lesen (Bibliothek) · Leser · Sprechen (Gespräche · Schreiben · Preply) · Gespräch · Schreibwerkstatt · Preply · Stand · Einstellungen.

Blätter: Wortblatt · Claude (Übersetzen/Fragen) · Hinzufügen.

Die Wireframes stehen in `docs/konzept/ux-architektur.md` §3.

**Übersetzer:** Bei jedem Ergebnis ist jedes englische Wort antippbar und hat „+ Wortschatz“. Ein einzelnes Wort oder eine kurze Wendung hat den Knopf direkt.

## 4. Stabilität und Leistung (Pflicht, nicht Kür)
- **Unterbrechungsfest:**
  - Jede Antwort wird sofort gespeichert.
  - Der laufende Übungsstand liegt lokal und je Tag zusätzlich in der Datenbank (`session/<tag>`, data-guard prüft das vor dem Bau).
  - Nach Neuladen oder Absturz: „Weiter, wo du warst“, genau an der Stelle.
- **Fehlergrenzen:** Jede Übung hat eine eigene. Ein Fehler zeigt „Diese Aufgabe überspringen“, nie einen weißen Bildschirm.
- **Keine Wartezeit im Kernablauf:**
  - KI läuft nur nebenher (Beispiele, Erklärungen, Aufgabenerzeugung im Voraus).
  - Bewertet wird lokal und sofort.
- **Leistungsbudget am iPhone:**
  - Heute ist in unter 1 s lesbar.
  - Die nächste Karte kommt in unter 50 ms.
  - Animationen dauern höchstens 200 ms, keine Layout-Animationen in Listen.
  - Die Bundle-Größe wird gemessen und sinkt.

## 5. Was wegfällt oder zusammengelegt wird (Funktionen bleiben erreichbar, wo sinnvoll)
- Satzbau, Sprint und Lückenjagd als eigene Einträge: Satzbau und Sprint fallen weg, Lückenjagd geht in den Fokus-Block auf.
- Auswahlfragen für Wendungen fallen weg.
- Lesen, Hören und Entdecken → ein Reiter **Lesen**.
- Chat und Übersetzer → ein Blatt **Claude**.
- Mehrere Kartensysteme → **ein** Wortschatz mit Stapeln (Stapel sind Filter).
- Kurs als eigener Pfad → Wochenthemen.
- „Neu“-Hinweise, Einleitungstexte, Zähler ohne Handlungsbezug fallen weg.

## 6. Umsetzung (nach Freigabe) – ein Plan, keine Abzweigungen
Daten- und Domänenschicht bleiben erhalten: FSRS, Karten, Grammatik, Reparatur-Sätze, Muster, Serie. Neu gebaut wird die Oberfläche.

| Sprint | Inhalt | Fertig, wenn |
|---|---|---|
| 1 | Grundgerüst: 4 Reiter, Profil, Claude-Blatt, Übungs-Player mit Fortsetzen, Fehlergrenzen, Leistungsbudget | Neuladen mitten in jeder Übung setzt exakt fort; Heute < 1 s |
| 2 | Wortschatz: Stapel, Anki-Sitzung, Wortliste, „+ Wortschatz“ aus Leser/Übersetzer/Gespräch | 40 Karten am Stück ohne Ruckeln; jedes Wort speicherbar |
| 3 | Tageseinheit (5 Blöcke, Wochenthema), Lesen/Leser, Sprechen/Schreiben/Preply eingehängt, Stand | Komplette Journeys a–d laufen |
| Abschluss | Ein kompletter Test (alle Journeys auf 390 px, beide Sprachen, drei Modi), data-guard, platform-guard, Lernwissenschaft; **eine** Veröffentlichung | Alles grün; Emrahs Handy-Checkliste |

Neue Ideen während der Sprints landen in `docs/backlog.md`, nicht im laufenden Sprint.
