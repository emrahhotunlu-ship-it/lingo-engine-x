# P18 Inhalt K1 (kwt + err, Kapitel 1–3): Protokoll je Charge

Quellen: `scripts/c1x/k1/*.mjs` (Schreibformat) → `node scripts/c1x/build-k1.mjs` → `src/content/c1x/src/{kwt,err}/k1-*.json`. Eigener Prüfer `scripts/c1x/lib.mjs` (kwtNorm, scoreKwt, scoreErr, Dubletten gegen tasks-v2/Pattern/transforms), bis das echte Schema/checkContent auf dem Branch liegt. Kapitel nach `src/content/grammar/path.json` (k1–k3, 13 Themen).

| Charge | Datei | Zahl | Löser-Probe (blind) | Gegenlesung english-teacher | Harte Fehler | Entscheidung |
|---|---|---|---|---|---|---|
| 1 | kwt/k1-1 | 28 | 28/28 gelöst, 5 Hinweise | 100 % (28), 8 hart + 20 Verb. | 8 (29 %) | alle eingearbeitet |
| 2 | kwt/k1-2 | 32 | 32/32 gelöst, 6 Hinweise | 100 % (32), 8 hart + 22 Verb. | 8 (25 %) | alle eingearbeitet |
| 3 | err/k1-1 | 27 (9 fehlerfrei) | 27/27, 10 ohne Fehler erkannt | 100 % (27), 5 hart + 9 Verb. | 5 (19 %) | alle eingearbeitet |
| 4 | err/k1-2 | 27 (9 fehlerfrei) | 27/27, alle 9 fehlerfreien erkannt | 100 % (27), 3 hart + 13 Verb. | 3 (11 %) | alle eingearbeitet |
| 5 | err/k1-3 | 27 (9 fehlerfrei) | 27/27, alle 9 erkannt | 100 % (27), 4 hart + 8 Verb. | 4 (15 %) | alle eingearbeitet |
| 6 | err/k1-4 | 39 (12 fehlerfrei) | 39/39, alle 12 erkannt | 100 % (39), 3 hart + 10 fix + 8 Verb. | 3 (8 %) | alle eingearbeitet |

Summe: kwt 60 (28 + 32), err 120 (27 + 27 + 27 + 39), davon 39 fehlerfrei (32,5 %). Lösungsposition der Korrektur je 1/3 (27/27/27 je Stelle). Ernte: 0 kwt aus `nb/transforms.json` (die 30 Aufgaben dort liegen größtenteils in Kap. 4–7, Rest bereits in `tasks-v2`, Dubletten-Regel), 25 err aus den Regel-Fallen (angepasst, `scripts/c1x/harvest-err.mjs` listet die 24 Kandidaten), alle 39 fehlerfreien neu geschrieben. Größe: kwt ≈ 59 KB roh / 21 KB gepackt+Base64, err ≈ 105 KB roh / ≈ 35 KB (Gesamt-dist weit unter 5,2 MB). Offen: einzige Nachprüfung der Korrekturen steht aus; Abgleich mit echtem Schema/`checkContent` und ID-Kollision mit Pilot (`kwt-0001…`) sobald P12 auf dem Branch liegt.
