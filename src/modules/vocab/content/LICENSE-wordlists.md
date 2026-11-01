# Wortlisten der Wörter-App: Herkunft und Lizenzen

Großpaket A Schritt 7 (V5). Neue Wörter kommen aus vier Quellen (Mischung 30/30/25/15, Emrah 01.11.2026, `docs/entscheidungen.md`).
Jedes vom Modul angelegte Wort trägt seine Herkunft im Dokument (`src`: `v5:col`, `v5:job`, `v5:band`) und einen Verweis auf den
Ursprungseintrag (`ref`).

| Quelle (`src`) | Datei | Herkunft | Lizenz |
|---|---|---|---|
| Wortpartner (`v5:col`) | `src/content/col/charge1.json` | eigene Lehrer-Charge (von Claude als Business-English-Lehrkraft erstellt und gegengelesen) | eigene Inhalte, keine fremden Rechte |
| Beruf (`v5:job`) | `src/modules/vocab/content/charge2-business.json` | eigene Lehrer-Charge 2 (nur verwendet, wenn `reviewed`) | eigene Inhalte, keine fremden Rechte |
| Häufigkeitsliste (`v5:band`) | `src/content/atlas/atlas.json` | Wort-Atlas, gebaut aus offenen Quellen und durchgesehen (`docs/atlas-quellen.md`) | siehe unten |
| eigene Funde (alles ohne `v5:`) | – | Emrahs Funde (Wort-Popup, Lesen, Lehrkraft) | – |

Quellen des Wort-Atlas (`docs/atlas-quellen.md`):

| Quelle | Wofür | Lizenz |
|---|---|---|
| wordfreq 3.1 | Auswahl und Häufigkeitsrang | Code MIT, Daten CC BY-SA 4.0 |
| WordNet 3.1 (Princeton) | Wortart, englische Erklärung | WordNet-Lizenz (frei nutzbar mit Hinweis) |
| FreeDict eng-deu 1.9 | deutsche Bedeutung | GPL-3.0 |
| Tatoeba | Beispielsatz mit deutscher Übersetzung | CC BY 2.0 FR |

Hinweise
- Der Quellenhinweis für Nutzer steht im Atlas (`atCredits`).
- FreeDict ist GPL-3.0: Die App ist privat und wird nicht weitergegeben. Würde sie je verteilt, müsste dieser Teil neu bewertet werden.
- Aus dem Atlas kommen nur Einträge ab der Einstufungsgrenze (ohne Einstufung Rang 4.500), ohne `hidden`, `basic` und `exWeak`, mit
  deutscher Bedeutung und Beispielsatz (`bandPool` in `domain/sources.ts`).
