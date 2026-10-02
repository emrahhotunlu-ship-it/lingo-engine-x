# C1-Paket (02.10.2026)

Auslöser: Emrahs Frage „Baut das einen C1-Wortschatz auf?“ und das Urteil des Englischlehrers: „Es gibt keinen C1-Plan.“ Bis dahin kamen neue Wörter nur aus Emrahs eigenen Handlungen, dem Startwortschatz, „Neue Wörter von Claude“ auf Knopfdruck und dem täglichen Auftrag – zufällig zwischen B2 und C1.

## Was es ist
- **100 von Hand geschriebene Einträge** in `src/content/c1/pack.json`, Business-Englisch auf C1-Niveau, zugeschnitten auf Emrahs Alltag (Kundenmeetings, Verhandlung, Projekt, Compliance, DMS/ECM/Cloud). Amerikanisches Englisch, ein Beispielsatz je Eintrag (8–20 Wörter), deutsche Bedeutung, englische Erklärung, bei Wendungen eine kurze deutsche Anmerkung zum typischen Fehler.
- **Soll-Mix des Englischlehrers:** Wortpartner 25 % · Rahmen und Überleitungen 20 % · Phrasal Verbs 12 % · präzise Einzelwörter 15 % · Fachbegriffe 13 % · Wortfamilien 8 % · Idiome 7 %.
- **Kein Claude-Aufruf.** Kein Qualitätsrisiko durch erfundene Inhalte; der Inhalt ist geprüft (`tests/unit/c1pack.test.ts`: Wendung steht im Satz, Sprache, US-Schreibweise, Anmerkung vorhanden, jede Karte abfragbar).

## Wie es in den Wortschatz kommt
- Bei jedem ersten Start eines Lerntages (nach dem Tagesplan, wie der Zulauf des Tagesauftrags) legt `features/today/pack.ts` **höchstens 2 Einträge** als ganz normale **neue Karten** an – nur wenn die Einstellung „Neue Wörter pro Tag“ größer als 0 ist und weniger als 6 ungenutzte Paket-Karten im Korb liegen.
- **Welche:** immer aus der Kategorie, die am weitesten unter dem Soll-Mix liegt (Methode der größten Reste), innerhalb der Kategorie in Dateireihenfolge. Ein Eintrag, den es schon gibt (Paket-Karte oder eigene Karte mit derselben Kennung), wird übersprungen.
- **Form:** Wortpartner, Rahmen, Phrasal Verbs und Idiome werden **Wendungskarten** (`chunk/c-<slug>`, `src.kind: 'pack'`, `src.ref: c1pack/<id>`), Einzelwörter, Fachbegriffe und Wortfamilien **Vokabelkarten** (`vocab/<slug>`, `src: 'pack'`, `origin.ref: c1pack/<id>`, Stufe C1).
- **Reihenfolge im Eingangskorb:** Termin → Lehrer → eigener Output → Wochenthema → eigene Funde → **C1-Paket** → Lektion und Vorschläge (`ai`, `job`, `daily`). Emrahs eigene Funde gehen also immer vor.
- **Sichtbar** als Stapel „C1-Paket“ im Wortschatz (Zähler Neu/Lernen/Fällig wie bei jedem Stapel).

## Daten (data-guard)
- Es werden nur neue Dokumente angelegt (`writer.transform`, `set`), nie ersetzt, nie gelöscht. Höchstens 2 je Lerntag und Seitenaufruf (`addedToday` aus den Daten, deshalb auch mit mehreren Geräten).
- Höchstens 100 zusätzliche Dokumente insgesamt (Grenze 5.000 je Artefakt, A6.6).
- Zurücknehmen: Karten ausblenden (Wortliste, Stapel „C1-Paket“) oder „Neue Wörter pro Tag“ auf 0 stellen. Nichts davon löscht Daten.

## Erweitern
Neue Einträge am Ende der Datei anhängen (Kennung `<kategorie>-<nummer>`); der Test prüft Format, Satz, Sprache und Mix. Die Auswahl passt sich dem Soll-Mix selbst an.
