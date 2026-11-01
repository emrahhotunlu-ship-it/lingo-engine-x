# Großpaket A Schritt 7 (V5): Bauplan Wortauswahl und Einstufung

Stand 01.11.2026. Grundlage: `plan.md` §3.5, §3.6, §8 und Zeile V5 der Paketliste; Bilder Satz 3 in `bilder/README.md`.

## Quellen neuer Wörter (`src/modules/vocab/domain/sources.ts`, rein)
| Quelle | Herkunft | Gewicht |
|---|---|---|
| `col` Wortpartner | `src/content/col/charge1.json`: Partner eines Grundworts, das schon eingeführt ist (`intro ≠ null`) | 30 % |
| `job` Beruf und Wendungen | `src/modules/vocab/content/charge2-business.json`, solange das Stichwort noch kein Lexem ist | 30 % |
| `own` eigene Funde | bestehende neue Lexeme ohne `v5:`-Herkunft (Wort-Popup, Lehrkraft, Lesen) | 25 % |
| `band` Häufigkeit | Wort-Atlas (`src/domain/atlas`), Rang ≥ Einstufungsgrenze; ohne `hidden`, `basic`, `exWeak`, ohne vorhandene Wörter und ohne die im Test gekonnten (`vmod/place.ok`) | 15 % |

- Aufteilung der freien Plätze nach größtem Rest, deterministisch; ist eine Quelle leer, geht ihr Anteil an die übrigen.
- Gewichte sind Konstanten im Code. `vcfg` bleibt unverändert (strikt geprüft, siehe `data/settings.ts`); das Nachsteuern nach 4 Wochen (plan §8) kommt mit einem eigenen Feld, wenn es so weit ist.
- **Nachfüllen:** in `learnRun.setup` vor `freezeDay` (nur Pflichtrunde, nur wenn heute noch kein Plan steht) entstehen fehlende Lexeme je Quelle über `createIfMissing` mit `src: 'v5:col' | 'v5:job' | 'v5:band'`. `buildDayPlan` mischt die neuen Kandidaten nach Quelle (gewichtetes Reißverschluss-Verfahren), Geschwister bleiben gesperrt.
- **Begegnung im Lesen** schreibt nur einen `vlog`-Eintrag, nie FSRS (Unit-Test ausdrücklich).

## Einstufung (`vmod/place`)
- Stufen 2.500–4.000, 4.000–6.000, 6.000–8.000, 8.000–10.000, 10.000–12.000 (Atlas-Rang).
- Je Stufe 6× erkennen (Satz mit markiertem Wort, 4 deutsche Bedeutungen gleicher Wortart) und 2× selbst bilden (Deutsch, Lücke mit Anfangsbuchstabe). Sicher bei ≥ 5/6 und ≥ 1/2; Stopp an der ersten unsicheren Stufe.
- Speichert `{v: 1, t, edge, bands, ok: [Wörter]}`; ändert keine Wörter und keinen Plan. Erreichbar über die Übersicht (Fortschritt › Wörter) und Einstellungen › Wörter, nicht auf der Start-Karte (eine rote Linie).

## Abweichung vom Plan (technisch)
- **Keine `vlex`-Bündel vorerst.** Neue Lexeme werden normale Dokumente (`vocab/…`, `chunk/…`) wie bisher. Grund: Die Kopie auf dem Test-Link hat 196 Dokumente; bei 5 neuen Wörtern am Tag dauert es ≈ 2,5 Jahre bis zur Grenze von 5.000. Warnschwellen 4.000/4.500 und Anzeige bleiben. Eintrag in `docs/entscheidungen.md`.

## Prüfen
- Unit: Quellen, Gewichte, Nachfüllen, gemischte Auswahl, Einstufungs-Auswertung, Begegnung ohne FSRS.
- `LICENSE-wordlists.md` im Modul (Quellen des Atlas laut `docs/atlas-quellen.md`).
- data-guard (neue Dokumente, `vmod/place`), english-teacher (die ersten 40 neuen Lexeme), ux-reviewer (Einstufung gegen `s3-*`), E2E.
