# P21 Inhalt K2 (ocl + mcc, Kapitel 1–3): Protokoll

Quellen: `scripts/c1x/k2/{ocl,mcc}-N.mjs` (Schreibformat) → `node scripts/c1x/build-k2.mjs` → `src/content/c1x/src/{ocl,mcc}/k2-N.json`.
Die Lösung steht in der mcc-Quelle immer zuerst, der Build setzt sie auf den geplanten Platz (Folge `0,1,2,3,2,0,3,1`; bei 120 Aufgaben genau 30 je Platz).
Geprüft von `tests/unit/c1xContent.test.ts` (Schema, `checkC1Content`, Wertung, Dubletten, Lösungsposition), `c1xOcl.test.ts` und `c1xMcc.test.ts`.

| Charge | Datei | Zahl | Inhalt | Automatische Prüfung | Löser-Probe (blind) | Gegenlesung english-teacher |
|---|---|---|---|---|---|---|
| 1 | ocl/k2-1 | 32 | Kapitel 1: Zeiten im Alltag | grün | offen | offen |
| 2 | ocl/k2-2 | 35 | Kapitel 2: hedging, Future, Past Perfect, used to, Diplomatie | grün | offen | offen |
| 3 | ocl/k2-3 | 27 | Kapitel 3: conditionals, cond-alt | grün | offen | offen |
| 4 | ocl/k2-4 | 26 | Kapitel 3: mixed-cond, Ergänzungen Kap. 1–2 | grün | offen | offen |
| 5 | mcc/k2-1 | 30 | Grammatik Kap. 1 | grün | offen | offen |
| 6 | mcc/k2-2 | 30 | Grammatik Kap. 2–3 | grün | offen | offen |
| 7 | mcc/k2-3 | 30 | Wortschatz: Kollokationen, Verben, Präpositionen | grün | offen | offen |
| 8 | mcc/k2-4 | 30 | Wortschatz: falsche Freunde, Intensivierer, feste Wendungen, Phrasal Verbs | grün | offen | offen |

Summe: ocl 120, mcc 120 (60 Grammatik, 60 Wortschatz). Alle `src: 'seed'`, eigene Sätze, keine Cambridge-Originale.

## Was die automatischen Prüfungen sicherstellen
- Jeder ocl-Satz hat genau eine Lücke, keine Verbstütze, 8–30 Wörter; jede Lösungsvariante (`accept`) gibt 1/1, jeder der drei Chips 0; jeder Chip hat eine Begründung, die bei seiner Eingabe greift.
- Jeder mcc hat vier verschiedene Optionen, die Lösung steht nie im Satz, jede falsche Option hat genau eine Begründung mit Kategorie, mindestens ein Ablenker ist `calque` (Deutsch gedacht), Lösungsposition je Platz 25 %.
- Begründungen DE/EN je höchstens 140 Zeichen (Lösung 240), richtige Sprache, US-Schreibweise.
- Keine doppelten Sätze untereinander und gegen LP2-Aufgaben/Umformungen.

## Offene Punkte (ehrlich)
1. **Löser-Probe** (zweiter Agent löst blind) und **Gegenlesung `english-teacher`** (20 %, mindestens 10 je Charge) sind **nicht** gelaufen: Die Sitzung durfte keinen weiteren Agenten starten. Die Aufgaben ohne Lösung liegen als Prüfbogen bereit (`loeser-probe-ohne-loesung.txt`, Schlüssel getrennt); die Befunde (zweite mögliche Lösung → `accept` ergänzen bzw. Ablenker tauschen) sind danach in die Quellen einzuarbeiten.
2. Bei der Selbstkontrolle wurden mehrdeutige Lücken aufgespürt und behoben (z. B. `if` neben `when` bei indirekten Fragen, `if` neben `provided that`). Restrisiko bleibt bei Lücken mit Modalverben (`might/may/could`): dort sind alle gültigen Wörter in `accept` aufgenommen.
3. Niveau: Funktionswort-Lücken sind meist B2/B2+ (ocl 13 von 120 C1, mcc 9 von 120 C1). Das C1-Gewicht steckt in den Mustern (Inversion, Diplomatie, mixed conditionals) und in den Wortschatz-Aufgaben.
4. Beruf/Alltag: ocl 83 : 37, mcc 99 : 21 (Ziel ⅔ : ⅓), also etwas berufslastig.
5. Die 60 Wortschatz-mcc (`area: 'lex'`, Muster `lx.<slug>`) werden von der Grammatik-Rundenwahl nie gezogen (Muster ohne Thema). Sie sind bereit für den Wörter-Schritt bzw. das Extra; bis dahin erscheinen sie nur über einen Fehlersatz mit `cid`. Läuft ein solcher Fehlersatz durch den Grammatik-Schreibweg, entsteht ein Dokument `grammar/lex` (Thema `lex`). Das ist beim Einhängen der Wortschatz-Route zu sperren.
6. `npm run pron --check`: `us-ipa.json` ist aktuell (die c1x-Inhalte fließen dort nicht ein, wie bei kwt/err).

## Größe
Roh: ocl ≈ 148 KB, mcc ≈ 156 KB (Verzeichnisgröße). `dist/index.html` wuchs mit P20 und P21 um 81.911 Byte auf 4.545.191 Byte (4,33 MiB, Zeile in `docs/umbau/budget.md`).
