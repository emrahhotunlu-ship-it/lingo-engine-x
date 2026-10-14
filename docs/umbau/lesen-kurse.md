# Lesen – Kurse (Paket L8, Entwurf des Englischlehrers, 14.10.2026)

Status: Entwurf, wartet auf Emrahs Antworten (Abschnitt 5). Kurse gehören laut Entscheidung vom 13.10.2026 fest zum Umfang.

## 1. Katalog (8 Kurse, 78 Lektionen)
Reihenfolge: höchstens zwei Kurse gleichzeitig (ein Berufskurs + Claude Code). Start K1 + K3, dann K4, K6, K7, K2, K5, K8.
- **K1 Claude Code in 10 Tagen** (10): was Claude Code ist · Aufgabe briefen · CLAUDE.md · Rechte und Sicherheit · erst planen · Subagenten · Hooks · MCP · Tests als Netz · Pitch intern (Abschluss: 60-Sekunden-Pitch).
- **K2 Claude Code im Beruf** (8, nach K1): Prototyp an einem Tag · CRM-Daten bereinigen · Ausschreibungen beantworten · interne Vertriebstools · Churn-Analyse · Schnittstellen mit Partnern · Nicht-Entwickler baut eine Lern-App · Governance und IT-Sicherheit.
- **K3 Partnerschaften und Business Development** (10): BD vs. Vertrieb · Partner finden · erste Mail · Discovery-Call · gemeinsamer Nutzen · Partnermodelle · Konditionen · Exklusivität/Gebiet · Co-Selling · Partner-QBR.
- **K4 SaaS-Kennzahlen für den Vertrieb** (10): ARR/MRR · Churn/NRR · CAC/Payback · LTV · Pipeline/Win-Rate · Verkaufszyklus · Preismodelle · Expansion · Investorensicht · Zahlen im QBR.
- **K5 KI im Unternehmen** (10): was LLMs können · Hype vs. Wert · Use Case wählen · Datenschutz/EU AI Act (nur mit Recherche) · Build/Buy/Partner · Pilot → Produktion · ROI · Menschen und Wandel · KI im Dokumentenmanagement · verantwortlich verkaufen.
- **K6 Software-Architektur für Nicht-Architekten** (10): Monolith vs. Microservices · IaaS/PaaS/SaaS · Multi-Tenancy · APIs · Security · SLAs · Datenstandort/DSGVO · Migration · TCO · Einwände von Architekten.
- **K7 Führen und Verhandeln** (12): Führen ohne Weisungsrecht · Feedback · schwierige Gespräche · Meetings · Delegieren · Stakeholder · Verhandlung vorbereiten · Anker · Zugeständnisse tauschen · Blockade · höflich Nein sagen · Abschluss (Zusammenfassungs-Mail).
- **K8 Wirtschaft verstehen** (8): Inflation/Zinsen · Zinsen und Software-Budgets · Abschwung · Wechselkurse · Fachkräftemangel · EU-Binnenmarkt · Quartalsbericht lesen · Smalltalk Wirtschaft.
- Später: „Cloud-DMS/ECM verkaufen“ (E-Rechnung, ViDA, GoBD) – nur mit sorgfältiger Recherche.

## 2. Aufbau einer Lektion (10–12 Minuten)
0 Aufwärmen (2 Lückensätze aus früheren Lektionen, lokal gebaut) · 1 Ziel + 4–5 Schlüsselwendungen (Wortverbindungen) · 2 Text 350–450 Wörter, Satzpaare EN/DE, Ansicht B, alte Wendungen kehren wieder · 3 Sprachtipp (typischer Fehler Deutschsprachiger: falsch/richtig/Grund) · 4 drei Prüffragen (Kernaussage, Detail, Sprach/Register-Frage) mit Begründung · 5 Selbst anwenden (konkrete Lage, 2 Sätze mit 2 Wendungen; lokale Prüfung, Musterlösung, auf Wunsch kurze Korrektur durch Claude `quick`) · 6 Wendungen als Karten mitnehmen. Pflichtfeld `talk` (Ausgabeaufgabe). Letzte Lektion jedes Kurses: Abschlussaufgabe (Mail ~120 Wörter oder 60-s-Pitch mit 4 Wendungen aus dem Kurs).

## 3. Entstehung ohne Wartezeit
Empfehlung: **Kurs vorab komplett schreiben und vom english-teacher zu 100 % gegenlesen**, dann einspielen (Chargen 8–12 Lektionen). Die Routine macht nur Tagesartikel + monatliche Aktualitätsprüfung von K1/K2. Claude Code / EU AI Act / Zahlen nur nach Recherche in offizieller Quelle, `sources[]` und `asOf` je Lektion, keine Bedienungsdetails ohne wörtliche Quelle. Alternative (Routine erzeugt täglich 1–2 Lektionen): frischer, aber ohne unabhängige Gegenlesung und anfällig bei Ausfall.

## 4. Fortschritt und Wörter-Training
Zustände gesperrt/offen/angefangen/fertig (fertig = Zustand, kein Knopf). Lektion n+1 nach n. 3–4 Lektionen/Woche, immer Extra, nie Pflicht, zählt nicht zur Serie. Ein Hauptknopf im Reiter („Heute: K3 · Lektion 4 · ca. 10 Min“ oder „Weiterlesen“). Kurswendungen in die **aktive** Spur über `saveLookupCard` (`origin.ref` = Kurs/Lektion), nur vorgemerkt, innerhalb des Tageskontingents neuer Wörter.

## 5. Offene Entscheidungen für Emrah
1. Kurse vorab komplett geprüft (Empfehlung) oder täglich von der Routine?
2. Mit welchen zwei Kursen starten (Vorschlag K1 + K3) und wie viele Lektionen pro Woche (Vorschlag 3–4)?
3. Rückmeldung auf eigene Sätze: Musterlösung + „Claude prüfen“ auf Wunsch (Empfehlung) oder nur Musterlösung?

## 6. Emrahs Entscheidungen (14.10.2026)
1. Entstehung: **täglich von der Routine** (entgegen der Empfehlung vorab geprüft). Folge: gleiche Routine wie die Tagesartikel, Lektionen im Satzpaar-Format, mindestens 2 Lektionen je laufendem Kurs im Voraus; App validiert beim Laden und blendet Fehlerhaftes aus. Ersatz für die fehlende Gegenlesung: strenge Prüftore in der App + monatliche Stichprobe durch english-teacher.
2. Startkurse: **K1 Claude Code in 10 Tagen + K5 KI im Unternehmen**.
3. Rückmeldung: **Musterlösung + „Claude prüfen“ auf Wunsch**.
Bau (L8) nach L7 (gleiches Routine-Format).
